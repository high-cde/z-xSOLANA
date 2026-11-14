
'use strict';

const { cache } = require('./cache');
const { computeScore } = require('./score');

const UA = 'ZDeskDashboard/1.0 (private HighKali desk; read-only; local)';
const DS = 'https://api.dexscreener.com';
const GT = 'https://api.geckoterminal.com/api/v2';
const RC = 'https://api.rugcheck.xyz/v1';
const RPC_PUBLICNODE = 'https://solana-rpc.publicnode.com';
const RPC_MAINNET = 'https://api.mainnet-beta.solana.com';
const PUMP_CURVE_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const WSOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const WATCHLIST = [
  { symbol: '$OV', mint: '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump', note: 'progetto desk — curva pump.fun' },
  { symbol: '$DSN', mint: 'EnxZzNG8ZarHt1Tez4ipu5yUnXj8rAbyAnXttxnMpump', note: 'meme xZDOS' },
];

// Mints ufficiali xStocks (Jupiter tag "xstocks" + DexScreener), rivalidati al runtime.
const XSTOCKS_SEED = [
  { symbol: 'SPYx', name: 'SP500 xStock', mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W' },
  { symbol: 'QQQx', name: 'Nasdaq xStock', mint: 'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ' },
  { symbol: 'NVDAx', name: 'NVIDIA xStock', mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh' },
  { symbol: 'TSLAx', name: 'Tesla xStock', mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB' },
  { symbol: 'GOOGLx', name: 'Alphabet xStock', mint: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN' },
];

const health = {
  dexscreener: { ok: null, note: '' },
  geckoterminal: { ok: null, note: '' },
  rugcheck: { ok: null, note: '' },
  rpc: { ok: null, note: '' },
  pumpfun: { ok: false, note: 'API Cloudflare 403 — curva letta on-chain se disponibile' },
  jupiter: { ok: null, note: '' },
};

function mark(src, ok, note) {
  health[src] = { ok, note: note || '', ts: Date.now() };
}

function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function httpJson(url, opts = {}) {
  const t = opts.timeout || 12000;
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), t);
  try {
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': UA,
        ...(opts.headers || {}),
      },
      body: opts.body,
      signal: ac.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${url}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(id);
  }
}

function isRateLimit(err, data) {
  const status = err && err.status;
  const code = (err && err.code) || (data && data.error && data.error.code);
  const msg = String((err && err.message) || (data && data.error && data.error.message) || '');
  return status === 429 || status === 503 || code === 429 || code === -32429
    || /\b429\b|too many requests|rate ?limit|server busy/i.test(msg);
}

async function rpcCall(method, params, prefer) {
  const order = prefer === 'mainnet'
    ? [RPC_MAINNET, RPC_PUBLICNODE]
    : [RPC_PUBLICNODE, RPC_MAINNET];
  let lastErr = null;
  let backoff = 600;
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let rateLimited = false;
    for (const url of order) {
      try {
        const data = await httpJson(url, {
          method: 'POST',
          timeout: 15000,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        });
        if (data && data.error) {
          lastErr = new Error(data.error.message || JSON.stringify(data.error));
          lastErr.code = data.error.code;
          if (isRateLimit(lastErr, data)) {
            rateLimited = true;
            break;
          }
          continue;
        }
        mark('rpc', true, url.includes('publicnode') ? 'publicnode' : 'mainnet-beta');
        return data.result;
      } catch (e) {
        lastErr = e;
        if (isRateLimit(e)) {
          rateLimited = true;
          break;
        }
      }
    }
    if (!rateLimited) break;
    const wait = backoff + Math.floor(Math.random() * 250);
    await sleep(wait);
    backoff = Math.min(backoff * 2, 20_000);
  }
  mark('rpc', false, lastErr ? lastErr.message : 'rpc fail');
  throw lastErr || new Error('rpc fail');
}

