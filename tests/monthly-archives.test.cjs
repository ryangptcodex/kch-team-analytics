const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {system}=require('./helpers/transaction-system.cjs');
function fixture(){
 const e=system(),c=e.context;
 for(const name of ['score.gs','canvasser-incentives.gs','incentives.gs','incentive-sheets.gs','sheet-updates.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),c);
 let clock='2026-10-31 23:59:59';c.archiveNow_=()=>clock;c.scoreToday_=()=>clock.slice(0,10);
 c.Utilities.formatDate=(date,zone,format)=>format==='yyyyMMdd'?clock.slice(0,10).replaceAll('-',''):format==='yyyy-MM-dd'?clock.slice(0,10):format==='yyyy-MM'?clock.slice(0,7):clock;
 e.actor({role:'ADMIN'});c.KCH_TEST_SPREADSHEET_ID_='test-book';
 const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},ss=c.getKchSpreadsheet_(),events=[],backups=[],triggers=[];
 const add=(name,rows)=>{const meta=c.txMetadata_(ctx),req=[],p=c.txAddSheet_(meta,req,name,rows[0],false);if(rows.length>1)req.push(c.txAppend_(p.sheetId,rows.slice(1)));c.txBatch_(ctx,req);};
 add(c.KCH_UPDATE_SHEET_,[['PUSAT PEMBARUAN SHEET']]);
 ss.getName=()=> 'UJI COBA';ss.toast=()=>{};ss.setActiveSheet=()=>{};ss.getNumSheets=()=>30;ss.moveActiveSheet=()=>{};
 ss.copy=()=>{events.push('backup');backups.push(JSON.parse(JSON.stringify(e.rows('SALES_TRANSACTIONS'))));return {getId:()=> 'snapshot-'+backups.length,getUrl:()=> 'https://docs.google.com/spreadsheets/d/snapshot-'+backups.length};};
 c.getKchSpreadsheet_=()=>ss;c.SpreadsheetApp.getActiveSpreadsheet=()=>ss;c.Session.getEffectiveUser=c.Session.getActiveUser;
 const realBatch=c.txBatch_;c.txBatch_=(ctx,req)=>{events.push(req.some(r=>r.deleteDimension)?'move-batch':'batch');return realBatch(ctx,req);};
 const original=ss.getSheetByName;ss.getSheetByName=name=>{const sheet=original(name);if(!sheet)return null;
  sheet.getLastColumn=()=>Math.max(0,...e.rows(name).map(r=>r.reduce((last,v,i)=>v!==''&&v!=null?i+1:last,0)));
  sheet.getLastRow=()=>e.rows(name).reduce((last,r,i)=>r.some(v=>v!==''&&v!=null)?i+1:last,0);
  const get=sheet.getRange;sheet.getRange=(r,...args)=>{if(typeof r==='string'){const m=/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(r),col=s=>Array.from(s).reduce((n,x)=>n*26+x.charCodeAt(0)-64,0);return get(Number(m[2]),col(m[1]),m[4]?Number(m[4])-Number(m[2])+1:1,m[3]?col(m[3])-col(m[1])+1:1);}return get(r,...args);};return sheet;};
 c.ScriptApp.getProjectTriggers=()=>triggers;c.ScriptApp.newTrigger=handler=>({timeBased:()=>({everyMinutes:n=>({create(){triggers.push({getHandlerFunction:()=>handler});events.push('trigger:'+n);}})})});c.ScriptApp.deleteTrigger=t=>triggers.splice(triggers.indexOf(t),1);
 for(const [id,[name]]of Object.entries(c.KCH_SCORE_PRODUCT_RULES_))e.rows('PRODUCTS').push([id,name,'ACTIVE']);
 add('HOLIDAYS',[['date','holiday_name'],['2026-11-01','Minggu']]);
 const init=()=>c.kchRunSheetUpdates_(ss),run=()=>c.archiveRun_(ss);
 const obj=(name)=>{const r=e.rows(name)||[];return r.slice(1).filter(r=>r.some(v=>v!==''&&v!=null)).map(v=>Object.fromEntries(r[0].map((h,i)=>[h,v[i]??''])));};
 return {...e,c,ss,ctx,add,events,backups,triggers,init,run,obj,clock:value=>{clock=value;}};
}
function prepare(){const e=fixture();e.save();e.init();e.events.length=0;e.backups.length=0;e.clock('2026-11-01 00:00:10');return e;}
test('updater registers all archive schemas, installs one clock trigger, and disables the previous reset',()=>{
 const e=fixture();e.init();assert.ok(e.exists('_KCH_ARCHIVE_ROWS'));assert.ok(e.exists('_KCH_MONTHLY_ARCHIVES'));assert.equal(e.triggers.length,1);assert.equal(e.c.archiveEnabled_(),true);e.init();assert.equal(e.triggers.length,1);
 assert.equal(e.ss.getSheetByName('PEMBARUAN_SHEET').getRange('A15').getValue(),false);
 e.c.setupArsipBulanan=()=> 'SAFE_ARCHIVE';assert.equal(e.c.siapkanAwalNovember(),'SAFE_ARCHIVE');
});
test('October cutoff includes the final minute, never removes November/future rows, and preserves stock, masters and receipts',()=>{
 const e=prepare();const row=e.rows('SALES_TRANSACTIONS')[1];row[1]='2026-10-31';row[17]='2026-10-31 23:59:59';
 assert.equal(e.save({requestId:'NOVEMBER-TRANSACTION-0001',date:'2026-11-01'}).success,true);
 const stock=JSON.stringify(e.rows('INVENTORY')),products=JSON.stringify(e.rows('PRODUCTS')),receipts=e.rows('_KCH_TX_REQUESTS').length;
 e.events.length=0;const result=e.run();assert.equal(result.success,true);assert.equal(e.events[0],'backup');assert.equal(e.obj('SALES_TRANSACTIONS').length,1);assert.equal(e.obj('SALES_TRANSACTIONS')[0].transaction_date,'2026-11-01');
 assert.equal(JSON.stringify(e.rows('INVENTORY')),stock);assert.equal(JSON.stringify(e.rows('PRODUCTS')),products);assert.ok(e.rows('_KCH_TX_REQUESTS').length>receipts);
 assert.ok(e.obj('_KCH_ARCHIVE_ROWS').some(r=>r.sheet_name==='SALES_TRANSACTIONS'));assert.equal(e.obj('_KCH_MONTHLY_ARCHIVES')[0].cutoff_wib,'2026-10-31 23:59:59');assert.equal(e.backups[0].length,3);
 const archived=e.obj('_KCH_ARCHIVE_ROWS').length;e.run();assert.equal(e.obj('_KCH_ARCHIVE_ROWS').length,archived);assert.equal(e.obj('SALES_TRANSACTIONS').length,1);
});
test('active sheets start empty while invoice history, specific dates, score and quarterly incentives still read archived sources exactly once',()=>{
 const e=prepare();const before=e.c.kchApi('MOCK','getIncentiveReport',['2026-10','S1']);assert.equal(before.success,true);e.run();
 assert.equal(e.obj('SALES_TRANSACTIONS').length,0);assert.equal(e.c.kchApi('MOCK','getTransactionsPaginated',[1,10,'','ALL','ALL','']).totalRows,0);
 const old=e.c.kchApi('MOCK','getTransactionsPaginated',[1,10,'','ALL','ALL','2026-10-25']);assert.equal(old.totalRows,1);
 const detail=e.c.kchApi('MOCK','getTransactionDetail',[old.data[0].id]);assert.equal(detail.success,true);assert.equal(detail.items[0].qty,2);
 const after=e.c.kchApi('MOCK','getIncentiveReport',['2026-10','S1']);assert.equal(after.quarter.actual,before.quarter.actual);assert.equal(after.monthly.parameters[2].actual,before.monthly.parameters[2].actual);
 assert.equal(e.c.kchApi('MOCK','getScoreReport',['2026-11','S1']).parameters[2].actual,0);assert.ok(e.obj('INSENTIF_BULANAN').every(r=>r.month==='2026-11'));assert.ok(e.obj('INSENTIF_BULANAN').every(r=>r.total_value_actual===0));
 const count=e.c.getSheetData_('SALES_TRANSACTIONS').rows.length;e.c.kchRunSheetUpdates_(e.ss);e.run();assert.equal(e.c.getSheetData_('SALES_TRANSACTIONS').rows.length,count);
});
test('archive-only AA and branding chains remain readable and holdings/deposits keep their original distributor',()=>{
 const e=prepare();e.clock('2026-10-31 23:59:59');
 const aa=e.c.kchApi('MOCK','saveScoreAA',[{requestId:'ARCHIVE-AA-000000000001',salesId:'S1',date:'2026-10-25',count:50,expectedRevision:''}]);assert.equal(aa.success,true);
 const pick=e.c.kchApi('MOCK','saveStockPickup',[{requestId:'ARCHIVE-PICK-000000001',salesId:'S1',date:'2026-10-25',distributor:'D2',items:[{productId:'P1',qty:2}]}]);assert.equal(pick.success,true);
 const cash=e.c.kchApi('MOCK','saveSalesCashDeposit',[{requestId:'ARCHIVE-CASH-000000001',salesId:'S1',date:'2026-10-25',distributor:'D2',amount:25000,notes:'Catatan'}]);assert.equal(cash.success,true);
 const holdings=JSON.stringify(e.rows('SALES_STOCK'));e.clock('2026-11-01 00:00:10');e.run();assert.equal(JSON.stringify(e.rows('SALES_STOCK')),holdings);
 assert.equal(e.c.kchApi('MOCK','getIncentiveReport',['2026-10','S1']).monthly.parameters[3].actual,50);
 const deposits=e.c.kchApi('MOCK','getMonthlyArchiveTable',['2026-10','SALES_CASH_DEPOSITS',1]);assert.equal(deposits.total,1);assert.equal(deposits.rows[0][deposits.headers.indexOf('amount')],25000);
 assert.equal(e.c.kchApi('MOCK','getStockPickupData',[]).cashDeposits.length,0);assert.equal(e.c.kchApi('MOCK','getStockPickupData',[]).holdings[0].distributor_id,'D2');
});
test('backup/header/date failures and oversized cells never remove active data or create a pending reservation',()=>{
 for(const mode of ['backup','date','header','cell']){
  const e=prepare();if(mode==='backup')e.ss.copy=()=>{throw Error('Drive unavailable');};
  if(mode==='date')e.rows('SALES_TRANSACTIONS')[1][1]='';if(mode==='header')e.rows('_KCH_ARCHIVE_ROWS')[0][0]='wrong';if(mode==='cell')e.rows('SALES_TRANSACTIONS')[1][15]='x'.repeat(46000);
  const before=JSON.stringify(e.rows('SALES_TRANSACTIONS'));assert.throws(()=>e.run());assert.equal(JSON.stringify(e.rows('SALES_TRANSACTIONS')),before);assert.equal(e.c.txHasPending_(e.c.txReceipts_(e.ctx,e.c.txMetadata_(e.ctx))),false);
 }
});
test('a rejected atomic archive leaves source and archive intact and permits a safe retry',()=>{
 const e=prepare();const before=JSON.stringify(e.rows('SALES_TRANSACTIONS'));e.options.rejectTarget='_KCH_ARCHIVE_ROWS';assert.throws(()=>e.run());assert.equal(JSON.stringify(e.rows('SALES_TRANSACTIONS')),before);assert.equal(e.obj('_KCH_ARCHIVE_ROWS').length,0);assert.equal(e.c.txHasPending_(e.c.txReceipts_(e.ctx,e.c.txMetadata_(e.ctx))),false);e.options.rejectTarget=null;e.run();assert.equal(e.obj('SALES_TRANSACTIONS').length,0);
});
test('lost archive response after commit resolves through receipt without duplicate history',()=>{
 const e=prepare();e.options.financialFault='lostAfterCommit';assert.equal(e.run().success,true);const n=e.obj('_KCH_ARCHIVE_ROWS').length;e.options.financialFault=null;e.run();assert.equal(e.obj('_KCH_ARCHIVE_ROWS').length,n);assert.equal(e.c.getSheetData_('SALES_TRANSACTIONS').rows.length,1);
});
test('uncertain archive blocks financial and AA writes plus native updates until the original atomic move settles',()=>{
 const e=prepare();e.options.financialFault='unknownBefore';assert.throws(()=>e.run());assert.equal(e.obj('SALES_TRANSACTIONS').length,1);assert.throws(()=>e.c.kchRunSheetUpdates_(e.ss),/belum pasti/);
 assert.throws(()=>e.c.kchApi('MOCK','saveScoreAA',[{requestId:'BLOCK-AA-000000000001',salesId:'S1',date:'2026-11-01',count:1,expectedRevision:''}]),/Pengarsipan/);
 assert.throws(()=>e.save({requestId:'BLOCK-TX-000000000001',date:'2026-11-01'}),/Pengarsipan/);
 e.settle();e.run();assert.equal(e.obj('SALES_TRANSACTIONS').length,0);assert.equal(e.save({requestId:'AFTER-ARCHIVE-0000001',date:'2026-11-01'}).success,true);
});
test('guests read only allowed month/table data without snapshot links, internal IDs or mutation access',()=>{
 const e=prepare();e.run();e.actor({role:'GUEST'});const list=e.c.kchApi('MOCK','getMonthlyArchives',[]);assert.equal(Object.hasOwn(list.months[0],'snapshotUrl'),false);assert.equal(list.canOpenSnapshot,false);assert.ok(!list.tables.includes('SKOR_EVENTS'));
 assert.equal(e.c.kchApi('MOCK','getMonthlyArchiveTable',['2026-10','SALES_TRANSACTIONS',1]).total,1);
 for(const table of ['ACCESS_USERS','_KCH_TX_REQUESTS','SKOR_EVENTS','ACTIVITY_LOGS'])assert.throws(()=>e.c.kchApi('MOCK','getMonthlyArchiveTable',['2026-10',table,1]));
 assert.throws(()=>e.c.kchApi('MOCK','setupArsipBulanan',[]));assert.throws(()=>e.c.kchApi('MOCK','getMonthlyArchiveTable',['2026-10','SALES_TRANSACTIONS',-1]));
});
test('closed-month writes are rejected, and a midnight worker catches up once even when its scheduled invocation is late',()=>{
 const e=prepare();assert.equal(e.save({requestId:'OLD-MONTH-00000000001',date:'2026-10-31'}).success,false);
 e.clock('2026-11-03 09:10:00');e.c.kchMonthlyArchiveTick_();assert.equal(e.obj('SALES_TRANSACTIONS').length,0);const n=e.backups.length;e.c.kchMonthlyArchiveTick_();assert.equal(e.backups.length,n);
});
test('February/leap-year and year-end archive cutoffs use actual month length',()=>{
 for(const [month,last,next]of [['2024-02','29','2024-03'],['2026-02','28','2026-03'],['2026-12','31','2027-01']]){
  const e=prepare();e.rows('SALES_TRANSACTIONS')[1][1]=month+'-'+last;e.clock(next+'-01 00:01:00');e.run();assert.ok(e.obj('_KCH_MONTHLY_ARCHIVES').some(r=>r.cutoff_wib===month+'-'+last+' 23:59:59'));
 }
});
test('month-end check waits for the entire last minute before closing and the next month checks once',()=>{
 const e=fixture();e.save();e.init();e.c.kchMonthlyArchiveTick_();assert.equal(e.obj('SALES_TRANSACTIONS').length,1);assert.equal(e.obj('_KCH_ARCHIVE_ROWS').length,0);
 e.clock('2026-11-01 00:00:59');e.c.kchMonthlyArchiveTick_();assert.equal(e.obj('SALES_TRANSACTIONS').length,0);assert.equal(e.obj('_KCH_MONTHLY_ARCHIVES')[0].cutoff_wib,'2026-10-31 23:59:59');
});
test('private pickup and cash proof remain accessible through recorded archived IDs to admin and guests, never arbitrary file IDs',()=>{
 const e=prepare();e.clock('2026-10-31 23:59:59');
 const p=e.c.kchApi('MOCK','saveStockPickup',[{requestId:'PHOTO-ARCHIVE-PICK-0001',salesId:'S1',date:'2026-10-25',distributor:'D2',items:[{productId:'P1',qty:1}]}]);
 const d=e.c.kchApi('MOCK','saveSalesCashDeposit',[{requestId:'PHOTO-ARCHIVE-CASH-0001',salesId:'S1',date:'2026-10-25',distributor:'D2',amount:25000}]);
 for(const name of ['STOCK_PICKUPS','SALES_CASH_DEPOSITS']){const h=e.rows(name)[0],r=e.rows(name)[1];r[h.indexOf('photo_file_id')]='PRIVATE-RECORDED';r[h.indexOf('photo_url')]='https://drive.google.com/file/d/PRIVATE-RECORDED';}
 const reads=[];e.c.DriveApp={getFileById(id){reads.push(id);assert.equal(id,'PRIVATE-RECORDED');return {getBlob:()=>({getBytes:()=>[1,2],getContentType:()=> 'image/jpeg'})};}};e.c.Utilities.base64Encode=()=> 'AQI=';
 e.clock('2026-11-01 00:00:10');e.run();e.actor({role:'GUEST'});
 assert.match(e.c.kchApi('MOCK','getStockPickupEvidence',[p.pickupId||p.transactionId]).dataUrl,/data:image\/jpeg/);
 assert.match(e.c.kchApi('MOCK','getSalesCashDepositEvidence',[d.depositId||d.transactionId]).dataUrl,/data:image\/jpeg/);
 assert.throws(()=>e.c.kchApi('MOCK','getStockPickupEvidence',['PRIVATE-RECORDED']));assert.equal(reads.length,2);
 assert.ok(!e.c.kchApi('MOCK','getMonthlyArchiveTable',['2026-10','STOCK_PICKUPS',1]).headers.includes('photo_file_id'));
});
test('completed-month incentive rows are frozen as final while current native reports retain quarterly history',()=>{
 const e=prepare();const before=e.c.kchApi('MOCK','getIncentiveReport',['2026-10','S1']);e.run();
 const frozen=e.c.kchApi('MOCK','getMonthlyArchiveTable',['2026-10','INSENTIF_BULANAN',1]);assert.ok(frozen.rows.every(row=>row[frozen.headers.indexOf('period_status')]==='SELESAI'));
 const quarter=e.obj('INSENTIF_TRIWULAN').find(row=>row.sales_id==='S1');assert.equal(quarter.total_value,before.quarter.actual);
});
test('missing archive module stops native entire-sheet update before backup or mutation',()=>{
 const e=fixture();e.c.KCH_ARCHIVE_SCHEMAS_=undefined;assert.throws(()=>e.init(),/Pasang monthly-archives/);assert.equal(e.backups.length,0);
});
test('a run crossing midnight cannot mark the following month checked and skip its data',()=>{
 const e=prepare();e.rows('SALES_TRANSACTIONS')[1][1]='2026-09-30';e.clock('2026-10-31 23:59:59');
 const copy=e.ss.copy;e.ss.copy=()=>{const snapshot=copy();e.clock('2026-11-01 00:00:10');return snapshot;};e.run();
 assert.equal(e.c.PropertiesService.getScriptProperties().getProperty('KCH_ARCHIVE_CHECKED_MONTH'),'2026-10');e.c.kchMonthlyArchiveTick_();assert.equal(e.c.PropertiesService.getScriptProperties().getProperty('KCH_ARCHIVE_CHECKED_MONTH'),'2026-11');
});
test('a failed scheduled run pauses retries so it cannot create a new full copy every minute',()=>{
 const e=prepare();e.options.rejectTarget='_KCH_ARCHIVE_ROWS';assert.throws(()=>e.c.kchMonthlyArchiveTick_());const n=e.backups.length;e.c.kchMonthlyArchiveTick_();assert.equal(e.backups.length,n);e.options.rejectTarget=null;e.c.kchRunSheetUpdates_(e.ss);e.c.kchMonthlyArchiveTick_();assert.equal(e.obj('SALES_TRANSACTIONS').length,0);
});
test('compact sheets with a frozen header archive successfully without deleting all non-frozen rows',()=>{
 const e=prepare();e.options.enforceGrid=true;
 const p=e.c.txMetadata_(e.ctx).SALES_TRANSACTIONS;
 e.c.txBatch_(e.ctx,[{updateSheetProperties:{properties:{sheetId:p.sheetId,gridProperties:{rowCount:2,frozenRowCount:1}},fields:'gridProperties.rowCount,gridProperties.frozenRowCount'}}]);
 // Reproduce the Sheets rejection the old row-deletion strategy could encounter.
 assert.throws(()=>e.c.txBatch_(e.ctx,[{deleteDimension:{range:{sheetId:p.sheetId,dimension:'ROWS',startIndex:1,endIndex:2}}}]),err=>err.httpStatus===400&&/non-frozen/.test(err.apiMessage));
 const result=e.run();assert.equal(result.success,true);assert.equal(e.obj('SALES_TRANSACTIONS').length,0);assert.ok(e.obj('_KCH_ARCHIVE_ROWS').some(r=>r.sheet_name==='SALES_TRANSACTIONS'));
 assert.equal(e.c.txMetadata_(e.ctx).SALES_TRANSACTIONS.gridProperties.rowCount,2);
});
test('archiving clears old values in place and leaves current/future cell positions and formulas untouched',()=>{
 const e=prepare();e.rows('SALES_TRANSACTIONS').push([...e.rows('SALES_TRANSACTIONS')[1]]);const current=e.rows('SALES_TRANSACTIONS')[2];current[0]='NOVEMBER-KEEP';current[1]='2026-11-01';current[15]='=SUM(1,2)';const before=JSON.stringify(current);
 e.run();assert.equal(JSON.stringify(e.rows('SALES_TRANSACTIONS')[2]),before);assert.ok(e.rows('SALES_TRANSACTIONS')[1].every(v=>v===''));assert.equal(e.c.getSheetData_('SALES_TRANSACTIONS').rows.length,2);
});
test('native archive failures show the short Google reason and distinguish definite rejection from uncertainty',()=>{
 const e=prepare();e.options.rejectTarget='_KCH_ARCHIVE_ROWS';assert.throws(()=>e.run());const detail=e.ss.getSheetByName('PEMBARUAN_SHEET').getRange('B11').getValue();assert.match(detail,/Rincian Google: injected request validation failure/);assert.match(detail,/pemindahan aktivitas tidak diterapkan/);assert.equal(e.c.txHasPending_(e.c.txReceipts_(e.ctx,e.c.txMetadata_(e.ctx))),false);
});
test('archive table privacy removes private columns and snapshot references for guests but retains them for admin',()=>{
 const e=prepare();e.rows('SALES_TRANSACTIONS')[0].push('backup_url','password_hash');e.rows('SALES_TRANSACTIONS')[1].push('PRIVATE-SNAPSHOT-URL','PRIVATE-HASH');e.run();
 const admin=e.c.kchApi('T','getMonthlyArchiveTable',['2026-10','SALES_TRANSACTIONS',1]);assert.ok(admin.headers.includes('backup_url'));assert.ok(admin.headers.includes('password_hash'));assert.ok(e.c.kchApi('T','getMonthlyArchives',[]).months[0].snapshotUrl);
 e.actor({role:'GUEST'});const list=e.c.kchApi('T','getMonthlyArchives',[]);assert.equal(list.canOpenSnapshot,false);assert.ok(!JSON.stringify(list).includes('snapshot-'));assert.ok(!Object.hasOwn(list.months[0],'snapshotUrl'));
 const guest=e.c.kchApi('T','getMonthlyArchiveTable',['2026-10','SALES_TRANSACTIONS',1]);for(const header of ['backup_url','password_hash','created_by'])assert.ok(!guest.headers.includes(header));assert.ok(!JSON.stringify(guest).includes('PRIVATE-'));assert.equal(guest.total,1);
});
