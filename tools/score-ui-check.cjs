const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const root=require('node:path').resolve(__dirname,'..');
const {system}=require(root+'/tests/helpers/transaction-system.cjs');
const e=system();vm.runInContext(fs.readFileSync(root+'/score.gs','utf8'),e.context);
for(const [id,[name]] of Object.entries(e.context.KCH_SCORE_PRODUCT_RULES_))e.rows('PRODUCTS').push([id,name,'ACTIVE']);
e.actor({role:'ADMIN'});
e.rows('SALES')[2][2]='MPR';
const priceHeaders=e.rows('PRICE_MASTER')[0];priceHeaders.push('unit');
for(const row of e.rows('PRICE_MASTER').slice(1))row.push('Box');
for(const team of ['Motoris','MPR'])for(const [id,price]of [['LBMAV',100000],['LKXOD',150000],['LPRGQ',250000]])e.rows('PRICE_MASTER').push(priceHeaders.map(h=>({product_id:id,team_name:team,cost_price:0,selling_price:price,shj:0,status:'ACTIVE',unit:'Box'})[h]??''));
function api(method,args){
 const result=e.context.kchApi('MOCK',method,args);
 // Exercise explicit null and omitted empty fields across the browser response boundary.
 for(const key of ['dailyAA','dailyBranding'])if(Array.isArray(result[key]))result[key].forEach((row,i)=>{if(row.count===null&&i%2===0)delete row.count;});
 return result;
}
function tx(product,amount){const row={transaction_id:'INV-1',transaction_date:'2026-10-01',sales_id:'S1',product_id:product,quantity:1,selling_price:amount,subtotal_sales:amount};e.rows('SALES_TRANSACTIONS').push([...e.context.TABLE_SCHEMAS.SALES_TRANSACTIONS].map(h=>row[h]??''));}
tx('LBMAV',3000000);tx('LKXOD',2000000);tx('LPRGQ',500000);tx('LPRGN',10000000);tx('P1',6000000);
let html=fs.readFileSync(root+'/index.html','utf8').replace(/<\?!= include_\('([^']+)'\); \?>/g,(_,name)=>fs.readFileSync(root+'/'+name+'.html','utf8'));
html=html.replace(/<script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'').replace(/<\?[\s\S]*?\?>/g,'null');
html=html.replace(/<\/body>\s*<\/html>\s*$/,`<script>
window.testCalls=[];window.testDelay={};window.loseNext=false;
window.google={script:{run:{withSuccessHandler(success){return {withFailureHandler(failure){return {kchApi(token,method,args){testCalls.push({method,args});window.testBackend(method,args).then(res=>{setTimeout(()=>{if(window.loseNext&&(method==='saveScoreAA'||method==='saveScoreBranding')){window.loseNext=false;failure(new Error('Simulasi respons hilang'));}else success(res);},window.testDelay[args[0]]||0);}).catch(failure);}};}};}}}};
initKchAuthentication=function(){document.body.classList.remove('kch-locked');document.getElementById('kchAuthScreen').hidden=true;captureKchInitialUi();appState.user={role:'ADMIN',fullName:'Admin Uji'};kchFirebaseAuth={currentUser:{getIdToken:()=>Promise.resolve('MOCK')}};switchView('skor');};
</script></body></html>`);
(async()=>{const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',err=>{errors.push(err.message);console.error('Browser error:',err.message)});
await page.exposeFunction('testBackend',(method,args)=>api(method,args));
await page.goto('http://127.0.0.1:'+port);await page.waitForFunction(()=>document.querySelector('#scoreRows').children.length===4,{},{timeout:5000}).catch(async err=>{console.log(await page.evaluate(()=>({message:document.querySelector('#scoreMessage').textContent,calls:window.testCalls,setup:window.appState?.score,body:document.body.className})));throw err;});
assert.equal(await page.evaluate(()=>!!document.getElementById('scoreTeamSummaryCard').previousElementSibling.querySelector('#scoreRows')&&!!document.getElementById('scoreTeamSummaryCard').nextElementSibling.querySelector('#scoreAASummary')),true);
assert.equal(await page.locator('#scoreAdminAA').isVisible(),true);assert.equal(await page.locator('#scoreCategory').textContent(),'DISPENSASI LANJUT · November 2026');
assert.match(await page.locator('#scoreRows').textContent(),/11.500.000/);
await page.waitForFunction(()=>document.querySelector('#scoreSummaryRows').querySelectorAll('tr').length===2);assert.match(await page.locator('#scoreSummaryRows').textContent(),/20 Box Bejo Jahe Merah/);assert.match(await page.locator('#scoreSummaryRows').textContent(),/atau/);
for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(300);const size=await page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth}));assert.ok(size.body<=size.viewport,JSON.stringify(size));await page.screenshot({path:root+'/docs/skor-'+width+'.png',fullPage:true});}
await page.locator('#scoreAADate').fill('2026-10-01');await page.locator('#scoreAADate').dispatchEvent('change');
await page.locator('#scoreAACount').fill('');await page.locator('#scoreAASave').click();assert.match(await page.locator('#scoreMessage').textContent(),/bilangan bulat/);
await page.locator('#scoreAACount').fill('10');await page.locator('#scoreAASave').click();await page.waitForFunction(()=>document.querySelector('#scoreAASummary').textContent.includes('AA: 10 / 400'));
await page.locator('#scoreAACount').fill('16');await page.evaluate(()=>loseNext=true);await page.locator('#scoreAASave').click();await page.waitForFunction(()=>document.querySelector('#scoreAASave').textContent==='Periksa / ulangi simpan');
assert.equal(await page.locator('#scoreMonth').isDisabled(),true);await page.locator('#scoreAASave').click();await page.waitForFunction(()=>document.querySelector('#scoreAASummary').textContent.includes('AA: 16 / 400'));
await page.waitForFunction(()=>document.querySelector('#scoreSummaryRows').textContent.includes('AA: Masih kurang 384 outlet'));
const calls=await page.evaluate(()=>testCalls.filter(c=>c.method==='saveScoreAA'));assert.equal(calls.length,3);assert.deepEqual(calls[1].args,calls[2].args);assert.equal(e.rows('SKOR_EVENTS').length,3);
await page.evaluate(()=>{testDelay['2026-09']=120;document.querySelector('#scoreMonth').value='2026-09';loadScoreReport();document.querySelector('#scoreMonth').value='2026-10';loadScoreReport();});await page.waitForTimeout(250);assert.equal(await page.locator('#scoreMonth').inputValue(),'2026-10');assert.match(await page.locator('#scoreRows').textContent(),/11.500.000/);
// MPR adds branding and halves AA only for that team; corrections/retries are replacements.
await page.locator('#scoreSales').selectOption('S2');await page.waitForFunction(()=>appState.score.report?.sales.salesId==='S2');
assert.equal(await page.locator('#scoreRows tr').count(),5);assert.equal(await page.locator('#scoreBrandingCard').isVisible(),true);assert.match(await page.locator('#scoreRows tr').nth(3).textContent(),/5%/);
await page.locator('#scoreBrandingDate').fill('2026-10-01');await page.locator('#scoreBrandingDate').dispatchEvent('change');await page.locator('#scoreBrandingCount').fill('10');await page.locator('#scoreBrandingSave').click();await page.waitForFunction(()=>document.querySelector('#scoreBrandingSummary').textContent.includes('Branding: 10 / 300'));
await page.locator('#scoreBrandingCount').fill('12');await page.evaluate(()=>loseNext=true);await page.locator('#scoreBrandingSave').click();await page.waitForFunction(()=>document.querySelector('#scoreBrandingSave').textContent==='Periksa / ulangi simpan');assert.equal(await page.locator('#scoreAACount').isDisabled(),true);await page.locator('#scoreBrandingSave').click();await page.waitForFunction(()=>document.querySelector('#scoreBrandingSummary').textContent.includes('Branding: 12 / 300'));
await page.waitForFunction(()=>document.querySelector('#scoreSummaryRows').textContent.includes('Branding: Masih kurang 288 outlet'));
const brandCalls=await page.evaluate(()=>testCalls.filter(c=>c.method==='saveScoreBranding'));assert.equal(brandCalls.length,3);assert.deepEqual(brandCalls[1].args,brandCalls[2].args);assert.equal(e.rows('SKOR_EVENTS').length,5);
for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
await page.locator('#scoreSales').selectOption('S1');await page.waitForFunction(()=>appState.score.report?.sales.salesId==='S1');assert.equal(await page.locator('#scoreRows tr').count(),4);assert.equal(await page.locator('#scoreBrandingCard').isVisible(),false);assert.match(await page.locator('#scoreRows tr').nth(3).textContent(),/10%/);
// Failure clears prior totals instead of displaying a stale category.
await page.evaluate(()=>{document.querySelector('#scoreMonth').value='bad';loadScoreReport();});assert.equal(await page.locator('#scoreTotal').textContent(),'—');
// Session reset clears score, daily input and report DOM from the previous account.
await page.evaluate(()=>{kchAuthGeneration++;resetKchSessionUi();});assert.equal(await page.evaluate(()=>appState.score),null);assert.equal(await page.locator('#scoreRows').textContent(),'');assert.equal(await page.locator('#scoreAACount').inputValue(),'');
e.actor({role:'GUEST',email:'juniortlkchlse@gmail.com',salesId:''});await page.evaluate(()=>{appState.user={role:'GUEST'};installKchAccountActions(appState.user);switchView('skor')});await page.waitForFunction(()=>document.querySelector('#scoreRows').children.length===4);
assert.equal(await page.locator('#scoreAdminAA').isVisible(),false);assert.equal(await page.locator('#scoreMapping').isVisible(),false);assert.equal(await page.locator('#scoreSales option').count(),2);
await page.waitForFunction(()=>document.querySelector('#scoreSummaryRows').querySelectorAll('tr').length===2);assert.match(await page.locator('#scoreSummaryRows').textContent(),/Sales One/);assert.match(await page.locator('#scoreSummaryRows').textContent(),/Sales Two/);
await page.locator('#scoreSales').selectOption('S2');await page.waitForFunction(()=>appState.score.report?.sales.salesId==='S2');assert.equal(await page.locator('#scoreBrandingCard').isVisible(),true);assert.equal(await page.locator('#scoreAdminBranding').isVisible(),false);
assert.deepEqual(errors,[]);console.log('Browser checks passed: real HTML/JS + mocked Google APIs; desktop/mobile 1440/390/320; manual AA/branding create/correction/replay; Motoris rules preserved; period races; session reset; sales visibility.');
}finally{await browser.close();server.close();}})().catch(err=>{console.error(err);process.exitCode=1});
