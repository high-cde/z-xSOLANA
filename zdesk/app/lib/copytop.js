'use strict';

/**
 * copy.top public discovery feed (sola lettura).
 * Fetches only public pages/APIs. No login, no deposit, no wallet connect,
 * no Privy, no referral (/r/start), no delegated signing, no auto-buy.
 */

const fs = require('fs');
const path = require('path');

const DESK_DIR = process.env.DESK_DIR || '/workspace/highkali-desk';
const JSON_FILE = path.join(DESK_DIR, 'copy-top.json');
const MD_FILE = path.join(DESK_DIR, 'copy-top.md');
const READONLY = /^(1|true|yes)$/i.test(process.env.ZDESK_READONLY || '');

const BASE = 'https://copy.top';
const UA = 'ZDESK-read-only/1.0 (+https://zdesk.x-zdos.it; public discovery, no login)';
const TIMEOUT_MS = 20_000;
const CACHE_MS = 8 * 60 * 1000;
const MAX_TRADERS = 40;
const MAX_COINS = 20;
const HIGH_COPIERS = 50;
const HIGH_WR = 0.85;
const THIN_CLOSED = 30;
const THIN_WITH_COPIERS = 10;

const NOTICE = 'Fonte pubblica copy.top (Polycool LLC / copyfomo), indipendente e non affiliata a fomo o pump.fun. Sola lettura: nessun deposito, nessun collegamento del wallet, nessuna firma delegata. NON è la lista APPROVED. HighKali non compra da questa classifica in automatico.';

let inflight = null;

function romeParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return parts;
}

function romeStamp(d = new Date()) {
  const p = romeParts(d);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} Europe/Rome`;
}

function romeIso(d = new Date()) {
  const p = romeParts(d);
  // November is CET (UTC+1); this feed is labeled Europe/Rome regardless.
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+01:00`;
}

function emptyCopytop(extra) {
  return {
    empty: true,
    message: 'nessun dato ancora',
    source: 'copy.top',
    readOnly: true,
    approved: false,
    autoBuy: false,
    notice: NOTICE,
    traders: [],
    coins: [],
    window: { traders: '30d', coins: '24h' },
    fetchedAt: null,
    fetchedAtRome: null,
    errors: [],
    ...(extra || {}),
  };
}

function allowedUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || u.hostname !== 'copy.top') return false;
  const p = u.pathname;
  if (p.startsWith('/r/')) return false;
  if (p.startsWith('/auth') || p.startsWith('/login')) return false;
  const blocked = [
    '/api/deposit', '/api/withdraw', '/api/me', '/api/wallet', '/api/account',
    '/api/keys', '/api/onboarding', '/api/referral', '/api/copies',
    '/api/fund', '/api/cash', '/api/mfa', '/api/portfolio',
  ];
  if (blocked.some((b) => p === b || p.startsWith(b + '/'))) return false;
  return true;
}

async function fetchText(url) {
  if (!allowedUrl(url)) throw new Error('url non consentito');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': UA,
      },
    });
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      const err = new Error('accesso pubblico bloccato (' + res.status + ')');
      err.status = res.status;
      err.blocked = true;
      throw err;
    }
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }
    return { status: res.status, contentType: res.headers.get('content-type') || '', text };
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url) {
  const { text } = await fetchText(url);
  return JSON.parse(text);
}

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sourceLabel(row) {
  const plats = Array.isArray(row.platforms) ? row.platforms.map((p) => String(p).toLowerCase()) : [];
  const src = String(row.followersSource || '').toLowerCase();
  const hasFomo = plats.includes('fomo') || src === 'fomo' || src === 'all';
  const hasPump = plats.includes('pumpfun') || plats.includes('pump.fun') || src === 'pumpfun' || src === 'pump.fun';
  if (hasFomo && hasPump) return 'fomo + pump.fun';
  if (hasPump) return 'pump.fun';
  if (hasFomo) return 'fomo';
  if (plats.length) return plats.join(', ');
  return src || null;
}

