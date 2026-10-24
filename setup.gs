/**
 * KALBE CONSUMER HEALTH - SALES MONITORING SYSTEM (CABANG LHOKSEUMAWE)
 * File: setup.gs
 * Database Optimization: Unified Transaction Table & Dynamic Working Days (HK)
 * Features:
 *  - Added Table HOLIDAYS (date, holiday_name) for National & Local Holidays
 *  - Dynamic Working Days: Automatic calendar month minus Sundays and HOLIDAYS
 *  - Unified Table: SALES_TRANSACTIONS (sales_name, shj, subtotal_shj, created_at)
 *  - Safe Lock: Anti-Reset Price Master & Inventory
 * Author: ZettBOT by Zettbos
 */

var KCH_CONFIG = {
  BRANCH_NAME: 'Cabang Lhokseumawe',
  TIMEZONE: 'Asia/Jakarta',
  DATE_FORMAT: 'dd/MM/yyyy HH:mm:ss'
};

var LEGACY_TEAM_MAP = {
  'TEAM-01': 'Canvasser',
  'TEAM-02': 'Motoris',
  'TEAM-03': 'Motoris Ultimate',
  'TEAM-04': 'SPG Kelontong',
  'CANVASSER': 'Canvasser',
  'ASISTEN CANVASSER': 'Junior Canvasser'
};

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

var TABLE_SCHEMAS = {
  USERS: [
    'username', 'password_hash', 'full_name', 
    'role', 'team_name', 'status', 'created_at'
  ],
  DISTRIBUTORS: [
    'distributor_id', 'distributor_name', 'distributor_type', 'status'
  ],
  SALES: [
    'sales_id', 'full_name', 'team_name', 'area', 'target_monthly',
    'phone', 'email', 'photo_url', 'status'
  ],
  PRODUCTS: [
    'product_id', 'product_name', 'category', 'unit', 
    'brand', 'min_stock', 'status'
  ],
  PRICE_MASTER: [
    'product_id', 'product_name', 'unit', 'team_name', 
    'cost_price', 'selling_price', 'shj', 'status'
  ],
  SALES_TRANSACTIONS: [
    'transaction_id', 'transaction_date', 'sales_id', 'sales_name', 'team_name', 'distributor',
    'product_id', 'product_name', 'quantity', 'cost_price', 'selling_price', 'shj',
    'subtotal_sales', 'subtotal_cost', 'subtotal_shj',
    'notes', 'created_by', 'created_at'
  ],
  ATTENDANCE: [
    'sales_id', 'sales_name', 'team_name', 'date', 
    'time', 'photo_url', 'status', 'location', 'notes'
  ],
  INVENTORY: [
    'product_id', 'product_name',
    'PT. Global Mitra Prima', 'AP. Geubrina Rizki'
  ],
  INVENTORY_MOVEMENTS: [
    'date', 'product_id', 
    'movement_type', 'quantity', 'stock_before', 'stock_after', 
    'reference_id', 'created_by', 'created_at'
  ],
  HOLIDAYS: [
    'date', 'holiday_name'
  ],
  FILES: [
    'file_name', 'category', 'drive_url', 'update_date'
  ],
  KCH_NEWS: [
    'news_id', 'publish_date', 'title', 'summary', 'banner_text', 'image_url', 'news_url', 'status', 'article_content', 'banner_kicker', 'banner_subtitle'
  ],
  VISIT_PHOTOS: [
    'visit_id', 'visit_date', 'visit_time', 'sales_id', 'sales_name', 'team_name', 'area', 'photo_url', 'notes', 'status'
  ],
  ACTIVITY_LOGS: [
    'log_id', 'timestamp', 'username', 'action', 
    'target_ref', 'details'
  ],
  WEEKLY_MEETINGS: [
    'meeting_id', 'meeting_date', 'title', 'summary', 'decisions', 'follow_up',
    'status', 'created_by', 'created_at', 'updated_at'
  ],
  SETTINGS: [
    'setting_key', 'setting_value'
  ]
};

var MONTHLY_TEAM_REPORT_HEADERS = [
  'report_month', 'sales_id', 'sales_name', 'team_name', 'area',
  'total_sales', 'total_shj', 'total_hk', 'product_rank',
  'product_id', 'product_name', 'quantity_sold', 'product_sales', 'product_shj'
];

var TODAY_PLAN_HEADERS = [
  'plan_id', 'plan_date', 'sales_id', 'sales_name', 'team_name', 'area',
  'destination', 'planned_time', 'notes', 'status', 'created_by', 'created_at', 'updated_at'
];

var WEEKLY_MEETING_HEADERS = [
  'meeting_id', 'meeting_date', 'title', 'summary', 'decisions', 'follow_up',
  'status', 'created_by', 'created_at', 'updated_at'
];

function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('⚡ KCH Lhokseumawe')
      .addItem('📅 Siapkan Sheet HOLIDAYS (Libur Nasional/Aceh)', 'setupHolidaysSheet_')
      .addItem('📑 Satukan Transaksi & Item (All-in-One)', 'setupSalesTransactionsUnifiedSheet_')
      .addItem('📊 Siapkan Sheet MONTHLY_TEAM_REPORT', 'setupMonthlyTeamReportSheet_')
      .addItem('🗺 Siapkan Sheet TODAY_PLAN', 'setupTodayPlanSheet_')
      .addItem('📝 Siapkan Sheet WEEKLY_MEETINGS', 'setupWeeklyMeetingsSheet_')
      .addItem('🗑 Hapus Sheet SALES PROFILES', 'deleteSalesProfilesSheet_')
      .addItem('⚡ Gabungkan & Selaraskan Sheet SALES (All-in-One)', 'consolidateSalesSheetStructure_')
      .addItem('📁 Rapikan & Sinkronkan Sheet FILES (4 Kolom)', 'setupFilesSheet_')
      .addItem('📰 Siapkan Sheet KCH_NEWS', 'setupKchNewsSheet_')
      .addItem('💲 Format & Kunci Harga di PRICE_MASTER (Anti-Reset)', 'setupPriceMasterSheetStructure_')
      .addItem('🏢 Siapkan & Sinkronkan Sheet DISTRIBUTORS', 'setupDistributorsSheet_')
      .addItem('📦 Format & Sinkronkan INVENTORY', 'setupInventorySheetStructure_')
      .addItem('📋 Format & Siapkan Sheet ATTENDANCE', 'setupAttendanceSheetForManualInput_')
      .addItem('📷 Siapkan Sheet VISIT_PHOTOS', 'setupVisitPhotosSheet_')
      .addItem('🔄 Sinkronkan Nama & Tim di Sheet ATTENDANCE', 'syncAttendanceSalesDetails_')
      .addItem('🖼 Buka Akses & Konversi Foto GDrive di ATTENDANCE', 'convertAndAuthorizeDrivePhotosInAttendance_')
      .addItem('🛠 Perbarui & Rapikan Seluruh Database Spreadsheet', 'repairAndOptimizeSpreadsheet_')
      .addItem('🗑 Hapus Sheet Usang & Kolom Duplikat', 'purgeObsoleteColumnsAndSheets_')
      .addItem('📦 Sinkronkan Produk ke INVENTORY', 'syncProductsToInventory_')
      .addItem('💲 Sinkronkan Produk ke PRICE_MASTER', 'syncProductsToPriceMaster_')
      .addItem('🧹 Hapus Semua Dropdown di Seluruh Sheet', 'removeAllSheetDropdowns_')
      .addToUi();
  } catch (e) {}
}

function setupMonthlyTeamReportSheet_() {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName('MONTHLY_TEAM_REPORT');
  if (!sheet) sheet = ss.insertSheet('MONTHLY_TEAM_REPORT');

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, MONTHLY_TEAM_REPORT_HEADERS.length)
      .setValues([MONTHLY_TEAM_REPORT_HEADERS])
      .setFontWeight('bold')
      .setBackground('#0c1e33')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  } else {
    var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var matches = MONTHLY_TEAM_REPORT_HEADERS.every(function(header, i) {
      return String(currentHeaders[i] || '').trim() === header;
    });
    if (!matches) throw new Error('Header MONTHLY_TEAM_REPORT tidak sesuai. Data sheet tidak diubah.');
  }

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 220);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidth(5, 150);
  sheet.setColumnWidth(6, 150);
  sheet.setColumnWidth(7, 150);
  sheet.setColumnWidth(8, 100);
  sheet.setColumnWidth(9, 110);
  sheet.setColumnWidth(10, 140);
  sheet.setColumnWidth(11, 240);
  sheet.setColumnWidth(12, 120);
  sheet.setColumnWidth(13, 150);
  sheet.setColumnWidth(14, 150);
  SpreadsheetApp.flush();
  return sheet;
}

