/**
 * KALBE CONSUMER HEALTH - SALES MONITORING SYSTEM (CABANG LHOKSEUMAWE)
 * File: code.gs
 * Backend Logic: Unified Transaction Processing, Analytics & Dynamic Working Days (HK)
 * Features:
 *  - Dynamic Working Days: Auto-calculates active month workdays excluding Sundays & HOLIDAYS sheet
 *  - Unified Table: SALES_TRANSACTIONS (sales_name, shj, subtotal_shj, created_at HH:mm:ss)
 *  - High-Efficiency Grouping for Pagination & Metrics (with Total Modal & Total SHJ)
 * Author: ZettBOT by Zettbos
 */

var TIMEZONE = 'Asia/Jakarta';
var DATE_FORMAT = 'dd/MM/yyyy HH:mm:ss';

var STANDARD_TEAMS = [
  'Canvasser',
  'Junior Canvasser',
  'MPR',
  'Asisten MPR',
  'Motoris',
  'MMTW',
  'Motoris Ultimate',
  'SPG Kelontong'
];

function isAttendanceOnlyTeam_(teamName) {
  return normalizeKey_(teamName) === 'SPR';
}

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('Kalbe Consumer Health - Cabang Lhokseumawe')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getCurrentUserInfo_() {
  if (!KCH_REQUEST_USER_) throw new Error('AUTH_REQUIRED: Silakan masuk terlebih dahulu.');
  return KCH_REQUEST_USER_;
}

function getSidebarLogoUrl_() {
  try {
    var settingsRows = getSheetData_('SETTINGS').rows;
    for (var i = 0; i < settingsRows.length; i++) {
      if (normalizeKey_(settingsRows[i].setting_key) === 'SIDEBAR_LOGO_URL') {
        var rawUrl = String(settingsRows[i].setting_value || '').trim();
        return formatDrivePhotoUrl_(rawUrl);
      }
    }
  } catch (err) {}
  return '';
}

function getIndividualDailyTargetRate_(teamName) {
  if (!teamName) return 0;
  var t = String(teamName).toUpperCase().trim();
  if (isAttendanceOnlyTeam_(t)) return 0;
  if (t.indexOf('JUNIOR') > -1) return 0;
  if (t.indexOf('ASISTEN MPR') > -1) return 0;
  if (t === 'MPR' || t.indexOf('MPR ') === 0 || t.indexOf(' MPR') > -1) return 3500000;
  if (t.indexOf('ULTIMATE') > -1) return 800000;
  if (t.indexOf('MMTW') > -1) return 1200000;
  if (t.indexOf('MOTORIS') > -1) return 1200000;
  if (t.indexOf('SPG') > -1) return 800000;
  if (t.indexOf('CANVASSER') > -1) return 3500000;
  return 0;
}

function getIndividualMonthlyTarget_(teamName, manualTarget) {
  var parsedManual = parseCleanNumber_(manualTarget);
  if (!teamName) return (parsedManual > 0) ? parsedManual : 0;
  
  var t = String(teamName).toUpperCase().trim();
  if (isAttendanceOnlyTeam_(t)) return 0;
  if (t.indexOf('JUNIOR') > -1) return 0;
  if (t.indexOf('ASISTEN MPR') > -1) return 0;
  if (t === 'MPR' || t.indexOf('MPR ') === 0 || t.indexOf(' MPR') > -1) {
    return (parsedManual > 0 && parsedManual !== 30000000 && parsedManual !== 27000000) ? parsedManual : 80000000;
  }
  if (t.indexOf('CANVASSER') > -1) {
    return (parsedManual > 0 && parsedManual !== 30000000 && parsedManual !== 27000000) ? parsedManual : 80000000;
  }
  if (t.indexOf('ULTIMATE') > -1) return (parsedManual > 0) ? parsedManual : 20000000;
  if (t.indexOf('MMTW') > -1) return (parsedManual > 0 && parsedManual !== 30000000) ? parsedManual : 27000000;
  if (t.indexOf('MOTORIS') > -1) return (parsedManual > 0 && parsedManual !== 30000000) ? parsedManual : 27000000;
  if (t.indexOf('SPG') > -1) return (parsedManual > 0) ? parsedManual : 20000000;
  if (parsedManual > 0) return parsedManual;
  return 0;
}

function normalizeKey_(str) {
  if (str === null || str === undefined) return '';
  return String(str).trim().toUpperCase();
}

function parseCleanNumber_(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  var clean = String(val).replace(/Rp|\s/gi, '').trim();
  if (clean.indexOf('.') > -1 && clean.indexOf(',') > -1) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.indexOf('.') > -1 && clean.indexOf(',') === -1) {
    var parts = clean.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      clean = clean.replace(/\./g, '');
    }
  } else if (clean.indexOf(',') > -1) {
    clean = clean.replace(',', '.');
  }
  var n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function normalizeDateString_(dateVal) {
  if (!dateVal) return '';
  if (Object.prototype.toString.call(dateVal) === '[object Date]') {
    return Utilities.formatDate(dateVal, TIMEZONE, 'yyyy-MM-dd');
  }
  var str = String(dateVal).trim();
  if (str.indexOf(' ') > -1) str = str.split(' ')[0];

  if (str.indexOf('/') > -1) {
    var parts = str.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return parts[0] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[2]).slice(-2);
      }
      var p0 = parseInt(parts[0], 10);
      var p1 = parseInt(parts[1], 10);
      var y = parts[2].length === 2 ? ('20' + parts[2]) : parts[2];
      return y + '-' + ('0' + p1).slice(-2) + '-' + ('0' + p0).slice(-2);
    }
  } else if (str.indexOf('-') > -1) {
    var dashParts = str.split('-');
    if (dashParts.length === 3 && dashParts[0].length <= 2) {
      var d2 = ('0' + dashParts[0]).slice(-2);
      var m2 = ('0' + dashParts[1]).slice(-2);
      var y2 = dashParts[2].length === 2 ? ('20' + dashParts[2]) : dashParts[2];
      return y2 + '-' + m2 + '-' + d2;
    }
  }
  return str.slice(0, 10);
}

function extractDriveFileId_(url) {
  if (!url) return '';
  url = String(url).trim();
  var matchFileD = url.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/i) || url.match(/\/d\/([a-zA-Z0-9_-]{20,})/i);
  if (matchFileD && matchFileD[1]) return matchFileD[1];

  var matchIdParam = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/i);
  if (matchIdParam && matchIdParam[1]) return matchIdParam[1];

  var matchLh3 = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{20,})/i);
  if (matchLh3 && matchLh3[1]) return matchLh3[1];

  if (/^[a-zA-Z0-9_-]{25,50}$/.test(url)) return url;
  return '';
}

function formatDrivePhotoUrl_(url) {
  if (!url) return '';
  url = String(url).trim();
  var fileId = extractDriveFileId_(url);
  if (fileId) {
    return 'https://lh3.googleusercontent.com/d/' + fileId;
  }
  return url;
}

function formatVisitPhotoTime_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, TIMEZONE, 'HH:mm');
  }
  var timeText = String(value).trim();
  var match = timeText.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*$/);
  if (match) return ('0' + match[1]).slice(-2) + ':' + match[2];
  return timeText;
}

function getSheetData_(sheetName) {
  if (typeof archiveEnabled_ === 'function' && archiveEnabled_() && ['SALES_TRANSACTIONS','ATTENDANCE'].indexOf(sheetName)>=0) return archiveHistoryObjects_(sheetName);
  return getActiveSheetData_(sheetName);
}
function getActiveSheetData_(sheetName) {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { headers: [], rows: [] };
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) {
    var h = (lastCol > 0) ? sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] : [];
    return { headers: h, rows: [] };
  }
  
  var displayValues = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var rawValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = displayValues[0];
  var rows = [];
  
  for (var i = 1; i < displayValues.length; i++) {
    var rowObj = {};
    var hasContent = false;
    for (var c = 0; c < headers.length; c++) {
      var hName = headers[c];
      var cellDisp = displayValues[i][c] !== undefined ? displayValues[i][c] : '';
      var cellRaw = rawValues[i][c];

      if (Object.prototype.toString.call(cellRaw) === '[object Date]') {
        rowObj[hName] = Utilities.formatDate(cellRaw, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
      } else if (typeof cellRaw === 'number' && Number.isFinite(cellRaw) && ['cost_price', 'selling_price', 'shj', 'subtotal_sales', 'subtotal_cost', 'subtotal_shj'].indexOf(hName) >= 0) {
        rowObj[hName] = cellRaw;
      } else {
        rowObj[hName] = cellDisp;
      }

      if (cellDisp !== '' || cellRaw !== '') hasContent = true;
    }
    if (hasContent) rows.push(rowObj);
  }
  return { headers: headers, rows: filterAuthorizedRows_(sheetName, rows) };
}

