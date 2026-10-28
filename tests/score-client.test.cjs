const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function client(){
  const nodes={},requests=[];
  const node=id=>nodes[id]??={value:'',textContent:'',innerHTML:'',hidden:false,disabled:false};
  const c={document:{getElementById:node,addEventListener(){}},crypto:{randomUUID:()=> 'fixed-uuid-for-test'},console};
  vm.createContext(c);
  for(const name of ['js.html','score-client.html'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8').replace(/^\s*<script>/,'').replace(/<\/script>\s*$/,''),c);
  c.kchRun=()=>{let success,failure;const p=new Proxy({},{get(_,key){if(key==='withSuccessHandler')return fn=>{success=fn;return p;};if(key==='withFailureHandler')return fn=>{failure=fn;return p;};return(...args)=>requests.push({method:key,args,success,failure});}});return p;};
  c.showToast=()=>{};
  const loadSummary=c.loadScoreTeamSummary;
  c.loadScoreTeamSummary=()=>{};
  const setup={success:true,canManage:true,today:'2026-10-25',mappingReady:true,mappingIssues:[],products:[],sales:[{salesId:'S1',name:'One',team:'Motoris',active:true}]};
  const report={success:true,mappingReady:true,month:'2026-10',sales:{salesId:'S1'},parameters:[{name:'A',actual:0,target:5000000,weight:0.4,max:40,achievement:0,points:0,score:0}],total:39.999999,category:'EVALUASI',nextMonth:'November 2026',workDays:27,workDaysPassed:21,dailyAA:[{date:'2026-10-01',isWorkDay:true,count:null,revision:''}],totalAA:0,enteredDays:0};
  node('scoreSales').value='S1';node('scoreMonth').value='2026-10';
  c.scoreState().setup=setup;
  return {c,node,requests,setup,report,loadSummary};
}
test('render uses backend unrounded category even when displayed total rounds to 40',()=>{
  const e=client();e.c.loadScoreReport();e.requests[0].success(e.report);
  assert.equal(e.node('scoreTotal').textContent,'40 / 100');assert.equal(e.node('scoreCategory').textContent,'EVALUASI · November 2026');
  assert.equal(e.node('scoreAACount').value,'');assert.match(e.node('scoreAASummary').textContent,/belum diinput/);
});
test('period changes and failures clear old totals; late previous response cannot replace new report',()=>{
  const e=client();e.c.loadScoreReport();const older=e.requests[0];e.node('scoreMonth').value='2026-09';e.c.loadScoreReport();
  e.requests[1].success({...e.report,month:'2026-09',total:65,category:'LANJUT BULAN BERIKUTNYA',nextMonth:'Oktober 2026'});
  older.success(e.report);assert.equal(e.node('scoreTotal').textContent,'65 / 100');assert.match(e.node('scoreCategory').textContent,/Oktober/);
  e.c.loadScoreReport();assert.equal(e.node('scoreTotal').textContent,'Sedang memuat data');e.requests[2].failure({message:'Read failed'});assert.equal(e.node('scoreCategory').textContent,'Gagal memuat');assert.equal(e.c.scoreState().report,null);
});
test('AA rejects blank, negative and decimal input before RPC; explicit zero is accepted',()=>{
  const e=client();e.c.scoreState().report=e.report;e.node('scoreAADate').value='2026-10-01';
  for(const text of ['', '-1','1.5']){e.node('scoreAACount').value=text;e.c.saveScoreAA();assert.equal(e.requests.length,0);}
  e.node('scoreAACount').value='0';e.c.saveScoreAA();assert.equal(e.requests[0].args[0].count,0);
});
test('uncertain AA locks date/sales/count and retries identical request/revision; double-click sends once',()=>{
  const e=client();e.c.scoreState().report=e.report;e.node('scoreAADate').value='2026-10-01';e.node('scoreAACount').value='12';
  e.c.saveScoreAA();e.c.saveScoreAA();assert.equal(e.requests.length,1);assert.equal(e.node('scoreSales').disabled,true);assert.equal(e.node('scoreAACount').disabled,true);
  e.requests[0].success({success:false,code:'SAVE_UNCERTAIN',message:'Unknown'});assert.equal(e.node('scoreAASave').textContent,'Periksa / ulangi simpan');assert.equal(e.node('scoreAASave').disabled,false);
  e.c.saveScoreAA();assert.deepEqual(e.requests[0].args,e.requests[1].args);
});
test('revision conflict invalidates stale AA form and requires reload before another write',()=>{
  const e=client();e.c.scoreState().report=e.report;e.node('scoreAADate').value='2026-10-01';e.node('scoreAACount').value='12';e.c.saveScoreAA();
  e.requests[0].success({success:false,code:'REVISION_CONFLICT',message:'Changed'});assert.equal(e.c.scoreState().pending,null);assert.equal(e.c.scoreState().report,null);assert.equal(e.node('scoreAASave').disabled,true);
  e.c.saveScoreAA();assert.equal(e.requests.length,1);
});
test('setup failure clears prior report and reports error; sales admin controls remain hidden',()=>{
  const e=client();e.c.scoreState().report=e.report;e.c.openScore();e.requests[0].failure({message:'Denied'});
  assert.equal(e.c.scoreState().setup,null);assert.equal(e.c.scoreState().report,null);assert.equal(e.node('scoreTotal').textContent,'—');assert.equal(e.node('scoreAdminAA').hidden,true);
});
test('backend-controlled sales scope hides admin inputs and read-only mapping',()=>{
  const e=client();e.c.openScore();e.requests[0].success({...e.setup,canManage:false});
  assert.equal(e.node('scoreAdminAA').hidden,true);assert.equal(e.node('scoreMapping').hidden,true);
  e.requests[1].success(e.report);assert.equal(e.node('scoreAASave').disabled,true);
  e.node('scoreAACount').value='12';e.c.saveScoreAA();assert.equal(e.requests.length,2);
});

function brandingClient(){const e=client();e.report.brandingEnabled=true;e.report.totalBranding=150;e.report.brandingEnteredDays=1;e.report.dailyBranding=[{date:'2026-10-01',isWorkDay:true,count:150,revision:'BRANDING-REV-1'}];e.report.parameters.push(...[2,3,4].map(i=>({...e.report.parameters[0],name:'Parameter '+i})));e.report.parameters.push({name:'Branding',actual:150,target:300,weight:.05,max:5,achievement:.5,points:2.5,score:2.5});return e;}
test('MPR branding renders as a count, and Motoris response hides the branding card',()=>{
 const e=brandingClient();e.c.loadScoreReport();e.requests[0].success(e.report);assert.equal(e.node('scoreBrandingCard').hidden,false);assert.equal(e.node('scoreAdminBranding').hidden,false);assert.match(e.node('scoreBrandingSummary').textContent,/150 \/ 300/);assert.match(e.node('scoreRows').innerHTML,/<td>Branding<\/td><td>150<\/td><td>300<\/td>/);
 e.c.loadScoreReport();assert.equal(e.node('scoreBrandingCard').hidden,true);e.requests[1].success({...e.report,brandingEnabled:false});assert.equal(e.node('scoreBrandingCard').hidden,true);
});
test('branding save uses daily revision and locks AA/date/period during an uncertain retry',()=>{
 const e=brandingClient();e.c.scoreState().report=e.report;e.node('scoreBrandingDate').value='2026-10-01';e.node('scoreBrandingCount').value='16';e.c.saveScoreBranding();
 assert.equal(e.requests[0].method,'saveScoreBranding');assert.equal(e.requests[0].args[0].expectedRevision,'BRANDING-REV-1');assert.equal(e.node('scoreAACount').disabled,true);assert.equal(e.node('scoreBrandingCount').disabled,true);e.c.saveScoreAA();assert.equal(e.requests.length,1);
 e.requests[0].success({success:false,code:'SAVE_UNCERTAIN',message:'Unknown'});e.c.saveScoreBranding();assert.deepEqual(e.requests[0].args,e.requests[1].args);
});
test('guest may see branding history but has no branding input and cannot initiate a save',()=>{
 const e=brandingClient();e.setup.canManage=false;e.c.loadScoreReport();e.requests[0].success(e.report);assert.equal(e.node('scoreBrandingCard').hidden,false);assert.equal(e.node('scoreAdminBranding').hidden,true);assert.equal(e.node('scoreBrandingSave').disabled,true);
 e.node('scoreBrandingCount').value='12';e.c.saveScoreBranding();assert.equal(e.requests.length,1);
});
test('branding validation rejects blank, negative and fractional counts before sending RPC',()=>{
 const e=brandingClient();e.c.scoreState().report=e.report;e.node('scoreBrandingDate').value='2026-10-01';for(const v of ['','-1','1.5']){e.node('scoreBrandingCount').value=v;e.c.saveScoreBranding();assert.equal(e.requests.length,0);}
 e.node('scoreBrandingCount').value='0';e.c.saveScoreBranding();assert.equal(e.requests[0].args[0].count,0);
});

test('omitted or empty nullable daily AA counts render as unentered while saved 400 and explicit zero remain intact',()=>{
 const e=client();e.report.totalAA=400;e.report.enteredDays=2;e.report.dailyAA=[{date:'2026-10-01',isWorkDay:true},{date:'2026-10-02',count:400,revision:'SAVED-400'},{date:'2026-10-03',count:0,revision:'SAVED-ZERO'},{date:'2026-10-04',count:''}];
 e.c.loadScoreReport();assert.doesNotThrow(()=>e.requests[0].success(e.report));assert.doesNotMatch(e.node('scoreDailyRows').innerHTML,/Sedang memuat data/);assert.match(e.node('scoreDailyRows').innerHTML,/400/);assert.match(e.node('scoreDailyRows').innerHTML,/<td>0<\/td>/);assert.match(e.node('scoreDailyRows').innerHTML,/—/);assert.match(e.node('scoreAASummary').textContent,/AA: 400/);assert.equal(e.c.scoreState().report.dailyAA[0].count,null);
});
test('missing daily AA response cannot leave a permanent loading row or enable writes',()=>{
 const e=client();delete e.report.dailyAA;e.c.loadScoreReport();assert.doesNotThrow(()=>e.requests[0].success(e.report));assert.doesNotMatch(e.node('scoreDailyRows').innerHTML,/Sedang memuat data/);assert.match(e.node('scoreMessage').textContent,/belum lengkap/);assert.equal(e.node('scoreAASave').disabled,true);assert.equal(e.c.scoreState().report,null);
});
test('missing count for a committed day is an explicit failure, never an invented zero or editable blank',()=>{
 const e=client();e.report.dailyAA=[{date:'2026-10-01',revision:'COMMITTED'}];e.c.loadScoreReport();e.requests[0].success(e.report);assert.match(e.node('scoreMessage').textContent,/sudah tersimpan/);assert.equal(e.node('scoreAASave').disabled,true);assert.equal(e.c.scoreState().report,null);assert.doesNotMatch(e.node('scoreDailyRows').innerHTML,/Sedang memuat data/);
});
test('transport failure clears daily loading and keeps retry available through Muat ulang',()=>{
 const e=client();e.c.loadScoreReport();e.requests[0].failure({message:'offline'});assert.doesNotMatch(e.node('scoreDailyRows').innerHTML,/Sedang memuat data/);assert.equal(e.node('scoreAASave').disabled,true);assert.equal(e.node('scoreCategory').textContent,'Gagal memuat');
});
test('branding accepts omitted empty counts through the same daily response boundary',()=>{
 const e=brandingClient();e.report.dailyBranding=[{date:'2026-10-01'},{date:'2026-10-02',count:150,revision:'SAVED'}];e.c.loadScoreReport();e.requests[0].success(e.report);assert.match(e.node('scoreBrandingDailyRows').innerHTML,/150/);assert.match(e.node('scoreBrandingDailyRows').innerHTML,/—/);assert.equal(e.node('scoreBrandingCard').hidden,false);
});

function summaryResponse(month='2026-10'){
 return {success:true,month,rows:[{sales:{salesId:'S1',name:'Amul Husni',team:'Motoris'},active:true,total:39.999999,category:'EVALUASI',parameters:[{score:10,max:40},{score:5,max:25},{score:15,max:25},{score:10,max:10}],guidance:[{label:'Fokus A',remaining:3000000,count:false,alternatives:[{quantity:30,unit:'box',productName:'Bejo Jahe Merah',unitPrice:100000}],warnings:[]},{label:'Fokus B',remaining:4500000,count:false,alternatives:[{quantity:30,unit:'box',productName:'Komix Herbal Sachet Original',unitPrice:150000},{quantity:18,unit:'box',productName:'Promag Herbal',unitPrice:250000}],warnings:[]},{label:'AA',remaining:0,count:true,alternatives:[],warnings:[]}],message:''}]};
}
test('team recap renders named product/unit alternatives under each sales and preserves the backend category',()=>{
 const e=client();e.loadSummary('2026-10');e.requests[0].success(summaryResponse());const html=e.node('scoreSummaryRows').innerHTML;
 assert.match(html,/Amul Husni/);assert.match(html,/30 box Bejo Jahe Merah/);assert.match(html,/Komix Herbal Sachet Original.*ATAU.*18 box Promag Herbal/);assert.match(html,/AA: target tercapai/);assert.match(html,/EVALUASI/);assert.match(html,/39,?99|40/);
});
test('same-period sales selection reuses recap; period changes ignore stale results and failures',()=>{
 const e=client();e.loadSummary('2026-10');const old=e.requests[0];e.loadSummary('2026-10');assert.equal(e.requests.length,1);e.loadSummary('2026-09');e.requests[1].success(summaryResponse('2026-09'));const html=e.node('scoreSummaryRows').innerHTML;old.success(summaryResponse());old.failure({message:'old error'});assert.equal(e.node('scoreSummaryRows').innerHTML,html);assert.match(e.node('scoreSummaryPeriod').textContent,/2026-09/);
});
test('recap errors/empty results clear loading, allow retry and never invalidate the selected sales AA form',()=>{
 const e=client();e.c.scoreState().report=e.report;e.loadSummary('2026-10');e.requests[0].failure({message:'offline'});assert.match(e.node('scoreSummaryRows').innerHTML,/offline/);assert.doesNotMatch(e.node('scoreSummaryRows').innerHTML,/Sedang memuat data/);assert.equal(e.c.scoreState().report,e.report);e.loadSummary('2026-10');assert.equal(e.requests.length,2);e.requests[1].success({success:true,month:'2026-10',rows:[]});assert.match(e.node('scoreSummaryRows').innerHTML,/Belum ada profil/);
});
test('recap escapes sales/product names and price diagnostics rather than injecting sheet content into the page',()=>{
 const e=client(),r=summaryResponse();r.rows[0].sales.name='<img src=x onerror=alert(1)>';r.rows[0].guidance[0].alternatives[0].productName='<script>alert(1)</script>';e.loadSummary('2026-10');e.requests[0].success(r);const html=e.node('scoreSummaryRows').innerHTML;assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;img/);assert.match(html,/&lt;script/);
});
test('recap states incomplete scores as unavailable and cannot turn missing data into zero',()=>{
 for(const total of [null,undefined]){const e=client(),r=summaryResponse();r.rows[0].total=total;r.rows[0].category=null;r.rows[0].parameters=[];r.rows[0].guidance=[];r.rows[0].message='Master belum valid';e.loadSummary('2026-10');e.requests[0].success(r);assert.match(e.node('scoreSummaryRows').innerHTML,/Belum dapat dihitung/);assert.match(e.node('scoreSummaryRows').innerHTML,/Master belum valid/);}
});
test('invalid recap month clears stale period and makes no request',()=>{
 const e=client();e.loadSummary('');assert.equal(e.requests.length,0);assert.match(e.node('scoreSummaryRows').innerHTML,/Pilih bulan/);
});

test('recap loads independently alongside detail, so failed recap does not prevent daily AA rendering',()=>{
 const e=client();e.c.loadScoreTeamSummary=e.loadSummary;e.c.loadScoreReport();assert.equal(e.requests[0].method,'getScoreTeamSummary');assert.equal(e.requests[1].method,'getScoreReport');e.requests[0].failure({message:'offline'});e.requests[1].success(e.report);assert.equal(e.c.scoreState().report,e.report);assert.match(e.node('scoreDailyRows').innerHTML,/2026-10-01/);assert.match(e.node('scoreSummaryRows').innerHTML,/offline/);
});
