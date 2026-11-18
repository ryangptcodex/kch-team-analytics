// Password authentication for Guest and individually scoped Sales accounts.
var KCH_GUEST_ACCESS_HEADERS_ = ['auth_type', 'username', 'password_hash', 'password_salt', 'password_iterations', 'session_version', 'password'];
var KCH_GUEST_PASSWORD_ITERATIONS_ = 600000;
var KCH_GUEST_SESSION_MS_ = 8 * 60 * 60 * 1000;

function guestAccessColumns_(sheet, create) {
  if (create) accessDisplayNameColumn_(sheet, true);
  var width = sheet.getLastColumn(), headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0], columns = {};
  KCH_GUEST_ACCESS_HEADERS_.forEach(function(h) {
    var matches = [];
    headers.forEach(function(v, i) { if (String(v).trim().toLowerCase() === h) matches.push(i + 1); });
    if (matches.length > 1) throw new Error('Kolom akun Tamu terdaftar ganda. Periksa ACCESS_USERS.');
    if (!matches.length && create) { headers.push(h); sheet.getRange(1, headers.length).setValue(h); matches.push(headers.length); }
    columns[h] = matches[0] || 0;
  });
  return columns;
}

function guestCredential_() {
  var sheet = getAccessSheet_(false);
  if (!sheet) return null;
  var rows = accessRows_(sheet), matches = [];
  rows.forEach(function(row, i) { if (String(row[0]).trim().toLowerCase() === KCH_GUEST_EMAIL_) matches.push({ row: row, number: i + 2 }); });
  if (matches.length > 1) throw new Error('ACCESS_DENIED: Konfigurasi akun Tamu ganda. Hubungi admin.');
  if (!matches.length) return null;
  var cols = guestAccessColumns_(sheet, false), values = sheet.getRange(matches[0].number, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var item = { passwordRecorded: !!(cols.password && values[cols.password - 1] !== ''), updatedAt: matches[0].row[6] || '', status: normalizeKey_(matches[0].row[4]), role: normalizeKey_(matches[0].row[3]) };
  Object.keys(cols).filter(function(h) { return h !== 'password'; }).forEach(function(h) { item[h] = cols[h] ? values[cols[h] - 1] : ''; });
  return item;
}

function guestCredentialReady_(c) {
  return c && c.role === 'GUEST' && passwordCredentialReady_(c);
}

function passwordCredentialReady_(c) {
  return c.auth_type === 'PASSWORD' && c.status === 'ACTIVE' &&
    /^[a-z0-9][a-z0-9._-]{2,39}$/.test(c.username) && /^[a-f0-9]{64}$/.test(c.password_hash) &&
    /^[a-f0-9]{64}$/.test(c.password_salt) && Number(c.password_iterations) === KCH_GUEST_PASSWORD_ITERATIONS_ && /^[a-f0-9]{32}$/.test(c.session_version);
}

// PBKDF2-HMAC-SHA256 (one 32-byte block), matching standard crypto implementations.
function guestPasswordHash_(password, salt, iterations) {
  var saltBytes = [];
  for (var i = 0; i < salt.length; i += 2) saltBytes.push(parseInt(salt.slice(i, i + 2), 16));
  var u = KCH_GUEST_SHA256_.hmac.array(password, saltBytes.concat([0, 0, 0, 1])), result = u.slice();
  for (var n = 1; n < iterations; n++) {
    u = KCH_GUEST_SHA256_.hmac.array(password, u);
    for (var j = 0; j < 32; j++) result[j] ^= u[j];
  }
  return result.map(function(v) { return ('0' + v.toString(16)).slice(-2); }).join('');
}
function guestEqual_(a, b) {
  var diff = a.length ^ b.length;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function guestRevision_(c) { return KCH_GUEST_SHA256_([c.username, c.password_hash, c.password_salt, c.password_iterations, c.status, c.role, c.auth_type, c.updatedAt, c.session_version].join('|')); }
function guestIdentity_(username) { return { uid: 'kch-guest-password', email: '', username: username, role: 'GUEST', salesId: '', teamName: '', fullName: 'Tamu', shortName: 'Tamu' }; }

// Slots count failed and currently-running logins. Verified success returns its
// own slot, preserving failures and reserving capacity before expensive hashing.
function guestRateState_(props,now,key) {
  var rate;
  try { rate=JSON.parse(props.getProperty(key) || 'null'); }
  catch(err){throw new Error('Pembatas login perlu diperiksa Admin.');}
  if(rate && rate.version===2){
    if(!Number.isSafeInteger(rate.count) || rate.count<0 || rate.count>20 || typeof rate.until!=='number' || !Number.isFinite(rate.until) || typeof rate.window!=='string' || !/^[a-f0-9]{32}$/.test(rate.window))throw new Error('Pembatas login perlu diperiksa Admin.');
    if(now<rate.until)return rate;
  }
  // The old version counted successes too. Start the corrected budget once,
  // without touching passwords, account status or existing Guest sessions.
  return {version:2,count:0,until:now+10*60*1000,window:Utilities.getUuid().replace(/-/g,'')};
}
function guestRateSlot_(key) {
  key = key || 'KCH_GUEST_RATE';
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var props=PropertiesService.getScriptProperties(),rate=guestRateState_(props,Date.now(),key);
    if(rate.count>=20)throw new Error('Terlalu banyak percobaan login. Coba lagi dalam 10 menit.');
    rate.count++;props.setProperty(key,JSON.stringify(rate));
    return rate.window;
  } finally { lock.releaseLock(); }
}
// Called only after credential recheck/session creation, with the shared lock held.
function guestRateSuccess_(window,props,key) {
  key = key || 'KCH_GUEST_RATE';
  var rate=guestRateState_(props,Date.now(),key);
  if(rate.window!==window)return;
  if(rate.count>0)rate.count--;
  props.setProperty(key,JSON.stringify(rate));
}

// Deliberate public unauthenticated entry point. Never returns account hashes/salts.
function kchGuestLogin(username, password) {
  var rateWindow=guestRateSlot_();
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 80 || password.length < 12 || password.length > 128) throw new Error('Username atau password Tamu salah, atau akun belum diaktifkan.');
  username = username.trim().toLowerCase();
  var c = guestCredential_();
  if (!guestCredentialReady_(c) || c.username !== username) throw new Error('Username atau password Tamu salah, atau akun belum diaktifkan.');
  if (!guestEqual_(guestPasswordHash_(password, c.password_salt, Number(c.password_iterations)), c.password_hash)) throw new Error('Username atau password Tamu salah, atau akun belum diaktifkan.');
  // Recheck under the shared lock: credential changes during hashing invalidate login.
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var latest = guestCredential_();
    if (!guestCredentialReady_(latest) || guestRevision_(latest) !== guestRevision_(c)) throw new Error('Akun berubah. Silakan masuk kembali.');
    var props = PropertiesService.getScriptProperties(), now = Date.now(), all = props.getProperties(), sessions = [];
    Object.keys(all).forEach(function(key) {
      if (key.indexOf('KCH_GUEST_SESSION_') !== 0) return;
      var entry;
      try { entry = JSON.parse(all[key]); } catch (err) { entry = null; }
      if (!entry || entry.expires <= now || entry.revision !== guestRevision_(c)) props.deleteProperty(key);
      else sessions.push({ key: key, expires: entry.expires });
    });
    // Bound shared script storage while allowing simultaneous guest viewers.
    sessions.sort(function(a, b) { return a.expires - b.expires; });
    while (sessions.length >= 50) props.deleteProperty(sessions.shift().key);
    var token = 'KCHG_' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('KCH_GUEST_SESSION_' + KCH_GUEST_SHA256_(token), JSON.stringify({ expires: now + KCH_GUEST_SESSION_MS_, revision: guestRevision_(c), username: username }));
    guestRateSuccess_(rateWindow,props);
    return { success: true, token: token, user: guestIdentity_(username) };
  } finally { lock.releaseLock(); }
}

