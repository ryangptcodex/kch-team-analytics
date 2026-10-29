// Motoris/MMTW incentives. Read-only estimates from the same snapshot/rules as Skor.
function incentiveEligible_(sales) { return ['MOTORIS', 'MMTW'].indexOf(txTeamKey_(sales.team_name)) >= 0; }
function incentiveAccess_() {
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
  var tariffs = [[200000, 400000, 500000], [125000, 250000, 312500], [125000, 250000, 312500], [50000, 100000, 125000]];
  var tv = report.parameters[2], eligible = txMoney_(tv.actual, 'Total Value') >= txMoney_(tv.target, 'Target Total Value') * 0.7;
  var parameters = report.parameters.map(function(p, i) {
    var actual = i < 3 ? txMoney_(p.actual, 'Aktual') : p.actual, target = i < 3 ? txMoney_(p.target, 'Target') : p.target;
    var tier = incentiveLevel_(actual, target, [90, 100, 110]), earned = tier ? tariffs[i][[90, 100, 110].indexOf(tier)] : 0;
    return { name: p.name, actual: p.actual, target: p.target, achievement: p.achievement, tier: tier,
      scheduled: earned, amount: earned * (eligible ? 1 : 0.5), tariffs: tariffs[i] };
  });
  return { eligible: eligible, payoutFactor: eligible ? 1 : 0.5, minimumValue: tv.target * 0.7, actualValue: tv.actual,
    parameters: parameters, total: parameters.reduce(function(sum, p) { return sum + p.amount; }, 0),
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
  var data = scoreContext_(true), sales = scoreSales_(data, salesId);
  if (!incentiveEligible_(sales)) throw new Error('Insentif ini hanya untuk Motoris dan MMTW. Juklak tim lain belum ditetapkan.');
  var mapping = scoreMapping_(data);
  if (!mapping.ready) throw new Error('Periksa master produk: ' + mapping.issues.join('; '));
  if (!data.meta.SALES_TRANSACTIONS) throw new Error('Sheet SALES_TRANSACTIONS tidak tersedia.');
  var rows = txTable_('SALES_TRANSACTIONS', data.raw.SALES_TRANSACTIONS, ['sales_id', 'transaction_date', 'product_id', 'quantity', 'selling_price'], false).rows.filter(function(r) { return normalizeKey_(r.sales_id) === normalizeKey_(salesId); });
  var prepared = { ledger: scoreLedger_(data.events), mapping: mapping, transactionsBySales: Object.create(null) };
  prepared.transactionsBySales[normalizeKey_(salesId)] = rows;
  var quarter = incentiveQuarter_(month), reports = quarter.months.map(function(m) { return scoreBuildReport_(data, m, salesId, prepared); });
  var report = reports[quarter.months.indexOf(month)], today = scoreToday_(), values = Object.create(null), products = Object.create(null);
  mapping.products.forEach(function(p) { products[p.productId] = p; });
  // scoreBuildReport_ validates the same rows/amounts first. Aggregate invoices by day,
  // not one incentive per invoice, and exclude only Promag Tablet invoice lines.
  rows.forEach(function(row) {
    var date = scoreDate_(row.transaction_date);
    if (date.slice(0, 7) !== month || date > today || products[normalizeKey_(row.product_id)].group === 'EXCLUDE') return;
    var amount = row.subtotal_sales !== undefined && row.subtotal_sales !== '' ? txMoney_(row.subtotal_sales, 'Subtotal transaksi') : txMoney_(row.selling_price, 'Harga transaksi') * txNumber_(row.quantity, 'Jumlah transaksi');
    values[date] = (values[date] || 0) + amount;
    if (!Number.isSafeInteger(values[date])) throw new Error('Total harian terlalu besar.');
  });
  var daily = report.dailyAA.map(function(day) {
    var future = day.date > today, value = values[day.date] || 0;
    var sunday = new Date(day.date + 'T00:00:00Z').getUTCDay() === 0;
    return { date: day.date, isWorkDay: day.isWorkDay, value: value / 100,
      amount: future ? null : (report.holidaySource && day.isWorkDay ? incentiveDailyRate_(value) : 0),
      status: future ? 'Belum berjalan' : !day.isWorkDay ? (sunday ? 'Minggu' : 'Libur') : !report.holidaySource ? 'Kalender libur belum tersedia' : value ? 'Hari kerja · berdasarkan transaksi' : 'Belum ada penjualan' };
  });
  var dailyTotal = report.holidaySource ? daily.reduce(function(sum, d) { return sum + (d.amount || 0); }, 0) : null;
  var quarterMonths = reports.map(function(r) { var p = r.parameters[2]; return { month: r.month, actual: p.actual, target: p.target, achievement: p.achievement, reached: txMoney_(p.actual, 'Total Value') >= txMoney_(p.target, 'Target') }; });
  var quarterActual = quarterMonths.reduce(function(sum, m) { return sum + txMoney_(m.actual, 'Total Value'); }, 0);
  if (!Number.isSafeInteger(quarterActual)) throw new Error('Akumulasi triwulan terlalu besar.');
  var quarterTarget = quarterMonths.reduce(function(sum, m) { return sum + txMoney_(m.target, 'Target'); }, 0);
  var tier = incentiveLevel_(quarterActual, quarterTarget, [100, 110, 120]), reached = quarterMonths.filter(function(m) { return m.reached; }).length;
  var payouts = { 3: [2000000, 2100000, 2200000], 2: [1000000, 1050000, 1100000], 1: [500000, 525000, 550000] };
  var quarterAmount = tier && reached ? payouts[reached][[100, 110, 120].indexOf(tier)] : 0;
  var monthly = incentiveMonthly_(report), monthEnd = report.dailyAA[report.dailyAA.length - 1].date;
  return { success: true, month: month, today: today, sales: report.sales, monthlyClosed: today > monthEnd,
    workDays: report.workDays, holidaySource: report.holidaySource,
    daily: daily, dailyTotal: dailyTotal, paidDays: daily.filter(function(d) { return d.amount > 0; }).length,
    monthly: monthly, monthTotal: dailyTotal === null ? null : dailyTotal + monthly.total,
    quarter: { number: quarter.number, year: quarter.year, months: quarterMonths, end: quarter.end, closed: today > quarter.end,
      actual: quarterActual / 100, target: quarterTarget / 100, achievement: quarterActual / quarterTarget, reachedMonths: reached, tier: tier, amount: quarterAmount },
    warnings: (report.holidaySource ? [] : ['Sheet HOLIDAYS belum tersedia; insentif harian belum dapat dipastikan.'])
      .concat(['AA mengikuti input harian admin yang tersedia; hari belum diinput belum menambah aktual.', 'Insentif periode berjalan adalah estimasi. Triwulan ditampilkan terpisah agar tidak dihitung tiga kali.']) };
}
