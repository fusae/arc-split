import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile, chmod} from 'node:fs/promises';
import {Wallet, JsonRpcProvider, FetchRequest, ContractFactory, parseUnits, formatUnits} from 'ethers';
import {compile} from './compile.mjs';
import {assertPaymentProof} from '../src/core.mjs';

// Disposable TESTNET ONLY keys. Never import a real wallet or change this chain guard.
const dir = new URL('../.sites-runtime/', import.meta.url);
const keyFile = new URL('arc-testnet-wallet.json', dir);
const reportFile = new URL('../artifacts/testnet-verification.json', import.meta.url);
await mkdir(dir, {recursive:true, mode:0o700});
await mkdir(new URL('../artifacts/', import.meta.url), {recursive:true});
let keys;
try { keys = JSON.parse(await readFile(keyFile, 'utf8')); }
catch(e) {
  if(e.code !== 'ENOENT') throw e;
  keys = {purpose:'Disposable Arc TESTNET ONLY, never fund with real assets', keys:Array.from({length:6},()=>Wallet.createRandom().privateKey)};
  await writeFile(keyFile, JSON.stringify(keys), {mode:0o600, flag:'wx'});
}
await chmod(keyFile, 0o600);
const rpc = new FetchRequest('https://rpc.testnet.arc.io'); rpc.timeout = 20000;
const provider = new JsonRpcProvider(rpc, 5042002, {staticNetwork:true, batchMaxCount:1, cacheTimeout:-1});
provider.pollingInterval = 1500;
const wallets = keys.keys.map(k=>new Wallet(k, provider));
const [payer,...recipients] = wallets;
const balance = a=>provider.getBalance(a, 'latest');
const report = {network:'Arc Testnet', chainId:5042002, startedAt:new Date().toISOString(), payer:payer.address, recipients:recipients.map(w=>w.address), checks:[], transactions:[], status:'incomplete', realFundsUsed:false};
const save = ()=>writeFile(reportFile, JSON.stringify(report, (_,v)=>typeof v==='bigint'?v.toString():v, 2));
try {
  assert.equal(BigInt(await provider.send('eth_chainId', [])),5042002n,'Refusing non-testnet network');
  const initial = await balance(payer.address);
  console.log(JSON.stringify({network:'Arc Testnet',address:payer.address,balanceTestUSDC:formatUnits(initial,18),faucet:'https://faucet.circle.com',signingEnabled:process.argv.includes('--run')}));
  if(process.argv.includes('--run')) {
    if(initial<parseUnits('2',18)) throw new Error('Need at least 2 TEST USDC from Circle faucet before validation');
    const artifact = await compile({'TestnetReceivers.sol':{content:`// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
contract TestnetReject { receive() external payable { revert("test refusal"); } }
contract TestnetReenter {
 address public target; uint256 public targetId; bool public innerSucceeded; uint256 public attempts;
 function configure(address a,uint256 id) external {target=a;targetId=id;}
 receive() external payable {attempts++; (innerSucceeded,)=target.call{value:0.01 ether}(abi.encodeWithSignature("pay(uint256)",targetId));}
}`}});
    let spent=0n;
    async function fees(gasLimit=1500000n,value=0n) {
      assert.equal(BigInt(await provider.send('eth_chainId',[])),5042002n);
      const price=BigInt(await provider.send('eth_gasPrice',[]));
      const maxFeePerGas=price*2n>20000000000n?price*2n:20000000000n;
      if(maxFeePerGas>parseUnits('100','gwei')) throw new Error('Test gas price unexpectedly high; stop');
      if(spent+gasLimit*maxFeePerGas+value>parseUnits('2',18)) throw new Error('2 test-USDC run budget exceeded');
      return {gasLimit,maxFeePerGas,maxPriorityFeePerGas:0n};
    }
    async function mined(label,txPromise,expected=1) {
      const tx=await txPromise;
      report.transactions.push({label,hash:tx.hash,explorer:`https://explorer.testnet.arc.io/tx/${tx.hash}`,status:'pending'}); await save();
      let receipt;
      try { receipt=await tx.wait(1,60000); } catch(e) { if(!e.receipt)throw e; receipt=e.receipt; }
      const fee=receipt.gasUsed*receipt.gasPrice;
      spent+=fee+(receipt.status===1?tx.value:0n);
      Object.assign(report.transactions.at(-1),{status:receipt.status,block:receipt.blockNumber,feeTestUSDC:formatUnits(fee,18)});await save();
      assert.equal(receipt.status,expected,label);return receipt;
    }
    async function deploy(abi,bytecode,label) {
      const c=await new ContractFactory(abi,bytecode,payer).deploy(await fees());
      await mined(label,Promise.resolve(c.deploymentTransaction()));return c;
    }
    const c=await deploy(artifact.abi,artifact.bytecode,'deploy ArcSplit');
    const address=await c.getAddress();report.contract=address;await save();
    assert.equal((await provider.getCode(address)).toLowerCase(),artifact.runtime.toLowerCase());
    report.checks.push('Onchain runtime bytecode exactly matches compiled ArcSplit');
    async function order(amount,rs,shares,title){
      const id=await c.nextOrderId();await mined(title, c.createOrder(amount,rs,shares,title,await fees(600000n)));return id;
    }
    const amount=parseUnits('0.1',18), rs=recipients.slice(0,2).map(w=>w.address);
    const id=await order(amount,rs,[7000,3000],'Testnet 70/30 split');report.orderId=id.toString();
    const before=await Promise.all(rs.map(balance));
    const receipt=await mined('pay 0.1 TEST USDC',c.pay(id,{value:amount,...await fees(400000n,amount)}));
    const after=await Promise.all(rs.map(balance));
    assert.deepEqual(after.map((v,i)=>v-before[i]),[parseUnits('0.07',18),parseUnits('0.03',18)]);
    const o=await c.getOrder(id),ev=receipt.logs.map(l=>{try{return c.interface.parseLog(l);}catch{return null;}}).find(e=>e?.name==='OrderPaid');
    assertPaymentProof(o,ev,receipt,address,id);
    assert.equal(await balance(address),0n);
    report.paymentHash=receipt.hash;report.checks.push('0.1 test USDC paid exactly 0.07/0.03; receipt verified; zero retained balance');
    await mined('duplicate payment reverts',c.pay(id,{value:amount,...await fees(150000n,amount)}),0);
    assert.deepEqual(await Promise.all(rs.map(balance)),after);report.checks.push('Mined duplicate payment reverted without changing recipient balances');
    const rejecting=artifact.contracts['TestnetReceivers.sol'].TestnetReject;
    const reject=await deploy(rejecting.abi,'0x'+rejecting.evm.bytecode.object,'deploy test rejecting recipient');
    const badId=await order(amount,[rs[0],await reject.getAddress()],[7000,3000],'Testnet atomic rollback');
    const prior=await balance(rs[0]);
    await mined('rejecting recipient rolls back entire payment',c.pay(badId,{value:amount,...await fees(400000n,amount)}),0);
    assert.equal(await balance(rs[0]),prior);assert.equal((await c.getOrder(badId)).paid,false);assert.equal(await balance(address),0n);
    report.checks.push('Mined recipient-failure transaction reverted all transfers and paid flag');
    const reenterArtifact=artifact.contracts['TestnetReceivers.sol'].TestnetReenter;
    const reenter=await deploy(reenterArtifact.abi,'0x'+reenterArtifact.evm.bytecode.object,'deploy test reentrant recipient');
    const inner=await order(parseUnits('0.01',18),rs,[5000,5000],'Testnet inner order');
    await mined('configure test reentrant recipient',reenter.configure(address,inner,await fees(150000n)));
    const outer=await order(amount,[rs[0],await reenter.getAddress()],[7000,3000],'Testnet reentrancy guard');
    await mined('pay with reentrant recipient',c.pay(outer,{value:amount,...await fees(600000n,amount)}));
    assert.equal(await reenter.attempts(),1n);assert.equal(await reenter.innerSucceeded(),false);assert.equal((await c.getOrder(inner)).paid,false);assert.equal((await c.getOrder(outer)).paid,true);
    report.checks.push('Reentrant inner payment blocked while outer split succeeds');
    const micro=parseUnits('0.000101',18),five=recipients.map(w=>w.address);
    const fiveId=await order(micro,five,[2000,2000,2000,2000,2000],'Testnet 5-way rounding');
    const fiveBefore=await Promise.all(five.map(balance));
    await mined('pay 5-way micro split',c.pay(fiveId,{value:micro,...await fees(600000n,micro)}));
    const fiveAfter=await Promise.all(five.map(balance));
    assert.deepEqual(fiveAfter.map((v,i)=>v-fiveBefore[i]),Array.from(await c.getPayouts(fiveId)));
    assert.equal(await balance(address),0n);report.checks.push('Five recipients paid exact 6-decimal allocations including rounding remainder');
    const wrong=await order(amount,rs,[7000,3000],'Testnet invalid amount');
    const wrongBefore=await Promise.all(rs.map(balance));
    await mined('wrong amount reverts',c.pay(wrong,{value:amount-1n,...await fees(150000n,amount-1n)}),0);
    assert.deepEqual(await Promise.all(rs.map(balance)),wrongBefore);assert.equal((await c.getOrder(wrong)).paid,false);
    report.checks.push('Mined incorrect-amount payment reverted with no recipient or order changes');
    report.spentTestUSDC=formatUnits(spent,18);report.status='passed';report.completedAt=new Date().toISOString();await save();
    console.log(JSON.stringify(report,(_,v)=>typeof v==='bigint'?v.toString():v,2));
  }
} catch(e) {report.error=e.shortMessage||e.message;await save();console.error(report.error);process.exitCode=1;}
finally {await provider.destroy();}
