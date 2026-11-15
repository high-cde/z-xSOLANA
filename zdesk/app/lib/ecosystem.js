'use strict';

/**
 * ZDESK · Ecosistema (sola lettura).
 * Stato dei siti ZDOS1.3 controllato dal server: codice HTTP, latenza, dimensione,
 * sha256 (primi 12 caratteri) del documento e scadenza del certificato TLS.
 * Ultimi articoli dev.to/asapkali dall'API pubblica.
 * Nessun contenuto dei siti viene inoltrato al browser: solo metadati tecnici.
 * VelvetHub (18+) è solo link e stato, nessuna anteprima.
 */
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { cache } = require('./cache');

const STATUS_TTL_MS = 60_000;
const DEVTO_TTL_MS = 10 * 60_000;
const TIMEOUT_MS = Number(process.env.ZDESK_ECO_TIMEOUT_MS || 8000);
const MAX_BYTES = 2 * 1024 * 1024;
const UA = 'zdesk-ecosystem/1.0 (+https://x-zdos.it; sola lettura)';
const DEVTO_USER = 'asapkali';
const DEVTO_API = 'https://dev.to/api/articles?username=' + DEVTO_USER + '&per_page=6';

const SITES = [
  { id: 'hub', name: 'ZDOS Hub', url: 'https://x-zdos.it/', tag: 'Hub · Solana', tone: 'kira',
    note: 'Home dell\'ecosistema: progetti, token, accesso con Phantom.' },
  { id: 'swap', name: 'ZSwap', url: 'https://swap.x-zdos.it/', tag: 'Solana · Swap', tone: 'swap',
    note: 'Esplorazione token, controllo rischi, swap via Jupiter.' },
  { id: 'ide', name: 'Zlang IDE', url: 'https://x-zdos.it/ide/', tag: 'ZLang · Solana devnet', tone: 'kira',
    note: 'Editor e compilatore ZLang nel browser (WASM). Ancoraggio del bytecode su devnet con Phantom.' },
  { id: 'rpg', name: 'Pinguino RPG', url: 'https://swap.x-zdos.it/rpg.html', tag: 'Gioco browser', tone: 'rpg',
    note: 'Gioco pixel nel browser. Simulazione, nessun premio reale.' },
  { id: 'velvet', name: 'VelvetHub', url: 'https://velvet.x-zdos.it/', tag: '18+ · Telegram', tone: 'velvet', adult: true,
    note: 'Riservato ai maggiori di 18 anni. Solo link e stato, nessuna anteprima.' },
  { id: 'devto', name: 'dev.to/asapkali', url: 'https://dev.to/asapkali', tag: 'Blog tecnico', tone: 'git',
    note: 'Articoli tecnici su ZDOS.' },
];

function lib(url) { return url.startsWith('https:') ? https : http; }

/**
 * GET con timeout, senza seguire redirect. Legge al massimo MAX_BYTES.
 * Ritorna { ok, status, ms, bytes, sha, tlsValidTo, tlsDaysLeft, location, error }.
 */
function checkUrl(url, opts = {}) {
  const timeout = opts.timeout || TIMEOUT_MS;
  const started = Date.now();
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    let req;
    try {
      req = lib(url).request(url, {
        method: 'GET',
        headers: { 'User-Agent': UA, Accept: 'text/html,application/json;q=0.9,*/*;q=0.5' },
        agent: false,
        timeout,
        rejectUnauthorized: opts.rejectUnauthorized !== false,
      }, (res) => {
        const ms = Date.now() - started;
        let tlsValidTo = null; let tlsDaysLeft = null;
        try {
          if (res.socket && typeof res.socket.getPeerCertificate === 'function') {
            const c = res.socket.getPeerCertificate();
            if (c && c.valid_to) {
              const d = new Date(c.valid_to);
              if (!Number.isNaN(d.getTime())) {
                tlsValidTo = d.toISOString();
                tlsDaysLeft = Math.floor((d.getTime() - Date.now()) / 86_400_000);
              }
            }
          }
        } catch { /* cert non disponibile */ }
        const hash = crypto.createHash('sha256');
        let bytes = 0; let truncated = false;
        res.on('data', (chunk) => {
          if (truncated) return;
          bytes += chunk.length;
          if (bytes > MAX_BYTES) { truncated = true; res.destroy(); return; }
          hash.update(chunk);
        });
        let ended = false;
        const end = () => { if (ended) return; ended = true; finish({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          ms,
          bytes: truncated ? null : bytes,
          sha: truncated ? null : hash.digest('hex').slice(0, 12),
          tlsValidTo,
          tlsDaysLeft,
          location: res.headers.location ? String(res.headers.location).slice(0, 300) : null,
          error: truncated ? 'risposta oltre 2 MB: non letta per intero' : null,
        }); };
        res.on('end', end);
        res.on('close', end);
        res.on('error', end);
      });
    } catch (e) {
      finish({ ok: false, status: null, ms: Date.now() - started, error: e.message });
      return;
    }
    req.on('timeout', () => { req.destroy(new Error('timeout dopo ' + timeout + ' ms')); });
    req.on('error', (e) => finish({ ok: false, status: null, ms: Date.now() - started, error: e.message }));
    req.end();
  });
}

