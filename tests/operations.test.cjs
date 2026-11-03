const {test}=require('node:test'),assert=require('node:assert/strict'),{system}=require('./helpers/transaction-system.cjs');
let next=0;
function fixture(options={}){const e=system(options),c=e.context;e.actor({role:'ADMIN'});const call=(method,...args)=>c.kchApi('MOCK',method,args);return {...e,c,call,op:(kind,fields={})=>call('saveOperationalChange',{requestId:'REQ-OPS-TEST-'+String(++next).padStart(16,'0'),kind,date:'2026-10-25',reason:'Operasional nyata dalam simulasi',...fields}),ref:(kind,id)=>call('getOperationsReference',kind,id).reference,pickup:(qty=5)=>call('saveStockPickup',{requestId:'REQ-PICK-TEST-'+String(++next).padStart(16,'0'),salesId:'S1',date:'2026-10-25',distributor:'D1',items:[{productId:'P1',qty}]}),held:()=>e.rows('SALES_STOCK')?.slice(1).filter(r=>r[0]==='S1'&&r[1]==='P1'&&r[2]==='D1').reduce((a,r)=>a+Number(r[3]),0)||0};}
function report(e,month='2026-10'){e.actor({role:'GUEST'});const r=e.call('getMonthlyTeamReport',month,'S1');e.actor({role:'ADMIN'});assert.equal(r.success,true,r.message);return r;}
function returns(e,id,qty,extra={}){const r=e.ref('SALE_RETURN',id);return e.op('SALE_RETURN',{referenceId:id,expectedRevision:r.revision,items:[{key:r.items[0].key,qty,...extra}]});}
test('stock receipts and opname are atomic, audited and idempotent without manufacturing sales',()=>{
 const e=fixture(),payload={requestId:'REQ-OPS-REPLAY-000001',distributor:'D1',items:[{productId:'P1',qty:50}]};assert.equal(e.op('STOCK_IN',payload).success,true);assert.equal(e.stock(),60);assert.equal(e.op('STOCK_IN',payload).replayed,true);assert.equal(e.stock(),60);assert.equal(report(e).summary.totalSales,0);
 const countInput={distributor:'D1',items:[{productId:'P1',targetQty:3}]},count=e.op('STOCK_COUNT',{...countInput,expectedRevision:e.call('getStockCountPreview',countInput).revision});assert.equal(count.success,true,count.message);assert.equal(e.stock(),3);assert.equal(e.stock('P1',3),5);assert.equal(e.rows('_KCH_OPERATIONS').length,3);assert.equal(e.op('STOCK_COUNT',{distributor:'D1',items:[{productId:'P1',targetQty:-1}]}).state,'FAILED');assert.equal(e.stock(),3);
});
test('held returns distinguish resellable and damaged goods without adding revenue',()=>{
 const e=fixture();assert.equal(e.pickup().success,true);assert.equal(e.stock(),5);assert.equal(e.held(),5);
 assert.equal(e.op('RETURN_HELD',{salesId:'S1',distributor:'D1',items:[{productId:'P1',qty:2}]}).success,true);assert.equal(e.stock(),7);assert.equal(e.held(),3);
 assert.equal(e.op('RETURN_HELD',{salesId:'S1',distributor:'D1',items:[{productId:'P1',qty:1,condition:'DAMAGED'}]}).success,true);assert.equal(e.stock(),7);assert.equal(e.held(),2);assert.equal(e.rows('DAMAGED_STOCK')[1][2],1);assert.equal(report(e).summary.totalSales,0);
});
test('partial invoice returns preserve original rows/prices and void restores only the unreturned remainder',()=>{
 const e=fixture(),saved=e.save();assert.equal(saved.success,true);assert.equal(e.stock(),8);assert.equal(returns(e,saved.transactionId,1).success,true);assert.equal(e.stock(),9);assert.equal(report(e).summary.totalSales,100);assert.equal(e.rows('SALES_TRANSACTIONS')[1][8],2);
 const r=e.ref('INVOICE_VOID',saved.transactionId);assert.equal(r.items[0].remaining,1);assert.equal(e.op('INVOICE_VOID',{referenceId:r.id,expectedRevision:r.revision}).success,true);assert.equal(e.stock(),10);assert.equal(report(e).summary.totalSales,0);
 assert.equal(e.op('INVOICE_VOID',{referenceId:r.id,expectedRevision:e.ref('INVOICE_VOID',r.id).revision}).state,'FAILED');assert.equal(e.stock(),10);
 const edit=e.call('getSalesTransactionForEdit',saved.transactionId);assert.equal(edit.success,false);assert.match(edit.message,/retur/);
});
test('a return restores sales holdings rather than distributor inventory when that was the invoice source',()=>{
 const e=fixture();e.pickup();const saved=e.save({items:[{productId:'P1',qty:2,sourceType:'SALES',distributorId:'D1'}]});assert.equal(saved.success,true,saved.message);assert.equal(e.stock(),5);assert.equal(e.held(),3);assert.equal(returns(e,saved.transactionId,1).success,true);assert.equal(e.stock(),5);assert.equal(e.held(),4);
});
test('damaged sale returns reduce sales but never increase sellable stock',()=>{
 const e=fixture(),saved=e.save();assert.equal(returns(e,saved.transactionId,1,{condition:'DAMAGED'}).success,true);assert.equal(e.stock(),8);assert.equal(e.rows('DAMAGED_STOCK')[1][2],1);assert.equal(report(e).summary.totalSales,100);
});
test('return caps and reference revisions prevent stale forms and over-returns',()=>{
 const e=fixture(),saved=e.save(),r=e.ref('SALE_RETURN',saved.transactionId);assert.equal(returns(e,saved.transactionId,1).success,true);
 assert.equal(e.op('SALE_RETURN',{referenceId:r.id,expectedRevision:r.revision,items:[{key:r.items[0].key,qty:1}]}).state,'FAILED');assert.equal(returns(e,saved.transactionId,2).state,'FAILED');assert.equal(e.stock(),9);
});
test('a closed-month invoice is corrected in the current month without changing the old month',()=>{
 const e=fixture(),saved=e.save({date:'2026-09-25'});assert.equal(saved.success,true);e.c.PropertiesService.getScriptProperties().setProperty('KCH_MONTHLY_ARCHIVE_ENABLED','TRUE');assert.equal(returns(e,saved.transactionId,1).success,true);assert.equal(report(e,'2026-09').summary.totalSales,200);assert.equal(report(e,'2026-10').summary.totalSales,-100);assert.equal(e.rows('SALES_TRANSACTIONS')[1][1],'2026-09-25');
});
test('pickup corrections adjust both accounts and expose the effective quantity with history intact',()=>{
 const e=fixture(),p=e.pickup(),r=e.ref('PICKUP_CORRECT',p.pickupId),result=e.op('PICKUP_CORRECT',{referenceId:r.id,expectedRevision:r.revision,items:[{key:r.items[0].key,targetQty:3}]});assert.equal(result.success,true,result.message);assert.equal(e.stock(),7);assert.equal(e.held(),3);assert.equal(e.rows('STOCK_PICKUPS')[1][8],5);assert.equal(e.call('getStockPickupData').pickups[0].quantity,3);
 const updated=e.ref('PICKUP_CORRECT',p.pickupId);assert.equal(updated.items[0].qty,3);assert.equal(e.op('PICKUP_CORRECT',{referenceId:updated.id,expectedRevision:updated.revision,items:[{key:updated.items[0].key,targetQty:0}]}).success,true);assert.equal(e.stock(),10);assert.equal(e.held(),0);
});
test('pickup reversal cannot consume holdings that have already been sold',()=>{
 const e=fixture(),p=e.pickup();assert.equal(e.save({items:[{productId:'P1',qty:4,sourceType:'SALES',distributorId:'D1'}]}).success,true);const r=e.ref('PICKUP_CORRECT',p.pickupId);assert.equal(e.op('PICKUP_CORRECT',{referenceId:r.id,expectedRevision:r.revision,items:[{key:r.items[0].key,targetQty:0}]}).state,'FAILED');assert.equal(e.held(),1);assert.equal(e.stock(),5);
});
test('setoran correction/void remains a memo and preserves original amounts',()=>{
 const e=fixture(),deposit=e.call('saveSalesCashDeposit',{requestId:'REQ-DEPOSIT-OPS-000001',salesId:'S1',date:'2026-10-25',distributor:'D1',amount:100000});assert.equal(deposit.success,true);
 let r=e.ref('DEPOSIT_CORRECT',deposit.depositId);assert.equal(e.op('DEPOSIT_CORRECT',{referenceId:r.id,expectedRevision:r.revision,amount:90000}).success,true);assert.equal(e.call('getStockPickupData').cashDeposits[0].amount,90000);
 r=e.ref('DEPOSIT_CORRECT',deposit.depositId);assert.equal(e.op('DEPOSIT_CORRECT',{referenceId:r.id,expectedRevision:r.revision,amount:0}).success,true);assert.equal(e.call('getStockPickupData').cashDeposits[0].amount,0);assert.equal(e.rows('SALES_CASH_DEPOSITS')[1][6],100000);assert.equal(e.stock(),10);assert.equal(report(e).summary.totalSales,0);
});
test('guest sees operational history but cannot write operations, references or masters',()=>{
 const e=fixture();e.op('STOCK_IN',{distributor:'D1',items:[{productId:'P1',qty:2}]});e.actor({role:'GUEST'});const res=e.call('getOperationsSetup');assert.equal(res.history.length,1);assert.ok(!JSON.stringify(res).includes('one@example.test'));for(const method of ['saveOperationalChange','getOperationsReference','getMasterEditor','saveMasterRecord'])assert.throws(()=>e.call(method,{}),/Tamu hanya boleh/);
});
test('known batch rejection leaves every stock/operation/audit row unchanged',()=>{
 const e=fixture({financialFault:'reject400'}),r=e.op('STOCK_IN',{distributor:'D1',items:[{productId:'P1',qty:2}]});assert.equal(r.state,'FAILED');assert.equal(e.stock(),10);assert.equal(e.exists('_KCH_OPERATIONS'),false);assert.equal(e.rows('ACTIVITY_LOGS').length,1);
});
test('lost commit response replays a stock receipt once',()=>{
 const e=fixture({financialFault:'lostAfterCommit'}),r=e.op('STOCK_IN',{distributor:'D1',items:[{productId:'P1',qty:2}]});assert.equal(r.success,true);assert.equal(r.replayed,true);assert.equal(e.stock(),12);assert.equal(e.rows('_KCH_OPERATIONS').length,2);
});
test('ambiguous operation keeps all accounts unchanged until the original batch settles',()=>{
 const e=fixture({financialFault:'unknownBefore'}),r=e.op('STOCK_IN',{distributor:'D1',items:[{productId:'P1',qty:2}]});assert.equal(r.state,'PENDING');assert.equal(e.stock(),10);e.settle();assert.equal(e.status(r.requestId).state,'COMMITTED');assert.equal(e.stock(),12);assert.equal(e.rows('_KCH_OPERATIONS').length,2);
});
test('mixed-source invoice returns keep every source and original price after master/status changes',()=>{
 const e=fixture();e.pickup();const sale=e.save({items:[{productId:'P1',qty:1,sourceType:'DIRECT',distributorId:'D1'},{productId:'P1',qty:2,sourceType:'SALES',distributorId:'D1'},{productId:'P2',qty:1,sourceType:'DIRECT',distributorId:'D2'}]});assert.equal(sale.success,true,sale.message);e.rows('PRICE_MASTER')[1][3]=999;e.rows('PRODUCTS')[1][2]='INACTIVE';e.rows('SALES')[1][3]='INACTIVE';const ref=e.ref('SALE_RETURN',sale.transactionId),items=ref.items.filter(i=>i.productId==='P1').map(i=>({key:i.key,qty:1}));const returned=e.op('SALE_RETURN',{referenceId:ref.id,expectedRevision:ref.revision,items});assert.equal(returned.success,true,returned.message);assert.equal(returned.totalSales,-200);assert.equal(e.stock(),5);assert.equal(e.held(),4);assert.equal(e.stock('P2',3),2);
 const detail=e.call('getTransactionDetail',sale.transactionId);assert.equal(detail.header.totalSales,340);assert.equal(detail.header.returnedValue,200);assert.equal(detail.header.netTotalSales,140);
 const rest=e.ref('INVOICE_VOID',sale.transactionId);assert.equal(e.op('INVOICE_VOID',{referenceId:rest.id,expectedRevision:rest.revision}).success,true);assert.equal(e.stock(),5);assert.equal(e.held(),5);assert.equal(e.stock('P2',3),3);assert.equal(report(e).summary.totalSales,0);
});
test('correction date cannot precede its source record',()=>{
 const e=fixture(),sale=e.save(),ref=e.ref('SALE_RETURN',sale.transactionId),r=e.op('SALE_RETURN',{date:'2026-10-24',referenceId:ref.id,expectedRevision:ref.revision,items:[{key:ref.items[0].key,qty:1}]});assert.equal(r.state,'FAILED');assert.match(r.message,/mendahului/);assert.equal(e.stock(),8);
});
test('duplicate canonical distributor sources cannot bypass a physical stock balance',()=>{
 const e=fixture();e.rows('DISTRIBUTORS').push(['D3','GMP','ACTIVE']);const r=e.save({items:[{productId:'P1',qty:6,distributorId:'D1',sourceType:'DIRECT'},{productId:'P1',qty:6,distributorId:'D3',sourceType:'DIRECT'}]});assert.equal(r.state,'FAILED');assert.equal(e.stock(),10);assert.equal(e.rows('SALES_TRANSACTIONS').length,1);
});
