const {test}=require('node:test'),assert=require('node:assert/strict');
const {system}=require('./helpers/transaction-system.cjs');
const ADMIN='mhmdryyan7@gmail.com';
const iter=values=>{let i=0;return {hasNext:()=>i<values.length,next:()=>values[i++]};};
function fixture(){
 const e=system(),c=e.context;e.actor({role:'ADMIN'});
 const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),req=[];
 for(const name of ['ATTENDANCE','VISIT_PHOTOS'])c.txAddSheet_(meta,req,name,c.TABLE_SCHEMAS[name],false);c.txBatch_(ctx,req);
 let created=0,reads=0;const files=new Map(),user=email=>({getEmail:()=>email});
 function folder(id,parents=[]){const f={access:'PRIVATE',owner:ADMIN,editors:[],viewers:[],getId:()=>id,getSharingAccess:()=>f.access,getOwner:()=>f.owner?user(f.owner):null,getEditors:()=>f.editors.map(user),getViewers:()=>f.viewers.map(user),getParents:()=>iter(parents)};return f;}
 const root=folder('root'),photos=folder('photos',[root]);
 function file(id,blob){const f={access:'PRIVATE',owner:ADMIN,editors:[],viewers:[],blob,parents:[photos],changes:[],getId:()=>id,getUrl:()=> 'https://drive.google.com/file/d/'+id+'/view',getBlob:()=>f.blob,getMimeType:()=>f.blob.getContentType(),getOwner:()=>f.owner?user(f.owner):null,getParents:()=>iter(f.parents),getEditors:()=>f.editors.map(user),getViewers:()=>f.viewers.map(user),removeEditor(u){f.editors=f.editors.filter(email=>email!==u.getEmail());},removeViewer(u){f.viewers=f.viewers.filter(email=>email!==u.getEmail());},setSharing(access,permission){f.changes.push([access,permission]);f.access=access;},getSharingAccess:()=>f.access,setTrashed(){f.trashed=true;}};files.set(id,f);return f;}
 photos.createFile=blob=>file('PRIVATE_IMAGE_'+String(++created).padStart(20,'0'),blob);
 c.getPhotoUploadFolder_=()=>photos;c.DriveApp={Access:{PRIVATE:'PRIVATE',ANYONE_WITH_LINK:'ANYONE_WITH_LINK'},Permission:{VIEW:'VIEW'},getFileById(id){reads++;if(!files.has(id))throw Error('File unavailable');return files.get(id);}};
 c.Utilities.base64Decode=v=>Array.from(Buffer.from(v,'base64'));c.Utilities.base64Encode=v=>Buffer.from(v).toString('base64');c.Utilities.newBlob=(bytes,mime)=>({getBytes:()=>bytes,getContentType:()=>mime});
 c.getKchSpreadsheetId_=()=> 'test-book';c.SpreadsheetApp.getActiveSpreadsheet=()=>c.getKchSpreadsheet_();
 const upload=(kind='attendance',patch={})=>c.kchApi('MOCK','saveSalesPhotoUpload',[{requestId:'REQ-PRIVATE-PHOTO-0001',salesId:'S1',date:'2026-10-25',notes:'Private evidence',imageDataUrl:'data:image/jpeg;base64,AQI=',...patch},kind]);
 return {...e,c,root,photos,files,folder,file,upload,created:()=>created,reads:()=>reads,evidence:(kind,ref)=>c.kchApi('MOCK','getSalesPhotoEvidence',[kind,ref])};
}
test('new evidence uses PRIVATE files and row references; authenticated Admin and Guest can view without a public URL',()=>{
 for(const kind of ['attendance','visit']){const e=fixture(),saved=e.upload(kind);assert.equal(saved.success,true,saved.message);assert.equal(saved.photoUrl,'');assert.match(saved.photoRef,/^[a-f0-9]{64}$/);const file=[...e.files.values()][0];assert.deepEqual(file.changes,[['PRIVATE','VIEW']]);
  const listed=e.c.kchApi('MOCK',kind==='attendance'?'getAttendanceByDate':'getVisitPhotosByDate',['2026-10-25']);const row=listed[kind==='attendance'?'attendance':'visitPhotos'][0];assert.equal(row.photoUrl,'');assert.equal(row.photoRef,saved.photoRef);
  assert.equal(e.evidence(kind,row.photoRef).dataUrl,'data:image/jpeg;base64,AQI=');e.actor({role:'GUEST'});assert.equal(e.evidence(kind,row.photoRef).success,true);assert.throws(()=>e.c.kchApi('MOCK','saveSalesPhotoUpload',[{},kind]),/Tamu hanya boleh/);
 }
});
test('unregistered hashes, arbitrary file IDs, mismatched kind, external URLs and other sales never read Drive evidence',()=>{
 const e=fixture(),saved=e.upload();const before=e.reads();for(const [kind,ref] of [['attendance','a'.repeat(64)],['attendance',[...e.files.keys()][0]],['visit',saved.photoRef],['unknown',saved.photoRef]])assert.throws(()=>e.evidence(kind,ref),/Bukti foto/);assert.equal(e.reads(),before);
 e.actor({role:'SALES',salesId:'S2'});assert.throws(()=>e.evidence('attendance',saved.photoRef),/Bukti foto/);assert.equal(e.reads(),before);
 assert.equal(e.c.photoEvidenceFileId_('https://evil.test/d/'+[...e.files.keys()][0]),'');assert.equal(e.c.photoEvidenceRef_('attendance',{photo_url:'https://evil.test/image.jpg'}),'');
});
test('private image endpoint rejects inactive visit rows and unsafe or oversized blobs',()=>{
 const e=fixture(),saved=e.upload('visit'),f=[...e.files.values()][0];e.rows('VISIT_PHOTOS')[1][e.rows('VISIT_PHOTOS')[0].indexOf('status')]='INACTIVE';assert.throws(()=>e.evidence('visit',saved.photoRef),/Bukti foto/);e.rows('VISIT_PHOTOS')[1][e.rows('VISIT_PHOTOS')[0].indexOf('status')]='ACTIVE';
 for(const [mime,length] of [['text/html',10],['image/svg+xml',10],['image/png',0],['image/jpeg',5*1024*1024+1]]){f.blob={getContentType:()=>mime,getBytes:()=>Array(length).fill(1)};assert.throws(()=>e.evidence('visit',saved.photoRef),/Format atau ukuran/);}
});
test('public folders, inherited sharing, shared accounts and foreign folder owners stop upload before creating a file',()=>{
 for(const mode of ['public','inherited','editors','viewers','owner']){const e=fixture();if(mode==='public')e.photos.access='ANYONE_WITH_LINK';if(mode==='inherited')e.root.access='ANYONE_WITH_LINK';if(mode==='editors')e.photos.editors=['other@example.test'];if(mode==='viewers')e.root.viewers=['other@example.test'];if(mode==='owner')e.root.owner='other@example.test';assert.equal(e.upload().state,'FAILED');assert.equal(e.created(),0);assert.equal(e.rows('ATTENDANCE').length,1);}
});
test('repair secures only recorded images, removes explicit viewers/editors, and refuses dangerous inherited folder permissions',()=>{
 const e=fixture();e.upload();const f=[...e.files.values()][0];f.access='ANYONE_WITH_LINK';f.editors=['other@example.test'];f.viewers=['guest@example.test'];const unrelated=e.file('UNRELATED_IMAGE_00000000000000000000',f.blob);unrelated.access='ANYONE_WITH_LINK';
 const r=e.c.amankanFotoLama();assert.equal(r.success,true);assert.equal(r.complete,true);assert.equal(r.secured,1);assert.equal(f.access,'PRIVATE');assert.deepEqual(f.editors,[]);assert.deepEqual(f.viewers,[]);assert.equal(unrelated.access,'ANYONE_WITH_LINK');
 f.access='ANYONE_WITH_LINK';e.root.viewers=['outsider@example.test'];const failed=e.c.amankanFotoLama();assert.equal(failed.success,false);assert.equal(failed.failedCount,1);assert.equal(f.access,'ANYONE_WITH_LINK');
});
test('repair requires native Admin and configured workbook, and cannot be called through the app gateway',()=>{
 const e=fixture();e.upload();const f=[...e.files.values()][0],before=f.changes.length;for(const mode of ['email','book']){const oldUser=e.c.Session.getActiveUser,oldBook=e.c.SpreadsheetApp.getActiveSpreadsheet;if(mode==='email')e.c.Session.getActiveUser=()=>({getEmail:()=> 'guest@example.test'});else e.c.SpreadsheetApp.getActiveSpreadsheet=()=>({getId:()=> 'wrong-book'});assert.throws(()=>e.c.amankanFotoLama(),/ACCESS_DENIED/);e.c.Session.getActiveUser=oldUser;e.c.SpreadsheetApp.getActiveSpreadsheet=oldBook;}assert.throws(()=>e.c.kchApi('MOCK','amankanFotoLama',[]),/ACCESS_DENIED/);assert.equal(f.changes.length,before);
});
test('archived attendance and visits remain accessible through authenticated evidence without publishing files',()=>{
 for(const kind of ['attendance','visit']){const e=fixture(),saved=e.upload(kind),name=kind==='attendance'?'ATTENDANCE':'VISIT_PHOTOS',headers=e.rows(name)[0],row=e.rows(name).pop();
 const meta=e.c.txMetadata_({id:'test-book',token:'TEST_ONLY_OAUTH'}),req=[];e.c.txAddSheet_(meta,req,'_KCH_ARCHIVE_ROWS',e.c.KCH_ARCHIVE_SCHEMAS_._KCH_ARCHIVE_ROWS,true);req.push(e.c.txAppend_(meta._KCH_ARCHIVE_ROWS.sheetId,[['2026-10',name,JSON.stringify(headers),JSON.stringify(row)]]));e.c.txBatch_({id:'test-book',token:'TEST_ONLY_OAUTH'},req);const f=[...e.files.values()][0];f.access='ANYONE_WITH_LINK';const repair=e.c.amankanFotoLama();assert.equal(repair.secured,1);assert.equal(f.access,'PRIVATE');e.c.PropertiesService.getScriptProperties().setProperty('KCH_MONTHLY_ARCHIVE_ENABLED','TRUE');e.actor({role:'GUEST'});assert.equal(e.evidence(kind,saved.photoRef).success,true);
 }
});

