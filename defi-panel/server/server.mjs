// ZDOS DeFi · pannello unico (Swap/Route, Pool/Liquidità, Basket, Posizioni, Dev) — API su 127.0.0.1:4198
// Solo dati reali (Meteora DLMM, Jupiter, DexScreener, RPC Solana). Nessuna chiave utente, nessun fondo custodito:
// il server costruisce transazioni NON firmate che l'utente firma nel proprio wallet. © 2026 ZDOS1.3 · P.IVA 11040550961
import http from "node:http";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const web3 = require("@solana/web3.js");
const DLMMmod = require("@meteora-ag/dlmm");
const DLMM = DLMMmod.default || DLMMmod;
const { StrategyType } = DLMMmod;
const BN = require("bn.js");
const { Connection, PublicKey, Keypair, Transaction, VersionedTransaction } = web3;

const PORT = +(process.env.DEFI_PORT || 4198);
const RPC = process.env.SOLANA_RPC_URL || "http://127.0.0.1:8895";
const conn = new Connection(RPC, { commitment: "confirmed" });
const JUP = "https://lite-api.jup.ag";
// Invio: il proxy RPC locale serve bene le letture ma non inoltra sendTransaction; per l'invio si usano RPC pubblici.
const SEND_RPCS = (process.env.SEND_RPCS || "https://solana-rpc.publicnode.com,https://api.mainnet-beta.solana.com").split(",");
async function rpcSend(raw) {
  let last = "nessun RPC disponibile";
  for (const url of SEND_RPCS) {
    const r = await up(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendTransaction", params: [Buffer.from(raw).toString("base64"), { encoding: "base64", preflightCommitment: "confirmed", maxRetries: 3 }] }) }, 20000).catch(e => ({ j: { error: { message: e.message } } }));
    if (r.j?.result) return r.j.result;
    const e = r.j?.error || {}; last = e.message || "errore RPC";
    if (e.code === -32002) { // preflight fallita: la transazione è valida ma la simulazione non passa (es. saldo insufficiente)
      const logs = (e.data?.logs || []).slice(-4).join(" | ");
      if (/no record of a prior credit/i.test(last)) { const err = new Error("saldo SOL insufficiente nel wallet per questa operazione (commissioni e affitto dei conti inclusi)"); err.preflight = true; throw err; }
      const err = new Error("la rete ha respinto la simulazione: " + (JSON.stringify(e.data?.err) || last) + (logs ? " · " + logs.slice(0, 300) : "")); err.preflight = true; throw err;
    }
  }
  throw new Error(last);
}
const METEORA = "https://dlmm.datapi.meteora.ag";
const DEXS = "https://api.dexscreener.com";
const VERSION = "1.0.0";

const SOL = "So11111111111111111111111111111111111111112";
const TOKENS = [
  { sym: "SOL", name: "Solana", mint: SOL, decimals: 9, chain: "solana", kind: "base" },
  { sym: "USDC", name: "USD Coin", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, chain: "solana", kind: "base" },
  { sym: "VELVET", alias: "$OV", name: "VELVET", mint: "2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump", decimals: 6, chain: "solana", kind: "zdos", note: "Moneta della community OurVelvet (Token-2022)." },
  { sym: "xZDOS", alias: "$DSN", name: "xZDOS", mint: "35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4", decimals: 6, chain: "solana", kind: "zdos", note: "Token ZDOS su Solana (Token-2022)." },
  { sym: "L$D", alias: "Dom-Coin", name: "Dom-Coin", mint: "FSwCz9qgcvfWGEU8QU3h4fQpyQ8TB2KLHYC9bmoMxDgP", decimals: 6, chain: "solana", kind: "zdos", note: "Dom-Coin. Il valore 0,0064 € mostrato altrove è un valore dichiarato, non un prezzo di mercato." }
];
const POLYGON = { sym: "$DSN", name: "$DSN (Polygon)", contract: "0xfc90516a1f736FaC557e09D8853dB80dA192c296", chain: "polygon", kind: "zdos", note: "Contratto ERC-20 su Polygon. Nessuno swap da questo pannello (solo Solana)." };
const KNOWN_POOLS = ["383iZ9nNfnnMtpM6oY7Gu4Nn87EtjwdPikkwctExjkze"];
const byKey = (k) => { const q = String(k || "").trim(); return TOKENS.find(t => t.mint === q || t.sym.toLowerCase() === q.toLowerCase() || (t.alias || "").toLowerCase() === q.toLowerCase()); };
const isB58 = (s) => typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

/* ---------- log ad anello (nessun IP) ---------- */
const LOG = []; const UP = [];
function pushLog(arr, e, max = 150) { arr.push(e); if (arr.length > max) arr.shift(); }

/* ---------- cache + fetch upstream ---------- */
const CACHE = new Map();
async function cached(key, ttlMs, fn) {
  const c = CACHE.get(key); const now = Date.now();
  if (c && now - c.t < ttlMs) return c.v;
  if (c && c.p) return c.p;
  const p = (async () => { try { const v = await fn(); CACHE.set(key, { t: Date.now(), v }); return v; } catch (e) { if (c) { CACHE.set(key, { ...c, p: null }); return c.v; } CACHE.delete(key); throw e; } })();
  CACHE.set(key, { ...(c || { t: 0, v: null }), p });
  return p;
}
async function up(url, opts = {}, timeout = 12000) {
  const t0 = Date.now(); let status = 0;
  try {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeout), headers: { accept: "application/json", "user-agent": "zdos-defi/" + VERSION, ...(opts.headers || {}) } });
    status = r.status; const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = { raw: txt.slice(0, 300) }; }
    return { status, ok: r.ok, j };
  } finally { pushLog(UP, { ts: Date.now(), url: url.replace(/\?.*$/, "") + (url.includes("?") ? "?…" : ""), status, ms: Date.now() - t0 }); }
}

