'use strict';

/**
 * Anti-fake / anti-exit-liquidity sniffer.
 * Read-only public data (DexScreener, RugCheck, Solana RPC). No keys, no signing.
 * Verdicts: OK | WARN | EXIT_LIQ | FAKE
 * EXIT_LIQ and FAKE (and missing RugCheck) are hard blocks for live copy buys.
 */

const fs = require('fs');
const path = require('path');
const {
  rpcCall, fetchRug, fetchDsTokenPairs, bestSolanaPair, normalizeDsPair,
  isValidPubkey, sleep, num,
} = require('./sources');

const DESK_DIR = process.env.DESK_DIR || '/workspace/highkali-desk';
const OUT_FILE = path.join(DESK_DIR, 'anti-fake.json');
const LOG_FILE = path.join(DESK_DIR, 'anti-fake.log');

const AGENT_WALLET = '';
const MIN_LIQ = 100_000;
const MAX_TOP10 = 35;
const MAX_SOURCE_PCT = 2;
const SELL_LOOKBACK_SEC = 30 * 60;
const SIG_LIMIT = 30;
const TX_PARSE = 16;
const MAX_PRICE_RUN = 15;
const BUY_IMPACT_MAX = 0.5;
const BUY_SLIPPAGE = 1;
const EXIT_SLIPPAGE = 1;

const KNOWN_NAMES = new Set([
  'sol', 'solana', 'usdc', 'usdt', 'btc', 'bitcoin', 'eth', 'ethereum',
  'jup', 'jupiter', 'bonk', 'wif', 'dogwifhat', 'trump', 'official trump',
  'pepe', 'doge', 'shiba', 'shib',
]);

function romeNow() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date()).replace(' ', 'T') + '+01:00';
}

function flag(code, msg, severity) {
  return { code, msg, severity };
}

async function tokenAmount(owner, mint) {
  let total = 0;
  try {
    const res = await rpcCall('getTokenAccountsByOwner', [
      owner,
      { mint },
      { encoding: 'jsonParsed' },
    ]);
    for (const v of (res && res.value) || []) {
      const ui = v.account && v.account.data && v.account.data.parsed
        && v.account.data.parsed.info && v.account.data.parsed.info.tokenAmount;
      if (ui && ui.uiAmount != null) total += Number(ui.uiAmount) || 0;
    }
  } catch { /* ignore */ }
  return total;
}

function soldInTx(tx, owner, mint) {
  const meta = tx && tx.meta;
  if (!meta) return 0;
  const sum = (arr) => arr.reduce((s, b) => s + (num(b.uiTokenAmount && b.uiTokenAmount.uiAmount) || 0), 0);
  const pre = (meta.preTokenBalances || []).filter((b) => b.mint === mint && b.owner === owner);
  const post = (meta.postTokenBalances || []).filter((b) => b.mint === mint && b.owner === owner);
  if (!pre.length && !post.length) return 0;
  const delta = sum(post) - sum(pre);
  return delta < -1e-9 ? -delta : 0;
}

async function recentSells(owner, mint, sinceUnix) {
  const sells = [];
  let sigs;
  try {
    sigs = await rpcCall('getSignaturesForAddress', [owner, { limit: SIG_LIMIT }]);
  } catch {
    return { sells, error: 'rpc signatures failed' };
  }
  const list = (sigs || []).filter((s) => !s.err && (!sinceUnix || (s.blockTime && s.blockTime >= sinceUnix)));
  for (const s of list.slice(0, TX_PARSE)) {
    try {
      const tx = await rpcCall('getTransaction', [
        s.signature,
        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
      ]);
      const sold = soldInTx(tx, owner, mint);
      if (sold > 0) {
        sells.push({
          signature: s.signature,
          at: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
          amount: sold,
        });
      }
    } catch { /* skip */ }
    await sleep(80);
  }
  return { sells };
}

function impersonation(token) {
  const sym = String((token && token.baseToken && token.baseToken.symbol) || (token && token.symbol) || '').trim().toLowerCase();
  const name = String((token && token.baseToken && token.baseToken.name) || (token && token.name) || '').trim().toLowerCase();
  if (!sym && !name) return null;
  if (KNOWN_NAMES.has(sym) || KNOWN_NAMES.has(name)) return { sym, name };
  return null;
}

