"use client";
import type { FormEvent } from "react";
import { useState } from "react";
import BankPicker from "./BankPicker";
import { ui } from "../ui";

type Account = { id: string; name: string; institution?: string; kind?: string; balance: number };
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);

export default function AccountsSection({ accounts, onSubmit, onRefresh }: { accounts: Account[]; onSubmit: (e: FormEvent<HTMLFormElement>) => void; onRefresh?: () => void }) {
  const [busy,setBusy]=useState<string|null>(null),[message,setMessage]=useState("");
  async function manageAccount(account:Account){
    if(busy)return;
    setBusy(account.id);setMessage("");
    try{
      const backupResponse=await fetch("/api/accounts/"+account.id+"/export",{cache:"no-store"});
      const backup=await backupResponse.json();
      if(!backupResponse.ok)throw new Error(backup.error||"Could not prepare account backup.");
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob),link=document.createElement("a");
      link.href=url;link.download="account-"+account.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-backup.json";
      document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
      const count=Number(backup.transactionCount||0);
      const confirmed=window.confirm("A backup of "+account.name+" has been downloaded ("+count+" linked transaction records). Delete this account and its linked transaction history permanently? This cannot be undone.");
      if(!confirmed)return;
      const response=await fetch("/api/accounts/"+account.id,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({transactionIds:(backup.transactions||[]).map((t:{_id:string})=>t._id)})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not delete account.");
      setMessage("Deleted "+account.name+" and "+(result.deletedTransactions||0)+" linked transaction records. Backup saved to your downloads.");
      onRefresh?.();
    }catch(error){setMessage(error instanceof Error?error.message:"Account management failed.");}
    finally{setBusy(null);}
  }
  return (
    <>
      <section className={ui.card}>
        <div className={ui.sectionHead}>
          <div><span className={ui.sectionLabel}>WALLET SETTINGS</span><h2 className={ui.h2Flush}>Manage accounts</h2></div>
          <span className={ui.pill}>{accounts.length} accounts</span>
        </div>
        <p className={ui.note+" mt-2"}>Add bank accounts, cash wallets and UPI accounts. You can also export and permanently delete an account.</p>
        <form className={ui.formGrid+" mt-4"} onSubmit={onSubmit}>
          <div className={ui.full}><label className={ui.label}>Choose bank or provider</label><BankPicker /></div>
          <div><label className={ui.label} htmlFor="accountName">Account nickname (optional)</label><input className={ui.field} id="accountName" name="name" maxLength={60} placeholder="e.g. Personal savings" /></div>
          <div><label className={ui.label} htmlFor="opening">Opening balance (₹)</label><input className={ui.field} id="opening" name="openingBalance" type="number" min="0" step=".01" defaultValue="0" required /></div>
          <input name="kind" type="hidden" value="bank" readOnly />
          <div className={ui.full}><button className={ui.primary} type="submit">＋ Create account</button></div>
        </form>
      </section>
      {message&&<p className={ui.card+" text-xs text-[#ffb5a9]"} role="status">{message}</p>}
      <section className={ui.card}>
        <h2 className={ui.h2}>Your accounts</h2>
        <div className={ui.bankGrid}>
          {accounts.map((a) => (
            <article className={ui.bankCard+" justify-between gap-3"} key={a.id}>
              <div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><b className={ui.bankName}>{a.name}</b><small className={ui.bankSub}>{a.institution || a.kind || "Account"}</small></div><strong className={ui.bankBalance}>{money(a.balance)}</strong></div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[.08] pt-2">
                <small className="text-[10px] text-[#929bad]">Account management</small>
                <button type="button" className={ui.smallButton+" text-[#ff9aa5]"} disabled={busy!==null} onClick={()=>void manageAccount(a)}>{busy===a.id?"Preparing backup…":"Export & delete"}</button>
              </div>
            </article>
          ))}
        </div>
        {!accounts.length && <p className={ui.muted}>No accounts available.</p>}
        <p className={ui.note}>Deleting an account first downloads a JSON backup, then asks for confirmation. Its linked transaction records are permanently deleted only after confirmation.</p>
      </section>
    </>
  );
}
