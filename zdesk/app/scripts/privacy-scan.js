'use strict';
// Controllo finale privacy: cerca IP pubblici della macchina, nome host e indirizzi del
// wallet agente (per impronta sha256, vedi lib/privacy.js) nei file indicati.
// Uso: node scripts/privacy-scan.js <file>...   → exit 1 se trova qualcosa (valori mai stampati per intero).
const fs = require('fs');
const os = require('os');
const pv = require('../lib/privacy');

const extra = String(process.env.ZDESK_PRIVATE_ADDRS || '').split(',').map((x) => x.trim()).filter(Boolean);
extra.forEach(pv.addPrivate);
const ips = [];
for (const list of Object.values(os.networkInterfaces())) {
  for (const i of list || []) {
    if (i.family !== 'IPv4' && i.family !== 4) continue;
    const a = i.address;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(a) || /^172\.(1[6-9]|2\d|3[01])\./.test(a)) continue;
    ips.push(a);
  }
}
(process.env.ZDESK_PRIVATE_IPS || '').split(',').map((x) => x.trim()).filter(Boolean).forEach((a) => ips.push(a));
const host = os.hostname().split('.')[0];
const CAND = /0x[0-9a-fA-F]{64}|0x[0-9a-fA-F]{40}|bc1[02-9ac-hj-np-z]{20,80}|[1-9A-HJ-NP-Za-km-z]{32,44}/g;
let hits = 0;
for (const f of process.argv.slice(2)) {
  let s;
  try { s = fs.readFileSync(f, 'utf8'); } catch { continue; }
  for (const ip of ips) if (s.includes(ip)) { hits++; console.log('PRIVATO: IP della macchina in ' + f); }
  if (host && host.length >= 6 && !/^(localhost|zdesk)$/i.test(host) && s.toLowerCase().includes(host.toLowerCase())) { hits++; console.log('PRIVATO: nome host in ' + f); }
  const seen = new Set();
  for (const m of s.match(CAND) || []) {
    if (seen.has(m)) continue; seen.add(m);
    if (pv.isPrivateAddr(m)) { hits++; console.log('PRIVATO: indirizzo wallet agente ' + pv.mask(m) + ' in ' + f); }
  }
}
if (hits) { console.log('privacy-scan: ' + hits + ' problemi'); process.exit(1); }
console.log('privacy-scan: nessun dato privato');
