// Read-only exports. The account scope is checked before reading any report data.
function exportOfficeReport_(input) {
  input = input || {};
  getCurrentUserInfo_();
  var id = input.salesId;
  if (typeof id !== 'string' || !id.trim() || id.length > 128) throw new Error('Pilih Sales yang valid.');
  assertOwnSales_(id);
  var incentive = input.kind === 'incentive';
  if (!incentive && input.kind !== 'rssh') throw new Error('Jenis laporan tidak valid.');
  if (incentive) scoreMonth_(input.period);
  else if (!isValidCalendarDate_(input.period) || new Date(input.period + 'T00:00:00Z').getUTCDay() !== 1) throw new Error('Pilih tanggal Senin untuk RSSH.');
  var sales = txUnique_(getSheetData_('SALES').rows,function(row) { return officeOwnRow_(row,id); },'Sales');
  var team = txTeamKey_(sales.team_name);
  var mpr = ['MPR','CANVASSER','ASISTEN MPR','JUNIOR CANVASSER'].indexOf(team) >= 0;
  if (!mpr && ['MOTORIS','MMTW'].indexOf(team) < 0) throw new Error('Format kantor hanya tersedia untuk Motoris/MMTW dan MPR/Canvasser.');
  if (incentive && incentiveJunior_(sales)) throw new Error('Form Incentive pasangan diekspor dari profil Senior. Alokasi asisten tercantum di formulir tersebut.');
  var template = KCH_OFFICE_REPORT_TEMPLATES_[(incentive ? 'incentive' : 'rssh') + (mpr ? 'Mpr' : 'Motoris')];
  var entries = incentive ? officeIncentiveCells_(input.period,sales,mpr,template.sku) : officeRsshCells_(input,sales,mpr);
  var slug = String(sales.sales_id).replace(/[^a-zA-Z0-9_-]+/g,'-');
  return {success:true, name:(incentive ? 'Form-Incentive-' : 'RSSH-') + slug + '-' + input.period + '.xlsx', data:officeWorkbook_(template.data,entries)};
}

