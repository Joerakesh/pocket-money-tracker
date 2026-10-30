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
import TransactionSection from "./transactions/TransactionSection";
import AccountsSection from "./accounts/AccountsSection";
import ActivitySection from "./activity/ActivitySection";
import PlanningSection from "./planning/PlanningSection";
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
const headings: Record<string, [string, string]> = {
  home: ["Overview", "Your essentials at a glance"],
  transaction: ["New transaction", "Record money in, money out and transfers"],
  activity: ["Activity", "Your spending and transaction history"],
  accounts: ["Accounts", "Manage your wallets and bank accounts"],
  plan: ["Plan", "Budgets, goals and recurring expenses"],
  more: ["Settings", "Manage your allowance and data"],
};
async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch("/api" + path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
const post = (body: unknown) => ({
  method: "POST",
  body: JSON.stringify(body),
});
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
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
  const [settings, setSettings] = useState<any>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""),
    [month, setMonth] = useState(""),
    [editing, setEditing] = useState<Tx | null>(null);
  const [importRows, setImportRows] = useState<any[]>([]);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [s, a, t, b, g, r, st] = await Promise.all([
        api<Summary>("/summary"),
        api<Account[]>("/accounts"),
        api<Tx[]>("/transactions"),
        api<Budget[]>("/budgets"),
        api<Goal[]>("/goals"),
        api<Recurring[]>("/recurring"),
        api("/settings"),
      ]);
      setSummary(s);
      setAccounts(a);
      setTransactions(t);
      setBudgets(b);
      setGoals(g);
      setRecurring(r);
      setSettings(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your ledger.");
    } finally {
      setBusy(false);
    }
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
    try {
      await api(
        "/" +
          (kind === "goal"
            ? "goals"
            : kind === "budget"
              ? "budgets"
              : "recurring"),
        post(payload),
      );
      notify("Saved successfully.");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save.");
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
      const result = await api(
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
  const [title, subtitle] = headings[tab];
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
        <div className="mx-0.5 mt-1 mb-4 flex min-h-[45px] items-end justify-between">
          <div>
            <h1 className="text-[25px] font-[780] tracking-[-.06em]">
              {title}
            </h1>
            <p className="mt-[3px] text-xs text-[#929bad]">{subtitle}</p>
          </div>
        </div>
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
          <section className={ui.card}>Loading your financial data…</section>
        ) : (
          <div className="grid grid-cols-1 items-start gap-[13px] [&>*]:w-full [&>*]:min-w-0">
            {tab === "home" && (
              <Overview
                summary={summary}
                accounts={accounts}
                transactions={transactions}
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
              <PlanningSection
                budgets={budgets}
                goals={goals}
                recurring={recurring}
                onSave={savePlan}
              />
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
