"use client";
import { useState, type FormEvent } from "react";
import { ui } from "../ui";
type Budget = { _id?: string; category: string; amount: number };
type Goal = { _id?: string; name: string; target: number; saved: number };
type Recurring = { _id?: string; name: string; amountPaise?: number; amount?: number; dueDay: number; category: string };
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);
const cats = ["Food", "Travel", "Shopping", "Education", "Health", "Bills", "Entertainment", "Friends", "Other", "Subscriptions"];
type Kind = "budget" | "goal" | "recurring";
export default function PlanningSection({ budgets, goals, recurring, onSave, onDelete }: {
  budgets: Budget[]; goals: Goal[]; recurring: Recurring[];
  onSave: (kind: Kind, e: FormEvent<HTMLFormElement>) => void;
  onDelete: (kind: Kind, id: string) => void;
}) {
  const [editing, setEditing] = useState<{kind:Kind;id:string}|null>(null);
  const field = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none";
  const action = "rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/80";
  const controls = (kind:Kind,id?:string) => id ? <span className="flex shrink-0 gap-1"><button type="button" className={action} onClick={()=>setEditing({kind,id})}>Edit</button><button type="button" className={action} onClick={()=>onDelete(kind,id)}>Delete</button></span> : null;
  const editor = (kind:Kind,item:Budget|Goal|Recurring) => <form className={ui.formGrid+" mt-3 rounded-xl border border-white/10 p-3"} onSubmit={e=>{onSave(kind,e);setEditing(null);}}>
    <input type="hidden" name="_id" value={item._id||""}/>
    {kind==="budget" ? <>
      <div><label className={ui.label}>Category</label><select className={field} name="category" defaultValue={(item as Budget).category}>{cats.map(c=><option key={c}>{c}</option>)}</select></div>
      <div><label className={ui.label}>Monthly limit (₹)</label><input className={field} name="amount" type="number" min=".01" step=".01" defaultValue={(item as Budget).amount} required/></div>
    </> : kind==="goal" ? <>
      <div><label className={ui.label}>Goal name</label><input className={field} name="name" defaultValue={(item as Goal).name} required/></div>
      <div><label className={ui.label}>Target (₹)</label><input className={field} name="target" type="number" min=".01" step=".01" defaultValue={(item as Goal).target} required/></div>
      <div><label className={ui.label}>Already saved (₹)</label><input className={field} name="saved" type="number" min="0" step=".01" defaultValue={(item as Goal).saved}/></div>
    </> : <>
      <div><label className={ui.label}>Name</label><input className={field} name="name" defaultValue={(item as Recurring).name} required/></div>
      <div><label className={ui.label}>Amount (₹)</label><input className={field} name="amount" type="number" min=".01" step=".01" defaultValue={(item as Recurring).amount??((item as Recurring).amountPaise||0)/100} required/></div>
      <div><label className={ui.label}>Due day</label><input className={field} name="dueDay" type="number" min="1" max="31" defaultValue={(item as Recurring).dueDay} required/></div>
      <div><label className={ui.label}>Category</label><input className={field} name="category" defaultValue={(item as Recurring).category}/></div>
    </>}
    <div className={ui.full+" flex gap-2"}><button className={ui.ghost}>Save changes</button><button type="button" className={action} onClick={()=>setEditing(null)}>Cancel</button></div>
  </form>;
  return <>
    <section className={ui.card}>
      <h2 className={ui.h2}>Budgets</h2>
      <form className={ui.formGrid} onSubmit={e=>onSave("budget",e)}>
        <div><label className={ui.label}>Category</label><select className={ui.field} name="category">{cats.map(c=><option key={c}>{c}</option>)}</select></div>
        <div><label className={ui.label}>Monthly limit (₹)</label><input className={ui.field} name="amount" type="number" min=".01" step=".01" required/></div>
        <div className={ui.full}><button className={ui.ghost}>Save category budget</button></div>
      </form>
      <div className={ui.list+" mt-2"}>{budgets.map(b=><div key={b._id||b.category}>
        <div className={ui.row}><span>{b.category}</span><span className="flex items-center gap-2"><b>{money(b.amount)}</b>{controls("budget",b._id)}</span></div>
        {editing?.kind==="budget"&&editing.id===b._id?editor("budget",b):null}
      </div>)}</div>
    </section>
    <section className={ui.card}>
      <h2 className={ui.h2}>Savings goals</h2>
      <form className={ui.formGrid} onSubmit={e=>onSave("goal",e)}>
        <div><label className={ui.label}>Goal name</label><input className={ui.field} name="name" required placeholder="Emergency fund"/></div>
        <div><label className={ui.label}>Target (₹)</label><input className={ui.field} name="target" type="number" min=".01" step=".01" required/></div>
        <div><label className={ui.label}>Already saved (₹)</label><input className={ui.field} name="saved" type="number" min="0" step=".01" defaultValue="0"/></div>
        <div className="flex items-end"><button className={ui.ghost}>Add goal</button></div>
      </form>
      <div className={ui.list+" mt-2"}>{goals.map(g=><div key={g._id||g.name}>
        <div className={ui.row}><span className={ui.rowMain}><b className={ui.rowTitle}>{g.name}</b><small className={ui.rowSub}>{money(g.saved)} / {money(g.target)}</small></span><span className="flex items-center gap-2"><b>{Math.round(g.target?(g.saved/g.target)*100:0)}%</b>{controls("goal",g._id)}</span></div>
        {editing?.kind==="goal"&&editing.id===g._id?editor("goal",g):null}
      </div>)}</div>
    </section>
    <section className={ui.card}>
      <h2 className={ui.h2}>Recurring expenses</h2>
      <form className={ui.formGrid} onSubmit={e=>onSave("recurring",e)}>
        <div><label className={ui.label}>Name</label><input className={ui.field} name="name" required placeholder="Subscription"/></div>
        <div><label className={ui.label}>Amount (₹)</label><input className={ui.field} name="amount" type="number" min=".01" step=".01" required/></div>
        <div><label className={ui.label}>Due day</label><input className={ui.field} name="dueDay" type="number" min="1" max="31" defaultValue="1" required/></div>
        <div><label className={ui.label}>Category</label><input className={ui.field} name="category" defaultValue="Subscriptions"/></div>
        <div className={ui.full}><button className={ui.ghost}>Add recurring reminder</button></div>
      </form>
      <div className={ui.list+" mt-2"}>{recurring.map(r=><div key={r._id||r.name}>
        <div className={ui.row}><span className={ui.rowMain}>{r.name}<small className={ui.rowSub}>Due day {r.dueDay} · {r.category}</small></span><span className="flex items-center gap-2"><b>{money(r.amount??(r.amountPaise||0)/100)}</b>{controls("recurring",r._id)}</span></div>
        {editing?.kind==="recurring"&&editing.id===r._id?editor("recurring",r):null}
      </div>)}</div>
    </section>
  </>;
}