function getWorkDaysConfig_() {
  var ss = getKchSpreadsheet_();
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth(); // 0 = Jan, 9 = Oct
  var todayDate = now.getDate();
  var daysInMonth = new Date(year, month + 1, 0).getDate();

  // 1. Baca daftar tanggal merah nasional & daerah dari sheet HOLIDAYS
  var holidayMap = {};
  var holidaySheetNames = ['HOLIDAYS', 'HARI_LIBUR', 'LIBUR'];
  var holidaySheet = null;

  for (var h = 0; h < holidaySheetNames.length; h++) {
    var sh = ss.getSheetByName(holidaySheetNames[h]);
    if (sh && sh.getLastRow() > 1) {
      holidaySheet = sh;
      break;
    }
  }

  if (holidaySheet) {
    try {
      var hLastR = holidaySheet.getLastRow();
      var hLastC = holidaySheet.getLastColumn();
      var hHeaders = holidaySheet.getRange(1, 1, 1, hLastC).getDisplayValues()[0];
      
      var colDateIdx = -1;
      var colDescIdx = -1;
      for (var hc = 0; hc < hHeaders.length; hc++) {
        var hName = String(hHeaders[hc] || '').toLowerCase().trim();
        if (hName === 'date' || hName === 'holiday_date' || hName === 'tanggal' || hName === 'tgl') {
          colDateIdx = hc;
        } else if (hName === 'holiday_name' || hName === 'keterangan' || hName === 'nama_libur' || hName === 'description') {
          colDescIdx = hc;
        }
      }
      if (colDateIdx === -1) colDateIdx = 0;

      var hVals = holidaySheet.getRange(2, 1, hLastR - 1, hLastC).getDisplayValues();
      for (var r = 0; r < hVals.length; r++) {
        var rawDate = hVals[r][colDateIdx];
        var normDate = normalizeDateString_(rawDate);
        if (normDate) {
          var desc = (colDescIdx !== -1 && hVals[r][colDescIdx]) ? String(hVals[r][colDescIdx]).trim() : 'Libur Nasional / Daerah';
          holidayMap[normDate] = desc;
        }
      }
    } catch (e) {}
  }

  // 2. Baca SETTINGS untuk fleksibilitas override (opsional)
  var settingSheet = ss.getSheetByName('SETTINGS');
  var settingsMap = {};
  if (settingSheet && settingSheet.getLastRow() > 1) {
    try {
      var sData = getSheetData_('SETTINGS').rows;
      sData.forEach(function(s) {
        if (s.setting_key) settingsMap[normalizeKey_(s.setting_key)] = s.setting_value;
      });
    } catch (err) {}
  }

  // 3. Kalkulasi Otomatis: Hari kalender bulan berjalan dikurangi hari Minggu & tanggal merah di sheet HOLIDAYS
  var autoTotalWorkDays = 0;
  var autoPassedWorkDays = 0;

  for (var d = 1; d <= daysInMonth; d++) {
    var dt = new Date(year, month, d);
    var isSunday = (dt.getDay() === 0);
    var dateStr = Utilities.formatDate(dt, TIMEZONE, 'yyyy-MM-dd');
    var isHoliday = !isSunday && !!holidayMap[dateStr];

    if (!isSunday && !isHoliday) {
      autoTotalWorkDays++;
      if (d <= todayDate) {
        autoPassedWorkDays++;
      }
    }
  }

  var totalWorkDays = autoTotalWorkDays;
  var passedWorkDays = autoPassedWorkDays;

  // Manual override hanya jika ENABLE_MANUAL_WORK_DAYS diset TRUE di sheet SETTINGS
  if (String(settingsMap['ENABLE_MANUAL_WORK_DAYS'] || '').toUpperCase() === 'TRUE') {
    if (settingsMap['TOTAL_WORK_DAYS']) {
      var parsedTotal = parseInt(settingsMap['TOTAL_WORK_DAYS'], 10);
      if (!isNaN(parsedTotal) && parsedTotal > 0) totalWorkDays = parsedTotal;
    }
    if (settingsMap['WORK_DAYS_PASSED'] !== undefined && settingsMap['WORK_DAYS_PASSED'] !== '') {
      var parsedPassed = parseInt(settingsMap['WORK_DAYS_PASSED'], 10);
      if (!isNaN(parsedPassed) && parsedPassed >= 0) passedWorkDays = parsedPassed;
    }
  }

  if (passedWorkDays > totalWorkDays) passedWorkDays = totalWorkDays;

  return {
    totalWorkDays: totalWorkDays,
    workDaysPassed: passedWorkDays,
    workDaysRemaining: Math.max(0, totalWorkDays - passedWorkDays)
  };
}

function getHolidayDateMap_() {
  var ss = getKchSpreadsheet_();
  var holidayMap = {};
  var holidaySheetNames = ['HOLIDAYS', 'HARI_LIBUR', 'LIBUR'];
  var holidaySheet = null;

  for (var h = 0; h < holidaySheetNames.length; h++) {
    var sh = ss.getSheetByName(holidaySheetNames[h]);
    if (sh && sh.getLastRow() > 1) {
      holidaySheet = sh;
      break;
    }
  }

  if (!holidaySheet) return holidayMap;

  try {
    var lastRow = holidaySheet.getLastRow();
    var lastCol = holidaySheet.getLastColumn();
    var headers = holidaySheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var dateCol = -1;

    for (var c = 0; c < headers.length; c++) {
      var header = String(headers[c] || '').toLowerCase().trim();
      if (header === 'date' || header === 'holiday_date' || header === 'tanggal' || header === 'tgl') {
        dateCol = c;
        break;
      }
    }
    if (dateCol === -1) dateCol = 0;

    var values = holidaySheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    for (var r = 0; r < values.length; r++) {
      var dateStr = normalizeDateString_(values[r][dateCol]);
      if (dateStr) holidayMap[dateStr] = true;
    }
  } catch (err) {}

  return holidayMap;
}

function getWorkDateRangeInfo_(startDate, endDate, holidayMap) {
  var startMatch = String(startDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var endMatch = String(endDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!startMatch || !endMatch) return { workDays: 0, dates: [] };

  var cursor = new Date(Date.UTC(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3])));
  var end = new Date(Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3])));
  if (isNaN(cursor.getTime()) || isNaN(end.getTime()) || cursor > end) return { workDays: 0, dates: [] };
  if (cursor.getUTCFullYear() !== Number(startMatch[1]) || cursor.getUTCMonth() !== Number(startMatch[2]) - 1 || cursor.getUTCDate() !== Number(startMatch[3])) return { workDays: 0, dates: [] };
  if (end.getUTCFullYear() !== Number(endMatch[1]) || end.getUTCMonth() !== Number(endMatch[2]) - 1 || end.getUTCDate() !== Number(endMatch[3])) return { workDays: 0, dates: [] };

  var dates = [];
  var workDays = 0;
  var maxDays = 4000;
  var scanned = 0;
  holidayMap = holidayMap || {};

  while (cursor <= end && scanned < maxDays) {
    var year = cursor.getUTCFullYear();
    var month = ('0' + (cursor.getUTCMonth() + 1)).slice(-2);
    var day = ('0' + cursor.getUTCDate()).slice(-2);
    var dateStr = year + '-' + month + '-' + day;
    var isWorkDay = cursor.getUTCDay() !== 0 && !holidayMap[dateStr];

    dates.push({ date: dateStr, isWorkDay: isWorkDay });
    if (isWorkDay) workDays++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    scanned++;
  }

  return { workDays: workDays, dates: dates };
}

function generateSequentialId_(prefix, sheetName, colIndex, isDaily) {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  var lastRow = sheet ? sheet.getLastRow() : 1;
  var now = new Date();
  var dateStr = Utilities.formatDate(now, TIMEZONE, 'yyyyMMdd');
  
  if (isDaily) {
    var searchPrefix = prefix + '-' + dateStr + '-';
    var maxNum = 0;
    if (lastRow > 1) {
      var ids = sheet.getRange(2, colIndex, lastRow - 1, 1).getDisplayValues();
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i][0];
        if (id && id.indexOf(searchPrefix) === 0) {
          var numPart = parseInt(id.replace(searchPrefix, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
        }
      }
    }
    var next = maxNum + 1;
    return searchPrefix + ('0000' + next).slice(-4);
  } else {
    var searchPrefixNonDaily = prefix + '-';
    var maxNumNonDaily = 0;
    if (lastRow > 1) {
      var idsNonDaily = sheet.getRange(2, colIndex, lastRow - 1, 1).getDisplayValues();
      for (var j = 0; j < idsNonDaily.length; j++) {
        var curId = idsNonDaily[j][0];
        if (curId && curId.indexOf(searchPrefixNonDaily) === 0) {
          var num = parseInt(curId.replace(searchPrefixNonDaily, ''), 10);
          if (!isNaN(num) && num > maxNumNonDaily) maxNumNonDaily = num;
        }
      }
    }
    return searchPrefixNonDaily + ('0000' + (maxNumNonDaily + 1)).slice(-4);
  }
}

function logActivity_(username, action, targetRef, details) {
  try {
    var ss = getKchSpreadsheet_();
    var sheet = ss.getSheetByName('ACTIVITY_LOGS');
    if (!sheet) return;
    
    var logId = generateSequentialId_('LOG', 'ACTIVITY_LOGS', 1, false);
    var timestamp = Utilities.formatDate(new Date(), TIMEZONE, DATE_FORMAT);
    sheet.appendRow([logId, timestamp, KCH_REQUEST_USER_ ? KCH_REQUEST_USER_.email : (username || 'admin'), action, targetRef, details]);
    SpreadsheetApp.flush();
  } catch (err) {}
}

function logClientActivity_(action, targetRef, details, username) {
  try {
    logActivity_(username || 'ryan', action, targetRef, details);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// Actual attendance days, independently from calendar workdays and sales dates.
function getAttendanceWorkDatesBySales_(month, today) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) throw new Error('Bulan absensi tidak valid.');
  today = today || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  var daysBySales = Object.create(null);
  getSheetData_('ATTENDANCE').rows.forEach(function(row) {
    var salesId = normalizeKey_(row.sales_id);
    var date = normalizeDateString_(row.date || row.attendance_date || '');
    if (!salesId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(0, 7) !== month || date > today) return;
    var year = Number(date.slice(0, 4));
    var monthNumber = Number(date.slice(5, 7));
    var day = Number(date.slice(8, 10));
    if (day < 1 || day > new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()) return;
    var status = normalizeKey_(row.status).replace(/[\s_-]+/g, ' ');
    var present = ['', 'ACTIVE', 'PRESENT', 'TERLAMBAT', 'LATE', 'MASUK', 'CHECK IN', 'CHECKIN'].indexOf(status) > -1 || /^HADIR(?: |$)/.test(status);
    if (!present) return;
    if (!daysBySales[salesId]) daysBySales[salesId] = Object.create(null);
    daysBySales[salesId][date] = true;
  });
  return daysBySales;
}

