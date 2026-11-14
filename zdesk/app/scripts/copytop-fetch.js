#!/usr/bin/env node
'use strict';

/**
 * Refresh the public copy.top discovery cache (read-only).
 * Usage: node scripts/copytop-fetch.js [--force]
 * Writes /workspace/highkali-desk/copy-top.json and copy-top.md
 * Never logs secrets. Does not sign in, deposit, or connect a wallet.
 */

const { refresh, JSON_FILE, MD_FILE } = require('../lib/copytop');

(async () => {
  const force = process.argv.includes('--force');
  const data = await refresh({ force });
  const nT = (data.traders || []).length;
  const nC = (data.coins || []).length;
  const when = data.fetchedAtRome || 'n/d';
  const errs = (data.errors && data.errors.length) ? (' errors=' + data.errors.join(' | ')) : '';
  console.log(`copy.top cache ${data.empty ? 'empty' : 'ok'} traders=${nT} coins=${nC} at ${when}${errs}`);
  console.log('json', JSON_FILE);
  console.log('md', MD_FILE);
  if (nT) {
    const top = data.traders.slice(0, 3).map((t) => {
      const wr = t.winRate != null ? (t.winRate * 100).toFixed(1) + '%' : 'n/d';
      return `#${t.rank} ${t.name} (${t.handle}) ${t.source || ''} pnl=${t.realizedUsd} wr=${wr} closed=${t.closed} copiers=${t.copiers}`;
    });
    console.log('top traders:', top.join(' · '));
  }
  if (nC) {
    const top = data.coins.slice(0, 3).map((c) => `$${c.symbol} ${c.chain} traders=${c.tradersBought} usd=${c.totalUsd}`);
    console.log('top coins:', top.join(' · '));
  }
  process.exit(data.empty && !(nT + nC) ? 1 : 0);
})().catch((e) => {
  console.error('copytop-fetch failed:', e.message || e);
  process.exit(1);
});
