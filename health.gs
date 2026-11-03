// Admin-only diagnostics and verified recovery. No automatic deletion of receipts or production data.
var KCH_BACKUPS_='_KCH_BACKUPS';
var KCH_BACKUP_HEADERS_=['backup_id','created_at','spreadsheet_id','url','kind','manifest_json','status'];
var KCH_HEALTH_LOG_='_KCH_HEALTH_EVENTS';
var KCH_HEALTH_HEADERS_=['event_id','created_at','actor_email','action','reference_id','details'];
var KCH_RUNTIME_='_KCH_RUNTIME_STATE';
var KCH_RUNTIME_HEADERS_=['state_key','value','updated_at'];
var KCH_RELEASE_='KCH-AUDIT-2026-11-03';
function healthSchemas_(){var s={};s[KCH_BACKUPS_]=KCH_BACKUP_HEADERS_.slice();s[KCH_HEALTH_LOG_]=KCH_HEALTH_HEADERS_.slice();s[KCH_RUNTIME_]=KCH_RUNTIME_HEADERS_.slice();return s;}
function healthContext_(){return {id:getKchSpreadsheet_().getId(),token:ScriptApp.getOAuthToken()};}
function healthBusinessNames_(){return ['SALES','PRODUCTS','PRICE_MASTER','DISTRIBUTORS','INVENTORY','HOLIDAYS','SETTINGS','FILES','KCH_NEWS','TODAY_PLAN','WEEKLY_MEETINGS','ATTENDANCE','VISIT_PHOTOS','SALES_TRANSACTIONS','INVENTORY_MOVEMENTS','SALES_STOCK','SALES_STOCK_MOVEMENTS','STOCK_PICKUPS','SALES_CASH_DEPOSITS','DAMAGED_STOCK','SKOR_EVENTS','ACTIVITY_LOGS','_KCH_OPERATIONS','_KCH_PERIOD_MASTERS','_KCH_ARCHIVE_ROWS','_KCH_MONTHLY_ARCHIVES','_KCH_TX_EDITS'];}
function healthRegistry_(ctx,meta){return meta[KCH_BACKUPS_]?txTable_(KCH_BACKUPS_,txRead_(ctx,[KCH_BACKUPS_])[KCH_BACKUPS_],KCH_BACKUP_HEADERS_,true).rows:[];}
function healthLogRequest_(meta,requests,action,reference,details,user){
  if(!meta[KCH_HEALTH_LOG_])txAddSheet_(meta,requests,KCH_HEALTH_LOG_,KCH_HEALTH_HEADERS_,true);
  requests.push(txAppend_(meta[KCH_HEALTH_LOG_].sheetId,[['HEALTH-'+Utilities.getUuid(),Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH:mm:ss'),user.email,action,reference,JSON.stringify(details)]]));
}
function healthCapture_(ctx){
  var meta=txMetadata_(ctx),names=healthBusinessNames_().concat([KCH_TX_REQUEST_SHEET_]).filter(function(n){return !!meta[n];});
  var ranges=names.map(function(n){return 'ranges='+encodeURIComponent("'"+n.replace(/'/g,"''")+"'");}).join('&');
  // Typed values preserve formulas and date serials when restoring a trusted private backup.
  var response=txApi_(ctx,'?includeGridData=true&'+ranges+'&fields=spreadsheetId,sheets(properties(title),data(startRow,startColumn,rowData(values(userEnteredValue))))');
  if(response.spreadsheetId!==ctx.id)throw new Error('Identitas salinan tidak sesuai.');
  var tables={};(response.sheets||[]).forEach(function(s){var name=s.properties.title;if(names.indexOf(name)<0)return;var rows=[];(s.data||[]).forEach(function(block){(block.rowData||[]).forEach(function(row,y){var at=(block.startRow||0)+y;if(!rows[at])rows[at]=[];(row.values||[]).forEach(function(cell,x){rows[at][(block.startColumn||0)+x]=cell.userEnteredValue||{};});});});
    rows=rows.map(function(row){row=row||[];while(row.length&&!Object.keys(row[row.length-1]||{}).length)row.pop();return row;});while(rows.length&&!rows[rows.length-1].length)rows.pop();if(!rows.length)throw new Error(name+': header salinan tidak dapat diverifikasi.');tables[name]=rows;
  });
  if(names.some(function(n){return !tables[n];}))throw new Error('Pembacaan salinan belum lengkap.');
  var manifest={version:1,tables:{}};names.forEach(function(n){manifest.tables[n]={rows:tables[n].length,hash:txHash_(JSON.stringify(tables[n]))};});
  var business={};healthBusinessNames_().forEach(function(n){if(tables[n])business[n]=tables[n];});
  return {tables:tables,manifest:manifest,revision:txHash_(JSON.stringify(business)),values:txRead_(ctx,names)};
}
function healthPending_(capture){var typed=capture.tables[KCH_TX_REQUEST_SHEET_];if(!typed)return [];var values=typed.map(function(row){return row.map(healthCellValue_);});return txTable_(KCH_TX_REQUEST_SHEET_,values,KCH_TX_REQUEST_HEADERS_,true).rows.filter(function(r){return r.state==='PENDING'&&!txCommitted_(txTable_(KCH_TX_REQUEST_SHEET_,values,KCH_TX_REQUEST_HEADERS_,true).rows,r.request_key);});}
function healthCellValue_(cell){cell=cell||{};return cell.stringValue!==undefined?cell.stringValue:cell.numberValue!==undefined?cell.numberValue:cell.boolValue!==undefined?cell.boolValue:cell.formulaValue!==undefined?cell.formulaValue:'';}
function healthPrivateCopy_(copy){
  var file=DriveApp.getFileById(copy.getId());file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);
  file.getEditors().concat(file.getViewers()).forEach(function(user){var email=user.getEmail();if(String(email).toLowerCase()!==KCH_BOOTSTRAP_ADMIN_EMAIL_){file.removeEditor(email);file.removeViewer(email);}});
  if(file.getSharingAccess()!==DriveApp.Access.PRIVATE||!file.getOwner()||String(file.getOwner().getEmail()).toLowerCase()!==KCH_BOOTSTRAP_ADMIN_EMAIL_||file.getEditors().concat(file.getViewers()).some(function(u){return String(u.getEmail()).toLowerCase()!==KCH_BOOTSTRAP_ADMIN_EMAIL_;}))throw new Error('Izin salinan belum privat; backup tidak disahkan.');
}
function healthCreateBackupLocked_(ctx,meta,id,kind,user){
  var existing=healthRegistry_(ctx,meta).filter(function(r){return r.backup_id===id&&r.status==='COMPLETE';})[0];if(existing)return existing;
  if(txHasPending_(txReceipts_(ctx,meta)))throw new Error('Backup ditahan sampai semua kiriman dipastikan selesai.');
  var before=healthCapture_(ctx),ss=getKchSpreadsheet_(),stamp=Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH.mm.ss'),copy=ss.copy(ss.getName()+' - BACKUP '+kind+' '+stamp);healthPrivateCopy_(copy);
  var captured=healthCapture_({id:copy.getId(),token:ctx.token}),after=healthCapture_(ctx);
  if(healthPending_(captured).length||JSON.stringify(captured.manifest)!==JSON.stringify(before.manifest)||after.revision!==before.revision)throw new Error('Sumber berubah saat dicadangkan; salinan tidak disahkan. Coba lagi.');
  var requests=[];if(!meta[KCH_BACKUPS_])txAddSheet_(meta,requests,KCH_BACKUPS_,KCH_BACKUP_HEADERS_,true);
  var row=[id,Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH:mm:ss'),copy.getId(),copy.getUrl(),kind,JSON.stringify(captured.manifest),'COMPLETE'];requests.push(txAppend_(meta[KCH_BACKUPS_].sheetId,[row]));healthLogRequest_(meta,requests,'CREATE_BACKUP',id,{revision:captured.revision},user);txBatch_(ctx,requests);
  var result={};KCH_BACKUP_HEADERS_.forEach(function(h,i){result[h]=row[i];});return result;
}
function createOperationalBackup_(requestId){
  opsAdmin_();var id=txRequestId_(requestId),lock=LockService.getScriptLock();lock.waitLock(30000);try{var ctx=healthContext_(),meta=txMetadata_(ctx),b=healthCreateBackupLocked_(ctx,meta,id,'MANUAL',getCurrentUserInfo_());return {success:true,backupId:b.backup_id,url:b.url,message:'Cadangan privat sudah dibuat dan diverifikasi.'};}finally{lock.releaseLock();}
}
function healthClosedDigest_(capture){
  var result=[],stored=capture.values[KCH_ARCHIVE_ROWS_]?txTable_(KCH_ARCHIVE_ROWS_,capture.values[KCH_ARCHIVE_ROWS_],KCH_ARCHIVE_SCHEMAS_[KCH_ARCHIVE_ROWS_],true).rows:[],month=Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM');
  Object.keys(KCH_ARCHIVE_DATES_).filter(function(n){return n.indexOf('INSENTIF_')!==0&&n!=='MONTHLY_TEAM_REPORT'&&n!=='ACTIVITY_LOGS';}).forEach(function(name){
    var values=capture.values[name]||[],headers=values[0]||[],rows=values.slice(1).map(function(row){return {headers:headers,row:row};});stored.filter(function(r){return r.sheet_name===name;}).forEach(function(r){rows.push({headers:JSON.parse(r.headers_json),row:JSON.parse(r.values_json)});});
    rows.forEach(function(item){if(!item.row.some(function(v){return v!==''&&v!==null;}))return;var date=archiveRowMonth_(name,item.headers,item.row);if(date>=month)return;var o={};item.headers.forEach(function(h,i){if(h)o[h]=item.row[i]===undefined?'':item.row[i];});result.push([name,date,o]);});
  });
  // Operational corrections are not stored in the monthly archive; they are append-only and retained.
  var ops=capture.values[KCH_OPERATIONS_]?txTable_(KCH_OPERATIONS_,capture.values[KCH_OPERATIONS_],KCH_OPERATION_HEADERS_,true).rows:[];ops.forEach(function(e){if(String(e.operation_date).slice(0,7)<month)result.push([KCH_OPERATIONS_,e.operation_date,e._cells]);});
  if(capture.values[KCH_PERIOD_MASTERS_])txTable_(KCH_PERIOD_MASTERS_,capture.values[KCH_PERIOD_MASTERS_],KCH_PERIOD_HEADERS_,true).rows.forEach(function(r){if(r.period<month)result.push([KCH_PERIOD_MASTERS_,r.period,r._cells]);});
  result.sort(function(a,b){return JSON.stringify(a).localeCompare(JSON.stringify(b));});return txHash_(JSON.stringify(result));
}
function healthVerifiedBackup_(id,ctx,meta){
  var row=healthRegistry_(ctx,meta).filter(function(r){return r.backup_id===id&&r.status==='COMPLETE';})[0];if(!row)throw new Error('Pilih cadangan terdaftar dan terverifikasi.');
  var captured=healthCapture_({id:row.spreadsheet_id,token:ctx.token});if(JSON.stringify(captured.manifest)!==row.manifest_json||healthPending_(captured).length)throw new Error('Cadangan berubah atau memiliki kiriman ambigu; pemulihan ditahan.');return {row:row,capture:captured};
}
function prepareBackupRestore_(backupId,requestId){
  opsAdmin_();var lock=LockService.getScriptLock();lock.waitLock(30000);try{var ctx=healthContext_(),meta=txMetadata_(ctx),chosen=healthVerifiedBackup_(backupId,ctx,meta),current=healthCapture_(ctx);if(healthPending_(current).length)throw new Error('Ada kiriman belum pasti. Periksa hasilnya terlebih dahulu.');
    var rollback=healthCreateBackupLocked_(ctx,meta,txRequestId_(requestId),'BEFORE_RESTORE',getCurrentUserInfo_());
    var sameClosed=healthClosedDigest_(chosen.capture)===healthClosedDigest_(current);
    return {success:true,backupId:backupId,expectedRevision:current.revision,rollbackBackupId:rollback.backup_id,canRestore:sameClosed,confirmation:'PULIHKAN '+backupId,tables:Object.keys(chosen.capture.manifest.tables).filter(function(n){return healthBusinessNames_().indexOf(n)>=0;}).map(function(n){return {name:n,rows:chosen.capture.manifest.tables[n].rows-1};}),message:sameClosed?'Cadangan kondisi sekarang siap. Periksa rincian sebelum pemulihan.':'Histori bulan tutup berbeda. Pemulihan Production ditahan; gunakan salinan pemulihan terpisah.'};
  }finally{lock.releaseLock();}
}
function saveBackupRestore_(payload){opsAdmin_();var result=txExecuteRequest_(payload,'RESTORE');if(result.success){PropertiesService.getScriptProperties().deleteProperty('KCH_ARCHIVE_CHECKED_MONTH');PropertiesService.getScriptProperties().deleteProperty('KCH_ARCHIVE_ERROR_MONTH');}return result;}
function healthRestorePlan_(ctx,meta,payload,user,id,requestId){
  opsAdmin_();if(payload.confirmation!=='PULIHKAN '+payload.backupId)throw new Error('Teks konfirmasi pemulihan belum sesuai.');var reason=String(payload.reason||'').trim();if(reason.length<3||reason.length>1000)throw new Error('Isi alasan pemulihan 3–1.000 karakter.');
  var chosen=healthVerifiedBackup_(payload.backupId,ctx,meta),rollback=healthVerifiedBackup_(payload.rollbackBackupId,ctx,meta),current=healthCapture_(ctx);
  if(current.revision!==payload.expectedRevision||rollback.capture.revision!==current.revision)throw new Error('Data berubah sejak pratinjau; siapkan pemulihan kembali.');
  if(healthClosedDigest_(chosen.capture)!==healthClosedDigest_(current))throw new Error('Histori bulan tutup berbeda; hanya salinan pemulihan terpisah yang diizinkan.');
  var receipts=txReceipts_(ctx,meta),key=txHash_(user.uid+':'+requestId);if(txHasPending_(receipts.filter(function(r){return r.request_key!==key;})))throw new Error('Masih ada kiriman lain belum pasti.');
  var source=chosen.capture.tables,requests=[];
  healthBusinessNames_().forEach(function(name){if(!meta[name]&&!source[name])return;var typed=source[name]||[];if(!typed.length&&meta[name]){var liveHeader=txRead_(ctx,[name])[name][0]||[];typed=[liveHeader.map(function(h){return {stringValue:String(h)};})];}
    if(!meta[name]){var headers=typed[0].map(healthCellValue_);txAddSheet_(meta,requests,name,headers,name.indexOf('_KCH_')===0);}
    var p=meta[name],height=Math.max(p.gridProperties.rowCount,typed.length),width=Math.max(p.gridProperties.columnCount,typed.reduce(function(n,r){return Math.max(n,r.length);},0));if(height!==p.gridProperties.rowCount||width!==p.gridProperties.columnCount)requests.push({updateSheetProperties:{properties:{sheetId:p.sheetId,gridProperties:{rowCount:height,columnCount:width}},fields:'gridProperties.rowCount,gridProperties.columnCount'}});
    requests.push({updateCells:{range:{sheetId:p.sheetId,startRowIndex:0,endRowIndex:height,startColumnIndex:0,endColumnIndex:width},rows:[],fields:'userEnteredValue'}});
    if(typed.length)requests.push({updateCells:{start:{sheetId:p.sheetId,rowIndex:0,columnIndex:0},rows:typed.map(function(row){return {values:row.map(function(cell){return {userEnteredValue:cell};})};}),fields:'userEnteredValue'}});
  });
  // Preserve request identities. Retries of rolled-back work must not recreate transactions.
  var backupReceiptValues=(source[KCH_TX_REQUEST_SHEET_]||[]).map(function(row){return row.map(healthCellValue_);}),backupReceipts=backupReceiptValues.length?txTable_(KCH_TX_REQUEST_SHEET_,backupReceiptValues,KCH_TX_REQUEST_HEADERS_,true).rows:[],backupKeys={};backupReceipts.forEach(function(r){backupKeys[r.request_key]=true;});
  receipts.forEach(function(r){if(r.state==='COMMITTED'&&!backupKeys[r.request_key]){var changed={};Object.keys(r).forEach(function(k){changed[k]=r[k];});changed.state='FAILED';changed.result_json=JSON.stringify({success:false,terminal:true,state:'FAILED',code:'ROLLED_BACK_BY_RESTORE',requestId:r.request_id,message:'Kiriman ini dikembalikan melalui pemulihan cadangan. Periksa riwayat Admin; kode kiriman lama tidak dapat dikirim ulang.'});requests.push(txUpdate_(meta[KCH_TX_REQUEST_SHEET_].sheetId,r._row,0,[txReceiptValues_(changed)]));}});
  backupReceipts.forEach(function(r){var live=receipts.filter(function(current){return current.request_key===r.request_key;})[0];if(live)requests.push(txUpdate_(meta[KCH_TX_REQUEST_SHEET_].sheetId,live._row,0,[txReceiptValues_(r)]));else requests.push(txAppend_(meta[KCH_TX_REQUEST_SHEET_].sheetId,[txReceiptValues_(r)]));});
  healthRuntimeRequest_(ctx,meta,requests,'RESTORE_GENERATION',id);
  healthLogRequest_(meta,requests,'RESTORE_BUSINESS_DATA',id,{backupId:payload.backupId,rollbackBackupId:payload.rollbackBackupId,reason:reason},user);
  if(JSON.stringify(requests).length>7500000)throw new Error('Data terlalu besar untuk pemulihan atomik. Gunakan salinan pemulihan terpisah.');
  return {requests:requests,result:{success:true,terminal:true,state:'COMMITTED',operation:'RESTORE',requestId:requestId,transactionId:id,totalSales:0,message:'Data usaha dipulihkan. Akun login tetap; cadangan sebelum pemulihan tersedia.',stockUpdates:[]},plan:{operation:'RESTORE',backupId:payload.backupId,rollbackBackupId:payload.rollbackBackupId}};
}
function createRecoveryCopy_(backupId){
  opsAdmin_();var ctx=healthContext_(),meta=txMetadata_(ctx),b=healthVerifiedBackup_(backupId,ctx,meta),copy=SpreadsheetApp.openById(b.row.spreadsheet_id).copy('KCH - SALINAN PEMULIHAN '+Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH.mm.ss'));healthPrivateCopy_(copy);var check=healthCapture_({id:copy.getId(),token:ctx.token});if(JSON.stringify(check.manifest)!==JSON.stringify(b.capture.manifest))throw new Error('Salinan pemulihan belum cocok dengan cadangan.');return {success:true,url:copy.getUrl(),message:'Salinan pemulihan privat terverifikasi; Production tidak diubah.'};
}
function recoverAbandonedReservation_(requestId,reason){
  opsAdmin_();if(typeof reason!=='string'||reason.trim().length<3||reason.length>1000)throw new Error('Isi alasan pemulihan.');var lock=LockService.getScriptLock();lock.waitLock(30000);try{var ctx=healthContext_(),meta=txMetadata_(ctx),rows=txReceipts_(ctx,meta),matches=rows.filter(function(r){return r.request_id===txRequestId_(requestId);});if(matches.length!==1)throw new Error('Catatan kiriman tidak unik.');var row=matches[0];if(row.state==='COMMITTED')return txReceiptResult_(row,true);if(row.state==='FAILED')return JSON.parse(row.result_json);
    var plan;try{plan=JSON.parse(row.plan_json);}catch(err){plan={};}
    if(row.state!=='PENDING'||plan.engine!==2||plan.phase!=='RESERVED_V2')throw new Error('Kiriman mungkin sudah dikirim ke Google. Blokir dipertahankan sampai hasil terbukti; jangan hapus jurnal.');
    var result=txFailure_('RESERVATION_CANCELLED','Reservasi belum dikirim ke penyimpanan usaha dan dibatalkan Admin.','FAILED');result.terminal=true;result.requestId=row.request_id;row.state='FAILED';row.result_json=JSON.stringify(result);var requests=[txUpdate_(meta[KCH_TX_REQUEST_SHEET_].sheetId,row._row,0,[txReceiptValues_(row)])];healthLogRequest_(meta,requests,'CANCEL_UNDISPATCHED_RESERVATION',row.request_id,{reason:reason},getCurrentUserInfo_());txBatch_(ctx,requests);return result;
  }finally{lock.releaseLock();}
}
function inspectOperationalRequest_(requestId){
  opsAdmin_();var ctx=healthContext_(),meta=txMetadata_(ctx),rows=txReceipts_(ctx,meta),matches=rows.filter(function(r){return r.request_id===txRequestId_(requestId);});if(matches.length!==1)throw new Error('Kiriman tidak ditemukan atau ID tidak unik.');var row=matches[0];if(row.state==='COMMITTED')return txReceiptResult_(row,true);if(row.state==='FAILED')return JSON.parse(row.result_json);return txPendingResult_(row.request_id,'Hasil masih belum pasti. Periksa catatan Monitor; jangan menghapus jurnal.');
}
function getOperationalHealth_(){
  opsAdmin_();var ctx=healthContext_(),meta=txMetadata_(ctx),names=['SALES','PRODUCTS','PRICE_MASTER','DISTRIBUTORS','INVENTORY','HOLIDAYS','SALES_STOCK','INVENTORY_MOVEMENTS','SALES_STOCK_MOVEMENTS',KCH_ARCHIVE_ROWS_,KCH_TX_REQUEST_SHEET_].filter(function(n){return !!meta[n];}),raw=txRead_(ctx,names),issues=[],checks=[];
  function issue(level,table,message){issues.push({level:level,table:table,message:message});}
  var required=['SALES','PRODUCTS','PRICE_MASTER','DISTRIBUTORS','INVENTORY','SALES_TRANSACTIONS','ATTENDANCE','VISIT_PHOTOS',KCH_TX_REQUEST_SHEET_,KCH_OPERATIONS_,KCH_PERIOD_MASTERS_,KCH_BACKUPS_];required.forEach(function(n){if(!meta[n])issue('ERROR',n,'Sheet wajib belum tersedia. Jalankan Perbarui Seluruh Sheet.');});
  var ss=getKchSpreadsheet_(),schemas={};[TABLE_SCHEMAS,stockSchemas_(),opsSchemas_(),periodSchemas_(),healthSchemas_()].forEach(function(group){Object.keys(group).forEach(function(n){schemas[n]=group[n];});});schemas[KCH_TX_REQUEST_SHEET_]=KCH_TX_REQUEST_HEADERS_;
  required.forEach(function(name){if(!meta[name]||!schemas[name])return;try{var sh=ss.getSheetByName(name),width=sh.getLastColumn(),headers=width?sh.getRange(1,1,1,width).getDisplayValues()[0]:[];txTable_(name,[headers],schemas[name],true);}catch(err){issue('ERROR',name,err.message);}});
  try{if(typeof DriveApp==='undefined')throw new Error('Layanan Drive belum tersedia.');var sourceFile=DriveApp.getFileById(ss.getId());if(sourceFile.getSharingAccess()!==DriveApp.Access.PRIVATE)issue('ERROR','IZIN SHEET','Spreadsheet tidak privat. Periksa pengaturan berbagi Google Drive.');var external=sourceFile.getEditors().concat(sourceFile.getViewers()).filter(function(u){return String(u.getEmail()).toLowerCase()!==KCH_BOOTSTRAP_ADMIN_EMAIL_;});if(external.length)issue('WARN','IZIN SHEET',external.length+' akun lain mempunyai akses langsung ke spreadsheet.');checks.push('Izin berbagi spreadsheet berhasil dibaca');}catch(err){issue('WARN','IZIN SHEET','Izin Drive belum dapat diperiksa: '+err.message);}
  try{var snapshot=periodRead_(Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM'));if(!snapshot||!snapshot.verified)issue('WARN','MASTER PERIODE','Snapshot master bulan berjalan belum lengkap. Jalankan Perbarui Seluruh Sheet.');else ['SALES','PRODUCTS','PRICE_MASTER','HOLIDAYS'].forEach(function(name){if(!raw[name])return;var actual=txTable_(name,raw[name],[],false).rows.map(function(r){var copy={};Object.keys(r).forEach(function(k){if(k.charAt(0)!=='_')copy[k]=r[k];});if(name==='SALES')copy.target_monthly=getIndividualMonthlyTarget_(copy.team_name,copy.target_monthly);return copy;}),frozen=snapshot.tables[name]||[],canonical=function(list){return list.map(function(r){var out={};Object.keys(r).sort().forEach(function(k){out[k]=r[k];});return JSON.stringify(out);}).sort().join('|');};if(canonical(actual)!==canonical(frozen))issue('WARN',name,'Master berubah di luar editor dan belum tercermin pada snapshot bulan berjalan. Perbarui Seluruh Sheet setelah diperiksa.');});}catch(err){issue('ERROR','MASTER PERIODE',err.message);}
  ['SALES','PRODUCTS','PRICE_MASTER','DISTRIBUTORS','INVENTORY','SALES_STOCK'].forEach(function(n){if(!raw[n])return;try{var t=txTable_(n,raw[n],TABLE_SCHEMAS[n]||KCH_STOCK_SCHEMAS_[n],false),seen={};t.rows.forEach(function(r){var key=n==='INVENTORY'?normalizeKey_(r.product_id):n==='SALES_STOCK'?JSON.stringify([r.sales_id,r.product_id,r.distributor_id]):periodKey_(n,r);if(!key||seen[key])issue('ERROR',n,'ID/key kosong atau ganda: '+key);seen[key]=true;});checks.push(n+': '+t.rows.length+' baris diperiksa');}catch(err){issue('ERROR',n,err.message);}});
  if(raw.DISTRIBUTORS){var namesSeen={};txTable_('DISTRIBUTORS',raw.DISTRIBUTORS,['distributor_name']).rows.forEach(function(d){var key=stockDistributorKey_(d.distributor_name);if(namesSeen[key])issue('ERROR','DISTRIBUTORS','Nama sumber distributor ganda: '+d.distributor_name);namesSeen[key]=true;});}
  try{if(raw.INVENTORY&&raw.DISTRIBUTORS){var inv=txTable_('INVENTORY',raw.INVENTORY,['product_id']),dists=txTable_('DISTRIBUTORS',raw.DISTRIBUTORS,['distributor_name']).rows,cols=inv.headers.filter(function(h){return dists.some(function(d){return stockDistributorKey_(h)===stockDistributorKey_(d.distributor_name);});}),latest={};if(raw.INVENTORY_MOVEMENTS)opsRawHistory_('INVENTORY_MOVEMENTS',ctx,meta,raw).forEach(function(r){latest[normalizeKey_(r.product_id)]=stockQty_(r.stock_after);});inv.rows.forEach(function(r){var total=cols.reduce(function(sum,h){return sum+stockQty_(r[h]);},0),last=latest[normalizeKey_(r.product_id)];if(last!==undefined&&last!==total)issue('ERROR','INVENTORY','Saldo '+r.product_id+' berbeda dari mutasi terakhir.');});}}
  catch(err){issue('ERROR','INVENTORY',err.message);}
  try{if(raw.SALES_STOCK){var last={};if(raw.SALES_STOCK_MOVEMENTS)opsRawHistory_('SALES_STOCK_MOVEMENTS',ctx,meta,raw).forEach(function(r){last[JSON.stringify([r.sales_id,r.product_id,r.distributor_id])]=stockQty_(r.stock_after);});txTable_('SALES_STOCK',raw.SALES_STOCK,KCH_STOCK_SCHEMAS_.SALES_STOCK,true).rows.forEach(function(r){var qty=stockQty_(r.quantity),key=JSON.stringify([r.sales_id,r.product_id,r.distributor_id]);if(last[key]!==undefined&&last[key]!==qty)issue('ERROR','SALES_STOCK','Saldo '+r.sales_id+' / '+r.product_id+' berbeda dari mutasi terakhir.');});}}catch(err){issue('ERROR','SALES_STOCK',err.message);}
  var receipts=raw[KCH_TX_REQUEST_SHEET_]?txTable_(KCH_TX_REQUEST_SHEET_,raw[KCH_TX_REQUEST_SHEET_],KCH_TX_REQUEST_HEADERS_,true).rows:[],pending=receipts.filter(function(r){return r.state==='PENDING'&&!txCommitted_(receipts,r.request_key);}).map(function(r){var plan;try{plan=JSON.parse(r.plan_json);}catch(err){plan={};}return {requestId:r.request_id,transactionId:r.transaction_id,createdAt:r.created_at,canCancelReservation:plan.engine===2&&plan.phase==='RESERVED_V2',message:plan.phase==='RESERVED_V2'?'Reservasi belum dikirim.':'Hasil mungkin sudah diproses Google; tetap ditahan sampai terbukti.'};});if(pending.length)issue('ERROR',KCH_TX_REQUEST_SHEET_,pending.length+' kiriman belum pasti.');
  var props=PropertiesService.getScriptProperties(),archiveError=props.getProperty('KCH_ARCHIVE_ERROR_MONTH');if(archiveError)issue('ERROR','ARSIP','Arsip '+archiveError+' perlu diperiksa; gunakan menu Admin setelah penyebab diperbaiki.');
  var triggers=ScriptApp.getProjectTriggers().map(function(t){return t.getHandlerFunction();});['kchMonthlyArchiveTick_','kchDailyBackupTick_','kchScheduledReportsTick_'].forEach(function(name){if(triggers.indexOf(name)<0)issue('WARN','TRIGGER','Trigger '+name+' belum terpasang.');});
  var backupRows=healthRegistry_(ctx,meta).slice().reverse().map(function(r){return {id:r.backup_id,date:r.created_at,kind:r.kind,url:r.url,status:r.status};});if(!backupRows.length)issue('WARN','BACKUP','Belum ada cadangan operasional terverifikasi.');
  return {success:true,release:KCH_RELEASE_,environment:getKchEnvironmentLabel_(),asOf:Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH:mm:ss'),issues:issues,checks:checks,pending:pending,backups:backupRows,archiveError:archiveError||'',lastReportSync:props.getProperty('KCH_REPORT_SYNC_AT')||'',lastBackupError:props.getProperty('KCH_BACKUP_ERROR')||'',lastReportError:props.getProperty('KCH_REPORT_SYNC_ERROR')||'',locale:typeof getKchSpreadsheet_().getSpreadsheetLocale==='function'?getKchSpreadsheet_().getSpreadsheetLocale():'Belum tersedia'};
}
function healthEnsureTriggers_(ss){
  kchSheetUpdateAdmin_(ss,Session.getActiveUser().getEmail());var all=ScriptApp.getProjectTriggers();['kchDailyBackupTick_','kchScheduledReportsTick_'].forEach(function(name){var existing=all.filter(function(t){return t.getHandlerFunction()===name;});if(!existing.length){var builder=ScriptApp.newTrigger(name).timeBased();if(name==='kchDailyBackupTick_')builder.everyDays(1).atHour(2).inTimezone('Asia/Jakarta').create();else builder.everyMinutes(15).create();}existing.slice(1).forEach(function(t){ScriptApp.deleteTrigger(t);});});
}
function healthNativeUser_(){var email=String(Session.getEffectiveUser().getEmail()).toLowerCase();if(email!==KCH_BOOTSTRAP_ADMIN_EMAIL_)throw new Error('ACCESS_DENIED');return {email:email,role:'ADMIN',uid:'NATIVE_ADMIN'};}
function kchDailyBackupTick_(){
  var user=healthNativeUser_(),lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;try{var ctx=healthContext_(),meta=txMetadata_(ctx);if(txHasPending_(txReceipts_(ctx,meta)))throw new Error('Ada kiriman belum pasti; pemeliharaan ditahan.');if(typeof periodEnsureCurrentLocked_==='function')periodEnsureCurrentLocked_(getKchSpreadsheet_(),ctx,meta,user);healthCreateBackupLocked_(ctx,meta,'BACKUP-'+Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd'),'DAILY',user);PropertiesService.getScriptProperties().deleteProperty('KCH_BACKUP_ERROR');}catch(err){PropertiesService.getScriptProperties().setProperty('KCH_BACKUP_ERROR',String(err.message).slice(0,1000));throw err;}finally{lock.releaseLock();}
}
function kchScheduledReportsTick_(){
  var user=healthNativeUser_(),lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;var previous=KCH_REQUEST_USER_;try{KCH_REQUEST_USER_=user;assertNoPendingTransactions_();var ctx=healthContext_(),meta=txMetadata_(ctx);if(txHasPending_(txReceipts_(ctx,meta)))throw new Error('Ada kiriman belum pasti; pemeliharaan ditahan.');if(typeof periodEnsureCurrentLocked_==='function')periodEnsureCurrentLocked_(getKchSpreadsheet_(),ctx,meta,user);if(!Object.keys(KCH_INCENTIVE_SHEET_SCHEMAS_).every(function(n){return !!meta[n];}))return;var plan=kchIncentiveSyncPlan_(getKchSpreadsheet_(),meta,ctx);txBatch_(ctx,plan.requests);PropertiesService.getScriptProperties().setProperty('KCH_REPORT_SYNC_AT',Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH:mm:ss'));PropertiesService.getScriptProperties().deleteProperty('KCH_REPORT_SYNC_ERROR');}catch(err){PropertiesService.getScriptProperties().setProperty('KCH_REPORT_SYNC_ERROR',String(err.message).slice(0,1000));throw err;}finally{KCH_REQUEST_USER_=previous;lock.releaseLock();}
}
function getSyncStatus_(){
  getCurrentUserInfo_();var ss=getKchSpreadsheet_(),pieces=[KCH_RELEASE_];[KCH_TX_REQUEST_SHEET_,'SKOR_EVENTS','ACTIVITY_LOGS'].forEach(function(n){var s=ss.getSheetByName(n);if(s){var last=s.getLastRow();pieces.push(n,last,last>1?s.getRange(last,1,1,Math.min(s.getLastColumn(),12)).getDisplayValues()[0]:[]);}});
  if(typeof DriveApp!=='undefined'){try{var cache=typeof CacheService!=='undefined'?CacheService.getScriptCache():null,key='kch-modified:'+ss.getId(),stamp=cache&&cache.get(key);if(!stamp){stamp=String(DriveApp.getFileById(ss.getId()).getLastUpdated().getTime());if(cache)cache.put(key,stamp,10);}pieces.push(stamp);}catch(err){}}
  return {success:true,version:txHash_(JSON.stringify(pieces)),serverDate:Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd'),asOf:Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH:mm:ss'),release:KCH_RELEASE_};
}

function businessContentGuard_(){
  var ctx=healthContext_(),meta=txMetadata_(ctx);if(txHasPending_(txReceipts_(ctx,meta)))throw new Error('Ada kiriman usaha yang hasilnya belum pasti. Periksa Monitor sebelum mengubah data.');
}

// The marker commits with the restore, so native recovery does not depend on a browser response arriving.
function healthRuntimeRequest_(ctx,meta,requests,key,value){
  var rows=[];if(!meta[KCH_RUNTIME_])txAddSheet_(meta,requests,KCH_RUNTIME_,KCH_RUNTIME_HEADERS_,true);else rows=txTable_(KCH_RUNTIME_,txRead_(ctx,[KCH_RUNTIME_])[KCH_RUNTIME_],KCH_RUNTIME_HEADERS_,true).rows;
  var matches=rows.filter(function(r){return r.state_key===key;});if(matches.length>1)throw new Error('Status runtime ganda.');var cells=[key,value,Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH:mm:ss')];requests.push(matches.length?txUpdate_(meta[KCH_RUNTIME_].sheetId,matches[0]._row,0,[cells]):txAppend_(meta[KCH_RUNTIME_].sheetId,[cells]));
}
function healthApplyRestoreMarker_(){
  var sheet=getKchSpreadsheet_().getSheetByName(KCH_RUNTIME_);if(!sheet||sheet.getLastRow()<2)return;
  var rows=sheet.getRange(2,1,sheet.getLastRow()-1,2).getDisplayValues(),match=rows.filter(function(r){return r[0]==='RESTORE_GENERATION';})[0];if(!match)return;var props=PropertiesService.getScriptProperties();if(props.getProperty('KCH_RESTORE_GENERATION_SEEN')===match[1])return;
  props.deleteProperty('KCH_ARCHIVE_CHECKED_MONTH');props.deleteProperty('KCH_ARCHIVE_ERROR_MONTH');props.setProperty('KCH_RESTORE_GENERATION_SEEN',match[1]);
}

function healthProtectBusinessSheets_(ss){
  var names=healthBusinessNames_().concat([KCH_TX_REQUEST_SHEET_,KCH_BACKUPS_,KCH_HEALTH_LOG_,KCH_RUNTIME_]),tag='KCH_AUDIT_V1: gunakan webapp untuk perubahan data';
  names.forEach(function(name){var sheet=ss.getSheetByName(name);if(!sheet||typeof sheet.getProtections!=='function')return;var existing=sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).filter(function(p){return p.getDescription()===tag;});if(!existing.length)existing=[sheet.protect().setDescription(tag)];existing.forEach(function(p){p.setWarningOnly(true);});});
}
