const {test}=require('node:test'),assert=require('node:assert/strict'),{auditSystem}=require('./helpers/audit-system.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
let serial=0;const req=()=> 'REQ-PRELAUNCH-'+String(++serial).padStart(16,'0');
function count(e,fields={}){return {requestId:req(),kind:'STOCK_COUNT',date:'2026-10-25',distributor:'D1',reason:'Hasil hitung fisik diverifikasi',items:[{productId:'P1',targetQty:10}],...fields};}
function tx(e,product,amount,sales='S1',date='2026-10-24'){const h=e.rows('SALES_TRANSACTIONS')[0],r={transaction_id:req(),transaction_date:date,sales_id:sales,sales_name:'Audit sales',team_name:'Motoris',product_id:product,product_name:product,quantity:1,selling_price:amount,cost_price:0,subtotal_sales:amount,subtotal_cost:0,subtotal_shj:amount};e.rows('SALES_TRANSACTIONS').push(h.map(k=>r[k]??''));}
function rulesRow(e){const hs=e.rows(e.c.KCH_PERIOD_MASTERS_)[0],row=e.rows(e.c.KCH_PERIOD_MASTERS_).find((r,i)=>i&&r[hs.indexOf('period')]==='2026-10'&&r[hs.indexOf('entity')]==='RULES');return {get:()=>JSON.parse(row[hs.indexOf('data_json')]),set:value=>{row[hs.indexOf('data_json')]=JSON.stringify(value);e.c.KCH_PERIOD_CACHE_=null;}};}
test('L06: opname rejects missing previews and physical counts invalidated by an intervening sale',()=>{
 const e=auditSystem(),input=count(e),preview=e.call('getStockCountPreview',input);assert.equal(preview.items[0].before,10);assert.equal(preview.items[0].delta,0);
 assert.equal(e.save().success,true);assert.equal(e.stock(),8);const rejected=e.call('saveOperationalChange',{...input,expectedRevision:preview.revision});assert.equal(rejected.state,'FAILED');assert.match(rejected.message,/Saldo atau hitungan/);assert.equal(e.stock(),8);
 assert.equal(e.call('saveOperationalChange',count(e)).state,'FAILED');assert.equal(e.stock(),8);
});
test('L06: confirmed count commits once, and altering the target or account invalidates its preview',()=>{
 const e=auditSystem(),input=count(e,{items:[{productId:'P1',targetQty:7}]}),p=e.call('getStockCountPreview',input);assert.equal(p.items[0].delta,-3);
 const bad=e.call('saveOperationalChange',{...input,requestId:req(),items:[{productId:'P1',targetQty:99}],expectedRevision:p.revision});assert.equal(bad.state,'FAILED');assert.equal(e.stock(),10);
 const payload={...input,expectedRevision:p.revision},saved=e.call('saveOperationalChange',payload);assert.equal(saved.success,true,saved.message);assert.equal(e.stock(),7);assert.equal(e.call('saveOperationalChange',payload).replayed,true);assert.equal(e.stock(),7);
});
test('L06: returning to the same balance does not revive an old count preview; Guest preview is denied',()=>{
 const e=auditSystem(),input=count(e),p=e.call('getStockCountPreview',input);e.save();e.call('saveOperationalChange',{requestId:req(),kind:'STOCK_IN',date:'2026-10-25',reason:'Penerimaan nyata',distributor:'D1',items:[{productId:'P1',qty:2}]});assert.equal(e.stock(),10);
 assert.equal(e.call('saveOperationalChange',{...input,expectedRevision:p.revision}).state,'FAILED');e.actor({role:'GUEST'});assert.throws(()=>e.call('getStockCountPreview',input),/Tamu hanya boleh/);
});
test('L06: held-account previews bind sales and distributor and reject duplicate products',()=>{
 const e=auditSystem();e.call('saveStockPickup',{requestId:req(),salesId:'S1',date:'2026-10-25',distributor:'D1',items:[{productId:'P1',qty:2}]});const input=count(e,{sourceType:'SALES',salesId:'S1',items:[{productId:'P1',targetQty:1}]}),p=e.call('getStockCountPreview',input);assert.equal(p.items[0].before,2);
 assert.equal(e.call('saveOperationalChange',{...input,salesId:'S2',expectedRevision:p.revision}).state,'FAILED');const r=e.call('saveOperationalChange',{...input,requestId:req(),expectedRevision:p.revision});assert.equal(r.success,true,r.message);assert.equal(e.objects('SALES_STOCK')[0].quantity,1);assert.equal(e.stock(),8);
 assert.throws(()=>e.call('getStockCountPreview',{...input,items:[...input.items,...input.items]}),/ganda/);
});
test('L03: incompatible protected product rename is rejected atomically while valid extensions remain usable',()=>{
 const e=auditSystem(),r=e.call('getMasterEditor').tables.PRODUCTS.rows.find(r=>r.data.product_id==='LBMAV'),before=JSON.stringify(e.rows('PRODUCTS'));
 const payload={requestId:req(),table:'PRODUCTS',data:{...r.data,product_name:'Bejo JM',unit:'Box'},expectedRevision:r.revision,reason:'Nama dirapikan'};
 const rejected=e.call('saveMasterRecord',payload);assert.equal(rejected.state,'FAILED');assert.match(rejected.message,/terikat pemetaan/);assert.equal(JSON.stringify(e.rows('PRODUCTS')),before);assert.equal(e.call('getScoreSetup').mappingReady,true);assert.equal(e.call('getIncentiveReport','2026-10','S1').success,true);
 const allowed=e.call('saveMasterRecord',{...payload,requestId:req(),data:{...r.data,unit:'Box',product_name:'Bejo Jahe Merah Kemasan Box'}});assert.equal(allowed.success,true,allowed.message);assert.equal(e.call('getScoreSetup').mappingReady,true);
});
test('L03: a new code cannot impersonate a product name reserved by the scoring map',()=>{
 const e=auditSystem(),r=e.call('saveMasterRecord',{requestId:req(),table:'PRODUCTS',expectedRevision:'',reason:'Produk baru',data:{product_id:'OTHER-BEJO',product_name:'Bejo Jahe Merah',unit:'Box',status:'ACTIVE'}});assert.equal(r.state,'FAILED');assert.equal(e.objects('PRODUCTS').some(r=>r.product_id==='OTHER-BEJO'),false);assert.equal(e.objects('INVENTORY').some(r=>r.product_id==='OTHER-BEJO'),false);
});
test('L01: closed scores and money retain snapshot product rules after current mapping changes',()=>{
 const e=auditSystem();tx(e,'LBMAV',1200000);e.capturePeriod();e.clock('2026-11-03 12:00:00');const before=e.call('getScoreReport','2026-10','S1'),money=e.call('getIncentiveReport','2026-10','S1');e.c.KCH_SCORE_PRODUCT_RULES_.LBMAV[1]='OTHER';e.c.KCH_SCORE_PRODUCT_RULES_.LPRGN[1]='OTHER';
 const after=e.call('getScoreReport','2026-10','S1');assert.equal(after.masterVerified,true);assert.equal(after.parameters[0].actual,before.parameters[0].actual);assert.deepEqual(clone(after.parameters),clone(before.parameters));assert.equal(e.call('getIncentiveReport','2026-10','S1').monthTotal,money.monthTotal);
});
test('L01: closed Senior/Junior reports retain loading lists, pair and 70 percent allocation',()=>{
 const e=auditSystem(),c=e.c,senior='CANVASSER-BAC-LHOKSEUMAWE-1',junior='JUNIOR CANVASSER-BAC-LHOKSEUMAWE-1';
 e.cell('SALES','S1',['team_name','Canvasser']);e.cell('SALES','S2',['team_name','Junior Canvasser']);e.cell('SALES','S1',['sales_id',senior]);e.cell('SALES','S2',['sales_id',junior]);
 for(const id of c.KCH_CANVASSER_LOADING_)if(!e.objects('PRODUCTS').some(p=>p.product_id===id))e.rows('PRODUCTS').push([id,'Loading '+id,'ACTIVE']);tx(e,'LBMAV',3500000,senior);e.capturePeriod();e.clock('2026-11-03 12:00:00');const before=e.call('getIncentiveReport','2026-10',junior);assert.equal(before.allocationFactor,0.7);
 c.KCH_CANVASSER_LOADING_=[];c.KCH_INCENTIVE_PAIRS_=[['UNRELATED',junior]];c.KCH_SCORE_PRODUCT_RULES_.LBMAV[1]='OTHER';const after=e.call('getIncentiveReport','2026-10',junior);assert.equal(after.masterVerified,true);assert.equal(after.referenceSales.salesId,senior);assert.equal(after.monthTotal,before.monthTotal);assert.equal(after.dailyTotal,before.dailyTotal);
});
test('L01: unsupported formula versions and altered V1 tariffs cannot certify historical money',()=>{
 for(const mutation of [p=>p.formulaVersion=999,p=>p.tariffsField[0][0]=999999]){const e=auditSystem();e.capturePeriod();e.clock('2026-11-03 12:00:00');const row=rulesRow(e),p=row.get();mutation(p);row.set(p);const r=e.call('getIncentiveReport','2026-10','S1');assert.equal(r.masterVerified,false);assert.equal(r.monthTotal,null);assert.equal(r.quarter.amount,null);}
});
test('L02: absent calendar stays unknown after month close and every daily monetary cell remains blank',()=>{
 const e=auditSystem();e.remove('HOLIDAYS');tx(e,'LBMAV',1500001);e.capturePeriod();e.clock('2026-11-03 12:00:00');const r=e.call('getIncentiveReport','2026-10','S1');assert.equal(r.masterVerified,false);assert.equal(r.holidaySource,'');assert.equal(r.dailyTotal,null);assert.equal(r.monthTotal,null);assert.ok(r.daily.every(d=>d.amount===null&&d.scheduled===null));
});
test('L02: an explicitly captured empty calendar is valid, but legacy ambiguous empty calendars are not',()=>{
 const e=auditSystem();e.capturePeriod();e.clock('2026-11-03 12:00:00');assert.equal(e.call('getIncentiveReport','2026-10','S1').masterVerified,true);const row=rulesRow(e),p=row.get();delete p.calendar;row.set(p);assert.equal(e.call('getIncentiveReport','2026-10','S1').masterVerified,false);
});
test('L02: explicit source verification can complete an ambiguous legacy snapshot once without changing business rows',()=>{
 const e=auditSystem();e.cell('SALES','S1',['target_monthly',27000000]);e.cell('SALES','S2',['target_monthly',27000000]);e.capturePeriod();const old=rulesRow(e),p=old.get();delete p.calendar;old.set(p);
 const b=e.call('createOperationalBackup',req()),source=e.objects(e.c.KCH_BACKUPS_).find(r=>r.backup_id===b.backupId);e.clock('2026-11-03 12:00:00');const transactions=JSON.stringify(e.rows('SALES_TRANSACTIONS')),r=e.call('savePeriodVerification',{requestId:req(),month:'2026-10',sourceId:source.spreadsheet_id,confirmation:'VERIFIKASI 2026-10',reason:'Kalender kosong dicocokkan dengan sumber Oktober'});assert.equal(r.success,true,r.message);assert.equal(e.call('getIncentiveReport','2026-10','S1').masterVerified,true);assert.equal(JSON.stringify(e.rows('SALES_TRANSACTIONS')),transactions);
 assert.equal(e.call('savePeriodVerification',{requestId:req(),month:'2026-10',sourceId:source.spreadsheet_id,confirmation:'VERIFIKASI 2026-10',reason:'Coba timpa bulan final'}).state,'FAILED');
});
test('L04: missing held balance is detected from ledger even though no balance rows remain',()=>{
 const e=auditSystem();e.call('saveStockPickup',{requestId:req(),salesId:'S1',date:'2026-10-25',distributor:'D1',items:[{productId:'P1',qty:2}]});e.rows('SALES_STOCK').splice(1);const r=e.call('getOperationalHealth');assert.ok(r.issues.some(i=>i.table==='SALES_STOCK'&&/saldo hilang/.test(i.message)));
});
test('L04: distributor swaps and orphaned references are detected without requiring a total-stock mismatch',()=>{
 const e=auditSystem();e.save();e.rows('INVENTORY')[1][2]=7;e.rows('INVENTORY')[1][3]=6;const r=e.call('getOperationalHealth');assert.ok(r.issues.some(i=>i.table==='INVENTORY'&&/Saldo distributor/.test(i.message)));
 const other=auditSystem();other.call('saveStockPickup',{requestId:req(),salesId:'S1',date:'2026-10-25',distributor:'D1',items:[{productId:'P1',qty:2}]});other.rows('SALES_STOCK')[1][0]='MISSING-SALES';assert.ok(other.call('getOperationalHealth').issues.some(i=>i.table==='SALES_STOCK'&&/Referensi/.test(i.message)));
});
test('L05: month-specific selectors expose historical members after they move to an ineligible current team',()=>{
 const e=auditSystem();e.capturePeriod();e.clock('2026-11-03 12:00:00');e.cell('SALES','S1',['team_name','SPR']);e.actor({role:'GUEST'});for(const method of ['getScoreSetup','getIncentiveSetup']){assert.equal(e.call(method).sales.some(s=>s.salesId==='S1'),false);const old=e.call(method,'2026-10').sales.find(s=>s.salesId==='S1');assert.equal(old.team,'Motoris');assert.equal(e.call(method,'2026-11').sales.some(s=>s.salesId==='S1'),false);assert.throws(()=>e.call(method,'bad-month'),/bulan/i);}assert.equal(e.call('getScoreReport','2026-10','S1').success,true);
});
test('L03: legacy aliases cannot be added as a second product under the same canonical scoring code',()=>{
 const e=auditSystem(),r=e.call('saveMasterRecord',{requestId:req(),table:'PRODUCTS',expectedRevision:'',reason:'Cek alias lama',data:{product_id:'LPRGQ',product_name:'Promag Herbal',unit:'Box',status:'ACTIVE'}});assert.equal(r.state,'FAILED');assert.match(r.message,/kanonik/);assert.equal(e.call('getScoreSetup').mappingReady,true);
});
test('L02: historical verification rejects a private registered source that has no calendar',()=>{
 const e=auditSystem();e.cell('SALES','S1',['target_monthly',27000000]);e.cell('SALES','S2',['target_monthly',27000000]);e.remove('HOLIDAYS');const b=e.call('createOperationalBackup',req()),source=e.objects(e.c.KCH_BACKUPS_).find(r=>r.backup_id===b.backupId);e.clock('2026-11-03 12:00:00');const r=e.call('savePeriodVerification',{requestId:req(),month:'2026-10',sourceId:source.spreadsheet_id,confirmation:'VERIFIKASI 2026-10',reason:'Sumber tidak memiliki kalender'});assert.equal(r.state,'FAILED');assert.match(r.message,/Kalender sumber/);
});
test('L04: a deleted entire balance table is an error and ambiguous legacy snapshots are visible in Monitor',()=>{
 const e=auditSystem();e.capturePeriod();const row=rulesRow(e),p=row.get();delete p.calendar;row.set(p);e.clock('2026-11-03 12:00:00');e.remove('SALES_STOCK');const health=e.call('getOperationalHealth');assert.ok(health.issues.some(i=>i.table==='SALES_STOCK'&&i.level==='ERROR'));assert.ok(health.issues.some(i=>i.table==='MASTER PERIODE'&&/2026-10/.test(i.message)));
});
test('installation errors identify the HTML filename and never echo backend source in the public page',()=>{
 const e=auditSystem(),sensitive='PRIVATE_BACKEND_SOURCE';let content;
 const output=html=>({setTitle(){return this;},addMetaTag(){return this;},setXFrameOptionsMode(){return this;},getContent:()=>html});
 e.c.HtmlService={XFrameOptionsMode:{ALLOWALL:1},createHtmlOutput:html=>{content=html;return output(html);},createTemplateFromFile:()=>({evaluate(){e.c.include_('incentive-client');}}),createHtmlOutputFromFile(){throw Error('Konten HTML rusak: '+sensitive);}};
 e.c.doGet();assert.match(content,/incentive-client\.html/);assert.equal(content.includes(sensitive),false);
 e.c.HtmlService.createHtmlOutputFromFile=()=>output('var WRONG_FILE=1;');assert.throws(()=>e.c.include_('incentive-client'),/File incentive-client\.html belum sesuai/);
 e.c.HtmlService.createHtmlOutputFromFile=()=>output('<script>var VALID_CLIENT=1;</script>');assert.match(e.c.include_('incentive-client'),/VALID_CLIENT/);
});
test('closed dashboard and monthly targets use captured values when current target helpers change',()=>{
 const e=auditSystem();e.capturePeriod();e.clock('2026-11-03 12:00:00');e.c.getIndividualMonthlyTarget_=()=>999999999;e.c.getIndividualDailyTargetRate_=()=>999999999;e.actor({role:'GUEST'});const monthly=e.call('getMonthlyTeamReport','2026-10','S1'),dashboard=e.call('getDashboardMetrics',{period:'CUSTOM',startDate:'2026-10-01',endDate:'2026-10-31'});assert.equal(monthly.sales.targetMonthly,27000000);assert.equal(dashboard.salesPerformance.find(r=>r.salesId==='S1').monthlyTarget,27000000);assert.equal(dashboard.salesPerformance.find(r=>r.salesId==='S1').dailyRate,1200000);
});
test('policy identity ignores object/list ordering while preserving all monetary rules',()=>{
 const e=auditSystem();e.capturePeriod();e.clock('2026-11-03 12:00:00');const before=e.call('getIncentiveReport','2026-10','S1');assert.equal(before.quarter.masterVerified,true);const row=rulesRow(e),p=row.get();p.productRules=Object.fromEntries(Object.entries(p.productRules).reverse());p.loading.reverse();p.pairs.reverse();row.set(p);const after=e.call('getIncentiveReport','2026-10','S1');assert.equal(after.quarter.masterVerified,true);assert.equal(after.monthTotal,before.monthTotal);assert.equal(after.quarter.amount,before.quarter.amount);
});
