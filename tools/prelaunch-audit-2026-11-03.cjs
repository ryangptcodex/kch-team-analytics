// Historical audit of source5c69964. Fixed-release regressions: tests/prelaunch-fixes.test.cjs.
if(!process.argv.includes('--historical-baseline')){console.log('Historical observations only: run against5c69964 with --historical-baseline. Current validation: node --test tests/*.test.cjs');process.exit(0);}
// Read-only audit of source5c69964. All data changes below are confined to in-memory Google mocks.
// These assertions reproduce remaining gaps; they are observations, not desired-behavior regression tests.
const assert=require('node:assert/strict');
const {auditSystem}=require('../tests/helpers/audit-system.cjs');
const observe=(id,details)=>console.log(JSON.stringify({id,...details}));
{
 const e=auditSystem();assert.equal(e.save().success,true);
 const hs=e.rows('SALES_TRANSACTIONS')[0],r=e.rows('SALES_TRANSACTIONS')[1];r[hs.indexOf('product_id')]='LBMAV';r[hs.indexOf('product_name')]='Bejo Jahe Merah';
 e.capturePeriod();e.clock('2026-11-03 12:00:00');const before=e.call('getScoreReport','2026-10','S1');e.c.KCH_SCORE_PRODUCT_RULES_.LBMAV[1]='OTHER';const after=e.call('getScoreReport','2026-10','S1');
 assert.equal(before.parameters[0].actual,200);assert.equal(after.parameters[0].actual,0);assert.equal(after.masterVerified,true);
 observe('L01',{case:'Closed snapshot rules ignored after calculator rule changes',beforeFocusA:200,afterFocusA:0,totalSales:after.parameters[2].actual,stillVerified:after.masterVerified});
}
{
 const e=auditSystem();e.remove('HOLIDAYS');const before=e.call('getIncentiveReport','2026-10','S1');e.capturePeriod();e.clock('2026-11-03 12:00:00');const after=e.call('getIncentiveReport','2026-10','S1');
 assert.equal(before.holidaySource,'');assert.equal(before.dailyTotal,null);assert.equal(after.holidaySource,'Snapshot periode');assert.equal(after.dailyTotal,0);assert.equal(after.masterVerified,true);
 observe('L02',{case:'Missing calendar becomes certified empty calendar after snapshot',beforeDailyTotal:before.dailyTotal,afterDailyTotal:after.dailyTotal,afterCalendar:after.holidaySource,stillVerified:after.masterVerified});
}
{
 const e=auditSystem(),record=e.call('getMasterEditor').tables.PRODUCTS.rows.find(r=>r.data.product_id==='LBMAV');
 const saved=e.call('saveMasterRecord',{requestId:'REQ-AUDIT-RENAME-000001',table:'PRODUCTS',data:{...record.data,product_name:'Bejo JM',unit:'Box'},expectedRevision:record.revision,reason:'Nama produk diringkas'});
 assert.equal(saved.success,true);const setup=e.call('getScoreSetup');assert.equal(setup.mappingReady,false);assert.throws(()=>e.call('getIncentiveReport','2026-10','S1'),/nama master tidak cocok/);
 observe('L03',{case:'Accepted product master edit breaks score mapping and incentive report',writeAccepted:saved.success,mappingReady:setup.mappingReady,issues:setup.mappingIssues});
}
{
 const e=auditSystem(),pickup=e.call('saveStockPickup',{requestId:'REQ-AUDIT-PICKUP-000001',salesId:'S1',date:'2026-10-25',distributor:'D1',items:[{productId:'P1',qty:2}]});assert.equal(pickup.success,true);
 e.rows('SALES_STOCK').splice(1);const health=e.call('getOperationalHealth'),issues=health.issues.filter(i=>i.table==='SALES_STOCK');assert.equal(issues.length,0);assert.equal(e.objects('SALES_STOCK_MOVEMENTS')[0].stock_after,2);
 observe('L04',{case:'Monitor misses a balance account removed while its movement ledger remains positive',movementBalance:2,balanceRows:e.objects('SALES_STOCK').length,holdingIssues:issues});
}
{
 const e=auditSystem();e.capturePeriod();e.clock('2026-11-03 12:00:00');e.cell('SALES','S1',['team_name','SPR']);
 const score=e.call('getScoreSetup').sales.map(s=>s.salesId),incentive=e.call('getIncentiveSetup').sales.map(s=>s.salesId);
 assert.equal(score.includes('S1'),false);assert.equal(incentive.includes('S1'),false);assert.equal(e.call('getScoreReport','2026-10','S1').sales.team,'Motoris');assert.equal(e.call('getIncentiveReport','2026-10','S1').sales.team,'Motoris');
 observe('L05',{case:'Historical eligible sales absent from screen selectors after moving to SPR',scoreSelector:score,incentiveSelector:incentive,historicalDirectReadWorks:true});
}
{
 const e=auditSystem(),payload={requestId:'REQ-AUDIT-COUNT-000001',kind:'STOCK_COUNT',date:'2026-10-25',reason:'Saldo fisik dihitung sebelum penjualan berikutnya',distributor:'D1',items:[{productId:'P1',targetQty:10}]};
 assert.equal(e.stock(),10);assert.equal(e.save().success,true);assert.equal(e.stock(),8);const saved=e.call('saveOperationalChange',payload);assert.equal(saved.success,true);assert.equal(e.stock(),10);
 observe('L06',{case:'Absolute stock count has no revision guard against intervening sales',physicalCountBeforeSale:10,balanceAfterSale:8,accepted:saved.success,balanceAfterStaleCount:e.stock()});
}