function getText(url, timeout = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const req = lib(url).get(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, timeout }, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return; }
      let body = ''; let size = 0;
      res.setEncoding('utf8');
      res.on('data', (c) => { size += c.length; if (size > MAX_BYTES) { res.destroy(new Error('risposta troppo grande')); return; } body += c; });
      res.on('end', () => resolve(body));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout dopo ' + timeout + ' ms')));
    req.on('error', reject);
  });
}

function cleanText(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

/** Tiene solo i campi utili e solo URL https su dev.to. */
function parseDevto(json) {
  if (!Array.isArray(json)) throw new Error('risposta dev.to inattesa');
  return json.slice(0, 6).map((a) => {
    const url = typeof a.url === 'string' && /^https:\/\/dev\.to\//.test(a.url) ? a.url : null;
    const tags = Array.isArray(a.tag_list) ? a.tag_list : (typeof a.tag_list === 'string' ? a.tag_list.split(',') : []);
    return {
      title: cleanText(a.title, 200),
      url,
      publishedAt: typeof a.published_at === 'string' ? a.published_at : null,
      readingMinutes: Number.isFinite(a.reading_time_minutes) ? a.reading_time_minutes : null,
      reactions: Number.isFinite(a.public_reactions_count) ? a.public_reactions_count : null,
      comments: Number.isFinite(a.comments_count) ? a.comments_count : null,
      tags: tags.map((t) => cleanText(t, 30)).filter(Boolean).slice(0, 4),
    };
  }).filter((a) => a.title && a.url);
}

let inflight = null;

async function getDevto(fetchText = getText) {
  const key = 'eco:devto';
  const fresh = cache.fresh(key);
  if (fresh) return fresh;
  try {
    const items = parseDevto(JSON.parse(await fetchText(DEVTO_API)));
    return cache.set(key, { user: DEVTO_USER, profile: 'https://dev.to/' + DEVTO_USER, items, checkedAt: new Date().toISOString(), error: null, stale: false }, DEVTO_TTL_MS);
  } catch (e) {
    const old = cache.stale(key);
    if (old) return Object.assign({}, old, { error: e.message, stale: true });
    return { user: DEVTO_USER, profile: 'https://dev.to/' + DEVTO_USER, items: [], checkedAt: new Date().toISOString(), error: e.message, stale: false };
  }
}

async function buildEcosystem(deps = {}) {
  const check = deps.checkUrl || checkUrl;
  const sites = deps.sites || SITES;
  const results = await Promise.all(sites.map(async (s) => {
    const r = await check(s.url);
    return {
      id: s.id, name: s.name, url: s.url, tag: s.tag, tone: s.tone, note: s.note,
      adult: !!s.adult,
      status: r.status, ok: !!r.ok, ms: r.ms,
      bytes: r.bytes == null ? null : r.bytes,
      sha: r.sha || null,
      tlsValidTo: r.tlsValidTo || null,
      tlsDaysLeft: r.tlsDaysLeft == null ? null : r.tlsDaysLeft,
      location: r.location || null,
      error: r.error || null,
    };
  }));
  const devto = await getDevto(deps.fetchText);
  return {
    readOnly: true,
    checkedAt: new Date().toISOString(),
    ttlSeconds: STATUS_TTL_MS / 1000,
    sites: results,
    up: results.filter((r) => r.ok).length,
    total: results.length,
    devto,
    links: {
      x: 'https://x.com/ZDOS_Core',
      github: 'https://github.com/high-cde',
    },
  };
}

/** Con cache 60 s e una sola richiesta in volo alla volta. */
async function getEcosystem(deps) {
  const key = 'eco:status';
  const fresh = cache.fresh(key);
  if (fresh) return Object.assign({}, fresh, { cached: true });
  if (!inflight) {
    inflight = buildEcosystem(deps)
      .then((v) => cache.set(key, v, STATUS_TTL_MS))
      .finally(() => { inflight = null; });
  }
  const v = await inflight;
  return Object.assign({}, v, { cached: false });
}

module.exports = { SITES, checkUrl, parseDevto, getDevto, buildEcosystem, getEcosystem, STATUS_TTL_MS };