test('repair continues in bounded batches and retains failures from earlier batches in its final report',()=>{
 const e=fixture();e.upload();const original=[...e.files.values()][0],template=e.rows('ATTENDANCE')[1];original.owner='other@example.test';
 for(let i=0;i<31;i++){const f=e.file('REPAIR_IMAGE_'+String(i).padStart(24,'0'),original.blob);f.access='ANYONE_WITH_LINK';const row=template.slice();row[e.rows('ATTENDANCE')[0].indexOf('photo_url')]=f.getUrl();e.rows('ATTENDANCE').push(row);}
 const first=e.c.amankanFotoLama();assert.equal(first.complete,false);assert.equal(first.checked,30);assert.equal(first.failedCount,1);const last=e.c.amankanFotoLama();assert.equal(last.complete,true);assert.equal(last.checked,32);assert.equal(last.failedCount,1);assert.equal(last.success,false);
});

test('initial metadata and dashboard attendance expose only references for private business photos',()=>{
 const e=fixture(),att=e.upload(),visit=e.upload('visit',{requestId:'REQ-PRIVATE-VISIT-0002'});assert.equal(att.success,true);assert.equal(visit.success,true);
 const metadata=e.c.kchApi('MOCK','getInitialAppMetadata',[]);assert.equal(metadata.success,true,metadata.message);assert.equal(metadata.visitPhotos[0].photoUrl,'');assert.equal(metadata.visitPhotos[0].photoRef,visit.photoRef);
 const dashboard=e.c.kchApi('MOCK','getDashboardMetrics',[{attendanceDate:'2026-10-25'}]);assert.equal(dashboard.success,true,dashboard.message);assert.equal(dashboard.todayAttendance[0].photoUrl,'');assert.equal(dashboard.todayAttendance[0].photoRef,att.photoRef);
});
