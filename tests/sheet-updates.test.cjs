const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {system}=require('./helpers/transaction-system.cjs');
function fixture(){
 const e=system(),c=e.context;
 for(const file of ['score.gs','sheet-updates.gs'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),c);
 const meta=c.txMetadata_({id:'test-book',token:'TEST_ONLY_OAUTH'}),status={},events=[];
 const control={getName:()=>c.KCH_UPDATE_SHEET_,getRange:(a)=>({getValue:()=>a==='A1'?'PUSAT PEMBARUAN SHEET':status[a],setValue(v){status[a]=v;return this;}})};
 const ss={getId:()=>c.KCH_TEST_SPREADSHEET_ID_,getName:()=> 'UJI COBA',getSheetByName(name){
  if(name===c.KCH_UPDATE_SHEET_)return control;
  if(!e.exists(name))return null;
  const rows=e.rows(name);return {getSheetId:()=>meta[name].sheetId,getLastColumn:()=>Math.max(0,...rows.map(r=>r.length)),getLastRow:()=>rows.length,getRange:()=>({getDisplayValues:()=>[rows[0].map(String)]})};
 },copy(){events.push('backup');return {getId:()=> 'backup',getUrl:()=> 'https://docs.google.com/spreadsheets/d/backup'};},toast(){}};
 c.txMetadata_=()=>meta;c.assertNoPendingTransactions_=()=>events.push('pending-check');
 c.txBatch_=(ctx,requests)=>events.push('batch');
 return {...e,c,ss,meta,status,events,control};
}
function applyExisting(e,plan){
 for(const r of plan.requests){
  if(r.insertDimension){const v=r.insertDimension.range,name=Object.keys(e.meta).find(n=>e.meta[n].sheetId===v.sheetId);for(const row of e.rows(name))row.splice(v.startIndex,0,'');}
  if(r.updateCells){const v=r.updateCells,name=Object.keys(e.meta).find(n=>e.meta[n].sheetId===v.start.sheetId);for(let i=0;i<v.rows[0].values.length;i++)e.rows(name)[0][v.start.columnIndex+i]=v.rows[0].values[i].userEnteredValue.stringValue;}
 }
}
test('additive migration inserts a missing middle column while preserving formulas, values and trailing custom data; rerun adds nothing',()=>{
 const e=fixture(),rows=e.rows('SALES');rows[0]=Array.from(e.c.TABLE_SCHEMAS.SALES);for(const row of rows.slice(1))while(row.length<rows[0].length)row.push('');const col=rows[0].indexOf('area');rows.forEach(r=>r.splice(col,1));rows[0].push('custom');rows[1].push('=SUM(1,2)');const before=rows[1].slice();
 const schema={SALES:e.c.TABLE_SCHEMAS.SALES};const plan=e.c.kchSheetUpdatePlan_(e.ss,e.meta,schema);assert.equal(plan.changes.length,1);applyExisting(e,plan);
 const expected=before.slice();expected.splice(col,0,'');assert.deepEqual(rows[1],expected);assert.equal(rows[1].at(-1),'=SUM(1,2)');assert.equal(e.c.kchSheetUpdatePlan_(e.ss,e.meta,schema).changes.length,0);
});
test('schema registry covers score, access, receipts, edits, plans and every current table without sample rows',()=>{
 const e=fixture(),schemas=e.c.kchSheetSchemas_();for(const name of ['SKOR_EVENTS','ACCESS_USERS','_KCH_TX_REQUESTS','_KCH_TX_EDITS','TODAY_PLAN','MONTHLY_TEAM_REPORT',...Object.keys(e.c.TABLE_SCHEMAS)])assert.ok(schemas[name]);
 const plan=e.c.kchSheetUpdatePlan_(e.ss,e.meta,{SKOR_EVENTS:schemas.SKOR_EVENTS});assert.equal(plan.requests[0].addSheet.properties.title,'SKOR_EVENTS');assert.equal(plan.requests[1].updateCells.rows.length,1);
});
test('ambiguous duplicate, reordered, blank and mixed custom headers fail preflight with no mutation',()=>{
 for(const headers of [['sales_id','sales_id'],['full_name','sales_id'],['sales_id','','team_name'],['sales_id','custom','full_name'],['SALES_ID']]){
  const e=fixture();e.rows('SALES')[0]=headers;const before=JSON.stringify(e.rows('SALES'));assert.throws(()=>e.c.kchSheetUpdatePlan_(e.ss,e.meta,{SALES:e.c.TABLE_SCHEMAS.SALES}));assert.equal(JSON.stringify(e.rows('SALES')),before);assert.equal(e.events.length,0);
 }
});
test('updater backs up before one atomic batch and resets action checkbox; repeated runs preserve business data',()=>{
 const e=fixture(),before=JSON.stringify(e.rows('SALES'));const result=e.c.kchRunSheetUpdates_(e.ss);assert.equal(result.success,true);assert.deepEqual(e.events,['pending-check','backup','batch']);assert.equal(e.status.A3,false);assert.equal(e.status.B8,'Berhasil');assert.equal(JSON.stringify(e.rows('SALES')),before);
});
test('failed backup and pending writes prevent structural mutation; failed batch exposes recovery copy',()=>{
 for(const mode of ['backup','pending','batch']){const e=fixture();if(mode==='backup')e.ss.copy=()=>{throw Error('Drive unavailable');};if(mode==='pending')e.c.assertNoPendingTransactions_=()=>{throw Error('pending');};if(mode==='batch')e.c.txBatch_=()=>{throw Error('batch failed');};assert.throws(()=>e.c.kchRunSheetUpdates_(e.ss));assert.equal(e.status.B8,'Gagal / perlu diperiksa');assert.equal(e.status.A3,false);if(mode!=='batch')assert.ok(!e.events.includes('batch'));else assert.match(e.status.B11,/Cadangan: https/);}
});
test('actual editor and target spreadsheet are checked before an owner-executed trigger can write',()=>{
 const e=fixture(),range={getSheet:()=>e.control,getA1Notation:()=> 'A3'};
 for(const email of ['', 'juniortlkchlse@gmail.com','other@example.com'])assert.throws(()=>e.c.kchSheetUpdateClick_({range,value:'TRUE',source:e.ss,user:{getEmail:()=>email}}),/ACCESS_DENIED/);
 assert.throws(()=>e.c.kchSheetUpdateAdmin_({getId:()=> 'production'},e.c.KCH_BOOTSTRAP_ADMIN_EMAIL_),/UJI COBA/);assert.equal(e.events.length,0);
 e.c.kchSheetUpdateClick_({range,value:'FALSE',source:e.ss});assert.equal(e.events.length,0);
});
test('maintenance stays outside web RPC and guests cannot read control/backup contents',()=>{
 const e=fixture();e.actor({role:'GUEST'});assert.throws(()=>e.c.kchApi('MOCK','setupKchSheetUpdates',[]),/tidak dikenal|tidak tersedia|tidak diizinkan|Unknown/i);
 e.c.KCH_REQUEST_USER_={role:'GUEST'};assert.equal(e.c.filterAuthorizedRows_('PEMBARUAN_SHEET',[{secret:'backup'}]).length,0);
});
test('installing twice creates one action tab and one matching trigger without erasing status or other triggers',()=>{
 const e=fixture(),triggers=[],cells={},calls=[];let installed=false;
 const ss=e.ss,original=ss.getSheetByName;
 function range(a){const chain={getValue:()=>cells[a]??cells[a+':D1'],setValue(v){cells[a]=v;return chain;},setValues(v){cells[a]=v;return chain;}};for(const name of ['merge','setBackground','setFontColor','setFontSize','setFontWeight','setWrap','insertCheckboxes'])chain[name]=()=>chain;return chain;}
 const sheet={getRange:range};for(const name of ['setColumnWidth','setColumnWidths','setRowHeight','setFrozenRows'])sheet[name]=()=>{};
 ss.getSheetByName=n=>n===e.c.KCH_UPDATE_SHEET_?(installed?sheet:null):original(n);ss.insertSheet=()=>{installed=true;calls.push('insert');return sheet;};ss.setActiveSheet=()=>{};ss.getNumSheets=()=>25;ss.moveActiveSheet=n=>calls.push(n);
 e.c.SpreadsheetApp.getActiveSpreadsheet=()=>ss;
 e.c.ScriptApp.getProjectTriggers=()=>triggers;
 e.c.ScriptApp.newTrigger=handler=>({forSpreadsheet:()=>({onEdit:()=>({create(){triggers.push({getHandlerFunction:()=>handler,getTriggerSourceId:()=>ss.getId()});}})})});
 e.c.setupKchSheetUpdates();cells.B8='Berhasil';e.c.installKchSheetUpdates_();assert.equal(triggers.length,1);assert.equal(calls.filter(c=>c==='insert').length,1);assert.equal(cells.B8,'Berhasil');assert.equal(calls.at(-1),25);
});
