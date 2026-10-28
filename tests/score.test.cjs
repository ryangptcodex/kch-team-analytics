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
test('exact confirmed product codes: all eight B products count; mixed invoice excludes only tablet line',()=>{
  const e=fixture();
  e.tx('LBMAV',5000000);
  for(const id of ['LKXOD','LKXJA','LKXPA','LKXNA','LKXOB','LKXLA','LKXKA','LPRGQ'])e.tx(id,625000);
  e.tx('LPRGN',90000000);e.tx('P1',17000000);
  const r=e.report(); assert.equal(r.mappingReady,true); assert.deepEqual(copy(r.parameters.map(p=>p.actual)),[5000000,5000000,27000000,0]);
  assert.equal(r.total,90);assert.equal(r.parameters[1].score,25);assert.equal(r.category,'LANJUT BULAN BERIKUTNYA');
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
test('MPR and Canvasser receive 5% AA plus branding 300 at 5%, with all other targets unchanged',()=>{
  for(const team of ['MPR','Canvasser','TEAM-01']){
    const e=brandingFixture(team);e.tx('LBMAV',5000000);e.tx('LKXOD',5000000);e.tx('P1',17000000);e.aa(400);e.brand(300);
    const r=e.report();assert.equal(r.brandingEnabled,true);assert.equal(r.total,100);
    assert.deepEqual(copy(r.parameters.map(p=>[p.target,p.weight,p.max])),[[5000000,.4,40],[5000000,.25,25],[27000000,.25,25],[400,.05,5],[300,.05,5]]);
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
