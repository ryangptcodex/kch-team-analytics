// Additive spreadsheet migrations. Never call the legacy repair/reset helpers here.
var KCH_UPDATE_SHEET_ = 'PEMBARUAN_SHEET';
var KCH_UPDATE_HANDLER_ = 'kchSheetUpdateClick_';

function kchSheetUpdateAdmin_(ss, email) {
  if (String(email || '').trim().toLowerCase() !== KCH_BOOTSTRAP_ADMIN_EMAIL_) throw new Error('ACCESS_DENIED: Hanya Gmail admin yang boleh memperbarui sheet.');
  if (!ss || ss.getId() !== KCH_TEST_SPREADSHEET_ID_) throw new Error('ACCESS_DENIED: Gunakan spreadsheet UJI COBA yang dikonfigurasi.');
}

// Visible editor entry point; the installer retains native admin/spreadsheet checks.
function setupKchSheetUpdates() {
  return installKchSheetUpdates_();
}

// Run once from the Sheet menu (or Apps Script editor), as the admin.
function installKchSheetUpdates_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  kchSheetUpdateAdmin_(ss, Session.getActiveUser().getEmail());
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sheet = ss.getSheetByName(KCH_UPDATE_SHEET_);
    if (sheet && sheet.getRange('A1').getValue() !== 'PUSAT PEMBARUAN SHEET') throw new Error('Nama PEMBARUAN_SHEET sudah dipakai sheet lain; tidak ditimpa.');
    if (!sheet) {
      sheet = ss.insertSheet(KCH_UPDATE_SHEET_);
      sheet.getRange('A1:D1').merge().setValue('PUSAT PEMBARUAN SHEET').setBackground('#0c1e33').setFontColor('#ffffff').setFontSize(16).setFontWeight('bold');
      sheet.getRange('A3').insertCheckboxes().setValue(false);
      sheet.getRange('B3:D3').merge().setValue('PERBARUI SELURUH SHEET').setBackground('#2563eb').setFontColor('#ffffff').setFontWeight('bold');
      sheet.getRange('A5:D5').merge().setValue('Klik checkbox di A3 sekali untuk memperbarui struktur sesuai kode terbaru.').setWrap(true);
      sheet.getRange('A6:D6').merge().setValue('Data lama dipertahankan. Kode Apps Script harus dipasang lebih dahulu.').setWrap(true);
      sheet.getRange('A8:A11').setValues([['Status'], ['Terakhir diperiksa'], ['Cadangan'], ['Rincian']]);
      sheet.getRange('B8:D8').merge().setValue('Siap');
      sheet.getRange('B9:D9').merge(); sheet.getRange('B10:D10').merge(); sheet.getRange('B11:D11').merge().setWrap(true);
      sheet.setColumnWidth(1, 155); sheet.setColumnWidths(2, 3, 210); sheet.setRowHeight(3, 42); sheet.setRowHeight(11, 90); sheet.setFrozenRows(1);
    }
    var triggers = ScriptApp.getProjectTriggers().filter(function(t) { return t.getHandlerFunction() === KCH_UPDATE_HANDLER_ && t.getTriggerSourceId() === ss.getId(); });
    if (!triggers.length) ScriptApp.newTrigger(KCH_UPDATE_HANDLER_).forSpreadsheet(ss).onEdit().create();
    triggers.slice(1).forEach(function(t) { ScriptApp.deleteTrigger(t); });
    ss.setActiveSheet(sheet); ss.moveActiveSheet(ss.getNumSheets());
    ss.toast('Tab pembaruan siap. Klik checkbox A3 untuk memperbarui struktur.', 'KCH UJI COBA', 8);
  } finally { lock.releaseLock(); }
}

function kchSheetSchemas_() {
  var schemas = {};
  Object.keys(TABLE_SCHEMAS).forEach(function(name) { schemas[name] = TABLE_SCHEMAS[name].slice(); });
  schemas.MONTHLY_TEAM_REPORT = MONTHLY_TEAM_REPORT_HEADERS.slice();
  schemas.TODAY_PLAN = TODAY_PLAN_HEADERS.slice();
  schemas.WEEKLY_MEETINGS = WEEKLY_MEETING_HEADERS.slice();
  schemas.ACCESS_USERS = KCH_ACCESS_HEADERS_.concat(['display_name'], KCH_GUEST_ACCESS_HEADERS_);
  schemas[KCH_SCORE_EVENTS_] = KCH_SCORE_HEADERS_.slice();
  schemas[KCH_TX_REQUEST_SHEET_] = KCH_TX_REQUEST_HEADERS_.slice();
  schemas[KCH_TX_EDIT_SHEET_] = KCH_TX_EDIT_HEADERS_.slice();
  return schemas;
}

