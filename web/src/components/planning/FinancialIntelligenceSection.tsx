"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ui } from "../ui";

type Tx = { _id: string; type: string; amount: number; date: string; category?: string; note?: string; allocationSource?: "essentials" | "personal" | "future" | "savings"; createdAt?: string };
type Budget = { category: string; amount: number };
type Summary = { totalBalance: number; spendable: number; days: number; perDay: number; monthSpent: number; monthIncome: number; byCat: Record<string, number> };
type FinancialPlan = { paydayAmount: number; allocationPercentages: { essentials: number; savings: number; personal: number; future: number }; financialFloor: number; emergencyTarget: number };
type Settings = { reserve?: number; reservePaise?: number; financialPlan?: FinancialPlan };
const defaults: FinancialPlan = { paydayAmount: 0, allocationPercentages: { essentials: 50, savings: 10, personal: 25, future: 15 }, financialFloor: 0, emergencyTarget: 0 };
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const spendEffect = (tx: Tx) => tx.type === "expense" || tx.type === "borrowed_expense" ? tx.amount : tx.type === "refund" ? -tx.amount : 0;
const essentialCategories = new Set(["Food", "Food & Dining", "Groceries", "Transport", "Travel", "Education", "Health", "Health & Personal Care", "Bills", "Bills & Utilities"]);

