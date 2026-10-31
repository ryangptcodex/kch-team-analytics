// Two-account stock ledger. Transfers and sales share the atomic transaction receipt.
var KCH_STOCK_SCHEMAS_ = {
  SALES_CASH_DEPOSITS: ['deposit_id','deposit_date','sales_id','sales_name','distributor_id','distributor_name','amount','notes','photo_file_id','photo_url','created_by','created_at'],
  SALES_STOCK: ['sales_id','product_id','distributor_id','quantity','updated_at'],
  SALES_STOCK_MOVEMENTS: ['date','sales_id','product_id','distributor_id','movement_type','quantity','stock_before','stock_after','reference_id','created_by','created_at'],
  STOCK_PICKUPS: ['pickup_id','pickup_date','sales_id','sales_name','distributor_id','distributor_name','product_id','product_name','quantity','photo_file_id','photo_url','created_by','created_at']
};
function stockSchemas_() {
  var schemas = {};
  Object.keys(KCH_STOCK_SCHEMAS_).forEach(function(name) { schemas[name] = KCH_STOCK_SCHEMAS_[name].slice(); });
  schemas.SALES_TRANSACTIONS = TABLE_SCHEMAS.SALES_TRANSACTIONS.concat(['stock_source','stock_distributor_id']);
  return schemas;
}
function stockQty_(value) {
  var qty = txNumber_(value, 'Jumlah stok');
  if (!Number.isSafeInteger(qty) || qty < 0) throw new Error('Stok harus bilangan bulat nonnegatif.');
  return qty;
}
function stockDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || normalizeDateString_(value).slice(0,10) !== value) throw new Error('Tanggal tidak valid.');
  var parts = value.split('-').map(Number);
  if (parts[2] < 1 || parts[2] > new Date(Date.UTC(parts[0],parts[1],0)).getUTCDate() || parts[1] < 1 || parts[1] > 12 || value > Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd')) throw new Error('Tanggal tidak valid atau di masa depan.');
  return value;
}
function stockDistributorKey_(name) {
  var key = txDistributorKey_(name).replace(/[^A-Z0-9]/g,'');
  if (['GMP','GLOBALPRIMA','GLOBALPRIMAGMP','PTGLOBALPRIMA','GLOBALMITRAPRIMA','PTGLOBALMITRAPRIMA'].indexOf(key) >= 0) return 'GMP';
  if (['GEUBRINARIZKY','GEUBRINARIZKI','APGEUBRINARIZKI','APGEUBRINARIZKY'].indexOf(key) >= 0) return 'GEUBRINA';
  return key;
}
function stockDistributor_(rows, value, active) {
  var key = normalizeKey_(value);
  var dist = txUnique_(rows,function(row) { return normalizeKey_(row.distributor_id) === key || stockDistributorKey_(row.distributor_name) === stockDistributorKey_(value); },'Distributor');
  if (!String(dist.distributor_id).trim()) throw new Error('Kode distributor kosong.');
  if (active && !txActive_(dist)) throw new Error('Distributor tidak aktif.');
  return dist;
}
function stockSource_(item, fallback, rows, active) {
  var type = item.sourceType || item.stock_source || 'DIRECT';
  if (['DIRECT','SALES'].indexOf(type) < 0) throw new Error('Sumber stok harus distributor atau pegangan sales.');
  var dist = stockDistributor_(rows,item.distributorId || item.stock_distributor_id || fallback,active);
  return {type:type,dist:dist};
}
function stockLineKey_(id,source,dist) { return JSON.stringify([normalizeKey_(id),source,normalizeKey_(dist)]); }
function stockFinancialSchema_(meta,raw,requests) {
  if (!meta.SALES_TRANSACTIONS) return;
  var h = (raw.SALES_TRANSACTIONS && raw.SALES_TRANSACTIONS[0] || []);
  if (h[18] === 'stock_source' && h[19] === 'stock_distributor_id') return;
  if (h.indexOf('stock_source') >= 0 || h.indexOf('stock_distributor_id') >= 0) throw new Error('Header sumber stok belum sesuai. Jalankan Perbarui Seluruh Sheet.');
  requests.push({insertDimension:{range:{sheetId:meta.SALES_TRANSACTIONS.sheetId,dimension:'COLUMNS',startIndex:18,endIndex:20},inheritFromBefore:true}});
  requests.push(txUpdate_(meta.SALES_TRANSACTIONS.sheetId,0,18,[['stock_source','stock_distributor_id']]));
}
function stockBook_(meta,raw) {
  var inv = txTable_('INVENTORY',raw.INVENTORY,['product_id']);
  var distributors = txTable_('DISTRIBUTORS',raw.DISTRIBUTORS,['distributor_id','distributor_name','status']).rows;
  var held = meta.SALES_STOCK ? txTable_('SALES_STOCK',raw.SALES_STOCK,KCH_STOCK_SCHEMAS_.SALES_STOCK,true).rows : [];
  ['INVENTORY_MOVEMENTS','SALES_STOCK_MOVEMENTS'].forEach(function(name) { if (meta[name] && raw[name]) txTable_(name,raw[name],TABLE_SCHEMAS[name] || KCH_STOCK_SCHEMAS_[name],true); });
  var accounts = Object.create(null), totals = Object.create(null);
  var columns = inv.headers.filter(function(h) { return distributors.some(function(d) { return stockDistributorKey_(d.distributor_name) === stockDistributorKey_(h); }); });
  function account(type,salesId,productId,dist) {
    var key = stockLineKey_(productId,type,dist.distributor_id) + ':' + (type === 'SALES' ? normalizeKey_(salesId) : '');
    if (accounts[key]) return accounts[key];
    var a = {sourceType:type,salesId:type === 'SALES' ? String(salesId) : '',productId:String(productId),distributorId:String(dist.distributor_id),stockColumn:'',before:0,after:0,exists:false};
    if (type === 'DIRECT') {
      var row = txUnique_(inv.rows,function(r) { return normalizeKey_(r.product_id) === normalizeKey_(productId); },'Stok produk ' + productId);
      var matching = columns.filter(function(h) { return stockDistributorKey_(h) === stockDistributorKey_(dist.distributor_name); });
      if (matching.length !== 1) throw new Error('Kolom stok distributor tidak ditemukan atau terdaftar ganda.');
      a.stockColumn = matching[0]; a.row = row._row; a.column = inv.index[a.stockColumn]; a.before = stockQty_(row[a.stockColumn]); a.exists = true;
      if (totals[normalizeKey_(productId)] === undefined) {
        var sum = columns.reduce(function(n,c) { return n + stockQty_(row[c]); },0);
        if (!Number.isSafeInteger(sum)) throw new Error('Total stok terlalu besar.');
        totals[normalizeKey_(productId)] = sum;
      }
    } else {
      var matches = held.filter(function(r) { return normalizeKey_(r.sales_id) === normalizeKey_(salesId) && normalizeKey_(r.product_id) === normalizeKey_(productId) && normalizeKey_(r.distributor_id) === normalizeKey_(dist.distributor_id); });
      if (matches.length > 1) throw new Error('Saldo pegangan sales terdaftar ganda.');
      if (matches.length) { a.before = stockQty_(matches[0].quantity); a.row = matches[0]._row; a.exists = true; }
    }
    a.after = a.before; accounts[key] = a; return a;
  }
  return {accounts:accounts,distributors:distributors,adjust:function(type,salesId,productId,dist,delta,restoring) {
    var a = account(type,salesId,productId,dist);
    if (restoring && type === 'SALES' && !a.exists) throw new Error('Saldo pegangan asal faktur hilang. Periksa admin.');
    var after = a.after + delta;
    if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(after) || after < 0) throw new Error((type === 'SALES' ? 'Stok pegangan sales' : 'Stok distributor') + ' tidak mencukupi untuk ' + productId + '. Sisa: ' + a.after + ', diminta: ' + (-delta) + '.');
    a.after = after; return a;
  },plan:function(ctxMeta,date,id,user) {
    var requests = [], movements = [], heldMoves = [], changes = [];
    var stamp = Utilities.formatDate(new Date(),TIMEZONE,DATE_FORMAT);
    Object.keys(accounts).sort().forEach(function(key) {
      var a = accounts[key], delta = a.after - a.before;
      if (!delta) return;
      changes.push({sourceType:a.sourceType,salesId:a.salesId,productId:a.productId,distributorId:a.distributorId,stockColumn:a.stockColumn,before:a.before,after:a.after});
      if (a.sourceType === 'DIRECT') {
        requests.push(txUpdate_(ctxMeta.INVENTORY.sheetId,a.row,a.column,[[a.after]]));
        var p = normalizeKey_(a.productId), before = totals[p], after = before + delta;
        if (!Number.isSafeInteger(after) || after < 0) throw new Error('Total stok hasil tidak valid.');
        movements.push([date,a.productId,delta > 0 ? 'IN' : 'OUT',Math.abs(delta),before,after,id,user.email,stamp]); totals[p] = after;
      } else {
        if (!ctxMeta.SALES_STOCK) txAddSheet_(ctxMeta,requests,'SALES_STOCK',KCH_STOCK_SCHEMAS_.SALES_STOCK,false);
        if (a.exists) requests.push(txUpdate_(ctxMeta.SALES_STOCK.sheetId,a.row,0,[[a.salesId,a.productId,a.distributorId,a.after,stamp]]));
        else requests.push(txAppend_(ctxMeta.SALES_STOCK.sheetId,[[a.salesId,a.productId,a.distributorId,a.after,stamp]]));
        heldMoves.push([date,a.salesId,a.productId,a.distributorId,delta > 0 ? 'IN' : 'OUT',Math.abs(delta),a.before,a.after,id,user.email,stamp]);
      }
    });
    if (movements.length) {
      if (!ctxMeta.INVENTORY_MOVEMENTS) txAddSheet_(ctxMeta,requests,'INVENTORY_MOVEMENTS',TABLE_SCHEMAS.INVENTORY_MOVEMENTS,false);
      requests.push(txAppend_(ctxMeta.INVENTORY_MOVEMENTS.sheetId,movements));
    }
    if (heldMoves.length) {
      if (!ctxMeta.SALES_STOCK_MOVEMENTS) txAddSheet_(ctxMeta,requests,'SALES_STOCK_MOVEMENTS',KCH_STOCK_SCHEMAS_.SALES_STOCK_MOVEMENTS,false);
      requests.push(txAppend_(ctxMeta.SALES_STOCK_MOVEMENTS.sheetId,heldMoves));
    }
    return {requests:requests,changes:changes};
  }};
}
function stockPickupPlan_(ctx,meta,payload,user,id,requestId) {
  if (user.role !== 'ADMIN') throw new Error('ACCESS_DENIED: Hanya admin yang boleh menginput pengambilan.');
  var date = stockDate_(payload.date);
  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 100) throw new Error('Pilih 1 sampai 100 produk.');
  var names = ['SALES','PRODUCTS','DISTRIBUTORS','INVENTORY','SALES_STOCK','STOCK_PICKUPS','SALES_STOCK_MOVEMENTS','INVENTORY_MOVEMENTS','ACTIVITY_LOGS'].filter(function(n) { return !!meta[n]; });
  var raw = txRead_(ctx,names), book = stockBook_(meta,raw);
  var sales = txUnique_(txTable_('SALES',raw.SALES,['sales_id','full_name','status']).rows,function(r) { return normalizeKey_(r.sales_id) === normalizeKey_(payload.salesId); },'Sales');
  if (!txActive_(sales)) throw new Error('Sales penerima tidak aktif.');
  var dist = stockDistributor_(book.distributors,payload.distributor,true);
  if (['GMP','GEUBRINA'].indexOf(stockDistributorKey_(dist.distributor_name)) < 0) throw new Error('Pilih GMP (Subdist) atau Geubrina Rizky (Panel).');
  var products = txTable_('PRODUCTS',raw.PRODUCTS,['product_id','product_name','status']).rows, grouped = Object.create(null);
  payload.items.forEach(function(item) {
    if (!item || typeof item.productId !== 'string' || !item.productId.trim()) throw new Error('Produk pengambilan tidak valid.');
    var key = normalizeKey_(item.productId), qty = stockQty_(item.qty);
    if (!qty) throw new Error('Jumlah pengambilan minimal 1.');
    grouped[key] = (grouped[key] || 0) + qty;
    if (!Number.isSafeInteger(grouped[key])) throw new Error('Jumlah terlalu besar.');
  });
  var stamp = Utilities.formatDate(new Date(),TIMEZONE,DATE_FORMAT), rows = [];
  Object.keys(grouped).sort().forEach(function(key) {
    var p = txUnique_(products,function(r) { return normalizeKey_(r.product_id) === key; },'Produk');
    if (!txActive_(p)) throw new Error('Produk tidak aktif.');
    book.adjust('DIRECT','',p.product_id,dist,-grouped[key]); book.adjust('SALES',sales.sales_id,p.product_id,dist,grouped[key]);
    rows.push([id,date,sales.sales_id,sales.full_name,dist.distributor_id,dist.distributor_name,p.product_id,p.product_name,grouped[key],'','',user.email,stamp]);
  });
  var plan = book.plan(meta,date,id,user), requests = plan.requests;
  ['STOCK_PICKUPS','ACTIVITY_LOGS'].forEach(function(name) { if (!meta[name]) txAddSheet_(meta,requests,name,KCH_STOCK_SCHEMAS_[name] || TABLE_SCHEMAS[name],false); else if(raw[name]) txTable_(name,raw[name],KCH_STOCK_SCHEMAS_[name] || TABLE_SCHEMAS[name],true); });
  var photo = stockPickupPhoto_(payload.photo,id);
  rows.forEach(function(row) { row[9] = photo.fileId; row[10] = photo.url; });
  requests.push(txAppend_(meta.STOCK_PICKUPS.sheetId,rows));
  requests.push(txAppend_(meta.ACTIVITY_LOGS.sheetId,[['AUD-'+Utilities.getUuid(),stamp,user.email,'CREATE_PICKUP',id,JSON.stringify({salesId:sales.sales_id,distributorId:dist.distributor_id,itemCount:rows.length})]]));
  return {requests:requests,cleanupFileId:photo.fileId,result:{success:true,terminal:true,state:'COMMITTED',operation:'PICKUP',requestId:requestId,transactionId:id,pickupId:id,message:'Pengambilan tersimpan. Stok distributor dipindahkan ke pegangan sales.',stockUpdates:plan.changes},plan:{operation:'PICKUP',stockUpdates:plan.changes,photoFileId:photo.fileId}};
}
function stockPickupPhoto_(data,id) {
  if (!data) return {fileId:'',url:''};
  if (typeof data !== 'string' || data.length > 3000000) throw new Error('Foto maksimal 2 MB.');
  var match = data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Foto harus JPEG, PNG atau WebP.');
  var bytes = Utilities.base64Decode(match[2]);
  if (!bytes.length || bytes.length > 2097152) throw new Error('Foto maksimal 2 MB.');
  // Private Drive file; the read-only proof endpoint checks the pickup record.
  var file = DriveApp.createFile(Utilities.newBlob(bytes,match[1],'Bukti-'+id+'.'+(match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1])));
  return {fileId:file.getId(),url:file.getUrl()};
}
function saveStockPickup_(payload) { if (getCurrentUserInfo_().role !== 'ADMIN') throw new Error('ACCESS_DENIED: Hanya admin.'); return txExecuteRequest_(payload,'PICKUP'); }
function getStockPickupData_() {
  var user = getCurrentUserInfo_();
  if (['ADMIN','GUEST'].indexOf(user.role) < 0) throw new Error('ACCESS_DENIED');
  var ctx = {id:getKchSpreadsheet_().getId(),token:ScriptApp.getOAuthToken()}, meta = txMetadata_(ctx);
  var names = ['SALES','PRODUCTS','DISTRIBUTORS','SALES_STOCK','STOCK_PICKUPS','SALES_CASH_DEPOSITS'].filter(function(n) { return !!meta[n]; });
  var raw = txRead_(ctx,names), tables = {};
  names.forEach(function(n) { tables[n] = txTable_(n,raw[n],KCH_STOCK_SCHEMAS_[n] || ['status'],false).rows; });
  return {success:true,sales:tables.SALES || [],products:tables.PRODUCTS || [],distributors:tables.DISTRIBUTORS || [],holdings:(tables.SALES_STOCK || []).map(function(row) { row.quantity = stockQty_(row.quantity); return row; }),pickups:(tables.STOCK_PICKUPS || []).slice(-500).reverse(),cashDeposits:(tables.SALES_CASH_DEPOSITS || []).slice(-500).reverse()};
}
function getStockPickupEvidence_(id) {
  var data = getStockPickupData_();
  var row = data.pickups.filter(function(r) { return r.pickup_id === id; })[0];
  if (!row || !row.photo_file_id) throw new Error('Bukti foto tidak ditemukan.');
  return stockEvidenceData_(row);
}
function stockEvidenceData_(row) {
  if (!row || !row.photo_file_id) throw new Error('Bukti foto tidak ditemukan.');
  var blob = DriveApp.getFileById(row.photo_file_id).getBlob(), bytes = blob.getBytes();
  if (!/^image\/(jpeg|png|webp)$/.test(blob.getContentType())) throw new Error('Format bukti foto tidak valid.');
  if (bytes.length > 2097152) throw new Error('Foto melebihi batas.');
  return {success:true,dataUrl:'data:'+blob.getContentType()+';base64,'+Utilities.base64Encode(bytes)};
}

