const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {system}=require('./helpers/transaction-system.cjs');
function env(){const e=system(),c=e.context;for(const f of ['score.gs','canvasser-incentives.gs','incentives.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);e.actor({role:'ADMIN'});return {...e,c};}
test('guest RPC sanitizes nested credentials, raw cell arrays, backup links and actor metadata without changing business values or source rows',()=>{
 const e=env(),payload={success:true,totalSales:123,stock:5,user:{role:'GUEST'},rows:[{sales_id:'S1',quantity:3,password:'never',password_hash:'HASH',api_token:'TOKEN',secret:'SECRET',snapshot_url:'PRIVATE',backupUrl:'BACKUP',created_by:'admin@private',actor_email:'admin@private',_cells:['all raw secrets'],nested:{result_json:'PRIVATE',amount:25000}}],recentActivities:[{details:'SECRET AUDIT'}]},before=JSON.stringify(payload);
 e.c.getStockPickupData_=()=>payload;e.actor({role:'GUEST'});const guest=e.c.kchApi('T','getStockPickupData',[]);assert.equal(guest.rows[0].quantity,3);assert.equal(guest.rows[0].nested.amount,25000);assert.equal(guest.stock,5);assert.equal(guest.recentActivities.length,0);assert.ok(!JSON.stringify(guest).includes('PRIVATE'));assert.ok(!JSON.stringify(guest).includes('HASH'));assert.ok(!JSON.stringify(guest).includes('SECRET'));assert.ok(!JSON.stringify(guest).includes('TOKEN'));assert.ok(!JSON.stringify(guest).includes('admin@private'));assert.equal(JSON.stringify(payload),before);
 e.actor({role:'ADMIN'});const admin=e.c.kchApi('T','getStockPickupData',[]);assert.equal(JSON.stringify(admin),before);
});
test('guest never receives dashboard audit logs, actor emails or edit revisions from score responses',()=>{
 const e=env();e.actor({role:'GUEST'});e.c.getDashboardMetrics_=()=>({success:true,recentActivities:[{username:'admin',details:'PRIVATE'}],kpi:{totalSales:200}});assert.equal(e.c.kchApi('T','getDashboardMetrics',[{}]).recentActivities.length,0);
 e.c.getScoreReport_=()=>({success:true,total:75,dailyAA:[{count:10,revision:'EVENT-ID',actor:'admin@private',updatedAt:'2026-10-25'}]});const score=e.c.kchApi('T','getScoreReport',['2026-10','S1']);assert.equal(score.total,75);assert.equal(score.dailyAA[0].count,10);assert.ok(!Object.hasOwn(score.dailyAA[0],'actor'));assert.ok(!Object.hasOwn(score.dailyAA[0],'revision'));
 e.c.KCH_REQUEST_USER_={role:'GUEST'};assert.equal(e.c.filterAuthorizedRows_('ACTIVITY_LOGS',[{details:'PRIVATE'}]).length,0);
});
test('private native sheets and account operations stay inaccessible even when a guest calls the gateway directly',()=>{
 const e=env();e.actor({role:'GUEST'});for(const name of ['listAccessUsers','saveGuestCredentials','setupArsipBulanan','setupKchSheetUpdates','siapkanAwalNovember','checkKchTransactionSetup'])assert.throws(()=>e.c.kchApi('T',name,[]),/ACCESS_DENIED/);
 e.c.KCH_REQUEST_USER_={role:'GUEST'};for(const name of ['ACCESS_USERS','USERS','PEMBARUAN_SHEET','SKOR_EVENTS','_KCH_MONTHLY_ARCHIVES','_KCH_ARCHIVE_ROWS','_KCH_TX_REQUESTS','_KCH_TX_EDITS'])assert.equal(e.c.filterAuthorizedRows_(name,[{password:'PRIVATE'}]).length,0,name);
});
