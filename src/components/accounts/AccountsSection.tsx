import type { FormEvent } from "react";
import BankPicker from "./BankPicker";
import { ui } from "../ui";

type Account = { id: string; name: string; institution?: string; kind?: string; balance: number };
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);

export default function AccountsSection({ accounts, onSubmit }: { accounts: Account[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return (
    <>
      <section className={ui.card}>
        <div className={ui.sectionHead}>
          <div><span className={ui.sectionLabel}>WALLET SETTINGS</span><h2 className={ui.h2Flush}>Manage accounts</h2></div>
          <span className={ui.pill}>{accounts.length} accounts</span>
        </div>
        <p className={`${ui.note} mt-2`}>Add or remove your bank accounts, cash wallets and UPI accounts.</p>
        <form className={`${ui.formGrid} mt-4`} onSubmit={onSubmit}>
          <div className={ui.full}><label className={ui.label}>Choose bank or provider</label><BankPicker /></div>
          <div><label className={ui.label} htmlFor="accountName">Account nickname (optional)</label><input className={ui.field} id="accountName" name="name" maxLength={60} placeholder="e.g. Personal savings" /></div>
          <div><label className={ui.label} htmlFor="opening">Opening balance (₹)</label><input className={ui.field} id="opening" name="openingBalance" type="number" min="0" step=".01" defaultValue="0" required /></div>
          <input name="kind" type="hidden" value="bank" readOnly />
          <div className={ui.full}><button className={ui.primary} type="submit">＋ Create account</button></div>
        </form>
      </section>
      <section className={ui.card}>
        <h2 className={ui.h2}>Your accounts</h2>
        <div className={ui.bankGrid}>
          {accounts.map((a) => (
            <article className={`${ui.bankCard} justify-between`} key={a.id}>
              <div className="min-w-0"><b className={ui.bankName}>{a.name}</b><small className={ui.bankSub}>{a.institution || a.kind || "Account"}</small></div>
              <strong className={ui.bankBalance}>{money(a.balance)}</strong>
            </article>
          ))}
        </div>
        {!accounts.length && <p className={ui.muted}>No accounts available.</p>}
      </section>
    </>
  );
}
