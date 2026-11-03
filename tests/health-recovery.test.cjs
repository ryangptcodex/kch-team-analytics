const {test}=require('node:test'),assert=require('node:assert/strict'),{auditSystem}=require('./helpers/audit-system.cjs');
function backup(e,id='REQ-HEALTH-BACKUP-00001'){return e.call('createOperationalBackup',id);}
function preview(e,b,id='REQ-HEALTH-PREVIEW-0001'){return e.call('prepareBackupRestore',b.backupId,id);}
function restore(e,p,extra={}){return e.call('saveBackupRestore',{requestId:'REQ-HEALTH-RESTORE-0001',backupId:p.backupId,rollbackBackupId:p.rollbackBackupId,expectedRevision:p.expectedRevision,confirmation:p.confirmation,reason:'Pemulihan terencana setelah pemeriksaan',...extra});}
test('registered private backups are verified, idempotent and do not alter source business data',()=>{
 const e=auditSystem(),before=JSON.stringify(e.rows('INVENTORY')),b=backup(e);assert.equal(b.success,true,b.message);assert.equal(e.copies.size,1);assert.equal(backup(e).backupId,b.backupId);assert.equal(e.copies.size,1);assert.equal(JSON.stringify(e.rows('INVENTORY')),before);const record=e.objects(e.c.KCH_BACKUPS_)[0];assert.equal(record.status,'COMPLETE');assert.equal(e.file(record.spreadsheet_id).access,'PRIVATE');assert.ok(JSON.parse(record.manifest_json).tables.SALES_TRANSACTIONS);
});
test('preview preserves live data, atomic restore rolls back balances and prevents replaying rolled-back invoices',()=>{
 const e=auditSystem(),b=backup(e),sale=e.save();assert.equal(sale.success,true);assert.equal(e.stock(),8);const p=preview(e,b);assert.equal(p.canRestore,true);assert.equal(e.stock(),8);assert.notEqual(p.rollbackBackupId,b.backupId);
 const result=restore(e,p);assert.equal(result.success,true,result.message);assert.equal(e.stock(),10);assert.equal(e.objects('SALES_TRANSACTIONS').length,0);assert.equal(e.status().state,'FAILED');assert.equal(e.save().state,'FAILED');assert.equal(e.stock(),10);assert.equal(restore(e,p).replayed,true);assert.equal(e.stock(),10);assert.ok(e.objects(e.c.KCH_HEALTH_LOG_).some(r=>r.action==='RESTORE_BUSINESS_DATA'));
});
test('source backup tampering invalidates restore and recovery-copy verification',()=>{
 const e=auditSystem(),b=backup(e),record=e.objects(e.c.KCH_BACKUPS_)[0];e.copies.get(record.spreadsheet_id).tables.INVENTORY[1][2]=999;assert.throws(()=>preview(e,b),/Cadangan berubah/);assert.throws(()=>e.call('createRecoveryCopy',b.backupId),/Cadangan berubah/);assert.equal(e.stock(),10);
});
test('stale restore preview cannot overwrite newer transactions',()=>{
 const e=auditSystem(),b=backup(e);e.save();const p=preview(e,b);assert.equal(e.save({requestId:'REQ-SECOND-SALE-000001',items:[{productId:'P1',qty:1}]}).success,true);const r=restore(e,p);assert.equal(r.state,'FAILED');assert.match(r.message,/Data berubah/);assert.equal(e.stock(),7);
});
test('closed-period differences block Production restore while a verified separate recovery copy is available',()=>{
 const e=auditSystem(),b=backup(e);assert.equal(e.save({date:'2026-09-25'}).success,true);const p=preview(e,b);assert.equal(p.canRestore,false);assert.equal(restore(e,p).state,'FAILED');assert.equal(e.stock(),8);const copy=e.call('createRecoveryCopy',b.backupId);assert.equal(copy.success,true);assert.equal(e.stock(),8);
});
test('a trusted typed backup restores formulas as formulas without changing normal write rules',()=>{
 const e=auditSystem({allowRestoreFormula:true,formulaCells:['INVENTORY:1:4']});e.rows('INVENTORY')[0].push('custom_formula');e.rows('INVENTORY')[1].push('=2+2');const b=backup(e);e.rows('INVENTORY')[1][4]='=3+3';const p=preview(e,b),r=restore(e,p);assert.equal(r.success,true,r.message);assert.equal(e.rows('INVENTORY')[1][4],'=2+2');
});
test('only proven undispatched reservations can be cancelled under the shared lock',()=>{
 const e=auditSystem(),hs=e.c.KCH_TX_REQUEST_HEADERS_,id='REQ-ABANDONED-SAFE-0001',row={request_key:e.c.txHash_('user-1:'+id),request_id:id,actor_uid:'user-1',actor_email:'one@example.test',fingerprint:'AUDIT_ONLY',attempt_id:'AUDIT_ONLY',transaction_id:'AUDIT_ONLY',state:'PENDING',plan_json:JSON.stringify({engine:2,phase:'RESERVED_V2'})};e.rows(e.c.KCH_TX_REQUEST_SHEET_).push(hs.map(h=>row[h]||''));const result=e.call('recoverAbandonedReservation',id,'Reservasi terhenti sebelum dikirim');assert.equal(result.state,'FAILED');assert.equal(result.terminal,true);assert.equal(e.stock(),10);assert.equal(e.save({requestId:'REQ-AFTER-RESERVATION-01'}).success,true);
});
test('prepared or legacy ambiguity remains blocked and can only be resolved from the eventual committed receipt',()=>{
 const e=auditSystem({financialFault:'unknownBefore'}),r=e.save();assert.equal(r.state,'PENDING');assert.throws(()=>e.call('recoverAbandonedReservation',r.requestId,'Coba pemulihan'),/mungkin sudah dikirim/);assert.throws(()=>backup(e),/Backup ditahan/);assert.equal(e.stock(),10);e.settle();const resolved=e.call('inspectOperationalRequest',r.requestId);assert.equal(resolved.state,'COMMITTED');assert.equal(e.stock(),8);
});
test('central Admin inspection works for native request actors without granting a guest access',()=>{
 const e=auditSystem(),hs=e.c.KCH_TX_REQUEST_HEADERS_,id='REQ-NATIVE-ARCHIVE-0001',row={request_key:'NATIVE_ARCHIVE_ONLY',request_id:id,actor_uid:'MONTHLY_ARCHIVE',state:'PENDING',transaction_id:'ARCHIVE_ONLY',plan_json:'{}'};e.rows(e.c.KCH_TX_REQUEST_SHEET_).push(hs.map(h=>row[h]||''));assert.equal(e.call('inspectOperationalRequest',id).state,'PENDING');assert.throws(()=>e.call('recoverAbandonedReservation',id,'Native ambiguous'),/mungkin sudah dikirim/);e.actor({role:'GUEST'});for(const m of ['getOperationalHealth','createOperationalBackup','prepareBackupRestore','saveBackupRestore','recoverAbandonedReservation','inspectOperationalRequest','createRecoveryCopy'])assert.throws(()=>e.call(m,id),/Tamu hanya boleh/);
});
test('monitor reports missing sheets, duplicate IDs and negative balances rather than claiming all healthy',()=>{
 const e=auditSystem();e.rows('SALES').push([...e.rows('SALES')[1]]);e.rows('INVENTORY')[1][2]=-1;e.remove('SALES_TRANSACTIONS');const r=e.call('getOperationalHealth');assert.ok(r.issues.some(i=>i.table==='SALES'&&/ganda/.test(i.message)));assert.ok(r.issues.some(i=>i.table==='INVENTORY'&&/nonnegatif/.test(i.message)));assert.ok(r.issues.some(i=>i.table==='SALES_TRANSACTIONS'));assert.ok(r.issues.some(i=>i.table==='TRIGGER'));
});
test('maintenance triggers install once at the requested WIB daily schedule and15minute report interval',()=>{
 const e=auditSystem(),triggers=[],schedules=[];e.c.ScriptApp.getProjectTriggers=()=>triggers;e.c.ScriptApp.newTrigger=name=>({timeBased(){const setup={name},b={everyDays(n){setup.days=n;return b;},atHour(n){setup.hour=n;return b;},inTimezone(z){setup.zone=z;return b;},everyMinutes(n){setup.minutes=n;return b;},create(){schedules.push(setup);triggers.push({getHandlerFunction:()=>name});}};return b;}});e.c.ScriptApp.deleteTrigger=t=>triggers.splice(triggers.indexOf(t),1);e.c.healthEnsureTriggers_(e.ss);e.c.healthEnsureTriggers_(e.ss);assert.equal(triggers.length,2);assert.deepEqual(schedules.find(s=>s.name==='kchDailyBackupTick_'),{name:'kchDailyBackupTick_',days:1,hour:2,zone:'Asia/Jakarta'});assert.equal(schedules.find(s=>s.name==='kchScheduledReportsTick_').minutes,15);
});
test('scheduled report sync creates only derived reports and current snapshots, never changes inventory',()=>{
 const e=auditSystem(),before=JSON.stringify(e.rows('INVENTORY'));e.c.kchScheduledReportsTick_();assert.equal(JSON.stringify(e.rows('INVENTORY')),before);assert.ok(e.rows('INSENTIF_HARIAN').length>1);assert.ok(e.c.PropertiesService.getScriptProperties().getProperty('KCH_REPORT_SYNC_AT'));
});
test('rejected restore leaves business rows, receipt outcomes and account revocation intact',()=>{
 const e=auditSystem(),b=backup(e);e.save();const p=preview(e,b);e.options.financialFault='reject400';const r=restore(e,p);assert.equal(r.state,'FAILED');assert.equal(e.stock(),8);assert.equal(e.status().state,'COMMITTED');assert.equal(e.objects('SALES_TRANSACTIONS').length,1);
});
test('lost restore response still commits its archive recovery marker and keeps login data untouched',()=>{
 const e=auditSystem(),access=e.rows('ACCESS_USERS'),guest=Array(access[0].length).fill('');guest[0]='guest@example.test';guest[3]='GUEST';guest[4]='ACTIVE';access.push(guest);const b=backup(e);e.save();const p=preview(e,b);e.rows('ACCESS_USERS')[1][4]='INACTIVE';e.options.financialFault='lostAfterCommit';const r=restore(e,p);assert.equal(r.success,true,r.message);assert.equal(r.replayed,true);assert.equal(e.stock(),10);assert.equal(e.rows('ACCESS_USERS')[1][4],'INACTIVE');const props=e.c.PropertiesService.getScriptProperties();props.setProperty('KCH_ARCHIVE_CHECKED_MONTH','2026-10');e.c.healthApplyRestoreMarker_();assert.equal(props.getProperty('KCH_ARCHIVE_CHECKED_MONTH'),null);assert.ok(props.getProperty('KCH_RESTORE_GENERATION_SEEN'));
});
test('an ambiguous restore blocks business content and score writes until the original result is known',()=>{
 const e=auditSystem(),b=backup(e);e.save();const p=preview(e,b);e.options.financialFault='unknownBefore';const r=restore(e,p);assert.equal(r.state,'PENDING');assert.equal(e.stock(),8);const plan=e.call('saveTodayPlan',{date:'2026-10-25',salesId:'S1',destination:'New plan'});assert.equal(plan.success,false);assert.match(plan.message,/belum pasti/);assert.throws(()=>e.call('saveScoreAA',{requestId:'REQ-PENDING-AA-0000001',date:'2026-10-25',salesId:'S1',count:1,expectedRevision:''}),/belum pasti/);assert.throws(()=>e.call('saveKchNewsArticle',{}),/belum pasti/);e.settle();assert.equal(e.status(r.requestId).state,'COMMITTED');assert.equal(e.stock(),10);
});
test('business sheet warnings install idempotently without editing unrelated protections or sharing',()=>{
 const e=auditSystem(),protections=[{description:'Existing user protection',warning:false}],calls=[];
 const wrap=p=>({getDescription:()=>p.description,setDescription(d){p.description=d;return this;},setWarningOnly(v){p.warning=v;calls.push(p.description);return this;}});
 e.c.SpreadsheetApp.ProtectionType={SHEET:'SHEET'};
 const sheet={getProtections:()=>protections.map(wrap),protect(){const p={description:'',warning:false};protections.push(p);return wrap(p);}};
 const book={getSheetByName:name=>name==='INVENTORY'?sheet:null};
 e.c.healthProtectBusinessSheets_(book);e.c.healthProtectBusinessSheets_(book);
 assert.equal(protections.length,2);assert.equal(protections[0].warning,false);assert.equal(protections[1].warning,true);assert.equal(calls.length,2);assert.ok(calls.every(x=>x.startsWith('KCH_AUDIT_V1:')));
});
