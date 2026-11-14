'use strict';

const fs = require('fs');
const path = require('path');
const sources = require('./sources');
const { cache } = require('./cache');
const { DESK_DIR } = require('./desk');

// Indirizzo del wallet agente: solo da variabile d'ambiente (non scritto nel repo).
const DESK_WALLET = process.env.ZDESK_AGENT_WALLET || '';
const OV_MINT = '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump';
const FLOOR_USD = 50;
const BUDGET_MAX_USD = 30;
const BUDGET_BUFFER_USD = 1;
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const WSOL = sources.WSOL;
const USDC = sources.USDC;
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const CACHE_TTL = 20_000;
const TX_LIMIT = 12;
const SNAP_MIN_MS = 30_000;
const SNAP_MAX = 480;
const FEE_SOL = 0.00002;

const KNOWN = {
  [WSOL]: { symbol: 'SOL', name: 'Solana' },
  So11111111111111111111111111111111111111112: { symbol: 'SOL', name: 'Solana' },
  [USDC]: { symbol: 'USDC', name: 'USD Coin' },
  [USDT]: { symbol: 'USDT', name: 'Tether' },
};

const SWAP_PROGRAMS = new Set([
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
  'JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph',
  'JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbLLCyF4WeK',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  'PhoeNiXzL6rWKFauMcW5RZ35kjQoJ8zKbZxnwLbKjZp',
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
]);

function sparkPath() {
  return process.env.WALLET_SPARK_FILE || path.join(DESK_DIR, 'wallet-spark.json');
}

function romeTime(secondsOrMs) {
  if (secondsOrMs == null) return null;
  const ms = secondsOrMs > 1e12 ? secondsOrMs : secondsOrMs * 1000;
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(ms)) + ' Europe/Rome';
}

function readSparks() {
  try {
    const raw = fs.readFileSync(sparkPath(), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.points) ? data : { address: DESK_WALLET, points: [] };
  } catch {
    return { address: DESK_WALLET, points: [] };
  }
}

function writeSparks(doc) {
  const file = sparkPath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(doc));
    fs.renameSync(tmp, file);
  } catch (e) {
    // VPS ProtectSystem may block unexpected paths; keep going in memory.
    console.error('wallet spark write', e.message);
  }
}

function pushSpark(address, usd, sol) {
  if (usd == null || !Number.isFinite(usd)) return readSparks().points || [];
  const doc = readSparks();
  if (doc.address && doc.address !== address) {
    doc.address = address;
    doc.points = [];
  }
  doc.address = address;
  const points = Array.isArray(doc.points) ? doc.points : [];
  const now = Date.now();
  const last = points[points.length - 1];
  if (!last || now - last.t >= SNAP_MIN_MS) {
    points.push({ t: now, usd: Math.round(usd * 100) / 100, sol: Math.round(sol * 1e6) / 1e6 });
  } else {
    last.usd = Math.round(usd * 100) / 100;
    last.sol = Math.round(sol * 1e6) / 1e6;
    last.t = now;
  }
  doc.points = points.slice(-SNAP_MAX);
  writeSparks(doc);
  return doc.points;
}

async function jupiterPrices(mints) {
  const uniq = [...new Set(mints.filter(Boolean))];
  if (!uniq.length) return new Map();
  const key = 'jup:px:' + uniq.slice().sort().join(',');
  const fresh = cache.fresh(key);
  if (fresh) return fresh;
  try {
    const url = 'https://lite-api.jup.ag/price/v2?ids=' + uniq.map(encodeURIComponent).join(',');
    const data = await sources.httpJson(url, { timeout: 8000 });
    const map = new Map();
    const rows = (data && data.data) || {};
    for (const mint of uniq) {
      const px = sources.num(rows[mint] && (rows[mint].price || rows[mint].usdPrice));
      if (px != null) map.set(mint, px);
    }
    sources.getHealth(); // no-op touch
    cache.set(key, map, 30_000);
    return map;
  } catch {
    return cache.stale(key) || new Map();
  }
}

function accountKeys(tx) {
  const keys = [];
  const msg = tx.transaction && (tx.transaction.message || tx.transaction);
  for (const k of (msg && msg.accountKeys) || []) {
    keys.push(typeof k === 'string' ? k : (k.pubkey || String(k)));
  }
  const loaded = tx.meta && tx.meta.loadedAddresses;
  if (loaded) {
    for (const k of loaded.writable || []) keys.push(typeof k === 'string' ? k : String(k));
    for (const k of loaded.readonly || []) keys.push(typeof k === 'string' ? k : String(k));
  }
  return keys;
}

