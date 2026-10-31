// Additive migrations by default; launch-test cleanup requires explicit one-time arming.
// Never call the legacy repair/reset helpers here.
var KCH_UPDATE_SHEET_ = 'PEMBARUAN_SHEET';
var KCH_UPDATE_HANDLER_ = 'kchSheetUpdateClick_';
var KCH_LAUNCH_SHEET_ = '_KCH_LAUNCH_STATE';
var KCH_LAUNCH_KEY_ = 'LAUNCH_2026_11';
var KCH_LAUNCH_HEADERS_ = ['launch_key', 'status', 'backup_url', 'completed_at'];

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
    sheet.getRange('A6').setValue('Data sumber dipertahankan; hasil laporan dihitung ulang. Pasang kode terbaru dahulu.');
    var triggers = ScriptApp.getProjectTriggers().filter(function(t) { return t.getHandlerFunction() === KCH_UPDATE_HANDLER_ && t.getTriggerSourceId() === ss.getId(); });
    if (!triggers.length) ScriptApp.newTrigger(KCH_UPDATE_HANDLER_).forSpreadsheet(ss).onEdit().create();
    triggers.slice(1).forEach(function(t) { ScriptApp.deleteTrigger(t); });
    ss.setActiveSheet(sheet); ss.moveActiveSheet(ss.getNumSheets());
    ss.toast('Tab pembaruan siap. Klik checkbox A3 untuk memperbarui struktur.', 'KCH UJI COBA', 8);
  } finally { lock.releaseLock(); }
}

