require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is missing. Copy .env.example to .env and configure it.');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: ['text/csv', 'application/csv'], limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const client = new MongoClient(process.env.MONGODB_URI);
let db, tx, accounts, settings, imports, budgets, goals, recurring;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const monthStart = (date = today()) => `${date.slice(0, 7)}-01`;
const endOfMonth = (date = today()) => {
  const [y, m] = date.slice(0, 7).split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
};
const dateDiff = (a, b) => Math.max(0, Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000));
const rupeesToPaise = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
};
const paiseToRupees = (value) => Number((Number(value || 0) / 100).toFixed(2));
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => {
  console.error(e);
  res.status(e.status || 500).json({ error: e.status ? e.message : 'Server error. Check the server terminal.' });
});
const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const validId = (id) => ObjectId.isValid(id);
const parseId = (id) => {
  if (!validId(id)) throw bad('Invalid record ID.');
  return new ObjectId(id);
};
const amountIn = (value) => {
  const amount = rupeesToPaise(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw bad('Amount must be greater than ₹0.');
  return amount;
};
const clean = (v, max = 160) => String(v || '').trim().slice(0, max);

// Google Sheets sync is optional. A sync failure never rolls back a saved MongoDB transaction.
async function syncToGoogleSheets(action, transaction, transactionId) {
  const url = process.env.GOOGLE_SHEETS_WEB_APP_URL;
  const secret = process.env.GOOGLE_SHEETS_SECRET;
  if (!url || !secret) return;
  try {
    let accountName = '';
    if (transaction && transaction.accountId) {
      const account = await accounts.findOne({ _id: parseId(transaction.accountId) });
      accountName = account?.name || '';
    }
    let toAccountName = '';
    if (transaction && transaction.toAccountId) {
      const account = await accounts.findOne({ _id: parseId(transaction.toAccountId) });
      toAccountName = account?.name || '';
    }
    const payload = {
      secret, action, transactionId: String(transactionId),
      date: transaction?.date || '',
      createdAt: transaction?.createdAt instanceof Date ? transaction.createdAt.toISOString() : new Date().toISOString(),
      type: transaction?.type || '', amount: paiseToRupees(transaction?.amountPaise || 0),
      category: transaction?.category || '', description: transaction?.note || transaction?.category || transaction?.type || '',
      account: accountName, toAccount: toAccountName, person: transaction?.person || '',
      notes: transaction?.note || '', status: transaction?.needsReview ? 'Needs review' : (transaction?.settled ? 'Settled' : 'Recorded'),
      importSource: transaction?.importSource || ''
    };
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Google Sheets returned HTTP ${response.status}`);
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'Google Sheets rejected the sync');
  } catch (error) {
    console.error('Google Sheets sync failed:', error.message);
  }
}

async function getMainSettings() {
  return await settings.findOne({ _id: 'main' }) || {
    _id: 'main', payday: endOfMonth(), reservePaise: 50000, currency: 'INR'
  };
}
async function ensureDefaultAccount() {
  const count = await accounts.countDocuments();
  if (!count) {
    await accounts.insertOne({ name: 'Cash', kind: 'cash', openingPaise: 0, createdAt: new Date() });
    await accounts.insertOne({ name: 'Bank account', kind: 'bank', openingPaise: 0, createdAt: new Date() });
  }
}
async function accountById(id) {
  const account = await accounts.findOne({ _id: parseId(id) });
  if (!account) throw bad('Account not found.', 404);
  return account;
}

// Account balances are derived from the ledger. Transfers affect two accounts but never count as income/spending.
async function accountBalances() {
  const list = await accounts.find().sort({ createdAt: 1 }).toArray();
  const ledger = await tx.find().toArray();
  const sums = new Map(list.map(a => [String(a._id), Number(a.openingPaise || 0)]));
  for (const t of ledger) {
    const amount = Number(t.amountPaise || 0);
    if (t.accountId && sums.has(t.accountId)) {
      if (['income', 'collection', 'refund'].includes(t.type)) sums.set(t.accountId, sums.get(t.accountId) + amount);
      if (['expense', 'lent', 'repayment'].includes(t.type)) sums.set(t.accountId, sums.get(t.accountId) - amount);
      if (t.type === 'transfer') sums.set(t.accountId, sums.get(t.accountId) - amount);
    }
    if (t.type === 'transfer' && t.toAccountId && sums.has(t.toAccountId)) {
      sums.set(t.toAccountId, sums.get(t.toAccountId) + amount);
    }
  }
  return list.map(a => ({ ...a, balancePaise: sums.get(String(a._id)) || 0, balance: paiseToRupees(sums.get(String(a._id)) || 0) }));
}

function ledgerEffect(t) {
  // Effect on available cash across all owned accounts.
  if (['income', 'collection', 'refund'].includes(t.type)) return t.amountPaise;
  if (['expense', 'lent', 'repayment'].includes(t.type)) return -t.amountPaise;
  return 0; // internal transfer
}
function spendingEffect(t) {
  if (t.type === 'expense' || t.type === 'borrowed_expense') return t.amountPaise;
  if (t.type === 'refund') return -t.amountPaise;
  return 0;
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/accounts', wrap(async (req, res) => {
  res.json(await accountBalances());
}));
app.post('/api/accounts', wrap(async (req, res) => {
  const institution = clean(req.body.institution || '', 80);
  const label = clean(req.body.name || '', 60);
  const kind = clean(req.body.kind || (institution === 'Cash' ? 'cash' : institution === 'UPI' ? 'upi' : 'bank'), 30);
  let name = label || institution || 'Account';
  if (!name) throw bad('Account name is required.');
  if (!label) {
    const existing = await accounts.countDocuments({ institution });
    if (existing) name = `${institution} · ${existing + 1}`;
  }
  const openingPaise = Math.round(Number(req.body.openingBalance || 0) * 100);
  if (!Number.isSafeInteger(openingPaise) || openingPaise < 0) throw bad('Opening balance is invalid.');
  const result = await accounts.insertOne({ name, institution, kind, openingPaise, createdAt: new Date() });
  res.status(201).json({ ok: true, id: String(result.insertedId) });
}));

app.delete('/api/accounts/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const account = await accounts.findOne({ _id: id });
  if (!account) throw bad('Account not found.', 404);
  const linked = await tx.countDocuments({ $or: [{ accountId: String(id) }, { toAccountId: String(id) }] });
  if (linked > 0) throw bad('This account has transaction history. Move or remove its transactions before deleting it.', 409);
  const count = await accounts.countDocuments();
  if (count <= 1) throw bad('Keep at least one account in your wallet.', 409);
  await accounts.deleteOne({ _id: id });
  res.json({ ok: true });
}));
app.get('/api/settings', wrap(async (req, res) => res.json(await getMainSettings())));
app.put('/api/settings', wrap(async (req, res) => {
  const payday = clean(req.body.payday || endOfMonth(), 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payday)) throw bad('Payday must use YYYY-MM-DD.');
  const reservePaise = Math.max(0, Math.round(Number(req.body.reserve || 0) * 100));
  await settings.updateOne({ _id: 'main' }, { $set: { payday, reservePaise, updatedAt: new Date() } }, { upsert: true });
  res.json({ ok: true });
}));

app.get('/api/transactions', wrap(async (req, res) => {
  const filter = {};
  if (req.query.month) filter.date = { $regex: `^${String(req.query.month).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
  const rows = await tx.find(filter).sort({ date: -1, createdAt: -1 }).limit(500).toArray();
  res.json(rows.map(t => ({ ...t, amount: paiseToRupees(t.amountPaise), _id: String(t._id) })));
}));

app.post('/api/transactions', wrap(async (req, res) => {
  const b = req.body || {};
  const allowed = ['expense', 'income', 'transfer', 'lent', 'borrowed_expense', 'repayment', 'collection', 'refund'];
  if (!allowed.includes(b.type)) throw bad('Choose a valid transaction type.');
  const amountPaise = amountIn(b.amount);
  const date = clean(b.date || today(), 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad('Date must use YYYY-MM-DD.');
  const doc = {
    type: b.type, amountPaise, date, category: clean(b.category || 'Other', 50),
    note: clean(b.note, 200), accountId: null, createdAt: new Date()
  };
  if (['expense', 'income', 'transfer', 'lent', 'repayment', 'collection', 'refund'].includes(b.type)) {
    if (!b.accountId) throw bad('Select the account used for this transaction.');
    await accountById(b.accountId);
    doc.accountId = String(b.accountId);
  }
  if (b.type === 'transfer') {
    if (!b.toAccountId || b.toAccountId === b.accountId) throw bad('Choose two different accounts for a transfer.');
    await accountById(b.toAccountId);
    doc.toAccountId = String(b.toAccountId);
  }
  if (['lent', 'borrowed_expense', 'repayment', 'collection'].includes(b.type)) {
    doc.person = clean(b.person, 80);
    if (!doc.person) throw bad('Enter the other person’s name.');
  }
  if (b.relatedTransactionId) {
    const related = await tx.findOne({ _id: parseId(b.relatedTransactionId) });
    if (!related) throw bad('Linked transaction not found.');
    doc.relatedTransactionId = String(related._id);
  }
  if (b.type === 'borrowed_expense') {
    // Someone else paid: it is spending, but does not reduce your cash account.
    doc.accountId = null;
    doc.settled = false;
  }
  const result = await tx.insertOne(doc);
  await syncToGoogleSheets('upsert', doc, result.insertedId);
  res.status(201).json({ ok: true, id: String(result.insertedId) });
}));

app.delete('/api/transactions/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const t = await tx.findOne({ _id: id });
  if (!t) throw bad('Transaction not found.', 404);
  await tx.deleteOne({ _id: id });
  await syncToGoogleSheets('delete', t, id);
  res.json({ ok: true });
}));