function officeOwnRow_(row,id) { return normalizeKey_(row.sales_id) === normalizeKey_(id); }
function officeAddDate_(date,days) { return new Date(Date.parse(date+'T00:00:00Z') + days * 86400000).toISOString().slice(0,10); }
function officeExcelDate_(date) { return (Date.parse(date+'T00:00:00Z') - Date.UTC(1899,11,30)) / 86400000; }
function officeColumn_(index) {
  return (index < 26 ? '' : String.fromCharCode(64 + Math.floor(index / 26))) + String.fromCharCode(65 + index % 26);
}
function officeMoney_(row,subtotal,price,qty) {
  return row[subtotal] === '' || row[subtotal] == null ? reportMoney_(row[price],price) * qty : reportMoney_(row[subtotal],subtotal);
}
function officeSkuKey_(id) {
  id=normalizeKey_(id);
  return scoreCanonicalProductId_(id === 'TPRGR' ? 'LPRGN' : id === 'PEBJE' ? 'PEBJF' : id);
}
function officeIncentiveCells_(month,sales,mpr,codes) {
  var id = sales.sales_id, start = month+'-01';
  var data = scoreContext_(true);
  var report = incentiveBuildReport_(data,month,id);
  if (!report.success) throw new Error(report.message || 'Insentif belum dapat dihitung.');
  var first = mpr ? 13 : 12, last = first + 30, cells = {};
  var name = sales.full_name;
  if (mpr && getCurrentUserInfo_().role === 'ADMIN') {
    var context = periodContext_(data,month);
    var pair = periodPolicy_(context).pairs.find(function(p) { return normalizeKey_(p[0]) === normalizeKey_(id); });
    var junior = pair && context.sales.find(function(row) { return officeOwnRow_(row,pair[1]) && incentiveJunior_(row); });
    if (junior) {
      name += ' / ' + junior.full_name;
      cells.M57 = report.monthTotal == null ? null : report.monthTotal * periodPolicy_(context).juniorFactor;
    }
  }
  cells['F'+(mpr?2:1)] = name;
  cells['F'+(mpr?4:3)] = sales.area;
  cells['F'+(mpr?6:5)] = month;
  var columns = Object.create(null), totals = Object.create(null), days = Object.create(null);
  codes.forEach(function(group,index) {
    String(group).split('-').forEach(function(code) { columns[officeSkuKey_(code)] = officeColumn_(6+index); });
  });
  var missing = Object.create(null);
  txTable_('SALES_TRANSACTIONS',data.raw.SALES_TRANSACTIONS,['sales_id','transaction_date','product_id','quantity'],false).rows.forEach(function(row) {
    var date = normalizeDateString_(row.transaction_date);
    if (!officeOwnRow_(row,id) || date.slice(0,7) !== month) return;
    var col = columns[officeSkuKey_(row.product_id)];
    var quantity = txNumber_(row.quantity,'Jumlah unit'), value = officeMoney_(row,'subtotal_sales','selling_price',quantity);
    if (!days[date]) days[date] = {units:{},value:0};
    days[date].value += value;
    if (!col) { missing[String(row.product_id)] = true; return; }
    days[date].units[col] = (days[date].units[col] || 0) + quantity;
    if (!totals[col]) totals[col] = {units:0,value:0,prices:Object.create(null)};
    totals[col].units += quantity; totals[col].value += value;
    totals[col].prices[String(row.selling_price)] = true;
  });
  var daily = Object.create(null);
  (report.daily || []).forEach(function(row) { daily[row.date] = row; });
  var buckets = Object.create(null), dailyTotals=Object.create(null);
  for (var r = first; r <= last; r++) {
    var date = officeAddDate_(start,r-first);
    if (date.slice(0,7) !== month) break;
    cells['B'+r] = r-first+1;
    cells['F'+r] = officeExcelDate_(date);
    var line = daily[date] || {}, activity = days[date];
    if (activity) Object.keys(activity.units).forEach(function(col) { cells[col+r] = activity.units[col]; });
    var values = [line.tabletValue,line.focusValue,activity ? activity.value/100 : null,line.value];
    (mpr ? ['AK','AL','AM','AN'] : ['AC','AD','AF','AE']).forEach(function(col,index) {
      var value=values[index];
      cells[col+r]=value;
      if (value!=null) dailyTotals[col]=(dailyTotals[col] || 0)+value;
    });
    if (line.scheduled > 0) buckets[line.scheduled] = (buckets[line.scheduled] || 0)+1;
  }
  Object.keys(totals).forEach(function(col) {
    var t = totals[col], prices = Object.keys(t.prices);
    cells[col+(first-2)] = prices.length === 1 ? Number(prices[0]) : null;
    cells[col+(last+1)] = t.units;
    cells[col+(last+2)] = t.value/100;
  });
  Object.keys(dailyTotals).forEach(function(col) { cells[col+(last+1)]=dailyTotals[col]; });
  var params = report.monthly.parameters;
  params.forEach(function(p,i) {
    var r = (mpr?48:54)+i;
    cells['G'+r]=p.target;cells['I'+r]=p.actual;cells['L'+r]=p.achievement;cells['M'+r]=p.scheduled == null ? p.amount : p.scheduled;
  });
  if (mpr) {
    cells.M53=report.monthly.scheduledTotal == null ? report.monthly.total : report.monthly.scheduledTotal;
    cells.I54=report.paidDays;cells.M54=report.dailyScheduledTotal;
    cells.M55=report.monthSubtotal;
    cells.M56=report.monthTotal;
  } else {
    var rates = [10000,20000,30000,50000];
    rates.forEach(function(rate,i) {
      cells['G'+(47+i)]=report.dailyTotal == null ? null : (buckets[rate] || 0);
      cells['I'+(47+i)]=report.dailyTotal == null ? null : (buckets[rate] || 0)*rate;
    });
    cells.G51=report.cappedFieldDaily ? rates.reduce(function(total,rate) { return total+(buckets[rate]||0); },0) : report.paidDays;
    cells.I51=report.dailyScheduledTotal;
    cells.M58=report.monthly.scheduledTotal;cells.M59=report.monthSubtotal;cells.M60=report.monthTotal;
  }
  cells.B63 = 'Insentif dihitung oleh webapp. Kolom Transtrack diisi terpisah. Rp/unit kosong bila harga berbeda.';
  if (report.seniorLoadingOnly) cells.B63 += ' TV Promag dibatasi Rp1 juta per hari; ambang harian Rp2,5 juta berasal dari produk loading.';
  if (report.cappedFieldDaily && report.dailyTotal != null) cells.B63 += ' Rekap harian setelah plafon: Rp'+report.dailyScheduledTotal+'; klaim harian setelah ambang TV: Rp'+report.dailyTotal+'.';
  if (Object.keys(missing).length) cells.B64 = 'SKU di luar kolom template (tetap masuk nilai transaksi dan perhitungan webapp): ' + Object.keys(missing).join(', ');
  return cells;
}

