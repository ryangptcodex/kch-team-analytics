const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
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
  const properties = {};
  const context = {
    PropertiesService: { getScriptProperties: () => ({getProperty: k => properties[k] ?? null,setProperty(k,v){properties[k]=v;},deleteProperty(k){delete properties[k];},getProperties:()=>({...properties})}) },
    Date, console,
    Session: { getActiveUser: () => ({ getEmail: () => options.editorEmail || '' }) },
    SpreadsheetApp: { openById: () => ss, flush() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => require('node:crypto').randomUUID(),
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
  for (const file of ['firebase-config.gs', 'code.gs', 'setup.gs', 'transactions.gs','transaction-edits.gs', 'guest-crypto.gs','guest-auth.gs','auth.gs']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  context.KCH_TEST_SPREADSHEET_ID_ = 'test-only';
  if (!options.identity || options.identity.email !== 'mhmdryyan7@gmail.com') context.KCH_BOOTSTRAP_ADMIN_EMAIL_ = 'admin@gmail.com';
  context.KCH_GUEST_EMAIL_ = 'sales@gmail.com';
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud: context.KCH_FIREBASE_WEB_CONFIG_.projectId, iss: 'https://securetoken.google.com/' + context.KCH_FIREBASE_WEB_CONFIG_.projectId,
    sub: identity.localId, exp: now + 3600, iat: now, auth_time: now, firebase: { sign_in_provider: 'google.com' }, ...(options.claims || {}) };
  const token = 'header.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.mock-signature';
  // The lookup is a mocked trust boundary, NOT a cryptographic verification test.
  let callToken = token;
  if(options.guestSession) {
    context.KCH_GUEST_PASSWORD_ITERATIONS_ = 1000;
    const access = sheets.get('ACCESS_USERS'), h = context.KCH_GUEST_ACCESS_HEADERS_;
    access.rows[0].push(...h);access.rows[2]=['sales@gmail.com','','','GUEST','ACTIVE','','stamp','PASSWORD','tamu','a'.repeat(64),'b'.repeat(64),'1000','c'.repeat(32)];
    callToken='KCHG_'+'a'.repeat(64);const credential=context.guestCredential_();
    properties['KCH_GUEST_SESSION_'+context.KCH_GUEST_SHA256_(callToken)] = JSON.stringify({expires:Date.now()+60000,revision:context.guestRevision_(credential),username:'tamu'});
  }
  return { context, sheets, token:callToken, googleToken:token, properties, identity, claims, lookupCalls: () => lookupCalls,
    call: (method, args = []) => context.kchApi(callToken, method, args) };
}


module.exports = { environment };
