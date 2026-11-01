// Editable invoice snapshots and atomic revisions. All entry points are private RPCs.
var KCH_TX_EDIT_SHEET_ = '_KCH_TX_EDITS';
var KCH_TX_EDIT_HEADERS_ = ['edit_id', 'transaction_id', 'actor_email', 'actor_role', 'reason', 'before_json', 'after_json', 'stock_json', 'created_at'];

function txEditSnapshot_(ctx, meta, transactionId, user) {
  if (typeof transactionId !== 'string' || !transactionId.trim() || transactionId.length > 128) throw new Error('ID faktur tidak valid.');
  if (!meta.SALES_TRANSACTIONS) throw new Error('Faktur tidak ditemukan atau tidak dapat diakses.');
  var names = ['SALES_TRANSACTIONS'];
  if (meta[KCH_TX_EDIT_SHEET_]) names.push(KCH_TX_EDIT_SHEET_);
  var raw = txRead_(ctx, names);
  var table = txTable_('SALES_TRANSACTIONS', raw.SALES_TRANSACTIONS, TABLE_SCHEMAS.SALES_TRANSACTIONS, true);
  var rows = table.rows.filter(function(row) { return String(row.transaction_id).trim() === transactionId.trim(); });
  if (!rows.length || rows.some(function(row) { return user.role !== 'ADMIN' && normalizeKey_(row.sales_id) !== normalizeKey_(user.salesId); })) throw new Error('Faktur tidak ditemukan atau tidak dapat diakses.');
  if (rows.length > 100) throw new Error('Faktur lebih dari 100 baris perlu diperiksa admin sebelum diedit.');
  var first = rows[0], items = Object.create(null), prices = Object.create(null), totalSales = 0, totalCost = 0;
  rows.forEach(function(row) {
    ['sales_id', 'team_name', 'transaction_date', 'notes', 'created_by', 'created_at'].forEach(function(field) {
      if (String(row[field]) !== String(first[field])) throw new Error('Data faktur tidak konsisten. Hubungi admin untuk pemeriksaan.');
    });
    if (row._cells.slice(table.headers[18] === 'stock_source' && table.headers[19] === 'stock_distributor_id' ? 20 : 18).some(function(v) { return v !== '' && v !== null; })) throw new Error('Faktur memiliki kolom tambahan berisi data. Perlu diperiksa admin sebelum diedit.');
    var qty = txNumber_(row.quantity, 'Qty faktur');
    if (!Number.isSafeInteger(qty) || qty <= 0) throw new Error('Qty pada faktur lama tidak valid. Perlu diperiksa admin.');
    var cost = txMoney_(row.cost_price, 'Modal faktur'), sell = txMoney_(row.selling_price, 'Harga faktur');
    if (sell <= 0 || !Number.isSafeInteger(cost * qty) || !Number.isSafeInteger(sell * qty) || txMoney_(row.subtotal_sales, 'Subtotal jual') !== sell * qty || txMoney_(row.subtotal_cost, 'Subtotal modal') !== cost * qty) throw new Error('Nilai pada faktur lama tidak konsisten. Perlu diperiksa admin.');
    var shj = txNumber_(row.shj, 'SHJ faktur'), subShj = txNumber_(row.subtotal_shj, 'Subtotal SHJ');
    if (Math.abs(shj * 100 - (sell - cost)) > 0.00001 || Math.abs(subShj * 100 - (sell - cost) * qty) > 0.00001) throw new Error('SHJ faktur lama tidak konsisten. Perlu diperiksa admin.');
    var productKey = normalizeKey_(row.product_id), sourceType = row.stock_source || 'DIRECT';
    if (!productKey || ['DIRECT','SALES'].indexOf(sourceType) < 0) throw new Error('Produk atau sumber stok faktur tidak valid.');
    var distId = String(row.stock_distributor_id || '');
    var key = stockLineKey_(row.product_id,sourceType,distId || row.distributor);
    if (prices[productKey] && (prices[productKey].costPrice !== cost / 100 || prices[productKey].sellingPrice !== sell / 100)) throw new Error('Produk sama memakai harga berbeda pada faktur lama. Perlu diperiksa admin.');
    prices[productKey] = {costPrice:cost/100,sellingPrice:sell/100};
    if (!items[key]) items[key] = { productId: String(row.product_id), productName: String(row.product_name), qty: 0, costPrice: cost / 100, sellingPrice: sell / 100, sourceType:sourceType, distributorId:distId, distributor:String(row.distributor) };
    items[key].qty += qty;
    totalSales += sell * qty; totalCost += cost * qty;
    if (![items[key].qty, totalSales, totalCost].every(Number.isSafeInteger)) throw new Error('Nilai faktur terlalu besar.');
  });
  var edits = meta[KCH_TX_EDIT_SHEET_] ? txTable_(KCH_TX_EDIT_SHEET_, raw[KCH_TX_EDIT_SHEET_], KCH_TX_EDIT_HEADERS_, true).rows.filter(function(row) { return row.transaction_id === transactionId; }) : [];
  var original = rows.map(function(row) { return stockSchemas_().SALES_TRANSACTIONS.map(function(field) { return row[field] === undefined ? '' : row[field]; }); });
  var revision = txHash_(JSON.stringify([original, edits.map(function(row) { return row.edit_id; })]));
  return { rows: rows, original: original, revision: revision, header: { id: transactionId, salesId: String(first.sales_id), salesName: String(first.sales_name), teamName: String(first.team_name), distributor: String(first.distributor), date: normalizeDateString_(first.transaction_date).slice(0, 10), notes: String(first.notes || ''), createdBy: first.created_by, createdAt: first.created_at }, items: Object.keys(items).map(function(key) { return items[key]; }), prices: prices, totalSales: totalSales / 100, totalCost: totalCost / 100 };
}

