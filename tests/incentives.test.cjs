const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {system}=require('./helpers/transaction-system.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(team='Motoris'){
 const e=system(),c=e.context;for(const file of ['score.gs','incentives.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
 e.actor({role:'ADMIN'});c.scoreToday_=()=> '2027-01-05';e.rows('SALES')[1][2]=team;e.rows('SALES')[2][2]='MMTW';
 for(const [id,[name]]of Object.entries(c.KCH_SCORE_PRODUCT_RULES_))e.rows('PRODUCTS').push([id,name,'ACTIVE']);e.rows('PRODUCTS').push(['LKXKA','Komix Herbal Kids','ACTIVE']);
 e.add=(name,rows)=>{const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),req=[],sheet=c.txAddSheet_(meta,req,name,rows[0],false);if(rows.length>1)req.push(c.txAppend_(sheet.sheetId,rows.slice(1)));c.txBatch_(ctx,req);};
 e.add('HOLIDAYS',[['date','holiday_name']]);let n=0;
 e.tx=(id,value,date='2026-10-02',sales='S1')=>{const row={transaction_id:'INC-'+(++n),transaction_date:date,sales_id:sales,product_id:id,quantity:1,selling_price:value,subtotal_sales:value};e.rows('SALES_TRANSACTIONS').push(Array.from(c.TABLE_SCHEMAS.SALES_TRANSACTIONS,h=>row[h]??''));};
 e.aa=(count,date='2026-10-02',sales='S1')=>c.kchApi('MOCK','saveScoreAA',[{requestId:'INC-AA-REQUEST-'+String(++n).padStart(16,'0'),date,salesId:sales,count,expectedRevision:''}]);
 e.report=(month='2026-10',sales='S1')=>c.kchApi('MOCK','getIncentiveReport',[month,sales]);return e;
}
test('daily tariffs at every exact boundary take one tier, including 1,500,001 => 50k',()=>{
 const c=fixture().context;for(const [value,expected]of [[0,0],[799999.99,0],[800000,10000],[999999.99,10000],[1000000,20000],[1199999.99,20000],[1200000,30000],[1500000,30000],[1500000.01,50000],[1500001,50000],[3000000,50000]])assert.equal(c.incentiveDailyRate_(Math.round(value*100)),expected,String(value));
});
test('daily aggregates all invoices per sales/date, excludes only tablet lines and includes focus/Kids/ordinary products',()=>{
 const e=fixture();e.tx('LBMAV',400000);e.tx('LKXOD',400000);e.tx('LPRGQ',400000);e.tx('LPRGN',9000000);e.tx('LKXKA',200000);e.tx('P1',100001);e.tx('P1',3000000,'2026-10-02','S2');
 const r=e.report(),d=r.daily.find(d=>d.date==='2026-10-02');assert.equal(d.value,1500001);assert.equal(d.scheduled,50000);assert.equal(d.amount,25000);assert.equal(r.paidDays,1);assert.equal(r.monthly.parameters[1].actual,800000);assert.equal(r.monthly.actualValue,1500001);
});
test('26 eligible workdays receive all 26 daily incentives with no 25-day or 1.25m cap',()=>{
 const e=fixture();e.rows('HOLIDAYS').push(['2026-10-01','Test holiday']);const days=e.context.getWorkDateRangeInfo_('2026-10-01','2026-10-31',{'2026-10-01':true}).dates.filter(d=>d.isWorkDay);assert.equal(days.length,26);
 for(const day of days)e.tx('P1',1500001,day.date);const r=e.report();assert.equal(r.workDays,26);assert.equal(r.paidDays,26);assert.equal(r.dailyTotal,1300000);
});
test('Sundays and holidays pay no daily incentive, but transactions remain in monthly/quarterly Total Value',()=>{
 const e=fixture();e.rows('HOLIDAYS').push(['2026-10-02','Holiday']);e.tx('P1',2000000);e.tx('P1',2000000,'2026-10-04');const r=e.report();assert.equal(r.dailyTotal,0);assert.equal(r.monthly.actualValue,4000000);assert.equal(r.quarter.actual,4000000);assert.equal(r.daily.find(d=>d.date==='2026-10-04').status,'Minggu');
});
test('each monthly parameter uses 90/100/110 steps independently, with no interpolation and no uncapped payout',()=>{
 for(const team of ['Motoris','MMTW'])for(const [factor,level,amount]of [[.899,0,0],[.9,90,500000],[.999,90,500000],[1,100,1000000],[1.099,100,1000000],[1.1,110,1250000],[2,110,1250000]]){
 const e=fixture(team);e.tx('LBMAV',5000000*factor);e.tx('LPRGQ',5000000*factor);e.tx('P1',17000000*factor);e.aa(Math.floor(400*factor));const r=e.report();assert.equal(r.monthly.total,amount,team+' '+factor);assert.equal(r.monthly.parameters[0].tier,level);assert.equal(r.monthly.parameters[0].target,5000000);
 }
});
test('below 70% monthly Total Value halves all four monthly parameters, with full payout at exactly 70%',()=>{
 const e=fixture();e.tx('LBMAV',5500000);e.tx('LPRGQ',5500000);e.tx('P1',7899999.99);e.aa(440);let r=e.report();assert.equal(r.monthly.eligible,false);assert.equal(r.monthly.total,468750);assert.equal(r.monthly.payoutFactor,.5);assert.equal(r.monthly.parameters[0].amount,250000);assert.equal(r.monthly.parameters[3].amount,62500);assert.equal(r.monthly.parameters[0].scheduled,500000);assert.equal(r.dailyTotal,25000);
 e.tx('P1',.01);r=e.report();assert.equal(r.monthly.eligible,true);assert.equal(r.monthly.payoutFactor,1);assert.equal(r.dailyTotal,50000);assert.equal(r.monthly.minimumValue,18900000);assert.equal(r.monthly.total,937500);assert.equal(r.monthly.parameters[2].amount,0);
});
test('monthly AA comes only from manual ledger counts, never invoice count or attendance',()=>{
 const e=fixture();for(let n=0;n<10;n++)e.tx('P1',2700000);let r=e.report();assert.equal(r.monthly.parameters[3].actual,0);assert.equal(r.monthly.parameters[3].amount,0);e.aa(360);r=e.report();assert.equal(r.monthly.parameters[3].tier,90);assert.equal(r.monthly.parameters[3].amount,50000);
});
test('quarter calendar uses fixed three-month windows, including January/year transition',()=>{
 const c=fixture().context;for(const [month,number,start,end]of [['2026-01',1,'2026-01','2026-03-31'],['2026-06',2,'2026-04','2026-06-30'],['2026-09',3,'2026-07','2026-09-30'],['2026-10',4,'2026-10','2026-12-31'],['2026-12',4,'2026-10','2026-12-31'],['2027-01',1,'2027-01','2027-03-31']]){const q=c.incentiveQuarter_(month);assert.equal(q.number,number);assert.equal(q.months[0],start);assert.equal(q.end,end);}
});
test('all nine quarterly payout combinations use aggregate tier and number of months reaching 100%',()=>{
 for(const reached of [1,2,3])for(const [factor,tier]of [[1,100],[1.1,110],[1.2,120]]){
 const e=fixture(),sum=Math.round(81000000*factor),values=reached===3?[27000000,27000000,sum-54000000]:reached===2?[20000000,27000000,sum-47000000]:[20000000,20000000,sum-40000000];
 values.forEach((v,i)=>e.tx('P1',v,'2026-'+['10','11','12'][i]+'-02'));
 const q=e.report().quarter;assert.equal(q.reachedMonths,reached);assert.equal(q.tier,tier);assert.equal(q.amount,({1:[500000,525000,550000],2:[1000000,1050000,1100000],3:[2000000,2100000,2200000]})[reached][[100,110,120].indexOf(tier)]);assert.equal(q.closed,true);
 }
});
test('quarter thresholds use raw actual values, do not round up, and cap at 120% tariff',()=>{
 for(const [sum,tier,amount]of [[80999999.99,0,0],[81000000,100,500000],[89099999.99,100,500000],[89100000,110,525000],[97199999.99,110,525000],[97200000,120,550000],[180000000,120,550000]]){
 const e=fixture();e.tx('P1',20000000);e.tx('P1',20000000,'2026-11-02');e.tx('P1',sum-40000000,'2026-12-02');const q=e.report().quarter;assert.equal(q.tier,tier);assert.equal(q.amount,amount);
 }
});
test('open periods show estimates, ignore future transactions and future daily incentives',()=>{
 const e=fixture();e.context.scoreToday_=()=> '2026-10-02';e.tx('P1',1500001);e.tx('P1',27000000,'2026-10-03');e.tx('P1',54000000,'2026-11-02');const r=e.report();assert.equal(r.monthlyClosed,false);assert.equal(r.quarter.closed,false);assert.equal(r.dailyTotal,25000);assert.equal(r.daily.find(d=>d.date==='2026-10-03').amount,null);assert.equal(r.monthly.actualValue,1500001);assert.equal(r.quarter.actual,1500001);
});
test('guest may read all eligible sales while no sheet or account data is mutated, using one batch snapshot',()=>{
 const e=fixture();e.actor({role:'GUEST',email:'',salesId:''});const before=JSON.stringify(['SALES','PRODUCTS','SALES_TRANSACTIONS','INVENTORY','ACTIVITY_LOGS'].map(n=>e.rows(n))),calls=e.calls.length;
 const r=e.report('2026-10','S2');assert.equal(r.sales.team,'MMTW');assert.equal(e.calls.length-calls,2);assert.equal(e.context.kchApi('MOCK','getIncentiveSetup',[]).sales.length,2);assert.equal(JSON.stringify(['SALES','PRODUCTS','SALES_TRANSACTIONS','INVENTORY','ACTIVITY_LOGS'].map(n=>e.rows(n))),before);assert.equal(e.exists('SKOR_EVENTS'),false);
});
test('MPR/Canvasser and legacy Sales logins cannot use the Motoris/MMTW incentive engine',()=>{
 const e=fixture('MPR');assert.equal(e.context.kchApi('MOCK','getIncentiveSetup',[]).sales.length,1);assert.throws(()=>e.report(),/hanya untuk Motoris/);e.actor({role:'SALES',salesId:'S1'});assert.throws(()=>e.report(),/ACCESS_DENIED/);
});
test('missing holidays disable daily estimates instead of assuming no holidays; invalid dates/data fail visibly',()=>{
 const e=fixture();e.tx('P1',2000000);e.remove('HOLIDAYS');let r=e.report();assert.equal(r.dailyTotal,null);assert.equal(r.monthTotal,null);assert.match(r.warnings[0],/HOLIDAYS/);
 assert.throws(()=>e.report('bad'),/bulan/);e.rows('PRODUCTS').find(r=>r[0]==='LBMAV')[1]='Wrong product';assert.throws(()=>e.report(),/master produk/);
});
test('incentive monthly actuals match Skor and reflect edited transaction rows on reload',()=>{
 const e=fixture();e.tx('LBMAV',4500000);e.tx('LPRGQ',5000000);e.tx('P1',17500000);e.aa(400);let r=e.report(),s=e.context.kchApi('MOCK','getScoreReport',['2026-10','S1']);assert.deepEqual(copy(r.monthly.parameters.map(p=>p.actual)),copy(s.parameters.map(p=>p.actual)));
 const h=e.rows('SALES_TRANSACTIONS')[0],row=e.rows('SALES_TRANSACTIONS')[1];row[h.indexOf('subtotal_sales')]=5500000;r=e.report();assert.equal(r.monthly.parameters[0].amount,500000);
});
test('monthly 50% adjustment preserves scheduled tiers and halves daily payouts once and leaves quarterly payout intact',()=>{
 const e=fixture();e.tx('LBMAV',5000000);e.tx('LPRGQ',4500000);e.aa(400);e.tx('P1',40000000,'2026-11-02');e.tx('P1',40000000,'2026-12-02');
 const r=e.report();assert.equal(r.monthly.total,(400000+125000+100000)/2);assert.equal(r.monthTotal,25000+r.monthly.total);assert.equal(r.dailyTotal,25000);assert.equal(r.quarter.amount,1050000);
 assert.deepEqual(copy(r.monthly.parameters.map(p=>p.amount)),copy(r.monthly.parameters.map(p=>p.scheduled*.5)));
});
test('same 70% monthly threshold halves mixed daily tariffs once; reload is not another deduction',()=>{
 const e=fixture();for(const [value,date]of [[800000,'2026-10-01'],[1000000,'2026-10-02'],[1200000,'2026-10-03'],[1500001,'2026-10-05']])e.tx('P1',value,date);
 let r=e.report();assert.equal(r.dailyScheduledTotal,110000);assert.equal(r.dailyTotal,55000);assert.equal(e.report().dailyTotal,55000);assert.equal(r.monthTotal,r.monthly.total+55000);
 e.tx('P1',14399999);r=e.report();assert.equal(r.monthly.actualValue,18900000);assert.equal(r.monthly.payoutFactor,1);assert.equal(r.dailyScheduledTotal,140000);assert.equal(r.dailyTotal,140000);
});
test('payout percentage is applied to combined gross daily plus monthly total with net detail reconciliation',()=>{
 const e=fixture();e.tx('LBMAV',5000000);e.tx('LPRGQ',4500000);e.aa(400);let r=e.report();assert.equal(r.dailyScheduledTotal,50000);assert.equal(r.monthly.scheduledTotal,625000);assert.equal(r.monthSubtotal,675000);assert.equal(r.payoutFactor,.5);assert.equal(r.monthTotal,337500);assert.equal(r.dailyTotal,25000);assert.equal(r.monthly.total,312500);assert.equal(r.monthTotal,r.dailyTotal+r.monthly.total);
 e.tx('P1',9400000);r=e.report();assert.equal(r.monthly.actualValue,18900000);assert.equal(r.payoutFactor,1);assert.equal(r.monthTotal,r.monthSubtotal);
});
