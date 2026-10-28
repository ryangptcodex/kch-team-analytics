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
function response(){return {success:true,users:[{email:'admin@gmail.com',role:'ADMIN',status:'ACTIVE'},{email:'guest@gmail.com',role:'GUEST',status:'ACTIVE'}]};}
test('account panel loads fixed admin/guest list without sales metadata',()=>{
 const e=panel();e.context.openKchAccessPanel();assert.equal(e.nodes.kchSaveAccess.disabled,true);e.requests[0].success(response());assert.equal(e.nodes.kchSaveAccess.disabled,false);assert.equal(e.nodes.kchAccessEmail.value,'guest@gmail.com');assert.equal(e.nodes.kchAccessRows.children.length,2);
});
test('guest status is preselected and saving sends no sales mapping',()=>{
 const e=panel();e.context.openKchAccessPanel();const r=response();r.users[1].status='INACTIVE';e.requests[0].success(r);assert.equal(e.nodes.kchAccessStatus.value,'INACTIVE');e.nodes.kchAccessStatus.value='ACTIVE';e.context.saveKchAccess({preventDefault(){}});assert.equal(e.requests[1].payload.email,'guest@gmail.com');assert.equal(e.requests[1].payload.status,'ACTIVE');assert.equal('salesId' in e.requests[1].payload,false);assert.equal(e.nodes.kchSaveAccess.disabled,true);
});
test('loading or failed account panel cannot save stale email',()=>{
 const e=panel();e.context.openKchAccessPanel();e.context.saveKchAccess({preventDefault(){}});assert.equal(e.requests.length,1);e.requests[0].failure({message:'offline'});assert.equal(e.nodes.kchSaveAccess.disabled,true);assert.match(e.nodes.kchAccessMessage.textContent,/offline/);
});
test('older account response cannot overwrite newer guest status',()=>{
 const e=panel();e.context.loadKchAccessUsers();e.context.loadKchAccessUsers();const r=response();r.users[1].status='INACTIVE';e.requests[1].success(r);e.requests[0].success(response());assert.equal(e.nodes.kchAccessStatus.value,'INACTIVE');
});
test('legacy or incomplete backend cannot enable account save',()=>{
 for(const r of [{success:true,sales:[]}, {success:true,users:[]}, {success:true,users:[{role:'ADMIN'},{role:'SALES'}]}]){const e=panel();e.context.loadKchAccessUsers();e.requests[0].success(r);assert.equal(e.nodes.kchSaveAccess.disabled,true);assert.match(e.nodes.kchAccessMessage.textContent,/tidak lengkap/);}
});
test('failed save shows failure and permits correction',()=>{
 const e=panel();e.context.loadKchAccessUsers();e.requests[0].success(response());e.context.saveKchAccess({preventDefault(){}});e.requests[1].success({success:false,message:'Denied'});assert.equal(e.nodes.kchSaveAccess.disabled,false);assert.equal(e.nodes.kchAccessMessage.textContent,'Denied');
});
