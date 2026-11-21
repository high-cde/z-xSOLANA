'use strict';
const test = require('node:test');
const assert = require('node:assert');
const cmd = require('../src/commands');
const { inviteUrl } = require('../src/invite');
const { makeNonceStore } = require('../src/verify');
const { mintInfo, fakeRpc } = require('./fixtures');
const C = require('../src/constants');

test('definizioni comandi valide per Discord', () => {
  const names = cmd.DEFS.map((d) => d.name);
  assert.deepStrictEqual(names, ['kira', 'radar', 'token', 'stato', 'verifica', 'quest', 'setup-server', 'rubina', 'zara', 'eventi', 'condividi-evento', 'ricordami', 'dimentica', 'bozza-x', 'invita', 'velvet', 'ingresso-18', 'curioso', 'radar-collega', 'radar-scollega', 'badge', 'dev', 'velvetstar', 'aiuto']);
  for (const d of cmd.DEFS) { assert.match(d.name, /^[a-z0-9-]{1,32}$/); assert.ok(d.description.length >= 1 && d.description.length <= 100); }
});
test('/kira con dati simulati', async () => {
  const r = await cmd.kira(C.DSN_SOL, { rpc: fakeRpc({ ['getAccountInfo:' + C.DSN_SOL]: mintInfo({}) }), fetchJson: async () => { throw new Error('offline'); } });
  assert.match(r.embeds[0].title, /K\.I\.R\.A\./); assert.match(r.embeds[0].description, /Mint authority/);
  const bad = await cmd.kira('nope', {}); assert.ok(bad.ephemeral);
});
test('/stato include zdesk locale e segnala i servizi giù', async () => {
  const r = await cmd.stato({ fetchStatus: async (u) => (/quest/.test(u) ? 502 : 200), zdeskJson: async () => ({ ok: true, trading: false }), now: () => 0 });
  const d = r.embeds[0].description;
  assert.match(d, /🔴 \*\*ZQuest\*\* · 502/); assert.match(d, /zdesk API \(locale\)\*\* · ok · .*trading spento/);
  assert.strictEqual(r.embeds[0].color, C.COLORS.warn);
});
test('/token: dati on-chain, niente pump.fun e niente prezzi', async () => {
  const orig = global.fetch;
  global.fetch = async (url, opt) => {
    const b = opt && opt.body ? JSON.parse(opt.body) : {};
    let result;
    if (b.method === 'getAccountInfo') result = { value: { owner: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', data: { parsed: { info: { supply: '1000000000000000', decimals: 6, mintAuthority: null, freezeAuthority: null } } } } };
    else if (b.method === 'eth_call') result = b.params[0].data === '0x313ce567' ? '0x12' : '0x' + (10n ** 30n).toString(16);
    return { ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result }) };
  };
  try {
    const r = await cmd.token({});
    const s = JSON.stringify(r);
    assert.ok(!/pump\.fun/i.test(s)); assert.ok(!/prezzo:|priceUsd|\$0\./i.test(s)); assert.match(s, /Nessuna pool/); assert.match(s, /1\.000\.000\.000/); assert.match(s, /revocata/); assert.match(s, /1\.000\.000\.000\.000/);
  } finally { global.fetch = orig; }
});
test('/radar legge zdesk o dichiara che non risponde', async () => {
  const ok = await cmd.radarZdesk({ zdeskJson: async () => ({ disclaimer: 'Solo lettura.', news: { example: true, fastPairs: [{ symbol: 'ABC', volH1: 12000, liqUsd: 9000, ageMin: 4, mint: 'M1' }] }, kira: { items: [{ symbol: 'XYZ', verdict: 'EVITARE' }] } }) });
  assert.match(ok.embeds[0].description, /ABC/); assert.match(ok.embeds[0].description, /EVITARE/); assert.match(ok.embeds[0].fields[0].value, /dati di esempio/);
  const ko = await cmd.radarZdesk({ zdeskJson: async () => { throw new Error('down'); } });
  assert.match(ko.embeds[0].description, /non risponde/);
});
test('/verifica crea un link monouso, solo in un server', () => {
  const deps = { store: makeNonceStore(), verifyUrl: 'https://x-zdos.it/discord/verify/', roles: C && { dsn: 'Holder $DSN', velvet: 'Holder VELVET' } };
  const r = cmd.verifica({ guildId: '1', userId: '2' }, deps);
  assert.ok(r.ephemeral); assert.match(r.embeds[0].url, /^https:\/\/x-zdos\.it\/discord\/verify\/\?n=/);
  assert.strictEqual(deps.store.size(), 1);
  assert.match(cmd.verifica({ guildId: null, userId: '2' }, deps).content, /dentro il server/);
});
test('/quest e link di invito con permessi minimi', async () => {
  assert.match(cmd.quest().embeds[0].url, /quest\.x-zdos\.it/);
  const u = inviteUrl('123456789012345678');
  assert.match(u, /scope=bot%20applications\.commands/); assert.match(u, /permissions=2251802229722160$/);
});
