import test from "node:test";
import assert from "node:assert/strict";
import {
  computeSummary,
  foldBalances,
  spendingEffect,
} from "../src/lib/ledger";
import { rupeesToPaise, paiseToRupees } from "../src/lib/money";

const out = (accountId: string, type: string, totalPaise: number) => ({
  _id: { accountId, type },
  totalPaise,
});

test("rupees <-> paise round-trips common amounts without float drift", () => {
  for (const [r, p] of [
    [19.99, 1999],
    [0.1 + 0.2, 30],
    [0.29, 29],
    [1234.56, 123456],
    [0.01, 1],
  ] as const) {
    assert.equal(rupeesToPaise(r), p);
    assert.equal(paiseToRupees(p), Number(r.toFixed(2)));
  }
  assert.ok(Number.isNaN(rupeesToPaise("abc")));
});

test("income, collection and refund add cash; expense, lent and repayment remove it", () => {
  const b = foldBalances(
    new Map([["a", 100_00]]),
    [
      out("a", "income", 50_00),
      out("a", "collection", 10_00),
      out("a", "refund", 5_00),
      out("a", "expense", 30_00),
      out("a", "lent", 20_00),
      out("a", "repayment", 15_00),
    ],
    [],
  );
  assert.equal(b.get("a"), 100_00 + 65_00 - 65_00);
});

test("transfer debits the source and credits the destination: money is conserved", () => {
  const openings = new Map([
    ["a", 500_00],
    ["b", 100_00],
  ]);
  const b = foldBalances(
    openings,
    [out("a", "transfer", 200_00)],
    [{ _id: "b", totalPaise: 200_00 }],
  );
  assert.equal(b.get("a"), 300_00);
  assert.equal(b.get("b"), 300_00);
  assert.equal(
    [...b.values()].reduce((x, y) => x + y, 0),
    600_00,
  );
});

test("borrowed expenses never touch an account balance", () => {
  const b = foldBalances(
    new Map([["a", 100_00]]),
    [out("a", "borrowed_expense", 40_00)],
    [],
  );
  assert.equal(b.get("a"), 100_00);
});

test("rows for unknown accounts are ignored", () => {
  const b = foldBalances(
    new Map([["a", 1_00]]),
    [out("ghost", "income", 9_00)],
    [{ _id: "ghost", totalPaise: 9_00 }],
  );
  assert.deepEqual([...b.entries()], [["a", 1_00]]);
});

test("spendingEffect: expenses and borrowed expenses spend, refunds give back, others are neutral", () => {
  assert.equal(spendingEffect({ type: "expense", amountPaise: 10 }), 10);
  assert.equal(
    spendingEffect({ type: "borrowed_expense", amountPaise: 10 }),
    10,
  );
  assert.equal(spendingEffect({ type: "refund", amountPaise: 4 }), -4);
  for (const type of ["income", "transfer", "lent", "repayment", "collection"])
    assert.equal(spendingEffect({ type, amountPaise: 99 }), 0);
});

const base = {
  today: "2026-10-10",
  payday: "2026-10-20",
  reservePaise: 500_00,
  monthRows: [],
  unpaidRows: [],
  balancesPaise: [3000_00],
};

test("safe-to-spend = cash - unpaid borrowed expenses - reserve, spread over days incl. payday", () => {
  const s = computeSummary({
    ...base,
    unpaidRows: [
      { type: "borrowed_expense", amountPaise: 200_00 },
      { type: "lent", amountPaise: 700_00 },
    ],
  });
  assert.equal(s.days, 11);
  assert.equal(s.owedToFriends, 200_00);
  assert.equal(s.owedByFriends, 700_00); // money owed TO you is deliberately not counted as spendable
  assert.equal(s.spendable, 3000_00 - 200_00 - 500_00);
  assert.equal(s.perDay, Math.floor(2300_00 / 11));
});

