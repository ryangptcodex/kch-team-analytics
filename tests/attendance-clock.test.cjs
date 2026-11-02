const {test}=require('node:test'),assert=require('node:assert/strict');
const {system}=require('./helpers/transaction-system.cjs');
function wib(c){c.Utilities.formatDate=(date,zone,format)=>{assert.equal(zone,'Asia/Jakarta');if(format==='yyyy-MM-dd')return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);if(format==='HH:mm:ss')return new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date);throw Error('Unexpected format '+format);};}
function fixture(){const e=system(),c=e.context;e.actor({role:'ADMIN'});const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),req=[];for(const name of ['ATTENDANCE','VISIT_PHOTOS'])c.txAddSheet_(meta,req,name,c.TABLE_SCHEMAS[name],false);c.txBatch_(ctx,req);let files=0;c.createUploadedPhotoFile_=()=>{files++;return {getId:()=> 'CLOCK_PROOF_0000000000000000000',getUrl:()=> 'https://drive.google.com/file/d/CLOCK_PROOF_0000000000000000000/view'};};
 const payload={requestId:'REQ-ATTENDANCE-CLOCK-0001',salesId:'S1',date:'2026-10-25',notes:'Actual attendance',imageDataUrl:'data:image/jpeg;base64,AQI='};return {...e,c,files:()=>files,upload:(patch={},kind='attendance')=>c.kchApi('MOCK','saveSalesPhotoUpload',[{...payload,...patch},kind])};}
