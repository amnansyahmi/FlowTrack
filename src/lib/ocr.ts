import { validDate } from "./validation";
import { dateKey } from "./finance";
export function parseReceipt(text: string, confidence = 0) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const moneyPattern =
    "(?:RM\\s*)?((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{2}))";
  const labels = [
    /(?:grand\s*total|total\s*(?:due|payable|paid)|jumlah\s*(?:bayar|keseluruhan))/i,
    /^(?:total|amount(?:\s+paid)?|amt|jumlah)\b/i,
  ];
  let amount: number | undefined;
  for (const label of labels) {
    for (const line of lines) {
      if (
        /sub\s*total|cash\s*(?:tendered|received)|change|balance/i.test(line) ||
        !label.test(line)
      )
        continue;
      const match = line.match(new RegExp(moneyPattern, "i"));
      if (match) amount = Number(match[1].replaceAll(",", ""));
    }
    if (amount !== undefined) break;
  }
  let date = "";
  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/);
  const named = text.match(
    /\b(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{4})\b/i,
  );
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso) date = iso[0];
  else if (named)
    date = `${named[3]}-${String(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(named[2].toUpperCase()) + 1).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
  else if (numeric)
    date = `${numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  const warnings: string[] = [];
  if (amount === undefined || amount <= 0)
    warnings.push("Final total could not be identified. Enter it manually.");
  if (!validDate(date)) {
    date = dateKey();
    warnings.push("Receipt date could not be identified. Today is selected.");
  }
  return {
    merchant: lines[0] ?? "",
    amount: amount ?? 0,
    date,
    confidence,
    warnings,
    raw: text,
  };
}
export async function readImageText(file: File, signal?: AbortSignal) {
  const { createWorker } = await import("tesseract.js");
  if (signal?.aborted) throw new Error("Receipt scan cancelled.");
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let cancelled = false;
  let cancel: () => void = () => {};
  let timer: ReturnType<typeof setTimeout>;
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => {
      cancelled = true;
      reject(new Error("Receipt scan cancelled."));
    };
    signal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => {
      cancelled = true;
      reject(
        new Error(
          "Scanning timed out. Try another image or add the expense manually.",
        ),
      );
    }, 60000);
  });
  try {
    worker = await Promise.race([
      createWorker("eng").then((created) => {
        if (cancelled) {
          void created.terminate();
          throw new Error("Receipt scan cancelled.");
        }
        return created;
      }),
      interrupted,
    ]);
    const result = await Promise.race([worker.recognize(file), interrupted]);
    return { text: result.data.text, confidence: result.data.confidence };
  } finally {
    clearTimeout(timer!);
    signal?.removeEventListener("abort", cancel);
    await worker?.terminate();
  }
}
export async function scanReceipt(file: File, signal?: AbortSignal) {
  const result = await readImageText(file, signal);
  return parseReceipt(result.text, result.confidence);
}
export async function receiptImage(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");
  if (file.size > 8 * 1024 * 1024)
    throw new Error("Receipt images must be smaller than 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to process this image.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}
