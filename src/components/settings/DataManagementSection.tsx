"use client";
import { useState, type FormEvent } from "react";
import { ui } from "../ui";

type Account = { id: string; name: string };

export default function DataManagementSection({ settings, onSave, onPreview, accounts, importRows, onCommit }: { settings: any; onSave: (e: FormEvent<HTMLFormElement>) => void; onPreview: (e: FormEvent<HTMLFormElement>) => void; accounts: Account[]; importRows: any[]; onCommit: (id: string) => void }) {
  const [importAccount, setImportAccount] = useState("");
  return (
    <>
      <section className={ui.card}>
        <h2 className={ui.h2}>Allowance settings</h2>
        <form className={ui.formGrid} onSubmit={onSave}>
          <div className={ui.full}><label className={ui.label}>Next allowance date</label><input className={ui.field} type="date" name="payday" defaultValue={settings?.payday || ""} required /></div>
          <div className={ui.full}><label className={ui.label}>Emergency reserve (₹)</label><input className={ui.field} type="number" name="reserve" min="0" step=".01" defaultValue={settings?.reserve ?? (settings?.reservePaise ?? 50000) / 100} /></div>
          <div className={ui.full}><button className={ui.primary}>Save settings</button></div>
        </form>
      </section>

      <section className={ui.card}>
        <div className={ui.sectionHead}><div><span className={ui.sectionLabel}>DATA MANAGEMENT</span><h2 className={ui.h2Flush}>Import bank statement</h2></div></div>
        <p className={`${ui.note} mt-2`}>Preview imported transactions and confirm the correct account before committing.</p>
        <form onSubmit={onPreview}>
          <label className={ui.label}>CSV statement</label>
          <input className={`${ui.field} file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#222a38] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#f5f7fb]`} name="csv" type="file" accept=".csv,text/csv" required />
          <div className="mt-2.5"><button className={ui.ghost}>Preview CSV</button></div>
        </form>
        {importRows.length > 0 && (
          <>
            <p className="mt-4 text-[13px]">{importRows.length} rows ready for review</p>
            <div className={ui.list}>
              {importRows.slice(0, 8).map((r, i) => (
                <div className={ui.row} key={r.importKey || i}><span className={ui.rowMain}>{r.date} · {r.description}</span><b>₹{r.amount}</b></div>
              ))}
            </div>
            <label className={`${ui.label} mt-3`}>Import into account</label>
            <select className={ui.field} value={importAccount} onChange={(e) => setImportAccount(e.target.value)}>
              <option value="">Choose account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button className={`${ui.primary} mt-2`} type="button" disabled={!importAccount} onClick={() => importAccount && onCommit(importAccount)}>Import previewed rows</button>
          </>
        )}
      </section>
    </>
  );
}
