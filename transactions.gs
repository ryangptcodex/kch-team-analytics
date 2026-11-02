// Transaction writes use the Sheets API so financial rows and balances commit
// together. Never log OAuth tokens or request payloads.
var KCH_TX_REQUEST_SHEET_ = '_KCH_TX_REQUESTS';
var KCH_TX_REQUEST_HEADERS_ = ['request_key', 'request_id', 'actor_uid', 'actor_email', 'fingerprint', 'attempt_id', 'transaction_id', 'state', 'result_json', 'plan_json', 'created_at', 'updated_at'];

function txFailure_(code, message, state) {
  return { success: false, code: code, message: message, state: state || 'UNAVAILABLE', terminal: false };
}

function txApi_(ctx, suffix, method, body) {
  var response;
  try {
    var options = { method: method || 'get', headers: { Authorization: 'Bearer ' + ctx.token }, muteHttpExceptions: true };
    if (body) { options.contentType = 'application/json'; options.payload = JSON.stringify(body); }
    response = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(ctx.id) + suffix, options);
  } catch (err) {
    var transport = new Error('Layanan spreadsheet belum memberikan kepastian hasil.');
    transport.transport = true;
    throw transport;
  }
  var status = response.getResponseCode();
  var data;
  try { data = JSON.parse(response.getContentText()); } catch (err) { data = {}; }
  if (status < 200 || status >= 300) {
    var failure = new Error(status === 403 ? 'Google Sheets API atau izin spreadsheet belum aktif. Jalankan pemeriksaan transaksi dari editor.' : 'Layanan spreadsheet menolak permintaan (HTTP ' + status + ').');
    failure.httpStatus = status;
    failure.apiStatus = data.error && data.error.status || '';
    // Keep a short provider diagnostic for the native admin archive status only;
    // do not log HTTP bodies, request payloads or authorization headers.
    failure.apiMessage = String(data.error && data.error.message || '').slice(0,600);
    throw failure;
  }
  return data;
}

function txBatch_(ctx, requests) {
  var data = txApi_(ctx, ':batchUpdate', 'post', { requests: requests, includeSpreadsheetInResponse: false });
  if (data.spreadsheetId !== ctx.id) throw new Error('Konfirmasi spreadsheet belum valid. Periksa hasil kiriman.');
  return data;
}

function txMetadata_(ctx) {
  var data = txApi_(ctx, '?fields=spreadsheetId,sheets(properties(sheetId,title,gridProperties))');
  if (data.spreadsheetId !== ctx.id) throw new Error('Identitas spreadsheet belum dapat diperiksa.');
  var sheets = Object.create(null);
  (data.sheets || []).forEach(function(sheet) { sheets[sheet.properties.title] = sheet.properties; });
  return sheets;
}

