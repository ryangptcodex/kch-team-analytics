const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {system}=require('./helpers/transaction-system.cjs');
function fixture(){
 const e=system(),c=e.context;
 for(const name of ['score.gs','canvasser-incentives.gs','incentives.gs','incentive-sheets.gs','sheet-updates.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),c);
 e.actor({role:'ADMIN'});c.KCH_TEST_SPREADSHEET_ID_='test-book';c.scoreToday_=()=> '2026-11-01';
 const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},ss=c.getKchSpreadsheet_(),events=[],backups=[];
 const add=(name,rows)=>{const meta=c.txMetadata_(ctx),requests=[],p=c.txAddSheet_(meta,requests,name,rows[0],false);if(rows.length>1)requests.push(c.txAppend_(p.sheetId,rows.slice(1)));c.txBatch_(ctx,requests);};
 add(c.KCH_UPDATE_SHEET_,[['PUSAT PEMBARUAN SHEET']]);
 const control=ss.getSheetByName(c.KCH_UPDATE_SHEET_);
 ss.getName=()=> 'UJI COBA';ss.toast=()=>{};
 ss.copy=()=>{events.push('backup');backups.push(JSON.parse(JSON.stringify(['SALES_TRANSACTIONS','INVENTORY','SALES_STOCK','SALES_CASH_DEPOSITS'].map(n=>e.rows(n)))));return {getId:()=> 'backup',getUrl:()=> 'https://docs.google.com/spreadsheets/d/backup'};};
 ss.setActiveSheet=()=>{};ss.getNumSheets=()=>30;ss.moveActiveSheet=()=>{};
 c.getKchSpreadsheet_=()=>ss;c.SpreadsheetApp.getActiveSpreadsheet=()=>ss;
 const realBatch=c.txBatch_;c.txBatch_=(ctx,requests)=>{events.push(requests.some(r=>r.updateCells?.range?.startRowIndex===1)?'clear-batch':'batch');return realBatch(ctx,requests);};
 for(const [id,[name]] of Object.entries(c.KCH_SCORE_PRODUCT_RULES_))e.rows('PRODUCTS').push([id,name,'ACTIVE']);
 add('HOLIDAYS',[['date','holiday_name'],['2026-11-01','Minggu']]);
 const arm=()=>{const control=ss.getSheetByName(c.KCH_UPDATE_SHEET_);control.getRange(14,1).setValue('PERSIAPAN LAUNCH NOVEMBER 2026');control.getRange(15,1).setValue(true);};
 // Real native Sheets calls use both A1 and numeric notation.
 const original=ss.getSheetByName;ss.getSheetByName=name=>{const sheet=original(name);if(!sheet)return null;sheet.getLastColumn=()=>Math.max(0,...e.rows(name).map(r=>r.reduce((last,v,i)=>v!==''&&v!=null?i+1:last,0)));sheet.getLastRow=()=>e.rows(name).reduce((last,r,i)=>r.some(v=>v!==''&&v!=null)?i+1:last,0);const get=sheet.getRange;sheet.getRange=(r,...args)=>{if(typeof r==='string'){const m=/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(r);if(!m)throw Error(r);let col=s=>Array.from(s).reduce((n,x)=>n*26+x.charCodeAt(0)-64,0);return get(Number(m[2]),col(m[1]),m[4]?Number(m[4])-Number(m[2])+1:1,m[3]?col(m[3])-col(m[1])+1:1);}return get(r,...args);};return sheet;};
 return {...e,c,ss,ctx,add,events,backups,arm,control:()=>ss.getSheetByName(c.KCH_UPDATE_SHEET_),run:()=>c.kchRunSheetUpdates_(ss)};
}
function nonempty(e,name){return (e.rows(name)||[]).slice(1).filter(r=>r.some(v=>v!==''&&v!=null));}
function seed(e){
 assert.equal(e.save().success,true);
 const headers=Array.from(e.c.kchSheetSchemas_().ACCESS_USERS);
 e.add('ACCESS_USERS',[headers,...[e.c.KCH_BOOTSTRAP_ADMIN_EMAIL_,e.c.KCH_GUEST_EMAIL_].map((email,i)=>headers.map(h=>h==='email'?email:h==='role'?(i?'GUEST':'ADMIN'):h==='password_hash'?'HASH-KEEP':h==='password_salt'?'SALT-KEEP':''))]);
 e.add('_KCH_TX_EDITS',[Array.from(e.c.KCH_TX_EDIT_HEADERS_),['OLD-EDIT-KEEP']]);
 for(const name of ['SALES_STOCK','SALES_STOCK_MOVEMENTS','STOCK_PICKUPS','SALES_CASH_DEPOSITS'])e.add(name,[Array.from(e.c.KCH_STOCK_SCHEMAS_[name])]);
 e.rows('SALES_STOCK').push(['S1','P1','D2',5,'2026-10-31']);
 for(const name of ['ATTENDANCE','VISIT_PHOTOS','TODAY_PLAN','WEEKLY_MEETINGS','MONTHLY_TEAM_REPORT','SKOR_EVENTS']){
  const schemas=e.c.kchSheetSchemas_();e.add(name,[Array.from(schemas[name]),['old-test-data']]);
 }
 e.rows('SALES_CASH_DEPOSITS').push(['CASH-OLD','2026-10-31','S1','Sales One','D1','GMP',100000]);
 e.add('KCH_NEWS',[Array.from(e.c.TABLE_SCHEMAS.KCH_NEWS),['NEWS-KEEP']]);
 e.add('FILES',[Array.from(e.c.TABLE_SCHEMAS.FILES),['FILE-KEEP']]);
}
test('normal update without arming preserves activity; registry covers every new feature and launch marker',()=>{
 const e=fixture();assert.equal(e.save().success,true);const before=nonempty(e,'SALES_TRANSACTIONS');e.run();assert.equal(nonempty(e,'SALES_TRANSACTIONS').length,before.length);
 for(const name of ['SALES_STOCK','SALES_STOCK_MOVEMENTS','STOCK_PICKUPS','SALES_CASH_DEPOSITS','SKOR_EVENTS','INSENTIF_HARIAN','INSENTIF_BULANAN','INSENTIF_TRIWULAN','_KCH_LAUNCH_STATE'])assert.ok(e.exists(name),name);
 assert.equal(e.c.kchLaunchCompleted_(e.ss),false);
});
test('armed launch backs up first, clears test activity atomically, preserves balances/master/content/journals, then cannot clear new transactions',()=>{
 const e=fixture();seed(e);const access=JSON.stringify(e.rows('ACCESS_USERS')),edits=JSON.stringify(e.rows('_KCH_TX_EDITS')),warehouse=JSON.stringify(e.rows('INVENTORY')),holdings=JSON.stringify(e.rows('SALES_STOCK')),oldReceipts=nonempty(e,'_KCH_TX_REQUESTS').length;
 e.arm();e.events.length=0;assert.equal(e.run().success,true);assert.equal(e.events[0],'backup');
 for(const name of ['SALES_TRANSACTIONS','ATTENDANCE','SKOR_EVENTS','VISIT_PHOTOS','TODAY_PLAN','WEEKLY_MEETINGS','MONTHLY_TEAM_REPORT','INVENTORY_MOVEMENTS','SALES_STOCK_MOVEMENTS','STOCK_PICKUPS','SALES_CASH_DEPOSITS','ACTIVITY_LOGS','INSENTIF_BULANAN'])assert.equal(nonempty(e,name).length,0,name);
 assert.equal(JSON.stringify(e.rows('ACCESS_USERS')),access);assert.equal(JSON.stringify(e.rows('_KCH_TX_EDITS')),edits);assert.equal(JSON.stringify(e.rows('INVENTORY')),warehouse);assert.equal(JSON.stringify(e.rows('SALES_STOCK')),holdings);
 assert.equal(nonempty(e,'KCH_NEWS')[0][0],'NEWS-KEEP');assert.equal(nonempty(e,'FILES')[0][0],'FILE-KEEP');assert.equal(nonempty(e,'HOLIDAYS')[0][1],'Minggu');
 assert.equal(e.c.kchLaunchCompleted_(e.ss),true);assert.ok(nonempty(e,'_KCH_TX_REQUESTS').length>oldReceipts);assert.equal(e.c.txHasPending_(e.c.txReceipts_(e.ctx,e.c.txMetadata_(e.ctx))),false);
 assert.equal(e.backups[0][0].length,2);assert.equal(e.control().getRange('A18').getValue(),'https://docs.google.com/spreadsheets/d/backup');
 assert.equal(e.save({requestId:'NEW-NOVEMBER-REQUEST-0001',date:'2026-10-25'}).success,true);
 const current=e.stock();e.arm();e.run();assert.equal(nonempty(e,'SALES_TRANSACTIONS').length,1);assert.equal(e.stock(),current);
 // Replaying a prelaunch request never subtracts warehouse stock again.
 assert.equal(e.save().replayed,true);assert.equal(e.stock(),current);
});
test('missing request journal is created safely for the first reset; headers and receipt survive the clear',()=>{
 const e=fixture();e.arm();e.run();assert.ok(e.exists('_KCH_TX_REQUESTS'));assert.equal(e.c.kchLaunchCompleted_(e.ss),true);assert.equal(nonempty(e,'_KCH_TX_REQUESTS')[0][7],'COMMITTED');
});
test('backup failure and ambiguous headers leave test activity untouched with no launch reservation',()=>{
 for(const mode of ['backup','headers']){const e=fixture();assert.equal(e.save().success,true);e.arm();const before=JSON.stringify(e.rows('SALES_TRANSACTIONS'));
 if(mode==='backup')e.ss.copy=()=>{throw Error('Drive unavailable');};else e.rows('ATTENDANCE')??e.add('ATTENDANCE',[['wrong_header']]);
 assert.throws(()=>e.run());assert.equal(JSON.stringify(e.rows('SALES_TRANSACTIONS')),before);assert.equal(e.c.kchLaunchCompleted_(e.ss),false);assert.equal(e.c.txHasPending_(e.c.txReceipts_(e.ctx,e.c.txMetadata_(e.ctx))),false);
 }
});
test('lost reset response after commit resolves through terminal receipt and never clears a later transaction',()=>{
 const e=fixture();assert.equal(e.save().success,true);e.arm();e.options.financialFault='lostAfterCommit';assert.equal(e.run().success,true);assert.equal(e.c.kchLaunchCompleted_(e.ss),true);e.options.financialFault=null;
 assert.equal(e.save({requestId:'AFTER-RESET-00000001'}).success,true);e.run();assert.equal(nonempty(e,'SALES_TRANSACTIONS').length,1);
});
test('uncertain reset before commit blocks new financial writes and maintenance until original batch settles',()=>{
 const e=fixture();assert.equal(e.save().success,true);e.arm();e.options.financialFault='unknownBefore';assert.throws(()=>e.run());assert.equal(nonempty(e,'SALES_TRANSACTIONS').length,1);
 assert.equal(e.save({requestId:'AFTER-UNKNOWN-00000001'}).code,'SAVE_PENDING');assert.throws(()=>e.run(),/hasilnya belum pasti/);
 e.settle();assert.equal(e.c.kchLaunchCompleted_(e.ss),true);assert.equal(nonempty(e,'SALES_TRANSACTIONS').length,0);assert.equal(e.save({requestId:'AFTER-SETTLED-00000001'}).success,true);e.run();assert.equal(nonempty(e,'SALES_TRANSACTIONS').length,1);
});
test('definite reset rejection is atomic and releases reservation for a safe retry',()=>{
 const e=fixture();assert.equal(e.save().success,true);e.arm();
 // Make ATTENDANCE an existing clear target (not a newly created header alone).
 e.add('ATTENDANCE',[Array.from(e.c.TABLE_SCHEMAS.ATTENDANCE)]);e.rows('ATTENDANCE').push(['S1']);e.options.rejectTarget='ATTENDANCE';
 assert.throws(()=>e.run());assert.equal(nonempty(e,'SALES_TRANSACTIONS').length,1);assert.equal(e.c.kchLaunchCompleted_(e.ss),false);
 assert.equal(e.c.txHasPending_(e.c.txReceipts_(e.ctx,e.c.txMetadata_(e.ctx))),false);
 e.options.rejectTarget=null;e.run();assert.equal(e.c.kchLaunchCompleted_(e.ss),true);
});
test('launch preparation is not available through the web gateway, including to guests',()=>{
 const e=fixture();for(const role of ['GUEST','ADMIN']){e.actor({role});assert.throws(()=>e.c.kchApi('MOCK','siapkanAwalNovember',[]));}
});
test('preparation arms once without clearing anything; rerunning after completion cannot arm another reset',()=>{
 const e=fixture();e.save();e.c.installKchSheetUpdates_=()=>{};
 const original=e.ss.getSheetByName;e.ss.getSheetByName=name=>{const sheet=original(name);if(!sheet)return null;const get=sheet.getRange;sheet.getRange=(...args)=>{const range=get(...args);for(const name of ['merge','setFontWeight','setWrap','insertCheckboxes'])range[name]=()=>range;return range;};return sheet;};
 e.c.siapkanAwalNovember();assert.equal(e.c.kchLaunchArmed_(e.control()),true);assert.equal(nonempty(e,'SALES_TRANSACTIONS').length,1);
 e.run();assert.equal(e.control().getRange('A15').getValue(),false);e.c.siapkanAwalNovember();assert.equal(e.c.kchLaunchArmed_(e.control()),false);
});
test('unrecognized control notes and stale stock module stop preparation/update rather than overwriting or omitting features',()=>{
 const e=fixture();e.c.installKchSheetUpdates_=()=>{};e.control().getRange('A14').setValue('My note');assert.throws(()=>e.c.siapkanAwalNovember(),/sudah berisi data/);assert.equal(e.control().getRange('A14').getValue(),'My note');
 e.c.stockSchemas_=()=>({SALES_STOCK:['sales_id']});assert.throws(()=>e.run(),/setoran dan asal stok/);assert.equal(e.events.filter(v=>v==='backup').length,0);
});
