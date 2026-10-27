// Optional browser check. Requires Playwright, Chromium, and a local official Chart.js UMD bundle.
// CHART_JS_PATH=/path/to/chart.umd.js node tools/responsive-ui-check.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const chartPath=process.env.CHART_JS_PATH;
if(!chartPath)throw Error('Set CHART_JS_PATH to an official Chart.js UMD bundle.');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<\?!= include_\('([^']+)'\); \?>/g,(_,n)=>fs.readFileSync(path.join(root,n+'.html'),'utf8')).replace(/<script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'').replace(/<\?[\s\S]*?\?>/g,m=>m.includes('JSON.stringify')?'null':'');
html=html.replace('</head>',()=>'<script>'+fs.readFileSync(chartPath,'utf8')+'</script></head>');
html=html.replace(/<\/body>\s*<\/html>\s*$/,`<script>
initKchAuthentication=function(){document.body.classList.remove('kch-locked');document.getElementById('kchAuthScreen').hidden=true;};
</script></body></html>`);
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{const page=await browser.newPage({viewport:{width:2560,height:1200},deviceScaleFactor:0.75}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setContent(html);
await page.evaluate(()=>{
  const longName='Muhammad Ryan dengan Nama Sales Panjang untuk Pengujian Responsif';
  appState.user={role:'ADMIN',fullName:longName,shortName:'Muhammad',email:'admin@example.test'};
  appState.teams=['Motoris','MMTW'];
  appState.sales=Array.from({length:12},(_,i)=>({sales_id:'S'+i,full_name:longName+' '+i,team_name:i%2?'MMTW':'Motoris',area:'Lhokseumawe',status:'ACTIVE',attendance_hk:10,attendance_month:'2026-10'}));
  appState.attendanceSales=appState.sales;
  appState.products=Array.from({length:12},(_,i)=>({product_id:'P'+i,product_name:'Produk dengan nama panjang untuk menguji tabel responsif '+i,brand:'Kalbe',unit:'Box',status:'ACTIVE'}));
  appState.inventory=appState.products.map(p=>({...p,'PT. Global Mitra Prima':100,'AP. Geubrina Rizki':100}));
  appState.priceMaster=appState.products.map(p=>({...p,team_name:'Motoris',cost_price:6000,selling_price:10000,shj:4000}));
  appState.files=[{file_name:'Panduan Penjualan dengan Judul Dokumen Panjang untuk Tim Lhokseumawe',category:'Panduan',file_url:'https://example.test',status:'ACTIVE'}];
  updateDynamicGreeting();populateAllSelects();renderInventoryTable();renderPriceMasterTable();renderSalesProfiles();renderDriveFiles();ensureTransactionRows();
  window.testDashboard={success:true,kpi:{totalSales:26200,totalTarget:549000000,achievementPct:0.005,workDaysPassed:23,workDaysRemaining:4,totalWorkDays:27,topCanvasser:{name:longName,achieved:12500000,pct:10,teamName:'Canvasser'},topMotoris:{name:longName,achieved:15000000,pct:20,teamName:'Motoris'}},salesTrend:[{date:'2026-10-26',amount:10000,targetAmount:27000000},{date:'2026-10-27',amount:26200,targetAmount:27000000}],salesPerformance:appState.sales.map(s=>({salesId:s.sales_id,name:s.full_name,teamName:s.team_name,achieved:15000000,todayAchieved:100000,dailyRate:1200000,periodTarget:27000000,monthlyTarget:27000000})),teamAchievements:[{teamName:'Motoris',achieved:26200,color:'#2563eb'}],areaAchievements:[{areaName:'Lhokseumawe',achieved:26200,color:'#2563eb'}]};
  appState.dashboardData=testDashboard;renderDashboardData(testDashboard);
  window.activateView=function(id){document.querySelectorAll('.content-view').forEach(e=>e.classList.toggle('active',e.id===id));};
});
// These CSS viewport widths cover 1920px screens at 75/80/100/125/150% zoom,
// plus laptop/tablet/phone sizes. Resize the same page to exercise Chart.js observers.
const widths=[2560,2400,1920,1536,1440,1280,1024,820,768,390,320,2560];
const views=await page.locator('.content-view').evaluateAll(es=>es.map(e=>e.id));
for(const width of widths){await page.setViewportSize({width,height:1000});
  for(const view of views){await page.evaluate(id=>activateView(id),view);await page.waitForTimeout(view==='view-dashboard'?150:30);
    const metrics=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(metrics.scroll<=width+1,`${view} at ${width}: ${JSON.stringify(metrics)}`);
  }
  await page.evaluate(()=>activateView('view-dashboard'));await page.waitForTimeout(200);
  if(width===2560&&process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH});
  const positions=await page.locator('.dashboard-main-grid > div').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}}));
  if(width>1080)assert.ok(positions[0].right<=positions[1].left+1,`Dashboard columns overlap at ${width}`);
  for(const id of ['salesTrendChart','salesDailyComparisonChart','teamDonutChart','areaDonutChart']){
    const size=await page.locator('#'+id).evaluate(e=>({width:e.getBoundingClientRect().width,parent:e.parentElement.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));
    assert.ok(size.width>0&&size.width<=size.parent+1&&size.height>0,`${id} at ${width}: ${JSON.stringify(size)}`);
  }
}
// Header regions must wrap onto separate rows instead of overlapping.
for(const width of [2560,1440,1024,390,320]){
  await page.setViewportSize({width,height:600});
  const rects=await page.locator('.topbar-left, .topbar-right').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}}));
  assert.ok(rects[0].right<=rects[1].left+1 || rects[0].bottom<=rects[1].top+1,`Header overlaps at ${width}`);
  for(const id of ['modalTransactionDetail','modalTransactionEdit','modalPhotoUpload','modalKchProfile']){
    await page.locator('#'+id).evaluate(e=>e.style.display='flex');
    const rect=await page.locator('#'+id+' .modal-dialog').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}});
    assert.ok(rect.left>=-1&&rect.right<=width+1&&rect.top>=-1&&rect.bottom<=601,`${id} at ${width}: ${JSON.stringify(rect)}`);
    await page.locator('#'+id).evaluate(e=>e.style.display='none');
  }
}
// Sidebar collapse/expand must also let active charts resize, without clearing data.
await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>toggleSidebarDesktop());await page.waitForTimeout(400);await page.evaluate(()=>toggleSidebarDesktop());await page.waitForTimeout(400);
assert.equal(await page.locator('#kpiCumulativeTarget').textContent(),'Rp 549.000.000');
assert.equal(await page.evaluate(()=>appState.charts.salesTrendChart.data.datasets.at(-1).data[1]),26200);
assert.deepEqual(errors,[]);
console.log(`PASS: ${views.length} views at ${widths.length} viewport transitions, including effective 75% at 2560 CSS px; four real Chart.js charts resize; sidebar and original data preserved.`);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