function txRead_(ctx, names) {
  if (!names.length) return Object.create(null);
  var ranges = names.map(function(name) { return 'ranges=' + encodeURIComponent("'" + name.replace(/'/g, "''") + "'"); }).join('&');
  var data = txApi_(ctx, '/values:batchGet?' + ranges + '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING');
  if (data.spreadsheetId !== ctx.id || !data.valueRanges || data.valueRanges.length !== names.length) throw new Error('Pembacaan spreadsheet belum lengkap.');
  var tables = Object.create(null);
  names.forEach(function(name, i) { tables[name] = data.valueRanges && data.valueRanges[i] && data.valueRanges[i].values || []; });
  return tables;
}

function txTable_(name, values, required, prefix) {
  var headers = (values[0] || []).map(function(value) { return String(value).trim(); });
  var index = Object.create(null);
  headers.forEach(function(header, i) {
    if (!header) return;
    if (Object.prototype.hasOwnProperty.call(index, header)) throw new Error('Header ganda pada sheet ' + name + '.');
    index[header] = i;
  });
  required.forEach(function(header, i) {
    if (!Object.prototype.hasOwnProperty.call(index, header) || (prefix && headers[i] !== header)) {
      throw new Error('Header ' + name + ' belum sesuai: ' + header + '. Data transaksi belum diubah.');
    }
  });
  return { name: name, headers: headers, index: index, rows: values.slice(1).map(function(cells, i) {
    var row = { _row: i + 1, _cells: cells };
    headers.forEach(function(header, column) { if (header) row[header] = cells[column] === undefined ? '' : cells[column]; });
    return row;
  }).filter(function(row) { return row._cells.some(function(value) { return value !== '' && value !== null; }); }) };
}

function txReceipts_(ctx, meta) {
  if (!meta[KCH_TX_REQUEST_SHEET_]) return [];
  var values = txRead_(ctx, [KCH_TX_REQUEST_SHEET_])[KCH_TX_REQUEST_SHEET_];
  return txTable_(KCH_TX_REQUEST_SHEET_, values, KCH_TX_REQUEST_HEADERS_, true).rows;
}

function txHash_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8).map(function(byte) {
    return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function txRequestId_(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,96}$/.test(value)) throw new Error('Kode kiriman tidak valid. Perbarui halaman aplikasi sebelum menyimpan.');
  return value;
}

function txFingerprint_(payload) {
  var items = Array.isArray(payload.items) ? payload.items.slice(0, 101).map(function(item) {
    item = item || {};
    var base = [normalizeKey_(item.productId), String(item.qty === undefined ? '' : item.qty).trim()];
    if (item.sourceType || item.distributorId) base.push(item.sourceType || 'DIRECT', normalizeKey_(item.distributorId));
    return base;
  }).sort(function(a, b) { return JSON.stringify(a).localeCompare(JSON.stringify(b)); }) : [];
  return txHash_(JSON.stringify([normalizeKey_(payload.salesId), String(payload.date || '').trim(), normalizeKey_(payload.distributor),
    typeof payload.notes === 'string' ? payload.notes.slice(0, 2001).trim() : '', items]));
}

function txCommitted_(rows, key) {
  var committed = rows.filter(function(row) { return row.request_key === key && row.state === 'COMMITTED'; });
  if (!committed.length) return null;
  if (committed.some(function(row) { return row.transaction_id !== committed[0].transaction_id; })) throw new Error('Riwayat kode kiriman perlu diperiksa admin.');
  return committed[0];
}

function txHasPending_(rows) {
  var committed = Object.create(null);
  rows.forEach(function(row) { if (row.state === 'COMMITTED') committed[row.request_key] = true; });
  return rows.some(function(row) { return row.state === 'PENDING' && !committed[row.request_key]; });
}

function txReceiptResult_(row, replayed) {
  var result = JSON.parse(row.result_json);
  if (!result || result.success !== true || result.transactionId !== row.transaction_id) throw new Error('Hasil kiriman perlu diperiksa admin.');
  result.replayed = !!replayed;
  result.terminal = true;
  result.state = 'COMMITTED';
  if (replayed) result.message = result.operation === 'PHOTO' ? 'Foto ini sudah tersimpan. Data tidak ditambahkan ulang.' : 'Kiriman ini sudah tersimpan. Saldo stok tidak diubah lagi.';
  return result;
}

function txCell_(value) {
  // stringValue is literal: notes beginning with '=' never become formulas.
  return { userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: String(value === undefined || value === null ? '' : value) } };
}

function txRows_(rows) { return rows.map(function(row) { return { values: row.map(txCell_) }; }); }
function txUpdate_(sheetId, row, column, rows) { return { updateCells: { start: { sheetId: sheetId, rowIndex: row, columnIndex: column }, rows: txRows_(rows), fields: 'userEnteredValue' } }; }
function txAppend_(sheetId, rows) { return { appendCells: { sheetId: sheetId, rows: txRows_(rows), fields: 'userEnteredValue' } }; }

function txSheetId_(meta) {
  var used = Object.keys(meta).map(function(name) { return meta[name].sheetId; });
  var id = 1;
  while (used.indexOf(id) >= 0) id++;
  return id;
}

function txAddSheet_(meta, requests, name, headers, hidden) {
  var id = txSheetId_(meta);
  meta[name] = { title: name, sheetId: id, gridProperties: { rowCount: 1000, columnCount: Math.max(headers.length, 20) } };
  requests.push({ addSheet: { properties: { title: name, sheetId: id, hidden: !!hidden, gridProperties: meta[name].gridProperties } } });
  requests.push(txUpdate_(id, 0, 0, [headers]));
  return meta[name];
}

function txNumber_(value, label) {
  if (typeof value !== 'number') {
    var text = String(value === undefined || value === null ? '' : value).trim().replace(/^Rp\s*/i, '').replace(/\s/g, '');
    if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d+(?:[.,]\d{1,2})?$/.test(text)) text = text.replace(',', '.');
    else throw new Error(label + ' bukan angka yang valid.');
    value = Number(text);
  }
  if (!Number.isFinite(value)) throw new Error(label + ' bukan angka yang valid.');
  return value;
}

function txMoney_(value, label) {
  value = txNumber_(value, label);
  var cents = Math.round(value * 100);
  if (value < 0 || !Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 0.00001) throw new Error(label + ' harus bernilai nonnegatif dengan maksimal dua desimal.');
  return cents;
}

function txUnique_(rows, predicate, label) {
  var found = rows.filter(predicate);
  if (found.length !== 1) throw new Error(label + (found.length ? ' terdaftar ganda.' : ' tidak ditemukan.'));
  return found[0];
}
function txActive_(row) { return normalizeKey_(row.status || 'ACTIVE') === 'ACTIVE'; }
function txDistributorKey_(value) { return normalizeKey_(String(value || '').replace(/\s*\([^)]*\)\s*$/, '')).replace(/\s+/g, ' '); }
function txTeamKey_(value) {
  var key = normalizeKey_(value);
  return normalizeKey_(LEGACY_TEAM_MAP[key] || ({ ULTIMATE: 'Motoris Ultimate', SPG: 'SPG Kelontong' })[key] || key);
}

