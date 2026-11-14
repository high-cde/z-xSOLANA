'use strict';
// Test offline di Staking / Connetti app (nessuna rete). Uso: node scripts/radar-staking-selftest.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const st = require('../lib/staking');
const ata = require('../lib/solana-ata');
const radar = require('../lib/radar');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('stato attivazione', () => {
  const MAX = '18446744073709551615';
  assert.strictEqual(st.stakeState({ activationEpoch: '1000', deactivationEpoch: MAX }, 1086), 'attivo');
  assert.strictEqual(st.stakeState({ activationEpoch: '1086', deactivationEpoch: MAX }, 1086), 'in attivazione');
  assert.strictEqual(st.stakeState({ activationEpoch: '1000', deactivationEpoch: '1087' }, 1086), 'in disattivazione');
  assert.strictEqual(st.stakeState({ activationEpoch: '1000', deactivationEpoch: '1080' }, 1086), 'inattivo');
  assert.strictEqual(st.stakeState(null, 1086), 'non delegato');
});

t('parse conto reale non delegato (riserva BlazeStake, getAccountInfo 14/11/2026)', () => {
  const acc = { pubkey: 'rsrxDvYUXjH1RQj2Ke36LNZEVqGztATxFkqNukERqFT', account: { lamports: 2583169503221, data: { parsed: { type: 'initialized', info: { meta: { authorized: { staker: '6WecYymEARvjG5ZyqkrVQ6YkhPfujNzWpSPwNKXHCbV2', withdrawer: '6WecYymEARvjG5ZyqkrVQ6YkhPfujNzWpSPwNKXHCbV2' } }, stake: null } } } } };
  const s = st.parseStake(acc, 1086);
  assert.strictEqual(s.state, 'non delegato');
  assert.strictEqual(s.validator, null);
  assert.strictEqual(s.withdrawer, '6WecYymEARvjG5ZyqkrVQ6YkhPfujNzWpSPwNKXHCbV2');
});

t('parse conto delegato', () => {
  const acc = { pubkey: 'A'.repeat(43), account: { lamports: 5002282880, data: { parsed: { type: 'delegated', info: { meta: { authorized: { staker: 'S', withdrawer: 'W' } }, stake: { delegation: { voter: 'V'.repeat(43), stake: '5000000000', activationEpoch: '900', deactivationEpoch: '18446744073709551615' } } } } } } };
  const s = st.parseStake(acc, 1086);
  assert.strictEqual(s.state, 'attivo');
  assert.strictEqual(s.delegatedLamports, 5e9);
  assert.strictEqual(s.deactivationEpoch, null);
});

t('validazione indirizzo', () => {
  assert.ok(st.isAddress('6C61wDacAtx3QHQYVw17fnm5GEaEAnc1XienNJKn2bsD'));
  assert.ok(!st.isAddress('abc'));
  assert.ok(!st.isAddress('0x' + '1'.repeat(40)));
});

t('ATA Token-2022 vettore noto (confrontato con solders)', () => {
  assert.strictEqual(ata.associatedTokenAddress('6C61wDacAtx3QHQYVw17fnm5GEaEAnc1XienNJKn2bsD', '35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4', ata.TOKEN_2022_PROGRAM), 'DHfKZHhEqYnrnFi9Rb2nPssye2Fjo27vQdRpLHcYAmid');
});

t('LST: 4 mint verificati', () => {
  assert.deepStrictEqual(st.LST.map((x) => x.symbol), ['JitoSOL', 'mSOL', 'bSOL', 'INF']);
  for (const x of st.LST) assert.ok(st.isAddress(x.mint) && /^https:\/\//.test(x.source));
});

t('watchlist: $DSN Solana e VELVET sempre presenti', () => {
  const m = radar.BUILTIN_WATCH.map((x) => x.mint);
  assert.ok(m.includes('35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4'));
  assert.ok(m.includes('2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump'));
});

t('frontend: nessuna firma, nessun link pump.fun', () => {
  const src = ['public/app.js', 'public/index.html', 'lib/staking.js', 'lib/connect.js', 'lib/radar.js']
    .map((f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  assert.ok(!/signTransaction|signAllTransactions|signMessage|signAndSendTransaction|sendTransaction/.test(src));
  assert.ok(!/https?:\/\/(www\.)?pump\.fun/i.test(src));
});

console.log(n + ' test ok');