function setupTodayPlanSheet_() {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName('TODAY_PLAN');
  if (!sheet) sheet = ss.insertSheet('TODAY_PLAN');

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, TODAY_PLAN_HEADERS.length)
      .setValues([TODAY_PLAN_HEADERS])
      .setFontWeight('bold')
      .setBackground('#0c1e33')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
  } else {
    var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var matches = TODAY_PLAN_HEADERS.every(function(header, i) {
      return String(currentHeaders[i] || '').trim() === header;
    });
    if (!matches) throw new Error('Header TODAY_PLAN tidak sesuai. Data sheet tidak diubah.');
  }

  sheet.setFrozenRows(1);
  [190, 120, 170, 210, 150, 150, 280, 120, 300, 110, 150, 180, 180].forEach(function(width, i) {
    sheet.setColumnWidth(i + 1, width);
  });
  SpreadsheetApp.flush();
  return sheet;
}

function setupWeeklyMeetingsSheet_() {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName('WEEKLY_MEETINGS');
  if (!sheet) sheet = ss.insertSheet('WEEKLY_MEETINGS');

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, WEEKLY_MEETING_HEADERS.length)
      .setValues([WEEKLY_MEETING_HEADERS])
      .setFontWeight('bold')
      .setBackground('#0c1e33')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
  } else {
    var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var matches = WEEKLY_MEETING_HEADERS.every(function(header, i) {
      return String(currentHeaders[i] || '').trim() === header;
    });
    if (!matches) throw new Error('Header WEEKLY_MEETINGS tidak sesuai. Data sheet tidak diubah.');
  }

  sheet.setFrozenRows(1);
  [190, 120, 240, 420, 360, 360, 110, 170, 180, 180].forEach(function(width, i) {
    sheet.setColumnWidth(i + 1, width);
  });
  SpreadsheetApp.flush();
  return sheet;
}

function setupHolidaysSheet_() {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName('HOLIDAYS');
  var expectedHeaders = TABLE_SCHEMAS.HOLIDAYS;

  if (!sheet) {
    sheet = ss.insertSheet('HOLIDAYS');
  }

  var defaultHolidays = [
    ['2026-08-15', 'Hari Damai Aceh (MoU Helsinki)'],
    ['2026-12-26', 'Peringatan Tsunami Aceh']
  ];

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    clearSheetValidations_(sheet);
    sheet.clear();
    sheet.getRange(1, 1, 1, expectedHeaders.length)
      .setValues([expectedHeaders])
      .setFontWeight('bold')
      .setBackground('#0c1e33')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);

    sheet.getRange(2, 1, defaultHolidays.length, expectedHeaders.length).setValues(defaultHolidays);
    sheet.getRange(2, 1, defaultHolidays.length, 1).setHorizontalAlignment('center');
  } else {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  }

  sheet.setColumnWidth(1, 160); // date
  sheet.setColumnWidth(2, 360); // holiday_name

  SpreadsheetApp.flush();
  try {
    ss.toast('Sheet HOLIDAYS siap digunakan! Silakan tambahkan tanggal merah nasional dan libur daerah.', 'Sukses', 5);
  } catch (e) {}
}

function deleteSalesProfilesSheet_() {
  var ss = getKchSpreadsheet_();
  var allSheets = ss.getSheets();
  var deletedCount = 0;

  allSheets.forEach(function(sh) {
    var name = sh.getName().trim();
    var norm = name.toUpperCase().replace(/[\s_-]+/g, '');
    if (norm.indexOf('SALESPROFIL') > -1 || 
        norm.indexOf('PROFILSALES') > -1 || 
        norm === 'SALESPROFILES' || 
        norm === 'SALESPROFILE' || 
        norm === 'SALESPROFIL') {
      try {
        ss.deleteSheet(sh);
        deletedCount++;
      } catch (err) {}
    }
  });

  SpreadsheetApp.flush();
  try {
    if (deletedCount > 0) {
      ss.toast('Berhasil menghapus sheet SALES PROFILES (' + deletedCount + ' sheet). Database kini tersentralisasi di sheet SALES.', 'Sukses', 5);
    }
  } catch (e) {}
}

