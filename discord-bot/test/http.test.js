'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const b58 = require('../src/base58');
const { makeServer } = require('../src/http');
const { makeNonceStore, messageFor } = require('../src/verify');

test('API verifica: message + verify', async () => {
  const store = makeNonceStore(); const rec = store.create('9', '8');
  const deps = { store, mints: { dsn: 'D', velvet: 'V' }, tokenBalance: async (o, m) => (m === 'D' ? 1n : 0n), assignRoles: async () => ['+Holder $DSN'], discordReady: () => false };
  const srv = makeServer(deps); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port + '/discord/api';
  try {
    assert.deepStrictEqual(await (await fetch(base + '/health')).json(), { ok: true, discord: false });
    const m = await (await fetch(base + '/message?n=' + rec.nonce)).json();
    assert.strictEqual(m.message, messageFor(rec));
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pk = b58.encode(Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url'));
    const sig = b58.encode(crypto.sign(null, Buffer.from(m.message), privateKey));
    const r = await fetch(base + '/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nonce: rec.nonce, publicKey: pk, signature: sig }) });
    const j = await r.json(); assert.strictEqual(r.status, 200); assert.deepStrictEqual(j.holder, { dsn: true, velvet: false });
    assert.strictEqual((await fetch(base + '/message?n=' + rec.nonce)).status, 404);
    assert.strictEqual((await fetch(base + '/verify', { method: 'POST', body: '{' })).status, 400);
  } finally { srv.close(); }
});
