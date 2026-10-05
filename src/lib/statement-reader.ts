import { parseDebtStatement } from "./debt-statement";
import { readImageText, receiptImage } from "./ocr";

interface PdfTextItem {
  str: string;
  transform: number[];
}
interface PdfPage {
  getTextContent(): Promise<{ items: unknown[] }>;
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: unknown;
  }): { promise: Promise<void>; cancel(): void };
  cleanup(): void;
}
interface PdfDocument {
  numPages: number;
  getPage(number: number): Promise<PdfPage>;
}
interface PdfModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: {
    data: Uint8Array;
    password?: string;
    useSystemFonts: boolean;
    isEvalSupported: boolean;
  }): { promise: Promise<PdfDocument>; destroy(): Promise<void> };
}
function textItem(value: unknown): value is PdfTextItem {
  return (
    !!value &&
    typeof value === "object" &&
    "str" in value &&
    "transform" in value
  );
}
export async function readDebtStatement(
  file: File,
  signal: AbortSignal,
  onProgress: (message: string) => void,
  password = "",
) {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    const image = await receiptImage(file);
    onProgress("Reading statement image…");
    const result = await readImageText(file, signal);
    return { ...parseDebtStatement(result.text, result.confidence), image };
  }
  if (file.size > 12 * 1024 * 1024)
    throw new Error("PDF statements must be smaller than 12 MB.");
  if (signal.aborted) throw new Error("Statement reading cancelled.");
  const moduleUrl = "/vendor/pdfjs/pdf.mjs";
  const pdfjs = (await import(/* @vite-ignore */ moduleUrl)) as PdfModule;
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs";
  if (signal.aborted) throw new Error("Statement reading cancelled.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (signal.aborted) throw new Error("Statement reading cancelled.");
  const task = pdfjs.getDocument({
    data: bytes,
    password: password || undefined,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const cancel = () => {
    void task.destroy();
  };
  signal.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    cancel();
  }, 120000);
  try {
    const document = await task.promise;
    let raw = "";
    let image = "";
    const warnings: string[] = [];
    for (let index = 1; index <= Math.min(document.numPages, 5); index++) {
      if (signal.aborted || timedOut)
        throw new Error("Statement reading cancelled or timed out.");
      onProgress(
        `Reading PDF page ${index} of ${Math.min(document.numPages, 5)}…`,
      );
      const page = await document.getPage(index);
      try {
        const items = (await page.getTextContent()).items.filter(textItem);
        const rows = new Map<number, PdfTextItem[]>();
        for (const item of items) {
          const y = Math.round(item.transform[5] / 3) * 3;
          rows.set(y, [...(rows.get(y) ?? []), item]);
        }
        let pageText = [...rows.entries()]
          .sort(([a], [b]) => b - a)
          .map(([, row]) =>
            row
              .sort((a, b) => a.transform[4] - b.transform[4])
              .map((item) => item.str)
              .join(" "),
          )
          .join("\n");
        if (index === 1 || pageText.trim().length < 30) {
          const natural = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: Math.min(2, 1600 / Math.max(natural.width, natural.height)),
          });
          const canvas = window.document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Unable to render this statement.");
          const render = page.render({
            canvas,
            canvasContext: context,
            viewport,
          });
          const stopRender = () => render.cancel();
          signal.addEventListener("abort", stopRender, { once: true });
          try {
            await render.promise;
          } finally {
            signal.removeEventListener("abort", stopRender);
          }
          if (index === 1) image = canvas.toDataURL("image/jpeg", 0.8);
          if (pageText.trim().length < 30) {
            const blob = await new Promise<Blob>((resolve, reject) =>
              canvas.toBlob(
                (value) =>
                  value
                    ? resolve(value)
                    : reject(new Error("Unable to read this PDF page.")),
                "image/png",
              ),
            );
            onProgress(`Recognising scanned PDF page ${index}…`);
            pageText = (
              await readImageText(
                new File([blob], "statement-page.png", { type: "image/png" }),
                signal,
              )
            ).text;
          }
          canvas.width = 0;
          canvas.height = 0;
        }
        raw += `${pageText}\n`;
      } finally {
        page.cleanup();
      }
    }
    if (document.numPages > 5)
      warnings.push(
        "Only the first 5 pages were read. Review any balances or plans on later pages manually.",
      );
    const result = parseDebtStatement(raw);
    return { ...result, image, warnings: [...result.warnings, ...warnings] };
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException")
      throw new Error(
        "This PDF needs its password. Enter the password and choose Read file again.",
      );
    throw error;
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
    await task.destroy();
  }
}
