const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const headers = ['email', 'firebase_uid', 'sales_id', 'role', 'status', 'created_at', 'updated_at'];

const {environment} = require('./helpers/auth-environment.cjs');

test('rejects missing token without querying Google or creating access sheet', () => {
  const e = environment({ access: false });
  assert.throws(() => e.context.kchApi('', 'getAuthProfile', []), /AUTH_REQUIRED/);
  assert.equal(e.lookupCalls(), 0); assert.equal(e.sheets.has('ACCESS_USERS'), false);
});
test('editor diagnostic expects an invalid token response without reading sales data', () => {
  const e = environment({ access: false, lookupCode: 400, lookupBody: { error: { message: 'INVALID_ID_TOKEN' } } });
  const report = e.context.checkKchGoogleConnection_();
  assert.equal(report.connectionOk, true); assert.equal(report.httpStatus, 400);
  assert.equal(e.sheets.has('ACCESS_USERS'), false);
});
test('visible editor diagnostic requires the active Google admin account', () => {
  for (const editorEmail of ['', 'sales@gmail.com']) {
    const e = environment({ editorEmail });
    assert.throws(() => e.context.checkKchGoogleConnection(), /ACCESS_DENIED/);
    assert.equal(e.lookupCalls(), 0);
  }
  const e = environment({ editorEmail: 'admin@gmail.com', access: false,
    lookupCode: 400, lookupBody: { error: { message: 'INVALID_ID_TOKEN' } } });
  assert.equal(e.context.checkKchGoogleConnection().connectionOk, true);
  assert.equal(e.sheets.has('ACCESS_USERS'), false);
});
test('diagnostic distinguishes API and fetch errors and redacts API key', () => {
  const e = environment({ lookupCode: 403, lookupBody: { error: { message: 'API_KEY_HTTP_REFERRER_BLOCKED' } } });
  assert.equal(e.context.checkKchGoogleConnection_().connectionOk, false);
  const key = e.context.KCH_FIREBASE_WEB_CONFIG_.apiKey;
  const failed = environment({ networkError: 'Required permission: script.external_request; key=' + key });
  const report = failed.context.checkKchGoogleConnection_();
  assert.equal(report.stage, 'FETCH'); assert.match(report.message, /script.external_request/);
  assert.ok(!report.message.includes(key));
});
test('rejects expired, wrong-project and non-Google tokens', () => {
  for (const claims of [{ exp: 1 }, { aud: 'another-project' }, { iss: 'wrong-issuer' }, { firebase: { sign_in_provider: 'password' } }]) {
    const e = environment({ claims }); assert.throws(() => e.call('getAuthProfile'), /AUTH_REQUIRED/); assert.equal(e.lookupCalls(), 0);
  }
});
test('fails closed when Google rejects token or cannot be reached', () => {
  assert.throws(() => environment({ lookupCode: 400 }).call('getAuthProfile'), /AUTH_REQUIRED/);
  assert.throws(() => environment({ networkError: true }).call('getAuthProfile'), /AUTH_UNAVAILABLE/);
});
test('rejects unverified, disabled, wrong UID, non-Google and revoked accounts', () => {
  for (const identity of [{ emailVerified: false }, { disabled: true }, { providerUserInfo: [] }, { validSince: String(Math.floor(Date.now() / 1000) + 100) }]) {
    assert.throws(() => environment({ identity }).call('getAuthProfile'), /AUTH_REQUIRED/);
  }
  assert.throws(() => environment({ claims: { sub: 'forged-uid' } }).call('getAuthProfile'), /AUTH_REQUIRED/);
});
test('unknown account cannot register itself or become admin even with a stored ADMIN role', () => {
  const e = environment({ access: [['other@gmail.com','other-uid','','ADMIN','ACTIVE']], identity: {email:'other@gmail.com',localId:'other-uid'} });
  assert.throws(() => e.call('getAuthProfile'), /hanya tersedia/);
  assert.equal(e.sheets.get('ACCESS_USERS').rows.length,2);
});
test('first verified designated admin bootstraps once', () => {
  const e = environment({ access: false, identity: { email: 'mhmdryyan7@gmail.com', localId: 'owner-uid' } });
  assert.equal(e.call('getAuthProfile').user.role, 'ADMIN');
  e.call('getAuthProfile'); assert.equal(e.sheets.get('ACCESS_USERS').rows.length, 2);
});
test('an inactive designated admin is not automatically re-enabled', () => {
  const e = environment({ access: [['mhmdryyan7@gmail.com', 'owner-uid', '', 'ADMIN', 'INACTIVE']], identity: { email: 'mhmdryyan7@gmail.com', localId: 'owner-uid' } });
  assert.throws(() => e.call('getAuthProfile'), /tidak aktif/);
});
test('Google guest identities are rejected regardless of stored role; only admin uses Google', () => {
  for(const role of ['SALES','ADMIN','GUEST']) {
    const e=environment({access:[['sales@gmail.com','sales-uid','S1',role,'ACTIVE']]});
    assert.throws(()=>e.call('getAuthProfile'),/Login Google hanya tersedia/);
  }
});
test('rejected Google guest never provisions or changes sheet data', () => {
  const e=environment({access:false});assert.throws(()=>e.call('getAuthProfile'),/ACCESS_DENIED/);assert.equal(e.sheets.has('ACCESS_USERS'),false);
});
test('guest UID mismatches and duplicate email rows fail closed', () => {
  for (const access of [
    [['sales@gmail.com', 'different-uid', '', 'GUEST', 'ACTIVE']],
    [['sales@gmail.com', 'sales-uid', '', 'GUEST', 'ACTIVE'], ['sales@gmail.com', 'sales-uid', '', 'GUEST', 'ACTIVE']]
  ]) assert.throws(() => environment({ access }).call('getAuthProfile'), /ACCESS_DENIED/);
});
test('deactivating access takes effect on the next RPC', () => {
  const e = environment({guestSession:true}); e.call('getAuthProfile');
  e.sheets.get('ACCESS_USERS').rows[2][4] = 'INACTIVE';
  assert.throws(() => e.call('getAuthProfile'), /Akses Tamu berubah/);
});
test('legacy seven-column admin access sheets still log in without a schema write', () => {
  const e = environment({identity:{email:'admin@gmail.com',localId:'admin-uid'}});
  assert.equal(e.call('getAuthProfile').user.role, 'ADMIN');
  assert.equal(e.sheets.get('ACCESS_USERS').rows[0].length, 7);
});
test('admin can save a display name and read it again on the next login', () => {
  const e = environment({ identity: { email: 'admin@gmail.com', localId: 'admin-uid', displayName: 'Abangda' } });
  const saved = e.call('saveMyProfile', [{ displayName: '  Ryan Pratama  ' }]);
  assert.equal(saved.user.fullName, 'Ryan Pratama'); assert.equal(saved.user.shortName, 'Ryan');
  assert.equal(e.call('getAuthProfile').user.fullName, 'Ryan Pratama');
  const access = e.sheets.get('ACCESS_USERS').rows;
  assert.equal(access[0][7], 'display_name'); assert.equal(access[1][7], 'Ryan Pratama');
  assert.equal(access[1][3], 'ADMIN'); assert.equal(access[1][1], 'admin-uid');
});
test('changing a Google profile name leaves the same email and UID authorized as admin', () => {
  const e = environment({ identity: { email: 'admin@gmail.com', localId: 'admin-uid', displayName: 'Abangda' } });
  assert.equal(e.call('getAuthProfile').user.fullName, 'Abangda');
  e.identity.displayName = 'Ryan Pratama';
  const user = e.call('getAuthProfile').user;
  assert.equal(user.fullName, 'Ryan Pratama'); assert.equal(user.role, 'ADMIN');
  assert.equal(user.email, 'admin@gmail.com'); assert.equal(user.uid, 'admin-uid');
});
test('invalid admin role is distinguished from inactive account status', () => {
  const e=environment({identity:{email:'admin@gmail.com',localId:'admin-uid'}});e.sheets.get('ACCESS_USERS').rows[1][3]='Sales Coordinator';
  assert.throws(()=>e.call('getAuthProfile'),/Role akun tidak valid/);
  e.sheets.get('ACCESS_USERS').rows[1][3]='ADMIN';e.sheets.get('ACCESS_USERS').rows[1][4]='INACTIVE';assert.throws(()=>e.call('getAuthProfile'),/Akses akun tidak aktif/);
});
test('admin profile updates cannot target guest or change account identity',()=>{
  const e=environment({identity:{email:'admin@gmail.com',localId:'admin-uid'}}),rows=e.sheets.get('ACCESS_USERS').rows,guestBefore=[...rows[2]];
  const r=e.call('saveMyProfile',[{displayName:'Ryan',email:'sales@gmail.com',role:'GUEST',salesId:'S2',uid:'forged'}]);
  assert.equal(r.user.email,'admin@gmail.com');assert.equal(r.user.role,'ADMIN');assert.equal(r.user.uid,'admin-uid');assert.deepEqual(rows[2],guestBefore);assert.equal(rows[1][7],'Ryan');
});
test('admin display-name column preserves unrelated columns',()=>{
  const e=environment({identity:{email:'admin@gmail.com',localId:'admin-uid'}}),rows=e.sheets.get('ACCESS_USERS').rows;rows[0][7]='notes';rows[1][7]='keep';
  e.call('saveMyProfile',[{displayName:'Ryan'}]);assert.equal(rows[1][7],'keep');assert.equal(rows[0][8],'display_name');assert.equal(rows[1][8],'Ryan');
});
test('invalid admin names are rejected before schema or account mutation',()=>{
  for(const displayName of ['', 'A', 'A'.repeat(81), '=IMPORTXML("example")', 'New\nLine', null]){
    const e=environment({identity:{email:'admin@gmail.com',localId:'admin-uid'}}),rows=e.sheets.get('ACCESS_USERS').rows,before=JSON.stringify(rows);
    assert.throws(()=>e.call('saveMyProfile',[{displayName}]),/Nama tampilan tidak valid/);assert.equal(JSON.stringify(rows),before);
  }
});
test('admin profile save rechecks deactivation and UID under lock',()=>{
  for(const change of [r=>r[4]='INACTIVE',r=>r[1]='other-uid']){
    const e=environment({identity:{email:'admin@gmail.com',localId:'admin-uid'}});e.context.KCH_REQUEST_USER_=e.call('getAuthProfile').user;change(e.sheets.get('ACCESS_USERS').rows[1]);
    assert.throws(()=>e.context.saveMyProfile_({displayName:'Ryan'}),/Akses akun berubah/);
  }
});
test('access status edits retain an existing custom display name', () => {
  const e = environment({ identity: { email: 'admin@gmail.com', localId: 'admin-uid' } });
  const rows = e.sheets.get('ACCESS_USERS').rows;
  rows[0][7] = 'display_name'; rows[2][7] = 'Sales Nickname';
  e.call('saveAccessUser', [{ email: 'sales@gmail.com', salesId: 'S1', status: 'INACTIVE' }]);
  assert.equal(rows[2][7], 'Sales Nickname');
});
test('guest cannot invoke any write, edit snapshot, profile, access or request-status endpoint',()=>{
  const e=environment({guestSession:true}),before=JSON.stringify([...e.sheets.values()].map(s=>s.rows));
  for(const method of ['saveMyProfile','listAccessUsers','saveAccessUser','saveTodayPlan','archiveTodayPlan','saveWeeklyMeeting','archiveWeeklyMeeting','saveKchNewsArticle','archiveKchNewsArticle','saveScoreAA','saveScoreBranding','saveSalesTransaction','editSalesTransaction','saveSalesPhotoUpload','getSalesTransactionForEdit','getSalesTransactionRequestStatus','logClientActivity','saveGuestCredentials'])assert.throws(()=>e.call(method,[{}]),/Tamu hanya boleh melihat/);
  assert.equal(JSON.stringify([...e.sheets.values()].map(s=>s.rows)),before);assert.equal(e.context.KCH_REQUEST_USER_,null);
});
test('guest can read all sales history, export and details without changing sheet data',()=>{
  const e=environment({guestSession:true}),before=JSON.stringify([...e.sheets.values()].map(s=>s.rows));
  assert.equal(e.call('getTransactionsPaginated',[1,10]).data.length,2);assert.equal(e.call('getAllTransactionsForExport',[]).data.length,2);assert.equal(e.call('getTransactionDetail',['T2']).success,true);
  assert.equal(JSON.stringify([...e.sheets.values()].map(s=>s.rows)),before);
});
test('admin sees only two configured accounts and can deactivate/reactivate guest, never add a third',()=>{
  const e=environment({identity:{email:'admin@gmail.com',localId:'admin-uid'}});
  const users=e.call('listAccessUsers').users;assert.equal(users.length,2);assert.equal(users[1].role,'GUEST');
  assert.equal(e.call('getTransactionsPaginated',[1,10]).data.length,2);
  assert.throws(()=>e.call('saveAccessUser',[{email:'third@gmail.com',status:'ACTIVE'}]),/tidak dapat ditambahkan/);
  assert.equal(e.call('saveAccessUser',[{email:'sales@gmail.com',status:'INACTIVE'}]).success,true);
  assert.equal(e.call('listAccessUsers').users[1].status,'INACTIVE');
  assert.equal(e.call('saveAccessUser',[{email:'sales@gmail.com',status:'ACTIVE'}]).success,true);
});
test('access form cannot promote guest, assign sales ID or deactivate designated admin',()=>{
  const e=environment({identity:{email:'admin@gmail.com',localId:'admin-uid'}});
  e.call('saveAccessUser',[{email:'sales@gmail.com',salesId:'S2',role:'ADMIN',status:'ACTIVE'}]);
  const row=e.sheets.get('ACCESS_USERS').rows[2];assert.equal(row[3],'GUEST');assert.equal(row[2],'');
  assert.throws(()=>e.call('saveAccessUser',[{email:'admin@gmail.com',status:'INACTIVE'}]),/Hanya status akun Tamu/);
});
test('RPC allowlist blocks setup functions, inherited properties and arbitrary helpers', () => {
  const e = environment();
  for (const method of ['repairAndOptimizeSpreadsheet', 'repairAndOptimizeSpreadsheet_', 'getSheetData', 'getSheetData_', 'constructor', '__proto__', 'verifyFirebaseIdentity_']) {
    assert.throws(() => e.call(method), /Operasi tidak tersedia/);
  }
});
test('only intended entry points remain public and template includes exist', () => {
  const names = [];
  for (const file of fs.readdirSync(root).filter(f => f.endsWith('.gs'))) {
    const source = fs.readFileSync(path.join(root, file), 'utf8'); new vm.Script(source);
    for (const match of source.matchAll(/^function (\w+)\(/gm)) names.push(match[1]);
  }
  assert.equal(new Set(names).size, names.length, 'No duplicate server function declarations');
  assert.deepEqual(names.filter(n => !n.endsWith('_')).sort(), ['checkKchGoogleConnection', 'checkKchTransactionSetup', 'doGet', 'kchApi', 'kchGuestLogin', 'kchGuestLogout', 'onOpen', 'repairAndOptimizeSpreadsheet', 'setupKchSheetUpdates']);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/include_\('([^']+)'\)/g)) assert.ok(fs.existsSync(path.join(root, match[1] + '.html')));
});
test('client attaches ID token and suppresses stale responses after logout', async () => {
  const source = fs.readFileSync(path.join(root, 'auth-client.html'), 'utf8');
  let successHandler, received;
  const runner = { withSuccessHandler(fn) { successHandler = fn; return this; }, withFailureHandler() { return this; },
    kchApi(...args) { received = args; } };
  const c = { google: { script: { run: runner } }, console };
  vm.createContext(c);
  vm.runInContext([...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n'), c);
  c.kchFirebaseAuth = { currentUser: { getIdToken: async () => 'verified-by-server-later' } };
  let count = 0;
  c.kchRun().withSuccessHandler(() => count++).getAuthProfile();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(received[0], 'verified-by-server-later'); assert.equal(received[1], 'getAuthProfile');
  c.kchAuthGeneration++;
  successHandler({ success: true }); assert.equal(count, 0);
});

test('all guest progress read endpoints are read-only, including reports and missing plan sheet',()=>{
  const e=environment({guestSession:true}),before=JSON.stringify([...e.sheets.entries()].map(([name,s])=>[name,s.rows]));
  e.context.setupMonthlyTeamReportSheet_=()=>{throw Error('Guest must not persist a report');};
  e.context.setupTodayPlanSheet_=()=>{throw Error('Guest must not create plan sheet');};
  for(const [method,args]of [['getInitialAppMetadata',[]],['getDashboardMetrics',[{period:'MONTH'}]],['getTodayPlans',['2026-10-25']],['getWeeklyMeetings',[]],['getKchNews',[]],['getAttendanceByDate',['2026-10-25']],['getVisitPhotosByDate',['2026-10-25']],['getMonthlyTeamReport',['2026-10','S2']]]) {
    const r=e.call(method,args);assert.equal(r.success,true,method+': '+r.message);
  }
  assert.equal(JSON.stringify([...e.sheets.entries()].map(([name,s])=>[name,s.rows])),before);
});
test('previous SALES and third-party ADMIN sessions are revoked by the next authenticated RPC',()=>{
  for(const role of ['SALES','ADMIN','GUEST']){
    const e=environment({identity:{email:'old-sales@gmail.com',localId:'old-uid'},access:[['old-sales@gmail.com','old-uid','S1',role,'ACTIVE']]});
    assert.throws(()=>e.call('getInitialAppMetadata'),/hanya tersedia/);
  }
});
test('designated real emails are the only production account configuration',()=>{
  const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'firebase-config.gs'),'utf8'),c);
  assert.equal(c.KCH_BOOTSTRAP_ADMIN_EMAIL_,'mhmdryyan7@gmail.com');assert.equal(c.KCH_GUEST_EMAIL_,'juniortlkchlse@gmail.com');
});