function getSalesTransactionForEdit_(transactionId) {
  var user = getCurrentUserInfo_(), lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return { success: false, message: 'Ada penyimpanan berjalan. Coba buka edit sebentar lagi.' }; }
  try {
    var ctx = { id: getKchSpreadsheet_().getId(), token: ScriptApp.getOAuthToken() }, meta = txMetadata_(ctx);
    if (txHasPending_(txReceipts_(ctx, meta))) throw new Error('Ada kiriman yang hasilnya belum pasti. Periksa hasil sebelum mengedit.');
    var snap = txEditSnapshot_(ctx, meta, transactionId, user);
    return { success: true, header: snap.header, items: snap.items, revision: snap.revision, totalSales: snap.totalSales };
  } catch (err) { return { success: false, message: err.message }; }
  finally { lock.releaseLock(); }
}

function txEditPlan_(ctx, meta, payload, user, transactionId, requestId) {
  var snapshot = txEditSnapshot_(ctx, meta, transactionId, user);
  if (typeof archiveAssertOpenDate_ === 'function') archiveAssertOpenDate_(snapshot.header.date);
  if (typeof payload.expectedRevision !== 'string' || payload.expectedRevision !== snapshot.revision) throw new Error('Faktur sudah berubah sejak dibuka. Tutup edit lalu buka kembali dari riwayat.');
  var reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  if (reason.length < 3 || reason.length > 500) throw new Error('Isi alasan edit sepanjang 3 sampai 500 karakter.');
  if (normalizeKey_(payload.salesId) !== normalizeKey_(snapshot.header.salesId)) throw new Error('Pemilik faktur tidak boleh diganti melalui edit.');
  var names = ['SALES', 'PRODUCTS', 'PRICE_MASTER', 'DISTRIBUTORS', 'INVENTORY', 'SALES_STOCK', 'SALES_STOCK_MOVEMENTS', 'SALES_TRANSACTIONS', 'INVENTORY_MOVEMENTS', 'ACTIVITY_LOGS'].filter(function(name) { return !!meta[name]; });
  var raw = txRead_(ctx, names);
  var sales = txUnique_(txTable_('SALES', raw.SALES, ['sales_id', 'team_name', 'status']).rows, function(row) { return normalizeKey_(row.sales_id) === normalizeKey_(snapshot.header.salesId); }, 'Sales');
  if (txTeamKey_(sales.team_name) !== txTeamKey_(snapshot.header.teamName)) throw new Error('Tim sales sudah berubah. Faktur lama perlu diperiksa admin sebelum diedit.');
  var book = stockBook_(meta,raw);
  snapshot.items.forEach(function(item) {
    var dist = stockDistributor_(book.distributors,item.distributorId || item.distributor,false);
    book.adjust(item.sourceType,snapshot.header.salesId,item.productId,dist,item.qty,true);
  });
  var proposed = txPlan_(ctx, JSON.parse(JSON.stringify(meta)), payload, user, transactionId, requestId, { raw: raw, fixedPrices: snapshot.prices, book:book, skipStockPlan:true });
  proposed.rows.forEach(function(row) { row[16] = snapshot.header.createdBy; row[17] = snapshot.header.createdAt; });
  var timestamp = Utilities.formatDate(new Date(),TIMEZONE,DATE_FORMAT);
  var stockPlan = book.plan(meta,Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd'),transactionId,user);
  var requests = stockPlan.requests, changes = stockPlan.changes;
  stockFinancialSchema_(meta,raw,requests);
  snapshot.rows.forEach(function(row, i) { requests.push(txUpdate_(meta.SALES_TRANSACTIONS.sheetId, row._row, 0, [proposed.rows[i] || stockSchemas_().SALES_TRANSACTIONS.map(function() { return ''; })])); });
  if (proposed.rows.length > snapshot.rows.length) requests.push(txAppend_(meta.SALES_TRANSACTIONS.sheetId, proposed.rows.slice(snapshot.rows.length)));
  ['INVENTORY_MOVEMENTS', 'ACTIVITY_LOGS'].forEach(function(name) { if (!meta[name]) txAddSheet_(meta, requests, name, TABLE_SCHEMAS[name], false); });
  if (!meta[KCH_TX_EDIT_SHEET_]) txAddSheet_(meta, requests, KCH_TX_EDIT_SHEET_, KCH_TX_EDIT_HEADERS_, true);
  var beforeJson = JSON.stringify(snapshot.original), afterJson = JSON.stringify(proposed.rows), stockJson = JSON.stringify(changes);
  if ([beforeJson, afterJson, stockJson].some(function(value) { return value.length > 45000; })) throw new Error('Faktur terlalu panjang untuk riwayat edit. Hubungi admin.');
  var editId = 'EDIT-' + Utilities.getUuid();
  requests.push(txAppend_(meta[KCH_TX_EDIT_SHEET_].sheetId, [[editId, transactionId, user.email, user.role, reason, beforeJson, afterJson, stockJson, timestamp]]));
  requests.push(txAppend_(meta.ACTIVITY_LOGS.sheetId, [['AUD-' + Utilities.getUuid(), timestamp, user.email, 'EDIT_TRANSACTION', transactionId, JSON.stringify({ editId: editId, salesId: snapshot.header.salesId, reason: reason, actorRole: user.role, assisted: user.role === 'ADMIN', oldTotalSales: snapshot.totalSales, totalSales: proposed.result.totalSales })]]));
  var result = proposed.result;
  result.operation = 'EDIT'; result.editId = editId; result.stockUpdates = changes;
  result.message = 'Perubahan faktur tersimpan. Stok disesuaikan dan riwayat edit dicatat.';
  var plan = { operation: 'EDIT', editId: editId, transactionId: transactionId, stockUpdates: changes };
  if (JSON.stringify(result).length > 45000 || JSON.stringify(plan).length > 45000) throw new Error('Detail stok edit terlalu panjang. Hubungi admin.');
  return { requests: requests, result: result, plan: plan };
}

function editSalesTransaction_(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Payload edit tidak valid.');
  return txExecuteRequest_(payload, true);
}