function resolveGuestSession_(token) {
  if (typeof token !== 'string' || !/^KCHG_[a-f0-9]{64}$/.test(token)) throw new Error('AUTH_REQUIRED: Silakan masuk kembali.');
  var props = PropertiesService.getScriptProperties(), key = 'KCH_GUEST_SESSION_' + KCH_GUEST_SHA256_(token), value = props.getProperty(key), session;
  try { session = JSON.parse(value || 'null'); } catch (err) { session = null; }
  if (!session || session.expires <= Date.now()) { if (value) props.deleteProperty(key); throw new Error('AUTH_REQUIRED: Sesi Tamu berakhir. Silakan masuk kembali.'); }
  var c = guestCredential_();
  if (!guestCredentialReady_(c) || session.revision !== guestRevision_(c) || session.username !== c.username) throw new Error('AUTH_REQUIRED: Akses Tamu berubah. Silakan masuk kembali.');
  return guestIdentity_(c.username);
}
function kchGuestLogout(token) {
  if (typeof token === 'string' && /^KCHG_[a-f0-9]{64}$/.test(token)) PropertiesService.getScriptProperties().deleteProperty('KCH_GUEST_SESSION_' + KCH_GUEST_SHA256_(token));
  if (typeof token === 'string' && /^KCHS_[a-f0-9]{64}$/.test(token)) PropertiesService.getScriptProperties().deleteProperty(salesSessionKey_(token));
  return { success: true };
}

