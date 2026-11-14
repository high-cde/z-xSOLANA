'use strict';

/**
 * ZDOS Radar — sezione di sola lettura per ZDESK.
 *
 * - X Trust: legge DESK_DIR/radar-x.json scritto dall'agente (nessuna chiamata X da zdesk).
 * - Token K.I.R.A.: controlli anti-rug su pochi mint, riusando sources.getTokenDetail
 *   (DexScreener + RugCheck + RPC, già in cache). Calcolo in background, max 12 mint,
 *   un mint ogni ~1,2 s, risultato in cache 5 minuti. La richiesta HTTP non aspetta mai la rete.
 * - News anticipo: DESK_DIR/radar-news.json (agente) + nuove pair veloci dalla cache già esistente.
 * - Watchlist: DESK_DIR/radar-watch.json (agente o doc) + watchlist desk di sources.
 *
 * Solo GET. Nessuna chiave. Nessun trade. Nessuna scrittura su disco.
 */

const fs = require('fs');
const path = require('path');
const sources = require('./sources');
const { cache } = require('./cache');
const { readPublicAntifake } = require('./antifake');

const DESK_DIR = process.env.DESK_DIR || '/workspace/highkali-desk';
const FILES = {
  x: 'radar-x.json',
  news: 'radar-news.json',
  watch: 'radar-watch.json',
  survivors: 'survivors.md',
};
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOKENS = 12;
const KIRA_TTL_MS = 5 * 60_000;
const FILE_TTL_MS = 20_000;
const STEP_DELAY_MS = 1200;
const FAST_MIN_VOL_H1 = 10_000;
const LABELS = new Set(['da_seguire', 'da_osservare', 'evitare']);
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FAMOUS = new Set([
  'sol', 'solana', 'btc', 'bitcoin', 'eth', 'ethereum', 'usdc', 'usdt', 'jup', 'jupiter',
  'bonk', 'wif', 'dogwifhat', 'popcat', 'trump', 'melania', 'pepe', 'doge', 'ray', 'raydium',
  'pump', 'pengu', 'fartcoin', 'ai16z',
]);

function safePath(name) {
  const resolved = path.resolve(path.join(DESK_DIR, name));
  if (!resolved.startsWith(path.resolve(DESK_DIR) + path.sep)) throw new Error('path non consentito');
  return resolved;
}

function readFileSafe(name) {
  try {
    const p = safePath(name);
    const st = fs.statSync(p);
    if (st.size > MAX_FILE_BYTES) return { ok: false, error: 'file troppo grande', mtime: st.mtime.toISOString() };
    return { ok: true, text: fs.readFileSync(p, 'utf8'), mtime: st.mtime.toISOString() };
  } catch (e) {
    return { ok: false, error: e.code === 'ENOENT' ? 'file assente' : (e.message || String(e)) };
  }
}

function readJsonFile(name) {
  const key = 'radar:file:' + name;
  const fresh = cache.fresh(key);
  if (fresh) return fresh;
  const f = readFileSafe(name);
  let out;
  if (!f.ok) out = { ok: false, error: f.error, mtime: f.mtime || null, data: null };
  else {
    try { out = { ok: true, mtime: f.mtime, data: JSON.parse(f.text) }; }
    catch (e) { out = { ok: false, mtime: f.mtime, error: 'JSON non valido: ' + e.message, data: null }; }
  }
  cache.set(key, out, FILE_TTL_MS);
  return out;
}

function str(v, max = 280) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ---------- X Trust ---------- */

