const {test}=require('node:test');
const assert=require('node:assert/strict');
const {system}=require('./helpers/transaction-system.cjs');
function fixture(){
 const e=system(),c=e.context;e.actor({role:'ADMIN'});
 const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),requests=[];
 for(const name of ['ATTENDANCE','VISIT_PHOTOS'])c.txAddSheet_(meta,requests,name,c.TABLE_SCHEMAS[name],false);
 c.txBatch_(ctx,requests);let files=0;
 c.createUploadedPhotoFile_=()=>{files++;return {getId:()=> 'DATE_TEST_IMAGE',getUrl:()=> 'https://drive.google.com/file/d/DATE_TEST_IMAGE/view',setTrashed(){}};};
 return {...e,c,files:()=>files,upload:(date,type)=>c.kchApi('MOCK','saveSalesPhotoUpload',[{requestId:'REQ-DATE-REGRESSION-0001',salesId:'S1',date,notes:'Date regression',imageDataUrl:'data:image/jpeg;base64,AQI='},type])};
}
test('invalid calendar dates and malformed inputs reject attendance and visits before uploading or appending',()=>{
 for(const type of ['attendance','visit'])for(const date of ['2026-11-31','2026-02-29','2024-02-30','2026-04-31','2026-00-10','2026-13-01','2026-10-00','2026-10-32','0000-01-01','25/10/2026','2026-10-25T12:00:00Z','2026-10-25 garbage','2026-1-2',null,undefined,20261025,'']){
  const e=fixture(),r=e.upload(date,type);assert.equal(r.success,false,`${type} ${date}`);assert.match(r.message,/Tanggal tidak valid/);assert.equal(e.files(),0);assert.equal(e.rows('ATTENDANCE').length,1);assert.equal(e.rows('VISIT_PHOTOS').length,1);
 }
});
test('future dates, including tomorrow and a leap date, cannot create attendance or visit evidence',()=>{
 for(const type of ['attendance','visit'])for(const date of ['2026-10-26','2026-11-01','2028-02-29','2030-01-01']){
  const e=fixture(),r=e.upload(date,type);assert.equal(r.success,false);assert.match(r.message,/hari ini \(WIB\)/);assert.equal(e.files(),0);
 }
});
test('valid today, earlier dates and leap day preserve the selected calendar date',()=>{
 for(const type of ['attendance','visit'])for(const date of ['2026-10-25','2026-10-24','2024-02-29']){
  const e=fixture(),r=e.upload(date,type);assert.equal(r.success,true,r.message);assert.equal(r.date,date);assert.equal(e.files(),1);const stored=e.rows(type==='attendance'?'ATTENDANCE':'VISIT_PHOTOS')[1][type==='attendance'?3:1];assert.equal(stored,date);
 }
});
test('date limit changes at midnight Jakarta rather than midnight UTC',()=>{
 const e=fixture();e.c.Utilities.formatDate=(date,zone,format)=>{assert.equal(zone,'Asia/Jakarta');assert.equal(format,'yyyy-MM-dd');return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);};
 const before=new Date('2026-11-01T16:59:59Z'),after=new Date('2026-11-01T17:00:00Z');
 assert.throws(()=>e.c.validatePhotoUploadDate_('2026-11-02',before),/hari ini/);assert.equal(e.c.validatePhotoUploadDate_('2026-11-02',after),'2026-11-02');assert.throws(()=>e.c.validatePhotoUploadDate_('2026-11-03',after),/hari ini/);
});
test('closed-period protection still rejects valid past attendance and visits before creating a file',()=>{
 for(const type of ['attendance','visit']){const e=fixture();e.c.PropertiesService.getScriptProperties().setProperty('KCH_MONTHLY_ARCHIVE_ENABLED','TRUE');const r=e.upload('2026-09-30',type);assert.equal(r.success,false);assert.match(r.message,/Periode sudah ditutup/);assert.equal(e.files(),0);}
});