function setupSalesTransactionsUnifiedSheet_() {
  var ss = getKchSpreadsheet_();
  var txSheet = ss.getSheetByName('SALES_TRANSACTIONS');
  var itemsSheet = ss.getSheetByName('SALES_TRANSACTION_ITEMS');
  var salesSheet = ss.getSheetByName('SALES');
  var prodSheet = ss.getSheetByName('PRODUCTS');

  if (!txSheet) {
    txSheet = ss.insertSheet('SALES_TRANSACTIONS');
  }

  var salesNameMap = {};
  if (salesSheet && salesSheet.getLastRow() > 1) {
    var sH = salesSheet.getRange(1, 1, 1, salesSheet.getLastColumn()).getDisplayValues()[0];
    var sIdIdx = sH.indexOf('sales_id');
    var sNameIdx = sH.indexOf('full_name');
    if (sIdIdx !== -1 && sNameIdx !== -1) {
      var sRows = salesSheet.getRange(2, 1, salesSheet.getLastRow() - 1, sH.length).getDisplayValues();
      for (var s = 0; s < sRows.length; s++) {
        var sid = String(sRows[s][sIdIdx] || '').trim().toUpperCase();
        if (sid) salesNameMap[sid] = String(sRows[s][sNameIdx] || '').trim();
      }
    }
  }

  var prodNameMap = {};
  if (prodSheet && prodSheet.getLastRow() > 1) {
    var pH = prodSheet.getRange(1, 1, 1, prodSheet.getLastColumn()).getDisplayValues()[0];
    var pIdIdx = pH.indexOf('product_id');
    var pNameIdx = pH.indexOf('product_name');
    if (pIdIdx !== -1 && pNameIdx !== -1) {
      var pRows = prodSheet.getRange(2, 1, prodSheet.getLastRow() - 1, pH.length).getDisplayValues();
      for (var p = 0; p < pRows.length; p++) {
        var pid = String(pRows[p][pIdIdx] || '').trim().toUpperCase();
        if (pid) prodNameMap[pid] = String(pRows[p][pNameIdx] || '').trim();
      }
    }
  }

  var txHeaderMap = {};
  var txLastR = txSheet.getLastRow();
  var txLastC = txSheet.getLastColumn();

  if (txLastR > 1 && txLastC > 0) {
    var txH = txSheet.getRange(1, 1, 1, txLastC).getDisplayValues()[0];
    var colMap = {};
    for (var th = 0; th < txH.length; th++) {
      colMap[String(txH[th] || '').trim().toLowerCase()] = th;
    }

    var txData = txSheet.getRange(2, 1, txLastR - 1, txLastC).getDisplayValues();
    for (var tr = 0; tr < txData.length; tr++) {
      var row = txData[tr];
      var txId = colMap['transaction_id'] !== undefined ? String(row[colMap['transaction_id']] || '').trim() : '';
      if (!txId) continue;

      var sId = colMap['sales_id'] !== undefined ? String(row[colMap['sales_id']] || '').trim() : '';
      var sName = colMap['sales_name'] !== undefined ? String(row[colMap['sales_name']] || '').trim() : '';
      if (!sName && salesNameMap[sId.toUpperCase()]) sName = salesNameMap[sId.toUpperCase()];

      var teamVal = colMap['team_name'] !== undefined ? String(row[colMap['team_name']] || '').trim() : 'Canvasser';
      var distVal = colMap['distributor'] !== undefined ? String(row[colMap['distributor']] || '').trim() : 'PT. Global Mitra Prima (Subdist)';
      var notesVal = colMap['notes'] !== undefined ? String(row[colMap['notes']] || '').trim() : '';
      var createdByVal = colMap['created_by'] !== undefined ? String(row[colMap['created_by']] || '').trim() : 'ryan';
      var createdAtVal = colMap['created_at'] !== undefined ? String(row[colMap['created_at']] || '').trim() : '';

      if (!createdAtVal) {
        createdAtVal = Utilities.formatDate(new Date(), KCH_CONFIG.TIMEZONE, KCH_CONFIG.DATE_FORMAT);
      }

      var totSales = colMap['total_sales'] !== undefined ? cleanRawNumber_(row[colMap['total_sales']]) : 0;
      var totCost = colMap['total_cost'] !== undefined ? cleanRawNumber_(row[colMap['total_cost']]) : 0;

      var pIdVal = colMap['product_id'] !== undefined ? String(row[colMap['product_id']] || '').trim() : '';
      var pNameVal = colMap['product_name'] !== undefined ? String(row[colMap['product_name']] || '').trim() : '';
      var qtyVal = colMap['quantity'] !== undefined ? cleanRawNumber_(row[colMap['quantity']]) : 1;
      var cPriceVal = colMap['cost_price'] !== undefined ? cleanRawNumber_(row[colMap['cost_price']]) : totCost;
      var sPriceVal = colMap['selling_price'] !== undefined ? cleanRawNumber_(row[colMap['selling_price']]) : totSales;
      var shjVal = colMap['shj'] !== undefined ? cleanRawNumber_(row[colMap['shj']]) : (sPriceVal - cPriceVal);
      var subSalesVal = colMap['subtotal_sales'] !== undefined ? cleanRawNumber_(row[colMap['subtotal_sales']]) : totSales;
      var subCostVal = colMap['subtotal_cost'] !== undefined ? cleanRawNumber_(row[colMap['subtotal_cost']]) : totCost;
      var subShjVal = colMap['subtotal_shj'] !== undefined ? cleanRawNumber_(row[colMap['subtotal_shj']]) : (shjVal * qtyVal);

      if (!txHeaderMap[txId]) {
        txHeaderMap[txId] = {
          date: colMap['transaction_date'] !== undefined ? String(row[colMap['transaction_date']] || '').trim() : '',
          salesId: sId,
          salesName: sName,
          teamName: teamVal,
          distributor: distVal,
          notes: notesVal,
          createdBy: createdByVal,
          createdAt: createdAtVal,
          totalSales: totSales,
          totalCost: totCost,
          existingItems: []
        };
      }

      if (pIdVal) {
        txHeaderMap[txId].existingItems.push({
          productId: pIdVal,
          productName: pNameVal || prodNameMap[pIdVal.toUpperCase()] || pIdVal,
          qty: qtyVal,
          costPrice: cPriceVal,
          sellingPrice: sPriceVal,
          shj: shjVal,
          subtotalSales: subSalesVal,
          subtotalCost: subCostVal,
          subtotalShj: subShjVal
        });
      }
    }
  }

  var itemsByTx = {};
  if (itemsSheet && itemsSheet.getLastRow() > 1 && itemsSheet.getLastColumn() > 0) {
    var itmH = itemsSheet.getRange(1, 1, 1, itemsSheet.getLastColumn()).getDisplayValues()[0];
    var iMap = {};
    for (var ih = 0; ih < itmH.length; ih++) {
      iMap[String(itmH[ih] || '').trim().toLowerCase()] = ih;
    }

    var itmData = itemsSheet.getRange(2, 1, itemsSheet.getLastRow() - 1, itmH.length).getDisplayValues();
    for (var ir = 0; ir < itmData.length; ir++) {
      var iRow = itmData[ir];
      var itmTxId = iMap['transaction_id'] !== undefined ? String(iRow[iMap['transaction_id']] || '').trim() : '';
      var itmPId = iMap['product_id'] !== undefined ? String(iRow[iMap['product_id']] || '').trim() : '';
      if (!itmTxId || !itmPId) continue;

      var itmQty = iMap['quantity'] !== undefined ? cleanRawNumber_(iRow[iMap['quantity']]) : 1;
      var itmCost = iMap['cost_price'] !== undefined ? cleanRawNumber_(iRow[iMap['cost_price']]) : 0;
      var itmSell = iMap['selling_price'] !== undefined ? cleanRawNumber_(iRow[iMap['selling_price']]) : 0;
      var itmSubSales = iMap['subtotal_sales'] !== undefined ? cleanRawNumber_(iRow[iMap['subtotal_sales']]) : (itmSell * itmQty);
      var itmSubCost = iMap['subtotal_cost'] !== undefined ? cleanRawNumber_(iRow[iMap['subtotal_cost']]) : (itmCost * itmQty);
      var itmShj = itmSell - itmCost;
      var itmSubShj = itmShj * itmQty;
      var itmPName = prodNameMap[itmPId.toUpperCase()] || itmPId;

      if (!itemsByTx[itmTxId]) itemsByTx[itmTxId] = [];
      itemsByTx[itmTxId].push({
        productId: itmPId,
        productName: itmPName,
        qty: itmQty,
        costPrice: itmCost,
        sellingPrice: itmSell,
        shj: itmShj,
        subtotalSales: itmSubSales,
        subtotalCost: itmSubCost,
        subtotalShj: itmSubShj
      });
    }
  }

  var consolidatedRows = [];
  var expectedHeaders = TABLE_SCHEMAS.SALES_TRANSACTIONS;

  for (var invoiceId in txHeaderMap) {
    var inv = txHeaderMap[invoiceId];
    var itmList = [];

    if (itemsByTx[invoiceId] && itemsByTx[invoiceId].length > 0) {
      itmList = itemsByTx[invoiceId];
    } else if (inv.existingItems && inv.existingItems.length > 0) {
      itmList = inv.existingItems;
    } else {
      var fallbackShj = inv.totalSales - inv.totalCost;
      itmList.push({
        productId: 'PROD-GENERAL',
        productName: 'Penjualan Produk KCH',
        qty: 1,
        costPrice: inv.totalCost,
        sellingPrice: inv.totalSales,
        shj: fallbackShj,
        subtotalSales: inv.totalSales,
        subtotalCost: inv.totalCost,
        subtotalShj: fallbackShj
      });
    }

    for (var k = 0; k < itmList.length; k++) {
      var item = itmList[k];
      consolidatedRows.push([
        invoiceId,
        inv.date,
        inv.salesId,
        inv.salesName || (salesNameMap[inv.salesId.toUpperCase()] || inv.salesId),
        inv.teamName,
        inv.distributor,
        item.productId,
        item.productName,
        item.qty,
        item.costPrice,
        item.sellingPrice,
        item.shj,
        item.subtotalSales,
        item.subtotalCost,
        item.subtotalShj,
        inv.notes,
        inv.createdBy,
        inv.createdAt
      ]);
    }
  }

  clearSheetValidations_(txSheet);
  txSheet.clear();

  txSheet.getRange(1, 1, 1, expectedHeaders.length)
    .setValues([expectedHeaders])
    .setFontWeight('bold')
    .setBackground('#0c1e33')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  txSheet.setFrozenRows(1);

  if (consolidatedRows.length > 0) {
    txSheet.getRange(2, 1, consolidatedRows.length, expectedHeaders.length).setValues(consolidatedRows);
    txSheet.getRange(2, 1, consolidatedRows.length, 1).setHorizontalAlignment('left');
    txSheet.getRange(2, 2, consolidatedRows.length, 1).setHorizontalAlignment('center');
    txSheet.getRange(2, 3, consolidatedRows.length, 4).setHorizontalAlignment('left');
    txSheet.getRange(2, 7, consolidatedRows.length, 2).setHorizontalAlignment('left');
    txSheet.getRange(2, 9, consolidatedRows.length, 1).setHorizontalAlignment('center');
    
    safeSetNumberFormat_(txSheet.getRange(2, 9, consolidatedRows.length, 1), '0');
    safeSetNumberFormat_(txSheet.getRange(2, 10, consolidatedRows.length, 6), '0');
    txSheet.getRange(2, 10, consolidatedRows.length, 6).setHorizontalAlignment('right');

    txSheet.getRange(2, 16, consolidatedRows.length, 2).setHorizontalAlignment('left');
    txSheet.getRange(2, 18, consolidatedRows.length, 1).setHorizontalAlignment('center');
    safeSetNumberFormat_(txSheet.getRange(2, 18, consolidatedRows.length, 1), 'dd/MM/yyyy HH:mm:ss');
  }

  txSheet.setColumnWidth(1, 175);
  txSheet.setColumnWidth(2, 115);
  txSheet.setColumnWidth(3, 210);
  txSheet.setColumnWidth(4, 180);
  txSheet.setColumnWidth(5, 160);
  txSheet.setColumnWidth(6, 230);
  txSheet.setColumnWidth(7, 120);
  txSheet.setColumnWidth(8, 220);
  txSheet.setColumnWidth(9, 85);
  txSheet.setColumnWidth(10, 115);
  txSheet.setColumnWidth(11, 115);
  txSheet.setColumnWidth(12, 105);
  txSheet.setColumnWidth(13, 130);
  txSheet.setColumnWidth(14, 130);
  txSheet.setColumnWidth(15, 120);
  txSheet.setColumnWidth(16, 180);
  txSheet.setColumnWidth(17, 120);
  txSheet.setColumnWidth(18, 170);

  if (txSheet.getMaxColumns() > expectedHeaders.length) {
    try { txSheet.deleteColumns(expectedHeaders.length + 1, txSheet.getMaxColumns() - expectedHeaders.length); } catch (e) {}
  }

  if (itemsSheet) {
    try { ss.deleteSheet(itemsSheet); } catch (e) {}
  }

  SpreadsheetApp.flush();
}

