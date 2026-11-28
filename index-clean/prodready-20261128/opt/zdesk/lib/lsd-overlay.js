'use strict';

/**
 * ZDESK · overlay Dom-Coin (L$D) + salute ecosistema + stato watchlist. SOLA LETTURA.
 * Non modifica sources.js, wallet.js, copytrader.js, ninja.js: si aggancia con un hook in server.js
 * (require('./lib/lsd-overlay').install(app, { sources, wrap })) prima delle rotte originali.
 * Nessun dato inventato: se una fonte non risponde il campo e' null ("n/d" in UI) e l'errore e' mostrato.
 * (c) 2026 ZDOS1.3 · P.IVA 11040550961
 */
const fs = require('fs');
const net = require('net');
const { cache } = require('./cache');

const LSD_MINT = 'FSwCz9qgcvfWGEU8QU3h4fQpyQ8TB2KLHYC9bmoMxDgP';
const LSD_POOL = '383iZ9nNfnnMtpM6oY7Gu4Nn87EtjwdPikkwctExjkze';
const OLD_VELVET = '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump';
const ENX = 'EnxZzNG8ZarHt1Tez4ipu5yUnXj8rAbyAnXttxnMpump';
const RPCS = ['https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'];
const TIMEOUT = 8000;
const CFG = '/etc/zdos-fondo-merito/config.json';
const STOP = '/etc/zdos-fondo-merito/STOP';

const DEAD = {
  [OLD_VELVET]: { symbol: 'VELVET (vecchio)', status: 'dead', statusNote: 'conio dichiarato morto 28/11, nuovo in arrivo' },
  [ENX]: { status: 'dead', statusNote: 'non ufficiale' },
};

async function jget(url, ms = TIMEOUT) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'zdesk-lsd/1.0 (sola lettura)' }, signal: AbortSignal.timeout(ms) });
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch { /* non json */ }
    return { ok: r.ok && j != null, status: r.status, ms: Date.now() - t0, json: j, error: r.ok ? (j == null ? 'risposta non JSON' : null) : 'HTTP ' + r.status };
  } catch (e) { return { ok: false, status: null, ms: Date.now() - t0, json: null, error: e.message }; }
}

async function rpc(method, params, tries = 0) { return rpcRetry(method, params, tries); }
async function rpcRetry(method, params, tries) {
  let last = 'nessun RPC';
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(TIMEOUT) });
      const j = await r.json();
      if (j.error) { last = j.error.message || 'errore RPC'; continue; }
      return j.result;
    } catch (e) { last = e.message; }
  }
  throw new Error(last);
}

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

async function rugFallback(sources) {
  try {
    const d = await sources.getTokenDetail(LSD_MINT); const r = d.token && d.token.rug;
    if (!r || !Array.isArray(r.holders)) return null;
    const hs = r.holders.slice(0, 10).map((h) => ({ tokenAccount: h.address, owner: h.owner, amount: h.uiAmount, pct: h.pct }));
    return { top1Pct: r.top1Pct, top5Pct: hs.slice(0, 5).reduce((a, b) => a + (b.pct || 0), 0), top10Pct: r.top10Pct, holders: hs, source: 'RugCheck (RPC saturo)' };
  } catch { return null; }
}


