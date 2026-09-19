import {getAddress,formatUnits,parseUnits,ZeroAddress} from 'ethers';
export const SCALE=10n**12n;
export const NETWORKS={5042:{name:'Arc Mainnet',rpc:'https://rpc.mainnet.arc.io',explorer:'https://explorer.arc.io',hex:'0x13b2'},5042002:{name:'Arc Testnet',rpc:'https://rpc.testnet.arc.io',explorer:'https://explorer.testnet.arc.io',hex:'0x4cef52'}};
export const COLORS=['#dcff7a','#a7cbb0','#85adb8','#c8b7e4','#e5bd82'];
export function parseAmount(value){
  if(!/^(0|[1-9]\d{0,12})(\.\d{1,6})?$/.test(String(value)))throw new Error('金额必须大于 0，最多 6 位小数 / Use a positive amount with up to 6 decimals.');
  const amount=parseUnits(String(value),18);
  if(amount<=0n||amount>=(1n<<128n))throw new Error('金额超出范围 / Amount is out of range.');
  return amount;
}
export function parseShare(value){
  if(!/^(0|[1-9]\d{0,2})(\.\d{1,2})?$/.test(String(value)))throw new Error('比例最多 2 位小数 / Percentages support up to 2 decimals.');
  const bps=Number(parseUnits(String(value),2));
  if(bps<=0||bps>10000)throw new Error('每位收款人的比例须大于 0 / Each share must be positive.');
  return bps;
}
export function validateSplit({title,amount,recipients}){
  const cleanTitle=String(title||'').trim();
  if(!cleanTitle||new TextEncoder().encode(cleanTitle).length>180)throw new Error('请填写标题，UTF-8 长度不超过 180 字节 / A title of at most 180 UTF-8 bytes is required.');
  const total=parseAmount(amount);
  if(!Array.isArray(recipients)||recipients.length<2||recipients.length>5)throw new Error('需要 2–5 位收款人 / Add 2–5 recipients.');
  const addresses=recipients.map(r=>{let a;try{a=getAddress(String(r.address).trim());}catch{throw new Error('请填写有效的钱包地址 / Enter valid wallet addresses.');}if(a===ZeroAddress)throw new Error('不能使用零地址 / The zero address is not allowed.');return a;});
  if(new Set(addresses.map(a=>a.toLowerCase())).size!==addresses.length)throw new Error('收款地址不能重复 / Recipient addresses must be unique.');
  const shares=recipients.map(r=>parseShare(r.percent));
  if(shares.reduce((a,b)=>a+b,0)!==10000)throw new Error('分账比例合计须为 100% / Shares must total 100%.');
  if(shares.some(s=>(total/SCALE)*BigInt(s)/10000n===0n))throw new Error('金额太小，每位须至少分得 0.000001 USDC / Each share must allocate at least 0.000001 USDC.');
  return {title:cleanTitle,amount:total,recipients:addresses,shares};
}
export function splitAmounts(amount,shares){let allocated=0n;return shares.map((s,i)=>{const payout=i===shares.length-1?amount-allocated:(amount/SCALE)*BigInt(s)/10000n*SCALE;allocated+=payout;return payout;});}
export function money(amount){const v=formatUnits(amount,18);const [a,b='']=v.split('.');return a+'.'+b.padEnd(2,'0');}
export function shortAddress(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'—';}
export function parseOrderLink(value){
  let url;try{url=new URL(value,'https://arc-split.invalid');}catch{throw new Error('付款链接无效 / Invalid payment link.');}
  const p=new URLSearchParams(url.hash.slice(1)),chain=Number(p.get('chain'));
  if(!NETWORKS[chain])throw new Error('不支持该网络 / Unsupported network.');
  let contract;try{contract=getAddress(p.get('contract'));}catch{throw new Error('合约地址无效 / Invalid contract address.');}
  const id=p.get('order');if(!/^[1-9]\d{0,76}$/.test(id||''))throw new Error('订单编号无效 / Invalid order ID.');
  return {chain,contract,id};
}
export function makeOrderLink(origin,{chain,contract,id}){const p=new URLSearchParams({chain:String(chain),contract:getAddress(contract),order:String(id)});return `${origin}/#${p}`;}
export function assertPaymentProof(order,event,receipt,contractAddress,id){
  const a=event?.args;
  if(!receipt||receipt.status!==1||receipt.to?.toLowerCase()!==contractAddress.toLowerCase()||!a||a.orderId!==BigInt(id)||a.amount!==order.amount||a.payer.toLowerCase()!==order.paidBy.toLowerCase()||receipt.blockNumber!==Number(order.paidBlock))throw new Error('付款凭证不匹配 / Payment proof does not match the order.');
  const expected=splitAmounts(order.amount,Array.from(order.shares,Number));
  if(a.recipients.length!==order.recipients.length||a.payouts.length!==expected.length||expected.some((p,i)=>p!==a.payouts[i]||a.recipients[i].toLowerCase()!==order.recipients[i].toLowerCase()))throw new Error('分账明细不匹配 / Payout proof mismatch.');
  return true;
}
