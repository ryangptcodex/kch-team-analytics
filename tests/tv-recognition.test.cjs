const {test}=require('node:test'),assert=require('node:assert/strict');
const {auditSystem}=require('./helpers/audit-system.cjs');
let seq=0;
function fixture(team='Motoris'){
 const e=auditSystem();e.cell('SALES','S1',['team_name',team]);e.clock('2026-11-25 12:00:00');
 for(const [id,name]of [['TNTPK','Entrostop Tablet'],['TMXGF','Mixagrip Flu'],['TMXGE','Mixagrip Flu & Batuk'],['TMXTG','Mextril Batuk']])e.rows('PRODUCTS').push([id,name,'ACTIVE']);
 for(const id of e.c.KCH_CANVASSER_LOADING_)if(!e.objects('PRODUCTS').some(p=>p.product_id===id))e.rows('PRODUCTS').push([id,'Loading '+id,'ACTIVE']);
 e.tx=(product,amount,date='2026-11-02',sales='S1',patch={})=>{const row={transaction_id:'TV-TEST-'+(++seq),transaction_date:date,sales_id:sales,product_id:product,quantity:amount<0?-1:1,selling_price:Math.abs(amount),subtotal_sales:amount,team_name:team,...patch};e.rows('SALES_TRANSACTIONS').push(e.rows('SALES_TRANSACTIONS')[0].map(h=>row[h]??''));return e.rows('SALES_TRANSACTIONS').at(-1);};
 e.report=(month='2026-11')=>e.call('getIncentiveReport',month,'S1');e.score=(month='2026-11')=>e.call('getScoreReport',month,'S1');return e;
}
function day(r,date){return r.daily.find(d=>d.date===date);}
test('Motoris chronological cap gives only the remaining 200k, then zero, independent of input order',()=>{
 const e=fixture();e.tx('TNTPK',500000,'2026-11-04');e.tx('TNTPK',500000,'2026-11-03');e.tx('TNTPK',4800000,'2026-11-02');const r=e.report();assert.equal(day(r,'2026-11-02').value,4800000);assert.equal(day(r,'2026-11-03').value,200000);assert.equal(day(r,'2026-11-04').value,0);assert.equal(day(r,'2026-11-03').rawValue,500000);assert.equal(day(r,'2026-11-03').excludedValue,300000);assert.equal(r.monthly.actualValue,5000000);assert.equal(e.score().parameters[2].actual,5000000);
});
test('PF A+B exact400k unlocks daily incentive; lower focus value never qualifies even with high TV',()=>{
 for(const [focus,expected]of [[399999.99,0],[400000,50000]]){const e=fixture();e.tx('LBMAV',focus);e.tx('TNTPK',1600000-focus);const d=day(e.report(),'2026-11-02');assert.equal(d.value,1600000);assert.equal(d.focusValue,focus);assert.equal(d.focusEligible,focus>=400000);assert.equal(d.scheduled,expected);}
});
test('an exhausted cap cannot earn the higher daily tier even though raw sales and focus qualify',()=>{
 const e=fixture();e.tx('TNTPK',5000000);e.tx('TNTPK',2000000,'2026-11-03');e.tx('LBMAV',400000,'2026-11-03');const r=e.report(),d=day(r,'2026-11-03');assert.equal(d.rawValue,2400000);assert.equal(d.value,400000);assert.equal(d.focusEligible,true);assert.equal(d.scheduled,0);
});
test('separate sales and calendar months have independent Motoris limits',()=>{
 const e=fixture();e.tx('TNTPK',6000000);e.tx('TNTPK',6000000,'2026-11-03','S2');e.tx('TNTPK',6000000,'2026-12-02');e.capturePeriod();e.clock('2026-12-25 12:00:00');assert.equal(e.report().monthly.actualValue,5000000);assert.equal(e.call('getIncentiveReport','2026-11','S2').monthly.actualValue,5000000);assert.equal(e.report('2026-12').monthly.actualValue,5000000);
});
test('October keeps uncapped values and the old daily rule, including historical snapshots',()=>{
 const e=fixture();e.clock('2026-10-25 12:00:00');e.tx('TNTPK',6000000,'2026-10-02');e.capturePeriod();e.clock('2026-11-25 12:00:00');const r=e.report('2026-10');assert.equal(r.monthly.actualValue,6000000);assert.equal(day(r,'2026-10-02').scheduled,50000);assert.equal(r.tvRecognition,null);assert.equal(e.score('2026-10').parameters[2].actual,6000000);
});
test('Canvasser applies independent4m limits to the three explicit product names, without capping focus or other loading',()=>{
 const e=fixture('Canvasser');for(const p of ['TMXGF','TMXGE','TMXTG'])e.tx(p,5000000);e.tx('LBMAV',6000000);e.tx('LPRGR',5000000);const r=e.report();assert.equal(r.monthly.actualValue,23000000);assert.equal(e.score().parameters[2].actual,23000000);assert.equal(r.monthly.parameters[0].actual,6000000);assert.equal(r.monthly.parameters[1].actual,5000000);assert.equal(day(r,'2026-11-02').excludedValue,3000000);
});
test('Canvasser daily uses the partial recognized remainder and retains the existing Promag Tablet branch',()=>{
 const e=fixture('Canvasser');e.tx('TMXGF',3800000);e.tx('TMXGF',1000000,'2026-11-03');e.tx('LBMAV',2300000,'2026-11-03');e.tx('LPRGN',1000000,'2026-11-03');const d=day(e.report(),'2026-11-03');assert.equal(d.value,2500000);assert.equal(d.tabletValue,1000000);assert.equal(d.scheduled,70000);
});
test('same-day splits cannot change cap allocation or daily incentive',()=>{
 const a=fixture(),b=fixture();a.tx('TNTPK',5500000);b.tx('TNTPK',2000000);b.tx('TNTPK',3500000);a.tx('LBMAV',400000);b.tx('LBMAV',400000);assert.deepEqual(JSON.parse(JSON.stringify(a.report().daily)),JSON.parse(JSON.stringify(b.report().daily)));
});
test('future entries do not consume the current cap',()=>{
 const e=fixture();e.tx('TNTPK',5000000,'2026-11-30');e.tx('TNTPK',1000000);assert.equal(e.report().monthly.actualValue,1000000);assert.equal(day(e.report(),'2026-11-30').amount,null);
});
test('a signed return above the ceiling does not remove recognized TV until the net amount falls below cap',()=>{
 const e=fixture();e.tx('TNTPK',6000000);e.tx('TNTPK',-500000,'2026-11-03');e.tx('TNTPK',-1000000,'2026-11-04');const table=e.c.txTable_('SALES_TRANSACTIONS',e.rows('SALES_TRANSACTIONS'),[],false).rows;table.forEach(r=>{if(r.quantity<0)r._kch_adjustment=true;});const data=e.c.scoreContext_(true),mapping=e.c.scoreMapping_(data),policy=e.c.periodTVPolicy_(e.c.periodCurrentPolicy_(),'2026-11');const days=e.c.scoreRecognizedDays_(table,'2026-11',{sales_id:'S1',team_name:'Motoris'},mapping,policy,'2026-11-25');assert.equal(days['2026-11-03'].tv,0);assert.equal(days['2026-11-04'].tv,-50000000);
});
test('editing the original invoice recomputes the cap allocation and all business rows remain untouched by reads',()=>{
 const e=fixture();const row=e.tx('TNTPK',4800000);e.tx('TNTPK',500000,'2026-11-03');assert.equal(day(e.report(),'2026-11-03').value,200000);const hs=e.rows('SALES_TRANSACTIONS')[0];row[hs.indexOf('subtotal_sales')]=4000000;row[hs.indexOf('selling_price')]=4000000;const before=JSON.stringify([e.rows('SALES_TRANSACTIONS'),e.rows('INVENTORY'),e.rows('SALES_STOCK'),e.rows('ACTIVITY_LOGS')]);assert.equal(day(e.report(),'2026-11-03').value,500000);e.score();assert.equal(JSON.stringify([e.rows('SALES_TRANSACTIONS'),e.rows('INVENTORY'),e.rows('SALES_STOCK'),e.rows('ACTIVITY_LOGS')]),before);
});
test('Q4 combines October uncapped and November/December independently capped with the original tariff identity',()=>{
 const e=fixture();for(const month of ['2026-10','2026-11','2026-12']){e.clock(month+'-25 12:00:00');e.tx('TNTPK',6000000,month+'-02');e.tx('LBMAV',22000000,month+'-02');e.capturePeriod();}e.clock('2027-01-05 12:00:00');const r=e.report('2026-11');assert.equal(r.quarter.actual,82000000);assert.equal(r.quarter.reachedMonths,3);assert.equal(r.quarter.amount,2000000);assert.deepEqual(Array.from(r.quarter.months,m=>m.actual),[28000000,27000000,27000000]);
});
test('rule snapshot records TV version and rejects unknown or tampered recognition rules',()=>{
 const e=fixture();e.capturePeriod();const r=e.objects(e.c.KCH_PERIOD_MASTERS_).find(r=>r.entity==='RULES'),policy=JSON.parse(r.data_json);assert.equal(policy.tvRecognition.version,'KCH_TV_300_2026_11');assert.ok(e.c.periodResolvePolicy_(policy));policy.tvRecognition.motorisCap=999;assert.equal(e.c.periodResolvePolicy_(policy),null);assert.throws(()=>e.c.periodTVPolicy_(policy,'2026-11'),/belum didukung/);
});
test('Guest receives identical capped reports and cannot change the source',()=>{
 const e=fixture();e.tx('TNTPK',6000000);const a=e.report();e.actor({role:'GUEST'});assert.equal(e.report().monthly.actualValue,a.monthly.actualValue);assert.equal(e.score().parameters[2].actual,5000000);assert.throws(()=>e.call('saveMasterRecord',{}),/Tamu hanya boleh/);
});

