import { ui } from "../ui";

type Tx = { _id: string; type: string; amount: number; date: string; category?: string; note?: string; person?: string };
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);

export default function ActivitySection({ transactions, search, onSearch, month, onMonth, onEdit, onDelete }: { transactions: Tx[]; search: string; onSearch: (v: string) => void; month: string; onMonth: (v: string) => void; onEdit: (tx: Tx) => void; onDelete: (tx: Tx) => void }) {
  return (
    <section className={ui.card}>
      <div className={ui.sectionHead}><div><span className={ui.sectionLabel}>SPENDING INSIGHTS</span><h2 className={ui.h2Flush}>Transactions</h2></div></div>
      <div className="my-3 grid grid-cols-[minmax(0,1fr)_minmax(120px,160px)] gap-2 max-[420px]:grid-cols-1">
        <input className={ui.field} value={search} onChange={(e) => onSearch(e.target.value)} type="search" placeholder="Search notes, categories or people" />
        <input className={ui.field} type="month" value={month} onChange={(e) => onMonth(e.target.value)} aria-label="Filter month" />
      </div>
      <div className={`${ui.list} mt-2`}>
        {transactions.map((tx) => (
          <article className={ui.row} key={tx._id}>
            <div className={ui.rowMain}>
              <b className={ui.rowTitle}>{tx.note || tx.category || tx.type}</b>
              <small className={ui.rowSub}>{tx.date} · {tx.category || tx.type}{tx.person ? " · " + tx.person : ""}</small>
            </div>
            <div className={ui.rowSide}>
              <b className={ui.rowTitle}>{money(tx.amount)}</b>
              <div className="flex justify-end gap-1.5">
                <button type="button" className={ui.smallButton} onClick={() => onEdit(tx)}>Edit</button>
                <button type="button" className={`${ui.smallButton} !border-[#ff7887]/20 text-[#ff7887]`} onClick={() => onDelete(tx)}>Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!transactions.length && <p className={ui.muted}>No matching transactions.</p>}
    </section>
  );
}
