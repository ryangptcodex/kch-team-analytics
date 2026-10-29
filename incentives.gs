// Incentives for field teams and paired Junior/Assistants. Read-only source calculations.
function incentiveEligible_(sales) { return ['MOTORIS', 'MMTW', 'MPR', 'CANVASSER', 'JUNIOR CANVASSER', 'ASISTEN MPR'].indexOf(txTeamKey_(sales.team_name)) >= 0; }
function incentiveAccess_() {
  if (typeof incentiveJunior_ !== 'function') throw new Error('Pasang Script canvasser-incentives.gs terbaru untuk membuka Insentif.');
  if (['ADMIN', 'GUEST'].indexOf(getCurrentUserInfo_().role) < 0) throw new Error('ACCESS_DENIED: Insentif hanya dapat dibaca Admin dan Tamu.');
}
function getIncentiveSetup_() {
  incentiveAccess_();
  var data = scoreContext_(false);
  return { success: true, today: scoreToday_(), sales: data.sales.filter(incentiveEligible_).map(function(s) {
    return { salesId: String(s.sales_id), name: String(s.full_name), team: String(s.team_name), active: txActive_(s) };
  }).sort(function(a, b) { return a.name.localeCompare(b.name); }) };
}
function incentiveDailyRate_(value) {
  // Input is integer minor units (rupiah cents); exactly 1.5m remains 30k.
  if (value > 150000000) return 50000;
  if (value >= 120000000) return 30000;
  if (value >= 100000000) return 20000;
  if (value >= 80000000) return 10000;
  return 0;
}
function incentiveLevel_(actual, target, levels) {
  var level = 0;
  levels.forEach(function(n) { if (actual >= target * n / 100) level = n; });
  return level;
}
function incentiveMonthly_(report) {
  var senior = incentiveSenior_({team_name:report.sales.team});
  var tariffs = senior ? [[400000,600000,800000],[250000,375000,500000],[250000,375000,500000],[50000,75000,100000],[50000,75000,100000]] : [[200000, 400000, 500000], [125000, 250000, 312500], [125000, 250000, 312500], [50000, 100000, 125000]];
  var tv = report.parameters[2], gateChecks = (senior ? report.parameters.slice(0,3) : [tv]).map(function(p) { return {name:p.name,actual:p.actual,minimum:p.target*0.7,reached:txMoney_(p.actual,'Aktual')>=txMoney_(p.target,'Target')*0.7}; });
  var eligible = gateChecks.every(function(g) { return g.reached; });
  var parameters = report.parameters.map(function(p, i) {
    var actual = i < 3 ? txMoney_(p.actual, 'Aktual') : p.actual, target = i < 3 ? txMoney_(p.target, 'Target') : p.target;
    var tier = incentiveLevel_(actual, target, [90, 100, 110]), earned = tier ? tariffs[i][[90, 100, 110].indexOf(tier)] : 0;
    return { name: p.name, actual: p.actual, target: p.target, achievement: p.achievement, tier: tier,
      scheduled: earned, amount: earned * (eligible ? 1 : 0.5), tariffs: tariffs[i] };
  });
  return { gateChecks:gateChecks, brandingTotal:report.totalBranding||0, brandingEnteredDays:report.brandingEnteredDays||0, eligible: eligible, payoutFactor: eligible ? 1 : 0.5, minimumValue: tv.target * 0.7, actualValue: tv.actual,
    parameters: parameters, scheduledTotal: parameters.reduce(function(sum, p) { return sum + p.scheduled; }, 0), total: parameters.reduce(function(sum, p) { return sum + p.amount; }, 0),
    aaEnteredDays: report.enteredDays, aaTotal: report.totalAA };
}
function incentiveQuarter_(month) {
  var first = Math.floor((Number(month.slice(5, 7)) - 1) / 3) * 3 + 1, year = month.slice(0, 4);
  var months = [first, first + 1, first + 2].map(function(n) { return year + '-' + ('0' + n).slice(-2); });
  return { number: Math.ceil(first / 3), year: Number(year), months: months,
    end: new Date(Date.UTC(Number(year), first + 2, 0)).toISOString().slice(0, 10) };
}
function getIncentiveReport_(month, salesId) {
  incentiveAccess_(); assertOwnSales_(salesId); scoreMonth_(month);
  return incentiveBuildReport_(scoreContext_(true), month, salesId);
}
function incentiveBuildReport_(data, month, salesId, shared) {
  assertOwnSales_(salesId);
  var sales = txUnique_(data.sales,function(s){return normalizeKey_(s.sales_id)===normalizeKey_(salesId);},'Sales');
  if (incentiveJunior_(sales)) return incentiveJuniorReport_(data,month,sales,shared);
  if (!incentiveEligible_(sales)) throw new Error('Juklak insentif tim ini belum ditetapkan.');
  var senior = incentiveSenior_(sales); if (senior) incentiveLoadingReady_(data);
  var mapping = shared ? shared.mapping : scoreMapping_(data);
  if (!mapping.ready) throw new Error('Periksa master produk: ' + mapping.issues.join('; '));
  if (!data.meta.SALES_TRANSACTIONS) throw new Error('Sheet SALES_TRANSACTIONS tidak tersedia.');
  var rows = shared ? (shared.transactionsBySales[normalizeKey_(salesId)] || []) : txTable_('SALES_TRANSACTIONS', data.raw.SALES_TRANSACTIONS, ['sales_id', 'transaction_date', 'product_id', 'quantity', 'selling_price'], false).rows.filter(function(r) { return normalizeKey_(r.sales_id) === normalizeKey_(salesId); });
  var prepared = {ledger:shared?shared.ledger:scoreLedger_(data.events),mapping:mapping,transactionsBySales:Object.create(null)};
  prepared.transactionsBySales[normalizeKey_(salesId)] = senior ? rows.filter(function(r){return KCH_CANVASSER_LOADING_.indexOf(scoreCanonicalProductId_(r.product_id))>=0;}) : rows;
  var quarter = incentiveQuarter_(month), reports = quarter.months.map(function(m) { return scoreBuildReport_(data, m, salesId, prepared); });
  var report = reports[quarter.months.indexOf(month)], today = scoreToday_(), values = Object.create(null), tablets = Object.create(null), products = Object.create(null);
  mapping.products.forEach(function(p) { products[p.productId] = p; });
  // scoreBuildReport_ validates the same rows/amounts first. Aggregate invoices by day,
  // not one incentive per invoice, and exclude only Promag Tablet invoice lines.
  rows.forEach(function(row) {
    var date = scoreDate_(row.transaction_date);
    if (date.slice(0, 7) !== month || date > today) return;
    var code = scoreCanonicalProductId_(row.product_id);
    if (senior ? KCH_CANVASSER_LOADING_.indexOf(code)<0 && code!=='LPRGN' : products[code].group==='EXCLUDE') return;
    var qty = txNumber_(row.quantity,'Jumlah transaksi');
    if (!Number.isSafeInteger(qty) || qty<=0) throw new Error('Jumlah transaksi tidak valid; periksa faktur '+(row.transaction_id||''));
    var amount = row.subtotal_sales !== undefined && row.subtotal_sales !== '' ? txMoney_(row.subtotal_sales, 'Subtotal transaksi') : txMoney_(row.selling_price, 'Harga transaksi') * txNumber_(row.quantity, 'Jumlah transaksi');
    var bucket = senior && code==='LPRGN' ? tablets : values;
    bucket[date] = (bucket[date] || 0) + amount;
    if (!Number.isSafeInteger(bucket[date])) throw new Error('Total harian terlalu besar.');
  });
  var daily = report.dailyAA.map(function(day) {
    var future = day.date > today, value = values[day.date] || 0;
    var sunday = new Date(day.date + 'T00:00:00Z').getUTCDay() === 0;
    return { date: day.date, isWorkDay: day.isWorkDay, value: value / 100, tabletValue:(tablets[day.date]||0)/100,
      amount: future ? null : (report.holidaySource && day.isWorkDay ? (senior ? incentiveCanvasserDailyRate_(value,tablets[day.date]||0) : incentiveDailyRate_(value)) : 0),
      status: future ? 'Belum berjalan' : !day.isWorkDay ? (sunday ? 'Minggu' : 'Libur') : !report.holidaySource ? 'Kalender libur belum tersedia' : value ? 'Hari kerja · berdasarkan transaksi' : 'Belum ada penjualan' };
  });
  var dailyTotal = report.holidaySource ? daily.reduce(function(sum, d) { return sum + (d.amount || 0); }, 0) : null;
  var quarterMonths = reports.map(function(r) { var p = r.parameters[2]; return { month: r.month, actual: p.actual, target: p.target, achievement: p.achievement, reached: txMoney_(p.actual, 'Total Value') >= txMoney_(p.target, 'Target') }; });
  var quarterActual = quarterMonths.reduce(function(sum, m) { return sum + txMoney_(m.actual, 'Total Value'); }, 0);
  if (!Number.isSafeInteger(quarterActual)) throw new Error('Akumulasi triwulan terlalu besar.');
  var quarterTarget = quarterMonths.reduce(function(sum, m) { return sum + txMoney_(m.target, 'Target'); }, 0);
  var tier = incentiveLevel_(quarterActual, quarterTarget, [100, 110, 120]), reached = quarterMonths.filter(function(m) { return m.reached; }).length;
  var payouts = senior ? {3:[3000000,3250000,3500000],2:[2000000,2125000,2250000],1:[1000000,1125000,1250000]} : { 3: [2000000, 2100000, 2200000], 2: [1000000, 1050000, 1100000], 1: [500000, 525000, 550000] };
  var quarterAmount = tier && reached ? payouts[reached][[100, 110, 120].indexOf(tier)] : 0;
  var monthly = incentiveMonthly_(report), monthEnd = report.dailyAA[report.dailyAA.length - 1].date;
  var dailyScheduledTotal = dailyTotal;
  daily.forEach(function(d) { d.scheduled = d.amount; if (d.amount !== null) d.amount *= monthly.payoutFactor; });
  if (dailyTotal !== null) dailyTotal *= monthly.payoutFactor;
  var monthSubtotal = dailyScheduledTotal === null ? null : dailyScheduledTotal + monthly.scheduledTotal;
  return { success: true, isJunior:false, allocationFactor:1, policy:senior?'LOADING':'ALL_NON_TABLET', month: month, today: today, sales: report.sales, monthlyClosed: today > monthEnd,
    workDays: report.workDays, holidaySource: report.holidaySource,
    daily: daily, dailyScheduledTotal: dailyScheduledTotal, dailyTotal: dailyTotal, paidDays: daily.filter(function(d) { return d.amount > 0; }).length,
    monthly: monthly, monthSubtotal: monthSubtotal, payoutFactor: monthly.payoutFactor,
    monthTotal: monthSubtotal === null ? null : monthSubtotal * monthly.payoutFactor,
    quarter: { number: quarter.number, year: quarter.year, months: quarterMonths, end: quarter.end, closed: today > quarter.end,
      actual: quarterActual / 100, target: quarterTarget / 100, achievement: quarterActual / quarterTarget, reachedMonths: reached, tier: tier, amount: quarterAmount },
    warnings: (report.holidaySource ? [] : ['Sheet HOLIDAYS belum tersedia; insentif harian belum dapat dipastikan.'])
      .concat(['AA mengikuti input harian admin yang tersedia; hari belum diinput belum menambah aktual.', 'Insentif periode berjalan adalah estimasi. Triwulan ditampilkan terpisah agar tidak dihitung tiga kali.']) };
}
