'use strict';
// Test offline del filtro privacy (lib/privacy.js). Uso: node scripts/privacy-selftest.js
// Usa solo valori di prova: nessun indirizzo reale dell'agente è scritto qui.
const assert = require('assert');
const pv = require('../lib/privacy');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };

const FAKE = 'Fake1111111111111111111111111111111111Wa11';
const DSN_SOL = '35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4';
const DSN_POL = '0xfc90516a1f736FaC557e09D8853dB80dA192c296';
const OV = '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump';

pv.addPrivate(FAKE);

t('wallet privato mascherato 4…4, anche dentro testo e chiavi', () => {
  const out = pv.clean({ address: FAKE, note: 'saldo di ' + FAKE + ' ok', [FAKE]: 1 });
  assert.strictEqual(out.address, 'Fake…Wa11');
  assert.strictEqual(out.note, 'saldo di Fake…Wa11 ok');
  assert.ok(!JSON.stringify(out).includes(FAKE));
});
t('indirizzi dei token restano interi', () => {
  const s = JSON.stringify(pv.clean({ a: DSN_SOL, b: DSN_POL, c: OV, d: 'https://solscan.io/token/' + DSN_SOL }));
  assert.ok(s.includes(DSN_SOL) && s.includes(DSN_POL) && s.includes(OV));
});
t('IP pubblici nascosti, locali no', () => {
  assert.strictEqual(pv.cleanString('ssh root@203.0.113.7 -p 22'), 'ssh root@IP nascosto -p 22');
  assert.strictEqual(pv.cleanString('bind 127.0.0.1:8787'), 'bind 127.0.0.1:8787');
  assert.strictEqual(pv.cleanString('lan 192.168.1.10'), 'lan 192.168.1.10');
});
t('hostname VPS nascosto', () => {
  assert.strictEqual(pv.cleanString('root@vmi1234567:~#'), 'root@host VPS:~#');
});
t('email nascoste, handle X no', () => {
  assert.strictEqual(pv.cleanString('scrivi a nome.cognome@example.com'), 'scrivi a email nascosta');
  assert.strictEqual(pv.cleanString('segui @ZDOS_Core'), 'segui @ZDOS_Core');
});
t('percorsi assoluti ridotti al nome file, URL intatti', () => {
  assert.strictEqual(pv.cleanString('letto da /opt/zdesk/desk/go.md'), 'letto da go.md');
  assert.strictEqual(pv.cleanString('"/root/.ssh/id"'), '"id"');
  assert.strictEqual(pv.cleanString('https://x-zdos.it/opt/a'), 'https://x-zdos.it/opt/a');
});
t('numeri, null e strutture annidate invariati', () => {
  assert.deepStrictEqual(pv.clean({ a: 1.5, b: null, c: [true, { d: 'ok' }] }), { a: 1.5, b: null, c: [true, { d: 'ok' }] });
});
t('middleware filtra res.json', () => {
  let sent = null;
  const res = { json: (b) => { sent = b; return res; } };
  pv.middleware({}, res, () => {});
  res.json({ w: FAKE });
  assert.strictEqual(sent.w, 'Fake…Wa11');
});
t('wallet agente: link tx rimossi e firme abbreviate', () => {
  const sig = '5'.repeat(44) + 'x'.repeat(44);
  const out = pv.clean({ address: FAKE, transactions: [{ signature: sig, solscan: 'https://solscan.io/tx/' + sig, amount: 1.25 }] });
  assert.strictEqual(out.address, 'Fake…Wa11');
  assert.strictEqual(out.transactions[0].solscan, null);
  assert.strictEqual(out.transactions[0].signature, '5555…xxxx');
  assert.strictEqual(out.transactions[0].amount, 1.25);
});
t('altri wallet: link tx intatti', () => {
  const sig = '5'.repeat(44) + 'x'.repeat(44);
  const url = 'https://solscan.io/tx/' + sig;
  const out = pv.clean({ address: 'So11111111111111111111111111111111111111112', transactions: [{ signature: sig, solscan: url }] });
  assert.strictEqual(out.transactions[0].solscan, url);
  assert.strictEqual(out.transactions[0].signature, sig);
});
t('route del wallet agente: firme abbreviate anche senza indirizzo', () => {
  const sig = '6'.repeat(44) + 'y'.repeat(44);
  let sent = null;
  const res = { json: (b) => { sent = b; return res; } };
  pv.middleware({ path: '/desk' }, res, () => {});
  res.json({ html: '<li>tx: <code>' + sig + '</code> https://solscan.io/tx/' + sig + '</li>' });
  assert.ok(!sent.html.includes(sig) && sent.html.includes('6666…yyyy') && sent.html.includes('link tx rimosso'));
  assert.ok(pv.AGENT_ROUTES.test('/wallet') && pv.AGENT_ROUTES.test('/wallet/desk') && !pv.AGENT_ROUTES.test('/wallet/So11111111111111111111111111111111111111112'));
});
console.log('privacy selftest: ' + n + ' ok');