test("manual payday planner amount is the base for protected and spendable allocations", () => {
  const s = computeSummary({
    ...base,
    allocation: {
      essentialsPercent: 50,
      savingsPercent: 20,
      personalPercent: 20,
      futurePercent: 10,
    },
    allocationCycleBasePaise: 1000_00,
  });
  assert.equal(s.protectedAllocations, 300_00);
  assert.equal(s.allocatedSpending, 700_00);
  assert.equal(s.spendable, 700_00);
});

test("money lent is a receivable, not spending, but is not safe-to-spend cash until collected", () => {
  const s = computeSummary({
    ...base,
    balancesPaise: [1411_00], // ₹3,000 opening cash less ₹1,500 lent and ₹89 subscription
    reservePaise: 500_00,
    monthRows: [
      { type: "lent", amountPaise: 1500_00, date: "2026-10-10", category: "Friends" },
      { type: "expense", amountPaise: 89_00, date: "2026-10-10", category: "Subscriptions" },
    ],
    unpaidRows: [{ type: "lent", amountPaise: 1500_00 }],
  });
  assert.equal(s.owedByFriends, 1500_00);
  assert.equal(s.owedToFriends, 0);
  assert.equal(s.monthSpent, 89_00);
  assert.equal(s.spendable, 911_00); // cash after lending + subscription, less reserve
  assert.equal(spendingEffect({ type: "lent", amountPaise: 1500_00 }), 0);
});

test("loan collections reduce the original receivable, including legacy unlinked repayments", () => {
  const s = computeSummary({
    ...base,
    unpaidRows: [
      { _id: "mary-loan", type: "lent", amountPaise: 500_00, person: "Mary" },
      { type: "collection", amountPaise: 500_00, person: "Mary" },
    ],
  });
  assert.equal(s.owedByFriends, 0);
});

test("partial and linked loan repayments leave only the unpaid amount", () => {
  const s = computeSummary({
    ...base,
    unpaidRows: [
      { _id: "loan-1", type: "lent", amountPaise: 1000_00, person: "Thenmozhi" },
      { _id: "loan-2", type: "lent", amountPaise: 500_00, person: "Mary" },
      { type: "collection", amountPaise: 300_00, person: "Thenmozhi", relatedTransactionId: "loan-1" },
      { type: "collection", amountPaise: 500_00, person: "Mary", relatedTransactionId: "loan-2" },
    ],
  });
  assert.equal(s.owedByFriends, 700_00);
});

test("unlinked repayments are allocated oldest-first and cannot create a negative receivable", () => {
  const s = computeSummary({
    ...base,
    unpaidRows: [
      { _id: "loan-1", type: "lent", amountPaise: 300_00, person: "Alex" },
      { _id: "loan-2", type: "lent", amountPaise: 500_00, person: "Alex" },
      { type: "collection", amountPaise: 400_00, person: "Alex" },
    ],
  });
  assert.equal(s.owedByFriends, 400_00);
});

test("payday rolls forward to the next monthly date after the configured date passes", () => {
  assert.equal(computeSummary({ ...base, payday: "2026-10-10" }).days, 1);
  assert.equal(computeSummary({ ...base, payday: "2026-09-01" }).days, 23);
  assert.equal(computeSummary({ ...base, today: "2026-11-01", payday: "2026-10-31" }).days, 30);
});

test("allocation-aware safe-to-spend protects reserve, savings and future allocations", () => {
  const s = computeSummary({
    ...base,
    balancesPaise: [3000_00],
    reservePaise: 500_00,
    allocation: {
      essentialsPercent: 0,
      savingsPercent: 33,
      personalPercent: 27,
      futurePercent: 40,
    },
  });
  assert.equal(s.ledgerSpendable, 2500_00);
  assert.equal(s.protectedAllocations, 2190_00); // 73% of the full ₹3,000 balance
  assert.equal(s.remainingAllocatedSpending, 310_00); // ₹2,500 after reserve, less protected allocations
  assert.equal(s.spendable, 310_00);
  assert.equal(s.days, 11);
  assert.equal(s.perDay, Math.floor(310_00 / 11)); // Spendable ₹310 spread across 11 days.
});

