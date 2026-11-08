// Skor Motoris/MMTW and MPR/Canvasser. Uses existing authenticated gateway and literal Sheets API writes.
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
  LPRGR: ['Promag Herbal', 'FOCUS_B'],
  LPRGN: ['Promag Tablet', 'EXCLUDE']
};

// Canonical correction confirmed by the user; legacy invoice codes remain readable.
function scoreCanonicalProductId_(id) { var key = normalizeKey_(id); return key === 'LPRGQ' ? 'LPRGR' : key; }
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
function scoreBrandingTeam_(teamName) { return ['MPR', 'CANVASSER'].indexOf(txTeamKey_(teamName)) >= 0; }
function scoreEligible_(sales) { return ['MOTORIS', 'MMTW'].indexOf(txTeamKey_(sales.team_name)) >= 0 || scoreBrandingTeam_(sales.team_name); }
function scoreAdmin_() {
  var user = getCurrentUserInfo_();
  if (user.role !== 'ADMIN') throw new Error('ACCESS_DENIED: Hanya admin yang boleh menginput AA dan branding.');
  return user;
}
function scoreContext_(withTransactions, withPrices) {
  var ctx = { id: getKchSpreadsheet_().getId(), token: ScriptApp.getOAuthToken() };
  var meta = txMetadata_(ctx);
  var names = ['SALES', 'PRODUCTS', KCH_SCORE_EVENTS_, 'HOLIDAYS', 'HARI_LIBUR', 'LIBUR'];
  if (withTransactions) {names.push('SALES_TRANSACTIONS');if(typeof KCH_OPERATIONS_!=='undefined'&&meta[KCH_OPERATIONS_])names.push(KCH_OPERATIONS_);}
  if (withPrices) names.push('PRICE_MASTER');
  if (typeof archiveEnabled_ === 'function' && archiveEnabled_() && meta[KCH_ARCHIVE_ROWS_]) names.push(KCH_ARCHIVE_ROWS_);
  var raw = txRead_(ctx, names.filter(function(n) { return !!meta[n]; }));
  if (typeof archiveMergeTable_ === 'function') {
    [KCH_SCORE_EVENTS_,'SALES_TRANSACTIONS'].forEach(function(name){if(raw[name])raw[name]=archiveMergeTable_(name,raw[name],raw[KCH_ARCHIVE_ROWS_]||[KCH_ARCHIVE_SCHEMAS_[KCH_ARCHIVE_ROWS_]]);});
  }
  if(withTransactions&&raw.SALES_TRANSACTIONS&&typeof opsAugmentTable_==='function')raw.SALES_TRANSACTIONS=opsAugmentTable_(raw.SALES_TRANSACTIONS,opsEntries_(ctx,meta,raw));
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
  if (!scoreEligible_(sales)) throw new Error('Skor hanya tersedia untuk Motoris, MMTW, MPR dan Canvasser.');
  return sales;
}
function scoreCatalog_(data) {
  var seen = Object.create(null);
  return data.products.map(function(p) {
    var id = scoreCanonicalProductId_(p.product_id), name = String(p.product_name || '').trim();
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
  var seen = Object.create(null), issues = [],rules=periodPolicy_(data).productRules;
  var products = scoreCatalog_(data).map(function(p) {
    var rule = rules[p.productId], group = rule ? rule[1] : 'OTHER';
    seen[p.productId] = true;
    var normalized = normalizeKey_(p.productName).replace(/[^A-Z0-9]+/g, ' ').trim();
    if (rule) {
      var expected = normalizeKey_(rule[0]).replace(/[^A-Z0-9]+/g, ' ').trim();
      if (normalized !== expected && normalized.indexOf(expected + ' ') !== 0) issues.push(p.productId + ': nama master tidak cocok dengan ' + rule[0]);
    } else if (Object.keys(rules).some(function(id) {
      return normalized === normalizeKey_(rules[id][0]).replace(/[^A-Z0-9]+/g, ' ').trim();
    })) {
      issues.push(p.productId + ': nama produk yang dipetakan memakai kode lain; periksa master');
    }
    return { productId: p.productId, productName: p.productName, group: group };
  });
  Object.keys(rules).forEach(function(id) { if (!seen[id]) issues.push(id + ': tidak ditemukan di PRODUCTS'); });
  return { ready: issues.length === 0, products: products, issues: issues };
}
function getScoreSetup_(month) {
  var user = getCurrentUserInfo_(), data = scoreContext_(false);if(month){scoreMonth_(month);data=periodContext_(data,month);}var ledger = scoreLedger_(data.events), mapping = scoreMapping_(data);
  return { success: true, canManage: user.role === 'ADMIN', today: scoreToday_(), mappingReady: mapping.ready,
    mappingIssues: mapping.issues,
    products: user.role === 'ADMIN' ? mapping.products : [],
    sales: data.sales.filter(function(s) { return scoreEligible_(s) && (['ADMIN', 'GUEST'].indexOf(user.role) >= 0 || normalizeKey_(s.sales_id) === normalizeKey_(user.salesId)); })
      .map(function(s) { return { salesId: String(s.sales_id), name: String(s.full_name), team: String(s.team_name), active: txActive_(s) }; }) };
}
function scoreWriteEvent_(data, ledger, scope, payload, input, user) {
  var requestId = txRequestId_(input.requestId), previous = String(input.expectedRevision || '');
  var body = JSON.stringify(payload);
  if (body.length > 45000) throw new Error('Data Skor terlalu besar.');
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
function saveScoreAA_(input) { return saveScoreDailyCount_(input, 'AA'); }
function saveScoreBranding_(input) { return saveScoreDailyCount_(input, 'BRANDING'); }
function saveScoreDailyCount_(input, metric) {
  var label = metric === 'BRANDING' ? 'Branding' : 'AA';
  var user = scoreAdmin_(), lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    if(typeof businessContentGuard_==='function')businessContentGuard_();else if (typeof archivePendingGuard_ === 'function') archivePendingGuard_();
    if (!input || typeof input.count !== 'number' || !Number.isSafeInteger(input.count) || input.count < 0) throw new Error(label + ' harus bilangan bulat minimal 0.');
    var date = scoreDate_(input.date);
    if (date !== input.date || date > scoreToday_()) throw new Error('Tanggal ' + label + ' tidak boleh di masa depan dan harus berformat yyyy-MM-dd.');
    if (typeof archiveAssertOpenDate_ === 'function') archiveAssertOpenDate_(date);
    var data = scoreContext_(false), sales = scoreSales_(data, input.salesId);
    if (metric === 'BRANDING' && !scoreBrandingTeam_(sales.team_name)) throw new Error('Branding Skor hanya tersedia untuk MPR dan Canvasser.');
    if (!txActive_(sales)) throw new Error('Profil sales tidak aktif.');
    var id = normalizeKey_(sales.sales_id), ledger = scoreLedger_(data.events);
    return scoreWriteEvent_(data, ledger, metric + ':' + id + ':' + date, { salesId: id, date: date, count: input.count }, input, user);
  } finally { lock.releaseLock(); }
}
function scoreParameters_(actuals,teamName,policy){
  policy=policy||periodCurrentPolicy_();var rules=scoreBrandingTeam_(teamName)?policy.scoreSenior:policy.scoreField;
  return rules.map(function(r,i){var achievement=actuals[i]/r[1],points=r[2]*achievement*100;return {name:r[0],actual:actuals[i],target:r[1],weight:r[2],max:r[3],achievement:achievement,points:points,score:Math.max(0,Math.min(points,r[3]))};});
}
function scoreCategory_(total,policy,month,storedEvaluation){if(month&&month>='2026-11'){var rule=scoreEvaluationRule_(month,storedEvaluation);if(!rule.verified)return null;return total<=70?'EVALUASI':total<=80?'DISPENSASI LANJUT':'AMAN';}var rules=(policy||periodCurrentPolicy_()).categories;return rules.filter(function(r){return r[0]===null||total<r[0];})[0][1];}
// Evaluation decisions are versioned separately from the monetary incentive juklak.
function scoreEvaluationVersion_(month){return month>='2026-11'?'KCH_EVAL_2026_11_V1':'KCH_EVAL_LEGACY_V1';}
function scoreEvaluationRule_(month,stored){
  var id=scoreEvaluationVersion_(month),verified=stored===undefined||stored===id;
  return {id:stored===undefined?id:stored,verified:verified,effectiveFrom:'2026-11',evaluationMax:70,dispensationMax:80,followUpMinimum:80,
    text:month>='2026-11'?'Mulai November 2026: ≤70 EVALUASI; >70 sampai 80 DISPENSASI LANJUT; >80 AMAN. Setelah dispensasi, minimal 80 pada akhir bulan berikutnya. Tepat 80 masih DISPENSASI, tetapi memenuhi minimum tindak lanjut. Keputusan kepegawaian tetap oleh Admin.':'Kategori periode sebelum November mengikuti aturan historisnya.'};
}
function scoreMonthOffset_(month,offset){var d=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1+offset,1));return d.toISOString().slice(0,7);}
function scoreEvaluationPrepared_(data){
  var base=data._periodBase||data;if(base._evaluationPrepared)return base._evaluationPrepared;
  var prepared={ledger:scoreLedger_(base.events),mapping:null,transactionsBySales:Object.create(null)};
  if(base.raw.SALES_TRANSACTIONS)txTable_('SALES_TRANSACTIONS',base.raw.SALES_TRANSACTIONS,[],false).rows.forEach(function(r){var id=normalizeKey_(r.sales_id);(prepared.transactionsBySales[id]||(prepared.transactionsBySales[id]=[])).push(r);});
  base._evaluationPrepared=prepared;return prepared;
}
function scoreApplyEvaluation_(data,report,prepared){
  var base=data._periodBase||data,today=scoreToday_(),current=today.slice(0,7),salesId=report.sales.salesId,cache=base._evaluationDecisions||(base._evaluationDecisions=Object.create(null));
  function unknown(month){return {month:month,category:null,verified:false,eligible:true,total:null};}
  function decide(raw,depth){
    var month=raw.month,key=normalizeKey_(salesId)+':'+month;if(cache[key])return cache[key];
    var phase=month<current?'FINAL':month===current?'ESTIMASI':'BELUM_BERJALAN',rule=raw.evaluationRule||scoreEvaluationRule_(month),category=raw.category;
    var result={month:month,total:raw.total,category:category,baseCategory:category,ruleId:rule.id,verified:raw.masterVerified!==false&&raw.mappingReady&&raw.total!==null&&rule.verified,eligible:true,phase:phase,onProbation:false,previousMonth:null,previousCategory:null,previousTotal:null,followUpMinimum:80,followUpStatus:'TIDAK_ADA',message:''};
    if(!result.verified){result.category=null;result.message=rule.verified?'Status evaluasi belum dapat dipastikan karena sumber Skor belum valid.':'Versi aturan evaluasi periode ini belum dikenali; kategori belum dapat disahkan.';return cache[key]=result;}
    if(month<'2026-11')return cache[key]=result;
    var previousMonth=scoreMonthOffset_(month,-1),previous=null;
    if(month>'2026-11'){
      result.previousMonth=previousMonth;
      if(previousMonth>=current){previous=unknown(previousMonth);}
      else if(depth>=120){previous=unknown(previousMonth);}
      else {
        try {
          var context=periodContext_(base,previousMonth),snapshot=periodRead_(previousMonth);
          if(!snapshot||!snapshot.verified||context.masterVerified===false)previous=unknown(previousMonth);
          else {var member=context.sales.filter(function(s){return normalizeKey_(s.sales_id)===normalizeKey_(salesId);})[0];
            if(!member||!scoreEligible_(member))previous={month:previousMonth,category:null,verified:true,eligible:false,total:null};
            else previous=decide(scoreBuildReport_(base,previousMonth,salesId,prepared||scoreEvaluationPrepared_(base)),depth+1);
          }
        }catch(err){previous=unknown(previousMonth);}
      }
      result.previousCategory=previous.category;result.previousTotal=previous.total;
      result.onProbation=previous.verified?previous.eligible&&previous.category==='DISPENSASI LANJUT':null;
    }
    if(result.onProbation===true){
      if(phase==='FINAL'){
        result.followUpStatus=raw.total<80?'TIDAK_TERPENUHI':'TERPENUHI';
        if(raw.total<80)result.category='EVALUASI';
        result.message='Bulan '+previousMonth+' mendapat dispensasi. '+(raw.total<80?'Skor akhir '+month+' di bawah 80: EVALUASI.':'Minimum 80 pada akhir '+month+' terpenuhi.');
      }else {result.followUpStatus='MENUNGGU_AKHIR_BULAN';result.message='Dalam pemantauan setelah dispensasi '+previousMonth+'. Wajib minimal 80 pada akhir '+month+'; keputusan akhir belum dibuat.';}
    }else if(result.onProbation===null){
      result.followUpStatus=previousMonth>=current?'MENUNGGU_BULAN_SEBELUMNYA':'RIWAYAT_BELUM_TERVERIFIKASI';
      result.message=previousMonth>=current?'Bulan sebelumnya belum selesai; tindak lanjut dispensasi belum dapat ditetapkan.':'Riwayat evaluasi '+previousMonth+' belum dapat diverifikasi; tindak lanjut belum dipastikan.';
      if(phase==='FINAL'&&category==='DISPENSASI LANJUT'&&raw.total<80){result.category=null;result.verified=false;}
    }
    if(phase==='ESTIMASI')result.message=(result.message?result.message+' ':'')+'Kategori bulan berjalan masih estimasi sampai akhir bulan.';
    if(phase==='BELUM_BERJALAN')result.message='Periode belum berjalan. Kategori dan tindak lanjut belum final.';
    if(result.category==='DISPENSASI LANJUT')result.message+=(result.message?' ':'')+'Jika kategori akhir DISPENSASI, minimal 80 pada bulan '+scoreMonthOffset_(month,1)+'.';
    if(raw.total===80)result.message+=(result.message?' ':'')+'Tepat 80 memenuhi minimum tindak lanjut, tetapi kategorinya tetap DISPENSASI.';
    return cache[key]=result;
  }
  var outcome=decide(report,0);report.category=outcome.category;report.evaluation=outcome;return report;
}
function getScoreReport_(month, salesId) {
  getCurrentUserInfo_(); assertOwnSales_(salesId); scoreMonth_(month);
  var data=scoreContext_(true);return scoreApplyEvaluation_(data,scoreBuildReport_(data,month,salesId));
}
function scoreBuildReport_(data, month, salesId, prepared) {
  if(typeof periodContext_==='function'){var originalData=data;data=periodContext_(data,month);if(data!==originalData&&prepared)prepared={ledger:prepared.ledger,mapping:scoreMapping_(data),transactionsBySales:prepared.transactionsBySales};}
  var sales = scoreSales_(data, salesId), ledger = prepared ? prepared.ledger : scoreLedger_(data.events), mapping = prepared&&prepared.mapping ? prepared.mapping : scoreMapping_(data);
  var today = scoreToday_(), start = month + '-01', end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  var holidayName = ['HOLIDAYS', 'HARI_LIBUR', 'LIBUR'].filter(function(n) { return !!data.meta[n]; })[0], holidays = Object.create(null);
  if(data.periodCalendarVerified===false){holidayName='';}
  else if (data.periodHolidays) {data.periodHolidays.forEach(function(row){holidays[scoreDate_(row.date)]=true;});holidayName='Snapshot periode';}
  else if (holidayName) {
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
  var brandingEnabled = scoreBrandingTeam_(sales.team_name), dailyBranding = [], totalBranding = 0;
  if (brandingEnabled) calendar.dates.forEach(function(day) {
    var event = ledger.latest['BRANDING:' + normalizeKey_(salesId) + ':' + day.date], count = event ? event.payload.count : null;
    if (event && (!Number.isSafeInteger(count) || count < 0 || event.payload.salesId !== normalizeKey_(salesId) || event.payload.date !== day.date)) throw new Error('Histori branding tidak valid.');
    if (day.date <= today && count !== null) { totalBranding += count; if (!Number.isSafeInteger(totalBranding)) throw new Error('Total branding terlalu besar.'); }
    dailyBranding.push({ date: day.date, isWorkDay: day.isWorkDay, count: count, revision: event ? event.event_id : '', actor: event ? event.actor : '', updatedAt: event ? event.updatedAt : '' });
  });
  var totals = [0, 0, 0, totalAA], products = Object.create(null);
  mapping.products.forEach(function(p) { products[p.productId] = p; });
  // No persisted report snapshot: committed transaction edits are reflected on reload.
  if (mapping.ready) {
    if (!data.meta.SALES_TRANSACTIONS) throw new Error('Sheet SALES_TRANSACTIONS tidak tersedia.');
    var transactionRows = prepared ? (prepared.transactionsBySales[normalizeKey_(salesId)] || []) : txTable_('SALES_TRANSACTIONS', data.raw.SALES_TRANSACTIONS, ['sales_id', 'transaction_date', 'product_id', 'quantity', 'selling_price'], false).rows;
    transactionRows.forEach(function(row) {
      if (normalizeKey_(row.sales_id) !== normalizeKey_(salesId)) return;
      var date = scoreDate_(row.transaction_date);
      if (date.slice(0, 7) !== month || date > today) return;
      var p = products[scoreCanonicalProductId_(row.product_id)];
      if (!p) throw new Error('Kode produk transaksi ' + row.product_id + ' tidak ada di master PRODUCTS; periksa master sebelum menilai.');
      var qty = txNumber_(row.quantity, 'Jumlah transaksi');
      if (!Number.isSafeInteger(qty) || qty===0 || (row._kch_adjustment===true?qty>0:qty<0)) throw new Error('Jumlah transaksi tidak valid; periksa faktur ' + (row.transaction_id || '') + '.');
      var amount = row.subtotal_sales !== undefined && row.subtotal_sales !== '' ? (row._kch_adjustment===true?reportMoney_:txMoney_)(row.subtotal_sales, 'Subtotal transaksi') : txMoney_(row.selling_price, 'Harga transaksi') * qty;
      if (!Number.isSafeInteger(amount)) throw new Error('Nilai transaksi terlalu besar.');
      if (p.group === 'FOCUS_A') totals[0] += amount;
      if (p.group === 'FOCUS_B') totals[1] += amount;
      if (p.group !== 'EXCLUDE') totals[2] += amount;
    });
  }
  for (var i = 0; i < 3; i++) { if (!Number.isSafeInteger(totals[i])) throw new Error('Total transaksi terlalu besar.'); totals[i] /= 100; }
  if (brandingEnabled) totals.push(totalBranding);
  var parameters = mapping.ready ? scoreParameters_(totals, sales.team_name,periodPolicy_(data)) : [], total = parameters.reduce(function(sum, p) { return sum + p.score; }, 0);
  if(data.masterVerified===false){parameters.forEach(function(p){p.target=null;p.achievement=null;p.points=null;p.score=null;});total=null;}
  var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1));
  return { success: true, policy:periodPolicy_(data),policySignature:periodPolicySignature_(periodPolicy_(data)), evaluationRule:scoreEvaluationRule_(month,data.scoreEvaluationPolicy), masterVerified:data.masterVerified!==false, mappingReady: mapping.ready, month: month, sales: { salesId: String(sales.sales_id), name: String(sales.full_name), team: String(sales.team_name) },
    parameters: parameters, total: mapping.ready ? total : null, category: mapping.ready && total!==null ? scoreCategory_(total,periodPolicy_(data),month,data.scoreEvaluationPolicy) : null,
    nextMonth: months[next.getUTCMonth()] + ' ' + next.getUTCFullYear(), holidaySource: holidayName || '', workDays: calendar.workDays,
    workDaysPassed: daily.filter(function(d) { return d.isWorkDay && d.date <= today; }).length,
    brandingEnabled: brandingEnabled, dailyBranding: dailyBranding, totalBranding: totalBranding,
    brandingEnteredDays: dailyBranding.filter(function(d) { return d.count !== null && d.date <= today; }).length,
    dailyAA: daily, totalAA: totalAA, enteredDays: daily.filter(function(d) { return d.count !== null && d.date <= today; }).length,
    message: data.masterVerified===false?'Master periode belum diverifikasi; target/skor historis belum disahkan.':mapping.ready ? '' : 'Periksa master produk: ' + mapping.issues.join('; ') };
}

