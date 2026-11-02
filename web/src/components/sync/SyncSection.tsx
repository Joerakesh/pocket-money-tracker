"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ui } from "../ui";
import { firebaseAuth } from "@/lib/firebase-client";

type Account = { id: string; name: string; institution?: string; balance: number };
type Candidate = {
  _id: string;
  amount: number;
  amountPaise: number;
  direction: "INCOME" | "EXPENSE" | "TRANSFER";
  reference?: string | null;
  accountSuffix?: string | null;
  counterparty?: string | null;
  date: string;
  sourcePackage: string;
  detectedAt: string;
  status: "PENDING" | "APPROVED" | "IGNORED";
  transferCandidate?: boolean;
  transactionId?: string;
};

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
}).format(value);
const sourceName = (pkg: string) => ({
  "com.google.android.apps.messaging": "Bank SMS",
  "com.google.android.apps.nbu.paisa.user": "Google Pay",
  "com.phonepe.app": "PhonePe",
  "net.one97.paytm": "Paytm",
  "in.org.npci.upiapp": "BHIM",
  "com.kotak811mobilebankingapp.instantsavingsupiscanandpayrecharge": "Kotak",
}[pkg] || "Bank notification");

export default function SyncSection({ accounts, onChanged }: {
  accounts: Account[];
  onChanged: () => void;
}) {
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [filter, setFilter] = useState("PENDING");
  const [accountByItem, setAccountByItem] = useState<Record<string, string>>({});
  const [destinationByItem, setDestinationByItem] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState("");

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const token = await firebaseAuth?.currentUser?.getIdToken();
    const response = await fetch("/api" + url, {
      ...init,
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: "Bearer " + token } : {}), ...init?.headers },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await request("/sync/notifications") as Candidate[];
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load synced notifications.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void refresh(); }, [refresh]);

  const counts = useMemo(() => ({
    pending: items.filter(x => x.status === "PENDING").length,
    approved: items.filter(x => x.status === "APPROVED").length,
    ignored: items.filter(x => x.status === "IGNORED").length,
  }), [items]);
  const visible = items.filter(x => filter === "ALL" || x.status === filter);

  const review = async (item: Candidate, action: "approve" | "ignore") => {
    setBusyId(item._id);
    setError("");
    try {
      const accountId = accountByItem[item._id] || accounts[0]?.id || "";
      const toAccountId = destinationByItem[item._id] || accounts.find(a => a.id !== accountId)?.id || "";
      await request("/sync/notifications/" + item._id + "/review", {
        method: "POST",
        body: JSON.stringify({
          action,
          accountId,
          toAccountId,
          category: item.direction === "TRANSFER" ? "Transfer" : "Needs review",
          note: item.counterparty || (item.direction === "TRANSFER" ? "Own-account transfer" : "Imported from bank notification"),
        }),
      });
      await refresh();
      if (action === "approve") onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update this notification.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="grid gap-[13px]">
      <div className={ui.hero}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className={ui.sectionLabel}>Pocket · Companion</span>
            <h2 className="mt-1 text-[25px] font-extrabold tracking-[-.05em]">Pocket Sync</h2>
            <p className="mt-1 text-xs text-[#aab4c4]">Bank alerts, organised before they reach your ledger.</p>
          </div>
          <span className="rounded-full border border-[#b8f36b]/20 bg-[#b8f36b]/10 px-3 py-1.5 text-[10px] font-bold text-[#b8f36b]">PHONE INBOX</span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-black/20 p-3"><b className="block text-xl">{counts.pending}</b><span className="text-[10px] text-[#aab4c4]">To review</span></div>
          <div className="rounded-2xl bg-black/20 p-3"><b className="block text-xl">{counts.approved}</b><span className="text-[10px] text-[#aab4c4]">Approved</span></div>
          <div className="rounded-2xl bg-black/20 p-3"><b className="block text-xl">{counts.ignored}</b><span className="text-[10px] text-[#aab4c4]">Ignored</span></div>
        </div>
      </div>

      <div className={ui.card}>
        <div className={ui.sectionHead}>
          <div><h3 className={ui.h2Flush}>Notification inbox</h3><p className={ui.note}>Candidates are separate from your ledger until you approve them.</p></div>
          <button type="button" className={ui.textAction} onClick={() => void refresh()} disabled={loading}>↻ Refresh</button>
        </div>
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {(["PENDING", "APPROVED", "IGNORED", "ALL"] as const).map(value => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-bold ${filter === value ? "bg-[#b8f36b] text-[#101608]" : "bg-[#252d3b] text-[#aab4c4]"}`}>
              {value === "ALL" ? "All" : value[0] + value.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {error && <p role="alert" className="mb-3 rounded-xl bg-[#ff7887]/10 p-3 text-xs text-[#ff9aa5]">{error}</p>}
        {loading ? <p className={ui.empty}>Loading notification inbox…</p> :
          visible.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center"><span className="text-2xl">⌁</span><p className="mt-2 text-sm font-bold">{filter === "PENDING" ? "You're all caught up" : "Nothing here yet"}</p><p className={ui.note}>New bank and UPI alerts from your phone will appear here after sync.</p></div> :
          <div className="grid">
            {visible.map(item => {
              const isTransfer = item.direction === "TRANSFER";
              const selectedAccount = accountByItem[item._id] || accounts[0]?.id || "";
              const destination = destinationByItem[item._id] || accounts.find(a => a.id !== selectedAccount)?.id || "";
              return <article key={item._id} className="border-b border-white/[.075] py-4 last:border-0">
                <div className="flex items-start gap-3">
                  <div className={`grid size-10 shrink-0 place-items-center rounded-[13px] text-sm font-black ${item.direction === "INCOME" ? "bg-[#b8f36b]/12 text-[#b8f36b]" : isTransfer ? "bg-[#83b8ff]/12 text-[#83b8ff]" : "bg-[#ff7887]/10 text-[#ff9aa5]"}`}>{isTransfer ? "⇄" : item.direction === "INCOME" ? "↓" : "↑"}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div><b className="block text-sm">{item.counterparty || (isTransfer ? "Possible own-account transfer" : sourceName(item.sourcePackage))}</b><span className="mt-1 block text-[10px] text-[#929bad]">{sourceName(item.sourcePackage)} · {item.date}</span></div>
                      <b className="whitespace-nowrap text-sm">{money(item.amount)}</b>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={ui.pill}>{item.status}</span>
                      <span className={ui.pill}>{item.direction}</span>
                      {item.accountSuffix && <span className={ui.pill}>A/c ··{item.accountSuffix}</span>}
                      {item.reference && <span className={ui.pill}>Ref {item.reference}</span>}
                    </div>
                  </div>
                </div>
                {item.status === "PENDING" && <div className="mt-3">
                  <button type="button" className={ui.textAction} onClick={() => setExpanded(expanded === item._id ? "" : item._id)}>{expanded === item._id ? "Hide review options" : "Review transaction"} ↓</button>
                  {expanded === item._id && <div className="mt-2 grid gap-2 rounded-2xl bg-[#0f141e] p-3">
                    <label className={ui.label}>Account {isTransfer ? "money moved from" : "to record against"}
                      <select className={ui.field} value={selectedAccount} onChange={e => setAccountByItem(v => ({...v,[item._id]:e.target.value}))}>
                        <option value="">Select account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.institution ? " · "+a.institution : ""}</option>)}
                      </select>
                    </label>
                    {isTransfer && <label className={ui.label}>Destination account
                      <select className={ui.field} value={destination} onChange={e => setDestinationByItem(v => ({...v,[item._id]:e.target.value}))}>
                        <option value="">Select destination</option>{accounts.filter(a => a.id !== selectedAccount).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </label>}
                    {accounts.length === 0 && <p className="text-xs text-[#ff9aa5]">Create your bank accounts in Pocket before approving transactions.</p>}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button type="button" disabled={busyId === item._id || !accounts.length || (isTransfer && (!destination || destination === selectedAccount))} onClick={() => void review(item,"approve")} className={ui.primary}>{busyId === item._id ? "Saving…" : "Approve"}</button>
                      <button type="button" disabled={busyId === item._id} onClick={() => void review(item,"ignore")} className={ui.ghost}>Ignore</button>
                    </div>
                    <p className="text-[10px] leading-relaxed text-[#929bad]">Approval creates a ledger entry. Transfer candidates require two accounts and are recorded as transfers, not income or spending.</p>
                  </div>}
                </div>}
                {item.status === "APPROVED" && <p className="mt-2 text-[10px] font-semibold text-[#b8f36b]">✓ Added to Pocket ledger</p>}
                {item.status === "IGNORED" && <p className="mt-2 text-[10px] text-[#929bad]">Ignored · not added to your ledger</p>}
              </article>;
            })}
          </div>}
      </div>
      <div className={ui.card}>
        <h3 className={ui.h2Flush}>How sync works</h3>
        <div className="mt-3 grid gap-3 text-xs text-[#aab4c4]">
          <p><b className="text-white">01 · Detect</b><br/>Pocket Sync reads supported payment notifications on your phone.</p>
          <p><b className="text-white">02 · Review</b><br/>Candidates appear here with amount, source, reference and counterparty when available.</p>
          <p><b className="text-white">03 · Approve</b><br/>Only approved candidates become financial ledger entries. Nothing is silently added to your balance.</p>
        </div>
      </div>
    </section>
  );
}