function involvedPrograms(tx) {
  const ids = new Set();
  const msg = tx.transaction && tx.transaction.message;
  const keys = accountKeys(tx);
  const ixs = (msg && (msg.instructions || msg.compiledInstructions)) || [];
  for (const ix of ixs) {
    if (ix.programId) ids.add(ix.programId);
    else if (ix.programIdIndex != null && keys[ix.programIdIndex]) ids.add(keys[ix.programIdIndex]);
  }
  const inner = (tx.meta && tx.meta.innerInstructions) || [];
  for (const group of inner) {
    for (const ix of group.instructions || []) {
      if (ix.programId) ids.add(ix.programId);
    }
  }
  return ids;
}

function symbolOf(mint, fallbacks) {
  if (!mint) return '—';
  if (mint === WSOL) return 'SOL';
  if (KNOWN[mint]) return KNOWN[mint].symbol;
  if (fallbacks && fallbacks[mint]) return fallbacks[mint];
  return mint.slice(0, 4) + '…' + mint.slice(-4);
}

function parseWalletTx(tx, wallet, symbols) {
  const sig = (tx.transaction && tx.transaction.signatures && tx.transaction.signatures[0]) || null;
  const base = {
    signature: sig,
    slot: tx.slot || null,
    blockTime: tx.blockTime || null,
    timeRome: romeTime(tx.blockTime),
    err: tx.meta && tx.meta.err ? true : false,
    solscan: sig ? 'https://solscan.io/tx/' + sig : null,
    changes: [],
    solDelta: 0,
    type: 'TX',
    direction: 'other',
    label: '',
  };
  if (!tx.meta) return { ...base, type: 'ERR', direction: 'fail', label: 'ERR' };
  if (tx.meta.err) {
    return { ...base, type: 'ERR', direction: 'fail', label: 'ERR' };
  }

  const keys = accountKeys(tx);
  const idx = keys.findIndex((k) => k === wallet);
  const preSol = (tx.meta.preBalances || [])[idx] || 0;
  const postSol = (tx.meta.postBalances || [])[idx] || 0;
  const dSol = (postSol - preSol) / 1e9;
  base.solDelta = dSol;

  const preMap = new Map();
  const postMap = new Map();
  for (const b of tx.meta.preTokenBalances || []) {
    if (b.owner !== wallet) continue;
    preMap.set(b.mint, sources.num(b.uiTokenAmount && b.uiTokenAmount.uiAmount) || 0);
  }
  for (const b of tx.meta.postTokenBalances || []) {
    if (b.owner !== wallet) continue;
    postMap.set(b.mint, sources.num(b.uiTokenAmount && b.uiTokenAmount.uiAmount) || 0);
  }
  const mints = new Set([...preMap.keys(), ...postMap.keys()]);
  const changes = [];
  for (const mint of mints) {
    const d = (postMap.get(mint) || 0) - (preMap.get(mint) || 0);
    if (Math.abs(d) < 1e-9) continue;
    const displayMint = mint === WSOL ? WSOL : mint;
    changes.push({
      mint: displayMint,
      symbol: symbolOf(displayMint, symbols),
      amount: d,
    });
  }
  if (Math.abs(dSol) >= FEE_SOL) {
    changes.push({ mint: 'SOL', symbol: 'SOL', amount: dSol, native: true });
  }
  base.changes = changes;

  const tokenChanges = changes.filter((c) => !c.native && c.mint !== WSOL);
  const hasIn = changes.some((c) => c.amount > 0);
  const hasOut = changes.some((c) => c.amount < 0);
  const programs = involvedPrograms(tx);
  const isSwapProg = [...programs].some((p) => SWAP_PROGRAMS.has(p));
  const logs = ((tx.meta && tx.meta.logMessages) || []).join('\n');
  const isSwapLog = /Instruction: Swap|Instruction: Route|Instruction: SharedAccountsRoute|SwapEvent/i.test(logs);

  let type = 'TX';
  if ((hasIn && hasOut && tokenChanges.length) || isSwapProg || isSwapLog) type = 'SWAP';
  else if (hasIn && !hasOut) type = 'IN';
  else if (hasOut && !hasIn) type = 'OUT';
  else if (hasIn && hasOut) type = 'SWAP';
  else if (Math.abs(dSol) >= FEE_SOL && !tokenChanges.length) type = dSol > 0 ? 'IN' : 'OUT';
  else type = 'TX';

  // fee-only
  if (type === 'OUT' && !tokenChanges.length && Math.abs(dSol) < 0.001) {
    return null;
  }

  const fmtAmt = (c) => {
    const n = c.amount;
    const abs = Math.abs(n);
    const body = abs >= 1 ? abs.toLocaleString('it-IT', { maximumFractionDigits: 4 })
      : abs.toPrecision(4);
    return (n > 0 ? '+' : '−') + body + ' ' + c.symbol;
  };
  const ordered = changes.slice().sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const labelParts = ordered.slice(0, 3).map(fmtAmt);
  if (!changes.length) return null;
  base.type = type;
  base.direction = type === 'IN' ? 'in' : type === 'OUT' ? 'out' : type === 'SWAP' ? 'swap' : 'other';
  base.label = type + (labelParts.length ? ' · ' + labelParts.join(' · ') : '');
  return base;
}