function bestSolanaPair(pairs, mint) {
  const list = (pairs || []).filter((p) => p && p.chainId === 'solana');
  const prefer = mint
    ? list.filter((p) => (p.baseToken && p.baseToken.address === mint) || (p.quoteToken && p.quoteToken.address === mint))
    : list;
  const pool = (prefer.length ? prefer : list).slice().sort((a, b) => {
    const la = (a.liquidity && a.liquidity.usd) || 0;
    const lb = (b.liquidity && b.liquidity.usd) || 0;
    return lb - la;
  });
  return pool[0] || null;
}

function normalizeDsPair(p) {
  if (!p) return null;
  const base = p.baseToken || {};
  const created = num(p.pairCreatedAt);
  const tx = p.txns || {};
  const vol = p.volume || {};
  const ch = p.priceChange || {};
  return {
    source: 'dexscreener',
    mint: base.address,
    symbol: base.symbol,
    name: base.name,
    pairAddress: p.pairAddress,
    dexId: p.dexId,
    priceUsd: num(p.priceUsd),
    priceNative: num(p.priceNative),
    mcap: num(p.marketCap) || num(p.fdv),
    fdv: num(p.fdv),
    liqUsd: p.liquidity ? num(p.liquidity.usd) : null,
    vol: { m5: num(vol.m5), h1: num(vol.h1), h6: num(vol.h6), h24: num(vol.h24) },
    txns: {
      m5: { buys: tx.m5 && tx.m5.buys, sells: tx.m5 && tx.m5.sells },
      h1: { buys: tx.h1 && tx.h1.buys, sells: tx.h1 && tx.h1.sells },
      h6: { buys: tx.h6 && tx.h6.buys, sells: tx.h6 && tx.h6.sells },
      h24: { buys: tx.h24 && tx.h24.buys, sells: tx.h24 && tx.h24.sells },
    },
    priceChange: { m5: num(ch.m5), h1: num(ch.h1), h6: num(ch.h6), h24: num(ch.h24) },
    pairCreatedAt: created,
    ageMs: created ? Date.now() - created : null,
    url: p.url || (p.pairAddress ? `https://dexscreener.com/solana/${p.pairAddress}` : null),
    image: p.info && p.info.imageUrl,
    links: (p.info && p.info.websites) || (p.info && p.info.socials) || [],
  };
}

function normalizeGtPool(pool, tokensById) {
  const a = pool.attributes || {};
  const rel = pool.relationships || {};
  const baseId = rel.base_token && rel.base_token.data && rel.base_token.data.id;
  const base = tokensById[baseId] || {};
  const vol = a.volume_usd || {};
  const tx = a.transactions || {};
  const ch = a.price_change_percentage || {};
  const created = a.pool_created_at ? Date.parse(a.pool_created_at) : null;
  const dex = rel.dex && rel.dex.data && rel.dex.data.id;
  return {
    source: 'geckoterminal',
    mint: base.address,
    symbol: base.symbol,
    name: base.name,
    image: base.image_url,
    pairAddress: a.address,
    dexId: dex,
    priceUsd: num(a.base_token_price_usd),
    mcap: num(a.market_cap_usd) || num(a.fdv_usd),
    fdv: num(a.fdv_usd),
    liqUsd: num(a.reserve_in_usd),
    vol: { m5: num(vol.m5), h1: num(vol.h1), h6: num(vol.h6), h24: num(vol.h24) },
    txns: {
      m5: { buys: tx.m5 && tx.m5.buys, sells: tx.m5 && tx.m5.sells },
      h1: { buys: tx.h1 && tx.h1.buys, sells: tx.h1 && tx.h1.sells },
      h6: { buys: tx.h6 && tx.h6.buys, sells: tx.h6 && tx.h6.sells },
      h24: { buys: tx.h24 && tx.h24.buys, sells: tx.h24 && tx.h24.sells },
    },
    priceChange: { m5: num(ch.m5), h1: num(ch.h1), h6: num(ch.h6), h24: num(ch.h24) },
    pairCreatedAt: Number.isFinite(created) ? created : null,
    ageMs: Number.isFinite(created) ? Date.now() - created : null,
    url: a.address ? `https://dexscreener.com/solana/${a.address}` : null,
  };
}

