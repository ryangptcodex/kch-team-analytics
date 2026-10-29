// Password authentication is exclusively for the single read-only Guest account.
var KCH_GUEST_ACCESS_HEADERS_ = ['auth_type', 'username', 'password_hash', 'password_salt', 'password_iterations', 'session_version'];
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
  var item = { updatedAt: matches[0].row[6] || '', status: normalizeKey_(matches[0].row[4]), role: normalizeKey_(matches[0].row[3]) };
  Object.keys(cols).forEach(function(h) { item[h] = cols[h] ? values[cols[h] - 1] : ''; });
  return item;
}

function guestCredentialReady_(c) {
  return c && c.auth_type === 'PASSWORD' && c.role === 'GUEST' && c.status === 'ACTIVE' &&
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

function guestRateSlot_() {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties(), now = Date.now(), rate = JSON.parse(props.getProperty('KCH_GUEST_RATE') || 'null');
    if (!rate || now >= rate.until) rate = { count: 0, until: now + 10 * 60 * 1000 };
    if (rate.count >= 20) throw new Error('Terlalu banyak percobaan login Tamu. Coba lagi dalam 10 menit.');
    rate.count++; props.setProperty('KCH_GUEST_RATE', JSON.stringify(rate));
  } finally { lock.releaseLock(); }
}

// Deliberate public unauthenticated entry point. Never returns account hashes/salts.
function kchGuestLogin(username, password) {
  guestRateSlot_();
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
  return { success: true };
}

// Admin-only RPC; old Google-guest row is retained as the single account record.
function saveGuestCredentials_(payload) {
  if (getCurrentUserInfo_().role !== 'ADMIN') throw new Error('ACCESS_DENIED: Hanya admin yang boleh mengelola akun.');
  payload = payload || {};
  var username = String(payload.username || '').trim().toLowerCase(), password = payload.password;
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) throw new Error('Username: 3–40 huruf kecil, angka, titik, garis bawah atau tanda hubung.');
  if (typeof password !== 'string' || (password.length && (password.length < 12 || password.length > 128))) throw new Error('Password minimal 12 dan maksimal 128 karakter.');
  var status = normalizeKey_(payload.status);
  if (['ACTIVE', 'INACTIVE'].indexOf(status) < 0) throw new Error('Status tidak valid.');
  var previous = guestCredential_();
  if (!password.length && (!previous || !previous.password_hash || !previous.password_salt)) throw new Error('Isi password untuk pemasangan akun Tamu pertama.');
  var revision = previous ? guestRevision_(previous) : '';
  var salt = password.length ? Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '') : previous.password_salt;
  var hash = password.length ? guestPasswordHash_(password, salt, KCH_GUEST_PASSWORD_ITERATIONS_) : previous.password_hash;
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var current = guestCredential_();
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
    sheet.getRange(rowNumber, 3, 1, 3).setValues([['', 'GUEST', status]]);
    sheet.getRange(rowNumber, 7).setValue(now); SpreadsheetApp.flush();
    return { success: true, message: 'Akun Tamu berhasil disimpan.' };
  } finally { lock.releaseLock(); }
}
