"use client";
type Account={id:string;_id?:string;name:string;institution?:string;kind?:string;balance:number};
type Tx={_id:string;type:string;amount:number;date:string;category?:string;note?:string;person?:string;accountId?:string;settled?:boolean};
type Summary={totalBalance:number;spendable:number;owedToFriends:number;owedByFriends:number;days:number;perDay:number;todaySpent:number;monthSpent:number;monthIncome:number;byCat:Record<string,number>};
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n)||0);
const bankSlugs:Record<string,string>={"State Bank of India":"sbin","Indian Bank":"idib","Kotak Mahindra Bank":"kkbk","HDFC Bank":"hdfc","ICICI Bank":"icic","Axis Bank":"utib","Canara Bank":"cnrb","Bank of Baroda":"barb","Punjab National Bank":"punb","Union Bank of India":"ubin","IDFC FIRST Bank":"idfb","Federal Bank":"fdrl","Indian Overseas Bank":"ioba","South Indian Bank":"sibl","DBS Bank India":"dbss","RBL Bank":"ratn","Equitas Small Finance Bank":"esfb","Jana Small Finance Bank":"jsfb","Ujjivan Small Finance Bank":"ujvn","Tamilnad Mercantile Bank":"tmbl","City Union Bank":"ciub","Karur Vysya Bank":"kvbl"};
const categoryIcons:Record<string,string>={"Food":"🍜","Food & Dining":"🍜","Transport":"🚌","Travel":"✈️","Shopping":"🛍️","Education":"🎓","Bills & Utilities":"🧾","Subscriptions":"📱","Health & Personal Care":"🧴","Entertainment":"🎬","Groceries":"🛒","Family & Friends":"🤝","Other":"✦"};
function BankLogo({institution}:{institution:string}){const slug=bankSlugs[institution];return <span className="bank-logo">{slug?<img src={`https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks/assets/logos/${slug}/symbol.svg`} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display="none";}}/>:institution==="Cash"?"₹":institution==="UPI"?"↗":institution.split(/\\s+/).filter(Boolean).slice(0,3).map(x=>x[0]).join("").toUpperCase()}</span>}
export default function Overview({summary,accounts,transactions,onNavigate}:{summary:Summary|null;accounts:Account[];transactions:Tx[];onNavigate:(tab:string,type?:string)=>void}){
 const s=summary;const categories=Object.entries(s?.byCat||{}).filter(([,v])=>Number(v)>0).sort((a,b)=>b[1]-a[1]);const max=Math.max(1,...categories.map(([,v])=>v));const recent=transactions.slice(0,5);
 return <>
 <section data-page="home" className="quick-actions" aria-label="Quick actions">
  <button className="quick-action" type="button" onClick={()=>onNavigate("transaction","expense")}><span className="qa-icon">↘</span><span>Expense</span></button>
  <button className="quick-action" type="button" onClick={()=>onNavigate("transaction","income")}><span className="qa-icon">↗</span><span>Income</span></button>
  <button className="quick-action" type="button" onClick={()=>onNavigate("transaction","transfer")}><span className="qa-icon">⇄</span><span>Transfer</span></button>
  <button className="quick-action" type="button" onClick={()=>onNavigate("accounts")}><span className="qa-icon">＋</span><span>Accounts</span></button>
 </section>
 <section data-page="home" className="card hero">
  <small>SAFE TO SPEND · AFTER RESERVE AND UNPAID BORROWED EXPENSES</small>
  <div className={"big "+((s?.perDay??0)<0?"red":"green")}>{money(s?.perDay||0)} <span className="hero-per-day">/ day</span></div>
  <div id="heroSub" className="muted">{money(s?.spendable||0)} safe to spend · {s?.days??0} day(s) until next allowance</div>
  <div className="hero-foot"><span>Available after reserve</span><strong>{money(s?.spendable||0)}</strong></div>
 </section>
 <section data-page="home" className="card">
  <div className="sectionhead"><div><span className="section-label">YOUR MONEY</span><h2>Your accounts</h2></div><button type="button" className="text-action" onClick={()=>onNavigate("accounts")}>Manage <span>→</span></button></div>
  <div className="bank-grid">{accounts.map(a=>{const institution=a.institution||a.kind||a.name;return <article className="bank-card" key={a.id||a._id}><div className="bank-card-info"><BankLogo institution={institution}/><div className="bank-meta"><strong>{a.name}</strong><small>{institution} · {a.kind||"Account"}</small></div></div><strong className="bank-balance">{money(a.balance)}</strong></article>})}</div>
  {!accounts.length&&<div className="account-empty">No accounts yet. Add your first bank or wallet to start tracking your money.<button type="button" className="primary" onClick={()=>onNavigate("accounts")}>＋ Add account</button></div>}
 </section>
 <section data-page="home" className="card">
  <div className="sectionhead"><div><span className="section-label">BALANCE OVERVIEW</span><h2>Account snapshot</h2></div></div>
  <div className="metrics">
   <div className="metric"><span>Total balances</span><strong>{money(s?.totalBalance||0)}</strong></div>
   <div className="metric"><span>Owe friends</span><strong className="red">{money(s?.owedToFriends||0)}</strong></div>
   <div className="metric"><span>Owed to you</span><strong className="green">{money(s?.owedByFriends||0)}</strong></div>
   <div className="metric"><span>Safe to spend</span><strong className="green">{money(s?.spendable||0)}</strong></div>
  </div>
 </section>
 <section data-page="home" className="card">
  <div className="sectionhead"><div><span className="section-label">MONTHLY REPORT</span><h2>This month</h2></div><button type="button" className="text-action" onClick={()=>onNavigate("activity")}>Details <span>→</span></button></div>
  <div className="metrics">
   <div className="metric"><span>Spent net of refunds</span><strong>{money(s?.monthSpent||0)}</strong></div>
   <div className="metric"><span>Income</span><strong className="green">{money(s?.monthIncome||0)}</strong></div>
   <div className="metric"><span>Spent today</span><strong>{money(s?.todaySpent||0)}</strong></div>
  </div>
  <div className="home-category-block"><div className="sectionhead"><h3>Spending by category</h3><span className="muted">{categories.length} categories</span></div>
   {categories.length?categories.slice(0,6).map(([name,value])=><div className="home-category" key={name}><div className="home-category-head"><span><i>{categoryIcons[name]||"•"}</i>{name}</span><strong>{money(value)}</strong></div><div className="bar"><i style={{width:`${Math.min(100,Math.max(0,value/max*100))}%`}}/></div></div>):<p className="empty">No spending recorded this month yet.</p>}
  </div>
 </section>
 <section data-page="home" className="card">
  <div className="sectionhead"><div><span className="section-label">LATEST ACTIVITY</span><h2>Recent transactions</h2></div><button type="button" className="text-action" onClick={()=>onNavigate("activity")}>See all <span>→</span></button></div>
  <div className="list">{recent.map(t=>{const incoming=["income","repayment","collection","refund"].includes(t.type);return <article className="item home-tx" key={t._id}><span className="home-tx-icon">{incoming?"↙":t.type==="transfer"?"⇄":"↗"}</span><span className="home-tx-copy"><strong>{t.note||t.category||t.type.replaceAll("_"," ")}</strong><small>{t.date} · {t.category||t.type.replaceAll("_"," ")}{t.person?" · "+t.person:""}</small></span><strong className={"amt "+(incoming?"green":"")}>{incoming?"+":"−"}{money(t.amount)}</strong></article>})}</div>
  {!recent.length&&<p className="empty">No transactions recorded yet. Add your first expense or income.</p>}
 </section>
 </>;
}