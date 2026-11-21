'use strict';
// Client zcomm: pubblica eventi firmati (HMAC-SHA256) sul bus locale tra ZDOS e OurVelvet.
// Mai bloccante: se zcomm non risponde, il comando del bot va avanti lo stesso.
// Nessun dato personale: solo ID tecnici (hash Discord, ID Radar), mai handle o token.
// © 2026 ZDOS1.3 · Licenza ZSEL proprietaria.
const fs = require('fs');
const crypto = require('crypto');
const URL_EV = process.env.ZCOMM_URL || 'http://127.0.0.1:4192/zcomm/api/events';
const KEY_FILE = process.env.ZCOMM_KEY_FILE || '/etc/zcomm/hmac.key';
let key = null;
function readKey() { if (key) return key; try { key = fs.readFileSync(KEY_FILE, 'utf8').trim(); } catch (_) { key = null; } return key; }
function sign(k, ts, body) { return crypto.createHmac('sha256', k).update(String(ts) + '.' + body).digest('hex'); }
async function publish(ev) {
  const k = readKey(); if (!k) return { ok: false, error: 'chiave zcomm non disponibile' };
  const body = JSON.stringify(ev); const ts = Math.floor(Date.now() / 1000);
  try {
    const r = await fetch(URL_EV, { method: 'POST', headers: { 'content-type': 'application/json', 'x-zcomm-ts': String(ts), 'x-zcomm-signature': sign(k, ts, body) }, body, signal: AbortSignal.timeout(3000) });
    return await r.json();
  } catch (e) { return { ok: false, error: e.message }; }
}
const dcId = (userId) => 'dc-' + crypto.createHash('sha256').update('zcomm:dc:' + userId).digest('hex').slice(0, 24);
module.exports = { publish, sign, dcId };