async function sniff(opts) {
  const mint = opts && opts.mint;
  const source = opts && opts.sourceWallet;
  const flags = [];
  const notes = [];
  const started = Date.now();

  const fail = (code, msg, extra) => writeResult({
    verdict: 'FAKE', allowBuy: false,
    flags: [flag(code, msg, 'FAKE')],
    mint, sourceWallet: source, at: romeNow(), ms: Date.now() - started,
    ...(extra || {}),
  });

  if (!isValidPubkey(mint) || !isValidPubkey(source)) {
    return fail('BAD_INPUT', 'Mint o wallet non validi');
  }
  if (source === AGENT_WALLET) {
    return fail('SELF', 'Non si copia il wallet agente');
  }

  const pairs = await fetchDsTokenPairs(mint);
  const best = bestSolanaPair(pairs, mint);
  const row = normalizeDsPair(best) || {};
  const rug = await fetchRug(mint, row.pairAddress);
  const liq = num(row.liquidityUsd) || num(row.liqUsd) || (rug && num(rug.totalMarketLiquidity)) || 0;
  const price = num(row.priceUsd);

  if (rug) {
    if (rug.rugged || rug.riskLevel === 'danger') {
      flags.push(flag('RUG', 'RugCheck danger o token già rugged', 'FAKE'));
    }
    if (rug.mintRevoked === false) {
      flags.push(flag('MINT_OPEN', 'Mint authority ancora attiva', 'FAKE'));
    }
    if (rug.freezeRevoked === false) {
      flags.push(flag('FREEZE_OPEN', 'Freeze authority ancora attiva', 'FAKE'));
    }
    const honeypot = (rug.risks || []).some((r) =>
      /honeypot|sell.?tax|can.?not.?sell|blacklist|pausab/i.test(`${r.name} ${r.description} ${r.level}`));
    if (honeypot) flags.push(flag('HONEYPOT', 'Rischio honeypot o tassa di vendita', 'FAKE'));
    const top10 = num(rug.top10PctExPool) != null ? rug.top10PctExPool : rug.top10Pct;
    if (top10 != null && top10 > MAX_TOP10) {
      flags.push(flag('CONCENTRATION', `Top 10 holder al ${top10.toFixed(1)}% (max ${MAX_TOP10}%)`, 'FAKE'));
    }
  } else {
    flags.push(flag('NO_RUGCHECK', 'RugCheck non disponibile: nel dubbio non si compra', 'FAKE'));
  }

  if (liq < MIN_LIQ) {
    flags.push(flag('THIN_LIQ', `Liquidità $${Math.round(liq)} sotto i $${MIN_LIQ}`, 'FAKE'));
  }

  const imp = impersonation(best || row);
  if (imp) {
    flags.push(flag('IMPERSONATION', `Nome o ticker (${imp.sym || imp.name}) imita un token famoso`, 'FAKE'));
  }

  let sourceAmt = 0;
  let sourcePct = null;
  let holderRank = null;
  try {
    sourceAmt = await tokenAmount(source, mint);
  } catch (e) {
    notes.push('saldo source illeggibile: ' + (e.message || e));
  }

  if (rug && Array.isArray(rug.holdersExPool || rug.holders)) {
    const list = rug.holdersExPool || rug.holders;
    const hit = list.find((h) => h.owner === source || h.address === source);
    if (hit) {
      sourcePct = num(hit.pct);
      holderRank = list.indexOf(hit) + 1;
    }
  }
  if (sourcePct != null && sourcePct >= MAX_SOURCE_PCT) {
    flags.push(flag(
      'SOURCE_WHALE',
      `Il wallet copiato detiene il ${sourcePct.toFixed(2)}% della supply (rango ${holderRank || '?'}): può scaricare sui follower`,
      'EXIT_LIQ',
    ));
  }

  let since = Math.floor(Date.now() / 1000) - SELL_LOOKBACK_SEC;
  if (opts.signalTs) {
    const t = typeof opts.signalTs === 'number'
      ? (opts.signalTs > 1e12 ? Math.floor(opts.signalTs / 1000) : opts.signalTs)
      : Math.floor(new Date(opts.signalTs).getTime() / 1000);
    if (Number.isFinite(t) && t > 0) since = Math.min(since, t);
  }
  const { sells, error: sellErr } = await recentSells(source, mint, since);
  if (sellErr) notes.push(sellErr);
  if (sells && sells.length) {
    const tot = sells.reduce((s, x) => s + x.amount, 0);
    flags.push(flag(
      'SOURCE_SELLING',
      `Il wallet copiato ha già venduto questo token (${sells.length} tx, ≈${tot.toPrecision(4)} token) dopo il segnale: i follower sono la sua exit liquidity`,
      'EXIT_LIQ',
    ));
  }
  if (sourceAmt === 0) {
    flags.push(flag('SOURCE_FLAT', 'Il wallet copiato non detiene più questo token', 'EXIT_LIQ'));
  }

  if (opts.signalPrice && price && opts.signalPrice > 0) {
    const run = ((price - opts.signalPrice) / opts.signalPrice) * 100;
    if (run > MAX_PRICE_RUN) {
      flags.push(flag('CHASE', `Prezzo già a +${run.toFixed(1)}% dal segnale (max +${MAX_PRICE_RUN}%)`, 'EXIT_LIQ'));
    }
  }

  const buys5 = num(row.txns && row.txns.m5 && row.txns.m5.buys);
  const sells5 = num(row.txns && row.txns.m5 && row.txns.m5.sells);
  const vol5 = num(row.volume && row.volume.m5);
  if (sells5 != null && buys5 != null && sells5 + buys5 >= 8 && sells5 > buys5 * 2) {
    flags.push(flag('SELL_PRESSURE', `Negli ultimi 5 minuti ${sells5} vendite vs ${buys5} acquisti`, 'WARN'));
  }
  if (vol5 && liq && vol5 > liq * 8) {
    flags.push(flag('WASH_VOL', `Volume 5m ($${Math.round(vol5)}) molto sopra la liquidità: possibile volume gonfiato`, 'WARN'));
  }

  const hardFake = flags.some((f) => f.severity === 'FAKE');
  const hardExit = flags.some((f) => f.severity === 'EXIT_LIQ');
  const verdict = hardFake ? 'FAKE' : hardExit ? 'EXIT_LIQ' : flags.some((f) => f.severity === 'WARN') ? 'WARN' : 'OK';
  const allowBuy = verdict === 'OK' || verdict === 'WARN';

  return writeResult({
    verdict,
    allowBuy,
    flags,
    notes,
    mint,
    sourceWallet: source,
    token: {
      symbol: (best && best.baseToken && best.baseToken.symbol) || row.symbol || null,
      price,
      liqUsd: liq,
      pair: row.pairAddress || (best && best.pairAddress) || null,
    },
    source: { amount: sourceAmt, pct: sourcePct, rank: holderRank, recentSells: sells || [] },
    slippage: { buyPct: BUY_SLIPPAGE, exitPct: EXIT_SLIPPAGE, maxImpactPct: BUY_IMPACT_MAX },
    agentWallet: AGENT_WALLET,
    rule: 'Solo wallet agente (copia secondario). Mai fondi principali.',
    at: romeNow(),
    ms: Date.now() - started,
  });
}

