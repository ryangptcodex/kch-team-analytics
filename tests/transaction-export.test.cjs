const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {system}=require('./helpers/transaction-system.cjs');
function fixture(){const e=system();e.actor({role:'ADMIN'});return {...e,c:e.context,export:(args=[])=>e.context.kchApi('MOCK','getAllTransactionsForExport',args)};}
test('export propagates an actual transaction read failure instead of success with empty rows and zero totals',()=>{
 const e=fixture(),read=e.c.getSheetData_;e.c.getSheetData_=name=>{if(name==='SALES_TRANSACTIONS')throw Error('Data transaksi tidak dapat dibaca');return read(name);};const r=e.export();assert.equal(r.success,false);assert.match(r.message,/tidak dapat dibaca/);for(const key of ['data','totalSales','totalCost','totalShj','exportedAt'])assert.equal(key in r,false);
});
test('missing, failed, truncated or malformed source responses fail rather than generating a partial export',()=>{
 for(const source of [null,undefined,{success:false,message:'Sumber belum tersedia'},{success:'true',data:[]},{success:true},{success:true,data:{},totalRows:0,summary:{totalSales:0,totalCost:0,totalShj:0}},{success:true,data:[],totalRows:1,summary:{totalSales:100,totalCost:60,totalShj:10}},{success:true,data:[],totalRows:0,summary:{}},{success:true,data:[],totalRows:0,summary:{totalSales:NaN,totalCost:0,totalShj:0}}]){const e=fixture();e.c.getTransactionsPaginated_=()=>source;const r=e.export();assert.equal(r.success,false);assert.equal('data' in r,false);}
});
test('a genuinely empty successful read remains a valid zero-row export',()=>{
 const e=fixture(),before=JSON.stringify(e.rows('SALES_TRANSACTIONS')),r=e.export();assert.equal(r.success,true);assert.equal(r.data.length,0);assert.equal(r.totalSales,0);assert.equal(r.totalCost,0);assert.equal(r.totalShj,0);assert.equal(JSON.stringify(e.rows('SALES_TRANSACTIONS')),before);
});
test('export preserves filtered invoices and totals for Admin and Guest without mutating business data',()=>{
 const e=fixture();e.save();e.save({requestId:'REQ-EXPORT-SECOND-0002',salesId:'S2',date:'2026-10-24',notes:'Other',items:[{productId:'P1',qty:1,costPrice:60,sellingPrice:100}]});
 const before=JSON.stringify(['SALES_TRANSACTIONS','INVENTORY','INVENTORY_MOVEMENTS','ACTIVITY_LOGS'].map(n=>e.rows(n)));
 for(const role of ['ADMIN','GUEST']){e.actor({role});const all=e.export(),filtered=e.export(['','ALL','ALL','2026-10-25']);assert.equal(all.success,true);assert.equal(all.data.length,2);assert.equal(all.totalSales,300);assert.equal(filtered.data.length,1);assert.equal(filtered.totalSales,200);assert.equal(filtered.totalCost,120);assert.equal(filtered.totalShj,80);}
 assert.equal(JSON.stringify(['SALES_TRANSACTIONS','INVENTORY','INVENTORY_MOVEMENTS','ACTIVITY_LOGS'].map(n=>e.rows(n))),before);
});
function client(result,networkError){
 const e={downloads:[],popups:[],toasts:[],args:[]},c={console,document:{addEventListener(){}},window:{open(){const p={html:'',document:{open(){},write(text){p.html=text;},close(){}}};e.popups.push(p);return p;}}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js.html'),'utf8').replace(/^<script>/,'').replace(/<\/script>\s*$/,''),c);
 c.getValue=id=>({txSearchKeyword:' SALES ',txFilterTeam:'Motoris',txFilterDistributor:'D1',txFilterDate:'2026-10-25'})[id];c.showToast=(...a)=>e.toasts.push(a);c.downloadTextFile=(...a)=>e.downloads.push(a);c.kchRun=()=>{let ok,bad;const r={withSuccessHandler(fn){ok=fn;return r;},withFailureHandler(fn){bad=fn;return r;},getAllTransactionsForExport(...args){e.args.push(args);if(networkError)bad(Error('Koneksi terputus'));else ok(result);}};return r;};return {...e,c};
}
test('CSV and print UI show source/RPC errors without downloading a file or opening a report',()=>{
 for(const networkError of [false,true]){const e=client({success:false,message:'Pembacaan sheet gagal'},networkError);e.c.exportTransactionsToCSV();e.c.printTransactionsReport();assert.equal(e.downloads.length,0);assert.equal(e.popups.length,0);assert.equal(e.toasts.filter(t=>t[1]==='error').length,2);assert.equal(e.toasts.some(t=>t[1]==='success'),false);}
});
test('CSV and print still export valid invoice values, filters and escaped names',()=>{
 const e=client({success:true,data:[{id:'INV-1',date:'2026-10-25',salesName:'Sales <one>',teamName:'Motoris',distributor:'GMP',totalSales:200,totalCost:120,totalShj:20}],totalSales:200,totalCost:120,totalShj:20});e.c.exportTransactionsToCSV();e.c.printTransactionsReport();assert.equal(e.downloads.length,1);assert.match(e.downloads[0][1],/INV-1/);assert.match(e.downloads[0][1],/120,200,20/);assert.equal(e.popups.length,1);assert.match(e.popups[0].html,/Sales &lt;one&gt;/);assert.deepEqual(e.args,[['sales','Motoris','D1','2026-10-25'],['sales','Motoris','D1','2026-10-25']]);
});
