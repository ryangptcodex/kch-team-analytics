const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function maintenance(options = {}) {
  const events = [];
  const callbacks = [];
  const backup = { getId: () => 'backup-id', getUrl: () => 'https://docs.google.com/spreadsheets/d/backup-id/edit', getName: () => 'KCH BACKUP' };
  const sheet = { getId: () => options.activeId || 'test-sheet', getName: () => 'KCH UJI COBA',
    copy(name) { events.push('backup'); assert.match(name, /BACKUP/); if (options.copyFailure) throw new Error('Drive unavailable'); return backup; },
    toast() { events.push('toast'); } };
  const menu = { addItem(label, callback) { callbacks.push(callback); return menu; }, addToUi() {} };
  const context = { Session: { getActiveUser: () => ({ getEmail: () => options.email ?? 'admin@gmail.com' }) },
    KCH_BOOTSTRAP_ADMIN_EMAIL_: 'admin@gmail.com', KCH_TEST_SPREADSHEET_ID_: 'test-sheet',
    SpreadsheetApp: { getUi() { if (options.webContext) throw new Error('UI unavailable'); return { createMenu: () => menu }; },
      getActiveSpreadsheet: () => options.noActive ? null : sheet, flush() { events.push('flush'); } },
    LockService: { getScriptLock: () => ({ waitLock() { events.push('lock'); }, releaseLock() { events.push('unlock'); } }) },
    Utilities: { formatDate: () => '2026-10-25 14.00.00' }, console: { log(message) { events.push('log-backup'); assert.match(message, /backup-id/); } } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../setup.gs'), 'utf8'), context);
  context.repairAndOptimizeSpreadsheet_ = () => { events.push('migration'); if (options.migrationFailure) throw new Error('Header mismatch'); return { status: 'success' }; };
  return { context, events, callbacks };
}

test('existing sheet callback takes a backup before running legacy migration', () => {
  const e = maintenance(); const result = e.context.repairAndOptimizeSpreadsheet();
  assert.equal(result.status, 'success'); assert.match(result.backupUrl, /backup-id/);
  assert.ok(e.events.indexOf('backup') < e.events.indexOf('migration'));
  assert.ok(e.events.indexOf('log-backup') < e.events.indexOf('migration'));
  assert.equal(e.events.at(-1), 'unlock');
});
test('maintenance rejects anonymous users, sales and web app contexts before backup or mutation', () => {
  for (const options of [{ email: '' }, { email: 'sales@gmail.com' }, { webContext: true }]) {
    const e = maintenance(options); assert.throws(() => e.context.repairAndOptimizeSpreadsheet(), /ACCESS_DENIED/);
    assert.equal(e.events.includes('backup'), false); assert.equal(e.events.includes('migration'), false);
  }
});
test('maintenance rejects missing or different active spreadsheet to protect the original', () => {
  for (const options of [{ noActive: true }, { activeId: 'original-october-sheet' }]) {
    const e = maintenance(options); assert.throws(() => e.context.repairAndOptimizeSpreadsheet(), /UJI COBA/);
    assert.equal(e.events.includes('backup'), false); assert.equal(e.events.includes('migration'), false);
  }
});
test('backup failure prevents migration and releases its lock', () => {
  const e = maintenance({ copyFailure: true }); assert.throws(() => e.context.repairAndOptimizeSpreadsheet(), /Cadangan gagal/);
  assert.equal(e.events.includes('migration'), false); assert.equal(e.events.at(-1), 'unlock');
});
test('migration failure reports the recovery copy and releases its lock', () => {
  const e = maintenance({ migrationFailure: true }); assert.throws(() => e.context.repairAndOptimizeSpreadsheet(), /Header mismatch.*backup-id/);
  assert.equal(e.events.at(-1), 'unlock');
});
test('rebuilt spreadsheet menu calls the stable maintenance entry point', () => {
  const e = maintenance(); e.context.onOpen();
  assert.ok(e.callbacks.includes('repairAndOptimizeSpreadsheet'));
  assert.equal(e.callbacks.includes('repairAndOptimizeSpreadsheet_'), false);
});
