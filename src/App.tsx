import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useFinance } from "./hooks/use-finance";
import { dateKey, shiftMonth } from "./lib/finance";
import { Button } from "./components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import { ImageIcon, navigationIcons } from "./components/image-icon";
import { useMobileViewport } from "./hooks/use-mobile-viewport";
import { Panel, SelectField } from "./components/shared";
import { EntryDialog, type Editor } from "./components/entry-dialog";
import { PaymentDialog, type Payment } from "./components/payment-dialog";
import { Dashboard } from "./pages/dashboard";
import { Transactions } from "./pages/transactions";
import { Bills } from "./pages/bills";
import { Plans } from "./pages/plans";
import { Budgets } from "./pages/budgets";
import { Accounts } from "./pages/accounts";
import { Settings } from "./pages/settings";
const DebtStatementDialog = lazy(() =>
  import("./components/debt-statement-dialog").then((module) => ({
    default: module.DebtStatementDialog,
  })),
);
const Reports = lazy(() => import("./pages/reports"));
const ImportDialog = lazy(() =>
  import("./components/import-dialog").then((m) => ({
    default: m.ImportDialog,
  })),
);
const ScanDialog = lazy(() =>
  import("./components/scan-dialog").then((m) => ({ default: m.ScanDialog })),
);
const views = [
  "Home",
  "Transactions",
  "Bills",
  "Plans",
  "Budgets",
  "Accounts",
  "Reports",
  "Settings",
  "More",
];
export default function App() {
  useMobileViewport();
  const finance = useFinance();
  const [view, setView] = useState(
    () =>
      views.find((v) => v.toLowerCase() === window.location.hash.slice(1)) ??
      "Home",
  );
  const [month, setMonth] = useState(dateKey().slice(0, 7));
  const [editor, setEditor] = useState<Editor | null>(null);
  const [statementEditor, setStatementEditor] = useState<Editor | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [scan, setScan] = useState<File | null>(null);
  const scanInput = useRef<HTMLInputElement>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () =>
      finance.setError(
        "Offline installation failed. Reload while connected to try again.",
      ),
  });
  useEffect(() => {
    const change = () =>
      setView(
        views.find((v) => v.toLowerCase() === window.location.hash.slice(1)) ??
          "Home",
      );
    window.addEventListener("hashchange", change);
    const onOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
    };
  }, []);
  useEffect(() => {
    if (!finance.message) return;
    const timer = window.setTimeout(() => finance.setMessage(""), 4500);
    return () => window.clearTimeout(timer);
  }, [finance.message, finance.setMessage]);
  function navigate(next: string) {
    setView(next);
    window.location.hash = next.toLowerCase();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function edit(next: Editor) {
    finance.setError("");
    setEditor(next);
  }
  function openStatement(next: Editor = { kind: "debts" }) {
    setEditor(null);
    setStatementEditor(next);
  }
  const props = {
    finance,
    month,
    onEdit: edit,
    onPayment: (next: Payment) => {
      finance.setError("");
      setPayment(next);
    },
  };
  if (finance.loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p role="status" className="text-sm text-muted-foreground">
          Opening FlowTrack…
        </p>
      </div>
    );
  if (finance.error && !finance.data.settings.length)
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="mb-4 text-xl font-semibold">Unable to open your data</h1>
        <p role="alert" className="mb-6 text-sm text-destructive">
          {finance.error}
        </p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </main>
    );
  return (
    <div className="min-h-screen">
      <aside className="desktop-sidebar">
        <a className="brand" href="#home" onClick={() => navigate("Home")}>
          <span className="brand-mark">
            <ImageIcon name="brand" />
          </span>
          FlowTrack
        </a>
        <p className="mt-2 text-xs text-muted-foreground">
          Personal finance, clearly.
        </p>
        <nav aria-label="Desktop navigation" className="mt-10 space-y-1">
          {views
            .filter((v) => v !== "More")
            .map((label) => (
              <Button
                key={label}
                className="w-full justify-start"
                variant={view === label ? "secondary" : "ghost"}
                aria-current={view === label ? "page" : undefined}
                onClick={() => navigate(label)}
              >
                <ImageIcon name={navigationIcons[label]} />
                {label}
              </Button>
            ))}
        </nav>
        <p className="mt-auto pt-10 text-xs text-muted-foreground">
          {online ? "Stored on this device" : "Offline · Stored on this device"}
        </p>
      </aside>
      <div className="app-content">
        <header className="app-header">
          <div>
            <a
              href="#home"
              className="brand lg:hidden"
              onClick={() => navigate("Home")}
            >
              <span className="brand-mark">
                <ImageIcon name="brand" />
              </span>
              FlowTrack
            </a>
            <p className="hidden text-sm text-muted-foreground lg:block">
              Your money, in view.
            </p>
          </div>
          <div className="month-switcher">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ImageIcon name="left" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Choose reporting month"
                >
                  <ImageIcon name="calendar" />
                  <span>
                    {new Date(`${month}-15T12:00:00`).toLocaleDateString(
                      "en-MY",
                      { month: "short", year: "numeric" },
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Month"
                    name="month"
                    value={month.slice(5)}
                    onChange={(value) =>
                      setMonth(`${month.slice(0, 4)}-${value}`)
                    }
                    options={Array.from({ length: 12 }, (_, index) => ({
                      value: String(index + 1).padStart(2, "0"),
                      label: new Date(2026, index).toLocaleDateString("en", {
                        month: "short",
                      }),
                    }))}
                  />
                  <SelectField
                    label="Year"
                    name="year"
                    value={month.slice(0, 4)}
                    onChange={(value) => setMonth(`${value}-${month.slice(5)}`)}
                    options={Array.from(
                      {
                        length: Math.max(
                          40,
                          Number(month.slice(0, 4)) - 2000 + 1,
                        ),
                      },
                      (_, index) => ({
                        value: String(2000 + index),
                        label: String(2000 + index),
                      }),
                    )}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setMonth(dateKey().slice(0, 7))}
                >
                  This month
                </Button>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ImageIcon name="right" />
            </Button>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <h1 className="text-2xl font-semibold tracking-tight">
              {view === "Home" ? "Overview" : view}
            </h1>
            {!online && (
              <span className="text-xs text-muted-foreground">Offline</span>
            )}
          </div>
          {needRefresh && (
            <div className="notice mb-4">
              <p className="text-sm">
                An update is ready. Finish your changes before reloading.
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  finance.pending ||
                  !!editor ||
                  !!payment ||
                  importOpen ||
                  !!scan ||
                  !!statementEditor
                }
                onClick={() => void updateServiceWorker(true)}
              >
                Update app
              </Button>
            </div>
          )}
          {finance.error && (
            <div role="alert" className="notice mb-4 text-destructive">
              <p className="text-sm">{finance.error}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => finance.setError("")}
              >
                Dismiss
              </Button>
            </div>
          )}
          {finance.message && (
            <div role="status" className="notice mb-4">
              <p className="text-sm">{finance.message}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => finance.setMessage("")}
              >
                Dismiss
              </Button>
            </div>
          )}
          <Suspense
            fallback={
              <p role="status" className="py-10 text-sm text-muted-foreground">
                Loading…
              </p>
            }
          >
            {view === "Home" && (
              <Dashboard
                {...props}
                onScan={() => scanInput.current?.click()}
                onView={navigate}
              />
            )}
            {view === "Transactions" && <Transactions {...props} />}
            {view === "Bills" && <Bills {...props} />}
            {view === "Plans" && (
              <Plans {...props} onStatement={openStatement} />
            )}
            {view === "Budgets" && <Budgets {...props} />}
            {view === "Accounts" && <Accounts {...props} />}
            {view === "Reports" && (
              <Reports finance={finance} month={month} onMonth={setMonth} />
            )}
            {view === "Settings" && (
              <Settings
                finance={finance}
                onEdit={edit}
                onImport={() => setImportOpen(true)}
              />
            )}
            {view === "More" && (
              <Panel title="More tools">
                <div className="divide-y">
                  {[
                    {
                      name: "Budgets",
                      description: "Monthly limits for your categories",
                    },
                    {
                      name: "Accounts",
                      description: "Bank, cash, e-wallets & transfers",
                    },
                    {
                      name: "Reports",
                      description: "Cash flow & monthly snapshots",
                    },
                    {
                      name: "Settings",
                      description: "Preferences, categories & backups",
                    },
                  ].map((item) => (
                    <Button
                      key={item.name}
                      variant="ghost"
                      className="h-auto w-full justify-between rounded-none py-5 text-left"
                      onClick={() => navigate(item.name)}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="icon-tile">
                          <ImageIcon name={navigationIcons[item.name]} />
                        </span>
                        <div>
                          <p>{item.name}</p>
                          <p className="mt-1 text-xs font-normal text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <ImageIcon name="right" className="size-4" />
                    </Button>
                  ))}
                </div>
                <Button
                  className="mt-5"
                  variant="outline"
                  onClick={() => setImportOpen(true)}
                >
                  <ImageIcon name="upload" />
                  Import file or paste text
                </Button>
              </Panel>
            )}
          </Suspense>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Main navigation">
        {["Home", "Transactions", "Bills", "Plans", "More"].map((label) => (
          <Button
            variant="ghost"
            key={label}
            className="nav-tab"
            aria-current={
              view === label ||
              (label === "More" &&
                ["Budgets", "Accounts", "Reports", "Settings"].includes(view))
                ? "page"
                : undefined
            }
            onClick={() => navigate(label)}
          >
            <span className="nav-icon">
              <ImageIcon name={navigationIcons[label]} />
            </span>
            <span className="nav-label">{label}</span>
          </Button>
        ))}
      </nav>
      <input
        ref={scanInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setScan(file);
          event.target.value = "";
        }}
      />
      {editor && (
        <EntryDialog
          key={`${editor.kind}:${editor.row?.id ?? editor.row?.title ?? "new"}`}
          editor={editor}
          {...props}
          onStatement={openStatement}
          onClose={() => setEditor(null)}
        />
      )}
      {payment && (
        <PaymentDialog
          key={payment.kind === "bill" ? payment.occurrence.id : payment.id}
          payment={payment}
          finance={finance}
          month={month}
          onClose={() => setPayment(null)}
        />
      )}
      <Suspense fallback={null}>
        {statementEditor && (
          <DebtStatementDialog
            editor={statementEditor}
            onClose={() => setStatementEditor(null)}
            onReview={(next) => {
              setStatementEditor(null);
              setEditor(next);
            }}
          />
        )}
        {importOpen && (
          <ImportDialog
            finance={finance}
            month={month}
            onClose={() => setImportOpen(false)}
          />
        )}
        {scan && (
          <ScanDialog
            file={scan}
            finance={finance}
            onClose={() => setScan(null)}
          />
        )}
      </Suspense>
    </div>
  );
}
