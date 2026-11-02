// Real photo form + recovery controls, with in-memory Sheets/Drive and a lost RPC response.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{system}=require('../tests/helpers/transaction-system.cjs');
const root=path.resolve(__dirname,'..'),e=system(),c=e.context;e.actor({role:'ADMIN'});
const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),req=[];
for(const name of ['ATTENDANCE','VISIT_PHOTOS'])c.txAddSheet_(meta,req,name,c.TABLE_SCHEMAS[name],false);c.txBatch_(ctx,req);
const files=[];c.createUploadedPhotoFile_=()=>{const id='UI-PROOF-'+files.length,f={getId:()=>id,getUrl:()=> 'https://drive.google.com/file/d/'+id+'/view',setTrashed(v){f.trashed=v;}};files.push(f);return f;};
let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<\?!= include_\('([^']+)'\); \?>/g,(_,n)=>fs.readFileSync(path.join(root,n+'.html'),'utf8')).replace(/<script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'').replace(/<\?[\s\S]*?\?>/g,m=>m.includes('JSON.stringify')?'{}':'');
html=html.replace(/<\/body>\s*<\/html>\s*$/,`<script>
initKchAuthentication=function(){document.body.classList.remove('kch-locked');document.getElementById('kchAuthScreen').hidden=true;appState.user={role:'ADMIN',uid:'user-1',fullName:'Muhammad Ryan'};appState.sales=appState.attendanceSales=[{sales_id:'S1',full_name:'Sales One',status:'ACTIVE'}];};
var testRefreshes=0;loadMetadata=function(){testRefreshes++;};handleAttendanceDateChange=function(){};handleVisitPhotosDateChange=function(){};reloadVisitPhotosOnly=function(){};
kchRun=function(){var ok=function(){},fail=function(){},r={withSuccessHandler(fn){ok=fn;return r;},withFailureHandler(fn){fail=fn;return r;},saveSalesPhotoUpload(payload,type){window.photoBackend('saveSalesPhotoUpload',[payload,type]).then(ok).catch(fail);},getSalesTransactionRequestStatus(id){window.photoBackend('getSalesTransactionRequestStatus',[id]).then(ok).catch(fail);}};return r;};
</script></body></html>`);
(async()=>{const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',err=>errors.push(err.message));let loseResponse=true;
await p.exposeFunction('photoBackend',(method,args)=>{const result=c.kchApi('MOCK',method,args);if(method==='saveSalesPhotoUpload'&&loseResponse){loseResponse=false;throw Error('Simulated lost RPC response');}return result;});
await p.goto('http://127.0.0.1:'+server.address().port);assert.deepEqual(errors,[]);await p.waitForFunction(()=>appState.user?.role==='ADMIN');await p.evaluate(()=>openPhotoUploadForm('attendance'));
await p.locator('#photoUploadSalesId').selectOption('S1');await p.locator('#photoUploadDate').fill('2026-10-25');await p.locator('#photoUploadNotes').fill('Arrival proof');
const image=await p.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=20;return canvas.toDataURL('image/png').split(',')[1];});
await p.locator('#photoUploadFile').setInputFiles({name:'proof.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await p.locator('#btnSubmitPhotoUpload').click();
await p.waitForFunction(()=>appState.pendingTransaction&&!appState.isSubmittingTransaction&&document.getElementById('photoRequestStatus').style.display==='block');
assert.equal(e.rows('ATTENDANCE').length,2);assert.equal(files.length,1);assert.equal(await p.locator('#photoUploadFile').isDisabled(),true);const id=await p.evaluate(()=>appState.pendingTransaction.requestId);assert.ok(id);
await p.locator('#btnCheckPhotoRequest').click();await p.waitForFunction(()=>!appState.pendingTransaction&&testRefreshes===1);assert.equal(e.rows('ATTENDANCE').length,2);assert.equal(files.length,1);assert.ok(!files[0].trashed);assert.equal(await p.locator('#modalPhotoUpload').isVisible(),false);
for(const width of [390,320]){await p.setViewportSize({width,height:850});await p.evaluate(()=>{openPhotoUploadForm('visit');txClientStatus('Hasil kiriman belum pasti. Periksa hasil sebelum mengirim lagi.',false);});assert.equal(await p.locator('#btnCheckPhotoRequest').isVisible(),true);const overflow=await p.locator('#modalPhotoUpload .modal-dialog').evaluate(el=>el.scrollWidth>el.clientWidth+2);assert.equal(overflow,false);}
await p.evaluate(()=>{closePhotoUploadForm();appState.user={role:'GUEST'};openPhotoUploadForm('attendance');});assert.equal(await p.locator('#modalPhotoUpload').isVisible(),false);assert.deepEqual(errors,[]);
console.log('PASS: real photo compression/form, lost RPC recovery without duplicate file/row, HK refresh, guest denied and recovery controls at 1440/390/320.');
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(err=>{console.error(err);process.exitCode=1;});