function consolidateSalesSheetStructure_() {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName('SALES');
  var expectedHeaders = TABLE_SCHEMAS.SALES;

  if (!sheet) {
    sheet = ss.insertSheet('SALES');
  }

  var existingRows = [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow > 1 && lastCol > 0) {
    var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var colMap = {};
    for (var ch = 0; ch < currentHeaders.length; ch++) {
      colMap[String(currentHeaders[ch] || '').trim().toLowerCase()] = ch;
    }

    var rawData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    for (var r = 0; r < rawData.length; r++) {
      var row = rawData[r];
      var sId = colMap['sales_id'] !== undefined ? String(row[colMap['sales_id']] || '').trim() : '';
      if (!sId) continue;

      var fName = colMap['full_name'] !== undefined ? String(row[colMap['full_name']] || '').trim() : '';
      var rawTeam = colMap['team_name'] !== undefined ? String(row[colMap['team_name']] || '').trim() : '';
      var teamName = LEGACY_TEAM_MAP[rawTeam.toUpperCase()] || rawTeam || 'Canvasser';

      var areaVal = colMap['area'] !== undefined ? String(row[colMap['area']] || '').trim() : 'Lhokseumawe';
      var tgtVal = colMap['target_monthly'] !== undefined ? cleanRawNumber_(row[colMap['target_monthly']]) : 0;
      var phoneVal = colMap['phone'] !== undefined ? String(row[colMap['phone']] || '').trim() : '';
      var emailVal = colMap['email'] !== undefined ? String(row[colMap['email']] || '').trim() : '';
      var photoVal = colMap['photo_url'] !== undefined ? String(row[colMap['photo_url']] || '').trim() : '';
      var statusVal = colMap['status'] !== undefined ? String(row[colMap['status']] || '').trim().toUpperCase() : 'ACTIVE';
      if (statusVal !== 'INACTIVE') statusVal = 'ACTIVE';

      existingRows.push([
        sId, fName, teamName, areaVal, tgtVal, phoneVal, emailVal, photoVal, statusVal
      ]);
    }
  }

  // Personil SPR dicatat di SALES hanya untuk absensi. Baris ini ditambahkan
  // sekali saat fungsi pembaruan database dijalankan; tidak menggandakan ID.
  var sprAttendanceOnly = [
    'SPR-BAC-LHOKSEUMAWE',
    'T. Nailul Maulana',
    'SPR',
    'Lhokseumawe',
    0,
    '',
    '',
    '',
    'ACTIVE'
  ];
  var sprAlreadyExists = existingRows.some(function(row) {
    return String(row[0] || '').trim().toUpperCase() === sprAttendanceOnly[0];
  });
  if (!sprAlreadyExists) existingRows.push(sprAttendanceOnly);

  clearSheetValidations_(sheet);
  sheet.clear();

  sheet.getRange(1, 1, 1, expectedHeaders.length)
    .setValues([expectedHeaders])
    .setFontWeight('bold')
    .setBackground('#0c1e33')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  if (existingRows.length > 0) {
    sheet.getRange(2, 1, existingRows.length, expectedHeaders.length).setValues(existingRows);
    safeSetNumberFormat_(sheet.getRange(2, 5, existingRows.length, 1), '0');
  }

  sheet.setColumnWidth(1, 230);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 170);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 150);
  sheet.setColumnWidth(6, 140);
  sheet.setColumnWidth(7, 210);
  sheet.setColumnWidth(8, 250);
  sheet.setColumnWidth(9, 110);

  SpreadsheetApp.flush();
}

function setupInventorySheetStructure_() {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName('INVENTORY');
  var expectedHeaders = TABLE_SCHEMAS.INVENTORY;
  var globalHeader = 'PT. Global Mitra Prima';
  var geubrinaHeader = 'AP. Geubrina Rizki';

  if (!sheet) {
    sheet = ss.insertSheet('INVENTORY');
  }

  var existingRows = [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var inventoryById = {};

  if (lastRow > 1 && lastCol > 0) {
    var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var colMap = {};
    for (var ch = 0; ch < currentHeaders.length; ch++) {
      colMap[String(currentHeaders[ch] || '').trim().toLowerCase()] = ch;
    }

    var rawData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    for (var r = 0; r < rawData.length; r++) {
      var row = rawData[r];
      var pId = colMap.product_id !== undefined ? String(row[colMap.product_id] || '').trim() : '';
      if (!pId) continue;

      inventoryById[pId.toUpperCase()] = {
        name: colMap.product_name !== undefined ? String(row[colMap.product_name] || '').trim() : '',
        globalStock: colMap[globalHeader.toLowerCase()] !== undefined ? distributorStockOrNull_(row[colMap[globalHeader.toLowerCase()]]) : null,
        geubrinaStock: colMap[geubrinaHeader.toLowerCase()] !== undefined ? distributorStockOrNull_(row[colMap[geubrinaHeader.toLowerCase()]]) : null
      };
    }
  }

  // Read the old distributor-stock columns from PRODUCTS before removing them.
  var productsSheet = ss.getSheetByName('PRODUCTS');
  if (productsSheet && productsSheet.getLastRow() > 1 && productsSheet.getLastColumn() > 0) {
    var productHeaders = productsSheet.getRange(1, 1, 1, productsSheet.getLastColumn()).getDisplayValues()[0];
    var productHeaderMap = {};
    productHeaders.forEach(function(header, index) {
      productHeaderMap[String(header || '').trim().toLowerCase()] = index;
    });
    var productIdIndex = productHeaderMap.product_id;
    var productNameIndex = productHeaderMap.product_name;
    var globalIndex = productHeaderMap[globalHeader.toLowerCase()];
    var geubrinaIndex = productHeaderMap[geubrinaHeader.toLowerCase()];
    if (globalIndex === undefined) globalIndex = productHeaderMap.distributor;
    var productValues = productsSheet.getRange(2, 1, productsSheet.getLastRow() - 1, productsSheet.getLastColumn()).getDisplayValues();

    productValues.forEach(function(row) {
      var pId = productIdIndex !== undefined ? String(row[productIdIndex] || '').trim() : '';
      if (!pId) return;
      var existing = inventoryById[pId.toUpperCase()] || {};
      inventoryById[pId.toUpperCase()] = {
        name: existing.name || (productNameIndex !== undefined ? String(row[productNameIndex] || '').trim() : ''),
        globalStock: existing.globalStock !== null && existing.globalStock !== undefined
          ? existing.globalStock
          : (globalIndex !== undefined ? normalizeDistributorStock_(row[globalIndex]) : 500),
        geubrinaStock: existing.geubrinaStock !== null && existing.geubrinaStock !== undefined
          ? existing.geubrinaStock
          : (geubrinaIndex !== undefined ? normalizeDistributorStock_(row[geubrinaIndex]) : 500)
      };
    });
  }

  Object.keys(inventoryById).forEach(function(id) {
    var item = inventoryById[id];
    existingRows.push([
      id,
      item.name || id,
      item.globalStock !== null && item.globalStock !== undefined ? item.globalStock : 500,
      item.geubrinaStock !== null && item.geubrinaStock !== undefined ? item.geubrinaStock : 500
    ]);
  });

  clearSheetValidations_(sheet);
  if (lastRow > 0) {
    sheet.getRange(1, 1, lastRow, expectedHeaders.length).clearContent();
  }
  sheet.getRange(1, 1, 1, expectedHeaders.length)
    .setValues([expectedHeaders])
    .setFontWeight('bold')
    .setBackground('#0c1e33')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  if (existingRows.length > 0) {
    sheet.getRange(2, 1, existingRows.length, expectedHeaders.length).setValues(existingRows);
    safeSetNumberFormat_(sheet.getRange(2, 3, existingRows.length, 2), '#,##0');
  }

  removeLegacyInventoryColumns_(sheet);
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 220);
  sheet.setColumnWidth(4, 220);

  SpreadsheetApp.flush();
}

