const {test}=require('node:test'),assert=require('node:assert/strict');
const {system}=require('./helpers/transaction-system.cjs');
function wib(c){c.Utilities.formatDate=(date,zone,format)=>{assert.equal(zone,'Asia/Jakarta');if(format==='yyyy-MM-dd')return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);if(format==='HH:mm:ss')return new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date);throw Error('Unexpected format '+format);};}
function fixture(){const e=system(),c=e.context;e.actor({role:'ADMIN'});const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),req=[];for(const name of ['ATTENDANCE','VISIT_PHOTOS'])c.txAddSheet_(meta,req,name,c.TABLE_SCHEMAS[name],false);c.txBatch_(ctx,req);let files=0;c.createUploadedPhotoFile_=()=>{files++;return {getId:()=> 'CLOCK_PROOF_0000000000000000000',getUrl:()=> 'https://drive.google.com/file/d/CLOCK_PROOF_0000000000000000000/view'};};
 const payload={requestId:'REQ-ATTENDANCE-CLOCK-0001',salesId:'S1',date:'2026-10-25',notes:'Actual attendance',imageDataUrl:'data:image/jpeg;base64,AQI='};return {...e,c,files:()=>files,upload:(patch={},kind='attendance')=>c.kchApi('MOCK','saveSalesPhotoUpload',[{...payload,...patch},kind])};}
test('office rule uses WIB: 08:00 start, tolerance through exactly 09:00:00 and late after it',()=>{
 const c=system().context;wib(c);
 for(const [utc,time,status] of [['2026-11-01T23:00:00Z','06:00:00','Hadir Tepat Waktu'],['2026-11-02T01:00:00Z','08:00:00','Hadir Tepat Waktu'],['2026-11-02T01:59:59Z','08:59:59','Hadir Tepat Waktu'],['2026-11-02T02:00:00Z','09:00:00','Hadir Tepat Waktu'],['2026-11-02T02:00:01Z','09:00:01','Hadir Terlambat'],['2026-11-02T06:00:00Z','13:00:00','Hadir Terlambat']]){const r=c.attendanceClock_('2026-11-02',{}, {role:'ADMIN'},new Date(utc));assert.equal(r.time,time);assert.equal(r.status,status);assert.equal(r.timeSource,'SERVER');assert.equal(r.workStart,'08:00:00');assert.equal(r.toleranceUntil,'09:00:00');}
});
test('Admin can record actual attendance time instead of upload time, including past dates, without pretending a future check-in',()=>{
 const c=system().context;wib(c);const now=new Date('2026-11-02T07:00:00Z');
 assert.equal(c.attendanceClock_('2026-11-02',{attendanceTime:'08:30'},{role:'ADMIN'},now).status,'Hadir Tepat Waktu');assert.equal(c.attendanceClock_('2026-11-01',{attendanceTime:'09:01'},{role:'ADMIN'},now).status,'Hadir Terlambat');assert.equal(c.attendanceClock_('2026-11-01',{attendanceTime:'08:00'},{role:'ADMIN'},now).timeSource,'ADMIN_INPUT');
 assert.throws(()=>c.attendanceClock_('2026-11-01',{}, {role:'ADMIN'},now),/tanggal sebelumnya/);assert.throws(()=>c.attendanceClock_('2026-11-02',{attendanceTime:'14:01'}, {role:'ADMIN'},now),/waktu server/);
});
test('clock validates manual values and denies manual/backdated clock input from non-admin accounts',()=>{
 const c=system().context;wib(c);const now=new Date('2026-11-02T07:00:00Z');for(const input of ['24:00','08:60','08:00:60','8:00','08.00','08:00 extra',800,null])assert.throws(()=>c.attendanceClock_('2026-11-02',{attendanceTime:input},{role:'ADMIN'},now),/Jam absensi tidak valid/);
 assert.throws(()=>c.attendanceClock_('2026-11-02',{attendanceTime:'08:00'},{role:'SALES'},now),/Hanya Admin/);assert.throws(()=>c.attendanceClock_('2026-11-01',{}, {role:'SALES'},now),/Hanya Admin/);assert.equal(c.attendanceClock_('2026-11-02',{}, {role:'SALES'},now).status,'Hadir Terlambat');
});
test('new attendance row and audit use the verified time, while replay cannot rescore or replace it',()=>{
 const e=fixture(),r=e.upload({attendanceTime:'08:45'});assert.equal(r.success,true,r.message);const row=e.rows('ATTENDANCE')[1];assert.equal(row[4],'08:45:00');assert.equal(row[6],'Hadir Tepat Waktu');const audit=JSON.parse(e.rows('ACTIVITY_LOGS')[1][5]);assert.equal(audit.attendanceClock.timeSource,'ADMIN_INPUT');assert.equal(audit.attendanceClock.workStart,'08:00:00');
 assert.equal(e.upload({attendanceTime:'08:45'}).replayed,true);assert.equal(e.files(),1);assert.equal(e.upload({attendanceTime:'09:30'}).state,'CONFLICT');assert.equal(e.rows('ATTENDANCE').length,2);assert.equal(e.rows('ATTENDANCE')[1][6],'Hadir Tepat Waktu');
});
test('missing historical time and future current-day times fail before file creation, while visits retain the existing clock flow',()=>{
 for(const patch of [{date:'2026-10-24'},{attendanceTime:'13:00'}]){const e=fixture();assert.equal(e.upload(patch).state,'FAILED');assert.equal(e.files(),0);assert.equal(e.rows('ATTENDANCE').length,1);}
 const e=fixture(),r=e.upload({},'visit');assert.equal(r.success,true,r.message);assert.equal(e.rows('VISIT_PHOTOS')[1][9],'ACTIVE');
});
test('blank manual time preserves the pre-update PHOTO fingerprint for existing replay receipts',()=>{
 const e=fixture(),payload={salesId:'S1',date:'2026-10-25',notes:'Actual attendance',imageDataUrl:'data:image/jpeg;base64,AQI='};e.upload();const rows=e.rows('_KCH_TX_REQUESTS'),fingerprint=rows[1][rows[0].indexOf('fingerprint')],old=e.c.txHash_(JSON.stringify(['PHOTO','attendance',e.c.txFingerprint_(payload),e.c.txHash_(payload.imageDataUrl)]));assert.equal(fingerprint,old);assert.equal(e.upload({attendanceTime:''}).replayed,true);assert.equal(e.rows('ATTENDANCE')[1][6],'Hadir Terlambat');
});
