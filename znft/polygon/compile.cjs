const solc = require('solc'); const fs = require('fs');
const input = { language: 'Solidity', sources: { 'VelvetPayTest.sol': { content: fs.readFileSync('VelvetPayTest.sol', 'utf8') } }, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
const out = JSON.parse(solc.compile(JSON.stringify(input))); const errs = (out.errors || []).filter(e => e.severity === 'error'); if (errs.length) { console.error(errs); process.exit(1); }
const c = out.contracts['VelvetPayTest.sol'].VelvetPayTest; fs.writeFileSync('VelvetPayTest.json', JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object, compiler: solc.version() }, null, 2));
console.log('compilato', solc.version(), (c.evm.bytecode.object.length / 2) + ' byte', (out.errors || []).map(e => e.severity + ': ' + e.message).join(' | '));
