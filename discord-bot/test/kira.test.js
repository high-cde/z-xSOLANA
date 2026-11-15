'use strict';
const test = require('node:test');
const assert = require('node:assert');
const K = require('../src/kira-core');
const { mintInfo, fakeRpc } = require('./fixtures');
const M = '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump';
const noRug = async () => { throw new Error('offline'); };

test('mint e freeze authority attive => BLOCCATO', async () => {
  const r = await K.kiraReport(M, { rpc: fakeRpc({ ['getAccountInfo:' + M]: mintInfo({ mintAuthority: 'Abc1111111111111111111111111111111', freezeAuthority: 'Abc1111111111111111111111111111111' }) }), fetchJson: noRug });
  assert.strictEqual(r.verdict, 'BLOCCATO'); assert.strictEqual(r.fails, 2);
});
test('authority revocate e holder non disponibili => controlli parziali', async () => {
  const r = await K.kiraReport(M, { rpc: fakeRpc({ ['getAccountInfo:' + M]: mintInfo({}) }), fetchJson: noRug });
  assert.match(r.verdict, /NESSUN RED FLAG \(controlli parziali\)/);
  assert.ok(r.checks.find((c) => c.id === 'top' && c.status === 'nd'));
});
test('Token-2022 permanentDelegate e tassa 10% => fail', async () => {
  const ext = [{ extension: 'permanentDelegate', state: { delegate: 'Del1111111111111111111111111111111' } }, { extension: 'transferFeeConfig', state: { newerTransferFee: { transferFeeBasisPoints: 1000 } } }];
  const r = await K.kiraReport(M, { rpc: fakeRpc({ ['getAccountInfo:' + M]: mintInfo({ extensions: ext }) }), fetchJson: noRug });
  assert.strictEqual(r.verdict, 'BLOCCATO');
  assert.ok(r.checks.find((c) => c.id === 'ext-pd' && c.status === 'fail'));
  assert.ok(r.checks.find((c) => c.id === 'ext-tf' && c.status === 'fail'));
});
test('le pool RugCheck non contano nella concentrazione', async () => {
  const rc = { mint: M, tokenMeta: { symbol: '$OV' }, risks: [], rugged: false, score_normalised: 1, totalMarketLiquidity: 1850,
    knownAccounts: { Pool111111111111111111111111111111: { type: 'AMM', name: 'Pump Fun' } }, markets: [{ pubkey: 'Pool111111111111111111111111111111' }],
    topHolders: [{ address: 'a1', owner: 'Pool111111111111111111111111111111', pct: 95 }, { address: 'a2', owner: 'Hold111111111111111111111111111111', pct: 2 }] };
  const r = await K.kiraReport(M, { rpc: fakeRpc({ ['getAccountInfo:' + M]: mintInfo({}) }), fetchJson: async () => rc });
  const top = r.checks.find((c) => c.id === 'top');
  assert.strictEqual(top.status, 'ok'); assert.match(top.detail, /in pool\/AMM: 95%/);
  assert.strictEqual(r.symbol, '$OV'); assert.strictEqual(r.verdict, 'NESSUN RED FLAG');
  assert.ok(!JSON.stringify(r.topHolders).includes('Hold111111111111111111111111111111'), 'owner mascherato');
});
test('emittente noto (USDC): authority attive solo informative', async () => {
  const U = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const r = await K.kiraReport(U, { rpc: fakeRpc({ ['getAccountInfo:' + U]: mintInfo({ owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', mintAuthority: 'X', freezeAuthority: 'Y' }) }), fetchJson: noRug });
  assert.strictEqual(r.fails, 0); assert.ok(r.checks.find((c) => c.id === 'mint' && c.status === 'info'));
});
test('mint non valido', async () => {
  const r = await K.kiraReport('ciao', { rpc: fakeRpc({}), fetchJson: noRug });
  assert.strictEqual(r.verdict, 'BLOCCATO');
});
test('explainRoute in italiano', () => {
  const q = { routePlan: [{ percent: 100, swapInfo: { label: 'Orca', inputMint: 'A', outputMint: 'B', inAmount: '100000000', outAmount: '6770000' } }], priceImpactPct: '0.001', otherAmountThreshold: '6700000', slippageBps: 50 };
  const e = K.explainRoute(q, (m) => ({ A: 'SOL', B: 'USDC' })[m], (m) => ({ A: 9, B: 6 })[m]);
  assert.match(e.steps[0].text, /Passo 1: 100% · 0,1 SOL → 6,77 USDC su Orca/);
});
