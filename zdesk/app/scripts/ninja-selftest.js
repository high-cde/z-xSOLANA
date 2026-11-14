#!/usr/bin/env node
'use strict';

/**
 * Offline WARN→EXIT + hard-stop proof. Uses a fake position file, never risk.md.
 * Writes state/log under a temp dir.
 */

process.env.NINJA_ALLOW_TEST_MINT = '1';
process.env.DESK_DIR = process.env.NINJA_TEST_DIR || '/tmp/ninja-selftest';
const path = require('path');
const fs = require('fs');
const dir = process.env.DESK_DIR;
fs.mkdirSync(dir, { recursive: true });
process.env.NINJA_STATE_FILE = path.join(dir, 'ninja.json');
process.env.NINJA_LOG_FILE = path.join(dir, 'ninja.log');
process.env.NINJA_POSITIONS_FILE = path.join(dir, 'positions.json');
process.env.NINJA_RISK_FILE = path.join(dir, 'risk-empty.md');
process.env.NINJA_COPY_FILE = path.join(dir, 'copy-empty.md');
fs.writeFileSync(process.env.NINJA_RISK_FILE, '# Risk\nLIVE: **none**\nopen_LIVE: **0 / 3**\n');
fs.writeFileSync(process.env.NINJA_COPY_FILE, '# Copy LIVE\n## OPEN\n\n');

// require after env
delete require.cache[require.resolve('../lib/ninja')];
const ninja = require('../lib/ninja');

const mint = 'TestMintNinja111111111111111111111111111';
const basePos = {
  symbol: 'TEST',
  mint,
  entryUsd: 1,
  qty: 100,
  spentUsd: 5,
  liqUsdEntry: 100000,
  copiedWallet: null,
  openedAt: new Date().toISOString(),
  source: 'test',
};

fs.writeFileSync(process.env.NINJA_POSITIONS_FILE, JSON.stringify({ positions: [basePos] }, null, 2));

function market({ price, liq, dump, sellers, rug, symbol }) {
  return {
    priceUsd: price,
    liqUsd: liq,
    symbol: symbol || 'TEST',
    pairAddress: 'TestPair',
    txns: dump ? { m5: { buys: 3, sells: 12 } } : { m5: { buys: 10, sells: 4 } },
    candles1m: [],
    candles5m: dump ? [
      { time: 1, open: 1, high: 1, low: 0.9, close: 1, volume: 100 },
      { time: 2, open: 1, high: 1, low: 0.9, close: 1, volume: 110 },
      { time: 3, open: 1, high: 1, low: 0.9, close: 1, volume: 90 },
      { time: 4, open: 1, high: 1, low: 0.9, close: 1, volume: 95 },
      { time: 5, open: 1, high: 1, low: 0.9, close: 1, volume: 105 },
      { time: 6, open: 1, high: 1, low: 0.9, close: 1, volume: 100 },
      { time: 7, open: 1.00, high: 1.00, low: 0.90, close: 0.92, volume: 400 },
    ] : [],
    rug: rug || { riskLevel: 'ok', rugged: false },
    sellerEvents: sellers || [],
    errors: [],
  };
}

async function run(label, mkt) {
  const res = await ninja.tick({
    positions: [basePos],
    fetchMarket: async () => mkt,
  });
  const row = res.state.positions[0];
  console.log(`  ${label}: status=${row.status} action=${row.action} pnl=${row.pnlPct} signals=${(row.activeSignalIds || []).join(',')}`);
  return row;
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('  ok:', msg);
  }
}

(async () => {
  console.log('Ninja selftest (offline, fake TEST mint, temp dir', dir, ')');

  // 1) mild dip, not yet red
  let row = await run('tick0 price -1.0%', market({ price: 0.990, liq: 100000 }));
  assert(row.status === 'OK', '−1.0% stays OK (red starts at −1.5%)');

  // 2) first red: -1.6% from entry
  row = await run('tick1 price -1.6%', market({ price: 0.984, liq: 100000 }));
  assert(row.status === 'WARN', '−1.6% → WARN');
  assert(row.action === 'TIGHTEN_TRAIL_3', 'WARN tightens trail to 3%');
  assert((row.activeSignalIds || []).includes('price_drawdown'), 'WARN signal is price_drawdown');

  // 3) same signal again must NOT exit
  row = await run('tick2 same -1.7%', market({ price: 0.983, liq: 100000 }));
  assert(row.status === 'WARN', 'same red type stays WARN (not distinct)');

  // 4) second distinct red (liq -16%) → EXIT
  row = await run('tick3 liq -16%', market({ price: 0.983, liq: 84000 }));
  assert(row.status === 'EXIT', 'second distinct red (liq_drop) → EXIT');
  assert(row.action === 'SELL_100_SLIP_5', 'EXIT action is SELL_100_SLIP_5');
  assert((row.activeSignalIds || []).includes('liq_drop'), 'EXIT includes liq_drop');

  // 5) hard stop on a fresh mint/state
  fs.writeFileSync(process.env.NINJA_STATE_FILE, JSON.stringify(ninja.defaultState(), null, 2));
  const pos2 = { ...basePos, mint: mint + 'X', symbol: 'HARD' };
  const resH = await ninja.tick({
    positions: [pos2],
    fetchMarket: async () => market({ price: 0.969, liq: 100000 }),
  });
  const hard = resH.state.positions[0];
  console.log(`  tick hard -3.1%: status=${hard.status} action=${hard.action} ids=${(hard.activeSignalIds || []).join(',')}`);
  assert(hard.status === 'EXIT', '−3.1% hard EXIT immediately (no second signal needed)');
  assert((hard.activeSignalIds || []).includes('hard_stop'), 'hard_stop id present');

  // 6) peak drawdown −3% is a WARN (not hard, unless also −3% from entry)
  fs.writeFileSync(process.env.NINJA_STATE_FILE, JSON.stringify(ninja.defaultState(), null, 2));
  const pos3 = { ...basePos, mint: mint + 'P', symbol: 'PEAK', peakUsd: 1.20 };
  const resP1 = await ninja.tick({
    positions: [pos3],
    fetchMarket: async () => market({ price: 1.20, liq: 100000 }),
  });
  const resP2 = await ninja.tick({
    positions: [{ ...pos3, peakUsd: 1.20 }],
    fetchMarket: async () => market({ price: 1.1628, liq: 100000 }), // -3.1% from 1.20, still +16% vs entry
  });
  const peak = resP2.state.positions[0];
  console.log(`  tick peak -3.1% (still green vs entry): status=${peak.status} fromPeak=${peak.fromPeakPct}`);
  assert(peak.status === 'WARN', '−3% from peak (profit still open) → WARN');

  const log = fs.readFileSync(process.env.NINJA_LOG_FILE, 'utf8');
  assert(/WARN TEST/.test(log), 'log has WARN TEST');
  assert(/EXIT TEST/.test(log), 'log has EXIT TEST');
  assert(/HARD_EXIT/.test(log), 'log has HARD_EXIT');

  if (process.exitCode === 1) {
    console.error('SELFTEST FAILED');
    process.exit(1);
  }
  console.log('SELFTEST PASSED');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
