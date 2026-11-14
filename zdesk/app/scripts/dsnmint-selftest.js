'use strict';
const assert = require('assert');
const sources = require('../lib/sources');

const OFFICIAL = '35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4';
const LEGACY = 'EnxZzNG8ZarHt1Tez4ipu5yUnXj8rAbyAnXttxnMpump';
const POLYGON = '0xfc90516a1f736FaC557e09D8853dB80dA192c296';
const OV = '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump';

const list = sources.WATCHLIST;
assert.ok(Array.isArray(list) && list.length >= 3, 'WATCHLIST deve avere almeno 3 voci');

const dsn = list.find((w) => w.mint === OFFICIAL);
const legacy = list.find((w) => w.mint === LEGACY);
const ov = list.find((w) => w.mint === OV);
const dsnAsLegacy = list.find((w) => w.mint === LEGACY && w.symbol === '$DSN');

assert.ok(dsn, 'manca $DSN ufficiale in WATCHLIST');
assert.strictEqual(dsn.symbol, '$DSN');
assert.strictEqual(dsn.decimals, 6);
assert.strictEqual(dsn.program, 'token-2022');
assert.ok(/Token-2022/i.test(dsn.note), 'nota $DSN deve citare Token-2022');
assert.ok(dsn.note.includes(POLYGON), 'nota $DSN deve citare il mint Polygon per esteso');
assert.ok(/nessuna pair/i.test(dsn.note), 'nota $DSN deve dire che non c\'è ancora una pair');

assert.ok(legacy, 'manca xZDOS legacy in WATCHLIST');
assert.notStrictEqual(legacy.symbol, '$DSN', 'EnxZ non deve più essere etichettato $DSN');
assert.ok(/legacy, non \$DSN ufficiale/i.test(legacy.note), 'nota legacy non conforme');
assert.ok(!dsnAsLegacy, 'EnxZ non deve avere symbol $DSN');

assert.ok(ov, 'manca $OV');
assert.strictEqual(ov.symbol, '$OV');

assert.strictEqual(sources.DSN_SOLANA_MINT, OFFICIAL);
assert.strictEqual(sources.DSN_POLYGON, POLYGON);
assert.strictEqual(sources.DSN_LEGACY_PUMP_MINT, LEGACY);

// Funzioni di normalizzazione: pair assente e payload vuoto non devono lanciare.
assert.strictEqual(sources.bestSolanaPair(null, OFFICIAL), null);
assert.strictEqual(sources.bestSolanaPair([], OFFICIAL), null);
assert.strictEqual(sources.bestSolanaPair(undefined, OFFICIAL), null);
assert.strictEqual(sources.normalizeDsPair(null), null);
assert.strictEqual(sources.normalizeDsPair(undefined), null);
const scored = sources.attachScore({ mint: OFFICIAL, noPair: true }, null);
assert.ok(scored);
assert.ok('score' in scored);

console.log('dsnmint-selftest OK');