// Register every feature that owns a Sheet schema and/or a refresh calculation here.
// A missing installed module fails explicitly, rather than claiming a full update.
function kchSheetUpdateModules_() {
  if (typeof KCH_INCENTIVE_SHEET_SCHEMAS_ === 'undefined' || typeof kchIncentiveSyncPlan_ !== 'function' || typeof incentiveBuildReport_ !== 'function' || typeof incentiveJunior_ !== 'function') throw new Error('Pasang Script incentive-sheets.gs, incentives.gs dan canvasser-incentives.gs terbaru sebelum Perbarui.');
  if (typeof stockSchemas_ !== 'function') throw new Error('Pasang stock-pickups.gs terbaru sebelum Perbarui.');
  var stockSchemas = stockSchemas_();
  if (!stockSchemas.SALES_CASH_DEPOSITS || !stockSchemas.SALES_TRANSACTIONS || stockSchemas.SALES_TRANSACTIONS.indexOf('stock_distributor_id') < 0) throw new Error('Pasang stock-pickups.gs terbaru yang mencakup setoran dan asal stok sebelum Perbarui.');
  return [{name:'PENGAMBILAN',schemas:stockSchemas,buildPlan:function(){return {requests:[],changes:[]};}}, {name:'INSENTIF',schemas:KCH_INCENTIVE_SHEET_SCHEMAS_,buildPlan:kchIncentiveSyncPlan_}];
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
  schemas[KCH_LAUNCH_SHEET_] = KCH_LAUNCH_HEADERS_.slice();
  kchSheetUpdateModules_().forEach(function(module) { Object.keys(module.schemas).forEach(function(name) { schemas[name] = module.schemas[name].slice(); }); });
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
        if (properties.gridProperties) properties.gridProperties.columnCount++;
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

// Remove obsolete login rows only, never the SALES business master or its history.
function kchLegacyLoginCleanupPlan_(ss, meta) {
  var requests = [], changes = [];
  ['ACCESS_USERS', 'USERS'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return;
    var width = sheet.getLastColumn(), values = sheet.getRange(1, 1, sheet.getLastRow(), width).getDisplayValues();
    var headers = values[0], roleColumn = headers.indexOf('role'), emailColumn = headers.indexOf('email');
    if (roleColumn < 0 || (name === 'ACCESS_USERS' && emailColumn < 0)) throw new Error(name + ': header akun lama tidak dikenali; pembersihan dibatalkan.');
    var remove = [];
    values.slice(1).forEach(function(row, index) {
      if (row.every(function(v) { return v === ''; })) return;
      var keep = name === 'ACCESS_USERS'
        ? [KCH_BOOTSTRAP_ADMIN_EMAIL_, KCH_GUEST_EMAIL_].indexOf(String(row[emailColumn]).trim().toLowerCase()) >= 0
        : ['ADMIN', 'GUEST'].indexOf(String(row[roleColumn]).trim().toUpperCase()) >= 0;
      if (!keep) remove.push(index + 1);
    });
    remove.reverse().forEach(function(index) {
      requests.push({ deleteDimension: { range: { sheetId: meta[name].sheetId, dimension: 'ROWS', startIndex: index, endIndex: index + 1 } } });
    });
    if (remove.length) changes.push(name + ': hapus ' + remove.length + ' akun login lama; profil/transaksi sales tetap.');
  });
  return { requests: requests, changes: changes };
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
    var meta = txMetadata_(ctx);
    var launching = kchLaunchArmed_(control) && !kchLaunchCompleted_(ss);
    var cleanup = kchLegacyLoginCleanupPlan_(ss, meta);
    var schemas = kchSheetSchemas_();
    // A first-time launch creates the request journal in its reservation batch.
    // The remaining schema and cleared data commit in the final batch.
    if (launching && !meta[KCH_TX_REQUEST_SHEET_]) delete schemas[KCH_TX_REQUEST_SHEET_];
    var plan = kchSheetUpdatePlan_(ss, meta, schemas);
    plan.requests = plan.requests.concat(cleanup.requests);
    plan.changes = plan.changes.concat(cleanup.changes);
    if (launching) {
      var cleared = kchLaunchClearPlan_(ss, meta);
      plan.requests = plan.requests.concat(cleared.requests);
      plan.changes = plan.changes.concat(cleared.changes);
    } else kchSheetUpdateModules_().forEach(function(module) {
      var generated = module.buildPlan(ss, meta, ctx);
      plan.requests = plan.requests.concat(generated.requests);
      plan.changes = plan.changes.concat(generated.changes);
    });
    if (meta[KCH_UPDATE_SHEET_]) plan.requests.push({updateSheetProperties:{properties:{sheetId:meta[KCH_UPDATE_SHEET_].sheetId,index:Object.keys(meta).length-1},fields:'index'}});
    var stamp = Utilities.formatDate(new Date(), KCH_CONFIG.TIMEZONE, 'yyyy-MM-dd HH.mm.ss');
    var backup = ss.copy(ss.getName() + ' - BACKUP PEMBARUAN ' + stamp);
    if (!backup || backup.getId() === ss.getId()) throw new Error('Cadangan gagal dibuat; pembaruan dibatalkan.');
    backupUrl = backup.getUrl();
    control.getRange('B10').setValue(backupUrl); SpreadsheetApp.flush();
    // Schema, legacy-account cleanup and generated reports commit atomically together.
    if (launching) {
      var reservation = kchLaunchReserve_(ss, ctx, meta, stamp, backupUrl);
      plan.requests.push(txAppend_(meta[KCH_LAUNCH_SHEET_].sheetId, [[KCH_LAUNCH_KEY_, 'COMPLETED', backupUrl, stamp]]));
      plan.requests.push({updateCells:{start:{sheetId:control.getSheetId(),rowIndex:14,columnIndex:0},rows:[{values:[{userEnteredValue:{boolValue:false}}]}],fields:'userEnteredValue'}});
      plan.requests.push(txUpdate_(control.getSheetId(), 16, 0, [['Selesai. Data uji dibersihkan sekali; klik Perbarui berikutnya mempertahankan data baru.']]));
      plan.requests.push(txUpdate_(control.getSheetId(), 17, 0, [[backupUrl]]));
      reservation.state = 'COMMITTED';
      reservation.result_json = JSON.stringify({success:true,transactionId:reservation.transaction_id,message:'Persiapan launch November selesai.'});
      plan.requests.push(txUpdate_(meta[KCH_TX_REQUEST_SHEET_].sheetId, reservation._row, 0, [txReceiptValues_(reservation)]));
      try { txBatch_(ctx, plan.requests); }
      catch (writeError) {
        // Never repeat a reset after an ambiguous write. A matching terminal
        // receipt proves the clear and permanent marker committed together.
        var saved = txCommitted_(txReceipts_(ctx, meta), reservation.request_key);
        if (!saved) {
          if ([400,403,404].indexOf(writeError.httpStatus) >= 0) txMarkFailed_(ctx,meta,reservation,'LAUNCH_REJECTED',writeError.message);
          throw writeError;
        }
      }
    } else txBatch_(ctx, plan.requests);
    control.getRange('B8').setValue('Berhasil');
    control.getRange('B9').setValue(stamp);
    control.getRange('B11').setValue(plan.changes.join('\n') || 'Struktur sudah sesuai kode terbaru. Tidak ada sheet/kolom ganda.');
    ss.toast(launching ? 'Semua sheet siap. Data uji dibersihkan sekali; saldo stok dan master tetap.' : 'Struktur dan laporan sheet sudah mengikuti kode terbaru.', 'Pembaruan selesai', 8);
    return { success: true, changes: plan.changes, backupUrl: backupUrl };
  } catch (err) {
    if (!control || control.getRange('A1').getValue() !== 'PUSAT PEMBARUAN SHEET') throw err;
    control.getRange('B8').setValue('Gagal / perlu diperiksa');
    control.getRange('B11').setValue(String(err.message) + (backupUrl ? '\nCadangan: ' + backupUrl + (launching ? '\nJika hasil persiapan launch belum pasti, hentikan input dan periksa kiriman tertunda; jangan menghapus jurnal. Klik ulang akan ditahan sampai hasil pasti.' : '\nJika koneksi terputus, periksa hasil lalu klik ulang; pembaruan tidak menggandakan kolom.') : ''));
    throw err;
  } finally {
    try { if (control && control.getRange('A1').getValue() === 'PUSAT PEMBARUAN SHEET') control.getRange('A3').setValue(false); } finally { lock.releaseLock(); }
  }
}