function getInitialAppMetadata_() {
  try {
    SpreadsheetApp.flush();
    var products = getSheetData_('PRODUCTS').rows;
    var rawSales = getSheetData_('SALES').rows;
    var priceMaster = getSheetData_('PRICE_MASTER').rows;
    var inventory = getSheetData_('INVENTORY').rows;
    var rawVisitPhotos = getSheetData_('VISIT_PHOTOS').rows;
    var kchNews = getActiveKchNews_();
    var weeklyMeetings = getWeeklyMeetings_();
    var workDays = getWorkDaysConfig_();
    var currentUser = getCurrentUserInfo_();
    var attendanceToday = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    var attendanceMonth = attendanceToday.slice(0, 7);
    var attendanceDays = getAttendanceWorkDatesBySales_(attendanceMonth, attendanceToday);

    var rawDistributors = getSheetData_('DISTRIBUTORS').rows;
    var distributors = [];
    if (rawDistributors && rawDistributors.length > 0) {
      rawDistributors.forEach(function(d) {
        var dName = d.distributor_name || d.name || '';
        if (dName && String(d.status || 'ACTIVE').toUpperCase() === 'ACTIVE') {
          distributors.push({
            id: d.distributor_id || '',
            name: dName,
            type: d.distributor_type || d.type || 'Subdist'
          });
        }
      });
    }
    if (distributors.length === 0) {
      distributors = [
        { id: 'DIST-01', name: 'PT. Global Mitra Prima (Subdist)', type: 'Subdist' },
        { id: 'DIST-02', name: 'AP. Geubrina Rizki (Panel)', type: 'Panel' }
      ];
    }

    var rawFiles = getSheetData_('FILES').rows;
    var files = [];
    rawFiles.forEach(function(f) {
      var fName = f.file_name || f.name || '';
      var fCat = f.category || f.kategori || 'Google Drive';
      var fUrl = f.drive_url || f.link_file || 'https://drive.google.com';
      var fDate = f.update_date || f.updated_at || '';
      if (fName || fUrl !== 'https://drive.google.com') {
        files.push({
          file_name: fName || 'Dokumen KCH',
          category: fCat,
          drive_url: fUrl,
          update_date: fDate
        });
      }
    });

    var visitPhotos = rawVisitPhotos.filter(function(photo) {
      return String(photo.status || 'ACTIVE').toUpperCase() !== 'INACTIVE';
    }).map(function(photo) {
      return {
        visitId: photo.visit_id || '',
        date: normalizeDateString_(photo.visit_date || ''),
        time: formatVisitPhotoTime_(photo.visit_time),
        salesId: photo.sales_id || '',
        salesName: photo.sales_name || '',
        teamName: photo.team_name || '',
        area: photo.area || '',
        photoUrl: formatDrivePhotoUrl_(photo.photo_url || ''),
        notes: photo.notes || ''
      };
    });

    var sales = [];
    var attendanceSales = [];
    var teamMonthlyTargetMap = {};
    STANDARD_TEAMS.forEach(function(st) { teamMonthlyTargetMap[normalizeKey_(st)] = 0; });

    rawSales.forEach(function(s) {
      var sTeamRaw = s.team_name || s.team_id || 'Canvasser';
      var finalTeam = sTeamRaw;
      var teamKey = normalizeKey_(sTeamRaw);

      if (teamKey === 'CANVASSER' || teamKey === 'TEAM-01') finalTeam = 'Canvasser';
      else if (teamKey === 'ASISTEN CANVASSER') finalTeam = 'Junior Canvasser';
      else if (teamKey === 'MOTORIS' || teamKey === 'TEAM-02') finalTeam = 'Motoris';
      else if (teamKey === 'ULTIMATE' || teamKey === 'MOTORIS ULTIMATE' || teamKey === 'TEAM-03') finalTeam = 'Motoris Ultimate';
      else if (teamKey === 'SPG' || teamKey === 'SPG KELONTONG' || teamKey === 'TEAM-04') finalTeam = 'SPG Kelontong';

      var rawTgt = s.target_monthly !== undefined ? s.target_monthly : s.target_amount;
      var sOfficialMonthlyTarget = getIndividualMonthlyTarget_(finalTeam, rawTgt);
      var sDailyRate = getIndividualDailyTargetRate_(finalTeam);

      var normTeamKey = normalizeKey_(finalTeam);
      if (!isAttendanceOnlyTeam_(finalTeam)) {
        if (teamMonthlyTargetMap[normTeamKey] === undefined) teamMonthlyTargetMap[normTeamKey] = 0;
        teamMonthlyTargetMap[normTeamKey] += sOfficialMonthlyTarget;
      }

      var salesRecord = {
        sales_id: s.sales_id || '',
        full_name: s.full_name || '',
        team_name: finalTeam,
        area: s.area || 'Lhokseumawe',
        daily_target: sDailyRate,
        target_amount: sOfficialMonthlyTarget,
        target_monthly: sOfficialMonthlyTarget,
        photo_url: formatDrivePhotoUrl_(s.photo_url),
        phone: String(s.phone || '').trim(),
        email: String(s.email || '').trim(),
        status: s.status || 'ACTIVE',
        attendance_hk: Object.keys(attendanceDays[normalizeKey_(s.sales_id)] || {}).length,
        attendance_month: attendanceMonth
      };
      attendanceSales.push(salesRecord);
      if (!isAttendanceOnlyTeam_(finalTeam)) sales.push(salesRecord);
    });

    var teams = [];
    STANDARD_TEAMS.forEach(function(st) {
      var norm = normalizeKey_(st);
      teams.push({
        team_id: st,
        team_name: st,
        monthly_target: teamMonthlyTargetMap[norm] || 0,
        status: 'ACTIVE'
      });
    });

    priceMaster.forEach(function(prc) {
      prc.cost_price = parseCleanNumber_(prc.cost_price);
      prc.selling_price = parseCleanNumber_(prc.selling_price);
      prc.shj = parseCleanNumber_(prc.shj);
    });

    inventory.forEach(function(inv) {
      inv['PT. Global Mitra Prima'] = parseCleanNumber_(inv['PT. Global Mitra Prima']);
      inv['AP. Geubrina Rizki'] = parseCleanNumber_(inv['AP. Geubrina Rizki']);
    });

    return {
      success: true,
      user: currentUser,
      teams: teams,
      distributors: distributors,
      products: products,
      sales: sales,
      priceMaster: priceMaster,
      inventory: inventory,
      files: files,
      attendanceSales: attendanceSales,
      visitPhotos: visitPhotos,
      kchNews: kchNews,
      weeklyMeetings: weeklyMeetings,
      canManageKchNews: isKchNewsManager_(),
      canManageTodayPlan: isKchNewsManager_(),
      canManageWeeklyMeetings: isWeeklyMeetingManager_(),
      sidebarLogoUrl: getSidebarLogoUrl_(),
      workDays: workDays
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getDashboardMetrics_(filters) {
  try {
    SpreadsheetApp.flush();
    filters = filters || {};
    var txData = getSheetData_('SALES_TRANSACTIONS').rows;
    var salesData = getSheetData_('SALES').rows;
    var workDays = getWorkDaysConfig_();
    var currentUser = getCurrentUserInfo_();

    var period = (filters.period || 'TODAY').toUpperCase();
    var now = new Date();
    var todayRealStr = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd');
    var currentYear = now.getFullYear();
    var currentMonth = ('0' + (now.getMonth() + 1)).slice(-2);
    var currentMonthPrefix = currentYear + '-' + currentMonth;

    var weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    var defaultWeekStart = Utilities.formatDate(weekAgo, TIMEZONE, 'yyyy-MM-dd');

    var startDate = filters.startDate || '';
    var endDate = filters.endDate || '';

    if (period === 'WEEK' || period === 'THIS WEEK') {
      if (!startDate) startDate = defaultWeekStart;
      if (!endDate) endDate = todayRealStr;
    } else if (period === 'MONTH' || period === 'THIS MONTH') {
      if (!startDate) startDate = currentMonthPrefix + '-01';
      if (!endDate) {
        var lastDay = new Date(currentYear, now.getMonth() + 1, 0).getDate();
        endDate = currentMonthPrefix + '-' + ('0' + lastDay).slice(-2);
      }
    }

    var chartStartDate = startDate || todayRealStr;
    var chartEndDate = endDate || chartStartDate;
    var workDateRange = getWorkDateRangeInfo_(chartStartDate, chartEndDate, getHolidayDateMap_());

    var legacyMap = {
      'TEAM-01': 'Canvasser',
      'TEAM-02': 'MOTORIS',
      'TEAM-03': 'MOTORIS ULTIMATE',
      'TEAM-04': 'SPG KELONTONG',
      'CANVASSER': 'Canvasser',
      'ASISTEN CANVASSER': 'Junior Canvasser'
    };

    var teamMonthlyTargetMap = {};
    var teamSalesMap = {};
    var teamNameMap = {};
    var teamsList = [];

    STANDARD_TEAMS.forEach(function(st) {
      var normSt = normalizeKey_(st);
      teamMonthlyTargetMap[normSt] = 0;
      teamSalesMap[normSt] = 0;
      teamNameMap[normSt] = st;
      teamsList.push({ teamId: st, teamName: st, target: 0 });
    });

    var salesAchievementMap = {};
    var salesNameMap = {};
    var salesTeamMap = {};
    var salesAreaMap = {};
    var branchOfficialMonthlyTargetTotal = 0;
    var branchDailyTargetTotal = 0;

    salesData.forEach(function(s) {
      var sIdRaw = String(s.sales_id || '').trim();
      if (!sIdRaw) return;
      var sIdNorm = normalizeKey_(sIdRaw);
      salesNameMap[sIdNorm] = s.full_name;

      var sTeamRaw = s.team_name || 'Canvasser';
      var sTeamNorm = normalizeKey_(sTeamRaw);
      if (legacyMap[sTeamNorm]) sTeamNorm = legacyMap[sTeamNorm];
      var finalTeamName = teamNameMap[sTeamNorm] || sTeamRaw;
      salesTeamMap[sIdNorm] = finalTeamName;

      var sAreaVal = String(s.area || 'Lhokseumawe').trim();
      salesAreaMap[sIdNorm] = sAreaVal;

      if (isAttendanceOnlyTeam_(finalTeamName)) return;

      var sOfficialMonthlyTarget = parseCleanNumber_(s.target_monthly);
      var sDailyRate = getIndividualDailyTargetRate_(finalTeamName);

      branchOfficialMonthlyTargetTotal += sOfficialMonthlyTarget;
      branchDailyTargetTotal += sDailyRate;

      var teamNormKey = normalizeKey_(finalTeamName);
      if (teamMonthlyTargetMap[teamNormKey] !== undefined) {
        teamMonthlyTargetMap[teamNormKey] += sOfficialMonthlyTarget;
      }

      salesAchievementMap[sIdNorm] = {
        salesId: sIdRaw,
        name: s.full_name,
        teamName: finalTeamName,
        area: sAreaVal,
        dailyRate: sDailyRate,
        monthlyTarget: sOfficialMonthlyTarget,
        target: sOfficialMonthlyTarget,
        achieved: 0,
        todayAchieved: 0
      };
    });

    var defaultAreaDefs = [
      { key: 'AREA_LHOKSEUMAWE', name: 'Lhokseumawe', color: '#2563eb' },
      { key: 'AREA_BIREUEN', name: 'Bireuen', color: '#16a34a' },
      { key: 'AREA_TAKENGON', name: 'Takengon', color: '#7c3aed' },
      { key: 'AREA_LANGSA', name: 'Langsa', color: '#f97316' },
      { key: 'AREA_BANDA_ACEH', name: 'Banda Aceh', color: '#0ea5e9' }
    ];

    var areaSalesAcc = {
      'AREA_LHOKSEUMAWE': 0,
      'AREA_BIREUEN': 0,
      'AREA_TAKENGON': 0,
      'AREA_LANGSA': 0,
      'AREA_BANDA_ACEH': 0
    };

    var totalSales = 0;
    var totalCost = 0;
    var trendDateMap = {};

    var recentInvoiceMap = {};
    var recentInvoiceOrder = [];

    for (var i = 0; i < txData.length; i++) {
      var row = txData[i];
      var rawDate = row.transaction_date || '';
      var normalizedTxDate = normalizeDateString_(rawDate);

      var sVal = parseCleanNumber_(row.subtotal_sales || row.total_sales);
      var cVal = parseCleanNumber_(row.subtotal_cost || row.total_cost);
      var txSalesNorm = normalizeKey_(row.sales_id);

      if (normalizedTxDate === todayRealStr && salesAchievementMap[txSalesNorm]) {
        salesAchievementMap[txSalesNorm].todayAchieved = (salesAchievementMap[txSalesNorm].todayAchieved || 0) + sVal;
      }

      if (period === 'TODAY') {
        if (normalizedTxDate !== todayRealStr) continue;
      } else if (period === 'WEEK' || period === 'THIS WEEK' || period === 'MONTH' || period === 'THIS MONTH' || period === 'CUSTOM') {
        if (startDate && normalizedTxDate < startDate) continue;
        if (endDate && normalizedTxDate > endDate) continue;
      }

      var rowTeamRaw = row.team_name || salesTeamMap[txSalesNorm] || '';
      var rowTeamNorm = normalizeKey_(rowTeamRaw);
      if (legacyMap[rowTeamNorm]) rowTeamNorm = legacyMap[rowTeamNorm];
      if (isAttendanceOnlyTeam_(rowTeamNorm)) continue;

      if (filters.teamId && filters.teamId !== 'ALL') {
        var filterNorm = normalizeKey_(filters.teamId);
        if (legacyMap[filterNorm]) filterNorm = legacyMap[filterNorm];
        if (rowTeamNorm !== filterNorm) continue;
      }

      totalSales += sVal;
      totalCost += cVal;

      if (normalizedTxDate) {
        trendDateMap[normalizedTxDate] = (trendDateMap[normalizedTxDate] || 0) + sVal;
      }
      if (teamSalesMap[rowTeamNorm] !== undefined) {
        teamSalesMap[rowTeamNorm] += sVal;
      }
      if (salesAchievementMap[txSalesNorm]) {
        salesAchievementMap[txSalesNorm].achieved += sVal;
      }

      var assignedArea = salesAreaMap[txSalesNorm] ? salesAreaMap[txSalesNorm].toUpperCase() : '';
      var matchedAreaKey = 'AREA_LHOKSEUMAWE';
      if (assignedArea.indexOf('BANDA') > -1 || assignedArea.indexOf('BNA') > -1) matchedAreaKey = 'AREA_BANDA_ACEH';
      else if (assignedArea.indexOf('BIREUEN') > -1 || assignedArea.indexOf('BIREUN') > -1) matchedAreaKey = 'AREA_BIREUEN';
      else if (assignedArea.indexOf('TAKENGON') > -1) matchedAreaKey = 'AREA_TAKENGON';
      else if (assignedArea.indexOf('LANGSA') > -1) matchedAreaKey = 'AREA_LANGSA';
      else if (assignedArea.indexOf('LHOKSEUMAWE') > -1) matchedAreaKey = 'AREA_LHOKSEUMAWE';

      if (areaSalesAcc[matchedAreaKey] !== undefined) {
        areaSalesAcc[matchedAreaKey] += sVal;
      }

      var curTxId = String(row.transaction_id || '').trim();
      if (curTxId) {
        if (!recentInvoiceMap[curTxId]) {
          recentInvoiceMap[curTxId] = {
            id: curTxId,
            date: row.transaction_date,
            salesName: row.sales_name || salesNameMap[txSalesNorm] || row.sales_id,
            teamName: teamNameMap[rowTeamNorm] || rowTeamRaw,
            distributor: row.distributor || 'PT. Global Mitra Prima (Subdist)',
            totalSales: sVal
          };
          recentInvoiceOrder.push(curTxId);
        } else {
          recentInvoiceMap[curTxId].totalSales += sVal;
        }
      }
    }

    var salesPerformanceList = [];
    var topCanvasser = null;
    var topMotoris = null;

    for (var normKey in salesAchievementMap) {
      var sp = salesAchievementMap[normKey];
      var curTeamName = sp.teamName || 'Sales';
      var curTeamLower = curTeamName.toLowerCase();
      if (curTeamLower.indexOf('junior') > -1 || curTeamLower.indexOf('asisten mpr') > -1) continue;

      var sPct = sp.monthlyTarget > 0 ? Math.round((sp.achieved / sp.monthlyTarget) * 100) : 0;
      sp.percentage = sPct;

      salesPerformanceList.push({
        salesId: sp.salesId,
        name: sp.name,
        teamName: curTeamName,
        areaName: sp.area || 'Lhokseumawe',
        dailyRate: sp.dailyRate,
        periodTarget: sp.monthlyTarget,
        monthlyTarget: sp.monthlyTarget,
        target: sp.monthlyTarget,
        achieved: sp.achieved,
        todayAchieved: sp.todayAchieved || 0,
        percentage: sPct
      });

      if ((curTeamLower.indexOf('canvasser') > -1 || curTeamLower === 'mpr') && curTeamLower.indexOf('junior') === -1 && curTeamLower.indexOf('asisten mpr') === -1) {
        if (!topCanvasser || sp.achieved > topCanvasser.achieved) {
          topCanvasser = { name: sp.name, achieved: sp.achieved, target: sp.monthlyTarget, pct: sPct, teamName: curTeamName };
        }
      }

      if (curTeamLower.indexOf('motoris') > -1 && curTeamLower.indexOf('ultimate') === -1) {
        if (!topMotoris || sp.achieved > topMotoris.achieved) {
          topMotoris = { name: sp.name, achieved: sp.achieved, target: sp.monthlyTarget, pct: sPct, teamName: curTeamName };
        }
      }
    }

    salesPerformanceList.sort(function(a, b) { return b.achieved - a.achieved; });

    var salesTrend = [];
    workDateRange.dates.forEach(function(dayInfo) {
      salesTrend.push({
        date: dayInfo.date,
        amount: trendDateMap[dayInfo.date] || 0,
        targetAmount: period === 'TODAY' && dayInfo.isWorkDay ? branchDailyTargetTotal : null
      });
    });

    var teamAchievements = [];
    teamsList.forEach(function(t) {
      var tLower = t.teamName.toLowerCase();
      if (tLower.indexOf('junior') > -1) return;

      var tNorm = normalizeKey_(t.teamName);
      var tAchieved = teamSalesMap[tNorm] || 0;
      var tTarget = teamMonthlyTargetMap[tNorm] || 0;
      var pct = tTarget > 0 ? Math.round((tAchieved / tTarget) * 100) : 0;
      
      var tColor = '#2563eb';
      if (tLower.indexOf('motoris') > -1 && tLower.indexOf('ultimate') === -1) tColor = '#16a34a';
      else if (tLower.indexOf('ultimate') > -1) tColor = '#7c3aed';
      else if (tLower.indexOf('spg') > -1) tColor = '#f97316';

      teamAchievements.push({
        teamId: t.teamName,
        teamName: t.teamName,
        achieved: tAchieved,
        target: tTarget,
        percentage: pct,
        color: tColor
      });
    });

    var areaAchievements = [];
    defaultAreaDefs.forEach(function(aDef) {
      var aAchieved = areaSalesAcc[aDef.key] || 0;
      areaAchievements.push({
        areaId: aDef.key,
        areaName: aDef.name,
        target: 0,
        achieved: aAchieved,
        percentage: 0,
        color: aDef.color
      });
    });

    var attendanceSheetRows = getSheetData_('ATTENDANCE').rows;
    var todayAttendanceList = [];
    var targetAttDate = filters.attendanceDate ? normalizeDateString_(filters.attendanceDate) : todayRealStr;

    for (var at = 0; at < attendanceSheetRows.length; at++) {
      var aRow = attendanceSheetRows[at];
      var rawAttDate = aRow.date || aRow.attendance_date || '';
      var normAttDate = normalizeDateString_(rawAttDate);

      if (normAttDate && normAttDate === targetAttDate) {
        var sIdKey = normalizeKey_(aRow.sales_id);
        var sName = aRow.sales_name || salesNameMap[sIdKey] || aRow.sales_id || 'Sales Personil';
        var sTeam = aRow.team_name || salesTeamMap[sIdKey] || 'Canvasser';
        if (normalizeKey_(sTeam) === 'ASISTEN CANVASSER') sTeam = 'Junior Canvasser';

        todayAttendanceList.push({
          id: aRow.sales_id || ('SLS-' + (at + 1)),
          date: normAttDate,
          salesId: aRow.sales_id || '-',
          salesName: sName,
          teamName: sTeam,
          time: formatVisitPhotoTime_(aRow.time) || '-',
          photoUrl: formatDrivePhotoUrl_(aRow.photo_url),
          status: aRow.status || 'Hadir Tepat Waktu',
          location: aRow.location || 'Cabang Lhokseumawe',
          notes: aRow.notes || 'Dokumentasi Absensi Lapangan'
        });
      }
    }

    var recentTxList = [];
    for (var ro = recentInvoiceOrder.length - 1; ro >= 0 && recentTxList.length < 5; ro--) {
      recentTxList.push(recentInvoiceMap[recentInvoiceOrder[ro]]);
    }

    var activityData = getSheetData_('ACTIVITY_LOGS').rows;
    var recentActivities = [];
    for (var aIdx = activityData.length - 1; aIdx >= 0 && recentActivities.length < 8; aIdx--) {
      var aRow = activityData[aIdx];
      var aTime = '';
      if (aRow.timestamp) {
        var tParts = aRow.timestamp.split(' ');
        aTime = tParts.length > 1 ? tParts[1].slice(0, 5) : aRow.timestamp;
      }
      recentActivities.push({
        id: aRow.log_id,
        time: aTime,
        timestamp: aRow.timestamp,
        username: aRow.username || 'admin',
        action: aRow.action,
        targetRef: aRow.target_ref,
        details: aRow.details
      });
    }

    var achievementPct = branchOfficialMonthlyTargetTotal > 0 ? (Math.round((totalSales / branchOfficialMonthlyTargetTotal) * 100 * 10) / 10) : 0;

    return {
      success: true,
      user: currentUser,
      currentServerDate: todayRealStr,
      attendanceDate: targetAttDate,
      kpi: {
        totalSales: totalSales,
        totalTarget: branchOfficialMonthlyTargetTotal,
        cumulativeTarget: branchOfficialMonthlyTargetTotal,
        achievementPct: achievementPct,
        workDaysPassed: workDays.workDaysPassed,
        workDaysRemaining: workDays.workDaysRemaining,
        totalWorkDays: workDays.totalWorkDays,
        topCanvasser: topCanvasser,
        topSeniorCanvasser: topCanvasser,
        topMotoris: topMotoris
      },
      teamAchievements: teamAchievements,
      areaAchievements: areaAchievements,
      salesTrend: salesTrend,
      salesPerformance: salesPerformanceList,
      todayAttendance: todayAttendanceList,
      recentTransactions: recentTxList,
      recentActivities: recentActivities
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getAttendanceByDate_(dateStr) {
  try {
    SpreadsheetApp.flush();
    var targetDate = normalizeDateString_(dateStr);
    if (!targetDate) targetDate = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');

    var attendanceSheetRows = getSheetData_('ATTENDANCE').rows;
    var salesData = getSheetData_('SALES').rows;
    var salesNameMap = {};
    var salesTeamMap = {};

    salesData.forEach(function(s) {
      var sIdNorm = normalizeKey_(s.sales_id);
      salesNameMap[sIdNorm] = s.full_name;
      salesTeamMap[sIdNorm] = s.team_name || '';
    });

    var attendanceList = [];
    for (var at = 0; at < attendanceSheetRows.length; at++) {
      var aRow = attendanceSheetRows[at];
      var rawAttDate = aRow.date || aRow.attendance_date || '';
      var normAttDate = normalizeDateString_(rawAttDate);

      if (normAttDate && normAttDate === targetDate) {
        var sIdKey = normalizeKey_(aRow.sales_id);
        var sName = aRow.sales_name || salesNameMap[sIdKey] || aRow.sales_id || 'Sales Personil';
        var sTeam = aRow.team_name || salesTeamMap[sIdKey] || 'Canvasser';
        if (normalizeKey_(sTeam) === 'ASISTEN CANVASSER') sTeam = 'Junior Canvasser';

        attendanceList.push({
          id: aRow.sales_id || ('SLS-' + (at + 1)),
          date: normAttDate,
          salesId: aRow.sales_id || '-',
          salesName: sName,
          teamName: sTeam,
          time: formatVisitPhotoTime_(aRow.time) || '-',
          photoUrl: formatDrivePhotoUrl_(aRow.photo_url),
          status: aRow.status || 'Hadir Tepat Waktu',
          location: aRow.location || 'Cabang Lhokseumawe',
          notes: aRow.notes || 'Dokumentasi Absensi Lapangan'
        });
      }
    }

    return { success: true, date: targetDate, attendance: attendanceList };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getVisitPhotosByDate_(dateStr) {
  try {
    SpreadsheetApp.flush();
    var targetDate = normalizeDateString_(dateStr);
    if (!targetDate) targetDate = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');

    var rows = getSheetData_('VISIT_PHOTOS').rows;
    var visitPhotos = rows.filter(function(photo) {
      var photoDate = normalizeDateString_(photo.visit_date || '');
      var status = String(photo.status || 'ACTIVE').toUpperCase();
      return photoDate === targetDate && status !== 'INACTIVE';
    }).map(function(photo) {
      return {
        visitId: photo.visit_id || '',
        date: normalizeDateString_(photo.visit_date || ''),
        time: formatVisitPhotoTime_(photo.visit_time),
        salesId: photo.sales_id || '',
        salesName: photo.sales_name || '',
        teamName: photo.team_name || '',
        area: photo.area || '',
        photoUrl: formatDrivePhotoUrl_(photo.photo_url || ''),
        notes: photo.notes || ''
      };
    });

    return { success: true, date: targetDate, visitPhotos: visitPhotos };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getTodayPlans_(dateStr) {
  try {
    var targetDate = normalizeDateString_(dateStr);
    if (!targetDate) targetDate = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    var planSheet = getKchSpreadsheet_().getSheetByName('TODAY_PLAN');
    if (!planSheet && getCurrentUserInfo_().role !== 'GUEST') setupTodayPlanSheet_();

    var rows = getSheetData_('TODAY_PLAN').rows;
    var plans = rows.filter(function(row) {
      return normalizeDateString_(row.plan_date) === targetDate && normalizeKey_(row.status || 'ACTIVE') === 'ACTIVE';
    }).map(function(row) {
      return {
        id: row.plan_id || '',
        date: normalizeDateString_(row.plan_date),
        salesId: row.sales_id || '',
        salesName: row.sales_name || '',
        teamName: row.team_name || '',
        area: row.area || '',
        destination: row.destination || '',
        plannedTime: formatVisitPhotoTime_(row.planned_time) || '',
        notes: row.notes || ''
      };
    });
    plans.sort(function(a, b) {
      if (!a.plannedTime) return b.plannedTime ? 1 : 0;
      if (!b.plannedTime) return -1;
      return a.plannedTime.localeCompare(b.plannedTime);
    });
    return { success: true, date: targetDate, plans: plans, canManage: isKchNewsManager_() };
  } catch (err) {
    return { success: false, message: err.message || 'Gagal memuat Today’s Plan.' };
  }
}

function saveTodayPlan_(payload) {
  try {
    if (!isKchNewsManager_()) return { success: false, message: 'Akses input Today’s Plan hanya untuk admin/koordinator.' };
    payload = payload || {};
    var planDate = normalizeDateString_(payload.date || '');
    var salesId = String(payload.salesId || '').trim();
    var destination = String(payload.destination || '').trim();
    var plannedTime = String(payload.plannedTime || '').trim();
    var notes = String(payload.notes || '').trim();
    var planId = String(payload.planId || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate)) return { success: false, message: 'Tanggal rencana tidak valid.' };
    if (!salesId || !destination) return { success: false, message: 'Sales dan tujuan kunjungan wajib diisi.' };
    if (plannedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(plannedTime)) return { success: false, message: 'Format jam rencana tidak valid.' };
    if (destination.length > 500 || notes.length > 2000) return { success: false, message: 'Tujuan maksimal 500 karakter dan keterangan maksimal 2.000 karakter.' };

    var salesRows = getSheetData_('SALES').rows;
    var sales = null;
    salesRows.some(function(row) {
      if (normalizeKey_(row.sales_id) === normalizeKey_(salesId)) { sales = row; return true; }
      return false;
    });
    if (!sales || normalizeKey_(sales.status || 'ACTIVE') === 'INACTIVE') {
      return { success: false, message: 'Sales tidak ditemukan atau statusnya tidak aktif.' };
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (typeof archivePendingGuard_ === 'function') archivePendingGuard_();
      if (typeof archiveAssertOpenDate_ === 'function') archiveAssertOpenDate_(planDate);
      var sheet = getKchSpreadsheet_().getSheetByName('TODAY_PLAN') || setupTodayPlanSheet_();
      var headerMap = {};
      TODAY_PLAN_HEADERS.forEach(function(header, i) { headerMap[header] = i; });
      var rowNumber = 0;
      if (planId && sheet.getLastRow() > 1) {
        var planRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, TODAY_PLAN_HEADERS.length).getDisplayValues();
        for (var i = 0; i < planRows.length; i++) {
          if (String(planRows[i][headerMap.plan_id] || '').trim() === planId) { rowNumber = i + 2; break; }
        }
        if (!rowNumber) return { success: false, message: 'Rencana yang akan diedit tidak ditemukan.' };
      }

      if (!planId) planId = 'PLAN-' + Utilities.getUuid().slice(0, 10).toUpperCase();
      var row = rowNumber
        ? sheet.getRange(rowNumber, 1, 1, TODAY_PLAN_HEADERS.length).getValues()[0]
        : new Array(TODAY_PLAN_HEADERS.length).fill('');
      var now = new Date();
      var planDateValue = new Date(Number(planDate.slice(0, 4)), Number(planDate.slice(5, 7)) - 1, Number(planDate.slice(8, 10)), 12, 0, 0);
      var values = {
        plan_id: planId,
        plan_date: planDateValue,
        sales_id: sales.sales_id,
        sales_name: sales.full_name || sales.sales_id,
        team_name: sales.team_name || '',
        area: sales.area || '',
        destination: destination,
        planned_time: plannedTime,
        notes: notes,
        status: 'ACTIVE',
        created_by: rowNumber ? row[headerMap.created_by] : getCurrentUserInfo_().username,
        created_at: rowNumber ? row[headerMap.created_at] : now,
        updated_at: now
      };
      Object.keys(values).forEach(function(key) { row[headerMap[key]] = values[key]; });
      if (rowNumber) sheet.getRange(rowNumber, 1, 1, TODAY_PLAN_HEADERS.length).setValues([row]);
      else sheet.appendRow(row);
      var savedRow = rowNumber || sheet.getLastRow();
      sheet.getRange(savedRow, headerMap.plan_date + 1).setNumberFormat('dd/MM/yyyy');
      sheet.getRange(savedRow, headerMap.created_at + 1, 1, 2).setNumberFormat('dd/MM/yyyy HH:mm:ss');
      SpreadsheetApp.flush();
      logActivity_(getCurrentUserInfo_().username, rowNumber ? 'UPDATE_TODAY_PLAN' : 'CREATE_TODAY_PLAN', planId, sales.full_name + ' - ' + destination);
      return { success: true, planId: planId, message: rowNumber ? 'Rencana berhasil diperbarui.' : 'Rencana berhasil disimpan.' };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { success: false, message: err.message || 'Gagal menyimpan Today’s Plan.' };
  }
}

function archiveTodayPlan_(planId) {
  try {
    if (!isKchNewsManager_()) return { success: false, message: 'Akses kelola Today’s Plan hanya untuk admin/koordinator.' };
    planId = String(planId || '').trim();
    if (!planId) return { success: false, message: 'ID rencana tidak valid.' };
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (typeof archivePendingGuard_ === 'function') archivePendingGuard_();
      var sheet = getKchSpreadsheet_().getSheetByName('TODAY_PLAN') || setupTodayPlanSheet_();
      if (sheet.getLastRow() < 2) return { success: false, message: 'Rencana tidak ditemukan.' };
      var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0] || '').trim() === planId) {
          if (typeof archiveAssertOpenDate_ === 'function') archiveAssertOpenDate_(normalizeDateString_(sheet.getRange(i+2,2).getValue()));
          sheet.getRange(i + 2, 10).setValue('ARCHIVED');
          sheet.getRange(i + 2, 13).setValue(new Date()).setNumberFormat('dd/MM/yyyy HH:mm:ss');
          SpreadsheetApp.flush();
          logActivity_(getCurrentUserInfo_().username, 'ARCHIVE_TODAY_PLAN', planId, 'Rencana diarsipkan');
          return { success: true, message: 'Rencana berhasil diarsipkan.' };
        }
      }
      return { success: false, message: 'Rencana tidak ditemukan.' };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { success: false, message: err.message || 'Gagal mengarsipkan rencana.' };
  }
}

function isWeeklyMeetingManager_() {
  var role = normalizeKey_(getCurrentUserInfo_().role).replace(/[ -]+/g, '_');
  return ['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'SALES_COORDINATOR'].indexOf(role) > -1;
}

function getWeeklyMeetings_() {
  var sheet = getKchSpreadsheet_().getSheetByName('WEEKLY_MEETINGS');
  if (!sheet) return [];
  return getSheetData_('WEEKLY_MEETINGS').rows.filter(function(row) {
    return normalizeKey_(row.status || 'ACTIVE') === 'ACTIVE' && String(row.title || '').trim();
  }).map(function(row) {
    return {
      id: row.meeting_id || '',
      date: normalizeDateString_(row.meeting_date || ''),
      title: String(row.title || '').trim(),
      summary: String(row.summary || '').trim(),
      decisions: String(row.decisions || '').trim(),
      followUp: String(row.follow_up || '').trim(),
      createdBy: String(row.created_by || '').trim()
    };
  }).sort(function(a, b) {
    return String(b.date || '').localeCompare(String(a.date || ''));
  }).slice(0, 100);
}

function getWeeklyMeetingsResponse_() {
  try {
    SpreadsheetApp.flush();
    return { success: true, meetings: getWeeklyMeetings_(), canManage: isWeeklyMeetingManager_() };
  } catch (err) {
    return { success: false, message: err.message || 'Gagal memuat hasil meeting mingguan.' };
  }
}

function saveWeeklyMeeting_(payload) {
  try {
    if (!isWeeklyMeetingManager_()) return { success: false, message: 'Akses kelola hasil meeting hanya untuk admin/koordinator.' };
    payload = payload || {};
    var meetingId = String(payload.meetingId || '').trim();
    var date = normalizeDateString_(payload.date || '');
    var title = String(payload.title || '').trim();
    var summary = String(payload.summary || '').trim();
    var decisions = String(payload.decisions || '').trim();
    var followUp = String(payload.followUp || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, message: 'Tanggal meeting tidak valid.' };
    if (!title || !summary) return { success: false, message: 'Judul meeting dan ringkasan hasil wajib diisi.' };
    if (title.length > 180 || summary.length > 5000 || decisions.length > 5000 || followUp.length > 5000) {
      return { success: false, message: 'Judul maksimal 180 karakter; ringkasan, keputusan, dan tindak lanjut maksimal 5.000 karakter.' };
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (typeof archivePendingGuard_ === 'function') archivePendingGuard_();
      if (typeof archiveAssertOpenDate_ === 'function') archiveAssertOpenDate_(date);
      var sheet = getKchSpreadsheet_().getSheetByName('WEEKLY_MEETINGS') || setupWeeklyMeetingsSheet_();
      var headerMap = {};
      WEEKLY_MEETING_HEADERS.forEach(function(header, i) { headerMap[header] = i; });
      var rowNumber = 0;
      if (meetingId && sheet.getLastRow() > 1) {
        var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, WEEKLY_MEETING_HEADERS.length).getDisplayValues();
        for (var i = 0; i < rows.length; i++) {
          if (String(rows[i][headerMap.meeting_id] || '').trim() === meetingId) { rowNumber = i + 2; break; }
        }
        if (!rowNumber) return { success: false, message: 'Hasil meeting yang akan diedit tidak ditemukan.' };
      }
      if (!meetingId) meetingId = 'MEET-' + Utilities.getUuid().slice(0, 10).toUpperCase();

      var row = rowNumber
        ? sheet.getRange(rowNumber, 1, 1, WEEKLY_MEETING_HEADERS.length).getValues()[0]
        : new Array(WEEKLY_MEETING_HEADERS.length).fill('');
      var now = new Date();
      var dateValue = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), 12, 0, 0);
      var values = {
        meeting_id: meetingId,
        meeting_date: dateValue,
        title: title,
        summary: summary,
        decisions: decisions,
        follow_up: followUp,
        status: 'ACTIVE',
        created_by: rowNumber ? row[headerMap.created_by] : getCurrentUserInfo_().username,
        created_at: rowNumber ? row[headerMap.created_at] : now,
        updated_at: now
      };
      Object.keys(values).forEach(function(key) { row[headerMap[key]] = values[key]; });
      if (rowNumber) sheet.getRange(rowNumber, 1, 1, WEEKLY_MEETING_HEADERS.length).setValues([row]);
      else sheet.appendRow(row);
      var savedRow = rowNumber || sheet.getLastRow();
      sheet.getRange(savedRow, headerMap.meeting_date + 1).setNumberFormat('dd/MM/yyyy');
      sheet.getRange(savedRow, headerMap.created_at + 1, 1, 2).setNumberFormat('dd/MM/yyyy HH:mm:ss');
      SpreadsheetApp.flush();
      logActivity_(getCurrentUserInfo_().username, rowNumber ? 'UPDATE_WEEKLY_MEETING' : 'CREATE_WEEKLY_MEETING', meetingId, title);
      return { success: true, meetingId: meetingId, message: rowNumber ? 'Hasil meeting berhasil diperbarui.' : 'Hasil meeting berhasil disimpan.' };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { success: false, message: err.message || 'Gagal menyimpan hasil meeting.' };
  }
}

function archiveWeeklyMeeting_(meetingId) {
  try {
    if (!isWeeklyMeetingManager_()) return { success: false, message: 'Akses kelola hasil meeting hanya untuk admin/koordinator.' };
    meetingId = String(meetingId || '').trim();
    if (!meetingId) return { success: false, message: 'ID meeting tidak valid.' };
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (typeof archivePendingGuard_ === 'function') archivePendingGuard_();
      var sheet = getKchSpreadsheet_().getSheetByName('WEEKLY_MEETINGS');
      if (!sheet || sheet.getLastRow() < 2) return { success: false, message: 'Hasil meeting tidak ditemukan.' };
      var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0] || '').trim() === meetingId) {
          if (typeof archiveAssertOpenDate_ === 'function') archiveAssertOpenDate_(normalizeDateString_(sheet.getRange(i+2,2).getValue()));
          sheet.getRange(i + 2, 7).setValue('ARCHIVED');
          sheet.getRange(i + 2, 10).setValue(new Date()).setNumberFormat('dd/MM/yyyy HH:mm:ss');
          SpreadsheetApp.flush();
          logActivity_(getCurrentUserInfo_().username, 'ARCHIVE_WEEKLY_MEETING', meetingId, 'Hasil meeting diarsipkan');
          return { success: true, message: 'Hasil meeting berhasil diarsipkan.' };
        }
      }
      return { success: false, message: 'Hasil meeting tidak ditemukan.' };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { success: false, message: err.message || 'Gagal mengarsipkan hasil meeting.' };
  }
}

