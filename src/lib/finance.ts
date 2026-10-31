import { ObjectId } from "mongodb";
import { getDatabase } from "./mongodb";
import { foldBalances } from "./ledger";
import { rupeesToPaise, paiseToRupees } from "./money";
export { spendingEffect } from "./ledger";
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const monthStart = (date = today()) => `${date.slice(0, 7)}-01`;
export const endOfMonth = (date = today()) => {
  const [y, m] = date.slice(0, 7).split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
};
export { rupeesToPaise, paiseToRupees } from "./money";
export const clean = (v: unknown, max = 160) =>
  String(v || "")
    .trim()
    .slice(0, max);
export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function bad(message: string, status = 400): never {
  throw new HttpError(message, status);
}
export const parseId = (id: unknown) => {
  const value = String(id || "");
  if (!ObjectId.isValid(value)) bad("Invalid record ID.");
  return new ObjectId(value);
};
export const amountIn = (v: unknown) => {
  const amount = rupeesToPaise(v);
  if (!Number.isSafeInteger(amount) || amount <= 0)
    bad("Amount must be greater than ₹0.");
  return amount;
};
export type SettingsDoc = {
  _id: string;
  payday?: string;
  reservePaise?: number;
  currency?: string;
  updatedAt?: Date;
};
let init: Promise<void> | null = null;
export async function collections() {
  const db = await getDatabase();
  if (!init)
    init = (async () => {
      const tx = db.collection("transactions"),
        accounts = db.collection("accounts");
      await Promise.all([
        tx.createIndex({ date: -1, createdAt: -1 }),
        tx.createIndex({ accountId: 1, type: 1 }),
        tx.createIndex({ toAccountId: 1, type: 1 }),
        tx.createIndex({ type: 1, settled: 1 }),
        tx.createIndex({ importKey: 1 }, { unique: true, sparse: true }),
        accounts.createIndex({ name: 1 }, { unique: true }),
      ]);
      if ((await accounts.countDocuments()) === 0)
        await accounts.insertMany([
          {
            name: "Cash",
            kind: "cash",
            openingPaise: 0,
            createdAt: new Date(),
          },
          {
            name: "Bank account",
            kind: "bank",
            openingPaise: 0,
            createdAt: new Date(),
          },
        ]);
    })().catch((e) => {
      init = null;
      throw e;
    });
  await init;
  return {
    db,
    tx: db.collection("transactions"),
    accounts: db.collection("accounts"),
    settings: db.collection<SettingsDoc>("settings"),
    imports: db.collection("imports"),
    budgets: db.collection("budgets"),
    goals: db.collection("goals"),
    recurring: db.collection("recurring"),
  };
}
export async function accountBalances(
  c: Awaited<ReturnType<typeof collections>>,
) {
  const list = await c.accounts.find().sort({ createdAt: 1 }).toArray();
  if (!list.length) return [];
  const ids = list.map((a) => String(a._id));
  const [outgoing, incoming] = await Promise.all([
    c.tx
      .aggregate([
        { $match: { accountId: { $in: ids }, deletedAt: { $exists: false } } },
        {
          $group: {
            _id: { accountId: "$accountId", type: "$type" },
            totalPaise: { $sum: "$amountPaise" },
          },
        },
      ])
      .toArray(),
    c.tx
      .aggregate([
        {
          $match: {
            type: "transfer",
            toAccountId: { $in: ids },
            deletedAt: { $exists: false },
          },
        },
        {
          $group: { _id: "$toAccountId", totalPaise: { $sum: "$amountPaise" } },
        },
      ])
      .toArray(),
  ]);
  const sums = foldBalances(
    new Map(list.map((a) => [String(a._id), Number(a.openingPaise || 0)])),
    outgoing as any,
    incoming as any,
  );
  return list.map((a) => ({
    ...a,
    balancePaise: sums.get(String(a._id)) || 0,
    balance: paiseToRupees(sums.get(String(a._id)) || 0),
  }));
}
export async function accountById(
  c: Awaited<ReturnType<typeof collections>>,
  id: unknown,
) {
  const account = await c.accounts.findOne({ _id: parseId(id) });
  if (!account) bad("Account not found.", 404);
  return account;
}
export async function accountExport(
  c: Awaited<ReturnType<typeof collections>>,
  id: ObjectId,
) {
  const account = await c.accounts.findOne({ _id: id });
  if (!account) bad("Account not found.", 404);
  const accountId = String(id);
  const matched = await c.tx
      .find({ $or: [{ accountId }, { toAccountId: accountId }] })
      .sort({ date: 1, createdAt: 1 })
      .toArray(),
    byId = new Map(matched.map((x) => [String(x._id), x]));
  let frontier = [...byId.keys()];
  while (frontier.length) {
    const linked = await c.tx
      .find({ relatedTransactionId: { $in: frontier } })
      .toArray();
    frontier = [];
    for (const row of linked) {
      const key = String(row._id);
      if (!byId.has(key)) {
        byId.set(key, row);
        frontier.push(key);
      }
    }
  }
  const transactions = [...byId.values()]
    .sort(
      (a, b) =>
        String(a.date || "").localeCompare(String(b.date || "")) ||
        new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime(),
    )
    .map((row) => ({
      ...row,
      _id: String(row._id),
      amount: paiseToRupees(row.amountPaise),
      relatedTransactionId: row.relatedTransactionId
        ? String(row.relatedTransactionId)
        : null,
    }));
  return {
    exportedAt: new Date().toISOString(),
    account: {
      ...account,
      _id: String(account._id),
      name: String(account.name || ""),
    },
    transactions,
    transactionCount: transactions.length,
    formatVersion: 1,
  };
}
export async function syncToSheets(
  c: Awaited<ReturnType<typeof collections>>,
  action: string,
  t: any,
  id: unknown,
) {
  const url = process.env.GOOGLE_SHEETS_WEB_APP_URL,
    secret = process.env.GOOGLE_SHEETS_SECRET;
  if (!url || !secret) return;
  try {
    const account = t?.accountId
        ? await c.accounts.findOne({ _id: parseId(t.accountId) })
        : null,
      toAccount = t?.toAccountId
        ? await c.accounts.findOne({ _id: parseId(t.toAccountId) })
        : null;
    const payload = {
      secret,
      action,
      transactionId: String(id),
      date: t?.date || "",
      createdAt:
        t?.createdAt instanceof Date
          ? t.createdAt.toISOString()
          : new Date().toISOString(),
      type: t?.type || "",
      amount: paiseToRupees(t?.amountPaise || 0),
      category: t?.category || "",
      description: t?.note || t?.category || t?.type || "",
      account: account?.name || "",
      toAccount: toAccount?.name || "",
      person: t?.person || "",
      notes: t?.note || "",
      status: t?.needsReview
        ? "Needs review"
        : t?.settled
          ? "Settled"
          : "Recorded",
      importSource: t?.importSource || "",
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      throw new Error(`Google Sheets returned HTTP ${response.status}`);
    const result = await response.json();
    if (!result.ok)
      throw new Error(result.error || "Google Sheets rejected sync");
  } catch (e) {
    console.error("Google Sheets sync failed:", e);
  }
}
