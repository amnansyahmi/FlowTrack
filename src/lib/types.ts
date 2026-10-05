export interface Category {
  id: string;
  name: string;
  icon: string;
  type: "income" | "expense" | "commitment";
  budget?: number;
}

export interface Income {
  id: string;
  amount: number;
  date: string; // ISO string
  note?: string;
  categoryId?: string;
  isSalary?: boolean;
  monthKey?: string; // YYYY-MM for salary
  source?: string;
  accountId?: string;
  repaymentId?: string;
}

export interface Expense {
  id: string;
  amount: number;
  date: string; // ISO string
  note?: string;
  categoryId: string;
  receiptId?: string;
  paymentMethod?: string;
  merchant?: string;
  accountId?: string;
  commitmentLogId?: string;
  debtPaymentId?: string;
}

export interface Commitment {
  id: string;
  title: string;
  amount: number;
  dueDateDay: number; // 1-31
  categoryId: string;
  note?: string;
  paymentMethod?: string;
  frequency: "weekly" | "monthly" | "yearly";
  startDate?: string;
  endDate?: string;
}

export interface CommitmentLog {
  id: string;
  commitmentId: string;
  monthYear: string; // YYYY-MM
  status: "paid" | "unpaid" | "overdue";
  paidDate?: string;
  receiptId?: string;
  note?: string;
  dueDate?: string;
  amount?: number;
  title?: string;
  accountId?: string;
}

export interface Receipt {
  id: string;
  data: string; // base64
  type: string;
  name: string;
  ocrText?: string;
  detectedData?: {
    amount?: number;
    date?: string;
    merchant?: string;
    paymentMethod?: string;
  };
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyAllocation?: number;
  deadline?: string;
  color?: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  date: string;
  monthYear: string;
  accountId?: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  monthKey: string;
  limit: number;
  note?: string;
}

export interface Debt {
  id: string;
  name: string;
  lender: string;
  originalAmount: number;
  remainingAmount: number;
  monthlyPayment: number;
  dueDay: number;
  interestRate?: number;
  startDate: string;
  note?: string;
  totalInstallments?: number;
  initialPaidInstallments?: number;
  archived?: boolean;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  date: string;
  receiptId?: string;
  note?: string;
  accountId?: string;
}

export interface MonthlySnapshot {
  id: string; // monthKey (YYYY-MM)
  totals: {
    income: number;
    expenses: number;
    commitments: {
      total: number;
      paid: number;
    };
    savings: number;
    debts: number;
    balance: number;
  };
  categories: { id: string; name: string; spent: number }[];
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: "bank" | "cash" | "ewallet";
  openingBalance: number;
  openingDate: string;
}
export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
}
export interface Receivable {
  id: string;
  name: string;
  borrower: string;
  originalAmount: number;
  remainingAmount: number;
  monthlyRepayment: number;
  dueDay: number;
  startDate: string;
  archived?: boolean;
}
export interface Repayment {
  id: string;
  receivableId: string;
  amount: number;
  date: string;
  accountId?: string;
}
export interface Settings {
  id: "preferences";
  savingsTarget: number;
  paydayDay: number;
}
export interface StoreData {
  categories: Category[];
  income: Income[];
  expenses: Expense[];
  commitments: Commitment[];
  commitmentLogs: CommitmentLog[];
  receipts: Receipt[];
  goals: Goal[];
  goalContributions: GoalContribution[];
  budgets: Budget[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  monthlySnapshots: MonthlySnapshot[];
  accounts: Account[];
  transfers: Transfer[];
  receivables: Receivable[];
  repayments: Repayment[];
  settings: Settings[];
}
export type StoreName = keyof StoreData;
export const STORE_NAMES: StoreName[] = [
  "categories",
  "income",
  "expenses",
  "commitments",
  "commitmentLogs",
  "receipts",
  "goals",
  "goalContributions",
  "budgets",
  "debts",
  "debtPayments",
  "monthlySnapshots",
  "accounts",
  "transfers",
  "receivables",
  "repayments",
  "settings",
];
export const emptyData = (): StoreData =>
  Object.fromEntries(
    STORE_NAMES.map((name) => [name, []]),
  ) as unknown as StoreData;
export const DEFAULT_SETTINGS: Settings = {
  id: "preferences",
  savingsTarget: 0,
  paydayDay: 25,
};