async function tokenAccounts(address, programId) {
  try {
    const res = await sources.rpcCall('getTokenAccountsByOwner', [
      address,
      { programId },
      { encoding: 'jsonParsed' },
    ], 'publicnode');
    return (res && res.value) || [];
  } catch {
    try {
      const res = await sources.rpcCall('getTokenAccountsByOwner', [
        address,
        { programId },
        { encoding: 'jsonParsed' },
      ], 'mainnet');
      return (res && res.value) || [];
    } catch {
      return [];
    }
  }
}

async function fetchParsedTx(signature) {
  const key = 'tx:' + signature;
  const fresh = cache.fresh(key);
  if (fresh !== null && fresh !== undefined) return fresh;
  const stale = cache.stale(key);
  if (stale) return stale;
  try {
    const tx = await sources.rpcCall('getTransaction', [
      signature,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
    ], 'publicnode');
    cache.set(key, tx, 24 * 60 * 60_000);
    return tx;
  } catch {
    try {
      const tx = await sources.rpcCall('getTransaction', [
        signature,
        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
      ], 'mainnet');
      cache.set(key, tx, 24 * 60 * 60_000);
      return tx;
    } catch (e) {
      cache.set(key, null, 20_000);
      return null;
    }
  }
}

async function getWallet(address) {
  if (!sources.isValidPubkey(address)) {
    const err = new Error('indirizzo non valido');
    err.status = 400;
    throw err;
  }
  const key = 'livewallet:' + address;
  const fresh = cache.fresh(key);
  if (fresh) return { ...fresh, cached: true };

  const solUsd = await sources.getSolPrice();
  let lamports = 0;
  try {
    let bal = await sources.rpcCall('getBalance', [address], 'publicnode');
    if (bal && typeof bal === 'object' && bal.value != null) bal = bal.value;
    lamports = Number(bal) || 0;
  } catch {
    lamports = 0;
  }

  const [t1, t2] = await Promise.all([
    tokenAccounts(address, TOKEN_PROGRAM),
    tokenAccounts(address, TOKEN_2022),
  ]);

  const balances = [];
  for (const a of [...t1, ...t2]) {
    const info = a.account && a.account.data && a.account.data.parsed && a.account.data.parsed.info;
    if (!info) continue;
    const ta = info.tokenAmount || {};
    const ui = sources.num(ta.uiAmount) || 0;
    if (ui <= 0) continue;
    balances.push({
      mint: info.mint,
      amount: ui,
      decimals: ta.decimals,
      program: a.account.data.program,
    });
  }

  const mintList = balances.map((b) => b.mint).slice(0, 40);
  const mintMap = await sources.fetchDsTokensBatch(mintList);
  const missing = [];
  for (const b of balances) {
    const known = KNOWN[b.mint];
    if (known) {
      b.symbol = known.symbol;
      b.name = known.name;
    }
    const best = sources.bestSolanaPair(mintMap.get(b.mint) || [], b.mint);
    if (best) {
      const isBase = best.baseToken && best.baseToken.address === b.mint;
      b.symbol = b.symbol || (isBase ? best.baseToken.symbol : (best.quoteToken && best.quoteToken.symbol));
      b.name = b.name || (isBase ? best.baseToken.name : null);
      b.priceUsd = sources.num(best.priceUsd);
    }
    if (b.mint === USDC || b.mint === USDT) {
      if (b.priceUsd == null) b.priceUsd = 1;
    }
    if (b.priceUsd == null) missing.push(b.mint);
  }
  if (missing.length) {
    const jup = await jupiterPrices(missing);
    for (const b of balances) {
      if (b.priceUsd == null && jup.has(b.mint)) b.priceUsd = jup.get(b.mint);
    }
  }
  for (const b of balances) {
    b.valueUsd = b.priceUsd != null ? b.priceUsd * b.amount : null;
    if (!b.symbol) b.symbol = symbolOf(b.mint);
    if (b.mint === OV_MINT) {
      b.symbol = b.symbol && String(b.symbol).startsWith('$') ? b.symbol : ('$' + (b.symbol || 'OV'));
      b.held = true;
      b.notForSale = true;
      b.note = 'token del progetto · tenuto, non in vendita';
    }
  }
  balances.sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0) || (b.amount || 0) - (a.amount || 0));

  const sol = lamports / 1e9;
  const solValueUsd = solUsd != null ? sol * solUsd : null;
  const tokensUsd = balances.reduce((s, b) => s + (b.valueUsd || 0), 0);
  const totalUsd = (solValueUsd || 0) + tokensUsd;
  const totalSol = solUsd ? totalUsd / solUsd : null;

  const symbols = {};
  for (const b of balances) symbols[b.mint] = b.symbol;
  symbols[WSOL] = 'SOL';
  symbols[USDC] = 'USDC';
  symbols[USDT] = 'USDT';

  let signatures = [];
  try {
    signatures = await sources.rpcCall('getSignaturesForAddress', [address, { limit: TX_LIMIT }], 'publicnode') || [];
  } catch {
    try {
      signatures = await sources.rpcCall('getSignaturesForAddress', [address, { limit: TX_LIMIT }], 'mainnet') || [];
    } catch {
      signatures = [];
    }
  }

  const transactions = [];
  for (const s of signatures) {
    const tx = await fetchParsedTx(s.signature);
    if (!tx) {
      transactions.push({
        signature: s.signature,
        slot: s.slot,
        blockTime: s.blockTime,
        timeRome: romeTime(s.blockTime),
        err: !!s.err,
        type: s.err ? 'ERR' : 'TX',
        direction: s.err ? 'fail' : 'other',
        changes: [],
        label: s.err ? 'ERR' : 'TX',
        solscan: 'https://solscan.io/tx/' + s.signature,
      });
      continue;
    }
    const parsed = parseWalletTx(tx, address, symbols);
    if (parsed) transactions.push(parsed);
  }

  const holdingsKey = JSON.stringify([
    Math.round(sol * 1e6),
    ...balances.map((b) => [b.mint, Math.round((b.amount || 0) * 1e6)]),
  ]);

  let spark = [];
  if (address === DESK_WALLET) {
    spark = pushSpark(address, totalUsd, sol);
  }

  const usdcRow = balances.find((b) => b.mint === USDC);
  const usdcUsd = usdcRow && usdcRow.valueUsd != null ? usdcRow.valueUsd : (usdcRow ? (usdcRow.amount || 0) : 0);
  const ovRow = balances.find((b) => b.mint === OV_MINT);
  const ovUsd = ovRow && ovRow.valueUsd != null ? ovRow.valueUsd : 0;
  const tradableUsd = (solValueUsd || 0) + (usdcUsd || 0);
  const room = tradableUsd - FLOOR_USD - BUDGET_BUFFER_USD;
  const budgetUsd = Math.max(0, Math.min(BUDGET_MAX_USD, Math.round(room * 100) / 100));
  const policy = address === DESK_WALLET ? {
    floorUsd: FLOOR_USD,
    floorOn: 'SOL+USDC',
    tradableUsd: Math.round(tradableUsd * 100) / 100,
    budgetMaxUsd: BUDGET_MAX_USD,
    budgetBufferUsd: BUDGET_BUFFER_USD,
    budgetUsd,
    ovHeld: !!(ovRow && ovRow.amount > 0),
    ovMint: OV_MINT,
    ovSymbol: '$OV',
    ovAmount: ovRow ? ovRow.amount : 0,
    ovValueUsd: ovUsd != null ? Math.round(ovUsd * 100) / 100 : null,
    note: '$OV tenuto, non in vendita. Floor $50 su SOL+USDC. Budget = min($30, SOL+USDC − $50 − $1).',
  } : null;

  const payload = {
    updatedAt: new Date().toISOString(),
    updatedRome: romeTime(Date.now()),
    address,
    desk: address === DESK_WALLET,
    sol,
    solUsd,
    solValueUsd,
    totalUsd: Number.isFinite(totalUsd) ? Math.round(totalUsd * 100) / 100 : null,
    totalSol: totalSol != null ? Math.round(totalSol * 1e6) / 1e6 : null,
    holdingsKey,
    policy,
    balances: [
      {
        mint: 'SOL',
        symbol: 'SOL',
        name: 'Solana',
        amount: sol,
        priceUsd: solUsd,
        valueUsd: solValueUsd,
        native: true,
      },
      ...balances,
    ],
    transactions,
    spark,
    readOnly: true,
  };
  cache.set(key, payload, CACHE_TTL);
  return payload;
}

function getDeskWallet() {
  return getWallet(DESK_WALLET);
}

module.exports = {
  DESK_WALLET,
  OV_MINT,
  FLOOR_USD,
  BUDGET_MAX_USD,
  getWallet,
  getDeskWallet,
  CACHE_TTL,
};
