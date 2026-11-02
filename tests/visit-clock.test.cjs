const {test}=require('node:test'),assert=require('node:assert/strict');
const {system}=require('./helpers/transaction-system.cjs');
function fixture(){
 const e=system(),c=e.context;e.actor({role:'ADMIN'});const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),req=[];
 for(const name of ['ATTENDANCE','VISIT_PHOTOS'])c.txAddSheet_(meta,req,name,c.TABLE_SCHEMAS[name],false);c.txBatch_(ctx,req);let files=0;
 c.createUploadedPhotoFile_=()=>{files++;return {getId:()=> 'VISIT_CLOCK_IMAGE_00000000000000',getUrl:()=> 'https://drive.google.com/file/d/VISIT_CLOCK_IMAGE_00000000000000/view'};};
 const format=c.Utilities.formatDate;c.Utilities.formatDate=(date,zone,pattern)=>pattern==='HH:mm:ss'?'21:30:00':pattern==='yyyy-MM-dd HH:mm:ss'?'2026-10-25 21:30:00':format(date,zone,pattern);
 const payload={requestId:'REQ-VISIT-CLOCK-000001',salesId:'S1',date:'2026-10-25',notes:'Actual visit time',imageDataUrl:'data:image/jpeg;base64,AQI='};
 return {...e,c,payload,files:()=>files,upload:(patch={})=>c.kchApi('MOCK','saveSalesPhotoUpload',[{...payload,...patch},'visit'])};
}
test('manual visit clock is persisted and displayed instead of upload time, with its own audit source and no attendance change',()=>{
 const e=fixture(),r=e.upload({visitTime:'15:40'});assert.equal(r.success,true,r.message);const row=e.rows('VISIT_PHOTOS')[1];assert.equal(row[2],'15:40:00');assert.equal(row[9],'ACTIVE');assert.equal(e.rows('ATTENDANCE').length,1);assert.equal(e.rows('SALES_TRANSACTIONS').length,1);
 const audit=JSON.parse(e.rows('ACTIVITY_LOGS')[1][5]);assert.equal(audit.visitClock.timeSource,'ADMIN_INPUT');assert.equal(audit.visitClock.time,'15:40:00');assert.equal(audit.attendanceClock,null);assert.match(e.rows('ACTIVITY_LOGS')[1][1],/21:30:00/);assert.equal(e.c.kchApi('MOCK','getVisitPhotosByDate',['2026-10-25']).visitPhotos[0].time,'15:40');
});
test('manual visit times allow seconds and dates before today, while an omitted current-day clock uses the server',()=>{
 const e=fixture();assert.equal(e.upload().success,true);assert.equal(e.rows('VISIT_PHOTOS')[1][2],'21:30:00');
 const old=fixture();assert.equal(old.upload({date:'2026-10-24',visitTime:'15:40:22'}).success,true);assert.equal(old.rows('VISIT_PHOTOS')[1][2],'15:40:22');
});
test('invalid, missing past-date and future current-day visit times reject before Drive upload',()=>{
 for(const patch of [{visitTime:'24:00'},{visitTime:'15:60'},{visitTime:'15:40:60'},{visitTime:'15.40'},{visitTime:1540},{visitTime:null},{visitTime:'22:00'},{date:'2026-10-24'}]){const e=fixture();assert.equal(e.upload(patch).state,'FAILED');assert.equal(e.files(),0);assert.equal(e.rows('VISIT_PHOTOS').length,1);}
});
test('only Admin can input an actual visit clock; Guest writes and nonadmin manual/backdated submissions remain blocked',()=>{
 const e=fixture();e.actor({role:'SALES',salesId:'S1'});assert.equal(e.upload({visitTime:'15:40'}).state,'FAILED');assert.equal(e.files(),0);e.actor({role:'GUEST'});assert.throws(()=>e.upload({visitTime:'15:40'}),/Tamu hanya boleh/);
});
test('same visit time replays once, changed time conflicts, and a legacy no-clock request keeps its original fingerprint',()=>{
 const e=fixture();assert.equal(e.upload({visitTime:'15:40'}).success,true);assert.equal(e.upload({visitTime:'15:40'}).replayed,true);assert.equal(e.upload({visitTime:'16:00'}).state,'CONFLICT');assert.equal(e.files(),1);assert.equal(e.rows('VISIT_PHOTOS').length,2);assert.equal(e.rows('VISIT_PHOTOS')[1][2],'15:40:00');
 const old=fixture();old.upload();const rows=old.rows('_KCH_TX_REQUESTS'),actual=rows[1][rows[0].indexOf('fingerprint')],expected=old.c.txHash_(JSON.stringify(['PHOTO','visit',old.c.txFingerprint_(old.payload),old.c.txHash_(old.payload.imageDataUrl)]));assert.equal(actual,expected);assert.equal(old.upload({visitTime:''}).replayed,true);
});
test('visit clock compares against the current Jakarta day, independently of UTC midnight',()=>{
 const c=system().context;c.Utilities.formatDate=(date,zone,pattern)=>new Intl.DateTimeFormat(pattern==='yyyy-MM-dd'?'en-CA':'en-GB',pattern==='yyyy-MM-dd'?{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}:{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date);const now=new Date('2026-11-01T17:30:00Z');
 assert.equal(c.visitClock_('2026-11-02',{}, {role:'ADMIN'},now).time,'00:30:00');assert.throws(()=>c.visitClock_('2026-11-02',{visitTime:'15:40'},{role:'ADMIN'},now),/waktu server/);assert.equal(c.visitClock_('2026-11-01',{visitTime:'15:40'},{role:'ADMIN'},now).time,'15:40:00');
});
