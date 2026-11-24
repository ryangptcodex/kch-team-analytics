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

test('master staging exports only the three allowed tables as a private file',()=>{
 const {c,logs}=app();
 const headers=['id','name'];
 c.TABLE_SCHEMAS=Object.fromEntries(['PRODUCTS','PRICE_MASTER','DISTRIBUTORS'].map(name=>[name,headers]));
 c.txRead_=(_ctx,names)=> {
  assert.deepEqual(Array.from(names),['PRODUCTS','PRICE_MASTER','DISTRIBUTORS']);
  return Object.fromEntries(names.map(name=>[name,[headers,['item','private-master-value']]]));
 };
 c.txTable_=(_name,values)=>({rows:[{id:values[1][0],name:values[1][1],unrelated:'excluded'}]});
 c.Utilities={formatDate:()=> '20261124-210000',newBlob:content=>content};
 c.TIMEZONE='Asia/Jakarta';
 c.DriveApp={Access:{PRIVATE:'private'},createFile:content=>{
  const payload=JSON.parse(content);
  assert.deepEqual(Object.keys(payload.tables),['PRODUCTS','PRICE_MASTER','DISTRIBUTORS']);
  assert.deepEqual(payload.tables.PRODUCTS,[{id:'item',name:'private-master-value'}]);
  return {getSharingAccess:()=> 'private',getUrl:()=> 'https://drive.google.com/file/d/example'};
 }};
 assert.equal(c.siapkanMasterStagingFirestore().counts.PRICE_MASTER,1);
 assert.doesNotMatch(logs.join(''),/private-master-value/);
 assert.throws(()=>app({pending:true}).c.siapkanMasterStagingFirestore(),/ditahan/);
});

test('Apps Script reads the Production staging manifest and all pages with GET',()=>{
 const {c,logs}=app();
 c.getFirebaseWebConfig_=()=>({projectId:'kch-team-analytics-production'});
 const requests=[];
 c.UrlFetchApp={fetch:(url,options)=>{
  requests.push(url);
  assert.equal(options.method,'get');
  assert.equal(options.headers.Authorization,'Bearer mock');
  const snapshot=url.split('/').at(-1);
  const documents=length=>Array.from({length},()=>({fields:{private:'private-master-value'}}));
  let body={fields:{
   snapshot_id:{stringValue:snapshot},source:{stringValue:'production_master_staging_v1'},row_count:{integerValue:'227'}
  }};
  if(url.includes('/PRODUCTS?')) body={documents:documents(25)};
  if(url.includes('/DISTRIBUTORS?')) body={documents:documents(2)};
  if(url.includes('/PRICE_MASTER?')) body=url.includes('pageToken=') ?
   {documents:documents(100)} : {documents:documents(100),nextPageToken:'next+page'};
  return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(body)};
 }};
 const result=c.periksaAksesAppsScriptFirestore();
 assert.equal(result.status,'APPS_SCRIPT_FIRESTORE_READ_OK');
 assert.equal(result.counts.PRICE_MASTER,200);
 assert.equal(requests.length,5);
 assert.ok(requests.some(url=>url.endsWith('pageToken=next%2Bpage')));
 assert.doesNotMatch(logs.join(''),/private-master-value|Bearer/);
});

test('Firestore read check reports a scope error without logging the API body',()=>{
 const {c,logs}=app();
 c.getFirebaseWebConfig_=()=>({projectId:'kch-team-analytics-production'});
 c.UrlFetchApp={fetch:()=>({
  getResponseCode:()=>403,
  getContentText:()=>JSON.stringify({error:{message:'private',details:[
   {'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:'ACCESS_TOKEN_SCOPE_INSUFFICIENT'}
  ]}})
 })};
 assert.throws(()=>c.periksaAksesAppsScriptFirestore(),/^Error: Firestore HTTP 403 \(ACCESS_TOKEN_SCOPE_INSUFFICIENT\)$/);
 assert.deepEqual(logs,[]);
});