function removeLegacyInventoryColumns_(sheet) {
  if (!sheet || sheet.getLastColumn() === 0) return;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var obsoleteHeaders = ['current_stock', 'minimum_stock', 'updated_at'];
  var columnsToRemove = [];
  headers.forEach(function(header, index) {
    if (obsoleteHeaders.indexOf(String(header || '').trim().toLowerCase()) !== -1) {
      columnsToRemove.push(index + 1);
    }
  });
  columnsToRemove.sort(function(a, b) { return b - a; }).forEach(function(column) {
    sheet.deleteColumn(column);
  });
}

function normalizeDistributorStock_(value) {
  var text = String(value === null || value === undefined ? '' : value).trim();
  var numericText = text.replace(/[.,\s]/g, '');
  if (numericText === '' || !/^-?\d+$/.test(numericText)) return 500;
  return cleanRawNumber_(text);
}

function distributorStockOrNull_(value) {
  var text = String(value === null || value === undefined ? '' : value).trim();
  var numericText = text.replace(/[.,\s]/g, '');
  if (numericText === '' || !/^-?\d+$/.test(numericText)) return null;
  return cleanRawNumber_(text);
}

function setupPriceMasterSheetStructure_() {
  return syncProductsToPriceMaster_();
}

function setupAttendanceSheetForManualInput_() {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName('ATTENDANCE');
  var expectedHeaders = TABLE_SCHEMAS.ATTENDANCE;

  if (!sheet) {
    sheet = ss.insertSheet('ATTENDANCE');
  }

  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.appendRow(expectedHeaders);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, expectedHeaders.length)
      .setFontWeight('bold')
      .setBackground('#0c1e33')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
  } else {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  }

  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 160);
  sheet.setColumnWidth(4, 110);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 260);
  sheet.setColumnWidth(7, 140);
  sheet.setColumnWidth(8, 200);
  sheet.setColumnWidth(9, 240);

  SpreadsheetApp.flush();
}

function setupVisitPhotosSheet_() {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName('VISIT_PHOTOS');
  var expectedHeaders = TABLE_SCHEMAS.VISIT_PHOTOS;

  if (!sheet) sheet = ss.insertSheet('VISIT_PHOTOS');

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length)
      .setValues([expectedHeaders])
      .setFontWeight('bold')
      .setBackground('#0c1e33')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);

    var dummyRows = [
      ['VIS-DUMMY-001', new Date(), '09:15', 'DUMMY-001', 'Contoh Sales 1', 'Canvasser', 'Lhokseumawe', 'https://placehold.co/640x420/e0f2fe/1d4ed8?text=Foto+Kunjungan+1', 'Kunjungan outlet dan pengecekan display', 'DUMMY'],
      ['VIS-DUMMY-002', new Date(), '10:30', 'DUMMY-002', 'Contoh Sales 2', 'Motoris', 'Bireuen', 'https://placehold.co/640x420/dcfce7/15803d?text=Foto+Kunjungan+2', 'Kunjungan outlet dan pengecekan stok', 'DUMMY'],
      ['VIS-DUMMY-003', new Date(), '13:45', 'DUMMY-003', 'Contoh Sales 3', 'MPR', 'Lhokseumawe', 'https://placehold.co/640x420/fef3c7/b45309?text=Foto+Kunjungan+3', 'Dokumentasi kunjungan pelanggan', 'DUMMY']
    ];
    sheet.getRange(2, 1, dummyRows.length, expectedHeaders.length).setValues(dummyRows);
    sheet.getRange(2, 2, dummyRows.length, 1).setNumberFormat('dd/MM/yyyy');
  } else {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    sheet.setFrozenRows(1);
  }

  [150, 110, 95, 170, 180, 150, 150, 340, 300, 100].forEach(function(width, index) {
    sheet.setColumnWidth(index + 1, width);
  });
  SpreadsheetApp.flush();
  try {
    ss.toast('Sheet VISIT_PHOTOS siap. Ganti baris DUMMY dengan dokumentasi kunjunganmu.', 'Sukses', 5);
  } catch (e) {}
}

function setupDistributorsSheet_() {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName('DISTRIBUTORS');
  var expectedHeaders = TABLE_SCHEMAS.DISTRIBUTORS;

  if (!sheet) {
    sheet = ss.insertSheet('DISTRIBUTORS');
  }

  var defaultDistributors = [
    ['DIST-01', 'PT. Global Mitra Prima (Subdist)', 'Subdist', 'ACTIVE'],
    ['DIST-02', 'AP. Geubrina Rizki (Panel)', 'Panel', 'ACTIVE']
  ];

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    clearSheetValidations_(sheet);
    sheet.clear();
    sheet.getRange(1, 1, 1, expectedHeaders.length)
      .setValues([expectedHeaders])
      .setFontWeight('bold')
      .setBackground('#0c1e33')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);

    sheet.getRange(2, 1, defaultDistributors.length, expectedHeaders.length).setValues(defaultDistributors);
  } else {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  }

  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 280);
  sheet.setColumnWidth(3, 140);
  sheet.setColumnWidth(4, 120);

  SpreadsheetApp.flush();
}

function setupFilesSheet_() {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName('FILES');
  var expectedHeaders = TABLE_SCHEMAS.FILES;

  if (!sheet) {
    sheet = ss.insertSheet('FILES');
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var existingRows = [];
  var todayDateStr = Utilities.formatDate(new Date(), KCH_CONFIG.TIMEZONE, 'dd/MM/yyyy');

  if (lastRow > 1 && lastCol > 0) {
    var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var colMap = {};
    for (var ch = 0; ch < rawHeaders.length; ch++) {
      colMap[String(rawHeaders[ch] || '').trim().toLowerCase()] = ch;
    }

    var rawData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    for (var r = 0; r < rawData.length; r++) {
      var row = rawData[r];
      var fName = colMap['file_name'] !== undefined ? String(row[colMap['file_name']] || '').trim() : '';
      var fCat = colMap['category'] !== undefined ? String(row[colMap['category']] || '').trim() : 'Google Drive';
      var fUrl = colMap['drive_url'] !== undefined ? String(row[colMap['drive_url']] || '').trim() : 'https://drive.google.com';
      var fDate = colMap['update_date'] !== undefined ? String(row[colMap['update_date']] || '').trim() : todayDateStr;

      if (fName || fUrl) {
        existingRows.push([fName || 'Berkas Dokumen', fCat, fUrl, fDate || todayDateStr]);
      }
    }
  }

  if (existingRows.length === 0) {
    existingRows = [
      ['Laporan Bulanan KCH 2026', 'Google Drive', 'https://drive.google.com', todayDateStr],
      ['Panduan Standar Operasional Sales', 'SOP & Matriks Penjualan', 'https://drive.google.com', todayDateStr],
      ['Dokumentasi Absensi & Lapangan', 'Folder Foto Kunjungan & Absensi', 'https://drive.google.com', todayDateStr]
    ];
  }

  clearSheetValidations_(sheet);
  sheet.clear();

  sheet.getRange(1, 1, 1, expectedHeaders.length)
    .setValues([expectedHeaders])
    .setFontWeight('bold')
    .setBackground('#0c1e33')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  sheet.getRange(2, 1, existingRows.length, expectedHeaders.length).setValues(existingRows);
  sheet.setColumnWidth(1, 280);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 350);
  sheet.setColumnWidth(4, 140);

  SpreadsheetApp.flush();
}