function cleanXAccount(a) {
  if (!a || typeof a !== 'object') return null;
  const handle = str(a.handle, 32).replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  const label = LABELS.has(a.label) ? a.label : null;
  const score = num(a.score);
  if (!label || score == null || score < 0 || score > 100) return null;
  const s = a.signals && typeof a.signals === 'object' ? a.signals : {};
  const shilled = Array.isArray(a.shilled) ? a.shilled.slice(0, 20).map((t) => ({
    mint: B58.test(str(t && t.mint, 44)) ? str(t.mint, 44) : null,
    symbol: str(t && t.symbol, 24),
    postedAt: str(t && t.postedAt, 40),
    outcome: str(t && t.outcome, 24),
    changePct: num(t && t.changePct),
  })).filter((t) => t.mint || t.symbol) : [];
  return {
    handle,
    label,
    score: Math.round(score),
    checkedAt: str(a.checkedAt, 40),
    signals: {
      accountAgeDays: num(s.accountAgeDays),
      verified: typeof s.verified === 'boolean' ? s.verified : null,
      followers: num(s.followers),
      following: num(s.following),
      engagementRate: num(s.engagementRate),
      shillHitRate: num(s.shillHitRate),
      walletProof: ['confermato', 'non_confermato', 'nessun_wallet', 'n/d'].includes(s.walletProof) ? s.walletProof : 'n/d',
      deletedPosts: num(s.deletedPosts),
    },
    shilled,
    reasons: Array.isArray(a.reasons) ? a.reasons.slice(0, 8).map((r) => str(r, 200)).filter(Boolean) : [],
  };
}

function getXTrust() {
  const f = readJsonFile(FILES.x);
  if (!f.ok) return { ok: false, file: FILES.x, error: f.error, mtime: f.mtime, accounts: [], example: false };
  const d = f.data || {};
  const raw = Array.isArray(d.accounts) ? d.accounts : [];
  const accounts = raw.map(cleanXAccount).filter(Boolean).sort((a, b) => b.score - a.score);
  return {
    ok: true,
    file: FILES.x,
    mtime: f.mtime,
    generatedAt: str(d.generatedAt, 40) || null,
    example: d.example === true,
    weights: d.weights && typeof d.weights === 'object' ? d.weights : null,
    accounts,
    dropped: raw.length - accounts.length,
    counts: {
      da_seguire: accounts.filter((a) => a.label === 'da_seguire').length,
      da_osservare: accounts.filter((a) => a.label === 'da_osservare').length,
      evitare: accounts.filter((a) => a.label === 'evitare').length,
    },
  };
}

/* ---------- Watchlist e lista mint ---------- */

function survivorsMints() {
  const f = readFileSafe(FILES.survivors);
  if (!f.ok) return [];
  const out = [];
  for (const line of f.text.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    const sym = cells[1];
    const m = line.match(/`([1-9A-HJ-NP-Za-km-z]{32,44})`/);
    if (m && sym && sym !== 'Symbol') out.push({ symbol: sym, mint: m[1], from: 'survivors' });
  }
  return out;
}

function getWatchInput() {
  const f = readJsonFile(FILES.watch);
  const d = (f.ok && f.data) || {};
  const tokens = (Array.isArray(d.tokens) ? d.tokens : [])
    .map((t) => ({ symbol: str(t && t.symbol, 24), mint: str(t && t.mint, 44), note: str(t && t.note, 200), from: 'radar-watch' }))
    .filter((t) => B58.test(t.mint));
  const handles = (Array.isArray(d.handles) ? d.handles : [])
    .map((h) => str(h, 32).replace(/^@/, ''))
    .filter((h) => /^[A-Za-z0-9_]{1,15}$/.test(h));
  return { ok: f.ok, error: f.ok ? null : f.error, mtime: f.mtime, example: d.example === true, tokens, handles };
}

// Token dell'ecosistema z-xSOLANA, sempre in watchlist (decisione in docs/token.md).
const BUILTIN_WATCH = [
  { symbol: '$DSN', mint: '35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4', note: 'ufficiale · Solana Token-2022 (anche Polygon 0xfc90…c296)', from: 'z-xSOLANA' },
  { symbol: 'VELVET ($OV)', mint: '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump', note: 'token community · nessun rendimento, nessuna promessa', from: 'z-xSOLANA' },
];