function txPlan_(ctx, meta, payload, user, transactionId, requestId, options) {
  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 100) throw new Error('Pilih 1 sampai 100 baris produk.');
  if (typeof payload.salesId !== 'string' || payload.salesId.length > 128) throw new Error('Sales ID tidak valid.');
  var date = String(payload.date || '').trim();
  var match = date.match(/^(\d{4})-(0[1-9]|1[0-2])-(\d{2})$/);
  var today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  if (!match || Number(match[3]) < 1 || Number(match[3]) > new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate() || date > today) throw new Error('Tanggal transaksi harus valid dan tidak boleh di masa depan.');
  if (payload.notes !== undefined && typeof payload.notes !== 'string') throw new Error('Catatan transaksi tidak valid.');
  var notes = String(payload.notes || '').trim();
  if (notes.length > 2000) throw new Error('Catatan maksimal 2.000 karakter.');
  if (typeof archiveAssertOpenDate_ === 'function') archiveAssertOpenDate_(date);
  var names = ['SALES', 'PRODUCTS', 'PRICE_MASTER', 'DISTRIBUTORS', 'INVENTORY'];
  names.forEach(function(name) { if (!meta[name]) throw new Error('Sheet ' + name + ' belum tersedia.'); });
  var optional = ['SALES_TRANSACTIONS', 'INVENTORY_MOVEMENTS', 'ACTIVITY_LOGS', 'SALES_STOCK', 'SALES_STOCK_MOVEMENTS'].filter(function(name) { return !!meta[name]; });
  var raw = options && options.raw || txRead_(ctx, names.concat(optional));
  var salesTable = txTable_('SALES', raw.SALES, ['sales_id', 'full_name', 'team_name', 'status']);
  var products = txTable_('PRODUCTS', raw.PRODUCTS, ['product_id', 'product_name', 'status']);
  var prices = txTable_('PRICE_MASTER', raw.PRICE_MASTER, ['product_id', 'team_name', 'cost_price', 'selling_price', 'status']);
  var distributors = txTable_('DISTRIBUTORS', raw.DISTRIBUTORS, ['distributor_id', 'distributor_name', 'status']);
  var inventory = txTable_('INVENTORY', raw.INVENTORY, ['product_id']);
  optional.forEach(function(name) { txTable_(name, raw[name], TABLE_SCHEMAS[name] || KCH_STOCK_SCHEMAS_[name], true); });
  var sales = txUnique_(salesTable.rows, function(row) { return normalizeKey_(row.sales_id) === normalizeKey_(payload.salesId); }, 'Sales');
  if (!txActive_(sales) || isAttendanceOnlyTeam_(sales.team_name)) throw new Error('Sales tidak aktif atau hanya boleh melakukan absensi.');
  if (user.role !== 'ADMIN' && normalizeKey_(sales.sales_id) !== normalizeKey_(user.salesId)) throw new Error('Sales hanya boleh menyimpan transaksi sendiri.');
  var book = options && options.book || stockBook_(meta,raw);
  var grouped = Object.create(null);
  payload.items.forEach(function(item) {
    if (!item || typeof item.productId !== 'string' || !item.productId.trim() || item.productId.length > 128) throw new Error('Kode produk tidak valid.');
    var qty = typeof item.qty === 'number' ? item.qty : typeof item.qty === 'string' && /^\d+$/.test(item.qty.trim()) ? Number(item.qty) : NaN;
    if (!Number.isSafeInteger(qty) || qty <= 0) throw new Error('Jumlah produk harus bilangan bulat lebih dari nol.');
    var source = stockSource_(item,payload.distributor,distributors.rows,true);
    var key = stockLineKey_(item.productId,source.type,source.dist.distributor_id);
    if (!grouped[key]) grouped[key] = { qty: 0, quotes: [], productId: normalizeKey_(item.productId), source: source };
    grouped[key].qty += qty;
    if (!Number.isSafeInteger(grouped[key].qty)) throw new Error('Jumlah produk terlalu besar.');
    grouped[key].quotes.push(item);
  });
  var requests = [], txRows = [], stockUpdates = [];
  stockFinancialSchema_(meta,raw,requests);
  var totalSalesCents = 0, totalCostCents = 0;
  var timestamp = Utilities.formatDate(new Date(), TIMEZONE, DATE_FORMAT);
  Object.keys(grouped).sort().forEach(function(key) {
    var item = grouped[key], source = item.source, distributor = source.dist;
    key = item.productId;
    var product = txUnique_(products.rows, function(row) { return normalizeKey_(row.product_id) === key; }, 'Produk ' + key);
    var historical = options && options.fixedPrices && options.fixedPrices[key];
    var price = historical ? { cost_price: historical.costPrice, selling_price: historical.sellingPrice, status: 'ACTIVE' } : txUnique_(prices.rows, function(row) { return normalizeKey_(row.product_id) === key && txTeamKey_(row.team_name) === txTeamKey_(sales.team_name); }, 'Harga produk ' + key + ' untuk tim sales');
    var inv = txUnique_(inventory.rows, function(row) { return normalizeKey_(row.product_id) === key; }, 'Stok produk ' + key);
    if (!txActive_(product) || !txActive_(price)) throw new Error('Produk atau harga ' + key + ' tidak aktif.');
    var cost = txMoney_(price.cost_price, 'Modal ' + key), sell = txMoney_(price.selling_price, 'Harga jual ' + key);
    if (sell <= 0) throw new Error('Harga jual produk harus lebih dari nol.');
    item.quotes.forEach(function(quote) {
      if ((quote.costPrice !== undefined && txMoney_(quote.costPrice, 'Modal pada form') !== cost) ||
          (quote.sellingPrice !== undefined && txMoney_(quote.sellingPrice, 'Harga pada form') !== sell)) throw new Error('Harga produk ' + key + ' berbeda dari master. Sinkronkan data lalu periksa kembali totalnya.');
    });
    book.adjust(source.type,sales.sales_id,product.product_id,distributor,-item.qty);
    var subSell = sell * item.qty, subCost = cost * item.qty;
    totalSalesCents += subSell; totalCostCents += subCost;
    if (![subSell, subCost, totalSalesCents, totalCostCents].every(Number.isSafeInteger)) throw new Error('Nilai transaksi terlalu besar.');
    var teamName = STANDARD_TEAMS.filter(function(team) { return normalizeKey_(team) === txTeamKey_(sales.team_name); })[0] || String(sales.team_name);
    txRows.push([transactionId, date, String(sales.sales_id), String(sales.full_name), teamName, String(distributor.distributor_name), String(product.product_id), String(product.product_name), item.qty, cost / 100, sell / 100, (sell - cost) / 100, subSell / 100, subCost / 100, (subSell - subCost) / 100, notes, user.email, timestamp, source.type, String(distributor.distributor_id)]);
  });
  var stockPlan = options && options.skipStockPlan ? {requests:[],changes:[]} : book.plan(meta,date,transactionId,user);
  requests = requests.concat(stockPlan.requests); stockUpdates = stockPlan.changes;
  ['SALES_TRANSACTIONS', 'INVENTORY_MOVEMENTS', 'ACTIVITY_LOGS'].forEach(function(name) { if (!meta[name]) txAddSheet_(meta, requests, name, name === 'SALES_TRANSACTIONS' ? stockSchemas_().SALES_TRANSACTIONS : TABLE_SCHEMAS[name], false); });
  requests.push(txAppend_(meta.SALES_TRANSACTIONS.sheetId, txRows));
  requests.push(txAppend_(meta.ACTIVITY_LOGS.sheetId, [['AUD-' + Utilities.getUuid(), timestamp, user.email, 'CREATE_TRANSACTION', transactionId,
    JSON.stringify({ salesId: String(sales.sales_id), distributor: String(payload.distributor || 'Campuran'), actorRole: user.role, assisted: user.role === 'ADMIN', totalSales: totalSalesCents / 100 })]]));
  var result = { success: true, terminal: true, state: 'COMMITTED', requestId: requestId, transactionId: transactionId,
    totalSales: totalSalesCents / 100, totalCost: totalCostCents / 100, totalShj: (totalSalesCents - totalCostCents) / 100,
    stockUpdates: stockUpdates, replayed: false, message: 'Transaksi tersimpan. Stok, mutasi, dan audit diperbarui bersama.' };
  var plan = { salesId: String(sales.sales_id), date: date, distributor: String(payload.distributor || 'Campuran'), stockUpdates: stockUpdates, itemCount: txRows.length };
  if (JSON.stringify(result).length > 45000 || JSON.stringify(plan).length > 45000) throw new Error('Detail transaksi terlalu panjang. Kurangi jumlah produk per kiriman.');
  return { requests: requests, result: result, plan: plan, rows: txRows };
}

