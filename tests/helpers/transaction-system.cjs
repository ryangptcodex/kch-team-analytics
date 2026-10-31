const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const copy = value => JSON.parse(JSON.stringify(value));
const root = path.resolve(__dirname, '../..');

function system(options = {}) {
  let store = {}, nextId = 100, financialAttempts = 0, committedBatches = 0, delayed = null, failReceiptRead = false;
  const calls = [];
  let actor = { uid: 'user-1', email: 'one@example.test', username: 'one@example.test', role: 'SALES', salesId: 'S1' };
  function add(name, rows) { store[name] = { sheetId: nextId++, title: name, hidden: false, rows: copy(rows), gridProperties: { rowCount: 1000, columnCount: 30 } }; }
  function native(name) {
    const sheet = store[name]; if (!sheet) return null;
    return { getSheetId:()=>sheet.sheetId, appendRow(row){sheet.rows.push([...row]);}, setFrozenRows(){}, getLastRow: () => sheet.rows.length, getLastColumn: () => Math.max(0, ...sheet.rows.map(r => r.length)),
      getRange(r, c, h=1, w=1) { const values = () => Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>sheet.rows[r-1+y]?.[c-1+x]??''));
        const range={ getValues: values, getDisplayValues: () => values().map(row => row.map(String)),getValue:()=>values()[0][0],setValue(v){return range.setValues([[v]]);},setValues(v){v.forEach((row,y)=>row.forEach((cell,x)=>{if(!sheet.rows[r-1+y])sheet.rows[r-1+y]=[];sheet.rows[r-1+y][c-1+x]=cell;}));return range;},setRichTextValue(v){return range.setValue(v.getText());},setNumberFormat(){return range;}};return range; } };
  }
  const properties={};
  const context = { console, PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k]??null,setProperty(k,v){properties[k]=v;},deleteProperty(k){delete properties[k];},getProperties:()=>({...properties})})}, ScriptApp: { getOAuthToken: () => 'TEST_ONLY_OAUTH' },
    SpreadsheetApp: { newRichTextValue:()=>({setText(text){return {build:()=>({getText:()=>text})};}}), flush() {} }, Session: { getActiveUser: () => ({getEmail:()=> 'mhmdryyan7@gmail.com'}) },
    LockService: { getScriptLock: () => ({ waitLock() { if(options.busy) throw Error('busy'); }, releaseLock() {} }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (algorithm, text) => [...crypto.createHash(algorithm).update(text).digest()], getUuid: () => crypto.randomUUID(),
      formatDate: (date, zone, format) => format === 'yyyyMMdd' ? '20261025' : format === 'yyyy-MM-dd' ? '2026-10-25' : format === 'yyyy-MM' ? '2026-10' : '2026-10-25 12:00:00' }
  };
  function byId(book, id) { return Object.values(book).find(s => s.sheetId === id); }
  function apply(requests) {
    const draft = copy(store);
    for (const request of requests) {
      if (request.addSheet) {
        const p = request.addSheet.properties;
        if (draft[p.title] || byId(draft,p.sheetId)) throw Error('sheet collision');
        draft[p.title] = { ...copy(p), rows: [] };
      } else if(request.updateSheetProperties) {
        const p=request.updateSheetProperties.properties, sheet=byId(draft,p.sheetId);if(!sheet)throw Error('missing sheet');sheet.gridProperties={...sheet.gridProperties,...p.gridProperties};
      } else if(request.repeatCell) {
        if(!byId(draft,request.repeatCell.range.sheetId))throw Error('missing sheet');
      } else if(request.insertDimension || request.deleteDimension) {
        const r=(request.insertDimension||request.deleteDimension).range,sheet=byId(draft,r.sheetId);if(!sheet)throw Error('missing sheet');const count=r.endIndex-r.startIndex;
        if(r.dimension==='ROWS'){if(request.deleteDimension)sheet.rows.splice(r.startIndex,count);else sheet.rows.splice(r.startIndex,0,...Array.from({length:count},()=>[]));}
        else for(const row of sheet.rows){if(request.deleteDimension)row.splice(r.startIndex,count);else {while(row.length<r.startIndex)row.push('');row.splice(r.startIndex,0,...Array(count).fill(''));}}
      } else if(request.updateCells?.range) {
        const r=request.updateCells.range,sheet=byId(draft,r.sheetId);if(!sheet)throw Error('missing sheet');if(options.rejectTarget===sheet.title)throw Error('injected request validation failure');
        for(let y=r.startRowIndex;y<Math.min(r.endRowIndex,sheet.rows.length);y++)for(let x=r.startColumnIndex;x<r.endColumnIndex;x++)sheet.rows[y][x]='';
      } else {
        const edit = request.updateCells || request.appendCells;
        const sheet = byId(draft, edit.sheetId ?? edit.start.sheetId);
        if (!sheet) throw Error('missing sheet');
        if(options.rejectTarget === sheet.title) throw Error('injected request validation failure');
        const rowStart = request.appendCells ? sheet.rows.length : edit.start.rowIndex;
        const colStart = request.appendCells ? 0 : edit.start.columnIndex;
        edit.rows.forEach((row,y) => row.values.forEach((cell,x) => {
          const typed = cell.userEnteredValue;
          assert.ok(!Object.hasOwn(typed,'formulaValue'),'All writes must be literal values');
          const value = Object.hasOwn(typed,'stringValue') ? typed.stringValue : Object.hasOwn(typed,'boolValue') ? typed.boolValue : typed.numberValue;
          if(typeof value === 'number') assert.ok(Number.isFinite(value));
          sheet.rows[rowStart+y] ??= []; sheet.rows[rowStart+y][colStart+x] = value;
        }));
      }
    }
    store = draft;
  }
  function response(code, body) { return {getResponseCode:()=>code,getContentText:()=>JSON.stringify(body)}; }
  context.UrlFetchApp = {fetch(url, request) {
    assert.equal(request.headers.Authorization,'Bearer TEST_ONLY_OAUTH');
    const parsed = new URL(url); assert.equal(parsed.hostname,'sheets.googleapis.com');
    calls.push({url,body:request.payload?JSON.parse(request.payload):null});
    if(options.apiDisabled) return response(403,{error:{status:'PERMISSION_DENIED'}});
    if(parsed.pathname.endsWith(':batchUpdate')) {
      const requests = JSON.parse(request.payload).requests;
      const isFinancial = requests.some(r => { const edit=r.appendCells||r.updateCells; if(!edit || (r.updateCells && r.updateCells.start?.rowIndex===0))return false; const id=edit.sheetId??edit.start?.sheetId??edit.range?.sheetId; return ['SALES_TRANSACTIONS','STOCK_PICKUPS','SALES_CASH_DEPOSITS'].includes(byId(store,id)?.title || requests.find(a=>a.addSheet?.properties.sheetId===id)?.addSheet.properties.title); });
      if(isFinancial) {
        financialAttempts++;
        if(options.financialFault==='reject400') return response(400,{error:{status:'INVALID_ARGUMENT'}});
        if(options.financialFault==='unknownBefore') { delayed=copy(requests); throw Error('lost connection before result'); }
      }
      try { apply(requests); } catch(err) { return response(400,{error:{status:'INVALID_ARGUMENT'}}); }
      if(isFinancial) {
        committedBatches++;
        if(options.financialFault==='lostAfterCommit' || options.financialFault==='lostAndReadFail') {
          if(options.financialFault==='lostAndReadFail') failReceiptRead = true;
          throw Error('response lost after commit');
        }
      }
      return response(200,{spreadsheetId:'test-book',replies:requests.map(()=>({}))});
    }
    if(parsed.pathname.endsWith('/values:batchGet')) {
      const names = parsed.searchParams.getAll('ranges').map(s=>s.slice(1,-1).replace(/''/g,"'"));
      if(failReceiptRead && names.includes('_KCH_TX_REQUESTS')) { failReceiptRead=false; throw Error('temporary receipt read failure'); }
      return response(200,{spreadsheetId:'test-book',valueRanges:names.map(name=>({range:name,values:copy(store[name]?.rows||[])}))});
    }
    return response(200,{spreadsheetId:'test-book',sheets:Object.values(store).map(s=>({properties:{sheetId:s.sheetId,title:s.title,gridProperties:s.gridProperties}}))});
  }};
  vm.createContext(context);
  for(const f of ['firebase-config.gs','code.gs','setup.gs','transactions.gs','stock-pickups.gs','transaction-edits.gs','guest-crypto.gs','guest-auth.gs','auth.gs']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
  add('SALES',[['sales_id','full_name','team_name','status'],['S1','Sales One','Motoris','ACTIVE'],['S2','Sales Two','Motoris','ACTIVE']]);
  add('PRODUCTS',[['product_id','product_name','status'],['P1','Product One','ACTIVE'],['P2','Product Two','ACTIVE']]);
  add('PRICE_MASTER',[['product_id','team_name','cost_price','selling_price','shj','status'],['P1','Motoris',60,100,10,'ACTIVE'],['P2','Motoris',20,40,20,'ACTIVE']]);
  add('DISTRIBUTORS',[['distributor_id','distributor_name','status'],['D1','PT. Global Mitra Prima (Subdist)','ACTIVE'],['D2','AP. Geubrina Rizki (Panel)','ACTIVE']]);
  add('INVENTORY',[['product_id','product_name','PT. Global Mitra Prima','AP. Geubrina Rizki'],['P1','Product One',10,5],['P2','Product Two',20,3]]);
  for(const name of ['SALES_TRANSACTIONS','INVENTORY_MOVEMENTS','ACTIVITY_LOGS']) add(name,[[...context.TABLE_SCHEMAS[name]]]);
  context.getKchSpreadsheet_=()=>({getId:()=> 'test-book',getSheetByName:n=>native(n)});
  context.verifyFirebaseIdentity_=()=>({uid:actor.uid,email:actor.email}); context.resolveAccessUser_=()=>({...actor});
  const fixture = {context,calls,options,
    rows:name=>store[name]?.rows, remove:name=>{delete store[name]}, actor:value=>{actor={...actor,...value}},
    stock:(product='P1',column=2)=>store.INVENTORY.rows.find(r=>r[0]===product)[column],
    save(payload={}) { return context.kchApi('MOCK_FIREBASE','saveSalesTransaction',[{requestId:'REQ-0000000000000001',salesId:'S1',date:'2026-10-25',distributor:'D1',notes:'Test',items:[{productId:'P1',qty:2,costPrice:60,sellingPrice:100}],...payload}]); },
    status:id=>context.kchApi('MOCK_FIREBASE','getSalesTransactionRequestStatus',[id||'REQ-0000000000000001']),
    financialAttempts:()=>financialAttempts, committedBatches:()=>committedBatches,
    settle() { if(delayed){apply(delayed);committedBatches++;delayed=null;} options.financialFault=null; },
    exists:name=>!!store[name]};
  return fixture;
}

module.exports = { system };
