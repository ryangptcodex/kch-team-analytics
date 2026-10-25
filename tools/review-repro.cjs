// Review-only reproductions with in-memory Sheets and authenticated-user mocks.
// No Google/Firebase network requests or real spreadsheet mutations are made.
// Prints observed behavior; these observations are NOT a passing regression suite.
// Run from the repository: node tools/review-repro.cjs
const fs=require('fs'),vm=require('vm');
const path=require('node:path');
const root=path.resolve(__dirname, '..')+path.sep;
function app(opts={}){
 const sheets={};let failed=opts.failSheet;
 function create(name,rows){sheets[name]={rows,getLastRow:()=>rows.length,getLastColumn:()=>Math.max(...rows.map(r=>r.length),0),appendRow:r=>rows.push([...r]),getRange(r,c,h=1,w=1){const range={getValues:()=>Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>rows[r-1+y]?.[c-1+x]??'')),getDisplayValues:()=>range.getValues().map(r=>r.map(v=>String(v))),setValue:v=>range.setValues([[v]]),setValues(values){if(failed===name)throw Error('SIMULATED_WRITE_FAILURE');values.forEach((row,y)=>row.forEach((v,x)=>{rows[r-1+y]??=[];rows[r-1+y][c-1+x]=v}));return range;},setNumberFormat(){return range}};return range;}};}
 const context={console,SpreadsheetApp:{flush(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{formatDate:(d,t,f)=>f==='yyyyMMdd'?'20261025':f==='yyyy-MM-dd'?'2026-10-25':f==='yyyy-MM'?'2026-10':'25/10/2026 12:00:00'}};vm.createContext(context);
 for(const f of ['firebase-config.gs','code.gs','setup.gs','auth.gs'])vm.runInContext(fs.readFileSync(root+f,'utf8'),context);
 create('SALES',[['sales_id','full_name','team_name','status'],['S1','Test Sales','Motoris','ACTIVE']]);
 create('PRODUCTS',[['product_id','product_name','status'],['P1','Test Product',opts.productStatus||'ACTIVE']]);
 create('PRICE_MASTER',[['product_id','team_name','cost_price','selling_price','shj','status'],['P1','Motoris',60,100,10,'ACTIVE']]);
 create('INVENTORY',[['product_id','PT. Global Mitra Prima','AP. Geubrina Rizki'],['P1',10,0]]);
 create('SALES_TRANSACTIONS',[[...context.TABLE_SCHEMAS.SALES_TRANSACTIONS]]);
 create('INVENTORY_MOVEMENTS',[[...context.TABLE_SCHEMAS.INVENTORY_MOVEMENTS]]);
 create('ACTIVITY_LOGS',[[...context.TABLE_SCHEMAS.ACTIVITY_LOGS]]);
 context.getKchSpreadsheet_=()=>({getSheetByName:n=>sheets[n]||null,insertSheet:n=>{create(n,[]);return sheets[n]}});
 context.verifyFirebaseIdentity_=()=>({uid:'test',email:'test@example.test'});
 context.resolveAccessUser_=()=>({uid:'test',email:'test@example.test',username:'test@example.test',salesId:'S1',role:'SALES',fullName:'Test Sales'});
 function save(items,other={}){return context.kchApi('mock-token','saveSalesTransaction',[{salesId:'S1',date:'2026-10-25',distributor:'PT. Global Mitra Prima',items,...other}]);}
 return{context,sheets,create,save,unfail:()=>{failed=null},stock:()=>sheets.INVENTORY.rows[1][1],tx:()=>sheets.SALES_TRANSACTIONS.rows.slice(1)};
}
const item=(qty,extra={})=>({productId:'P1',qty,costPrice:60,sellingPrice:100,...extra});
function result(label,e,r){console.log(JSON.stringify({case:label,success:r.success,stock:e.stock(),txRows:e.tx().length,totals:r.totalSales,message:r.message}));}
let e=app();result('duplicate product qty6+6 against stock10',e,e.save([item(6),item(6)]));
e=app();result('negative qty -2',e,e.save([item(-2)]));
e=app();result('zero qty',e,e.save([item(0)]));
e=app();result('browser prices override master60/100',e,e.save([item(1,{costPrice:0,sellingPrice:1})]));console.log(JSON.stringify({case:'persisted tampered prices',cost:e.tx()[0][9],sell:e.tx()[0][10]}));
e=app({failSheet:'SALES_TRANSACTIONS'});result('transaction write fails after stock update',e,e.save([item(2)]));
e=app({failSheet:'INVENTORY_MOVEMENTS'});result('movement write fails after transaction saved',e,e.save([item(2)]));e.unfail();result('retry after previous failure',e,e.save([item(2)]));
e=app();e.save([item(2)],{requestId:'same-request'});result('same request submitted twice',e,e.save([item(2)],{requestId:'same-request'}));
e=app();result('invalid date accepted',e,e.save([item(1)],{date:'2026-99-99'}));
e=app();result('unknown distributor reduces global stock',e,e.save([item(1)],{distributor:'Unknown Distributor'}));
e=app({productStatus:'INACTIVE'});result('inactive product accepted',e,e.save([item(1)]));
e=app();e.save([item(1)],{notes:'=SUM(1,2)'});console.log(JSON.stringify({case:'formula text forwarded unchanged into notes cell',notes:e.tx()[0][15]}));
e=app();e.save([item(1)]);e.sheets.SALES_TRANSACTIONS.rows[1][1]='2026-10-25 00:00:00';console.log(JSON.stringify({case:'date filter with formatted Date cell',withoutFilter:e.context.kchApi('t','getTransactionsPaginated',[1,10,'','ALL','ALL','']).totalRows,withFilter:e.context.kchApi('t','getTransactionsPaginated',[1,10,'','ALL','ALL','2026-10-25']).totalRows}));
e=app();e.save([item(1)]);console.log(JSON.stringify({case:'SHJ master differs from saved',masterShj:10,savedShj:e.tx()[0][11]}));
e=app();e.context.KCH_REQUEST_USER_={role:'ADMIN',email:'test@example.test',username:'test@example.test'};e.sheets.SALES.rows[0].push('target_monthly');e.sheets.SALES.rows[1][2]='Canvasser';e.sheets.SALES.rows[1].push(30000000);e.context.getWorkDaysConfig_=()=>({totalWorkDays:27,workDaysPassed:21,workDaysRemaining:6});e.context.getHolidayDateMap_=()=>({});const meta=e.context.getInitialAppMetadata_(),dash=e.context.getDashboardMetrics_({period:'TODAY'});console.log(JSON.stringify({case:'same Canvasser target30000000 interpreted differently',metadataSuccess:meta.success,metadataTarget:meta.sales?.[0].target_monthly,dashboardSuccess:dash.success,dashboardTarget:dash.kpi?.totalTarget,error:dash.message}));

function photoApp(){const e=app();e.create('ATTENDANCE',[[...e.context.TABLE_SCHEMAS.ATTENDANCE]]);let trashed=false;const file={setSharing(){},getUrl:()=> 'https://example.test/photo',setTrashed(){trashed=true}};e.context.Utilities.base64Decode=s=>[...Buffer.from(s,'base64')];e.context.Utilities.newBlob=()=>({});e.context.Utilities.getUuid=()=> 'test-uuid';const format=e.context.Utilities.formatDate;e.context.Utilities.formatDate=(d,t,f)=>f==='HH:mm:ss'?'23:59:00':format(d,t,f);e.context.DriveApp={Access:{ANYONE_WITH_LINK:'public-link'},Permission:{VIEW:'view'}};e.context.getPhotoUploadFolder_=()=>({createFile:()=>file});e.photo=(date,notes='Test')=>e.context.kchApi('mock','saveSalesPhotoUpload',[{salesId:'S1',date,notes,imageDataUrl:'data:image/jpeg;base64,/9j/'},'attendance']);e.trashed=()=>trashed;return e;}
e=photoApp();let r=e.photo('2030-01-01');console.log(JSON.stringify({case:'future attendance accepted and marked on time at23:59',success:r.success,status:e.sheets.ATTENDANCE.rows[1]?.[6],time:e.sheets.ATTENDANCE.rows[1]?.[4]}));
e=photoApp();r=e.photo('2026-02-31');console.log(JSON.stringify({case:'impossible attendance date accepted',success:r.success,storedDate:e.sheets.ATTENDANCE.rows[1]?.[3]?.toISOString()}));
e=photoApp();e.context.SpreadsheetApp.flush=()=>{throw Error('SIMULATED_FLUSH_FAILURE')};r=e.photo('2026-10-25');console.log(JSON.stringify({case:'photo failure after row append',success:r.success,savedAttendanceRows:e.sheets.ATTENDANCE.rows.length-1,fileTrashed:e.trashed()}));
e=app();e.sheets.SALES.rows[1][2]='Canvasser';e.save([item(1)]);e.context.KCH_REQUEST_USER_={role:'ADMIN',email:'test@example.test'};e.context.getWorkDaysConfig_=()=>({totalWorkDays:27,workDaysPassed:21,workDaysRemaining:6});e.context.getHolidayDateMap_=()=>({});const chart=e.context.getDashboardMetrics_({period:'TODAY'});console.log(JSON.stringify({case:'Canvasser chart total differs from branch sales',success:chart.success,branchSales:chart.kpi?.totalSales,canvasserSales:chart.teamAchievements?.find(t=>t.teamName==='Canvasser')?.achieved}));
e=app();e.context.getTransactionsPaginated_=()=>({success:false,message:'SIMULATED_READ_FAILURE'});console.log(JSON.stringify({case:'export hides upstream read failure',result:e.context.getAllTransactionsForExport_('','ALL','ALL','')}));

e=app();delete e.sheets.INVENTORY_MOVEMENTS;result('missing movement sheet still allows sale',e,e.save([item(1)]));
