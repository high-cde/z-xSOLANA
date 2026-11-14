
'use strict';

const fs = require('fs');
const path = require('path');
const {
  rpcCall, getPairList, fetchRug, getSolPrice, fetchDsTokenPairs,
  bestSolanaPair, normalizeDsPair, isValidPubkey, sleep, num, WSOL, USDC,
} = require('./sources');
const { cache } = require('./cache');
const copypanels = require('./copypanels');

const DESK_DIR = process.env.DESK_DIR || '/workspace/highkali-desk';
const READONLY = /^(1|true|yes)$/i.test(process.env.ZDESK_READONLY || '');
const SIGNALS_FILE = path.join(DESK_DIR, 'copy-signals.md');
const WALLETS_FILE = path.join(DESK_DIR, 'copy-wallets.md');
const LIVE_FILE = path.join(DESK_DIR, 'copy-live.md');
const AGENT_WALLET = '';
const PUBKEY_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
const MAX_GAINERS = 8;
const MAX_WALLETS = 12;
const SIGS_PER_WALLET = 18;
const TX_PARSE_LIMIT = 12;

const SKIP_OWNERS = new Set([
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', // Raydium authority
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
  'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA', // PumpSwap
  '6m2CDdhRgxpH4WjvdzxAYbGxwdGUz5MziiL5jek2kBma',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
]);

let scanState = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  error: null,
  progress: '',
};

function shortAddr(a) {
  if (!a) return '';
  return a.slice(0, 4) + '…' + a.slice(-4);
}

function romeStamp(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  // sv-SE gives YYYY-MM-DD HH:MM:SS
  return fmt.format(d).replace(' ', ' ') + ' CET';
}

function ensureSignalsFile() {
  if (READONLY) return;
  if (!fs.existsSync(SIGNALS_FILE)) {
    const header = `# Copy signals — SOLO PAPER

Nessun trade reale. Log automatico delle nuove compre osservate sui wallet
copy-trader (top holder dei token in maggiore rialzo, analisi RPC pubblica).
Serve solo alla valutazione in simulazione del desk HighKali.

| Quando (Europe/Rome) | Wallet | Mint | Size | Prezzo est. | Tx | Fonte |
|---|---|---|---|---|---|---|
`;
    fs.writeFileSync(SIGNALS_FILE, header, 'utf8');
  }
}

let loggedSigIndex = null;
let loggedSigIndexBytes = -1;

function loadLoggedSigs() {
  try {
    const raw = fs.readFileSync(SIGNALS_FILE, 'utf8');
    const bytes = Buffer.byteLength(raw);
    if (loggedSigIndex && loggedSigIndexBytes === bytes) return loggedSigIndex;
    const set = new Set();
    const re = /`([1-9A-HJ-NP-Za-km-z]{80,100})`/g;
    let m;
    while ((m = re.exec(raw))) set.add(m[1]);
    loggedSigIndex = set;
    loggedSigIndexBytes = bytes;
    return set;
  } catch {
    loggedSigIndex = new Set();
    loggedSigIndexBytes = 0;
    return loggedSigIndex;
  }
}

function alreadyLogged(sig) {
  if (!sig) return false;
  return loadLoggedSigs().has(sig);
}

function appendBuySignals(buys) {
  if (READONLY) return 0;
  ensureSignalsFile();
  const index = loadLoggedSigs();
  const lines = [];
  const written = [];
  const nowMs = Date.now();
  for (const b of buys) {
    if (!b.signature || index.has(b.signature)) continue;
    const when = b.blockTime
      ? romeStamp(new Date(b.blockTime * 1000))
      : romeStamp();
    const px = b.priceUsd != null ? ('$' + Number(b.priceUsd).toPrecision(6)) : 'n/d';
    const size = b.size != null ? String(Math.round(b.size * 1000) / 1000) : 'n/d';
    lines.push(
      `| ${when} | \`${b.wallet}\` | \`${b.mint}\` | ${size} | ${px} | \`${b.signature}\` | rpc |`
    );
    index.add(b.signature);
    written.push(b);
  }
  if (lines.length) {
    const chunk = lines.join('\n') + '\n';
    fs.appendFileSync(SIGNALS_FILE, chunk, 'utf8');
    loggedSigIndexBytes += Buffer.byteLength(chunk);
    const lags = written.map((b) => {
      const swapMs = b.blockTime ? b.blockTime * 1000 : nowMs;
      return Math.max(0, Math.round((nowMs - swapMs) / 1000));
    });
    const minLag = Math.min(...lags);
    const maxLag = Math.max(...lags);
    console.log(
      `[copy-signals] wrote ${lines.length} buy(s) at ${romeStamp()} — lag ${minLag}s..${maxLag}s vs swap time`
    );
  }
  return lines.length;
}