export default function FinancialIntelligenceSection({ summary, transactions, budgets, settings, onSave }: {
  summary: Summary | null; transactions: Tx[]; budgets: Budget[]; settings: Settings | null;
  onSave: (plan: FinancialPlan) => Promise<void>;
}) {
  const savedPlan = settings?.financialPlan || defaults;
  const [plan, setPlan] = useState<FinancialPlan>(savedPlan);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const percentages = plan.allocationPercentages;
  const percentageTotal = percentages.essentials + percentages.savings + percentages.personal + percentages.future;
  const latestIncome = useMemo(() => [...transactions].filter(t => t.type === "income" && t.category !== "Friends" && !/^old balance$/i.test(t.note || "")).sort((a,b) => b.date.localeCompare(a.date) || Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""))[0], [transactions]);
  const incomeAmount = latestIncome?.amount || 0;
  const plannerAmount = Math.max(0, Number(plan.paydayAmount) || 0);
  // Track wallet spending within the latest income cycle, but use the amount
  // explicitly entered in Payday Planner as the allocation base.
  const cycleRows = latestIncome ? transactions.filter(t => t._id !== latestIncome._id && t.date >= latestIncome.date) : [];
  const walletSpent = (key: "essentials" | "personal" | "future" | "savings") => cycleRows.reduce((total, tx) => {
    if (tx.type === "expense" && (tx.allocationSource || "personal") === key) return total + tx.amount;
    if (tx.type === "refund" && (tx.allocationSource || "personal") === key) return total - tx.amount;
    return total;
  }, 0);
  const walletAmounts = { essentials: percentages.essentials, savings: percentages.savings, personal: percentages.personal, future: percentages.future };
  const walletLabels = { essentials: "Essentials", savings: "Savings", personal: "Personal spending", future: "Future expenses" };
  const walletKeys = ["essentials", "personal", "future", "savings"] as const;
  const allocations = [
    { key: "essentials" as const, label: "Essentials", value: percentages.essentials },
    { key: "savings" as const, label: "Savings", value: percentages.savings },
    { key: "personal" as const, label: "Personal spending", value: percentages.personal },
    { key: "future" as const, label: "Future expenses", value: percentages.future },
  ];
  const currentMonth = monthKey(new Date());
  const previousDate = new Date(); previousDate.setMonth(previousDate.getMonth() - 1);
  const previousMonth = monthKey(previousDate);
  const monthly = (key: string) => transactions.filter(t => t.date.startsWith(key));
  const currentRows = monthly(currentMonth), previousRows = monthly(previousMonth);
  const sumIncome = (rows: Tx[]) => rows.filter(t => t.type === "income").reduce((n,t) => n+t.amount,0);
  const sumSpend = (rows: Tx[]) => rows.reduce((n,t) => n+spendEffect(t),0);
  const currentIncome = sumIncome(currentRows), previousIncome = sumIncome(previousRows);
  const currentSpend = sumSpend(currentRows), previousSpend = sumSpend(previousRows);
  const lifestyleIncomeChange = previousIncome > 0 ? ((currentIncome-previousIncome)/previousIncome)*100 : null;
  const lifestyleSpendChange = previousSpend > 0 ? ((currentSpend-previousSpend)/previousSpend)*100 : null;
  const reserve = settings?.reserve ?? (settings?.reservePaise || 0)/100;
  const target = Math.max(0, plan.emergencyTarget);
  const reserveProgress = target > 0 ? Math.min(100, reserve/target*100) : 0;
  const essentialSpend = currentRows.filter(t => essentialCategories.has(t.category || "")).reduce((n,t) => n+spendEffect(t),0);
  const budgetedCategories = budgets.filter(b => b.amount > 0);
  const budgetSpend = budgetedCategories.reduce((n,b) => n+(summary?.byCat?.[b.category] || 0),0);
  const budgetLimit = budgetedCategories.reduce((n,b) => n+b.amount,0);
  const savingsRate = currentIncome > 0 ? Math.max(0, Math.min(1, (currentIncome-currentSpend)/currentIncome)) : 0;
  const savingsPoints = currentIncome > 0 ? savingsRate*35 : 0;
  const reservePoints = target > 0 ? Math.min(30, reserve/target*30) : 0;
  const budgetPoints = budgetLimit > 0 ? Math.max(0, 20*(1-Math.min(1,budgetSpend/budgetLimit))) : 10;
  const disciplinePoints = (summary?.spendable ?? 0) > 0 ? 15 : 0;
  const healthScore = Math.round(savingsPoints+reservePoints+budgetPoints+disciplinePoints);
  const incomeHistory = useMemo(() => {
    const rows = [...transactions].filter(t => t.type === "income" && t.category !== "Friends" && !/^old balance$/i.test(t.note || "")).sort((a,b) => b.date.localeCompare(a.date));
    return rows.slice(0,8).map((income, index) => {
      const nextIncome = rows[index-1];
      const cycleRows = transactions.filter(t => t.date >= income.date && (!nextIncome || t.date < nextIncome.date));
      return { income, spent: cycleRows.reduce((n,t) => n+spendEffect(t),0) };
    });
  }, [transactions]);
  const updatePercent = (key: keyof FinancialPlan["allocationPercentages"], value: number) => {
    setPlan(p => ({ ...p, allocationPercentages: { ...p.allocationPercentages, [key]: Math.max(0, Math.min(100, value || 0)) } }));
  };
  const submit = async (event: FormEvent<HTMLFormElement>, requirePlannerAmount = false) => {
    event.preventDefault();
    if (requirePlannerAmount && !(plan.paydayAmount > 0)) { setMessage("Enter a payday planner amount greater than ₹0."); return; }
    if (percentageTotal !== 100) { setMessage("Allocation percentages must add up to 100%."); return; }
    setSaving(true); setMessage("");
    try { await onSave(plan); setMessage("Financial plan saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save financial plan."); }
    finally { setSaving(false); }
  };

  return (
    <>
      <section className={ui.card}>
        <div className={ui.sectionHead}><div><span className={ui.sectionLabel}>PAYDAY ROUTINE</span><h2 className={ui.h2Flush}>Payday planner</h2></div><span className={ui.pill}>Virtual allocation</span></div>
        <p className={ui.note}>Enter the amount you received or want to plan for this payday. Pocket applies your saved percentages only to this amount; it never substitutes your account balance.</p>
        <form onSubmit={(event) => submit(event, true)} className="grid grid-cols-2 gap-3">
          <label className="col-span-full"><span className={ui.label}>Payday planner amount (₹)</span><input className={ui.field} type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Enter your payday amount" value={plan.paydayAmount || ""} onChange={e => setPlan(p => ({ ...p, paydayAmount: Math.max(0, Number(e.target.value) || 0) }))}/><span className={ui.rowSub}>This is a planning amount only. It does not add income or change account balances.</span></label>
          {allocations.map(item => (
            <label key={item.key} className="min-w-0"><span className={ui.label}>{item.label} (%)</span><input className={ui.field} type="number" min="0" max="100" step="1" value={item.value} onChange={e => updatePercent(item.key, Number(e.target.value))}/><span className={ui.rowSub}>{money(plannerAmount*item.value/100)}</span></label>
          ))}
          <div className="col-span-full flex items-center justify-between rounded-xl bg-white/[.035] px-3 py-2 text-xs"><span>Allocation total</span><strong className={percentageTotal===100 ? ui.green : ui.red}>{percentageTotal}%</strong></div>
          <button className={`${ui.primary} col-span-full`} disabled={saving || percentageTotal!==100}>{saving ? "Saving…" : "Save payday rules"}</button>
        </form>
        {message && <p className={`${ui.note} mt-2`} role="status">{message}</p>}
        {percentageTotal===100 && <div className={`${ui.list} mt-3`}>{allocations.map(item => <div className={ui.row} key={item.key}><span>{item.label} · {item.value}%</span><b>{money(plannerAmount*item.value/100)}</b></div>)}</div>}
      </section>

      <section className={ui.card}>
        <span className={ui.sectionLabel}>VIRTUAL ALLOCATION WALLETS</span><h2 className={ui.h2Flush}>Spend from an allocation</h2>
        <p className={ui.note}>Your latest income starts this cycle. Each wallet keeps its starting allocation fixed; when you record an expense, choose its funding source in the transaction form and that wallet’s remaining amount decreases. These are planning envelopes, not separate bank accounts.</p>
        <div className="mt-3 rounded-2xl border border-white/[.06] bg-white/[.035] p-3"><span className={ui.metricLabel}>Payday amount entered</span><strong className="mt-1 block text-xl">{money(plannerAmount)}</strong><span className={ui.rowSub}>{latestIncome ? `Latest recorded income · ${latestIncome.date} · ${money(incomeAmount)}` : "Enter your payday amount above to preview wallet allocations."}</span></div>
        <div className={`${ui.list} mt-3`}>{walletKeys.map(key => { const allocated = plannerAmount * walletAmounts[key] / 100; const spent = walletSpent(key); const remaining = allocated - spent; return <div className={ui.row} key={key}><span className={ui.rowMain}><b className={ui.rowTitle}>{walletLabels[key]}</b><small className={ui.rowSub}>{walletAmounts[key]}% · Used {money(spent)}</small></span><span className="text-right"><b className={remaining < 0 ? ui.red : ui.green}>{money(remaining)}</b><small className={`${ui.rowSub} block`}>remaining</small></span></div>; })}</div>
        <p className={`${ui.note} mt-2`}>Expenses saved before this feature are treated as Personal spending unless edited. To use Future Expenses, select it under “Fund this expense from” when adding or editing an expense.</p>
      </section>

      <section className={ui.card}>
        <span className={ui.sectionLabel}>BETWEEN PAYDAYS</span><h2 className={ui.h2Flush}>Next payday survival</h2>
        <div className="mt-3 rounded-2xl border border-[#b8f36b]/15 bg-[#b8f36b]/[.055] p-4">
          <span className={ui.metricLabel}>Safe daily spending limit</span>
          <strong className={`mt-1 block text-3xl tracking-tight ${(summary?.perDay || 0)>=0 ? ui.green : ui.red}`}>{money(summary?.perDay || 0)}</strong>
          <span className={ui.rowSub}>{money(summary?.spendable || 0)} spendable across {summary?.days || 0} day(s) until your next allowance.</span>
        </div>
        <p className={`${ui.note} mt-3`}>Safe-to-spend protects the remaining Savings and Future wallets, your reserve, and unpaid borrowed expenses. Spending tagged to Future or Savings reduces that protected wallet instead of consuming your Personal spending allowance. Money lent is excluded from spending reports, but it is not spendable cash until collected.</p>
      </section>

      <section className={ui.card}>
        <span className={ui.sectionLabel}>SAFETY NET</span><h2 className={ui.h2Flush}>Emergency fund & financial floor</h2>
        <form className="mt-3 grid grid-cols-2 gap-3" onSubmit={submit}>
          <label><span className={ui.label}>Monthly essential target (₹)</span><input className={ui.field} type="number" min="0" step=".01" value={plan.financialFloor} onChange={e=>setPlan(p=>({...p,financialFloor:Math.max(0,Number(e.target.value)||0)}))}/></label>
          <label><span className={ui.label}>Emergency fund target (₹)</span><input className={ui.field} type="number" min="0" step=".01" value={plan.emergencyTarget} onChange={e=>setPlan(p=>({...p,emergencyTarget:Math.max(0,Number(e.target.value)||0)}))}/></label>
          <div className="col-span-full"><button className={ui.ghost} type="submit" disabled={saving || percentageTotal!==100}>Save financial targets</button></div>
        </form>
        <div className="mt-4 space-y-3">
          <div className={ui.row}><span>Tracked reserve</span><b>{money(reserve)}</b></div>
          <div className={ui.row}><span>Emergency fund target</span><b>{target>0 ? money(target) : "Not set"}</b></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#b8f36b]" style={{width:`${reserveProgress}%`}}/></div>
          <p className={ui.note}>{target>0 ? `${reserveProgress.toFixed(0)}% of target. Build toward 3–6 months of essential expenses.` : "Set a target to track emergency-fund progress."}</p>
          <div className={ui.row}><span>Essential-category spending this month</span><b>{money(essentialSpend)}</b></div>
          <p className={ui.note}>Compared with your monthly essential target of {money(plan.financialFloor)}. Review category selection to keep this estimate relevant.</p>
        </div>
      </section>

      <section className={ui.card}>
        <span className={ui.sectionLabel}>INCOME CYCLES</span><h2 className={ui.h2Flush}>Payday history</h2>
        <p className={ui.note}>Each allowance or salary starts a payday cycle. Friend reimbursements and opening-balance entries do not reset your allocations.</p>
        {incomeHistory.length ? <div className={ui.list}>{incomeHistory.map(({income,spent})=><div className={ui.row} key={income._id}><span className={ui.rowMain}><b className={ui.rowTitle}>{income.note || income.category || "Income"}</b><small className={ui.rowSub}>{income.date} · Cycle spending {money(spent)}</small></span><b className={ui.green}>{money(income.amount)}</b></div>)}</div> : <p className={ui.empty}>No income transactions recorded yet.</p>}
      </section>

      <section className={ui.card}>
        <span className={ui.sectionLabel}>SPENDING HABITS</span><h2 className={ui.h2Flush}>Lifestyle inflation</h2>
        {previousIncome>0 ? <div className="mt-3 space-y-2"><div className={ui.row}><span>Income change vs last month</span><b className={lifestyleIncomeChange!==null && lifestyleIncomeChange>=0 ? ui.green : ui.red}>{lifestyleIncomeChange!.toFixed(1)}%</b></div><div className={ui.row}><span>Spending change vs last month</span><b className={lifestyleSpendChange!==null && lifestyleSpendChange>0 ? ui.red : ui.green}>{(lifestyleSpendChange || 0).toFixed(1)}%</b></div><p className={ui.note}>{(lifestyleSpendChange || 0)>(lifestyleIncomeChange || 0) ? "Spending is growing faster than income. Consider directing more of the increase toward savings." : "Spending is not outpacing income in this comparison."}</p></div> : <p className={ui.empty}>Record income and spending across two calendar months to unlock this comparison.</p>}
      </section>

      <section className={ui.card}>
        <div className={ui.sectionHead}><div><span className={ui.sectionLabel}>MONTHLY CHECK-IN</span><h2 className={ui.h2Flush}>Financial health score</h2></div><strong className="text-2xl text-[#b8f36b]">{healthScore}/100</strong></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#b8f36b]" style={{width:`${healthScore}%`}}/></div>
        <div className={`${ui.list} mt-3`}>
          <div className={ui.row}><span>Savings rate · 35 points</span><b>{Math.round(savingsPoints)}/35</b></div>
          <div className={ui.row}><span>Emergency reserve · 30 points</span><b>{Math.round(reservePoints)}/30</b></div>
          <div className={ui.row}><span>Budget adherence · 20 points</span><b>{Math.round(budgetPoints)}/20</b></div>
          <div className={ui.row}><span>Positive spendable balance · 15 points</span><b>{disciplinePoints}/15</b></div>
        </div>
        <p className={`${ui.note} mt-2`}>An indicative coaching score, not a credit score. Without category budgets, the budget component starts neutral at 10/20. Transfers are excluded.</p>
      </section>
    </>
  );
}