function parseRug(d, pairAddress) {
  if (!d || typeof d !== 'object') return null;
  const mintAuth = d.mintAuthority !== undefined ? d.mintAuthority : (d.token && d.token.mintAuthority);
  const freezeAuth = d.freezeAuthority !== undefined ? d.freezeAuthority : (d.token && d.token.freezeAuthority);
  const poolKeys = new Set();
  for (const m of d.markets || []) {
    if (m.pubkey) poolKeys.add(m.pubkey);
    if (m.liquidityA) poolKeys.add(m.liquidityA);
    if (m.liquidityB) poolKeys.add(m.liquidityB);
  }
  if (pairAddress) poolKeys.add(pairAddress);
  const holders = (d.topHolders || []).map((h) => ({
    address: h.address,
    owner: h.owner || h.address,
    pct: num(h.pct) || 0,
    uiAmount: num(h.uiAmount),
    insider: !!h.insider,
  }));
  const isPool = (h) =>
    poolKeys.has(h.address) || poolKeys.has(h.owner) ||
    (h.pct >= 80 && (d.tokenType === 'pump' || String(d.mint || '').endsWith('pump')));
  const rawTop10 = holders.slice(0, 10).reduce((s, h) => s + h.pct, 0);
  const rawTop1 = holders[0] ? holders[0].pct : null;
  const ex = holders.filter((h) => !isPool(h));
  const top10Ex = ex.slice(0, 10).reduce((s, h) => s + h.pct, 0);
  const top1Ex = ex[0] ? ex[0].pct : null;
  const risks = (d.risks || []).map((r) => ({
    name: r.name || r.score || String(r),
    level: r.level || r.risk || '',
    description: r.description || r.value || '',
  }));
  let riskLevel = 'ok';
  if (d.rugged) riskLevel = 'danger';
  else if (risks.some((r) => String(r.level).toLowerCase() === 'danger')) riskLevel = 'danger';
  else if (risks.some((r) => /warn|warning/i.test(String(r.level)))) riskLevel = 'warn';
  return {
    mintRevoked: mintAuth == null,
    freezeRevoked: freezeAuth == null,
    mintAuthority: mintAuth,
    freezeAuthority: freezeAuth,
    top10Pct: Math.round(rawTop10 * 100) / 100,
    top1Pct: rawTop1 != null ? Math.round(rawTop1 * 100) / 100 : null,
    top10PctExPool: Math.round(top10Ex * 100) / 100,
    top1PctExPool: top1Ex != null ? Math.round(top1Ex * 100) / 100 : null,
    holders: holders.slice(0, 15),
    holdersExPool: ex.slice(0, 15),
    totalHolders: d.totalHolders,
    rugged: !!d.rugged,
    riskLevel,
    risks,
    score: d.score,
    scoreNorm: d.score_normalised,
    totalMarketLiquidity: d.totalMarketLiquidity,
    tokenType: d.tokenType,
  };
}

function attachScore(row, rug) {
  const h1 = (row.txns && row.txns.h1) || {};
  const h6 = (row.txns && row.txns.h6) || {};
  const h24 = (row.txns && row.txns.h24) || {};
  const buys = num(h1.buys) != null ? h1.buys : (num(h6.buys) != null ? h6.buys : h24.buys);
  const sells = num(h1.sells) != null ? h1.sells : (num(h6.sells) != null ? h6.sells : h24.sells);
  const meta = computeScore({
    liqUsd: row.liqUsd,
    vol1h: row.vol && row.vol.h1,
    vol6h: row.vol && row.vol.h6,
    vol24h: row.vol && row.vol.h24,
    buys,
    sells,
    top10Pct: rug ? (rug.top10PctExPool != null ? rug.top10PctExPool : rug.top10Pct) : null,
    top1Pct: rug ? (rug.top1PctExPool != null ? rug.top1PctExPool : rug.top1Pct) : null,
    mintRevoked: rug ? rug.mintRevoked : null,
    freezeRevoked: rug ? rug.freezeRevoked : null,
    rugged: rug && rug.rugged,
    rugLevel: rug && rug.riskLevel,
  });
  row.score = meta.score;
  row.scoreMeta = meta;
  if (rug) row.rug = rug;
  return row;
}

