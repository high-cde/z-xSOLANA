// ÆSIR · Filiera ZDOS — aggregatore admin in sola lettura (127.0.0.1:4196, pubblicato dietro auth staff su x-zdos.it/aesir/).
// Non firma transazioni, non tiene chiavi di wallet, non muove fondi. © 2026 ZDOS1.3
import http from "node:http";
import * as C from "./common.mjs";

const PORT = +(process.env.FILIERA_PORT || 4196);
const MINER = "http://127.0.0.1:4197";
const get = async (u, ms = 6000) => { try { const r = await C.fetchJson(u, {}, ms); return r.json; } catch { return null; } };

let cache = { exp: 0, v: null };
async function filiera() {
  if (cache.v && cache.exp > Date.now()) return cache.v;
  const [miner, health, pools, balances, vchainCheck, anchorsCk, zai, vstatus, vblocks, vanch, merito, events, vcpu, kira, zpool, dex] = await Promise.all([
    get(MINER + "/api/zminer/status"), get(MINER + "/api/zminer/cache/health"), get(MINER + "/api/zminer/cache/pools"), get(MINER + "/api/zminer/cache/balances"),
    get(MINER + "/api/zminer/cache/vchain"), get(MINER + "/api/zminer/cache/anchors"), get(MINER + "/api/zminer/cache/zai"),
    get("http://127.0.0.1:8899/api/vchain/status"), get("http://127.0.0.1:8899/api/vchain/blocks?limit=12"), get("http://127.0.0.1:8899/api/vchain/anchors"),
    get("http://127.0.0.1:4192/merito/summary", 15000), get("http://127.0.0.1:4192/zcomm/events?limit=60"), get("http://127.0.0.1:8900/api/vcpu/status"),
    get("http://127.0.0.1:3010/health"), get("http://127.0.0.1:8844/api/zpool/status"), get("http://127.0.0.1:8897/api/dex/status", 8000),
  ]);
  const m = merito || {};
  const v = {
    ok: true, ts: C.now(), tsRome: new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" }) + " (ora di Roma)",
    vision: "vBLOCKCHAIN è il ledger ZDOS programmabile in Zlang, ancorato su Solana: unisce monete, merito, miner, zAI, DEX e badge con regole ed eventi cross-servizio.",
    coins: C.COINS, wallets: balances, pools, services: health,
    vchain: { status: vstatus && { height: vstatus.height, headHash: vstatus.headHash, chainId: vstatus.chainId, rails: vstatus.rails }, blocks: vblocks && vblocks.blocks, check: vchainCheck,
      anchors: vanch && { latest: vanch.latest, recent: (vanch.anchors || []).slice(0, 8) }, anchorCheck: anchorsCk, anchorNetwork: "devnet" },
    merito: { emissions: m.emissions && { live: m.emissions.live, schedule: m.emissions.schedule }, token: m.token, fund: m.fund && { address: m.fund.address }, calendar: m.calendar && { weekNo: m.calendar.weekNo, startRome: m.calendar.startRome },
      week: m.week, profiles: m.profiles, rules: m.rules, register: m.register && { totalSent: m.register.totalSent, batches: (m.register.batches || []).slice(0, 4) } },
    bus: events && events.events, vcpu: vcpu && { ticks: vcpu.ticks, dispatched: vcpu.dispatched, bootedAt: vcpu.bootedAt, health: vcpu.health, cores: vcpu.cores && Object.fromEntries(Object.entries(vcpu.cores).map(([k, c]) => [k, c.name])) },
    kira: kira && { ok: kira.ok, load: kira.load, freeRam: kira.freeRam, peers: (kira.peers || []).map((p) => ({ peer: p.peer, lastSeen: p.lastSeen, grok2: p.grok2 })) },
    zpool: zpool && { engine: zpool.engine, stats: zpool.stats, totalHashrateHs: zpool.totalHashrateHs, fleet: (zpool.fleet || []).map((f) => ({ rig: f.rig_name, hs: f.hashrate_hs, last: f.last_heartbeat })), note: "hashrate auto-dichiarato dai worker (non verificato on-chain); il rig BONK-Treasury invia valori fissi ogni 12 s" },
    dex: dex && { name: dex.dexName, vault: dex.vaultAddress, lsdMint: dex.lsdMint, pegEur: dex.pegEur, solPriceEur: dex.solPriceEur },
    miner, zai,
  };
  cache = { v, exp: Date.now() + 15000 };
  return v;
}

http.createServer(async (req, res) => {
  const j = (c, o) => { res.writeHead(c, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(JSON.stringify(o)); };
  try {
    const u = new URL(req.url, "http://x"); const p = u.pathname.replace(/^\/aesir/, "");
    if (req.method !== "GET") return j(405, { ok: false, error: "sola lettura" });
    if (p === "/api/filiera") return j(200, await filiera());
    if (p === "/api/miner/proofs") return j(200, await get(MINER + "/api/zminer/proofs?limit=" + Math.min(200, +(u.searchParams.get("limit") || 40))));
    if (p === "/api/health") return j(200, { ok: true, service: "aesir-filiera" });
    return j(404, { ok: false, error: "non trovato" });
  } catch (e) { return j(500, { ok: false, error: "errore interno" }); }
}).listen(PORT, "127.0.0.1", () => console.log("ÆSIR Filiera su 127.0.0.1:" + PORT));