app.post('/api/transactions/:id/settle', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const original = await tx.findOne({ _id: id });
  if (!original || !['borrowed_expense', 'lent'].includes(original.type)) throw bad('Only a loan or borrowed expense can be settled.');
  if (original.settled) throw bad('This item is already settled.');
  const accountId = clean(req.body.accountId, 40);
  await accountById(accountId);
  const settlementType = original.type === 'borrowed_expense' ? 'repayment' : 'collection';
  const settlement = {
    type: settlementType, amountPaise: original.amountPaise, date: today(),
    category: 'Friends', note: `Settlement: ${original.note || original.person}`,
    person: original.person, accountId, relatedTransactionId: String(original._id), createdAt: new Date()
  };
  const settledResult = await tx.insertOne(settlement);
  await syncToGoogleSheets('upsert', settlement, settledResult.insertedId);
  await tx.updateOne({ _id: id }, { $set: { settled: true, settledAt: today() } });
  const updatedOriginal = await tx.findOne({ _id: id });
  await syncToGoogleSheets('upsert', updatedOriginal, id);
  res.json({ ok: true });
}));

// Budgets: values are stored as paise per calendar month.
app.get('/api/budgets', wrap(async (req, res) => {
  const list = await budgets.find().sort({ category: 1 }).toArray();
  res.json(list.map(x => ({ ...x, amount: paiseToRupees(x.amountPaise), _id: String(x._id) })));
}));
app.post('/api/budgets', wrap(async (req, res) => {
  const category = clean(req.body.category, 50);
  const amountPaise = amountIn(req.body.amount);
  if (!category) throw bad('Category is required.');
  await budgets.updateOne({ category }, { $set: { category, amountPaise, updatedAt: new Date() } }, { upsert: true });
  res.json({ ok: true });
}));