async function pickGainers() {
  let list;
  try {
    list = await getPairList('trending');
  } catch {
    list = { rows: [] };
  }
  const rows = (list.rows || []).filter((r) => r && r.mint && (r.liqUsd || 0) >= 8000);
  rows.sort((a, b) => {
    const ca = Math.max(num(a.priceChange && a.priceChange.h6) || -999, num(a.priceChange && a.priceChange.h24) || -999);
    const cb = Math.max(num(b.priceChange && b.priceChange.h6) || -999, num(b.priceChange && b.priceChange.h24) || -999);
    return cb - ca;
  });
  return rows.filter((r) => {
    const ch = Math.max(num(r.priceChange && r.priceChange.h6) || 0, num(r.priceChange && r.priceChange.h24) || 0);
    return ch >= 8;
  }).slice(0, MAX_GAINERS);
}

async function discoverWallets(gainers) {
  const found = new Map(); // wallet -> { appearances, mints, samplePct }
  for (const g of gainers) {
    scanState.progress = 'holder ' + (g.symbol || g.mint);
    let rug = g.rug;
    try { rug = await fetchRug(g.mint, g.pairAddress); } catch { /* */ }
    const holders = (rug && (rug.holdersExPool || rug.holders)) || [];
    let n = 0;
    for (const h of holders) {
      const owner = h.owner || h.address;
      if (!isValidPubkey(owner)) continue;
      if (SKIP_OWNERS.has(owner)) continue;
      if (g.pairAddress && (owner === g.pairAddress || h.address === g.pairAddress)) continue;
      if ((h.pct || 0) >= 80) continue; // probabilmente curva/pool
      if (++n > 4) break;
      const rec = found.get(owner) || { wallet: owner, appearances: 0, mints: [], samplePct: 0 };
      rec.appearances += 1;
      rec.mints.push({ mint: g.mint, symbol: g.symbol, pct: h.pct, change: g.priceChange });
      rec.samplePct += h.pct || 0;
      found.set(owner, rec);
    }
    await sleep(400);
  }
  const arr = [...found.values()].sort((a, b) => b.appearances - a.appearances || b.samplePct - a.samplePct);
  return arr.slice(0, MAX_WALLETS);
}

function classifyTx(tx, wallet) {
  if (!tx || !tx.meta || tx.meta.err) return [];
  const msg = tx.transaction && (tx.transaction.message || tx.transaction);
  const keys = [];
  const accountKeys = (msg && msg.accountKeys) || [];
  for (const k of accountKeys) {
    keys.push(typeof k === 'string' ? k : (k.pubkey || k));
  }
  const preSol = (tx.meta.preBalances || []);
  const postSol = (tx.meta.postBalances || []);
  const idx = keys.findIndex((k) => k === wallet);
  let dSol = 0;
  if (idx >= 0) dSol = ((postSol[idx] || 0) - (preSol[idx] || 0)) / 1e9;

  const preTok = tx.meta.preTokenBalances || [];
  const postTok = tx.meta.postTokenBalances || [];
  const deltas = new Map(); // mint -> {dTok, owner}

  function keyOf(b) { return (b.mint || '') + '|' + (b.owner || ''); }

  const preMap = new Map();
  for (const b of preTok) {
    if (b.owner !== wallet) continue;
    preMap.set(b.mint, num(b.uiTokenAmount && b.uiTokenAmount.uiAmount) || 0);
  }
  const postMap = new Map();
  for (const b of postTok) {
    if (b.owner !== wallet) continue;
    postMap.set(b.mint, num(b.uiTokenAmount && b.uiTokenAmount.uiAmount) || 0);
  }
  const mints = new Set([...preMap.keys(), ...postMap.keys()]);
  const events = [];
  const t = tx.blockTime || null;
  const sig = (tx.transaction && tx.transaction.signatures && tx.transaction.signatures[0]) || null;

  for (const mint of mints) {
    if (mint === WSOL || mint === USDC) continue;
    const d = (postMap.get(mint) || 0) - (preMap.get(mint) || 0);
    if (Math.abs(d) < 1e-9) continue;
    if (d > 0 && dSol < -0.00001) {
      const costSol = -dSol;
      events.push({
        side: 'BUY', mint, size: d, costSol, priceSol: costSol / d,
        blockTime: t, signature: sig,
      });
    } else if (d < 0 && dSol > 0.00001) {
      const proceedsSol = dSol;
      events.push({
        side: 'SELL', mint, size: -d, proceedsSol, priceSol: proceedsSol / (-d),
        blockTime: t, signature: sig,
      });
    } else if (d > 0) {
      events.push({ side: 'BUY', mint, size: d, costSol: dSol < 0 ? -dSol : null, priceSol: null, blockTime: t, signature: sig });
    } else if (d < 0) {
      events.push({ side: 'SELL', mint, size: -d, proceedsSol: dSol > 0 ? dSol : null, priceSol: null, blockTime: t, signature: sig });
    }
  }
  return events;
}

