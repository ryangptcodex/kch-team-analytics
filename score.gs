// Skor Motoris/MMTW. Uses existing authenticated gateway and literal Sheets API writes.
// AA is a manually reported daily count, never inferred from invoices or attendance.
var KCH_SCORE_EVENTS_ = 'SKOR_EVENTS';
var KCH_SCORE_HEADERS_ = ['event_id', 'scope', 'previous_id', 'payload_json', 'actor_email', 'actor_uid', 'actor_role', 'created_at'];
// Codes and names confirmed by the user from PRODUCTS, 27 October 2026.
var KCH_SCORE_PRODUCT_RULES_ = {
  LBMAV: ['Bejo Jahe Merah', 'FOCUS_A'],
  LKXOD: ['Komix Herbal Sachet Original', 'FOCUS_B'],
  LKXJA: ['Komix Herbal Sachet Jahe', 'FOCUS_B'],
  LKXPA: ['Komix Herbal Sachet Peppermint', 'FOCUS_B'],
  LKXNA: ['Komix Herbal Sachet Jeruk Nipis', 'FOCUS_B'],
  LKXOB: ['Komix Herbal Tube Original', 'FOCUS_B'],
  LKXLA: ['Komix Herbal Tube Lemon', 'FOCUS_B'],
  LKXKA: ['Komix Herbal Kids', 'FOCUS_B'],
  LPRGQ: ['Promag Herbal', 'FOCUS_B'],
  LPRGN: ['Promag Tablet', 'EXCLUDE']
};

