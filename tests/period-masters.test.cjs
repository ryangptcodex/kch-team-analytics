const {test}=require('node:test'),assert=require('node:assert/strict'),{auditSystem}=require('./helpers/audit-system.cjs');
test('closed-month team/target, dashboard and scores use verified snapshots after current master changes',()=>{
 const e=auditSystem();e.capturePeriod();e.save();e.clock('2026-11-03 12:00:00');e.cell('SALES','S1',['team_name','Canvasser']);e.cell('SALES','S1',['target_monthly',80000000]);
 e.actor({role:'GUEST'});const monthly=e.call('getMonthlyTeamReport','2026-10','S1');assert.equal(monthly.success,true,monthly.message);assert.equal(monthly.sales.teamName,'Motoris');assert.equal(monthly.sales.targetMonthly,27000000);
 const dash=e.call('getDashboardMetrics',{period:'CUSTOM',startDate:'2026-10-01',endDate:'2026-10-31'});assert.equal(dash.success,true,dash.message);assert.equal(dash.salesPerformance.find(r=>r.salesId==='S1').monthlyTarget,27000000);
 const score=e.call('getScoreReport','2026-10','S1');assert.equal(score.masterVerified,true);assert.equal(score.sales.team,'Motoris');assert.equal(score.parameters[2].target,27000000);
});
test('missing historical master is explicitly unknown instead of guessing certified target or incentive money',()=>{
 const e=auditSystem();e.capturePeriod();e.clock('2026-11-03 12:00:00');e.actor({role:'GUEST'});
 const monthly=e.call('getMonthlyTeamReport','2026-09','S1');assert.equal(monthly.sales.targetVerified,false);assert.equal(monthly.sales.targetMonthly,null);
 const score=e.call('getScoreReport','2026-09','S1');assert.equal(score.masterVerified,false);assert.equal(score.total,null);assert.equal(score.parameters[2].target,null);
 const incentive=e.call('getIncentiveReport','2026-09','S1');assert.equal(incentive.masterVerified,false);assert.equal(incentive.monthTotal,null);assert.equal(incentive.quarter.amount,null);
});
test('master editor validates revisions, preserves balances and snapshots the current month in the same commit',()=>{
 const e=auditSystem();e.capturePeriod();const setup=e.call('getMasterEditor'),record=setup.tables.SALES.rows.find(r=>r.data.sales_id==='S1'),payload={requestId:'REQ-MASTER-REVISION-0001',table:'SALES',data:{...record.data,full_name:'Sales Updated'},expectedRevision:record.revision,reason:'Nama lengkap diperbarui'};
 const saved=e.call('saveMasterRecord',payload);assert.equal(saved.success,true,saved.message);assert.equal(e.stock(),10);assert.equal(e.objects('SALES').find(r=>r.sales_id==='S1').full_name,'Sales Updated');const snapshots=e.objects(e.c.KCH_PERIOD_MASTERS_).filter(r=>r.period==='2026-10'&&r.entity==='SALES');assert.equal(JSON.parse(snapshots.find(r=>r.record_key==='S1').data_json).full_name,'Sales Updated');
 assert.equal(e.call('saveMasterRecord',payload).replayed,true);assert.equal(e.call('saveMasterRecord',{...payload,requestId:'REQ-MASTER-REVISION-0002',data:{...payload.data,full_name:'Stale'}}).state,'FAILED');
});
test('adding a master product creates zero balances and never the legacy default500',()=>{
 const e=auditSystem();const r=e.call('saveMasterRecord',{requestId:'REQ-MASTER-PRODUCT-0001',table:'PRODUCTS',data:{product_id:'NEWP',product_name:'New Product',category:'General',unit:'Box',brand:'Brand',min_stock:0,status:'ACTIVE'},expectedRevision:'',reason:'Produk baru operasional'});assert.equal(r.success,true,r.message);const row=e.objects('INVENTORY').find(r=>r.product_id==='NEWP');assert.equal(row['PT. Global Mitra Prima'],0);assert.equal(row['AP. Geubrina Rizki'],0);
});
test('historical verification accepts only a registered private source and cannot overwrite a frozen period',()=>{
 const e=auditSystem();e.cell('SALES','S1',['target_monthly',27000000]);e.cell('SALES','S2',['target_monthly',27000000]);const b=e.call('createOperationalBackup','REQ-PERIOD-SOURCE-00001');assert.equal(b.success,true,b.message);const registry=e.objects(e.c.KCH_BACKUPS_).find(r=>r.backup_id===b.backupId);e.clock('2026-11-03 12:00:00');
 const payload={requestId:'REQ-VERIFY-OCTOBER-00001',month:'2026-10',sourceId:registry.spreadsheet_id,confirmation:'VERIFIKASI 2026-10',reason:'Master dicocokkan dengan dokumen Oktober'};assert.equal(e.call('savePeriodVerification',payload).success,true);assert.equal(e.call('savePeriodVerification',{...payload,requestId:'REQ-VERIFY-OCTOBER-00002'}).state,'FAILED');
 assert.equal(e.call('savePeriodVerification',{...payload,requestId:'REQ-VERIFY-SEPTEMBER-01',month:'2026-09',sourceId:'ARBITRARY_FILE_ID',confirmation:'VERIFIKASI 2026-09'}).state,'FAILED');
});
test('native generated reports identify unverified historical payouts instead of calling them final',()=>{
 const e=auditSystem();e.save({date:'2026-09-25'});e.capturePeriod();e.c.KCH_REQUEST_USER_={role:'ADMIN',email:'mhmdryyan7@gmail.com'};const rows=e.c.kchIncentiveSheetRows_(e.c.scoreContext_(true));const headers=e.c.KCH_INCENTIVE_SHEET_SCHEMAS_.INSENTIF_BULANAN,month=rows.INSENTIF_BULANAN.find(r=>r[0]==='2026-09'&&r[1]==='S1');assert.equal(month[headers.indexOf('period_status')],'BELUM TERVERIFIKASI');assert.equal(month[headers.indexOf('combined_paid')],'');
});
test('repeated current-month edits reuse snapshot rows rather than growing discarded copies',()=>{
 const e=auditSystem();e.capturePeriod();const initial=e.rows(e.c.KCH_PERIOD_MASTERS_).length;for(let n=0;n<3;n++){const row=e.call('getMasterEditor').tables.SALES.rows.find(r=>r.data.sales_id==='S1');const r=e.call('saveMasterRecord',{requestId:'REQ-MASTER-REUSE-'+String(n).padStart(12,'0'),table:'SALES',data:{...row.data,full_name:'Revision '+n},expectedRevision:row.revision,reason:'Pembetulan nama'});assert.equal(r.success,true,r.message);}assert.equal(e.rows(e.c.KCH_PERIOD_MASTERS_).length,initial);
});
test('historical incentive reports survive a move to an ineligible team and do not invent a cross-policy quarter bonus',()=>{
 const e=auditSystem();e.capturePeriod();e.clock('2026-11-03 12:00:00');e.cell('SALES','S1',['team_name','SPR']);const r=e.call('getIncentiveReport','2026-10','S1');assert.equal(r.success,true);assert.equal(r.masterVerified,true);assert.equal(r.sales.team,'Motoris');assert.equal(r.quarter.amount,null);e.c.KCH_REQUEST_USER_={role:'ADMIN',email:'mhmdryyan7@gmail.com'};const rows=e.c.kchIncentiveSheetRows_(e.c.scoreContext_(true));assert.ok(rows.INSENTIF_BULANAN.some(r=>r[0]==='2026-10'&&r[1]==='S1'));assert.equal(rows.INSENTIF_BULANAN.some(r=>r[0]==='2026-11'&&r[1]==='S1'),false);
});
test('previously unverified derived archive reports complete after explicit master verification without changing business rows',()=>{
 const e=auditSystem();e.cell('SALES','S1',['target_monthly',27000000]);e.cell('SALES','S2',['target_monthly',27000000]);e.save({date:'2026-09-24'});e.capturePeriod();e.c.KCH_REQUEST_USER_={role:'ADMIN',email:'mhmdryyan7@gmail.com'};
 const hs=e.c.KCH_INCENTIVE_SHEET_SCHEMAS_.INSENTIF_BULANAN,unknown=e.c.kchIncentiveSheetRows_(e.c.scoreContext_(true)).INSENTIF_BULANAN.find(r=>r[0]==='2026-09'&&r[1]==='S1');e.rows(e.c.KCH_ARCHIVE_ROWS_).push(['2026-09','INSENTIF_BULANAN',JSON.stringify(hs),JSON.stringify(unknown)]);e.c.PropertiesService.getScriptProperties().setProperty('KCH_MONTHLY_ARCHIVE_ENABLED','TRUE');e.c.KCH_REQUEST_USER_=null;
 const b=e.call('createOperationalBackup','REQ-ARCHIVE-VERIFY-SOURCE-01'),source=e.objects(e.c.KCH_BACKUPS_).find(r=>r.backup_id===b.backupId),verified=e.call('savePeriodVerification',{requestId:'REQ-ARCHIVE-VERIFY-SEPT-01',month:'2026-09',sourceId:source.spreadsheet_id,confirmation:'VERIFIKASI 2026-09',reason:'Dibandingkan dengan master September'});assert.equal(verified.success,true,verified.message);
 const before=JSON.stringify(e.rows('SALES_TRANSACTIONS')),plan=e.c.kchIncentiveSyncPlan_(e.ss,e.c.txMetadata_(e.ctx),e.ctx);e.c.txBatch_(e.ctx,plan.requests);assert.equal(JSON.stringify(e.rows('SALES_TRANSACTIONS')),before);const final=JSON.parse(e.objects(e.c.KCH_ARCHIVE_ROWS_)[0].values_json);assert.equal(final[hs.indexOf('period_status')],'SELESAI');assert.equal(final[hs.indexOf('total_value_target')],27000000);
});
test('returns update net Skor and incentive parameters using original invoice amounts',()=>{
 const e=auditSystem(),ph=e.rows('PRICE_MASTER')[0],pr=e.rows('PRICE_MASTER').find((r,i)=>i&&r[ph.indexOf('product_id')]==='P1');pr[ph.indexOf('cost_price')]=600000;pr[ph.indexOf('selling_price')]=1200000;pr[ph.indexOf('shj')]=600000;
 const sale=e.save({date:'2026-10-24',items:[{productId:'P1',qty:1}]});assert.equal(sale.success,true,sale.message);const before=e.call('getIncentiveReport','2026-10','S1');assert.equal(before.dailyTotal,15000);
 const ref=e.call('getOperationsReference','SALE_RETURN',sale.transactionId).reference,r=e.call('saveOperationalChange',{requestId:'REQ-INCENTIVE-RETURN-0001',kind:'SALE_RETURN',date:'2026-10-24',referenceId:ref.id,expectedRevision:ref.revision,reason:'Retur pada tanggal pencatatan yang sama',items:[{key:ref.items[0].key,qty:1}]});assert.equal(r.success,true,r.message);const after=e.call('getIncentiveReport','2026-10','S1');assert.equal(after.monthly.actualValue,0);assert.equal(after.dailyTotal,0);assert.equal(e.call('getScoreReport','2026-10','S1').parameters[2].actual,0);
});
