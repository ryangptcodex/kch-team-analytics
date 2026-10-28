const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {system} = require('./helpers/transaction-system.cjs');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const e = system(), c = e.context;
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../score.gs'),'utf8'),c);
  for (const [id,[name]] of Object.entries(c.KCH_SCORE_PRODUCT_RULES_)) e.rows('PRODUCTS').push([id,name,'ACTIVE']);
  e.rows('SALES')[2][2] = 'MMTW';
  e.actor({role:'ADMIN'});
  e.api=(name,...args)=>c.kchApi('MOCK',name,args);
  e.report=(month='2026-10',sales='S1')=>e.api('getScoreReport',month,sales);
  let sequence=0;
  e.aa=(count=10,date='2026-10-01',salesId='S1',extra={})=>e.api('saveScoreAA',{requestId:'SCORE-REQUEST-'+String(++sequence).padStart(16,'0'), expectedRevision:'', count,date,salesId,...extra});
  e.tx=(product,amount,extra={})=>{
    const row={transaction_id:'INV-1',transaction_date:'2026-10-01',sales_id:'S1',product_id:product,product_name:'Historical name intentionally different',quantity:1,selling_price:amount,subtotal_sales:amount,...extra};
    e.rows('SALES_TRANSACTIONS').push([...c.TABLE_SCHEMAS.SALES_TRANSACTIONS].map(h=>row[h]??''));
  };
  e.add=(name,rows)=>{const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),req=[]; const sheet=c.txAddSheet_(meta,req,name,rows[0],false); if(rows.length>1)req.push(c.txAppend_(sheet.sheetId,rows.slice(1)));c.txBatch_(ctx,req);};
  return e;
}
test('exact confirmed product codes: six Family variants plus Promag count; Kids is ordinary turnover; mixed invoice excludes only tablet line',()=>{
  const e=fixture();
  e.tx('LBMAV',5000000);
  for(const id of ['LKXOD','LKXJA','LKXPA','LKXNA','LKXOB','LKXLA','LPRGQ'])e.tx(id,625000);
  e.rows('PRODUCTS').push(['LKXKA','Komix Herbal Kids','ACTIVE']);e.tx('LKXKA',625000);
  e.tx('LPRGN',90000000);e.tx('P1',17000000);
  const r=e.report(); assert.equal(r.mappingReady,true); assert.deepEqual(copy(r.parameters.map(p=>p.actual)),[5000000,4375000,27000000,0]);
  assert.equal(r.total,86.875);assert.equal(r.parameters[1].score,21.875);assert.equal(r.category,'LANJUT BULAN BERIKUTNYA');
});
test('Excel ratios, decimal weights, individual caps, no carryover between parameters',()=>{
  const e=fixture();e.tx('LBMAV',10000000);
  e.aa(800);
  const r=e.report();assert.equal(r.parameters[0].points,80);assert.equal(r.parameters[0].score,40);assert.equal(r.parameters[3].points,20);assert.equal(r.parameters[3].score,10);
  assert.equal(r.total,40+10+0.25*(10000000/27000000)*100);
});
test('categories use original total at exact and immediately below 40 and 60; never ROUND',()=>{
  const c=fixture().context;
  for(const [n,category]of [[0,'EVALUASI'],[39.999999,'EVALUASI'],[40,'DISPENSASI LANJUT'],[59.999999,'DISPENSASI LANJUT'],[60,'LANJUT BULAN BERIKUTNYA'],[100,'LANJUT BULAN BERIKUTNYA']]) assert.equal(c.scoreCategory_(n),category);
  const ps=c.scoreParameters_([1234567.89,2345678.91,12345678.91,123]);
  assert.equal(ps[0].score,0.4*(1234567.89/5000000)*100);
  assert.equal(ps[3].score,0.1*(123/400)*100);
});
test('full-month targets unchanged by opening date; calendar excludes Sundays and configured holidays',()=>{
  const e=fixture();e.add('HOLIDAYS',[['date','holiday_name'],['2026-10-01','Libur'],['2026-10-04','Minggu juga'],['2026-10-01','Duplikat']]);
  const r=e.report();assert.equal(r.workDays,26);assert.equal(r.workDaysPassed,20);
  assert.deepEqual(copy(r.parameters.map(p=>p.target)),[5000000,5000000,27000000,400]);assert.equal(r.dailyAA.length,31);
  assert.equal(r.dailyAA[0].isWorkDay,false);assert.equal(r.dailyAA[3].isWorkDay,false);
});
test('next month follows selected period including December year rollover and leap-year calendar',()=>{
  const e=fixture();assert.equal(e.report('2026-09').nextMonth,'Oktober 2026'); assert.equal(e.report('2026-12').nextMonth,'Januari 2027'); assert.equal(e.report('2024-02').dailyAA.length,29);
});
test('sales and period filters; future dates omitted, timestamp dates and Indonesian dates supported',()=>{
  const e=fixture();e.tx('P1',111,{transaction_date:'2026-10-01 14:22:00'});e.tx('P1',222,{transaction_date:'02/10/2026'});
  e.tx('P1',900,{transaction_date:'2026-09-30'});e.tx('P1',900,{transaction_date:'2026-10-26'});e.tx('P1',900,{sales_id:'S2'});
  assert.equal(e.report().parameters[2].actual,333); assert.equal(e.report().totalAA,0);
});
test('AA is manual per sales/date; invoices and attendance never generate AA; missing distinct from explicit zero',()=>{
  const e=fixture();for(let i=0;i<12;i++)e.tx('P1',100);
  assert.equal(e.report().totalAA,0);assert.equal(e.report().dailyAA[0].count,null);
  e.aa(0);e.aa(12,'2026-10-02');e.aa(12,'2026-10-03');e.aa(100,'2026-09-01');e.aa(99,'2026-10-01','S2');
  const r=e.report();assert.equal(r.totalAA,24);assert.equal(r.enteredDays,3);assert.equal(r.dailyAA[0].count,0);assert.equal(r.dailyAA[3].count,null);
});
test('AA correction replaces daily count; replay does not add; immutable ledger records actor and previous revision',()=>{
  const e=fixture(),a=e.aa(10),id='SCORE-CORRECTION-00000001';e.aa(16,'2026-10-01','S1',{requestId:id,expectedRevision:a.revision});
  assert.equal(e.report().totalAA,16);assert.equal(e.aa(16,'2026-10-01','S1',{requestId:id,expectedRevision:a.revision}).replayed,true);
  const rows=e.rows('SKOR_EVENTS');assert.equal(rows.length,3);assert.equal(rows[2][2],a.revision);assert.equal(rows[2][4],'one@example.test');assert.equal(rows[2][6],'ADMIN');
  assert.equal(e.report().dailyAA[0].revision,id);
});
test('optimistic revision conflict protects another admin correction, including ABA',()=>{
  const e=fixture(),a=e.aa(10),b=e.aa(12,'2026-10-01','S1',{expectedRevision:a.revision});
  e.aa(10,'2026-10-01','S1',{expectedRevision:b.revision});
  const r=e.aa(99,'2026-10-01','S1',{expectedRevision:a.revision});assert.equal(r.code,'REVISION_CONFLICT');assert.equal(e.report().totalAA,10);
});
test('ambiguous network failure after commit is recovered by replay of the same event ID',()=>{
  const e=fixture(),original=e.context.UrlFetchApp.fetch; let lost=true;
  e.context.UrlFetchApp.fetch=(url,request)=>{const r=original(url,request);if(lost&&url.endsWith(':batchUpdate')){lost=false;throw Error('lost after commit');}return r;};
  const input={requestId:'SCORE-LOST-RESPONSE-0001'},r=e.aa(17,'2026-10-01','S1',input);assert.equal(r.code,'SAVE_UNCERTAIN');assert.equal(e.report().totalAA,17);
  assert.equal(e.aa(17,'2026-10-01','S1',input).replayed,true);assert.equal(e.rows('SKOR_EVENTS').length,2);
});
test('duplicate delayed event delivery counts once; forked history fails closed',()=>{
  const e=fixture(),a=e.aa(10);e.rows('SKOR_EVENTS').push(copy(e.rows('SKOR_EVENTS')[1]));assert.equal(e.report().totalAA,10);
  const conflict=copy(e.rows('SKOR_EVENTS')[1]);conflict[0]='SCORE-ANOTHER-BRANCH';conflict[3]=JSON.stringify({salesId:'S1',date:'2026-10-01',count:90});e.rows('SKOR_EVENTS').push(conflict);
  assert.throws(()=>e.report(),/bercabang/);
});
test('request IDs cannot be reused with changed count, scope, previous revision or actor',()=>{
  const e=fixture(),id='SCORE-COLLISION-00000001';e.aa(10,'2026-10-01','S1',{requestId:id});
  assert.throws(()=>e.aa(11,'2026-10-01','S1',{requestId:id}),/data lain/);
  assert.throws(()=>e.aa(10,'2026-10-02','S1',{requestId:id}),/data lain/);
  e.actor({uid:'other-admin'});assert.throws(()=>e.aa(10,'2026-10-01','S1',{requestId:id}),/data lain/);
});
test('only admins may write AA; sales reports/setup disclose only own sales, not other AA or mapping',()=>{
  const e=fixture();e.aa(13);e.aa(99,'2026-10-01','S2');e.actor({role:'SALES'});
  assert.throws(()=>e.aa(10),/Hanya admin/);assert.throws(()=>e.report('2026-10','S2'),/data sendiri/);
  const setup=e.api('getScoreSetup');assert.equal(setup.sales.length,1);assert.equal(setup.products.length,0);assert.equal(setup.canManage,false);
  assert.equal(e.report().totalAA,13);assert.equal(e.context.KCH_REQUEST_USER_,null);
  e.context.KCH_REQUEST_USER_={role:'SALES',salesId:'S1'};assert.deepEqual(copy(e.context.filterAuthorizedRows_('SKOR_EVENTS',[{secret:true}])),[]);
});
test('Motoris and MMTW share exact rules; excludes Ultimate and unrelated teams',()=>{
  const e=fixture(); assert.deepEqual(copy(e.report().parameters),copy(e.report('2026-10','S2').parameters));
  for(const team of ['Motoris Ultimate','SPG Kelontong']){e.rows('SALES')[2][2]=team; assert.throws(()=>e.report('2026-10','S2'),/hanya tersedia/);}
  e.rows('SALES')[2][2]='TEAM-02';assert.equal(e.report('2026-10','S2').sales.team,'TEAM-02');
});
test('AA rejects negative, fractional, blank/string/unsafe counts, invalid/future dates and inactive or unknown sales',()=>{
  const e=fixture();for(const value of [-1,1.5,'12','',null,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>e.aa(value),/bilangan bulat/);
  for(const d of ['2026-02-30','2026-10-26','bad','2026-10-01 10:00:00'])assert.throws(()=>e.aa(1,d),/Tanggal/);
  assert.throws(()=>e.aa(1,'2026-10-01','unknown'),/tidak ditemukan/);e.rows('SALES')[1][3]='INACTIVE';assert.throws(()=>e.aa(1),/tidak aktif/);
  assert.equal(e.exists('SKOR_EVENTS'),false);
});
test('mapping uses codes and validates actual master names, ignores historical transaction labels',()=>{
  const e=fixture();e.tx('LPRGN',999,{product_name:'Promag Herbal'});e.tx('LPRGQ',100,{product_name:'Promag Tablet'});assert.equal(e.report().parameters[2].actual,100);
  e.rows('PRODUCTS').find(p=>p[0]==='LPRGN')[1]='Promag Herbal';const r=e.report();assert.equal(r.mappingReady,false);assert.equal(r.total,null);assert.equal(r.category,null);assert.match(r.message,/LPRGN/);
});
test('missing known codes, new focus/Promag codes, duplicate master and unknown transaction products never silently misclassify',()=>{
  const e=fixture();e.rows('PRODUCTS').splice(e.rows('PRODUCTS').findIndex(p=>p[0]==='LBMAV'),1);assert.equal(e.report().mappingReady,false);
  const n=fixture();n.rows('PRODUCTS').push(['NEWPROMAG','Promag Tablet','ACTIVE']);assert.equal(n.report().mappingReady,false);
  const d=fixture();d.rows('PRODUCTS').push(['LBMAV','Bejo Jahe Merah','ACTIVE']);assert.throws(()=>d.report(),/ganda/);
  const t=fixture();t.tx('MISSING',500);assert.throws(()=>t.report(),/tidak ada di master/);
});
test('currency cents are preserved and fallback price times quantity is supported',()=>{
  const e=fixture();e.tx('P1',0.1);e.tx('P1',0.2);e.tx('LPRGQ',123.45,{quantity:2,subtotal_sales:''});
  const r=e.report();assert.equal(r.parameters[1].actual,246.9);assert.equal(r.parameters[2].actual,247.2);
});
test('invalid financial rows and malformed holiday configuration fail visibly; invalid months rejected',()=>{
  for(const bad of [{subtotal_sales:-1},{subtotal_sales:'not money'},{quantity:0},{transaction_date:'2026-10-32'}]){const e=fixture();e.tx('P1',100,bad);assert.throws(()=>e.report());}
  const e=fixture();for(const month of ['2026-00','2026-13','2026-1','bad'])assert.throws(()=>e.report(month),/bulan/);
  e.add('HOLIDAYS',[['wrong','holiday_name'],['2026-10-01','Libur']]);assert.throws(()=>e.report(),/Kolom tanggal/);
});
test('committed create and edit remain intact; score reload uses edited lines and current period',()=>{
  const e=fixture();e.actor({role:'SALES'});const saved=e.save();assert.equal(saved.success,true);assert.equal(e.report().parameters[2].actual,200);
  const snapshot=e.api('getSalesTransactionForEdit',saved.transactionId);assert.equal(snapshot.success,true);
  const edited=e.api('editSalesTransaction',{transactionId:saved.transactionId,requestId:'SCORE-EDIT-TEST-00000001',expectedRevision:snapshot.revision,salesId:snapshot.header.salesId,distributor:snapshot.header.distributor,date:snapshot.header.date,notes:snapshot.header.notes,items:[{productId:'P1',qty:3,costPrice:60,sellingPrice:100}],reason:'Koreksi jumlah'});
  assert.equal(edited.success,true);assert.equal(e.stock(),7);assert.equal(e.report().parameters[2].actual,300);
  const moved=e.api('getSalesTransactionForEdit',saved.transactionId);
  assert.equal(e.api('editSalesTransaction',{transactionId:saved.transactionId,requestId:'SCORE-EDIT-PERIOD-000001',expectedRevision:moved.revision,salesId:moved.header.salesId,distributor:moved.header.distributor,date:'2026-09-30',notes:moved.header.notes,items:moved.items,reason:'Koreksi tanggal'}).success,true);
  assert.equal(e.report().parameters[2].actual,0);assert.equal(e.report('2026-09').parameters[2].actual,300);
});

test('other Promag variants remain ordinary KPI turnover; exclusion is specific to LPRGN',()=>{
  const e=fixture();e.rows('PRODUCTS').push(['PRGOTHER','Promag Double Action','ACTIVE']);e.tx('PRGOTHER',700);
  const r=e.report();assert.equal(r.mappingReady,true);assert.equal(r.parameters[1].actual,0);assert.equal(r.parameters[2].actual,700);
});

test('guest can view Motoris and MMTW scores/AA across sales, with no write access or sheet changes',()=>{
  const e=fixture();e.aa(10);e.aa(20,'2026-10-01','S2');const before=JSON.stringify(e.rows('SKOR_EVENTS'));
  e.actor({role:'GUEST',uid:'guest',email:'juniortlkchlse@gmail.com',salesId:''});
  const setup=e.api('getScoreSetup');assert.equal(setup.canManage,false);assert.equal(setup.sales.length,2);assert.equal(setup.products.length,0);
  assert.equal(e.report().totalAA,10);assert.equal(e.report('2026-10','S2').totalAA,20);assert.throws(()=>e.aa(99),/Tamu hanya boleh melihat/);
  assert.equal(JSON.stringify(e.rows('SKOR_EVENTS')),before);
});

function brandingFixture(team='MPR') {
  const e=fixture();e.rows('SALES')[1][2]=team;e.rows('SALES')[2][2]='Canvasser';let seq=0;
  e.brand=(count=10,date='2026-10-01',salesId='S1',extra={})=>e.api('saveScoreBranding',{requestId:'BRANDING-REQUEST-'+String(++seq).padStart(12,'0'),expectedRevision:'',count,date,salesId,...extra});
  return e;
}
test('MPR and Canvasser use their own 6.4m/8.2m/80m targets, AA 400 and branding 300',()=>{
  for(const team of ['MPR','Canvasser','TEAM-01']){
    const e=brandingFixture(team);e.tx('LBMAV',6400000);e.tx('LKXOD',8200000);e.tx('P1',65400000);e.aa(400);e.brand(300);
    const r=e.report();assert.equal(r.brandingEnabled,true);assert.equal(r.total,100);
    assert.deepEqual(copy(r.parameters.map(p=>[p.target,p.weight,p.max])),[[6400000,.4,40],[8200000,.25,25],[80000000,.25,25],[400,.05,5],[300,.05,5]]);
  }
});
test('Motoris/MMTW remain exactly four parameters with AA 10 and reject branding writes',()=>{
  for(const team of ['Motoris','MMTW']){
    const e=brandingFixture(team);e.aa(400);const r=e.report();assert.equal(r.parameters.length,4);assert.equal(r.parameters[3].score,10);assert.equal(r.brandingEnabled,false);assert.equal(r.dailyBranding.length,0);
    assert.throws(()=>e.brand(300),/hanya tersedia untuk MPR dan Canvasser/);
  }
});
test('MPR/Canvasser fractional AA/branding scores follow original Excel precision and independent caps',()=>{
  const e=brandingFixture();e.aa(123);e.brand(117);let r=e.report();assert.equal(r.parameters[3].score,.05*(123/400)*100);assert.equal(r.parameters[4].score,.05*(117/300)*100);
  assert.equal(r.total,r.parameters.reduce((n,p)=>n+p.score,0));assert.equal(r.parameters[3].max,5);
  const c=brandingFixture();c.aa(1000);c.brand(1000);r=c.report();assert.equal(r.parameters[3].score,5);assert.equal(r.parameters[4].score,5);
});
test('branding daily counts accumulate by month/sales and never come from invoice counts',()=>{
  const e=brandingFixture();e.tx('P1',500);assert.equal(e.report().totalBranding,0);assert.equal(e.report().dailyBranding[0].count,null);
  e.brand(10);e.brand(20,'2026-10-02');e.brand(99,'2026-09-01');e.brand(88,'2026-10-01','S2');
  const r=e.report();assert.equal(r.totalBranding,30);assert.equal(r.brandingEnteredDays,2);assert.equal(e.report('2026-09').totalBranding,99);assert.equal(e.report('2026-10','S2').totalBranding,88);assert.equal(r.totalAA,0);
});
test('branding correction replaces a day, replays safely and is independent of AA revisions',()=>{
  const e=brandingFixture(),a=e.brand(10);e.aa(7);
  const id='BRANDING-CORRECT-00001';assert.equal(e.brand(12,'2026-10-01','S1',{requestId:id,expectedRevision:a.revision}).success,true);
  assert.equal(e.brand(12,'2026-10-01','S1',{requestId:id,expectedRevision:a.revision}).replayed,true);
  assert.equal(e.report().totalBranding,12);assert.equal(e.report().totalAA,7);assert.equal(e.rows('SKOR_EVENTS').length,4);
  assert.equal(e.brand(99,'2026-10-01','S1',{expectedRevision:a.revision}).code,'REVISION_CONFLICT');
  assert.equal(e.rows('SKOR_EVENTS').at(-1)[1],'BRANDING:S1:2026-10-01');assert.equal(e.rows('SKOR_EVENTS').at(-1)[6],'ADMIN');
});
test('branding validates counts, active sales and real nonfuture dates before writing',()=>{
  const e=brandingFixture();for(const n of [-1,1.5,'1','',null,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>e.brand(n),/bilangan bulat/);
  for(const d of ['2026-10-26','2026-02-30','bad','2026-10-01 12:00:00'])assert.throws(()=>e.brand(1,d),/Tanggal/);
  e.rows('SALES')[1][3]='INACTIVE';assert.throws(()=>e.brand(1),/tidak aktif/);assert.equal(e.exists('SKOR_EVENTS'),false);
});
test('new scoring eligibility excludes Junior Canvasser, Asisten MPR, Ultimate and unrelated teams',()=>{
  for(const team of ['Junior Canvasser','Asisten MPR','Motoris Ultimate','SPG Kelontong']){const e=brandingFixture(team);assert.throws(()=>e.report(),/hanya tersedia/);assert.throws(()=>e.brand(),/hanya tersedia/);}
});
test('guest can read both MPR/Canvasser branding, but cannot write or mutate AA/history',()=>{
  const e=brandingFixture();e.brand(10);e.brand(20,'2026-10-01','S2');const before=JSON.stringify(e.rows('SKOR_EVENTS'));
  e.actor({role:'GUEST',uid:'guest',email:'juniortlkchlse@gmail.com',salesId:''});assert.equal(e.api('getScoreSetup').sales.length,2);assert.equal(e.report().totalBranding,10);assert.equal(e.report('2026-10','S2').totalBranding,20);
  assert.throws(()=>e.brand(100),/Tamu hanya boleh melihat/);assert.equal(JSON.stringify(e.rows('SKOR_EVENTS')),before);
});
test('uncertain branding response reuses its event ID without appending or counting twice',()=>{
  const e=brandingFixture(),original=e.context.UrlFetchApp.fetch;let lose=true;
  e.context.UrlFetchApp.fetch=(url,req)=>{const r=original(url,req);if(lose&&url.endsWith(':batchUpdate')){lose=false;throw Error('lost');}return r;};
  const input={requestId:'BRANDING-LOST-00000001'};assert.equal(e.brand(17,'2026-10-01','S1',input).code,'SAVE_UNCERTAIN');assert.equal(e.brand(17,'2026-10-01','S1',input).replayed,true);assert.equal(e.report().totalBranding,17);assert.equal(e.rows('SKOR_EVENTS').length,2);
});
test('branding IDs cannot collide with AA or another day, and unsafe total is rejected',()=>{
  const e=brandingFixture(),id='BRANDING-CROSS-0000001';e.brand(1,'2026-10-01','S1',{requestId:id});assert.throws(()=>e.aa(1,'2026-10-01','S1',{requestId:id}),/data lain/);assert.throws(()=>e.brand(1,'2026-10-02','S1',{requestId:id}),/data lain/);
  const huge=brandingFixture();huge.brand(Number.MAX_SAFE_INTEGER);huge.brand(1,'2026-10-02');assert.throws(()=>huge.report(),/Total branding terlalu besar/);
});

test('MPR/Canvasser half-target sales and manual counts produce exactly 50 points at full monthly targets',()=>{
  for(const team of ['MPR','Canvasser']){
    const e=brandingFixture(team);e.tx('LBMAV',3200000);e.tx('LKXOD',4100000);e.tx('P1',32700000);e.aa(200);e.brand(150);
    const r=e.report();assert.deepEqual(copy(r.parameters.map(p=>p.score)),[20,12.5,12.5,2.5,2.5]);assert.equal(r.total,50);assert.equal(r.category,'DISPENSASI LANJUT');
  }
});

function summaryFixture(){
 const e=fixture();e.rows('SALES').push(['S3','Amul Husni','MPR','ACTIVE'],['S4','Canvasser One','Canvasser','ACTIVE'],['S5','Other','Asisten MPR','ACTIVE']);
 const h=e.rows('PRICE_MASTER')[0];h.push('unit');e.rows('PRICE_MASTER').slice(1).forEach(r=>r.push('Box'));
 e.price=(id,team,price,unit='Box',status='ACTIVE')=>e.rows('PRICE_MASTER').push(h.map(k=>({product_id:id,team_name:team,selling_price:price,cost_price:0,shj:0,status,unit})[k]??''));
 for(const team of ['Motoris','MMTW','MPR','Canvasser']){e.price('LBMAV',team,100000);e.price('LKXOD',team,150000);e.price('LPRGQ',team,250000);}
 e.summary=(month='2026-10')=>e.api('getScoreTeamSummary',month);
 return e;
}
test('all-team recap matches every individual report with team-specific targets, original category and no extra network reads per sales',()=>{
 const e=summaryFixture();e.tx('LBMAV',2000000);e.aa(100);const before=e.calls.length,r=e.summary();assert.equal(e.calls.length-before,2);assert.equal(r.rows.length,4);
 for(const row of r.rows){const detail=e.report('2026-10',row.sales.salesId);assert.equal(row.total,detail.total);assert.equal(row.category,detail.category);assert.deepEqual(copy(row.parameters),copy(detail.parameters));}
 assert.equal(r.rows.some(r=>r.sales.salesId==='S5'),false);assert.equal(r.rows.find(r=>r.sales.salesId==='S3').parameters[0].target,6400000);
});
test('guidance uses remaining revenue and current team-specific prices, rounded upward; Komix OR Promag each covers the same combined gap',()=>{
 const e=summaryFixture();e.tx('LBMAV',2000000);e.tx('LPRGQ',500000);const row=e.summary().rows.find(r=>r.sales.salesId==='S1');
 assert.equal(row.guidance[0].remaining,3000000);assert.equal(row.guidance[0].alternatives[0].quantity,30);assert.equal(row.guidance[0].alternatives[0].unit,'box');
 const b=row.guidance[1];assert.equal(b.remaining,4500000);assert.deepEqual(copy(b.alternatives.map(q=>[q.productId,q.quantity])),[['LKXOD',30],['LPRGQ',18]]);
 const p=e.rows('PRICE_MASTER').find(r=>r[0]==='LBMAV'&&r[1]==='Motoris');p[3]=130000;
 assert.equal(e.summary().rows.find(r=>r.sales.salesId==='S1').guidance[0].alternatives[0].quantity,24);
});
test('guidance honors count units rather than relabeling non-box prices; product-unit fallback is explicit and mismatches have no quantity',()=>{
 const e=summaryFixture(),p=e.rows('PRICE_MASTER').find(r=>r[0]==='LBMAV'&&r[1]==='Motoris');p[6]='Sachet';assert.equal(e.summary().rows.find(r=>r.sales.salesId==='S1').guidance[0].alternatives[0].unit,'sachet');
 e.rows('PRODUCTS')[0].push('unit');e.rows('PRODUCTS').find(r=>r[0]==='LBMAV')[3]='Box';let note=e.summary().rows.find(r=>r.sales.salesId==='S1').guidance[0];assert.equal(note.alternatives.length,0);assert.match(note.warnings[0],/satuan.*berbeda/);
 p[6]='';note=e.summary().rows.find(r=>r.sales.salesId==='S1').guidance[0];assert.equal(note.alternatives[0].unit,'box');
});
test('missing, zero, invalid, duplicate, inactive price and missing units never produce invented product quantities',()=>{
 for(const change of [p=>p[3]=0,p=>p[3]='bad',p=>p[5]='INACTIVE',p=>p[6]='']){
  const e=summaryFixture(),p=e.rows('PRICE_MASTER').find(r=>r[0]==='LBMAV'&&r[1]==='Motoris');change(p);
  const row=e.summary().rows.find(r=>r.sales.salesId==='S1');assert.equal(row.total,0);assert.equal(row.guidance[0].alternatives.length,0);assert.ok(row.guidance[0].warnings.length);
 }
 const dup=summaryFixture();dup.price('LBMAV','Motoris',123);assert.match(dup.summary().rows.find(r=>r.sales.salesId==='S1').guidance[0].warnings[0],/ganda/);
 const missing=summaryFixture();missing.remove('PRICE_MASTER');assert.match(missing.summary().rows[0].guidance[0].warnings[0],/belum tersedia/);
});
test('price reference never falls back to another team, and a usable named Komix variant can replace unavailable Original',()=>{
 const e=summaryFixture();e.rows('PRICE_MASTER').find(r=>r[0]==='LBMAV'&&r[1]==='MPR')[5]='INACTIVE';e.rows('PRICE_MASTER').find(r=>r[0]==='LKXOD'&&r[1]==='MPR')[5]='INACTIVE';e.price('LKXJA','MPR',200000);
 const row=e.summary().rows.find(r=>r.sales.salesId==='S3');assert.equal(row.guidance[0].alternatives.length,0);assert.equal(row.guidance[1].alternatives[0].productId,'LKXJA');assert.equal(row.guidance[1].alternatives[0].quantity,41);
});
test('met targets generate no negative gaps or unnecessary quotes; AA and branding deficits use manual counts per team',()=>{
 const e=summaryFixture();e.tx('LBMAV',10000000);e.aa(401);e.api('saveScoreBranding',{requestId:'SUMMARY-BRANDING-0001',salesId:'S3',date:'2026-10-01',count:120,expectedRevision:''});
 const rows=e.summary().rows,s1=rows.find(r=>r.sales.salesId==='S1'),s3=rows.find(r=>r.sales.salesId==='S3');assert.equal(s1.guidance[0].remaining,0);assert.equal(s1.guidance[0].alternatives.length,0);assert.equal(s1.guidance[3].remaining,0);assert.equal(s1.guidance.length,4);assert.equal(s3.guidance[4].remaining,180);assert.equal(s3.guidance[3].remaining,400);
});
test('recap filters month and reflects committed transaction edits without storing report or changing master prices',()=>{
 const e=summaryFixture();const saved=e.save();const first=e.summary().rows.find(r=>r.sales.salesId==='S1');assert.equal(first.parameters[2].actual,200);
 const snapshot=e.api('getSalesTransactionForEdit',saved.transactionId);const r=e.api('editSalesTransaction',{transactionId:saved.transactionId,requestId:'SUMMARY-EDIT-00000001',expectedRevision:snapshot.revision,salesId:snapshot.header.salesId,distributor:snapshot.header.distributor,date:'2026-09-30',notes:snapshot.header.notes,items:snapshot.items,reason:'Koreksi periode'});assert.equal(r.success,true);
 assert.equal(e.summary().rows.find(r=>r.sales.salesId==='S1').parameters[2].actual,0);assert.equal(e.summary('2026-09').rows.find(r=>r.sales.salesId==='S1').parameters[2].actual,200);assert.equal(e.exists('MONTHLY_TEAM_REPORT'),false);
});
test('an invalid sales report is flagged without falsely scoring zero or blocking valid colleagues',()=>{
 const e=summaryFixture();e.tx('P1',100,{quantity:0});const rows=e.summary().rows;const bad=rows.find(r=>r.sales.salesId==='S1');assert.equal(bad.total,null);assert.ok(bad.message);assert.equal(bad.guidance.length,0);assert.equal(rows.find(r=>r.sales.salesId==='S2').total,0);
});
test('guest recap has full read access with identical scores and no sheet/stock/audit mutations, while unsupported roles are denied',()=>{
 const e=summaryFixture(),before=JSON.stringify(['SALES','PRODUCTS','PRICE_MASTER','SALES_TRANSACTIONS','INVENTORY','ACTIVITY_LOGS'].map(n=>e.rows(n))),admin=e.summary();
 e.actor({role:'GUEST',email:'juniortlkchlse@gmail.com',salesId:''});assert.deepEqual(copy(e.summary()),copy(admin));assert.equal(JSON.stringify(['SALES','PRODUCTS','PRICE_MASTER','SALES_TRANSACTIONS','INVENTORY','ACTIVITY_LOGS'].map(n=>e.rows(n))),before);assert.equal(e.exists('SKOR_EVENTS'),false);
 e.actor({role:'SALES',salesId:'S1'});assert.throws(()=>e.summary(),/Admin dan Tamu/);
});
test('summary invalid periods and incomplete product mapping never show made-up totals or product notes',()=>{
 const e=summaryFixture();assert.throws(()=>e.summary('2026-13'),/bulan/);e.rows('PRODUCTS').find(r=>r[0]==='LBMAV')[1]='Wrong master name';for(const row of e.summary().rows){assert.equal(row.total,null);assert.equal(row.guidance.length,0);assert.match(row.message,/master produk/);}
});
test('Family recap separates sachet, tube and Promag alternatives using live team master prices',()=>{
 const e=summaryFixture();
 for(const [id,price] of [['LKXOD',13000],['LPRGQ',16800]])e.rows('PRICE_MASTER').find(r=>r[0]===id&&r[1]==='Motoris')[3]=price;
 e.price('LKXOB','Motoris',10000);e.tx('LPRGQ',65200);
 let b=e.summary().rows.find(r=>r.sales.salesId==='S1').guidance[1];
 assert.equal(b.remaining,4934800);assert.deepEqual(copy(b.alternatives.map(q=>[q.productId,q.quantity])),[['LKXOD',380],['LKXOB',494],['LPRGQ',294]]);
 assert.deepEqual(copy(b.alternatives.map(q=>q.displayName||q.productName)),['Komix Herbal Sachet','Komix Tube','Promag Herbal']);
 e.price('LKXJA','Motoris',14000);b=e.summary().rows.find(r=>r.sales.salesId==='S1').guidance[1];assert.match(b.alternatives[0].displayName,/Komix Herbal Sachet Original/);
 e.rows('PRICE_MASTER').find(r=>r[0]==='LKXOB'&&r[1]==='Motoris')[3]=20000;
 assert.equal(e.summary().rows.find(r=>r.sales.salesId==='S1').guidance[1].alternatives[1].quantity,247);
});