function txReceiptValues_(receipt) { return KCH_TX_REQUEST_HEADERS_.map(function(header) { return receipt[header] || ''; }); }
function txPendingResult_(id, message) { var result = txFailure_('SAVE_PENDING', message || 'Hasil kiriman masih diperiksa. Gunakan Periksa hasil; jangan membuat kiriman baru.', 'PENDING'); result.requestId = id; return result; }

function txMarkFailed_(ctx, meta, receipt, code, message) {
  receipt.state = 'FAILED'; receipt.updated_at = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  var result = { success: false, terminal: true, state: 'FAILED', code: code, requestId: receipt.request_id, message: message };
  receipt.result_json = JSON.stringify(result);
  txBatch_(ctx, [txUpdate_(meta[KCH_TX_REQUEST_SHEET_].sheetId, receipt._row, 0, [txReceiptValues_(receipt)])]);
  return result;
}

function getSalesTransactionRequestStatus_(requestId) {
  var user = getCurrentUserInfo_();
  var id = txRequestId_(requestId);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return txPendingResult_(id, 'Penyimpanan masih berjalan. Periksa lagi sebentar.'); }
  try {
    var ctx = { id: getKchSpreadsheet_().getId(), token: ScriptApp.getOAuthToken() };
    var meta = txMetadata_(ctx), rows = txReceipts_(ctx, meta), key = txHash_(user.uid + ':' + id);
    var committed = txCommitted_(rows, key);
    if (committed) return txReceiptResult_(committed, true);
    if (rows.some(function(row) { return row.request_key === key && row.state === 'PENDING'; })) return txPendingResult_(id);
    var rejected = rows.filter(function(row) { return row.request_key === key && row.state === 'FAILED'; });
    if (rejected.length) return JSON.parse(rejected[rejected.length - 1].result_json);
    return { success: false, terminal: false, state: 'NOT_FOUND', requestId: id, blocked: txHasPending_(rows), message: 'Kiriman belum tercatat. Kode kiriman tetap dipertahankan untuk mencoba kembali.' };
  } catch (err) { return txPendingResult_(id, err.message || 'Status kiriman belum dapat diperiksa.'); }
  finally { lock.releaseLock(); }
}