function parseBondingCurve(base64Data) {
  const raw = Buffer.from(base64Data, 'base64');
  if (raw.length < 49) return null;
  const vtok = raw.readBigUInt64LE(8);
  const vsol = raw.readBigUInt64LE(16);
  const rtok = raw.readBigUInt64LE(24);
  const rsol = raw.readBigUInt64LE(32);
  const supply = raw.readBigUInt64LE(40);
  const complete = raw[48] !== 0;
  const INITIAL_REAL_TOKENS = 793100000000000n;
  const GRAD_SOL = 85n * 1000000000n;
  const progressSol = Number(rsol) / Number(GRAD_SOL);
  let progressTok = null;
  if (rtok <= INITIAL_REAL_TOKENS) {
    progressTok = Number(INITIAL_REAL_TOKENS - rtok) / Number(INITIAL_REAL_TOKENS);
  }
  return {
    complete,
    virtualSol: Number(vsol) / 1e9,
    realSol: Number(rsol) / 1e9,
    targetSol: 85,
    progressSol: Math.max(0, Math.min(complete ? 1 : progressSol, 1)),
    progressTok: progressTok == null ? null : Math.max(0, Math.min(progressTok, 1)),
    realTokens: Number(rtok) / 1e6,
    supply: Number(supply),
  };
}

async function fetchBondingCurve(pairAddress) {
  if (!pairAddress) return null;
  const key = 'curve:' + pairAddress;
  const fresh = cache.fresh(key);
  if (fresh !== null && fresh !== undefined) return fresh;
  try {
    const result = await rpcCall('getAccountInfo', [pairAddress, { encoding: 'base64' }], 'publicnode');
    const val = result && result.value;
    if (!val || !val.data || !val.data[0]) {
      cache.set(key, null, 60_000);
      return null;
    }
    if (val.owner !== PUMP_CURVE_PROGRAM) {
      cache.set(key, null, 120_000);
      return null;
    }
    const parsed = parseBondingCurve(val.data[0]);
    cache.set(key, parsed, 30_000);
    return parsed;
  } catch (e) {
    return cache.stale(key) || null;
  }
}

async function fetchRug(mint, pairAddress) {
  const key = 'rug:' + mint;
  const fresh = cache.fresh(key);
  if (fresh !== null && fresh !== undefined) return fresh;
  try {
    const data = await httpJson(`${RC}/tokens/${mint}/report`, { timeout: 14000 });
    const rug = parseRug(data, pairAddress);
    mark('rugcheck', true);
    cache.set(key, rug, 8 * 60_000);
    return rug;
  } catch (e) {
    mark('rugcheck', false, e.message);
    const stale = cache.stale(key);
    if (stale) return stale;
    return null;
  }
}

async function fetchDsTokenPairs(mint) {
  const key = 'ds:tok:' + mint;
  const fresh = cache.fresh(key);
  if (fresh) return fresh;
  try {
    let data;
    try {
      data = await httpJson(`${DS}/token-pairs/v1/solana/${mint}`);
    } catch {
      data = await httpJson(`${DS}/latest/dex/tokens/${mint}`);
      data = data && data.pairs;
    }
    const pairs = Array.isArray(data) ? data : (data && data.pairs) || [];
    mark('dexscreener', true);
    cache.set(key, pairs, 30_000);
    return pairs;
  } catch (e) {
    mark('dexscreener', false, e.message);
    return cache.stale(key) || [];
  }
}

