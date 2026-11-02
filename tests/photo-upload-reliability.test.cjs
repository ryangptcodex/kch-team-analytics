const {test}=require('node:test');
const assert=require('node:assert/strict');
const {system}=require('./helpers/transaction-system.cjs');
function fixture(){
 const e=system(),c=e.context;e.actor({role:'ADMIN'});
 const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),req=[];
 for(const name of ['ATTENDANCE','VISIT_PHOTOS'])c.txAddSheet_(meta,req,name,c.TABLE_SCHEMAS[name],false);c.txBatch_(ctx,req);
 const files=[];c.createUploadedPhotoFile_=()=>{const f={trashed:false,getId:()=> 'PHOTO-FILE-'+files.length,getUrl:()=> 'https://drive.google.com/file/d/PROOF/view',setTrashed(v){f.trashed=v;}};files.push(f);return f;};
 c.DriveApp={getFileById:id=>files.find(f=>f.getId()===id)};
 const payload={requestId:'REQ-PHOTO-RELIABILITY-0001',salesId:'S1',date:'2026-10-25',notes:'Attendance evidence',imageDataUrl:'data:image/jpeg;base64,AQI='};
 return {...e,c,files,payload,upload:(type='attendance',patch={})=>c.kchApi('MOCK','saveSalesPhotoUpload',[{...payload,...patch},type]),status:()=>c.kchApi('MOCK','getSalesTransactionRequestStatus',[payload.requestId]),count:name=>e.rows(name).length-1};
}
test('attendance and visit evidence atomically commit with one receipt and audit; repeated calls never create another file or row',()=>{
 for(const type of ['attendance','visit']){const e=fixture(),before=JSON.stringify(e.rows('INVENTORY')),r=e.upload(type);assert.equal(r.success,true,r.message);assert.equal(r.operation,'PHOTO');assert.equal(e.upload(type).replayed,true);assert.equal(e.files.length,1);assert.equal(e.count(type==='attendance'?'ATTENDANCE':'VISIT_PHOTOS'),1);assert.equal(e.count('ACTIVITY_LOGS'),1);assert.equal(e.count('SALES_TRANSACTIONS'),0);assert.equal(JSON.stringify(e.rows('INVENTORY')),before);assert.equal(e.status().transactionId,r.transactionId);}
});
test('lost commit response resolves through receipt and keeps referenced photo intact',()=>{
 const e=fixture();e.options.financialFault='lostAfterCommit';const r=e.upload();assert.equal(r.success,true);assert.equal(r.replayed,true);assert.equal(e.count('ATTENDANCE'),1);assert.equal(e.files[0].trashed,false);assert.equal(e.upload().success,true);assert.equal(e.files.length,1);
});
test('unknown or unreadable commit results retain proof and block repeated writes until the original batch settles',()=>{
 for(const fault of ['unknownBefore','lostAndReadFail']){const e=fixture();e.options.financialFault=fault;const r=e.upload();assert.equal(r.state,'PENDING');assert.equal(e.files.length,1);assert.equal(e.files[0].trashed,false);assert.equal(e.upload().state,fault==='unknownBefore'?'PENDING':'COMMITTED');assert.equal(e.files.length,1);if(fault==='unknownBefore'){assert.equal(e.count('ATTENDANCE'),0);assert.equal(e.save().state,'PENDING');e.settle();}assert.equal(e.status().state,'COMMITTED');assert.equal(e.count('ATTENDANCE'),1);assert.equal(e.files[0].trashed,false);}
});
test('definite write rejection creates no row and only then discards unused evidence; retry of the same ID remains rejected',()=>{
 const e=fixture();e.options.financialFault='reject400';assert.equal(e.upload().state,'FAILED');assert.equal(e.count('ATTENDANCE'),0);assert.equal(e.files[0].trashed,true);e.options.financialFault=null;assert.equal(e.upload().state,'FAILED');assert.equal(e.files.length,1);
});
test('native append/flush failures no longer affect the photo and its row because upload uses an atomic API batch',()=>{
 const e=fixture();e.c.SpreadsheetApp.flush=()=>{throw Error('late flush failure');};const r=e.upload();assert.equal(r.success,true);assert.equal(e.count('ATTENDANCE'),1);assert.equal(e.files[0].trashed,false);
});
test('same request cannot be reused for a different image, photo type, date or notes',()=>{
 const e=fixture();e.upload();for(const [type,patch] of [['attendance',{imageDataUrl:'data:image/jpeg;base64,AwQ='}],['visit',{}],['attendance',{date:'2026-10-24'}],['attendance',{notes:'Different'}]])assert.equal(e.upload(type,patch).code,'REQUEST_CONFLICT');assert.equal(e.files.length,1);assert.equal(e.count('ATTENDANCE'),1);assert.equal(e.count('VISIT_PHOTOS'),0);
});
test('malformed sheet, inaccessible master and Drive creation failure do not append attendance',()=>{
 for(const mode of ['headers','master','drive']){const e=fixture();if(mode==='headers')e.rows('ATTENDANCE')[0][3]='wrong_date';if(mode==='master')e.rows('SALES')[1][3]='INACTIVE';if(mode==='drive')e.c.createUploadedPhotoFile_=()=>{throw Error('Drive unavailable');};if(mode==='master')assert.throws(()=>e.upload(),/Profil sales tidak aktif/);else assert.equal(e.upload().state,'FAILED');assert.equal(e.count('ATTENDANCE'),0);assert.equal(e.files.length,0);}
});
