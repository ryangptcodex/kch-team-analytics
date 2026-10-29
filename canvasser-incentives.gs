// Confirmed loading codes and fixed Senior -> Junior pairs. Team display names stay unchanged.
var KCH_CANVASSER_LOADING_ = ['LPRGR','TMXTG','TMXGF','TMXGE','CKPXE','TXONE','LETSB','TNTPK','TFTGF','TFTSG','LMHGA','LBMAV','LKXPA','LKXLA','LKXNA','LKXOD','LKXJA','LKXOB','LEXUA','PEMAB','PEGAB','PBSJC'];
var KCH_INCENTIVE_PAIRS_ = [
  ['CANVASSER-BAC-LHOKSEUMAWE-1','JUNIOR CANVASSER-BAC-LHOKSEUMAWE-1'],
  ['MPR-LSE-BIREUN','ASS. MPR-LSE-BIREUN'],
  ['MPR-LSE-IDI','ASS. MPR-LSE-IDI'],
  ['MPR-LSE-LHOKSEUMAWE','ASS. MPR-LSE-LHOKSEUMAWE']
];
function incentiveJunior_(sales) { return ['JUNIOR CANVASSER','ASISTEN MPR'].indexOf(txTeamKey_(sales.team_name)) >= 0; }
function incentiveSenior_(sales) { return ['MPR','CANVASSER'].indexOf(txTeamKey_(sales.team_name)) >= 0; }
function incentiveSourceSales_(data, sales) {
  if (!incentiveJunior_(sales)) return sales;
  var pair = KCH_INCENTIVE_PAIRS_.filter(function(p) { return normalizeKey_(p[1]) === normalizeKey_(sales.sales_id); });
  if (pair.length !== 1) throw new Error('Pasangan Senior belum ditetapkan untuk ' + sales.full_name + '.');
  var senior = txUnique_(data.sales, function(s) { return normalizeKey_(s.sales_id) === normalizeKey_(pair[0][0]); }, 'Senior pasangan ' + sales.full_name);
  if (!incentiveSenior_(senior)) throw new Error('Tim Senior pasangan tidak sesuai untuk ' + sales.full_name + '.');
  return senior;
}
function incentiveLoadingReady_(data) {
  var available = Object.create(null);
  data.products.forEach(function(p) { available[scoreCanonicalProductId_(p.product_id)] = true; });
  var missing = KCH_CANVASSER_LOADING_.filter(function(id) { return !available[id]; });
  if (missing.length) throw new Error('Periksa master PRODUCTS untuk produk loading: ' + missing.join(', '));
}
function incentiveCanvasserDailyRate_(loadingCents, tabletCents) {
  return loadingCents >= 350000000 || (loadingCents >= 250000000 && tabletCents >= 100000000) ? 70000 : 0;
}
function incentiveJuniorReport_(data, month, junior, shared) {
  var senior = incentiveSourceSales_(data, junior), base = incentiveBuildReport_(data, month, senior.sales_id, shared);
  var r = JSON.parse(JSON.stringify(base));
  r.sales = {salesId:String(junior.sales_id),name:String(junior.full_name),team:String(junior.team_name)};
  r.isJunior = true; r.allocationFactor = 0.7; r.referenceSales = base.sales;
  r.referenceQuarter = base.quarter; r.referenceMonthTotal=base.monthTotal;
  function allocate(value) { return value === null ? null : value * 7 / 10; }
  r.daily.forEach(function(d) {
    d.referenceValue=d.value; d.referenceTabletValue=d.tabletValue; d.value=null; d.tabletValue=null;
    d.scheduled=allocate(d.scheduled);d.amount=allocate(d.amount);
  });
  r.monthly.parameters.forEach(function(p) {
    p.reference={actual:p.actual,target:p.target,achievement:p.achievement,tier:p.tier};
    p.actual=null;p.target=null;p.achievement=null;p.tier=null;
    p.scheduled=allocate(p.scheduled);p.amount=allocate(p.amount);p.tariffs=p.tariffs.map(allocate);
  });
  r.monthly.actualValue=null;r.monthly.minimumValue=null;r.monthly.aaTotal=null;r.monthly.brandingTotal=null;
  r.monthly.scheduledTotal=allocate(r.monthly.scheduledTotal);r.monthly.total=allocate(r.monthly.total);
  r.referenceGateChecks=base.monthly.gateChecks;r.monthly.gateChecks=[];
  r.dailyScheduledTotal=allocate(r.dailyScheduledTotal);r.dailyTotal=allocate(r.dailyTotal);
  r.monthSubtotal=allocate(r.monthSubtotal);r.monthTotal=allocate(r.monthTotal);
  r.quarter.referenceActual=r.quarter.actual;r.quarter.referenceTarget=r.quarter.target;
  r.quarter.actual=null;r.quarter.target=null;r.quarter.achievement=null;
  r.quarter.months.forEach(function(m) {m.reference={actual:m.actual,target:m.target,achievement:m.achievement};m.actual=null;m.target=null;m.achievement=null;});
  r.quarter.amount=allocate(r.quarter.amount);
  r.warnings.unshift('Tidak memiliki target sendiri. Insentif mengikuti 70% hasil Senior ' + base.sales.name + ', termasuk bonus triwulan. Faktor pencapaian Senior tidak dipotong lagi.');
  return r;
}
