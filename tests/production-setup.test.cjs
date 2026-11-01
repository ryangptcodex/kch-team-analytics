const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {system}=require('./helpers/transaction-system.cjs');
const BOOK='1ww5Zhw_2nFqUyEq9S-I85fpJO1J3tJ_1Mo5UPBqpz4M',SCRIPT='1uVrRq4sfvzLIjCIMAg6Qo5TlPG0XJxCnDTuYINSCrsf0WrOF2mvbk-5X';
function fixture(){
 const e=system({bookId:BOOK,scriptId:SCRIPT}),c=e.context;
 for(const file of ['score.gs','canvasser-incentives.gs','incentives.gs','incentive-sheets.gs','sheet-updates.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
 e.actor({role:'ADMIN'});
 const native=c.getKchSpreadsheet_(),ctx={id:BOOK,token:'TEST_ONLY_OAUTH'},events=[],snapshots=[],folders=[],triggers=[];
 const add=(name,rows)=>{const meta=c.txMetadata_(ctx),req=[],p=c.txAddSheet_(meta,req,name,rows[0],false);if(rows.length>1)req.push(c.txAppend_(p.sheetId,rows.slice(1)));c.txBatch_(ctx,req);};
 add('PEMBARUAN_SHEET',[['PUSAT PEMBARUAN SHEET']]);
 const schemas=c.kchSheetSchemas_();for(const n of ['ACCESS_USERS','SALES_STOCK','STOCK_PICKUPS','SALES_CASH_DEPOSITS','SKOR_EVENTS','_KCH_TX_REQUESTS','_KCH_TX_EDITS','_KCH_ARCHIVE_ROWS','_KCH_MONTHLY_ARCHIVES'])if(!e.exists(n))add(n,[Array.from(schemas[n])]);
 const access=e.rows('ACCESS_USERS'),headers=access[0];access.push(headers.map(h=>({email:c.KCH_BOOTSTRAP_ADMIN_EMAIL_,role:'ADMIN',status:'ACTIVE',firebase_uid:'ADMIN-OLD-UID',display_name:'Admin'}[h]||'')),headers.map(h=>({email:c.KCH_GUEST_EMAIL_,role:'GUEST',status:'ACTIVE',password:'TRIAL-PASSWORD',password_hash:'TRIAL-HASH',username:'trialguest'}[h]||'')));
 const row={transaction_id:'TRIAL',transaction_date:'2026-10-25',sales_id:'S1',product_id:'P1',quantity:2,selling_price:100,subtotal_sales:200};e.rows('SALES_TRANSACTIONS').push(Array.from(c.TABLE_SCHEMAS.SALES_TRANSACTIONS,h=>row[h]??''));
 e.rows('SALES_STOCK').push(['S1','P1','D1',5,'trial']);
 e.rows('_KCH_TX_REQUESTS').push(Array.from(c.KCH_TX_REQUEST_HEADERS_,h=>({request_key:'TRIAL',request_id:'TRIAL-REQUEST-000001',state:'PENDING'}[h]||'')));
 e.rows('_KCH_ARCHIVE_ROWS').push(['2026-10','SALES_TRANSACTIONS','["transaction_id"]','["OLD-TRIAL"]']);e.rows('SKOR_EVENTS').push(['TRIAL-EVENT']);
 const ss={...native,getName:()=> 'KCH Team Analytics Production',getId:()=>BOOK,toast(){},copy(){events.push('backup');snapshots.push(JSON.stringify(['SALES_TRANSACTIONS','INVENTORY','SALES_STOCK','_KCH_ARCHIVE_ROWS'].map(n=>e.rows(n))));return {getId:()=> 'backup',getUrl:()=> 'https://docs.google.com/spreadsheets/d/backup'};},setActiveSheet(){},moveActiveSheet(){},getNumSheets:()=>30};
 const original=native.getSheetByName;ss.getSheetByName=name=>{const sheet=original(name);if(!sheet)return null;const get=sheet.getRange;sheet.getRange=(r,...args)=>{if(typeof r==='string'){const m=/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(r),col=s=>Array.from(s).reduce((n,x)=>n*26+x.charCodeAt(0)-64,0);return get(Number(m[2]),col(m[1]),m[4]?Number(m[4])-Number(m[2])+1:1,m[3]?col(m[3])-col(m[1])+1:1);}return get(r,...args);};return sheet;};
 c.SpreadsheetApp.getActiveSpreadsheet=()=>ss;c.SpreadsheetApp.openById=id=>{assert.equal(id,BOOK,'Production must never open the UJI database');return ss;};
 // Restore the real routing/read gate that the shared transaction harness normally mocks.
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','firebase-config.gs'),'utf8'),c);
 c.DriveApp={createFolder(name){events.push('folder');const folder={getId:()=> 'PROD-PHOTO-'+folders.length};folders.push({name,folder});return folder;},getFolderById:id=>{assert.ok(id.startsWith('PROD-PHOTO-'));return {getId:()=>id};}};
 c.ScriptApp.getProjectTriggers=()=>triggers;c.ScriptApp.deleteTrigger=t=>triggers.splice(triggers.indexOf(t),1);c.ScriptApp.newTrigger=handler=>({forSpreadsheet:()=>({onEdit:()=>({create(){triggers.push({getHandlerFunction:()=>handler,getTriggerSourceId:()=>BOOK});}})})});
 const props=c.PropertiesService.getScriptProperties();props.setProperty('KCH_GUEST_SESSION_TRIAL','SECRET');props.setProperty('KCH_MONTHLY_ARCHIVE_ENABLED','TRUE');props.setProperty('KCH_ARCHIVE_CHECKED_MONTH','2026-10');props.setProperty('PHOTO_UPLOAD_FOLDER_ID','UJI-FOLDER');
 const real=c.txBatch_;c.txBatch_=(ctx,req)=>{events.push('batch');return real(ctx,req);};
 const objects=n=>{const r=e.rows(n)||[];return r.slice(1).filter(r=>r.some(v=>v!==''&&v!=null)).map(v=>Object.fromEntries(r[0].map((h,i)=>[h,v[i]??''])));};
 const fill=()=>{const r=e.rows(c.KCH_OPENING_INVENTORY_);for(const v of r.slice(1)){v[2]=20;v[3]=10;}e.rows(c.KCH_OPENING_HELD_).push(['S1','P1','D2',3]);};
 return {...e,c,ss,ctx,props,events,snapshots,folders,triggers,add,objects,fill,prepare:()=>c.siapkanDatabaseProduksiBaru(),open:()=>c.terapkanStokAwalProduksi()};
}
test('routing matches both supplied Production IDs and keeps the UJI configuration separate',()=>{
 const e=fixture();assert.equal(e.c.getKchSpreadsheetId_(),BOOK);assert.throws(()=>e.c.getKchSpreadsheet_(),/belum disiapkan/);assert.ok(e.c.getKchEnvironmentKey_().startsWith('production-'));
 e.c.ScriptApp.getScriptId=()=> 'ORIGINAL-UJI-PROJECT';assert.equal(e.c.getKchSpreadsheetId_(),e.c.KCH_TEST_SPREADSHEET_ID_);assert.equal(e.c.getKchEnvironmentKey_(),'');assert.throws(()=>e.prepare(),/ACCESS_DENIED/);
});
test('native initialization rejects wrong email, project and active workbook before any data changes',()=>{
 for(const mode of ['email','project','workbook']){const e=fixture(),before=JSON.stringify(e.rows('SALES_TRANSACTIONS'));if(mode==='email')e.c.Session.getActiveUser=()=>({getEmail:()=> 'guest@example.test'});if(mode==='project')e.c.ScriptApp.getScriptId=()=> 'UJI';if(mode==='workbook')e.c.SpreadsheetApp.getActiveSpreadsheet=()=>({...e.ss,getId:()=>e.c.KCH_TEST_SPREADSHEET_ID_});assert.throws(()=>e.prepare(),/ACCESS_DENIED/);assert.equal(JSON.stringify(e.rows('SALES_TRANSACTIONS')),before);assert.equal(e.events.length,0);}
});
test('preparation backs up before one atomic clear, drops copied history/sessions/credentials, preserves masters and does not invent opening stock',()=>{
 const e=fixture(),price=JSON.stringify(e.rows('PRICE_MASTER'));e.events.length=0;const r=e.prepare();assert.equal(r.state,'PREPARED');assert.deepEqual(e.events.slice(0,3),['backup','folder','batch']);assert.equal(JSON.stringify(e.rows('PRICE_MASTER').map(r=>[r[0],r[3],r[4],r[5]])),JSON.stringify(JSON.parse(price).map(r=>[r[0],r[1],r[2],r[3]]))); // canonical columns migrate; business values remain
 for(const n of ['SALES_TRANSACTIONS','SALES_STOCK','STOCK_PICKUPS','SALES_CASH_DEPOSITS','SKOR_EVENTS','_KCH_ARCHIVE_ROWS','_KCH_MONTHLY_ARCHIVES','_KCH_TX_REQUESTS','_KCH_TX_EDITS'])assert.equal(e.objects(n).length,0,n);
 assert.ok(e.objects('INVENTORY').every(r=>r['PT. Global Mitra Prima']===0&&r['AP. Geubrina Rizki']===0));assert.ok(e.objects(e.c.KCH_OPENING_INVENTORY_).every(r=>r['PT. Global Mitra Prima']===''));
 assert.equal(e.objects('ACCESS_USERS').find(r=>r.role==='GUEST').status,'INACTIVE');assert.equal(e.objects('ACCESS_USERS').find(r=>r.role==='GUEST').password,'');assert.equal(e.props.getProperty('KCH_GUEST_SESSION_TRIAL'),null);assert.equal(e.props.getProperty('KCH_MONTHLY_ARCHIVE_ENABLED'),null);assert.ok(e.props.getProperty('PHOTO_UPLOAD_FOLDER_ID').startsWith('PROD-PHOTO-'));
 assert.equal(e.c.getKchSpreadsheet_().getId(),BOOK);assert.throws(()=>e.save(),/Production belum dibuka/);assert.equal(e.c.productionState_(e.ss).state,'PREPARED');assert.ok(e.snapshots[0].includes('OLD-TRIAL'));
 assert.ok(e.calls.every(call=>new URL(call.url).pathname.includes(BOOK)));
});
test('repeated preparation resumes safely without clearing templates or later operational data',()=>{
 const e=fixture();e.prepare();e.rows(e.c.KCH_OPENING_INVENTORY_)[1][2]=9;const n=e.snapshots.length;assert.equal(e.prepare().alreadyPrepared,true);assert.equal(e.rows(e.c.KCH_OPENING_INVENTORY_)[1][2],9);assert.equal(e.snapshots.length,n);
});
test('blank/incomplete/negative/fractional opening balances and duplicate holdings fail before any writes',()=>{
 for(const mode of ['blank','missing','negative','fraction','duplicate','heldblank']){const e=fixture();e.prepare();e.fill();const r=e.rows(e.c.KCH_OPENING_INVENTORY_);if(mode==='blank')r[1][2]='';if(mode==='missing')r.pop();if(mode==='negative')r[1][2]=-1;if(mode==='fraction')r[1][2]=1.5;if(mode==='duplicate')e.rows(e.c.KCH_OPENING_HELD_).push(['S1','P1','D2',3]);if(mode==='heldblank')e.rows(e.c.KCH_OPENING_HELD_)[1][3]='';const before=JSON.stringify(e.rows('INVENTORY'));assert.throws(()=>e.open());assert.equal(JSON.stringify(e.rows('INVENTORY')),before);assert.equal(e.c.productionState_(e.ss).state,'PREPARED');}
});
test('real warehouse and optional held opening balances commit once, with ledger entries and no sales/score/revenue',()=>{
 const e=fixture();e.prepare();e.fill();assert.equal(e.open().state,'READY');assert.equal(e.stock('P1',2),20);assert.equal(e.stock('P1',3),10);assert.equal(e.objects('SALES_STOCK')[0].quantity,3);assert.equal(e.objects('SALES_STOCK')[0].distributor_id,'D2');assert.equal(e.objects('SALES_TRANSACTIONS').length,0);assert.equal(e.objects('SKOR_EVENTS').length,0);assert.equal(e.objects('INVENTORY_MOVEMENTS')[0].quantity,30);assert.equal(e.objects('SALES_STOCK_MOVEMENTS')[0].quantity,3);
 const before=JSON.stringify([e.rows('INVENTORY'),e.rows('SALES_STOCK')]);assert.equal(e.open().state,'READY');assert.equal(JSON.stringify([e.rows('INVENTORY'),e.rows('SALES_STOCK')]),before);
 assert.equal(e.save().success,true);const stock=e.stock();e.prepare();e.open();assert.equal(e.stock(),stock);assert.equal(e.objects('SALES_TRANSACTIONS').length,1);
});
test('opening initialization rejects activity inserted manually before opening',()=>{
 const e=fixture();e.prepare();e.fill();e.rows('SALES_TRANSACTIONS').push(['MANUAL-ACTUAL']);assert.throws(()=>e.open(),/Sudah ada aktivitas/);assert.equal(e.stock(),0);
});
test('backup or definite commit failure never cleans the copy, and a safe retry succeeds',()=>{
 for(const mode of ['backup','reject']){const e=fixture();if(mode==='backup')e.ss.copy=()=>{throw Error('Drive unavailable');};else e.options.rejectTarget='_KCH_PRODUCTION_STATE';const before=JSON.stringify(e.rows('SALES_TRANSACTIONS'));assert.throws(()=>e.prepare());assert.equal(JSON.stringify(e.rows('SALES_TRANSACTIONS')),before);assert.equal(e.c.productionIsPrepared_(),false);assert.equal(e.props.getProperty('KCH_PRODUCTION_INIT_PENDING'),null);if(mode==='reject'){e.options.rejectTarget=null;assert.equal(e.prepare().state,'PREPARED');}}
});
test('lost preparation response is resolved by the permanent marker and cannot clear twice',()=>{
 const e=fixture();e.options.financialFault='lostAfterCommit';assert.equal(e.prepare().state,'PREPARED');e.options.financialFault=null;const n=e.snapshots.length;assert.equal(e.prepare().alreadyPrepared,true);assert.equal(e.snapshots.length,n);
});
test('unknown preparation blocks retries until the original batch settles; late completion resumes without another clear',()=>{
 const e=fixture();e.options.financialFault='unknownBefore';assert.throws(()=>e.prepare());assert.ok(e.props.getProperty('KCH_PRODUCTION_INIT_PENDING'));assert.throws(()=>e.prepare(),/belum pasti/);assert.equal(e.objects('SALES_TRANSACTIONS').length,1);e.settle();assert.equal(e.prepare().alreadyPrepared,true);assert.equal(e.objects('SALES_TRANSACTIONS').length,0);assert.equal(e.c.productionIsPrepared_(),true);
});
test('unknown opening blocks retries and business writes until marker confirms READY',()=>{
 const e=fixture();e.prepare();e.fill();e.options.financialFault='unknownBefore';assert.throws(()=>e.open());assert.throws(()=>e.open(),/belum pasti/);assert.throws(()=>e.save(),/Production belum dibuka/);e.settle();assert.equal(e.open().state,'READY');assert.equal(e.stock(),20);assert.equal(e.objects('SALES_STOCK').length,1);
});
test('Production helpers are not available through the authenticated guest/admin gateway',()=>{
 const e=fixture();for(const role of ['ADMIN','GUEST']){e.actor({role});for(const name of ['siapkanDatabaseProduksiBaru','terapkanStokAwalProduksi'])assert.throws(()=>e.c.kchApi('MOCK',name,[]),/ACCESS_DENIED/);}
});
test('account/profile audit records do not block opening balances and are preserved',()=>{
 const e=fixture();e.prepare();e.fill();e.rows('ACTIVITY_LOGS').push(['AUD-INFO','2026-10-25','admin','UPDATE_PROFILE','profile','Name updated']);e.open();assert.ok(e.objects('ACTIVITY_LOGS').some(r=>r.action==='UPDATE_PROFILE'));assert.equal(e.c.productionState_(e.ss).state,'READY');assert.match(e.ss.getSheetByName('PEMBARUAN_SHEET').getRange('B8').getValue(),/sudah diterapkan/);
});
test('opening write rejection leaves zero balances and allows safe retry without duplicate ledger rows',()=>{
 const e=fixture();e.prepare();e.fill();e.options.rejectTarget='INVENTORY';assert.throws(()=>e.open());assert.equal(e.stock(),0);assert.equal(e.props.getProperty('KCH_PRODUCTION_OPEN_PENDING'),null);e.options.rejectTarget=null;e.open();assert.equal(e.stock(),20);assert.equal(e.objects('SALES_STOCK').length,1);
});

test('re-running preparation cannot clear an uncertain opening reservation or permit a second opening batch',()=>{
 const e=fixture();e.prepare();e.fill();e.options.financialFault='unknownBefore';assert.throws(()=>e.open());const pending=e.props.getProperty('KCH_PRODUCTION_OPEN_PENDING');assert.ok(pending);e.prepare();assert.equal(e.props.getProperty('KCH_PRODUCTION_OPEN_PENDING'),pending);assert.throws(()=>e.open(),/belum pasti/);e.settle();e.open();assert.equal(e.objects('SALES_STOCK_MOVEMENTS').length,1);assert.equal(e.stock(),20);
});