// Admin-only RPC; old Google-guest row is retained as the single account record.
function saveGuestCredentials_(payload) {
  requirePrimaryAdmin_();
  payload = payload || {};
  var username = String(payload.username || '').trim().toLowerCase(), password = payload.password;
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) throw new Error('Username: 3–40 huruf kecil, angka, titik, garis bawah atau tanda hubung.');
  if (typeof password !== 'string' || (password.length && (password.length < 12 || password.length > 128))) throw new Error('Password minimal 12 dan maksimal 128 karakter.');
  var status = normalizeKey_(payload.status);
  if (['ACTIVE', 'INACTIVE'].indexOf(status) < 0) throw new Error('Status tidak valid.');
  var previous = guestCredential_();
  if (!password.length && (!previous || !previous.password_hash || !previous.password_salt)) throw new Error('Isi password untuk pemasangan akun Tamu pertama.');
  if (!password.length && !previous.passwordRecorded) throw new Error('Kolom password di ACCESS_USERS masih kosong. Isi kembali password Tamu lalu Simpan akses agar tersimpan di sheet.');
  var revision = previous ? guestRevision_(previous) : '';
  var salt = password.length ? Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '') : previous.password_salt;
  var hash = password.length ? guestPasswordHash_(password, salt, KCH_GUEST_PASSWORD_ITERATIONS_) : previous.password_hash;
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var current = guestCredential_();
    if (salesCredentials_(getAccessSheet_(false)).some(function(c) { return c.username === username; })) throw new Error('Username sudah dipakai akun Sales.');
    if ((current ? guestRevision_(current) : '') !== revision) throw new Error('Akun Tamu berubah. Muat ulang dan simpan lagi.');
    var sheet = getAccessSheet_(true), rows = accessRows_(sheet), index = -1;
    rows.forEach(function(row, i) { if (String(row[0]).trim().toLowerCase() === KCH_GUEST_EMAIL_) index = i; });
    var now = new Date();
    if (index < 0) { sheet.appendRow([KCH_GUEST_EMAIL_, '', '', 'GUEST', status, now, now]); index = sheet.getLastRow() - 2; }
    var columns = guestAccessColumns_(sheet, true), rowNumber = index + 2;
    // Fail closed if a multi-cell credential update is interrupted.
    sheet.getRange(rowNumber, 5).setValue('INACTIVE'); SpreadsheetApp.flush();
    var data = { auth_type: 'PASSWORD', username: username, password_hash: hash, password_salt: salt, password_iterations: KCH_GUEST_PASSWORD_ITERATIONS_, session_version: Utilities.getUuid().replace(/-/g, '') };
    Object.keys(data).forEach(function(h) { sheet.getRange(rowNumber, columns[h]).setNumberFormat('@').setValue(data[h]); });
    // Requested readable copy, stored as literal text, never evaluated as a formula.
    if (password.length) sheet.getRange(rowNumber, columns.password).setNumberFormat('@').setRichTextValue(SpreadsheetApp.newRichTextValue().setText(password).build());
    SpreadsheetApp.flush();
    if (password.length && sheet.getRange(rowNumber, columns.password).getDisplayValues()[0][0] !== password) throw new Error('Password belum terkonfirmasi tersimpan di ACCESS_USERS. Simpan ulang; akun sementara nonaktif.');
    sheet.getRange(rowNumber, 3, 1, 3).setValues([['', 'GUEST', status]]);
    sheet.getRange(rowNumber, 7).setValue(now); SpreadsheetApp.flush();
    return { success: true, message: 'Akun Tamu berhasil disimpan.' };
  } finally { lock.releaseLock(); }
}

var KCH_SALES_SESSION_PREFIX_ = 'KCH_SALES_SESSION_';
var KCH_SALES_RATE_KEY_ = 'KCH_SALES_RATE';

