'use strict';

/**
 * ZDESK · filtro privacy per le risposte /api/* (sola lettura).
 * Maschera gli indirizzi del wallet agente (primi 4…ultimi 4), nasconde IP pubblici,
 * nomi host del VPS, email e percorsi assoluti del server.
 * Gli indirizzi privati non sono scritti qui: arrivano dai moduli già presenti
 * (wallet.js, antifake.js), da ZDESK_PRIVATE_ADDRS (separati da virgola) e da un
 * elenco di impronte sha256, così il codice non li ripete in chiaro.
 * Indirizzi dei token, domini e handle pubblici non vengono toccati.
 */
const crypto = require('crypto');

// sha256 degli indirizzi del wallet agente (Solana, EVM, Bitcoin, Sui), EVM/BTC/Sui in minuscolo.
const PRIVATE_SHA = new Set([
  '30025198626feedd90fd563bc9868978797246c72acc20da35ac0057e723d828',
  '91a0f49803ec574832e9a4196da9f6dd637164ef20da7a366d1c1e2b0de46187',
  '9df5cff5ce8714c5b4fc823ec28517dd98e727a56492256b4c34fbf5df6180ec',
  '8db1ba12a73f468fb52a2a32b47e5b386d5e1ade8e1a4afe586945c70c620c6f',
]);

const CANDIDATE = /\b(?:0x[0-9a-fA-F]{64}|0x[0-9a-fA-F]{40}|bc1[02-9ac-hj-np-z]{20,80}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/g;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const HOSTNAME = /\bvmi\d{5,}\b/gi;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;
const ABS_PATH = /(^|[\s"'`(=:])\/(?:root|home\/[^/\s"'`)]+|opt|workspace|var|etc|srv|tmp)(?:\/[^\s"'`)<>,;]+)+/g;

const known = new Map();
const extra = new Set();

function mask(a) { return a.length > 10 ? a.slice(0, 4) + '…' + a.slice(-4) : '…'; }
function norm(a) { return /^(0x|bc1)/i.test(a) ? a.toLowerCase() : a; }

function isPrivateAddr(a) {
  if (extra.has(a)) return true;
  if (known.has(a)) return known.get(a);
  const hit = PRIVATE_SHA.has(crypto.createHash('sha256').update(norm(a)).digest('hex'));
  if (known.size > 20000) known.clear();
  known.set(a, hit);
  return hit;
}

function addPrivate(a) {
  if (typeof a === 'string' && a.length >= 26) {
    extra.add(a);
    PRIVATE_SHA.add(crypto.createHash('sha256').update(norm(a)).digest('hex'));
  }
}

function publicIp(ip) {
  const p = ip.split('.').map(Number);
  if (p.some((n) => n > 255)) return false;
  if (p[0] === 127 || p[0] === 10 || p[0] === 0) return false;
  if (p[0] === 192 && p[1] === 168) return false;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return false;
  if (p[0] === 169 && p[1] === 254) return false;
  return true;
}

function cleanString(s, ctx) {
  if (typeof s !== 'string' || s.length < 7) return s;
  let out = s;
  if (/[0-9A-Za-z]{26,}/.test(out)) {
    out = out.replace(CANDIDATE, (m) => {
      if (!isPrivateAddr(m)) return m;
      if (ctx) ctx.hit = true;
      return mask(m);
    });
  }
  if (/\d+\.\d+\.\d+\.\d+/.test(out)) out = out.replace(IPV4, (m) => (publicIp(m) ? 'IP nascosto' : m));
  if (/vmi\d/i.test(out)) out = out.replace(HOSTNAME, 'host VPS');
  if (out.includes('@')) out = out.replace(EMAIL, 'email nascosta');
  if (out.includes('/')) {
    out = out.replace(ABS_PATH, (m, pre) => {
      const p = m.slice(pre.length).replace(/\/+$/, '');
      return pre + p.slice(p.lastIndexOf('/') + 1);
    });
  }
  return out;
}

// Link a transazioni su explorer: dalla firma si risale al wallet che l'ha firmata.
const TX_URL = /^https?:\/\/(?:www\.)?(?:solscan\.io|explorer\.solana\.com|solana\.fm|orb\.helius\.dev|xray\.helius\.xyz)\/(?:tx|transaction)\//i;
// Firma Solana (base58, 64 byte → 86-88 caratteri).
const SIG = /[1-9A-HJ-NP-Za-km-z]{80,90}/g;
const TX_URL_IN = /https?:\/\/(?:www\.)?(?:solscan\.io|explorer\.solana\.com|solana\.fm|orb\.helius\.dev|xray\.helius\.xyz)\/(?:tx|transaction)\/[1-9A-HJ-NP-Za-km-z]{80,90}[^\s"'<]*/gi;
// Route che riguardano sempre l'attività del wallet agente (diario desk, wallet live,
// copy trader, ninja, antifake): firme e link tx sempre abbreviati/rimossi.
const AGENT_ROUTES = /^\/(?:(?:desk|copytrader|ninja|antifake)(?:\/.*)?|wallet(?:\/desk)?\/?)$/;

function cleanWith(v, ctx, depth) {
  if (depth > 40) return v;
  if (typeof v === 'string') return cleanString(v, ctx);
  if (Array.isArray(v)) return v.map((x) => cleanWith(x, ctx, depth + 1));
  if (v && typeof v === 'object') {
    if (v instanceof Date) return v;
    const o = {};
    for (const k of Object.keys(v)) o[cleanString(k, ctx)] = cleanWith(v[k], ctx, depth + 1);
    return o;
  }
  return v;
}

/** Nelle risposte che riguardano il wallet agente: niente link a transazioni, firme abbreviate. */
function stripTx(v, depth = 0) {
  if (depth > 40) return v;
  if (typeof v === 'string') {
    if (TX_URL.test(v)) return null;
    if (v.length < 80) return v;
    return v.replace(TX_URL_IN, 'link tx rimosso').replace(SIG, (m) => mask(m));
  }
  if (Array.isArray(v)) return v.map((x) => stripTx(x, depth + 1));
  if (v && typeof v === 'object') {
    if (v instanceof Date) return v;
    const o = {};
    for (const k of Object.keys(v)) o[k] = stripTx(v[k], depth + 1);
    return o;
  }
  return v;
}

function clean(v, forceTx = false) {
  const ctx = { hit: false };
  const out = cleanWith(v, ctx, 0);
  return ctx.hit || forceTx ? stripTx(out) : out;
}

/** Middleware Express: filtra res.json su tutte le route /api/*. */
function middleware(req, res, next) {
  const orig = res.json.bind(res);
  const agentRoute = AGENT_ROUTES.test(String(req.path || ''));
  res.json = (body) => orig(clean(body, agentRoute));
  next();
}

module.exports = { clean, cleanString: (x) => cleanString(x), mask, middleware, addPrivate, isPrivateAddr, stripTx, AGENT_ROUTES };
