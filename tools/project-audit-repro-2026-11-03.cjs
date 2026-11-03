// Audit observations against current source, using in-memory Google services only.
// These assertions document reproducible gaps; they are not desired-behavior tests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {system}=require('../tests/helpers/transaction-system.cjs');
const observe=(id,details)=>console.log(JSON.stringify({id,...details}));
function fixture(){const e=system();e.actor({role:'ADMIN'});e.context.getWorkDaysConfig_=()=>({totalWorkDays:27,workDaysPassed:21,workDaysRemaining:6});return e;}
function dashboard(e){const r=e.context.kchApi('MOCK','getDashboardMetrics',[{period:'CUSTOM',startDate:'2026-10-25',endDate:'2026-10-25'}]);assert.equal(r.success,true,r.message);return r;}
function addTable(e,name,headers){const c=e.context,ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),requests=[];c.txAddSheet_(meta,requests,name,headers,false);c.txBatch_(ctx,requests);}
{
 const e=fixture();e.rows('SALES')[1][2]='Canvasser';e.rows('PRICE_MASTER').slice(1).forEach(r=>r[1]='Canvasser');
 const saved=e.save();assert.equal(saved.success,true,saved.message);const r=dashboard(e),team=r.teamAchievements.find(t=>t.teamName==='Canvasser');
 assert.equal(r.kpi.totalSales,200);assert.equal(team.achieved,0);
 observe('A01',{case:'Canvasser sale included in branch but missing from team chart',branchSales:r.kpi.totalSales,canvasserSales:team.achieved,leaderboardSales:r.salesPerformance.find(s=>s.salesId==='S1').achieved});
}
{
 const e=fixture();e.rows('SALES')[0].push('target_monthly');e.rows('SALES')[1].push(30000000);e.rows('SALES')[1][2]='Canvasser';e.rows('SALES')[2].push(27000000);
 const metadata=e.context.kchApi('MOCK','getInitialAppMetadata',[]),r=dashboard(e);assert.equal(metadata.success,true,metadata.message);
 e.actor({role:'GUEST'});const monthly=e.context.kchApi('MOCK','getMonthlyTeamReport',['2026-10','S1']);assert.equal(monthly.success,true,monthly.message);
 const profile=metadata.sales.find(s=>s.sales_id==='S1'),dash=r.salesPerformance.find(s=>s.salesId==='S1');assert.equal(profile.target_monthly,80000000);assert.equal(dash.monthlyTarget,30000000);
 observe('A02',{case:'Same sales target differs by screen',rawTarget:30000000,profileTarget:profile.target_monthly,dashboardTarget:dash.monthlyTarget,monthlyReportTarget:monthly.sales.targetMonthly});
}
{
 const e=fixture();e.rows('SALES')[0].push('target_monthly');e.rows('SALES')[1].push(27000000);e.rows('SALES')[2].push(27000000);e.rows('SALES')[2][3]='INACTIVE';
 const r=dashboard(e);assert.equal(r.kpi.totalTarget,54000000);assert.ok(r.salesPerformance.some(s=>s.salesId==='S2'));
 observe('A03',{case:'Inactive sales still contributes to current branch target',activeSales:1,inactiveSales:1,branchTarget:r.kpi.totalTarget,inactiveInLeaderboard:true});
}
{
 const e=fixture();assert.equal(e.save().success,true);e.rows('SALES_TRANSACTIONS')[1][1]='2026-10-25 00:00:00';
 const read=date=>e.context.kchApi('MOCK','getTransactionsPaginated',[1,10,'','ALL','ALL',date]);const all=read(''),filtered=read('2026-10-25');
 assert.equal(all.totalRows,1);assert.equal(filtered.totalRows,0);const exported=e.context.kchApi('MOCK','getAllTransactionsForExport',['','ALL','ALL','2026-10-25']);assert.equal(exported.success,true);assert.equal(exported.data.length,0);
 observe('A04',{case:'Timestamp date disappears under calendar filter and filtered export',withoutFilter:all.totalRows,withDateFilter:filtered.totalRows,exportRows:exported.data.length});
}
{
 const e=fixture();e.actor({role:'GUEST'});const read=()=>e.context.kchApi('MOCK','getMonthlyTeamReport',['2026-09','S1']);const old=read();e.rows('SALES')[1][2]='Canvasser';const changed=read();
 assert.equal(old.sales.targetMonthly,27000000);assert.equal(changed.sales.targetMonthly,80000000);
 observe('A05',{case:'Historical monthly report uses current sales team and target',period:'2026-09',beforeTeamChange:old.sales,afterTeamChange:changed.sales});
}
{
 const e=fixture();addTable(e,'STOCK_PICKUPS',e.context.KCH_STOCK_SCHEMAS_.STOCK_PICKUPS);const hs=e.rows('STOCK_PICKUPS')[0];
 for(let i=0;i<501;i++){const r={pickup_id:'PICK-AUDIT-'+i,pickup_date:'2026-10-25',sales_id:'S1',photo_file_id:'AUDIT_ONLY_PRIVATE_IMAGE_00000000'};e.rows('STOCK_PICKUPS').push(hs.map(h=>r[h]??''));}
 const visible=e.context.kchApi('MOCK','getStockPickupData',[]);assert.equal(visible.pickups.length,500);
 let error='';try{e.context.kchApi('MOCK','getStockPickupEvidence',['PICK-AUDIT-0']);}catch(err){error=err.message;}assert.match(error,/Bukti foto tidak ditemukan/);
 observe('A06',{case:'Old active pickup proof cannot be resolved beyond the last 500 rows',storedRows:501,visibleRows:visible.pickups.length,oldestProofError:error});
}
{
 const e=fixture(),c=e.context;addTable(e,'ATTENDANCE',c.TABLE_SCHEMAS.ATTENDANCE);addTable(e,c.KCH_ARCHIVE_ROWS_,c.KCH_ARCHIVE_SCHEMAS_[c.KCH_ARCHIVE_ROWS_]);c.PropertiesService.getScriptProperties().setProperty('KCH_MONTHLY_ARCHIVE_ENABLED','TRUE');
 const hs=e.rows('ATTENDANCE')[0];for(let i=0;i<10;i++){const r={date:'2026-10-25',sales_id:'S1',photo_url:'https://drive.google.com/file/d/AUDIT_PRIVATE_IMAGE_'+String(i).padStart(24,'0')+'/view',status:'HADIR'};e.rows('ATTENDANCE').push(hs.map(h=>r[h]??''));}
 c.DriveApp={getFileById:()=>({getBlob:()=>({getContentType:()=> 'image/jpeg',getBytes:()=>[1,2]})})};c.Utilities.base64Encode=b=>Buffer.from(b).toString('base64');
 const list=c.kchApi('MOCK','getAttendanceByDate',['2026-10-25']);assert.equal(list.attendance.length,10);e.calls.length=0;
 for(const row of list.attendance)assert.equal(c.kchApi('MOCK','getSalesPhotoEvidence',['attendance',row.photoRef]).success,true);
 const archiveReads=e.calls.filter(r=>r.url.includes('/values:batchGet')&&decodeURIComponent(r.url).includes(c.KCH_ARCHIVE_ROWS_));assert.equal(archiveReads.length,10);
 observe('A07',{case:'Ten uncached photos each reread full attendance and combined archive',photos:10,sheetsApiCalls:e.calls.length,combinedArchiveReads:archiveReads.length,excludesRealAuthAndDriveLatency:true});
}
{
 const e=fixture();assert.equal(e.save().success,true);e.remove('SALES_TRANSACTIONS');const r=dashboard(e),exported=e.context.kchApi('MOCK','getAllTransactionsForExport',['','ALL','ALL','']);assert.equal(r.kpi.totalSales,0);assert.equal(exported.success,true);assert.equal(exported.data.length,0);
 observe('A08',{case:'Missing transaction sheet is treated as a valid zero-sales source',dashboardSuccess:r.success,totalSales:r.kpi.totalSales,exportSuccess:exported.success,exportRows:exported.data.length});
}
{
 const e=fixture(),c=e.context;addTable(e,'TODAY_PLAN',Array.from(c.TODAY_PLAN_HEADERS));addTable(e,'WEEKLY_MEETINGS',Array.from(c.WEEKLY_MEETING_HEADERS));
 const plans=c.kchApi('MOCK','saveTodayPlan',[{date:'2026-11-31',salesId:'S1',destination:'Audit only'}]);const meetings=c.kchApi('MOCK','saveWeeklyMeeting',[{date:'2026-11-31',title:'Audit only',summary:'Audit only'}]);
 assert.equal(plans.success,true,plans.message);assert.equal(meetings.success,true,meetings.message);
 observe('A09',{case:'Impossible dates remain accepted outside attendance/visit/financial forms',input:'2026-11-31',todayPlanSuccess:plans.success,planStoredDate:String(e.rows('TODAY_PLAN')[1][1]),meetingSuccess:meetings.success,meetingStoredDate:String(e.rows('WEEKLY_MEETINGS')[1][1])});
}
{
 const e=fixture(),c=e.context;addTable(e,'TODAY_PLAN',Array.from(c.TODAY_PLAN_HEADERS));const result=c.kchApi('MOCK','saveTodayPlan',[{date:'2026-10-25',salesId:'S1',destination:'=1+1',notes:'=2+2'}]);assert.equal(result.success,true,result.message);
 const hs=e.rows('TODAY_PLAN')[0],row=e.rows('TODAY_PLAN')[1];assert.equal(row[hs.indexOf('destination')],'=1+1');
 observe('A10',{case:'Plan user text reaches native Sheets appendRow as an unescaped formula string',destinationPassedToSetter:row[hs.indexOf('destination')],notesPassedToSetter:row[hs.indexOf('notes')],note:'Mock records setter input; no real Google formula was executed. Admin-only route.'});
}
{
 const e=fixture(),c=e.context;e.rows('INVENTORY')[1][2]=1000;const originalBook=c.getKchSpreadsheet_;
 c.getKchSpreadsheet_=()=>{const book=originalBook(),originalSheet=book.getSheetByName;book.getSheetByName=name=>{const sheet=originalSheet(name);if(sheet&&name==='INVENTORY'){const originalRange=sheet.getRange;sheet.getRange=(...args)=>{const range=originalRange(...args);range.getDisplayValues=()=>range.getValues().map(row=>row.map(v=>typeof v==='number'?v.toLocaleString('en-US'):String(v)));return range;};}return sheet;};return book;};
 const result=c.kchApi('MOCK','getInitialAppMetadata',[]);assert.equal(result.success,true,result.message);const shown=result.inventory.find(r=>r.product_id==='P1')['PT. Global Mitra Prima'];assert.equal(shown,1);
 observe('A11',{case:'Inventory metadata depends on display locale instead of numeric cell value',numericCellValue:e.stock(),displayedCell:'1,000',metadataStock:shown,note:'Conditional on sheet formatting/locale; live locale not inspected.'});
}
{
 const e=system({financialFault:'unknownBefore'});e.actor({role:'ADMIN'});const first=e.save();assert.equal(first.state,'PENDING');e.options.financialFault=null;const status=e.status();const next=e.save({requestId:'REQ-AUDIT-SECOND-00000001'});assert.equal(status.state,'PENDING');assert.equal(next.state,'PENDING');assert.equal(e.stock(),10);
 observe('A12',{case:'Unresolved receipt holds all subsequent financial/photo writes until reconciled',originalState:first.state,statusAfterConnectionRecovers:status.state,newRequestState:next.state,stockUnchanged:e.stock()===10,note:'Intentional safety guard, but no guided Admin reconciliation operation exists. The original ambiguous provider request might still commit; never delete PENDING to unblock.'});
}