function officeRsshCells_(input,sales,mpr) {
  var id = sales.sales_id, start = input.period, end = officeAddDate_(start,5);
  var distro = txUnique_(getSheetData_('DISTRIBUTORS').rows,function(row) {
    return normalizeKey_(row.distributor_id) === normalizeKey_(input.distributorId) && !!input.distributorId;
  },'Distributor');
  var distKey = normalizeKey_(distro.distributor_id), distName = txDistributorKey_(distro.distributor_name);
  function matchesDistributor(row) {
    var key = normalizeKey_(row.stock_distributor_id || row.distributor_id);
    return key ? key === distKey : txDistributorKey_(row.distributor || row.distributor_name) === distName || normalizeKey_(row.distributor) === distKey;
  }
  function reportRows(name) {
    var rows = typeof archiveEnabled_ === 'function' && archiveEnabled_() ? archiveHistoryObjects_(name).rows : getSheetData_(name).rows;
    return rows.filter(function(row) { return officeOwnRow_(row,id) && matchesDistributor(row); });
  }
  var products = Object.create(null);
  function product(row) {
    var key = officeSkuKey_(row.product_id);
    if (!key) throw new Error('Kode produk RSSH belum tersedia.');
    if (!products[key]) products[key] = {key:key,name:row.product_name || key,qty:0,buy:0,sell:0,buys:Object.create(null),sells:Object.create(null),pickups:{},movements:[]};
    if (products[key].name === key && row.product_name) products[key].name = row.product_name;
    return products[key];
  }
  getSheetData_('SALES_TRANSACTIONS').rows.forEach(function(row) {
    var date = normalizeDateString_(row.transaction_date);
    if (!officeOwnRow_(row,id) || date < start || date > end) return;
    if (!row.stock_distributor_id && normalizeKey_(row.distributor) === 'CAMPURAN') throw new Error('Ada baris faktur Campuran tanpa asal distributor. RSSH tidak dapat membagi angkanya.');
    if (!matchesDistributor(row)) return;
    var qty = txNumber_(row.quantity,'Jumlah unit'), p = product(row);
    p.qty += qty; p.buy += officeMoney_(row,'subtotal_cost','cost_price',qty); p.sell += officeMoney_(row,'subtotal_sales','selling_price',qty);
    p.buys[String(row.cost_price)] = true; p.sells[String(row.selling_price)] = true;
  });
  var entries = opsEntries_();
  var deposits = opsEffectiveRecordRows_('SALES_CASH_DEPOSITS',reportRows('SALES_CASH_DEPOSITS'),entries);
  var pickups = opsEffectiveRecordRows_('STOCK_PICKUPS',reportRows('STOCK_PICKUPS'),entries);
  var panel = /PANEL/i.test(String(distro.distributor_type || '')+' '+distro.distributor_name);
  var cells = {D4:sales.full_name,D6:distro.distributor_name,D7:sales.area,D8:start+' s.d. '+end,D19:panel?'PANEL':'GROSIR'};
  var received = Object.create(null);
  deposits.forEach(function(row) {
    var date = normalizeDateString_(row.deposit_date);
    if (date >= start && date <= end) received[date]=(received[date] || 0)+reportMoney_(row.amount,'Setoran');
  });
  for (var i=0;i<6;i++) {
    var date=officeAddDate_(start,i), col=officeColumn_(3+i);
    cells[col+'12']=officeExcelDate_(date);
    if (Object.prototype.hasOwnProperty.call(received,date)) cells[col+'13']=received[date]/100;
  }
  pickups.forEach(function(row) {
    var date=normalizeDateString_(row.pickup_date);
    if (date < start || date > end) return;
    var p=product(row);
    p.pickups[date]=(p.pickups[date] || 0)+txNumber_(row.quantity,'Loading');
  });
  reportRows('SALES_STOCK_MOVEMENTS').forEach(function(row) {
    var date=normalizeDateString_(row.date);
    if (date > end || !isValidCalendarDate_(date)) return;
    var key=officeSkuKey_(row.product_id);
    if (date >= start || products[key]) product(row).movements.push(row);
  });
  var list=Object.keys(products).sort().map(function(key) { return products[key]; });
  if (list.length > (mpr?31:27)) throw new Error('Jumlah SKU melebihi baris format RSSH kantor.');
  list.forEach(function(p,index) {
    var r=index+20;
    cells['B'+r]=index+1;cells['C'+r]=p.name;cells['F'+r]=p.qty;cells['G'+r]=p.sell/100;cells['H'+r]=p.buy/100;
    var buys=Object.keys(p.buys), sells=Object.keys(p.sells);
    if (buys.length===1) cells['D'+r]=Number(buys[0]);
    if (sells.length===1) cells['E'+r]=Number(sells[0]);
    p.movements.sort(function(a,b) { return normalizeDateString_(a.date).localeCompare(normalizeDateString_(b.date)); });
    var before=p.movements.filter(function(row) { return normalizeDateString_(row.date)<start; });
    var within=p.movements.filter(function(row) { return normalizeDateString_(row.date)>=start; });
    var first=within[0], previous=before[before.length-1], final=within[within.length-1] || previous;
    var consistent = within.every(function(row,index) {
      var prior = index ? within[index-1] : previous;
      return !prior || String(prior.stock_after)===String(row.stock_before);
    });
    if (consistent && (first || previous)) cells['J'+r]=first?first.stock_before:previous.stock_after;
    if (consistent && final) cells[(mpr?'P':'Q')+r]=final.stock_after;
    var slots=mpr?4:5, loading=Object.keys(p.pickups).sort();
    for (var slot=0;slot<slots;slot++) {
      var selected=slot===slots-1 ? loading.slice(slot) : loading.slice(slot,slot+1);
      cells[officeColumn_(10+slot)+r]=selected.reduce(function(n,date){return n+p.pickups[date];},0);
    }
  });
  cells.B63 = 'Saldo berasal dari riwayat stok pegangan. Harga unit kosong bila berbeda; nilai mengikuti faktur. Loading melebihi slot digabung di kolom terakhir.';
  return cells;
}

