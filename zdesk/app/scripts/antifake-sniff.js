#!/usr/bin/env node
'use strict';

const { sniff, isValidPubkey } = (() => {
  const a = require('../lib/antifake');
  const { isValidPubkey } = require('../lib/sources');
  return { sniff: a.sniff, isValidPubkey };
})();

function arg(name, short) {
  const i = process.argv.indexOf('--' + name);
  if (i >= 0) return process.argv[i + 1];
  if (short) {
    const j = process.argv.indexOf('-' + short);
    if (j >= 0) return process.argv[j + 1];
  }
  return null;
}

async function main() {
  const mint = arg('mint', 'm') || process.argv[2];
  const wallet = arg('wallet', 'w') || process.argv[3];
  const signalPrice = arg('price', 'p');
  const signalTs = arg('since', 's');
  if (!mint || !wallet) {
    console.error('uso: antifake-sniff.js --mint <mint> --wallet <source> [--price <usd>] [--since <iso|unix>]');
    process.exit(2);
  }
  const result = await sniff({
    mint,
    sourceWallet: wallet,
    signalPrice: signalPrice ? Number(signalPrice) : undefined,
    signalTs: signalTs || undefined,
  });
  const slim = { ...result };
  delete slim.history;
  console.log(JSON.stringify(slim, null, 2));
  process.exit(result.allowBuy ? 0 : 1);
}

main().catch((e) => {
  console.error(e && e.stack || e);
  process.exit(2);
});
