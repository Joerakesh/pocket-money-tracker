"use client";
import { ui } from "../ui";
type Account={id:string;_id?:string;name:string;institution?:string;kind?:string;balance:number};
type Tx={_id:string;type:string;amount:number;date:string;category?:string;note?:string;person?:string;accountId?:string;settled?:boolean};
type Summary={totalBalance:number;spendable:number;owedToFriends:number;owedByFriends:number;days:number;perDay:number;todaySpent:number;monthSpent:number;monthIncome:number;byCat:Record<string,number>};
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n)||0);
const bankSlugs:Record<string,string>={"State Bank of India":"sbin","Indian Bank":"idib","Kotak Mahindra Bank":"kkbk","HDFC Bank":"hdfc","ICICI Bank":"icic","Axis Bank":"utib","Canara Bank":"cnrb","Bank of Baroda":"barb","Punjab National Bank":"punb","Union Bank of India":"ubin","IDFC FIRST Bank":"idfb","Federal Bank":"fdrl","Indian Overseas Bank":"ioba","South Indian Bank":"sibl","DBS Bank India":"dbss","RBL Bank":"ratn","Equitas Small Finance Bank":"esfb","Jana Small Finance Bank":"jsfb","Ujjivan Small Finance Bank":"ujvn","Tamilnad Mercantile Bank":"tmbl","City Union Bank":"ciub","Karur Vysya Bank":"kvbl"};
const categoryIcons:Record<string,string>={"Food":"🍜","Food & Dining":"🍜","Transport":"🚌","Travel":"✈️","Shopping":"🛍️","Education":"🎓","Bills & Utilities":"🧾","Subscriptions":"📱","Health & Personal Care":"🧴","Entertainment":"🎬","Groceries":"🛒","Family & Friends":"🤝","Other":"✦"};
function BankLogo({ institution }: { institution: string }) {
  const slug = bankSlugs[institution];
  return (
    <span className={ui.bankLogo}>
      {slug ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={ui.bankLogoImg} src={`https://cdn.jsdelivr.net/gh/praveenpuglia/indian-banks/assets/logos/${slug}/symbol.svg`} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      ) : institution === "Cash" ? "₹" : institution === "UPI" ? "↗" : institution.split(/\s+/).filter(Boolean).slice(0, 3).map((x) => x[0]).join("").toUpperCase()}
    </span>
  );
}

const quick = [
  ["expense", "↘", "Expense"],
  ["income", "↗", "Income"],
  ["transfer", "⇄", "Transfer"],
] as const;

