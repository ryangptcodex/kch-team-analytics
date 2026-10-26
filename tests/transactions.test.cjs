const { test } = require('node:test');
const assert = require('node:assert/strict');
const { system } = require('./helpers/transaction-system.cjs');
const q = qty => ({productId:'P1',qty,costPrice:60,sellingPrice:100});
function unchanged(e) { assert.equal(e.stock(),10); assert.equal(e.rows('SALES_TRANSACTIONS').length,1); assert.equal(e.rows('INVENTORY_MOVEMENTS').length,1); }

test('one commit writes canonical sale, selected stock, movement, audit and committed receipt',()=>{
 const e=system();const r=e.save();assert.equal(r.success,true);assert.equal(r.totalSales,200);assert.equal(r.totalCost,120);assert.equal(r.totalShj,80);
 assert.equal(e.stock(),8);assert.equal(e.stock('P1',3),5);assert.equal(e.rows('SALES_TRANSACTIONS')[1][8],2);
 assert.equal(e.rows('INVENTORY_MOVEMENTS')[1][4],15);assert.equal(e.rows('INVENTORY_MOVEMENTS')[1][5],13);
 assert.equal(e.rows('ACTIVITY_LOGS')[1][2],'one@example.test');assert.equal(e.committedBatches(),1);assert.equal(e.status().transactionId,r.transactionId);
});
test('duplicate product lines are summed before stock checking',()=>{
 const e=system();const r=e.save({items:[q(6),q(6)]});assert.equal(r.state,'FAILED');assert.match(r.message,/mencukupi/);unchanged(e);
 const ok=system();assert.equal(ok.save({items:[q(6),q(4)]}).success,true);assert.equal(ok.stock(),0);assert.equal(ok.rows('SALES_TRANSACTIONS').length,2);assert.equal(ok.rows('SALES_TRANSACTIONS')[1][8],10);
});
for(const qty of [-2,0,1.5,'1.5','abc',null,true,Infinity])test('rejects invalid quantity '+String(qty),()=>{const e=system();assert.equal(e.save({items:[q(qty)]}).state,'FAILED');unchanged(e)});
test('rejects invalid/future dates but permits valid historical transactions',()=>{
 for(const date of ['2026-02-31','2026-10-00','2030-01-01','25/10/2026']){const e=system();assert.equal(e.save({date}).state,'FAILED');unchanged(e)}
 const e=system();assert.equal(e.save({date:'2026-09-01'}).success,true);
});
test('tampered quotes are rejected and master prices are authoritative without a quote',()=>{
 const e=system();assert.equal(e.save({items:[{productId:'P1',qty:1,costPrice:0,sellingPrice:1}]}).state,'FAILED');unchanged(e);
 const other=system();assert.equal(other.save({items:[{productId:'P1',qty:1}]}).success,true);assert.equal(other.rows('SALES_TRANSACTIONS')[1][9],60);assert.equal(other.rows('SALES_TRANSACTIONS')[1][10],100);
});
test('inactive products/prices/distributors and wrong-team prices are rejected',()=>{
 for(const mutate of [e=>{e.rows('PRODUCTS')[1][2]='INACTIVE'},e=>{e.rows('PRICE_MASTER')[1][5]='INACTIVE'},e=>{e.rows('DISTRIBUTORS')[1][2]='INACTIVE'},e=>{e.rows('PRICE_MASTER')[1][1]='Canvasser'}]){const e=system();mutate(e);assert.equal(e.save().state,'FAILED');unchanged(e)}
 const e=system();assert.equal(e.save({distributor:'Unknown'}).state,'FAILED');unchanged(e);
});
test('distributor names, IDs and supported legacy team names resolve unambiguously',()=>{
 const e=system();e.rows('SALES')[1][2]='TEAM-02';const r=e.save({distributor:'AP. Geubrina Rizki (Panel)'});assert.equal(r.success,true);assert.equal(e.stock(),10);assert.equal(e.stock('P1',3),3);assert.equal(e.rows('SALES_TRANSACTIONS')[1][4],'Motoris');
});
test('duplicate master rows and invalid stock prevent all financial writes',()=>{
 for(const mutate of [e=>{e.rows('PRODUCTS').push([...e.rows('PRODUCTS')[1]])},e=>{e.rows('PRICE_MASTER').push([...e.rows('PRICE_MASTER')[1]])},e=>{e.rows('INVENTORY')[1][2]=-1},e=>{e.rows('INVENTORY')[1][2]=1.5}]){const e=system();mutate(e);const before=e.stock();assert.equal(e.save().state,'FAILED');assert.equal(e.stock(),before);assert.equal(e.rows('SALES_TRANSACTIONS').length,1)}
});
test('same request replays its original result without another stock deduction',()=>{
 const e=system();const first=e.save();e.rows('PRICE_MASTER')[1][3]=200;const replay=e.save();assert.equal(replay.success,true);assert.equal(replay.replayed,true);assert.equal(replay.transactionId,first.transactionId);assert.equal(replay.totalSales,200);assert.equal(e.stock(),8);assert.equal(e.committedBatches(),1);
});
test('same request ID with changed intent is refused after commit',()=>{
 const e=system();e.save();assert.equal(e.save({items:[q(3)]}).code,'REQUEST_CONFLICT');assert.equal(e.stock(),8);assert.equal(e.committedBatches(),1);
});
test('a rejected request is terminal; a corrected new request can proceed',()=>{
 const e=system();assert.equal(e.save({items:[q(-2)]}).state,'FAILED');assert.equal(e.save().state,'FAILED');unchanged(e);
 assert.equal(e.save({requestId:'REQ-0000000000000002'}).success,true);assert.equal(e.stock(),8);
});
test('an atomic request rejection leaves stock, sales, movement and audit unchanged',()=>{
 const e=system({rejectTarget:'INVENTORY_MOVEMENTS'});const r=e.save();assert.equal(r.state,'FAILED');unchanged(e);assert.equal(e.rows('ACTIVITY_LOGS').length,1);assert.equal(e.committedBatches(),0);
});
test('a lost response after commit is resolved from the receipt without resubmitting',()=>{
 const e=system({financialFault:'lostAfterCommit'});const r=e.save();assert.equal(r.success,true);assert.equal(r.replayed,true);assert.equal(e.stock(),8);assert.equal(e.financialAttempts(),1);
});
test('receipt checks recover an acknowledged-later commit with no duplicate financial batch',()=>{
 const e=system({financialFault:'lostAndReadFail'});assert.equal(e.save().state,'PENDING');assert.equal(e.stock(),8);assert.equal(e.status().state,'COMMITTED');assert.equal(e.save().success,true);assert.equal(e.financialAttempts(),1);
});
test('uncertain writes block retries and other sales until the original outcome settles',()=>{
 const e=system({financialFault:'unknownBefore'});assert.equal(e.save().state,'PENDING');unchanged(e);assert.equal(e.save().state,'PENDING');assert.equal(e.financialAttempts(),1);
 e.actor({uid:'user-2',email:'two@example.test',salesId:'S2'});assert.equal(e.save({requestId:'REQ-0000000000000002',salesId:'S2'}).state,'PENDING');assert.equal(e.financialAttempts(),1);
 assert.throws(()=>e.context.assertNoPendingTransactions_(),/ditahan/);
 e.settle();assert.equal(e.stock(),8);e.actor({uid:'user-1',email:'one@example.test',salesId:'S1'});assert.equal(e.status().state,'COMMITTED');
 assert.equal(e.save({requestId:'REQ-0000000000000002'}).success,true);assert.equal(e.stock(),6);assert.equal(e.financialAttempts(),2);
});
test('request status is scoped by verified UID, not payload identity',()=>{
 const e=system();e.save();e.actor({uid:'user-2',email:'two@example.test',salesId:'S2'});assert.equal(e.status().state,'NOT_FOUND');
 assert.equal(e.save({salesId:'S2'}).success,true);assert.equal(e.stock(),6);assert.equal(e.rows('SALES_TRANSACTIONS').length,3);
});
test('server ownership checks and real actor attribution remain enforced',()=>{
 const e=system();assert.throws(()=>e.save({salesId:'S2'}),/data sendiri/);unchanged(e);
 e.actor({uid:'admin',email:'admin@example.test',role:'ADMIN'});assert.equal(e.save({salesId:'S2',username:'fake@example.test'}).success,true);
 assert.equal(e.rows('SALES_TRANSACTIONS')[1][2],'S2');assert.equal(e.rows('SALES_TRANSACTIONS')[1][16],'admin@example.test');assert.equal(JSON.parse(e.rows('ACTIVITY_LOGS')[1][5]).assisted,true);
});
test('formula-like notes and all text fields are written with literal stringValue',()=>{
 const e=system();assert.equal(e.save({notes:'=SUM(1,2)'}).success,true);assert.equal(e.rows('SALES_TRANSACTIONS')[1][15],'=SUM(1,2)');
 assert.ok(e.calls.some(c=>JSON.stringify(c.body).includes('"stringValue":"=SUM(1,2)"')));
});
test('missing financial tables are created in the same atomic batch',()=>{
 const e=system();for(const name of ['SALES_TRANSACTIONS','INVENTORY_MOVEMENTS','ACTIVITY_LOGS'])e.remove(name);
 assert.equal(e.save().success,true);assert.equal(e.rows('SALES_TRANSACTIONS').length,2);assert.equal(e.rows('INVENTORY_MOVEMENTS').length,2);assert.equal(e.rows('ACTIVITY_LOGS').length,2);
});
test('missing core masters and incorrect financial headers are rejected before stock changes',()=>{
 const e=system();e.remove('DISTRIBUTORS');assert.equal(e.save().state,'FAILED');assert.equal(e.stock(),10);
 const other=system();other.rows('INVENTORY_MOVEMENTS')[0][0]='wrong_date';assert.equal(other.save().state,'FAILED');unchanged(other);
});
test('decimal prices use integer minor units, avoiding floating-point totals',()=>{
 const e=system();e.rows('PRICE_MASTER')[1][2]=0.1;e.rows('PRICE_MASTER')[1][3]=0.3;
 const r=e.save({items:[{productId:'P1',qty:3,costPrice:0.1,sellingPrice:0.3}]});assert.equal(r.totalSales,0.9);assert.equal(r.totalCost,0.3);assert.equal(r.totalShj,0.6);
});
test('API activation failure does not create financial records or mutate stock',()=>{
 const e=system({apiDisabled:true});const r=e.save();assert.equal(r.success,false);assert.match(r.message,/API/);unchanged(e);assert.equal(e.exists('_KCH_TX_REQUESTS'),false);
});
test('malformed amounts and overflow do not silently become zero or unsafe totals',()=>{
 for(const value of ['not a number','1.2.3','1,2,3','12.34.567',-1,Infinity,0.001]){const e=system();e.rows('PRICE_MASTER')[1][2]=value;assert.equal(e.save({items:[{productId:'P1',qty:1}]}).state,'FAILED');unchanged(e)}
 const e=system();assert.equal(e.save({items:[q(Number.MAX_SAFE_INTEGER),q(1)]}).state,'FAILED');unchanged(e);
});
test('every committed request has exactly one financial batch and one actor receipt',()=>{
 const e=system();e.save();e.save();const rows=e.rows('_KCH_TX_REQUESTS');assert.equal(rows.length,2);assert.equal(rows[1][7],'COMMITTED');assert.equal(rows[1][2],'user-1');assert.equal(e.committedBatches(),1);
});