function publicFlags(stats) {
  const flags = [];
  const seen = new Set();
  const badges = (stats && Array.isArray(stats.badges)) ? stats.badges : [];
  for (const b of badges) {
    const label = String((b && b.label) || '').trim();
    const tone = String((b && b.tone) || '');
    if (!label) continue;
    const low = label.toLowerCase();
    if (low === 'clean' || tone === 'profit') continue;
    const key = low;
    if (seen.has(key)) continue;
    seen.add(key);
    flags.push({
      label,
      tone: tone === 'loss' || tone === 'warn' ? tone : 'warn',
      detail: b && b.detail ? String(b.detail) : '',
    });
  }
  const fp = stats && stats.fairPlay ? String(stats.fairPlay) : null;
  if (fp === 'flagged' || fp === 'watch') {
    if (!seen.has('fair play')) {
      flags.push({
        label: fp === 'flagged' ? 'fair play: flagged' : 'fair play: watch',
        tone: fp === 'flagged' ? 'loss' : 'warn',
        detail: '',
      });
    }
  }
  return flags;
}

function deriveWarnings(row, stats, flags) {
  const warnings = [];
  const copiers = num(row.copiers) || 0;
  const closed = stats && stats.closed != null ? num(stats.closed) : null;
  const wr = stats && stats.winRate != null ? num(stats.winRate) : null;
  if (copiers >= HIGH_COPIERS) {
    warnings.push('molti copiatori');
  }
  if (copiers >= HIGH_COPIERS && closed != null && closed < THIN_WITH_COPIERS) {
    warnings.push('pochi trade chiusi, tanti copiatori');
  }
  if (wr != null && wr >= HIGH_WR && (closed == null || closed < THIN_CLOSED)) {
    warnings.push('win rate alto su pochi trade chiusi');
  }
  for (const f of flags) {
    const low = f.label.toLowerCase();
    if (low.includes('sells into copiers') || low.includes('vende')) {
      if (!warnings.includes('vende sui copiatori')) warnings.push('vende sui copiatori');
    }
    if (low.includes('flipper')) {
      if (!warnings.includes('flipper')) warnings.push('flipper');
    }
  }
  return warnings;
}

function normalizeTrader(row) {
  if (!row || !row.handle) return null;
  const handle = String(row.handle).replace(/[^\w.-]/g, '').slice(0, 64);
  if (!handle) return null;
  const stats = row.stats && typeof row.stats === 'object' ? row.stats : {};
  const flags = publicFlags(stats);
  const profilePath = '/t/' + handle;
  return {
    rank: num(row.rank),
    handle,
    name: row.name ? String(row.name).slice(0, 80) : handle,
    source: sourceLabel(row),
    realizedUsd: num(stats.realized != null ? stats.realized : stats.realized30),
    winRate: num(stats.winRate),
    closed: stats.closed != null ? num(stats.closed) : null,
    wins: stats.wins != null ? num(stats.wins) : null,
    copiers: num(row.copiers) || 0,
    fairPlay: stats.fairPlay ? String(stats.fairPlay) : null,
    flags,
    warnings: deriveWarnings(row, stats, flags),
    profilePath,
    profileUrl: BASE + profilePath,
  };
}

function normalizeCoin(row) {
  if (!row) return null;
  const chain = String(row.chain || 'solana').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'solana';
  const token = String(row.token || row.mint || row.address || '').trim();
  if (!token || token.length < 8 || token.length > 100) return null;
  if (!/^[A-Za-z0-9]+$/.test(token)) return null;
  const symbol = String(row.symbol || row.ticker || '').replace(/^\$/, '').slice(0, 24);
  const tokenPath = `/token/${chain}/${token}`;
  return {
    symbol: symbol || shortToken(token),
    token,
    chain,
    tradersBought: num(row.traders != null ? row.traders : row.tradersBought),
    totalUsd: num(row.usd != null ? row.usd : row.totalUsd),
    tokenPath,
    tokenUrl: BASE + tokenPath,
  };
}

function shortToken(t) {
  if (!t) return '';
  if (t.length <= 10) return t;
  return t.slice(0, 4) + '…' + t.slice(-4);
}