function getActiveKchNews_() {
  var rows = getSheetData_('KCH_NEWS').rows;
  return rows.filter(function(row) {
    return String(row.status || 'ACTIVE').trim().toUpperCase() === 'ACTIVE' &&
      String(row.title || '').trim() !== '';
  }).map(function(row) {
    return {
      newsId: row.news_id || '',
      date: normalizeDateString_(row.publish_date || ''),
      title: String(row.title || '').trim(),
      summary: String(row.summary || '').trim(),
      bannerText: String(row.banner_text || '').trim(),
      bannerKicker: String(row.banner_kicker || '').trim(),
      bannerSubtitle: String(row.banner_subtitle || '').trim(),
      imageUrl: formatDrivePhotoUrl_(row.image_url || ''),
      newsUrl: String(row.news_url || '').trim(),
      content: String(row.article_content || row.content || '').trim(),
      status: String(row.status || 'ACTIVE').trim().toUpperCase()
    };
  }).sort(function(a, b) {
    return String(b.date || '').localeCompare(String(a.date || ''));
  }).slice(0, 50);
}

function getKchNews_() {
  try {
    SpreadsheetApp.flush();
    return { success: true, news: getActiveKchNews_(), canManage: isKchNewsManager_() };
  } catch (err) {
    return { success: false, message: err.message || 'Gagal memuat KCH News.' };
  }
}

