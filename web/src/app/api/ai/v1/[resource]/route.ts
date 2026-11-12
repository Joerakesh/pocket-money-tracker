import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { accountBalances, collections, endOfMonth, monthStart, paiseToRupees, spendingEffect, today } from "@/lib/finance";
import { computeSummary } from "@/lib/ledger";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function authenticate(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !token.startsWith("pocket_live_")) return null;

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = await getDatabase();
  const record = await db.collection("pocket_ai_tokens").findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!record || !record.uid || !record.email || !record.scopes?.includes("finance:read")) return null;
  return { uid: String(record.uid), email: String(record.email) };
}

function publicTransaction(row: any) {
  return {
    id: String(row._id),
    date: row.date,
    type: row.type,
    amount: paiseToRupees(Number(row.amountPaise || 0)),
    currency: "INR",
    category: row.category || "Uncategorised",
    note: row.note || "",
    person: row.person || null,
    settled: typeof row.settled === "boolean" ? row.settled : null,
    allocationSource: row.allocationSource || null,
    accountId: row.accountId || null,
    toAccountId: row.toAccountId || null,
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  const identity = await authenticate(request);
  if (!identity) return json({ error: "Invalid, expired or revoked Pocket API key." }, 401);

  const { resource } = await context.params;
  const c = await collections(identity);
  const params = request.nextUrl.searchParams;
  const now = new Date();
  const month = params.get("month") || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (!/^[0-9]{4}-[0-9]{2}$/.test(month)) return json({ error: "month must use YYYY-MM." }, 400);

  if (resource === "overview") {
    const currentDay = today();
    const selectedStart = `${month}-01`;
    const selectedEndDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const selectedEnd = `${month}-${String(selectedEndDate).padStart(2, "0")}`;
    const [accounts, selectedMonthRows, settings, currentMonthRows, unpaidRows, latestIncome] = await Promise.all([
      accountBalances(c),
      c.tx.find(
        { deletedAt: { $exists: false }, date: { $gte: selectedStart, $lte: selectedEnd } },
        { projection: { date: 1, type: 1, amountPaise: 1, category: 1, settled: 1 } },
      ).toArray(),
      c.settings.findOne({ _id: "main" }),
      c.tx.find(
        { deletedAt: { $exists: false }, date: { $gte: monthStart(currentDay), $lte: endOfMonth(currentDay) } },
        { projection: { date: 1, type: 1, amountPaise: 1, category: 1, settled: 1 } },
      ).toArray(),
      c.tx.find(
        { deletedAt: { $exists: false }, type: { $in: ["borrowed_expense", "lent", "repayment", "collection"] } },
        { projection: { _id: 1, type: 1, amountPaise: 1, relatedTransactionId: 1, person: 1, settled: 1, date: 1 } },
      ).sort({ date: 1, createdAt: 1 }).toArray(),
      c.tx.findOne(
        { deletedAt: { $exists: false }, type: "income", category: { $ne: "Friends" }, note: { $not: /^old balance$/i } },
        { sort: { date: -1, createdAt: -1 }, projection: { date: 1, _id: 1 } },
      ),
    ]);

    let monthIncomePaise = 0;
    let monthSpentPaise = 0;
    const byCategoryPaise: Record<string, number> = {};
    for (const row of selectedMonthRows) {
      const amount = Number(row.amountPaise || 0);
      if (row.type === "income") monthIncomePaise += amount;
      monthSpentPaise += spendingEffect({ type: String(row.type), amountPaise: amount });
      if (row.type === "expense" || row.type === "borrowed_expense" || row.type === "refund") {
        const category = String(row.category || "Other");
        byCategoryPaise[category] = (byCategoryPaise[category] || 0) +
          (row.type === "refund" ? -amount : amount);
      }
    }

    const cycleRows = latestIncome
      ? await c.tx.find(
          { deletedAt: { $exists: false }, date: { $gte: latestIncome.date }, _id: { $ne: latestIncome._id } },
          { projection: { type: 1, amountPaise: 1, allocationSource: 1 } },
        ).toArray()
      : [];
    const allocationSpentPaise = { essentials: 0, savings: 0, personal: 0, future: 0 };
    const allocationSources = new Set(["essentials", "savings", "personal", "future"]);
    for (const row of cycleRows) {
      if (row.type !== "expense" && row.type !== "refund") continue;
      const rawSource = String(row.allocationSource || "personal");
      const source = allocationSources.has(rawSource) ? rawSource as keyof typeof allocationSpentPaise : "personal";
      allocationSpentPaise[source] += Number(row.amountPaise || 0) * (row.type === "refund" ? -1 : 1);
    }

    const percentages = settings?.financialPlan?.allocationPercentages;
    const allocation = percentages ? {
      essentialsPercent: Number(percentages.essentials || 0),
      savingsPercent: Number(percentages.savings || 0),
      personalPercent: Number(percentages.personal || 0),
      futurePercent: Number(percentages.future || 0),
    } : undefined;
    const currentSummary = computeSummary({
      today: currentDay,
      payday: settings?.payday || endOfMonth(currentDay),
      reservePaise: Number(settings?.reservePaise || 0),
      monthRows: currentMonthRows as any,
      unpaidRows: unpaidRows.map((row: any) => ({
        ...row,
        _id: String(row._id),
        relatedTransactionId: row.relatedTransactionId ? String(row.relatedTransactionId) : undefined,
      })) as any,
      balancesPaise: accounts.map((account: any) => Number(account.balancePaise || 0)),
      allocation,
      allocationCycleBasePaise: Math.max(0, Number(settings?.financialPlan?.plannerAmountPaise || 0)),
      allocationSpentPaise,
    });

    return json({
      currency: "INR",
      month,
      totalBalance: paiseToRupees(accounts.reduce((sum, account: any) => sum + Number(account.balancePaise || 0), 0)),
      spendable: paiseToRupees(currentSummary.spendable),
      ledgerSpendable: paiseToRupees(currentSummary.ledgerSpendable),
      perDayAllowance: paiseToRupees(currentSummary.perDay),
      daysUntilPayday: currentSummary.days,
      reserve: paiseToRupees(currentSummary.reserve),
      owedToFriends: paiseToRupees(currentSummary.owedToFriends),
      owedByFriends: paiseToRupees(currentSummary.owedByFriends),
      protectedAllocations: paiseToRupees(currentSummary.protectedAllocations),
      todaySpent: paiseToRupees(currentSummary.todaySpent),
      currentMonthSpent: paiseToRupees(currentSummary.monthSpent),
      monthIncome: paiseToRupees(monthIncomePaise),
      monthExpenses: paiseToRupees(monthSpentPaise),
      netFlow: paiseToRupees(monthIncomePaise - monthSpentPaise),
      accounts: accounts.map((account: any) => ({
        id: String(account._id),
        name: account.name,
        institution: account.institution || "",
        kind: account.kind || "other",
        balance: paiseToRupees(Number(account.balancePaise || 0)),
      })),
      spendingByCategory: Object.fromEntries(
        Object.entries(byCategoryPaise).map(([key, value]) => [key, paiseToRupees(value)]),
      ),
      transactionCount: selectedMonthRows.length,
      note: "Spendable is calculated using Pocket's existing payday, reserve, allocation and outstanding-debt rules. Transfers are excluded from income and spending. Balances are ledger-derived, not bank-verified.",
    });
  }

  if (resource === "transactions") {
    const filter: Record<string, any> = { deletedAt: { $exists: false } };
    if (params.has("month")) filter.date = { $regex: `^${month}` };
    if (params.has("from") || params.has("to")) {
      filter.date = {};
      if (params.has("from")) filter.date.$gte = params.get("from");
      if (params.has("to")) filter.date.$lte = params.get("to");
    }
    if (params.has("type")) filter.type = params.get("type");
    if (params.has("category")) filter.category = params.get("category");
    const limit = Math.min(200, Math.max(1, Number(params.get("limit") || 50)));
    const rows = await c.tx.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit).toArray();
    return json({ count: rows.length, limit, transactions: rows.map(publicTransaction) });
  }

  if (resource === "budgets") {
    const rows = await c.budgets.find().sort({ category: 1 }).toArray();
    return json(rows.map((row: any) => ({
      id: String(row._id),
      category: row.category,
      monthlyLimit: paiseToRupees(Number(row.amountPaise || 0)),
      currency: "INR",
    })));
  }

  if (resource === "goals") {
    const rows = await c.goals.find().sort({ createdAt: -1 }).toArray();
    return json(rows.map((row: any) => ({
      id: String(row._id),
      name: row.name,
      target: paiseToRupees(Number(row.targetPaise || 0)),
      saved: paiseToRupees(Number(row.savedPaise || 0)),
      remaining: paiseToRupees(Math.max(0, Number(row.targetPaise || 0) - Number(row.savedPaise || 0))),
      progressPercent: Number(row.targetPaise) > 0 ? Math.min(100, Math.round(Number(row.savedPaise || 0) / Number(row.targetPaise) * 100)) : 0,
      currency: "INR",
    })));
  }

  if (resource === "recurring") {
    const rows = await c.recurring.find({ active: { $ne: false } }).sort({ dueDay: 1 }).toArray();
    return json(rows.map((row: any) => ({
      id: String(row._id),
      name: row.name,
      amount: paiseToRupees(Number(row.amountPaise || 0)),
      dueDay: row.dueDay,
      category: row.category || "Subscriptions",
      currency: "INR",
    })));
  }

  return json({ error: "Unknown resource. See /api/ai/openapi." }, 404);
}
