// Application RPC uses kchApi. The editor diagnostic also checks the active
// Google account; all implementation helpers end in _.
var KCH_REQUEST_USER_ = null;
var KCH_ACCESS_HEADERS_ = ['email', 'firebase_uid', 'sales_id', 'role', 'status', 'created_at', 'updated_at'];

function checkKchGoogleConnection() {
  var email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (email !== KCH_BOOTSTRAP_ADMIN_EMAIL_) {
    throw new Error('ACCESS_DENIED: Jalankan pemeriksaan dari editor memakai Gmail admin.');
  }
  return checkKchGoogleConnection_();
}

// Run manually in the Apps Script editor. Uses a deliberately invalid token;
// never reads a user's token, spreadsheet data, or changes access permissions.
function checkKchGoogleConnection_() {
  var apiKey = KCH_FIREBASE_WEB_CONFIG_.apiKey;
  var report;
  try {
    var response = UrlFetchApp.fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey),
      { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ idToken: 'KCH_DIAGNOSTIC_INVALID_TOKEN' }) }
    );
    var status = response.getResponseCode();
    var body;
    try { body = JSON.parse(response.getContentText()); } catch (err) { body = {}; }
    var message = String(body.error && body.error.message || 'Tidak ada rincian error.');
    message = message.split(apiKey).join('[REDACTED]').slice(0, 1000);
    var reachable = status === 400 && /^INVALID_ID_TOKEN(?:\s|:|$)/.test(message);
    report = { connectionOk: reachable, httpStatus: status, message: reachable
      ? 'Koneksi verifikasi Google berhasil. INVALID_ID_TOKEN memang diharapkan untuk tes ini; login pengguna belum diuji.'
      : message };
  } catch (err) {
    report = { connectionOk: false, stage: 'FETCH',
      message: String(err && err.message || 'Permintaan HTTPS gagal.').split(apiKey).join('[REDACTED]').slice(0, 1000) };
  }
  console.log(JSON.stringify(report));
  return report;
}

function verifyFirebaseIdentity_(token) {
  if (typeof token !== 'string' || token.length > 16000 || token.split('.').length !== 3) {
    throw new Error('AUTH_REQUIRED: Silakan masuk dengan Google.');
  }
  var claims;
  try {
    claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token.split('.')[1])).getDataAsString());
  } catch (err) { throw new Error('AUTH_REQUIRED: Token tidak valid.'); }
  var project = KCH_FIREBASE_WEB_CONFIG_.projectId;
  var now = Math.floor(Date.now() / 1000);
  if (claims.aud !== project || claims.iss !== 'https://securetoken.google.com/' + project ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 ||
      typeof claims.exp !== 'number' || claims.exp <= now ||
      typeof claims.iat !== 'number' || claims.iat > now + 60 ||
      !claims.firebase || claims.firebase.sign_in_provider !== 'google.com') {
    throw new Error('AUTH_REQUIRED: Sesi Google tidak valid atau kedaluwarsa.');
  }
  // Decoding claims is NOT signature verification. Google's authenticated lookup
  // validates the token; only its authoritative user identity is trusted below.
  var response;
  try {
    response = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' +
      encodeURIComponent(KCH_FIREBASE_WEB_CONFIG_.apiKey), {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ idToken: token }), muteHttpExceptions: true
      });
  } catch (err) { throw new Error('AUTH_UNAVAILABLE: Verifikasi Google belum dapat dihubungi. Coba lagi.'); }
  if (response.getResponseCode() !== 200) throw new Error('AUTH_REQUIRED: Verifikasi sesi Google gagal. Silakan masuk lagi.');
  var data;
  try { data = JSON.parse(response.getContentText()); }
  catch (err) { throw new Error('AUTH_UNAVAILABLE: Respons verifikasi Google tidak valid.'); }
  var user = data.users && data.users.length === 1 ? data.users[0] : null;
  if (!user || user.localId !== claims.sub || user.disabled || user.emailVerified !== true ||
      !user.email || !Array.isArray(user.providerUserInfo) ||
      !user.providerUserInfo.some(function(provider) { return provider.providerId === 'google.com'; })) {
    throw new Error('AUTH_REQUIRED: Akun Google tidak dapat diverifikasi.');
  }
  // Firebase refresh tokens revoked after this login must not keep app access.
  if (user.validSince && (!claims.auth_time || claims.auth_time < Number(user.validSince))) {
    throw new Error('AUTH_REQUIRED: Sesi telah dicabut. Silakan masuk lagi.');
  }
  return { uid: user.localId, email: String(user.email).trim().toLowerCase(), name: user.displayName || user.email };
}

