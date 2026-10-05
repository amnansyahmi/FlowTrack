# FlowTrack

A mobile-first personal finance tracker built with React, TypeScript, Vite, shadcn/ui, and IndexedDB. Records stay on the current device; no API keys or cloud account are required.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Build and preview the installable offline app:

```sh
npm run build
npm run preview
```

## What you can track

- Income and expenses, with editing, search, receipt attachments, and payment history.
- Weekly, monthly, and yearly bills with dated occurrences, end dates, and reversible payments.
- Netflix, YouTube Premium, Spotify, Apple Music, iCloud+, and Apple TV+ shortcuts with local SVG logos. Enter the price of your own plan; presets do not assume current pricing.
- Separate monthly category budgets, including copying the previous month.
- Savings goals, contributions, a persistent savings target, and spending allowance until payday.
- Debts and fixed instalment plans, including principal outstanding and payoff estimates.
- Money owed to you, with repayments counted as income only when received.
- Bank, cash, and e-wallet accounts, opening balances, and internal transfers.
- Monthly reports and saved snapshots. Snapshots capture totals; they do not lock transactions.

## Import and backup

In **Settings → Import file or paste text**, choose a JSON file, paste a FlowTrack JSON backup, or paste a list such as:

```text
1. Loan Rumah - RM1300
2. Netflix - RM50
3. Groceries - RM400
4. Saving - RM200
Gaji: RM7000
```

Preview and edit each row before importing. The parser suggests recurring bills, category budgets, savings targets, and explicitly labelled income. Standalone numbers, approximate values, and balance/total lines are skipped until reviewed. Budgets are spending limits, not completed expenses. Existing bills with matching names are skipped to prevent duplicates. Imported bills default to monthly; choose a due day in the preview and edit dates/frequency afterward.

JSON backups use a versioned envelope and include all stores and receipt images. Legacy v3 exports are also accepted after validation. Restore requires confirmation and replaces the entire dataset in one transaction: a failed restore leaves the existing dataset intact. Text lists add records and replace matching monthly budget limits/the savings target; they do not replace the whole dataset. File imports are limited to 30 MB.

**Export a backup before clearing browser data, changing devices, or restoring another backup.** There is no cloud synchronization. The app can request persistent browser storage, but keep a separate backup.

## Calculation rules

Amounts are summed in integer cents. The available balance includes tracked account opening balances and previous-month carryover, then deducts completed expenses, bill/debt payments, and savings set aside. Each linked payment is counted once.

```text
Safe to spend = available balance
             − unpaid scheduled bills
             − remaining payments for each active debt
             − unfunded portion of the monthly savings target
```

Paying a reserved bill or debt reduces the balance and releases the corresponding reserve; it does not create extra spendable money. Negative projections remain visible. Future salary and expected repayments are not automatically counted as received income.

Savings contributions mean money moved outside the tracked bank/cash/e-wallet accounts; they reduce the source account and available balance. Initial savings entered on a goal are historical context and do not deduct cash again. Internal account transfers do not change total income or spending. Set an account opening balance before its first tracked transaction and do not include income already recorded in FlowTrack.

Bill payments use a date within their billing month. Due days beyond a month's length use the last day. Weekly bills repeat from their start date; yearly bills use its month. Existing v3 bills without a start date are anchored to their earliest recorded billing month, or the upgrade month if none exists. Review that anchor for old weekly/yearly bills. Paid legacy logs capture their current bill amount during migration; amounts that were already changed before the upgrade cannot be reconstructed automatically.

Debt plans track principal and fixed payments; interest/fees are not calculated automatically. Record only the principal reduction in a debt payment and record interest/fees as separate expenses. Payoff dates are estimates at the current payment amount. Existing manual expenses duplicating old bill/debt records must be reviewed and removed or reconciled; the app cannot infer these relationships safely.

## Offline and receipt scanning

The production service worker precaches core screens, lazy report/import/OCR modules, fonts, and local logos. It prompts when an update is ready. Finish open forms before updating. Receipt recognition uses Tesseract in the browser; its OCR worker/language files may need a connection on first use. Scanned fields always require review. Final-total labels take priority over subtotals or cash/change lines, and a saved scan retains a compressed receipt image.

## Checks

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

The regression suite covers cash flow, per-debt reserves, recurrence, short months, salary-month assignment, text/receipt parsing, backup validation, v3 database upgrades, atomic rollback, and stale-edit conflicts. Browser tests cover payments and reversals, calendar selection, preferences, subscriptions, imports, budget months, mobile layout, and offline reloads. GitHub Actions runs these checks for pull requests.

The app is split into calculation, validation, database, import, and transaction modules; a data hook; reusable shadcn controls; and feature screens. Reports and Tesseract are loaded on demand. See `THIRD_PARTY_NOTICES.md` for component and logo attribution.