// Preflight all sheets before any write. Only missing canonical columns are inserted;
// existing cells/formulas/formats shift intact. Unknown trailing columns stay intact.
function kchSheetUpdatePlan_(ss, meta, schemas) {
  var requests = [], changes = [];
  Object.keys(schemas).forEach(function(name) {
    var expected = schemas[name], sheet = ss.getSheetByName(name), properties;
    if (!sheet) {
      properties = txAddSheet_(meta, requests, name, expected, name.indexOf('_KCH_') === 0);
      changes.push(name + ': sheet baru');
    } else {
      properties = meta[name];
      if (!properties || properties.sheetId !== sheet.getSheetId()) throw new Error(name + ': metadata berubah; ulangi pembaruan.');
      var width = sheet.getLastColumn(), headers = width ? sheet.getRange(1, 1, 1, width).getDisplayValues()[0] : [];
      if (!width && sheet.getLastRow()) throw new Error(name + ': header kosong tetapi data tersedia. Periksa admin.');
      var seen = Object.create(null), canonical = [];
      headers.forEach(function(h) {
        if (!h || h !== h.trim()) throw new Error(name + ': header kosong/spasi tidak aman; periksa admin.');
        var key = h.toLowerCase();
        if (seen[key]) throw new Error(name + ': header ganda ' + h + '; periksa admin.');
        seen[key] = true;
        if (expected.indexOf(h) >= 0) canonical.push(h);
        else if (expected.some(function(e) { return e.toLowerCase() === key; })) throw new Error(name + ': ejaan header berbeda ' + h + '; periksa admin.');
      });
      // Reject old/ambiguous layouts instead of guessing aliases or moving financial data.
      var order = canonical.map(function(h) { return expected.indexOf(h); });
      if (order.some(function(n, i) { return i && n <= order[i - 1]; }) || canonical.some(function(h, i) { return headers[i] !== h; })) throw new Error(name + ': urutan/header lama tidak kompatibel. Tidak ada data yang diubah.');
      if (!canonical.length && headers.length) throw new Error(name + ': tidak ada header yang dikenali.');
      var current = headers.slice();
      expected.forEach(function(h, index) {
        if (current[index] === h) return;
        requests.push({ insertDimension: { range: { sheetId: properties.sheetId, dimension: 'COLUMNS', startIndex: index, endIndex: index + 1 }, inheritFromBefore: index > 0 } });
        requests.push(txUpdate_(properties.sheetId, 0, index, [[h]]));
        current.splice(index, 0, h); changes.push(name + ': tambah ' + h);
      });
    }
    // Header appearance only: never rewrite row data, number formats or validation.
    requests.push({ repeatCell: { range: { sheetId: properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: expected.length },
      cell: { userEnteredFormat: { backgroundColor: { red: 0.047, green: 0.118, blue: 0.2 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } }, fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat' } });
  });
  return { requests: requests, changes: changes };
}

function kchSheetUpdateClick_(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== KCH_UPDATE_SHEET_ || e.range.getA1Notation() !== 'A3' || e.value !== 'TRUE') return;
  // Installable triggers execute as their owner: explicitly check the actual editor.
  kchSheetUpdateAdmin_(e.source, e.user && e.user.getEmail());
  return kchRunSheetUpdates_(e.source);
}

function kchRunSheetUpdates_(ss) {
  kchSheetUpdateAdmin_(ss, Session.getActiveUser().getEmail());
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  var control = ss.getSheetByName(KCH_UPDATE_SHEET_), backupUrl = '';
  try {
    if (!control || control.getRange('A1').getValue() !== 'PUSAT PEMBARUAN SHEET') throw new Error('Pasang tab pembaruan melalui menu terlebih dahulu.');
    control.getRange('B8').setValue('Sedang memperbarui…');
    if (typeof assertNoPendingTransactions_ === 'function') assertNoPendingTransactions_();
    SpreadsheetApp.flush();
    var ctx = { id: ss.getId(), token: ScriptApp.getOAuthToken() };
    var plan = kchSheetUpdatePlan_(ss, txMetadata_(ctx), kchSheetSchemas_());
    var stamp = Utilities.formatDate(new Date(), KCH_CONFIG.TIMEZONE, 'yyyy-MM-dd HH.mm.ss');
    var backup = ss.copy(ss.getName() + ' - BACKUP PEMBARUAN ' + stamp);
    if (!backup || backup.getId() === ss.getId()) throw new Error('Cadangan gagal dibuat; pembaruan dibatalkan.');
    backupUrl = backup.getUrl();
    control.getRange('B10').setValue(backupUrl); SpreadsheetApp.flush();
    // All structural changes are one atomic Sheets API batch.
    txBatch_(ctx, plan.requests);
    control.getRange('B8').setValue('Berhasil');
    control.getRange('B9').setValue(stamp);
    control.getRange('B11').setValue(plan.changes.join('\n') || 'Struktur sudah sesuai kode terbaru. Tidak ada sheet/kolom ganda.');
    ss.toast('Seluruh struktur sheet sudah mengikuti kode terbaru.', 'Pembaruan selesai', 8);
    return { success: true, changes: plan.changes, backupUrl: backupUrl };
  } catch (err) {
    if (!control || control.getRange('A1').getValue() !== 'PUSAT PEMBARUAN SHEET') throw err;
    control.getRange('B8').setValue('Gagal / perlu diperiksa');
    control.getRange('B11').setValue(String(err.message) + (backupUrl ? '\nCadangan: ' + backupUrl + '\nJika koneksi terputus, periksa hasil lalu klik ulang; pembaruan tidak menggandakan kolom.' : ''));
    throw err;
  } finally {
    try { if (control && control.getRange('A1').getValue() === 'PUSAT PEMBARUAN SHEET') control.getRange('A3').setValue(false); } finally { lock.releaseLock(); }
  }
}
