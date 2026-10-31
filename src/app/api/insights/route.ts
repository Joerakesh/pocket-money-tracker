import { NextRequest, NextResponse } from "next/server";
import { collections, accountBalances, accountById, paiseToRupees, today } from "@/lib/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (x: unknown, s = 200) =>
  NextResponse.json(x, { status: s, headers: { "Cache-Control": "no-store" } });

async function requestForecast(dailySpendingPaise: number[]) {
  const baseUrl = process.env.ML_SERVICE_URL?.replace(/\/$/, "");
  if (!baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl}/predict/spending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daily_spending_paise: dailySpendingPaise,
        forecast_days: 30,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error("ML service returned HTTP", response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("ML service unavailable:", error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const c = await collections();
    const params = req.nextUrl.searchParams;
    const month = params.get("month") || today().slice(0, 7);
    const accountId = params.get("accountId") || "";
    if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: "Invalid month." }, 400);

    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const start = `${month}-01`;
    const end = `${month}-${String(lastDay).padStart(2, "0")}`;
    if (accountId) await accountById(c, accountId);

    const filter: Record<string, unknown> = {
      deletedAt: { $exists: false },
      date: { $gte: start, $lte: end },
    };
    if (accountId) filter.$or = [{ accountId }, { toAccountId: accountId }];

    const [rows, accounts] = await Promise.all([
      c.tx.find(filter).sort({ date: 1 }).toArray(),
      accountBalances(c),
    ]);

    const daily: Record<string, { income: number; expense: number; net: number }> = {};
    for (let day = 1; day <= lastDay; day++) {
      daily[`${month}-${String(day).padStart(2, "0")}`] = { income: 0, expense: 0, net: 0 };
    }

    const categories: Record<string, number> = {};
    let income = 0;
    let expense = 0;
    for (const transaction of rows as any[]) {
      const day = daily[transaction.date];
      if (!day) continue;
      const outgoing = !accountId || transaction.accountId === accountId;
      const incoming = !accountId || transaction.toAccountId === accountId;

      if (["income", "collection", "repayment", "refund"].includes(transaction.type) && outgoing) {
        day.income += transaction.amountPaise;
        day.net += transaction.amountPaise;
      }
      if (["expense", "borrowed_expense", "lent"].includes(transaction.type) && outgoing) {
        day.expense += transaction.amountPaise;
        day.net -= transaction.amountPaise;
      }
      if (transaction.type === "transfer") {
        if (outgoing) day.net -= transaction.amountPaise;
        if (incoming) day.net += transaction.amountPaise;
      }
      if (transaction.type === "income" && outgoing) income += transaction.amountPaise;
      if (["expense", "borrowed_expense"].includes(transaction.type) && outgoing) {
        expense += transaction.amountPaise;
        const category = transaction.category || "Other";
        categories[category] = (categories[category] || 0) + transaction.amountPaise;
      }
    }

    // Build a complete, chronological 180-day series. Zero-spend days are meaningful observations.
    const endDate = new Date(`${today()}T00:00:00Z`);
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 179);
    const historyStart = startDate.toISOString().slice(0, 10);
    const historyEnd = today();
    const historyFilter: Record<string, unknown> = {
      deletedAt: { $exists: false },
      date: { $gte: historyStart, $lte: historyEnd },
    };
    if (accountId) {
      historyFilter.type = "expense";
      historyFilter.accountId = accountId;
    } else {
      historyFilter.type = { $in: ["expense", "borrowed_expense"] };
    }

    const history = await c.tx
      .find(historyFilter, { projection: { date: 1, amountPaise: 1 } })
      .sort({ date: 1 })
      .toArray();

    const spendingByDate = new Map<string, number>();
    for (const transaction of history as any[]) {
      spendingByDate.set(
        transaction.date,
        (spendingByDate.get(transaction.date) || 0) + Number(transaction.amountPaise || 0),
      );
    }

    const dailySpendingPaise: number[] = [];
    for (let offset = 0; offset < 180; offset++) {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + offset);
      dailySpendingPaise.push(spendingByDate.get(date.toISOString().slice(0, 10)) || 0);
    }

    const rawPrediction = await requestForecast(dailySpendingPaise);
    const prediction = rawPrediction
      ? {
          ...rawPrediction,
          next30Days: Number(rawPrediction.predicted_total || 0),
          dailyAverage: dailySpendingPaise.reduce((sum, value) => sum + value, 0) / dailySpendingPaise.length / 100,
          observations: rawPrediction.observations,
        }
      : null;

    return json({
      month,
      accountId,
      accounts: accounts
        .filter((account) => !accountId || String(account._id) === accountId)
        .map((account) => ({
          id: String(account._id),
          name: account.name,
          balance: account.balance,
        })),
      totals: {
        income: paiseToRupees(income),
        expense: paiseToRupees(expense),
        net: paiseToRupees(income - expense),
      },
      categories: Object.entries(categories)
        .map(([name, amount]) => ({ name, amount: paiseToRupees(amount) }))
        .sort((a, b) => b.amount - a.amount),
      daily: Object.entries(daily).map(([date, values]) => ({
        date,
        income: paiseToRupees(values.income),
        expense: paiseToRupees(values.expense),
        net: paiseToRupees(values.net),
      })),
      prediction,
      predictionStatus: process.env.ML_SERVICE_URL
        ? prediction
          ? "available"
          : "unavailable"
        : "not_configured",
      forecastHistoryDays: 180,
      transactionCount: rows.length,
    });
  } catch (error) {
    console.error("Insights request failed:", error);
    return json({ error: error instanceof Error ? error.message : "Insights unavailable." }, 400);
  }
}