function isKchNewsManager_() {
  var role = normalizeKey_(getCurrentUserInfo_().role).replace(/[ -]+/g, '_');
  return ['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'SALES_COORDINATOR'].indexOf(role) > -1;
}

function ensureKchNewsArticleColumn_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (!lastCol) {
    sheet.getRange(1, 1, 1, TABLE_SCHEMAS.KCH_NEWS.length).setValues([TABLE_SCHEMAS.KCH_NEWS]);
    lastCol = TABLE_SCHEMAS.KCH_NEWS.length;
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var headerMap = {};
  headers.forEach(function(value, index) { headerMap[normalizeKey_(value)] = index; });
  ['banner_kicker', 'banner_subtitle', 'article_content'].forEach(function(header) {
    var key = normalizeKey_(header);
    if (headerMap[key] === undefined) {
      headers.push(header);
      sheet.getRange(1, headers.length).setValue(header);
      headerMap[key] = headers.length - 1;
    }
  });
  return { headers: headers, map: headerMap };
}

function saveKchNewsArticle_(payload) {
  try {
    if (!isKchNewsManager_()) return { success: false, message: 'Akses hanya untuk admin/pengelola KCH News.' };
    payload = payload || {};
    var title = String(payload.title || '').trim();
    var dateText = String(payload.date || '').trim();
    var summary = String(payload.summary || '').trim();
    var content = String(payload.content || '').trim();
    var bannerText = String(payload.bannerText || '').trim();
    var bannerKicker = String(payload.bannerKicker || '').trim();
    var bannerSubtitle = String(payload.bannerSubtitle || '').trim();
    var imageUrl = String(payload.imageUrl || '').trim();
    var newsUrl = String(payload.newsUrl || '').trim();
    if (!title || !dateText || !summary || !content) {
      return { success: false, message: 'Judul, tanggal, ringkasan, dan isi artikel wajib diisi.' };
    }
    if (content.length > 45000) return { success: false, message: 'Isi artikel maksimal 45.000 karakter.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return { success: false, message: 'Format tanggal artikel tidak valid.' };
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) return { success: false, message: 'URL gambar harus diawali http:// atau https://.' };
    if (newsUrl && !/^https?:\/\//i.test(newsUrl)) return { success: false, message: 'Link selengkapnya harus diawali http:// atau https://.' };

    var ss = getKchSpreadsheet_();
    var sheet = ss.getSheetByName('KCH_NEWS');
    if (!sheet) sheet = ss.insertSheet('KCH_NEWS');
    var schema = ensureKchNewsArticleColumn_(sheet);
    var idCol = schema.map.NEWS_ID;
    var titleCol = schema.map.TITLE;
    var dateCol = schema.map.PUBLISH_DATE;
    if (idCol === undefined || titleCol === undefined || dateCol === undefined) {
      return { success: false, message: 'Header utama sheet KCH_NEWS belum lengkap. Jalankan Siapkan Sheet KCH_NEWS.' };
    }

    var newsId = String(payload.newsId || '').trim();
    var rowNumber = 0;
    if (newsId && sheet.getLastRow() > 1) {
      var ids = sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === newsId) { rowNumber = i + 2; break; }
      }
      if (!rowNumber) return { success: false, message: 'Artikel yang akan diedit tidak ditemukan.' };
    }
    if (!newsId) newsId = 'NEWS-' + Utilities.getUuid().slice(0, 8).toUpperCase();

    var row = rowNumber ? sheet.getRange(rowNumber, 1, 1, schema.headers.length).getValues()[0] : new Array(schema.headers.length).fill('');
    var values = {
      NEWS_ID: newsId,
      PUBLISH_DATE: new Date(Number(dateText.slice(0, 4)), Number(dateText.slice(5, 7)) - 1, Number(dateText.slice(8, 10)), 12, 0, 0),
      TITLE: title,
      SUMMARY: summary,
      BANNER_TEXT: bannerText,
      BANNER_KICKER: bannerKicker,
      BANNER_SUBTITLE: bannerSubtitle,
      IMAGE_URL: imageUrl,
      NEWS_URL: newsUrl,
      ARTICLE_CONTENT: content,
      STATUS: 'ACTIVE'
    };
    Object.keys(values).forEach(function(key) {
      var col = schema.map[key];
      if (col !== undefined) row[col] = values[key];
    });
    if (rowNumber) sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    if (schema.map.PUBLISH_DATE !== undefined) {
      sheet.getRange(rowNumber || sheet.getLastRow(), schema.map.PUBLISH_DATE + 1).setNumberFormat('dd/MM/yyyy');
    }
    SpreadsheetApp.flush();
    logActivity_(getCurrentUserInfo_().username, rowNumber ? 'UPDATE_KCH_NEWS' : 'CREATE_KCH_NEWS', newsId, title);
    return { success: true, newsId: newsId, message: rowNumber ? 'Artikel berhasil diperbarui.' : 'Artikel berhasil diterbitkan.' };
  } catch (err) {
    return { success: false, message: err.message || 'Gagal menyimpan artikel.' };
  }
}

