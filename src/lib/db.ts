import {
  STORE_NAMES,
  emptyData,
  type StoreData,
  type StoreName,
} from "./types";
export * from "./types";

const DB_NAME = "FlowTrackDB";
export const DB_VERSION = 4;
let connection: Promise<IDBDatabase> | undefined;

export function openDB(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      connection = undefined;
      reject(
        new Error(
          "Close other FlowTrack tabs, then retry the database upgrade.",
        ),
      );
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      const indexes: Partial<Record<StoreName, [string, string][]>> = {
        commitmentLogs: [
          ["by_commitment", "commitmentId"],
          ["by_month", "monthYear"],
        ],
        goalContributions: [
          ["by_goal", "goalId"],
          ["by_month", "monthYear"],
        ],
        budgets: [["by_month", "monthKey"]],
        debtPayments: [["by_debt", "debtId"]],
        repayments: [["by_receivable", "receivableId"]],
      };
      for (const name of STORE_NAMES) {
        const store = db.objectStoreNames.contains(name)
          ? request.transaction!.objectStore(name)
          : db.createObjectStore(name, { keyPath: "id" });
        for (const [index, key] of indexes[name] ?? []) {
          if (!store.indexNames.contains(index))
            store.createIndex(index, key, { unique: false });
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        connection = undefined;
      };
      resolve(db);
    };
  });
  return connection;
}

type Row =
  StoreData[StoreName][number] | ({ id: string } & Record<string, unknown>);
export type Change = {
  store: StoreName;
  value?: Row;
  deleteId?: string;
  expected?: Row | null;
};
/** One transaction: either every linked record commits or none do. */
export async function commitChanges(changes: Change[]): Promise<void> {
  if (!changes.length) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      [...new Set(changes.map((c) => c.store))],
      "readwrite",
    );
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error("The changes could not be saved."));
    tx.onerror = () => {
      /* onabort reports the final transaction result */
    };
    try {
      for (const change of changes) {
        const store = tx.objectStore(change.store);
        const write = () => {
          if (change.deleteId !== undefined) store.delete(change.deleteId);
          else if (change.value) store.put(change.value);
        };
        if (Object.prototype.hasOwnProperty.call(change, "expected")) {
          const request = store.get(change.deleteId ?? change.value!.id);
          request.onsuccess = () => {
            if (
              JSON.stringify(request.result ?? null) !==
              JSON.stringify(change.expected)
            ) {
              reject(
                new Error(
                  "This record changed in another tab. Reload and retry your change.",
                ),
              );
              tx.abort();
            } else write();
          };
        } else write();
      }
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}

export async function loadData(): Promise<StoreData> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const result = emptyData();
    const tx = db.transaction(STORE_NAMES, "readonly");
    tx.oncomplete = () => resolve(result);
    tx.onabort = () =>
      reject(tx.error ?? new Error("Unable to read your data."));
    for (const name of STORE_NAMES) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        (result[name] as unknown[]) = request.result;
      };
    }
  });
}

/** Validated by backup.ts before reaching this function. */
export async function replaceData(data: StoreData): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAMES, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        tx.error ?? new Error("Restore failed; existing data was retained."),
      );
    try {
      for (const name of STORE_NAMES) {
        const store = tx.objectStore(name);
        store.clear();
        for (const item of data[name]) store.add(item);
      }
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}