function setupKchNewsSheet_() {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName('KCH_NEWS');
  if (!sheet) sheet = ss.insertSheet('KCH_NEWS');

  var expectedHeaders = TABLE_SCHEMAS.KCH_NEWS;
  var lastCol = sheet.getLastColumn();
  var headers = [];
  if (lastCol > 0 && sheet.getLastRow() > 0) {
    headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function(value) {
      return String(value || '').trim();
    });
  }

  if (headers.length === 0 || !headers.some(function(value) { return value; })) {
    headers = expectedHeaders.slice();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    expectedHeaders.forEach(function(header) {
      if (headers.map(function(value) { return value.toLowerCase(); }).indexOf(header.toLowerCase()) === -1) {
        headers.push(header);
      }
    });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#0c1e33')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  if (sheet.getLastRow() <= 1) {
    var seed = {
      news_id: 'NEWS-001',
      publish_date: new Date(2026, 7, 29),
      title: 'Kalbe Perkuat Ekosistem Precision Medicine dan Cell Therapy di Indonesia melalui DBSDLS 2026',
      summary: 'DBSDLS 2026 membahas precision medicine, cell therapy, dan kolaborasi untuk mendorong inovasi terapi di Indonesia.',
      banner_text: 'Precision Medicine & Cell Therapy',
      image_url: '',
      news_url: 'https://www.kalbe.co.id/id/news',
      status: 'ACTIVE'
    };
    var seedRow = headers.map(function(header) {
      var key = String(header || '').trim().toLowerCase();
      return Object.prototype.hasOwnProperty.call(seed, key) ? seed[key] : '';
    });
    sheet.getRange(2, 1, 1, headers.length).setValues([seedRow]);
    var dateColumn = headers.map(function(value) { return String(value).toLowerCase(); }).indexOf('publish_date') + 1;
    if (dateColumn > 0) sheet.getRange(2, dateColumn).setNumberFormat('dd/MM/yyyy');
  }

  var widths = { news_id: 130, publish_date: 120, title: 420, summary: 520, banner_text: 260, image_url: 360, news_url: 360, status: 110, article_content: 640, banner_kicker: 200, banner_subtitle: 300 };
  headers.forEach(function(header, index) {
    var width = widths[String(header || '').trim().toLowerCase()];
    if (width) sheet.setColumnWidth(index + 1, width);
  });
  SpreadsheetApp.flush();
  try { ss.toast('Sheet KCH_NEWS siap digunakan dari menu KCH News di webapp.', 'KCH News', 5); } catch (e) {}
  return { status: 'success', message: 'Sheet KCH_NEWS siap digunakan.' };
}

function syncAttendanceSalesDetails_() {
  var ss = getKchSpreadsheet_();
  var attSheet = ss.getSheetByName('ATTENDANCE');
  var salesSheet = ss.getSheetByName('SALES');

  if (!attSheet || attSheet.getLastRow() <= 1 || !salesSheet || salesSheet.getLastRow() <= 1) return;

  var sHeaders = salesSheet.getRange(1, 1, 1, salesSheet.getLastColumn()).getDisplayValues()[0];
  var sIdCol = sHeaders.indexOf('sales_id');
  var sNameCol = sHeaders.indexOf('full_name');
  var sTeamCol = sHeaders.indexOf('team_name');
  if (sIdCol === -1) return;

  var sData = salesSheet.getRange(2, 1, salesSheet.getLastRow() - 1, sHeaders.length).getDisplayValues();
  var salesMap = {};
  for (var i = 0; i < sData.length; i++) {
    var sid = String(sData[i][sIdCol] || '').trim().toUpperCase();
    if (sid) {
      salesMap[sid] = {
        name: sNameCol !== -1 ? sData[i][sNameCol] : '',
        team: sTeamCol !== -1 ? sData[i][sTeamCol] : ''
      };
    }
  }

  var aHeaders = attSheet.getRange(1, 1, 1, attSheet.getLastColumn()).getDisplayValues()[0];
  var colId = aHeaders.indexOf('sales_id') + 1;
  var colName = aHeaders.indexOf('sales_name') + 1;
  var colTeam = aHeaders.indexOf('team_name') + 1;

  if (colId === 0 || colName === 0 || colTeam === 0) return;

  var lastR = attSheet.getLastRow();
  var idVals = attSheet.getRange(2, colId, lastR - 1, 1).getDisplayValues();
  var nameRange = attSheet.getRange(2, colName, lastR - 1, 1);
  var teamRange = attSheet.getRange(2, colTeam, lastR - 1, 1);
  var nameVals = nameRange.getValues();
  var teamVals = teamRange.getValues();

  for (var j = 0; j < idVals.length; j++) {
    var curSid = String(idVals[j][0] || '').trim().toUpperCase();
    if (curSid && salesMap[curSid]) {
      nameVals[j][0] = salesMap[curSid].name;
      teamVals[j][0] = salesMap[curSid].team;
    }
  }

  nameRange.setValues(nameVals);
  teamRange.setValues(teamVals);
  SpreadsheetApp.flush();
}