function archiveKchNewsArticle_(newsId) {
  try {
    if (!isKchNewsManager_()) return { success: false, message: 'Akses hanya untuk admin/pengelola KCH News.' };
    newsId = String(newsId || '').trim();
    if (!newsId) return { success: false, message: 'ID artikel tidak valid.' };
    var sheet = getKchSpreadsheet_().getSheetByName('KCH_NEWS');
    if (!sheet || sheet.getLastRow() < 2) return { success: false, message: 'Artikel tidak ditemukan.' };
    var schema = ensureKchNewsArticleColumn_(sheet);
    var idCol = schema.map.NEWS_ID;
    var statusCol = schema.map.STATUS;
    if (idCol === undefined || statusCol === undefined) return { success: false, message: 'Kolom ID/status tidak ditemukan di KCH_NEWS.' };
    var ids = sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === newsId) {
        sheet.getRange(i + 2, statusCol + 1).setValue('ARCHIVED');
        SpreadsheetApp.flush();
        logActivity_(getCurrentUserInfo_().username, 'ARCHIVE_KCH_NEWS', newsId, 'Artikel diarsipkan');
        return { success: true, message: 'Artikel berhasil diarsipkan.' };
      }
    }
    return { success: false, message: 'Artikel tidak ditemukan.' };
  } catch (err) {
    return { success: false, message: err.message || 'Gagal mengarsipkan artikel.' };
  }
}

