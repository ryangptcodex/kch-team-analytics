const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Minimal DOM for the admin access form; the tests exercise asynchronous RPC
// ordering and loading states without depending on dashboard metadata.
function panel() {
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.disabled = false; this.hidden = true; this._value = ''; this.textContent = ''; }
    set value(value) { this._value = this.tag === 'select' && !this.children.some(c => c.value === value) ? '' : value; }
    get value() { return this._value; }
    replaceChildren() { this.children = []; this._value = ''; }
    appendChild(child) { this.children.push(child); if (this.tag === 'select' && this.children.length === 1) this._value = child.value; }
  }
  const nodes = {};
  for (const [id, tag] of Object.entries({ kchAccessPanel: 'section', kchAccessSales: 'select', kchSaveAccess: 'button',
    kchAccessMessage: 'p', kchAccessRows: 'tbody', kchAccessEmail: 'input', kchAccessStatus: 'select' })) nodes[id] = new Element(tag);
  for (const value of ['ACTIVE', 'INACTIVE']) { const option = new Element('option'); option.value = value; nodes.kchAccessStatus.appendChild(option); }
  const requests = [];
  const context = { document: { getElementById: id => nodes[id], createElement: tag => new Element(tag) },
    appState: { attendanceSales: [] }, showToast() {}, console };
  vm.createContext(context);
  const html = fs.readFileSync(path.resolve(__dirname, '../auth-client.html'), 'utf8');
  vm.runInContext([...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n'), context);
  context.kchRun = function() {
    const request = {};
    const runner = { withSuccessHandler(fn) { request.success = fn; return runner; }, withFailureHandler(fn) { request.failure = fn; return runner; },
      listAccessUsers() { request.method = 'listAccessUsers'; requests.push(request); },
      saveAccessUser(payload) { request.method = 'saveAccessUser'; request.payload = payload; requests.push(request); } };
    return runner;
  };
  return { context, nodes, requests };
}
function response() {
  return { success: true, sales: [{ sales_id: 'S1', full_name: 'One', status: 'ACTIVE' }, { sales_id: 'S2', full_name: 'Two', status: 'ACTIVE' }],
    users: [{ email: 'admin@gmail.com', salesId: '', role: 'ADMIN', status: 'ACTIVE' },
      { email: 'one@gmail.com', salesId: 'S1', role: 'SALES', status: 'INACTIVE' }] };
}

test('opening before dashboard metadata arrives loads profiles directly from server', () => {
  const e = panel(); e.context.openKchAccessPanel();
  assert.equal(e.nodes.kchAccessPanel.hidden, false);
  assert.equal(e.nodes.kchAccessSales.disabled, true); assert.equal(e.nodes.kchSaveAccess.disabled, true);
  assert.match(e.nodes.kchAccessSales.children[0].textContent, /Memuat/);
  assert.equal(e.requests[0].method, 'listAccessUsers');
  e.requests[0].success(response());
  assert.equal(e.context.appState.attendanceSales.length, 0, 'Does not require metadata side effects');
  assert.deepEqual(e.nodes.kchAccessSales.children.map(c => c.value), ['', 'S1', 'S2']);
  assert.equal(e.nodes.kchAccessSales.disabled, false); assert.equal(e.nodes.kchSaveAccess.disabled, false);
});
test('existing account edit selects the right profile and can reactivate access', () => {
  const e = panel(); e.context.openKchAccessPanel(); e.requests[0].success(response());
  const rows = e.nodes.kchAccessRows.children;
  assert.equal(rows[0].children[4].children.length, 0, 'No sales edit action on admin account');
  rows[1].children[4].children[0].onclick();
  assert.equal(e.nodes.kchAccessEmail.value, 'one@gmail.com'); assert.equal(e.nodes.kchAccessSales.value, 'S1');
  assert.equal(e.nodes.kchAccessStatus.value, 'INACTIVE');
  e.nodes.kchAccessStatus.value = 'ACTIVE'; e.context.saveKchAccess({ preventDefault() {} });
  assert.equal(e.requests[1].method, 'saveAccessUser');
  assert.equal(e.requests[1].payload.email, 'one@gmail.com'); assert.equal(e.requests[1].payload.salesId, 'S1');
  assert.equal(e.requests[1].payload.status, 'ACTIVE');
});
test('empty profiles display an explanation and cannot submit an invalid mapping', () => {
  const e = panel(); e.context.openKchAccessPanel();
  e.requests[0].success({ success: true, sales: [], users: response().users });
  assert.match(e.nodes.kchAccessMessage.textContent, /Sheet SALES/);
  assert.equal(e.nodes.kchAccessSales.disabled, true); assert.equal(e.nodes.kchSaveAccess.disabled, true);
  e.context.saveKchAccess({ preventDefault() {} }); assert.equal(e.requests.length, 1);
});
test('load failure removes stale profiles and blocks saving until data reloads', () => {
  const e = panel(); e.context.openKchAccessPanel(); e.requests[0].success(response());
  e.context.loadKchAccessUsers(); e.requests[1].failure(new Error('connection lost'));
  assert.equal(e.nodes.kchAccessSales.children.length, 1); assert.equal(e.nodes.kchAccessSales.value, '');
  assert.equal(e.nodes.kchAccessSales.disabled, true); assert.equal(e.nodes.kchSaveAccess.disabled, true);
  assert.match(e.nodes.kchAccessMessage.textContent, /connection lost/);
});
test('out-of-order responses do not overwrite a newer loaded profile list', () => {
  const e = panel(); e.context.openKchAccessPanel(); e.context.openKchAccessPanel();
  e.requests[1].success(response());
  e.requests[0].failure(new Error('old failed request'));
  assert.equal(e.nodes.kchAccessSales.disabled, false);
  assert.deepEqual(e.nodes.kchAccessSales.children.map(c => c.value), ['', 'S1', 'S2']);
  assert.equal(e.nodes.kchAccessMessage.textContent, '');
});
test('an older backend produces an actionable message rather than an empty dropdown', () => {
  const e = panel(); e.context.openKchAccessPanel();
  e.requests[0].success({ success: true, users: response().users });
  assert.match(e.nodes.kchAccessMessage.textContent, /auth.gs/); assert.equal(e.nodes.kchSaveAccess.disabled, true);
});
test('loaded profiles require an explicit selection before saving a new account', () => {
  const e = panel(); e.context.openKchAccessPanel(); e.requests[0].success(response());
  e.context.saveKchAccess({ preventDefault() {} });
  assert.equal(e.requests.length, 1); assert.match(e.nodes.kchAccessMessage.textContent, /Pilih profil/);
});
