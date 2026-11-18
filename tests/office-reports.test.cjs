const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {system} = require('./helpers/transaction-system.cjs');

function fixture() {
  const e = system(), c = e.context;
  for (const file of ['office-reports.gs','office-report-templates.gs','score.gs','incentives.gs','canvasser-incentives.gs']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c,{filename:file});
  }
  const sales={sales_id:'S1',full_name:'Nama & Sales',area:'Aceh',team_name:'Motoris'};
  const row={sales_id:'S1',transaction_date:'2026-11-09',product_id:'PEGAB',product_name:'Produk',quantity:2,
    cost_price:60,selling_price:100,subtotal_cost:120,subtotal_sales:200,stock_distributor_id:'D1',distributor:'Campuran'};
  const rows={
    SALES:[sales],
    DISTRIBUTORS:[{distributor_id:'D1',distributor_name:'Subdist Contoh'},{distributor_id:'D2',distributor_name:'Panel Contoh'}],
    SALES_TRANSACTIONS:[row,{...row,stock_distributor_id:'D2',quantity:1,subtotal_cost:60,subtotal_sales:100},{...row,sales_id:'S2'}],
    SALES_CASH_DEPOSITS:[{sales_id:'S1',distributor_id:'D1',deposit_date:'2026-11-09',amount:120}],
    STOCK_PICKUPS:[{sales_id:'S1',distributor_id:'D1',pickup_date:'2026-11-09',product_id:'PEGAB',quantity:3}],
    SALES_STOCK_MOVEMENTS:[
      {sales_id:'S1',distributor_id:'D1',date:'2026-11-09',product_id:'PEGAB',stock_before:10,stock_after:13},
      {sales_id:'S1',distributor_id:'D1',date:'2026-11-10',product_id:'PEGAB',stock_before:13,stock_after:11}
    ]
  };
  c.getSheetData_=name=>({rows:rows[name] || []});
  c.opsEntries_=()=>[];
  const headers=Object.keys(row);
  c.scoreContext_=()=>({raw:{SALES_TRANSACTIONS:[headers,...rows.SALES_TRANSACTIONS.map(record=>headers.map(h=>record[h]))]}});
  c.incentiveBuildReport_=()=>({success:true,paidDays:1,dailyScheduledTotal:10000,monthSubtotal:101000,monthTotal:50500,dailyTotal:5000,
    monthly:{scheduledTotal:91000,parameters:[{target:400,actual:320,achievement:.8,scheduled:91000}]},
    daily:[{date:'2026-11-09',scheduled:10000,value:800000,tabletValue:0,focusValue:400000}]
  });
  return {e,c,sales,rows};
}

test('RSSH uses invoice line distributor and recorded deposits, pickups and balances',()=>{
  const {c,sales,rows}=fixture();
  const input={period:'2026-11-09',distributorId:'D1'};
  const report=c.officeRsshCells_(input,sales,false);
  assert.equal(report.F20,2);
  assert.equal(report.G20,200);
  assert.equal(report.H20,120);
  assert.equal(report.D13,120);
  assert.equal(report.E13,undefined);
  assert.equal(report.J20,10);
  assert.equal(report.K20,3);
  assert.equal(report.Q20,11);
  rows.SALES_STOCK_MOVEMENTS[1].stock_before=99;
  assert.equal(c.officeRsshCells_(input,sales,false).Q20,undefined);
  const panel=c.officeRsshCells_({...input,distributorId:'D2'},sales,false);
  assert.equal(panel.D19,'PANEL');
  assert.equal(panel.F20,1);
  assert.equal(panel.D13,undefined);
  rows.SALES_TRANSACTIONS[0].stock_distributor_id='';
  assert.throws(()=>c.officeRsshCells_(input,sales,false),/Campuran/);
});

test('Form Incentive exports the webapp award and a calendar with matching SKU detail',()=>{
  const {c,sales}=fixture();
  const report=c.officeIncentiveCells_('2026-11',sales,false,['PEGAB']);
  assert.equal(report.G20,3);
  assert.equal(report.AF20,300);
  assert.equal(report.AE20,800000);
  assert.equal(report.G47,1);
  assert.equal(report.I47,10000);
  assert.equal(report.M60,50500);
  assert.equal(report.F42,undefined);
  assert.equal(report.C20,undefined);
});

test('office export enforces sales ownership and excludes Guest before reading the workbook',()=>{
  const {e,c}=fixture();
  assert.throws(()=>c.kchApi('MOCK','exportOfficeReport',[{kind:'rssh',salesId:'S2',period:'2026-11-09',distributorId:'D1'}]),/ACCESS_DENIED/);
  assert.throws(()=>c.kchApi('MOCK','exportOfficeReport',[{kind:'rssh',salesId:'S1',period:'2026-11-10',distributorId:'D1'}]),/Senin/);
  e.actor({role:'GUEST'});
  assert.throws(()=>c.kchApi('MOCK','exportOfficeReport',[{}]),/ACCESS_DENIED/);
  assert.match(c.officeCellXml_(' r="C20" t="inlineStr"','=A1 & <literal>'),/inlineStr.*=A1 &amp; &lt;literal&gt;/);
});

test('Motoris Excel separates capped daily schedule from zero daily claim below the November TV gate',()=>{
  const {c,sales}=fixture();
  const previous=c.incentiveBuildReport_;
  c.incentiveBuildReport_=()=>({...previous(),cappedFieldDaily:true,paidDays:0,dailyTotal:0,monthTotal:45500});
  const cells=c.officeIncentiveCells_('2026-11',sales,false,['PEGAB']);
  assert.equal(cells.G51,1);
  assert.equal(cells.I51,10000);
  assert.equal(cells.M60,45500);
  assert.match(cells.B63,/klaim harian setelah ambang TV: Rp0/);
});
