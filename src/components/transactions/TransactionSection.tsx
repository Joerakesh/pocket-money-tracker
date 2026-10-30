"use client";
import type { FormEvent } from "react";
import { ui } from "../ui";

type Account = { id: string; name: string; balance: number };

const types = [
  ["expense", "↘", "Expense"], ["income", "↗", "Income"], ["transfer", "⇄", "Transfer"], ["lent", "↗", "Lend"],
  ["repayment", "↙", "Repay"], ["borrowed_expense", "↙", "Paid for me"], ["collection", "↗", "Collected"], ["refund", "↶", "Refund"],
];
const categories = ["Food", "Travel", "Shopping", "Education", "Health", "Bills", "Entertainment", "Friends", "Other"];

export default function TransactionSection({ type, setType, accounts, onSubmit, editing }: { type: string; setType: (v: string) => void; accounts: Account[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void; editing: any }) {
  const needsPerson = ["lent", "borrowed_expense", "repayment", "collection"].includes(type);
  return (
    <>
      <section className={ui.card}>
        <div className={ui.sectionHead}><div><span className={ui.sectionLabel}>NEW ENTRY</span><h2 className={ui.h2Flush}>Choose a transaction</h2></div></div>
        <div className="mt-3 grid grid-cols-4 gap-2 max-[520px]:gap-1.5 max-[360px]:grid-cols-2" role="group" aria-label="Transaction type">
          {types.map(([v, icon, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setType(v)}
              className={`flex min-h-[70px] w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-[15px] border px-[5px] py-3 text-[11px] leading-tight max-[520px]:min-h-16 max-[520px]:px-[3px] max-[520px]:py-2.5 max-[520px]:text-[10px] ${ui.focusRing} ${type === v ? "border-[#b8f36b] bg-[#b8f36b] text-[#101608]" : "border-white/[.075] bg-[#1b2230] text-[#f5f7fb]"}`}
            >
              <span className="text-xl leading-tight">{icon}</span>{label}
            </button>
          ))}
        </div>
      </section>

      <section className={ui.card}>
        <h2 className={ui.h2}>{editing ? "Edit transaction" : "Add transaction"}</h2>
        <form className={ui.formGrid} onSubmit={onSubmit}>
          <div><label className={ui.label} htmlFor="amount">Amount (₹)</label><input className={ui.field} name="amount" id="amount" type="number" min=".01" step=".01" required defaultValue={editing?.amount} /></div>
          <div><label className={ui.label} htmlFor="accountId">Account</label>
            <select className={ui.field} name="accountId" id="accountId" required defaultValue={editing?.accountId || accounts[0]?.id || ""}>
              <option value="">Choose account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · ₹{a.balance.toFixed(2)}</option>)}
            </select>
          </div>
          {type === "transfer" && (
            <div><label className={ui.label} htmlFor="toAccountId">Transfer to</label>
              <select className={ui.field} name="toAccountId" id="toAccountId" required>
                {accounts.filter((a) => a.id !== editing?.accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          {needsPerson && <div><label className={ui.label} htmlFor="person">Friend / person</label><input className={ui.field} name="person" id="person" required defaultValue={editing?.person} /></div>}
          <div className={ui.full}><label className={ui.label} htmlFor="category">Category</label>
            <select className={ui.field} name="category" id="category" defaultValue={editing?.category || "Food"}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div><label className={ui.label} htmlFor="date">Date</label><input className={ui.field} name="date" id="date" type="date" required defaultValue={editing?.date || new Date().toISOString().slice(0, 10)} /></div>
          <div><label className={ui.label} htmlFor="note">Note</label><input className={ui.field} name="note" id="note" maxLength={200} defaultValue={editing?.note || ""} /></div>
          <div className={ui.full}><button className={`${ui.primary} flex min-h-[46px] items-center justify-center gap-[9px]`} type="submit">{editing ? "Save changes" : "Save transaction"}</button></div>
        </form>
        <p className={`${ui.note} mt-3`}>Transfers are not spending. Lending is tracked separately from purchases.</p>
      </section>
    </>
  );
}
