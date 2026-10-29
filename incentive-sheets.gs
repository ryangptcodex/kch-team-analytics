// Generated incentive reports, refreshed only by the native admin Sheet updater.
var KCH_INCENTIVE_SHEET_SCHEMAS_ = {
  INSENTIF_HARIAN: ['month','date','sales_id','sales_name','team_name','is_work_day','total_value','base_incentive','payout_percent','paid_incentive','calendar_status','as_of','period_status','promag_tablet_value','senior_sales_id','senior_sales_name','allocation_percent','reference_total_value','reference_promag_tablet_value'],
  INSENTIF_BULANAN: ['month','sales_id','sales_name','team_name',
    'focus_a_actual','focus_a_target','focus_a_tier','focus_a_base','focus_a_paid',
    'focus_b_actual','focus_b_target','focus_b_tier','focus_b_base','focus_b_paid',
    'total_value_actual','total_value_target','total_value_tier','total_value_base','total_value_paid',
    'aa_actual','aa_target','aa_tier','aa_base','aa_paid','aa_entered_days',
    'daily_base','daily_paid','monthly_base','monthly_paid','combined_base','payout_percent','combined_paid','minimum_value_70pct','as_of','period_status','branding_actual','branding_target','branding_tier','branding_base','branding_paid','branding_entered_days','senior_sales_id','senior_sales_name','allocation_percent','gate_focus_a_70pct','gate_focus_b_70pct','gate_total_value_70pct'],
  INSENTIF_TRIWULAN: ['year','quarter','sales_id','sales_name','team_name','total_value','target_value','achievement_percent','months_reached_100pct','tier_percent','quarter_bonus',
    'month_1','month_1_actual','month_1_target','month_1_achievement_percent',
    'month_2','month_2_actual','month_2_target','month_2_achievement_percent',
    'month_3','month_3_actual','month_3_target','month_3_achievement_percent','quarter_end','as_of','period_status','senior_sales_id','senior_sales_name','allocation_percent','senior_total_value','senior_target_value']
};

function kchIncentiveSheetRows_(data) {
  var today = scoreToday_(), currentMonth = today.slice(0, 7), start = Date.now();
  var shared = { mapping: scoreMapping_(data), ledger: scoreLedger_(data.events), transactionsBySales: Object.create(null) };
  if (!shared.mapping.ready) throw new Error('Insentif: periksa master produk: ' + shared.mapping.issues.join('; '));
  if (!data.meta.SALES_TRANSACTIONS) throw new Error('Insentif: SALES_TRANSACTIONS belum tersedia.');
  var sales = data.sales.filter(incentiveEligible_).sort(function(a,b) { return String(a.sales_id).localeCompare(String(b.sales_id)); });
  var known = Object.create(null), firstMonth = Object.create(null);
  sales.forEach(function(s) {
    var id = normalizeKey_(s.sales_id);
    if (!id || known[id]) throw new Error('Insentif: master SALES memiliki ID kosong/ganda.');
    known[id] = true; firstMonth[id] = currentMonth;
  });
  txTable_('SALES_TRANSACTIONS', data.raw.SALES_TRANSACTIONS, ['sales_id','transaction_date','product_id','quantity','selling_price'], false).rows.forEach(function(row) {
    var id = normalizeKey_(row.sales_id); if (!known[id]) return;
    var date = scoreDate_(row.transaction_date); if (date > today) return;
    (shared.transactionsBySales[id] || (shared.transactionsBySales[id] = [])).push(row);
    if (date.slice(0,7) < firstMonth[id]) firstMonth[id] = date.slice(0,7);
  });
  Object.keys(shared.ledger.latest).forEach(function(key) {
    var prefix = key.indexOf('AA:')===0 ? 'AA:' : key.indexOf('BRANDING:')===0 ? 'BRANDING:' : '';
    if (!prefix) return;
    var p = shared.ledger.latest[key].payload, id = key.slice(prefix.length,-11);
    if (!known[id]) return;
    var date = scoreDate_(key.slice(-10));
    if (p.salesId !== id || scoreDate_(p.date) !== date || !Number.isSafeInteger(p.count) || p.count < 0) throw new Error('Insentif: histori AA tidak cocok dengan scope sales/tanggal.');
    if (date <= today && date.slice(0,7) < firstMonth[id]) firstMonth[id] = date.slice(0,7);
  });
  sales.filter(incentiveJunior_).forEach(function(s) { firstMonth[normalizeKey_(s.sales_id)] = firstMonth[normalizeKey_(incentiveSourceSales_(data,s).sales_id)]; });
  var result = { INSENTIF_HARIAN: [], INSENTIF_BULANAN: [], INSENTIF_TRIWULAN: [] }, count = 0;
  function push(name, row) {
    if (++count > 150000 || Date.now() - start > 150000) throw new Error('Riwayat Insentif terlalu besar untuk satu pembaruan; tidak ada hasil yang ditulis.');
    result[name].push(row);
  }
  sales.forEach(function(s) {
    var id = normalizeKey_(s.sales_id), month = scoreMonth_(firstMonth[id]), quarters = Object.create(null);
    while (month <= currentMonth) {
      var r = incentiveBuildReport_(data, month, id, shared), m = r.monthly, q = r.quarter, source = r.referenceSales || r.sales, allocation = (r.allocationFactor||1)*100;
      var identity = [month,r.sales.salesId,r.sales.name,r.sales.team], state = r.monthlyClosed ? 'SELESAI' : 'ESTIMASI';
      r.daily.forEach(function(d) {
        push('INSENTIF_HARIAN', [month,d.date,r.sales.salesId,r.sales.name,r.sales.team,d.isWorkDay,d.value,
          r.dailyTotal === null || d.scheduled === null ? '' : d.scheduled,m.payoutFactor*100,
          r.dailyTotal === null || d.amount === null ? '' : d.amount,r.dailyTotal === null ? 'Kalender libur belum tersedia' : d.status,r.today,state,d.tabletValue,source.salesId,source.name,allocation,d.referenceValue,d.referenceTabletValue]);
      });
      var monthly = identity.slice();
      m.parameters.slice(0,4).forEach(function(p) { monthly = monthly.concat([p.actual,p.target,p.tier,p.scheduled,p.amount]); });
      push('INSENTIF_BULANAN', monthly.concat([m.aaEnteredDays,r.dailyScheduledTotal === null ? '' : r.dailyScheduledTotal,r.dailyTotal === null ? '' : r.dailyTotal,
        m.scheduledTotal,m.total,r.monthSubtotal === null ? '' : r.monthSubtotal,m.payoutFactor*100,r.monthTotal === null ? '' : r.monthTotal,m.minimumValue,r.today,state].concat(m.parameters[4] ? [m.parameters[4].actual,m.parameters[4].target,m.parameters[4].tier,m.parameters[4].scheduled,m.parameters[4].amount] : ['','','','',''], [m.brandingEnteredDays||0,source.salesId,source.name,allocation], [0,1,2].map(function(i){return r.isJunior?'':m.gateChecks.length===3?m.gateChecks[i].minimum:i===2?m.minimumValue:'';}))));
      var quarterKey = q.year + '-TW' + q.number;
      if (!quarters[quarterKey]) {
        quarters[quarterKey] = true;
        var qr = [q.year,'TW'+q.number,r.sales.salesId,r.sales.name,r.sales.team,q.actual,q.target,q.achievement===null?'':q.achievement*100,q.reachedMonths,q.tier,q.amount];
        q.months.forEach(function(v) { qr = qr.concat([v.month,v.actual,v.target,v.achievement===null?'':v.achievement*100]); });
        push('INSENTIF_TRIWULAN', qr.concat([q.end,r.today,q.closed ? 'SELESAI' : 'ESTIMASI',source.salesId,source.name,allocation,r.isJunior?r.referenceQuarter.actual:q.actual,r.isJunior?r.referenceQuarter.target:q.target]));
      }
      var y = Number(month.slice(0,4)), n = Number(month.slice(5,7));
      month = n === 12 ? String(y+1)+'-01' : String(y)+'-'+('0'+(n+1)).slice(-2);
    }
  });
  return result;
}