function fifoStats(events, solUsd) {
  // events oldest first
  const books = new Map();
  let realizedSol = 0;
  let wins = 0;
  let losses = 0;
  let closed = 0;
  const recent = [];
  for (const ev of events) {
    const book = books.get(ev.mint) || { lots: [] };
    if (ev.side === 'BUY') {
      book.lots.push({ qty: ev.size, costSol: ev.costSol || 0 });
    } else if (ev.side === 'SELL') {
      let remain = ev.size;
      let cost = 0;
      while (remain > 1e-12 && book.lots.length) {
        const lot = book.lots[0];
        const take = Math.min(lot.qty, remain);
        const lotCost = lot.qty > 0 ? (lot.costSol * take / lot.qty) : 0;
        cost += lotCost;
        lot.qty -= take;
        lot.costSol -= lotCost;
        remain -= take;
        if (lot.qty <= 1e-12) book.lots.shift();
      }
      const proceeds = ev.proceedsSol || 0;
      const pnl = proceeds - cost;
      realizedSol += pnl;
      closed += 1;
      if (pnl > 0) wins += 1;
      else if (pnl < 0) losses += 1;
    }
    books.set(ev.mint, book);
    recent.push(ev);
  }
  recent.sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0));
  const winRate = closed > 0 ? wins / closed : null;
  return {
    realizedSol,
    realizedUsd: solUsd != null ? realizedSol * solUsd : null,
    wins,
    losses,
    closed,
    winRate,
    trades: events.length,
    recent: recent.slice(0, 12),
  };
}