function convertAndAuthorizeDrivePhotosInAttendance_() {
  var ss = getKchSpreadsheet_();
  var sheet = ss.getSheetByName('ATTENDANCE');
  if (!sheet || sheet.getLastRow() <= 1) return;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var photoColIdx = headers.indexOf('photo_url') + 1;
  if (photoColIdx === 0) photoColIdx = 6;

  var lastRow = sheet.getLastRow();
  var photoRange = sheet.getRange(2, photoColIdx, lastRow - 1, 1);
  var values = photoRange.getValues();

  for (var i = 0; i < values.length; i++) {
    var rawUrl = String(values[i][0] || '').trim();
    if (!rawUrl) continue;

    var fileId = extractDriveFileId_(rawUrl);
    if (fileId) {
      try {
        var file = DriveApp.getFileById(fileId);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (err) {}
    }
  }

  SpreadsheetApp.flush();
}

function purgeObsoleteColumnsAndSheets_() {
  var ss = getKchSpreadsheet_();
  var allSheets = ss.getSheets();
  
  allSheets.forEach(function(sh) {
    var name = sh.getName().trim();
    var norm = name.toUpperCase().replace(/[\s_-]+/g, '');
    if (norm === 'TEAMS' || 
        norm === 'TARGET' || 
        norm === 'TARGETS' || 
        norm === 'SALESTARGET' || 
        norm === 'SALESTARGETS' || 
        norm.indexOf('SALESPROFIL') > -1 || 
        norm.indexOf('PROFILSALES') > -1 || 
        norm === 'SALESTRANSACTIONITEMS' ||
        norm === 'SALESTRANSACTIONSITEMS' ||
        norm === 'TRANSACTIONITEMS' ||
        norm === 'SETORANHARIAN') {
      try { 
        ss.deleteSheet(sh); 
      } catch (e) {}
    }
  });

  SpreadsheetApp.flush();
}

function deduplicateSheetColumns_(sheet, expectedHeaders) {
  if (!sheet) return;

  if (sheet.getName() === 'PRODUCTS') {
    setupInventorySheetStructure_();
    removeProductDistributorColumns_(sheet);
    return;
  }

  if (sheet.getName() === 'HOLIDAYS') {
    setupHolidaysSheet_();
    return;
  }
  if (sheet.getName() === 'SALES_TRANSACTIONS') {
    setupSalesTransactionsUnifiedSheet_();
    return;
  }
  if (sheet.getName() === 'SALES') {
    consolidateSalesSheetStructure_();
    return;
  }
  if (sheet.getName() === 'DISTRIBUTORS') {
    setupDistributorsSheet_();
    return;
  }
  if (sheet.getName() === 'INVENTORY') {
    setupInventorySheetStructure_();
    return;
  }
  if (sheet.getName() === 'ATTENDANCE') {
    setupAttendanceSheetForManualInput_();
    return;
  }
  if (sheet.getName() === 'PRICE_MASTER') {
    syncProductsToPriceMaster_();
    return;
  }
  if (sheet.getName() === 'FILES') {
    setupFilesSheet_();
    return;
  }

  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;

  var headerVals = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var seenHeaders = {};

  for (var c = headerVals.length - 1; c >= 0; c--) {
    var rawH = String(headerVals[c] || '').trim();
    var normH = rawH.toLowerCase();

    if (!normH) {
      if (c + 1 > expectedHeaders.length) {
        try { sheet.deleteColumn(c + 1); } catch (e) {}
      }
      continue;
    }

    if (seenHeaders[normH]) {
      try { sheet.deleteColumn(c + 1); } catch (err) {}
    } else {
      seenHeaders[normH] = true;
    }
  }

  lastCol = sheet.getLastColumn();
  if (lastCol > expectedHeaders.length) {
    try { sheet.deleteColumns(expectedHeaders.length + 1, lastCol - expectedHeaders.length); } catch (e) {}
  }

  sheet.getRange(1, 1, 1, expectedHeaders.length)
    .setValues([expectedHeaders])
    .setFontWeight('bold')
    .setBackground('#0c1e33')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function removeProductDistributorColumns_(sheet) {
  if (!sheet || sheet.getLastColumn() === 0) return;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var distributorHeaders = ['pt. global mitra prima', 'ap. geubrina rizki', 'distributor'];
  var columnsToRemove = [];
  headers.forEach(function(header, index) {
    if (distributorHeaders.indexOf(String(header || '').trim().toLowerCase()) !== -1) {
      columnsToRemove.push(index + 1);
    }
  });
  columnsToRemove.sort(function(a, b) { return b - a; }).forEach(function(column) {
    sheet.deleteColumn(column);
  });
}

function deduplicateAllSheets_() {
  var ss = getKchSpreadsheet_();
  for (var sheetName in TABLE_SCHEMAS) {
    var sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      deduplicateSheetColumns_(sheet, TABLE_SCHEMAS[sheetName]);
    }
  }
  SpreadsheetApp.flush();
}

function repairAndOptimizeSpreadsheet_() {
  var ss = getKchSpreadsheet_();
  var timestamp = Utilities.formatDate(new Date(), KCH_CONFIG.TIMEZONE, KCH_CONFIG.DATE_FORMAT);
  
  setupHolidaysSheet_();
  deleteSalesProfilesSheet_();
  setupDistributorsSheet_();
  setupSalesTransactionsUnifiedSheet_();
  setupMonthlyTeamReportSheet_();
  setupTodayPlanSheet_();
  setupWeeklyMeetingsSheet_();
  consolidateSalesSheetStructure_();
  setupAttendanceSheetForManualInput_();
  setupVisitPhotosSheet_();
  setupKchNewsSheet_();
  setupInventorySheetStructure_();
  setupFilesSheet_();
  purgeObsoleteColumnsAndSheets_();
  deduplicateAllSheets_();
  convertAndAuthorizeDrivePhotosInAttendance_();
  syncProductsToPriceMaster_();
  syncProductsToInventory_();
  ensureSettingsConfigured_();
  removeAllSheetDropdowns_();
  formatAndCompactSheets_();

  SpreadsheetApp.flush();
  try {
    ss.toast('Database teroptimasi! Sheet HOLIDAYS dan transaksi tersentralisasi penuh.', 'Selesai', 5);
  } catch (e) {}

  return {
    status: 'success',
    timestamp: timestamp,
    message: 'Database berhasil disatukan dan sistem berjalan optimal.'
  };
}

function syncProductsToPriceMaster_() {
  var ss = getKchSpreadsheet_();
  var prodSheet = ss.getSheetByName('PRODUCTS');
  var salesSheet = ss.getSheetByName('SALES');
  var priceSheet = ss.getSheetByName('PRICE_MASTER');

  if (!priceSheet) {
    priceSheet = ss.insertSheet('PRICE_MASTER');
  }

  // PRICE_MASTER is manually maintained. Once it contains data rows, do not
  // regenerate or overwrite its values during database updates.
  if (priceSheet.getLastRow() > 1) {
    try {
      ss.toast('PRICE_MASTER berisi data manual, jadi tidak diubah saat pembaruan.', 'PRICE_MASTER aman', 5);
    } catch (e) {}
    return;
  }

  if (!prodSheet) return;

  var expectedHeaders = TABLE_SCHEMAS.PRICE_MASTER;
  var prodLastRow = prodSheet.getLastRow();
  if (prodLastRow <= 1) return;

  var prodValues = prodSheet.getRange(2, 1, prodLastRow - 1, Math.min(prodSheet.getLastColumn(), 6)).getDisplayValues();
  var realProducts = [];

  for (var p = 0; p < prodValues.length; p++) {
    var pId = String(prodValues[p][0] || '').trim();
    var pName = String(prodValues[p][1] || '').trim();
    var pUnit = normalizeUnit_(String(prodValues[p][3] || '').trim() || 'Box');
    if (pId) {
      realProducts.push({ id: pId, name: pName || pId, unit: pUnit });
    }
  }

  var teamsMap = {};
  STANDARD_TEAMS.forEach(function(t) { teamsMap[t] = true; });

  if (salesSheet && salesSheet.getLastRow() > 1) {
    var sHeaders = salesSheet.getRange(1, 1, 1, salesSheet.getLastColumn()).getDisplayValues()[0];
    var hTeam = sHeaders.indexOf('team_name');
    if (hTeam !== -1) {
      var sRows = salesSheet.getRange(2, hTeam + 1, salesSheet.getLastRow() - 1, 1).getDisplayValues();
      for (var s = 0; s < sRows.length; s++) {
        var tVal = String(sRows[s][0] || '').trim();
        var tProper = LEGACY_TEAM_MAP[tVal.toUpperCase()] || tVal;
        if (tProper && !isAttendanceOnlyTeam_(tProper)) teamsMap[tProper] = true;
      }
    }
  }

  var teams = Object.keys(teamsMap).map(function(name) { return { teamName: name }; });
  var priceLastRow = priceSheet.getLastRow();
  var existingPriceData = {};

  if (priceLastRow > 1) {
    var lastCol = priceSheet.getLastColumn();
    var currentHeaders = priceSheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var colMap = {};
    for (var ch = 0; ch < currentHeaders.length; ch++) {
      colMap[String(currentHeaders[ch] || '').trim().toLowerCase()] = ch;
    }

    var rawVals = priceSheet.getRange(2, 1, priceLastRow - 1, lastCol).getValues();
    var dispVals = priceSheet.getRange(2, 1, priceLastRow - 1, lastCol).getDisplayValues();

    for (var r = 0; r < rawVals.length; r++) {
      var rowPId = colMap['product_id'] !== undefined ? String(dispVals[r][colMap['product_id']] || '').trim().toUpperCase() : '';
      var rawTName = colMap['team_name'] !== undefined ? String(dispVals[r][colMap['team_name']] || '').trim() : '';
      var rowTName = (LEGACY_TEAM_MAP[rawTName.toUpperCase()] || rawTName).toUpperCase();

      if (rowPId && rowTName) {
        var rawCost = colMap['cost_price'] !== undefined ? rawVals[r][colMap['cost_price']] : null;
        var rawSell = colMap['selling_price'] !== undefined ? rawVals[r][colMap['selling_price']] : null;
        var rawShj = colMap['shj'] !== undefined ? rawVals[r][colMap['shj']] : null;

        var costNum = (typeof rawCost === 'number' && !isNaN(rawCost)) ? Math.round(rawCost) : cleanRawNumber_(dispVals[r][colMap['cost_price']]);
        var sellNum = (typeof rawSell === 'number' && !isNaN(rawSell)) ? Math.round(rawSell) : cleanRawNumber_(dispVals[r][colMap['selling_price']]);
        var shjNum = (typeof rawShj === 'number' && !isNaN(rawShj)) ? Math.round(rawShj) : cleanRawNumber_(dispVals[r][colMap['shj']]);

        if (shjNum === 0 && sellNum > 0 && costNum > 0) {
          shjNum = sellNum - costNum;
        }

        var key = rowPId + '____' + rowTName;
        existingPriceData[key] = {
          unit: colMap['unit'] !== undefined ? normalizeUnit_(dispVals[r][colMap['unit']]) : '',
          cost: costNum,
          sell: sellNum,
          shj: shjNum,
          status: (colMap['status'] !== undefined && dispVals[r][colMap['status']]) ? dispVals[r][colMap['status']] : 'ACTIVE'
        };
      }
    }
  }

  var newRows = [];
  for (var i = 0; i < realProducts.length; i++) {
    var prod = realProducts[i];
    for (var j = 0; j < teams.length; j++) {
      var tm = teams[j];
      var lookupKey = prod.id.toUpperCase() + '____' + tm.teamName.toUpperCase();
      var prev = existingPriceData[lookupKey] || {};

      var unitVal = prev.unit || prod.unit || 'Box';
      var costFinal = (prev.cost !== undefined) ? prev.cost : 0;
      var sellFinal = (prev.sell !== undefined) ? prev.sell : 0;
      var shjFinal = (prev.shj !== undefined) ? prev.shj : (sellFinal - costFinal);
      var statusVal = prev.status || 'ACTIVE';

      newRows.push([
        prod.id,
        prod.name,
        normalizeUnit_(unitVal),
        tm.teamName,
        costFinal,
        sellFinal,
        shjFinal,
        statusVal
      ]);
    }
  }

  clearSheetValidations_(priceSheet);
  priceSheet.clear();
  priceSheet.getRange(1, 1, 1, expectedHeaders.length)
    .setValues([expectedHeaders])
    .setFontWeight('bold')
    .setBackground('#0c1e33')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  priceSheet.setFrozenRows(1);

  if (newRows.length > 0) {
    priceSheet.getRange(2, 1, newRows.length, expectedHeaders.length).setValues(newRows);
    safeSetNumberFormat_(priceSheet.getRange(2, 5, newRows.length, 3), '0');
  }

  SpreadsheetApp.flush();
}

function syncProductsToInventory_() {
  var ss = getKchSpreadsheet_();
  var prodSheet = ss.getSheetByName('PRODUCTS');
  var invSheet = ss.getSheetByName('INVENTORY');

  if (!prodSheet || !invSheet) return;

  var expectedHeaders = TABLE_SCHEMAS.INVENTORY;
  deduplicateSheetColumns_(invSheet, expectedHeaders);

  var prodLastRow = prodSheet.getLastRow();
  var invLastRow = invSheet.getLastRow();

  if (prodLastRow <= 1) return;

  var prodValues = prodSheet.getRange(2, 1, prodLastRow - 1, Math.min(prodSheet.getLastColumn(), 6)).getDisplayValues();
  var realProducts = [];

  for (var p = 0; p < prodValues.length; p++) {
    var pId = String(prodValues[p][0] || '').trim();
    var pName = String(prodValues[p][1] || '').trim();
    var pMin = cleanRawNumber_(prodValues[p][5]) || 50;

    if (pId) {
      realProducts.push({ id: pId, name: pName || pId, minStock: pMin });
    }
  }

  var existingStockMap = {};
  if (invLastRow > 1) {
    var rawInvHeaders = invSheet.getRange(1, 1, 1, invSheet.getLastColumn()).getDisplayValues()[0];
    var hProd = rawInvHeaders.indexOf('product_id');
    var hGlobalStock = rawInvHeaders.indexOf('PT. Global Mitra Prima');
    var hGeubrinaStock = rawInvHeaders.indexOf('AP. Geubrina Rizki');

    var invRows = invSheet.getRange(2, 1, invLastRow - 1, rawInvHeaders.length).getValues();
    for (var i = 0; i < invRows.length; i++) {
      var rProd = String(invRows[i][hProd !== -1 ? hProd : 0] || '').trim().toUpperCase();
      var rGlobal = hGlobalStock !== -1 ? distributorStockOrNull_(invRows[i][hGlobalStock]) : null;
      var rGeubrina = hGeubrinaStock !== -1 ? distributorStockOrNull_(invRows[i][hGeubrinaStock]) : null;

      if (rProd) {
        existingStockMap[rProd] = {
          globalStock: rGlobal,
          geubrinaStock: rGeubrina
        };
      }
    }
  }

  var newInvRows = [];

  for (var prodIdx = 0; prodIdx < realProducts.length; prodIdx++) {
    var curProd = realProducts[prodIdx];
    var preserved = existingStockMap[curProd.id.toUpperCase()] || {};

    var globalStockVal = preserved.globalStock !== null && preserved.globalStock !== undefined ? preserved.globalStock : 500;
    var geubrinaStockVal = preserved.geubrinaStock !== null && preserved.geubrinaStock !== undefined ? preserved.geubrinaStock : 500;

    newInvRows.push([
      curProd.id,
      curProd.name,
      globalStockVal,
      geubrinaStockVal
    ]);
  }

  clearSheetValidations_(invSheet);
  if (invLastRow > 1) {
    try {
      invSheet.getRange(2, 1, invLastRow - 1, expectedHeaders.length).clearContent();
    } catch (e) {}
  }

  if (newInvRows.length > 0) {
    invSheet.getRange(2, 1, newInvRows.length, expectedHeaders.length).setValues(newInvRows);
    safeSetNumberFormat_(invSheet.getRange(2, 3, newInvRows.length, 2), '#,##0');
  }
}

function ensureSettingsConfigured_() {
  var ss = getKchSpreadsheet_();
  var settingSheet = ss.getSheetByName('SETTINGS');

  if (!settingSheet) {
    settingSheet = ss.insertSheet('SETTINGS');
    settingSheet.getRange(1, 1, 1, TABLE_SCHEMAS.SETTINGS.length)
      .setValues([TABLE_SCHEMAS.SETTINGS])
      .setFontWeight('bold')
      .setBackground('#0c1e33')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    settingSheet.setFrozenRows(1);
    settingSheet.setColumnWidth(1, 240);
    settingSheet.setColumnWidth(2, 420);
  }

  var lastRow = settingSheet.getLastRow();
  var keysMap = {};

  if (lastRow > 1) {
    var existing = settingSheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (var i = 0; i < existing.length; i++) {
      keysMap[existing[i][0].trim().toUpperCase()] = true;
    }
  }

  var defaultSettings = [
    ['BRANCH_NAME', 'Cabang Lhokseumawe'],
    ['ENABLE_MANUAL_WORK_DAYS', 'FALSE'],
    ['SIDEBAR_LOGO_URL', '']
  ];

  defaultSettings.forEach(function(row) {
    if (!keysMap[row[0].toUpperCase()]) {
      settingSheet.appendRow(row);
    }
  });
}

function formatAndCompactSheets_() {
  var ss = getKchSpreadsheet_();
  var sheets = ss.getSheets();

  sheets.forEach(function(sh) {
    var lastRow = sh.getLastRow();
    var maxRows = sh.getMaxRows();
    var lastCol = sh.getLastColumn();
    var maxCols = sh.getMaxColumns();

    if (maxRows > lastRow + 5 && maxRows > 15) {
      try { sh.deleteRows(lastRow + 6, maxRows - (lastRow + 5)); } catch (err) {}
    }
    if (maxCols > lastCol + 2 && maxCols > 8) {
      try { sh.deleteColumns(lastCol + 3, maxCols - (lastCol + 2)); } catch (err) {}
    }
    if (lastRow > 1 && lastCol > 0) {
      try { sh.setFrozenRows(1); } catch (err) {}
    }
  });
}

function clearSheetValidations_(sheet) {
  if (!sheet) return;
  try {
    var maxR = sheet.getMaxRows();
    var maxC = sheet.getMaxColumns();
    if (maxR > 0 && maxC > 0) {
      sheet.getRange(1, 1, maxR, maxC).clearDataValidations();
    }
  } catch (err) {}
}

function removeAllSheetDropdowns_() {
  var ss = getKchSpreadsheet_();
  var sheets = ss.getSheets();
  var cleared = 0;

  sheets.forEach(function(sheet) {
    try {
      var maxR = sheet.getMaxRows();
      var maxC = sheet.getMaxColumns();
      if (maxR > 0 && maxC > 0) {
        sheet.getRange(1, 1, maxR, maxC).clearDataValidations();
        cleared++;
      }
    } catch (err) {}
  });

  SpreadsheetApp.flush();
  try {
    ss.toast('Semua dropdown/data validation di seluruh sheet sudah dihapus. Isi data tetap dipertahankan.', 'Selesai', 5);
  } catch (e) {}

  return {
    status: 'success',
    sheets_cleared: cleared
  };
}

function cleanRawNumber_(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Math.round(val);
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
  return isNaN(n) ? 0 : Math.round(n);
}

function normalizeUnit_(val) {
  if (!val) return 'Box';
  var str = String(val).trim();
  var upper = str.toUpperCase();
  if (upper === 'BOX') return 'Box';
  if (upper === 'RENCENG') return 'Renceng';
  if (upper === 'PCS') return 'Pcs';
  if (upper === 'STRIP') return 'Strip';
  if (upper === 'SACHET') return 'Sachet';
  if (upper === 'BOTOL') return 'Botol';
  if (upper === 'TUBE') return 'Tube';
  if (upper === 'DUS') return 'Dus';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function safeSetNumberFormat_(range, formatStr) {
  try {
    if (range) {
      range.setNumberFormat(formatStr || '0');
    }
  } catch (err) {}
}
