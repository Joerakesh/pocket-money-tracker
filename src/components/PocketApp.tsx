"use client";
import {useState} from "react";
import AppHeader from "./layout/AppHeader";
import BottomNavigation from "./layout/BottomNavigation";
import Overview from "./dashboard/Overview";
import TransactionSection from "./transactions/TransactionSection";
import AccountsSection from "./accounts/AccountsSection";
import ActivitySection from "./activity/ActivitySection";
import PlanningSection from "./planning/PlanningSection";
import DataManagementSection from "./settings/DataManagementSection";
const headings:Record<string,[string,string]>={home:["Overview","Your essentials at a glance"],transaction:["New transaction","Record money in, money out and transfers"],activity:["Activity","Your spending and transaction history"],accounts:["Accounts","Manage your wallets and bank accounts"],plan:["Plan","Budgets, goals and recurring expenses"],more:["Settings","Manage your allowance and data"]};
export default function PocketApp(){const [tab,setTab]=useState("home");const [type,setType]=useState("expense");const [refreshKey,setRefreshKey]=useState(0);const [showMore,setShowMore]=useState(false);const [title,subtitle]=headings[tab];return <><main key={refreshKey}><AppHeader onRefresh={()=>setRefreshKey(x=>x+1)} onSettings={()=>setTab("more")}/><div className="page-heading" id="pageHeading"><div><h1>{title}</h1><p>{subtitle}</p></div></div><div className="layout">{tab==="home"&&<Overview/>}{tab==="transaction"&&<TransactionSection type={type} setType={setType}/ >}{tab==="accounts"&&<AccountsSection/>}{tab==="activity"&&<ActivitySection/>}{tab==="plan"&&<PlanningSection/>}{tab==="more"&&<DataManagementSection/>}</div></main><BottomNavigation active={tab} onChange={setTab}/><button type="button" className="floating-add" id="floatingAdd" aria-label="Add transaction" onClick={()=>{setType("expense");setTab("transaction")}}>＋</button></>}
