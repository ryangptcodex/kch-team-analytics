// Real Skor HTML/JS with in-memory Google services. No Production business writes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{auditSystem}=require('../tests/helpers/audit-system.cjs');
const root=path.resolve(__dirname,'..'),e=auditSystem();let sequence=0;
function seed(month,points,sales='S1'){
 const a=Math.round((points-50)*125000*100)/100,hs=e.rows('SALES_TRANSACTIONS')[0];
 for(const [id,amount]of [['LBMAV',a],['LPRGR',5000000],['P1',22000000-a]]){const r={transaction_id:'UI-EVAL-'+(++sequence),transaction_date:month+'-02',sales_id:sales,sales_name:sales,team_name:'Motoris',product_id:id,quantity:1,selling_price:amount,cost_price:0,subtotal_sales:amount,subtotal_cost:0,subtotal_shj:amount};e.rows('SALES_TRANSACTIONS').push(hs.map(h=>r[h]??''));}
 e.clock(month+'-25 12:00:00');e.capturePeriod();
}
seed('2026-10',80);seed('2026-11',75);seed('2026-11',80.0000008,'S2');seed('2026-12',80);seed('2027-01',75);e.clock('2027-01-20 12:00:00');
const unchanged=JSON.stringify([e.rows('SALES'),e.rows('ACCESS_USERS'),e.rows('SALES_TRANSACTIONS')]);
let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<\?!= include_\('([^']+)'\); \?>/g,(_,n)=>fs.readFileSync(path.join(root,n+'.html'),'utf8')).replace(/<script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'').replace(/<\?[\s\S]*?\?>/g,m=>m.includes('JSON.stringify')?'{}':'');
html=html.replace(/<\/body>\s*<\/html>\s*$/,`<script>
initKchAuthentication=function(){captureKchInitialUi();document.body.classList.remove('kch-locked');document.getElementById('kchAuthScreen').hidden=true;appState.user={role:'ADMIN',uid:'user-1',fullName:'Muhammad Ryan'};installKchAccountActions(appState.user);initApp();};
kchRun=function(){let ok=function(){},fail=function(){};const r=new Proxy({}, {get(t,m){if(m==='withSuccessHandler')return fn=>{ok=fn;return r;};if(m==='withFailureHandler')return fn=>{fail=fn;return r;};return(...args)=>window.evaluationBackend(m,args).then(ok).catch(fail);}});return r;};
</script></body></html>`);
(async()=>{const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'Asia/Jakarta'}),errors=[];page.on('pageerror',err=>errors.push(err.message));await page.exposeFunction('evaluationBackend',(method,args)=>e.call(method,...args));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>appState.user&&!appState.isLoadingMetadata&&appState.sales.length);
 await page.locator('#nav-skor').click();await page.waitForFunction(()=>scoreState().report?.month==='2027-01');await page.locator('#scoreSales').selectOption('S1');await page.waitForFunction(()=>scoreState().report?.sales.salesId==='S1');assert.match(await page.locator('#scoreCategory').textContent(),/DISPENSASI.*Estimasi/);assert.match(await page.locator('#scoreEvaluationStatus').textContent(),/pemantauan.*80/);assert.match(await page.locator('#scoreEvaluationRule').textContent(),/≤70.*80.*AMAN/);
 async function month(value,sales='S1'){await page.locator('#scoreMonth').fill(value);await page.locator('#scoreMonth').dispatchEvent('change');await page.waitForFunction(m=>scoreState().report?.month===m,value);await page.locator('#scoreSales').selectOption(sales);await page.waitForFunction(v=>scoreState().report?.month===v[0]&&scoreState().report?.sales.salesId===v[1],[value,sales]);}
 await month('2026-10');assert.match(await page.locator('#scoreCategory').textContent(),/LANJUT BULAN BERIKUTNYA/);
 await month('2026-11');assert.match(await page.locator('#scoreCategory').textContent(),/DISPENSASI/);assert.equal(await page.locator('#scoreTotal').textContent(),'75 / 100');
 await month('2026-11','S2');assert.match(await page.locator('#scoreCategory').textContent(),/AMAN/);assert.equal(await page.locator('#scoreTotal').textContent(),'> 80 / 100');
 await month('2026-12');assert.equal(await page.locator('#scoreTotal').textContent(),'80 / 100');assert.match(await page.locator('#scoreCategory').textContent(),/DISPENSASI/);assert.match(await page.locator('#scoreEvaluationStatus').textContent(),/Tepat 80.*tetap DISPENSASI/);
 e.clock('2027-02-01 00:00:01');await month('2027-01');assert.match(await page.locator('#scoreCategory').textContent(),/^EVALUASI/);assert.match(await page.locator('#scoreEvaluationStatus').textContent(),/di bawah 80: EVALUASI/);await page.waitForFunction(()=>document.getElementById('scoreSummaryRows').textContent.includes('EVALUASI'));
 for(const width of [390,320]){await page.setViewportSize({width,height:850});await page.waitForTimeout(80);assert.equal(await page.locator('#view-skor').evaluate(el=>el.scrollWidth>el.clientWidth+2),false,'Skor overflow at '+width);assert.equal(await page.locator('#scoreEvaluationStatus').isVisible(),true);}
 assert.equal(JSON.stringify([e.rows('SALES'),e.rows('ACCESS_USERS'),e.rows('SALES_TRANSACTIONS')]),unchanged);assert.deepEqual(errors,[]);
 console.log('PASS: November rules, old October category, exact80dispensation, >80unrounded display, pending and final follow-up across December/January, team recap, desktop/mobile, and unchanged accounts/business data.');
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(err=>{console.error(err);process.exitCode=1;});
