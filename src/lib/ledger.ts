// Pure ledger arithmetic. No database access, so it can be unit-tested.
// All amounts are integer paise.

export type TxRow = {
  type: string;
  amountPaise: number;
  date?: string;
  category?: string;
};
export type OutgoingRow = {
  _id: { accountId: string; type: string };
  totalPaise: number;
};
export type IncomingRow = { _id: string; totalPaise: number };

export const CASH_IN = ["income", "collection", "refund"];
export const CASH_OUT = ["expense", "lent", "repayment", "transfer"];

/** Net spending effect of a transaction: refunds reduce spending, borrowed expenses count as spending. */
export const spendingEffect = (t: { type: string; amountPaise: number }) =>
  t.type === "expense" || t.type === "borrowed_expense"
    ? t.amountPaise
    : t.type === "refund"
      ? -t.amountPaise
      : 0;

/** Combine opening balances with per-account/type totals. Transfers debit the source and credit the destination. */
export function foldBalances(
  openings: Map<string, number>,
  outgoing: OutgoingRow[],
  incoming: IncomingRow[],
) {
  const sums = new Map(openings);
  for (const row of outgoing) {
    const id = row._id.accountId;
    if (!sums.has(id)) continue;
    const n = Number(row.totalPaise || 0);
    if (CASH_IN.includes(row._id.type)) sums.set(id, sums.get(id)! + n);
    else if (CASH_OUT.includes(row._id.type)) sums.set(id, sums.get(id)! - n);
  }
  for (const row of incoming)
    if (sums.has(row._id))
      sums.set(row._id, sums.get(row._id)! + Number(row.totalPaise || 0));
  return sums;
}

export type SummaryInput = {
  today: string;
  payday: string;
  reservePaise: number;
  monthRows: TxRow[];
  unpaidRows: { type: string; amountPaise: number }[];
  balancesPaise: number[];
  allocation?: {
    incomePaise: number;
    essentialsPercent: number;
    savingsPercent: number;
    personalPercent: number;
    futurePercent: number;
    cycleSpendPaise: number;
  };
};

function daysUntilNextPayday(today: string, payday: string) {
  const [year, month, day] = today.split("-").map(Number);
  const paydayDay = Number(payday.slice(8, 10));
  const todayDate = new Date(year, month - 1, day, 12);
  const makePayday = (y: number, m: number) => {
    const lastDay = new Date(y, m, 0).getDate();
    return new Date(y, m - 1, Math.min(paydayDay, lastDay), 12);
  };
  let next = makePayday(year, month);
  if (next < todayDate) {
    const nextMonth = new Date(year, month, 1, 12);
    next = makePayday(nextMonth.getFullYear(), nextMonth.getMonth() + 1);
  }
  return Math.max(1, Math.round((next.getTime() - todayDate.getTime()) / 86400000) + 1);
}

export function computeSummary(i: SummaryInput) {
  let todaySpent = 0,
    monthSpent = 0,
    monthIncome = 0,
    owedToFriends = 0,
    owedByFriends = 0;
  const byCat: Record<string, number> = {};
  for (const item of i.monthRows) {
    const isSpend = item.type === "expense" || item.type === "borrowed_expense";
    const cat = item.category || "Other";
    if (item.date === i.today && isSpend) todaySpent += item.amountPaise;
    monthSpent += spendingEffect(item);
    if (item.type === "income") monthIncome += item.amountPaise;
    if (isSpend) byCat[cat] = (byCat[cat] || 0) + item.amountPaise;
    if (item.type === "refund")
      byCat[cat] = (byCat[cat] || 0) - item.amountPaise;
  }
  for (const item of i.unpaidRows) {
    if (item.type === "borrowed_expense") owedToFriends += item.amountPaise;
    if (item.type === "lent") owedByFriends += item.amountPaise;
  }
  const cash = i.balancesPaise.reduce((s, n) => s + n, 0);
  const days = daysUntilNextPayday(i.today, i.payday);
  const reserve = Number(i.reservePaise || 0);
  const ledgerSpendable = cash - owedToFriends - reserve;
  const protectedAllocations = i.allocation
    ? Math.round(i.allocation.incomePaise * (i.allocation.savingsPercent + i.allocation.futurePercent) / 100)
    : 0;
  const allocatedSpending = i.allocation
    ? Math.round(i.allocation.incomePaise * (i.allocation.essentialsPercent + i.allocation.personalPercent) / 100)
    : Number.POSITIVE_INFINITY;
  const remainingAllocatedSpending = i.allocation
    ? allocatedSpending - i.allocation.cycleSpendPaise
    : Number.POSITIVE_INFINITY;
  const spendable = i.allocation
    ? Math.min(ledgerSpendable - protectedAllocations, remainingAllocatedSpending)
    : ledgerSpendable;
  return {
    todaySpent,
    monthSpent,
    monthIncome,
    owedToFriends,
    owedByFriends,
    byCat,
    cash,
    days,
    reserve,
    ledgerSpendable,
    protectedAllocations,
    allocatedSpending,
    remainingAllocatedSpending,
    spendable,
    perDay: Math.floor(spendable / days),
  };
}
