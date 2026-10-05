import { amount } from "./validation";
export type ImportKind = "bill" | "budget" | "savings" | "income" | "skip";
export interface ImportLine {
  id: string;
  raw: string;
  name: string;
  amount: number | null;
  kind: ImportKind;
  warning?: string;
}
export function parseTextImport(text: string): ImportLine[] {
  return text
    .split(/\r?\n/)
    .map((raw, index): ImportLine | null => {
      if (!raw.trim()) return null;
      const clean = raw
        .trim()
        .replace(/^(?:\d+[.)]|[-*•☐])\s*/, "")
        .trim();
      const base = {
        id: String(index),
        raw: raw.trim(),
        name: clean,
        amount: null,
        kind: "skip" as ImportKind,
      };
      if (/^(?:balance|baki|total|jumlah|remaining)\b/i.test(clean))
        return {
          ...base,
          warning: "Summary line. Not imported automatically.",
        };
      // Amount may have a currency prefix, suffix, or a clear name/amount separator.
      const match =
        clean.match(
          /^(.*?)\s*(?:[-–—:=]\s*)?(?:RM|MYR)\s*([\d,]+(?:\.\d{1,2})?)\s*$/i,
        ) ??
        clean.match(
          /^(.*?)\s*[-–—:=]\s*([\d,]+(?:\.\d{1,2})?)\s*(?:RM|MYR)?\s*$/i,
        ) ??
        clean.match(/^(.*?)\s+([\d,]+(?:\.\d{1,2})?)\s*(?:RM|MYR)\s*$/i);
      if (!match || !match[1].trim())
        return {
          ...base,
          warning:
            "Unlabelled or unclear amount. Choose a type and enter a name and amount to include it.",
        };
      const name = match[1]
        .trim()
        .replace(/[-–—:=]\s*$/, "")
        .trim();
      if (
        match[2].includes(",") &&
        !/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(match[2])
      )
        return {
          ...base,
          name,
          warning: "Unclear number grouping. Review the amount manually.",
        };
      let value: number;
      try {
        value = amount(match[2].replaceAll(",", ""));
      } catch {
        return {
          ...base,
          name,
          warning: "Invalid amount. Review before importing.",
        };
      }
      let kind: ImportKind = "bill";
      if (/\b(saving[s]?|simpanan|tabung)\b/i.test(name)) kind = "savings";
      else if (/\b(salary|gaji|income|pendapatan)\b/i.test(name))
        kind = "income";
      else if (
        /\b(groceries|barang dapur|minyak|petrol|fuel|makan|food|susu|shopping|belanja|parking)\b/i.test(
          name,
        )
      )
        kind = "budget";
      return {
        ...base,
        name,
        amount: value,
        kind,
        warning: "Suggested type. Review before saving.",
      };
    })
    .filter((line): line is ImportLine => line !== null);
}
