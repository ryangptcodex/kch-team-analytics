const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function browser() {
  class Element {
    constructor(tag, id = '', className = '') { Object.assign(this, { tag, id, className, children: [], parentElement: null,
      style: {}, hidden: false, disabled: false, value: '', _text: '' }); }
    get classList() { return { add: c => { if (!this.className.split(' ').includes(c)) this.className += ' ' + c; },
      remove: c => { this.className = this.className.split(' ').filter(n => n !== c).join(' '); }, contains: c => this.className.split(' ').includes(c) }; }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set textContent(value) { this._text = value; this.children = []; }
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
    matches(selector) { return selector.split(',').some(s => { s = s.trim(); return s.startsWith('#') ? this.id === s.slice(1) : s.startsWith('.') && this.className.split(' ').includes(s.slice(1)); }); }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    cloneNode() {
      const copy = new Element(this.tag, this.id, this.className);
      for (const property of ['hidden', 'disabled', 'value', '_text']) copy[property] = this[property];
      copy.style = { ...this.style }; this.children.forEach(child => copy.appendChild(child.cloneNode(true))); return copy;
    }
    replaceWith(other) {
      const parent = this.parentElement; const index = parent.children.indexOf(this);
      parent.children[index] = other; other.parentElement = parent; this.parentElement = null;
    }
  }
  const body = new Element('body');
  const add = (parent, tag, id = '', className = '') => parent.appendChild(new Element(tag, id, className));
  const screen = add(body, 'section', 'kchAuthScreen'); screen.hidden = true;
  add(screen, 'button', 'kchGoogleLogin'); add(screen, 'p', 'kchAuthMessage');
  const access = add(body, 'section', 'kchAccessPanel'); access.hidden = true;
  add(access, 'input', 'kchAccessEmail'); add(access, 'tbody', 'kchAccessRows');
  const layout = add(body, 'div', '', 'app-layout');
  add(layout, 'span', '', 'user-role-header'); add(layout, 'div', 'userDropdownMenu'); add(layout, 'div', 'dashboardData');
  add(body, 'div', 'modalPhotoUpload', 'modal-backdrop').style.display = 'none'; add(body, 'div', 'toastBox');
  const document = { body, addEventListener() {}, createElement: tag => new Element(tag),
    getElementById: id => body.querySelectorAll('#' + id)[0] || null,
    querySelector: selector => body.querySelectorAll(selector)[0] || null,
    querySelectorAll: selector => body.querySelectorAll(selector) };
  const cleared = [];
  const context = { document, console, clearTimeout: id => cleared.push(id), setTimeout: () => 1,
    window: { location: { reload() { throw new Error('Must not reload the iframe'); } } } };
  vm.createContext(context);
  for (const name of ['js.html', 'auth-client.html']) {
    const text = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
    vm.runInContext([...text.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n'), context);
  }
  const get = id => document.getElementById(id);
  return { context, document, get, cleared };
}

test('logout shows login without navigating and clears prior account data immediately', async () => {
  const e = browser(); const c = e.context; c.captureKchInitialUi();
  let destroyed = 0;
  c.appState.user = { role: 'ADMIN' }; c.appState.sales = [{ sales_id: 'PRIVATE' }];
  c.appState.charts.test = { destroy() { destroyed++; } }; c.appState.txSearchTimer = 123;
  e.get('dashboardData').textContent = 'Private admin data'; e.get('kchAccessEmail').value = 'old@gmail.com';
  e.get('modalPhotoUpload').style.display = 'flex'; c.installKchAccountActions({ role: 'ADMIN' });
  let resolveSignOut;
  c.kchFirebaseAuth = { currentUser: {}, signOut: () => new Promise(resolve => { resolveSignOut = resolve; }) };
  const pending = c.signOutKch();
  assert.equal(e.get('kchAuthScreen').hidden, false); assert.equal(e.document.body.classList.contains('kch-locked'), true);
  assert.equal(e.get('dashboardData').textContent, ''); assert.equal(e.get('kchAccessEmail').value, '');
  assert.equal(e.get('modalPhotoUpload').style.display, 'none'); assert.equal(e.get('userDropdownMenu').children.length, 0);
  assert.equal(c.appState.user, null); assert.equal(c.appState.sales.length, 0);
  assert.equal(destroyed, 1); assert.deepEqual(e.cleared, [123]);
  await new Promise(resolve => setImmediate(resolve)); resolveSignOut(); await pending;
  assert.match(e.get('kchAuthMessage').textContent, /Sudah keluar/); assert.equal(e.get('kchGoogleLogin').disabled, false);
});

test('logout failure remains on login with an actionable retry and no false success', async () => {
  const e = browser(); const c = e.context; c.captureKchInitialUi();
  c.kchFirebaseAuth = { signOut: () => Promise.reject(new Error('offline')) };
  await c.signOutKch();
  assert.match(e.get('kchAuthMessage').textContent, /Belum berhasil keluar/);
  assert.equal(e.get('kchAuthScreen').hidden, false); assert.equal(e.get('kchGoogleLogin').disabled, false);
  assert.equal(c.kchSigningOut, false);
});

test('logout with unavailable Firebase keeps a visible login message without navigating', () => {
  const e = browser(); e.context.captureKchInitialUi(); e.context.signOutKch();
  assert.equal(e.get('kchAuthScreen').hidden, false); assert.match(e.get('kchAuthMessage').textContent, /belum siap/);
});

test('repeated clicks during signout trigger only one Firebase operation', async () => {
  const e = browser(); const c = e.context; c.captureKchInitialUi(); let count = 0, done;
  c.kchFirebaseAuth = { signOut: () => { count++; return new Promise(resolve => { done = resolve; }); } };
  const pending = c.signOutKch(); c.signOutKch();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(count, 1); done(); await pending;
});

test('same-page admin logout then guest login rebuilds UI without admin actions', async () => {
  const e = browser(); const c = e.context; let authListener;
  const auth = { setPersistence: () => Promise.resolve(), onAuthStateChanged: fn => { authListener = fn; },
    signOut: async () => { authListener(null); } };
  const authFactory = () => auth; authFactory.Auth = { Persistence: { NONE: 'NONE' } };
  const firebase = { initializeApp() {}, auth: authFactory };
  c.firebase = firebase; c.window.firebase = firebase; c.window.KCH_FIREBASE_CONFIG = {};
  c.initApp = () => { e.get('dashboardData').textContent = c.appState.user.email; };
  let profile;
  c.kchRun = () => { const r = { withSuccessHandler(fn) { r.success = fn; return r; }, withFailureHandler() { return r; },
    getAuthProfile() { r.success({ user: profile }); } }; return r; };
  c.initKchAuthentication(); await new Promise(resolve => setImmediate(resolve));
  profile = { role: 'ADMIN', email: 'admin@gmail.com' }; authListener({ uid: 'A' });
  assert.ok(e.get('userDropdownMenu').children.some(n => n.textContent === 'Kelola akun'));
  await c.signOutKch();
  profile = { role: 'GUEST', email: 'juniortlkchlse@gmail.com' }; authListener({ uid: 'S' });
  assert.equal(e.document.body.classList.contains('kch-locked'), false); assert.equal(e.get('kchAuthScreen').hidden, true);
  assert.equal(e.get('dashboardData').textContent, 'juniortlkchlse@gmail.com');
  assert.equal(e.get('userDropdownMenu').children.some(n => n.textContent === 'Kelola akun'), false);
  assert.equal(e.get('userDropdownMenu').children.filter(n => n.id === 'kchLogoutAction').length, 1);
  assert.equal(e.document.querySelector('.user-role-header').textContent, 'Tamu');
  assert.equal(e.document.body.classList.contains('kch-readonly'), true);
  assert.equal(e.get('userDropdownMenu').children.some(n=>n.textContent==='Edit profil'), false);
});

test('a late RPC response after logout cannot render old data', async () => {
  const e = browser(); const c = e.context; c.captureKchInitialUi(); let callback;
  const runner = { withSuccessHandler(fn) { callback = fn; return runner; }, withFailureHandler() { return runner; }, kchApi() {} };
  c.google = { script: { run: runner } };
  c.kchFirebaseAuth = { currentUser: { getIdToken: async () => 'old-token' }, signOut: async () => {} };
  c.kchRun().withSuccessHandler(() => { e.get('dashboardData').textContent = 'old private data'; }).getInitialAppMetadata();
  await new Promise(resolve => setImmediate(resolve)); await c.signOutKch(); callback({ success: true });
  assert.equal(e.get('dashboardData').textContent, '');
});

test('photo compression started before logout cannot submit under the next account', () => {
  const e = browser(); const c = e.context; let compressionDone, rpcCount = 0;
  const input = { files: [{}] }; const originalGet = e.document.getElementById;
  e.document.getElementById = id => id === 'photoUploadFile' ? input : originalGet(id);
  c.getValue = () => 'present'; c.appState.photoUploadType = 'attendance';
  c.compressPhotoFile = (file, callback) => { compressionDone = callback; };
  c.kchRun = () => { rpcCount++; throw new Error('Stale upload must not start an RPC'); };
  c.submitPhotoUploadForm({ preventDefault() {} });
  c.kchAuthGeneration++; compressionDone('data:image/jpeg;base64,ABC', null);
  assert.equal(rpcCount, 0);
});

test('a successful attendance upload requests fresh profile metadata for its HK count', () => {
  const e = browser(); const c = e.context; let refreshed = 0, dateReloaded = '';
  const input = { files: [{}] }; const get = e.document.getElementById;
  e.document.getElementById = id => id === 'photoUploadFile' ? input : get(id);
  c.getValue = id => ({ photoUploadSalesId: 'S1', photoUploadDate: '2026-10-25', photoUploadNotes: 'Check-in' })[id];
  c.appState.photoUploadType = 'attendance';
  c.compressPhotoFile = (file, callback) => callback('data:image/jpeg;base64,ABC', null);
  c.loadMetadata = () => { refreshed++; }; c.handleAttendanceDateChange = date => { dateReloaded = date; };
  c.closePhotoUploadForm = () => {}; c.showToast = () => {};
  c.kchRun = () => { const r = { withSuccessHandler(fn) { r.ok = fn; return r; }, withFailureHandler() { return r; },
    saveSalesPhotoUpload(payload, type) { assert.equal(payload.salesId, 'S1'); assert.equal(type, 'attendance'); r.ok({ success: true }); } }; return r; };
  c.submitPhotoUploadForm({ preventDefault() {} });
  assert.equal(refreshed, 1); assert.equal(dateReloaded, '2026-10-25');
});

for (const emitStateEvent of [false, true]) {
  test('Google login rechecks access exactly once ' + (emitStateEvent ? 'with' : 'without') + ' an auth-state event', async () => {
    const e = browser(); const c = e.context; c.captureKchInitialUi(); let requests = 0;
    c.firebase = { auth: { GoogleAuthProvider: class { setCustomParameters(value) { assert.equal(value.prompt, 'select_account'); } } } };
    c.kchFirebaseAuth = { signInWithPopup: async () => {
      if (emitStateEvent) c.handleKchAuthState({ uid: 'same-user' });
      return { user: { uid: 'same-user' } };
    } };
    c.kchRun = () => { const r = { withSuccessHandler(fn) { r.success = fn; return r; }, withFailureHandler() { return r; },
      getAuthProfile() { requests++; r.success({ user: { role: 'SALES', email: 'sales@gmail.com' } }); } }; return r; };
    c.initApp = () => {};
    await c.signInKchGoogle();
    assert.equal(requests, 1); assert.equal(e.get('kchAuthScreen').hidden, true);
    assert.equal(c.appState.user.role, 'SALES'); assert.equal(e.get('kchGoogleLogin').disabled, false);
  });
}
