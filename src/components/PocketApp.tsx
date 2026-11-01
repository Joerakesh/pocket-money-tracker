"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import AppHeader from "./layout/AppHeader";
import BottomNavigation from "./layout/BottomNavigation";
import Overview from "./dashboard/Overview";
import DashboardSkeleton from "./dashboard/DashboardSkeleton";
import TransactionSection from "./transactions/TransactionSection";
import AccountsSection from "./accounts/AccountsSection";
import ActivitySection from "./activity/ActivitySection";
import PlanningSection from "./planning/PlanningSection";
import FinancialIntelligenceSection from "./planning/FinancialIntelligenceSection";
import DataManagementSection from "./settings/DataManagementSection";
import { ui } from "./ui";

type Account = {
  id: string;
  _id?: string;
  name: string;
  institution?: string;
  kind?: string;
  balance: number;
};
type Tx = {
  _id: string;
  type: string;
  amount: number;
  date: string;
  category?: string;
  note?: string;
  person?: string;
  accountId?: string;
  toAccountId?: string;
  settled?: boolean;
};
type Summary = {
  totalBalance: number;
  spendable: number;
  owedToFriends: number;
  owedByFriends: number;
  days: number;
  perDay: number;
  todaySpent: number;
  monthSpent: number;
  monthIncome: number;
  byCat: Record<string, number>;
  accounts?: Account[];
  recentTransactions?: Tx[];
  settings?: Settings;
};
type Budget = { _id?: string; category: string; amount: number };
type Goal = { _id?: string; name: string; target: number; saved: number };
type Recurring = {
  _id?: string;
  name: string;
  amountPaise?: number;
  amount?: number;
  dueDay: number;
  category: string;
  active?: boolean;
};
type Settings = {
  payday?: string;
  reserve?: number;
  reservePaise?: number;
  financialPlan?: {
    allocationPercentages: {
      essentials: number;
      savings: number;
      personal: number;
      future: number;
    };
    financialFloor: number;
    emergencyTarget: number;
  };
};
type ImportRow = {
  importKey?: string;
  date: string;
  description: string;
  amount: number;
};
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch("/api" + path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Request failed";
    throw new Error(message);
  }
  return data as T;
}
const post = (body: unknown) => ({
  method: "POST",
  body: JSON.stringify(body),
});
export default function PocketApp() {
  const [tab, setTab] = useState("home"),
    [type, setType] = useState("expense"),
    [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null),
    [accounts, setAccounts] = useState<Account[]>([]),
    [transactions, setTransactions] = useState<Tx[]>([]),
    [budgets, setBudgets] = useState<Budget[]>([]),
    [goals, setGoals] = useState<Goal[]>([]),
    [recurring, setRecurring] = useState<Recurring[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""),
    [month, setMonth] = useState(""),
    [editing, setEditing] = useState<Tx | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");

    // The home screen is backed by one request. The summary response also
    // carries the account snapshot and five latest transactions it displays.
    try {
      const s = await api<Summary>("/summary");
      setSummary(s);
      if (s.accounts) setAccounts(s.accounts);
      if (s.recentTransactions) setTransactions(s.recentTransactions);
      if (s.settings) setSettings(s.settings);
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your dashboard.");
      setBusy(false);
      return;
    }

    // Load the larger datasets independently after the first screen is ready.
    // One failed endpoint must not prevent the other sections from rendering.
    const backgroundLoads = [
      { name: "accounts", request: api<Account[]>("/accounts").then(setAccounts) },
      { name: "transactions", request: api<Tx[]>("/transactions").then(setTransactions) },
      { name: "budgets", request: api<Budget[]>("/budgets").then(setBudgets) },
      { name: "goals", request: api<Goal[]>("/goals").then(setGoals) },
      { name: "recurring items", request: api<Recurring[]>("/recurring").then(setRecurring) },
      { name: "settings", request: api<Settings>("/settings").then(setSettings) },
    ];
    void Promise.allSettled(backgroundLoads.map((item) => item.request)).then((results) => {
      const failed = results.flatMap((result, index) =>
        result.status === "rejected" ? [backgroundLoads[index].name] : [],
      );
      if (failed.length) {
        setError("Some sections could not be refreshed: " + failed.join(", ") + ".");
      }
    });
  }, []);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);
  const notify = (s: string) => {
    setNotice(s);
  };
  const visible = useMemo(
    () =>
      transactions.filter(
        (t) =>
          (!search ||
            [t.note, t.category, t.person, t.type].some((v) =>
              String(v || "")
                .toLowerCase()
                .includes(search.toLowerCase()),
            )) &&
          (!month || t.date.startsWith(month)),
      ),
    [transactions, search, month],
  );
  const saveTx = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      type,
      amount: Number(f.get("amount")),
      date: String(f.get("date") || new Date().toISOString().slice(0, 10)),
      category: String(f.get("category") || "Other"),
      note: String(f.get("note") || ""),
      accountId: String(f.get("accountId") || ""),
      toAccountId: String(f.get("toAccountId") || ""),
      person: String(f.get("person") || ""),
    };
    try {
      if (editing)
        await api("/transactions/" + editing._id, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      else await api("/transactions", post(payload));
      setEditing(null);
      notify(editing ? "Transaction updated." : "Transaction saved.");
      setTab("activity");
      await load();
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Could not save transaction.",
      );
    }
  };
  const createAccount = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api(
        "/accounts",
        post({
          institution: f.get("institution"),
          name: f.get("name"),
          kind: f.get("kind"),
          openingBalance: Number(f.get("openingBalance") || 0),
        }),
      );
      notify("Account created.");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not create account.");
    }
  };
  const savePlan = async (
    kind: "budget" | "goal" | "recurring",
    e: FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const id = String(f.get("_id") || "");
    const payload =
      kind === "budget"
        ? { category: f.get("category"), amount: Number(f.get("amount")) }
        : kind === "goal"
          ? {
              name: f.get("name"),
              target: Number(f.get("target")),
              saved: Number(f.get("saved") || 0),
            }
          : {
              name: f.get("name"),
              amount: Number(f.get("amount")),
              dueDay: Number(f.get("dueDay")),
              category: f.get("category"),
            };
    const endpoint =
      "/" +
      (kind === "goal" ? "goals" : kind === "budget" ? "budgets" : "recurring");
    try {
      await api(id ? endpoint + "/" + id : endpoint, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      notify("Saved successfully.");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save.");
    }
  };
  const removePlan = async (
    kind: "budget" | "goal" | "recurring",
    id: string,
  ) => {
    const label =
      kind === "budget"
        ? "category budget"
        : kind === "goal"
          ? "savings goal"
          : "recurring reminder";
    if (!window.confirm("Delete this " + label + "?")) return;
    const endpoint =
      kind === "goal" ? "goals" : kind === "budget" ? "budgets" : "recurring";
    try {
      await api("/" + endpoint + "/" + id, { method: "DELETE" });
      notify(label[0].toUpperCase() + label.slice(1) + " deleted.");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not delete item.");
    }
  };
  const saveSettings = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api("/settings", {
        method: "PUT",
        body: JSON.stringify({
          payday: f.get("payday"),
          reserve: Number(f.get("reserve") || 0),
        }),
      });
      notify("Settings saved.");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save settings.");
    }
  };
  const saveFinancialPlan = async (
    financialPlan: NonNullable<Settings["financialPlan"]>,
  ) => {
    await api("/financial-plan", {
      method: "PUT",
      body: JSON.stringify(financialPlan),
    });
    await load();
  };
  const removeTx = async (tx: Tx) => {
    if (!window.confirm("Move this transaction to deleted history?")) return;
    try {
      await api("/transactions/" + tx._id, { method: "DELETE" });
      notify("Transaction deleted.");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Delete failed.");
    }
  };
  const previewCsv = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = new FormData(e.currentTarget).get("csv") as File;
    if (!file) return;
    try {
      const res = await fetch("/api/import/preview", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: await file.text(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setImportRows(data.rows || []);
      notify("CSV preview ready.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "CSV preview failed.");
    }
  };
  const commitCsv = async (accountId: string) => {
    try {
      const result = await api<{ added: number; skipped: number }>(
        "/import/commit",
        post({ rows: importRows, accountId }),
      );
      notify(
        "Imported " + result.added + " rows; " + result.skipped + " skipped.",
      );
      setImportRows([]);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Import failed.");
    }
  };
  return (
    <>
      <main
        key={refreshKey}
        className="mx-auto max-w-[620px] px-[18px] pt-6 pb-[125px] min-[760px]:pt-8 max-[420px]:px-[13px] max-[420px]:pt-4 max-[360px]:px-[11px]"
      >
        <AppHeader
          onRefresh={() => setRefreshKey((x) => x + 1)}
          onSettings={() => setTab("more")}
        />
        {error && (
          <div
            className={`${ui.card} mb-[13px] text-xs text-[#ff7887] [overflow-wrap:anywhere]`}
            role="alert"
          >
            {error}{" "}
            <button
              type="button"
              className={`${ui.ghost} ml-2 !w-auto !px-2.5 !py-1.5`}
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        )}
        {notice && (
          <div
            className={`${ui.card} mb-[13px] text-xs text-[#b8f36b] [overflow-wrap:anywhere]`}
            role="status"
          >
            {notice}
            <button
              type="button"
              aria-label="Dismiss"
              className={`${ui.ghost} ml-2 !w-auto !px-2.5 !py-1.5`}
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        {busy && !summary ? (
          <DashboardSkeleton />
        ) : (
          <div className="grid grid-cols-1 items-start gap-[13px] [&>*]:w-full [&>*]:min-w-0">
            {tab === "home" && (
              <Overview
                summary={summary}
                accounts={summary?.accounts ?? accounts}
                transactions={summary?.recentTransactions ?? transactions}
                onNavigate={(next, nextType) => {
                  setTab(next);
                  if (nextType) setType(nextType);
                  setEditing(null);
                }}
              />
            )}
            {tab === "transaction" && (
              <TransactionSection
                type={type}
                setType={setType}
                accounts={accounts}
                onSubmit={saveTx}
                editing={editing}
              />
            )}
            {tab === "accounts" && (
              <AccountsSection accounts={accounts} onSubmit={createAccount} />
            )}
            {tab === "activity" && (
              <ActivitySection
                transactions={visible}
                search={search}
                onSearch={setSearch}
                month={month}
                onMonth={setMonth}
                onEdit={(tx) => {
                  setEditing(tx);
                  setType(tx.type);
                  setTab("transaction");
                }}
                onDelete={removeTx}
              />
            )}
            {tab === "plan" && (
              <>
                <PlanningSection
                  budgets={budgets}
                  goals={goals}
                  recurring={recurring}
                  onSave={savePlan}
                  onDelete={removePlan}
                />
                <FinancialIntelligenceSection
                  summary={summary}
                  transactions={transactions}
                  budgets={budgets}
                  settings={settings}
                  onSave={saveFinancialPlan}
                />
              </>
            )}
            {tab === "more" && (
              <DataManagementSection
                settings={settings}
                onSave={saveSettings}
                onPreview={previewCsv}
                accounts={accounts}
                importRows={importRows}
                onCommit={commitCsv}
              />
            )}
          </div>
        )}
      </main>
      <BottomNavigation
        active={tab}
        onChange={(next) => {
          setEditing(null);
          setTab(next);
        }}
      />
      <button
        type="button"
        aria-label="Add transaction"
        onClick={() => {
          setEditing(null);
          setType("expense");
          setTab("transaction");
        }}
        className="fixed right-[max(18px,calc((100vw_-_620px)/2_+_18px))] bottom-[calc(17px_+_env(safe-area-inset-bottom))] z-[60] grid size-[54px] cursor-pointer place-items-center rounded-full border-0 bg-[#b8f36b] p-0 text-[32px] leading-none text-[#101608] shadow-[0_10px_30px_rgba(0,0,0,.53),0_0_0_6px_rgba(184,243,107,.1)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#b8f36b]"
      >
        ＋
      </button>
    </>
  );
}