function writeResult(result) {
  try {
    if (!fs.existsSync(DESK_DIR)) fs.mkdirSync(DESK_DIR, { recursive: true });
    let hist = [];
    if (fs.existsSync(OUT_FILE)) {
      try {
        const prev = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
        hist = Array.isArray(prev.history) ? prev.history : (prev.verdict ? [prev] : []);
      } catch { /* reset */ }
    }
    const slim = { ...result };
    delete slim.history;
    hist = [slim, ...hist].slice(0, 40);
    fs.writeFileSync(OUT_FILE, JSON.stringify({ ...result, history: hist }, null, 2));
    fs.appendFileSync(LOG_FILE, `${result.at} ${result.verdict} mint=${result.mint || ''} src=${result.sourceWallet || ''} allow=${result.allowBuy}\n`);
  } catch (e) {
    result.writeError = e.message;
  }
  return result;
}

function publicRecord(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return null;
  const flags = Array.isArray(rec.flags)
    ? rec.flags.slice(0, 40).map((f) => ({
        code: String((f && f.code) || ''),
        msg: String((f && f.msg) || ''),
        severity: String((f && f.severity) || ''),
      }))
    : [];
  const symbol = (rec.token && rec.token.symbol) || rec.symbol || null;
  return {
    verdict: rec.verdict ? String(rec.verdict) : null,
    allowBuy: rec.allowBuy === true,
    flags,
    mint: rec.mint ? String(rec.mint) : null,
    sourceWallet: rec.sourceWallet ? String(rec.sourceWallet) : null,
    symbol: symbol ? String(symbol) : null,
    at: rec.at ? String(rec.at) : null,
    ms: Number.isFinite(rec.ms) ? rec.ms : null,
  };
}

function emptyAntifake(extra) {
  return {
    empty: true,
    message: 'nessun controllo ancora',
    verdict: null,
    allowBuy: false,
    flags: [],
    mint: null,
    sourceWallet: null,
    symbol: null,
    at: null,
    history: [],
    ...(extra || {}),
  };
}

function readPublicAntifake() {
  try {
    if (!fs.existsSync(OUT_FILE)) return emptyAntifake();
    const raw = fs.readFileSync(OUT_FILE, 'utf8').trim();
    if (!raw || raw === '{}' || raw === '[]') return emptyAntifake();
    const data = JSON.parse(raw);
    const latest = publicRecord(Array.isArray(data) ? data[0] : data);
    const histSrc = Array.isArray(data)
      ? data
      : (Array.isArray(data.history) ? data.history : (latest && latest.verdict ? [data] : []));
    const history = histSrc.map(publicRecord).filter(Boolean).slice(0, 20);
    if (!latest || !latest.verdict) return emptyAntifake();
    return {
      empty: false,
      message: null,
      ...latest,
      history,
    };
  } catch {
    return emptyAntifake();
  }
}

module.exports = { sniff, readPublicAntifake, AGENT_WALLET, OUT_FILE, MIN_LIQ, BUY_SLIPPAGE, EXIT_SLIPPAGE, BUY_IMPACT_MAX };
