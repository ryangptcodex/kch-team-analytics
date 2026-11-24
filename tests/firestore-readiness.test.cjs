const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

function app(options={}) {
  const owner='owner@example.test';
  const sheets=['SALES','PRODUCTS','PRICE_MASTER','DISTRIBUTORS','INVENTORY','SALES_TRANSACTIONS','ACCESS_USERS','_KCH_TX_REQUESTS'];
  const reads=[],logs=[];
  const c=vm.createContext({
    KCH_BOOTSTRAP_ADMIN_EMAIL_:owner,KCH_TX_REQUEST_SHEET_:'_KCH_TX_REQUESTS',
    isKchProduction_:()=>options.production!==false,normalizeKey_:v=>String(v).trim().toLowerCase(),
    getFirebaseWebConfig_:()=>({projectId:'production'}),getKchSpreadsheetId_:()=> 'prod',
    Session:{getActiveUser:()=>({getEmail:()=>options.active ?? owner}),getEffectiveUser:()=>({getEmail:()=>owner})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getId:()=>options.source || 'prod',getSheetByName:n=>sheets.includes(n)&&{getLastRow:()=>4}})},
    ScriptApp:{getOAuthToken:()=> 'mock'},
    txMetadata_:()=>{reads.push('metadata');return Object.fromEntries(sheets.map(n=>[n,{}]));},
    txReceipts_:()=>{reads.push('journal');return [{state:options.pending?'PENDING':'COMMITTED',actor_email:'private@example.test'}];},
    txHasPending_:rows=>rows.some(r=>r.state==='PENDING'),
    console:{log:s=>logs.push(s)}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','firestore-readiness.gs'),'utf8'),c);
  return {c,reads,logs};
}

test('Production readiness emits row extents and journal status without values or writes',()=>{
 const {c,reads,logs}=app({pending:true});
 const result=c.periksaSumberMigrasiFirestore();
 assert.equal(result.receiptState,'PENDING');
 assert.equal(result.rowsBelowHeader.ACCESS_USERS,3);
 assert.deepEqual(reads,['metadata','journal']);
 assert.doesNotMatch(logs.join(''),/private@example/);
});

test('readiness denies other users, projects, or spreadsheets before reading APIs',()=>{
 for(const options of [{active:''},{active:'other@example.test'},{production:false},{source:'other'}]){
   const {c,reads,logs}=app(options);
   assert.throws(()=>c.periksaSumberMigrasiFirestore(),/ACCESS_DENIED|belum terkonfirmasi/);
   assert.deepEqual(reads,[]);
   assert.deepEqual(logs,[]);
 }
});
