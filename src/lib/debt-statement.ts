import { validDate } from "./validation";

export const debtTypes = [
  { value: "credit-card", label: "Credit card", icon: "loan" },
  { value: "spaylater", label: "SPayLater", icon: "shopping" },
  { value: "grab-paylater", label: "Grab PayLater", icon: "wallet" },
  { value: "atome", label: "Atome", icon: "receipt" },
  { value: "loan", label: "Other loan", icon: "bank" },
] as const;
export type DebtType = (typeof debtTypes)[number]["value"];
export function isDebtType(value: unknown): value is DebtType {
  return debtTypes.some((type) => type.value === value);
}

export function parseDebtStatement(raw: string, confidence?: number) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const amounts = (line: string) => {
    // Never interpret dates, card numbers, credit limits, or percentages as money.
    const decimal = [
      ...line.matchAll(
        /(?:RM|MYR)?\s*((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?!\d|\s*%)/gi,
      ),
    ].map((m) => Number(m[1].replaceAll(",", "")));
    if (decimal.length) return decimal;
    return [
      ...line.matchAll(/(?:RM|MYR)\s*((?:\d{1,3}(?:,\d{3})+|\d+))(?![\d.,])/gi),
    ].map((m) => Number(m[1].replaceAll(",", "")));
  };
  const warnings: string[] = [];
  function find(
    labels: RegExp[],
    exclude = /credit\s*limit|available\s*(?:credit|balance)|had\s*kredit|previous\s*balance|baki\s*terdahulu/i,
  ) {
    for (const label of labels) {
      const values: number[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (!label.test(lines[i]) || exclude.test(lines[i])) continue;
        if (
          /[-−]\s*(?:RM|MYR)?\s*\d|(?:RM|MYR)\s*[-−]\s*\d|\([^)]*\d+\.\d{2}[^)]*\)|\bCR\b/i.test(
            lines[i],
          )
        ) {
          warnings.push(
            "A negative or credit balance was found. Check this field manually.",
          );
          continue;
        }
        const same = amounts(lines[i]);
        const next =
          !same.length && /^(?:RM|MYR)?\s*[\d,.]+\s*$/.test(lines[i + 1] ?? "")
            ? amounts(lines[i + 1])
            : [];
        values.push(...(same.length ? same : next));
      }
      const unique = [
        ...new Set(
          values.filter((v) => Number.isFinite(v) && v >= 0 && v <= 100000000),
        ),
      ];
      if (unique.length > 1) {
        warnings.push(
          "Multiple amounts match a statement field. Check the selected amount against your statement.",
        );
        return unique[0];
      }
      if (unique.length) return unique[0];
    }
    return undefined;
  }
  const remainingAmount = find([
    /total\s*outstanding|outstanding\s*(?:balance|amount)|baki\s*(?:tertunggak|belum\s*bayar)|jumlah\s*tertunggak|remaining\s*(?:balance|amount)/i,
    /statement\s*balance|new\s*balance|current\s*balance|baki\s*penyata/i,
  ]);
  const originalAmount = find([
    /original\s*(?:amount|principal)|financed\s*amount|jumlah\s*(?:asal|pembiayaan)/i,
  ]);
  const minimumPayment = find([
    /minimum\s*(?:payment|amount\s*due)|bayaran\s*minimum/i,
  ]);
  const instalment = find([
    /(?:monthly|month['’]?s)\s*(?:instal[l]?ment|payment)|instal[l]?ment\s*amount|ansuran\s*bulanan/i,
  ]);
  const amountDue = find(
    [
      /total\s*(?:payment\s*)?due|amount\s*due|payment\s*due|jumlah\s*(?:perlu\s*dibayar|bayaran)|bil\s*semasa/i,
    ],
    /minimum|date|tarikh|credit\s*limit|available/i,
  );
  const monthlyPayment = instalment ?? amountDue ?? minimumPayment;
  if (remainingAmount === undefined)
    warnings.push(
      "Outstanding balance was not identified. Enter it in the debt form; the credit limit is never used as debt.",
    );
  if (monthlyPayment === undefined)
    warnings.push(
      "Monthly payment was not identified. Enter your planned payment.",
    );
  else if (instalment === undefined && amountDue === undefined)
    warnings.push(
      "Only a minimum payment was found. It is suggested for review, not treated as the full outstanding balance.",
    );
  if (originalAmount === undefined)
    warnings.push(
      "Original debt amount was not identified. For a new debt, the outstanding balance is used as the starting amount; change it if needed.",
    );
  let dueDate: string | undefined;
  const dueLine = lines.findIndex((line) =>
    /due\s*date|payment\s*deadline|pay\s*by|tarikh\s*(?:akhir|bayaran|matang)/i.test(
      line,
    ),
  );
  if (dueLine >= 0) {
    const value = `${lines[dueLine]} ${lines[dueLine + 1] ?? ""}`;
    const iso = value.match(/\b\d{4}-\d{2}-\d{2}\b/);
    const numeric = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})\b/);
    const named = value.match(
      /\b(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{4})\b/i,
    );
    if (iso) dueDate = iso[0];
    else if (numeric)
      dueDate = `${numeric[3].length === 2 ? "20" : ""}${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
    else if (named)
      dueDate = `${named[3]}-${String(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(named[2].toUpperCase()) + 1).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
    if (!validDate(dueDate)) dueDate = undefined;
  }
  if (!dueDate)
    warnings.push(
      "Due date was not identified. Check the due day before saving.",
    );
  const type: DebtType = /s\s*pay\s*later|shopee/i.test(raw)
    ? "spaylater"
    : /grab/i.test(raw)
      ? "grab-paylater"
      : /atome/i.test(raw)
        ? "atome"
        : /credit\s*card|kad\s*kredit|visa|mastercard/i.test(raw)
          ? "credit-card"
          : "loan";
  const bank = raw.match(
    /\b(MAYBANK|CIMB|RHB|HSBC|HONG\s*LEONG|PUBLIC\s*BANK|AMBANK|AFFIN|UOB|OCBC|BANK\s*ISLAM|STANDARD\s*CHARTERED)\b/i,
  )?.[1];
  const lender =
    type === "spaylater"
      ? "SPayLater"
      : type === "grab-paylater"
        ? "Grab PayLater"
        : type === "atome"
          ? "Atome"
          : (bank ?? "");
  const totalInstallments = raw.match(
    /(?:total\s*instal[l]?ments|tenure|jumlah\s*ansuran)\s*[:=-]?\s*(\d{1,3})\b/i,
  )?.[1];
  const initialPaidInstallments = raw.match(
    /(?:paid\s*instal[l]?ments|instal[l]?ments\s*paid|ansuran\s*dibayar)\s*[:=-]?\s*(\d{1,3})\b/i,
  )?.[1];
  return {
    raw,
    confidence,
    warnings,
    debtType: type,
    lender,
    name: lender
      ? `${lender}${type === "credit-card" ? " credit card" : ""}`
      : "",
    remainingAmount,
    originalAmount,
    monthlyPayment,
    minimumPayment,
    dueDate,
    totalInstallments: totalInstallments
      ? Number(totalInstallments)
      : undefined,
    initialPaidInstallments: initialPaidInstallments
      ? Number(initialPaidInstallments)
      : undefined,
  };
}
