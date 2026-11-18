const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {system} = require('./helpers/transaction-system.cjs');

const password = 'fixture-password-2026';

function fixture() {
  const e = system(), c = e.context;
  const root = path.resolve(__dirname, '..');
  for (const file of ['auth.gs','score.gs','canvasser-incentives.gs','incentives.gs']) {
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
  }
  c.KCH_GUEST_PASSWORD_ITERATIONS_ = 1000;
  const owner = c.KCH_BOOTSTRAP_ADMIN_EMAIL_;
  const branch = 'supervisor@example.test';
  const google = {
    owner:{email:owner,uid:'owner-uid',name:'Owner'},
    branch:{email:branch,uid:'branch-uid',name:'Supervisor'},
    outsider:{email:'outsider@example.test',uid:'other-uid',name:'Other'}
  };
  c.verifyFirebaseIdentity_ = token => ({...google[token]});
  function add(name,headers,records=[]) {
    const ctx = {id:'test-book',token:'TEST_ONLY_OAUTH'}, meta = c.txMetadata_(ctx), requests = [];
    const sheet = c.txAddSheet_(meta,requests,name,headers,false);
    if (records.length) requests.push(c.txAppend_(sheet.sheetId,records.map(row=>headers.map(h=>row[h] ?? ''))));
    c.txBatch_(ctx,requests);
  }
  add('ACCESS_USERS',Array.from(c.KCH_ACCESS_HEADERS_));
  const call = (token,method,...args) => c.kchApi(token,method,args);
  const save = (salesId,username,pwd=password,status='ACTIVE') => call('owner','saveSalesCredentials',{salesId,username,password:pwd,status});
  return {...e,c,call,save,add,branch,google};
}

test('only the primary Admin manages accounts, while a registered Google branch Admin has normal Admin access', () => {
  const e = fixture();
  assert.equal(e.call('owner','getAuthProfile').user.canManageAccounts,true);
  assert.throws(()=>e.call('branch','getAuthProfile'),/ACCESS_DENIED/);
  assert.throws(()=>e.call('outsider','getAuthProfile'),/ACCESS_DENIED/);
  e.call('owner','saveBranchAdmin',{email:e.branch.toUpperCase(),status:'ACTIVE'});
  const profile = e.call('branch','getAuthProfile').user;
  assert.equal(profile.role,'ADMIN');
  assert.equal(profile.canManageAccounts,false);
  assert.equal(e.call('branch','getInitialAppMetadata').sales.length,2);
  for (const method of ['listAccessUsers','saveBranchAdmin','saveSalesCredentials','saveAccessUser','saveGuestCredentials']) {
    assert.throws(()=>e.call('branch',method,{}),/Admin utama/,method);
  }
  assert.equal(e.call('branch','saveMyProfile',{displayName:'Supervisor Baru'}).success,true);
  assert.equal(e.call('branch','getAuthProfile').user.fullName,'Supervisor Baru');
  e.call('owner','saveBranchAdmin',{email:e.branch,status:'INACTIVE'});
  assert.throws(()=>e.call('branch','getAuthProfile'),/AUTH_REQUIRED.*tidak aktif/);
  e.call('owner','saveBranchAdmin',{email:e.branch,status:'ACTIVE'});
  e.google.branch.uid='changed-uid';
  assert.throws(()=>e.call('branch','getAuthProfile'),/Identitas akun berubah/);
});

