const {system}=require('./transaction-system.cjs'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const clone=x=>JSON.parse(JSON.stringify(x));
function auditSystem(options={}){
 const e=system(options),c=e.context;e.actor({role:'ADMIN'});
 for(const file of ['score.gs','canvasser-incentives.gs','incentives.gs','incentive-sheets.gs','sheet-updates.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../..',file),'utf8'),c,{filename:file});
 c.KCH_TEST_SPREADSHEET_ID_='test-book';c.Session.getEffectiveUser=c.Session.getActiveUser;
 let now='2026-10-25 12:00:00';c.Utilities.formatDate=(d,z,f)=>f==='yyyyMMdd'?now.slice(0,10).replaceAll('-',''):f==='yyyy-MM-dd'?now.slice(0,10):f==='yyyy-MM'?now.slice(0,7):f==='HH:mm:ss'?now.slice(11):now;c.scoreToday_=()=>now.slice(0,10);
 for(const [id,[name]]of Object.entries(c.KCH_SCORE_PRODUCT_RULES_))e.rows('PRODUCTS').push([id,name,'ACTIVE']);
 const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},baseBook=c.getKchSpreadsheet_();baseBook.getName=()=> 'Audit Only';baseBook.getUrl=()=> 'https://docs.google.com/spreadsheets/d/test-book';baseBook.getSpreadsheetLocale=()=> 'id_ID';c.getKchSpreadsheet_=()=>baseBook;
 const meta=c.txMetadata_(ctx),plan=c.kchSheetUpdatePlan_(baseBook,meta,c.kchSheetSchemas_());c.txBatch_(ctx,plan.requests);
 function capturePeriod(){const meta=c.txMetadata_(ctx),raw=c.txRead_(ctx,['SALES','PRODUCTS','PRICE_MASTER','HOLIDAYS',c.KCH_PERIOD_MASTERS_]);c.txBatch_(ctx,c.periodSnapshotPlan_(meta,raw,now.slice(0,7),{email:'mhmdryyan7@gmail.com'},'TEST_ADMIN_CAPTURE',true));c.PropertiesService.getScriptProperties().setProperty('KCH_PERIOD_SNAPSHOTS_ACTIVE','TRUE');}
 const owner='mhmdryyan7@gmail.com',copies=new Map(),files=new Map();let serial=0;
 const response=body=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(body)});
 const originalFetch=c.UrlFetchApp.fetch;
 function sourceRows(id,name){return id==='test-book'?e.rows(name):copies.get(id)?.tables[name];}
 function propertyList(id){if(id==='test-book'){const r=originalFetch('https://sheets.googleapis.com/v4/spreadsheets/test-book?fields=spreadsheetId,sheets(properties)',{headers:{Authorization:'Bearer TEST_ONLY_OAUTH'},method:'get'});return JSON.parse(r.getContentText()).sheets;}return copies.get(id).sheets;}
 function typed(v,name,y,x){if(options.formulaCells?.includes(name+':'+y+':'+x))return {formulaValue:v};return v===undefined||v===null?{}:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:String(v)};}
 c.UrlFetchApp.fetch=(url,request)=>{const u=new URL(url),id=decodeURIComponent(u.pathname.match(/\/spreadsheets\/([^/:]+)/)?.[1]||'test-book');
  if(u.searchParams.get('includeGridData')==='true'){
   e.calls.push({url,body:null});const names=u.searchParams.getAll('ranges').map(r=>r.slice(1,-1).replace(/''/g,"'"));return response({spreadsheetId:id,sheets:names.map(name=>({properties:{title:name},data:[{startRow:0,startColumn:0,rowData:(sourceRows(id,name)||[]).map((r,y)=>({values:r.map((v,x)=>({userEnteredValue:typed(v,name,y,x)}))}))}]}))});
  }
  if(id!=='test-book'){
   e.calls.push({url,body:null});if(!copies.has(id))throw Error('Unknown audit-only copy');if(u.pathname.endsWith('/values:batchGet')){const names=u.searchParams.getAll('ranges').map(r=>r.slice(1,-1).replace(/''/g,"'"));return response({spreadsheetId:id,valueRanges:names.map(n=>({range:n,values:clone(sourceRows(id,n)||[])}))});}return response({spreadsheetId:id,sheets:clone(copies.get(id).sheets)});
  }
  return originalFetch(url,request);
 };
 function file(id){if(!files.has(id))files.set(id,{access:'PRIVATE',owner,editors:[],viewers:[],getSharingAccess(){return this.access;},getOwner(){return {getEmail:()=>this.owner};},getEditors(){return this.editors.map(email=>({getEmail:()=>email}));},getViewers(){return this.viewers.map(email=>({getEmail:()=>email}));},setSharing(access){this.access=access;},removeEditor(email){this.editors=this.editors.filter(x=>x!==email);},removeViewer(email){this.viewers=this.viewers.filter(x=>x!==email);},getLastUpdated:()=>new Date('2026-10-25T12:00:00Z')});return files.get(id);}
 function copyBook(sourceId){const id='AUDIT_COPY_'+(++serial),sheets=clone(propertyList(sourceId)),tables={};sheets.forEach(s=>{tables[s.properties.title]=clone(sourceRows(sourceId,s.properties.title)||[]);});copies.set(id,{tables,sheets});file(id);return nativeBook(id);}
 function nativeBook(id){return {getId:()=>id,getUrl:()=> 'https://docs.google.com/spreadsheets/d/'+id,copy:()=>copyBook(id)};}
 baseBook.copy=()=>copyBook('test-book');c.SpreadsheetApp.openById=id=>id==='test-book'?baseBook:nativeBook(id);c.DriveApp={Access:{PRIVATE:'PRIVATE'},Permission:{VIEW:'VIEW'},getFileById:file};
 const lock=c.LockService.getScriptLock;c.LockService.getScriptLock=()=>({...lock(),tryLock:()=>!options.busy});
 return {...e,c,ctx,ss:baseBook,copies,files,file,capturePeriod,clock:value=>{now=value;c.KCH_PERIOD_CACHE_=null;},call:(m,...args)=>c.kchApi('MOCK',m,args),objects:name=>c.txTable_(name,e.rows(name)||[],[],false).rows,cell(name,id,value,key='sales_id'){const headers=e.rows(name)[0],row=e.rows(name).find((r,i)=>i&&r[headers.indexOf(key)]===id);row[headers.indexOf(value[0])]=value[1];}};
}
module.exports={auditSystem};