function trackedMints() {
  const seen = new Set();
  const list = [];
  const add = (t) => {
    if (!t || !B58.test(t.mint) || seen.has(t.mint) || list.length >= MAX_TOKENS) return;
    seen.add(t.mint);
    list.push(t);
  };
  BUILTIN_WATCH.forEach(add);
  const w = getWatchInput();
  w.tokens.forEach(add);
  (sources.WATCHLIST || []).forEach((t) => add({ symbol: t.symbol, mint: t.mint, note: t.note, from: 'watchlist desk' }));
  survivorsMints().forEach(add);
  return list;
}

/* ---------- K.I.R.A. ---------- */

function check(id, label, status, detail) {
  return { id, label, status, detail };
}

function kiraChecks(token, symbolCounts) {
  const t = token || {};
  const rug = t.rug || null;
  const oc = t.onchain || null;
  const checks = [];

  const mintAuth = oc ? oc.mintAuthority : (rug ? rug.mintAuthority : undefined);
  if (mintAuth === undefined) checks.push(check('mint', 'Mint authority', 'nd', 'dato non disponibile'));
  else checks.push(check('mint', 'Mint authority', mintAuth == null ? 'ok' : 'fail', mintAuth == null ? 'revocata' : 'ATTIVA: si possono stampare token'));

  const freezeAuth = oc ? oc.freezeAuthority : (rug ? rug.freezeAuthority : undefined);
  if (freezeAuth === undefined) checks.push(check('freeze', 'Freeze authority', 'nd', 'dato non disponibile'));
  else checks.push(check('freeze', 'Freeze authority', freezeAuth == null ? 'ok' : 'fail', freezeAuth == null ? 'revocata' : 'ATTIVA: i wallet possono essere congelati'));

  const top10 = rug ? num(rug.top10PctExPool) : null;
  if (top10 == null) checks.push(check('top10', 'Top 10 holder (esclusa pool)', 'nd', 'RugCheck non disponibile'));
  else checks.push(check('top10', 'Top 10 holder (esclusa pool)', top10 > 35 ? 'fail' : top10 > 25 ? 'warn' : 'ok', top10.toFixed(1) + '%'));

  if (!t.pairAddress && !t.dexId) {
    checks.push(check('lp', 'Liquidità (LP)', 'warn', 'nessun pool trovato su DexScreener'));
  } else if (t.dexId === 'pumpfun') {
    checks.push(check('lp', 'Liquidità (LP)', 'warn', 'ancora sulla curva pump.fun: nessun pool LP'));
  } else if (rug) {
    const lpRisk = (rug.risks || []).find((r) => /lp|liquidity/i.test(String(r.name)));
    checks.push(check('lp', 'Liquidità (LP)', lpRisk ? (/danger/i.test(lpRisk.level) ? 'fail' : 'warn') : 'ok', lpRisk ? lpRisk.name : 'nessun rischio LP segnalato da RugCheck'));
  } else {
    checks.push(check('lp', 'Liquidità (LP)', 'nd', 'RugCheck non disponibile'));
  }

  if (rug) {
    const insiders = (rug.holders || []).filter((h) => h.insider).length;
    checks.push(check('insider', 'Insider / bundle tra i top holder', insiders >= 3 ? 'fail' : insiders > 0 ? 'warn' : 'ok', insiders ? insiders + ' wallet insider (RugCheck)' : 'nessuno segnalato'));
  } else {
    checks.push(check('insider', 'Insider / bundle tra i top holder', 'nd', 'RugCheck non disponibile'));
  }

  checks.push(check('dev', 'Vendite del dev', 'nd', 'controllo dell\'agente (fase 2), non calcolato in zdesk'));

  const sym = String(t.symbol || '').trim().toLowerCase();
  const name = String(t.name || '').trim().toLowerCase();
  const famous = FAMOUS.has(sym) || FAMOUS.has(name);
  const dup = sym && (symbolCounts.get(sym) || 0) > 1;
  checks.push(check('clone', 'Clone / nome copiato', famous ? 'fail' : dup ? 'warn' : 'ok', famous ? 'imita un token noto' : dup ? 'simbolo ripetuto tra i token seguiti' : 'nessuna somiglianza nota'));

  if (rug && rug.rugged) checks.push(check('rug', 'RugCheck', 'fail', 'token segnato come rugged'));
  else if (rug) checks.push(check('rug', 'RugCheck', rug.riskLevel === 'danger' ? 'fail' : rug.riskLevel === 'warn' ? 'warn' : 'ok', 'livello ' + rug.riskLevel));

  const ageH = num(t.ageMs) != null ? t.ageMs / 3600_000 : null;
  const volH1 = t.vol ? num(t.vol.h1) : null;
  const liq = num(t.liqUsd);
  let st = 'ok';
  const parts = [];
  if (ageH == null) { st = 'nd'; parts.push('età n/d'); } else { parts.push(ageH < 48 ? ageH.toFixed(1) + ' h' : (ageH / 24).toFixed(1) + ' g'); if (ageH < 1) st = 'warn'; }
  if (volH1 != null) { parts.push('vol 1h $' + Math.round(volH1).toLocaleString('it-IT')); if (volH1 < 5000 && st === 'ok') st = 'warn'; }
  if (liq != null) { parts.push('liq $' + Math.round(liq).toLocaleString('it-IT')); if (liq < 30000 && st === 'ok') st = 'warn'; }
  checks.push(check('age', 'Età, volume, liquidità', st, parts.join(' · ')));

  const fails = checks.filter((c) => c.status === 'fail').length;
  const warns = checks.filter((c) => c.status === 'warn').length;
  const verdict = fails ? 'EVITARE' : warns >= 2 ? 'OSSERVARE' : 'NESSUN RED FLAG';
  return { verdict, fails, warns, checks };
}

