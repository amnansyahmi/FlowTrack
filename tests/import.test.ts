import test from "node:test";
import assert from "node:assert/strict";
import { parseTextImport } from "../src/lib/text-import";
import { parseReceipt } from "../src/lib/ocr";
import { makeBackup, parseBackup, validateData } from "../src/lib/backup";
import { emptyData } from "../src/lib/types";
import { amount } from "../src/lib/validation";
test("Malay list distinguishes bills, budgets, savings, and ambiguous totals", () => {
  const rows = parseTextImport(
    "1. Loan Rumah - RM1300\n2. Netflix - RM50\n3. Groceries - RM400\n4. Saving - RM200\n5. Minyak - RM300\n3800\n5000\nBalance - RM400+-",
  );
  assert.deepEqual(
    rows.map((r) => r.kind),
    ["bill", "bill", "budget", "savings", "budget", "skip", "skip", "skip"],
  );
  assert.equal(rows[0].amount, 1300);
  assert.equal(rows[1].name, "Netflix");
});
test("similar list formats and labelled income are supported", () => {
  const rows = parseTextImport(
    "• Gaji: RM 7,000.00\nInternet = 150 MYR\nNetflix 50 RM\n- Simpanan - 200",
  );
  assert.deepEqual(
    rows.map((r) => r.kind),
    ["income", "bill", "bill", "savings"],
  );
  assert.equal(rows[0].amount, 7000);
});
test("uncertain and approximate values require review", () => {
  assert.equal(parseTextImport("Netflix - RM50+-")[0].kind, "skip");
  assert.equal(parseTextImport("Loan - RM0")[0].kind, "skip");
});
test("receipt final total outranks subtotal, cash tendered, and change", () => {
  const parsed = parseReceipt(
    "SHOP\nSUBTOTAL 90.00\nTOTAL RM 95.40\nCASH 100.00\nCHANGE 4.60\n05/10/2026",
    95,
  );
  assert.equal(parsed.amount, 95.4);
  assert.equal(parsed.date, "2026-10-05");
});
test("OCR supports comma amounts, named dates and Malaysian labels", () => {
  const parsed = parseReceipt("SHOP\nJumlah Bayar: RM 1,250.50\n03 MAY 2026");
  assert.equal(parsed.amount, 1250.5);
  assert.equal(parsed.date, "2026-05-03");
});
test("OCR never silently uses a subtotal when final total is absent", () => {
  assert.equal(parseReceipt("SHOP\nSUBTOTAL 90.00").amount, 0);
  assert.ok(parseReceipt("SHOP\nTOTAL 20.00\n31/02/2026").warnings.length > 0);
});
test("versioned and legacy backups round-trip", () => {
  const data = emptyData();
  data.income = [{ id: "i", amount: 100, date: "2026-01-01" }];
  assert.deepEqual(parseBackup(makeBackup(data)), data);
  assert.deepEqual(parseBackup(JSON.stringify(data)), data);
});
test("backup rejects unknown stores, invalid amounts, malformed dates and duplicate IDs", () => {
  assert.throws(() => validateData({ ...emptyData(), unknown: [] }));
  assert.throws(() =>
    validateData({
      ...emptyData(),
      income: [{ id: "i", amount: "100", date: "2026-01-01" }],
    }),
  );
  assert.throws(() =>
    validateData({
      ...emptyData(),
      income: [{ id: "i", amount: 100, date: "2026-02-31" }],
    }),
  );
  assert.throws(() =>
    validateData({
      ...emptyData(),
      income: [
        { id: "i", amount: 100, date: "2026-01-01" },
        { id: "i", amount: 100, date: "2026-01-01" },
      ],
    }),
  );
});
test("backup rejects unsupported versions and missing linked accounts", () => {
  assert.throws(() =>
    parseBackup(
      JSON.stringify({ app: "FlowTrack", version: 99, data: emptyData() }),
    ),
  );
  assert.throws(() =>
    validateData({
      ...emptyData(),
      income: [
        { id: "i", amount: 100, date: "2026-01-01", accountId: "missing" },
      ],
    }),
  );
});
test("backup rejects inconsistent and duplicated linked payments", () => {
  const data = emptyData();
  data.debtPayments = [
    { id: "p", debtId: "d", amount: 100, date: "2026-01-01" },
  ];
  data.expenses = [
    {
      id: "e",
      amount: 50,
      date: "2026-01-01",
      categoryId: "debt",
      debtPaymentId: "p",
    },
  ];
  assert.throws(() => validateData(data));
});
test("numeric entry rejects negative, non-finite, and overprecise money", () => {
  for (const value of ["-1", "NaN", "Infinity", "1.234", "50oops", ""])
    assert.throws(() => amount(value));
  assert.equal(amount("50.20"), 50.2);
});