const conc = { value: null, at: null, error: null, running: false, last: 0 };
async function refreshConc(sources) {
  if (conc.running || Date.now() - conc.last < (conc.value ? 300_000 : 20_000)) return;
  conc.running = true; conc.last = Date.now();
  try {
    let lastErr = null;
    const jr = await jget('https://datapi.jup.ag/v1/holders/' + LSD_MINT, 10000);
    if (jr.ok && jr.json && Array.isArray(jr.json.holders) && jr.json.holders.length) {
      const supply = Number(jr.json.totalSupply || 200000000);
      const rows = jr.json.holders.slice(0, 10).map((h) => ({ tokenAccount: null, owner: h.address, amount: h.amount, pct: (h.amount / supply) * 100 }));
      const sum = (k) => rows.slice(0, k).reduce((x, r) => x + (r.pct || 0), 0);
      conc.value = { top1Pct: rows[0].pct, top5Pct: sum(5), top10Pct: sum(10), holders: rows, source: 'Jupiter datapi (holder)' };
      conc.at = new Date().toISOString(); conc.error = null; return;
    }
    lastErr = 'Jupiter holders: ' + (jr.error || 'vuoto');
    for (let i = 0; i < 3; i++) {
      try {
        const mint = await rpc('getAccountInfo', [LSD_MINT, { encoding: 'jsonParsed' }]);
        const supply = Number(mint.value.data.parsed.info.supply) / 1e6;
        const big = await rpc('getTokenLargestAccounts', [LSD_MINT]);
        const accts = (big.value || []).slice(0, 20);
        const owners = await rpc('getMultipleAccounts', [accts.map((a) => a.address), { encoding: 'jsonParsed' }]);
        const rows = accts.map((a, i2) => {
          const o = owners.value[i2] && owners.value[i2].data && owners.value[i2].data.parsed && owners.value[i2].data.parsed.info;
          return { tokenAccount: a.address, owner: o ? o.owner : null, amount: a.uiAmount, pct: supply ? (a.uiAmount / supply) * 100 : null };
        });
        const sum = (k) => rows.slice(0, k).reduce((x, r) => x + (r.pct || 0), 0);
        conc.value = { top1Pct: rows[0] ? rows[0].pct : null, top5Pct: sum(5), top10Pct: sum(10), holders: rows.slice(0, 10), source: 'RPC Solana getTokenLargestAccounts' };
        conc.at = new Date().toISOString(); conc.error = null; lastErr = null; break;
      } catch (e) { lastErr = e.message; await new Promise((z) => setTimeout(z, 2500)); }
    }
    if (lastErr) { conc.error = lastErr; const fb = conc.value ? null : await rugFallback(sources); if (fb) { conc.value = fb; conc.at = new Date().toISOString(); } }
  } finally { conc.running = false; }
}

async function onchain(sources) {
  const t0 = Date.now();
  try {
    const acc = await rpc('getAccountInfo', [LSD_MINT, { encoding: 'jsonParsed' }]);
    const info = acc && acc.value && acc.value.data && acc.value.data.parsed && acc.value.data.parsed.info;
    if (!info) throw new Error('mint non leggibile');
    const decimals = info.decimals;
    const supply = Number(info.supply) / 10 ** decimals;
    const out = {
      ok: true, program: acc.value.owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' ? 'Token (classico)' : acc.value.owner,
      decimals, supply,
      mintAuthority: { status: info.mintAuthority ? 'ACTIVE' : 'REVOCATA', address: info.mintAuthority || null },
      freezeAuthority: { status: info.freezeAuthority ? 'ACTIVE' : 'REVOCATA', address: info.freezeAuthority || null },
      holders: null, ms: 0,
    };
    out.concentration = conc.value ? { ...conc.value, asOf: conc.at } : { error: conc.error || 'in calcolo (RPC pubblico con limiti): riprova tra poco' };
    refreshConc(sources);
    out.ms = Date.now() - t0;
    return out;
  } catch (e) { return { ok: false, error: e.message, ms: Date.now() - t0 }; }
}

async function meteora() {
  const r = await jget('https://dlmm.datapi.meteora.ag/pools/' + LSD_POOL);
  if (!r.ok) return { ok: false, error: r.error, ms: r.ms };
  const p = r.json;
  return {
    ok: true, ms: r.ms, pool: p.address, binStep: p.pool_config && p.pool_config.bin_step, baseFeePct: p.pool_config && p.pool_config.base_fee_pct,
    reserveL$D: num(p.token_x_amount), reserveSOL: num(p.token_y_amount), tvlUsd: num(p.tvl), currentPriceSolPerLsd: num(p.current_price),
    volume24hUsd: num(p.volume && p.volume['24h']), fees24hUsd: num(p.fees && p.fees['24h']), holders: num(p.token_x && p.token_x.holders),
    priceUsdMeteora: num(p.token_x && p.token_x.price), marketCapMeteora: num(p.token_x && p.token_x.market_cap),
    note: 'Meteora quota L$D a 0 USD (token non verificato): il prezzo USD qui sotto viene da DexScreener.',
  };
}

