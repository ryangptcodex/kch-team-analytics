const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {system}=require('./helpers/transaction-system.cjs');
function fixture(){const e=system(),c=e.context;for(const name of ['score.gs','canvasser-incentives.gs','incentives.gs','incentive-sheets.gs','sheet-updates.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),c);e.actor({role:'ADMIN'});c.scoreToday_=()=> '2026-12-29';e.rows('SALES')[2][2]='MMTW';for(const [id,[name]]of Object.entries(c.KCH_SCORE_PRODUCT_RULES_))e.rows('PRODUCTS').push([id,name,'ACTIVE']);const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'};
 e.add=(name,rows)=>{const meta=c.txMetadata_(ctx),req=[],s=c.txAddSheet_(meta,req,name,rows[0],false);if(rows.length>1)req.push(c.txAppend_(s.sheetId,rows.slice(1)));c.txBatch_(ctx,req);};e.add('HOLIDAYS',[['date','holiday_name']]);
 e.tx=(value,date='2026-10-02',product='P1')=>{const row={transaction_id:'TEST-'+e.rows('SALES_TRANSACTIONS').length,transaction_date:date,sales_id:'S1',product_id:product,quantity:1,selling_price:value,subtotal_sales:value};e.rows('SALES_TRANSACTIONS').push(Array.from(c.TABLE_SCHEMAS.SALES_TRANSACTIONS,h=>row[h]??''));};
 e.snapshot=()=>{c.KCH_REQUEST_USER_={role:'ADMIN'};try{return c.kchIncentiveSheetRows_(c.scoreContext_(true));}finally{c.KCH_REQUEST_USER_=null;}};
 e.sync=()=>{const ss=c.getKchSpreadsheet_(),meta=c.txMetadata_(ctx),plan=c.kchSheetUpdatePlan_(ss,meta,c.kchSheetSchemas_()),generated=c.kchIncentiveSyncPlan_(ss,meta,ctx);c.txBatch_(ctx,plan.requests.concat(generated.requests));return generated;};
 return e;}
function objects(e,name){const rows=e.rows(name);return rows.slice(1).filter(r=>r.some(v=>v!==''&&v!==undefined)).map(r=>Object.fromEntries(rows[0].map((h,i)=>[h,r[i]??''])));}
test('registry includes all three incentive tabs and reports share webapp calculations with one quarter row per sales',()=>{
 const e=fixture();e.tx(5000000,'2026-10-02','LBMAV');e.tx(4500000,'2026-10-02','LPRGR');e.tx(40000000,'2026-11-02');e.tx(40000000,'2026-12-02');const data=e.snapshot();for(const name of Object.keys(e.context.KCH_INCENTIVE_SHEET_SCHEMAS_)){assert.ok(e.context.kchSheetSchemas_()[name]);for(const row of data[name])assert.equal(row.length,e.context.KCH_INCENTIVE_SHEET_SCHEMAS_[name].length);}
 const cols=e.context.KCH_INCENTIVE_SHEET_SCHEMAS_.INSENTIF_BULANAN,oct=data.INSENTIF_BULANAN.find(r=>r[0]==='2026-10'&&r[1]==='S1');assert.equal(oct[cols.indexOf('combined_base')],575000);assert.equal(oct[cols.indexOf('combined_paid')],287500);assert.equal(oct[cols.indexOf('payout_percent')],50);assert.equal(data.INSENTIF_TRIWULAN.filter(r=>r[2]==='S1').length,1);assert.equal(data.INSENTIF_TRIWULAN.find(r=>r[2]==='S1')[10],1050000);
});
test('native report planner creates and fills tabs atomically; repeated refreshes do not duplicate rows or touch business data',()=>{
 const e=fixture();e.tx(2000000);const business=JSON.stringify(['SALES_TRANSACTIONS','INVENTORY','ACTIVITY_LOGS'].map(n=>e.rows(n)));e.sync();const first=JSON.stringify(Object.keys(e.context.KCH_INCENTIVE_SHEET_SCHEMAS_).map(n=>objects(e,n)));e.sync();assert.equal(JSON.stringify(Object.keys(e.context.KCH_INCENTIVE_SHEET_SCHEMAS_).map(n=>objects(e,n))),first);assert.equal(JSON.stringify(['SALES_TRANSACTIONS','INVENTORY','ACTIVITY_LOGS'].map(n=>e.rows(n))),business);assert.equal(e.context.KCH_REQUEST_USER_,null);
});
test('reload reflects corrected transactions and clears stale report rows when source periods disappear',()=>{
 const e=fixture();e.tx(2000000);e.sync();assert.ok(objects(e,'INSENTIF_BULANAN').some(r=>r.month==='2026-10'));const row=e.rows('SALES_TRANSACTIONS')[1],h=e.rows('SALES_TRANSACTIONS')[0];row[h.indexOf('subtotal_sales')]=3000000;e.sync();assert.equal(objects(e,'INSENTIF_BULANAN').find(r=>r.month==='2026-10').total_value_actual,3000000);
 e.rows('SALES_TRANSACTIONS').splice(1);e.sync();assert.ok(objects(e,'INSENTIF_BULANAN').every(r=>r.month==='2026-12'));assert.ok(objects(e,'INSENTIF_HARIAN').every(r=>r.month==='2026-12'));assert.equal(objects(e,'INSENTIF_TRIWULAN').length,2);
});
test('unavailable calendar produces empty unknown incentive cells and never invented zero payouts',()=>{
 const e=fixture();e.tx(2000000);e.remove('HOLIDAYS');const data=e.snapshot(),headers=e.context.KCH_INCENTIVE_SHEET_SCHEMAS_.INSENTIF_BULANAN,row=data.INSENTIF_BULANAN.find(r=>r[0]==='2026-10');assert.equal(row[headers.indexOf('combined_paid')],'');assert.equal(row[headers.indexOf('daily_paid')],'');assert.match(data.INSENTIF_HARIAN[0][10],/Kalender/);
});
test('earliest manual AA creates a historic period even with no transactions; SPG excluded and future rows ignored',()=>{
 const e=fixture();e.rows('SALES').push(['S3','SPG','SPG Kelontong','ACTIVE']);e.context.kchApi('MOCK','saveScoreAA',[{requestId:'SHEET-AA-000000000001',date:'2026-09-01',salesId:'S1',count:400,expectedRevision:''}]);e.tx(90000000,'2027-01-02');const data=e.snapshot(),rows=data.INSENTIF_BULANAN;assert.ok(rows.some(r=>r[0]==='2026-09'&&r[1]==='S1'));assert.ok(rows.every(r=>r[1]!=='S3'&&r[0]<='2026-12'));assert.equal(data.INSENTIF_TRIWULAN.filter(r=>r[2]==='S1').length,2);
});
test('invalid master fails before writing report results and restores native request context',()=>{
 const e=fixture();e.tx(2000000);e.sync();const before=JSON.stringify(e.rows('INSENTIF_BULANAN'));e.rows('PRODUCTS').find(r=>r[0]==='LBMAV')[1]='Wrong';assert.throws(()=>e.sync(),/master produk/);assert.equal(JSON.stringify(e.rows('INSENTIF_BULANAN')),before);assert.equal(e.context.KCH_REQUEST_USER_,null);
});
test('populated custom columns stop regeneration rather than detach manual side notes',()=>{
 const e=fixture();e.sync();const r=e.rows('INSENTIF_BULANAN');r[0].push('manual_note');r[1].push('do not lose');const before=JSON.stringify(r);assert.throws(()=>e.sync(),/data tambahan manual/);assert.equal(JSON.stringify(e.rows('INSENTIF_BULANAN')),before);
});
test('generated text is written literally even when sales names resemble formulas',()=>{
 const e=fixture();e.rows('SALES')[1][1]='=HYPERLINK("example")';e.sync();assert.equal(objects(e,'INSENTIF_BULANAN')[0].sales_name,'=HYPERLINK("example")');
});
test('atomic report write rejection keeps old reports and source cells intact',()=>{
 const e=fixture();e.tx(2000000);e.sync();const before=JSON.stringify(e.rows('INSENTIF_BULANAN'));e.options.rejectTarget='INSENTIF_BULANAN';assert.throws(()=>e.sync());assert.equal(JSON.stringify(e.rows('INSENTIF_BULANAN')),before);assert.equal(e.rows('SALES_TRANSACTIONS').length,2);
});