async function fetchDsTokensBatch(mints) {
  const uniq = [...new Set(mints.filter(Boolean))];
  const out = new Map();
  for (let i = 0; i < uniq.length; i += 25) {
    const chunk = uniq.slice(i, i + 25);
    try {
      const data = await httpJson(`${DS}/latest/dex/tokens/${chunk.join(',')}`);
      const pairs = (data && data.pairs) || [];
      mark('dexscreener', true);
      for (const mint of chunk) {
        const related = pairs.filter((p) =>
          p.chainId === 'solana' &&
          ((p.baseToken && p.baseToken.address === mint) || (p.quoteToken && p.quoteToken.address === mint))
        );
        out.set(mint, related);
        cache.set('ds:tok:' + mint, related, 30_000);
      }
    } catch (e) {
      mark('dexscreener', false, e.message);
    }
  }
  return out;
}

async function fetchGtPools(kind) {
  const url = `${GT}/networks/solana/${kind}?page=1&include=base_token,quote_token`;
  const data = await httpJson(url, { timeout: 15000 });
  const tokens = {};
  for (const t of data.included || []) {
    if (t.type === 'token') tokens[t.id] = t.attributes || {};
  }
  const rows = (data.data || []).map((p) => normalizeGtPool(p, tokens)).filter((r) => r.mint);
  mark('geckoterminal', true);
  return rows;
}

async function dsFallbackList() {
  const rows = [];
  try {
    const boosts = await httpJson(`${DS}/token-boosts/latest/v1`);
    const mints = (Array.isArray(boosts) ? boosts : [])
      .filter((b) => b.chainId === 'solana' && b.tokenAddress)
      .map((b) => b.tokenAddress);
    const map = await fetchDsTokensBatch(mints.slice(0, 25));
    for (const mint of mints) {
      const best = bestSolanaPair(map.get(mint) || [], mint);
      const row = normalizeDsPair(best);
      if (row) rows.push(row);
    }
  } catch (e) {
    mark('dexscreener', false, e.message);
  }
  return rows;
}

const enrichQ = [];
const enrichSeen = new Set();
let enrichRunning = false;

function enqueueEnrich(mints) {
  for (const m of mints) {
    if (!m || enrichSeen.has(m)) continue;
    if (cache.fresh('rug:' + m)) continue;
    enrichSeen.add(m);
    enrichQ.push(m);
  }
  pumpEnrich();
}

async function pumpEnrich() {
  if (enrichRunning) return;
  enrichRunning = true;
  try {
    let n = 0;
    while (enrichQ.length && n < 15) {
      const mint = enrichQ.shift();
      n++;
      try { await fetchRug(mint); } catch { /* ignore */ }
      await sleep(1200);
    }
  } finally {
    enrichRunning = false;
    if (enrichQ.length) setTimeout(pumpEnrich, 2000);
  }
}

function applyCachedRug(rows) {
  return rows.map((r) => {
    const rug = cache.stale('rug:' + r.mint);
    return attachScore({ ...r }, rug || null);
  });
}

async function getPairList(kind) {
  const key = 'pairs:' + kind;
  const fresh = cache.fresh(key);
  if (fresh) return { ...fresh, cached: true };
  const gtKind = kind === 'new' ? 'new_pools' : 'trending_pools';
  let rows = [];
  let error = null;
  try {
    rows = await fetchGtPools(gtKind);
  } catch (e) {
    mark('geckoterminal', false, e.message);
    error = e.message;
    try {
      rows = await dsFallbackList();
    } catch (e2) {
      error = (error || '') + ' | ' + e2.message;
    }
  }
  if (!rows.length) {
    const stale = cache.stale(key);
    if (stale) return { ...stale, stale: true, error };
  }
  rows = applyCachedRug(rows);
  enqueueEnrich(rows.map((r) => r.mint));
  const payload = { updatedAt: new Date().toISOString(), rows, error, source: rows[0] && rows[0].source };
  cache.set(key, payload, 45_000);
  return payload;
}

