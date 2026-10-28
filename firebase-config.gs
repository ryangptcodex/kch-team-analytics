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

// ID of the TEST spreadsheet only; do not use the original October database.
var KCH_TEST_SPREADSHEET_ID_ = '1zExCrUfi2umx1-AG4kmGS11ZEVFrqGA2PEjClle0z4A';

function getKchSpreadsheet_() {
  if (!KCH_TEST_SPREADSHEET_ID_) throw new Error('ID spreadsheet UJI COBA belum dikonfigurasi.');
  return SpreadsheetApp.openById(KCH_TEST_SPREADSHEET_ID_);
}