function salesCredentials_(sheet) {
  if (!sheet) return [];
  var cols = guestAccessColumns_(sheet, false), count = sheet.getLastRow() - 1;
  if (!cols.auth_type || count < 1) return [];
  return sheet.getRange(2, 1, count, sheet.getLastColumn()).getDisplayValues().map(function(row, i) {
    return {
      number: i + 2, salesId: row[2], role: normalizeKey_(row[3]), status: normalizeKey_(row[4]),
      auth_type: row[cols.auth_type - 1], username: row[cols.username - 1] || '',
      password_hash: row[cols.password_hash - 1] || '', password_salt: row[cols.password_salt - 1] || '',
      password_iterations: row[cols.password_iterations - 1] || '', session_version: row[cols.session_version - 1] || ''
    };
  }).filter(function(c) { return c.role === 'SALES' && c.auth_type === 'PASSWORD'; });
}

function salesCredential_(accounts, salesId) {
  var matches = accounts.filter(function(c) { return normalizeKey_(c.salesId) === normalizeKey_(salesId); });
  if (matches.length > 1) throw new Error('Konfigurasi akun Sales ganda. Hubungi Admin utama.');
  return matches[0];
}

function salesCredentialRevision_(c) {
  return KCH_GUEST_SHA256_(JSON.stringify([normalizeKey_(c.salesId), guestRevision_(c)]));
}

function nativeSalesProfile_(id) {
  var matches = getActiveSheetData_('SALES').rows.filter(function(row) { return normalizeKey_(row.sales_id) === normalizeKey_(id); });
  if (matches.length !== 1 || !txActive_(matches[0]) || !normalizeKey_(id)) return null;
  return matches[0];
}

function salesIdentity_(account) {
  var profile = nativeSalesProfile_(account.salesId);
  if (!profile) throw new Error('AUTH_REQUIRED: Profil Sales tidak aktif. Hubungi Admin utama.');
  var id = String(profile.sales_id), actor = 'sales:' + normalizeKey_(id).toLowerCase();
  var name = String(profile.full_name || id);
  return {uid:actor,email:actor,username:account.username,role:'SALES',salesId:id,teamName:String(profile.team_name || ''),fullName:name,shortName:name.split(/\s+/)[0]};
}

function saveSalesCredentials_(payload) {
  requirePrimaryAdmin_();
  payload = payload || {};
  var id = String(payload.salesId || '').trim(), username = String(payload.username || '').trim().toLowerCase();
  var password = payload.password, status = normalizeKey_(payload.status);
  if (!id || !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) throw new Error('Pilih Sales dan gunakan username 3–40 karakter (huruf, angka, titik, garis bawah atau tanda hubung).');
  if (['ACTIVE','INACTIVE'].indexOf(status) < 0) throw new Error('Status tidak valid.');
  if (typeof password !== 'string' || (password && (password.length < 12 || password.length > 128))) throw new Error('Password harus 12–128 karakter.');
  var previous = salesCredential_(salesCredentials_(getAccessSheet_(false)), id);
  if (!password && (!previous || !previous.password_hash || !previous.password_salt)) throw new Error('Isi password untuk akun Sales baru.');
  var salt = password ? Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '') : previous.password_salt;
  var hash = password ? guestPasswordHash_(password, salt, KCH_GUEST_PASSWORD_ITERATIONS_) : previous.password_hash;
  var iterations = password ? KCH_GUEST_PASSWORD_ITERATIONS_ : previous.password_iterations;
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sheet = getAccessSheet_(true), accounts = salesCredentials_(sheet), current = salesCredential_(accounts,id), guest = guestCredential_();
    if ((current ? salesCredentialRevision_(current) : '') !== (previous ? salesCredentialRevision_(previous) : '')) throw new Error('Akun berubah. Muat ulang dan simpan lagi.');
    if (accounts.some(function(c) { return c !== current && c.username === username; }) || (guest && guest.username === username)) throw new Error('Username sudah dipakai.');
    var profile = nativeSalesProfile_(id);
    if ((!current || status === 'ACTIVE') && !profile) throw new Error('Profil Sales tidak aktif, ganda atau tidak ditemukan.');
    var cols = guestAccessColumns_(sheet, true), now = new Date(), row = current ? current.number : sheet.getLastRow() + 1;
    var values = {auth_type:'PASSWORD',username:username,password_hash:hash,password_salt:salt,password_iterations:iterations,session_version:Utilities.getUuid().replace(/-/g, '')};
    if (!current) {
      var cells = new Array(sheet.getLastColumn()).fill('');
      ['', '', String(profile.sales_id), 'SALES', 'INACTIVE', now, now].forEach(function(value,index) { cells[index] = value; });
      Object.keys(values).forEach(function(key) { cells[cols[key]-1] = String(values[key]); });
      sheet.getRange(row,3).setNumberFormat('@');
      Object.keys(values).forEach(function(key) { sheet.getRange(row,cols[key]).setNumberFormat('@'); });
      sheet.getRange(row,1,1,cells.length).setValues([nativeLiteralRow_(cells)]);
    } else {
      sheet.getRange(row,5).setValue('INACTIVE');
      SpreadsheetApp.flush();
      Object.keys(values).forEach(function(key) { sheet.getRange(row,cols[key]).setNumberFormat('@').setValue(values[key]); });
      sheet.getRange(row,7).setValue(now);
    }
    var passwordCell = password ? sheet.getRange(row,cols.password) : null;
    if (passwordCell) passwordCell.setNumberFormat('@').setRichTextValue(SpreadsheetApp.newRichTextValue().setText(password).build());
    SpreadsheetApp.flush();
    if (passwordCell && passwordCell.getDisplayValues()[0][0] !== password) throw new Error('Password Sales belum terkonfirmasi tersimpan. Simpan ulang; akun sementara nonaktif.');
    sheet.getRange(row,5).setValue(status);
    SpreadsheetApp.flush();
    return {success:true,message:'Akun Sales berhasil disimpan.'};
  } finally { lock.releaseLock(); }
}

