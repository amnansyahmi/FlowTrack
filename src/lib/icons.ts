import { subscriptionLogo } from "./subscriptions";
export type IconName =
  | "home"
  | "activity"
  | "receipt"
  | "target"
  | "grid"
  | "budget"
  | "wallet"
  | "chart"
  | "settings"
  | "plus"
  | "income"
  | "expense"
  | "scan"
  | "calendar"
  | "left"
  | "right"
  | "down"
  | "savings"
  | "transfer"
  | "edit"
  | "copy"
  | "trash"
  | "upload"
  | "download"
  | "search"
  | "bank"
  | "clock"
  | "check"
  | "loan"
  | "cloud"
  | "groceries"
  | "car"
  | "shield"
  | "food"
  | "utility"
  | "shopping"
  | "family"
  | "brand";

export const navigationIcons: Record<string, IconName> = {
  Home: "home",
  Transactions: "activity",
  Bills: "receipt",
  Plans: "target",
  Budgets: "budget",
  Accounts: "wallet",
  Reports: "chart",
  Settings: "settings",
  More: "grid",
};

export function categoryIcon(name: string): IconName {
  const value = name.toLowerCase();
  if (/grocer|barang|susu/.test(value)) return "groceries";
  if (/food|makan|dining/.test(value)) return "food";
  if (/transport|\bcar\b|kereta|fuel|minyak|parking/.test(value)) return "car";
  if (/insurance|insurans|takaful/.test(value)) return "shield";
  if (/home|house|rumah|rent/.test(value)) return "home";
  if (/credit|kad kredit|spay|paylater|loan|hutang/.test(value)) return "loan";
  if (/utilit|bill|internet|data/.test(value)) return "utility";
  if (/family|child|pengasuh|nafkah/.test(value)) return "family";
  if (/saving|simpan/.test(value)) return "savings";
  if (/shop|personal/.test(value)) return "shopping";
  if (/salary|income|gaji/.test(value)) return "income";
  return "receipt";
}

export const billIconChoices = [
  { name: "car", label: "Car" },
  { name: "home", label: "House" },
  { name: "shield", label: "Insurance" },
  { name: "utility", label: "Utilities" },
  { name: "groceries", label: "Groceries" },
  { name: "food", label: "Food" },
  { name: "family", label: "Family" },
  { name: "loan", label: "Credit card" },
  { name: "receipt", label: "Bill" },
  { name: "shopping", label: "Shopping" },
  { name: "savings", label: "Savings" },
  { name: "cloud", label: "Internet" },
  { name: "wallet", label: "Wallet" },
  { name: "bank", label: "Bank" },
  { name: "target", label: "Goal" },
  { name: "calendar", label: "Calendar" },
] as const satisfies { name: IconName; label: string }[];
export type BillIcon = (typeof billIconChoices)[number]["name"];
export function isBillIcon(value: unknown): value is BillIcon {
  return billIconChoices.some((choice) => choice.name === value);
}
export function billImage(bill: { title: string; icon?: BillIcon }): string {
  return bill.icon && isBillIcon(bill.icon)
    ? `/icons/${bill.icon}.svg`
    : (subscriptionLogo(bill.title) ??
        `/icons/${categoryIcon(bill.title)}.svg`);
}
