const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function attendance(data = {}, options = {}) {
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [options.now || '2026-10-25T10:00:00Z'])); } }
  let writtenReport;
  const reportRange = { clearContent() { return this; }, setValues(rows) { writtenReport = rows; return this; }, setNumberFormat() { return this; } };
  const report = { getLastRow: () => 1, getRange: () => reportRange };
  const context = { Date: FixedDate, console,
    SpreadsheetApp: { flush() {} }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate(date, timeZone, pattern) {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
      const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
      return pattern.replace(/yyyy|MM|dd|HH|mm|ss/g, token => ({ yyyy: p.year, MM: p.month, dd: p.day, HH: p.hour, mm: p.minute, ss: p.second })[token]);
    } }
  };
  vm.createContext(context);
  for (const file of ['firebase-config.gs', 'code.gs', 'setup.gs', 'transactions.gs','transaction-edits.gs', 'guest-crypto.gs','guest-auth.gs','auth.gs']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  context.KCH_REQUEST_USER_ = { role: options.role || 'ADMIN', salesId: 'S1', username: 'owner@example.test', email: 'owner@example.test' };
  context.getKchSpreadsheet_ = () => ({ getSheetByName: () => null });
  context.getSheetData_ = name => ({ headers: [], rows: context.filterAuthorizedRows_(name, data[name] || []) });
  context.setupMonthlyTeamReportSheet_ = () => report;
  return { context, report: () => writtenReport };
}
const sales = [
  { sales_id: 'S1', full_name: 'One', team_name: 'Canvasser', target_monthly: 80000000, status: 'ACTIVE' },
  { sales_id: 'S2', full_name: 'Two', team_name: 'Motoris', target_monthly: 27000000, status: 'ACTIVE' }
];
const present = (date, extra = {}) => ({ sales_id: 'S1', date, status: 'Hadir Tepat Waktu', ...extra });

