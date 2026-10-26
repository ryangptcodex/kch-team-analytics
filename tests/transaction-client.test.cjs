const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
function browser(storage=new Map()) {
 const ids=['txFormFields','txRequestStatus','txRequestStatusText','txRequestCode','btnRetryTxRequest','btnCheckTxRequest','btnSubmitTx','transactionItemsTbody','txEditFormFields','btnSubmitTxEdit','editTxRequestStatus','editTxRequestStatusText','editTxRequestCode','btnRetryTxEditRequest','btnCheckTxEditRequest'];
 const els=Object.fromEntries(ids.map(id=>[id,{style:{},disabled:false,textContent:''}]));
 const values={inputTxTeam:'Motoris',inputTxSales:'S1',inputTxDistributor:'D1',inputTxDate:'2026-10-25',inputTxNotes:'private note'};
 els.transactionItemsTbody.querySelectorAll=()=>[{querySelector:s=>({value:s==='.item-product-select'?'P1':'2'})}];
 const calls=[],toasts=[];
 const c={console,document:{addEventListener(){},getElementById:id=>els[id]||null},window:{location:{hostname:'kch.test'},crypto,
 sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../js.html'),'utf8').replace(/^<script>/,'').replace(/<\/script>\s*$/,''),c);
 c.appState.user={uid:'user-1'};c.appState.inventory=[{product_id:'P1',D1:10}];c.getValue=id=>values[id]||'';c.findPriceProduct=()=>({cost_price:60,selling_price:100});
 c.showToast=(...args)=>toasts.push(args);let refreshes=0,resets=0;c.loadMetadata=()=>refreshes++;c.resetSalesTransactionForm=()=>resets++;
 c.kchRun=()=>{let ok,fail;const p={withSuccessHandler:f=>(ok=f,p),withFailureHandler:f=>(fail=f,p),saveSalesTransaction:payload=>calls.push({method:'save',payload,ok,fail}),editSalesTransaction:payload=>calls.push({method:'edit',payload,ok,fail}),getSalesTransactionRequestStatus:id=>calls.push({method:'status',id,ok,fail})};return p};
 return {c,els,calls,storage,toasts,refreshes:()=>refreshes,resets:()=>resets,values};
}
test('double submit is ignored and only opaque ID is retained for recovery',()=>{
 const e=browser();e.c.submitSalesTransaction();e.c.submitSalesTransaction();assert.equal(e.calls.length,1);assert.equal(e.els.txFormFields.disabled,true);
 assert.equal(e.els.txRequestStatus.style.display,'none');assert.equal(e.els.btnSubmitTx.textContent,'Menyimpan…');
 const saved=JSON.parse([...e.storage.values()][0]);assert.deepEqual(Object.keys(saved),['requestId']);assert.equal(saved.requestId,e.calls[0].payload.requestId);assert.ok(![...e.storage.values()][0].includes('private'));
});
test('lost response locks draft; status recovery clears once and refreshes authoritative stock',()=>{
 const e=browser();e.c.submitSalesTransaction();const id=e.calls[0].payload.requestId;e.calls[0].fail(Error('offline'));
 assert.equal(e.els.txFormFields.disabled,true);assert.equal(e.els.btnCheckTxRequest.disabled,false);
 e.c.submitSalesTransaction();assert.equal(e.calls.length,1);e.c.checkPendingSalesTransaction();assert.equal(e.calls[1].id,id);
 e.calls[1].ok({success:true,state:'COMMITTED',transactionId:'TRX-1',totalSales:200,message:'Tersimpan'});
 assert.equal(e.c.appState.pendingTransaction,null);assert.equal(e.storage.size,0);assert.equal(e.els.txFormFields.disabled,false);assert.equal(e.refreshes(),1);assert.equal(e.resets(),1);assert.equal(e.c.appState.inventory[0].D1,10);
});
test('not-found retry keeps original request and exact draft',()=>{
 const e=browser();e.c.submitSalesTransaction();const payload=e.calls[0].payload;e.calls[0].fail(Error('offline'));e.c.checkPendingSalesTransaction();e.calls[1].ok({state:'NOT_FOUND',blocked:false});
 assert.equal(e.els.btnRetryTxRequest.style.display,'inline-flex');e.c.retryPendingSalesTransaction();assert.equal(e.calls[2].payload,payload);assert.equal(e.calls[2].payload.requestId,payload.requestId);
});
test('refresh restores own opaque ID, checks status and holds form during uncertainty',()=>{
 const first=browser();first.c.submitSalesTransaction();const e=browser(first.storage);e.c.restorePendingSalesTransaction();assert.equal(e.calls[0].method,'status');assert.equal(e.els.txFormFields.disabled,true);
 e.calls[0].ok({state:'PENDING',message:'Masih diperiksa'});assert.equal(e.els.txFormFields.disabled,true);assert.equal(e.els.btnRetryTxRequest.style.display,'none');assert.equal(e.c.appState.pendingTransaction.payload,null);
});
test('restored unsent ID is reused when details are reentered',()=>{
 const first=browser();first.c.submitSalesTransaction();const id=first.calls[0].payload.requestId;const e=browser(first.storage);e.c.restorePendingSalesTransaction();e.calls[0].ok({state:'NOT_FOUND',blocked:false});assert.equal(e.els.txFormFields.disabled,false);
 e.c.submitSalesTransaction();assert.equal(e.calls[1].payload.requestId,id);
});
test('terminal rejection unlocks existing draft; correction uses a fresh ID',()=>{
 const e=browser();e.c.submitSalesTransaction();const id=e.calls[0].payload.requestId;e.calls[0].ok({success:false,state:'FAILED',terminal:true,message:'Stok kurang'});
 assert.equal(e.storage.size,0);assert.equal(e.resets(),0);assert.equal(e.els.txFormFields.disabled,false);e.c.submitSalesTransaction();assert.notEqual(e.calls[1].payload.requestId,id);
});
test('blocked browser storage stops submission before any RPC',()=>{
 const e=browser();e.c.window.sessionStorage.setItem=()=>{throw Error('blocked')};e.c.submitSalesTransaction();assert.equal(e.calls.length,0);assert.equal(e.c.appState.pendingTransaction,null);assert.match(e.toasts[0][0],/belum dimulai/);
});
test('pending IDs are isolated by verified account and hostname',()=>{
 const first=browser();first.c.submitSalesTransaction();const e=browser(first.storage);e.c.appState.user={uid:'user-2'};e.c.restorePendingSalesTransaction();assert.equal(e.calls.length,0);assert.equal(e.c.appState.pendingTransaction,null);
 e.c.appState.user={uid:'user-1'};e.c.window.location.hostname='other.test';e.c.restorePendingSalesTransaction();assert.equal(e.calls.length,0);
});
test('storage removal failure keeps committed submission locked against duplicates',()=>{
 const e=browser();e.c.submitSalesTransaction();e.c.window.sessionStorage.removeItem=()=>{throw Error('blocked')};e.calls[0].ok({success:true,state:'COMMITTED',transactionId:'TRX-1',totalSales:200});
 assert.equal(e.els.txFormFields.disabled,true);assert.ok(e.c.appState.pendingTransaction);assert.equal(e.refreshes(),0);e.c.submitSalesTransaction();assert.equal(e.calls.length,1);
});

test('edit dispatch shares request recovery and locks both financial forms',()=>{
 const e=browser(),payload={transactionId:'TRX-1',requestId:'REQ-EDIT-0000000001',items:[]};e.c.appState.pendingTransaction={requestId:payload.requestId,payload};e.c.txClientStore(e.c.appState.pendingTransaction);e.c.txClientSend(payload);
 assert.equal(e.calls[0].method,'edit');assert.equal(e.els.txEditFormFields.disabled,true);assert.equal(e.els.txFormFields.disabled,true);assert.equal(e.els.btnSubmitTxEdit.textContent,'Menyimpan…');assert.equal(e.els.editTxRequestStatus.style.display,'none');
 e.calls[0].fail(Error('offline'));assert.equal(e.els.editTxRequestStatus.style.display,'block');assert.equal(e.els.btnCheckTxEditRequest.disabled,false);
 e.c.checkPendingSalesTransaction();e.calls[1].ok({state:'NOT_FOUND',blocked:false});e.c.retryPendingSalesTransaction();assert.equal(e.calls[2].method,'edit');assert.equal(e.calls[2].payload,payload);
});
test('committed edit closes its dialog and refreshes without resetting create draft',()=>{
 const e=browser();let closed=0;e.c.closeSalesTransactionEdit=()=>closed++;e.c.appState.pendingTransaction={requestId:'REQ-EDIT-0000000001',payload:{transactionId:'TRX-1'}};
 e.c.txClientHandleResult({success:true,state:'COMMITTED',operation:'EDIT',transactionId:'TRX-1',totalSales:100,message:'Tersimpan'});
 assert.equal(closed,1);assert.equal(e.resets(),0);assert.equal(e.refreshes(),1);assert.equal(e.c.appState.pendingTransaction,null);assert.equal(e.els.txEditFormFields.disabled,false);
});
test('an unresolved edit cannot be closed or replaced by another edit',()=>{
 const e=browser();e.c.appState.pendingTransaction={requestId:'REQ-EDIT-0000000001',payload:{transactionId:'TRX-1'}};e.c.appState.transactionEdit={header:{id:'TRX-1'}};
 e.c.closeSalesTransactionEdit();assert.ok(e.c.appState.transactionEdit);e.c.openSalesTransactionEdit('TRX-2');assert.equal(e.calls.length,0);assert.equal(e.toasts.length,2);
});
