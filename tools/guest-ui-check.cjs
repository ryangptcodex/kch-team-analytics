// Optional Chromium smoke test with real app code, mocked Google/Firebase services.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');const {system}=require('../tests/helpers/transaction-system.cjs');const root=path.resolve(__dirname,'..');
const e=system();for(const name of ['auth.gs','score.gs'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),e.context);
for(const [id,[name]]of Object.entries(e.context.KCH_SCORE_PRODUCT_RULES_))e.rows('PRODUCTS').push([id,name,'ACTIVE']);
const resolveReal=e.context.resolveAccessUser_;let role='GUEST';
e.context.verifyFirebaseIdentity_=()=>({uid:role==='GUEST'?'guest-uid':'admin-uid',email:role==='GUEST'?'juniortlkchlse@gmail.com':'mhmdryyan7@gmail.com',name:role==='GUEST'?'Guest Google Name':'Admin'});
e.context.resolveAccessUser_=identity=>role==='GUEST'?resolveReal(identity):({...identity,role:'ADMIN',salesId:'',username:identity.email,fullName:'Admin',shortName:'Admin'});
let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<\?!= include_\('([^']+)'\); \?>/g,(_,n)=>fs.readFileSync(path.join(root,n+'.html'),'utf8')).replace(/<script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'').replace(/<\?[\s\S]*?\?>/g,m=>m.includes('JSON.stringify')?'null':'');
html=html.replace(/<\/body>\s*<\/html>\s*$/,`<script>
window.google={script:{run:{withSuccessHandler(success){return {withFailureHandler(failure){return {kchApi(token,method,args){window.testBackend(method,args).then(success).catch(failure);}};}};}}}};
initKchAuthentication=function(){captureKchInitialUi();kchFirebaseAuth={currentUser:{getIdToken:()=>Promise.resolve('MOCK')}};handleKchAuthState({uid:'guest-uid'});};
</script></body></html>`);
(async()=>{const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox'],headless:true});
try{const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',x=>errors.push(x.message));await p.exposeFunction('testBackend',(method,args)=>e.context.kchApi('MOCK',method,args));
const before=JSON.stringify(['SALES','PRODUCTS','SALES_TRANSACTIONS','INVENTORY','ACTIVITY_LOGS'].map(n=>e.rows(n)));
await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForFunction(()=>appState.user?.role==='GUEST'&&!appState.isLoadingMetadata&&!appState.isLoadingDashboard);
assert.equal(await p.locator('.user-role-header').textContent(),'Tamu');assert.equal(await p.locator('#nav-input-tx').isVisible(),false);assert.doesNotMatch(await p.locator('#userDropdownMenu').textContent(),/Edit profil|Kelola akun/);assert.equal(await p.locator('#kchLogoutAction').count(),1);assert.equal(await p.evaluate(()=>appState.sales.length),2);
await p.evaluate(()=>switchView('skor'));await p.waitForFunction(()=>appState.score?.report?.success);assert.equal(await p.locator('#scoreSales option').count(),2);assert.equal(await p.locator('#scoreAdminAA').isVisible(),false);assert.equal(await p.locator('#scoreMapping').isVisible(),false);
for(const view of ['absensi','foto-kunjungan','today-plan','weekly-meeting','kch-news','riwayat','laporan-bulanan']){await p.evaluate(v=>switchView(v),view);await p.waitForTimeout(70);const visibleWrites=await p.locator('[data-kch-write]').evaluateAll(es=>es.filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none').length);assert.equal(visibleWrites,0,view);}
assert.equal(await p.evaluate(()=>document.body.classList.contains('kch-locked')),false);
assert.equal(JSON.stringify(['SALES','PRODUCTS','SALES_TRANSACTIONS','INVENTORY','ACTIVITY_LOGS'].map(n=>e.rows(n))),before);assert.equal(e.exists('ACCESS_USERS'),false);assert.equal(e.exists('SKOR_EVENTS'),false);assert.equal(e.exists('MONTHLY_TEAM_REPORT'),false);assert.equal(e.exists('TODAY_PLAN'),false);
// Account transitions in the same tab must rebuild the menu and restore/remove write controls.
role='ADMIN';await p.evaluate(()=>handleKchAuthState({uid:'admin-uid'}));await p.waitForFunction(()=>appState.user?.role==='ADMIN'&&!appState.isLoadingMetadata);assert.equal(await p.locator('#nav-input-tx').isVisible(),true);assert.equal(await p.evaluate(()=>document.body.classList.contains('kch-readonly')),false);assert.match(await p.locator('#userDropdownMenu').textContent(),/Kelola akun/);
role='GUEST';await p.evaluate(()=>handleKchAuthState({uid:'guest-uid'}));await p.waitForFunction(()=>appState.user?.role==='GUEST'&&!appState.isLoadingMetadata);assert.equal(await p.locator('#nav-input-tx').isVisible(),false);assert.doesNotMatch(await p.locator('#userDropdownMenu').textContent(),/Edit profil|Kelola akun/);assert.equal(await p.locator('#kchLogoutAction').count(),1);
assert.deepEqual(errors,[]);console.log('PASS: real guest resolver/gateway; all-team reads; no guest sheet mutations; write controls hidden; guest/admin/guest transitions restore permissions.');
}finally{await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
