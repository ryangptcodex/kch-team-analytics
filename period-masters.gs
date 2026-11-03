// Period master snapshots prevent changes in today's team/target/catalog from rewriting closed months.
var KCH_PERIOD_MASTERS_='_KCH_PERIOD_MASTERS';
var KCH_PERIOD_HEADERS_=['period','entity','record_key','data_json','source','verified_by','recorded_at'];
var KCH_PERIOD_CACHE_=null;
var KCH_MASTER_TABLES_=['SALES','PRODUCTS','PRICE_MASTER','DISTRIBUTORS','HOLIDAYS','FILES'];
function periodSchemas_(){var s={};s[KCH_PERIOD_MASTERS_]=KCH_PERIOD_HEADERS_.slice();return s;}
function periodKey_(name,row){if(name==='RULES')return 'POLICY';if(name==='PRICE_MASTER')return JSON.stringify([normalizeKey_(row.product_id),txTeamKey_(row.team_name)]);return normalizeKey_(row[name==='SALES'?'sales_id':name==='PRODUCTS'?'product_id':name==='DISTRIBUTORS'?'distributor_id':name==='HOLIDAYS'?'date':'file_name']);}
// Immutable implementation of the confirmed V1 juklak; new policies require a new version.
function periodPolicyV1_(){return {
  policy:'KCH_2026_V1',formulaVersion:1,dailyTargets:{CANVASSER:3500000,MPR:3500000,MOTORIS:1200000,MMTW:1200000,'MOTORIS ULTIMATE':800000,'SPG KELONTONG':800000,'JUNIOR CANVASSER':0,'ASISTEN MPR':0,SPR:0},
  productRules:{LBMAV:['Bejo Jahe Merah','FOCUS_A'],LKXOD:['Komix Herbal Sachet Original','FOCUS_B'],LKXJA:['Komix Herbal Sachet Jahe','FOCUS_B'],LKXPA:['Komix Herbal Sachet Peppermint','FOCUS_B'],LKXNA:['Komix Herbal Sachet Jeruk Nipis','FOCUS_B'],LKXOB:['Komix Herbal Tube Original','FOCUS_B'],LKXLA:['Komix Herbal Tube Lemon','FOCUS_B'],LPRGR:['Promag Herbal','FOCUS_B'],LPRGN:['Promag Tablet','EXCLUDE']},
  loading:['LPRGR','TMXTG','TMXGF','TMXGE','CKPXE','TXONE','LETSB','TNTPK','TFTGF','TFTSG','LMHGA','LBMAV','LKXPA','LKXLA','LKXNA','LKXOD','LKXJA','LKXOB','LEXUA','PEMAB','PEGAB','PBSJC'],
  pairs:[['CANVASSER-BAC-LHOKSEUMAWE-1','JUNIOR CANVASSER-BAC-LHOKSEUMAWE-1'],['MPR-LSE-BIREUN','ASS. MPR-LSE-BIREUN'],['MPR-LSE-IDI','ASS. MPR-LSE-IDI'],['MPR-LSE-LHOKSEUMAWE','ASS. MPR-LSE-LHOKSEUMAWE']],
  scoreField:[['Fokus A · Bejo Jahe Merah',5000000,0.40,40],['Fokus B · Komix Herbal Family + Promag Herbal',5000000,0.25,25],['Total Value (non Promag Tablet)',27000000,0.25,25],['Active Account (AA)',400,0.10,10]],
  scoreSenior:[['Fokus A · Bejo Jahe Merah',6400000,0.40,40],['Fokus B · Komix Herbal Family + Promag Herbal',8200000,0.25,25],['Total Value (non Promag Tablet)',80000000,0.25,25],['Active Account (AA)',400,0.05,5],['Branding',300,0.05,5]],
  tariffsField:[[200000,400000,500000],[125000,250000,312500],[125000,250000,312500],[50000,100000,125000]],tariffsSenior:[[400000,600000,800000],[250000,375000,500000],[250000,375000,500000],[50000,75000,100000],[50000,75000,100000]],
  dailyField:[[150000000,50000,true],[120000000,30000,false],[100000000,20000,false],[80000000,10000,false]],dailySenior:{loading:350000000,mixedLoading:250000000,tablet:100000000,amount:70000},
  monthlyLevels:[90,100,110],quarterLevels:[100,110,120],gate:0.7,reducedFactor:0.5,juniorFactor:0.7,
  quarterField:{3:[2000000,2100000,2200000],2:[1000000,1050000,1100000],1:[500000,525000,550000]},quarterSenior:{3:[3000000,3250000,3500000],2:[2000000,2125000,2250000],1:[1000000,1125000,1250000]},
  categories:[[40,'EVALUASI'],[60,'DISPENSASI LANJUT'],[null,'LANJUT BULAN BERIKUTNYA']]
};}
function periodCurrentPolicy_(){var p=periodPolicyV1_();if(typeof KCH_SCORE_PRODUCT_RULES_!=='undefined')p.productRules=KCH_SCORE_PRODUCT_RULES_;if(typeof KCH_CANVASSER_LOADING_!=='undefined')p.loading=KCH_CANVASSER_LOADING_;if(typeof KCH_INCENTIVE_PAIRS_!=='undefined')p.pairs=KCH_INCENTIVE_PAIRS_;return JSON.parse(JSON.stringify(p));}
function periodResolvePolicy_(stored){
  if(!stored||stored.policy!=='KCH_2026_V1'||stored.formulaVersion!==undefined&&stored.formulaVersion!==1||!stored.productRules||!Array.isArray(stored.loading)||!Array.isArray(stored.pairs))return null;
  var p=periodPolicyV1_();Object.keys(p).forEach(function(k){if(Object.prototype.hasOwnProperty.call(stored,k))p[k]=stored[k];});
  try{if(!Object.keys(p.productRules).length||Object.keys(p.productRules).some(function(k){var r=p.productRules[k];return !Array.isArray(r)||typeof r[0]!=='string'||['FOCUS_A','FOCUS_B','OTHER','EXCLUDE'].indexOf(r[1])<0;}))return null;
    if(p.loading.some(function(k){return typeof k!=='string'||!k;})||p.pairs.some(function(pair){return !Array.isArray(pair)||pair.length!==2||pair.some(function(k){return typeof k!=='string'||!k;});}))return null;
    var numeric=JSON.stringify([p.dailyTargets,p.scoreField,p.scoreSenior,p.tariffsField,p.tariffsSenior,p.dailyField,p.dailySenior,p.monthlyLevels,p.quarterLevels,p.gate,p.reducedFactor,p.juniorFactor,p.quarterField,p.quarterSenior,p.categories]);
    // V1 numeric policy is fixed. Unsupported tariffs/formulas cannot be certified by changing JSON.
    var v=periodPolicyV1_();if(numeric!==JSON.stringify([v.dailyTargets,v.scoreField,v.scoreSenior,v.tariffsField,v.tariffsSenior,v.dailyField,v.dailySenior,v.monthlyLevels,v.quarterLevels,v.gate,v.reducedFactor,v.juniorFactor,v.quarterField,v.quarterSenior,v.categories]))return null;
  }catch(err){return null;}return p;
}
function periodPolicy_(data){return data&&data.periodRules||periodCurrentPolicy_();}
function periodPolicySignature_(policy){
  var copy=JSON.parse(JSON.stringify(policy));copy.loading.sort();copy.pairs.sort(function(a,b){return JSON.stringify(a).localeCompare(JSON.stringify(b));});
  function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object'){var out={};Object.keys(value).sort().forEach(function(k){out[k]=canonical(value[k]);});return out;}return value;}
  return txHash_(JSON.stringify(canonical(copy)));
}
function periodCalendar_(raw){
  var values=raw.HOLIDAYS,headers=values&&values[0]||[],present=headers.indexOf('date')>=0,dates=present?txTable_('HOLIDAYS',values,['date'],false).rows.map(function(h){var d=normalizeDateString_(h.date);if(!isValidCalendarDate_(d))throw new Error('Kalender snapshot memiliki tanggal tidak valid.');return d;}).sort():[];
  return {source:present?'HOLIDAYS':'',verified:present,count:dates.length,digest:txHash_(JSON.stringify(dates))};
}
function periodRead_(month){
  if(KCH_PERIOD_CACHE_&&Object.prototype.hasOwnProperty.call(KCH_PERIOD_CACHE_,month))return KCH_PERIOD_CACHE_[month];
  if(!KCH_PERIOD_CACHE_)KCH_PERIOD_CACHE_={};
  if(KCH_PERIOD_CACHE_._disabled)return null;
  if(!KCH_PERIOD_CACHE_._rows){var ctx={id:getKchSpreadsheet_().getId(),token:ScriptApp.getOAuthToken()},meta=txMetadata_(ctx);
    if(!meta[KCH_PERIOD_MASTERS_]){KCH_PERIOD_CACHE_._disabled=true;return null;}
    var all=txTable_(KCH_PERIOD_MASTERS_,txRead_(ctx,[KCH_PERIOD_MASTERS_])[KCH_PERIOD_MASTERS_],KCH_PERIOD_HEADERS_,true).rows;
    if(!all.length&&PropertiesService.getScriptProperties().getProperty('KCH_PERIOD_SNAPSHOTS_ACTIVE')!=='TRUE'){KCH_PERIOD_CACHE_._disabled=true;return null;}KCH_PERIOD_CACHE_._rows=all;
  }
  var rows=KCH_PERIOD_CACHE_._rows.filter(function(r){return r.period===month;}),result={verified:false,tables:{},rows:rows},seen={};
  rows.forEach(function(r){var key=r.entity+':'+r.record_key;if(seen[key])throw new Error('Snapshot master periode terdaftar ganda.');seen[key]=true;if(!result.tables[r.entity])result.tables[r.entity]=[];result.tables[r.entity].push(JSON.parse(r.data_json));});
  var stored=result.tables.RULES&&result.tables.RULES[0];result.policy=periodResolvePolicy_(stored);
  var dates=(result.tables.HOLIDAYS||[]).map(function(h){return normalizeDateString_(h.date);}).sort(),validDates=dates.every(isValidCalendarDate_);
  result.calendarVerified=!!(validDates&&stored&&(stored.calendar?stored.calendar.verified===true&&stored.calendar.source==='HOLIDAYS'&&stored.calendar.count===dates.length&&stored.calendar.digest===txHash_(JSON.stringify(dates)):dates.length>0));
  result.verified=!!(result.tables.SALES&&result.tables.PRODUCTS&&result.policy&&result.calendarVerified);KCH_PERIOD_CACHE_[month]=result;return result;
}
function periodContext_(data,month){
  var base=data._periodBase||data;if(!base.meta[KCH_PERIOD_MASTERS_])return base;if(month>=scoreToday_().slice(0,7))return base;
  var snapshot=periodRead_(month);if(snapshot===null)return base;
  var next={};Object.keys(base).forEach(function(k){next[k]=base[k];});next._periodBase=base;next.masterVerified=snapshot.verified;next.period=month;
  next.periodRules=snapshot.policy||periodCurrentPolicy_();next.periodCalendarVerified=snapshot.calendarVerified;next.periodHolidays=snapshot.tables.HOLIDAYS||[];
  if(snapshot.tables.SALES&&snapshot.tables.PRODUCTS){next.sales=snapshot.tables.SALES;next.products=snapshot.tables.PRODUCTS;}
  else {
    // Retain captured invoice teams for actuals, but never certify guessed historical targets/payouts.
    var transactions=base.raw.SALES_TRANSACTIONS?txTable_('SALES_TRANSACTIONS',base.raw.SALES_TRANSACTIONS,[],false).rows:[];
    next.sales=base.sales.map(function(s){var clone={};Object.keys(s).forEach(function(k){clone[k]=s[k];});var teams=transactions.filter(function(t){return normalizeKey_(t.sales_id)===normalizeKey_(s.sales_id)&&normalizeDateString_(t.transaction_date).slice(0,7)===month;}).map(function(t){return t.team_name;}).filter(function(t){return String(t||'').trim();});if(teams.length&&teams.every(function(t){return txTeamKey_(t)===txTeamKey_(teams[0]);}))clone.team_name=teams[0];return clone;});
  }
  return next;
}
function periodSnapshotPlan_(meta,raw,month,user,source,replace,policy){
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Bulan snapshot tidak valid.');
  var requests=[],existing=raw[KCH_PERIOD_MASTERS_]?txTable_(KCH_PERIOD_MASTERS_,raw[KCH_PERIOD_MASTERS_],KCH_PERIOD_HEADERS_,true).rows:[],same=existing.filter(function(r){return r.period===month;});
  if(same.length&&!replace)throw new Error('Master periode ini sudah diverifikasi dan dikunci.');
  if(!meta[KCH_PERIOD_MASTERS_])txAddSheet_(meta,requests,KCH_PERIOD_MASTERS_,KCH_PERIOD_HEADERS_,true);

  var stamp=Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH:mm:ss'),rows=[];
  ['SALES','PRODUCTS','PRICE_MASTER','HOLIDAYS'].forEach(function(name){var seen=Object.create(null);if(!raw[name])return;txTable_(name,raw[name],[],false).rows.forEach(function(item){var clean={};Object.keys(item).forEach(function(k){if(k.charAt(0)!=='_')clean[k]=item[k];});if(name==='SALES'){if(month<Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM')){clean.target_monthly=txMoney_(clean.target_monthly,'Target master historis')/100;if(getIndividualDailyTargetRate_(clean.team_name)>0&&clean.target_monthly<=0)throw new Error('Target historis sumber belum lengkap.');}else clean.target_monthly=getIndividualMonthlyTarget_(clean.team_name,clean.target_monthly);}var key=periodKey_(name,clean);if(!key||seen[key])throw new Error(name+': ID snapshot kosong/ganda.');seen[key]=true;var encoded=JSON.stringify(clean);if(encoded.length>45000)throw new Error('Master terlalu panjang untuk snapshot.');rows.push([month,name,key,encoded,source,user.email,stamp]);});});
  var capturedPolicy=JSON.parse(JSON.stringify(policy||(month<Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM')?periodPolicyV1_():periodCurrentPolicy_())));capturedPolicy.calendar=periodCalendar_(raw);
  rows.push([month,'RULES','POLICY',JSON.stringify(capturedPolicy),source,user.email,stamp]);
  var reused=Math.min(same.length,rows.length);for(var i=0;i<reused;i++)requests.push(txUpdate_(meta[KCH_PERIOD_MASTERS_].sheetId,same[i]._row,0,[rows[i]]));if(rows.length>reused)requests.push(txAppend_(meta[KCH_PERIOD_MASTERS_].sheetId,rows.slice(reused)));for(var j=reused;j<same.length;j++)requests.push(txUpdate_(meta[KCH_PERIOD_MASTERS_].sheetId,same[j]._row,0,[KCH_PERIOD_HEADERS_.map(function(){return '';})]));return requests;
}
function periodSyncPlan_(ss,meta,ctx){
  var names=['SALES','PRODUCTS','PRICE_MASTER','HOLIDAYS',KCH_PERIOD_MASTERS_].filter(function(n){return !!ss.getSheetByName(n);}),raw=txRead_(ctx,names),month=Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM');
  return {requests:periodSnapshotPlan_(meta,raw,month,{email:KCH_BOOTSTRAP_ADMIN_EMAIL_},'ADMIN_UPDATER',true),changes:['Master '+month+' direkam; periode tutup tidak ditimpa.']};
}
function getMasterEditor_(){
  opsAdmin_();var ctx={id:getKchSpreadsheet_().getId(),token:ScriptApp.getOAuthToken()},meta=txMetadata_(ctx),raw=txRead_(ctx,KCH_MASTER_TABLES_.filter(function(n){return !!meta[n];})),tables={};
  KCH_MASTER_TABLES_.forEach(function(name){var t=raw[name]?txTable_(name,raw[name],TABLE_SCHEMAS[name],true):{headers:TABLE_SCHEMAS[name],rows:[]};tables[name]={headers:t.headers,rows:t.rows.map(function(r){var data={};t.headers.forEach(function(h){data[h]=r[h];});return {key:periodKey_(name,r),data:data,revision:txHash_(JSON.stringify(r._cells))};})};});
  var periods=meta[KCH_PERIOD_MASTERS_]?txTable_(KCH_PERIOD_MASTERS_,txRead_(ctx,[KCH_PERIOD_MASTERS_])[KCH_PERIOD_MASTERS_],KCH_PERIOD_HEADERS_,true).rows:[];
  return {success:true,tables:tables,periods:Array.from(new Set(periods.map(function(p){return p.period;}))).sort().reverse()};
}
function saveMasterRecord_(payload){opsAdmin_();return txExecuteRequest_(payload,'MASTER');}
function masterValidateProductMapping_(product,rows,old){
  var rules=KCH_SCORE_PRODUCT_RULES_,id=scoreCanonicalProductId_(product.product_id),name=normalizeKey_(product.product_name).replace(/[^A-Z0-9]+/g,' ').trim(),rule=rules[id];
  if((rows||[]).some(function(r){return (!old||r._row!==old._row)&&scoreCanonicalProductId_(r.product_id)===id;}))throw new Error('Kode kanonik produk sudah terdaftar; jangan menggandakan alias lama.');
  if(rule){var expected=normalizeKey_(rule[0]).replace(/[^A-Z0-9]+/g,' ').trim();if(name!==expected&&name.indexOf(expected+' ')!==0)throw new Error('Nama '+id+' terikat pemetaan Skor: gunakan '+rule[0]+'. Perubahan alias perlu migrasi yang disahkan.');}
  else if(Object.keys(rules).some(function(key){return name===normalizeKey_(rules[key][0]).replace(/[^A-Z0-9]+/g,' ').trim();}))throw new Error('Nama produk terikat Skor memakai kode lain. Gunakan kode produk resmi.');
}
function masterPlan_(ctx,meta,payload,user,id,requestId){
  opsAdmin_();var name=payload.table,data=payload.data;if(KCH_MASTER_TABLES_.indexOf(name)<0||!data||typeof data!=='object'||Array.isArray(data))throw new Error('Master tidak valid.');
  var reason=String(payload.reason||'').trim();if(reason.length<3||reason.length>500)throw new Error('Isi alasan perubahan master 3–500 karakter.');
  var names=KCH_MASTER_TABLES_.concat(['INVENTORY',KCH_PERIOD_MASTERS_]).filter(function(n){return !!meta[n];}),raw=txRead_(ctx,names),headers=TABLE_SCHEMAS[name];if(!meta[name])throw new Error('Perbarui struktur sheet dahulu.');
  var table=txTable_(name,raw[name],headers,true),key=periodKey_(name,data),matches=table.rows.filter(function(r){return periodKey_(name,r)===key;});if(!key||matches.length>1)throw new Error('ID master kosong/ganda.');
  var old=matches[0];if((old?txHash_(JSON.stringify(old._cells)):'')!==String(payload.expectedRevision||''))throw new Error('Master sudah berubah. Muat ulang sebelum menyimpan.');
  var clean={};headers.forEach(function(h){var v=data[h]===undefined?'':data[h];if(typeof v!=='string'&&typeof v!=='number')throw new Error('Nilai master tidak valid.');if(String(v).length>2000)throw new Error('Isian master terlalu panjang.');clean[h]=typeof v==='string'?v.trim():v;});
  if(clean.status!==undefined&&['ACTIVE','INACTIVE'].indexOf(normalizeKey_(clean.status))<0)throw new Error('Status master harus ACTIVE atau INACTIVE.');
  if(clean.status!==undefined)clean.status=normalizeKey_(clean.status);
  if(name==='SALES'){if(!clean.full_name||!clean.team_name)throw new Error('Nama dan tim sales wajib.');if(STANDARD_TEAMS.concat(['SPR']).map(txTeamKey_).indexOf(txTeamKey_(clean.team_name))<0)throw new Error('Tim sales tidak dikenal.');clean.target_monthly=getIndividualMonthlyTarget_(clean.team_name,txMoney_(clean.target_monthly||0,'Target bulanan')/100);if(clean.photo_url&&!/^https:\/\//i.test(clean.photo_url)&&!extractDriveFileId_(clean.photo_url))throw new Error('URL foto profil harus HTTPS atau ID Drive.');if(clean.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email))throw new Error('Email sales tidak valid.');}
  if(name==='PRODUCTS'){if(old&&old.unit&&normalizeKey_(old.unit)!==normalizeKey_(clean.unit))throw new Error('Satuan produk lama tidak boleh diubah tanpa migrasi; gunakan kode produk baru.');if(!clean.product_name||!clean.unit)throw new Error('Nama produk dan satuan wajib.');clean.min_stock=stockQty_(clean.min_stock||0);masterValidateProductMapping_(clean,table.rows,old);}
  if(name==='PRICE_MASTER'){var product=txUnique_(txTable_('PRODUCTS',raw.PRODUCTS,['product_id']).rows,function(p){return normalizeKey_(p.product_id)===normalizeKey_(clean.product_id);},'Produk harga');if(STANDARD_TEAMS.map(txTeamKey_).indexOf(txTeamKey_(clean.team_name))<0)throw new Error('Tim harga tidak dikenal.');clean.cost_price=txMoney_(clean.cost_price,'Modal')/100;clean.selling_price=txMoney_(clean.selling_price,'Harga jual')/100;if(!clean.selling_price)throw new Error('Harga jual harus positif.');clean.shj=clean.selling_price-clean.cost_price;clean.product_name=product.product_name;clean.unit=product.unit||clean.unit;}
  if(name==='DISTRIBUTORS'){if(table.rows.some(function(d){return (!old||d._row!==old._row)&&stockDistributorKey_(d.distributor_name)===stockDistributorKey_(clean.distributor_name);}))throw new Error('Nama sumber distributor sudah terdaftar.');if(!clean.distributor_name)throw new Error('Nama distributor wajib.');if(['GMP','GEUBRINA'].indexOf(stockDistributorKey_(clean.distributor_name))<0||old&&stockDistributorKey_(old.distributor_name)!==stockDistributorKey_(clean.distributor_name))throw new Error('Gunakan distributor asal GMP/Geubrina; perubahan sumber stok perlu migrasi tersendiri.');}
  if(name==='HOLIDAYS'&&!isValidCalendarDate_(clean.date))throw new Error('Tanggal libur tidak valid.');
  if(name==='FILES'){if(!clean.file_name||!/^https:\/\//i.test(clean.drive_url))throw new Error('Nama dokumen dan tautan HTTPS wajib.');clean.update_date=Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd');}
  var requests=[],cells=table.headers.map(function(h){return Object.prototype.hasOwnProperty.call(clean,h)?clean[h]:old?old[h]:'';});
  if(payload.remove===true){if(name!=='HOLIDAYS'||!old)throw new Error('Master bisnis tidak boleh dihapus; nonaktifkan statusnya.');cells=table.headers.map(function(){return '';});}
  requests.push(old?txUpdate_(meta[name].sheetId,old._row,0,[cells]):txAppend_(meta[name].sheetId,[cells]));
  // Update in-memory source used for the same atomic period snapshot.
  if(old)raw[name][old._row]=cells;else raw[name].push(cells);
  if(name==='PRODUCTS'){
    var inv=txTable_('INVENTORY',raw.INVENTORY,['product_id','product_name']),existing=inv.rows.filter(function(r){return normalizeKey_(r.product_id)===normalizeKey_(clean.product_id);});if(existing.length>1)throw new Error('Produk INVENTORY ganda.');
    if(!existing.length)requests.push(txAppend_(meta.INVENTORY.sheetId,[inv.headers.map(function(h){return h==='product_id'?clean.product_id:h==='product_name'?clean.product_name:bookInventoryColumn_(h,raw)?0:'';})]));
    else requests.push(txUpdate_(meta.INVENTORY.sheetId,existing[0]._row,inv.index.product_name,[[clean.product_name]]));
  }
  requests=requests.concat(periodSnapshotPlan_(meta,raw,Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM'),user,'MASTER_EDITOR',true));
  if(!meta.ACTIVITY_LOGS)txAddSheet_(meta,requests,'ACTIVITY_LOGS',TABLE_SCHEMAS.ACTIVITY_LOGS,false);
  requests.push(txAppend_(meta.ACTIVITY_LOGS.sheetId,[['AUD-'+Utilities.getUuid(),Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM-dd HH:mm:ss'),user.email,'UPDATE_MASTER',name+':'+key,JSON.stringify({reason:reason,before:old?old._cells:null,after:cells})]]));
  return {requests:requests,result:{success:true,terminal:true,state:'COMMITTED',operation:'MASTER',requestId:requestId,transactionId:id,totalSales:0,message:'Master dan snapshot bulan berjalan tersimpan.',stockUpdates:[]},plan:{operation:'MASTER',table:name,key:key}};
}
function bookInventoryColumn_(h,raw){return txTable_('DISTRIBUTORS',raw.DISTRIBUTORS,['distributor_name']).rows.some(function(d){return stockDistributorKey_(d.distributor_name)===stockDistributorKey_(h);});}

function getHistoricalMasterSources_(month){
  opsAdmin_();scoreMonth_(month);if(month>=scoreToday_().slice(0,7))throw new Error('Pilih bulan yang sudah tutup.');
  var ctx=healthContext_(),meta=txMetadata_(ctx),sources=[];
  if(meta[KCH_ARCHIVE_INDEX_])txTable_(KCH_ARCHIVE_INDEX_,txRead_(ctx,[KCH_ARCHIVE_INDEX_])[KCH_ARCHIVE_INDEX_],KCH_ARCHIVE_SCHEMAS_[KCH_ARCHIVE_INDEX_],true).rows.forEach(function(r){if(r.month===month&&r.status==='COMPLETED'&&!sources.some(function(s){return s.id===r.snapshot_id;}))sources.push({id:r.snapshot_id,label:'Arsip '+r.month+' · '+r.archived_at});});
  healthRegistry_(ctx,meta).filter(function(r){return r.status==='COMPLETE';}).forEach(function(r){if(!sources.some(function(s){return s.id===r.spreadsheet_id;}))sources.push({id:r.spreadsheet_id,label:r.kind+' · '+r.created_at});});
  var existing=periodRead_(month);return {success:true,month:month,verified:!!(existing&&existing.verified),sources:sources,message:'Periksa master di sumber yang dipilih. Pengesahan tidak mengubah transaksi atau membuka bulan tutup.'};
}
function savePeriodVerification_(payload){opsAdmin_();return txExecuteRequest_(payload,'PERIOD_VERIFY');}
function periodVerificationPlan_(ctx,meta,payload,user,id,requestId){
  opsAdmin_();var month=scoreMonth_(payload.month);if(month>=scoreToday_().slice(0,7)||payload.confirmation!=='VERIFIKASI '+month)throw new Error('Pilih bulan tutup dan ketik konfirmasi verifikasi.');
  var reason=String(payload.reason||'').trim();if(reason.length<3||reason.length>1000)throw new Error('Isi dasar verifikasi 3–1.000 karakter.');
  var allowed=getHistoricalMasterSources_(month).sources;if(!allowed.some(function(s){return s.id===payload.sourceId;}))throw new Error('Sumber periode tidak terdaftar.');
  var registered=healthRegistry_(ctx,meta).filter(function(r){return r.spreadsheet_id===payload.sourceId&&r.status==='COMPLETE';})[0];if(registered)healthVerifiedBackup_(registered.backup_id,ctx,meta);
  var file=DriveApp.getFileById(payload.sourceId);if(!file.getOwner()||String(file.getOwner().getEmail()).toLowerCase()!==KCH_BOOTSTRAP_ADMIN_EMAIL_||file.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error('Sumber harus privat dan dimiliki Admin.');
  var sourceCtx={id:payload.sourceId,token:ctx.token},sourceMeta=txMetadata_(sourceCtx),names=['SALES','PRODUCTS','PRICE_MASTER','HOLIDAYS'].filter(function(n){return !!sourceMeta[n];}),raw=txRead_(sourceCtx,names);if(!raw.SALES||!raw.PRODUCTS)throw new Error('Master sumber belum lengkap.');
  raw[KCH_PERIOD_MASTERS_]=meta[KCH_PERIOD_MASTERS_]?txRead_(ctx,[KCH_PERIOD_MASTERS_])[KCH_PERIOD_MASTERS_]:[];
  var current=periodRead_(month);if(current&&current.verified)throw new Error('Master periode ini sudah diverifikasi dan dikunci.');
  var sourcePolicy=null;if(sourceMeta[KCH_PERIOD_MASTERS_]){var sourceSnapshots=txTable_(KCH_PERIOD_MASTERS_,txRead_(sourceCtx,[KCH_PERIOD_MASTERS_])[KCH_PERIOD_MASTERS_],KCH_PERIOD_HEADERS_,true).rows.filter(function(r){return r.period===month&&r.entity==='RULES';});if(sourceSnapshots.length>1)throw new Error('Aturan sumber periode ganda.');if(sourceSnapshots.length){sourcePolicy=periodResolvePolicy_(JSON.parse(sourceSnapshots[0].data_json));if(!sourcePolicy)throw new Error('Versi aturan sumber periode belum didukung.');}}
  if(!periodCalendar_(raw).verified)throw new Error('Kalender sumber belum tersedia; periode belum dapat disahkan.');
  var requests=periodSnapshotPlan_(meta,raw,month,user,'ADMIN_VERIFIED:'+payload.sourceId,!!(current&&current.rows.length),sourcePolicy||periodPolicyV1_());healthLogRequest_(meta,requests,'VERIFY_CLOSED_PERIOD',month,{sourceId:payload.sourceId,reason:reason},user);
  return {requests:requests,result:{success:true,terminal:true,state:'COMMITTED',operation:'PERIOD_VERIFY',requestId:requestId,transactionId:id,totalSales:0,message:'Master periode disahkan dari sumber yang dipilih. Transaksi lama tetap.',stockUpdates:[]},plan:{operation:'PERIOD_VERIFY',month:month,sourceId:payload.sourceId}};
}
function periodEnsureCurrentLocked_(ss,ctx,meta,user){
  if(!meta[KCH_PERIOD_MASTERS_])return;
  var month=Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM'),existing=txTable_(KCH_PERIOD_MASTERS_,txRead_(ctx,[KCH_PERIOD_MASTERS_])[KCH_PERIOD_MASTERS_],KCH_PERIOD_HEADERS_,true).rows;
  if(existing.some(function(r){return r.period===month;}))return;
  var names=['SALES','PRODUCTS','PRICE_MASTER','HOLIDAYS',KCH_PERIOD_MASTERS_].filter(function(n){return !!meta[n];}),raw=txRead_(ctx,names);txBatch_(ctx,periodSnapshotPlan_(meta,raw,month,user,'SCHEDULED_MONTH_START',false));PropertiesService.getScriptProperties().setProperty('KCH_PERIOD_SNAPSHOTS_ACTIVE','TRUE');
}

function periodDashboardRoster_(sales,start,end,period){
  var current=Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM'),months=[];
  if(period==='CUSTOM'&&isValidCalendarDate_(start)&&isValidCalendarDate_(end)){
    var month=start.slice(0,7),last=end.slice(0,7);while(month<=last&&months.length<120){months.push(month);var year=Number(month.slice(0,4)),n=Number(month.slice(5));month=n===12?String(year+1)+'-01':String(year)+'-'+('0'+(n+1)).slice(-2);}if(month<=last)throw new Error('Pilih rentang paling lama 120 bulan.');
  }else months=[current];
  var rows=[],verified=true,holidays=getHolidayDateMap_();months.forEach(function(month){var snapshot=month<current?periodRead_(month):null;if(snapshot&&snapshot.verified){rows=rows.concat(filterAuthorizedRows_('SALES',snapshot.tables.SALES).map(function(s){var frozen={};Object.keys(s).forEach(function(k){frozen[k]=s[k];});frozen._periodFrozen=true;frozen._periodDailyRate=snapshot.policy.dailyTargets[txTeamKey_(s.team_name)]||0;return frozen;}));Object.keys(holidays).forEach(function(d){if(d.slice(0,7)===month)delete holidays[d];});(snapshot.tables.HOLIDAYS||[]).forEach(function(h){var d=normalizeDateString_(h.date);if(d.slice(0,7)===month)holidays[d]=true;});}else {if(snapshot&&!snapshot.verified)verified=false;rows=rows.concat(sales);}});return {rows:rows,verified:verified,months:months,holidays:holidays};
}

function periodHistoricalSales_(data){
  var sales=data.sales.filter(incentiveEligible_).map(function(s){var r={};Object.keys(s).forEach(function(k){r[k]=s[k];});return r;}),known={};sales.forEach(function(s){known[normalizeKey_(s.sales_id)]=s;});
  if(!data.meta[KCH_PERIOD_MASTERS_])return sales;periodRead_(Utilities.formatDate(new Date(),TIMEZONE,'yyyy-MM'));
  ((KCH_PERIOD_CACHE_&&KCH_PERIOD_CACHE_._rows)||[]).filter(function(r){return r.entity==='SALES';}).forEach(function(r){var s=JSON.parse(r.data_json),key=normalizeKey_(s.sales_id);if(!incentiveEligible_(s))return;if(!known[key]){known[key]=s;sales.push(s);}if(!known[key]._periodFirstMonth||r.period<known[key]._periodFirstMonth)known[key]._periodFirstMonth=r.period;});return sales;
}
