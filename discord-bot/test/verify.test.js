'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const b58 = require('../src/base58');
const { makeNonceStore, messageFor, verifyEd25519, handleVerify } = require('../src/verify');

function wallet() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
  return { pk: b58.encode(raw), sign: (msg) => b58.encode(crypto.sign(null, Buffer.from(msg, 'utf8'), privateKey)) };
}

test('base58 andata e ritorno', () => {
  for (const hex of ['00', '0000ff', 'deadbeef', crypto.randomBytes(32).toString('hex')]) assert.strictEqual(b58.decode(b58.encode(Buffer.from(hex, 'hex'))).toString('hex'), hex);
  assert.strictEqual(b58.decode('So11111111111111111111111111111111111111112').length, 32);
});
test('firma ed25519 valida e non valida', () => {
  const w = wallet();
  assert.ok(verifyEd25519(w.pk, 'ciao', w.sign('ciao')));
  assert.ok(!verifyEd25519(w.pk, 'ciao!', w.sign('ciao')));
  assert.ok(!verifyEd25519(wallet().pk, 'ciao', w.sign('ciao')));
  assert.ok(!verifyEd25519('x', 'ciao', w.sign('ciao')));
});
test('nonce monouso e con scadenza', () => {
  let t = 1000; const s = makeNonceStore({ ttlMs: 500, now: () => t });
  const r = s.create('g1', 'u1');
  assert.ok(s.peek(r.nonce)); assert.ok(s.consume(r.nonce)); assert.strictEqual(s.consume(r.nonce), null);
  const r2 = s.create('g1', 'u1'); t += 600; assert.strictEqual(s.peek(r2.nonce), null);
});
test('handleVerify: ruoli in base ai saldi, nonce consumato', async () => {
  const store = makeNonceStore(); const rec = store.create('111', '222'); const w = wallet();
  let assigned = null;
  const deps = { store, mints: { dsn: 'DSN', velvet: 'VEL' }, tokenBalance: async (o, m) => (m === 'VEL' ? 5n : 0n), assignRoles: async (x) => { assigned = x; return ['+Holder VELVET']; } };
  const bad = await handleVerify({ nonce: rec.nonce, publicKey: w.pk, signature: w.sign('altro') }, deps);
  assert.strictEqual(bad.status, 400); assert.ok(store.peek(rec.nonce), 'firma errata non consuma il nonce');
  const ok = await handleVerify({ nonce: rec.nonce, publicKey: w.pk, signature: w.sign(messageFor(rec)) }, deps);
  assert.strictEqual(ok.status, 200); assert.deepStrictEqual(ok.json.holder, { dsn: false, velvet: true });
  assert.deepStrictEqual(assigned, { guildId: '111', userId: '222', dsn: false, velvet: true });
  const again = await handleVerify({ nonce: rec.nonce, publicKey: w.pk, signature: w.sign(messageFor(rec)) }, deps);
  assert.strictEqual(again.status, 400);
});
test('messaggio dichiara niente transazioni', () => {
  const m = messageFor({ nonce: 'n', guildId: 'g', userId: 'u', exp: 0 });
  assert.match(m, /nessun|non invii transazioni/i);
});
