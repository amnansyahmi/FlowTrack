import { test, expect, type Page } from "@playwright/test";
import {
  emptyData,
  DEFAULT_SETTINGS,
  type StoreData,
} from "../../src/lib/types";
import { dateKey, money } from "../../src/lib/finance";
import { makeBackup } from "../../src/lib/backup";
const today = dateKey();
const month = today.slice(0, 7);
function fixture() {
  const data = emptyData();
  data.settings = [DEFAULT_SETTINGS];
  data.categories = [
    { id: "food", name: "Food", icon: "", type: "expense" },
    { id: "bills", name: "Bills", icon: "", type: "expense" },
    { id: "debt", name: "Debt", icon: "", type: "expense" },
    { id: "salary", name: "Salary", icon: "", type: "income" },
    { id: "subs", name: "Subscriptions", icon: "", type: "commitment" },
  ];
  return data;
}
async function seed(page: Page, data: StoreData) {
  await page.goto("/");
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  await page.evaluate(async (records) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("FlowTrackDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(Object.keys(records), "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      for (const [name, rows] of Object.entries(records)) {
        const store = tx.objectStore(name);
        store.clear();
        for (const row of rows) store.put(row);
      }
    });
    db.close();
  }, data);
  await page.reload();
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
}
async function view(page: Page, name: string) {
  await page
    .locator(".desktop-sidebar")
    .getByRole("button", { name, exact: true })
    .click();
}
async function restore(page: Page, data: StoreData) {
  await view(page, "Settings");
  await page.getByRole("button", { name: "Import file or paste text" }).click();
  await page.getByLabel("Backup JSON or expense list").fill(makeBackup(data));
  await page.getByRole("button", { name: "Preview import" }).click();
  await page.getByRole("button", { name: "Restore backup" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("bill payment, linked history and reversal preserve safe spending", async ({
  page,
}) => {
  const data = fixture();
  data.income = [{ id: "i", amount: 1000, date: today }];
  data.commitments = [
    {
      id: "bill",
      title: "Netflix",
      amount: 100,
      dueDateDay: Number(today.slice(8)),
      frequency: "monthly",
      categoryId: "subs",
      startDate: `${month}-01`,
    },
  ];
  await seed(page, data);
  await expect(page.getByTestId("safe-to-spend")).toHaveText(/RM\s*900\.00/);
  await page.getByRole("button", { name: "Pay", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("safe-to-spend")).toHaveText(/RM\s*900\.00/);
  await view(page, "Transactions");
  await expect(page.getByText("Bill payment · Linked")).toBeVisible();
  await page.getByRole("button", { name: "Reverse", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByText("Bill payment · Linked")).toHaveCount(0);
  await view(page, "Home");
  await expect(page.getByTestId("safe-to-spend")).toHaveText(/RM\s*900\.00/);
});

test("calendar picker, expense editing and savings preferences work after reload", async ({
  page,
}) => {
  const data = fixture();
  data.income = [{ id: "i", amount: 1000, date: today }];
  await seed(page, data);
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (RM)").fill("25.50");
  await dialog.getByRole("button", { name: "Date", exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await dialog.getByLabel("Merchant").fill("Lunch");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("safe-to-spend")).toHaveText(/RM\s*974\.50/);
  await view(page, "Transactions");
  await page.getByRole("button", { name: "Edit", exact: true }).last().click();
  await page.getByRole("dialog").getByLabel("Amount (RM)").fill("30");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await view(page, "Settings");
  await page.getByLabel("Monthly savings target (RM)").fill("200");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved.");
  await page.reload();
  await expect(page.getByLabel("Monthly savings target (RM)")).toHaveValue(
    "200",
  );
  await view(page, "Home");
  await expect(page.getByTestId("safe-to-spend")).toHaveText(/RM\s*770\.00/);
});

test("subscription preset requires plan price and renders its SVG logo", async ({
  page,
}) => {
  await seed(page, fixture());
  await view(page, "Bills");
  await page.getByRole("button", { name: /Netflix Movies/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Bill name")).toHaveValue("Netflix");
  await dialog.getByLabel("Amount (RM)").fill("50");
  await dialog.getByLabel("Due day (1–31)").fill("5");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.locator('img[src="/logos/netflix.svg"]').first(),
  ).toBeVisible();
  await expect(page.getByText("Netflix", { exact: true })).toHaveCount(3);
});

test("paste import reviews the example list and skips standalone totals", async ({
  page,
}) => {
  await seed(page, fixture());
  await view(page, "Settings");
  await page.getByRole("button", { name: "Import file or paste text" }).click();
  await page
    .getByLabel("Backup JSON or expense list")
    .fill(
      "1. Loan Rumah - RM1300\n2. Maintenance Rumah - RM200\n3. Bills - RM200\n4. Internet & data - RM150\n5. Credit card - RM400\n6. Nafkah - RM300\n7. Netflix - RM50\n8. Groceries - RM400\n9. Saving - RM200\n10. Minyak - RM300\n11. insurance - RM400\n12. kereta - RM1200\n13. Parking - RM80\n14. Pengasuh - RM400\n15. susu - RM200\n16. Makan - RM300\n\n3800\n5000\nBalance - RM400+-",
    );
  await page.getByRole("button", { name: "Preview import" }).click();
  await expect(
    page.getByText("Unlabelled or unclear amount.", { exact: false }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Import reviewed rows" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Monthly savings target (RM)")).toHaveValue(
    "200",
  );
  await view(page, "Bills");
  await expect(page.getByText("Loan Rumah", { exact: true })).toHaveCount(2);
  await view(page, "Transactions");
  await expect(
    page.getByText("No matching transactions this month."),
  ).toBeVisible();
});

test("JSON text restore validates data and replaces it only after confirmation", async ({
  page,
}) => {
  await seed(page, fixture());
  await view(page, "Settings");
  await page.getByRole("button", { name: "Import file or paste text" }).click();
  await page
    .getByLabel("Backup JSON or expense list")
    .fill('{"app":"FlowTrack","version":99}');
  await page.getByRole("button", { name: "Preview import" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Unsupported backup version",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  const restored = fixture();
  restored.income = [{ id: "restored", amount: 1234, date: today }];
  await restore(page, restored);
  await view(page, "Home");
  await expect(page.getByTestId("safe-to-spend")).toHaveText(/RM\s*1,234\.00/);
});

test("debt payments and receivable repayments update balances once", async ({
  page,
}) => {
  const data = fixture();
  data.income = [{ id: "salary-tx", amount: 1000, date: today }];
  data.debts = [
    {
      id: "d",
      name: "Phone instalments",
      lender: "Bank",
      originalAmount: 100,
      remainingAmount: 100,
      monthlyPayment: 100,
      dueDay: 5,
      startDate: `${month}-01`,
      totalInstallments: 1,
    },
  ];
  data.receivables = [
    {
      id: "r",
      name: "Family advance",
      borrower: "Family",
      originalAmount: 200,
      remainingAmount: 200,
      monthlyRepayment: 50,
      dueDay: 5,
      startDate: `${month}-01`,
    },
  ];
  await seed(page, data);
  await expect(page.getByTestId("safe-to-spend")).toHaveText(/RM\s*900\.00/);
  await view(page, "Plans");
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Record payment", exact: true }),
  ).toBeDisabled();
  await view(page, "Home");
  await expect(page.getByTestId("safe-to-spend")).toHaveText(/RM\s*900\.00/);
  await view(page, "Plans");
  await page
    .getByRole("button", { name: "Money owed to you", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Receive repayment", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await view(page, "Home");
  await expect(page.getByTestId("safe-to-spend")).toHaveText(/RM\s*950\.00/);
});

test("monthly budget editing stays in its month", async ({ page }) => {
  await seed(page, fixture());
  await view(page, "Budgets");
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page.getByRole("dialog").getByLabel("Budget limit (RM)").fill("200");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByText(/of RM\s*200\.00/)).toBeVisible();
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.getByText(/of RM\s*200\.00/)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  await expect(page.getByText(/of RM\s*200\.00/)).toBeVisible();
});

test("mobile navigation, calendar, and SVG assets fit narrow screens", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Bills", exact: true })
    .click();
  await page.getByRole("button", { name: /Netflix Movies/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start date", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Today", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-calendar.png" });
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "More", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Settings Preferences/ }),
  ).toBeVisible();
  await expect(
    page
      .locator(".mobile-nav")
      .getByRole("button", { name: "More", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/mobile-more.png" });
});

test("installed app reloads and opens lazy reports while offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await view(page, "Reports");
  await expect(
    page.getByText("Monthly overview", { exact: true }),
  ).toBeVisible();
  await view(page, "Settings");
  await page.getByRole("button", { name: "Import file or paste text" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("account transfers and savings contributions reconcile cash balances", async ({
  page,
}) => {
  const data = fixture();
  data.accounts = [
    {
      id: "a",
      name: "Bank account",
      type: "bank",
      openingBalance: 1000,
      openingDate: `${month}-01`,
    },
    {
      id: "b",
      name: "E-wallet",
      type: "ewallet",
      openingBalance: 0,
      openingDate: `${month}-01`,
    },
  ];
  data.goals = [
    { id: "g", name: "Emergency fund", targetAmount: 500, currentAmount: 0 },
  ];
  await seed(page, data);
  await view(page, "Accounts");
  await page.getByRole("button", { name: "Add transfer" }).click();
  await page.getByRole("dialog").getByLabel("Amount (RM)").fill("100");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByText(/RM\s*900\.00/)).toBeVisible();
  await view(page, "Home");
  await expect(page.getByTestId("safe-to-spend")).toHaveText(/RM\s*1,000\.00/);
  await view(page, "Plans");
  await page
    .getByRole("button", { name: "Savings goals", exact: true })
    .click();
  await page.getByRole("button", { name: "Add contribution" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (RM)").fill("100");
  await dialog.getByRole("combobox", { name: "Account", exact: true }).click();
  await page.getByRole("option", { name: "Bank account", exact: true }).click();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await view(page, "Home");
  await expect(page.getByTestId("safe-to-spend")).toHaveText(/RM\s*900\.00/);
  await view(page, "Accounts");
  await expect(page.getByText(/RM\s*800\.00/)).toBeVisible();
});

test("receipt attachments are compressed, viewable, and included in exported backups", async ({
  page,
}) => {
  const data = fixture();
  data.expenses = [
    {
      id: "expense",
      amount: 10,
      date: today,
      categoryId: "food",
      merchant: "Test receipt",
    },
  ];
  await seed(page, data);
  await view(page, "Transactions");
  const choose = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Attach receipt" }).click();
  await (await choose).setFiles("public/icon-192.png");
  await expect(page.getByRole("status")).toContainText("Receipt attached.");
  await page.getByRole("button", { name: "View receipt" }).click();
  await expect(page.getByRole("dialog").getByRole("img")).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await view(page, "Settings");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON backup" }).click();
  const download = await downloading;
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  const { parseBackup } = await import("../../src/lib/backup");
  const restored = parseBackup(await readFile(path!, "utf8"));
  expect(restored.receipts).toHaveLength(1);
  expect(restored.expenses[0].receiptId).toBe(restored.receipts[0].id);
});

test("bill editing and manual image icons persist from the monthly payment list", async ({
  page,
}) => {
  const data = fixture();
  data.commitments = [
    {
      id: "car",
      title: "Kereta",
      amount: 1100,
      dueDateDay: 1,
      frequency: "monthly",
      categoryId: "subs",
      startDate: `${month}-01`,
    },
  ];
  await page.setViewportSize({ width: 375, height: 812 });
  await seed(page, data);
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Bills", exact: true })
    .click();
  const row = page.locator(".bill-payment");
  await expect(row.locator("img")).toHaveAttribute("src", "/icons/car.svg");
  await row.getByRole("button", { name: "Edit Kereta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (RM)").fill("1200");
  await dialog.getByLabel("Bill icon", { exact: true }).click();
  await page.getByRole("button", { name: "Use House icon" }).click();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row.getByText(/RM\s*1,200.00/)).toBeVisible();
  await expect(row.locator("img")).toHaveAttribute("src", "/icons/home.svg");
  await page.reload();
  await expect(page.locator(".bill-payment img")).toHaveAttribute(
    "src",
    "/icons/home.svg",
  );
});

test("save confirmations dismiss automatically and do not hide the updated data", async ({
  page,
}) => {
  await seed(page, fixture());
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (RM)").fill("25");
  await dialog.getByLabel("Merchant").fill("Dinner");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved." }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved." }),
  ).toHaveCount(0, { timeout: 7000 });
  await expect(page.getByTestId("safe-to-spend")).toHaveText(money(-25));
});

test("real PDF statement becomes a reviewed debt with a saved preview", async ({
  page,
}) => {
  await seed(page, fixture());
  await view(page, "Plans");
  await page
    .getByRole("button", {
      name: "Upload statement or screenshot",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Upload debt statement")
    .setInputFiles("tests/fixtures/credit-card.pdf");
  await page
    .getByRole("button", { name: "Review & edit debt", exact: true })
    .waitFor({ timeout: 20000 });
  await expect(
    page.getByRole("dialog").getByText(/RM\s*1,200.00/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review & edit debt", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Remaining amount (RM)")).toHaveValue("1200");
  await expect(dialog.getByLabel("Monthly payment (RM)")).toHaveValue("200");
  await expect(dialog.getByLabel("Due day", { exact: true })).toHaveValue("15");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("CIMB credit card", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Statement preview", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("img")).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
  );
});

test("PayLater statement text and presets require confirmation before creating debt", async ({
  page,
}) => {
  await seed(page, fixture());
  await view(page, "Plans");
  for (const provider of ["Credit card", "SPayLater", "Grab PayLater", "Atome"])
    await expect(
      page.getByRole("button", { name: provider, exact: true }),
    ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Upload statement or screenshot",
      exact: true,
    })
    .click();
  await page.getByText("Paste statement text instead", { exact: true }).click();
  await page
    .getByLabel("Statement text")
    .fill(
      "Atome\nTotal outstanding RM600.00\nMonthly instalment RM200.00\nDue date 20/10/2026",
    );
  await page.getByRole("button", { name: "Detect statement details" }).click();
  await page.getByRole("button", { name: "Review & edit debt" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Atome");
  await expect(dialog.getByLabel("Remaining amount (RM)")).toHaveValue("600");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Atome", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/Remaining of RM\s*600.00/)).toBeVisible();
});

test("PWA shell and populated mobile screens fit phone and tablet widths", async ({
  page,
}) => {
  test.setTimeout(60000);
  const data = fixture();
  data.income = [{ id: "i", amount: 7000, date: today }];
  data.commitments = [
    {
      id: "house",
      title: "Loan Rumah",
      amount: 1300,
      dueDateDay: 1,
      frequency: "monthly",
      categoryId: "subs",
      startDate: `${month}-01`,
    },
    {
      id: "internet",
      title: "Internet + CelcomDigi family plan",
      amount: 150,
      dueDateDay: 1,
      frequency: "monthly",
      categoryId: "subs",
      startDate: `${month}-01`,
    },
  ];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page, data);
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of [
      "Home",
      "Transactions",
      "Bills",
      "Plans",
      "More",
      "Budgets",
      "Accounts",
      "Reports",
      "Settings",
    ]) {
      if (width >= 1024) {
        if (name === "More") continue;
        await view(page, name);
      } else if (
        ["Budgets", "Accounts", "Reports", "Settings"].includes(name)
      ) {
        await page
          .locator(".mobile-nav")
          .getByRole("button", { name: "More", exact: true })
          .click();
        await page
          .getByRole("button", { name: new RegExp(`^${name} `) })
          .click();
        await page.getByRole("heading", { name, exact: true }).waitFor();
      } else
        await page
          .locator(".mobile-nav")
          .getByRole("button", { name, exact: true })
          .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390)
        await page.screenshot({
          path: `test-results/pwa-${name.toLowerCase()}.png`,
        });
    }
    if (width < 1024) {
      const nav = await page.locator(".mobile-nav").boundingBox();
      expect(nav?.width).toBe(width);
      expect((nav?.y ?? 0) + (nav?.height ?? 0)).toBe(844);
      await expect(page.locator(".mobile-nav img")).toHaveCount(5);
    }
  }
  expect(
    await page.locator('meta[name="viewport"]').getAttribute("content"),
  ).toContain("user-scalable=no");
  expect(
    await page.evaluate(() => {
      const event = new Event("gesturestart", { cancelable: true });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(true);
  expect(errors).toEqual([]);
});
