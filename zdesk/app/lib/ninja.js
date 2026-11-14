
'use strict';

/**
 * HighKali Ninja — fast-exit risk watcher.
 * NEVER holds private keys. NEVER signs or sends transactions.
 * Sells are executed only by desk routines via Phantom MCP.
 */

const fs = require('fs');
const path = require('path');
const sources = require('./sources');
const { cache } = require('./cache');

const DESK_DIR = process.env.DESK_DIR || '/workspace/highkali-desk';
const STATE_FILE = process.env.NINJA_STATE_FILE || path.join(DESK_DIR, 'ninja.json');
const LOG_FILE = process.env.NINJA_LOG_FILE || path.join(DESK_DIR, 'ninja.log');
const RISK_FILE = process.env.NINJA_RISK_FILE || path.join(DESK_DIR, 'risk.md');
const COPY_FILE = process.env.NINJA_COPY_FILE || path.join(DESK_DIR, 'copy-live.md');
const POSITIONS_FILE = process.env.NINJA_POSITIONS_FILE || '';

const THRESH = {
  RED_FROM_ENTRY: -1,
  RED_FROM_PEAK: -2.5,
  HARD_STOP: -2,
  LIQ_RED: -15,
  LIQ_HARD: -30,
  WINDOW_MS: 10 * 60 * 1000,
  VOL_SPIKE_MULT: 2,
  TRAIL_TIGHTEN_PCT: 3,
  COPY_TP_PCT: 8,
  INTERVAL_MS: Number(process.env.NINJA_INTERVAL_MS) || 6000,
  IDLE_INTERVAL_MS: Number(process.env.NINJA_IDLE_INTERVAL_MS) || 12000,
  DS_TTL: 5000,
  OHLCV_TTL: 15000,
  RUG_TTL: 90_000,
  SIG_TTL: 12_000,
  TX_PARSE_CAP: 6,
};

const RUG_RANK = { ok: 0, warn: 1, warning: 1, danger: 2, rugged: 3 };

const SKIP_OWNERS = new Set([
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
  'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
]);