async function getTokenDetail(mint) {
  const key = 'detail:' + mint;
  const fresh = cache.fresh(key);
  if (fresh) return fresh;
  const pairs = await fetchDsTokenPairs(mint);
  const best = bestSolanaPair(pairs, mint);
  let row = normalizeDsPair(best) || { mint, pairs: [] };
  if (!row.mint) row.mint = mint;
  const rug = await fetchRug(mint, row.pairAddress);
  attachScore(row, rug);
  let curve = null;
  if (row.dexId === 'pumpfun' && row.pairAddress) {
    curve = await fetchBondingCurve(row.pairAddress);
  }
  row.bondingCurve = curve;
  row.allPairs = (pairs || []).filter((p) => p.chainId === 'solana').map((p) => ({
    dexId: p.dexId,
    pairAddress: p.pairAddress,
    liqUsd: p.liquidity && p.liquidity.usd,
    priceUsd: p.priceUsd,
    url: p.url,
  }));
  row.links = {
    dexscreener: row.url || `https://dexscreener.com/solana/${mint}`,
    solscan: `https://solscan.io/token/${mint}`,
    rugcheck: `https://rugcheck.xyz/tokens/${mint}`,
  };
  // conferma authority on-chain
  try {
    const acc = await rpcCall('getAccountInfo', [mint, { encoding: 'jsonParsed' }], 'publicnode');
    const info = acc && acc.value && acc.value.data && acc.value.data.parsed && acc.value.data.parsed.info;
    if (info) {
      row.onchain = {
        decimals: info.decimals,
        supply: info.supply,
        mintAuthority: info.mintAuthority,
        freezeAuthority: info.freezeAuthority,
        program: acc.value.data.program,
      };
      if (row.rug) {
        row.rug.mintRevoked = info.mintAuthority == null;
        row.rug.freezeRevoked = info.freezeAuthority == null;
        attachScore(row, row.rug);
      }
    }
  } catch { /* optional */ }
  const payload = { updatedAt: new Date().toISOString(), token: row };
  cache.set(key, payload, 30_000);
  return payload;
}

async function getWatchlist() {
  const key = 'watchlist';
  const fresh = cache.fresh(key);
  if (fresh) return { ...fresh, cached: true };
  const items = [];
  for (const w of WATCHLIST) {
    try {
      const detail = await getTokenDetail(w.mint);
      items.push({ ...w, token: detail.token });
    } catch (e) {
      items.push({ ...w, error: e.message });
    }
  }
  const payload = { updatedAt: new Date().toISOString(), items };
  cache.set(key, payload, 30_000);
  return payload;
}

