const {test}=require('node:test'),assert=require('node:assert/strict'),{auditSystem}=require('./helpers/audit-system.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));let seq=0;
function seed(e,month,points,options={}){
 const a=(points-50)*125000;if(a<0||a>5000000)throw Error('Fixture supports50..90points');const date=month+'-02',h=e.rows('SALES_TRANSACTIONS')[0];
 for(const [product,amount]of [['LBMAV',a],['LPRGR',5000000],['P1',22000000-a]])if(amount>0){const row={transaction_id:'EVAL-FIXTURE-'+(++seq),transaction_date:date,sales_id:'S1',sales_name:'Sales One',team_name:'Motoris',product_id:product,quantity:1,selling_price:amount,cost_price:0,subtotal_sales:amount,subtotal_cost:0,subtotal_shj:amount};e.rows('SALES_TRANSACTIONS').push(h.map(k=>row[k]??''));}
 e.clock(month+'-25 12:00:00');if(options.capture!==false)e.capturePeriod();
}
function report(e,month){return e.call('getScoreReport',month,'S1');}
test('November categories use exact unrounded thresholds, including zero,70,80and fractions',()=>{
 const e=auditSystem();for(const [value,category]of [[0,'EVALUASI'],[1,'EVALUASI'],[70,'DISPENSASI LANJUT'],[70.000001,'DISPENSASI LANJUT'],[70.5,'DISPENSASI LANJUT'],[79.999999,'DISPENSASI LANJUT'],[80,'DISPENSASI LANJUT'],[80.000001,'AMAN'],[100,'AMAN']])assert.equal(e.c.scoreCategory_(value,e.c.periodPolicyV1_(),'2026-11'),category,String(value));
 assert.equal(e.c.scoreCategory_(50,e.c.periodPolicyV1_(),'2026-10'),'DISPENSASI LANJUT');assert.equal(e.c.scoreCategory_(80,e.c.periodPolicyV1_(),'2026-10'),'LANJUT BULAN BERIKUTNYA');
});
test('real November point totals use new categories without changing parameters or money policy',()=>{
 for(const [points,category]of [[70,'DISPENSASI LANJUT'],[70.5,'DISPENSASI LANJUT'],[75,'DISPENSASI LANJUT'],[80,'DISPENSASI LANJUT'],[80.5,'AMAN']]){const e=auditSystem();seed(e,'2026-11',points);e.clock('2026-11-08 18:30:00');const r=report(e,'2026-11');assert.equal(r.total,points);assert.equal(r.category,category);assert.equal(r.evaluation.phase,'ESTIMASI');assert.equal(r.evaluation.onProbation,false);assert.equal(r.policy.categories[0][0],40);}
});
test('dispensation from legacy October does not retrospectively start the new November follow-up',()=>{
 const e=auditSystem();seed(e,'2026-10',50);seed(e,'2026-11',75);e.clock('2026-12-01 00:00:01');assert.equal(report(e,'2026-10').category,'DISPENSASI LANJUT');const r=report(e,'2026-11');assert.equal(r.category,'DISPENSASI LANJUT');assert.equal(r.evaluation.onProbation,false);assert.equal(r.evaluation.phase,'FINAL');
});
test('below80after November dispensation becomes EVALUASI only after the next month closes',()=>{
 const e=auditSystem();seed(e,'2026-11',75);seed(e,'2026-12',75);e.clock('2026-12-20 12:00:00');let r=report(e,'2026-12');assert.equal(r.category,'DISPENSASI LANJUT');assert.equal(r.evaluation.onProbation,true);assert.equal(r.evaluation.followUpStatus,'MENUNGGU_AKHIR_BULAN');
 e.clock('2027-01-01 00:00:01');r=report(e,'2026-12');assert.equal(r.total,75);assert.equal(r.evaluation.baseCategory,'DISPENSASI LANJUT');assert.equal(r.category,'EVALUASI');assert.equal(r.evaluation.followUpStatus,'TIDAK_TERPENUHI');assert.equal(r.evaluation.previousMonth,'2026-11');assert.equal(r.evaluation.phase,'FINAL');
});
test('75 followed by exactly 80 is evaluated at month close',()=>{
 const e=auditSystem();seed(e,'2026-11',75);seed(e,'2026-12',80);
 e.clock('2026-12-20 12:00:00');let december=report(e,'2026-12');
 assert.equal(december.category,'DISPENSASI LANJUT');
 assert.equal(december.evaluation.followUpStatus,'MENUNGGU_AKHIR_BULAN');
 e.clock('2027-01-01 00:00:01');december=report(e,'2026-12');
 assert.equal(december.evaluation.baseCategory,'DISPENSASI LANJUT');
 assert.equal(december.category,'EVALUASI');
 assert.equal(december.evaluation.followUpStatus,'TIDAK_TERPENUHI');
 assert.match(december.evaluation.message,/80 atau kurang/);
});
test('above80after dispensation is AMAN and ends the following-month probation',()=>{
 const e=auditSystem();seed(e,'2026-11',75);seed(e,'2026-12',85);seed(e,'2027-01',75);e.clock('2027-02-01 00:00:01');const december=report(e,'2026-12');assert.equal(december.category,'AMAN');assert.equal(december.evaluation.followUpStatus,'TERPENUHI');assert.equal(report(e,'2027-01').category,'DISPENSASI LANJUT');assert.equal(report(e,'2027-01').evaluation.onProbation,false);
});
test('a failed previous follow-up is not mistaken for another dispensation merely from its point band',()=>{
 const e=auditSystem();seed(e,'2026-11',75);seed(e,'2026-12',75);seed(e,'2027-01',75);e.clock('2027-02-01 00:00:01');const r=report(e,'2027-01');assert.equal(r.evaluation.previousCategory,'EVALUASI');assert.equal(r.evaluation.onProbation,false);assert.equal(r.category,'DISPENSASI LANJUT');
});
test('unverified prior history cannot cause either an invented dismissal or a final renewed dispensation',()=>{
 const e=auditSystem();seed(e,'2026-11',75,{capture:false});seed(e,'2026-12',75);e.clock('2027-01-01 00:00:01');const r=report(e,'2026-12');assert.equal(r.total,75);assert.equal(r.masterVerified,true);assert.equal(r.category,null);assert.equal(r.evaluation.verified,false);assert.equal(r.evaluation.onProbation,null);assert.equal(r.evaluation.followUpStatus,'RIWAYAT_BELUM_TERVERIFIKASI');assert.match(r.evaluation.message,/belum/);
});
test('final categories that cannot be altered by missing previous history remain usable',()=>{
 for(const [points,category]of [[69,'EVALUASI'],[85,'AMAN']]){const e=auditSystem();seed(e,'2026-12',points);e.clock('2027-01-01 00:00:01');const r=report(e,'2026-12');assert.equal(r.category,category);assert.equal(r.evaluation.verified,true);assert.equal(r.evaluation.followUpStatus,'RIWAYAT_BELUM_TERVERIFIKASI');}
 const e=auditSystem();seed(e,'2026-12',80);e.clock('2027-01-01 00:00:01');assert.equal(report(e,'2026-12').category,null);
});
test('future month never invents a completed previous-month outcome',()=>{
 const e=auditSystem();seed(e,'2026-11',75);seed(e,'2026-12',75);e.clock('2026-11-08 18:30:00');const r=report(e,'2026-12');assert.equal(r.evaluation.phase,'BELUM_BERJALAN');assert.equal(r.evaluation.onProbation,null);assert.equal(r.evaluation.followUpStatus,'MENUNGGU_BULAN_SEBELUMNYA');
});
test('team recap and individual decisions agree and no accounts or business rows are changed by evaluation',()=>{
 const e=auditSystem();seed(e,'2026-11',75);seed(e,'2026-12',75);e.clock('2027-01-01 00:00:01');const before=JSON.stringify([e.rows('SALES'),e.rows('ACCESS_USERS'),e.rows('SALES_TRANSACTIONS')]);e.actor({role:'GUEST'});const summary=e.call('getScoreTeamSummary','2026-12').rows.find(r=>r.sales.salesId==='S1'),detail=report(e,'2026-12');assert.equal(summary.category,'EVALUASI');assert.equal(summary.category,detail.category);assert.deepEqual(clone(summary.evaluation),clone(detail.evaluation));assert.equal(JSON.stringify([e.rows('SALES'),e.rows('ACCESS_USERS'),e.rows('SALES_TRANSACTIONS')]),before);
});
test('snapshot records the evaluation version separately and unknown evaluation versions do not alter incentive money',()=>{
 const e=auditSystem();seed(e,'2026-10',80);seed(e,'2026-11',80);e.clock('2026-12-05 12:00:00');const before=e.call('getIncentiveReport','2026-11','S1'),hs=e.rows(e.c.KCH_PERIOD_MASTERS_)[0],row=e.rows(e.c.KCH_PERIOD_MASTERS_).find((r,i)=>i&&r[hs.indexOf('period')]==='2026-11'&&r[hs.indexOf('entity')]==='RULES'),p=JSON.parse(row[hs.indexOf('data_json')]);assert.equal(p.evaluationPolicy,'KCH_EVAL_2026_11_V1');p.evaluationPolicy='UNSUPPORTED_EVAL_POLICY';row[hs.indexOf('data_json')]=JSON.stringify(p);e.c.KCH_PERIOD_CACHE_=null;
 const r=report(e,'2026-11');assert.equal(r.total,80);assert.equal(r.masterVerified,true);assert.equal(r.category,null);assert.equal(r.evaluation.verified,false);const after=e.call('getIncentiveReport','2026-11','S1');assert.deepEqual(clone(after),clone(before));assert.equal(before.monthly.total,500000);assert.equal(before.dailyTotal,50000);
});
test('newly eligible members with a verified non-scoring previous team do not inherit invented probation',()=>{
 const e=auditSystem();e.cell('SALES','S1',['team_name','SPR']);seed(e,'2026-11',75);e.cell('SALES','S1',['team_name','Motoris']);seed(e,'2026-12',75);e.clock('2027-01-01 00:00:01');const r=report(e,'2026-12');assert.equal(r.category,'DISPENSASI LANJUT');assert.equal(r.evaluation.onProbation,false);
});
test('evaluation source reads are shared across members in team recap',()=>{
 const e=auditSystem();seed(e,'2026-11',75);seed(e,'2026-12',75);e.clock('2027-01-01 00:00:01');e.actor({role:'GUEST'});e.calls.length=0;report(e,'2026-12');const detailCalls=e.calls.length;e.calls.length=0;const summary=e.call('getScoreTeamSummary','2026-12');assert.equal(summary.rows.length,2);assert.ok(e.calls.length<=detailCalls,`${e.calls.length} summary reads vs${detailCalls} single member reads`);
});
test('being evaluated does not add a new financial penalty after the failed follow-up',()=>{
 const e=auditSystem();seed(e,'2026-11',75);seed(e,'2026-12',75);e.clock('2027-01-05 12:00:00');assert.equal(report(e,'2026-12').category,'EVALUASI');const money=e.call('getIncentiveReport','2026-12','S1');assert.equal(money.monthly.total,500000);assert.equal(money.dailyTotal,50000);assert.equal(money.monthTotal,550000);
});
test('historical follow-up uses frozen catalogs even when the current product catalog becomes invalid',()=>{
 const e=auditSystem();seed(e,'2026-11',75);seed(e,'2026-12',75);e.clock('2027-01-05 12:00:00');e.rows('PRODUCTS').push([...e.rows('PRODUCTS')[1]]);const r=report(e,'2026-12');assert.equal(r.total,75);assert.equal(r.category,'EVALUASI');assert.equal(r.evaluation.followUpStatus,'TIDAK_TERPENUHI');
});
test('source verification cannot silently replace an unsupported evaluation policy with the current one',()=>{
 const e=auditSystem();seed(e,'2026-11',75);const hs=e.rows(e.c.KCH_PERIOD_MASTERS_)[0],row=e.rows(e.c.KCH_PERIOD_MASTERS_).find((r,i)=>i&&r[hs.indexOf('period')]==='2026-11'&&r[hs.indexOf('entity')]==='RULES'),rules=JSON.parse(row[hs.indexOf('data_json')]);delete rules.calendar;rules.evaluationPolicy='FUTURE_UNSUPPORTED_EVALUATION';row[hs.indexOf('data_json')]=JSON.stringify(rules);const b=e.call('createOperationalBackup','REQ-EVAL-UNKNOWN-BACKUP-01'),source=e.objects(e.c.KCH_BACKUPS_).find(r=>r.backup_id===b.backupId);e.clock('2026-12-05 12:00:00');const r=e.call('savePeriodVerification',{requestId:'REQ-EVAL-UNKNOWN-VERIFY-01',month:'2026-11',sourceId:source.spreadsheet_id,confirmation:'VERIFIKASI 2026-11',reason:'Sumber versi evaluasi tidak dikenal'});assert.equal(r.state,'FAILED');assert.match(r.message,/Versi aturan evaluasi sumber/);assert.equal(JSON.parse(row[hs.indexOf('data_json')]).evaluationPolicy,'FUTURE_UNSUPPORTED_EVALUATION');
});

test('Admin records HO receipt against a final evaluation, with calendar deadlines and replay protection',()=>{
 const e=auditSystem();
 seed(e,'2026-11',65);
 e.clock('2026-12-11 12:00:00');
 let r=report(e,'2026-11');
 assert.equal(r.rmApproval.deadline,'2026-12-11');
 assert.equal(r.rmApproval.lastWorkDate,'2026-12-15');
 assert.equal(r.rmApproval.status,'MENUNGGU_APPROVAL');
 const input={month:'2026-11',salesId:'S1',receivedDate:'2026-12-11',expectedRevision:''};
 const result=e.call('saveScoreRmApproval',input);
 assert.equal(result.approval.status,'TEPAT_WAKTU');
 assert.equal(e.call('saveScoreRmApproval',input).approval.revision,result.approval.revision);
 assert.equal(e.objects('_KCH_RM_APPROVALS').length,1);
 e.clock('2026-12-13 12:00:00');
 assert.throws(()=>e.call('saveScoreRmApproval',{...input,receivedDate:'2026-12-12'}),/telah berubah/);
 assert.throws(()=>e.call('saveScoreRmApproval',{...input,receivedDate:'2026-12-14'}),/sampai hari ini/);
 e.call('saveScoreRmApproval',{...input,receivedDate:'2026-12-12',expectedRevision:result.approval.revision});
 r=report(e,'2026-11');
 assert.equal(r.rmApproval.status,'LEWAT_TENGGAT');
 assert.equal(r.rmApproval.receivedDate,'2026-12-12');
 assert.equal(e.objects('_KCH_RM_APPROVALS').length,2);
 assert.equal(e.objects('SALES').find(row=>row.sales_id==='S1').status,'ACTIVE');
 e.actor({role:'GUEST'});
 assert.equal(report(e,'2026-11').rmApproval,undefined);
 assert.throws(()=>e.call('saveScoreRmApproval',input),/ACCESS_DENIED/);
 e.actor({role:'SALES',salesId:'S1'});
 assert.equal(report(e,'2026-11').rmApproval,undefined);
 assert.throws(()=>e.call('saveScoreRmApproval',input),/ACCESS_DENIED/);
});

test('after a year boundary an evaluation with no receipt shows overdue, while a safe score has no approval form',()=>{
 const e=auditSystem();
 seed(e,'2026-12',65);
 e.clock('2027-01-12 09:00:00');
 const r=report(e,'2026-12');
 assert.equal(r.rmApproval.deadline,'2027-01-11');
 assert.equal(r.rmApproval.lastWorkDate,'2027-01-15');
 assert.equal(r.rmApproval.status,'LEWAT_TENGGAT');
 const safe=auditSystem();seed(safe,'2026-11',85);safe.clock('2026-12-12 09:00:00');
 assert.equal(report(safe,'2026-11').rmApproval,undefined);
 assert.throws(()=>safe.call('saveScoreRmApproval',{month:'2026-11',salesId:'S1',receivedDate:'2026-12-11',expectedRevision:''}),/Evaluasi yang sudah final/);
});