// Recap reads one shared spreadsheet snapshot, never one network request per sales.
function scorePriceQuote_(data, prices, productId, teamName, remainingCents) {
  var product = txUnique_(data.products, function(p) { return scoreCanonicalProductId_(p.product_id) === productId; }, 'Produk ' + productId);
  if (!txActive_(product)) throw new Error(product.product_name + ': produk tidak aktif.');
  var rows = prices.filter(function(p) { return scoreCanonicalProductId_(p.product_id) === productId && txTeamKey_(p.team_name) === txTeamKey_(teamName) && txActive_(p); });
  if (rows.length !== 1) throw new Error(product.product_name + ': harga aktif untuk tim ' + teamName + (rows.length ? ' terdaftar ganda.' : ' belum tersedia.'));
  var price = txMoney_(rows[0].selling_price, 'Harga ' + product.product_name);
  if (!price) throw new Error(product.product_name + ': harga jual harus lebih dari nol.');
  var priceUnit = String(rows[0].unit || '').trim(), productUnit = String(product.unit || '').trim();
  if (priceUnit && productUnit && normalizeKey_(priceUnit) !== normalizeKey_(productUnit)) throw new Error(product.product_name + ': satuan PRODUCTS dan PRICE_MASTER berbeda.');
  var unit = priceUnit || productUnit;
  if (!unit) throw new Error(product.product_name + ': satuan harga belum tersedia.');
  return { productId: productId, productName: String(product.product_name), unit: unit.toLowerCase(), unitPrice: price / 100, quantity: Math.ceil(remainingCents / price) };
}
function scoreGuidance_(data, prices, report, priceError) {
  return report.parameters.map(function(p, i) {
    var remaining = Math.max(0, p.target - p.actual), note = { label: ['Fokus A', 'Fokus B', 'Total Value', 'AA', 'Branding'][i], remaining: remaining, count: i >= 3, alternatives: [], warnings: [] };
    if (i >= 2 || !remaining) return note;
    if (priceError) { note.warnings.push(priceError); return note; }
    var cents = txMoney_(remaining, 'Sisa target');
    function quote(id) {
      try { return scorePriceQuote_(data, prices, id, report.sales.team, cents); }
      catch (err) { note.warnings.push(err.message); return null; }
    }
    if (i === 0) { var bejo = quote('LBMAV'); if (bejo) note.alternatives.push(bejo); }
    else {
      // Keep sachet and tube as separate alternatives, each covering the full combined gap.
      [['Komix Herbal Sachet', ['LKXOD', 'LKXJA', 'LKXNA', 'LKXPA']], ['Komix Tube', ['LKXOB', 'LKXLA']]].forEach(function(group) {
        var quotes = [];
        group[1].forEach(function(id) {
          try { quotes.push(scorePriceQuote_(data, prices, id, report.sales.team, cents)); }
          catch (err) { /* An unavailable variant must not borrow another team's price. */ }
        });
        if (!quotes.length) { note.warnings.push(group[0] + ': belum ada harga dan satuan aktif yang valid untuk tim ini.'); return; }
        var reference = quotes[0];
        reference.displayName = group[0];
        if (quotes.some(function(q) { return q.unitPrice !== reference.unitPrice || q.unit !== reference.unit; })) reference.displayName += ' (' + reference.productName + ')';
        note.alternatives.push(reference);
      });
      var promag = quote('LPRGR'); if (promag) note.alternatives.push(promag);
    }
    return note;
  });
}
function getScoreTeamSummary_(month) {
  var user = getCurrentUserInfo_();
  if (['ADMIN', 'GUEST'].indexOf(user.role) < 0) throw new Error('ACCESS_DENIED: Rekap seluruh tim hanya tersedia untuk Admin dan Tamu.');
  scoreMonth_(month);
  var data = scoreContext_(true, true);if(typeof periodContext_==='function')data=periodContext_(data,month);var prepared = { ledger: scoreLedger_(data.events), mapping: scoreMapping_(data), transactionsBySales: Object.create(null) };
  if (data.meta.SALES_TRANSACTIONS) txTable_('SALES_TRANSACTIONS', data.raw.SALES_TRANSACTIONS, ['sales_id', 'transaction_date', 'product_id', 'quantity', 'selling_price'], false).rows.forEach(function(row) {
    var id = normalizeKey_(row.sales_id); if (!prepared.transactionsBySales[id]) prepared.transactionsBySales[id] = []; prepared.transactionsBySales[id].push(row);
  });
  var prices = [], priceError = '';
  try {
    if (!data.meta.PRICE_MASTER) throw new Error('PRICE_MASTER belum tersedia; estimasi jumlah produk belum dapat dihitung.');
    prices = txTable_('PRICE_MASTER', data.raw.PRICE_MASTER, ['product_id', 'team_name', 'selling_price'], false).rows;
  } catch (err) { priceError = err.message; }
  var rows = data.sales.filter(scoreEligible_).map(function(sales) {
    var row = { sales: { salesId: String(sales.sales_id), name: String(sales.full_name), team: String(sales.team_name) }, active: txActive_(sales), parameters: [], total: null, category: null, guidance: [], message: '' };
    try {
      var report = scoreApplyEvaluation_(data,scoreBuildReport_(data, month, sales.sales_id, prepared),prepared);
      row.parameters = report.parameters; row.total = report.total; row.category = report.category; row.message = report.message;row.evaluation=report.evaluation;
      if (report.mappingReady && report.masterVerified!==false) row.guidance = scoreGuidance_(data, prices, report, priceError);
    } catch (err) { row.message = err.message; }
    return row;
  });
  rows.sort(function(a, b) { if (a.total === null && b.total !== null) return 1; if (a.total !== null && b.total === null) return -1; return (b.total || 0) - (a.total || 0) || a.sales.name.localeCompare(b.sales.name); });
  return { success: true, month: month, rows: rows, priceBasis: 'Harga jual aktif PRICE_MASTER sesuai tim dan satuan master saat rekap dimuat. Jumlah dibulatkan ke atas; alternatif Fokus B bukan kewajiban ganda.' };
}
