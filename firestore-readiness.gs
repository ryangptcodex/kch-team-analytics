// Run manually from the bound Production Apps Script editor.
function periksaSumberMigrasiFirestore() {
  var ss=firestoreMigrationSource_();
  var ctx={id:ss.getId(),token:ScriptApp.getOAuthToken()};
  var meta=txMetadata_(ctx);
  var required=['SALES','PRODUCTS','PRICE_MASTER','DISTRIBUTORS','INVENTORY','SALES_TRANSACTIONS','ACCESS_USERS'];
  var followUp=['SALES_STOCK','SALES_STOCK_MOVEMENTS','INVENTORY_MOVEMENTS','STOCK_PICKUPS','SALES_CASH_DEPOSITS',
    'ATTENDANCE','VISIT_PHOTOS','TODAY_PLAN','WEEKLY_MEETINGS','KCH_NEWS','HOLIDAYS','FILES','SETTINGS','ACTIVITY_LOGS',
    'SKOR_EVENTS','_KCH_RM_APPROVALS','_KCH_TX_REQUESTS','_KCH_TX_EDITS','_KCH_OPERATIONS','_KCH_MONTHLY_ARCHIVES',
    '_KCH_ARCHIVE_ROWS','_KCH_PERIOD_MASTERS','MONTHLY_TEAM_REPORT','INSENTIF_HARIAN','INSENTIF_BULANAN','INSENTIF_TRIWULAN'];
  var counts={};
  required.concat(followUp).forEach(function(name) {
    var sheet=ss.getSheetByName(name);
    if (sheet) counts[name]=Math.max(0,sheet.getLastRow()-1);
  });
  var missing=required.filter(function(name) { return !meta[name] || counts[name]===undefined; });
  var receiptState=meta[KCH_TX_REQUEST_SHEET_] ? (txHasPending_(txReceipts_(ctx,meta)) ? 'PENDING' : 'NO_PENDING') : 'NO_JOURNAL';
  var result={project:getFirebaseWebConfig_().projectId,missingRequired:missing,receiptState:receiptState,rowsBelowHeader:counts};
  console.log(JSON.stringify(result));
  return result;
}

function firestoreMigrationSource_() {
  var active=Session.getActiveUser().getEmail(), effective=Session.getEffectiveUser().getEmail();
  if (!isKchProduction_() || normalizeKey_(active)!==normalizeKey_(KCH_BOOTSTRAP_ADMIN_EMAIL_) ||
      normalizeKey_(effective)!==normalizeKey_(KCH_BOOTSTRAP_ADMIN_EMAIL_)) {
    throw new Error('ACCESS_DENIED: Jalankan dari editor Apps Script Production dengan akun Admin utama.');
  }
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId()!==getKchSpreadsheetId_()) throw new Error('Spreadsheet Production yang terikat belum terkonfirmasi.');
  return ss;
}

// Save a private staging copy of selected master tables to the admin's My Drive.
function siapkanMasterStagingFirestore() {
  var ss=firestoreMigrationSource_(), ctx={id:ss.getId(),token:ScriptApp.getOAuthToken()};
  var meta=txMetadata_(ctx);
  if (!meta[KCH_TX_REQUEST_SHEET_] || txHasPending_(txReceipts_(ctx,meta))) {
    throw new Error('Cek jurnal transaksi terlebih dahulu. Ekspor staging ditahan.');
  }
  var names=['PRODUCTS','PRICE_MASTER','DISTRIBUTORS'];
  var raw=txRead_(ctx,names), tables={};
  names.forEach(function(name) {
    var headers=TABLE_SCHEMAS[name], table=txTable_(name,raw[name],headers,true);
    tables[name]=table.rows.map(function(row) {
      var record={};
      headers.forEach(function(header) { record[header]=row[header]; });
      return record;
    });
  });
  var filename='KCH-MASTER-STAGING-'+Utilities.formatDate(new Date(),TIMEZONE,'yyyyMMdd-HHmmss')+'.json';
  var content={version:1,project:getFirebaseWebConfig_().projectId,tables:tables};
  var file=DriveApp.createFile(Utilities.newBlob(JSON.stringify(content),'application/json',filename));
  if (file.getSharingAccess()!==DriveApp.Access.PRIVATE) throw new Error('Setelan berbagi file staging perlu diperiksa di My Drive.');
  var result={file:filename,url:file.getUrl(),counts:Object.fromEntries(names.map(function(name) { return [name,tables[name].length]; }))};
  console.log(JSON.stringify(result));
  return result;
}
