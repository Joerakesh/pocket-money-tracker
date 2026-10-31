import type { FormEvent } from "react";
import { ui } from "../ui";

type Budget = { category: string; amount: number };
type Goal = { _id?: string; name: string; target: number; saved: number };
type Recurring = { _id?: string; name: string; amountPaise?: number; amount?: number; dueDay: number; category: string };
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);
const cats = ["Food", "Travel", "Shopping", "Education", "Health", "Bills", "Entertainment", "Friends", "Other", "Subscriptions"];
type Kind = "budget" | "goal" | "recurring";

export default function PlanningSection({ budgets, goals, recurring, onSave }: { budgets: Budget[]; goals: Goal[]; recurring: Recurring[]; onSave: (kind: Kind, e: FormEvent<HTMLFormElement>) => void }) {
  return (
    <>
      <section className={ui.card}>
        <h2 className={ui.h2}>Budgets</h2>
        <form className={ui.formGrid} onSubmit={(e) => onSave("budget", e)}>
          <div><label className={ui.label}>Category</label><select className={ui.field} name="category">{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className={ui.label}>Monthly limit (₹)</label><input className={ui.field} name="amount" type="number" min=".01" step=".01" required /></div>
          <div className={ui.full}><button className={ui.ghost}>Save category budget</button></div>
        </form>
        <div className={`${ui.list} mt-2`}>{budgets.map((b) => <div className={ui.row} key={b.category}><span>{b.category}</span><b>{money(b.amount)}</b></div>)}</div>
      </section>

      <section className={ui.card}>
        <h2 className={ui.h2}>Savings goals</h2>
        <form className={ui.formGrid} onSubmit={(e) => onSave("goal", e)}>
          <div><label className={ui.label}>Goal name</label><input className={ui.field} name="name" required placeholder="Emergency fund" /></div>
          <div><label className={ui.label}>Target (₹)</label><input className={ui.field} name="target" type="number" min=".01" step=".01" required /></div>
          <div><label className={ui.label}>Already saved (₹)</label><input className={ui.field} name="saved" type="number" min="0" step=".01" defaultValue="0" /></div>
          <div className="flex items-end"><button className={ui.ghost}>Add goal</button></div>
        </form>
        <div className={`${ui.list} mt-2`}>
          {goals.map((g) => (
            <div className={ui.row} key={g._id || g.name}>
              <span className={ui.rowMain}><b className={ui.rowTitle}>{g.name}</b><small className={ui.rowSub}>{money(g.saved)} / {money(g.target)}</small></span>
              <b>{Math.round(g.target ? (g.saved / g.target) * 100 : 0)}%</b>
            </div>
          ))}
        </div>
      </section>

      <section className={ui.card}>
        <h2 className={ui.h2}>Recurring expenses</h2>
        <form className={ui.formGrid} onSubmit={(e) => onSave("recurring", e)}>
          <div><label className={ui.label}>Name</label><input className={ui.field} name="name" required placeholder="Subscription" /></div>
          <div><label className={ui.label}>Amount (₹)</label><input className={ui.field} name="amount" type="number" min=".01" step=".01" required /></div>
          <div><label className={ui.label}>Due day</label><input className={ui.field} name="dueDay" type="number" min="1" max="31" defaultValue="1" required /></div>
          <div><label className={ui.label}>Category</label><input className={ui.field} name="category" defaultValue="Subscriptions" /></div>
          <div className={ui.full}><button className={ui.ghost}>Add recurring reminder</button></div>
        </form>
        <div className={`${ui.list} mt-2`}>
          {recurring.map((r) => (
            <div className={ui.row} key={r._id || r.name}>
              <span className={ui.rowMain}>{r.name}<small className={ui.rowSub}>Due day {r.dueDay} · {r.category}</small></span>
              <b>{money(r.amount ?? (r.amountPaise || 0) / 100)}</b>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