test("allocation uses the current ledger balance without subtracting recorded spending twice", () => {
  const s = computeSummary({
    ...base,
    balancesPaise: [2900_00],
    allocation: {
      essentialsPercent: 0,
      savingsPercent: 33,
      personalPercent: 27,
      futurePercent: 40,
    },
  });
  assert.equal(s.ledgerSpendable, 2400_00);
  assert.equal(s.protectedAllocations, 2117_00); // 73% of the full ₹2,900 balance
  assert.equal(s.spendable, 283_00); // ₹2,400 after reserve, less protected allocations
});

test("spending from Future Expenses reduces that wallet, not the personal safe-to-spend allowance", () => {
  const s = computeSummary({ ...base, balancesPaise: [2700_00], reservePaise: 500_00, allocation: { essentialsPercent: 0, savingsPercent: 33, personalPercent: 27, futurePercent: 40 }, allocationCycleBasePaise: 3000_00, allocationSpentPaise: { essentials: 0, savings: 0, personal: 0, future: 300_00 } });
  assert.equal(s.protectedAllocations, 1890_00);
  assert.equal(s.allocatedSpending, 810_00);
  assert.equal(s.spendable, 310_00);
});

test("spending from Personal Spending reduces safe-to-spend by the same amount", () => {
  const s = computeSummary({ ...base, balancesPaise: [2900_00], reservePaise: 500_00, allocation: { essentialsPercent: 0, savingsPercent: 33, personalPercent: 27, futurePercent: 40 }, allocationCycleBasePaise: 3000_00, allocationSpentPaise: { essentials: 0, savings: 0, personal: 100_00, future: 0 } });
  assert.equal(s.spendable, 210_00);
});

test("allocation never makes safe-to-spend negative when reserve exceeds available cash", () => {
  const s = computeSummary({
    ...base,
    balancesPaise: [100_00],
    allocation: {
      essentialsPercent: 0,
      savingsPercent: 33,
      personalPercent: 27,
      futurePercent: 40,
    },
  });
  assert.equal(s.spendable, 0);
  assert.equal(s.perDay, 0);
});

test("unallocated safe-to-spend reports a shortfall when reserve exceeds cash", () => {
  const s = computeSummary({ ...base, balancesPaise: [100_00] });
  assert.equal(s.spendable, -400_00);
  assert.equal(s.perDay, Math.floor(-400_00 / s.days));
});

test("month totals: refunds reduce spend and category, income is separate, transfers are ignored", () => {
  const s = computeSummary({
    ...base,
    monthRows: [
      {
        type: "expense",
        amountPaise: 100_00,
        date: "2026-10-10",
        category: "Food",
      },
      {
        type: "expense",
        amountPaise: 50_00,
        date: "2026-10-03",
        category: "Food",
      },
      {
        type: "borrowed_expense",
        amountPaise: 80_00,
        date: "2026-10-10",
        category: "Travel",
      },
      {
        type: "refund",
        amountPaise: 30_00,
        date: "2026-10-09",
        category: "Food",
      },
      { type: "income", amountPaise: 900_00, date: "2026-10-01" },
      { type: "transfer", amountPaise: 400_00, date: "2026-10-02" },
      { type: "lent", amountPaise: 60_00, date: "2026-10-10" },
    ],
  });
  assert.equal(s.todaySpent, 180_00);
  assert.equal(s.monthSpent, 100_00 + 50_00 + 80_00 - 30_00);
  assert.equal(s.monthIncome, 900_00);
  assert.deepEqual(s.byCat, { Food: 120_00, Travel: 80_00 });
});

test("uncategorised spending is grouped under Other", () => {
  const s = computeSummary({
    ...base,
    monthRows: [{ type: "expense", amountPaise: 5_00, date: "2026-10-10" }],
  });
  assert.deepEqual(s.byCat, { Other: 5_00 });
});
