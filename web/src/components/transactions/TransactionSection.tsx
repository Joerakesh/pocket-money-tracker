"use client";
import type { FormEvent } from "react";
import { ui } from "../ui";

type Account = { id: string; name: string; balance: number };

const types = [
  ["expense", "↘", "Expense"], ["income", "↗", "Income"], ["transfer", "⇄", "Transfer"], ["lent", "↗", "Money lent"],
  ["repayment", "↙", "Repay"], ["borrowed_expense", "↙", "Paid for me"], ["collection", "↗", "Loan returned"], ["refund", "↶", "Refund"],
] as const;
const categories = ["Food", "Travel", "Shopping", "Education", "Health", "Bills", "Entertainment", "Friends", "Subscriptions", "Other"];
const descriptions: Record<string, string> = {
  expense: "A purchase or bill paid from your account. This reduces your cash and counts as spending.",
  income: "Money you received. This increases your account balance and starts an income cycle.",
  transfer: "Move money between your own accounts. Transfers do not count as income or spending.",
  lent: "Money you gave someone and expect back. Your account balance decreases, but this is tracked as money owed to you—not as spending.",
  repayment: "Money you return to someone who lent you money. This reduces your cash and your outstanding debt.",
  borrowed_expense: "Someone else paid an expense for you. It is recorded as an amount you owe, without reducing your account balance.",
  collection: "Money someone returned from a previous loan. Your cash increases and your outstanding receivable decreases; it is not new income.",
  refund: "A merchant or person refunded a previous purchase. This increases cash and offsets spending.",
};

export default function TransactionSection({ type, setType, accounts, onSubmit, editing }: { type: string; setType: (v: string) => void; accounts: Account[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void; editing: any }) {
  const needsPerson = ["lent", "borrowed_expense", "repayment", "collection"].includes(type);
  const needsAccount = type !== "borrowed_expense";
  const personLabel = type === "lent" ? "Who did you lend to?" : type === "collection" ? "Who repaid you?" : type === "repayment" ? "Who are you repaying?" : "Who paid for you?";
  const isTransfer = type === "transfer";
  return (
    <>
      <section className={ui.card}>
        <div className={ui.sectionHead}><div><span className={ui.sectionLabel}>TRANSACTION TYPE</span><h2 className={ui.h2Flush}>What happened?</h2></div></div>
        <div className="mt-3 grid grid-cols-4 gap-2 max-[520px]:gap-1.5 max-[360px]:grid-cols-2" role="group" aria-label="Transaction type">
          {types.map(([v, icon, label]) => (
            <button key={v} type="button" aria-pressed={type === v} onClick={() => setType(v)}
              className={`flex min-h-[70px] w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-[15px] border px-[5px] py-3 text-[11px] leading-tight max-[520px]:min-h-16 max-[520px]:px-[3px] max-[520px]:py-2.5 max-[520px]:text-[10px] ${ui.focusRing} ${type === v ? "border-[#b8f36b] bg-[#b8f36b] text-[#101608]" : "border-white/[.075] bg-[#1b2230] text-[#f5f7fb]"}`}>
              <span className="text-xl leading-tight">{icon}</span>{label}
            </button>
          ))}
        </div>
        <p className={`${ui.note} mt-3`}>{descriptions[type] || descriptions.expense}</p>
      </section>

      <section className={ui.card}>
        <div className={ui.sectionHead}>
          <div><span className={ui.sectionLabel}>{editing ? "UPDATE LEDGER ENTRY" : "NEW LEDGER ENTRY"}</span><h2 className={ui.h2Flush}>{editing ? "Edit transaction" : "Transaction details"}</h2></div>
        </div>
        <form className={`${ui.formGrid} mt-3`} onSubmit={onSubmit}>
          <div><label className={ui.label} htmlFor="amount">Amount (₹)</label><input className={ui.field} name="amount" id="amount" type="number" min=".01" step=".01" inputMode="decimal" required defaultValue={editing?.amount} placeholder="0.00" /></div>
          <div><label className={ui.label} htmlFor="date">Date</label><input className={ui.field} name="date" id="date" type="date" required defaultValue={editing?.date || new Date().toISOString().slice(0, 10)} /></div>
          {needsAccount && <div className={ui.full}><label className={ui.label} htmlFor="accountId">{isTransfer ? "Transfer from" : "Account"}</label>
            <select className={ui.field} name="accountId" id="accountId" required defaultValue={editing?.accountId || accounts[0]?.id || ""}>
              <option value="">Choose account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · ₹{a.balance.toFixed(2)}</option>)}
            </select>
          </div>}
          {isTransfer && <div className={ui.full}><label className={ui.label} htmlFor="toAccountId">Transfer to</label>
            <select className={ui.field} name="toAccountId" id="toAccountId" required defaultValue={editing?.toAccountId || accounts.find((a) => a.id !== editing?.accountId)?.id || ""}>
              <option value="">Choose destination account</option>
              {accounts.filter((a) => a.id !== editing?.accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>}
          {needsPerson && <div className={ui.full}><label className={ui.label} htmlFor="person">{personLabel}</label><input className={ui.field} name="person" id="person" required maxLength={80} defaultValue={editing?.person} placeholder="Enter person's name" /></div>}
          {type === "expense" && <div className={ui.full}><label className={ui.label} htmlFor="allocationSource">Fund this expense from</label><select className={ui.field} name="allocationSource" id="allocationSource" defaultValue={editing?.allocationSource || "personal"}><option value="essentials">Essentials</option><option value="personal">Personal spending</option><option value="future">Future expenses</option><option value="savings">Savings</option></select><p className={ui.note}>This updates the selected virtual wallet. Your actual account balance is still reduced only by this expense.</p></div>}
          <div className={ui.full}><label className={ui.label} htmlFor="category">Category</label>
            <select className={ui.field} name="category" id="category" defaultValue={editing?.category || (needsPerson ? "Friends" : isTransfer ? "Transfer" : "Food")}>{categories.map((c) => <option key={c}>{c}</option>)}{isTransfer && <option>Transfer</option>}</select>
          </div>
          <div className={ui.full}><label className={ui.label} htmlFor="note">Description / note</label><input className={ui.field} name="note" id="note" maxLength={200} defaultValue={editing?.note || ""} placeholder={type === "lent" ? "e.g. Short-term loan" : type === "expense" ? "What was this payment for?" : "Add a note (optional)"} /></div>
          <div className={ui.full}><button className={`${ui.primary} flex min-h-[48px] items-center justify-center gap-[9px]`} type="submit">{editing ? "Save changes" : "Save transaction"}</button></div>
        </form>
        <p className={`${ui.note} mt-3`}>You can correct a transaction's type later using Edit. Money lent is excluded from spending reports, but it is not spendable until it is repaid.</p>
      </section>
    </>
  );
}