let kiraState = { status: 'idle', startedAt: null, finishedAt: null, items: [], error: null };
let kiraInflight = false;

async function runKira() {
  if (kiraInflight) return;
  kiraInflight = true;
  kiraState = { ...kiraState, status: 'running', startedAt: new Date().toISOString(), error: null };
  try {
    const list = trackedMints();
    const details = [];
    for (let i = 0; i < list.length; i += 1) {
      const t = list[i];
      try {
        const d = await sources.getTokenDetail(t.mint);
        details.push({ input: t, token: d && d.token });
      } catch (e) {
        details.push({ input: t, error: e.message || String(e) });
      }
      if (i < list.length - 1) await sources.sleep(STEP_DELAY_MS);
    }
    const symbolCounts = new Map();
    for (const d of details) {
      const s = String((d.token && d.token.symbol) || d.input.symbol || '').trim().toLowerCase();
      if (s) symbolCounts.set(s, (symbolCounts.get(s) || 0) + 1);
    }
    const items = details.map((d) => {
      const tk = d.token || {};
      const k = d.error ? { verdict: 'N/D', fails: 0, warns: 0, checks: [] } : kiraChecks(tk, symbolCounts);
      return {
        symbol: tk.symbol || d.input.symbol || '?',
        name: tk.name || '',
        mint: d.input.mint,
        from: d.input.from,
        note: d.input.note || '',
        dexId: tk.dexId || null,
        priceUsd: num(tk.priceUsd),
        liqUsd: num(tk.liqUsd),
        links: tk.links || { dexscreener: 'https://dexscreener.com/solana/' + d.input.mint, solscan: 'https://solscan.io/token/' + d.input.mint, rugcheck: 'https://rugcheck.xyz/tokens/' + d.input.mint },
        error: d.error || null,
        ...k,
      };
    });
    const order = { EVITARE: 0, OSSERVARE: 1, 'NESSUN RED FLAG': 2, 'N/D': 3 };
    items.sort((a, b) => (order[a.verdict] - order[b.verdict]) || String(a.symbol).localeCompare(String(b.symbol)));
    kiraState = { status: 'ready', startedAt: kiraState.startedAt, finishedAt: new Date().toISOString(), items, error: null };
    cache.set('radar:kira', kiraState, KIRA_TTL_MS);
  } catch (e) {
    kiraState = { ...kiraState, status: 'error', error: e.message || String(e), finishedAt: new Date().toISOString() };
  } finally {
    kiraInflight = false;
  }
}