// Deliberately armed once by the admin; installing new code alone never clears data.
// This is launch-test cleanup, not a monthly reset or an archive-aware report policy.
function siapkanAwalNovember() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  kchSheetUpdateAdmin_(ss, Session.getActiveUser().getEmail());
  installKchSheetUpdates_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    assertNoPendingTransactions_();
    var control = ss.getSheetByName(KCH_UPDATE_SHEET_);
    if (kchLaunchCompleted_(ss)) {
      ss.toast('Persiapan launch sudah selesai. Data baru tidak akan dikosongkan lagi.', 'KCH UJI COBA', 8);
      return;
    }
    var heading = control.getRange('A14').getValue();
    if (heading !== 'PERSIAPAN LAUNCH NOVEMBER 2026' && control.getRange('A14:D18').getDisplayValues().some(function(row) { return row.some(function(v) { return v !== ''; }); })) throw new Error('A14:D18 sudah berisi data lain; pindahkan dahulu.');
    control.getRange('A14:D14').merge().setValue('PERSIAPAN LAUNCH NOVEMBER 2026').setFontWeight('bold');
    control.getRange('A15').insertCheckboxes().setValue(true);
    control.getRange('B15:D15').merge().setValue('Bersihkan data uji sekali saat Perbarui Seluruh Sheet');
    control.getRange('A16:D16').merge().setValue('Aktivitas uji dikosongkan. Master, login, libur, berita, dokumen dan saldo stok tetap. Cadangan lengkap dibuat dahulu.').setWrap(true);
    control.getRange('A17:D17').merge().setValue('Siap. Tutup tab webapp lain, lalu klik A3. Ini bukan reset rutin bulanan.').setWrap(true);
    control.getRange('A18:D18').merge();
    ss.setActiveSheet(control);
    ss.toast('Persiapan siap. Klik A3 untuk memperbarui semua sheet dan membersihkan data uji sekali.', 'KCH UJI COBA', 10);
  } finally { lock.releaseLock(); }
}

