import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { accountBalances, collections, paiseToRupees } from "@/lib/finance";
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
    const [accounts, rows] = await Promise.all([
      accountBalances(c),
      c.tx.find(
        { deletedAt: { $exists: false }, date: { $regex: `^${month}` } },
        { projection: { type: 1, amountPaise: 1, category: 1, date: 1 } },
      ).toArray(),
    ]);
    let incomePaise = 0;
    let expensePaise = 0;
    const byCategory: Record<string, number> = {};
    for (const row of rows) {
      const amount = Number(row.amountPaise || 0);
      if (row.type === "income") incomePaise += amount;
      if (row.type === "expense" || row.type === "borrowed_expense") {
        expensePaise += amount;
        const category = String(row.category || "Uncategorised");
        byCategory[category] = (byCategory[category] || 0) + amount;
      }
    }
    return json({
      currency: "INR",
      month,
      totalBalance: paiseToRupees(accounts.reduce((sum, account) => sum + Number(account.balancePaise || 0), 0)),
      accounts: accounts.map((account: any) => ({
        id: String(account._id),
        name: account.name,
        institution: account.institution || "",
        kind: account.kind || "other",
        balance: paiseToRupees(Number(account.balancePaise || 0)),
      })),
      monthIncome: paiseToRupees(incomePaise),
      monthExpenses: paiseToRupees(expensePaise),
      netFlow: paiseToRupees(incomePaise - expensePaise),
      spendingByCategory: Object.fromEntries(
        Object.entries(byCategory).map(([key, value]) => [key, paiseToRupees(value)]),
      ),
      transactionCount: rows.length,
      note: "Transfers are excluded from income and expenses. This endpoint reports ledger account balance, not a bank-verified balance.",
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