app.get('/api/goals', wrap(async (req, res) => {
  const list = await goals.find().sort({ createdAt: -1 }).toArray();
  res.json(list.map(g => ({ ...g, target: paiseToRupees(g.targetPaise), saved: paiseToRupees(g.savedPaise), _id: String(g._id) })));
}));
app.post('/api/goals', wrap(async (req, res) => {
  const name = clean(req.body.name, 80);
  const targetPaise = amountIn(req.body.target);
  const savedPaise = Math.max(0, Math.round(Number(req.body.saved || 0) * 100));
  if (!name) throw bad('Goal name is required.');
  await goals.insertOne({ name, targetPaise, savedPaise, createdAt: new Date() });
  res.json({ ok: true });
}));

app.get('/api/recurring', wrap(async (req, res) => res.json(await recurring.find().sort({ dueDay: 1 }).toArray())));
app.post('/api/recurring', wrap(async (req, res) => {
  const name = clean(req.body.name, 80);
  const amountPaise = amountIn(req.body.amount);
  const dueDay = Number(req.body.dueDay);
  if (!name) throw bad('Name is required.');
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw bad('Due day must be between 1 and 31.');
  await recurring.insertOne({ name, amountPaise, dueDay, category: clean(req.body.category || 'Subscriptions', 50), active: true, createdAt: new Date() });
  res.json({ ok: true });
}));

