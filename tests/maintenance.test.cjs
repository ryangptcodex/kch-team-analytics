const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(options={}){
 const calls=[],callbacks=[],ss={getId:()=>options.activeId||'test-book'},menu={addItem(label,fn){callbacks.push(fn);return menu;},addToUi(){}};
 const c={Session:{getActiveUser:()=>({getEmail:()=>options.email??'admin@test'})},KCH_BOOTSTRAP_ADMIN_EMAIL_:'admin@test',KCH_TEST_SPREADSHEET_ID_:'test-book',SpreadsheetApp:{getActiveSpreadsheet:()=>options.noActive?null:ss,getUi:()=>{if(options.web)throw Error('No UI');return {createMenu:()=>menu};}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../setup.gs'),'utf8'),c);
 c.repairAndOptimizeSpreadsheet_=()=>{calls.push('UNSAFE_LEGACY');throw Error('Legacy must not run');};
 c.kchRunSheetUpdates_=book=>{assert.equal(book,ss);calls.push('SAFE_UPDATER');return {success:true,backupUrl:'BACKUP'};};return {c,calls,callbacks,ss};
}
test('stable spreadsheet repair callback delegates to safe updater and never calls legacy rebuild',()=>{const e=fixture();assert.equal(e.c.repairAndOptimizeSpreadsheet().success,true);assert.deepEqual(e.calls,['SAFE_UPDATER']);});
test('native maintenance rejects wrong user, missing/wrong spreadsheet and web context before delegation',()=>{for(const options of [{email:''},{email:'guest@test'},{noActive:true},{activeId:'original-other-book'},{web:true}]){const e=fixture(options);assert.throws(()=>e.c.repairAndOptimizeSpreadsheet(),/ACCESS_DENIED/);assert.equal(e.calls.length,0);}});
test('maintenance refuses missing safe updater rather than falling back to destructive legacy helpers',()=>{const e=fixture();delete e.c.kchRunSheetUpdates_;assert.throws(()=>e.c.repairAndOptimizeSpreadsheet(),/legacy dinonaktifkan/);assert.equal(e.calls.length,0);});
test('safe updater failures propagate without another migration or retry',()=>{const e=fixture();e.c.kchRunSheetUpdates_=()=>{throw Error('Backup unavailable');};assert.throws(()=>e.c.repairAndOptimizeSpreadsheet(),/Backup unavailable/);assert.equal(e.calls.length,0);});
test('menu exposes only safe update, archive and guarded production actions',()=>{const e=fixture();e.c.onOpen();assert.ok(e.callbacks.includes('repairAndOptimizeSpreadsheet'));assert.ok(e.callbacks.includes('siapkanDatabaseProduksiBaru'));for(const name of ['setupSalesTransactionsUnifiedSheet_','setupInventorySheetStructure_','syncProductsToInventory_','purgeObsoleteColumnsAndSheets_','repairAndOptimizeSpreadsheet_'])assert.ok(!e.callbacks.includes(name));});