// Memo only: deposits do not settle invoices, change inventory or count as sales.
function stockCashDepositPlan_(ctx,meta,payload,user,id,requestId) {
  if (user.role !== 'ADMIN') throw new Error('ACCESS_DENIED: Hanya admin yang boleh mencatat setoran.');
  var date = stockDate_(payload.date), amount = txMoney_(payload.amount,'Nominal setoran');
  if (amount <= 0) throw new Error('Nominal setoran harus lebih dari nol.');
  if (payload.notes !== undefined && typeof payload.notes !== 'string') throw new Error('Catatan setoran tidak valid.');
  var notes = String(payload.notes || '').trim();
  if (notes.length > 1000) throw new Error('Catatan setoran maksimal 1.000 karakter.');
  var names = ['SALES','DISTRIBUTORS','SALES_CASH_DEPOSITS','ACTIVITY_LOGS'].filter(function(name) { return !!meta[name]; });
  var raw = txRead_(ctx,names);
  var sales = txUnique_(txTable_('SALES',raw.SALES,['sales_id','full_name','status']).rows,function(row) { return normalizeKey_(row.sales_id) === normalizeKey_(payload.salesId); },'Sales penyetor');
  if (!txActive_(sales)) throw new Error('Sales penyetor tidak aktif.');
  var distributors = txTable_('DISTRIBUTORS',raw.DISTRIBUTORS,['distributor_id','distributor_name','status']).rows;
  var dist = stockDistributor_(distributors,payload.distributor,true);
  if (['GMP','GEUBRINA'].indexOf(stockDistributorKey_(dist.distributor_name)) < 0) throw new Error('Pilih GMP atau Geubrina.');
  var requests = [];
  ['SALES_CASH_DEPOSITS','ACTIVITY_LOGS'].forEach(function(name) {
    var headers = KCH_STOCK_SCHEMAS_[name] || TABLE_SCHEMAS[name];
    if (meta[name]) txTable_(name,raw[name],headers,true);
    else txAddSheet_(meta,requests,name,headers,false);
  });
  var stamp = Utilities.formatDate(new Date(),TIMEZONE,DATE_FORMAT), photo = stockPickupPhoto_(payload.photo,id);
  requests.push(txAppend_(meta.SALES_CASH_DEPOSITS.sheetId,[[id,date,sales.sales_id,sales.full_name,dist.distributor_id,dist.distributor_name,amount/100,notes,photo.fileId,photo.url,user.email,stamp]]));
  requests.push(txAppend_(meta.ACTIVITY_LOGS.sheetId,[['AUD-'+Utilities.getUuid(),stamp,user.email,'CREATE_CASH_DEPOSIT',id,JSON.stringify({salesId:sales.sales_id,distributorId:dist.distributor_id,amount:amount/100,memoOnly:true})]]));
  return {requests:requests,cleanupFileId:photo.fileId,result:{success:true,terminal:true,state:'COMMITTED',operation:'DEPOSIT',requestId:requestId,transactionId:id,depositId:id,amount:amount/100,message:'Catatan setoran tersimpan.',stockUpdates:[]},plan:{operation:'DEPOSIT',memoOnly:true,photoFileId:photo.fileId}};
}
function saveSalesCashDeposit_(payload) {
  if (getCurrentUserInfo_().role !== 'ADMIN') throw new Error('ACCESS_DENIED: Hanya admin yang boleh mencatat setoran.');
  return txExecuteRequest_(payload,'DEPOSIT');
}
function getSalesCashDepositEvidence_(id) {
  var data = getStockPickupData_();
  return stockEvidenceData_(data.cashDeposits.filter(function(row) { return row.deposit_id === id; })[0]);
}
