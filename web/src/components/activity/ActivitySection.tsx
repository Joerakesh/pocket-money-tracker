"use client";
import { ui } from "../ui";

type Tx = { _id: string; type: string; amount: number; date: string; category?: string; note?: string; person?: string; settled?: boolean };
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);
const typeMeta: Record<string, { label: string; sign: string; tone: string; detail: string }> = {
  expense: { label: "Expense", sign: "−", tone: "text-[#ff9aa5]", detail: "Purchase or bill paid" },
  income: { label: "Income", sign: "+", tone: "text-[#b8f36b]", detail: "Money received" },
  transfer: { label: "Transfer", sign: "⇄", tone: "text-[#c5d2e5]", detail: "Between your accounts" },
  lent: { label: "Money lent", sign: "−", tone: "text-[#f3c879]", detail: "Receivable · not spending" },
  repayment: { label: "Debt repayment", sign: "−", tone: "text-[#ff9aa5]", detail: "You paid someone back" },
  borrowed_expense: { label: "Paid for me", sign: "↗", tone: "text-[#f3c879]", detail: "You owe this amount" },
  collection: { label: "Loan returned", sign: "+", tone: "text-[#b8f36b]", detail: "Receivable collected · not income" },
  refund: { label: "Refund", sign: "+", tone: "text-[#b8f36b]", detail: "Purchase refund" },
};

export default function ActivitySection({ transactions, search, onSearch, month, onMonth, onEdit, onDelete }: { transactions: Tx[]; search: string; onSearch: (v: string) => void; month: string; onMonth: (v: string) => void; onEdit: (tx: Tx) => void; onDelete: (tx: Tx) => void }) {
  const lending = transactions.filter((tx) => tx.type === "lent" || tx.type === "collection");
  const spending = transactions.filter((tx) => tx.type === "expense" || tx.type === "borrowed_expense");
  return (
    <section className={ui.card}>
      <div className={ui.sectionHead}><div><span className={ui.sectionLabel}>LEDGER & HISTORY</span><h2 className={ui.h2Flush}>Transactions</h2></div></div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-3"><span className={ui.metricLabel}>Spending entries</span><strong className="mt-1 block text-lg">{spending.length}</strong></div>
        <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-3"><span className={ui.metricLabel}>Loan activity</span><strong className="mt-1 block text-lg">{lending.length}</strong></div>
      </div>
      <div className="my-3 grid grid-cols-[minmax(0,1fr)_minmax(120px,160px)] gap-2 max-[420px]:grid-cols-1">
        <input className={ui.field} value={search} onChange={(e) => onSearch(e.target.value)} type="search" placeholder="Search note, category, person or type" />
        <input className={ui.field} type="month" value={month} onChange={(e) => onMonth(e.target.value)} aria-label="Filter month" />
      </div>
      <div className={`${ui.list} mt-2`}>
        {transactions.map((tx) => {
          const meta = typeMeta[tx.type] || { label: tx.type.replaceAll("_", " "), sign: "", tone: "text-[#d5dbe5]", detail: "Ledger entry" };
          return (
            <article className="flex items-center gap-3 border-b border-white/[.07] py-3.5 last:border-b-0" key={tx._id}>
              <span className={`grid size-10 flex-none place-items-center rounded-xl bg-white/[.055] text-lg font-bold ${meta.tone}`}>{meta.sign || "·"}</span>
              <div className="min-w-0 flex-1">
                <b className={`${ui.rowTitle} block truncate`}>{tx.note || tx.person || tx.category || meta.label}</b>
                <small className={`${ui.rowSub} mt-1 block`}>{tx.date} · {meta.label}{tx.category ? " · " + tx.category : ""}{tx.person ? " · " + tx.person : ""}</small>
                <span className={`mt-1 block text-[10px] ${meta.tone}`}>{meta.detail}{tx.settled ? " · Settled" : tx.type === "lent" || tx.type === "borrowed_expense" ? " · Outstanding" : ""}</span>
              </div>
              <div className="flex flex-none flex-col items-end gap-2">
                <b className={`whitespace-nowrap text-xs font-bold ${meta.tone}`}>{meta.sign === "⇄" ? "" : meta.sign}{money(tx.amount)}</b>
                <div className="flex gap-1.5">
                  <button type="button" className={ui.smallButton} onClick={() => onEdit(tx)}>Edit</button>
                  <button type="button" aria-label={`Delete ${meta.label}`} className={`${ui.smallButton} !border-[#ff7887]/20 text-[#ff7887]`} onClick={() => onDelete(tx)}>Delete</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!transactions.length && <p className={ui.muted}>No matching transactions. Try changing your search or month filter.</p>}
    </section>
  );
}
