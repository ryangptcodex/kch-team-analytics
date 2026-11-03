// Closed periods are immutable. Archive rows + active-row removal + receipt commit
// together; a full private spreadsheet copy is made before any row is removed.
var KCH_ARCHIVE_BUILD_FULL_ = false;
var KCH_ARCHIVE_RUN_MONTH_ = '';
var KCH_ARCHIVE_INDEX_ = '_KCH_MONTHLY_ARCHIVES';
var KCH_ARCHIVE_ROWS_ = '_KCH_ARCHIVE_ROWS';
var KCH_ARCHIVE_SCHEMAS_ = {
  _KCH_MONTHLY_ARCHIVES:['month','cutoff_wib','snapshot_id','snapshot_url','archived_at','row_count','status'],
  _KCH_ARCHIVE_ROWS:['month','sheet_name','headers_json','values_json']
};
var KCH_ARCHIVE_DATES_ = {
  SALES_TRANSACTIONS:'transaction_date',ATTENDANCE:'date',VISIT_PHOTOS:'visit_date',
  INVENTORY_MOVEMENTS:'date',SALES_STOCK_MOVEMENTS:'date',STOCK_PICKUPS:'pickup_date',SALES_CASH_DEPOSITS:'deposit_date',
  SKOR_EVENTS:'payload_json',TODAY_PLAN:'plan_date',WEEKLY_MEETINGS:'meeting_date',MONTHLY_TEAM_REPORT:'report_month',
  ACTIVITY_LOGS:'timestamp',INSENTIF_HARIAN:'date',INSENTIF_BULANAN:'month',INSENTIF_TRIWULAN:'quarter_end'
};
function archiveNow_() { return Utilities.formatDate(new Date(),'Asia/Jakarta','yyyy-MM-dd HH:mm:ss'); }
function archiveMonth_() { return KCH_ARCHIVE_RUN_MONTH_ || archiveNow_().slice(0,7); }
function archiveEnabled_() { return PropertiesService.getScriptProperties().getProperty('KCH_MONTHLY_ARCHIVE_ENABLED') === 'TRUE'; }
function archiveAssertOpenDate_(date) {
  if (archiveEnabled_() && String(date).slice(0,7) < archiveMonth_()) throw new Error('Periode sudah ditutup. Arsip bulan sebelumnya hanya dapat dilihat; gunakan tanggal bulan berjalan.');
}
function archivePendingGuard_() {
  if (!archiveEnabled_()) return;
  var ctx={id:getKchSpreadsheet_().getId(),token:ScriptApp.getOAuthToken()},meta=txMetadata_(ctx);
  var rows=txReceipts_(ctx,meta);
  if (rows.some(function(row){return String(row.actor_uid)==='MONTHLY_ARCHIVE' && row.state==='PENDING' && !txCommitted_(rows,row.request_key);})) throw new Error('Pengarsipan bulanan belum pasti selesai. Hentikan input dan periksa status arsip; jangan menghapus jurnal.');
}
function archiveIndex_() {
  var sheet=getKchSpreadsheet_().getSheetByName(KCH_ARCHIVE_INDEX_);
  if (!sheet || sheet.getLastRow()<2) return [];
  return txTable_(KCH_ARCHIVE_INDEX_,sheet.getRange(1,1,sheet.getLastRow(),sheet.getLastColumn()).getDisplayValues(),KCH_ARCHIVE_SCHEMAS_[KCH_ARCHIVE_INDEX_],true).rows;
}
function archiveAllRows_() {
  var sheet=getKchSpreadsheet_().getSheetByName(KCH_ARCHIVE_ROWS_);
  if (!sheet || sheet.getLastRow()<2) return [];
  return txTable_(KCH_ARCHIVE_ROWS_,sheet.getRange(1,1,sheet.getLastRow(),sheet.getLastColumn()).getValues(),KCH_ARCHIVE_SCHEMAS_[KCH_ARCHIVE_ROWS_],true).rows;
}
// Map columns by header (old invoices may predate source columns), never by index.
function archiveMergeTable_(name, active, archiveValues) {
  if (!archiveEnabled_() || !Object.prototype.hasOwnProperty.call(KCH_ARCHIVE_DATES_,name)) return active;
  var stored=(archiveValues ? txTable_(KCH_ARCHIVE_ROWS_,archiveValues,KCH_ARCHIVE_SCHEMAS_[KCH_ARCHIVE_ROWS_],true).rows : archiveAllRows_()).filter(function(row){return row.sheet_name===name;});
  if (!stored.length) return active;
  var headers=active && active[0] ? active[0].slice() : JSON.parse(stored[0].headers_json), rows=[];
  stored.forEach(function(row){
    var old=JSON.parse(row.headers_json),values=JSON.parse(row.values_json);
    rows.push(headers.map(function(h){var i=old.indexOf(h);return i<0?'':values[i];}));
  });
  return [headers].concat(rows,(active||[]).slice(1));
}
function archiveHistoryObjects_(name) {
  var ctx={id:getKchSpreadsheet_().getId(),token:ScriptApp.getOAuthToken()},meta=txMetadata_(ctx);
  if(name==='SALES_TRANSACTIONS' && !meta[name])throw new Error('Sumber SALES_TRANSACTIONS tidak ditemukan; laporan ditahan.');
  var names=[name,KCH_ARCHIVE_ROWS_].filter(function(n){return !!meta[n];}),raw=txRead_(ctx,names);
  var table=archiveMergeTable_(name,raw[name]||[],raw[KCH_ARCHIVE_ROWS_]||[KCH_ARCHIVE_SCHEMAS_[KCH_ARCHIVE_ROWS_]]);
  return {headers:table[0]||[],rows:filterAuthorizedRows_(name,txTable_(name,table,[],false).rows)};
}
function archiveReportRows_(rows) {
  if (!archiveEnabled_() || KCH_ARCHIVE_BUILD_FULL_) return rows;
  var month=archiveMonth_(),quarter=Math.floor((Number(month.slice(5))-1)/3)+1;
  rows.INSENTIF_HARIAN=rows.INSENTIF_HARIAN.filter(function(row){return row[0]===month;});
  rows.INSENTIF_BULANAN=rows.INSENTIF_BULANAN.filter(function(row){return row[0]===month;});
  rows.INSENTIF_TRIWULAN=rows.INSENTIF_TRIWULAN.filter(function(row){return String(row[0])===month.slice(0,4)&&row[1]==='TW'+quarter;});
  return rows;
}
function archiveEnsureTrigger_(ss) {
  kchSheetUpdateAdmin_(ss,Session.getActiveUser().getEmail());
  var triggers=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='kchMonthlyArchiveTick_';});
  if (!triggers.length) ScriptApp.newTrigger('kchMonthlyArchiveTick_').timeBased().everyMinutes(1).create();
  triggers.slice(1).forEach(function(t){ScriptApp.deleteTrigger(t);});
  PropertiesService.getScriptProperties().setProperty('KCH_MONTHLY_ARCHIVE_ENABLED','TRUE');
  PropertiesService.getScriptProperties().deleteProperty('KCH_ARCHIVE_ERROR_MONTH');
  // Old launch checkbox is no longer destructive, even if left checked.
  var control=ss.getSheetByName(KCH_UPDATE_SHEET_);
  if(control){control.getRange('A15').setValue(false);control.getRange('A17').setValue('Mode arsip bulanan aktif. Histori dipertahankan; reset launch dinonaktifkan.');}
}
function setupArsipBulanan() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();kchSheetUpdateAdmin_(ss,Session.getActiveUser().getEmail());
  installKchSheetUpdates_();
  kchRunSheetUpdates_(ss);
  return archiveRun_(ss);
}
function kchMonthlyArchiveTick_() {
  if (!archiveEnabled_()) return;
  if(typeof healthApplyRestoreMarker_==='function')healthApplyRestoreMarker_();
  var props=PropertiesService.getScriptProperties();
  if (props.getProperty('KCH_ARCHIVE_CHECKED_MONTH')===archiveMonth_() || props.getProperty('KCH_ARCHIVE_ERROR_MONTH')===archiveMonth_()) return;
  return archiveRun_(getKchSpreadsheet_(),true);
}
function archiveRowMonth_(name, headers, values) {
  var field=KCH_ARCHIVE_DATES_[name],value=values[headers.indexOf(field)];
  if (name==='SKOR_EVENTS') {try{value=JSON.parse(value).date;}catch(err){throw new Error('SKOR_EVENTS: tanggal arsip tidak dapat dibaca.');}}
  var date=normalizeDateString_(value);
  if (!/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(date)) throw new Error(name+': tanggal kosong/tidak valid; pengarsipan dihentikan tanpa menghapus data.');
  return date.slice(0,7);
}
function archivePlan_(ss,meta,ctx) {
  var month=archiveMonth_(),requests=[],changes=[],records=[],months=Object.create(null),names=Object.keys(KCH_ARCHIVE_DATES_).filter(function(n){return !!meta[n];});
  var raw=txRead_(ctx,names);
  names.forEach(function(name){
    var values=raw[name]||[],headers=values[0]||[],remove=[];
    if (values.length<2) return;
    if (headers.indexOf(KCH_ARCHIVE_DATES_[name])<0) throw new Error(name+': kolom tanggal belum sesuai; tidak ada data yang dihapus.');
    values.slice(1).forEach(function(row,i){
      if (!row.some(function(v){return v!==''&&v!==null;})) return;
      var period=archiveRowMonth_(name,headers,row);
      if (period>=month) return;
      var encoded=JSON.stringify(row),encodedHeaders=JSON.stringify(headers);
      if(encoded.length>45000 || encodedHeaders.length>45000) throw new Error(name+': isi baris terlalu panjang untuk arsip aman.');
      records.push([period,name,encodedHeaders,encoded]);months[period]=(months[period]||0)+1;remove.push(i+1);
    });
    // Clear only archived cells; never delete physical rows (a compact/frozen
    // sheet must retain its grid). Current/future rows, formulas and formats stay put.
    if (name.indexOf('INSENTIF_')!==0) for(var i=remove.length-1;i>=0;i--){var end=remove[i]+1,start=remove[i];while(i>0&&remove[i-1]===start-1){i--;start=remove[i];}requests.push({updateCells:{range:{sheetId:meta[name].sheetId,startRowIndex:start,endRowIndex:end,startColumnIndex:0,endColumnIndex:(meta[name].gridProperties||{}).columnCount||headers.length},rows:[],fields:'userEnteredValue'}});}
    if(remove.length)changes.push(name+': '+remove.length+' baris dipindah ke arsip.');
  });
  if (records.length>15000 || JSON.stringify([records,requests]).length>7500000) throw new Error('Arsip terlalu besar untuk satu proses aman; tidak ada aktivitas dihapus. Hubungi pengelola untuk migrasi bertahap.');
  return {requests:requests,changes:changes,records:records,months:months};
}
function archiveRun_(ss, scheduled) {
  kchSheetUpdateAdmin_(ss,(scheduled ? Session.getEffectiveUser() : Session.getActiveUser()).getEmail());
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  var previousRunMonth=KCH_ARCHIVE_RUN_MONTH_;KCH_ARCHIVE_RUN_MONTH_=archiveNow_().slice(0,7);
  var control=ss.getSheetByName(KCH_UPDATE_SHEET_),ctx={id:ss.getId(),token:ScriptApp.getOAuthToken()},backupUrl='';
  try {
    assertNoPendingTransactions_();
    var meta=txMetadata_(ctx);
    [KCH_ARCHIVE_INDEX_,KCH_ARCHIVE_ROWS_,KCH_TX_REQUEST_SHEET_].forEach(function(n){if(!meta[n])throw new Error('Klik Perbarui Seluruh Sheet dahulu; '+n+' belum tersedia.');});
    // Validate both journals before the backup/reservation or deletion.
    txTable_(KCH_ARCHIVE_INDEX_,txRead_(ctx,[KCH_ARCHIVE_INDEX_])[KCH_ARCHIVE_INDEX_],KCH_ARCHIVE_SCHEMAS_[KCH_ARCHIVE_INDEX_],true);
    txTable_(KCH_ARCHIVE_ROWS_,txRead_(ctx,[KCH_ARCHIVE_ROWS_])[KCH_ARCHIVE_ROWS_],KCH_ARCHIVE_SCHEMAS_[KCH_ARCHIVE_ROWS_],true);
    var plan=archivePlan_(ss,meta,ctx);
    if (plan.records.length) archiveFinalizeIncentives_(ss,meta,ctx,plan);
    if (!plan.records.length) {PropertiesService.getScriptProperties().setProperty('KCH_ARCHIVE_CHECKED_MONTH',archiveMonth_());return {success:true,archivedRows:0};}
    var stamp=archiveNow_(),snapshot=ss.copy(ss.getName()+' - ARSIP BULANAN sampai '+Object.keys(plan.months).sort().pop()+' - '+stamp.replace(/:/g,'.'));
    if (!snapshot||snapshot.getId()===ss.getId())throw new Error('Salinan arsip gagal dibuat; aktivitas tidak dihapus.');
    backupUrl=snapshot.getUrl();
    if(control){control.getRange('B8').setValue('Mengarsipkan…');control.getRange('B10').setValue(backupUrl);SpreadsheetApp.flush();}
    var id='ARCHIVE-'+Utilities.getUuid(),receipt={request_key:txHash_('NATIVE_ARCHIVE:'+id),request_id:id,actor_uid:'MONTHLY_ARCHIVE',actor_email:KCH_BOOTSTRAP_ADMIN_EMAIL_,fingerprint:txHash_(JSON.stringify(plan.months)),attempt_id:id,transaction_id:id,state:'PENDING',result_json:'',plan_json:JSON.stringify({kind:'MONTHLY_ARCHIVE',backupUrl:backupUrl}),created_at:stamp,updated_at:stamp,_row:Math.max(1,ss.getSheetByName(KCH_TX_REQUEST_SHEET_).getLastRow())};
    txBatch_(ctx,[txAppend_(meta[KCH_TX_REQUEST_SHEET_].sheetId,[txReceiptValues_(receipt)])]);
    plan.requests.push(txAppend_(meta[KCH_ARCHIVE_ROWS_].sheetId,plan.records));
    var indexRows=Object.keys(plan.months).sort().map(function(month){var parts=month.split('-').map(Number),last=new Date(Date.UTC(parts[0],parts[1],0)).getUTCDate();return [month,month+'-'+last+' 23:59:59',snapshot.getId(),backupUrl,stamp,plan.months[month],'COMPLETED'];});
    plan.requests.push(txAppend_(meta[KCH_ARCHIVE_INDEX_].sheetId,indexRows));
    receipt.state='COMMITTED';receipt.result_json=JSON.stringify({success:true,transactionId:id,archivedRows:plan.records.length});
    plan.requests.push(txUpdate_(meta[KCH_TX_REQUEST_SHEET_].sheetId,receipt._row,0,[txReceiptValues_(receipt)]));
    try{txBatch_(ctx,plan.requests);}catch(err){
      var saved=txCommitted_(txReceipts_(ctx,meta),receipt.request_key);
      if(!saved){if([400,403,404].indexOf(err.httpStatus)>=0)txMarkFailed_(ctx,meta,receipt,'ARCHIVE_REJECTED',err.message);throw err;}
    }
    PropertiesService.getScriptProperties().setProperty('KCH_ARCHIVE_CHECKED_MONTH',archiveMonth_());
    if(control){control.getRange('B8').setValue('Berhasil');control.getRange('B11').setValue(plan.changes.join('\n')+'\nMaster, akun dan saldo stok tetap. Lihat menu Arsip Bulanan.');}
    return {success:true,archivedRows:plan.records.length,backupUrl:backupUrl};
  }catch(err){PropertiesService.getScriptProperties().setProperty('KCH_ARCHIVE_ERROR_MONTH',archiveMonth_());if(control){control.getRange('B8').setValue('Arsip gagal / perlu diperiksa');control.getRange('B11').setValue(err.message+(err.apiMessage?'\nRincian Google: '+err.apiMessage:'')+(backupUrl?'\nSalinan lengkap: '+backupUrl:'')+([400,403,404].indexOf(err.httpStatus)>=0?'\nPermintaan ditolak Google; pemindahan aktivitas tidak diterapkan. Perbaiki penyebab lalu jalankan setupArsipBulanan lagi.':'\nHentikan input bila hasil belum pasti; jangan hapus jurnal PENDING.'));}throw err;}
  finally{KCH_ARCHIVE_RUN_MONTH_=previousRunMonth;lock.releaseLock();}
}
function getMonthlyArchives_() {
  var user=getCurrentUserInfo_();if(['ADMIN','GUEST'].indexOf(user.role)<0)throw new Error('ACCESS_DENIED');
  var groups=Object.create(null);
  archiveIndex_().forEach(function(row){if(row.status!=='COMPLETED')return;if(!groups[row.month]){groups[row.month]={month:row.month,cutoff:row.cutoff_wib,rows:0};if(user.role==='ADMIN')groups[row.month].snapshotUrl=row.snapshot_url;}groups[row.month].rows+=Number(row.row_count)||0;});
  return {success:true,canOpenSnapshot:user.role==='ADMIN',months:Object.keys(groups).sort().reverse().map(function(m){return groups[m];}),tables:Object.keys(KCH_ARCHIVE_DATES_).filter(function(n){return user.role==='ADMIN'||['ACTIVITY_LOGS','SKOR_EVENTS'].indexOf(n)<0;})};
}
function getMonthlyArchiveTable_(month,name,page) {
  var setup=getMonthlyArchives_();
  if (!setup.months.some(function(row){return row.month===month;})||setup.tables.indexOf(name)<0)throw new Error('Arsip tidak tersedia atau tidak diizinkan.');
  page=Number(page||1);if(!Number.isSafeInteger(page)||page<1)throw new Error('Halaman tidak valid.');
  var stored=archiveAllRows_().filter(function(row){return row.month===month&&row.sheet_name===name;}),headers=stored.length?JSON.parse(stored[0].headers_json):[];
  var rows=stored.map(function(row){var hs=JSON.parse(row.headers_json),vs=JSON.parse(row.values_json);return headers.map(function(h){var i=hs.indexOf(h);return i<0?'':vs[i];});});
  // Hide private Drive IDs and actor tokens from the generic viewer.
  var columns=headers.map(function(h,i){return {h:h,i:i};}).filter(function(c){return ['photo_file_id','actor_uid'].indexOf(c.h)<0 && (getCurrentUserInfo_().role==='ADMIN' || !kchGuestPrivateField_(c.h));});
  return {success:true,headers:columns.map(function(c){return c.h;}),rows:rows.slice((page-1)*100,page*100).map(function(row){return columns.map(function(c){return row[c.i];});}),total:rows.length,page:page};
}