function saveSalesTransactionAtomic_(payload) { return txExecuteRequest_(payload, false); }

function txExecuteRequest_(payload, editing) {
  var user = getCurrentUserInfo_();
  var id;
  try { id = txRequestId_(payload && payload.requestId); } catch (err) { return txFailure_('CLIENT_UPDATE_REQUIRED', err.message); }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return txPendingResult_(id, 'Sistem sedang memproses kiriman lain. Periksa hasil atau coba lagi sebentar.'); }
  try {
    var ctx = { id: getKchSpreadsheet_().getId(), token: ScriptApp.getOAuthToken() };
    var meta = txMetadata_(ctx), rows = txReceipts_(ctx, meta), key = txHash_(user.uid + ':' + id);
    var pickup = editing === 'PICKUP', deposit = editing === 'DEPOSIT', photoUpload = editing === 'PHOTO';
    var photoFingerprint = payload.photo ? txHash_(typeof payload.photo === 'string' ? payload.photo.slice(0,3000001) : 'INVALID') : '';
    var fingerprint = photoUpload ? txHash_(JSON.stringify(['PHOTO',payload.photoType,txFingerprint_(payload),txHash_(payload.imageDataUrl)].concat(payload.attendanceTime?[payload.attendanceTime]:[]).concat(payload.visitTime?['VISIT_TIME',payload.visitTime]:[]))) : deposit ? txHash_(JSON.stringify(['DEPOSIT', txFingerprint_(payload), String(payload.amount), photoFingerprint])) : pickup ? txHash_(JSON.stringify(['PICKUP', txFingerprint_(payload), photoFingerprint])) : editing ? txHash_(JSON.stringify(['EDIT', payload.transactionId, payload.expectedRevision, payload.reason, txFingerprint_(payload)])) : txFingerprint_(payload);
    var committed = txCommitted_(rows, key);
    if (committed) {
      if (committed.fingerprint !== fingerprint) return txFailure_('REQUEST_CONFLICT', 'Kode kiriman ini sudah digunakan. Periksa hasil kiriman sebelumnya.', 'CONFLICT');
      return txReceiptResult_(committed, true);
    }
    if (rows.some(function(row) { return row.request_key === key && row.state === 'PENDING'; })) return txPendingResult_(id);
    var rejected = rows.filter(function(row) { return row.request_key === key && row.state === 'FAILED'; });
    if (rejected.length) return JSON.parse(rejected[rejected.length - 1].result_json);
    if (txHasPending_(rows)) return txPendingResult_(id, 'Ada kiriman yang hasilnya belum pasti. Penyimpanan baru ditahan agar stok tetap konsisten. Admin dapat memeriksa kiriman tertunda.');
    var attempt = Utilities.getUuid();
    var stamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    var transactionId = editing && !pickup && !deposit && !photoUpload ? String(payload.transactionId || '') : (photoUpload ? 'PHOTO-' : deposit ? 'CASH-' : pickup ? 'PICK-' : 'TRX-') + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd') + '-' + attempt.replace(/-/g, '').slice(0, 16);
    var receipt = { request_key: key, request_id: id, actor_uid: user.uid, actor_email: user.email, fingerprint: fingerprint,
      attempt_id: attempt, transaction_id: transactionId, state: 'PENDING', result_json: '', plan_json: '', created_at: stamp, updated_at: stamp };
    var reserve = [];
    if (!meta[KCH_TX_REQUEST_SHEET_]) txAddSheet_(meta, reserve, KCH_TX_REQUEST_SHEET_, KCH_TX_REQUEST_HEADERS_, true);
    reserve.push(txAppend_(meta[KCH_TX_REQUEST_SHEET_].sheetId, [txReceiptValues_(receipt)]));
    txBatch_(ctx, reserve);
    // Locate the actual appended row; never assume a row number for a reservation.
    rows = txReceipts_(ctx, meta);
    receipt = txUnique_(rows, function(row) { return row.request_key === key && row.attempt_id === attempt; }, 'Catatan kiriman');
    var plan;
    try { plan = photoUpload ? photoUploadPlan_(ctx, meta, payload, user, transactionId, id) : deposit ? stockCashDepositPlan_(ctx, meta, payload, user, transactionId, id) : pickup ? stockPickupPlan_(ctx, meta, payload, user, transactionId, id) : editing ? txEditPlan_(ctx, meta, payload, user, transactionId, id) : txPlan_(ctx, meta, payload, user, transactionId, id); }
    catch (validation) { return txMarkFailed_(ctx, meta, receipt, 'VALIDATION_FAILED', validation.message); }
    receipt.state = 'COMMITTED'; receipt.result_json = JSON.stringify(plan.result); receipt.plan_json = JSON.stringify(plan.plan);
    receipt.updated_at = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    plan.requests.push(txUpdate_(meta[KCH_TX_REQUEST_SHEET_].sheetId, receipt._row, 0, [txReceiptValues_(receipt)]));
    try {
      txBatch_(ctx, plan.requests);
      return plan.result;
    } catch (writeError) {
      // A response may be lost after a successful atomic commit. Read the receipt
      // instead of repeating the financial write with uncertain prior status.
      try {
        var live = txReceipts_(ctx, meta), saved = txCommitted_(live, key);
        if (saved) return txReceiptResult_(saved, true);
        if ([400, 403, 404].indexOf(writeError.httpStatus) >= 0) {
          var rejectedResult = txMarkFailed_(ctx, meta, receipt, 'WRITE_REJECTED', writeError.message);
          if (plan.cleanupFileId) { try { DriveApp.getFileById(plan.cleanupFileId).setTrashed(true); } catch (cleanupError) {} }
          return rejectedResult;
        }
      } catch (readError) {}
      return txPendingResult_(id);
    }
  } catch (err) { return txPendingResult_(id, err.message || 'Hasil penyimpanan belum dapat dipastikan. Periksa hasil sebelum mencoba kiriman baru.'); }
  finally { lock.releaseLock(); }
}

