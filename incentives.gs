// Incentives for field teams and paired Junior/Assistants. Read-only source calculations.
function incentiveEligible_(sales) { return ['MOTORIS', 'MMTW', 'MPR', 'CANVASSER', 'JUNIOR CANVASSER', 'ASISTEN MPR'].indexOf(txTeamKey_(sales.team_name)) >= 0; }
function incentiveAccess_() {
  if (typeof incentiveJunior_ !== 'function') throw new Error('Pasang Script canvasser-incentives.gs terbaru untuk membuka Insentif.');
  if (['ADMIN', 'GUEST'].indexOf(getCurrentUserInfo_().role) < 0) throw new Error('ACCESS_DENIED: Insentif hanya dapat dibaca Admin dan Tamu.');
}
function getIncentiveSetup_(month) {
  incentiveAccess_();
  var data = scoreContext_(false);if(month){scoreMonth_(month);data=periodContext_(data,month);}
  return { success: true, today: scoreToday_(), sales: data.sales.filter(incentiveEligible_).map(function(s) {
    return { salesId: String(s.sales_id), name: String(s.full_name), team: String(s.team_name), active: txActive_(s) };
  }).sort(function(a, b) { return a.name.localeCompare(b.name); }) };
}
function incentiveDailyRate_(value,policy){
  var tiers=(policy||periodCurrentPolicy_()).dailyField;for(var i=0;i<tiers.length;i++){var t=tiers[i];if(t[2]?value>t[0]:value>=t[0])return t[1];}return 0;
}
function incentiveLevel_(actual, target, levels) {
  var level = 0;
  levels.forEach(function(n) { if (actual >= target * n / 100) level = n; });
  return level;
}
function incentiveMonthly_(report) {
  var senior = incentiveSenior_({team_name:report.sales.team});
  var policy=report.policy||periodCurrentPolicy_(),tariffs=senior?policy.tariffsSenior:policy.tariffsField;
  if(report.masterVerified===false)return {gateChecks:[],brandingTotal:report.totalBranding||0,brandingEnteredDays:report.brandingEnteredDays||0,eligible:false,payoutFactor:1,minimumValue:null,actualValue:report.parameters[2].actual,parameters:report.parameters.map(function(p,i){return {name:p.name,actual:p.actual,target:null,achievement:null,tier:null,scheduled:null,amount:null,tariffs:tariffs[i]};}),scheduledTotal:null,total:null,aaEnteredDays:report.enteredDays,aaTotal:report.totalAA};
  var tv = report.parameters[2], gateChecks = (senior ? report.parameters.slice(0,3) : [tv]).map(function(p) { return {name:p.name,actual:p.actual,minimum:p.target*policy.gate,reached:(typeof reportMoney_==='function'?reportMoney_:txMoney_)(p.actual,'Aktual')>=txMoney_(p.target,'Target')*policy.gate}; });
  var eligible = gateChecks.every(function(g) { return g.reached; });
  var parameters = report.parameters.map(function(p, i) {
    var actual = i < 3 ? (typeof reportMoney_==='function'?reportMoney_:txMoney_)(p.actual, 'Aktual') : p.actual, target = i < 3 ? txMoney_(p.target, 'Target') : p.target;
    var tier = incentiveLevel_(actual,target,policy.monthlyLevels), earned = tier ? tariffs[i][policy.monthlyLevels.indexOf(tier)] : 0;
    return { name: p.name, actual: p.actual, target: p.target, achievement: p.achievement, tier: tier,
      scheduled: earned, amount: earned * (eligible ? 1 : policy.reducedFactor), tariffs: tariffs[i] };
  });
  return { gateChecks:gateChecks, brandingTotal:report.totalBranding||0, brandingEnteredDays:report.brandingEnteredDays||0, eligible: eligible, payoutFactor: eligible ? 1 : policy.reducedFactor, minimumValue: tv.target * policy.gate, actualValue: tv.actual,
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
  if(typeof periodContext_==='function')data=periodContext_(data,month);
  assertOwnSales_(salesId);
  var sales = txUnique_(data.sales,function(s){return normalizeKey_(s.sales_id)===normalizeKey_(salesId);},'Sales');
  if (incentiveJunior_(sales)) return incentiveJuniorReport_(data,month,sales,shared);
  if (!incentiveEligible_(sales)) throw new Error('Juklak insentif tim ini belum ditetapkan.');
  var policy=periodPolicy_(data);var senior = incentiveSenior_(sales); if (senior) incentiveLoadingReady_(data);
  var mapping = shared&&!data._periodBase ? shared.mapping : scoreMapping_(data);
  if (!mapping.ready) throw new Error('Periksa master produk: ' + mapping.issues.join('; '));
  if (!data.meta.SALES_TRANSACTIONS) throw new Error('Sheet SALES_TRANSACTIONS tidak tersedia.');
  var rows = shared ? (shared.transactionsBySales[normalizeKey_(salesId)] || []) : txTable_('SALES_TRANSACTIONS', data.raw.SALES_TRANSACTIONS, ['sales_id', 'transaction_date', 'product_id', 'quantity', 'selling_price'], false).rows.filter(function(r) { return normalizeKey_(r.sales_id) === normalizeKey_(salesId); });
  var prepared = {ledger:shared?shared.ledger:scoreLedger_(data.events),mapping:mapping,transactionsBySales:Object.create(null)};
  prepared.transactionsBySales[normalizeKey_(salesId)] = senior ? rows.filter(function(r){return policy.loading.indexOf(scoreCanonicalProductId_(r.product_id))>=0;}) : rows;
  var quarter = incentiveQuarter_(month), reports = quarter.months.map(function(m) {
    var monthlyData=typeof periodContext_==='function'?periodContext_(data,m):data,member=monthlyData.sales.filter(function(s){return normalizeKey_(s.sales_id)===normalizeKey_(salesId);})[0];
    if(!member||!scoreEligible_(member)||incentiveSenior_(member)!==senior)return {month:m,masterVerified:false,parameters:[{},{},{actual:0,target:null,achievement:null}]};
    var monthlyPrepared={ledger:prepared.ledger,mapping:scoreMapping_(monthlyData),transactionsBySales:Object.create(null)},monthlyPolicy=periodPolicy_(monthlyData);monthlyPrepared.transactionsBySales[normalizeKey_(salesId)]=senior?rows.filter(function(r){return monthlyPolicy.loading.indexOf(scoreCanonicalProductId_(r.product_id))>=0;}):rows;
    return scoreBuildReport_(monthlyData,m,salesId,monthlyPrepared);
  });
  var report = reports[quarter.months.indexOf(month)], today = scoreToday_(), values = Object.create(null), tablets = Object.create(null), products = Object.create(null);
  mapping.products.forEach(function(p) { products[p.productId] = p; });
  // scoreBuildReport_ validates the same rows/amounts first. Aggregate invoices by day,
  // not one incentive per invoice, and exclude only Promag Tablet invoice lines.
  rows.forEach(function(row) {
    var date = scoreDate_(row.transaction_date);
    if (date.slice(0, 7) !== month || date > today) return;
    var code = scoreCanonicalProductId_(row.product_id);
    if (senior ? policy.loading.indexOf(code)<0 && code!=='LPRGN' : products[code].group==='EXCLUDE') return;
    var qty = txNumber_(row.quantity,'Jumlah transaksi');
    if (!Number.isSafeInteger(qty) || qty===0 || (row._kch_adjustment===true?qty>0:qty<0)) throw new Error('Jumlah transaksi tidak valid; periksa faktur '+(row.transaction_id||''));
    var amount = row.subtotal_sales !== undefined && row.subtotal_sales !== '' ? (row._kch_adjustment===true?reportMoney_:txMoney_)(row.subtotal_sales, 'Subtotal transaksi') : txMoney_(row.selling_price, 'Harga transaksi') * txNumber_(row.quantity, 'Jumlah transaksi');
    var bucket = senior && code==='LPRGN' ? tablets : values;
    bucket[date] = (bucket[date] || 0) + amount;
    if (!Number.isSafeInteger(bucket[date])) throw new Error('Total harian terlalu besar.');
  });
  var daily = report.dailyAA.map(function(day) {
    var future = day.date > today, value = values[day.date] || 0;
    var sunday = new Date(day.date + 'T00:00:00Z').getUTCDay() === 0;
    return { date: day.date, isWorkDay: day.isWorkDay, value: value / 100, tabletValue:(tablets[day.date]||0)/100,
      amount: future ? null : (report.holidaySource && day.isWorkDay ? (senior ? incentiveCanvasserDailyRate_(value,tablets[day.date]||0,policy) : incentiveDailyRate_(value,policy)) : 0),
      status: future ? 'Belum berjalan' : !day.isWorkDay ? (sunday ? 'Minggu' : 'Libur') : !report.holidaySource ? 'Kalender libur belum tersedia' : value ? 'Hari kerja · berdasarkan transaksi' : 'Belum ada penjualan' };
  });
  var dailyTotal = report.holidaySource ? daily.reduce(function(sum, d) { return sum + (d.amount || 0); }, 0) : null;
  var quarterVerified=reports.every(function(r){return r.masterVerified!==false&&r.policySignature===report.policySignature;});
  var quarterMonths = reports.map(function(r) { var p = r.parameters[2]; return { month: r.month, masterVerified:r.masterVerified!==false, actual: p.actual, target: p.target, achievement: p.achievement, reached: r.masterVerified!==false && (typeof reportMoney_==='function'?reportMoney_:txMoney_)(p.actual, 'Total Value') >= txMoney_(p.target, 'Target') }; });
  var quarterActual = quarterMonths.reduce(function(sum, m) { return sum + (typeof reportMoney_==='function'?reportMoney_:txMoney_)(m.actual, 'Total Value'); }, 0);
  if (!Number.isSafeInteger(quarterActual)) throw new Error('Akumulasi triwulan terlalu besar.');
  var quarterTarget = quarterMonths.reduce(function(sum, m) { return sum + (m.target===null?0:txMoney_(m.target, 'Target')); }, 0);
  var tier = incentiveLevel_(quarterActual,quarterTarget,policy.quarterLevels), reached = quarterMonths.filter(function(m) { return m.reached; }).length;
  var payouts=senior?policy.quarterSenior:policy.quarterField;
  var quarterAmount = quarterVerified?(tier && reached ? payouts[reached][policy.quarterLevels.indexOf(tier)] : 0):null;
  var monthly = incentiveMonthly_(report), monthEnd = report.dailyAA[report.dailyAA.length - 1].date;
  if(report.masterVerified===false){daily.forEach(function(d){d.amount=null;});monthly.total=null;monthly.scheduledTotal=null;dailyTotal=null;monthly.parameters.forEach(function(p){p.amount=null;p.scheduled=null;});}
  var dailyScheduledTotal = dailyTotal;
  daily.forEach(function(d) { d.scheduled = d.amount; if (d.amount !== null) d.amount *= monthly.payoutFactor; });
  if (dailyTotal !== null) dailyTotal *= monthly.payoutFactor;
  var monthSubtotal = dailyScheduledTotal === null ? null : dailyScheduledTotal + monthly.scheduledTotal;
  return { success: true, masterVerified:report.masterVerified!==false, isJunior:false, allocationFactor:1, policy:senior?'LOADING':'ALL_NON_TABLET', month: month, today: today, sales: report.sales, monthlyClosed: today > monthEnd,
    workDays: report.workDays, holidaySource: report.holidaySource,
    daily: daily, dailyScheduledTotal: dailyScheduledTotal, dailyTotal: dailyTotal, paidDays: daily.filter(function(d) { return d.amount > 0; }).length,
    monthly: monthly, monthSubtotal: monthSubtotal, payoutFactor: monthly.payoutFactor,
    monthTotal: monthSubtotal === null ? null : monthSubtotal * monthly.payoutFactor,
    quarter: { masterVerified:quarterVerified, number: quarter.number, year: quarter.year, months: quarterMonths, end: quarter.end, closed: today > quarter.end,
      actual: quarterVerified?quarterActual / 100:null, target: quarterVerified?quarterTarget / 100:null, achievement: quarterVerified&&quarterTarget?quarterActual / quarterTarget:null, reachedMonths: reached, tier: quarterVerified?tier:null, amount: quarterAmount },
    warnings: (quarterVerified?[]:['Master atau aturan antarbulan belum sesuai; bonus triwulan belum dapat disahkan.']).concat(report.masterVerified===false?['Master periode belum diverifikasi.']:[]).concat(report.holidaySource ? [] : ['Sheet HOLIDAYS belum tersedia; insentif harian belum dapat dipastikan.'])
      .concat(['AA mengikuti input harian admin yang tersedia; hari belum diinput belum menambah aktual.', 'Insentif periode berjalan adalah estimasi. Triwulan ditampilkan terpisah agar tidak dihitung tiga kali.']) };
}
