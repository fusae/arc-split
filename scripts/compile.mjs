import solc from 'solc';
import { readFile } from 'node:fs/promises';
export async function compile(extraSources = {}) {
  const source = await readFile(new URL('../contracts/ArcSplit.sol', import.meta.url),'utf8');
  const output = JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'ArcSplit.sol':{content:source},...extraSources},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',metadata:{bytecodeHash:'none'},outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}})));
  const errors = (output.errors || []).filter(e => e.severity === 'error');
  if(errors.length) throw new Error(errors.map(e=>e.formattedMessage).join('\n'));
  const c=output.contracts['ArcSplit.sol'].ArcSplit;
  return {abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtime:'0x'+c.evm.deployedBytecode.object,contracts:output.contracts};
}
