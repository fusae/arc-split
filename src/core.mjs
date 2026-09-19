import {getAddress,formatUnits,parseUnits,ZeroAddress} from 'ethers';
export const SCALE=10n**12n;
export const NETWORKS={5042:{name:'Arc Mainnet',rpc:'https://rpc.mainnet.arc.io',explorer:'https://explorer.arc.io',hex:'0x13b2'},5042002:{name:'Arc Testnet',rpc:'https://rpc.testnet.arc.io',explorer:'https://explorer.testnet.arc.io',hex:'0x4cef52'}};
export const COLORS=['#dcff7a','#a7cbb0','#85adb8','#c8b7e4','#e5bd82'];
export function parseAmount(value){
  if(!/^(0|[1-9]\d{0,12})(\.\d{1,6})?$/.test(String(value)))throw new Error('Use a positive amount with up to 6 decimals.');
  const amount=parseUnits(String(value),18);
  if(amount<=0n||amount>=(1n<<128n))throw new Error('Amount is out of range.');
  return amount;
}
export function parseShare(value){
  if(!/^(0|[1-9]\d{0,2})(\.\d{1,2})?$/.test(String(value)))throw new Error('Percentages support up to 2 decimals.');
  const bps=Number(parseUnits(String(value),2));
  if(bps<=0||bps>10000)throw new Error('Each share must be positive.');
  return bps;
}
export function validateSplit({title,amount,recipients}){
  const cleanTitle=String(title||'').trim();
  if(!cleanTitle||new TextEncoder().encode(cleanTitle).length>180)throw new Error('A title of at most 180 UTF-8 bytes is required.');
  const total=parseAmount(amount);
  if(!Array.isArray(recipients)||recipients.length<2||recipients.length>5)throw new Error('Add 2–5 recipients.');
  const addresses=recipients.map(r=>{let a;try{a=getAddress(String(r.address).trim());}catch{throw new Error('Enter valid wallet addresses.');}if(a===ZeroAddress)throw new Error('The zero address is not allowed.');return a;});
  if(new Set(addresses.map(a=>a.toLowerCase())).size!==addresses.length)throw new Error('Recipient addresses must be unique.');
  const shares=recipients.map(r=>parseShare(r.percent));
  if(shares.reduce((a,b)=>a+b,0)!==10000)throw new Error('Shares must total 100%.');
  if(shares.some(s=>(total/SCALE)*BigInt(s)/10000n===0n))throw new Error('Each share must allocate at least 0.000001 USDC.');
  return {title:cleanTitle,amount:total,recipients:addresses,shares};
}
export function splitAmounts(amount,shares){let allocated=0n;return shares.map((s,i)=>{const payout=i===shares.length-1?amount-allocated:(amount/SCALE)*BigInt(s)/10000n*SCALE;allocated+=payout;return payout;});}
export function money(amount){const v=formatUnits(amount,18);const [a,b='']=v.split('.');return a+'.'+b.padEnd(2,'0');}
export function shortAddress(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—';}
export function parseOrderLink(value){
  let url;try{url=new URL(value,'https://arc-split.invalid');}catch{throw new Error('Invalid payment link.');}
  const p=new URLSearchParams(url.hash.slice(1)),chain=Number(p.get('chain'));
  if(!NETWORKS[chain])throw new Error('Unsupported network.');
  let contract;try{contract=getAddress(p.get('contract'));}catch{throw new Error('Invalid contract address.');}
  const id=p.get('order');if(!/^[1-9]\d{0,76}$/.test(id||''))throw new Error('Invalid order ID.');
  return {chain,contract,id};
}
export function makeOrderLink(origin,{chain,contract,id}){const p=new URLSearchParams({chain:String(chain),contract:getAddress(contract),order:String(id)});return `${origin}/#${p}`;}
export function assertPaymentProof(order,event,receipt,contractAddress,id){
  const a=event?.args;
  if(!receipt||receipt.status!==1||receipt.to?.toLowerCase()!==contractAddress.toLowerCase()||!a||a.orderId!==BigInt(id)||a.amount!==order.amount||a.payer.toLowerCase()!==order.paidBy.toLowerCase()||receipt.blockNumber!==Number(order.paidBlock))throw new Error('Payment proof does not match the order.');
  const expected=splitAmounts(order.amount,Array.from(order.shares,Number));
  if(a.recipients.length!==order.recipients.length||a.payouts.length!==expected.length||expected.some((p,i)=>p!==a.payouts[i]||a.recipients[i].toLowerCase()!==order.recipients[i].toLowerCase()))throw new Error('Payout proof mismatch.');
  return true;
}
