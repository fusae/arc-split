import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import ganache from 'ganache';
const rpc=ganache.provider({logging:{quiet:true},chain:{chainId:5042,hardfork:'shanghai'},wallet:{totalAccounts:5,defaultBalance:1000}});
const accounts=await rpc.request({method:'eth_accounts',params:[]});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const errors=[];
await context.route('https://fonts.googleapis.com/**',route=>route.abort());
await context.route('https://fonts.gstatic.com/**',route=>route.abort());
// Never use the production contract addresses in the isolated local EVM.
await context.route('http://localhost:4182/config.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({deployments:{5042:null,5042002:null}})}));
await context.route('https://rpc.mainnet.arc.io/**',async route=>{
  const body=route.request().postDataJSON();
  async function respond(req){try{return {jsonrpc:'2.0',id:req.id,result:await rpc.request({method:req.method,params:req.params||[]})};}catch(e){return {jsonrpc:'2.0',id:req.id,error:{code:e.code||-32000,message:e.message,data:e.data}};}}
  const result=Array.isArray(body)?await Promise.all(body.map(respond)):await respond(body);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
await page.exposeFunction('__localWalletRPC',async({method,params=[]})=>{
  if(method==='eth_requestAccounts')return accounts.slice(0,1);
  if(method==='eth_accounts')return accounts.slice(0,1);
  if(method==='wallet_switchEthereumChain')return null;
  return rpc.request({method,params});
});
await page.addInitScript(()=>{
  // Legacy visitors who previously selected Chinese must also see English.
  localStorage.setItem('arc-split-language',JSON.stringify('zh'));
  Object.defineProperty(window,'ethereum',{value:{request:args=>window.__localWalletRPC(args),on:()=>{}},configurable:true});
  window.__registeredTools={};
  Object.defineProperty(document,'modelContext',{value:{registerTool:tool=>{window.__registeredTools[tool.name]=tool;}},configurable:true});
});
const checks=[];
try{
  await page.goto('http://localhost:4182/');
  await page.locator('#recipients .recipient-row').nth(1).waitFor();
  await page.waitForFunction(()=>Object.keys(window.__registeredTools||{}).length===2);
  assert.equal(await page.locator('#preview-amount').innerText(),'10.00');
  await page.locator('#demo').click();await page.locator('#pay').click();
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.match(await page.locator('.paid-heading').innerText(),/Demo/);
  assert.equal(await rpc.request({method:'eth_getTransactionCount',params:[accounts[0],'latest']}),'0x0');
  checks.push('demo is clearly labelled and sends no transaction');
  await page.locator('#download-receipt').click();
  await page.locator('#new-order').click();
  await page.locator('#add-recipient').click();await page.locator('#add-recipient').click();await page.locator('#add-recipient').click();
  assert.equal(await page.locator('.recipient-row').count(),5);assert(await page.locator('#add-recipient').isDisabled());
  await page.locator('.remove-recipient').last().click();await page.locator('.remove-recipient').last().click();await page.locator('.remove-recipient').last().click();
  assert.equal(await page.locator('.recipient-row').count(),2);checks.push('recipient controls enforce 2–5');
  const prepared=await page.evaluate(async({accounts})=>window.__registeredTools.prepare_split_request.execute({title:'Browser verification',amount:'10',recipients:[{address:accounts[1],percent:'70'},{address:accounts[2],percent:'30'}]}),{accounts});
  assert.equal(prepared.onchainOrderCreated,false);assert.equal(await page.locator('#title').inputValue(),'Browser verification');
  const invalid=await page.evaluate(async()=>{try{await window.__registeredTools.prepare_split_request.execute({title:'x',amount:'-1',recipients:[]});return false;}catch{return true;}});assert(invalid);assert.equal(await page.locator('#title').inputValue(),'Browser verification');
  checks.push('WebMCP registration, staging, state read-back and invalid-input preservation');
  await page.locator('#create').click();await page.locator('#setup-view').waitFor({state:'visible'});
  assert.match(await page.locator('#message').innerText(),/Deploy or connect/);checks.push('missing contract blocks real order creation');
  await page.locator('#estimate-deploy').click();await page.locator('#deploy').waitFor({timeout:20000});
  await page.locator('#deploy').click();await page.locator('#create-view').waitFor({state:'visible',timeout:30000});
  const address=await page.evaluate(()=>JSON.parse(localStorage.getItem('arc-split-contract-5042')));assert.match(address,/^0x[0-9a-fA-F]{40}$/);checks.push('wallet deployment + exact runtime verification against local EVM');
  await page.locator('#create').click();await page.locator('#pay').waitFor({timeout:30000});
  const link=page.url();assert(link.includes('order=1'));assert(link.includes('contract='));
  await page.locator('#pay').click();await page.locator('.paid-heading').waitFor({timeout:30000});
  assert.match(await page.locator('.paid-heading').innerText(),/verified/);assert.equal(await page.locator('#pay').count(),0);
  assert.equal(await rpc.request({method:'eth_getBalance',params:[accounts[1],'latest']}),'0x'+(1007n*10n**18n).toString(16));
  assert.equal(await rpc.request({method:'eth_getBalance',params:[accounts[2],'latest']}),'0x'+(1003n*10n**18n).toString(16));
  checks.push('create → shareable link → pay → 7/3 actual local-EVM balance changes → verified receipt');
  const downloadPromise=page.waitForEvent('download');await page.locator('#download-receipt').click();const download=await downloadPromise;await mkdir('artifacts',{recursive:true});await download.saveAs('artifacts/local-e2e-receipt.json');
  await page.locator('#refresh-order').click();await page.locator('.paid-heading').waitFor({state:'visible'});
  await page.reload();await page.locator('.paid-heading').waitFor({timeout:20000});checks.push('receipt reload verifies from chain, not browser-only payment state');
  await page.screenshot({path:'artifacts/receipt-desktop.png',fullPage:true});
  assert.equal(await page.locator('#language').count(),0);
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.match(await page.locator('.paid-heading').innerText(),/verified/);
  assert.doesNotMatch(await page.locator('body').innerText(),/[\u3400-\u9fff]/);
  checks.push('English-only receipt and no language switch, including legacy Chinese preference');
  await page.locator('#tab-create').click();
  await page.screenshot({path:'artifacts/create-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/create-mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));checks.push('390px mobile view has no horizontal overflow');
  const toolState=await page.evaluate(()=>window.__registeredTools.get_split_state.execute({}));assert.equal(toolState.view,'create');
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/browser-verification.json',JSON.stringify({environment:'Isolated local EVM; intercepted RPC. NOT Arc mainnet evidence.',checks,errors},null,2));
  console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();await rpc.disconnect();}