function officeWorkbook_(base64,entries) {
  var archive=Utilities.unzip(Utilities.newBlob(Utilities.base64Decode(base64),'application/zip','layout.zip'));
  var sheet=archive.find(function(file) { return file.getName()==='xl/worksheets/sheet1.xml'; });
  if (!sheet) throw new Error('Template laporan tidak lengkap.');
  var xml=sheet.getDataAsString('UTF-8');
  var written=Object.create(null);
  xml=xml.replace(/<c\b([^>]*\br="([A-Z]+\d+)"[^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g,function(cell,attributes,ref) {
    var marker=cell.indexOf('__KCH_INPUT__')>=0;
    if (!marker && !Object.prototype.hasOwnProperty.call(entries,ref)) return cell;
    written[ref]=true;
    return officeCellXml_(attributes,entries[ref]);
  });
  if (Object.keys(entries).some(function(ref) { return !written[ref] && entries[ref]!=null; })) {
    throw new Error('Template laporan tidak sesuai dengan kolom hasil.');
  }
  sheet.setDataFromString(xml,'UTF-8');
  return Utilities.base64Encode(Utilities.zip(archive,'laporan.xlsx').getBytes());
}
function officeCellXml_(attributes,value) {
  attributes=attributes.replace(/\s+t="[^"]*"/,'');
  if (value==null || value==='') return '<c'+attributes+'/>';
  if (typeof value==='number' && isFinite(value)) return '<c'+attributes+' t="n"><v>'+value+'</v></c>';
  var safe=String(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});
  return '<c'+attributes+' t="inlineStr"><is><t xml:space="preserve">'+safe+'</t></is></c>';
}
