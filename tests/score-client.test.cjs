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
  const setup={success:true,canManage:true,today:'2026-10-25',mappingReady:true,mappingIssues:[],products:[],sales:[{salesId:'S1',name:'One',team:'Motoris',active:true}]};
  const report={success:true,mappingReady:true,month:'2026-10',sales:{salesId:'S1'},parameters:[{name:'A',actual:0,target:5000000,weight:0.4,max:40,achievement:0,points:0,score:0}],total:39.999999,category:'EVALUASI',nextMonth:'November 2026',workDays:27,workDaysPassed:21,dailyAA:[{date:'2026-10-01',isWorkDay:true,count:null,revision:''}],totalAA:0,enteredDays:0};
  node('scoreSales').value='S1';node('scoreMonth').value='2026-10';
  c.scoreState().setup=setup;
  return {c,node,requests,setup,report};
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