function getAccessSheet_(create) {
  var ss = getKchSpreadsheet_();
  if (!ss) throw new Error('Spreadsheet terikat tidak ditemukan.');
  var sheet = ss.getSheetByName('ACCESS_USERS');
  if (!sheet && create) {
    sheet = ss.insertSheet('ACCESS_USERS');
    sheet.appendRow(KCH_ACCESS_HEADERS_);
    sheet.setFrozenRows(1);
  }
  if (sheet) {
    var headers = sheet.getRange(1, 1, 1, KCH_ACCESS_HEADERS_.length).getDisplayValues()[0];
    if (!KCH_ACCESS_HEADERS_.every(function(h, i) { return headers[i] === h; })) {
      throw new Error('Header ACCESS_USERS tidak sesuai; data tidak diubah.');
    }
  }
  return sheet;
}

function accessRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, KCH_ACCESS_HEADERS_.length).getDisplayValues();
}

function accessDisplayNameColumn_(sheet, create) {
  var lastColumn = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  var columns = [];
  headers.forEach(function(header, i) {
    if (String(header).trim().toLowerCase() === 'display_name') columns.push(i + 1);
  });
  if (columns.length > 1) throw new Error('Kolom display_name terdaftar ganda. Periksa ACCESS_USERS.');
  if (columns.length) return columns[0];
  if (!create) return 0;
  var column = Math.max(lastColumn, KCH_ACCESS_HEADERS_.length) + 1;
  sheet.getRange(1, column).setValue('display_name');
  return column;
}

function saveMyProfile_(payload) {
  var user = getCurrentUserInfo_();
  var name = payload && typeof payload.displayName === 'string' ? payload.displayName.trim() : '';
  if (name.length < 2 || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name) || /^[=+@-]/.test(name)) {
    throw new Error('Nama tampilan tidak valid. Gunakan 2–80 karakter dalam satu baris.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getAccessSheet_(false);
    var rows = accessRows_(sheet);
    var matches = [];
    rows.forEach(function(row, i) {
      if (String(row[0]).trim().toLowerCase() === user.email) matches.push({ row: row, number: i + 2 });
    });
    if (matches.length !== 1 || matches[0].row[1] !== user.uid || normalizeKey_(matches[0].row[4]) !== 'ACTIVE' ||
        ['ADMIN', 'SALES'].indexOf(normalizeKey_(matches[0].row[3])) < 0) {
      throw new Error('ACCESS_DENIED: Akses akun berubah. Silakan masuk kembali.');
    }
    var entry = matches[0];
    var column = accessDisplayNameColumn_(sheet, true);
    sheet.getRange(entry.number, column).setNumberFormat('@').setValue(name);
    sheet.getRange(entry.number, 7).setValue(new Date());
    SpreadsheetApp.flush();
    user.fullName = name;
    user.shortName = name.split(/\s+/)[0];
    logActivity_(user.email, 'UPDATE_PROFILE', user.email, 'Nama tampilan diperbarui.');
    return { success: true, user: user, message: 'Nama tampilan berhasil disimpan.' };
  } finally { lock.releaseLock(); }
}

function resolveAccessUser_(identity) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var isBootstrap = identity.email === KCH_BOOTSTRAP_ADMIN_EMAIL_;
    var sheet = getAccessSheet_(isBootstrap);
    var rows = accessRows_(sheet);
    var matches = [];
    rows.forEach(function(row, i) {
      if (String(row[0]).trim().toLowerCase() === identity.email) matches.push({ row: row, number: i + 2 });
    });
    if (matches.length > 1) throw new Error('ACCESS_DENIED: Email terdaftar ganda. Hubungi admin.');
    if (!matches.length && isBootstrap) {
      // Bootstrap once. An existing inactive admin is never automatically re-enabled.
      var now = new Date();
      var row = [identity.email, identity.uid, '', 'ADMIN', 'ACTIVE', now, now];
      sheet.appendRow(row);
      matches.push({ row: row, number: sheet.getLastRow() });
    }
    if (!matches.length) throw new Error('ACCESS_DENIED: Akun belum terdaftar. Hubungi admin.');
    var entry = matches[0];
    var role = normalizeKey_(entry.row[3]);
    if (normalizeKey_(entry.row[4]) !== 'ACTIVE') {
      throw new Error('ACCESS_DENIED: Akses akun tidak aktif. Hubungi admin.');
    }
    if (['ADMIN', 'SALES'].indexOf(role) < 0) {
      throw new Error('ACCESS_DENIED: Role akun tidak valid. Hubungi admin.');
    }
    if (entry.row[1] && entry.row[1] !== identity.uid) throw new Error('ACCESS_DENIED: Identitas akun berubah. Hubungi admin.');
    var salesId = String(entry.row[2] || '').trim();
    var sales = null;
    if (role === 'SALES') {
      sales = getSheetData_('SALES').rows.filter(function(s) { return normalizeKey_(s.sales_id) === normalizeKey_(salesId); })[0];
      if (!salesId || !sales || normalizeKey_(sales.status || 'ACTIVE') !== 'ACTIVE') {
        throw new Error('ACCESS_DENIED: Profil sales belum terhubung atau tidak aktif.');
      }
      if (rows.some(function(row) { return String(row[0]).trim().toLowerCase() !== identity.email &&
          normalizeKey_(row[4]) === 'ACTIVE' && normalizeKey_(row[2]) === normalizeKey_(salesId); })) {
        throw new Error('ACCESS_DENIED: Profil sales terhubung ke beberapa akun aktif. Hubungi admin.');
      }
    }
    if (!entry.row[1]) {
      sheet.getRange(entry.number, 2).setValue(identity.uid);
      sheet.getRange(entry.number, 7).setValue(new Date());
    }
    SpreadsheetApp.flush();
    var displayColumn = accessDisplayNameColumn_(sheet, false);
    var customName = displayColumn ? String(sheet.getRange(entry.number, displayColumn).getDisplayValues()[0][0] || '').trim() : '';
    var fullName = customName || (sales ? (sales.full_name || identity.name) : identity.name);
    return { email: identity.email, username: identity.email, uid: identity.uid, role: role,
      salesId: salesId, teamName: sales ? sales.team_name : '', fullName: fullName,
      shortName: String(fullName).split(/\s+/)[0] };
  } finally { lock.releaseLock(); }
}