test('confirmed Canvasser codes retain caps after master renames; unrelated similar names stay uncapped',()=>{
 const e=fixture('Canvasser');for(const code of ['TMXGF','TMXGE','TMXTG']){e.cell('PRODUCTS',code,['product_name','Nama kemasan baru '+code],'product_id');e.tx(code,5000000);}
 e.cell('PRODUCTS','LEXUA',['product_name','Mextril nama mirip bukan kode yang disetujui'],'product_id');e.tx('LEXUA',5000000);
 const r=e.report();assert.equal(r.monthly.actualValue,17000000);assert.equal(e.score().parameters[2].actual,17000000);assert.deepEqual(Array.from(r.tvRecognition.canvasserCodes),['TMXGF','TMXGE','TMXTG']);
});
test('confirmed SKU ceilings stay4m each when legacy snapshot has no recognition metadata',()=>{
 const e=fixture('Canvasser');for(const code of ['TMXGF','TMXGE','TMXTG'])e.tx(code,6000000);e.capturePeriod();const headers=e.rows(e.c.KCH_PERIOD_MASTERS_)[0],rule=e.rows(e.c.KCH_PERIOD_MASTERS_).find((r,i)=>i&&r[headers.indexOf('entity')]==='RULES'),p=JSON.parse(rule[headers.indexOf('data_json')]);delete p.tvRecognition;rule[headers.indexOf('data_json')]=JSON.stringify(p);e.clock('2026-12-05 12:00:00');assert.equal(e.report().monthly.actualValue,12000000);assert.equal(e.score().parameters[2].actual,12000000);
});
test('paired Junior receives70percent of the capped Senior report without independent SKU quotas or double reductions',()=>{
 const e=fixture('Canvasser');e.c.KCH_INCENTIVE_PAIRS_=[['S1','S2']];e.cell('SALES','S2',['team_name','Junior Canvasser']);for(const code of ['TMXGF','TMXGE','TMXTG'])e.tx(code,5000000);e.tx('LBMAV',6400000);e.tx('LPRGR',8200000);e.tx('LEXUA',53400000);
 const s=e.report(),j=e.call('getIncentiveReport','2026-11','S2');assert.equal(s.monthly.actualValue,80000000);assert.equal(s.dailyScheduledTotal,70000);assert.equal(j.dailyTotal,s.dailyTotal*.7);assert.equal(j.monthTotal,s.monthTotal*.7);assert.equal(j.daily[1].referenceValue,80000000);assert.equal(j.monthly.actualValue,null);
});
test('native daily/monthly/quarterly report rows use exactly the same capped TV as the web report',()=>{
 for(const team of ['Motoris','Canvasser']){const e=fixture(team);for(const code of team==='Motoris'?['TNTPK']:['TMXGF','TMXGE','TMXTG'])e.tx(code,6000000);const expected=team==='Motoris'?5000000:12000000,web=e.report();e.c.KCH_REQUEST_USER_={role:'ADMIN',email:'mhmdryyan7@gmail.com'};let rows;try{rows=e.c.kchIncentiveSheetRows_(e.c.scoreContext_(true));}finally{e.c.KCH_REQUEST_USER_=null;}
 const schemas=e.c.KCH_INCENTIVE_SHEET_SCHEMAS_,monthly=rows.INSENTIF_BULANAN.find(r=>r[0]==='2026-11'&&r[1]==='S1'),daily=rows.INSENTIF_HARIAN.filter(r=>r[0]==='2026-11'&&r[2]==='S1'),quarter=rows.INSENTIF_TRIWULAN.find(r=>r[2]==='S1');assert.equal(monthly[schemas.INSENTIF_BULANAN.indexOf('total_value_actual')],expected);assert.equal(daily.reduce((sum,r)=>sum+r[schemas.INSENTIF_HARIAN.indexOf('total_value')],0),expected);assert.equal(quarter[schemas.INSENTIF_TRIWULAN.indexOf('total_value')],web.quarter.actual);
 }
});