async function resolveXstocks() {
  const key = 'xstocks:mints';
  const fresh = cache.fresh(key);
  if (fresh) return fresh;
  const resolved = [];
  for (const seed of XSTOCKS_SEED) {
    let mint = seed.mint;
    let source = 'seed+dexscreener';
    try {
      const j = await httpJson(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(seed.symbol)}`, { timeout: 10000 });
      const list = Array.isArray(j) ? j : [];
      const hit = list.find((t) =>
        t && t.symbol === seed.symbol &&
        Array.isArray(t.tags) && t.tags.includes('xstocks') &&
        t.address
      ) || list.find((t) => t && t.symbol === seed.symbol && t.address === seed.mint);
      if (hit && hit.address) {
        mint = hit.address;
        source = 'jupiter+xstocks';
        mark('jupiter', true);
      }
    } catch (e) {
      mark('jupiter', false, e.message);
    }
    resolved.push({ ...seed, mint, source });
  }
  cache.set(key, resolved, 60 * 60_000);
  return resolved;
}

async function getXstocks() {
  const key = 'xstocks';
  const fresh = cache.fresh(key);
  if (fresh) return { ...fresh, cached: true };
  const list = await resolveXstocks();
  const map = await fetchDsTokensBatch(list.map((x) => x.mint));
  const items = [];
  for (const x of list) {
    const best = bestSolanaPair(map.get(x.mint) || [], x.mint);
    let row = normalizeDsPair(best);
    if (!row) row = { mint: x.mint, symbol: x.symbol, name: x.name };
    row.symbol = row.symbol || x.symbol;
    row.name = row.name || x.name;
    const rug = cache.stale('rug:' + x.mint) || null;
    attachScore(row, rug);
    items.push({
      ...x,
      token: row,
      blocked: true,
      blockReason: 'acquisto bloccato (georestriction Phantom) — solo watch, nessun trade',
    });
  }
  enqueueEnrich(list.map((x) => x.mint));
  const payload = {
    updatedAt: new Date().toISOString(),
    notice: 'Acquisto bloccato (georestriction Phantom). Solo osservazione, nessuna elusione.',
    items,
  };
  cache.set(key, payload, 45_000);
  return payload;
}

function isValidPubkey(addr) {
  return typeof addr === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

async function getSolPrice() {
  const fresh = cache.fresh('solusd');
  if (fresh) return fresh;
  try {
    const data = await httpJson(`${DS}/latest/dex/tokens/${WSOL}`);
    const best = bestSolanaPair((data && data.pairs) || [], WSOL);
    // for WSOL pairs, priceUsd is often the other token; pick USDC/USDT pair
    const usdc = ((data && data.pairs) || []).find((p) =>
      p.chainId === 'solana' && p.quoteToken && (p.quoteToken.address === USDC || p.quoteToken.symbol === 'USDC') && p.baseToken && p.baseToken.address === WSOL
    ) || ((data && data.pairs) || []).find((p) =>
      p.chainId === 'solana' && p.baseToken && p.baseToken.symbol === 'SOL' && p.quoteToken && p.quoteToken.symbol === 'USDC'
    );
    const px = num(usdc && usdc.priceUsd) || num(best && best.priceUsd);
    if (px) {
      cache.set('solusd', px, 60_000);
      return px;
    }
  } catch { /* ignore */ }
  return cache.stale('solusd') || null;
}

async function getWallet(address) {
  if (!isValidPubkey(address)) {
    const err = new Error('indirizzo non valido');
    err.status = 400;
    throw err;
  }
  const key = 'wallet:' + address;
  const fresh = cache.fresh(key);
  if (fresh) return { ...fresh, cached: true };

  const solUsd = await getSolPrice();
  let lamports = 0;
  try {
    lamports = await rpcCall('getBalance', [address], 'publicnode');
    if (lamports && typeof lamports === 'object' && lamports.value != null) lamports = lamports.value;
  } catch { lamports = 0; }

  async function tokenAccounts(programId) {
    try {
      const res = await rpcCall('getTokenAccountsByOwner', [
        address,
        { programId },
        { encoding: 'jsonParsed' },
      ], 'mainnet');
      return (res && res.value) || [];
    } catch {
      return [];
    }
  }
  const [t1, t2] = await Promise.all([tokenAccounts(TOKEN_PROGRAM), tokenAccounts(TOKEN_2022)]);
  const balances = [];
  for (const a of [...t1, ...t2]) {
    const info = a.account && a.account.data && a.account.data.parsed && a.account.data.parsed.info;
    if (!info) continue;
    const ta = info.tokenAmount || {};
    const ui = num(ta.uiAmount) || 0;
    if (ui <= 0) continue;
    balances.push({
      mint: info.mint,
      amount: ui,
      decimals: ta.decimals,
      program: a.account.data.program,
    });
  }
  const mintMap = await fetchDsTokensBatch(balances.map((b) => b.mint).slice(0, 30));
  for (const b of balances) {
    const best = bestSolanaPair(mintMap.get(b.mint) || [], b.mint);
    if (best) {
      b.symbol = best.baseToken && best.baseToken.address === b.mint ? best.baseToken.symbol : (best.quoteToken && best.quoteToken.symbol);
      b.name = best.baseToken && best.baseToken.address === b.mint ? best.baseToken.name : null;
      b.priceUsd = num(best.priceUsd);
      b.valueUsd = b.priceUsd != null ? b.priceUsd * b.amount : null;
    }
  }
  balances.sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0));

  let signatures = [];
  try {
    signatures = await rpcCall('getSignaturesForAddress', [address, { limit: 20 }], 'mainnet') || [];
  } catch { signatures = []; }

  const txs = signatures.map((s) => ({
    signature: s.signature,
    slot: s.slot,
    blockTime: s.blockTime,
    err: s.err || null,
    memo: s.memo || null,
    solscan: `https://solscan.io/tx/${s.signature}`,
  }));

  const sol = (Number(lamports) || 0) / 1e9;
  const payload = {
    updatedAt: new Date().toISOString(),
    address,
    sol,
    solUsd,
    solValueUsd: solUsd != null ? sol * solUsd : null,
    balances,
    transactions: txs,
  };
  cache.set(key, payload, 30_000);
  return payload;
}


