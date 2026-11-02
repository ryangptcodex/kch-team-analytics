// Read-only launch review reproductions. Google services are in-memory mocks.
// Observed bad behavior is deliberately printed; this is NOT a passing test suite.
const assert=require('node:assert/strict');
const {system}=require('../tests/helpers/transaction-system.cjs');
const {environment}=require('../tests/helpers/auth-environment.cjs');
function photoFixture(){
 const e=system(),c=e.context;e.actor({role:'ADMIN'});
 const ctx={id:'test-book',token:'TEST_ONLY_OAUTH'},meta=c.txMetadata_(ctx),requests=[];
 c.txAddSheet_(meta,requests,'ATTENDANCE',c.TABLE_SCHEMAS.ATTENDANCE,false);c.txBatch_(ctx,requests);
 let trashed=false,sharing='';
 c.DriveApp={Access:{ANYONE_WITH_LINK:'ANYONE_WITH_LINK'},Permission:{VIEW:'VIEW'}};
 c.getPhotoUploadFolder_=()=>({createFile:()=>({getUrl:()=> 'https://drive.google.com/file/d/REVIEW_ONLY_IMAGE_ID/view',setSharing(access){sharing=access;},setTrashed(){trashed=true;}})});
 c.Utilities.base64Decode=value=>Array.from(Buffer.from(value,'base64'));c.Utilities.newBlob=()=>({});
 return {...e,c,trashed:()=>trashed,sharing:()=>sharing,upload:date=>c.kchApi('MOCK','saveSalesPhotoUpload',[{salesId:'S1',date,notes:'Review only',imageDataUrl:'data:image/jpeg;base64,AQI='},'attendance'])};
}
let e=photoFixture(),result=e.upload('2030-01-01');assert.equal(result.success,false);assert.equal(e.rows('ATTENDANCE').length,1);
console.log(JSON.stringify({case:'future attendance now rejected',observedSuccess:result.success,message:result.message}));
e=photoFixture();result=e.upload('2026-11-31');assert.equal(result.success,false);assert.equal(e.rows('ATTENDANCE').length,1);
console.log(JSON.stringify({case:'impossible Gregorian attendance date now rejected',observedSuccess:result.success,message:result.message}));
e=photoFixture();e.c.SpreadsheetApp.flush=()=>{throw Error('SIMULATED_RESPONSE_FAILURE_AFTER_APPEND');};result=e.upload('2026-10-25');assert.equal(result.success,false);assert.equal(e.rows('ATTENDANCE').length,2);assert.equal(e.trashed(),true);
console.log(JSON.stringify({case:'photo write acknowledged as failed after append',observedSuccess:result.success,persistedAttendanceRows:e.rows('ATTENDANCE').length-1,referencedPhotoTrashed:e.trashed()}));
const guest=environment({identity:{email:'admin@gmail.com',localId:'admin-uid'}});guest.context.KCH_GUEST_PASSWORD_ITERATIONS_=1000;
guest.call('saveGuestCredentials',[{username:'tamu',password:'review-only-password-123',status:'ACTIVE'}]);
let successful=0;for(let i=0;i<20;i++)if(guest.context.kchGuestLogin('tamu','review-only-password-123').success)successful++;
let blocked=false;try{guest.context.kchGuestLogin('tamu','review-only-password-123');}catch(err){blocked=/Terlalu banyak/.test(err.message);}
assert.equal(successful,20);assert.equal(blocked,true);
console.log(JSON.stringify({case:'successful guest logins exhaust shared ten-minute limiter',successfulLogins:successful,nextCorrectLoginBlocked:blocked}));
const exported=system(),c=exported.context;c.getTransactionsPaginated_=()=>({success:false,message:'SIMULATED_READ_FAILURE'});result=c.getAllTransactionsForExport_('','ALL','ALL','');assert.equal(result.success,true);
console.log(JSON.stringify({case:'export wrapper masks source read error',observedSuccess:result.success,returnedRows:result.data.length}));
const callbacks=[],menu={addItem(label,fn){callbacks.push(fn);return menu;},addToUi(){}};
c.SpreadsheetApp.getUi=()=>({createMenu:()=>menu});c.onOpen();
console.log(JSON.stringify({case:'legacy database mutators still exposed in Sheet menu',callbacks:callbacks.filter(fn=>['setupSalesTransactionsUnifiedSheet_','setupInventorySheetStructure_','syncProductsToInventory_','purgeObsoleteColumnsAndSheets_'].includes(fn))}));