// Preview/commit imports rather than silently treating every debit as a final expense.
function csvLine(line) {
  const out = []; let field = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && quoted && line[i + 1] === '"') { field += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}
app.post('/api/import/preview', wrap(async (req, res) => {
  const text = String(req.body || '');
  const lines = text.split(/\r?\n/).filter(x => x.trim());
  if (lines.length < 2) throw bad('CSV appears empty.');
  const headerIndex = lines.findIndex(l => /date/i.test(l) && /(debit|withdrawal|amount)/i.test(l));
  if (headerIndex < 0) throw bad('Could not identify the CSV columns. Export a CSV with date and debit/credit or amount columns.');
  const headers = csvLine(lines[headerIndex]).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const findCol = (patterns) => headers.findIndex(h => patterns.some(p => p.test(h)));
  const dateIdx = findCol([/^date$/, /transaction date/, /txn date/]);
  const descIdx = findCol([/description/, /narration/, /details/, /particulars/]);
  const debitIdx = findCol([/^debit$/, /withdrawal/, /debit amount/]);
  const creditIdx = findCol([/^credit$/, /deposit/, /credit amount/]);
  const amountIdx = findCol([/^amount$/, /transaction amount/]);
  const balanceIdx = findCol([/balance/]);
  if (dateIdx < 0 || (debitIdx < 0 && creditIdx < 0 && amountIdx < 0)) throw bad('CSV columns were not recognised. Please review the file format.');
  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const c = csvLine(line);
    const dateRaw = (c[dateIdx] || '').trim().replace(/^"|"$/g, '');
    const match = dateRaw.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (!match) continue;
    const date = `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
    const num = v => Math.round(Math.abs(Number(String(v || '').replace(/[₹,\s"]/g, '')) || 0) * 100);
    let type, amountPaise;
    if (debitIdx >= 0 || creditIdx >= 0) {
      const debit = num(c[debitIdx]), credit = num(c[creditIdx]);
      if (!debit && !credit) continue;
      type = credit ? 'income' : 'expense';
      amountPaise = credit || debit;
    } else {
      const raw = String(c[amountIdx] || '').replace(/[₹,\s"]/g, '');
      const n = Number(raw);
      if (!Number.isFinite(n) || n === 0) continue;
      type = n < 0 ? 'expense' : 'income';
      amountPaise = Math.round(Math.abs(n) * 100);
    }
    const description = clean(c[descIdx] || 'Imported transaction', 200);
    const importKey = crypto.createHash('sha256').update([date, type, amountPaise, description, c[balanceIdx] || ''].join('|')).digest('hex');
    rows.push({ date, type, amountPaise, amount: paiseToRupees(amountPaise), description, importKey, balance: balanceIdx >= 0 ? c[balanceIdx] : '' });
  }
  res.json({ rows: rows.slice(0, 2000), count: rows.length });
}));
app.post('/api/import/commit', wrap(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 2000) : [];
  const accountId = clean(req.body.accountId, 40);
  if (!rows.length) throw bad('No rows selected.');
  await accountById(accountId);
  let added = 0, skipped = 0;
  for (const row of rows) {
    if (!row.importKey || !/^[a-f0-9]{64}$/.test(row.importKey)) { skipped++; continue; }
    const exists = await tx.findOne({ importKey: row.importKey });
    if (exists) { skipped++; continue; }
    const imported = {
      importKey: row.importKey, importSource: 'csv', type: row.type === 'income' ? 'income' : 'expense',
      amountPaise: amountIn(row.amount), date: clean(row.date, 10), category: 'Needs review',
      note: clean(row.description, 200), accountId, needsReview: true, createdAt: new Date()
    };
    const importedResult = await tx.insertOne(imported);
    await syncToGoogleSheets('upsert', imported, importedResult.insertedId);
    added++;
  }
  res.json({ added, skipped, reviewRequired: added });
}));

app.post('/api/sheets/sync-all', wrap(async (req, res) => {
  if (!process.env.GOOGLE_SHEETS_WEB_APP_URL || !process.env.GOOGLE_SHEETS_SECRET) {
    throw bad('Configure GOOGLE_SHEETS_WEB_APP_URL and GOOGLE_SHEETS_SECRET in .env first.', 400);
  }
  const all = await tx.find().sort({ date: 1, createdAt: 1 }).toArray();
  for (const item of all) await syncToGoogleSheets('upsert', item, item._id);
  res.json({ ok: true, attempted: all.length, message: 'Sync attempted. Check the server terminal for any Google Sheets sync errors.' });
}));

app.get('/api/summary', wrap(async (req, res) => {
  const [st, all, balances] = await Promise.all([getMainSettings(), tx.find().toArray(), accountBalances()]);
  const t = today(), month = t.slice(0, 7);
  let todaySpent = 0, monthSpent = 0, monthIncome = 0, owedToFriends = 0, owedByFriends = 0;
  const byCat = {};
  for (const item of all) {
    if (item.date === t && ['expense', 'borrowed_expense'].includes(item.type)) todaySpent += item.amountPaise;
    if (item.date.startsWith(month)) {
      monthSpent += spendingEffect(item);
      if (item.type === 'income') monthIncome += item.amountPaise;
      if (['expense', 'borrowed_expense'].includes(item.type)) byCat[item.category] = (byCat[item.category] || 0) + item.amountPaise;
      if (item.type === 'refund') byCat[item.category] = (byCat[item.category] || 0) - item.amountPaise;
    }
    if (item.type === 'borrowed_expense' && !item.settled) owedToFriends += item.amountPaise;
    if (item.type === 'lent' && !item.settled) owedByFriends += item.amountPaise;
  }
  const cashPaise = balances.reduce((s, a) => s + a.balancePaise, 0);
  const days = dateDiff(t, st.payday) + 1 || 1;
  const reserve = Number(st.reservePaise || 0);
  const spendable = cashPaise - owedToFriends - reserve;
  res.json({
    settings: { ...st, reserve: paiseToRupees(reserve) },
    accounts: balances.map(a => ({ id: String(a._id), name: a.name, kind: a.kind, balance: paiseToRupees(a.balancePaise) })),
    totalBalance: paiseToRupees(cashPaise), spendable: paiseToRupees(spendable),
    owedToFriends: paiseToRupees(owedToFriends), owedByFriends: paiseToRupees(owedByFriends),
    days, perDay: paiseToRupees(Math.floor(spendable / days)),
    todaySpent: paiseToRupees(todaySpent), monthSpent: paiseToRupees(monthSpent),
    monthIncome: paiseToRupees(monthIncome),
    byCat: Object.fromEntries(Object.entries(byCat).map(([k,v]) => [k, paiseToRupees(v)]))
  });
}));

(async () => {
  await client.connect();
  db = client.db(process.env.DB_NAME || 'pocket_money_tracker');
  tx = db.collection('transactions');
  accounts = db.collection('accounts');
  settings = db.collection('settings');
  imports = db.collection('imports');
  budgets = db.collection('budgets');
  goals = db.collection('goals');
  recurring = db.collection('recurring');
  await tx.createIndex({ date: -1 });
  await tx.createIndex({ importKey: 1 }, { unique: true, sparse: true });
  await accounts.createIndex({ name: 1 }, { unique: true });
  await ensureDefaultAccount();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  app.listen(port, host, () => console.log(`Pocket Money Tracker running at http://localhost:${port}`));
})().catch(e => {
  console.error('Startup failed:', e.message);
  process.exit(1);
});
