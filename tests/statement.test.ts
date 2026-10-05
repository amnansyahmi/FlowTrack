import test from "node:test";
import assert from "node:assert/strict";
import { parseDebtStatement } from "../src/lib/debt-statement";
import { billImage, categoryIcon } from "../src/lib/icons";
import { emptyData } from "../src/lib/types";
import { makeBackup, parseBackup } from "../src/lib/backup";

test("bill icons recognise Malay and English names without confusing credit card with car", () => {
  for (const name of ["Kereta", "Car loan", "Minyak", "Parking"])
    assert.equal(categoryIcon(name), "car");
  for (const name of ["Loan Rumah", "House loan", "Rumah", "Home maintenance"])
    assert.equal(categoryIcon(name), "home");
  assert.equal(categoryIcon("Credit card"), "loan");
  assert.equal(categoryIcon("Insurance Alaia"), "shield");
  assert.equal(billImage({ title: "Netflix" }), "/logos/netflix.svg");
  assert.equal(billImage({ title: "Netflix", icon: "car" }), "/icons/car.svg");
});
test("credit card statement separates outstanding debt, minimum payment and credit limits", () => {
  const result = parseDebtStatement(
    "RHB CREDIT CARD\nCredit limit RM18,000.00\nAvailable credit RM7,118.00\nOutstanding balance RM10,882.00\nMinimum payment RM544.10\nMonthly instalment RM1,500.00\nPayment due date 15/10/2026",
  );
  assert.equal(result.remainingAmount, 10882);
  assert.equal(result.monthlyPayment, 1500);
  assert.equal(result.minimumPayment, 544.1);
  assert.equal(result.debtType, "credit-card");
  assert.equal(result.lender, "RHB");
  assert.equal(result.dueDate, "2026-10-15");
});
test("PayLater providers and labelled amounts are detected", () => {
  for (const [provider, type] of [
    ["SPayLater", "spaylater"],
    ["Grab PayLater", "grab-paylater"],
    ["Atome", "atome"],
  ]) {
    const result = parseDebtStatement(
      `${provider}\nTotal outstanding\nRM1,200.00\nAmount due RM200.00\nDue date 20 Oct 2026\nTotal instalments: 6\nPaid instalments: 2`,
    );
    assert.equal(result.debtType, type);
    assert.equal(result.remainingAmount, 1200);
    assert.equal(result.monthlyPayment, 200);
    assert.equal(result.totalInstallments, 6);
    assert.equal(result.initialPaidInstallments, 2);
    assert.equal(result.dueDate, "2026-10-20");
  }
});
test("Malay statement labels and explicit integer currency amounts work", () => {
  const result = parseDebtStatement(
    "SPayLater\nJumlah tertunggak RM1200\nAnsuran bulanan RM200\nJumlah asal RM1800\nTarikh bayaran 05/11/2026",
  );
  assert.equal(result.remainingAmount, 1200);
  assert.equal(result.monthlyPayment, 200);
  assert.equal(result.originalAmount, 1800);
  assert.equal(result.dueDate, "2026-11-05");
});
test("missing, ambiguous and minimum-only statement fields require review", () => {
  const missing = parseDebtStatement(
    "RHB VISA\nCredit limit RM18,000.00\nAvailable balance RM2,000.00\nCard number 1234 5678 9012 3456",
  );
  assert.equal(missing.remainingAmount, undefined);
  assert.equal(missing.monthlyPayment, undefined);
  assert.ok(missing.warnings.length >= 3);
  const min = parseDebtStatement(
    "Credit card\nStatement balance RM2000.00\nMinimum payment RM100.00",
  );
  assert.equal(min.monthlyPayment, 100);
  assert.ok(min.warnings.some((w) => w.includes("Only a minimum")));
  const multi = parseDebtStatement(
    "Outstanding balance RM1200.00\nOutstanding balance RM1400.00",
  );
  assert.ok(multi.warnings.some((w) => w.includes("Multiple amounts")));
});
test("negative and credit balances are never silently converted to debt", () => {
  for (const value of ["-RM100.00", "RM-100.00", "(100.00)", "RM100.00 CR"])
    assert.equal(
      parseDebtStatement(`Outstanding balance ${value}`).remainingAmount,
      undefined,
    );
});
test("bill icon and debt type survive backup; invalid values and missing statement attachments fail", () => {
  const data = emptyData();
  data.commitments = [
    {
      id: "bill",
      title: "Kereta",
      amount: 1100,
      dueDateDay: 1,
      categoryId: "subs",
      frequency: "monthly",
      icon: "car",
    },
  ];
  data.debts = [
    {
      id: "debt",
      name: "SPayLater",
      lender: "SPayLater",
      debtType: "spaylater",
      originalAmount: 1200,
      remainingAmount: 1200,
      monthlyPayment: 200,
      dueDay: 20,
      startDate: "2026-10-01",
    },
  ];
  assert.equal(parseBackup(makeBackup(data)).commitments[0].icon, "car");
  assert.equal(parseBackup(makeBackup(data)).debts[0].debtType, "spaylater");
  assert.throws(
    () =>
      parseBackup(
        makeBackup({
          ...data,
          commitments: [{ ...data.commitments[0], icon: "../evil" }] as never,
        }),
      ),
    /Invalid bill icon/,
  );
  assert.throws(
    () =>
      parseBackup(
        makeBackup({
          ...data,
          debts: [{ ...data.debts[0], debtType: "invalid" }] as never,
        }),
      ),
    /Invalid debt type/,
  );
  assert.throws(
    () =>
      parseBackup(
        makeBackup({
          ...data,
          debts: [{ ...data.debts[0], statementId: "missing" }],
        }),
      ),
    /missing debt statement/,
  );
});