function checkKchTransactionSetup() {
  var email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (email !== KCH_BOOTSTRAP_ADMIN_EMAIL_) throw new Error('ACCESS_DENIED: Jalankan pemeriksaan dari editor memakai Gmail admin.');
  var ctx = { id: getKchSpreadsheet_().getId(), token: ScriptApp.getOAuthToken() };
  var meta = txMetadata_(ctx);
  var missing = ['SALES', 'PRODUCTS', 'PRICE_MASTER', 'DISTRIBUTORS', 'INVENTORY'].filter(function(name) { return !meta[name]; });
  var rows = txReceipts_(ctx, meta);
  var pending = rows.filter(function(row) { return row.state === 'PENDING' && !txCommitted_(rows, row.request_key); }).map(function(row) {
    return { requestId: row.request_id, transactionId: row.transaction_id, actorEmail: row.actor_email, createdAt: row.created_at };
  });
  var report = { success: !missing.length && !pending.length, missingSheets: missing, pendingRequests: pending,
    message: missing.length ? 'Lengkapi sheet master yang disebutkan.' : pending.length ? 'Ada kiriman tertunda. Periksa hasil dan hubungi pengelola sebelum mengubah catatan kiriman.' : 'Google Sheets API terhubung. Sheet master tersedia; tidak ada kiriman tertunda.' };
  console.log(JSON.stringify(report));
  return report;
}

function assertNoPendingTransactions_() {
  var ctx = { id: getKchSpreadsheet_().getId(), token: ScriptApp.getOAuthToken() };
  var meta = txMetadata_(ctx);
  if (txHasPending_(txReceipts_(ctx, meta))) throw new Error('Pembaruan sheet ditahan karena ada kiriman transaksi yang hasilnya belum pasti. Periksa kiriman terlebih dahulu.');
}
