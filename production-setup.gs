// Native Admin-only, one-time preparation of the exact user-supplied Production copy.
var KCH_PRODUCTION_STATE_ = '_KCH_PRODUCTION_STATE';
var KCH_PRODUCTION_HEADERS_ = ['environment','spreadsheet_id','script_id','state','prepared_at','backup_url','opened_at','photo_folder_id'];
var KCH_OPENING_INVENTORY_ = 'STOK_AWAL_PRODUKSI';
var KCH_OPENING_HELD_ = 'PEGANGAN_AWAL_PRODUKSI';
function productionSchemas_() {
  var schemas={};schemas[KCH_PRODUCTION_STATE_]=KCH_PRODUCTION_HEADERS_.slice();
  schemas[KCH_OPENING_INVENTORY_]=TABLE_SCHEMAS.INVENTORY.slice();
  schemas[KCH_OPENING_HELD_]=['sales_id','product_id','distributor_id','quantity'];return schemas;
}
function productionIsPrepared_() {
  var value=PropertiesService.getScriptProperties().getProperty('KCH_PRODUCTION_BINDING'),binding;
  try {binding=JSON.parse(value||'null');}catch(err){return false;}
  return !!(binding&&binding.spreadsheetId===KCH_PRODUCTION_SPREADSHEET_ID_&&binding.scriptId===KCH_PRODUCTION_SCRIPT_ID_);
}
function productionRequireReady_() {
  if(isKchProduction_()&&PropertiesService.getScriptProperties().getProperty('KCH_PRODUCTION_READY')!=='READY')throw new Error('Production belum dibuka. Isi STOK_AWAL_PRODUKSI lalu jalankan terapkanStokAwalProduksi; data uji tidak boleh menjadi saldo awal.');
}
function productionNative_() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  if(String(Session.getActiveUser().getEmail()||'').toLowerCase()!==KCH_BOOTSTRAP_ADMIN_EMAIL_||!isKchProduction_()||!ss||ss.getId()!==KCH_PRODUCTION_SPREADSHEET_ID_||ss.getId()===KCH_TEST_SPREADSHEET_ID_)throw new Error('ACCESS_DENIED: Jalankan hanya dari spreadsheet dan proyek Apps Script Production yang ditentukan, memakai Gmail Admin.');
  return ss;
}
function productionState_(ss) {
  var ctx={id:ss.getId(),token:ScriptApp.getOAuthToken()},meta=txMetadata_(ctx);
  if(!meta[KCH_PRODUCTION_STATE_])return null;
  var values=txRead_(ctx,[KCH_PRODUCTION_STATE_])[KCH_PRODUCTION_STATE_];
  var rows=txTable_(KCH_PRODUCTION_STATE_,values,KCH_PRODUCTION_HEADERS_,true).rows;
  if(!rows.length)return null;
  if(rows.length!==1)throw new Error('Penanda Production tidak valid; tidak ada data dihapus.');
  var row=rows[0];if(row.environment!=='PRODUCTION'||row.spreadsheet_id!==ss.getId()||row.script_id!==ScriptApp.getScriptId()||['PREPARED','READY'].indexOf(row.state)<0)throw new Error('Penanda berasal dari lingkungan lain; persiapan ulang ditolak.');return row;
}
function productionBind_(row) {
  var props=PropertiesService.getScriptProperties();
  props.setProperty('KCH_PRODUCTION_BINDING',JSON.stringify({spreadsheetId:row.spreadsheet_id,scriptId:row.script_id}));
  props.setProperty('PHOTO_UPLOAD_FOLDER_ID',String(row.photo_folder_id));
  props.setProperty('KCH_PRODUCTION_READY',row.state==='READY'?'READY':'PREPARED');
  props.deleteProperty('KCH_PRODUCTION_INIT_PENDING');if(row.state==='READY')props.deleteProperty('KCH_PRODUCTION_OPEN_PENDING');
}
function productionClear_(p,start,end) {return {updateCells:{range:{sheetId:p.sheetId,startRowIndex:start,endRowIndex:end,startColumnIndex:0,endColumnIndex:p.gridProperties.columnCount},rows:[],fields:'userEnteredValue'}};}
function productionMasterData_(ss,ctx,meta) {
  var names=['PRODUCTS','SALES','DISTRIBUTORS','PRICE_MASTER'];names.forEach(function(n){if(!meta[n])throw new Error('Master '+n+' belum tersedia di salinan Production.');});
  var raw=txRead_(ctx,names),data={};
  names.forEach(function(n){data[n]=txTable_(n,raw[n],n==='PRODUCTS'?['product_id','product_name']:n==='SALES'?['sales_id','full_name','team_name']:n==='DISTRIBUTORS'?['distributor_id','distributor_name']:['product_id','team_name','selling_price','cost_price'],false).rows;});
  [['PRODUCTS','product_id'],['SALES','sales_id'],['DISTRIBUTORS','distributor_id']].forEach(function(pair){var seen=Object.create(null);if(!data[pair[0]].length)throw new Error('Master '+pair[0]+' kosong.');data[pair[0]].forEach(function(row){var key=normalizeKey_(row[pair[1]]);if(!key||seen[key])throw new Error('ID master '+pair[0]+' kosong/ganda.');seen[key]=true;});});
  data.DISTRIBUTORS.forEach(function(d){if(['GMP','GEUBRINA'].indexOf(stockDistributorKey_(d.distributor_name))<0)throw new Error('Distributor tidak dikenali: '+d.distributor_name);});
  ['GMP','GEUBRINA'].forEach(function(key){if(data.DISTRIBUTORS.filter(function(d){return stockDistributorKey_(d.distributor_name)===key;}).length!==1)throw new Error('Master distributor GMP/Panel harus lengkap dan unik.');});
  return data;
}
function siapkanDatabaseProduksiBaru() {
  var ss=productionNative_(),lock=LockService.getScriptLock();lock.waitLock(30000);
  var props=PropertiesService.getScriptProperties(),ctx={id:ss.getId(),token:ScriptApp.getOAuthToken()};
  try {
    var existing=productionState_(ss);if(existing){productionBind_(existing);if(existing.state==='PREPARED')productionPreparedNotice_(ss,existing.backup_url);return {success:true,alreadyPrepared:true,state:existing.state,message:'Sudah disiapkan. Data dan saldo tidak dikosongkan ulang.'};}
    if(productionIsPrepared_()||props.getProperty('KCH_PRODUCTION_INIT_PENDING'))throw new Error('Persiapan pernah dimulai atau hasilnya belum pasti. Tidak boleh reset; periksa penanda Production.');
    var meta=txMetadata_(ctx),masters=productionMasterData_(ss,ctx,meta),schemas=kchSheetSchemas_();
    Object.keys(productionSchemas_()).forEach(function(n){schemas[n]=productionSchemas_()[n];});
    var plan=kchSheetUpdatePlan_(ss,meta,schemas),keep=['PRODUCTS','PRICE_MASTER','SALES','DISTRIBUTORS','HOLIDAYS','HARI_LIBUR','LIBUR','SETTINGS'];
    Object.keys(meta).forEach(function(name){var sheet=ss.getSheetByName(name);if(!sheet||keep.indexOf(name)>=0)return;var last=sheet.getLastRow();if(last>0)plan.requests.push(productionClear_(meta[name],schemas[name]?1:0,last));});
    // Discard all old inventory balances; master products define the opening template.
    var inventory=masters.PRODUCTS.map(function(p){return [p.product_id,p.product_name,0,0];}),opening=masters.PRODUCTS.map(function(p){return [p.product_id,p.product_name,'',''];});
    [meta.INVENTORY,meta[KCH_OPENING_INVENTORY_]].forEach(function(p){if(p.gridProperties.rowCount<inventory.length+1)plan.requests.push({updateSheetProperties:{properties:{sheetId:p.sheetId,gridProperties:{rowCount:inventory.length+1}},fields:'gridProperties.rowCount'}});});
    plan.requests.push(txUpdate_(meta.INVENTORY.sheetId,1,0,inventory));plan.requests.push(txUpdate_(meta[KCH_OPENING_INVENTORY_].sheetId,1,0,opening));
    // New Production Guest credentials must be configured deliberately by Admin.
    var access=schemas.ACCESS_USERS,admin={},guest={};admin.email=KCH_BOOTSTRAP_ADMIN_EMAIL_;admin.role='ADMIN';admin.status='ACTIVE';guest.email=KCH_GUEST_EMAIL_;guest.role='GUEST';guest.status='INACTIVE';guest.display_name='Tamu';
    plan.requests.push(txUpdate_(meta.ACCESS_USERS.sheetId,1,0,[access.map(function(h){return admin[h]||'';}),access.map(function(h){return guest[h]||'';})]));
    var stamp=Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH:mm:ss'),backup=ss.copy(ss.getName()+' - BACKUP SEBELUM PERSIAPAN PRODUCTION - '+stamp.replace(/:/g,'.'));
    if(!backup||backup.getId()===ss.getId())throw new Error('Backup gagal; persiapan dibatalkan.');
    var preparingControl=ss.getSheetByName(KCH_UPDATE_SHEET_);if(preparingControl){preparingControl.getRange('B8').setValue('Menyiapkan Production…');preparingControl.getRange('B10').setValue(backup.getUrl());}
    var folder=DriveApp.createFolder('KCH Production Photos - '+ss.getId().slice(-8));
    var state=['PRODUCTION',ss.getId(),ScriptApp.getScriptId(),'PREPARED',stamp,backup.getUrl(),'',folder.getId()];
    plan.requests.push(txUpdate_(meta[KCH_PRODUCTION_STATE_].sheetId,1,0,[state]));
    if(meta[KCH_UPDATE_SHEET_]){
      var controlId=meta[KCH_UPDATE_SHEET_].sheetId;
      plan.requests.push(txUpdate_(controlId,0,0,[['PUSAT PEMBARUAN SHEET']]));
      plan.requests.push(txUpdate_(controlId,2,1,[['PERBARUI SELURUH SHEET']]));
      plan.requests.push(txUpdate_(controlId,4,0,[['Klik A3 untuk memperbarui struktur dan laporan setelah stok awal siap.'],['Lingkungan Production terpisah; data UJI COBA dipertahankan.']]));
      plan.requests.push(txUpdate_(controlId,7,0,[['Status'],['Terakhir diperiksa'],['Cadangan'],['Rincian']]));
    }
    if(JSON.stringify(plan.requests).length>7500000)throw new Error('Persiapan terlalu besar untuk satu batch aman; belum ada data diubah.');
    props.setProperty('KCH_PRODUCTION_INIT_PENDING',JSON.stringify({spreadsheetId:ss.getId(),scriptId:ScriptApp.getScriptId(),backupUrl:backup.getUrl()}));
    try{txBatch_(ctx,plan.requests);}catch(err){var saved=productionState_(ss);if(!saved){if([400,403,404].indexOf(err.httpStatus)>=0)props.deleteProperty('KCH_PRODUCTION_INIT_PENDING');throw err;}}
    // Invalidate copied sessions, archive cursors, and UJI photo-folder references.
    Object.keys(props.getProperties()).forEach(function(key){if(/^(KCH_GUEST_|KCH_ARCHIVE_|KCH_MONTHLY_ARCHIVE_|PHOTO_UPLOAD_FOLDER_ID)/.test(key))props.deleteProperty(key);});
    ScriptApp.getProjectTriggers().forEach(function(t){if(['kchSheetUpdateClick_','kchMonthlyArchiveTick_'].indexOf(t.getHandlerFunction())>=0)ScriptApp.deleteTrigger(t);});
    productionBind_(productionState_(ss));
    productionPreparedNotice_(ss,backup.getUrl());
    ss.toast('Production bersih disiapkan. Belum dibuka untuk input sebelum stok awal diterapkan.','KCH Production',10);
    return {success:true,state:'PREPARED',backupUrl:backup.getUrl(),message:'Isi saldo fisik pada STOK_AWAL_PRODUKSI; jangan gunakan saldo percobaan.'};
  } catch(err){productionFailureNotice_(ss,err);throw err;}finally{lock.releaseLock();}
}
function terapkanStokAwalProduksi() {
  var ss=productionNative_(),lock=LockService.getScriptLock();lock.waitLock(30000);
  var props=PropertiesService.getScriptProperties(),ctx={id:ss.getId(),token:ScriptApp.getOAuthToken()},opened=false,showReady=false;
  try {
    var state=productionState_(ss);if(!state)throw new Error('Jalankan siapkanDatabaseProduksiBaru dahulu.');
    if(state.state==='READY'){showReady=props.getProperty('KCH_PRODUCTION_READY')!=='READY';productionBind_(state);opened=true;}
    else {
      if(props.getProperty('KCH_PRODUCTION_OPEN_PENDING'))throw new Error('Hasil stok awal belum pasti. Jangan mengulangi; periksa penanda Production.');
      var meta=txMetadata_(ctx),masters=productionMasterData_(ss,ctx,meta),names=Object.keys(schemasForOpening_()).filter(function(n){return !!meta[n];}),raw=txRead_(ctx,names);
      names.forEach(function(n){if([KCH_OPENING_INVENTORY_,KCH_OPENING_HELD_].indexOf(n)<0&&txTable_(n,raw[n],[],false).rows.length)throw new Error('Sudah ada aktivitas di '+n+'; stok awal tidak boleh diterapkan ulang.');});
      [KCH_OPENING_INVENTORY_,KCH_OPENING_HELD_,'INVENTORY','SALES_STOCK','ACTIVITY_LOGS','INVENTORY_MOVEMENTS','SALES_STOCK_MOVEMENTS'].forEach(function(n){if(!meta[n])throw new Error('Sheet '+n+' belum lengkap; periksa persiapan Production.');});
      var warehouse=txTable_(KCH_OPENING_INVENTORY_,raw[KCH_OPENING_INVENTORY_],TABLE_SCHEMAS.INVENTORY,true).rows,held=txTable_(KCH_OPENING_HELD_,raw[KCH_OPENING_HELD_],productionSchemas_()[KCH_OPENING_HELD_],true).rows,seen=Object.create(null),inventory=[],inventoryMoves=[],holdings=[],heldMoves=[],stamp=Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH:mm:ss'),date=Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd'),id='OPENING-'+Utilities.getUuid();
      warehouse.forEach(function(row){var key=normalizeKey_(row.product_id),product=txUnique_(masters.PRODUCTS,function(p){return normalizeKey_(p.product_id)===key;},'Produk stok awal');if(seen[key])throw new Error('Produk stok awal ganda.');seen[key]=true;var quantities=TABLE_SCHEMAS.INVENTORY.slice(2).map(function(h){if(row[h]===''||row[h]===null)throw new Error('Isi stok fisik untuk '+product.product_id+' / '+h+' (boleh 0).');return stockQty_(row[h]);});inventory.push([product.product_id,product.product_name,quantities[0],quantities[1]]);var total=quantities[0]+quantities[1];if(!Number.isSafeInteger(total))throw new Error('Stok awal terlalu besar.');if(total)inventoryMoves.push([date,product.product_id,'IN',total,0,total,id,KCH_BOOTSTRAP_ADMIN_EMAIL_,stamp]);});
      if(warehouse.length!==masters.PRODUCTS.length)throw new Error('Semua produk harus ada pada STOK_AWAL_PRODUKSI.');
      var heldSeen=Object.create(null);held.forEach(function(row){var sales=txUnique_(masters.SALES,function(s){return normalizeKey_(s.sales_id)===normalizeKey_(row.sales_id);},'Sales pegangan awal'),product=txUnique_(masters.PRODUCTS,function(p){return normalizeKey_(p.product_id)===normalizeKey_(row.product_id);},'Produk pegangan awal'),dist=stockDistributor_(masters.DISTRIBUTORS,row.distributor_id,false),qty=(row.quantity===''||row.quantity===null?NaN:stockQty_(row.quantity)),key=JSON.stringify([sales.sales_id,product.product_id,dist.distributor_id]);if(!Number.isSafeInteger(qty))throw new Error('Jumlah pegangan awal wajib diisi (boleh 0).');if(heldSeen[key])throw new Error('Pegangan awal ganda.');heldSeen[key]=true;if(qty){holdings.push([sales.sales_id,product.product_id,dist.distributor_id,qty,stamp]);heldMoves.push([date,sales.sales_id,product.product_id,dist.distributor_id,'IN',qty,0,qty,id,KCH_BOOTSTRAP_ADMIN_EMAIL_,stamp]);}});
      var requests=[txUpdate_(meta.INVENTORY.sheetId,1,0,inventory)];if(holdings.length)requests.push(txAppend_(meta.SALES_STOCK.sheetId,holdings));if(inventoryMoves.length)requests.push(txAppend_(meta.INVENTORY_MOVEMENTS.sheetId,inventoryMoves));if(heldMoves.length)requests.push(txAppend_(meta.SALES_STOCK_MOVEMENTS.sheetId,heldMoves));
      requests.push(txAppend_(meta.ACTIVITY_LOGS.sheetId,[['AUD-'+Utilities.getUuid(),stamp,KCH_BOOTSTRAP_ADMIN_EMAIL_,'OPENING_BALANCES',id,'Saldo fisik pembukaan Production; bukan penjualan/omzet.']]));
      var values=KCH_PRODUCTION_HEADERS_.map(function(h){return h==='state'?'READY':h==='opened_at'?stamp:state[h];});requests.push(txUpdate_(meta[KCH_PRODUCTION_STATE_].sheetId,1,0,[values]));
      if(JSON.stringify(requests).length>7500000)throw new Error('Stok awal terlalu besar untuk satu batch aman.');
      props.setProperty('KCH_PRODUCTION_OPEN_PENDING',id);
      try{txBatch_(ctx,requests);}catch(err){var saved=productionState_(ss);if(!saved||saved.state!=='READY'){if([400,403,404].indexOf(err.httpStatus)>=0)props.deleteProperty('KCH_PRODUCTION_OPEN_PENDING');throw err;}}
      productionBind_(productionState_(ss));opened=true;showReady=true;
    }
  }catch(err){productionFailureNotice_(ss,err);throw err;}finally{lock.releaseLock();}
  if(opened)installKchSheetUpdates_();
  if(showReady){var control=ss.getSheetByName(KCH_UPDATE_SHEET_);if(control){control.getRange('B8').setValue('Stok awal Production sudah diterapkan');control.getRange('B11').setValue('Saldo awal diterapkan sekali. Verifikasi master, atur akun Tamu, lalu periksa deployment; temuan audit lain tetap perlu dibereskan sebelum launch.');}ss.toast('Stok awal sudah diterapkan; tidak menambah omzet.','KCH Production',10);}
  return {success:true,state:'READY',message:'Stok awal sudah diterapkan sekali. Verifikasi master dan akses sebelum deployment; tidak ada omzet uji yang dibawa.'};
}
function schemasForOpening_() {
  var schemas=productionSchemas_();['SALES_TRANSACTIONS','INVENTORY_MOVEMENTS','SALES_STOCK','SALES_STOCK_MOVEMENTS','STOCK_PICKUPS','SALES_CASH_DEPOSITS','SKOR_EVENTS','ATTENDANCE','VISIT_PHOTOS','TODAY_PLAN','WEEKLY_MEETINGS','_KCH_TX_REQUESTS','_KCH_TX_EDITS','_KCH_ARCHIVE_ROWS','_KCH_MONTHLY_ARCHIVES'].forEach(function(n){schemas[n]=[];});delete schemas[KCH_PRODUCTION_STATE_];return schemas;
}

function productionPreparedNotice_(ss,url) {
  var control=ss.getSheetByName(KCH_UPDATE_SHEET_);if(!control)return;
  control.getRange('B8').setValue('Production disiapkan — isi stok awal');control.getRange('B10').setValue(url);
  control.getRange('B11').setValue('Master dipertahankan. Data uji/arsip/receipt kosong; stok sementara 0. Isi STOK_AWAL_PRODUKSI dan PEGANGAN_AWAL_PRODUKSI jika ada, lalu jalankan terapkanStokAwalProduksi.');
}
function productionFailureNotice_(ss,err) {
  try{var control=ss.getSheetByName(KCH_UPDATE_SHEET_);if(control){control.getRange('B8').setValue('Persiapan Production belum selesai / perlu diperiksa');control.getRange('B11').setValue(err.message+(err.apiMessage?'\nRincian Google: '+err.apiMessage:'')+'\nJangan hapus penanda atau memaksa reset bila hasil belum pasti.');}}catch(statusError){}
}