test('three attendance categories use WIB minutes, with late attendance retained after noon',()=>{
 const c=system().context;wib(c);
 for(const [utc,time,status] of [
 ['2026-11-01T23:00:00Z','06:00:00','HADIR TEPAT WAKTU'],
 ['2026-11-02T01:00:00Z','08:00:00','HADIR TEPAT WAKTU'],
 ['2026-11-02T01:00:59Z','08:00:59','HADIR TEPAT WAKTU'],
 ['2026-11-02T01:01:00Z','08:01:00','HADIR'],
 ['2026-11-02T01:59:59Z','08:59:59','HADIR'],
 ['2026-11-02T02:00:00Z','09:00:00','HADIR'],
 ['2026-11-02T02:00:59Z','09:00:59','HADIR'],
 ['2026-11-02T02:01:00Z','09:01:00','HADIR TELAT'],
 ['2026-11-02T05:00:00Z','12:00:00','HADIR TELAT'],
 ['2026-11-02T06:00:00Z','13:00:00','HADIR TELAT']]){const r=c.attendanceClock_('2026-11-02',{}, {role:'ADMIN'},new Date(utc));assert.equal(r.time,time);assert.equal(r.status,status);assert.equal(r.timeSource,'SERVER');assert.equal(r.workStart,'08:00:00');assert.equal(r.toleranceUntil,'09:00:59');assert.equal(r.timePrecision,'MINUTE');}
});
test('Admin can record actual attendance time instead of upload time, including past dates, without pretending a future check-in',()=>{
 const c=system().context;wib(c);const now=new Date('2026-11-02T07:00:00Z');
 assert.equal(c.attendanceClock_('2026-11-02',{attendanceTime:'08:30'},{role:'ADMIN'},now).status,'HADIR');assert.equal(c.attendanceClock_('2026-11-01',{attendanceTime:'09:01'},{role:'ADMIN'},now).status,'HADIR TELAT');assert.equal(c.attendanceClock_('2026-11-01',{attendanceTime:'08:00'},{role:'ADMIN'},now).timeSource,'ADMIN_INPUT');
 assert.throws(()=>c.attendanceClock_('2026-11-01',{}, {role:'ADMIN'},now),/tanggal sebelumnya/);assert.throws(()=>c.attendanceClock_('2026-11-02',{attendanceTime:'14:01'}, {role:'ADMIN'},now),/waktu server/);
});
test('clock validates manual values and denies manual/backdated clock input from non-admin accounts',()=>{
 const c=system().context;wib(c);const now=new Date('2026-11-02T07:00:00Z');for(const input of ['24:00','08:60','08:00:60','8:00','08.00','08:00 extra',800,null])assert.throws(()=>c.attendanceClock_('2026-11-02',{attendanceTime:input},{role:'ADMIN'},now),/Jam absensi tidak valid/);
 assert.throws(()=>c.attendanceClock_('2026-11-02',{attendanceTime:'08:00'},{role:'SALES'},now),/Hanya Admin/);assert.throws(()=>c.attendanceClock_('2026-11-01',{}, {role:'SALES'},now),/Hanya Admin/);assert.equal(c.attendanceClock_('2026-11-02',{}, {role:'SALES'},now).status,'HADIR TELAT');
});
test('new attendance row and audit use the verified time, while replay cannot rescore or replace it',()=>{
 const e=fixture(),r=e.upload({attendanceTime:'08:45'});assert.equal(r.success,true,r.message);const row=e.rows('ATTENDANCE')[1];assert.equal(row[4],'08:45:00');assert.equal(row[6],'HADIR');const audit=JSON.parse(e.rows('ACTIVITY_LOGS')[1][5]);assert.equal(audit.attendanceClock.timeSource,'ADMIN_INPUT');assert.equal(audit.attendanceClock.workStart,'08:00:00');
 assert.equal(e.upload({attendanceTime:'08:45'}).replayed,true);assert.equal(e.files(),1);assert.equal(e.upload({attendanceTime:'09:30'}).state,'CONFLICT');assert.equal(e.rows('ATTENDANCE').length,2);assert.equal(e.rows('ATTENDANCE')[1][6],'HADIR');
});
test('missing historical time and future current-day times fail before file creation, while visits retain the existing clock flow',()=>{
 for(const patch of [{date:'2026-10-24'},{attendanceTime:'13:00'}]){const e=fixture();assert.equal(e.upload(patch).state,'FAILED');assert.equal(e.files(),0);assert.equal(e.rows('ATTENDANCE').length,1);}
 const e=fixture(),r=e.upload({},'visit');assert.equal(r.success,true,r.message);assert.equal(e.rows('VISIT_PHOTOS')[1][9],'ACTIVE');
});
test('blank manual time preserves the pre-update PHOTO fingerprint for existing replay receipts',()=>{
 const e=fixture(),payload={salesId:'S1',date:'2026-10-25',notes:'Actual attendance',imageDataUrl:'data:image/jpeg;base64,AQI='};e.upload();const rows=e.rows('_KCH_TX_REQUESTS'),fingerprint=rows[1][rows[0].indexOf('fingerprint')],old=e.c.txHash_(JSON.stringify(['PHOTO','attendance',e.c.txFingerprint_(payload),e.c.txHash_(payload.imageDataUrl)]));assert.equal(fingerprint,old);assert.equal(e.upload({attendanceTime:''}).replayed,true);assert.equal(e.rows('ATTENDANCE')[1][6],'HADIR TELAT');
});

test('existing presence records are classified by saved clock while sick/leave/absent labels remain intact',()=>{
 const c=system().context;
 for(const [old,time,expected] of [['Hadir Tepat Waktu','07:46:22','HADIR TEPAT WAKTU'],['Hadir Tepat Waktu','08:13:15','HADIR'],['Hadir Terlambat','09:15:00','HADIR TELAT'],['HADIR','12:01:00','HADIR TELAT'],['','08:30','HADIR'],['Hadir Tepat Waktu','','HADIR'],['Izin','08:30','Izin'],['Sakit','07:00','Sakit'],['Tidak Hadir','09:30','Tidak Hadir']])assert.equal(c.attendanceCategory_(old,time),expected);
});
test('attendance list and dashboard immediately relabel old morning records without rewriting raw rows',()=>{
 const e=fixture();e.upload({attendanceTime:'08:13'});const rows=e.rows('ATTENDANCE');rows[1][6]='Hadir Tepat Waktu';const before=JSON.stringify(rows);
 assert.equal(e.c.kchApi('MOCK','getAttendanceByDate',['2026-10-25']).attendance[0].status,'HADIR');assert.equal(e.c.kchApi('MOCK','getDashboardMetrics',[{attendanceDate:'2026-10-25'}]).todayAttendance[0].status,'HADIR');assert.equal(JSON.stringify(rows),before);
});
