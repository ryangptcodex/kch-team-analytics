const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function browser(){
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const els=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{textContent:'old',innerHTML:'old',style:{},setAttribute(k,v){this[k]=v}}]));
 const calls=[],toasts=[];const c={document:{addEventListener(){},getElementById:id=>els[id]||null},console,window:{}};vm.createContext(c);
 vm.runInContext(fs.readFileSync(path.join(root,'js.html'),'utf8').replace(/^<script>/,'').replace(/<\/script>\s*$/,''),c);
 c.showToast=(...args)=>toasts.push(args);c.showKchAuthError=()=>{};
 const renderers=['renderSalesTrendChart','renderSalesLeaderboard','renderDailySalesComparisonChart','renderTeamDonutChart','renderAreaDonutChart','renderAttendanceGrid','renderVisitPhotos','renderRecentTransactions','renderActivityFeed','updatePeriodBadges'];
 renderers.forEach(n=>c[n]=()=>{});
 c.kchRun=()=>{let ok,fail;const p={withSuccessHandler:f=>(ok=f,p),withFailureHandler:f=>(fail=f,p),getDashboardMetrics:payload=>calls.push({method:'metrics',payload,ok,fail}),getInitialAppMetadata:()=>calls.push({method:'metadata',ok,fail})};return p};
 return {c,els,calls,toasts,html};
}
test('initial HTML has neutral KPI values and no sample target or identity',()=>{
 const e=browser();assert.doesNotMatch(e.html,/147\.000\.000|Ryan Pratama|ryan\.coordinator@/);
 for(const id of ['kpiTotalOmset','kpiCumulativeTarget','kpiDaysPassedBadge','kpiTopMotorisAchieved'])assert.match(e.html,new RegExp('id="'+id+'"[^>]*>[\\s\\S]*?Sedang memuat data'));
 assert.match(e.html,/id="dashboardLoadStatus"[^>]*>[\s\S]*?Sedang memuat data/);
});
test('refresh clears old values and charts until a genuine server response arrives',()=>{
 const e=browser();let destroyed=0;e.c.appState.dashboardData={kpi:{totalTarget:147000000}};e.c.appState.charts.salesTrendChart={destroy(){destroyed++}};
 e.c.loadDashboardMetrics();assert.equal(e.els.kpiCumulativeTarget.textContent,'Sedang memuat data');assert.equal(e.c.appState.dashboardData,null);assert.equal(destroyed,1);assert.equal(e.els['view-dashboard']['aria-busy'],'true');
 e.calls[0].ok({success:true,kpi:{totalTarget:123456,totalSales:200}});assert.match(e.els.kpiCumulativeTarget.textContent,/123\.456/);assert.equal(e.els.kpiCumulativeTarget['data-loading'],'false');assert.match(e.els.dashboardLoadStatus.innerHTML,/Diperbarui/);assert.equal(e.els['view-dashboard']['aria-busy'],'false');
});
test('failed or empty responses stay neutral rather than showing false zeros or stale values',()=>{
 for(const mode of ['transport','rejected','null']){const e=browser();e.c.loadDashboardMetrics();if(mode==='transport')e.calls[0].fail(Error('offline'));else e.calls[0].ok(mode==='null'?null:{success:false,message:'No data'});
 assert.equal(e.els.kpiCumulativeTarget.textContent,'—');assert.equal(e.els.dashboardLoadStatus.textContent,'Gagal memuat data');assert.match(e.els.salesPerformanceTbody.innerHTML,/belum berhasil/);assert.equal(e.c.appState.isLoadingDashboard,false);}
});
test('rapid period changes ignore stale successes and failures',()=>{
 const e=browser();e.c.loadDashboardMetrics();e.c.appState.dashboardPeriod='MONTH';e.c.loadDashboardMetrics();assert.equal(e.calls[1].payload.period,'MONTH');
 e.calls[1].ok({success:true,kpi:{totalTarget:600,totalSales:200}});e.calls[0].ok({success:true,kpi:{totalTarget:999}});assert.match(e.els.kpiCumulativeTarget.textContent,/600/);e.calls[0].fail(Error('old'));assert.equal(e.toasts.length,0);assert.equal(e.c.appState.isLoadingDashboard,false);
});
test('metadata loading invalidates old metrics and remains neutral on failure',()=>{
 const e=browser();e.c.loadDashboardMetrics();e.c.loadMetadata();assert.equal(e.calls[1].method,'metadata');e.calls[0].ok({success:true,kpi:{totalTarget:999}});assert.equal(e.els.kpiCumulativeTarget.textContent,'Sedang memuat data');
 e.calls[1].fail(Error('offline'));assert.equal(e.els.dashboardLoadStatus.textContent,'Gagal memuat data');assert.equal(e.c.appState.isLoadingMetadata,false);
});
test('real zero returned by server is displayed as zero after loading',()=>{
 const e=browser();e.c.loadDashboardMetrics();e.calls[0].ok({success:true,kpi:{totalTarget:0,totalSales:0}});assert.equal(e.els.kpiCumulativeTarget.textContent,'Rp 0');assert.equal(e.els.kpiTotalOmset.textContent,'Rp 0');
});