async function dexscreener() {
  const r = await jget('https://api.dexscreener.com/latest/dex/pairs/solana/' + LSD_POOL);
  if (!r.ok) return { ok: false, error: r.error, ms: r.ms };
  const p = (r.json.pairs || [])[0];
  if (!p) return { ok: false, error: 'pair non trovata', ms: r.ms };
  return {
    ok: true, ms: r.ms, url: p.url, priceUsd: num(p.priceUsd), priceNative: num(p.priceNative), liquidityUsd: num(p.liquidity && p.liquidity.usd),
    volume24hUsd: num(p.volume && p.volume.h24), txns24h: p.txns && p.txns.h24, change24hPct: num(p.priceChange && p.priceChange.h24),
    fdvUsd: num(p.fdv), pairCreatedAt: p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : null,
    note: 'FDV/MCap = prezzo x 200M di supply; con liquidita cosi bassa non e un valore realizzabile.',
  };
}

async function defiPanel() {
  const r = await jget('http://127.0.0.1:4198/overview', 12000);
  if (!r.ok) return { ok: false, error: r.error, ms: r.ms };
  const t = (r.json.tokens || []).find((x) => x.mint === LSD_MINT);
  if (!t) return { ok: false, error: 'L$D non presente nel pannello /defi', ms: r.ms };
  return { ok: true, ms: r.ms, url: 'https://x-zdos.it/defi/', tradable: t.tradable || null, kira: t.kira || null, jupiterLiquidityUsd: num(t.market && t.market.liquidityUsd), holders: num(t.market && t.market.holders), organic: t.market ? t.market.organic : null, pairs: (t.pairs || []).length };
}

async function lsdLive() {
  const r = await jget('https://ourvelvet.online/api/domcoin/lsd-live');
  if (!r.ok) return { ok: false, error: r.error, ms: r.ms };
  const j = r.json;
  return {
    ok: true, ms: r.ms, totalSupply: num(j.totalSupply),
    walletBalanceLsd: num(j.walletBalanceLsd), note: 'Nessun valore in EUR dichiarato: il prezzo e solo quello di mercato (pool).',
  };
}

async function buildDomcoin(sources) {
  const [chain, met, dex, defi, live] = await Promise.all([onchain(sources), meteora(), dexscreener(), defiPanel(), lsdLive()]);
  const wallet = chain.ok && chain.mintAuthority.address;
  let walletPct = null;
  if (wallet && chain.concentration && chain.concentration.holders) {
    const h = chain.concentration.holders.find((x) => x.owner === wallet);
    walletPct = h ? h.pct : null;
  }
  return {
    ok: true, readOnly: true, checkedAt: new Date().toISOString(),
    token: { symbol: 'L$D', name: 'Dom-Coin', mint: LSD_MINT, pool: LSD_POOL, poolUrl: 'https://app.meteora.ag/dlmm/' + LSD_POOL },
    onchain: chain, mintAuthorityWalletSharePct: walletPct,
    meteora: met, dexscreener: dex, defiPanel: defi, lsdLive: live,
    warnings: [
      chain.ok && chain.mintAuthority.status === 'ACTIVE' ? 'Mint authority ATTIVA: chi controlla il wallet indicato puo coniare altri L$D. Revoca da firmare dal wallet stesso (https://x-zdos.it/lsd-revoca/).' : null,
      dex.ok && dex.liquidityUsd != null && dex.liquidityUsd < 1000 ? 'Liquidita del pool molto bassa (' + dex.liquidityUsd + ' USD): prezzo e FDV non sono significativi.' : null,
    ].filter(Boolean),
  };
}

function tcp(port, ms = 2500) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port });
    const done = (ok, err) => { s.destroy(); resolve({ open: ok, ms: Date.now() - t0, error: err || null }); };
    s.setTimeout(ms, () => done(false, 'timeout'));
    s.once('connect', () => done(true));
    s.once('error', (e) => done(false, e.code || e.message));
  });
}