function filterAuthorizedRows_(sheetName, rows) {
  var user = KCH_REQUEST_USER_;
  if (!user || user.role === 'ADMIN') return rows;
  if (['USERS', 'ACCESS_USERS', 'SKOR_EVENTS'].indexOf(sheetName) >= 0) return [];
  if (['SALES', 'SALES_TRANSACTIONS', 'ATTENDANCE', 'VISIT_PHOTOS', 'TODAY_PLAN'].indexOf(sheetName) >= 0) {
    return rows.filter(function(row) { return normalizeKey_(row.sales_id) === normalizeKey_(user.salesId); });
  }
  if (sheetName === 'ACTIVITY_LOGS') return rows.filter(function(row) { return String(row.username).toLowerCase() === user.email; });
  return rows;
}

function assertOwnSales_(salesId) {
  var user = getCurrentUserInfo_();
  if (user.role !== 'ADMIN' && normalizeKey_(salesId) !== normalizeKey_(user.salesId)) {
    throw new Error('ACCESS_DENIED: Sales hanya boleh mengelola data sendiri.');
  }
}

function listAccessUsers_() {
  var sales = getSheetData_('SALES').rows.filter(function(row) {
    return String(row.sales_id || '').trim();
  }).map(function(row) {
    return { sales_id: String(row.sales_id).trim(), full_name: row.full_name || row.sales_id,
      team_name: row.team_name || '', status: row.status || 'ACTIVE' };
  });
  return { success: true, users: accessRows_(getAccessSheet_(false)).map(function(row) {
    return { email: row[0], salesId: row[2], role: row[3], status: row[4] };
  }), sales: sales };
}

function saveAccessUser_(payload) {
  payload = payload || {};
  var email = String(payload.email || '').trim().toLowerCase();
  var salesId = String(payload.salesId || '').trim();
  var status = normalizeKey_(payload.status || 'ACTIVE');
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/.test(email) || email.length > 254) throw new Error('Gunakan alamat Gmail sales yang valid.');
  if (email === KCH_BOOTSTRAP_ADMIN_EMAIL_) throw new Error('Akun admin utama tidak dapat diubah dari formulir sales.');
  if (['ACTIVE', 'INACTIVE'].indexOf(status) < 0) throw new Error('Status tidak valid.');
  var sales = getSheetData_('SALES').rows.filter(function(s) { return normalizeKey_(s.sales_id) === normalizeKey_(salesId); })[0];
  if (!sales || (status === 'ACTIVE' && normalizeKey_(sales.status || 'ACTIVE') !== 'ACTIVE')) throw new Error('Pilih profil sales yang valid dan aktif.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getAccessSheet_(true);
    var rows = accessRows_(sheet);
    var index = -1;
    rows.forEach(function(row, i) {
      if (String(row[0]).toLowerCase() === email) {
        if (index !== -1) throw new Error('Email terdaftar ganda. Periksa ACCESS_USERS.');
        index = i;
      } else if (status === 'ACTIVE' && normalizeKey_(row[4]) === 'ACTIVE' && normalizeKey_(row[2]) === normalizeKey_(salesId)) {
        throw new Error('Profil sales sudah terhubung ke akun aktif lain.');
      }
    });
    if (index >= 0 && normalizeKey_(rows[index][3]) !== 'SALES') throw new Error('Akun ini bukan akun sales.');
    var now = new Date();
    var row = [email, index < 0 ? '' : rows[index][1], sales.sales_id, 'SALES', status,
      index < 0 ? now : sheet.getRange(index + 2, 6).getValue(), now];
    if (index < 0) sheet.appendRow(row);
    else sheet.getRange(index + 2, 1, 1, row.length).setValues([row]);
    SpreadsheetApp.flush();
    logActivity_(getCurrentUserInfo_().email, 'UPDATE_ACCESS_USER', email, JSON.stringify({ salesId: sales.sales_id, status: status }));
    return { success: true, message: 'Akses sales berhasil disimpan.' };
  } finally { lock.releaseLock(); }
}

