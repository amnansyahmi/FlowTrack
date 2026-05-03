const DB_NAME = 'FlowTrackDB';
const DB_VERSION = 3;

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'income' | 'expense' | 'commitment';
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
}

export interface Commitment {
  id: string;
  title: string;
  amount: number;
  dueDateDay: number; // 1-31
  categoryId: string;
  note?: string;
  paymentMethod?: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  startDate?: string;
  endDate?: string;
}

export interface CommitmentLog {
  id: string;
  commitmentId: string;
  monthYear: string; // YYYY-MM
  status: 'paid' | 'unpaid' | 'overdue';
  paidDate?: string;
  receiptId?: string;
  note?: string;
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
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  date: string;
  receiptId?: string;
  note?: string;
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
  categories: { id: string, name: string, spent: number }[];
  createdAt: string;
}

export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;

      const stores = [
        { name: 'categories', key: 'id' },
        { name: 'income', key: 'id' },
        { name: 'expenses', key: 'id' },
        { name: 'commitments', key: 'id' },
        { name: 'commitmentLogs', key: 'id', indexes: [['by_commitment', 'commitmentId'], ['by_month', 'monthYear']] },
        { name: 'receipts', key: 'id' },
        { name: 'goals', key: 'id' },
        { name: 'goalContributions', key: 'id', indexes: [['by_goal', 'goalId'], ['by_month', 'monthYear']] },
        { name: 'budgets', key: 'id', indexes: [['by_month', 'monthKey']] },
        { name: 'debts', key: 'id' },
        { name: 'debtPayments', key: 'id', indexes: [['by_debt', 'debtId']] },
        { name: 'monthlySnapshots', key: 'id' }
      ];

      stores.forEach(s => {
        if (!db.objectStoreNames.contains(s.name)) {
          const store = db.createObjectStore(s.name, { keyPath: s.key });
          if (s.indexes) {
            s.indexes.forEach(idx => store.createIndex(idx[0], idx[1], { unique: false }));
          }
        }
      });
    };
  });
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function add<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function update<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function remove(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getById<T>(storeName: string, id: string): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
