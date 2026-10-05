export function amount(
  value: FormDataEntryValue | string | number | null,
  label = "Amount",
  allowZero = false,
): number {
  if (value === null || String(value).trim() === "")
    throw new Error(`${label} is required.`);
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    (allowZero ? number < 0 : number <= 0) ||
    number > 100000000 ||
    Math.abs(number * 100 - Math.round(number * 100)) > 0.00001
  ) {
    throw new Error(
      `${label} must be ${allowZero ? "zero or " : ""}a positive amount with at most two decimal places.`,
    );
  }
  return Math.round(number * 100) / 100;
}
export function day(
  value: FormDataEntryValue | string | number | null,
): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 31)
    throw new Error("Due day must be between 1 and 31.");
  return number;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value))
    return false;
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value.slice(0, 10)
  );
}
export function date(value: FormDataEntryValue | null): string {
  if (!validDate(value)) throw new Error("Choose a valid date.");
  return value;
}
export function text(value: FormDataEntryValue | null, label: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} is required.`);
  if (value.length > 500) throw new Error(`${label} is too long.`);
  return value.trim();
}
