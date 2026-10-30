"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Tab = "overview" | "activity" | "accounts" | "plans" | "settings";
type TxType = "expense" | "income" | "lent" | "borrowed_expense" | "repayment" | "collection" | "transfer" | "refund";
type Account = { id: string; name: string; institution?: string; kind?: string; balance: number };
type Transaction = { _id: string; type: TxType; amount: number; date: string; category?: string; note?: string; person?: string; accountId?: string; toAccountId?: string; settled?: boolean };
type Summary = { totalBalance: number; spendable: number; owedToFriends: number; owedByFriends: number; days: number; perDay: number; todaySpent: number; monthSpent: number; monthIncome: number; byCat: Record<string, number> };
type Budget = { _id?: string; category: string; amount: number };
type Goal = { _id?: string; name: string; target: number; saved: number };
type Recurring = { _id?: string; name: string; amountPaise?: number; amount?: number; dueDay: number; category: string; active?: boolean };

const money = (n = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);
const today = () => new Date().toISOString().slice(0, 10);
const categories = ["Food", "Travel", "Shopping", "Education", "Health", "Bills", "Entertainment", "Friends", "Other"];
const transactionTypes: { type: TxType; title: string; icon: string; hint: string }[] = [
  { type: "expense", title: "Expense", icon: "↗", hint: "Money spent from an account" },
  { type: "income", title: "Income", icon: "↙", hint: "Money received" },
  { type: "lent", title: "Lend", icon: "⇢", hint: "Money you gave someone" },
  { type: "repayment", title: "Repay", icon: "↩", hint: "Money you paid back" },
];
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch("/api" + path, { ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data as T;
}
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });
function IconButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) { return <button className="icon-button" type="button" onClick={onClick} aria-label={label}>{children}</button>; }
function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) { return <div className="section-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>; }
function Metric({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) { return <div className="metric-card"><span>{label}</span><strong className={tone || ""}>{value}</strong></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="empty-state">{children}</div>; }

export default function PocketApp() {
  const [tab, setTab] = useState<Tab>("overview");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(false);
  const [txType, setTxType] = useState<TxType>("expense");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [undoId, setUndoId] = useState("");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const [s, a, t, b, g, r] = await Promise.all([
        request<Summary>("/summary"), request<Account[]>("/accounts"), request<Transaction[]>("/transactions"),
        request<Budget[]>("/budgets"), request<Goal[]>("/goals"), request<Recurring[]>("/recurring")
      ]);
      setSummary(s); setAccounts(a); setTransactions(t); setBudgets(b); setGoals(g); setRecurring(r);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load your ledger."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visibleTransactions = useMemo(() => transactions.filter(t => {
    const q = search.trim().toLowerCase();
    return (!q || [t.note, t.category, t.person, t.type].some(v => String(v || "").toLowerCase().includes(q))) && (!month || t.date.startsWith(month));
  }), [transactions, search, month]);
  const showNotice = useCallback((message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); }, []);
  const openAdd = (type: TxType = "expense") => { setEditing(null); setTxType(type); setModal(true); };
  const saveTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = { type: txType, amount: Number(form.get("amount")), date: String(form.get("date") || today()), category: String(form.get("category") || "Other"), note: String(form.get("note") || ""), accountId: String(form.get("accountId") || ""), person: String(form.get("person") || ""), toAccountId: String(form.get("toAccountId") || "") };
    try {
      if (editing) await request("/transactions/" + editing._id, { method: "PUT", body: JSON.stringify(payload) });
      else await request("/transactions", post(payload));
      setModal(false); setEditing(null); showNotice(editing ? "Transaction updated." : "Transaction added."); await load();
    } catch (e) { showNotice(e instanceof Error ? e.message : "Could not save transaction."); }
  };
  const editTransaction = (tx: Transaction) => { setEditing(tx); setTxType(tx.type); setModal(true); };
  const deleteTransaction = async (tx: Transaction) => {
    if (!window.confirm("Move this transaction to deleted history?")) return;
    try { await request("/transactions/" + tx._id, { method: "DELETE" }); setUndoId(tx._id); showNotice("Transaction deleted. Use Undo to restore it."); await load(); }
    catch (e) { showNotice(e instanceof Error ? e.message : "Delete failed."); }
  };
  const restoreTransaction = async () => { try { await request("/transactions/" + undoId + "/restore", post({})); setUndoId(""); showNotice("Transaction restored."); await load(); } catch (e) { showNotice(e instanceof Error ? e.message : "Restore failed."); } };

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setTab("overview"); }}><span className="brand-mark">₹</span><span>Pocket<span className="brand-dot">.</span><small>PERSONAL FINANCE</small></span></a>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav">{([["overview","◫","Overview"],["activity","↗","Activity"],["accounts","▣","Accounts"],["plans","◎","Plans"],["settings","⚙","Settings"]] as [Tab,string,string][]).map(([key,icon,label]) => <button type="button" key={key} className={tab===key ? "nav-link active" : "nav-link"} onClick={() => setTab(key)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-chip"><span className="live-dot"/> Private ledger <small>MongoDB synced</small></div><button className="side-refresh" onClick={() => void load()} type="button">↻ &nbsp; Refresh data</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span className="eyebrow">YOUR FINANCES</span><h1>{({overview:"Overview",activity:"Activity",accounts:"Accounts",plans:"Plans",settings:"Settings"} as Record<Tab,string>)[tab]}</h1></div><div className="top-actions"><span className="today-label">{new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</span><IconButton label="Refresh data" onClick={() => void load()}>↻</IconButton><button className="primary-button top-add" onClick={() => openAdd("expense")}>＋ <span>Add transaction</span></button></div></header>
      {error && <div className="alert error-alert">{error}<button onClick={() => void load()}>Retry</button></div>}
      {notice && <div className="toast">{notice}{undoId && notice.startsWith("Transaction deleted") && <button onClick={() => void restoreTransaction()}>Undo</button>}</div>}
      {busy && !summary ? <div className="loading-panel"><span className="loader"/>Loading your financial data…</div> : <>
        {tab === "overview" && <Overview summary={summary} accounts={accounts} transactions={transactions} onAdd={openAdd} onTab={setTab} onEdit={editTransaction}/>}
        {tab === "activity" && <Activity transactions={visibleTransactions} search={search} setSearch={setSearch} month={month} setMonth={setMonth} onEdit={editTransaction} onDelete={deleteTransaction}/>}
        {tab === "accounts" && <Accounts accounts={accounts} reload={load} notify={showNotice}/>}
        {tab === "plans" && <Plans budgets={budgets} goals={goals} recurring={recurring} reload={load} notify={showNotice}/>}
        {tab === "settings" && <Settings reload={load} notify={showNotice}/>}
      </>}
    </main>
    {modal && <TransactionModal type={txType} setType={setTxType} accounts={accounts} editing={editing} close={() => setModal(false)} submit={saveTransaction}/>}
    <button className="mobile-add" type="button" onClick={() => openAdd("expense")}>＋</button>
  </div>;
}
function Overview({ summary, accounts, transactions, onAdd, onTab, onEdit }: { summary: Summary | null; accounts: Account[]; transactions: Transaction[]; onAdd: (type?: TxType) => void; onTab: (tab: Tab) => void; onEdit: (tx: Transaction) => void }) {
  const s = summary;
  return <div className="content-stack"><section className="welcome-row"><div><p className="muted-copy">A clearer picture of your money.</p><h2>Good to see you <span>✦</span></h2></div><span className="date-pill">{new Date().toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</span></section>
    <section className="balance-hero"><div className="hero-orbit"/><div className="hero-top"><span>TOTAL ACCOUNT BALANCE</span><span className="hero-status"><i/> LIVE BALANCE</span></div><strong>{money(s?.totalBalance)}</strong><div className="hero-footer"><span>Available to spend</span><b>{money(s?.spendable)}</b><span className="hero-divider"/><span>{s?.days ?? 0} days left in cycle</span><b>{money(s?.perDay)}/day</b></div></section>
    <div className="metric-grid"><Metric label="Spent this month" value={money(s?.monthSpent)} tone="red"/><Metric label="Income this month" value={money(s?.monthIncome)} tone="green"/><Metric label="Spent today" value={money(s?.todaySpent)}/><Metric label="You owe / borrowed" value={money(s?.owedToFriends)}/></div>
    <section className="panel"><SectionTitle eyebrow="QUICK ACTIONS" title="What would you like to do?"/><div className="quick-grid">{transactionTypes.map(item => <button type="button" className="quick-tile" key={item.type} onClick={() => onAdd(item.type)}><span className="quick-icon">{item.icon}</span><b>{item.title}</b><small>{item.hint}</small></button>)}</div></section>
    <div className="two-column"><section className="panel"><SectionTitle eyebrow="ACCOUNTS" title="Your accounts" action={<button className="text-button" onClick={() => onTab("accounts")}>Manage ↗</button>}/>{accounts.length ? <div className="account-list">{accounts.slice(0,4).map(a => <div className="account-row" key={a.id}><span className="account-icon">{a.kind==="cash"?"₹":a.kind==="upi"?"⌁":"▣"}</span><span className="account-name"><b>{a.name}</b><small>{a.institution || a.kind || "Account"}</small></span><strong>{money(a.balance)}</strong></div>)}</div> : <Empty>No accounts yet. Add your first account to start tracking.</Empty>}</section>
      <section className="panel"><SectionTitle eyebrow="RECENT" title="Recent activity" action={<button className="text-button" onClick={() => onTab("activity")}>View all ↗</button>}/>{transactions.slice(0,5).length ? <div className="transaction-list">{transactions.slice(0,5).map(tx => <TransactionRow key={tx._id} tx={tx} onEdit={onEdit}/>)}</div> : <Empty>Your transactions will appear here.</Empty>}</section></div>
  </div>;
}
function TransactionRow({ tx, onEdit }: { tx: Transaction; onEdit?: (tx: Transaction) => void }) {
  const incoming = ["income","collection","refund"].includes(tx.type);
  const label = tx.type === "borrowed_expense" ? "Borrowed expense" : tx.type.charAt(0).toUpperCase()+tx.type.slice(1).replace("_"," ");
  return <div className="transaction-row"><span className={"transaction-symbol "+(incoming?"positive":"")}>{incoming?"↙":"↗"}</span><span className="transaction-copy"><b>{tx.note || tx.category || label}</b><small>{tx.category || label} · {tx.date}{tx.person ? " · "+tx.person : ""}</small></span><strong className={incoming?"positive":""}>{incoming?"+":"−"}{money(tx.amount)}</strong>{onEdit && <button className="row-edit" onClick={() => onEdit(tx)} type="button" aria-label="Edit transaction">···</button>}</div>;
}
function Activity({ transactions, search, setSearch, month, setMonth, onEdit, onDelete }: { transactions: Transaction[]; search: string; setSearch: (s:string)=>void; month:string; setMonth:(s:string)=>void; onEdit:(tx:Transaction)=>void; onDelete:(tx:Transaction)=>void }) {
  return <div className="content-stack"><section className="panel"><SectionTitle eyebrow="LEDGER" title="All transactions"/><div className="filter-row"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes, people or categories…"/><input aria-label="Filter by month" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div>{transactions.length ? <div className="transaction-list full-list">{transactions.map(tx=><div className="activity-item" key={tx._id}><TransactionRow tx={tx}/><div className="activity-actions"><button onClick={()=>onEdit(tx)}>Edit</button><button className="danger-text" onClick={()=>onDelete(tx)}>Delete</button></div></div>)}</div> : <Empty>No matching transactions found.</Empty>}</section></div>;
}
function Accounts({ accounts, reload, notify }: { accounts:Account[]; reload:()=>Promise<void>; notify:(s:string)=>void }) {
  const [showForm,setShowForm]=useState(false);
  const add=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await request("/accounts",post({institution:f.get("institution"),name:f.get("name"),kind:f.get("kind"),openingBalance:Number(f.get("openingBalance")||0)}));setShowForm(false);notify("Account created.");await reload();}catch(err){notify(err instanceof Error?err.message:"Could not add account.");}};
  return <div className="content-stack"><section className="panel"><SectionTitle eyebrow="YOUR MONEY" title="Accounts" action={<button className="primary-button" onClick={()=>setShowForm(v=>!v)}>＋ Add account</button>}/>{showForm&&<form className="form-grid" onSubmit={add}><label>Bank / institution<input name="institution" placeholder="e.g. SBI, Cash, GPay" required/></label><label>Account name<input name="name" placeholder="e.g. Main savings"/></label><label>Account type<select name="kind"><option value="bank">Bank</option><option value="upi">UPI</option><option value="cash">Cash</option></select></label><label>Opening balance (₹)<input name="openingBalance" type="number" min="0" step="0.01" defaultValue="0" required/></label><button className="primary-button form-submit">Save account</button></form>}{accounts.length?<div className="account-grid">{accounts.map(a=><article className="account-card" key={a.id}><span className="account-icon large">{a.kind==="cash"?"₹":a.kind==="upi"?"⌁":"▣"}</span><span className="eyebrow">{a.institution||a.kind||"ACCOUNT"}</span><h3>{a.name}</h3><strong>{money(a.balance)}</strong><small>Current balance</small></article>)}</div>:<Empty>No accounts available yet.</Empty>}</section></div>;
}
function Plans({ budgets, goals, recurring, reload, notify }: { budgets:Budget[]; goals:Goal[]; recurring:Recurring[]; reload:()=>Promise<void>; notify:(s:string)=>void }) {
  const [kind,setKind]=useState<"budget"|"goal"|"recurring">("budget");
  const save=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);try{if(kind==="budget")await request("/budgets",post({category:f.get("category"),amount:Number(f.get("amount"))}));if(kind==="goal")await request("/goals",post({name:f.get("name"),target:Number(f.get("target")),saved:Number(f.get("saved")||0)}));if(kind==="recurring")await request("/recurring",post({name:f.get("name"),amount:Number(f.get("amount")),dueDay:Number(f.get("dueDay")),category:f.get("category")}));e.currentTarget.reset();notify("Saved successfully.");await reload();}catch(err){notify(err instanceof Error?err.message:"Could not save.");}};
  return <div className="content-stack"><section className="panel"><SectionTitle eyebrow="PLAN AHEAD" title="Budgets, goals & recurring"/><div className="segmented">{(["budget","goal","recurring"] as const).map(k=><button key={k} className={kind===k?"selected":""} onClick={()=>setKind(k)} type="button">{k==="budget"?"Budget":k==="goal"?"Savings goal":"Recurring"}</button>)}</div><form className="form-grid compact-form" onSubmit={save}>{kind==="budget"?<><label>Category<select name="category">{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Monthly limit (₹)<input name="amount" type="number" min="1" step="0.01" required/></label></>:kind==="goal"?<><label>Goal name<input name="name" placeholder="e.g. Emergency fund" required/></label><label>Target (₹)<input name="target" type="number" min="1" step="0.01" required/></label><label>Already saved (₹)<input name="saved" type="number" min="0" step="0.01" defaultValue="0"/></label></>:<><label>Expense name<input name="name" placeholder="e.g. Hostel mess" required/></label><label>Amount (₹)<input name="amount" type="number" min="0.01" step="0.01" required/></label><label>Due day<input name="dueDay" type="number" min="1" max="31" required/></label><label>Category<select name="category">{categories.map(c=><option key={c}>{c}</option>)}</select></label></>}<button className="primary-button form-submit">Save {kind}</button></form></section>
    <div className="two-column"><section className="panel"><SectionTitle title="Budgets"/>{budgets.length?budgets.map(b=><div className="simple-row" key={b.category}><span>{b.category}</span><b>{money(b.amount)}</b></div>):<Empty>No budgets created.</Empty>}</section><section className="panel"><SectionTitle title="Savings goals"/>{goals.length?goals.map(g=><div className="goal-row" key={g._id||g.name}><div><b>{g.name}</b><small>{money(g.saved)} of {money(g.target)}</small></div><div className="progress-track"><i style={{width:Math.min(100,g.target?g.saved/g.target*100:0)+"%"}}/></div></div>):<Empty>No savings goals yet.</Empty>}</section></div>
    <section className="panel"><SectionTitle title="Recurring expenses"/>{recurring.length?recurring.map(r=><div className="simple-row" key={r._id||r.name}><span><b>{r.name}</b><small>Due on day {r.dueDay} · {r.category}</small></span><b>{money(r.amount ?? (r.amountPaise||0)/100)}</b></div>):<Empty>No recurring expenses added.</Empty>}</section></div>;
}
function Settings({ reload, notify }: { reload:()=>Promise<void>; notify:(s:string)=>void }) {
  const [payday,setPayday]=useState("");const [reserve,setReserve]=useState("0");const [loaded,setLoaded]=useState(false);
  useEffect(()=>{request<{payday:string;reservePaise:number}>("/settings").then(s=>{setPayday(s.payday||"");setReserve(String((s.reservePaise||0)/100));setLoaded(true);}).catch(e=>notify(e.message));},[notify]);
  const save=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();try{await request("/settings",{method:"PUT",body:JSON.stringify({payday,reserve:Number(reserve)})});notify("Settings saved.");await reload();}catch(e){notify(e instanceof Error?e.message:"Could not save settings.");}};
  return <div className="content-stack"><section className="panel narrow-panel"><SectionTitle eyebrow="PREFERENCES" title="Allowance settings"/><p className="muted-copy">Set your monthly payday and the amount you want to keep untouched as a reserve.</p><form className="form-grid" onSubmit={save}><label>Next payday<input type="date" value={payday} onChange={e=>setPayday(e.target.value)} required/></label><label>Protected reserve (₹)<input type="number" min="0" step="0.01" value={reserve} onChange={e=>setReserve(e.target.value)} required/></label><button className="primary-button form-submit" disabled={!loaded}>Save settings</button></form></section><section className="panel narrow-panel"><SectionTitle eyebrow="DATA" title="Your ledger"/><p className="muted-copy">Your financial records stay in your configured MongoDB database. Export account data before removing any account.</p><button className="secondary-button" onClick={async()=>{try{await request("/sheets/sync-all",post({}));notify("Google Sheets sync requested.");}catch(e){notify(e instanceof Error?e.message:"Sync failed.");}}}>↗ Sync all transactions to Google Sheets</button></section></div>;
}
function TransactionModal({ type, setType, accounts, editing, close, submit }: { type:TxType; setType:(t:TxType)=>void; accounts:Account[]; editing:Transaction|null; close:()=>void; submit:(e:FormEvent<HTMLFormElement>)=>void }) {
  const needsPerson=["lent","borrowed_expense","repayment","collection"].includes(type);const needsAccount=type!=="borrowed_expense";
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><form className="transaction-modal" onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">{editing?"UPDATE LEDGER":"NEW ENTRY"}</span><h2>{editing?"Edit transaction":"Add transaction"}</h2></div><button type="button" className="icon-button" onClick={close}>×</button></div>
    {!editing&&<div className="type-grid">{transactionTypes.map(t=><button type="button" key={t.type} className={type===t.type?"type-option chosen":"type-option"} onClick={()=>setType(t.type)}><span>{t.icon}</span>{t.title}</button>)}<button type="button" className={type==="transfer"?"type-option chosen":"type-option"} onClick={()=>setType("transfer")}><span>⇄</span>Transfer</button><button type="button" className={type==="borrowed_expense"?"type-option chosen":"type-option"} onClick={()=>setType("borrowed_expense")}><span>↙</span>Borrowed</button></div>}
    <label>Amount (₹)<input name="amount" type="number" min="0.01" step="0.01" defaultValue={editing?.amount} required autoFocus/></label>
    {needsAccount&&<label>{type==="repayment"?"Paid from":type==="collection"?"Received in":"Account"}<select name="accountId" defaultValue={editing?.accountId||accounts[0]?.id} required>{accounts.map(a=><option value={a.id} key={a.id}>{a.name} · {money(a.balance)}</option>)}</select></label>}
    {type==="transfer"&&<label>Transfer to<select name="toAccountId" required>{accounts.filter(a=>a.id!==editing?.accountId).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
    {needsPerson&&<label>Person<input name="person" defaultValue={editing?.person} placeholder="Who is this with?" required/></label>}
    <div className="form-two"><label>Category<select name="category" defaultValue={editing?.category||"Food"}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Date<input name="date" type="date" defaultValue={editing?.date||today()} required/></label></div><label>Note (optional)<input name="note" defaultValue={editing?.note||""} placeholder="Add a short note"/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" disabled={!accounts.length&&needsAccount}>{editing?"Save changes":"Add to ledger"}</button></div>{!accounts.length&&<p className="form-warning">Create an account before adding an account-based transaction.</p>}
  </form></div>;
}