/* ---------- dati reali ---------- */
async function jupToken(mint) {
  return cached("jt:" + mint, 10 * 60e3, async () => {
    const r = await up(`${JUP}/tokens/v2/search?query=${mint}`);
    if (!r.ok || !Array.isArray(r.j)) throw new Error("jupiter tokens " + r.status);
    return r.j.find(x => x.id === mint) || null;
  });
}
async function dexPairs() {
  return cached("dexs", 60e3, async () => {
    const mints = TOKENS.filter(t => t.kind === "zdos").map(t => t.mint).join(",");
    const r = await up(`${DEXS}/tokens/v1/solana/${mints}`);
    const r2 = await up(`${DEXS}/tokens/v1/polygon/${POLYGON.contract}`).catch(() => ({ j: [] }));
    const all = [...(Array.isArray(r.j) ? r.j : []), ...(Array.isArray(r2.j) ? r2.j : [])];
    return all.map(p => ({ chain: p.chainId, dex: p.dexId, pair: p.pairAddress, url: p.url, base: p.baseToken, quote: p.quoteToken, priceUsd: p.priceUsd ? +p.priceUsd : null, priceNative: p.priceNative ? +p.priceNative : null, liquidityUsd: p.liquidity?.usd ?? null, volume24h: p.volume?.h24 ?? null, txns24h: p.txns?.h24 || null, change24h: p.priceChange?.h24 ?? null, createdAt: p.pairCreatedAt || null }));
  });
}
async function meteoraPool(addr) {
  return cached("mp:" + addr, 30e3, async () => {
    const r = await up(`${METEORA}/pools/${addr}`);
    if (!r.ok) throw new Error("meteora " + r.status);
    return r.j;
  });
}
async function meteoraDiscover() {
  return cached("mdisc", 10 * 60e3, async () => {
    const found = new Set(KNOWN_POOLS);
    for (const t of TOKENS.filter(t => t.kind === "zdos")) {
      const r = await up(`${METEORA}/pools?page_size=20&query=${t.mint}`).catch(() => null);
      for (const p of (r?.j?.data || [])) if (isB58(p.address)) found.add(p.address);
    }
    return [...found];
  });
}
function poolSummary(p) {
  const tx = byKey(p.token_x?.address), ty = byKey(p.token_y?.address);
  return {
    address: p.address, name: `${tx?.sym || p.token_x?.symbol || "?"}-${ty?.sym || p.token_y?.symbol || "?"}`,
    x: { mint: p.token_x?.address, sym: tx?.sym || p.token_x?.symbol, decimals: p.token_x?.decimals, amount: p.token_x_amount, priceUsd: p.token_x?.price, verified: p.token_x?.is_verified, holders: p.token_x?.holders, freezeDisabled: p.token_x?.freeze_authority_disabled },
    y: { mint: p.token_y?.address, sym: ty?.sym || p.token_y?.symbol, decimals: p.token_y?.decimals, amount: p.token_y_amount, priceUsd: p.token_y?.price, verified: p.token_y?.is_verified },
    binStep: p.pool_config?.bin_step, baseFeePct: p.pool_config?.base_fee_pct, maxFeePct: p.pool_config?.max_fee_pct, protocolFeePct: p.pool_config?.protocol_fee_pct, pairType: p.pool_config?.pair_type, collectFeeMode: p.pool_config?.collect_fee_mode,
    dynamicFeePct: p.dynamic_fee_pct, tvlUsd: p.tvl, priceInY: p.current_price, volume: p.volume, fees: p.fees, cumulative: p.cumulative_metrics,
    apr: p.apr, blacklisted: !!p.is_blacklisted, createdAt: p.created_at, reserveX: p.reserve_x, reserveY: p.reserve_y, tags: p.tags || [],
    meteoraUrl: `https://app.meteora.ag/dlmm/${p.address}`
  };
}
function kira(t, jt, pools) {
  const f = [];
  if (!jt) { f.push({ lvl: 1, msg: "dati Jupiter non disponibili in questo momento" }); }
  else {
    const a = jt.audit || {};
    if (a.isSus) f.push({ lvl: 2, msg: "Jupiter segnala il token come sospetto" });
    if (jt.mintAuthority && !a.mintAuthorityDisabled) f.push({ lvl: 2, msg: "mint authority attiva: la supply può aumentare" });
    if (jt.freezeAuthority && !a.freezeAuthorityDisabled) f.push({ lvl: 2, msg: "freeze authority attiva: i saldi possono essere congelati" });
    if (a.topHoldersPercentage > 50) f.push({ lvl: 1, msg: `i primi holder hanno il ${a.topHoldersPercentage.toFixed(1)}% della supply` });
    if ((jt.holderCount ?? 0) < 50) f.push({ lvl: 1, msg: `pochi holder (${jt.holderCount ?? 0})` });
    if (jt.organicScoreLabel === "low") f.push({ lvl: 1, msg: "attività organica bassa secondo Jupiter" });
  }
  for (const p of pools) if (p.blacklisted && (p.x.mint === t.mint || p.y.mint === t.mint)) f.push({ lvl: 2, msg: `il pool ${p.name} è segnalato (blacklist) dalle API Meteora` });
  const max = f.reduce((m, x) => Math.max(m, x.lvl), 0);
  return { level: max >= 2 ? "rosso" : max === 1 ? "giallo" : "verde", flags: f.map(x => x.msg) };
}
async function tradable(t) {
  if (t.kind === "base") return { ok: true };
  return cached("trad:" + t.mint, 5 * 60e3, async () => {
    const r = await up(`${JUP}/swap/v1/quote?inputMint=${SOL}&outputMint=${t.mint}&amount=1000000&slippageBps=300`);
    if (r.ok && r.j.outAmount) return { ok: true, route: (r.j.routePlan || []).map(x => x.swapInfo?.label).filter(Boolean) };
    return { ok: false, reason: r.j?.errorCode || r.j?.error || ("HTTP " + r.status) };
  });
}
async function overview() {
  return cached("overview", 45e3, async () => {
    const addrs = await meteoraDiscover().catch(() => KNOWN_POOLS);
    const pools = (await Promise.all(addrs.map(a => meteoraPool(a).then(poolSummary).catch(() => null)))).filter(Boolean);
    const pairs = await dexPairs().catch(() => []);
    const tokens = [];
    for (const t of TOKENS) {
      const jt = t.kind === "zdos" ? await jupToken(t.mint).catch(() => null) : null;
      const tr = await tradable(t).catch(() => ({ ok: false, reason: "verifica non riuscita" }));
      const k = t.kind === "zdos" ? kira(t, jt, pools) : { level: "verde", flags: [] };
      if (t.kind === "zdos" && !tr.ok) k.flags.push("non instradabile ora tramite Jupiter (" + tr.reason + ")");
      tokens.push({ ...t, icon: jt?.icon || null, tokenProgram: jt?.tokenProgram || null, launchpad: jt?.launchpad || null,
        market: jt ? { usdPrice: jt.usdPrice ?? null, liquidityUsd: jt.liquidity ?? null, mcapUsd: jt.mcap ?? null, holders: jt.holderCount ?? null, supply: jt.totalSupply ?? null, organic: jt.organicScoreLabel || null, priceBlock: jt.priceBlockId || null } : null,
        audit: jt ? { mintAuthority: jt.mintAuthority || null, freezeAuthority: jt.freezeAuthority || null, ...jt.audit } : null,
        tradable: tr, kira: k, pairs: pairs.filter(p => p.base?.address === t.mint || p.quote?.address === t.mint) });
    }
    const polyPairs = pairs.filter(p => p.chain === "polygon");
    return { ok: true, updated: new Date().toISOString(), sources: ["Meteora DLMM API", "Jupiter (tokens v2, swap v1)", "DexScreener", "RPC Solana"], tokens, polygon: { ...POLYGON, pairs: polyPairs }, pools };
  });
}
async function poolDetail(addr) {
  return cached("pd:" + addr, 20e3, async () => {
    const meta = poolSummary(await meteoraPool(addr));
    const d = await DLMM.create(conn, new PublicKey(addr));
    const active = await d.getActiveBin();
    const around = await d.getBinsAroundActiveBin(35, 35);
    const dx = d.tokenX.mint?.decimals ?? meta.x.decimals, dy = d.tokenY.mint?.decimals ?? meta.y.decimals;
    const bins = around.bins.map(b => ({ id: b.binId, x: Number(b.xAmount.toString()) / 10 ** dx, y: Number(b.yAmount.toString()) / 10 ** dy, price: +b.pricePerToken }));
    let feeInfo = null, dyn = null;
    try { const fi = d.getFeeInfo(); feeInfo = { baseFeePct: +fi.baseFeeRatePercentage.toString(), maxFeePct: +fi.maxFeeRatePercentage.toString(), protocolFeePct: +fi.protocolFeePercentage.toString() }; } catch {}
    try { dyn = +d.getDynamicFee().toString(); } catch {}
    return { ok: true, pool: meta, onchain: { activeBin: active.binId, activePrice: +active.pricePerToken, binStep: d.lbPair.binStep, feeInfo, dynamicFeePct: dyn, decimals: { x: dx, y: dy }, status: d.lbPair.status, activationType: d.lbPair.activationType }, bins, slotRead: await conn.getSlot().catch(() => null) };
  });
}