test('Sales credentials bind to an existing Sales ID and password or status changes revoke its sessions', () => {
  const e = fixture(), c = e.c;
  const business = JSON.stringify([e.rows('SALES'),e.rows('INVENTORY'),e.rows('SALES_TRANSACTIONS')]);
  assert.throws(()=>e.save('unknown','unknown'),/Profil Sales/);
  e.save('s1','Anita');
  assert.throws(()=>e.save('S2','anita'),/Username sudah dipakai/);
  e.save('S2','budi');
  assert.throws(()=>c.kchSalesLogin('anita','different-password'),/salah/);
  const one = c.kchSalesLogin('ANITA',password), two = c.kchSalesLogin('budi',password);
  assert.equal(one.user.salesId,'S1');
  assert.equal(two.user.salesId,'S2');
  assert.equal(e.call(one.token,'getAuthProfile').user.uid,one.user.uid);
  const accounts = JSON.stringify(e.call('owner','listAccessUsers'));
  assert.match(accounts,/anita/);
  assert.doesNotMatch(accounts,/hash|salt|fixture-password/);
  const sheet = e.rows('ACCESS_USERS'), passwordColumn = sheet[0].indexOf('password');
  const savedPassword = () => e.rows('ACCESS_USERS').find(row => row[2] === 'S1')[passwordColumn];
  assert.equal(savedPassword(),password);
  assert.throws(()=>e.call(one.token,'listAccessUsers'),/ACCESS_DENIED/);
  e.save('S1','anita','=rotated-password-2026');
  assert.throws(()=>e.call(one.token,'getAuthProfile'),/AUTH_REQUIRED/);
  const updated = c.kchSalesLogin('anita','=rotated-password-2026');
  assert.equal(savedPassword(),'=rotated-password-2026');
  assert.equal(updated.user.uid,one.user.uid);
  e.save('S1','anita','','INACTIVE');
  assert.equal(savedPassword(),'=rotated-password-2026');
  assert.throws(()=>e.call(updated.token,'getAuthProfile'),/AUTH_REQUIRED/);
  assert.equal(e.call(two.token,'getAuthProfile').user.salesId,'S2');
  c.kchGuestLogout(two.token);
  assert.throws(()=>e.call(two.token,'getAuthProfile'),/AUTH_REQUIRED/);
  assert.equal(JSON.stringify([e.rows('SALES'),e.rows('INVENTORY'),e.rows('SALES_TRANSACTIONS')]),business);
});

test('Sales reads only its own transactions, attendance, dashboard and archive, and submits only for itself', () => {
  const e = fixture(), c = e.c;
  e.save('S1','anita');
  e.save('S2','budi');
  const one = c.kchSalesLogin('anita',password).token;
  const two = c.kchSalesLogin('budi',password).token;
  const payload = {date:'2026-10-25',distributor:'D1',notes:'Own invoice',items:[{productId:'P1',qty:1,costPrice:60,sellingPrice:100}]};
  const first = e.call(one,'saveSalesTransaction',{...payload,requestId:'SALES-REQUEST-00000001',salesId:'S1',username:'untrusted'});
  const second = e.call(two,'saveSalesTransaction',{...payload,requestId:'SALES-REQUEST-00000002',salesId:'S2'});
  assert.equal(first.success,true,JSON.stringify(first));
  assert.equal(second.success,true,JSON.stringify(second));
  assert.throws(()=>e.call(one,'saveSalesTransaction',{...payload,requestId:'SALES-REQUEST-00000003',salesId:'S2'}),/ACCESS_DENIED/);
  assert.throws(()=>e.call(one,'saveSalesPhotoUpload',{salesId:'S2'},'visit'),/ACCESS_DENIED/);
  assert.equal(e.call(one,'getTransactionDetail',second.transactionId).success,false);
  assert.equal(e.call(one,'getSalesTransactionForEdit',second.transactionId).success,false);
  assert.equal(e.call(one,'getSalesTransactionForEdit',first.transactionId).success,true);
  assert.equal(e.call(one,'editSalesTransaction',{...payload,transactionId:second.transactionId,requestId:'SALES-REQUEST-00000004',salesId:'S1'}).success,false);
  assert.equal(e.call(one,'getSalesTransactionRequestStatus','SALES-REQUEST-00000002').state,'NOT_FOUND');
  assert.doesNotMatch(JSON.stringify(e.call(one,'getAllTransactionsForExport')),/Sales Two|untrusted/);
  assert.doesNotMatch(JSON.stringify(e.call(one,'getDashboardMetrics',{period:'TODAY'})),/Sales Two/);
  assert.throws(()=>e.call(one,'getMonthlyTeamReport','2026-10','S2'),/ACCESS_DENIED/);
  assert.equal(e.call(one,'getMonthlyTeamReport','2026-10','S1').success,true);
  assert.equal(e.exists('MONTHLY_TEAM_REPORT'),false);
  assert.throws(()=>e.call(one,'getScoreTeamSummary','2026-10'),/ACCESS_DENIED/);
  const people = [{sales_id:'S1',date:'2026-10-25',status:'HADIR'},{sales_id:'S2',date:'2026-10-25',status:'HADIR'}];
  e.add('ATTENDANCE',Array.from(c.TABLE_SCHEMAS.ATTENDANCE),people);
  assert.deepEqual(Array.from(e.call(one,'getAttendanceByDate','2026-10-25').attendance,row=>row.salesId),['S1']);
  e.add('_KCH_MONTHLY_ARCHIVES',Array.from(c.KCH_ARCHIVE_SCHEMAS_._KCH_MONTHLY_ARCHIVES),[{month:'2026-09',status:'COMPLETED',snapshot_url:'private'}]);
  e.add('_KCH_ARCHIVE_ROWS',Array.from(c.KCH_ARCHIVE_SCHEMAS_._KCH_ARCHIVE_ROWS),people.map(row=>({
    month:'2026-09',sheet_name:'ATTENDANCE',headers_json:'["sales_id","date"]',values_json:JSON.stringify([row.sales_id,row.date])
  })));
  const archives=e.call(one,'getMonthlyArchives');
  assert.equal(archives.months[0].rows,1);
  assert.equal(archives.canOpenSnapshot,false);
  assert.equal(archives.months[0].snapshotUrl,undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(e.call(one,'getMonthlyArchiveTable','2026-09','ATTENDANCE',1).rows)),[['S1','2026-10-25']]);
});