function kchIncentiveSyncPlan_(ss, meta, ctx) {
  var previous = KCH_REQUEST_USER_, rows;
  try {
    // Entry point already checked native admin email, target ID, lock and pending writes.
    KCH_REQUEST_USER_ = {role:'ADMIN',email:KCH_BOOTSTRAP_ADMIN_EMAIL_,salesId:''};
    rows = kchIncentiveSheetRows_(scoreContext_(true));
  } finally { KCH_REQUEST_USER_ = previous; }
  var requests = [], changes = [];
  Object.keys(KCH_INCENTIVE_SHEET_SCHEMAS_).forEach(function(name) {
    var headers = KCH_INCENTIVE_SHEET_SCHEMAS_[name], values = rows[name], p = meta[name], sheet = ss.getSheetByName(name);
    if (!p) throw new Error(name + ': rencana struktur belum disiapkan.');
    var oldRows = sheet ? sheet.getLastRow() : 1;
    if (sheet && oldRows > 1) {
      // Check original header positions too: newly inserted canonical columns can
      // shift existing custom notes, even when the old width is smaller.
      var originalHeaders = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
      originalHeaders.forEach(function(h, column) {
        if (headers.indexOf(h) >= 0) return;
        var extra = sheet.getRange(2,column+1,oldRows-1,1).getDisplayValues();
        if (extra.some(function(row) { return row[0] !== ''; })) throw new Error(name + ': ada data tambahan manual di luar kolom laporan. Pindahkan dahulu; data tidak diubah.');
      });
    }
    var neededRows = Math.max(oldRows, values.length+1), grid = p.gridProperties || {};
    if (neededRows > grid.rowCount || headers.length > grid.columnCount) requests.push({updateSheetProperties:{properties:{sheetId:p.sheetId,gridProperties:{rowCount:Math.max(neededRows,grid.rowCount||1000),columnCount:Math.max(headers.length,grid.columnCount||20)}},fields:'gridProperties.rowCount,gridProperties.columnCount'}});
    if (neededRows > 1) requests.push({updateCells:{range:{sheetId:p.sheetId,startRowIndex:1,endRowIndex:neededRows,startColumnIndex:0,endColumnIndex:headers.length},rows:[],fields:'userEnteredValue'}});
    for (var i=0;i<values.length;i+=500) requests.push(txUpdate_(p.sheetId,i+1,0,values.slice(i,i+500)));
    requests.push({updateSheetProperties:{properties:{sheetId:p.sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}});
    changes.push(name + ': ' + values.length + ' baris laporan diperbarui (bukan ditambahkan ganda).');
  });
  if (JSON.stringify(requests).length > 8000000) throw new Error('Laporan Insentif terlalu besar untuk satu batch; pembaruan dibatalkan.');
  return {requests:requests,changes:changes};
}
