// Append-only operational corrections. Every stock/financial change uses the shared receipt lock/batch.
var KCH_OPERATION_CACHE_=null;
var KCH_OPERATIONS_='_KCH_OPERATIONS';
var KCH_OPERATION_HEADERS_=['operation_id','operation_date','kind','reference_id','sales_id','reason','lines_json','amount','actor_email','created_at'];
var KCH_DAMAGED_HEADERS_=['product_id','distributor_id','quantity','updated_at'];
var KCH_OPERATION_KINDS_=['STOCK_IN','STOCK_COUNT','RETURN_HELD','SALE_RETURN','INVOICE_VOID','PICKUP_CORRECT','DEPOSIT_CORRECT'];
function opsAdmin_(){if(getCurrentUserInfo_().role!=='ADMIN')throw new Error('ACCESS_DENIED: Operasi ini khusus Admin.');}
function opsSchemas_(){var s={};s[KCH_OPERATIONS_]=KCH_OPERATION_HEADERS_.slice();s.DAMAGED_STOCK=KCH_DAMAGED_HEADERS_.slice();return s;}
function opsEntries_(ctx,meta,raw){
  var memo=!ctx&&!raw;if(memo&&KCH_OPERATION_CACHE_)return KCH_OPERATION_CACHE_;
  ctx=ctx||{id:getKchSpreadsheet_().getId(),token:ScriptApp.getOAuthToken()};meta=meta||txMetadata_(ctx);
  if(!meta[KCH_OPERATIONS_])return [];
  var entries=txTable_(KCH_OPERATIONS_,raw&&raw[KCH_OPERATIONS_]||txRead_(ctx,[KCH_OPERATIONS_])[KCH_OPERATIONS_],KCH_OPERATION_HEADERS_,true).rows;if(memo)KCH_OPERATION_CACHE_=entries;return entries;
}
function opsRevision_(rows,entries,ref){return txHash_(JSON.stringify([rows.map(function(r){return r._cells||r;}),entries.filter(function(e){return e.reference_id===ref;}).map(function(e){return e.operation_id;})]));}
function opsRawHistory_(name,ctx,meta,raw){
  if(!meta[name])throw new Error('Sumber '+name+' tidak ditemukan.');
  var names=[name];if(archiveEnabled_()&&meta[KCH_ARCHIVE_ROWS_])names.push(KCH_ARCHIVE_ROWS_);
  var values=raw&&raw[name]?raw:txRead_(ctx,names);
  return txTable_(name,archiveMergeTable_(name,values[name],values[KCH_ARCHIVE_ROWS_]||[KCH_ARCHIVE_SCHEMAS_[KCH_ARCHIVE_ROWS_]]),[],false).rows;
}
function opsReference_(kind,id,ctx,meta,entries){
  if(typeof id!=='string'||!id.trim()||id.length>128)throw new Error('Pilih referensi yang valid.');
  id=id.trim();var name=kind==='PICKUP_CORRECT'?'STOCK_PICKUPS':kind==='DEPOSIT_CORRECT'?'SALES_CASH_DEPOSITS':'SALES_TRANSACTIONS';
  var field=name==='STOCK_PICKUPS'?'pickup_id':name==='SALES_CASH_DEPOSITS'?'deposit_id':'transaction_id';
  var rows=opsRawHistory_(name,ctx,meta).filter(function(r){return r[field]===id;});
  if(!rows.length)throw new Error('Referensi tidak ditemukan.');
  var revision=opsRevision_(rows,entries,id),first=rows[0],items=[];
  if(name==='SALES_CASH_DEPOSITS'){
    if(rows.length!==1)throw new Error('Setoran terdaftar ganda.');
    var amount=txMoney_(first.amount,'Setoran');entries.forEach(function(e){if(e.kind==='DEPOSIT_CORRECT'&&e.reference_id===id)amount=txMoney_(e.amount,'Koreksi setoran');});
    return {id:id,salesId:first.sales_id,salesName:first.sales_name,date:normalizeDateString_(first.deposit_date),amount:amount/100,revision:revision,items:[],sourceRows:rows};
  }
  var grouped=Object.create(null);
  rows.forEach(function(r){
    var type=name==='STOCK_PICKUPS'?'SALES':r.stock_source||'DIRECT',dist=String(r.stock_distributor_id||r.distributor_id||r.distributor||''),key=stockLineKey_(r.product_id,type,dist);
    var qty=stockQty_(r.quantity);if(!qty)throw new Error('Jumlah referensi tidak valid.');
    var cost=name==='SALES_TRANSACTIONS'?txMoney_(r.cost_price,'Modal faktur'):0,sell=name==='SALES_TRANSACTIONS'?txMoney_(r.selling_price,'Harga faktur'):0;
    if(name==='SALES_TRANSACTIONS'&&(sell<=0||txMoney_(r.subtotal_sales,'Subtotal faktur')!==sell*qty||txMoney_(r.subtotal_cost,'Subtotal modal')!==cost*qty))throw new Error('Nilai faktur tidak konsisten; periksa sumber.');
    if(!grouped[key])grouped[key]={key:key,productId:String(r.product_id),productName:String(r.product_name),sourceType:type,distributorId:dist,qty:0,remaining:0,costPrice:cost/100,sellingPrice:sell/100,teamName:first.team_name||'',salesName:first.sales_name||'',salesId:first.sales_id};
    var item=grouped[key];if(item.costPrice!==cost/100||item.sellingPrice!==sell/100)throw new Error('Baris produk sumber mempunyai harga berbeda.');item.qty+=qty;if(!Number.isSafeInteger(item.qty))throw new Error('Jumlah referensi terlalu besar.');
  });
  entries.forEach(function(e){if(e.reference_id!==id)return;
    if(['SALE_RETURN','INVOICE_VOID','PICKUP_CORRECT'].indexOf(e.kind)<0)return;
    JSON.parse(e.lines_json).forEach(function(line){var item=grouped[line.key];if(!item)throw new Error('Riwayat koreksi tidak cocok dengan sumber.');if(e.kind==='PICKUP_CORRECT')item.qty=line.targetQty;else item.remaining-=line.qty;});
  });
  Object.keys(grouped).forEach(function(key){var item=grouped[key];item.remaining+=item.qty;if(item.remaining<0)throw new Error('Retur melebihi jumlah faktur.');items.push(item);});
  return {id:id,salesId:first.sales_id,salesName:first.sales_name,date:normalizeDateString_(first.transaction_date||first.pickup_date),revision:revision,items:items,sourceRows:rows,voided:entries.some(function(e){return e.reference_id===id&&e.kind==='INVOICE_VOID';})};
}
function getOperationsReference_(kind,id){opsAdmin_();if(['SALE_RETURN','INVOICE_VOID','PICKUP_CORRECT','DEPOSIT_CORRECT'].indexOf(kind)<0)throw new Error('Jenis referensi tidak valid.');var ctx={id:getKchSpreadsheet_().getId(),token:ScriptApp.getOAuthToken()},meta=txMetadata_(ctx),r=opsReference_(kind,id,ctx,meta,opsEntries_(ctx,meta));delete r.sourceRows;return {success:true,reference:r};}
function opsFingerprint_(payload){return txHash_(JSON.stringify(['OPERATIONS',payload.kind,payload.referenceId||'',payload.expectedRevision||'',payload.salesId||'',payload.distributor||'',payload.sourceType||'',payload.date,payload.reason,payload.amount===undefined?'':String(payload.amount),(Array.isArray(payload.items)?payload.items.slice(0,101):[]).map(function(i){return [i.key||'',i.productId||'',i.sourceType||'',i.distributorId||'',String(i.qty===undefined?'':i.qty),String(i.targetQty===undefined?'':i.targetQty),i.condition||'GOOD'];})]));}
function saveOperationalChange_(payload){opsAdmin_();return txExecuteRequest_(payload,'OPERATIONS');}
function opsPlan_(ctx,meta,payload,user,id,requestId){
  opsAdmin_();var kind=payload.kind;if(KCH_OPERATION_KINDS_.indexOf(kind)<0)throw new Error('Jenis operasi tidak valid.');
  var date=stockDate_(payload.date),reason=typeof payload.reason==='string'?payload.reason.trim():'';if(reason.length<3||reason.length>1000)throw new Error('Isi alasan/keterangan 3–1.000 karakter.');
  var names=['SALES','PRODUCTS','DISTRIBUTORS','INVENTORY','SALES_STOCK','INVENTORY_MOVEMENTS','SALES_STOCK_MOVEMENTS','DAMAGED_STOCK',KCH_OPERATIONS_].filter(function(n){return !!meta[n];});
  var raw=txRead_(ctx,names),entries=opsEntries_(ctx,meta,raw),book=stockBook_(meta,raw),lines=[],amount=0,reference=null,salesId=String(payload.salesId||''),referenceId=String(payload.referenceId||'');
  if(['SALE_RETURN','INVOICE_VOID','PICKUP_CORRECT','DEPOSIT_CORRECT'].indexOf(kind)>=0){reference=opsReference_(kind,referenceId,ctx,meta,entries);if(payload.expectedRevision!==reference.revision)throw new Error('Referensi sudah berubah. Muat referensi kembali sebelum menyimpan.');if(reference.voided)throw new Error('Faktur sudah dibatalkan.');if(date<reference.date)throw new Error('Tanggal koreksi tidak boleh mendahului catatan asal.');salesId=reference.salesId;}
  var products=txTable_('PRODUCTS',raw.PRODUCTS,['product_id','product_name','status']).rows,distributors=book.distributors;
  var sales=salesId?txUnique_(txTable_('SALES',raw.SALES,['sales_id','full_name','status']).rows,function(s){return normalizeKey_(s.sales_id)===normalizeKey_(salesId);},'Sales'):null;
  if(kind==='RETURN_HELD'&&!sales)throw new Error('Pilih sales pengembali.');
  if(kind==='DEPOSIT_CORRECT')amount=txMoney_(payload.amount,'Nominal setoran baru')/100;
  else {
    var input=kind==='INVOICE_VOID'?reference.items.filter(function(i){return i.remaining>0;}).map(function(i){return {key:i.key,qty:i.remaining,condition:'GOOD'};}):payload.items;
    if(!Array.isArray(input)||!input.length||input.length>100)throw new Error('Isi 1–100 baris produk.');
    var used=Object.create(null);
    input.forEach(function(value){
      if(!value||typeof value!=='object')throw new Error('Baris produk tidak valid.');
      var ref=reference?reference.items.filter(function(i){return i.key===value.key;})[0]:null;if(reference&&!ref)throw new Error('Produk tidak cocok dengan referensi.');
      var productId=ref?ref.productId:String(value.productId||''),p=txUnique_(products,function(r){return normalizeKey_(r.product_id)===normalizeKey_(productId);},'Produk');
      if(kind==='STOCK_IN'&&!txActive_(p))throw new Error('Produk masuk harus aktif.');
      var dist=stockDistributor_(distributors,ref?ref.distributorId:value.distributorId||payload.distributor,kind==='STOCK_IN');
      var type=ref?ref.sourceType:kind==='RETURN_HELD'?'SALES':kind==='STOCK_IN'?'DIRECT':payload.sourceType||'DIRECT';
      if(['DIRECT','SALES'].indexOf(type)<0||type==='SALES'&&!sales)throw new Error('Pilih sumber stok dan sales yang sesuai.');
      var key=ref?ref.key:stockLineKey_(p.product_id,type,dist.distributor_id);if(used[key])throw new Error('Produk/sumber yang sama terdaftar ganda.');used[key]=true;
      var qty=stockQty_(value.qty===undefined?0:value.qty),target=stockQty_(value.targetQty===undefined?0:value.targetQty),condition=value.condition||'GOOD';if(['GOOD','DAMAGED'].indexOf(condition)<0)throw new Error('Kondisi barang tidak valid.');
      if(['STOCK_COUNT','PICKUP_CORRECT'].indexOf(kind)<0&&!qty)throw new Error('Jumlah minimal 1.');
      var line={key:key,productId:String(p.product_id),productName:String(p.product_name),sourceType:type,distributorId:String(dist.distributor_id),salesId:salesId,qty:qty,condition:condition};
      if(kind==='STOCK_IN')book.adjust('DIRECT','',p.product_id,dist,qty);
      else if(kind==='STOCK_COUNT'){var account=book.adjust(type,salesId,p.product_id,dist,0);line.before=account.after;line.targetQty=target;book.adjust(type,salesId,p.product_id,dist,target-account.after);}
      else if(kind==='RETURN_HELD'){book.adjust('SALES',salesId,p.product_id,dist,-qty);if(condition==='GOOD')book.adjust('DIRECT','',p.product_id,dist,qty);}
      else if(kind==='PICKUP_CORRECT'){line.before=ref.qty;line.targetQty=target;var delta=target-ref.qty;book.adjust('DIRECT','',p.product_id,dist,-delta);book.adjust('SALES',salesId,p.product_id,dist,delta,true);}
      else {if(qty>ref.remaining)throw new Error('Jumlah retur melebihi sisa faktur.');if(condition==='GOOD')book.adjust(type,salesId,p.product_id,dist,qty,true);line.costPrice=ref.costPrice;line.sellingPrice=ref.sellingPrice;line.teamName=ref.teamName;line.salesName=ref.salesName;amount-=txMoney_(ref.sellingPrice,'Harga faktur')*qty;}
      lines.push(line);
    });
  }
  if(['SALE_RETURN','INVOICE_VOID'].indexOf(kind)>=0){if(!Number.isSafeInteger(amount))throw new Error('Nilai retur terlalu besar.');amount/=100;}
  if(!Number.isSafeInteger(Math.round(amount*100)))throw new Error('Nilai operasi terlalu besar.');
  var stock=book.plan(meta,date,id,user),requests=stock.requests,stamp=Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH:mm:ss');
  var damaged=lines.filter(function(l){return l.condition==='DAMAGED'&&['RETURN_HELD','SALE_RETURN'].indexOf(kind)>=0;});
  if(damaged.length){
    if(!meta.DAMAGED_STOCK)txAddSheet_(meta,requests,'DAMAGED_STOCK',KCH_DAMAGED_HEADERS_,false);
    var existing=raw.DAMAGED_STOCK?txTable_('DAMAGED_STOCK',raw.DAMAGED_STOCK,KCH_DAMAGED_HEADERS_,true).rows:[],changes=Object.create(null);
    damaged.forEach(function(l){var key=stockLineKey_(l.productId,'DAMAGED',l.distributorId);if(!changes[key]){var matches=existing.filter(function(r){return normalizeKey_(r.product_id)===normalizeKey_(l.productId)&&normalizeKey_(r.distributor_id)===normalizeKey_(l.distributorId);});if(matches.length>1)throw new Error('Saldo barang rusak ganda.');changes[key]={row:matches[0],product:l.productId,dist:l.distributorId,qty:matches.length?stockQty_(matches[0].quantity):0};}changes[key].qty+=l.qty;if(!Number.isSafeInteger(changes[key].qty))throw new Error('Stok rusak terlalu besar.');});
    Object.keys(changes).forEach(function(k){var d=changes[k],row=[d.product,d.dist,d.qty,stamp];requests.push(d.row?txUpdate_(meta.DAMAGED_STOCK.sheetId,d.row._row,0,[row]):txAppend_(meta.DAMAGED_STOCK.sheetId,[row]));});
  }
  if(!meta[KCH_OPERATIONS_])txAddSheet_(meta,requests,KCH_OPERATIONS_,KCH_OPERATION_HEADERS_,true);
  if(!meta.ACTIVITY_LOGS)txAddSheet_(meta,requests,'ACTIVITY_LOGS',TABLE_SCHEMAS.ACTIVITY_LOGS,false);
  var encoded=JSON.stringify(lines);if(encoded.length>45000)throw new Error('Detail operasi terlalu panjang.');
  requests.push(txAppend_(meta[KCH_OPERATIONS_].sheetId,[[id,date,kind,referenceId,salesId,reason,encoded,amount,user.email,stamp]]));
  requests.push(txAppend_(meta.ACTIVITY_LOGS.sheetId,[['AUD-'+Utilities.getUuid(),stamp,user.email,kind,id,JSON.stringify({referenceId:referenceId,salesId:salesId,reason:reason,amount:amount})]]));
  return {requests:requests,result:{success:true,terminal:true,state:'COMMITTED',operation:'OPERATIONS',operationKind:kind,requestId:requestId,transactionId:id,totalSales:amount,message:'Operasi tersimpan beserta mutasi dan riwayatnya.',stockUpdates:stock.changes},plan:{operation:'OPERATIONS',kind:kind,referenceId:referenceId,stockUpdates:stock.changes}};
}
function opsAdjustmentRows_(entries){
  var rows=[];
  entries.forEach(function(e){if(['SALE_RETURN','INVOICE_VOID'].indexOf(e.kind)<0)return;
    JSON.parse(e.lines_json).forEach(function(l){var qty=stockQty_(l.qty);if(!qty)throw new Error('Riwayat retur tidak valid.');var cost=txMoney_(l.costPrice,'Modal retur'),sell=txMoney_(l.sellingPrice,'Harga retur');
      rows.push({transaction_id:e.operation_id,transaction_date:e.operation_date,sales_id:e.sales_id,sales_name:l.salesName,team_name:l.teamName,distributor:l.distributorId,product_id:l.productId,product_name:l.productName,quantity:-qty,cost_price:cost/100,selling_price:sell/100,shj:(sell-cost)/100,subtotal_sales:-sell*qty/100,subtotal_cost:-cost*qty/100,subtotal_shj:-(sell-cost)*qty/100,notes:e.kind+' · '+e.reference_id+' · '+e.reason,created_by:e.actor_email,created_at:e.created_at,stock_source:l.sourceType,stock_distributor_id:l.distributorId,_kch_adjustment:true,reference_id:e.reference_id});
    });
  });return rows;
}
function opsReportRows_(rows){var entries=opsEntries_(),refs={};entries.forEach(function(e){if(['SALE_RETURN','INVOICE_VOID'].indexOf(e.kind)>=0)refs[e.reference_id]=true;});var original=rows.map(function(r){if(!refs[r.transaction_id])return r;var copy={};Object.keys(r).forEach(function(k){copy[k]=r[k];});copy.hasCorrections=true;return copy;});return original.concat(filterAuthorizedRows_('SALES_TRANSACTIONS',opsAdjustmentRows_(entries)));}
function opsAugmentTable_(table,entries){
  var headers=(table[0]||[]).slice();if(headers.indexOf('_kch_adjustment')<0)headers.push('_kch_adjustment');
  var original=(table||[]).slice(1).map(function(r){return headers.map(function(h,i){return h==='_kch_adjustment'?false:r[i]===undefined?'':r[i];});});
  return [headers].concat(original,opsAdjustmentRows_(entries).map(function(r){return headers.map(function(h){return r[h]===undefined?'':r[h];});}));
}
function opsEffectiveRecordRows_(name,rows,entries){
  var emitted=Object.create(null);
  return rows.map(function(r){var row={};Object.keys(r).forEach(function(k){row[k]=r[k];});
    entries.forEach(function(e){if(name==='STOCK_PICKUPS'&&e.kind==='PICKUP_CORRECT'&&e.reference_id===r.pickup_id){JSON.parse(e.lines_json).forEach(function(l){if(normalizeKey_(l.productId)===normalizeKey_(r.product_id)&&normalizeKey_(l.distributorId)===normalizeKey_(r.distributor_id)){var key=e.operation_id+':'+l.key;row.quantity=emitted[key]?0:l.targetQty;emitted[key]=true;}});row.correction_id=e.operation_id;}
      if(name==='SALES_CASH_DEPOSITS'&&e.kind==='DEPOSIT_CORRECT'&&e.reference_id===r.deposit_id){row.amount=e.amount;row.correction_id=e.operation_id;}});return row;});
}
function opsAssertEditable_(id){if(opsEntries_().some(function(e){return e.reference_id===id&&['SALE_RETURN','INVOICE_VOID'].indexOf(e.kind)>=0;}))throw new Error('Faktur sudah memiliki retur/pembatalan. Gunakan riwayat operasi; edit faktur asal ditahan agar retur tidak terhitung dua kali.');}
function getOperationsSetup_(page,keyword){
  var user=getCurrentUserInfo_();if(['ADMIN','GUEST'].indexOf(user.role)<0)throw new Error('ACCESS_DENIED');
  page=Number(page||1);if(!Number.isSafeInteger(page)||page<1)throw new Error('Halaman tidak valid.');keyword=String(keyword||'').trim().toUpperCase();
  var ctx={id:getKchSpreadsheet_().getId(),token:ScriptApp.getOAuthToken()},meta=txMetadata_(ctx),entries=opsEntries_(ctx,meta),matching=entries.filter(function(e){return !keyword||[e.operation_id,e.reference_id,e.sales_id,e.kind].join(' ').toUpperCase().indexOf(keyword)>=0;}).reverse();
  var names=['SALES','PRODUCTS','DISTRIBUTORS','DAMAGED_STOCK'].filter(function(n){return !!meta[n];}),raw=txRead_(ctx,names),result={success:true,page:page,total:matching.length,history:matching.slice((page-1)*50,page*50).map(function(e){return {id:e.operation_id,date:e.operation_date,kind:e.kind,referenceId:e.reference_id,salesId:e.sales_id,reason:e.reason,amount:e.amount,lines:JSON.parse(e.lines_json)};}),damaged:raw.DAMAGED_STOCK?txTable_('DAMAGED_STOCK',raw.DAMAGED_STOCK,KCH_DAMAGED_HEADERS_,true).rows:[]};
  ['SALES','PRODUCTS','DISTRIBUTORS'].forEach(function(n){result[n.toLowerCase()]=raw[n]?txTable_(n,raw[n],[],false).rows:[];});
  if(user.role==='ADMIN'){
    result.references=[];['SALES_TRANSACTIONS','STOCK_PICKUPS','SALES_CASH_DEPOSITS'].forEach(function(n){if(!meta[n])return;var values=txRead_(ctx,[n])[n],rs=txTable_(n,values,[],false).rows,seen={};rs.slice().reverse().some(function(r){var id=r.transaction_id||r.pickup_id||r.deposit_id;if(!id||seen[id])return false;seen[id]=true;result.references.push({id:id,type:n,name:r.sales_name||'',date:normalizeDateString_(r.transaction_date||r.pickup_date||r.deposit_date)});return Object.keys(seen).length>=100;});});
  }
  return result;
}
// Signed report amounts are accepted only in server-generated adjustment rows.
function reportMoney_(value,label){var n=txNumber_(value,label),cents=Math.round(n*100);if(!Number.isSafeInteger(cents)||Math.abs(n*100-cents)>0.00001)throw new Error(label+' tidak valid.');return cents;}