function kchLaunchArmed_(control) {
  var checked = control.getRange('A15').getValue();
  return control.getRange('A14').getValue() === 'PERSIAPAN LAUNCH NOVEMBER 2026' && (checked === true || checked === 'TRUE');
}

function kchLaunchCompleted_(ss) {
  var sheet = ss.getSheetByName(KCH_LAUNCH_SHEET_);
  if (!sheet || sheet.getLastRow() < 2) return false;
  var values = sheet.getRange(1,1,sheet.getLastRow(),sheet.getLastColumn()).getDisplayValues();
  var table = txTable_(KCH_LAUNCH_SHEET_,values,KCH_LAUNCH_HEADERS_,true);
  return table.rows.some(function(row) { return row.launch_key === KCH_LAUNCH_KEY_ && row.status === 'COMPLETED'; });
}

function kchLaunchClearPlan_(ss, meta) {
  // Exact allowlist: no inference from dates/names, no Drive file deletion.
  // Journals remain to prevent replay of old request IDs after launch.
  var names = ['SALES_TRANSACTIONS','SALES_TRANSACTION_ITEMS','ATTENDANCE',
    'INVENTORY_MOVEMENTS','SALES_STOCK_MOVEMENTS','STOCK_PICKUPS','SALES_CASH_DEPOSITS',
    'SKOR_EVENTS','VISIT_PHOTOS','TODAY_PLAN','WEEKLY_MEETINGS','MONTHLY_TEAM_REPORT','ACTIVITY_LOGS']
    .concat(Object.keys(KCH_INCENTIVE_SHEET_SCHEMAS_));
  var requests = [], changes = [];
  names.forEach(function(name) {
    var sheet = ss.getSheetByName(name), p = meta[name];
    if (!sheet || !p || sheet.getLastRow() < 2) return;
    // Clear all activity columns, including trailing manual notes, but keep
    // header, formatting, validation and grid. Entire original file is backed up.
    requests.push({updateCells:{range:{sheetId:p.sheetId,startRowIndex:1,endRowIndex:sheet.getLastRow(),startColumnIndex:0,endColumnIndex:Math.max(sheet.getLastColumn(),p.gridProperties.columnCount)},rows:[],fields:'userEnteredValue'}});
    changes.push(name + ': data uji dikosongkan (tersimpan di cadangan).');
  });
  changes.push('Persiapan launch sekali: saldo gudang/pegangan, master dan login tetap; hasil laporan kosong sampai pembaruan berikutnya.');
  return {requests:requests,changes:changes};
}

function kchLaunchReserve_(ss, ctx, meta, stamp, backupUrl) {
  var requests = [], sheet = ss.getSheetByName(KCH_TX_REQUEST_SHEET_);
  if (!meta[KCH_TX_REQUEST_SHEET_]) txAddSheet_(meta,requests,KCH_TX_REQUEST_SHEET_,KCH_TX_REQUEST_HEADERS_,true);
  else txTable_(KCH_TX_REQUEST_SHEET_,txRead_(ctx,[KCH_TX_REQUEST_SHEET_])[KCH_TX_REQUEST_SHEET_],KCH_TX_REQUEST_HEADERS_,true);
  var id = 'LAUNCH-' + Utilities.getUuid();
  var receipt = {request_key:txHash_('NATIVE_LAUNCH:' + id),request_id:id,actor_uid:'NATIVE_ADMIN',actor_email:KCH_BOOTSTRAP_ADMIN_EMAIL_,
    fingerprint:txHash_(KCH_LAUNCH_KEY_),attempt_id:id,transaction_id:KCH_LAUNCH_KEY_,state:'PENDING',result_json:'',
    plan_json:JSON.stringify({kind:'LAUNCH_TEST_CLEANUP',backupUrl:backupUrl}),created_at:stamp,updated_at:stamp,_row:sheet ? Math.max(1,sheet.getLastRow()) : 1};
  requests.push(txAppend_(meta[KCH_TX_REQUEST_SHEET_].sheetId,[txReceiptValues_(receipt)]));
  txBatch_(ctx,requests);
  return receipt;
}
