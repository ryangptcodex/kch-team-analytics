const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const headers = ['email', 'firebase_uid', 'sales_id', 'role', 'status', 'created_at', 'updated_at'];

function environment(options = {}) {
  const sheets = new Map();
  function sheet(name, initial = []) {
    const rows = initial.map(row => [...row]);
    const api = {
      rows, getLastRow: () => rows.length,
      getLastColumn: () => Math.max(0, ...rows.map(r => r.length)),
      setFrozenRows() {}, appendRow(row) { rows.push([...row]); },
      getRange(r, c, height = 1, width = 1) {
        const range = {
          getValues: () => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => rows[r - 1 + y]?.[c - 1 + x] ?? '')),
          getDisplayValues: () => range.getValues().map(row => row.map(v => String(v))),
          getValue: () => range.getValues()[0][0],
          setValue(v) { return range.setValues([[v]]); },
          setValues(values) { values.forEach((row, y) => row.forEach((v, x) => {
            if (!rows[r - 1 + y]) rows[r - 1 + y] = [];
            rows[r - 1 + y][c - 1 + x] = v;
          })); return range; },
          setNumberFormat() { return range; }
        };
        return range;
      }
    };
    sheets.set(name, api); return api;
  }
  sheet('SALES', [['sales_id', 'full_name', 'team_name', 'status'], ['S1', 'Sales One', 'Canvasser', 'ACTIVE'], ['S2', 'Sales Two', 'Motoris', 'ACTIVE']]);
  sheet('SALES_TRANSACTIONS', [['transaction_id', 'sales_id', 'sales_name', 'team_name', 'subtotal_sales', 'subtotal_cost', 'subtotal_shj', 'transaction_date'],
    ['T1', 'S1', 'Sales One', 'Canvasser', 200, 100, 100, '2026-10-25'], ['T2', 'S2', 'Sales Two', 'Motoris', 500, 300, 200, '2026-10-25']]);
  sheet('ACTIVITY_LOGS', [['log_id', 'timestamp', 'username', 'action', 'target_ref', 'details']]);
  if (options.access !== false) sheet('ACCESS_USERS', [headers, ...(options.access || [
    ['admin@gmail.com', 'admin-uid', '', 'ADMIN', 'ACTIVE'],
    ['sales@gmail.com', 'sales-uid', 'S1', 'SALES', 'ACTIVE']])]);
  let lookupCalls = 0;
  const identity = { localId: 'sales-uid', email: 'sales@gmail.com', emailVerified: true, displayName: 'Sales One', providerUserInfo: [{ providerId: 'google.com' }], ...(options.identity || {}) };
  const ss = { getSheetByName: name => sheets.get(name) || null, insertSheet: name => sheet(name) };
  const context = {
    Date, console,
    Session: { getActiveUser: () => ({ getEmail: () => options.editorEmail || '' }) },
    SpreadsheetApp: { openById: () => ss, flush() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      base64DecodeWebSafe: input => [...Buffer.from(input, 'base64url')],
      newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString() }),
      formatDate: () => '2026-10-25 12:00:00'
    },
    UrlFetchApp: { fetch(url, request) {
      lookupCalls++;
      assert.match(url, /^https:\/\/identitytoolkit\.googleapis\.com\/v1\/accounts:lookup\?key=/);
      assert.equal(typeof JSON.parse(request.payload).idToken, 'string');
      if (options.networkError) throw new Error(typeof options.networkError === 'string' ? options.networkError : 'offline');
      return { getResponseCode: () => options.lookupCode || 200,
        getContentText: () => JSON.stringify(options.lookupBody || { users: [identity] }) };
    } }
  };
  vm.createContext(context);
  for (const file of ['firebase-config.gs', 'code.gs', 'setup.gs', 'auth.gs']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  context.KCH_TEST_SPREADSHEET_ID_ = 'test-only';
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud: context.KCH_FIREBASE_WEB_CONFIG_.projectId, iss: 'https://securetoken.google.com/' + context.KCH_FIREBASE_WEB_CONFIG_.projectId,
    sub: identity.localId, exp: now + 3600, iat: now, auth_time: now, firebase: { sign_in_provider: 'google.com' }, ...(options.claims || {}) };
  const token = 'header.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.mock-signature';
  // The lookup is a mocked trust boundary, NOT a cryptographic verification test.
  return { context, sheets, token, identity, claims, lookupCalls: () => lookupCalls,
    call: (method, args = []) => context.kchApi(token, method, args) };
}

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
  const e = environment({ editorEmail: 'mhmdryyan7@gmail.com', access: false,
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
test('unknown account cannot register itself or become admin', () => {
  const e = environment({ access: false });
  assert.throws(() => e.call('getAuthProfile'), /belum terdaftar/);
  assert.equal(e.sheets.has('ACCESS_USERS'), false);
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
test('sales identity is bound to Gmail and sales profile', () => {
  const e = environment(); const user = e.call('getAuthProfile').user;
  assert.equal(user.role, 'SALES'); assert.equal(user.salesId, 'S1'); assert.equal(user.email, 'sales@gmail.com');
  assert.equal(e.context.KCH_REQUEST_USER_, null);
});
test('pre-registered Gmail binds its UID on first verified login', () => {
  const e = environment({ access: [['sales@gmail.com', '', 'S1', 'SALES', 'ACTIVE']] });
  e.call('getAuthProfile'); assert.equal(e.sheets.get('ACCESS_USERS').rows[1][1], 'sales-uid');
});
test('UID mismatch, duplicate email and duplicate profile fail closed', () => {
  for (const access of [
    [['sales@gmail.com', 'different-uid', 'S1', 'SALES', 'ACTIVE']],
    [['sales@gmail.com', 'sales-uid', 'S1', 'SALES', 'ACTIVE'], ['sales@gmail.com', 'sales-uid', 'S1', 'SALES', 'ACTIVE']],
    [['sales@gmail.com', 'sales-uid', 'S1', 'SALES', 'ACTIVE'], ['other@gmail.com', '', 'S1', 'SALES', 'ACTIVE']]
  ]) assert.throws(() => environment({ access }).call('getAuthProfile'), /ACCESS_DENIED/);
});
test('deactivating access takes effect on the next RPC', () => {
  const e = environment(); e.call('getAuthProfile');
  e.sheets.get('ACCESS_USERS').rows[2][4] = 'INACTIVE';
  assert.throws(() => e.call('getAuthProfile'), /tidak aktif/);
});
test('sales cannot access admin operations, others uploads, transactions or reports', () => {
  const e = environment();
  for (const method of ['listAccessUsers', 'saveAccessUser', 'saveTodayPlan', 'saveWeeklyMeeting', 'saveKchNewsArticle']) {
    assert.throws(() => e.call(method, [{}]), /Hanya admin/);
  }
  for (const method of ['saveSalesTransaction', 'saveSalesPhotoUpload']) {
    assert.throws(() => e.call(method, [{ salesId: 'S2', username: 'admin@gmail.com' }]), /data sendiri/);
  }
  assert.throws(() => e.call('getMonthlyTeamReport', ['2026-10', 'S2']), /data sendiri/);
  assert.equal(e.context.KCH_REQUEST_USER_, null);
});
test('sales history, exports and detail cannot expose other sales transactions', () => {
  const e = environment();
  const history = e.call('getTransactionsPaginated', [1, 10]);
  assert.equal(history.success, true); assert.equal(history.data.length, 1); assert.equal(history.data[0].id, 'T1');
  assert.equal(e.call('getAllTransactionsForExport', []).data.length, 1);
  assert.equal(e.call('getTransactionDetail', ['T2']).success, false);
});
test('admin can read all sales history and add or deactivate sales access', () => {
  const e = environment({ identity: { email: 'admin@gmail.com', localId: 'admin-uid' } });
  assert.equal(e.call('getTransactionsPaginated', [1, 10]).data.length, 2);
  assert.equal(e.call('saveAccessUser', [{ email: 'second@gmail.com', salesId: 'S2' }]).success, true);
  assert.equal(e.call('saveAccessUser', [{ email: 'second@gmail.com', salesId: 'S2', status: 'INACTIVE' }]).success, true);
  assert.equal(e.call('listAccessUsers').users.find(u => u.email === 'second@gmail.com').status, 'INACTIVE');
});
test('access form cannot grant admin or remap an existing admin account', () => {
  const e = environment({ identity: { email: 'admin@gmail.com', localId: 'admin-uid' } });
  e.call('saveAccessUser', [{ email: 'second@gmail.com', salesId: 'S2', role: 'ADMIN' }]);
  assert.equal(e.call('listAccessUsers').users.find(u => u.email === 'second@gmail.com').role, 'SALES');
  assert.throws(() => e.call('saveAccessUser', [{ email: 'admin@gmail.com', salesId: 'S2', status: 'INACTIVE' }]), /bukan akun sales/);
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
  assert.deepEqual(names.filter(n => !n.endsWith('_')).sort(), ['checkKchGoogleConnection', 'doGet', 'kchApi', 'onOpen']);
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
