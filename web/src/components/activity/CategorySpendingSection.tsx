"use client";

import { useMemo, useState } from "react";
import { ui } from "../ui";

type Tx = {
  _id: string;
  type: string;
  amount: number;
  date: string;
  category?: string;
  note?: string;
  person?: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function CategorySpendingSection({ transactions }: { transactions: Tx[] }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [expanded, setExpanded] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const expenses = transactions.filter(
      (tx) =>
        (tx.type === "expense" || tx.type === "borrowed_expense") &&
        (!month || tx.date.startsWith(month)),
    );
    const groups = new Map<string, Tx[]>();
    for (const tx of expenses) {
      const category = tx.category?.trim() || "Uncategorized";
      groups.set(category, [...(groups.get(category) || []), tx]);
    }
    return [...groups.entries()]
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => b.date.localeCompare(a.date)),
        total: items.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, month]);

  const total = grouped.reduce((sum, group) => sum + group.total, 0);
  const count = grouped.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section className={ui.card}>
      <div className={ui.sectionHead}>
        <div>
          <span className={ui.sectionLabel}>SPENDING BREAKDOWN</span>
          <h2 className={ui.h2Flush}>Category-wise spending</h2>
        </div>
      </div>
      <p className={`${ui.note} mt-2`}>
        See how much you spent in each category. Select a category to view every transaction under it.
      </p>
      <label className={ui.label} htmlFor="category-spending-month">Month</label>
      <input
        id="category-spending-month"
        className={ui.field}
        type="month"
        value={month}
        onChange={(event) => {
          setMonth(event.target.value);
          setExpanded(null);
        }}
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-3">
          <span className={ui.metricLabel}>Total spending</span>
          <strong className="mt-1 block text-lg text-[#ff9aa5]">{money(total)}</strong>
        </div>
        <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-3">
          <span className={ui.metricLabel}>Transactions</span>
          <strong className="mt-1 block text-lg">{count}</strong>
        </div>
      </div>
      <div className="mt-4">
        {grouped.map((group) => {
          const isOpen = expanded === group.category;
          const share = total > 0 ? (group.total / total) * 100 : 0;
          return (
            <div key={group.category} className="border-b border-white/[.07] last:border-b-0">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? null : group.category)}
                className={`flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent py-3.5 text-left ${ui.focusRing}`}
              >
                <span className="grid size-10 flex-none place-items-center rounded-xl bg-white/[.055] text-sm font-bold text-[#b8f36b]">
                  {group.category.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{group.category}</span>
                  <span className="mt-1 block text-[10px] text-[#929bad]">
                    {group.items.length} transaction{group.items.length === 1 ? "" : "s"} · {share.toFixed(1)}% of spending
                  </span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/[.07]">
                    <span className="block h-full rounded-full bg-[#b8f36b]" style={{ width: `${share}%` }} />
                  </span>
                </span>
                <span className="flex-none text-right">
                  <strong className="block whitespace-nowrap text-xs">{money(group.total)}</strong>
                  <span className="mt-1 block text-[10px] text-[#929bad]">{isOpen ? "Hide" : "View"}</span>
                </span>
              </button>
              {isOpen && (
                <div className="mb-3 ml-[52px] rounded-xl border border-white/[.07] bg-black/10 px-3">
                  {group.items.map((tx) => (
                    <div key={tx._id} className="flex items-center gap-3 border-b border-white/[.06] py-3 last:border-b-0">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{tx.note || tx.person || group.category}</span>
                        <span className="mt-1 block text-[10px] text-[#929bad]">
                          {tx.date}{tx.type === "borrowed_expense" ? " · Paid for me" : ""}
                        </span>
                      </span>
                      <strong className="flex-none text-xs text-[#ff9aa5]">−{money(tx.amount)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!grouped.length && (
          <p className={`${ui.muted} py-6 text-center text-xs`}>
            No spending transactions for this month.
          </p>
        )}
      </div>
      <p className={`${ui.note} mt-3 mb-0`}>
        Money lent and account transfers are excluded. Expenses paid by someone else for you are included as spending.
      </p>
    </section>
  );
}