function scoreToday_() { return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd'); }
function scoreDate_(value) {
  var date = normalizeDateString_(value);
  if (!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date)) throw new Error('Tanggal tidak valid.');
  var parsed = new Date(date + 'T00:00:00Z');
  if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Tanggal tidak valid.');
  return date;
}
function scoreMonth_(month) {
  if (typeof month !== 'string' || !/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Pilih bulan penilaian yang valid (2000–2099).');
  return month;
}
function scoreEligible_(sales) { return ['MOTORIS', 'MMTW'].indexOf(txTeamKey_(sales.team_name)) >= 0; }
function scoreAdmin_() {
  var user = getCurrentUserInfo_();
  if (user.role !== 'ADMIN') throw new Error('ACCESS_DENIED: Hanya admin yang boleh menginput AA.');
  return user;
}
function scoreContext_(withTransactions) {
  var ctx = { id: getKchSpreadsheet_().getId(), token: ScriptApp.getOAuthToken() };
  var meta = txMetadata_(ctx);
  var names = ['SALES', 'PRODUCTS', KCH_SCORE_EVENTS_, 'HOLIDAYS', 'HARI_LIBUR', 'LIBUR'];
  if (withTransactions) names.push('SALES_TRANSACTIONS');
  var raw = txRead_(ctx, names.filter(function(n) { return !!meta[n]; }));
  function table(name, headers) {
    if (!meta[name]) throw new Error('Sheet ' + name + ' tidak tersedia.');
    return txTable_(name, raw[name], headers, false).rows;
  }
  return { ctx: ctx, meta: meta, raw: raw,
    sales: table('SALES', ['sales_id', 'full_name', 'team_name', 'status']),
    products: table('PRODUCTS', ['product_id', 'product_name']),
    events: meta[KCH_SCORE_EVENTS_] ? txTable_(KCH_SCORE_EVENTS_, raw[KCH_SCORE_EVENTS_], KCH_SCORE_HEADERS_, true).rows : [] };
}
function scoreSales_(data, salesId) {
  assertOwnSales_(salesId);
  var sales = txUnique_(data.sales, function(s) { return normalizeKey_(s.sales_id) === normalizeKey_(salesId); }, 'Sales');
  if (!scoreEligible_(sales)) throw new Error('Skor hanya tersedia untuk Motoris dan MMTW (bukan Motoris Ultimate).');
  return sales;
}
function scoreCatalog_(data) {
  var seen = Object.create(null);
  return data.products.map(function(p) {
    var id = normalizeKey_(p.product_id), name = String(p.product_name || '').trim();
    if (!id || !name || seen[id]) throw new Error('Master PRODUCTS memiliki kode/nama kosong atau kode ganda. Periksa master dahulu.');
    seen[id] = true;
    return { productId: id, productName: name };
  }).sort(function(a, b) { return a.productId.localeCompare(b.productId); });
}
// Append-only replacement events. Replays with the same ID are semantically identical;
// duplicate deliveries never add counts. Forks fail closed instead of choosing a winner.
function scoreLedger_(events) {
  var latest = Object.create(null), ids = Object.create(null);
  events.forEach(function(e) {
    var signature = JSON.stringify([e.scope, e.previous_id, e.payload_json, e.actor_email, e.actor_uid, e.actor_role]);
    if (!e.event_id || !e.scope || e.actor_role !== 'ADMIN') throw new Error('Histori Skor tidak valid; admin perlu memeriksa SKOR_EVENTS.');
    if (ids[e.event_id]) {
      if (ids[e.event_id].signature !== signature) throw new Error('Kode kiriman Skor bertabrakan; periksa SKOR_EVENTS.');
      return;
    }
    if (String(e.previous_id || '') !== (latest[e.scope] ? latest[e.scope].event_id : '')) throw new Error('Revisi Skor bercabang; admin perlu memeriksa SKOR_EVENTS sebelum melanjutkan.');
    var payload;
    try { payload = JSON.parse(e.payload_json); } catch (err) { throw new Error('Histori Skor tidak dapat dibaca.'); }
    ids[e.event_id] = { signature: signature, event: e };
    latest[e.scope] = { event_id: e.event_id, payload: payload, actor: e.actor_email, updatedAt: e.created_at };
  });
  return { latest: latest, ids: ids };
}
function scoreMapping_(data) {
  var seen = Object.create(null), issues = [];
  var products = scoreCatalog_(data).map(function(p) {
    var rule = KCH_SCORE_PRODUCT_RULES_[p.productId], group = rule ? rule[1] : 'OTHER';
    seen[p.productId] = true;
    var normalized = normalizeKey_(p.productName).replace(/[^A-Z0-9]+/g, ' ').trim();
    if (rule) {
      var expected = normalizeKey_(rule[0]).replace(/[^A-Z0-9]+/g, ' ').trim();
      if (normalized !== expected && normalized.indexOf(expected + ' ') !== 0) issues.push(p.productId + ': nama master tidak cocok dengan ' + rule[0]);
    } else if (Object.keys(KCH_SCORE_PRODUCT_RULES_).some(function(id) {
      return normalized === normalizeKey_(KCH_SCORE_PRODUCT_RULES_[id][0]).replace(/[^A-Z0-9]+/g, ' ').trim();
    })) {
      issues.push(p.productId + ': nama produk yang dipetakan memakai kode lain; periksa master');
    }
    return { productId: p.productId, productName: p.productName, group: group };
  });
  Object.keys(KCH_SCORE_PRODUCT_RULES_).forEach(function(id) { if (!seen[id]) issues.push(id + ': tidak ditemukan di PRODUCTS'); });
  return { ready: issues.length === 0, products: products, issues: issues };
}
function getScoreSetup_() {
  var user = getCurrentUserInfo_(), data = scoreContext_(false), ledger = scoreLedger_(data.events), mapping = scoreMapping_(data);
  return { success: true, canManage: user.role === 'ADMIN', today: scoreToday_(), mappingReady: mapping.ready,
    mappingIssues: mapping.issues,
    products: user.role === 'ADMIN' ? mapping.products : [],
    sales: data.sales.filter(function(s) { return scoreEligible_(s) && (['ADMIN', 'GUEST'].indexOf(user.role) >= 0 || normalizeKey_(s.sales_id) === normalizeKey_(user.salesId)); })
      .map(function(s) { return { salesId: String(s.sales_id), name: String(s.full_name), team: String(s.team_name), active: txActive_(s) }; }) };
}
function scoreWriteEvent_(data, ledger, scope, payload, input, user) {
  var requestId = txRequestId_(input.requestId), previous = String(input.expectedRevision || '');
  var body = JSON.stringify(payload);
  if (body.length > 45000) throw new Error('Data AA terlalu besar.');
  var existing = ledger.ids[requestId];
  if (existing) {
    var e = existing.event;
    if (e.scope !== scope || e.previous_id !== previous || e.payload_json !== body || e.actor_uid !== user.uid) throw new Error('Kode kiriman sudah dipakai untuk data lain. Muat ulang data.');
    return { success: true, revision: requestId, replayed: true, message: 'Kiriman sudah tersimpan; tidak dijumlahkan ulang.' };
  }
  if ((ledger.latest[scope] ? ledger.latest[scope].event_id : '') !== previous) return { success: false, code: 'REVISION_CONFLICT', message: 'Data sudah diubah admin lain. Muat ulang sebelum menyimpan.' };
  var requests = [], sheet = data.meta[KCH_SCORE_EVENTS_];
  if (!sheet) sheet = txAddSheet_(data.meta, requests, KCH_SCORE_EVENTS_, KCH_SCORE_HEADERS_, false);
  requests.push(txAppend_(sheet.sheetId, [[requestId, scope, previous, body, user.email, user.uid, user.role,
    Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss')]]));
  try { txBatch_(data.ctx, requests); }
  catch (err) {
    if (err.transport) return { success: false, code: 'SAVE_UNCERTAIN', message: 'Hasil simpan belum pasti. Tekan Periksa / ulangi simpan dengan kiriman yang sama; jangan membuat input baru.' };
    throw err;
  }
  return { success: true, revision: requestId, message: 'Data Skor berhasil disimpan.' };
}
function saveScoreAA_(input) {
  var user = scoreAdmin_(), lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    if (!input || typeof input.count !== 'number' || !Number.isSafeInteger(input.count) || input.count < 0) throw new Error('AA harus bilangan bulat minimal 0.');
    var date = scoreDate_(input.date);
    if (date !== input.date || date > scoreToday_()) throw new Error('Tanggal AA tidak boleh di masa depan dan harus berformat yyyy-MM-dd.');
    var data = scoreContext_(false), sales = scoreSales_(data, input.salesId);
    if (!txActive_(sales)) throw new Error('Profil sales tidak aktif.');
    var id = normalizeKey_(sales.sales_id), ledger = scoreLedger_(data.events);
    return scoreWriteEvent_(data, ledger, 'AA:' + id + ':' + date, { salesId: id, date: date, count: input.count }, input, user);
  } finally { lock.releaseLock(); }
}
function scoreParameters_(actuals) {
  var rules = [
    ['Fokus A · Bejo Jahe Merah', 5000000, 0.40, 40],
    ['Fokus B · Komix Herbal All/Family + Promag Herbal', 5000000, 0.25, 25],
    ['Total Value (non Promag Tablet)', 27000000, 0.25, 25],
    ['Active Account (AA)', 400, 0.10, 10]
  ];
  return rules.map(function(r, i) {
    var achievement = actuals[i] / r[1], points = r[2] * achievement * 100;
    return { name: r[0], actual: actuals[i], target: r[1], weight: r[2], max: r[3], achievement: achievement, points: points, score: Math.min(points, r[3]) };
  });
}
function scoreCategory_(total) { return total < 40 ? 'EVALUASI' : total < 60 ? 'DISPENSASI LANJUT' : 'LANJUT BULAN BERIKUTNYA'; }
function getScoreReport_(month, salesId) {
  getCurrentUserInfo_(); assertOwnSales_(salesId); scoreMonth_(month);
  var data = scoreContext_(true), sales = scoreSales_(data, salesId), ledger = scoreLedger_(data.events), mapping = scoreMapping_(data);
  var today = scoreToday_(), start = month + '-01', end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  var holidayName = ['HOLIDAYS', 'HARI_LIBUR', 'LIBUR'].filter(function(n) { return !!data.meta[n]; })[0], holidays = Object.create(null);
  if (holidayName) {
    var h = txTable_(holidayName, data.raw[holidayName], [], false);
    var dateHeader = ['date', 'holiday_date', 'tanggal', 'tgl'].filter(function(n) { return h.headers.indexOf(n) >= 0; })[0];
    if (!dateHeader) throw new Error('Kolom tanggal libur tidak ditemukan pada ' + holidayName + '.');
    h.rows.forEach(function(row) { holidays[scoreDate_(row[dateHeader])] = true; });
  }
  var calendar = getWorkDateRangeInfo_(start, end, holidays), daily = [], totalAA = 0;
  calendar.dates.forEach(function(day) {
    var event = ledger.latest['AA:' + normalizeKey_(salesId) + ':' + day.date], count = event ? event.payload.count : null;
    if (event && (!Number.isSafeInteger(count) || count < 0 || event.payload.salesId !== normalizeKey_(salesId) || event.payload.date !== day.date)) throw new Error('Histori AA tidak valid.');
    if (day.date <= today && count !== null) { totalAA += count; if (!Number.isSafeInteger(totalAA)) throw new Error('Total AA terlalu besar.'); }
    daily.push({ date: day.date, isWorkDay: day.isWorkDay, count: count, revision: event ? event.event_id : '', actor: event ? event.actor : '', updatedAt: event ? event.updatedAt : '' });
  });
  var totals = [0, 0, 0, totalAA], products = Object.create(null);
  mapping.products.forEach(function(p) { products[p.productId] = p; });
  // No persisted report snapshot: committed transaction edits are reflected on reload.
  if (mapping.ready) {
    if (!data.meta.SALES_TRANSACTIONS) throw new Error('Sheet SALES_TRANSACTIONS tidak tersedia.');
    txTable_('SALES_TRANSACTIONS', data.raw.SALES_TRANSACTIONS, ['sales_id', 'transaction_date', 'product_id', 'quantity', 'selling_price'], false).rows.forEach(function(row) {
      if (normalizeKey_(row.sales_id) !== normalizeKey_(salesId)) return;
      var date = scoreDate_(row.transaction_date);
      if (date.slice(0, 7) !== month || date > today) return;
      var p = products[normalizeKey_(row.product_id)];
      if (!p) throw new Error('Kode produk transaksi ' + row.product_id + ' tidak ada di master PRODUCTS; periksa master sebelum menilai.');
      var qty = txNumber_(row.quantity, 'Jumlah transaksi');
      if (!Number.isSafeInteger(qty) || qty <= 0) throw new Error('Jumlah transaksi tidak valid; periksa faktur ' + (row.transaction_id || '') + '.');
      var amount = row.subtotal_sales !== undefined && row.subtotal_sales !== '' ? txMoney_(row.subtotal_sales, 'Subtotal transaksi') : txMoney_(row.selling_price, 'Harga transaksi') * qty;
      if (!Number.isSafeInteger(amount)) throw new Error('Nilai transaksi terlalu besar.');
      if (p.group === 'FOCUS_A') totals[0] += amount;
      if (p.group === 'FOCUS_B') totals[1] += amount;
      if (p.group !== 'EXCLUDE') totals[2] += amount;
    });
  }
  for (var i = 0; i < 3; i++) { if (!Number.isSafeInteger(totals[i])) throw new Error('Total transaksi terlalu besar.'); totals[i] /= 100; }
  var parameters = mapping.ready ? scoreParameters_(totals) : [], total = parameters.reduce(function(sum, p) { return sum + p.score; }, 0);
  var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1));
  return { success: true, mappingReady: mapping.ready, month: month, sales: { salesId: String(sales.sales_id), name: String(sales.full_name), team: String(sales.team_name) },
    parameters: parameters, total: mapping.ready ? total : null, category: mapping.ready ? scoreCategory_(total) : null,
    nextMonth: months[next.getUTCMonth()] + ' ' + next.getUTCFullYear(), holidaySource: holidayName || '', workDays: calendar.workDays,
    workDaysPassed: daily.filter(function(d) { return d.isWorkDay && d.date <= today; }).length,
    dailyAA: daily, totalAA: totalAA, enteredDays: daily.filter(function(d) { return d.count !== null && d.date <= today; }).length,
    message: mapping.ready ? '' : 'Periksa master produk: ' + mapping.issues.join('; ') };
}