function getPhotoUploadFolder_() {
  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty('PHOTO_UPLOAD_FOLDER_ID');
  if (savedId) {
    try { return DriveApp.getFolderById(savedId); } catch (e) {}
  }

  var folderName = 'KCH Sales Monitoring Photos';
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  props.setProperty('PHOTO_UPLOAD_FOLDER_ID', folder.getId());
  return folder;
}

function createUploadedPhotoFile_(payload, kind, salesId, dateStr) {
  var dataUrl = String(payload.imageDataUrl || '');
  var match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error('File foto tidak valid. Pilih file gambar JPG, PNG, WEBP, atau GIF.');

  var bytes = Utilities.base64Decode(match[2]);
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
    throw new Error('Ukuran foto setelah kompresi harus maksimal 5 MB.');
  }

  var mimeType = match[1].toLowerCase();
  var extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
  var safeSalesId = String(salesId).replace(/[^a-zA-Z0-9_-]/g, '_');
  var fileName = kind + '_' + safeSalesId + '_' + dateStr + '_' + Utilities.getUuid().slice(0, 8) + '.' + extension;
  var blob = Utilities.newBlob(bytes, mimeType, fileName);
  var file = getPhotoUploadFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file;
}

// Validate new uploads strictly; legacy date normalization elsewhere remains unchanged.
function validatePhotoUploadDate_(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0,4) === '0000') {
    throw new Error('Tanggal tidak valid. Gunakan format YYYY-MM-DD.');
  }
  var parsed = new Date(value + 'T00:00:00Z');
  if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) {
    throw new Error('Tanggal tidak valid. Pilih tanggal yang benar pada kalender.');
  }
  var today = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd');
  if (value > today) throw new Error('Tanggal absensi atau kunjungan tidak boleh melebihi hari ini (WIB).');
  return value;
}

function saveSalesPhotoUpload_(payload, photoType) {
  if (!payload || typeof payload.imageDataUrl !== 'string' || payload.imageDataUrl.length > 7 * 1024 * 1024) {
    return {success:false,terminal:true,state:'FAILED',message:'Foto tidak valid atau terlalu besar.'};
  }
  var request = Object.assign({}, payload, {photoType:String(photoType || '').toLowerCase()});
  return txExecuteRequest_(request, 'PHOTO');
}

// The photo row, audit entry and COMMITTED receipt share one atomic Sheets batch.
// A Drive file is only discarded after a definite batch rejection, never on timeout.
function photoUploadPlan_(ctx, meta, payload, user, id, requestId) {
  var type = payload.photoType;
  if (type !== 'attendance' && type !== 'visit') throw new Error('Jenis foto tidak dikenali.');
  var now = new Date(), date = validatePhotoUploadDate_(payload.date, now);
  if (typeof archiveAssertOpenDate_ === 'function') archiveAssertOpenDate_(date);
  var salesId = String(payload.salesId || '').trim(), notes = String(payload.notes || '').trim();
  if (!salesId || !notes || !payload.imageDataUrl) throw new Error('Sales ID, tanggal, keterangan, dan foto wajib diisi.');
  if (notes.length > 2000) throw new Error('Keterangan maksimal 2000 karakter.');
  var name = type === 'attendance' ? 'ATTENDANCE' : 'VISIT_PHOTOS';
  if (!meta[name]) throw new Error('Sheet ' + name + ' tidak ditemukan. Jalankan Perbarui Seluruh Sheet.');
  var raw = txRead_(ctx, ['SALES',name].concat(meta.ACTIVITY_LOGS ? ['ACTIVITY_LOGS'] : []));
  var sales = txUnique_(txTable_('SALES',raw.SALES,['sales_id','full_name','team_name','status'],false).rows,function(row){return normalizeKey_(row.sales_id)===normalizeKey_(salesId);},'Sales');
  if (!txActive_(sales)) throw new Error('Profil sales tidak aktif.');
  var table = txTable_(name,raw[name],TABLE_SCHEMAS[name],true), requests = [];
  if (meta.ACTIVITY_LOGS) txTable_('ACTIVITY_LOGS',raw.ACTIVITY_LOGS,TABLE_SCHEMAS.ACTIVITY_LOGS,true);
  else txAddSheet_(meta,requests,'ACTIVITY_LOGS',TABLE_SCHEMAS.ACTIVITY_LOGS,false);
  var time = Utilities.formatDate(now,TIMEZONE,'HH:mm:ss'), stamp = Utilities.formatDate(now,TIMEZONE,'yyyy-MM-dd HH:mm:ss');
  var file = createUploadedPhotoFile_(payload,type,sales.sales_id,date), url = file.getUrl(), fileId = file.getId();
  var values = type === 'attendance' ? {
    sales_id:sales.sales_id,sales_name:sales.full_name,team_name:sales.team_name,date:date,time:time,
    photo_url:url,status:'Hadir Tepat Waktu',location:sales.area || '',notes:notes
  } : {
    visit_id:id,visit_date:date,visit_time:time,sales_id:sales.sales_id,sales_name:sales.full_name,
    team_name:sales.team_name,area:sales.area || '',photo_url:url,notes:notes,status:'ACTIVE'
  };
  requests.push(txAppend_(meta[name].sheetId,[table.headers.map(function(h){return Object.prototype.hasOwnProperty.call(values,h)?values[h]:'';})]));
  requests.push(txAppend_(meta.ACTIVITY_LOGS.sheetId,[['AUD-'+Utilities.getUuid(),stamp,user.email,'UPLOAD_'+type.toUpperCase(),id,JSON.stringify({salesId:sales.sales_id,date:date,actorRole:user.role,assisted:user.role==='ADMIN'})]]));
  return {requests:requests,cleanupFileId:fileId,plan:{operation:'PHOTO',type:type,date:date,salesId:sales.sales_id,photoFileId:fileId},result:{
    success:true,terminal:true,state:'COMMITTED',operation:'PHOTO',transactionId:id,requestId:requestId,type:type,date:date,
    photoUrl:formatDrivePhotoUrl_(url),message:type==='attendance'?'Foto absensi berhasil disimpan.':'Foto kunjungan berhasil disimpan.'
  }};
}

function saveSalesTransaction_(payload) {
  return saveSalesTransactionAtomic_(payload);
}