/* ---------- Jupiter quote / swap (transazione non firmata) ---------- */
function toBase(ui, dec) {
  const s = String(ui).trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [i, f = ""] = s.split(".");
  const v = BigInt(i) * 10n ** BigInt(dec) + BigInt((f + "0".repeat(dec)).slice(0, dec) || "0");
  return v > 0n ? v : null;
}
async function quote(q) {
  const a = byKey(q.in), b = byKey(q.out);
  if (!a || !b) return { ok: false, code: 400, errore: "moneta non supportata" };
  if (a.mint === b.mint) return { ok: false, code: 400, errore: "scegli due monete diverse" };
  const amt = toBase(q.amount, a.decimals); if (!amt) return { ok: false, code: 400, errore: "importo non valido" };
  const slip = Math.min(1000, Math.max(10, parseInt(q.slippageBps || "100", 10) || 100));
  const r = await up(`${JUP}/swap/v1/quote?inputMint=${a.mint}&outputMint=${b.mint}&amount=${amt}&slippageBps=${slip}&restrictIntermediateTokens=true`);
  if (!r.ok || !r.j.outAmount) return { ok: false, code: 200, errore: r.j?.error || "nessun percorso disponibile", codice: r.j?.errorCode || null, in: a.sym, out: b.sym };
  const ov = await overview().catch(() => null);
  const risk = ov ? Object.fromEntries(ov.tokens.filter(t => t.mint === a.mint || t.mint === b.mint).map(t => [t.sym, t.kira])) : {};
  const out = Number(r.j.outAmount) / 10 ** b.decimals, min = Number(r.j.otherAmountThreshold) / 10 ** b.decimals, inn = Number(r.j.inAmount) / 10 ** a.decimals;
  // Impatto: Jupiter lo calcola sui prezzi USD; per i token senza prezzo USD restituisce 1 (100%). Stima propria dal prezzo spot del pool DLMM.
  let impact = +r.j.priceImpactPct, impactSrc = "jupiter";
  const hops = r.j.routePlan || [];
  if (ov && hops.length === 1) {
    const pl = ov.pools.find(p => p.address === hops[0].swapInfo?.ammKey);
    if (pl && pl.priceInY > 0) {
      const spot = a.mint === pl.x.mint ? pl.priceInY : 1 / pl.priceInY; // unità di out per unità di in
      impact = Math.max(0, 1 - (out / inn) / spot); impactSrc = "stima dal prezzo spot del pool";
    }
  }
  if (impactSrc === "jupiter" && impact >= 0.999) { impact = null; impactSrc = "non calcolabile (Jupiter non ha un prezzo USD del token)"; }
  return { ok: true, priceImpactEst: impact, priceImpactSource: impactSrc, in: { sym: a.sym, mint: a.mint, amount: inn }, out: { sym: b.sym, mint: b.mint, amount: out, minimum: min }, rate: out / inn,
    priceImpactPct: +r.j.priceImpactPct, slippageBps: slip, route: (r.j.routePlan || []).map(x => ({ label: x.swapInfo?.label, amm: x.swapInfo?.ammKey, pct: x.percent })), kira: risk, contextSlot: r.j.contextSlot, quoteResponse: r.j };
}
async function swapBuild(body) {
  const qr = body.quoteResponse, user = body.userPublicKey;
  if (!qr || !isB58(user)) return { ok: false, code: 400, errore: "richiesta incompleta" };
  if (!byKey(qr.inputMint) || !byKey(qr.outputMint)) return { ok: false, code: 400, errore: "moneta non supportata" };
  const r = await up(`${JUP}/swap/v1/swap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quoteResponse: qr, userPublicKey: user, dynamicComputeUnitLimit: true, dynamicSlippage: false, prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 200000, priorityLevel: "medium" } } }) }, 20000);
  if (!r.ok || !r.j.swapTransaction) return { ok: false, code: 502, errore: r.j?.error || "Jupiter non ha costruito la transazione" };
  return { ok: true, tx: r.j.swapTransaction, versioned: true, lastValidBlockHeight: r.j.lastValidBlockHeight, nota: "Transazione non firmata: la firma avviene solo nel tuo wallet." };
}

/* ---------- invio di una transazione già firmata dall'utente (solo inoltro) ---------- */
function decodeTx(b64) {
  const raw = Buffer.from(String(b64 || ""), "base64");
  if (raw.length < 64 || raw.length > 1232) throw new Error("transazione non valida");
  try { const v = VersionedTransaction.deserialize(raw); return { v, raw }; } catch { const l = Transaction.from(raw); return { l, raw }; }
}
async function sendSigned(b64) {
  const { v, l, raw } = decodeTx(b64);
  const sigs = v ? v.signatures : l.signatures.map(s => s.signature);
  if (!sigs.length || sigs.some(s => !s || s.every(x => x === 0))) return { ok: false, code: 400, errore: "mancano firme: la transazione deve essere firmata nel wallet" };
  const sig = await rpcSend(raw);
  return { ok: true, signature: sig, explorer: `https://solscan.io/tx/${sig}` };
}

/* ---------- liquidità DLMM (transazioni costruite qui, firmate dall'utente) ---------- */
const PENDING = new Map(); // id -> { kp, owner, pool, exp }
setInterval(() => { const n = Date.now(); for (const [k, v] of PENDING) if (v.exp < n) PENDING.delete(k); }, 30e3).unref();
const STRAT = { spot: "Spot", curve: "Curve", bidask: "BidAsk" };
async function lpBuild(b) {
  if (!KNOWN_POOLS.includes(b.pool) && !(await meteoraDiscover().catch(() => [])).includes(b.pool)) return { ok: false, code: 400, errore: "pool non gestito dal pannello" };
  if (!isB58(b.owner)) return { ok: false, code: 400, errore: "wallet non valido" };
  const d = await DLMM.create(conn, new PublicKey(b.pool));
  const dx = d.tokenX.mint?.decimals ?? 6, dy = d.tokenY.mint?.decimals ?? 9;
  const ax = +b.amountX > 0 ? toBase(b.amountX, dx) : 0n, ay = +b.amountY > 0 ? toBase(b.amountY, dy) : 0n;
  if ((ax === null) || (ay === null) || (ax === 0n && ay === 0n)) return { ok: false, code: 400, errore: "importi non validi" };
  const left = Math.max(0, Math.min(34, parseInt(b.binsLeft ?? 10, 10) || 0)), right = Math.max(0, Math.min(34, parseInt(b.binsRight ?? 10, 10) || 0));
  const active = await d.getActiveBin();
  const st = StrategyType[STRAT[b.strategy] || "Spot"];
  const kp = Keypair.generate(); const owner = new PublicKey(b.owner);
  const tx = await d.initializePositionAndAddLiquidityByStrategy({ positionPubKey: kp.publicKey, user: owner, totalXAmount: new BN(ax.toString()), totalYAmount: new BN(ay.toString()), strategy: { minBinId: active.binId - left, maxBinId: active.binId + right, strategyType: st }, slippage: Math.min(5, Math.max(0.1, +b.slippagePct || 1)) });
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.feePayer = owner; tx.recentBlockhash = blockhash;
  const id = crypto.randomBytes(12).toString("hex");
  PENDING.set(id, { kp, owner: b.owner, pool: b.pool, exp: Date.now() + 150e3 });
  return { ok: true, id, tx: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"), versioned: false, position: kp.publicKey.toBase58(), range: { min: active.binId - left, max: active.binId + right, active: active.binId }, lastValidBlockHeight, scade: "150 s",
    nota: "Il conto posizione è nuovo e serve solo a creare la posizione: il proprietario della posizione sei tu. Dopo la tua firma il server aggiunge la firma del conto posizione e inoltra." };
}
async function lpFinalize(b) {
  const p = PENDING.get(String(b.id || "")); if (!p) return { ok: false, code: 410, errore: "richiesta scaduta: ricostruisci la transazione" };
  const raw = Buffer.from(String(b.tx || ""), "base64"); let tx;
  try { tx = Transaction.from(raw); } catch { return { ok: false, code: 400, errore: "transazione non valida" }; }
  if (!tx.feePayer || tx.feePayer.toBase58() !== p.owner) return { ok: false, code: 400, errore: "fee payer diverso dal wallet" };
  const msg = tx.serializeMessage();
  const us = tx.signatures.find(s => s.publicKey.toBase58() === p.owner);
  if (!us?.signature) return { ok: false, code: 400, errore: "manca la firma del wallet" };
  const spki = crypto.createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), new PublicKey(p.owner).toBuffer()]), format: "der", type: "spki" });
  if (!crypto.verify(null, msg, spki, us.signature)) return { ok: false, code: 400, errore: "firma del wallet non valida" };
  if (!tx.instructions.some(ix => ix.keys.some(k => k.pubkey.equals(p.kp.publicKey)))) return { ok: false, code: 400, errore: "transazione diversa da quella costruita" };
  tx.partialSign(p.kp);
  PENDING.delete(String(b.id));
  const sig = await rpcSend(tx.serialize());
  return { ok: true, signature: sig, position: p.kp.publicKey.toBase58(), explorer: `https://solscan.io/tx/${sig}` };
}
async function positions(owner) {
  const addrs = await meteoraDiscover().catch(() => KNOWN_POOLS); const out = [];
  for (const a of addrs) {
    try {
      const d = await DLMM.create(conn, new PublicKey(a));
      const { userPositions, activeBin } = await d.getPositionsByUserAndLbPair(new PublicKey(owner));
      const dx = d.tokenX.mint?.decimals ?? 6, dy = d.tokenY.mint?.decimals ?? 9;
      for (const up_ of userPositions) {
        const pd = up_.positionData;
        out.push({ pool: a, position: up_.publicKey.toBase58(), lowerBin: pd.lowerBinId, upperBin: pd.upperBinId, activeBin: activeBin.binId, inRange: activeBin.binId >= pd.lowerBinId && activeBin.binId <= pd.upperBinId,
          x: Number(pd.totalXAmount) / 10 ** dx, y: Number(pd.totalYAmount) / 10 ** dy, feeX: Number(pd.feeX?.toString() || 0) / 10 ** dx, feeY: Number(pd.feeY?.toString() || 0) / 10 ** dy });
      }
    } catch (e) { out.push({ pool: a, errore: String(e.message || e).slice(0, 120) }); }
  }
  return out;
}
async function lpRemove(b) {
  if (!isB58(b.owner) || !isB58(b.position) || !isB58(b.pool)) return { ok: false, code: 400, errore: "richiesta incompleta" };
  const addrs = await meteoraDiscover().catch(() => KNOWN_POOLS); if (!addrs.includes(b.pool)) return { ok: false, code: 400, errore: "pool non gestito" };
  const bps = Math.max(1, Math.min(10000, parseInt(b.bps, 10) || 10000));
  const d = await DLMM.create(conn, new PublicKey(b.pool));
  const pos = await d.getPosition(new PublicKey(b.position));
  if (pos.positionData.owner && pos.positionData.owner.toBase58 && pos.positionData.owner.toBase58() !== b.owner) return { ok: false, code: 403, errore: "la posizione non appartiene a questo wallet" };
  const txs = await d.removeLiquidity({ user: new PublicKey(b.owner), position: new PublicKey(b.position), fromBinId: pos.positionData.lowerBinId, toBinId: pos.positionData.upperBinId, bps: new BN(bps), shouldClaimAndClose: bps === 10000 && !!b.close });
  const arr = Array.isArray(txs) ? txs : [txs];
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  return { ok: true, versioned: false, txs: arr.map(t => { t.feePayer = new PublicKey(b.owner); t.recentBlockhash = blockhash; return t.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"); }) };
}
async function walletView(owner) {
  const pk = new PublicKey(owner);
  const [lam, a, b2] = await Promise.all([
    conn.getBalance(pk),
    conn.getParsedTokenAccountsByOwner(pk, { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }),
    conn.getParsedTokenAccountsByOwner(pk, { programId: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") })
  ]);
  const bal = { SOL: lam / 1e9 };
  for (const acc of [...a.value, ...b2.value]) { const i = acc.account.data.parsed.info; const t = byKey(i.mint); if (t) bal[t.sym] = (bal[t.sym] || 0) + (i.tokenAmount.uiAmount || 0); }
  return { ok: true, owner, balances: bal, positions: await positions(owner) };
}

/* ---------- Filiera ÆSIR: stato pubblico, sola lettura ---------- */
async function ecosystem() {
  return cached("eco", 30e3, async () => {
    const g = (u) => up(u, {}, 5000).then(r => r.j).catch(() => null);
    const [m, v, z] = await Promise.all([g("http://127.0.0.1:4197/api/zminer/status"), g("http://127.0.0.1:8899/api/vchain/status"), g("http://127.0.0.1:8844/api/zpool/status")]);
    return { ok: true,
      miner: m ? { name: m.name, kind: m.kind, proofs: m.n, points: m.points, head: m.head, jobs: Object.fromEntries(Object.entries(m.byJob || {}).map(([k, x]) => [k, { runs: x.runs, ok: x.ok, last: x.lastSummary }])) } : null,
      vchain: v ? { chainId: v.chainId, height: v.height, headHash: v.headHash, nota: "ledger interno ZDOS; le radici di prova si ancorano su Solana" } : null,
      zpool: z ? { engine: z.engine, hashrateDichiaratoHs: z.totalHashrateHs, rig: (z.fleet || []).map(r => ({ nome: r.rig_name, hashrateDichiaratoHs: r.hashrate_hs, ultimoHeartbeat: r.last_heartbeat })), nota: "hashrate dichiarati dai nodi, non verificati" } : null };
  });
}

/* ---------- snapshot periodico sul bus zcomm (source dex, tipo pool_snapshot) ---------- */
async function snapshot() {
  try {
    const { publish } = await import("/opt/zdos-filiera/zbus.mjs");
    for (const a of KNOWN_POOLS) {
      const d = await poolDetail(a);
      const hour = new Date().toISOString().slice(0, 13).replace(/[-T]/g, "");
      await publish({ key: `dex:defi:${a.slice(0, 8)}:${hour}`, type: "pool_snapshot", source: "dex", data: { pool: a, activeBin: d.onchain.activeBin, priceInY: d.onchain.activePrice, x: d.pool.x.amount, y: d.pool.y.amount, blacklisted: d.pool.blacklisted } });
    }
  } catch (e) { pushLog(UP, { ts: Date.now(), url: "zcomm:pool_snapshot", status: 0, ms: 0, err: String(e.message || e).slice(0, 80) }); }
}
setTimeout(snapshot, 20e3).unref(); setInterval(snapshot, 60 * 60e3).unref();

/* ---------- limiti di frequenza ---------- */
const RL = new Map();
function limited(ip, bucket, max) { const k = ip + "|" + bucket, n = Date.now(), w = RL.get(k) || []; const f = w.filter(t => n - t < 60e3); f.push(n); RL.set(k, f); return f.length > max; }
setInterval(() => RL.clear(), 10 * 60e3).unref();

const DEV = { version: VERSION, rpc: "RPC Solana mainnet (proxy locale)", upstream: { jupiter: JUP, meteora: METEORA, dexscreener: DEXS },
  endpoints: [
    ["GET", "/api/defi/health", "stato del servizio"], ["GET", "/api/defi/overview", "monete, pool Meteora, coppie DexScreener, controlli K.I.R.A."],
    ["GET", "/api/defi/pool/{indirizzo}", "dettaglio pool DLMM: bin attivo, bin ±35, commissioni on-chain"], ["GET", "/api/defi/quote?in=SOL&out=L$D&amount=0.01&slippageBps=100", "quotazione Jupiter"],
    ["POST", "/api/defi/swap/build", "transazione di swap non firmata (Jupiter)"], ["POST", "/api/defi/send", "inoltra una transazione già firmata dal wallet"],
    ["POST", "/api/defi/lp/build", "transazione non firmata per aprire una posizione DLMM"], ["POST", "/api/defi/lp/finalize", "aggiunge la firma del conto posizione e inoltra"],
    ["POST", "/api/defi/lp/remove", "transazioni non firmate per ritirare liquidità"], ["GET", "/api/defi/wallet/{indirizzo}", "saldi e posizioni DLMM (sola lettura)"],
    ["GET", "/api/defi/ecosystem", "Filiera: miner, vBLOCKCHAIN, Z-Pool (hashrate dichiarati)"], ["GET", "/api/defi/log", "ultime richieste (senza IP) e chiamate upstream"]
  ], regole: ["nessuna chiave privata utente sul server", "nessun fondo custodito, nessuna liquidità della casa", "ogni transazione è firmata solo dal wallet dell'utente", "nessun mint, nessuna promessa di rendimento"] };

function send(res, code, obj, extra = {}) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra });
  res.end(b);
}
function readBody(req) {
  return new Promise((ok, ko) => { let n = 0; const ch = []; req.on("data", c => { n += c.length; if (n > 65536) { ko(new Error("corpo troppo grande")); req.destroy(); } else ch.push(c); }); req.on("end", () => { try { ok(JSON.parse(Buffer.concat(ch).toString() || "{}")); } catch { ko(new Error("JSON non valido")); } }); });
}

http.createServer(async (req, res) => {
  const t0 = Date.now(); const u = new URL(req.url, "http://x"); const p = u.pathname.replace(/^\/api\/defi/, "") || "/";
  const ip = String(req.headers["x-real-ip"] || req.socket.remoteAddress || "");
  let code = 200;
  const reply = (c, o) => { code = c; send(res, c, o); };
  try {
    if (req.method === "GET") {
      if (limited(ip, "get", 120)) return reply(429, { ok: false, errore: "troppe richieste, riprova tra poco" });
      if (p === "/health") return reply(200, { ok: true, servizio: "zdos-defi", versione: VERSION, slot: await conn.getSlot().catch(() => null) });
      if (p === "/overview") return reply(200, await overview());
      if (p === "/ecosystem") return reply(200, await ecosystem());
      if (p === "/dev") return reply(200, { ok: true, ...DEV });
      if (p === "/log") return reply(200, { ok: true, richieste: LOG.slice(-80).reverse(), upstream: UP.slice(-60).reverse() });
      let m;
      if ((m = p.match(/^\/pool\/([1-9A-HJ-NP-Za-km-z]{32,44})$/))) return reply(200, await poolDetail(m[1]));
      if ((m = p.match(/^\/wallet\/([1-9A-HJ-NP-Za-km-z]{32,44})$/))) return reply(200, await walletView(m[1]));
      if (p === "/quote") { if (limited(ip, "quote", 40)) return reply(429, { ok: false, errore: "troppe quotazioni, attendi un minuto" }); const q = await quote(Object.fromEntries(u.searchParams)); return reply(q.code || 200, q); }
      return reply(404, { ok: false, errore: "non trovato" });
    }
    if (req.method === "POST") {
      if (limited(ip, "post", 20)) return reply(429, { ok: false, errore: "troppe richieste, riprova tra poco" });
      const b = await readBody(req);
      const fn = { "/swap/build": swapBuild, "/send": (x) => sendSigned(x.tx), "/lp/build": lpBuild, "/lp/finalize": lpFinalize, "/lp/remove": lpRemove }[p];
      if (!fn) return reply(404, { ok: false, errore: "non trovato" });
      const r = await fn(b); return reply(r.code || 200, r);
    }
    return reply(405, { ok: false, errore: "metodo non ammesso" });
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 240);
    reply(e?.preflight ? 422 : /non valid|troppo grande|JSON/.test(msg) ? 400 : 502, { ok: false, errore: msg });
  } finally { pushLog(LOG, { ts: Date.now(), method: req.method, path: p.length > 60 ? p.slice(0, 60) + "…" : p, status: code, ms: Date.now() - t0 }); }
}).listen(PORT, "127.0.0.1", () => console.log("zdos-defi su 127.0.0.1:" + PORT));