function parseUsdLabel(s) {
  if (!s) return null;
  const m = String(s).trim().replace(/,/g, '').match(/\$?\s*([0-9]+(?:\.[0-9]+)?)\s*([kmb])?/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const u = (m[2] || '').toLowerCase();
  const mul = u === 'k' ? 1e3 : u === 'm' ? 1e6 : u === 'b' ? 1e9 : 1;
  return n * mul;
}

function parseSeoCoins(html) {
  if (!html) return [];
  const seo = (html.match(/<div id="seo">([\s\S]*?)<\/div>/) || [])[1] || html;
  const coins = [];
  const re = /<li><a href="(\/token\/([a-z0-9]+)\/([A-Za-z0-9]+))">\$?([^<]+)<\/a>\s*·\s*([a-z0-9]+)\s*·\s*([0-9][0-9,]*)\s*traders bought\s*·\s*\$([0-9.,]+\s*[kmb]?)\s*in total<\/li>/gi;
  let m;
  while ((m = re.exec(seo))) {
    const coin = normalizeCoin({
      token: m[3],
      chain: m[2] || m[5],
      symbol: String(m[4] || '').trim(),
      traders: Number(String(m[6]).replace(/,/g, '')),
      usd: parseUsdLabel(m[7]),
    });
    if (coin) coins.push(coin);
    if (coins.length >= MAX_COINS) break;
  }
  return coins;
}

function fmtUsdMd(n) {
  if (n == null || !Number.isFinite(n)) return 'n/d';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'm';
  if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(1) + 'k';
  return sign + '$' + abs.toFixed(0);
}

function fmtPctMd(n) {
  if (n == null || !Number.isFinite(n)) return 'n/d';
  return (n * 100).toFixed(1) + '%';
}

function toMarkdown(data) {
  const lines = [];
  lines.push('# copy.top — sola lettura (fonte pubblica)');
  lines.push('');
  lines.push('**NON è la lista APPROVED. Nessun buy automatico.**');
  lines.push('');
  lines.push(NOTICE);
  lines.push('');
  lines.push('- Aggiornato: **' + (data.fetchedAtRome || 'n/d') + '**');
  lines.push('- Finestra trader: ' + ((data.window && data.window.traders) || '30d') + ' (realized PnL)');
  lines.push('- Finestra monete: ' + ((data.window && data.window.coins) || '24h'));
  if (data.errors && data.errors.length) {
    lines.push('- Avvisi fetch: ' + data.errors.join('; '));
  }
  lines.push('');
  lines.push('## Classifica trader (pubblica)');
  lines.push('');
  lines.push('| # | Trader | Fonte | PnL realizzato | Win rate | Chiusi | Copiatori | Flag / avvisi | Profilo |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  if (!data.traders.length) {
    lines.push('| — | nessun dato ancora |  |  |  |  |  |  |  |');
  } else {
    for (const t of data.traders) {
      const flags = [
        ...(t.flags || []).map((f) => f.label),
        ...(t.warnings || []),
      ];
      const uniq = [...new Set(flags)];
      lines.push([
        '',
        t.rank != null ? t.rank : '',
        (t.name || t.handle) + ' (`' + t.handle + '`)',
        t.source || '—',
        fmtUsdMd(t.realizedUsd),
        fmtPctMd(t.winRate),
        t.closed != null ? String(t.closed) : 'n/d',
        t.copiers != null ? String(t.copiers) : '0',
        uniq.length ? uniq.join(', ') : '—',
        t.profilePath || '',
        '',
      ].join(' | '));
    }
  }
  lines.push('');
  lines.push('## Monete che i top trader stanno comprando');
  lines.push('');
  lines.push('| Token | Chain | Mint | Trader che hanno comprato | Totale $ | Percorso |');
  lines.push('|---|---|---|---|---|---|');
  if (!data.coins.length) {
    lines.push('| — |  |  | nessun dato ancora |  |  |');
  } else {
    for (const c of data.coins) {
      lines.push([
        '',
        '$' + (c.symbol || ''),
        c.chain || '',
        '`' + c.token + '`',
        c.tradersBought != null ? String(c.tradersBought) : 'n/d',
        fmtUsdMd(c.totalUsd),
        c.tokenPath || '',
        '',
      ].join(' | '));
    }
  }
  lines.push('');
  lines.push('Un wallet di questa classifica non diventa APPROVED da solo: passa prima da GMGN Watch e dallo sniffer.');
  lines.push('');
  return lines.join('\n');
}

function writeAtomic(file, content) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

function persist(data) {
  if (READONLY) return;
  if (!fs.existsSync(DESK_DIR)) fs.mkdirSync(DESK_DIR, { recursive: true });
  writeAtomic(JSON_FILE, JSON.stringify(data, null, 2) + '\n');
  writeAtomic(MD_FILE, toMarkdown(data));
}

async function fetchPublic() {
  const errors = [];
  let traders = [];
  let coins = [];
  const discoverUrl = BASE + '/api/discover?window=30d&sort=realized&dir=desc&chain=all&limit=' + MAX_TRADERS;
  const flowUrl = BASE + '/api/flow?side=buy&window=24h&limit=' + MAX_COINS;

  try {
    const disc = await fetchJson(discoverUrl);
    const rows = Array.isArray(disc && disc.rows) ? disc.rows : [];
    traders = rows.map(normalizeTrader).filter(Boolean).slice(0, MAX_TRADERS);
    if (!traders.length) errors.push('classifica trader vuota');
  } catch (e) {
    errors.push('trader: ' + (e.blocked ? 'blocco pubblico' : (e.message || String(e))));
  }

  try {
    const flow = await fetchJson(flowUrl);
    const rows = Array.isArray(flow && flow.rows) ? flow.rows : [];
    coins = rows.map(normalizeCoin).filter(Boolean).slice(0, MAX_COINS);
  } catch (e) {
    errors.push('flow monete: ' + (e.blocked ? 'blocco pubblico' : (e.message || String(e))));
  }

  if (!coins.length) {
    try {
      const page = await fetchText(BASE + '/coins');
      coins = parseSeoCoins(page.text).slice(0, MAX_COINS);
      if (coins.length && !errors.some((x) => x.startsWith('flow'))) {
        // used HTML fallback only
      } else if (!coins.length) {
        const home = await fetchText(BASE + '/');
        coins = parseSeoCoins(home.text).slice(0, MAX_COINS);
      }
      if (!coins.length) errors.push('monete: nessun dato pubblico');
    } catch (e) {
      errors.push('monete html: ' + (e.blocked ? 'blocco pubblico' : (e.message || String(e))));
    }
  }

  const now = new Date();
  const empty = !traders.length && !coins.length;
  return {
    empty,
    message: empty ? 'nessun dato ancora' : null,
    source: 'copy.top',
    readOnly: true,
    approved: false,
    autoBuy: false,
    notice: NOTICE,
    traders,
    coins,
    window: { traders: '30d', coins: '24h' },
    fetchedAt: now.toISOString(),
    fetchedAtRome: romeStamp(now),
    errors,
  };
}

async function refresh(opts) {
  const force = opts && opts.force;
  if (READONLY && !(opts && opts.allowReadonlyWrite)) {
    return readPublicCopytop();
  }
  if (!force) {
    const cached = readCacheFile();
    if (cached && cached.fetchedAt && (Date.now() - Date.parse(cached.fetchedAt) < CACHE_MS) && !cached.empty) {
      return cached;
    }
  }
  if (inflight) return inflight;
  inflight = (async () => {
    const data = await fetchPublic();
    if (!data.empty) persist(data);
    else {
      // keep previous cache if the live fetch came back empty/blocked
      const prev = readCacheFile();
      if (prev && !prev.empty) {
        prev.errors = [...(prev.errors || []), ...(data.errors || []), 'fetch vuoto, tenuto il cache precedente'];
        return prev;
      }
      persist(data);
    }
    return data;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

function readCacheFile() {
  try {
    if (!fs.existsSync(JSON_FILE)) return null;
    const raw = fs.readFileSync(JSON_FILE, 'utf8').trim();
    if (!raw || raw === '{}' || raw === '[]') return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return sanitizePublic(data);
  } catch {
    return null;
  }
}

function sanitizePublic(data) {
  const traders = Array.isArray(data.traders) ? data.traders.map((t) => ({
    rank: num(t && t.rank),
    handle: t && t.handle ? String(t.handle).slice(0, 64) : '',
    name: t && t.name ? String(t.name).slice(0, 80) : '',
    source: t && t.source ? String(t.source).slice(0, 40) : null,
    realizedUsd: num(t && t.realizedUsd),
    winRate: num(t && t.winRate),
    closed: t && t.closed != null ? num(t.closed) : null,
    wins: t && t.wins != null ? num(t.wins) : null,
    copiers: num(t && t.copiers) || 0,
    fairPlay: t && t.fairPlay ? String(t.fairPlay).slice(0, 24) : null,
    flags: Array.isArray(t && t.flags) ? t.flags.slice(0, 8).map((f) => ({
      label: String((f && f.label) || '').slice(0, 80),
      tone: String((f && f.tone) || 'warn').slice(0, 16),
      detail: String((f && f.detail) || '').slice(0, 200),
    })) : [],
    warnings: Array.isArray(t && t.warnings) ? t.warnings.map((w) => String(w).slice(0, 80)).slice(0, 8) : [],
    profilePath: t && t.profilePath ? String(t.profilePath).slice(0, 80) : null,
    profileUrl: t && t.profileUrl ? String(t.profileUrl).slice(0, 120) : null,
  })).filter((t) => t.handle).slice(0, MAX_TRADERS) : [];

  const coins = Array.isArray(data.coins) ? data.coins.map((c) => ({
    symbol: c && c.symbol ? String(c.symbol).slice(0, 24) : '',
    token: c && c.token ? String(c.token).slice(0, 100) : '',
    chain: c && c.chain ? String(c.chain).slice(0, 24) : '',
    tradersBought: num(c && c.tradersBought),
    totalUsd: num(c && c.totalUsd),
    tokenPath: c && c.tokenPath ? String(c.tokenPath).slice(0, 160) : null,
    tokenUrl: c && c.tokenUrl ? String(c.tokenUrl).slice(0, 200) : null,
  })).filter((c) => c.token).slice(0, MAX_COINS) : [];

  const empty = !traders.length && !coins.length;
  return {
    empty,
    message: empty ? (data.message || 'nessun dato ancora') : null,
    source: 'copy.top',
    readOnly: true,
    approved: false,
    autoBuy: false,
    notice: NOTICE,
    traders,
    coins,
    window: {
      traders: (data.window && data.window.traders) || '30d',
      coins: (data.window && data.window.coins) || '24h',
    },
    fetchedAt: data.fetchedAt ? String(data.fetchedAt) : null,
    fetchedAtRome: data.fetchedAtRome ? String(data.fetchedAtRome) : null,
    errors: Array.isArray(data.errors) ? data.errors.map((e) => String(e).slice(0, 200)).slice(0, 8) : [],
  };
}

function readPublicCopytop() {
  const cached = readCacheFile();
  if (!cached) return emptyCopytop();
  if (cached.empty && !(cached.traders && cached.traders.length) && !(cached.coins && cached.coins.length)) {
    return emptyCopytop({
      fetchedAt: cached.fetchedAt,
      fetchedAtRome: cached.fetchedAtRome,
      errors: cached.errors,
    });
  }
  return cached;
}

function maybeRefreshInBackground() {
  if (READONLY) return;
  const cached = readCacheFile();
  const age = cached && cached.fetchedAt ? Date.now() - Date.parse(cached.fetchedAt) : Infinity;
  if (!Number.isFinite(age) || age > CACHE_MS) {
    refresh().catch((e) => console.error('copytop refresh', e.message || e));
  }
}

module.exports = {
  readPublicCopytop,
  refresh,
  maybeRefreshInBackground,
  emptyCopytop,
  NOTICE,
  JSON_FILE,
  MD_FILE,
  CACHE_MS,
};
