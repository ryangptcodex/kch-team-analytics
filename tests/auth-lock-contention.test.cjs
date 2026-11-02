const {test}=require('node:test'),assert=require('node:assert/strict');
const {environment}=require('./helpers/auth-environment.cjs');
function admin(options={}){return environment({identity:{email:'admin@gmail.com',localId:'admin-uid',displayName:'Muhammad Ryan'},...options});}
test('established Admin authentication needs no shared lock or native flush, while still verifying Google',()=>{
 const e=admin(),before=JSON.stringify(e.sheets.get('ACCESS_USERS').rows);e.context.LockService.getScriptLock=()=>{throw Error('Shared write lock is busy');};e.context.SpreadsheetApp.flush=()=>{throw Error('Authentication must not flush read-only data');};assert.equal(e.call('getAuthProfile').user.role,'ADMIN');assert.equal(e.lookupCalls(),1);assert.equal(JSON.stringify(e.sheets.get('ACCESS_USERS').rows),before);
});
test('attendance and metadata reads proceed for an established Admin while another operation holds the script lock',()=>{
 const e=admin();let waits=0;e.context.LockService.getScriptLock=()=>({waitLock(){waits++;throw Error('Another operation is running');},releaseLock(){}});
 const attendance=e.call('getAttendanceByDate',['2026-11-02']);assert.equal(attendance.success,true,attendance.message);assert.equal(e.call('getInitialAppMetadata').success,true);assert.equal(waits,0);
});
test('lock-free checks reread deactivation, role, UID, duplicates and header corruption on every RPC',()=>{
 for(const change of [rows=>rows[1][4]='INACTIVE',rows=>rows[1][3]='GUEST',rows=>rows[1][1]='other-uid',rows=>rows.push(rows[1].slice()),rows=>rows[0][1]='bad_uid_header']){const e=admin();e.call('getAuthProfile');change(e.sheets.get('ACCESS_USERS').rows);e.context.LockService.getScriptLock=()=>{throw Error('Must reject invalid access before waiting');};assert.throws(()=>e.call('getAuthProfile'),/ACCESS_DENIED|Header ACCESS_USERS/);assert.equal(e.context.KCH_REQUEST_USER_,null);}
});
test('first Admin bootstrap and blank UID binding stay locked, then subsequent reads stop taking the lock',()=>{
 for(const missingSheet of [false,true]){const e=admin(missingSheet?{access:false}:{});if(!missingSheet)e.sheets.get('ACCESS_USERS').rows[1][1]='';let waits=0,releases=0;e.context.LockService.getScriptLock=()=>({waitLock(){waits++;},releaseLock(){releases++;}});
 assert.equal(e.call('getAuthProfile').user.uid,'admin-uid');assert.equal(waits,1);assert.equal(releases,1);assert.equal(e.call('getAuthProfile').user.uid,'admin-uid');assert.equal(waits,1);const rows=e.sheets.get('ACCESS_USERS').rows;assert.equal(rows.filter(r=>r[0]==='admin@gmail.com').length,1);assert.equal(rows.find(r=>r[0]==='admin@gmail.com')[1],'admin-uid');}
});
test('binding rereads status and UID after lock acquisition, preventing late deactivation or competing UID overwrite',()=>{
 for(const change of [r=>r[4]='INACTIVE',r=>r[1]='other-uid']){const e=admin(),rows=e.sheets.get('ACCESS_USERS').rows;rows[1][1]='';let releases=0;e.context.LockService.getScriptLock=()=>({waitLock(){change(rows[1]);},releaseLock(){releases++;}});assert.throws(()=>e.call('getAuthProfile'),/ACCESS_DENIED/);assert.equal(releases,1);assert.notEqual(rows[1][1],'admin-uid');}
});
test('unbound users still fail closed on a busy lock, and established users cannot bypass locked mutations',()=>{
 const e=admin(),rows=e.sheets.get('ACCESS_USERS').rows;rows[1][1]='';const before=JSON.stringify(rows);e.context.LockService.getScriptLock=()=>({waitLock(){throw Error('busy');},releaseLock(){}});assert.throws(()=>e.call('getAuthProfile'),/AUTH_UNAVAILABLE/);assert.equal(JSON.stringify(rows),before);
 rows[1][1]='admin-uid';assert.equal(e.call('getAuthProfile').user.role,'ADMIN');assert.throws(()=>e.call('saveMyProfile',[{displayName:'Muhammad Ryan'}]),/busy/);assert.equal(rows[0].includes('display_name'),false);
});