function kchApi(token, method, args) {
  var handlers = {
    getScoreSetup: function() { return getScoreSetup_(); },
    getScoreReport: function(month, salesId) { return getScoreReport_(month, salesId); },
    saveScoreAA: function(input) { return saveScoreAA_(input); },
    getAuthProfile: function() { return { success: true, user: getCurrentUserInfo_() }; },
    saveMyProfile: saveMyProfile_,
    listAccessUsers: listAccessUsers_, saveAccessUser: saveAccessUser_,
    getInitialAppMetadata: getInitialAppMetadata_, getDashboardMetrics: getDashboardMetrics_,
    getAttendanceByDate: getAttendanceByDate_, getVisitPhotosByDate: getVisitPhotosByDate_,
    getTodayPlans: getTodayPlans_, saveTodayPlan: saveTodayPlan_, archiveTodayPlan: archiveTodayPlan_,
    getWeeklyMeetings: getWeeklyMeetingsResponse_, saveWeeklyMeeting: saveWeeklyMeeting_, archiveWeeklyMeeting: archiveWeeklyMeeting_,
    getKchNews: getKchNews_, saveKchNewsArticle: saveKchNewsArticle_, archiveKchNewsArticle: archiveKchNewsArticle_,
    saveSalesPhotoUpload: saveSalesPhotoUpload_, saveSalesTransaction: saveSalesTransaction_,
    getSalesTransactionRequestStatus: getSalesTransactionRequestStatus_,
    getSalesTransactionForEdit: getSalesTransactionForEdit_, editSalesTransaction: editSalesTransaction_,
    getTransactionsPaginated: getTransactionsPaginated_, getTransactionDetail: getTransactionDetail_,
    getAllTransactionsForExport: getAllTransactionsForExport_, getMonthlyTeamReport: getMonthlyTeamReport_,
    logClientActivity: logClientActivity_
  };
  if (!Object.prototype.hasOwnProperty.call(handlers, method) || !Array.isArray(args) || args.length > 10) {
    throw new Error('ACCESS_DENIED: Operasi tidak tersedia.');
  }
  try {
    KCH_REQUEST_USER_ = resolveAccessUser_(verifyFirebaseIdentity_(token));
    var user = getCurrentUserInfo_();
    var adminOnly = ['saveScoreAA', 'listAccessUsers', 'saveAccessUser', 'saveTodayPlan', 'archiveTodayPlan',
      'saveWeeklyMeeting', 'archiveWeeklyMeeting', 'saveKchNewsArticle', 'archiveKchNewsArticle'];
    if (adminOnly.indexOf(method) >= 0 && user.role !== 'ADMIN') throw new Error('ACCESS_DENIED: Hanya admin yang boleh melakukan operasi ini.');
    if (['saveSalesTransaction', 'saveSalesPhotoUpload'].indexOf(method) >= 0) {
      if (!args[0] || typeof args[0] !== 'object' || Array.isArray(args[0])) throw new Error('Payload tidak valid.');
      assertOwnSales_(args[0].salesId);
      args[0].username = user.email;
      var sales = getSheetData_('SALES').rows.filter(function(s) { return normalizeKey_(s.sales_id) === normalizeKey_(args[0].salesId); })[0];
      if (!sales || normalizeKey_(sales.status || 'ACTIVE') !== 'ACTIVE') throw new Error('Profil sales tidak aktif atau tidak ditemukan.');
      args[0].teamName = sales.team_name;
    }
    if (method === 'getMonthlyTeamReport') assertOwnSales_(args[1]);
    if (method === 'logClientActivity') {
      args[0] = 'CLIENT_' + String(args[0] || '').slice(0, 100);
      args[3] = user.email;
    }
    var result = handlers[method].apply(null, args);
    if (method === 'saveSalesPhotoUpload' && result.success) {
      logActivity_(user.email, 'UPLOAD_' + String(args[1]).toUpperCase(), args[0].salesId,
        JSON.stringify({ salesId: args[0].salesId, date: args[0].date, actorRole: user.role, assisted: user.role === 'ADMIN' }));
    }
    return result;
  } finally { KCH_REQUEST_USER_ = null; }
}
