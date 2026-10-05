import test from "node:test";
import assert from "node:assert/strict";
import { indexedDB } from "fake-indexeddb";
import { commitChanges, loadData, openDB, replaceData } from "../src/lib/db";
import { emptyData, STORE_NAMES } from "../src/lib/types";
Object.assign(globalThis, { indexedDB });
test("v3 upgrade retains existing records and adds new stores", async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("FlowTrackDB", 3);
    request.onupgradeneeded = () => {
      for (const name of STORE_NAMES.slice(0, 12))
        request.result.createObjectStore(name, { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("income", "readwrite");
      tx.objectStore("income").put({
        id: "legacy",
        amount: 100,
        date: "2026-01-01",
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
  const db = await openDB();
  assert.equal(db.version, 4);
  assert.ok(db.objectStoreNames.contains("accounts"));
  assert.equal((await loadData()).income[0].id, "legacy");
  assert.ok(
    db
      .transaction("commitmentLogs")
      .objectStore("commitmentLogs")
      .indexNames.contains("by_month"),
  );
});
test("a failed multi-store transaction rolls back all linked writes", async () => {
  await assert.rejects(
    commitChanges([
      {
        store: "expenses",
        value: {
          id: "rollback",
          amount: 10,
          date: "2026-01-01",
          categoryId: "food",
        },
      },
      { store: "receipts", value: { id: "bad", callback: () => undefined } },
    ]),
  );
  assert.equal((await loadData()).expenses.length, 0);
});
test("failed restore retains all original data", async () => {
  const data = emptyData();
  data.income = [
    { id: "duplicate", amount: 20, date: "2026-01-01" },
    { id: "duplicate", amount: 30, date: "2026-01-01" },
  ];
  await assert.rejects(replaceData(data));
  assert.equal((await loadData()).income[0].id, "legacy");
});
test("optimistic concurrency rejects a stale edit without partial writes", async () => {
  const old = (await loadData()).income[0];
  await commitChanges([{ store: "income", value: { ...old, amount: 200 } }]);
  await assert.rejects(
    commitChanges([
      { store: "income", value: { ...old, amount: 300 }, expected: old },
      {
        store: "expenses",
        value: {
          id: "conflict",
          amount: 1,
          date: "2026-01-01",
          categoryId: "food",
        },
        expected: null,
      },
    ]),
  );
  const data = await loadData();
  assert.equal(data.income[0].amount, 200);
  assert.equal(data.expenses.length, 0);
});
test("valid atomic restore replaces records in every store", async () => {
  const data = emptyData();
  data.settings = [{ id: "preferences", savingsTarget: 200, paydayDay: 25 }];
  await replaceData(data);
  const stored = await loadData();
  assert.equal(stored.income.length, 0);
  assert.equal(stored.settings[0].savingsTarget, 200);
});