const SERVICES = [
  { id: 'defi', name: 'DeFi (swap · pool)', port: 4198, url: 'http://127.0.0.1:4198/health', public: 'https://x-zdos.it/defi/' },
  { id: 'firma', name: 'Firma Phantom (SIWS)', port: 8905, url: 'http://127.0.0.1:8905/api/firma/health', public: 'https://x-zdos.it/verifica/' },
  { id: 'social', name: 'Social OurVelvet', port: 8910, url: 'http://127.0.0.1:8910/api/social/health', public: null },
  { id: 'miner', name: 'ZDOS Miner (lavoro utile)', port: 4197, url: null, public: null },
  { id: 'vchain', name: 'vBLOCKCHAIN', port: 8899, url: 'http://127.0.0.1:8899/health', public: 'https://dex.x-zdos.it/' },
  { id: 'quest', name: 'ZQuest', port: 3200, url: 'http://127.0.0.1:3200/api/health', public: 'https://quest.x-zdos.it/' },
  { id: 'zcomm', name: 'zcomm (bus eventi merito)', port: 4192, url: 'http://127.0.0.1:4192/zcomm/health', public: null },
];

async function checkService(s) {
  if (!s.url) {
    const t = await tcp(s.port);
    return { id: s.id, name: s.name, port: s.port, status: 'n/d', latencyMs: null, detail: t.open ? 'nessun endpoint health; porta aperta (' + t.ms + ' ms)' : 'nessun endpoint health; porta non raggiungibile (' + (t.error || '') + ')', portOpen: t.open };
  }
  const r = await jget(s.url, 4000);
  const ok = r.ok && r.json && r.json.ok === true;
  return { id: s.id, name: s.name, port: s.port, status: ok ? 'ok' : 'down', latencyMs: r.ms, detail: ok ? (r.json.servizio || r.json.service || r.json.engine || 'ok') : (r.error || 'risposta non ok'), httpStatus: r.status };
}

function fondoState() {
  try {
    const c = JSON.parse(fs.readFileSync(CFG, 'utf8'));
    const m = c.merit || {};
    return {
      ok: true, emissionsLive: c.emissionsLive === true, status: c.status || null, stopFile: fs.existsSync(STOP),
      payoutsOff: c.emissionsLive !== true || fs.existsSync(STOP),
      points: m.points || null, weeklyMax: m.weeklyMax || null, proposals: m.proposals || null,
    };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function buildEco() {
  const services = await Promise.all(SERVICES.map(checkService));
  return { ok: true, readOnly: true, checkedAt: new Date().toISOString(), services, fondoMerito: fondoState() };
}

async function cached(key, ttl, fn) {
  const f = cache.fresh(key);
  if (f) return { ...f, cached: true };
  const v = await fn();
  cache.set(key, v, ttl);
  return v;
}

async function overlayWatchlist(sources) {
  const base = await sources.getWatchlist();
  const items = (base.items || []).map((it) => (DEAD[it.mint] ? { ...it, ...DEAD[it.mint] } : it));
  if (!items.some((i) => i.mint === LSD_MINT)) {
    let entry = { symbol: 'L$D', name: 'Dom-Coin', mint: LSD_MINT, note: 'Dom-Coin · Token classico, 6 decimali, pool Meteora DLMM ' + LSD_POOL.slice(0, 6) + '… · mint authority attiva (vedi Dom-Coin)', status: 'live' };
    try { const d = await sources.getTokenDetail(LSD_MINT); entry = { ...entry, token: d.token }; } catch (e) { entry.error = e.message; }
    // ordine: attivi (L$D dopo $DSN), poi dead in fondo
    const idx = items.findIndex((i) => i.symbol === '$DSN');
    items.splice(idx >= 0 ? idx + 1 : 0, 0, entry);
  }
  items.sort((a, b) => (a.status === 'dead') - (b.status === 'dead'));
  return { ...base, items, overlay: 'lsd-overlay v1' };
}

function install(app, { sources, wrap }) {
  require('./lsd-verde').install(app, { wrap }); // L$D "cosa manca per il verde" (sola lettura; rollback /var/backups/lsd-verde/)
  setTimeout(() => refreshConc(sources).catch(() => {}), 3000);
  app.get('/api/watchlist', wrap(async (_req, res) => {
    res.json(await cached('lsd:watchlist', 30_000, () => overlayWatchlist(sources)));
  }));
  app.get('/api/domcoin', wrap(async (_req, res) => {
    res.json(await cached('lsd:domcoin', 90_000, () => buildDomcoin(sources)));
  }));
  app.get('/api/ecosystem-health', wrap(async (_req, res) => {
    res.json(await cached('lsd:eco', 20_000, buildEco));
  }));
}

module.exports = { install, LSD_MINT, LSD_POOL, DEAD };