async function getOhlcv(pairAddress, opts = {}) {
  if (!pairAddress) {
    const err = new Error('pair mancante');
    err.status = 400;
    throw err;
  }
  const timeframe = ['minute', 'hour', 'day'].includes(opts.timeframe) ? opts.timeframe : 'minute';
  const aggregate = Number(opts.aggregate) || (timeframe === 'minute' ? 5 : 1);
  const limit = Math.min(Number(opts.limit) || 180, 500);
  const key = `ohlcv:${pairAddress}:${timeframe}:${aggregate}:${limit}`;
  const fresh = cache.fresh(key);
  if (fresh) return { ...fresh, cached: true };
  try {
    const url = `${GT}/networks/solana/pools/${encodeURIComponent(pairAddress)}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd`;
    const data = await httpJson(url, { timeout: 15000 });
    mark('geckoterminal', true);
    const raw = (data && data.data && data.data.attributes && data.data.attributes.ohlcv_list) || [];
    const candles = raw.map((row) => ({
      time: Number(row[0]),
      open: num(row[1]),
      high: num(row[2]),
      low: num(row[3]),
      close: num(row[4]),
      volume: num(row[5]),
    })).filter((c) => Number.isFinite(c.time) && c.close != null)
      .sort((a, b) => a.time - b.time);
    const payload = {
      updatedAt: new Date().toISOString(),
      pairAddress,
      timeframe,
      aggregate,
      candles,
    };
    cache.set(key, payload, 30_000);
    return payload;
  } catch (e) {
    mark('geckoterminal', false, e.message);
    const stale = cache.stale(key);
    if (stale) return { ...stale, stale: true, error: e.message };
    return {
      updatedAt: new Date().toISOString(),
      pairAddress,
      timeframe,
      aggregate,
      candles: [],
      error: e.message,
    };
  }
}

function getHealth() {
  return { ...health, now: new Date().toISOString() };
}

module.exports = {
  WATCHLIST,
  XSTOCKS_SEED,
  PUMP_CURVE_PROGRAM,
  WSOL,
  USDC,
  isValidPubkey,
  httpJson,
  rpcCall,
  getPairList,
  getTokenDetail,
  getWatchlist,
  getXstocks,
  getWallet,
  getHealth,
  getOhlcv,
  getSolPrice,
  fetchRug,
  fetchDsTokenPairs,
  fetchDsTokensBatch,
  bestSolanaPair,
  normalizeDsPair,
  attachScore,
  enqueueEnrich,
  cache,
  sleep,
  num,
};
