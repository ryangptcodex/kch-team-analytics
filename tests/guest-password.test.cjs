const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {environment}=require('./helpers/auth-environment.cjs');
function admin(){const e=environment({identity:{email:'admin@gmail.com',localId:'admin-uid'}});e.context.KCH_GUEST_PASSWORD_ITERATIONS_=1000;return e;}
function configured(){const e=admin();e.call('saveGuestCredentials',[{username:'tamu',password:'private-test-password',status:'ACTIVE'}]);return e;}
function login(e){return e.context.kchGuestLogin('tamu','private-test-password');}
test('PBKDF2-HMAC-SHA256 matches Node standard for UTF-8 passwords and salts at multiple iteration counts',()=>{
 const c=admin().context;for(const password of ['password','Rahasia-é-🔒'])for(const n of [1,2,1000]){
 const salt='01ab'.repeat(16);assert.equal(c.guestPasswordHash_(password,salt,n),crypto.pbkdf2Sync(password,Buffer.from(salt,'hex'),n,32,'sha256').toString('hex'));
 }
 const raw=environment().context;assert.equal(raw.KCH_GUEST_PASSWORD_ITERATIONS_,600000);
});
test('only admin may configure credentials, and invalid usernames/short passwords never change sheet rows',()=>{
 const e=environment({guestSession:true}),before=JSON.stringify(e.sheets.get('ACCESS_USERS').rows);assert.throws(()=>e.call('saveGuestCredentials',[{}]),/Tamu hanya boleh/);assert.equal(JSON.stringify(e.sheets.get('ACCESS_USERS').rows),before);
 const a=admin();for(const payload of [{username:'x',password:'private-test-password',status:'ACTIVE'},{username:'tamu',password:'short',status:'ACTIVE'},{username:'tamu',password:'',status:'ACTIVE'}])assert.throws(()=>a.call('saveGuestCredentials',[payload]));
});
test('credentials include requested readable password and salted hash in ACCESS_USERS, preserving admin, old profiles and custom columns',()=>{
 const e=admin(),sheet=e.sheets.get('ACCESS_USERS'),before=[...sheet.rows[1]];sheet.rows[0].push('display_name');sheet.rows[2][7]='Keep this';
 e.call('saveGuestCredentials',[{username:'Tamu',password:'private-test-password',status:'ACTIVE',role:'ADMIN',salesId:'S1'}]);
 assert.deepEqual(sheet.rows[1],before);assert.equal(sheet.rows[2][7],'Keep this');assert.equal(sheet.rows[2][3],'GUEST');assert.equal(sheet.rows[2][2],'');assert.equal(sheet.rows[2][sheet.rows[0].indexOf('password')],'private-test-password');
 const c=e.context.guestCredential_();assert.equal(c.username,'tamu');assert.equal(c.password_hash.length,64);assert.equal(c.password_salt.length,64);assert.equal(c.auth_type,'PASSWORD');
 const listing=JSON.stringify(e.call('listAccessUsers'));assert.match(listing,/"username":"tamu"/);assert.doesNotMatch(listing,/password_hash|password_salt|session_version/);
});
test('guest password login needs no Google verification and successful reads do not mutate business sheets',()=>{
 const e=configured(),calls=e.lookupCalls(),before=JSON.stringify([...e.sheets.values()].map(s=>s.rows)),r=login(e);
 assert.equal(e.lookupCalls(),calls);assert.equal(r.user.role,'GUEST');assert.equal(r.user.email,'');assert.equal(r.user.salesId,'');assert.match(r.token,/^KCHG_[a-f0-9]{64}$/);
 assert.equal(e.context.kchApi(r.token,'getAuthProfile',[]).user.username,'tamu');assert.equal(e.context.kchApi(r.token,'getTransactionsPaginated',[1,10]).data.length,2);
 assert.equal(JSON.stringify([...e.sheets.values()].map(s=>s.rows)),before);assert.doesNotMatch(JSON.stringify(e.properties),new RegExp(r.token));
});
test('wrong username/password, disabled account and manipulated sheet role all fail closed',()=>{
 const e=configured();for(const args of [['wrong','private-test-password'],['tamu','wrong-password-value']])assert.throws(()=>e.context.kchGuestLogin(...args),/salah/);
 const rows=e.sheets.get('ACCESS_USERS').rows;rows[2][4]='INACTIVE';assert.throws(()=>login(e),/salah/);rows[2][4]='ACTIVE';rows[2][3]='ADMIN';assert.throws(()=>login(e),/salah/);
});
test('forged, expired and logged-out guest tokens cannot be reused',()=>{
 const e=configured(),r=login(e),c=e.context;assert.throws(()=>c.kchApi('KCHG_'+'b'.repeat(64),'getAuthProfile',[]),/AUTH_REQUIRED/);
 const key='KCH_GUEST_SESSION_'+c.KCH_GUEST_SHA256_(r.token),session=JSON.parse(e.properties[key]);session.expires=0;e.properties[key]=JSON.stringify(session);assert.throws(()=>c.kchApi(r.token,'getAuthProfile',[]),/AUTH_REQUIRED/);
 const next=login(e);c.kchGuestLogout(next.token);assert.throws(()=>c.kchApi(next.token,'getAuthProfile',[]),/AUTH_REQUIRED/);
});
test('password/username changes and deactivate-reactivate revoke existing sessions even within the same timestamp',()=>{
 const e=configured(),r=login(e);e.call('saveGuestCredentials',[{username:'tamu',password:'new-private-password',status:'ACTIVE'}]);assert.throws(()=>e.context.kchApi(r.token,'getAuthProfile',[]),/AUTH_REQUIRED/);assert.throws(()=>login(e),/salah/);
 const t=e.context.kchGuestLogin('tamu','new-private-password').token;e.call('saveGuestCredentials',[{username:'tamu',password:'',status:'INACTIVE'}]);e.call('saveGuestCredentials',[{username:'tamu',password:'',status:'ACTIVE'}]);assert.throws(()=>e.context.kchApi(t,'getAuthProfile',[]),/AUTH_REQUIRED/);
 const u=e.context.kchGuestLogin('tamu','new-private-password').token;e.call('saveGuestCredentials',[{username:'pengunjung',password:'',status:'ACTIVE'}]);assert.throws(()=>e.context.kchApi(u,'getAuthProfile',[]),/AUTH_REQUIRED/);
});
test('guest password session cannot call writes/profile/AA/branding/access endpoints or editor installers',()=>{
 const e=configured(),r=login(e);for(const m of ['saveGuestCredentials','saveSalesTransaction','editSalesTransaction','saveScoreAA','saveScoreBranding','saveSalesPhotoUpload','saveMyProfile','logClientActivity','saveAccessUser','listAccessUsers'])assert.throws(()=>e.context.kchApi(r.token,m,[{}]),/Tamu hanya boleh/);
 assert.throws(()=>e.context.kchApi(r.token,'setupKchSheetUpdates',[]),/Operasi tidak tersedia/);assert.equal(e.context.KCH_REQUEST_USER_,null);
});
test('login rate limit persists across invocations and arbitrary usernames without growing unbounded keys',()=>{
 const e=configured();for(let i=0;i<20;i++)assert.throws(()=>e.context.kchGuestLogin('unknown'+i,'wrong-password-value'),/salah/);assert.throws(()=>login(e),/Terlalu banyak/);assert.deepEqual(Object.keys(e.properties),['KCH_GUEST_RATE']);
 const rate=JSON.parse(e.properties.KCH_GUEST_RATE);rate.until=0;e.properties.KCH_GUEST_RATE=JSON.stringify(rate);assert.equal(login(e).success,true);
});
test('Google is restricted to the designated admin even after a native guest account is configured',()=>{
 const e=configured();assert.equal(e.call('getAuthProfile').user.role,'ADMIN');assert.throws(()=>e.context.resolveAccessUser_({uid:'sales-uid',email:'sales@gmail.com'}),/Google hanya tersedia/);
});
test('first-time native Guest setup adds its account/credential columns without removing legacy data',()=>{
 const e=environment({access:false,identity:{email:'admin@gmail.com',localId:'admin-uid'}});e.context.KCH_GUEST_PASSWORD_ITERATIONS_=1000;
 assert.equal(e.call('saveGuestCredentials',[{username:'tamu',password:'private-test-password',status:'ACTIVE'}]).success,true);assert.equal(e.sheets.get('ACCESS_USERS').rows.length,3);assert.equal(login(e).user.role,'GUEST');
 const header=e.sheets.get('ACCESS_USERS').rows[0];for(const h of e.context.KCH_GUEST_ACCESS_HEADERS_)assert.equal(header.filter(v=>v===h).length,1);
});
test('readable password mirrors saves, preserves blank edits, stays out of RPC responses and accepts literal formula-looking text',()=>{
 const e=configured(),rows=e.sheets.get('ACCESS_USERS').rows,col=rows[0].indexOf('password');
 assert.equal(rows[2][col],'private-test-password');e.call('saveGuestCredentials',[{username:'tamu',password:'',status:'ACTIVE'}]);assert.equal(rows[2][col],'private-test-password');
 const password='=SUM(100,200)-secret';e.call('saveGuestCredentials',[{username:'tamu',password,status:'ACTIVE'}]);assert.equal(rows[2][col],password);assert.equal(e.context.kchGuestLogin('tamu',password).success,true);
 assert.doesNotMatch(JSON.stringify(e.call('listAccessUsers')),/SUM\(100/);assert.equal('password' in e.context.guestCredential_(),false);
});
test('legacy hash with empty visible password cannot silently report a successful blank save',()=>{
 const e=configured(),rows=e.sheets.get('ACCESS_USERS').rows,col=rows[0].indexOf('password');rows[2][col]='';
 assert.equal(e.call('listAccessUsers').users[1].passwordRecorded,false);
 assert.throws(()=>e.call('saveGuestCredentials',[{username:'tamu',password:'',status:'ACTIVE'}]),/Isi kembali password/);
 e.call('saveGuestCredentials',[{username:'tamu',password:'private-test-password',status:'ACTIVE'}]);assert.equal(rows[2][col],'private-test-password');assert.equal(e.call('listAccessUsers').users[1].passwordRecorded,true);
});
test('a missing password write fails readback verification rather than reporting success',()=>{
 const e=configured(),sheet=e.sheets.get('ACCESS_USERS'),original=sheet.getRange;
 sheet.getRange=(...args)=>{const r=original(...args);r.setRichTextValue=()=>r;return r;};
 assert.throws(()=>e.call('saveGuestCredentials',[{username:'tamu',password:'different-password',status:'ACTIVE'}]),/belum terkonfirmasi/);assert.equal(sheet.rows[2][4],'INACTIVE');
});