export default function Overview({ summary, accounts, transactions, onNavigate }: { summary: Summary | null; accounts: Account[]; transactions: Tx[]; onNavigate: (tab: string, type?: string) => void }) {
  const s = summary;
  const categories = Object.entries(s?.byCat || {}).filter(([, v]) => Number(v) > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...categories.map(([, v]) => v));
  const recent = transactions.slice(0, 5);
  const qaBtn = `flex w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-[7px] rounded-2xl border border-transparent bg-transparent px-[3px] py-2 text-[11px] text-[#d5dbe5] max-[420px]:text-[10px] ${ui.focusRing}`;
  const qaIcon = "grid size-[46px] place-items-center rounded-full bg-[#252d3a] text-[21px] text-[#f3f5fa] max-[420px]:size-[43px]";
  return (
    <>
      <section aria-label="Quick actions" className="mb-3.5 grid grid-cols-4 gap-2 max-[420px]:gap-1">
        {quick.map(([t, icon, label]) => (
          <button key={t} className={qaBtn} type="button" onClick={() => onNavigate("transaction", t)}><span className={qaIcon}>{icon}</span><span>{label}</span></button>
        ))}
        <button className={qaBtn} type="button" onClick={() => onNavigate("accounts")}><span className={qaIcon}>＋</span><span>Accounts</span></button>
      </section>

      <section className={ui.hero}>
        <span aria-hidden className="pointer-events-none absolute -right-[82px] -bottom-[122px] size-[190px] rounded-full border border-[#b8f36b]/[.08] shadow-[0_0_0_18px_rgba(184,243,107,.025),0_0_0_38px_rgba(184,243,107,.02)]" />
        <small className="text-[9px] font-extrabold tracking-[.09em] text-[#b6c2b0]">SAFE TO SPEND · AFTER RESERVE AND UNPAID BORROWED EXPENSES</small>
        <div className={`mt-[13px] mb-2 text-[clamp(38px,10vw,54px)] font-[780] leading-[1.08] tracking-[-.065em] max-[420px]:text-[40px] ${(s?.perDay ?? 0) < 0 ? ui.red : ui.green}`}>
          {money(s?.perDay || 0)} <span className="text-[.38em] font-semibold tracking-[-.02em] text-[#b6c2b0]">/ day</span>
        </div>
        <div className="text-xs text-[#b0bac9]">{money(s?.spendable || 0)} safe to spend · {s?.days ?? 0} day(s) until next allowance</div>
        <div className="relative z-[1] mt-[19px] flex items-center justify-between gap-3 border-t border-white/[.09] pt-[13px] text-[11px] text-[#b6c2b0]">
          <span>Available after reserve</span><strong className="text-[13px] text-[#b8f36b]">{money(s?.spendable || 0)}</strong>
        </div>
      </section>

      <section className={ui.card}>
        <div className={ui.sectionHead}>
          <div><span className={ui.sectionLabel}>YOUR MONEY</span><h2 className={ui.h2Flush}>Your accounts</h2></div>
          <button type="button" className={ui.textAction} onClick={() => onNavigate("accounts")}>Manage <span className="ml-[3px] text-base">→</span></button>
        </div>
        <div className={`${ui.bankGrid} mt-3.5`}>
          {accounts.map((a) => {
            const institution = a.institution || a.kind || a.name;
            return (
              <article className={ui.bankCard} key={a.id || a._id}>
                <div className="flex min-w-0 flex-1 items-center gap-[13px]">
                  <BankLogo institution={institution} />
                  <div className="min-w-0 flex-1"><strong className={ui.bankName}>{a.name}</strong><small className={ui.bankSub}>{institution} · {a.kind || "Account"}</small></div>
                </div>
                <strong className={ui.bankBalance}>{money(a.balance)}</strong>
              </article>
            );
          })}
        </div>
        {!accounts.length && (
          <div className="rounded-2xl border border-dashed border-white/[.075] p-5 text-center text-xs text-[#929bad]">
            No accounts yet. Add your first bank or wallet to start tracking your money.
            <button type="button" className={`${ui.primary} mx-auto mt-3 block !w-auto`} onClick={() => onNavigate("accounts")}>＋ Add account</button>
          </div>
        )}
      </section>

      <section className={ui.card}>
        <div className={`${ui.sectionHead} mb-3.5`}><div><span className={ui.sectionLabel}>BALANCE OVERVIEW</span><h2 className={ui.h2Flush}>Account snapshot</h2></div></div>
        <div className={ui.metrics}>
          <div className={ui.metric}><span className={ui.metricLabel}>Total balances</span><strong className={ui.metricValue}>{money(s?.totalBalance || 0)}</strong></div>
          <div className={ui.metric}><span className={ui.metricLabel}>Owe friends</span><strong className={`${ui.metricValue} ${ui.red}`}>{money(s?.owedToFriends || 0)}</strong></div>
          <div className={ui.metric}><span className={ui.metricLabel}>Owed to you</span><strong className={`${ui.metricValue} ${ui.green}`}>{money(s?.owedByFriends || 0)}</strong></div>
          <div className={ui.metric}><span className={ui.metricLabel}>Safe to spend</span><strong className={`${ui.metricValue} ${ui.green}`}>{money(s?.spendable || 0)}</strong></div>
        </div>
      </section>

      <section className={ui.card}>
        <div className={`${ui.sectionHead} mb-3.5`}>
          <div><span className={ui.sectionLabel}>MONTHLY REPORT</span><h2 className={ui.h2Flush}>This month</h2></div>
          <button type="button" className={ui.textAction} onClick={() => onNavigate("activity")}>Details <span className="ml-[3px] text-base">→</span></button>
        </div>
        <div className={ui.metrics}>
          <div className={ui.metric}><span className={ui.metricLabel}>Spent net of refunds</span><strong className={ui.metricValue}>{money(s?.monthSpent || 0)}</strong></div>
          <div className={ui.metric}><span className={ui.metricLabel}>Income</span><strong className={`${ui.metricValue} ${ui.green}`}>{money(s?.monthIncome || 0)}</strong></div>
          <div className={ui.metric}><span className={ui.metricLabel}>Spent today</span><strong className={ui.metricValue}>{money(s?.todaySpent || 0)}</strong></div>
        </div>
        <div className="mt-[19px] border-t border-white/[.075] pt-4">
          <div className={ui.sectionHead}><h3 className="text-[13px] font-bold tracking-[-.02em]">Spending by category</h3><span className={ui.muted}>{categories.length} categories</span></div>
          {categories.length ? categories.slice(0, 6).map(([name, value]) => (
            <div className="mt-[13px]" key={name}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2"><i className="grid size-[25px] place-items-center rounded-lg bg-[#252f3d] not-italic">{categoryIcons[name] || "•"}</i>{name}</span>
                <strong className="whitespace-nowrap text-xs font-bold">{money(value)}</strong>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#303847]"><i className="block h-full rounded-full bg-linear-to-r from-[#91d957] to-[#b8f36b]" style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }} /></div>
            </div>
          )) : <p className={ui.empty}>No spending recorded this month yet.</p>}
        </div>
      </section>

      <section className={ui.card}>
        <div className={`${ui.sectionHead} mb-3.5`}>
          <div><span className={ui.sectionLabel}>LATEST ACTIVITY</span><h2 className={ui.h2Flush}>Recent transactions</h2></div>
          <button type="button" className={ui.textAction} onClick={() => onNavigate("activity")}>See all <span className="ml-[3px] text-base">→</span></button>
        </div>
        <div className={ui.list}>
          {recent.map((t) => {
            const incoming = ["income", "repayment", "collection", "refund"].includes(t.type);
            const kind = t.type.replaceAll("_", " ");
            return (
              <article className="flex items-center justify-between gap-2.5 border-b border-white/[.075] py-[13px] last:border-b-0" key={t._id}>
                <span className="grid size-[37px] flex-none place-items-center rounded-xl bg-[#252f3d] text-lg text-[#b8f36b]">{incoming ? "↙" : t.type === "transfer" ? "⇄" : "↗"}</span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-xs font-bold">{t.note || t.category || kind}</strong><small className="mt-[3px] block text-[10px] text-[#929bad]">{t.date} · {t.category || kind}{t.person ? " · " + t.person : ""}</small></span>
                <strong className={`whitespace-nowrap text-xs font-bold ${incoming ? ui.green : ""}`}>{incoming ? "+" : "−"}{money(t.amount)}</strong>
              </article>
            );
          })}
        </div>
        {!recent.length && <p className={ui.empty}>No transactions recorded yet. Add your first expense or income.</p>}
      </section>
    </>
  );
}