test('HK counts unique presence dates per sales, including assisted attendance', () => {
  const e = attendance({ ATTENDANCE: [present('2026-10-01'), present('01/10/2026 08:05:00'),
    present('2026-10-02', { created_by: 'admin@example.test' }), present('2026-10-01', { sales_id: 'S2' })] });
  const days = e.context.getAttendanceWorkDatesBySales_('2026-10');
  assert.deepEqual(Object.keys(days.S1).sort(), ['2026-10-01', '2026-10-02']); assert.equal(Object.keys(days.S2).length, 1);
});
test('only presence statuses count; permission, sickness, absence and inactive records do not', () => {
  const statuses = ['Hadir Tepat Waktu', 'Hadir Terlambat', 'HADIR', 'TERLAMBAT', 'PRESENT', '', 'ACTIVE',
    'IZIN', 'SAKIT', 'ALPA', 'TIDAK HADIR', 'CUTI', 'INACTIVE', 'ARCHIVED', 'CANCELLED', 'UNKNOWN'];
  const e = attendance({ ATTENDANCE: statuses.map((status, i) => present('2026-10-' + String(i + 1).padStart(2, '0'), { status })) });
  assert.equal(Object.keys(e.context.getAttendanceWorkDatesBySales_('2026-10').S1).length, 7);
});
test('out-of-month, future, malformed and impossible dates do not add HK', () => {
  const e = attendance({ ATTENDANCE: [present('2026-09-30'), present('2026-11-01'), present('2026-10-26'), present('2026-10-32'),
    present('2026-10-00'), present('not a date'), present('2026-10-20', { sales_id: '' }), present('2026-10-25')] });
  assert.deepEqual(Object.keys(e.context.getAttendanceWorkDatesBySales_('2026-10').S1), ['2026-10-25']);
  const feb = attendance({ ATTENDANCE: [present('2026-02-29'), present('2026-02-28'), present('2024-02-29')] });
  assert.equal(Object.keys(feb.context.getAttendanceWorkDatesBySales_('2026-02').S1).length, 1);
  assert.equal(Object.keys(feb.context.getAttendanceWorkDatesBySales_('2024-02').S1).length, 1);
});
test('Date cells, local date strings, legacy date headers and normalized sales IDs deduplicate', () => {
  const e = attendance({ ATTENDANCE: [present(new Date('2026-10-24T18:30:00Z')), present('25/10/2026'),
    { sales_id: ' s1 ', attendance_date: '25-10-2026', status: 'hadir-tepat-waktu' }] });
  assert.deepEqual(Object.keys(e.context.getAttendanceWorkDatesBySales_('2026-10').S1), ['2026-10-25']);
});
test('actual Sunday attendance counts, independently from the calendar workday setting', () => {
  const e = attendance({ ATTENDANCE: [present('2026-10-25')] });
  assert.equal(Object.keys(e.context.getAttendanceWorkDatesBySales_('2026-10').S1).length, 1);
});
test('profile metadata includes zero for no attendance and refreshes after a new check-in', () => {
  const data = { SALES: sales, ATTENDANCE: [] }; const e = attendance(data);
  let result = e.context.getInitialAppMetadata_();
  assert.equal(result.success, true); assert.equal(result.sales[0].attendance_hk, 0); assert.equal(result.sales[0].attendance_month, '2026-10');
  data.ATTENDANCE.push(present('2026-10-25'));
  result = e.context.getInitialAppMetadata_(); assert.equal(result.sales[0].attendance_hk, 1); assert.equal(result.sales[1].attendance_hk, 0);
  assert.equal(result.attendanceSales[0].attendance_hk, 1);
});
test('profile month uses Jakarta time when UTC is still in the previous month', () => {
  const e = attendance({ SALES: sales, ATTENDANCE: [present('2026-10-31'), present('2026-11-01')] }, { now: '2026-10-31T18:30:00Z' });
  const result = e.context.getInitialAppMetadata_();
  assert.equal(result.success, true); assert.equal(result.sales[0].attendance_month, '2026-11'); assert.equal(result.sales[0].attendance_hk, 1);
});
test('sales-scoped metadata and HK do not disclose other sales attendance', () => {
  const e = attendance({ SALES: sales, ATTENDANCE: [present('2026-10-01'), present('2026-10-02', { sales_id: 'S2' })] }, { role: 'SALES' });
  const result = e.context.getInitialAppMetadata_();
  assert.equal(result.success, true); assert.equal(result.sales.length, 1); assert.equal(result.sales[0].sales_id, 'S1');
  assert.equal(result.sales[0].attendance_hk, 1); assert.equal(e.context.getAttendanceWorkDatesBySales_('2026-10').S2, undefined);
});
test('monthly report counts attendance only while preserving transaction totals', () => {
  const e = attendance({ SALES: sales, ATTENDANCE: [present('2026-10-04'), present('2026-10-04'), present('2026-10-06'), present('2026-10-07', { status: 'SAKIT' })],
    SALES_TRANSACTIONS: [{ sales_id: 'S1', transaction_date: '2026-10-01', product_id: 'P1', quantity: 1, cost_price: 10, selling_price: 20 }] });
  const result = e.context.getMonthlyTeamReport_('2026-10', 'S1');
  assert.equal(result.success, true); assert.equal(result.summary.totalHK, 2); assert.equal(result.summary.totalSales, 20); assert.equal(result.summary.totalShj, 10);
  assert.equal(e.report()[0][7], 2);
});
test('sales transactions alone do not count as HK', () => {
  const e = attendance({ SALES: sales, SALES_TRANSACTIONS: [{ sales_id: 'S1', transaction_date: '2026-10-01', product_id: 'P1', quantity: 1, selling_price: 20 }] });
  const result = e.context.getMonthlyTeamReport_('2026-10', 'S1');
  assert.equal(result.success, true); assert.equal(result.summary.totalHK, 0); assert.equal(result.summary.totalSales, 20);
});
test('profile cards display the HK month and distinguish unloaded data from zero days', () => {
  const container = { innerHTML: '' }; const context = { document: { addEventListener() {}, getElementById: id => id === 'salesProfilesGridContainer' ? container : null } };
  vm.createContext(context);
  const html = fs.readFileSync(path.join(__dirname, '../js.html'), 'utf8'); vm.runInContext(html.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, ''), context);
  context.appState.sales = [{ ...sales[0], attendance_hk: 8, attendance_month: '2026-10' }]; context.renderSalesProfiles();
  assert.match(container.innerHTML, /8 HK · Okt 2026/);
  context.appState.sales[0].attendance_hk = 0; context.renderSalesProfiles(); assert.match(container.innerHTML, /0 HK · Okt 2026/);
  delete context.appState.sales[0].attendance_hk; context.renderSalesProfiles(); assert.match(container.innerHTML, /HK belum dimuat/);
});
