// Public Firebase web configuration. Never put service-account keys here.
var KCH_FIREBASE_WEB_CONFIG_ = {
  "apiKey": "AIzaSyAIaW-qbj4HB2TKS0PlHdj94y5A4jfChn0",
  "authDomain": "kch-team-analytics---uji-coba.firebaseapp.com",
  "projectId": "kch-team-analytics---uji-coba",
  "storageBucket": "kch-team-analytics---uji-coba.firebasestorage.app",
  "messagingSenderId": "86670203247",
  "appId": "1:86670203247:web:d58261cecfc0b538ee309a",
  "measurementId": "G-TTVTERWKHC"
};
var KCH_BOOTSTRAP_ADMIN_EMAIL_ = 'mhmdryyan7@gmail.com';
// Only these two verified Google accounts may use the web app.
var KCH_GUEST_EMAIL_ = 'juniortlkchlse@gmail.com';
function getFirebaseWebConfig_() { return KCH_FIREBASE_WEB_CONFIG_; }

// Each bound project has an explicit database target. Renaming a file is not routing.
var KCH_TEST_SPREADSHEET_ID_ = '1zExCrUfi2umx1-AG4kmGS11ZEVFrqGA2PEjClle0z4A';
var KCH_PRODUCTION_SPREADSHEET_ID_ = '1ww5Zhw_2nFqUyEq9S-I85fpJO1J3tJ_1Mo5UPBqpz4M';
var KCH_PRODUCTION_SCRIPT_ID_ = '1uVrRq4sfvzLIjCIMAg6Qo5TlPG0XJxCnDTuYINSCrsf0WrOF2mvbk-5X';
function isKchProduction_() { return typeof ScriptApp.getScriptId === 'function' && ScriptApp.getScriptId() === KCH_PRODUCTION_SCRIPT_ID_; }
function getKchEnvironmentLabel_() { return isKchProduction_() ? 'KCH Production' : 'KCH UJI COBA'; }
function getKchSpreadsheetId_() { return isKchProduction_() ? KCH_PRODUCTION_SPREADSHEET_ID_ : KCH_TEST_SPREADSHEET_ID_; }
function getKchEnvironmentKey_() { return isKchProduction_() ? 'production-' + txHash_(KCH_PRODUCTION_SCRIPT_ID_).slice(0,16) : ''; }
function getKchSpreadsheet_() {
  if (isKchProduction_() && (typeof productionIsPrepared_ !== 'function' || !productionIsPrepared_())) throw new Error('Database Production belum disiapkan. Jalankan siapkanDatabaseProduksiBaru dari editor Production.');
  return SpreadsheetApp.openById(getKchSpreadsheetId_());
}