// Freeze final closed-month results using the same calculators as the webapp;
// current reports are regenerated against the complete (active + archived) history.
function archiveFinalizeIncentives_(ss,meta,ctx,plan) {
  var previousUser=KCH_REQUEST_USER_,previousFull=KCH_ARCHIVE_BUILD_FULL_,full;
  try {
    KCH_REQUEST_USER_={role:'ADMIN',email:KCH_BOOTSTRAP_ADMIN_EMAIL_,salesId:''};
    KCH_ARCHIVE_BUILD_FULL_=true;
    full=kchIncentiveSheetRows_(scoreContext_(true));
  } finally {KCH_REQUEST_USER_=previousUser;KCH_ARCHIVE_BUILD_FULL_=previousFull;}
  var periods=Object.keys(plan.months),already=Object.create(null);
  archiveIndex_().forEach(function(row){if(row.status==='COMPLETED')already[row.month]=true;});
  plan.records=plan.records.filter(function(row){return row[1].indexOf('INSENTIF_')!==0;});
  Object.keys(KCH_INCENTIVE_SHEET_SCHEMAS_).forEach(function(name){
    var headers=KCH_INCENTIVE_SHEET_SCHEMAS_[name];
    full[name].forEach(function(row){var period=archiveRowMonth_(name,headers,row);if(period<archiveMonth_()&&periods.indexOf(period)>=0&&!already[period])plan.records.push([period,name,JSON.stringify(headers),JSON.stringify(row)]);});
  });
  plan.months=Object.create(null);plan.records.forEach(function(row){plan.months[row[0]]=(plan.months[row[0]]||0)+1;});
  var current=kchIncentiveSyncPlan_(ss,meta,ctx);plan.requests=plan.requests.concat(current.requests);
  if(plan.records.length>15000||JSON.stringify([plan.records,plan.requests]).length>7500000)throw new Error('Arsip dan laporan terlalu besar untuk satu proses aman; data aktif tetap.');
}

function archiveFindEvidence_(name,id) {
  if (['STOCK_PICKUPS','SALES_CASH_DEPOSITS'].indexOf(name)<0 || typeof id!=='string' || id.length>160) return null;
  var field=name==='STOCK_PICKUPS'?'pickup_id':'deposit_id',found=null;
  archiveAllRows_().some(function(row){if(row.sheet_name!==name)return false;var hs=JSON.parse(row.headers_json),vs=JSON.parse(row.values_json);if(vs[hs.indexOf(field)]!==id)return false;found={};hs.forEach(function(h,i){found[h]=vs[i];});return true;});
  return found;
}