function getTransactionsPaginated_(page, limit, searchKeyword, teamFilter, distFilter, dateFilter) {
  try {
    SpreadsheetApp.flush();
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;
    searchKeyword = (searchKeyword || '').toLowerCase().trim();
    teamFilter = teamFilter || 'ALL';
    distFilter = distFilter || 'ALL';
    dateFilter = (dateFilter || '').trim();

    var legacyMap = {
      'TEAM-01': 'Canvasser',
      'TEAM-02': 'MOTORIS',
      'TEAM-03': 'MOTORIS ULTIMATE',
      'TEAM-04': 'SPG KELONTONG',
      'CANVASSER': 'Canvasser',
      'ASISTEN CANVASSER': 'Junior Canvasser'
    };

    var txData = getSheetData_('SALES_TRANSACTIONS').rows;
    var invoiceMap = {};
    var invoiceOrder = [];

    for (var i = txData.length - 1; i >= 0; i--) {
      var row = txData[i];
      var txId = String(row.transaction_id || '').trim();
      if (!txId) continue;

      var teamName = row.team_name || 'Canvasser';
      var rowTeamNorm = normalizeKey_(teamName);
      if (legacyMap[rowTeamNorm]) rowTeamNorm = legacyMap[rowTeamNorm];

      var distributor = row.distributor || 'PT. Global Mitra Prima (Subdist)';
      var salesName = row.sales_name || row.sales_id;
      var subSales = parseCleanNumber_(row.subtotal_sales || row.total_sales);
      var subCost = parseCleanNumber_(row.subtotal_cost || row.total_cost);
      var subShj = (row.subtotal_shj !== undefined && row.subtotal_shj !== '') ? parseCleanNumber_(row.subtotal_shj) : (subSales - subCost);

      if (teamFilter !== 'ALL') {
        var filterNorm = normalizeKey_(teamFilter);
        if (legacyMap[filterNorm]) filterNorm = legacyMap[filterNorm];
        if (rowTeamNorm !== filterNorm) continue;
      }
      if (dateFilter && row.transaction_date !== dateFilter) continue;
      if (!dateFilter && typeof archiveEnabled_ === 'function' && archiveEnabled_() && normalizeDateString_(row.transaction_date).slice(0,7)!==archiveMonth_()) continue;

      if (searchKeyword) {
        var matchId = txId.toLowerCase().indexOf(searchKeyword) > -1;
        var matchSales = (salesName || '').toLowerCase().indexOf(searchKeyword) > -1;
        var matchTeam = (teamName || '').toLowerCase().indexOf(searchKeyword) > -1;
        var matchDist = (distributor || '').toLowerCase().indexOf(searchKeyword) > -1;
        var matchProd = (row.product_name || row.product_id || '').toLowerCase().indexOf(searchKeyword) > -1;
        if (!matchId && !matchSales && !matchTeam && !matchDist && !matchProd) continue;
      }

      if (!invoiceMap[txId]) {
        invoiceMap[txId] = {
          id: txId,
          archived: typeof archiveEnabled_ === 'function' && archiveEnabled_() && normalizeDateString_(row.transaction_date).slice(0,7)<archiveMonth_(),
          date: row.transaction_date,
          salesId: row.sales_id,
          salesName: salesName,
          teamName: teamName,
          distributor: distributor,
          distributors: [distributor],
          totalSales: subSales,
          totalCost: subCost,
          totalShj: subShj,
          notes: row.notes || '-',
          createdAt: row.created_at || ''
        };
        invoiceOrder.push(txId);
      } else {
        if (invoiceMap[txId].distributors.indexOf(distributor) < 0) invoiceMap[txId].distributors.push(distributor);
        if (invoiceMap[txId].distributors.length > 1) invoiceMap[txId].distributor = 'Campuran';
        invoiceMap[txId].totalSales += subSales;
        invoiceMap[txId].totalCost += subCost;
        invoiceMap[txId].totalShj += subShj;
      }
    }

    var filtered = invoiceOrder.map(function(id) { return invoiceMap[id]; }).filter(function(invoice) { return distFilter === 'ALL' || invoice.distributors.some(function(d) { return normalizeKey_(d) === normalizeKey_(distFilter); }); });
    var grandTotalSales = filtered.reduce(function(sum, item) { return sum + item.totalSales; }, 0);
    var grandTotalCost = filtered.reduce(function(sum, item) { return sum + item.totalCost; }, 0);
    var grandTotalShj = filtered.reduce(function(sum, item) { return sum + item.totalShj; }, 0);

    var totalRows = filtered.length;
    var totalPages = Math.ceil(totalRows / limit) || 1;
    var offset = (page - 1) * limit;
    var pagedRows = filtered.slice(offset, offset + limit);

    return {
      success: true,
      data: pagedRows,
      totalRows: totalRows,
      totalPages: totalPages,
      currentPage: page,
      summary: {
        totalSales: grandTotalSales,
        totalCost: grandTotalCost,
        totalShj: grandTotalShj
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getAllTransactionsForExport_(searchKeyword, teamFilter, distFilter, dateFilter) {
  try {
    SpreadsheetApp.flush();
    var res = getTransactionsPaginated_(1, 999999, searchKeyword, teamFilter, distFilter, dateFilter);
    return {
      success: true,
      data: res.data || [],
      totalSales: res.summary ? res.summary.totalSales : 0,
      totalCost: res.summary ? res.summary.totalCost : 0,
      totalShj: res.summary ? res.summary.totalShj : 0,
      branch: 'Cabang Lhokseumawe',
      exportedAt: Utilities.formatDate(new Date(), TIMEZONE, DATE_FORMAT)
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getTransactionDetail_(transactionId) {
  try {
    SpreadsheetApp.flush();
    var txData = getSheetData_('SALES_TRANSACTIONS').rows;
    var matchingRows = txData.filter(function(r) {
      return String(r.transaction_id || '').trim() === String(transactionId).trim();
    });

    if (matchingRows.length === 0) {
      return { success: false, message: 'Faktur tidak ditemukan!' };
    }

    var first = matchingRows[0];
    var totalSales = 0;
    var totalCost = 0;
    var totalShj = 0;
    var items = [];

    matchingRows.forEach(function(m) {
      var qty = parseInt(m.quantity, 10) || 1;
      var cPrice = parseCleanNumber_(m.cost_price);
      var sPrice = parseCleanNumber_(m.selling_price);
      var shjVal = (m.shj !== undefined && m.shj !== '') ? parseCleanNumber_(m.shj) : (sPrice - cPrice);

      var subSales = parseCleanNumber_(m.subtotal_sales) || (sPrice * qty);
      var subCost = parseCleanNumber_(m.subtotal_cost) || (cPrice * qty);
      var subShj = parseCleanNumber_(m.subtotal_shj) || (shjVal * qty);

      totalSales += subSales;
      totalCost += subCost;
      totalShj += subShj;

      items.push({
        sourceType: m.stock_source || 'DIRECT',
        distributorId: m.stock_distributor_id || '',
        distributor: m.distributor || '',
        productId: m.product_id || '-',
        productName: m.product_name || m.product_id || '-',
        qty: qty,
        costPrice: cPrice,
        sellingPrice: sPrice,
        shj: shjVal,
        subtotalSales: subSales,
        subtotalCost: subCost,
        subtotalShj: subShj
      });
    });

    var header = {
      id: first.transaction_id,
      date: first.transaction_date,
      salesName: first.sales_name || first.sales_id,
      teamName: first.team_name,
      distributor: matchingRows.some(function(row) { return row.distributor !== first.distributor; }) ? 'Campuran — lihat sumber per produk' : (first.distributor || 'PT. Global Mitra Prima (Subdist)'),
      totalSales: totalSales,
      totalCost: totalCost,
      totalShj: totalShj,
      notes: first.notes || '-',
      createdBy: first.created_by || 'ryan',
      createdAt: first.created_at || '-'
    };

    return {
      success: true,
      header: header,
      items: items
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getMonthlyTeamReport_(reportMonth, salesId) {
  try {
    reportMonth = String(reportMonth || '').trim();
    salesId = String(salesId || '').trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(reportMonth)) {
      return { success: false, message: 'Pilih bulan laporan yang valid.' };
    }
    if (!salesId) return { success: false, message: 'Pilih sales terlebih dahulu.' };

    var salesRows = getSheetData_('SALES').rows;
    var selectedSales = null;
    for (var s = 0; s < salesRows.length; s++) {
      if (normalizeKey_(salesRows[s].sales_id) === normalizeKey_(salesId)) {
        selectedSales = salesRows[s];
        break;
      }
    }

    var totals = { sales: 0, shj: 0 };
    var workDates = getAttendanceWorkDatesBySales_(reportMonth)[normalizeKey_(salesId)] || {};
    var productMap = {};
    var txRows = getSheetData_('SALES_TRANSACTIONS').rows;

    txRows.forEach(function(row) {
      if (normalizeKey_(row.sales_id) !== normalizeKey_(salesId)) return;
      var date = normalizeDateString_(row.transaction_date);
      if (!date || date.slice(0, 7) !== reportMonth) return;

      var qty = parseInt(row.quantity, 10) || 0;
      var unitCost = parseCleanNumber_(row.cost_price);
      var unitSales = parseCleanNumber_(row.selling_price);
      var unitShj = (row.shj !== undefined && row.shj !== '')
        ? parseCleanNumber_(row.shj)
        : unitSales - unitCost;
      var salesAmount = (row.subtotal_sales !== undefined && row.subtotal_sales !== '')
        ? parseCleanNumber_(row.subtotal_sales)
        : unitSales * qty;
      var shjAmount = (row.subtotal_shj !== undefined && row.subtotal_shj !== '')
        ? parseCleanNumber_(row.subtotal_shj)
        : unitShj * qty;

      totals.sales += salesAmount;
      totals.shj += shjAmount;

      var productId = String(row.product_id || '').trim();
      var productName = String(row.product_name || productId || 'Produk tanpa nama').trim();
      var key = normalizeKey_(productId || productName);
      if (!productMap[key]) {
        productMap[key] = {
          productId: productId || '-',
          productName: productName,
          quantity: 0,
          totalSales: 0,
          totalShj: 0
        };
      }
      productMap[key].quantity += qty;
      productMap[key].totalSales += salesAmount;
      productMap[key].totalShj += shjAmount;
    });

    var products = Object.keys(productMap).map(function(key) { return productMap[key]; });
    products.sort(function(a, b) {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      if (b.totalSales !== a.totalSales) return b.totalSales - a.totalSales;
      return a.productName.localeCompare(b.productName);
    });

    var teamName = selectedSales ? (selectedSales.team_name || '') : '';
    var rawTarget = selectedSales ? (selectedSales.target_monthly || selectedSales.target_amount || 0) : 0;
    var targetMonthly = getIndividualMonthlyTarget_(teamName, rawTarget);
    var reportRows = products.length ? products : [{
      productId: '', productName: 'Belum ada transaksi produk', quantity: 0, totalSales: 0, totalShj: 0
    }];
    var sheetRows = reportRows.map(function(product, index) {
      return [
        reportMonth,
        salesId,
        selectedSales ? selectedSales.full_name : (txRows.find(function(row) { return normalizeKey_(row.sales_id) === normalizeKey_(salesId); }) || {}).sales_name || salesId,
        teamName,
        selectedSales ? (selectedSales.area || '') : '',
        totals.sales,
        totals.shj,
        Object.keys(workDates).length,
        products.length ? index + 1 : 0,
        product.productId,
        product.productName,
        product.quantity,
        product.totalSales,
        product.totalShj
      ];
    });

    if (getCurrentUserInfo_().role !== 'GUEST' && !(typeof archiveEnabled_ === 'function' && archiveEnabled_() && reportMonth < archiveMonth_())) {
      var lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        if (typeof archivePendingGuard_ === 'function') archivePendingGuard_();
        var reportSheet = setupMonthlyTeamReportSheet_();
        var existing = getSheetData_('MONTHLY_TEAM_REPORT').rows;
        var retainedRows = existing.filter(function(row) {
          return !(String(row.report_month || '').trim() === reportMonth && normalizeKey_(row.sales_id) === normalizeKey_(salesId));
        }).map(function(row) {
          return MONTHLY_TEAM_REPORT_HEADERS.map(function(header) {
            if (['total_sales', 'total_shj', 'total_hk', 'product_rank', 'quantity_sold', 'product_sales', 'product_shj'].indexOf(header) > -1) {
              return parseCleanNumber_(row[header]);
            }
            return row[header] === undefined ? '' : row[header];
          });
        });
        var output = retainedRows.concat(sheetRows);
        var oldDataRows = Math.max(0, reportSheet.getLastRow() - 1);
        if (oldDataRows > 0) reportSheet.getRange(2, 1, oldDataRows, MONTHLY_TEAM_REPORT_HEADERS.length).clearContent();
        if (output.length) reportSheet.getRange(2, 1, output.length, MONTHLY_TEAM_REPORT_HEADERS.length).setValues(output);
        if (output.length) {
          reportSheet.getRange(2, 6, output.length, 2).setNumberFormat('"Rp" #,##0');
          reportSheet.getRange(2, 13, output.length, 2).setNumberFormat('"Rp" #,##0');
          reportSheet.getRange(2, 8, output.length, 2).setNumberFormat('#,##0');
          reportSheet.getRange(2, 12, output.length, 1).setNumberFormat('#,##0');
        }
        SpreadsheetApp.flush();
      } finally {
        lock.releaseLock();
      }
    }

    return {
      success: true,
      reportMonth: reportMonth,
      sales: {
        salesId: salesId,
        salesName: selectedSales ? selectedSales.full_name : salesId,
        teamName: teamName,
        area: selectedSales ? (selectedSales.area || '') : '',
        targetMonthly: targetMonthly,
        achievementPercent: targetMonthly > 0 ? totals.sales / targetMonthly * 100 : 0
      },
      summary: {
        totalSales: totals.sales,
        totalShj: totals.shj,
        totalHK: Object.keys(workDates).length,
        productCount: products.length
      },
      products: products
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Jalankan fungsi ini sekali dari editor Apps Script untuk meminta izin Drive
 * sebelum memakai fitur unggah foto dari webapp.
 */
function authorizePhotoUploadDrive_() {
  getPhotoUploadFolder_();
  return 'Akses Google Drive sudah diotorisasi dan folder unggahan siap digunakan.';
}
