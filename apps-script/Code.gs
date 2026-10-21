/**
 * Pocket Money Tracker -> Google Sheets sync.
 * Attach this script to the destination Google Sheet.
 * Set SHARED_SECRET to the same private value as GOOGLE_SHEETS_SECRET in .env.
 */
const SHARED_SECRET = 'REPLACE_WITH_A_LONG_RANDOM_SECRET';
const TZ = 'Asia/Kolkata';
const MASTER_SHEET = 'Transactions';
const DASHBOARD_SHEET = 'Dashboard';
const HEADERS = [
  'Date', 'Time', 'Type', 'Description', 'Category', 'Amount (₹)',
  'Income (₹)', 'Expense (₹)', 'Lent (₹)', 'Collection (₹)',
  'Repayment (₹)', 'Transfer (₹)', 'Account', 'Other Account',
  'Person', 'Notes', 'Status', 'Transaction ID', 'Created At'
];
const MASTER_HEADER_ROW = 1;
const MONTH_HEADER_ROW = 6;
const ID_COL = 18;

function setupPocketMoneySpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  const master = getOrCreateSheet_(ss, MASTER_SHEET);
  if (master.getRange(1, 1).getValue() !== HEADERS[0]) {
    master.clear();
    master.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  styleHeader_(master.getRange(1, 1, 1, HEADERS.length));
  master.setFrozenRows(1);
  master.getRange('A:A').setNumberFormat('yyyy-mm-dd');
  master.getRange('B:B').setNumberFormat('hh:mm:ss');
  master.getRange('F:L').setNumberFormat('₹#,##0.00;[Red]-₹#,##0.00');
  master.getRange('S:S').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  master.autoResizeColumns(1, HEADERS.length);

  const dashboard = getOrCreateSheet_(ss, DASHBOARD_SHEET);
  dashboard.clear();
  dashboard.getRange('A1:B1').merge().setValue('POCKET MONEY TRACKER — MONTHLY DASHBOARD');
  dashboard.getRange('A1').setFontSize(16).setFontWeight('bold');
  dashboard.getRange('A2').setValue('Selected month (YYYY-MM)');
  dashboard.getRange('B2').setFormula('=TEXT(TODAY(),"yyyy-mm")');
  dashboard.getRange('A4:B11').setValues([
    ['Total income', ''], ['Total expenses (net of refunds)', ''],
    ['Net income', ''], ['Money lent', ''], ['Money collected', ''],
    ['Repayments made', ''], ['Transfers', ''], ['Transactions recorded', '']
  ]);
  dashboard.getRange('B4').setFormula('=SUMIFS(Transactions!G:G,Transactions!A:A,">="&DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),Transactions!A:A,"<"&EDATE(DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),1))');
  dashboard.getRange('B5').setFormula('=SUMIFS(Transactions!H:H,Transactions!A:A,">="&DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),Transactions!A:A,"<"&EDATE(DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),1))');
  dashboard.getRange('B6').setFormula('=B4-B5');
  dashboard.getRange('B7').setFormula('=SUMIFS(Transactions!I:I,Transactions!A:A,">="&DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),Transactions!A:A,"<"&EDATE(DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),1))');
  dashboard.getRange('B8').setFormula('=SUMIFS(Transactions!J:J,Transactions!A:A,">="&DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),Transactions!A:A,"<"&EDATE(DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),1))');
  dashboard.getRange('B9').setFormula('=SUMIFS(Transactions!K:K,Transactions!A:A,">="&DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),Transactions!A:A,"<"&EDATE(DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),1))');
  dashboard.getRange('B10').setFormula('=SUMIFS(Transactions!L:L,Transactions!A:A,">="&DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),Transactions!A:A,"<"&EDATE(DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),1))');
  dashboard.getRange('B11').setFormula('=COUNTIFS(Transactions!A:A,">="&DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),Transactions!A:A,"<"&EDATE(DATE(VALUE(LEFT(B2,4)),VALUE(RIGHT(B2,2)),1),1))');
  dashboard.getRange('B4:B10').setNumberFormat('₹#,##0.00;[Red]-₹#,##0.00');
  dashboard.getRange('A4:A11').setFontWeight('bold');
  dashboard.setColumnWidth(1, 250);
  dashboard.setColumnWidth(2, 180);
  dashboard.getRange('A13:B13').merge().setValue('All records are stored in Transactions. Each calendar month also gets its own tab. Refunds reduce net expenses; transfers are excluded from income and expenses.');
  dashboard.getRange('A13').setWrap(true);
  dashboard.setRowHeight(13, 42);
  SpreadsheetApp.flush();
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!SHARED_SECRET || SHARED_SECRET.indexOf('REPLACE_') === 0 || payload.secret !== SHARED_SECRET) {
      return json_({ ok: false, error: 'Unauthorized' });
    }
    if (!payload.transactionId) return json_({ ok: false, error: 'Missing transactionId' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureBaseSheets_(ss);
    if (payload.action === 'delete') {
      deleteTransactionEverywhere_(ss, String(payload.transactionId));
      return json_({ ok: true, action: 'delete' });
    }
    if (payload.action !== 'upsert') return json_({ ok: false, error: 'Unsupported action' });
    const row = makeRow_(payload);
    const monthName = String(payload.date || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthName)) return json_({ ok: false, error: 'Invalid transaction date' });
    const master = ss.getSheetByName(MASTER_SHEET);
    // Remove this ID from any old month first (handles an edited transaction changing month).
    ss.getSheets().filter(sh => /^\d{4}-\d{2}$/.test(sh.getName())).forEach(sh => deleteFromSheet_(sh, String(payload.transactionId), MONTH_HEADER_ROW));
    upsertInSheet_(master, row, MASTER_HEADER_ROW);
    const monthly = getOrCreateMonthSheet_(ss, monthName);
    upsertInSheet_(monthly, row, MONTH_HEADER_ROW);
    return json_({ ok: true, action: 'upsert', month: monthName });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function ensureBaseSheets_(ss) {
  if (!ss.getSheetByName(MASTER_SHEET) || !ss.getSheetByName(DASHBOARD_SHEET)) setupPocketMoneySpreadsheet();
  const master = ss.getSheetByName(MASTER_SHEET);
  if (master.getLastRow() === 0) master.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
}
function getOrCreateSheet_(ss, name) { return ss.getSheetByName(name) || ss.insertSheet(name); }
function getOrCreateMonthSheet_(ss, name) {
  const sh = getOrCreateSheet_(ss, name);
  if (sh.getRange(MONTH_HEADER_ROW, 1).getValue() !== HEADERS[0]) {
    sh.clear();
    sh.getRange('A1:B1').merge().setValue('MONTHLY SUMMARY — ' + name);
    sh.getRange('A1').setFontSize(14).setFontWeight('bold');
    sh.getRange('A2:B5').setValues([
      ['Total income', ''], ['Total expenses (net of refunds)', ''], ['Net income', ''], ['Record count', '']
    ]);
    sh.getRange('B2').setFormula('=SUM(G7:G)');
    sh.getRange('B3').setFormula('=SUM(H7:H)');
    sh.getRange('B4').setFormula('=B2-B3');
    sh.getRange('B5').setFormula('=COUNTA(R7:R)');
    sh.getRange(MONTH_HEADER_ROW, 1, 1, HEADERS.length).setValues([HEADERS]);
    styleHeader_(sh.getRange(MONTH_HEADER_ROW, 1, 1, HEADERS.length));
    sh.setFrozenRows(MONTH_HEADER_ROW);
    sh.getRange('A:A').setNumberFormat('yyyy-mm-dd');
    sh.getRange('B:B').setNumberFormat('hh:mm:ss');
    sh.getRange('F:L').setNumberFormat('₹#,##0.00;[Red]-₹#,##0.00');
    sh.getRange('S:S').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sh.autoResizeColumns(1, HEADERS.length);
  }
  return sh;
}
function makeRow_(p) {
  const amount = Number(p.amount || 0);
  const type = String(p.type || 'other');
  const income = type === 'income' ? amount : 0;
  let expense = ['expense', 'borrowed_expense'].includes(type) ? amount : 0;
  if (type === 'refund') expense = -amount;
  const transactionDate = new Date(String(p.date) + 'T12:00:00+05:30');
  return [
    transactionDate, Utilities.formatDate(new Date(p.createdAt || new Date()), TZ, 'HH:mm:ss'), type,
    p.description || '', p.category || '', amount, income, expense,
    type === 'lent' ? amount : 0, type === 'collection' ? amount : 0,
    type === 'repayment' ? amount : 0, type === 'transfer' ? amount : 0,
    p.account || '', p.toAccount || '', p.person || '', p.notes || '', p.status || 'Recorded',
    String(p.transactionId), new Date(p.createdAt || new Date())
  ];
}
function upsertInSheet_(sheet, row, headerRow) {
  const id = String(row[ID_COL - 1]);
  const existing = findRowById_(sheet, id, headerRow);
  if (existing) sheet.getRange(existing, 1, 1, HEADERS.length).setValues([row]);
  else sheet.getRange(Math.max(sheet.getLastRow() + 1, headerRow + 1), 1, 1, HEADERS.length).setValues([row]);
}
function findRowById_(sheet, id, headerRow) {
  const last = sheet.getLastRow();
  if (last <= headerRow) return 0;
  const values = sheet.getRange(headerRow + 1, ID_COL, last - headerRow, 1).getDisplayValues();
  for (let i = 0; i < values.length; i++) if (String(values[i][0]) === id) return headerRow + 1 + i;
  return 0;
}
function deleteFromSheet_(sheet, id, headerRow) {
  const row = findRowById_(sheet, id, headerRow);
  if (row) sheet.deleteRow(row);
}
function deleteTransactionEverywhere_(ss, id) {
  const master = ss.getSheetByName(MASTER_SHEET);
  if (master) deleteFromSheet_(master, id, MASTER_HEADER_ROW);
  ss.getSheets().filter(sh => /^\d{4}-\d{2}$/.test(sh.getName())).forEach(sh => deleteFromSheet_(sh, id, MONTH_HEADER_ROW));
}
function styleHeader_(range) {
  range.setFontWeight('bold').setWrap(true);
  range.setBackground('#202938').setFontColor('#ffffff');
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