function getKira() {
  if (!cache.fresh('radar:kira') && !kiraInflight) {
    runKira().catch((e) => console.error('radar kira', e.message || e));
  }
  return { ...kiraState, running: kiraInflight, ttlSec: KIRA_TTL_MS / 1000, maxTokens: MAX_TOKENS };
}

/* ---------- News anticipo ---------- */

function getNews() {
  const f = readJsonFile(FILES.news);
  const d = (f.ok && f.data) || {};
  const items = (Array.isArray(d.items) ? d.items : []).slice(0, 50).map((n) => ({
    at: str(n && n.at, 40),
    kind: str(n && n.kind, 24),
    title: str(n && n.title, 200),
    detail: str(n && n.detail, 400),
    source: str(n && n.source, 200),
    mint: B58.test(str(n && n.mint, 44)) ? str(n.mint, 44) : null,
    handle: str(n && n.handle, 32).replace(/^@/, ''),
  })).filter((n) => n.title);

  // Pair giovani e veloci: solo dalla cache già popolata dal server (zero chiamate di rete qui).
  const seen = new Set();
  const rowsAll = [];
  let fastUpdatedAt = null;
  for (const key of ['pairs:new', 'pairs:trending']) {
    const c = cache.stale(key);
    if (!c) continue;
    if (!fastUpdatedAt || (c.updatedAt && c.updatedAt > fastUpdatedAt)) fastUpdatedAt = c.updatedAt;
    for (const r of c.rows || []) {
      if (!r || !r.mint || seen.has(r.mint)) continue;
      seen.add(r.mint);
      rowsAll.push(r);
    }
  }
  const fast = rowsAll
    .map((r) => {
      const created = num(r.pairCreatedAt);
      const ageMs = created ? Date.now() - created : num(r.ageMs);
      return {
        symbol: r.symbol, mint: r.mint, ageMin: ageMs != null ? Math.round(ageMs / 60000) : null,
        volH1: r.vol ? num(r.vol.h1) : null, liqUsd: num(r.liqUsd),
        changeH1: r.priceChange ? num(r.priceChange.h1) : null,
        url: r.url || ('https://dexscreener.com/solana/' + r.mint),
      };
    })
    .filter((r) => r.ageMin != null && r.ageMin < 180 && (r.volH1 || 0) >= FAST_MIN_VOL_H1)
    .sort((a, b) => (b.volH1 || 0) - (a.volH1 || 0))
    .slice(0, 10);

  let antifake = null;
  try {
    const af = readPublicAntifake();
    antifake = af && af.verdict ? { verdict: af.verdict, mint: af.mint || null, symbol: (af.token && af.token.symbol) || af.symbol || null, at: af.at || null } : null;
  } catch { antifake = null; }

  return {
    ok: f.ok, file: FILES.news, error: f.ok ? null : f.error, mtime: f.mtime,
    example: d.example === true, items, fastPairs: fast,
    fastPairsUpdatedAt: fastUpdatedAt, fastMinVolH1: FAST_MIN_VOL_H1, antifake,
  };
}

/* ---------- API ---------- */

function getRadar() {
  const watch = getWatchInput();
  return {
    updatedAt: new Date().toISOString(),
    readOnly: true,
    trading: false,
    deskDir: path.basename(DESK_DIR),
    disclaimer: 'Segnali informativi in sola lettura. Nessun segnale garantisce un profitto. Nessun trade da qui.',
    x: getXTrust(),
    kira: getKira(),
    news: getNews(),
    watch: { ...watch, tracked: trackedMints() },
  };
}

module.exports = { getRadar, kiraChecks, cleanXAccount, FILES, BUILTIN_WATCH };