test('Sales can maintain its own plan and read only its own stock, pickups and deposits', () => {
  const e = fixture(), c = e.c;
  e.save('S1','anita');
  const token=c.kchSalesLogin('anita',password).token;
  e.add('TODAY_PLAN',Array.from(c.TODAY_PLAN_HEADERS),[
    {plan_id:'PLAN-OTHER',plan_date:'2026-10-25',sales_id:'S2',destination:'Other Sales',status:'ACTIVE'}
  ]);
  const plan={date:'2026-10-25',salesId:'S1',destination:'Own Sales'};
  assert.equal(e.call(token,'saveTodayPlan',{...plan,salesId:'S2'}).success,false);
  assert.equal(e.call(token,'saveTodayPlan',{...plan,planId:'PLAN-OTHER'}).success,false);
  assert.equal(e.call(token,'archiveTodayPlan','PLAN-OTHER').success,false);
  const saved=e.call(token,'saveTodayPlan',plan);
  assert.equal(saved.success,true,JSON.stringify(saved));
  assert.equal(e.call(token,'getTodayPlans','2026-10-25').plans.length,1);
  assert.equal(e.call(token,'archiveTodayPlan',saved.planId).success,true);
  for (const [name,id] of [['SALES_STOCK','product_id'],['STOCK_PICKUPS','pickup_id'],['SALES_CASH_DEPOSITS','deposit_id']]) {
    const rows=[{sales_id:'S1',[id]:'OWN',quantity:1,photo_file_id:'own-private-file'},{sales_id:'S2',[id]:'OTHER',quantity:1,photo_file_id:'other-private-file'}];
    e.add(name,Array.from(c.KCH_STOCK_SCHEMAS_[name]),rows);
  }
  const stock=e.call(token,'getStockPickupData',{});
  assert.equal(stock.holdings.length,1);
  assert.equal(stock.pickupTotal,1);
  assert.equal(stock.depositTotal,1);
  assert.equal(stock.pickups[0].photo_file_id,true);
  assert.doesNotMatch(JSON.stringify(stock),/OTHER|private-file|Sales Two/);
  for (const method of ['getStockPickupEvidence','getSalesCashDepositEvidence']) {
    assert.throws(()=>e.call(token,method,'OTHER'),/ACCESS_DENIED/);
  }
});