function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,%]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function pctChange(from, to) {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

function romeStamp(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  return fmt.format(d).replace('T', ' ') + ' Europe/Rome';
}

function isPubkey(addr) {
  return typeof addr === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function shortAddr(a) {
  if (!a) return '';
  return a.slice(0, 4) + '…' + a.slice(-4);
}

function readFileSafe(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function atomicWrite(file, text) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = file + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

function appendLog(line) {
  const row = `[${romeStamp()}] ${line}\n`;
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, row, 'utf8');
  return row;
}

function parsePipeTable(md) {
  const rows = [];
  const lines = String(md || '').split(/\r?\n/);
  let headers = null;
  for (const line of lines) {
    if (!/^\s*\|/.test(line)) {
      if (headers) break;
      continue;
    }
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (!cells.length) continue;
    if (cells.every((c) => /^[-:]+$/.test(c))) continue;
    if (!headers) {
      headers = cells.map((h) => h.replace(/\s+/g, ''));
      continue;
    }
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
    rows.push(obj);
  }
  return rows;
}

function extractSection(md, headingRe) {
  const lines = String(md || '').split(/\r?\n/);
  const out = [];
  let on = false;
  let level = 0;
  for (const line of lines) {
    const m = /^(#{1,4})\s+(.*)/.exec(line);
    if (m) {
      if (on && m[1].length <= level) break;
      if (!on && headingRe.test(m[2].trim())) {
        on = true;
        level = m[1].length;
        continue;
      }
    }
    if (on) out.push(line);
  }
  return out.join('\n');
}

function stripTicks(s) {
  return String(s || '').replace(/`/g, '').trim();
}

function normalizePosition(raw, source) {
  const mint = stripTicks(raw.mint || raw.Mint || '');
  if (!isPubkey(mint) && !(process.env.NINJA_ALLOW_TEST_MINT === '1' && mint)) return null;
  const symbol = stripTicks(raw.symbol || raw.Symbol || raw.token || '???');
  const entryUsd = num(raw.entryUsd || raw.EntryUsd || raw.entry || raw.Entry);
  if (entryUsd == null || entryUsd <= 0) return null;
  return {
    symbol,
    mint,
    entryUsd,
    qty: num(raw.qty || raw.Qty),
    spentUsd: num(raw.spentUsd || raw.SpentUsd || raw.spent),
    liqUsdEntry: num(raw.liqUsdEntry || raw.LiqUsdEntry || raw.liqEntry),
    copiedWallet: stripTicks(raw.copiedWallet || raw.CopiedWallet || raw.wallet || '') || null,
    openedAt: stripTicks(raw.openedAt || raw.OpenedAt || raw.opened) || null,
    peakUsd: num(raw.peakUsd || raw.PeakUsd),
    source,
    notes: stripTicks(raw.notes || raw.Notes || ''),
  };
}

function parseCopyLive(md) {
  if (!md) return [];
  const open = extractSection(md, /^OPEN\b/i) || md;
  return parsePipeTable(open).map((r) => normalizePosition({
    symbol: r.Symbol,
    mint: r.Mint,
    entryUsd: r.EntryUsd || r.Entry,
    qty: r.Qty,
    spentUsd: r.SpentUsd || r.Spent,
    liqUsdEntry: r.LiqUsdEntry || r.LiqEntry,
    copiedWallet: r.CopiedWallet || r.Wallet,
    openedAt: r.OpenedAt || r.Opened,
    peakUsd: r.PeakUsd,
    notes: r.Notes,
  }, 'copy-live')).filter(Boolean);
}

function bookIsFlat(md) {
  if (!md) return false;
  return /open_LIVE:\s*\*\*0\s*\/\s*3\*\*/i.test(md)
    || /LIVE:\s*\*\*none\*\*/i.test(md)
    || /LIVE 0\/3/i.test(md)
    || /Nessuno\s*\(Risk/i.test(md)
    || /open_LIVE:\s*0\s*\/\s*3/i.test(md);
}

function parseRiskLive(md) {
  if (!md) return [];
  if (bookIsFlat(md)) return [];
  const liveSec = extractSection(md, /^LIVE\b/i);
  const fromTable = parsePipeTable(liveSec || md).map((r) => normalizePosition({
    symbol: r.Symbol,
    mint: r.Mint,
    entryUsd: r.EntryUsd || r.Entry,
    qty: r.Qty,
    spentUsd: r.SpentUsd || r.Spent,
    liqUsdEntry: r.LiqUsdEntry || r.LiqEntry,
    copiedWallet: r.CopiedWallet,
    openedAt: r.OpenedAt,
    peakUsd: r.PeakUsd,
    notes: r.Notes,
  }, 'risk')).filter(Boolean);
  if (fromTable.length) return fromTable;

  // Block form: "- SYMBOL ... mint `...` ... entry $x ... qty y"
  const blocks = [];
  const re = /(?:^|\n)[-*]\s+(?:FILL\s+)?([A-Z0-9$.]{2,12})\b[\s\S]{0,400}?mint[:\s`]*([1-9A-HJ-NP-Za-km-z]{32,44})[\s\S]{0,300}?entry[^\d$]*\$?([0-9.]+)/gi;
  let m;
  const src = liveSec || md;
  while ((m = re.exec(src))) {
    const pos = normalizePosition({
      symbol: m[1],
      mint: m[2],
      entryUsd: m[3],
    }, 'risk');
    if (pos) blocks.push(pos);
  }
  return blocks;
}

function loadPositions() {
  const map = new Map();
  const add = (p) => {
    if (!p || !p.mint) return;
    const prev = map.get(p.mint);
    if (!prev) map.set(p.mint, p);
    else map.set(p.mint, { ...prev, ...p, source: [prev.source, p.source].filter(Boolean).join('+') });
  };
  if (POSITIONS_FILE) {
    try {
      const raw = fs.readFileSync(POSITIONS_FILE, 'utf8');
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : (data.positions || data.open || []);
      for (const r of list) add(normalizePosition(r, 'file') || r);
    } catch (e) {
      appendLog(`ERROR positions-file ${POSITIONS_FILE}: ${e.message}`);
    }
  }
  for (const p of parseRiskLive(readFileSafe(RISK_FILE))) add(p);
  for (const p of parseCopyLive(readFileSafe(COPY_FILE))) add(p);
  return [...map.values()];
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function defaultState() {
  return {
    version: 1,
    tz: 'Europe/Rome',
    wallet: process.env.ZDESK_AGENT_WALLET || '',
    rules: {
      redFromEntryPct: THRESH.RED_FROM_ENTRY,
      redFromPeakPct: THRESH.RED_FROM_PEAK,
      hardStopPct: THRESH.HARD_STOP,
      liqRedPct: THRESH.LIQ_RED,
      liqHardPct: THRESH.LIQ_HARD,
      windowMinutes: 10,
      trailTightenPct: THRESH.TRAIL_TIGHTEN_PCT,
      copyTakeProfitPct: THRESH.COPY_TP_PCT,
      copyExitStyle: '100%',
    },
    daemon: { pid: process.pid, status: 'starting', lastTick: null, intervalMs: THRESH.INTERVAL_MS, lagMs: null, keys: false },
    positions: [],
    lastExits: [],
    updatedAt: new Date().toISOString(),
    updatedAtRome: romeStamp(),
  };
}

function writeState(state) {
  state.updatedAt = new Date().toISOString();
  state.updatedAtRome = romeStamp();
  atomicWrite(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

/* ---------- market fetch (short TTL, no keys) ---------- */

async function fetchDsFast(mint) {
  const key = 'ninja:ds:' + mint;
  const fresh = cache.fresh(key);
  if (fresh) return { ...fresh, cached: true };
  try {
    let data;
    try {
      data = await sources.httpJson(`https://api.dexscreener.com/token-pairs/v1/solana/${mint}`, { timeout: 8000 });
    } catch {
      data = await sources.httpJson(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { timeout: 8000 });
      data = data && data.pairs;
    }
    const pairs = Array.isArray(data) ? data : [];
    const best = sources.bestSolanaPair(pairs, mint);
    const row = sources.normalizeDsPair(best);
    const payload = { row, fetchedAt: Date.now() };
    cache.set(key, payload, THRESH.DS_TTL);
    return payload;
  } catch (e) {
    const stale = cache.stale(key);
    if (stale) return { ...stale, stale: true, error: e.message };
    return { row: null, error: e.message };
  }
}

async function fetchOhlcvFast(pairAddress, timeframe, aggregate) {
  if (!pairAddress) return { candles: [], error: 'no-pair' };
  const key = `ninja:ohlcv:${pairAddress}:${timeframe}:${aggregate}`;
  const fresh = cache.fresh(key);
  if (fresh) return { ...fresh, cached: true };
  try {
    const url = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${encodeURIComponent(pairAddress)}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=24&currency=usd`;
    const data = await sources.httpJson(url, { timeout: 10000 });
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
    const payload = { candles, fetchedAt: Date.now() };
    cache.set(key, payload, THRESH.OHLCV_TTL);
    return payload;
  } catch (e) {
    const stale = cache.stale(key);
    if (stale) return { ...stale, stale: true, error: e.message };
    return { candles: [], error: e.message };
  }
}

async function fetchRugFast(mint, pairAddress) {
  const key = 'ninja:rug:' + mint;
  const fresh = cache.fresh(key);
  if (fresh) return fresh;
  try {
    const rug = await sources.fetchRug(mint, pairAddress);
    cache.set(key, rug, THRESH.RUG_TTL);
    return rug;
  } catch (e) {
    return cache.stale(key) || null;
  }
}

function classifyWalletDelta(tx, wallet, mint) {
  if (!tx || !tx.meta || tx.meta.err) return null;
  const preMap = new Map();
  const postMap = new Map();
  for (const b of tx.meta.preTokenBalances || []) {
    if (b.owner === wallet && b.mint === mint) {
      preMap.set(mint, num(b.uiTokenAmount && b.uiTokenAmount.uiAmount) || 0);
    }
  }
  for (const b of tx.meta.postTokenBalances || []) {
    if (b.owner === wallet && b.mint === mint) {
      postMap.set(mint, num(b.uiTokenAmount && b.uiTokenAmount.uiAmount) || 0);
    }
  }
  const d = (postMap.get(mint) || 0) - (preMap.get(mint) || 0);
  if (d < -1e-9) {
    const sig = (tx.transaction && tx.transaction.signatures && tx.transaction.signatures[0]) || null;
    return { side: 'SELL', size: -d, signature: sig, blockTime: tx.blockTime || null, wallet };
  }
  return null;
}

async function recentSells(wallet, mint, sinceUnix) {
  if (!isPubkey(wallet) || SKIP_OWNERS.has(wallet)) return [];
  const key = `ninja:sigs:${wallet}:${mint}`;
  const fresh = cache.fresh(key);
  if (fresh) return fresh;
  const sells = [];
  try {
    const sigs = await sources.rpcCall('getSignaturesForAddress', [wallet, { limit: 12 }], 'publicnode') || [];
    let parsed = 0;
    for (const s of sigs) {
      if (s.err) continue;
      if (sinceUnix && s.blockTime && s.blockTime < sinceUnix - 30) continue;
      if (parsed >= THRESH.TX_PARSE_CAP) break;
      try {
        const tx = await sources.rpcCall('getTransaction', [
          s.signature,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
        ], 'publicnode');
        parsed++;
        const ev = classifyWalletDelta(tx, wallet, mint);
        if (ev) {
          ev.signature = ev.signature || s.signature;
          ev.blockTime = ev.blockTime || s.blockTime;
          sells.push(ev);
        }
      } catch {
        break;
      }
      await sources.sleep(120);
    }
  } catch {
    const stale = cache.stale(key);
    return stale || [];
  }
  cache.set(key, sells, THRESH.SIG_TTL);
  return sells;
}

function candleDump(candles, txns, timeframe) {
  if (!candles || candles.length < 6) return null;
  const last = candles[candles.length - 1];
  const prev = candles.slice(0, -1);
  const closed = (last.close != null && last.open != null && last.time && (Date.now() / 1000 - last.time) < (timeframe === '1m' ? 180 : 600))
    ? last
    : last;
  if (!closed || closed.open == null || closed.close == null) return null;
  if (!(closed.close < closed.open)) return null;
  const vols = prev.map((c) => c.volume || 0).filter((v) => v > 0).sort((a, b) => a - b);
  if (vols.length < 5) return null;
  const mid = vols[Math.floor(vols.length / 2)];
  if (!(mid > 0) || !((closed.volume || 0) >= THRESH.VOL_SPIKE_MULT * mid)) return null;
  const t = (txns && (timeframe === '5m' ? txns.m5 : (txns.m5 || txns.h1))) || {};
  const buys = num(t.buys);
  const sells = num(t.sells);
  if (sells == null || buys == null || !(sells > buys)) return null;
  const dropPct = pctChange(closed.open, closed.close);
  return {
    timeframe,
    dropPct,
    volume: closed.volume,
    medianVol: mid,
    buys,
    sells,
  };
}

async function defaultFetchMarket(pos) {
  const ds = await fetchDsFast(pos.mint);
  const row = ds.row || {};
  const pairAddress = row.pairAddress || pos.pairAddress || null;
  const [ohlcv1, ohlcv5, rug] = await Promise.all([
    pairAddress ? fetchOhlcvFast(pairAddress, 'minute', 1) : Promise.resolve({ candles: [] }),
    pairAddress ? fetchOhlcvFast(pairAddress, 'minute', 5) : Promise.resolve({ candles: [] }),
    fetchRugFast(pos.mint, pairAddress),
  ]);
  const openedUnix = pos.openedAt ? (Date.parse(pos.openedAt) / 1000) : (Date.now() / 1000 - 86400);
  const watch = [];
  if (pos.copiedWallet && isPubkey(pos.copiedWallet)) watch.push({ role: 'copied', wallet: pos.copiedWallet });
  const holders = (rug && (rug.holdersExPool || rug.holders)) || [];
  for (const h of holders.slice(0, 2)) {
    const w = h.owner || h.address;
    if (isPubkey(w) && !SKIP_OWNERS.has(w)) watch.push({ role: h.insider ? 'insider' : 'top_holder', wallet: w, pct: h.pct });
  }
  const seenW = new Set();
  const sells = [];
  for (const w of watch) {
    if (seenW.has(w.wallet)) continue;
    seenW.add(w.wallet);
    const evs = await recentSells(w.wallet, pos.mint, openedUnix);
    for (const ev of evs) sells.push({ ...ev, role: w.role, pct: w.pct });
  }
  return {
    priceUsd: row.priceUsd != null ? row.priceUsd : null,
    liqUsd: row.liqUsd != null ? row.liqUsd : null,
    symbol: row.symbol || pos.symbol,
    pairAddress,
    txns: row.txns || null,
    priceChange: row.priceChange || null,
    candles1m: (ohlcv1 && ohlcv1.candles) || [],
    candles5m: (ohlcv5 && ohlcv5.candles) || [],
    rug: rug || null,
    sellerEvents: sells,
    errors: [ds.error, ohlcv1.error, ohlcv5.error].filter(Boolean),
    cached: !!(ds.cached && ohlcv1.cached),
  };
}

/* ---------- signal evaluation (pure) ---------- */

function evalSignals(pos, market, prev) {
  const now = Date.now();
  const mark = market.priceUsd != null ? market.priceUsd : (prev && prev.mark) || null;
  const peakUsd = Math.max(
    pos.entryUsd || 0,
    num(pos.peakUsd) || 0,
    num(prev && prev.peakUsd) || 0,
    mark || 0,
  );
  const liqUsd = market.liqUsd != null ? market.liqUsd : (prev && prev.liqUsd) || null;
  const liqEntry = pos.liqUsdEntry != null ? pos.liqUsdEntry : (prev && prev.liqUsdEntry) || liqUsd;
  const pnlPct = pctChange(pos.entryUsd, mark);
  const fromPeakPct = pctChange(peakUsd, mark);
  const liqPct = pctChange(liqEntry, liqUsd);

  const reds = [];
  const hards = [];

  if (pnlPct != null && pnlPct <= THRESH.HARD_STOP) {
    hards.push({
      id: 'hard_stop',
      detail: `prezzo ${pnlPct.toFixed(2)}% ≤ hard stop ${THRESH.HARD_STOP}% dall'entry`,
    });
  }
  if (liqPct != null && liqPct <= THRESH.LIQ_HARD) {
    hards.push({
      id: 'liq_hard',
      detail: `liquidità ${liqPct.toFixed(1)}% ≤ ${THRESH.LIQ_HARD}% vs entry`,
    });
  }

  const rug = market.rug;
  const baseRug = (prev && prev.rugBaseline) || null;
  if (rug) {
    const level = rug.rugged ? 'rugged' : String(rug.riskLevel || 'ok').toLowerCase();
    const rank = RUG_RANK[level] != null ? RUG_RANK[level] : 0;
    const baseLevel = baseRug ? (baseRug.rugged ? 'rugged' : String(baseRug.riskLevel || 'ok').toLowerCase()) : 'ok';
    const baseRank = RUG_RANK[baseLevel] != null ? RUG_RANK[baseLevel] : 0;
    if (rug.rugged || rank >= 2) {
      hards.push({
        id: 'rug',
        detail: rug.rugged ? 'RugCheck rugged=true' : `RugCheck ${level}`,
      });
    } else if (baseRug && rank > baseRank) {
      reds.push({
        id: 'rug_worse',
        detail: `RugCheck ${baseLevel} → ${level}`,
      });
    }
  }

  if (pnlPct != null && pnlPct <= THRESH.RED_FROM_ENTRY) {
    reds.push({
      id: 'price_drawdown',
      detail: `prezzo ${pnlPct.toFixed(2)}% ≤ ${THRESH.RED_FROM_ENTRY}% dall'entry`,
    });
  } else if (fromPeakPct != null && fromPeakPct <= THRESH.RED_FROM_PEAK && peakUsd > pos.entryUsd) {
    reds.push({
      id: 'price_drawdown',
      detail: `prezzo ${fromPeakPct.toFixed(2)}% ≤ ${THRESH.RED_FROM_PEAK}% dal picco ($${peakUsd})`,
    });
  }

  const dump1 = candleDump(market.candles1m, market.txns, '1m');
  const dump5 = candleDump(market.candles5m, market.txns, '5m');
  const dump = dump1 || dump5;
  if (dump) {
    reds.push({
      id: 'candle_dump',
      detail: `candela ${dump.timeframe} rossa, vol ${Number(dump.volume).toFixed(0)} ≥ ${THRESH.VOL_SPIKE_MULT}× mediana, sell ${dump.sells} > buy ${dump.buys}`,
    });
  }

  if (liqPct != null && liqPct <= THRESH.LIQ_RED) {
    reds.push({
      id: 'liq_drop',
      detail: `liquidità ${liqPct.toFixed(1)}% ≤ ${THRESH.LIQ_RED}% vs entry`,
    });
  }

  const sellers = market.sellerEvents || [];
  if (sellers.length) {
    const s = sellers[0];
    reds.push({
      id: 'smart_sell',
      detail: `${s.role || 'wallet'} ${shortAddr(s.wallet)} ha venduto ${s.size != null ? Number(s.size).toPrecision(4) : ''} ${pos.symbol}`,
    });
  }

  // hard already implies the matching soft signal; keep soft list for logs but EXIT is immediate
  return {
    now,
    mark,
    peakUsd,
    liqUsd,
    liqUsdEntry: liqEntry,
    pnlPct,
    fromPeakPct,
    liqPct,
    reds,
    hards,
    rugBaseline: baseRug || (rug ? { riskLevel: rug.riskLevel, rugged: !!rug.rugged, score: rug.score } : null),
    symbol: market.symbol || pos.symbol,
    pairAddress: market.pairAddress || (prev && prev.pairAddress) || null,
    errors: market.errors || [],
  };
}

function applySignals(prevRow, pos, ev) {
  const nowIso = new Date(ev.now).toISOString();
  const prev = prevRow || {};
  const firstAt = prev.firstRedAt ? Date.parse(prev.firstRedAt) : null;
  const prevIds = new Set((prev.activeSignalIds || []).concat((prev.windowSignals || []).map((s) => s.id)));
  const windowSignals = (prev.windowSignals || []).filter((s) => ev.now - Date.parse(s.at) <= THRESH.WINDOW_MS);

  let status = prev.status === 'EXIT' ? 'EXIT' : 'OK';
  let action = prev.status === 'EXIT' ? (prev.action || 'SELL_100_SLIP_5') : null;
  let reason = prev.exitReason || null;
  let firstRedAt = prev.firstRedAt || null;
  let secondRedAt = prev.secondRedAt || null;
  const newEvents = [];

  if (prev.status !== 'EXIT' && ev.hards.length) {
    status = 'EXIT';
    action = 'SELL_100_SLIP_5';
    reason = ev.hards.map((h) => h.id + ': ' + h.detail).join(' | ');
    secondRedAt = nowIso;
    if (!firstRedAt) firstRedAt = nowIso;
    newEvents.push({ kind: 'HARD_EXIT', detail: reason });
  }

  const distinctNew = [];
  if (status !== 'EXIT') {
    for (const r of ev.reds) {
      const alreadyWindow = windowSignals.some((s) => s.id === r.id);
      if (!alreadyWindow) {
        windowSignals.push({ id: r.id, at: nowIso, detail: r.detail });
        distinctNew.push(r);
      }
    }
    const uniqueIds = [...new Set(windowSignals.map((s) => s.id))];
    if (uniqueIds.length === 0) {
      // no red in window
      if (ev.reds.length === 0) {
        if (prev.status === 'WARN') newEvents.push({ kind: 'CLEAR', detail: 'segnali rossi rientrati' });
        status = 'OK';
        action = null;
        firstRedAt = null;
        secondRedAt = null;
        windowSignals.length = 0;
      }
    } else if (uniqueIds.length === 1) {
      status = 'WARN';
      action = 'TIGHTEN_TRAIL_3';
      if (!firstRedAt) firstRedAt = nowIso;
      if (prev.status !== 'WARN') {
        newEvents.push({ kind: 'WARN', detail: ev.reds.map((r) => r.id + ': ' + r.detail).join(' | ') });
      } else if (distinctNew.length && prev.status === 'WARN') {
        // same-window first still unique; already WARN
      }
      reason = ev.reds.map((r) => r.id + ': ' + r.detail).join(' | ');
    } else {
      // two distinct types: EXIT if second arrived within 10 min of first, OR first still active
      const firstTs = firstAt || ev.now;
      const within = ev.now - firstTs <= THRESH.WINDOW_MS;
      const firstStillActive = ev.reds.some((r) => r.id === (prev.windowSignals && prev.windowSignals[0] && prev.windowSignals[0].id))
        || ev.reds.length >= 1;
      if (within || (prev.status === 'WARN' && firstStillActive)) {
        status = 'EXIT';
        action = 'SELL_100_SLIP_5';
        secondRedAt = nowIso;
        if (!firstRedAt) firstRedAt = prev.firstRedAt || nowIso;
        reason = uniqueIds.join(' + ') + ' — ' + windowSignals.map((s) => s.id + ': ' + s.detail).join(' | ');
        newEvents.push({ kind: 'EXIT', detail: reason });
      } else {
        status = 'WARN';
        action = 'TIGHTEN_TRAIL_3';
        firstRedAt = nowIso;
        reason = ev.reds.map((r) => r.id + ': ' + r.detail).join(' | ');
        windowSignals.splice(0, windowSignals.length, ...ev.reds.map((r) => ({ id: r.id, at: nowIso, detail: r.detail })));
        newEvents.push({ kind: 'WARN', detail: reason });
      }
    }
  }

  return {
    mint: pos.mint,
    symbol: ev.symbol || pos.symbol,
    source: pos.source,
    copiedWallet: pos.copiedWallet || null,
    status,
    action,
    exitReason: status === 'EXIT' ? reason : null,
    warnReason: status === 'WARN' ? reason : null,
    trailTightenPct: status === 'WARN' || (status === 'EXIT' && prev.status === 'WARN') ? THRESH.TRAIL_TIGHTEN_PCT : null,
    sellSlippagePct: status === 'EXIT' ? 5 : null,
    entryUsd: pos.entryUsd,
    mark: ev.mark,
    peakUsd: ev.peakUsd,
    qty: pos.qty,
    spentUsd: pos.spentUsd,
    pnlPct: ev.pnlPct != null ? Math.round(ev.pnlPct * 100) / 100 : null,
    fromPeakPct: ev.fromPeakPct != null ? Math.round(ev.fromPeakPct * 100) / 100 : null,
    liqUsd: ev.liqUsd,
    liqUsdEntry: ev.liqUsdEntry,
    liqPct: ev.liqPct != null ? Math.round(ev.liqPct * 10) / 10 : null,
    pairAddress: ev.pairAddress,
    firstRedAt,
    secondRedAt,
    windowSignals,
    activeSignalIds: ev.reds.map((r) => r.id).concat(ev.hards.map((h) => h.id)),
    hards: ev.hards,
    reds: ev.reds,
    rugBaseline: ev.rugBaseline,
    openedAt: pos.openedAt,
    errors: ev.errors,
    updatedAt: nowIso,
    updatedAtRome: romeStamp(new Date(ev.now)),
    _events: newEvents,
  };
}

async function tick(opts = {}) {
  const t0 = Date.now();
  const prevAll = loadState() || defaultState();
  const prevMap = new Map((prevAll.positions || []).map((p) => [p.mint, p]));
  const positions = opts.positions || loadPositions();
  const fetchMarket = opts.fetchMarket || defaultFetchMarket;
  const rows = [];
  const events = [];

  for (const pos of positions) {
    const prev = prevMap.get(pos.mint);
    let market;
    try {
      market = await fetchMarket(pos, prev);
    } catch (e) {
      market = { priceUsd: prev && prev.mark, liqUsd: prev && prev.liqUsd, candles1m: [], candles5m: [], sellerEvents: [], errors: [e.message] };
    }
    const ev = evalSignals(pos, market, prev);
    const row = applySignals(prev, pos, ev);
    rows.push(row);
    for (const evn of row._events || []) {
      events.push({ mint: pos.mint, symbol: row.symbol, ...evn });
      appendLog(`${evn.kind} ${row.symbol} ${shortAddr(pos.mint)} ${evn.detail}`);
    }
    delete row._events;
  }

  for (const old of prevAll.positions || []) {
    if (!positions.some((p) => p.mint === old.mint)) {
      appendLog(`CLOSE_BOOK ${old.symbol} ${shortAddr(old.mint)} status era ${old.status}`);
      if (old.status === 'EXIT') {
        prevAll.lastExits = [old, ...(prevAll.lastExits || [])].slice(0, 20);
      }
    }
  }
  for (const pos of positions) {
    if (!prevMap.has(pos.mint)) {
      appendLog(`NEW_POS ${pos.symbol} ${shortAddr(pos.mint)} entry $${pos.entryUsd} source=${pos.source}`);
    }
  }

  const worst = rows.some((r) => r.status === 'EXIT') ? 'EXIT' : rows.some((r) => r.status === 'WARN') ? 'WARN' : 'OK';
  const lagMs = Date.now() - t0;
  const state = {
    ...(prevAll.version ? prevAll : defaultState()),
    version: 1,
    tz: 'Europe/Rome',
    wallet: process.env.ZDESK_AGENT_WALLET || '',
    rules: defaultState().rules,
    daemon: {
      pid: process.pid,
      status: 'running',
      lastTick: new Date().toISOString(),
      lastTickRome: romeStamp(),
      intervalMs: positions.length ? THRESH.INTERVAL_MS : THRESH.IDLE_INTERVAL_MS,
      lagMs,
      openCount: rows.length,
      worst,
      keys: false,
      signs: false,
    },
    positions: rows,
    lastExits: prevAll.lastExits || [],
    updatedAt: new Date().toISOString(),
    updatedAtRome: romeStamp(),
  };
  writeState(state);
  return { state, events, lagMs };
}

function readPublicState() {
  const st = loadState();
  if (!st) {
    return {
      ok: false,
      missing: true,
      positions: [],
      daemon: { status: 'offline' },
      updatedAtRome: null,
    };
  }
  let alive = false;
  try {
    if (st.daemon && st.daemon.pid) {
      process.kill(st.daemon.pid, 0);
      alive = true;
    }
  } catch {
    alive = false;
  }
  const ageMs = st.daemon && st.daemon.lastTick ? (Date.now() - Date.parse(st.daemon.lastTick)) : null;
  return { ...st, ok: true, daemonAlive: alive, tickAgeMs: ageMs };
}

module.exports = {
  THRESH,
  DESK_DIR,
  STATE_FILE,
  LOG_FILE,
  parseCopyLive,
  parseRiskLive,
  loadPositions,
  loadState,
  writeState,
  defaultState,
  evalSignals,
  applySignals,
  tick,
  appendLog,
  readPublicState,
  romeStamp,
  pctChange,
  candleDump,
  defaultFetchMarket,
};