function salesSessionKey_(token) { return KCH_SALES_SESSION_PREFIX_ + KCH_GUEST_SHA256_(token); }

function kchSalesLogin(username,password) {
  var window = guestRateSlot_(KCH_SALES_RATE_KEY_);
  var denied = 'Username atau password Sales salah, atau akun belum aktif.';
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 80 || password.length < 12 || password.length > 128) throw new Error(denied);
  username = username.trim().toLowerCase();
  var accounts = salesCredentials_(getAccessSheet_(false)), matches = accounts.filter(function(c) { return c.username === username; });
  var c = matches.length === 1 ? salesCredential_(accounts,matches[0].salesId) : null;
  if (!salesCredentialReady_(c) || !guestEqual_(guestPasswordHash_(password,c.password_salt,Number(c.password_iterations)),c.password_hash)) throw new Error(denied);
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var latest = salesCredential_(salesCredentials_(getAccessSheet_(false)),c.salesId);
    var revision = salesCredentialRevision_(c);
    if (!salesCredentialReady_(latest) || salesCredentialRevision_(latest) !== revision) throw new Error(denied);
    var user = salesIdentity_(latest);
    var props = PropertiesService.getScriptProperties(), now = Date.now(), all = props.getProperties(), sessions = [];
    Object.keys(all).forEach(function(key) {
      if (key.indexOf(KCH_SALES_SESSION_PREFIX_) !== 0) return;
      var entry;
      try { entry = JSON.parse(all[key]); } catch (err) { entry = null; }
      if (!entry || !(entry.expires > now) || (entry.salesId === user.salesId && entry.revision !== revision)) props.deleteProperty(key);
      else sessions.push({key:key,expires:entry.expires});
    });
    sessions.sort(function(a,b) { return a.expires-b.expires; });
    while (sessions.length >= 200) props.deleteProperty(sessions.shift().key);
    var token = 'KCHS_' + Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'');
    props.setProperty(salesSessionKey_(token),JSON.stringify({salesId:user.salesId,revision:revision,expires:now+KCH_GUEST_SESSION_MS_}));
    guestRateSuccess_(window,props,KCH_SALES_RATE_KEY_);
    return {success:true,token:token,user:user};
  } finally { lock.releaseLock(); }
}

function salesCredentialReady_(c) {
  return c && c.role === 'SALES' && passwordCredentialReady_(c);
}

function resolveSalesSession_(token) {
  if (!/^KCHS_[a-f0-9]{64}$/.test(token)) throw new Error('AUTH_REQUIRED: Silakan masuk kembali.');
  var props = PropertiesService.getScriptProperties(), key = salesSessionKey_(token), session;
  try { session = JSON.parse(props.getProperty(key) || 'null'); } catch (err) { session = null; }
  if (!session || !(session.expires > Date.now())) throw new Error('AUTH_REQUIRED: Sesi Sales berakhir. Silakan masuk kembali.');
  var credential = salesCredential_(salesCredentials_(getAccessSheet_(false)),session.salesId);
  if (!salesCredentialReady_(credential) || session.revision !== salesCredentialRevision_(credential)) throw new Error('AUTH_REQUIRED: Akses Sales berubah. Silakan masuk kembali.');
  return salesIdentity_(credential);
}
