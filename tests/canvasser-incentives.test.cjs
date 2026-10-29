const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const {system}=require('./helpers/transaction-system.cjs');
function fixture(){const e=system(),c=e.context;for(const file of ['score.gs','canvasser-incentives.gs','incentives.gs','incentive-sheets.gs','sheet-updates.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);e.actor({role:'ADMIN'});c.scoreToday_=()=> '2027-01-05';
 e.rows('SALES').splice(1);for(const [i,p]of c.KCH_INCENTIVE_PAIRS_.entries()){e.rows('SALES').push([p[0],['Aziz Muradi','Amul Husni','Fitriatuddin','Khairul Rizal'][i],i?'MPR':'Canvasser','ACTIVE'],[p[1],['Muhammad Zulfan','Muhammad Nuzar','Edy','Adriansyah Putra'][i],i?'Asisten MPR':'Junior Canvasser','ACTIVE']);}
 for(const [id,[name]]of Object.entries(c.KCH_SCORE_PRODUCT_RULES_))e.rows('PRODUCTS').push([id,name,'ACTIVE']);for(const id of c.KCH_CANVASSER_LOADING_)if(!e.rows('PRODUCTS').some(r=>r[0]===id))e.rows('PRODUCTS').push([id,'Loading '+id,'ACTIVE']);
 e.add=(name,rows)=>{const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),req=[],s=c.txAddSheet_(meta,req,name,rows[0],false);if(rows.length>1)req.push(c.txAppend_(s.sheetId,rows.slice(1)));c.txBatch_(ctx,req);};e.add('HOLIDAYS',[['date','holiday_name']]);let n=0;
 e.senior=c.KCH_INCENTIVE_PAIRS_[0][0];e.junior=c.KCH_INCENTIVE_PAIRS_[0][1];
 e.tx=(product,value,date='2026-10-02',sales=e.senior)=>{const row={transaction_id:'CAN-'+(++n),transaction_date:date,sales_id:sales,product_id:product,quantity:1,selling_price:value,subtotal_sales:value};e.rows('SALES_TRANSACTIONS').push(Array.from(c.TABLE_SCHEMAS.SALES_TRANSACTIONS,h=>row[h]??''));};
 e.count=(method,count,sales=e.senior,date='2026-10-02')=>c.kchApi('MOCK',method,[{requestId:'CAN-COUNT-REQUEST-'+String(++n).padStart(16,'0'),date,salesId:sales,count,expectedRevision:''}]);e.report=(month='2026-10',sales=e.senior)=>c.kchApi('MOCK','getIncentiveReport',[month,sales]);
 return e;}
function targets(e,factor=1,date='2026-10-02',sales=e.senior){e.tx('LBMAV',6400000*factor,date,sales);e.tx('LPRGR',8200000*factor,date,sales);e.tx('TMXTG',65400000*factor,date,sales);}
test('all confirmed loading codes contribute, nonloading is recorded but excluded, tablet separate, and legacy Promag code resolves',()=>{
 const e=fixture();for(const id of e.context.KCH_CANVASSER_LOADING_)e.tx(id,100000);e.tx('P1',90000000);e.tx('LPRGN',1000000);e.tx('LPRGQ',300000);const r=e.report();assert.equal(r.monthly.actualValue,e.context.KCH_CANVASSER_LOADING_.length*100000+300000);assert.equal(r.daily[1].tabletValue,1000000);assert.equal(r.daily[1].scheduled,70000);assert.equal(r.monthly.parameters[1].actual,1000000);assert.equal(r.monthly.parameters[0].target,6400000);assert.equal(r.monthly.parameters[1].target,8200000);
});
test('daily qualifies only at the two exact compositions, pays once, and never pools tablets into loading',()=>{
 const e=fixture(),c=e.context;for(const [load,tablet,amount]of [[2499999.99,1000000,0],[2500000,999999.99,0],[2500000,1000000,70000],[3500000,0,70000],[3499999.99,0,0],[2000000,1500000,0],[0,3500000,0],[3500000,1000000,70000],[10000000,10000000,70000]])assert.equal(c.incentiveCanvasserDailyRate_(Math.round(load*100),Math.round(tablet*100)),amount);
});
test('MPR and Canvasser monthly 90/100/110 tiers and manual AA/branding produce 1m/1.5m/2m',()=>{
 for(const pair of [0,1])for(const [f,total]of [[.9,1000000],[1,1500000],[1.1,2000000],[2,2000000]]){const e=fixture(),s=e.context.KCH_INCENTIVE_PAIRS_[pair][0];targets(e,f,'2026-10-02',s);e.count('saveScoreAA',Math.round(400*f),s);e.count('saveScoreBranding',Math.round(300*f),s);const r=e.report('2026-10',s);assert.equal(r.monthly.parameters.length,5);assert.equal(r.monthly.total,total);assert.equal(r.monthly.eligible,true);assert.equal(r.monthly.parameters[4].target,300);assert.equal(r.dailyTotal,70000);}
});
test('all TV/A/B must independently reach 70%, using raw thresholds, and combined adjustment occurs once',()=>{
 for(const which of [0,1,2]){const e=fixture();const a=which===0?4479999.99:6400000,b=which===1?5739999.99:8200000,tv=which===2?55999999.99:80000000;e.tx('LBMAV',a);e.tx('LPRGR',b);e.tx('TMXTG',tv-a-b);e.count('saveScoreAA',400);e.count('saveScoreBranding',300);let r=e.report();assert.equal(r.monthly.eligible,false);assert.equal(r.payoutFactor,.5);assert.equal(r.dailyTotal,35000);assert.equal(r.monthTotal,r.monthSubtotal*.5);assert.equal(r.monthly.gateChecks.filter(g=>!g.reached).length,1);
 e.tx(which===0?'LBMAV':which===1?'LPRGR':'TMXTG',.01);r=e.report();assert.equal(r.monthly.eligible,true);assert.equal(r.dailyTotal,70000);assert.equal(r.monthTotal,r.monthSubtotal);}
});
test('nine quarterly tariffs use loading-only accumulation at 240m with no monthly-gate reduction',()=>{
 for(const reached of [1,2,3])for(const [f,tier,index]of [[1,100,0],[1.1,110,1],[1.2,120,2]]){const e=fixture(),sum=Math.round(240000000*f),v=reached===3?[80000000,80000000,sum-160000000]:reached===2?[60000000,80000000,sum-140000000]:[60000000,60000000,sum-120000000];v.forEach((value,i)=>e.tx('TMXTG',value,'2026-'+['10','11','12'][i]+'-02'));e.tx('P1',900000000);e.tx('LPRGN',900000000);const q=e.report().quarter;assert.equal(q.target,240000000);assert.equal(q.actual,sum);assert.equal(q.reachedMonths,reached);assert.equal(q.tier,tier);assert.equal(q.amount,({1:[1000000,1125000,1250000],2:[2000000,2125000,2250000],3:[3000000,3250000,3500000]})[reached][index]);}
});
test('every fixed Junior pair follows exactly 70% of its Senior net daily/monthly/quarter without own targets or double reduction',()=>{
 for(const [s,j]of fixture().context.KCH_INCENTIVE_PAIRS_){const e=fixture();e.tx('LBMAV',6400000,'2026-10-02',s);e.tx('LPRGR',5739999,'2026-10-02',s);e.tx('TMXTG',70000000,'2026-10-02',s);e.tx('TMXTG',80000000,'2026-11-02',s);e.tx('TMXTG',90000000,'2026-12-02',s);e.tx('TMXTG',999999999,'2026-10-02',j);const senior=e.report('2026-10',s),jr=e.report('2026-10',j);assert.equal(jr.isJunior,true);assert.equal(jr.referenceSales.salesId,s);assert.equal(jr.monthTotal,senior.monthTotal*7/10);assert.equal(jr.dailyTotal,24500);assert.equal(jr.quarter.amount,senior.quarter.amount*7/10);assert.equal(jr.monthly.actualValue,null);assert.ok(jr.monthly.parameters.every(p=>p.actual===null&&p.target===null&&p.achievement===null));assert.equal(jr.quarter.target,null);assert.equal(jr.daily[1].value,null);assert.equal(jr.daily[1].referenceValue,senior.daily[1].value);}
});
test('missing/duplicate/wrong-team pairs and unknown Junior IDs fail rather than inheriting the wrong Senior',()=>{
 for(const mode of ['missing','duplicate','wrong-team','unknown']){const e=fixture();if(mode==='missing')e.rows('SALES').splice(1,1);if(mode==='duplicate')e.rows('SALES').push([...e.rows('SALES')[1]]);if(mode==='wrong-team')e.rows('SALES')[1][2]='Motoris';if(mode==='unknown')e.rows('SALES')[2][0]='UNKNOWN-JUNIOR';assert.throws(()=>e.report('2026-10',mode==='unknown'?'UNKNOWN-JUNIOR':e.junior));}
});
test('missing loading master blocks unsupported assumptions; Sunday/holidays and future transactions do not earn daily fees',()=>{
 const e=fixture();e.rows('HOLIDAYS').push(['2026-10-02','Holiday']);e.tx('TMXTG',3500000);e.tx('TMXTG',3500000,'2026-10-04');assert.equal(e.report().dailyTotal,0);e.rows('PRODUCTS').splice(e.rows('PRODUCTS').findIndex(r=>r[0]==='PBSJC'),1);assert.throws(()=>e.report(),/PBSJC/);
});
test('sheet export includes five parameters and Junior allocation, correct row widths, inherited periods and no fabricated Junior target',()=>{
 const e=fixture();targets(e);e.count('saveScoreAA',400);e.count('saveScoreBranding',300);e.context.KCH_REQUEST_USER_={role:'ADMIN'};const rows=e.context.kchIncentiveSheetRows_(e.context.scoreContext_(true));e.context.KCH_REQUEST_USER_=null;
 for(const [name,values]of Object.entries(rows))for(const row of values)assert.equal(row.length,e.context.KCH_INCENTIVE_SHEET_SCHEMAS_[name].length,name);
 const h=e.context.KCH_INCENTIVE_SHEET_SCHEMAS_.INSENTIF_BULANAN,senior=rows.INSENTIF_BULANAN.find(r=>r[0]==='2026-10'&&r[1]===e.senior),junior=rows.INSENTIF_BULANAN.find(r=>r[0]==='2026-10'&&r[1]===e.junior);
 assert.equal(senior[h.indexOf('branding_actual')],300);assert.equal(senior[h.indexOf('combined_paid')],1570000);assert.equal(junior[h.indexOf('combined_paid')],1099000);assert.equal(junior[h.indexOf('focus_a_target')],null);assert.equal(junior[h.indexOf('senior_sales_id')],e.senior);assert.equal(junior[h.indexOf('allocation_percent')],70);
});
test('canonical Promag Herbal is LPRGR; old master/invoice alias stays readable and duplicate aliases are rejected',()=>{
 const e=fixture();e.tx('LPRGQ',8200000);assert.equal(e.report().monthly.parameters[1].actual,8200000);const p=e.rows('PRODUCTS').find(r=>r[0]==='LPRGR');p[0]='LPRGQ';assert.equal(e.report().monthly.parameters[1].actual,8200000);e.rows('PRODUCTS').push(['LPRGR','Promag Herbal','ACTIVE']);assert.throws(()=>e.report(),/ganda/);
});
test('guest reads all pairs with no business mutations; setup retains master team labels',()=>{
 const e=fixture();e.actor({role:'GUEST',email:'',salesId:''});const before=JSON.stringify(e.rows('SALES_TRANSACTIONS'));const setup=e.context.kchApi('MOCK','getIncentiveSetup',[]);assert.equal(setup.sales.length,8);assert.equal(setup.sales.find(s=>s.salesId===e.junior).team,'Junior Canvasser');assert.equal(e.report('2026-10',e.junior).isJunior,true);assert.equal(JSON.stringify(e.rows('SALES_TRANSACTIONS')),before);
});
test('updater expands existing incentive schemas, preserves an empty custom header and writes idempotent Senior/Junior/branding results',()=>{
 const e=fixture(),c=e.context;targets(e);e.count('saveScoreAA',400);e.count('saveScoreBranding',300);
 for(const [name,marker]of [['INSENTIF_HARIAN','promag_tablet_value'],['INSENTIF_BULANAN','branding_actual'],['INSENTIF_TRIWULAN','senior_sales_id']]){const h=Array.from(c.KCH_INCENTIVE_SHEET_SCHEMAS_[name]);e.add(name,[h.slice(0,h.indexOf(marker)).concat('custom_header')]);}
 function sync(){const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),ss=c.getKchSpreadsheet_(),plan=c.kchSheetUpdatePlan_(ss,meta,c.kchSheetSchemas_()),report=c.kchIncentiveSyncPlan_(ss,meta,ctx);c.txBatch_(ctx,plan.requests.concat(report.requests));}
 sync();const rows=e.rows('INSENTIF_BULANAN'),h=rows[0];assert.equal(h.at(-1),'custom_header');const jr=rows.find(r=>r[0]==='2026-10'&&r[1]===e.junior);assert.equal(jr[h.indexOf('combined_paid')],1099000);assert.equal(jr[h.indexOf('focus_a_target')],'');assert.equal(jr[h.indexOf('senior_sales_id')],e.senior);
 const first=JSON.stringify(rows);sync();assert.equal(JSON.stringify(e.rows('INSENTIF_BULANAN')),first);assert.equal(c.KCH_REQUEST_USER_,null);
});
