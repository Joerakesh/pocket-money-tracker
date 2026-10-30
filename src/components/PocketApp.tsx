"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import AppHeader from "./layout/AppHeader";
import BottomNavigation from "./layout/BottomNavigation";
import Overview from "./dashboard/Overview";
import TransactionSection from "./transactions/TransactionSection";
import AccountsSection from "./accounts/AccountsSection";
import ActivitySection from "./activity/ActivitySection";
import PlanningSection from "./planning/PlanningSection";
import DataManagementSection from "./settings/DataManagementSection";

type Account={id:string;_id?:string;name:string;institution?:string;kind?:string;balance:number};
type Tx={_id:string;type:string;amount:number;date:string;category?:string;note?:string;person?:string;accountId?:string;toAccountId?:string;settled?:boolean};
type Summary={totalBalance:number;spendable:number;owedToFriends:number;owedByFriends:number;days:number;perDay:number;todaySpent:number;monthSpent:number;monthIncome:number;byCat:Record<string,number>};
type Budget={_id?:string;category:string;amount:number};
type Goal={_id?:string;name:string;target:number;saved:number};
type Recurring={_id?:string;name:string;amountPaise?:number;amount?:number;dueDay:number;category:string;active?:boolean};
const headings:Record<string,[string,string]>={home:["Overview","Your essentials at a glance"],transaction:["New transaction","Record money in, money out and transfers"],activity:["Activity","Your spending and transaction history"],accounts:["Accounts","Manage your wallets and bank accounts"],plan:["Plan","Budgets, goals and recurring expenses"],more:["Settings","Manage your allowance and data"]};
async function api<T=any>(path:string,init?:RequestInit):Promise<T>{const res=await fetch("/api"+path,{...init,headers:{...(init?.body?{"Content-Type":"application/json"}:{}),...init?.headers},cache:"no-store"});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"Request failed");return data;}
const post=(body:unknown)=>({method:"POST",body:JSON.stringify(body)});
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n)||0);
export default function PocketApp(){
 const [tab,setTab]=useState("home"),[type,setType]=useState("expense"),[refreshKey,setRefreshKey]=useState(0);
 const [summary,setSummary]=useState<Summary|null>(null),[accounts,setAccounts]=useState<Account[]>([]),[transactions,setTransactions]=useState<Tx[]>([]),[budgets,setBudgets]=useState<Budget[]>([]),[goals,setGoals]=useState<Goal[]>([]),[recurring,setRecurring]=useState<Recurring[]>([]);
 const [settings,setSettings]=useState<any>(null),[busy,setBusy]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [search,setSearch]=useState(""),[month,setMonth]=useState(""),[editing,setEditing]=useState<Tx|null>(null);
 const [importRows,setImportRows]=useState<any[]>([]);
 const load=useCallback(async()=>{setBusy(true);setError("");try{const [s,a,t,b,g,r,st]=await Promise.all([api<Summary>("/summary"),api<Account[]>("/accounts"),api<Tx[]>("/transactions"),api<Budget[]>("/budgets"),api<Goal[]>("/goals"),api<Recurring[]>("/recurring"),api("/settings")]);setSummary(s);setAccounts(a);setTransactions(t);setBudgets(b);setGoals(g);setRecurring(r);setSettings(st);}catch(e){setError(e instanceof Error?e.message:"Could not load your ledger.");}finally{setBusy(false);}},[]);
 useEffect(()=>{void load();},[load,refreshKey]);
 const notify=(s:string)=>{setNotice(s);};
 const visible=useMemo(()=>transactions.filter(t=>(!search||[t.note,t.category,t.person,t.type].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase())))&&(!month||t.date.startsWith(month))),[transactions,search,month]);
 const saveTx=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const payload={type,amount:Number(f.get("amount")),date:String(f.get("date")||new Date().toISOString().slice(0,10)),category:String(f.get("category")||"Other"),note:String(f.get("note")||""),accountId:String(f.get("accountId")||""),toAccountId:String(f.get("toAccountId")||""),person:String(f.get("person")||"")};try{if(editing)await api("/transactions/"+editing._id,{method:"PUT",body:JSON.stringify(payload)});else await api("/transactions",post(payload));setEditing(null);notify(editing?"Transaction updated.":"Transaction saved.");setTab("activity");await load();}catch(err){notify(err instanceof Error?err.message:"Could not save transaction.");}};
 const createAccount=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api("/accounts",post({institution:f.get("institution"),name:f.get("name"),kind:f.get("kind"),openingBalance:Number(f.get("openingBalance")||0)}));notify("Account created.");await load();}catch(err){notify(err instanceof Error?err.message:"Could not create account.");}};
 const savePlan=async(kind:"budget"|"goal"|"recurring",e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const payload=kind==="budget"?{category:f.get("category"),amount:Number(f.get("amount"))}:kind==="goal"?{name:f.get("name"),target:Number(f.get("target")),saved:Number(f.get("saved")||0)}:{name:f.get("name"),amount:Number(f.get("amount")),dueDay:Number(f.get("dueDay")),category:f.get("category")};try{await api("/"+(kind==="goal"?"goals":kind==="budget"?"budgets":"recurring"),post(payload));notify("Saved successfully.");await load();}catch(err){notify(err instanceof Error?err.message:"Could not save.");}};
 const saveSettings=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api("/settings",{method:"PUT",body:JSON.stringify({payday:f.get("payday"),reserve:Number(f.get("reserve")||0)})});notify("Settings saved.");await load();}catch(err){notify(err instanceof Error?err.message:"Could not save settings.");}};
 const removeTx=async(tx:Tx)=>{if(!window.confirm("Move this transaction to deleted history?"))return;try{await api("/transactions/"+tx._id,{method:"DELETE"});notify("Transaction deleted.");await load();}catch(err){notify(err instanceof Error?err.message:"Delete failed.");}};
 const previewCsv=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const file=(new FormData(e.currentTarget).get("csv") as File);if(!file)return;try{const res=await fetch("/api/import/preview",{method:"POST",headers:{"Content-Type":"text/csv"},body:await file.text()});const data=await res.json();if(!res.ok)throw new Error(data.error||"Preview failed");setImportRows(data.rows||[]);notify("CSV preview ready.");}catch(err){notify(err instanceof Error?err.message:"CSV preview failed.");}};
 const commitCsv=async(accountId:string)=>{try{const result=await api("/import/commit",post({rows:importRows,accountId}));notify("Imported "+result.added+" rows; "+result.skipped+" skipped.");setImportRows([]);await load();}catch(err){notify(err instanceof Error?err.message:"Import failed.");}};
 const [title,subtitle]=headings[tab];
 return <><main key={refreshKey}><AppHeader onRefresh={()=>setRefreshKey(x=>x+1)} onSettings={()=>setTab("more")}/><div className="page-heading" id="pageHeading"><div><h1>{title}</h1><p>{subtitle}</p></div></div>
 {error&&<div className="card status" role="alert">{error} <button type="button" onClick={()=>void load()}>Retry</button></div>}
 {notice&&<div className="card status" role="status">{notice}<button type="button" onClick={()=>setNotice("")}>×</button></div>}
 {busy&&!summary?<section className="card">Loading your financial data…</section>:<div className="layout">
 {tab==="home"&&<Overview summary={summary} accounts={accounts} transactions={transactions}/>}
 {tab==="transaction"&&<TransactionSection type={type} setType={setType} accounts={accounts} onSubmit={saveTx} editing={editing}/>}
 {tab==="accounts"&&<AccountsSection accounts={accounts} onSubmit={createAccount}/>}
 {tab==="activity"&&<ActivitySection transactions={visible} search={search} onSearch={setSearch} month={month} onMonth={setMonth} onEdit={(tx)=>{setEditing(tx);setType(tx.type);setTab("transaction");}} onDelete={removeTx}/>}
 {tab==="plan"&&<PlanningSection budgets={budgets} goals={goals} recurring={recurring} onSave={savePlan}/>}
 {tab==="more"&&<DataManagementSection settings={settings} onSave={saveSettings} onPreview={previewCsv} accounts={accounts} importRows={importRows} onCommit={commitCsv}/>}
 </div>}</main><BottomNavigation active={tab} onChange={(next)=>{setEditing(null);setTab(next);}}/><button type="button" className="floating-add" id="floatingAdd" aria-label="Add transaction" onClick={()=>{setEditing(null);setType("expense");setTab("transaction");}}>＋</button></>;
}
