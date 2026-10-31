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
};

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
  const days = Math.max(
    1,
    Math.round(
      (new Date(`${i.payday}T12:00:00`).getTime() -
        new Date(`${i.today}T12:00:00`).getTime()) /
        86400000,
    ) + 1,
  );
  const reserve = Number(i.reservePaise || 0);
  const spendable = cash - owedToFriends - reserve;
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
    spendable,
    perDay: Math.floor(spendable / days),
  };
}
