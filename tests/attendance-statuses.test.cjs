const {test}=require('node:test'),assert=require('node:assert/strict');
const {system}=require('./helpers/transaction-system.cjs');
function fixture(){
 const e=system(),c=e.context;e.actor({role:'ADMIN'});const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),req=[];
 for(const name of ['ATTENDANCE','VISIT_PHOTOS'])c.txAddSheet_(meta,req,name,c.TABLE_SCHEMAS[name],false);c.txBatch_(ctx,req);const files=[];let seq=0;
 c.createUploadedPhotoFile_=()=>{const id='STATUS_IMAGE_'+String(files.length).padStart(24,'0'),file={getId:()=>id,getUrl:()=> 'https://drive.google.com/file/d/'+id+'/view',setTrashed(v){file.trashed=v;}};files.push(file);return file;};c.DriveApp={getFileById:id=>files.find(f=>f.getId()===id)};
 const submit=(status,patch={})=>c.kchApi('MOCK','saveSalesPhotoUpload',[{requestId:'REQ-ATTENDANCE-STATUS-'+String(++seq).padStart(5,'0'),salesId:'S1',date:'2026-10-25',attendanceStatus:status,imageDataUrl:'',notes:'',...patch},'attendance']);
 return {...e,c,files,submit,list:()=>c.kchApi('MOCK','getAttendanceByDate',['2026-10-25']),hk:()=>{c.KCH_REQUEST_USER_={role:'ADMIN'};try{return Object.keys(c.getAttendanceWorkDatesBySales_('2026-10').S1 || {}).length;}finally{c.KCH_REQUEST_USER_=null;}}};
}
test('Admin stores all four explicit statuses without photo or clock; only presence without check-in counts one HK',()=>{
 for(const status of ['IZIN','TIDAK HADIR','SAKIT','HADIR TAPI TIDAK ABSEN']){const e=fixture(),r=e.submit(status);assert.equal(r.success,true,r.message);assert.equal(r.withoutPhoto,true);assert.equal(r.photoRef,'');assert.equal(e.files.length,0);const row=e.rows('ATTENDANCE')[1];assert.equal(row[6],status);assert.equal(row[4],'');assert.equal(row[5],'');assert.equal(row[8],'');assert.equal(e.list().attendance[0].status,status);assert.equal(e.list().attendance[0].countsAsPresent,status==='HADIR TAPI TIDAK ABSEN');assert.equal(e.hk(),status==='HADIR TAPI TIDAK ABSEN'?1:0);assert.equal(e.rows('ACTIVITY_LOGS')[1][3],'SET_ATTENDANCE_STATUS');assert.equal(e.rows('SALES_TRANSACTIONS').length,1);}
});
test('normal attendance retains mandatory photo/clock validation and visit upload cannot use an attendance status to bypass its photo',()=>{
 const e=fixture();assert.equal(e.submit('HADIR').state,'FAILED');assert.equal(e.files.length,0);const visit=e.c.kchApi('MOCK','saveSalesPhotoUpload',[{requestId:'REQ-NO-PHOTO-VISIT-0001',salesId:'S1',date:'2026-10-25',attendanceStatus:'SAKIT',imageDataUrl:''},'visit']);assert.equal(visit.state,'FAILED');assert.equal(e.rows('VISIT_PHOTOS').length,1);assert.equal(e.submit('HADIR',{imageDataUrl:'data:image/jpeg;base64,AQI=',attendanceTime:'08:30'}).success,true);
});
test('invalid status choices and nonadmin status writes fail before a file is created',()=>{
 for(const status of ['ADMIN','BELUM ABSEN','HADIR TELAT',42,null]){const e=fixture();assert.equal(e.submit(status).success,false);assert.equal(e.rows('ATTENDANCE').length,1);assert.equal(e.files.length,0);}
 const e=fixture();e.actor({role:'SALES',salesId:'S1'});assert.equal(e.submit('IZIN').success,false);assert.equal(e.rows('ATTENDANCE').length,1);e.actor({role:'GUEST'});assert.throws(()=>e.submit('SAKIT'),/Tamu hanya boleh/);
});
test('an explicit status replays once and changed status with the same request ID cannot overwrite it',()=>{
 const e=fixture(),id='REQ-STATUS-REPLAY-0001';assert.equal(e.submit('SAKIT',{requestId:id}).success,true);assert.equal(e.submit('SAKIT',{requestId:id}).replayed,true);assert.equal(e.submit('IZIN',{requestId:id}).state,'CONFLICT');assert.equal(e.rows('ATTENDANCE').length,2);assert.equal(e.files.length,0);
});
test('latest status controls the daily card and HK while prior rows/photos and audit are retained',()=>{
 const e=fixture();e.submit('HADIR',{attendanceTime:'08:30',imageDataUrl:'data:image/jpeg;base64,AQI='});assert.equal(e.hk(),1);e.submit('SAKIT');assert.equal(e.list().attendance.length,1);assert.equal(e.list().attendance[0].status,'SAKIT');assert.equal(e.hk(),0);assert.equal(e.files.length,1);assert.notEqual(e.files[0].trashed,true);
 e.submit('HADIR TAPI TIDAK ABSEN');assert.equal(e.hk(),1);e.submit('HADIR',{attendanceTime:'09:30',imageDataUrl:'data:image/jpeg;base64,AQI='});assert.equal(e.list().attendance.length,1);assert.equal(e.list().attendance[0].status,'HADIR TELAT');assert.equal(e.hk(),1);assert.equal(e.rows('ATTENDANCE').length,5);assert.equal(e.files.length,2);assert.equal(JSON.parse(e.rows('ACTIVITY_LOGS')[2][5]).previousAttendanceStatus,'HADIR');
});
test('lost or delayed status commit recovers through the shared receipt without duplicate records',()=>{
 for(const fault of ['lostAfterCommit','unknownBefore']){const e=fixture(),id='REQ-STATUS-FAULT-0001';e.options.financialFault=fault;const r=e.submit('HADIR TAPI TIDAK ABSEN',{requestId:id});assert.equal(r.state,fault==='unknownBefore'?'PENDING':'COMMITTED');if(fault==='unknownBefore'){assert.equal(e.submit('IZIN').state,'PENDING');e.settle();}assert.equal(e.c.kchApi('MOCK','getSalesTransactionRequestStatus',[id]).state,'COMMITTED');assert.equal(e.rows('ATTENDANCE').length,2);assert.equal(e.hk(),1);assert.equal(e.files.length,0);}
});
test('definite batch rejection leaves attendance, HK and audit unchanged and marks the status request failed',()=>{
 const e=fixture();e.options.financialFault='reject400';assert.equal(e.submit('IZIN').state,'FAILED');assert.equal(e.rows('ATTENDANCE').length,1);assert.equal(e.rows('ACTIVITY_LOGS').length,1);assert.equal(e.hk(),0);
});
test('historical status needs no invented arrival time, but dates in a closed period are still rejected',()=>{
 const e=fixture();assert.equal(e.submit('IZIN',{date:'2026-10-24'}).success,true);e.c.PropertiesService.getScriptProperties().setProperty('KCH_MONTHLY_ARCHIVE_ENABLED','TRUE');assert.equal(e.submit('SAKIT',{date:'2026-09-30'}).state,'FAILED');
});
test('archived status events retain the latest daily outcome and HK without removing older photo records',()=>{
 const e=fixture();e.submit('HADIR',{attendanceTime:'08:30',imageDataUrl:'data:image/jpeg;base64,AQI='});e.submit('SAKIT');const rows=e.rows('ATTENDANCE'),headers=rows[0],events=rows.slice(1);const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=e.c.txMetadata_(ctx),req=[];e.c.txAddSheet_(meta,req,'_KCH_ARCHIVE_ROWS',e.c.KCH_ARCHIVE_SCHEMAS_._KCH_ARCHIVE_ROWS,true);req.push(e.c.txAppend_(meta._KCH_ARCHIVE_ROWS.sheetId,events.map(row=>['2026-10','ATTENDANCE',JSON.stringify(headers),JSON.stringify(row)])));e.c.txBatch_(ctx,req);e.rows('ATTENDANCE').splice(1);e.c.PropertiesService.getScriptProperties().setProperty('KCH_MONTHLY_ARCHIVE_ENABLED','TRUE');assert.equal(e.list().attendance.length,1);assert.equal(e.list().attendance[0].status,'SAKIT');assert.equal(e.hk(),0);assert.equal(e.rows('_KCH_ARCHIVE_ROWS').length,3);assert.equal(e.files.length,1);assert.notEqual(e.files[0].trashed,true);
});