async function analyzeWallet(w, solUsd, priceMap) {
  let sigs = [];
  try {
    sigs = await rpcCall('getSignaturesForAddress', [w.wallet, { limit: SIGS_PER_WALLET }], 'mainnet') || [];
  } catch (e) {
    return { ...w, error: e.message, stats: null, recent: [] };
  }
  const events = [];
  let parsed = 0;
  for (const s of sigs) {
    if (s.err) continue;
    if (parsed >= TX_PARSE_LIMIT) break;
    try {
      const tx = await rpcCall('getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }], 'mainnet');
      parsed++;
      const evs = classifyTx(tx, w.wallet);
      for (const ev of evs) {
        ev.signature = ev.signature || s.signature;
        ev.blockTime = ev.blockTime || s.blockTime;
        const px = priceMap.get(ev.mint);
        if (px && ev.priceSol != null && solUsd) ev.priceUsd = ev.priceSol * solUsd;
        else if (px) ev.priceUsd = px;
        else if (ev.priceSol != null && solUsd) ev.priceUsd = ev.priceSol * solUsd;
        ev.symbol = (priceMap.get('sym:' + ev.mint)) || ev.mint.slice(0, 4);
        events.push(ev);
      }
    } catch {
      // rate limit — stop parsing this wallet
      break;
    }
    await sleep(180);
  }
  events.sort((a, b) => (a.blockTime || 0) - (b.blockTime || 0));
  const stats = fifoStats(events, solUsd);
  return {
    wallet: w.wallet,
    appearances: w.appearances,
    gainerMints: w.mints,
    solscan: `https://solscan.io/account/${w.wallet}`,
    parsedTx: parsed,
    stats,
    recent: stats.recent,
  };
}

async function runScan() {
  if (scanState.status === 'running') return;
  scanState = { status: 'running', startedAt: new Date().toISOString(), finishedAt: null, error: null, progress: 'gainers' };
  try {
    const solUsd = await getSolPrice();
    const gainers = await pickGainers();
    scanState.progress = `gainers ${gainers.length}`;
    const discovered = await discoverWallets(gainers);
    const wallets = mergeWatchList(discovered, parseApprovedWallets().wallets);

    const priceMap = new Map();
    for (const g of gainers) {
      if (g.priceUsd) priceMap.set(g.mint, g.priceUsd);
      if (g.symbol) priceMap.set('sym:' + g.mint, g.symbol);
    }

    const analyzed = [];
    for (const w of wallets) {
      scanState.progress = 'wallet ' + shortAddr(w.wallet);
      const rec = await analyzeWallet(w, solUsd, priceMap);
      analyzed.push(rec);
      await sleep(250);
    }

    analyzed.sort((a, b) => {
      const wa = (a.stats && a.stats.winRate) || 0;
      const wb = (b.stats && b.stats.winRate) || 0;
      const pa = (a.stats && a.stats.realizedSol) || 0;
      const pb = (b.stats && b.stats.realizedSol) || 0;
      const ca = (a.stats && a.stats.closed) || 0;
      const cb = (b.stats && b.stats.closed) || 0;
      if (cb !== ca) return cb - ca;
      if (wb !== wa) return wb - wa;
      return pb - pa;
    });

    // paper log: new BUY events from analyzed wallets
    const newBuys = [];
    for (const w of analyzed) {
      for (const ev of w.recent || []) {
        if (ev.side === 'BUY' && ev.signature) {
          newBuys.push({
            wallet: w.wallet,
            mint: ev.mint,
            size: ev.size,
            priceUsd: ev.priceUsd,
            signature: ev.signature,
            blockTime: ev.blockTime,
          });
        }
      }
    }
    let logged = 0;
    try { logged = appendBuySignals(newBuys); } catch (e) { /* file errors shouldn't fail the scan */ scanState.error = 'log: ' + e.message; }

    const payload = {
      updatedAt: new Date().toISOString(),
      paperOnly: true,
      notice: 'Solo valutazione PAPER. Nessun trade reale. Wallet scoperti tra i top holder (ex pool) dei token in maggiore rialzo su GeckoTerminal/DexScreener; PnL e win rate stimati dalle transazioni RPC recenti (campione limitato).',
      solUsd,
      gainers: gainers.map((g) => ({
        mint: g.mint, symbol: g.symbol, name: g.name,
        priceUsd: g.priceUsd, liqUsd: g.liqUsd,
        changeH6: g.priceChange && g.priceChange.h6,
        changeH24: g.priceChange && g.priceChange.h24,
      })),
      wallets: analyzed,
      loggedNewBuys: logged,
      signalsFile: SIGNALS_FILE,
    };
    cache.set('copytrader', payload, 12 * 60_000);
    scanState = { status: 'done', startedAt: scanState.startedAt, finishedAt: new Date().toISOString(), error: scanState.error, progress: 'ok' };
    return payload;
  } catch (e) {
    scanState = { status: 'error', startedAt: scanState.startedAt, finishedAt: new Date().toISOString(), error: e.message, progress: 'error' };
    throw e;
  }
}


function readDeskFile(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function parseApprovedWallets() {
  // Always re-read at runtime: another worker may be rewriting copy-wallets.md.
  return copypanels.approvedAddresses();
}

function mergeWatchList(discovered, approvedAddrs) {
  const seen = new Set();
  const out = [];
  for (const addr of approvedAddrs || []) {
    if (!isValidPubkey(addr) || seen.has(addr)) continue;
    seen.add(addr);
    const hit = (discovered || []).find((w) => w.wallet === addr);
    out.push(hit ? { ...hit, approved: true } : {
      wallet: addr, appearances: 0, mints: [], samplePct: 0, approved: true,
    });
  }
  const cap = Math.max(MAX_WALLETS, out.length);
  for (const w of discovered || []) {
    if (!w || !w.wallet || seen.has(w.wallet)) continue;
    if (out.length >= cap) break;
    seen.add(w.wallet);
    out.push(w);
  }
  return out;
}

function parseBookSection(raw, heading) {
  if (!raw) return [];
  const idx = raw.indexOf(heading);
  if (idx < 0) return [];
  const rest = raw.slice(idx);
  const next = rest.search(/\n## /);
  const section = next > 0 ? rest.slice(0, next) : rest;
  const rows = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('|')) continue;
    if (/^\|\s*-+/.test(line)) continue;
    if (/Symbol \| Mint|Quando \(Europe/.test(line)) continue;
    const mint = (line.match(/`([1-9A-HJ-NP-Za-km-z]{32,44})`/) || [])[1];
    if (!mint) continue;
    const cells = line.split('|').map((c) => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
    rows.push({ mint, cells });
  }
  return rows;
}

function parseCopyLiveBook() {
  const raw = readDeskFile(LIVE_FILE);
  if (raw == null) return { open: [], closed: [], hasLiveFills: false, missing: true };
  const open = parseBookSection(raw, '## OPEN');
  const closed = parseBookSection(raw, '## CLOSED');
  return { open, closed, hasLiveFills: open.length > 0 || closed.length > 0, missing: false };
}

function livePolicy() {
  const approved = parseApprovedWallets();
  const book = parseCopyLiveBook();
  return {
    mode: 'LIVE',
    executor: 'HighKali compra e vende da solo sul wallet agente',
    wallet: AGENT_WALLET,
    secondaryOnly: true,
    floorUsd: 50,
    floorOn: 'SOL+USDC',
    budgetMaxUsd: 30,
    size: '~1/3 del budget',
    maxPositions: 3,
    stopPct: -2,
    scaleOut: '+4% vende metà; runner +8% / +12%; chiude in pari se torna a entry',
    buySlippagePct: 1,
    exitSlippagePct: 1,
    exitRetrySlippagePct: 2,
    impactMaxPct: 0.5,
    minLiqUsd: 100000,
    snifferRequired: true,
    noPerpetuals: true,
    approvedCount: approved.count,
    approvedWallets: approved.wallets,
    openCount: book.open.length,
    closedCount: book.closed.length,
    hasLiveFills: book.hasLiveFills,
    ovHeld: true,
    ovNote: 'tenuto · non in vendita',
    notice: 'Copy LIVE solo su wallet APPROVED. Lo sniffer anti-fake è obbligatorio prima di ogni buy (blocco su FAKE e EXIT_LIQ). $OV tenuto · non in vendita. Nessun trade da questa dashboard.',
  };
}

function withLive(payload) {
  const live = livePolicy();
  return {
    ...payload,
    live,
    feed: copypanels.feedStatus(getCopyPollState()),
    walletBook: copypanels.parseCopyWallets(),
    refusals: copypanels.getCopyRefusals(),
    routines: copypanels.getRoutineHealth(),
  };
}

function getCopyTrader() {
  const cached = cache.stale('copytrader');
  const fresh = cache.fresh('copytrader');
  if (scanState.status === 'idle' && !cached) {
    runScan().catch(() => {});
  } else if (scanState.status === 'done' && !fresh) {
    // refresh in background when stale
    runScan().catch(() => {});
  }
  if (fresh) return withLive({ ...fresh, status: 'ready', scan: scanState, poll: getCopyPollState(), cached: true });
  if (cached) return withLive({ ...cached, status: scanState.status === 'running' ? 'refreshing' : 'ready', scan: scanState, poll: getCopyPollState(), stale: true });
  return withLive({
    status: 'scanning',
    paperOnly: true,
    notice: 'Scansione pubblica dei top holder in corso (RPC, 1–2 min). Non è la lista APPROVED e non genera fill LIVE.',
    wallets: [],
    gainers: [],
    scan: scanState,
    poll: getCopyPollState(),
  });
}

function startCopyTraderIfNeeded() {
  if (scanState.status === 'idle' && !cache.stale('copytrader')) {
    runScan().catch(() => {});
  }
  startCopySignalPoller();
}

const POLL_INTERVAL_MS = 45_000;
const POLL_SIGS_PER_WALLET = 12;
const POLL_PARSE_LIMIT = 6;
const POLL_MAX_EXTRA = 8;
const POLL_MAX_AGE_SEC = 6 * 3600;

let pollerStarted = false;
let pollInflight = false;
let pollState = {
  status: 'idle',
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
  lastLogged: 0,
  watched: [],
  lastLagsSec: [],
  lastKnownLag: null,
};

function watchedWalletsForPoll() {
  const approved = parseApprovedWallets().wallets || [];
  const cached = cache.stale('copytrader');
  const extras = [];
  const seen = new Set(approved);
  for (const w of (cached && cached.wallets) || []) {
    const addr = w && w.wallet;
    if (!addr || seen.has(addr)) continue;
    seen.add(addr);
    extras.push(addr);
    if (extras.length >= POLL_MAX_EXTRA) break;
  }
  return { approved, wallets: [...approved, ...extras] };
}

async function collectNewBuys(wallet, solUsd) {
  let sigs = [];
  try {
    sigs = await rpcCall('getSignaturesForAddress', [wallet, { limit: POLL_SIGS_PER_WALLET }], 'mainnet') || [];
  } catch (e) {
    throw e;
  }
  const buys = [];
  const nowSec = Math.floor(Date.now() / 1000);
  let parsed = 0;
  for (const s of sigs) {
    if (!s || s.err || !s.signature) continue;
    if (alreadyLogged(s.signature)) continue;
    if (s.blockTime && (nowSec - s.blockTime) > POLL_MAX_AGE_SEC) continue;
    if (parsed >= POLL_PARSE_LIMIT) break;
    try {
      const tx = await rpcCall('getTransaction', [s.signature, {
        encoding: 'jsonParsed',
        maxSupportedTransactionVersion: 0,
      }], 'mainnet');
      parsed++;
      const evs = classifyTx(tx, wallet);
      for (const ev of evs) {
        if (ev.side !== 'BUY') continue;
        ev.signature = ev.signature || s.signature;
        ev.blockTime = ev.blockTime || s.blockTime;
        if (!ev.signature || alreadyLogged(ev.signature)) continue;
        if (ev.priceSol != null && solUsd) ev.priceUsd = ev.priceSol * solUsd;
        ev.wallet = wallet;
        buys.push(ev);
      }
    } catch (e) {
      if (e && (e.status === 429 || /429|too many requests|rate ?limit/i.test(String(e.message || '')))) {
        throw e;
      }
      break;
    }
    await sleep(150);
  }
  return buys;
}

async function pollCopySignals() {
  if (pollInflight) return pollState;
  pollInflight = true;
  pollState = {
    ...pollState,
    status: 'running',
    lastStartedAt: new Date().toISOString(),
    lastError: null,
  };
  try {
    const { approved, wallets } = watchedWalletsForPoll();
    pollState.watched = wallets;
    if (!wallets.length) {
      pollState.status = 'done';
      pollState.lastFinishedAt = new Date().toISOString();
      pollState.lastLogged = 0;
      return pollState;
    }
    const solUsd = await getSolPrice().catch(() => null);
    const allBuys = [];
    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      try {
        const buys = await collectNewBuys(wallet, solUsd);
        allBuys.push(...buys);
      } catch (e) {
        pollState.lastError = (approved.includes(wallet) ? 'approved ' : '') + shortAddr(wallet) + ': ' + (e.message || String(e));
        if (e && (e.status === 429 || /429|too many requests|rate ?limit/i.test(String(e.message || '')))) {
          break;
        }
      }
      await sleep(220);
    }
    const nowMs = Date.now();
    const logged = appendBuySignals(allBuys);
    const lags = allBuys
      .filter((b) => b.signature && alreadyLogged(b.signature) && b.blockTime)
      .map((b) => Math.max(0, Math.round((nowMs - b.blockTime * 1000) / 1000)));
    const lagObj = copypanels.formatLag(lags);
    pollState = {
      ...pollState,
      status: 'done',
      lastFinishedAt: new Date().toISOString(),
      lastLogged: logged,
      lastLagsSec: lags.slice(0, 12),
      lastKnownLag: lagObj || pollState.lastKnownLag,
      approvedCount: approved.length,
    };
    return pollState;
  } catch (e) {
    pollState = {
      ...pollState,
      status: 'error',
      lastFinishedAt: new Date().toISOString(),
      lastError: e.message || String(e),
    };
    return pollState;
  } finally {
    pollInflight = false;
  }
}

function startCopySignalPoller() {
  if (!pollerStarted) {
    pollerStarted = true;
    pollCopySignals().catch((e) => console.error('copy-signals poller', e.message || e));
    setInterval(() => {
      pollCopySignals().catch((e) => console.error('copy-signals poller', e.message || e));
    }, POLL_INTERVAL_MS);
    return;
  }
  if (!pollInflight) {
    pollCopySignals().catch((e) => console.error('copy-signals poller', e.message || e));
  }
}

function getCopyPollState() {
  return {
    ...pollState,
    intervalMs: POLL_INTERVAL_MS,
    intervalSec: Math.round(POLL_INTERVAL_MS / 1000),
  };
}

module.exports = {
  getCopyTrader, startCopyTraderIfNeeded, startCopySignalPoller,
  getCopyPollState, runScan, SIGNALS_FILE,
};
