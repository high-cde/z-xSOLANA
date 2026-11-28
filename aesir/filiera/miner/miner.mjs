// ZDOS Miner · lavoro utile per i servizi ZDOS al posto di XMRig. Nessun mining di criptovalute.
// Ogni lavoro produce una "prova di lavoro" (hash concatenato) -> evento firmato zcomm (work_proof)
// e, ogni 6 ore, una radice Merkle registrata come blocco ZMINER_WORK_ROOT su vBLOCKCHAIN.
// I punti lavoro NON sono VELVET e NON sono token: sono un contatore di contributo della rete.
// © 2026 ZDOS1.3 · Licenza ZSEL proprietaria.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import * as C from "./common.mjs";

const PORT = +(process.env.ZMINER_PORT || 4197);
const ROOT_EVERY = +(process.env.ZMINER_ROOT_EVERY_S || 6 * 3600);
fs.mkdirSync(C.DATA, { recursive: true });
const F = (n) => path.join(C.DATA, n);
const PROOFS = F("proofs.jsonl");
const KEY = C.readKey();

const POINTS = { health: 1, vchain_verify: 2, index_pools: 2, index_balances: 2, anchor_check: 1, zcomm_audit: 1, zai_inference: 5 };
const EVERY = { health: 120, index_pools: 300, vchain_verify: 600, index_balances: 600, anchor_check: 900, zcomm_audit: 600, zai_inference: 3 * 3600 };

let st = C.readJson(F("state.json"), null) || { startedFirst: C.now(), n: 0, head: "0".repeat(64), points: 0, byJob: {}, last: {}, lastRoot: null, roots: [], errors: 0 };
st.bootedAt = C.now(); st.version = "1.0.0";
const save = () => C.writeJson(F("state.json"), st);

// ---------- lavori ----------
const JOBS = {
  async health() {
    const svc = await Promise.all(C.SERVICES.map(async ([name, port, p, layer]) => ({ name, port, layer, ...(await C.probe(port, p)) })));
    const pub = await Promise.all(C.PUBLIC.map(async (u) => { const t0 = Date.now(); try { const r = await fetch(u, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(8000) }); return { url: u, code: r.status, ms: Date.now() - t0, up: r.status < 500 }; } catch { return { url: u, code: 0, ms: Date.now() - t0, up: false }; } }));
    const out = { ts: C.now(), services: svc, public: pub, up: svc.filter((s) => s.up).length, total: svc.length };
    C.writeJson(F("health.json"), out);
    return { in: "services:" + svc.length + "+" + pub.length, out, summary: `${out.up}/${out.total} servizi, ${pub.filter((p) => p.up).length}/${pub.length} URL pubblici` };
  },
  async index_pools() {
    const sol = C.COINS.filter((c) => c.chain === "solana");
    const ds = await C.fetchJson("https://api.dexscreener.com/tokens/v1/solana/" + sol.map((c) => c.mint).join(","));
    const jup = await C.fetchJson("https://lite-api.jup.ag/price/v3?ids=" + sol.map((c) => c.mint).join(","));
    const pools = (Array.isArray(ds.json) ? ds.json : []).map((p) => ({ src: "dexscreener", dex: p.dexId, labels: p.labels || [], pair: p.pairAddress, base: p.baseToken && p.baseToken.address, sym: p.baseToken && p.baseToken.symbol, quote: p.quoteToken && p.quoteToken.symbol, liqUsd: p.liquidity && p.liquidity.usd, vol24: p.volume && p.volume.h24, priceUsd: p.priceUsd ? +p.priceUsd : null, url: p.url }));
    const meteora = [];
    for (const k of C.KNOWN_POOLS) {
      const r = await C.fetchJson("https://dlmm.datapi.meteora.ag/pools/" + k.addr);
      if (r.json && r.json.address) { const j = r.json; meteora.push({ src: "meteora-dlmm", label: k.label, pair: j.address, tvl: j.tvl, price: j.current_price, vol24: j.volume && (j.volume["24h"] ?? j.volume.h24), fees24: j.fees && (j.fees["24h"] ?? j.fees.h24), binStep: j.pool_config && j.pool_config.bin_step, baseFee: j.pool_config && j.pool_config.base_fee_pct, x: j.token_x_amount, y: j.token_y_amount, blacklisted: j.is_blacklisted, url: "https://app.meteora.ag/dlmm/" + j.address }); }
    }
    // ricerca pool Meteora DLMM per ogni mint (nuovi pool creati da altri)
    for (const c of sol) { const r = await C.fetchJson("https://dlmm.datapi.meteora.ag/pools?page_size=10&query=" + c.mint); if (r.json && Array.isArray(r.json.data)) for (const j of r.json.data) if (!meteora.find((m) => m.pair === j.address)) meteora.push({ src: "meteora-dlmm", label: j.name, pair: j.address, tvl: j.tvl, price: j.current_price, url: "https://app.meteora.ag/dlmm/" + j.address }); }
    const prices = {}; if (jup.json) for (const [m, v] of Object.entries(jup.json)) prices[m] = { usd: v.usdPrice ?? null, liquidity: v.liquidity ?? null, launchpad: v.launchpad || null, change24h: v.priceChange24h ?? null };
    const out = { ts: C.now(), pools, meteora, prices };
    C.writeJson(F("pools.json"), out);
    return { in: sol.map((c) => c.mint).join(","), out, summary: `${pools.length} pool DexScreener, ${meteora.length} Meteora, ${Object.keys(prices).length} prezzi Jupiter` };
  },
  async index_balances() {
    const sol = C.COINS.filter((c) => c.chain === "solana").map((c) => c.mint);
    const wallets = [];
    for (const w of C.WALLETS) {
      const o = { ...w, sol: null, tokens: {} };
      try { o.sol = (await C.solRpc("getBalance", [w.addr])).value / 1e9; } catch (e) { o.err = e.message; }
      for (const prog of ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]) {
        try { const r = await C.solRpc("getTokenAccountsByOwner", [w.addr, { programId: prog }, { encoding: "jsonParsed" }]);
          for (const a of r.value) { const i = a.account.data.parsed.info; if (sol.includes(i.mint)) o.tokens[i.mint] = (o.tokens[i.mint] || 0) + (+i.tokenAmount.uiAmountString || 0); } } catch {}
      }
      wallets.push(o);
    }
    const supply = {};
    for (const m of sol) { try { const s = await C.solRpc("getTokenSupply", [m]); supply[m] = +s.value.uiAmountString; } catch {} }
    const ts = await C.polyCall("0xfc90516a1f736FaC557e09D8853dB80dA192c296", "0x18160ddd");
    const dec = await C.polyCall("0xfc90516a1f736FaC557e09D8853dB80dA192c296", "0x313ce567");
    if (ts && ts !== "0x") { const d = dec && dec !== "0x" ? parseInt(dec, 16) : 18; supply["0xfc90516a1f736FaC557e09D8853dB80dA192c296"] = Number(BigInt(ts) / 10n ** BigInt(Math.max(0, d - 2))) / 100; }
    const out = { ts: C.now(), wallets, supply };
    C.writeJson(F("balances.json"), out);
    return { in: C.WALLETS.map((w) => w.addr).join(","), out, summary: `${wallets.length} wallet, ${Object.keys(supply).length} supply` };
  },
  async vchain_verify() {
    const r = await C.fetchJson("http://127.0.0.1:8899/api/vchain/blocks?limit=50");
    const blocks = ((r.json && r.json.blocks) || []).slice().reverse();
    let links = 0, broken = [], hashOk = 0, hashUnk = 0;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (i > 0) { if (b.prevHash === blocks[i - 1].hash) links++; else broken.push(b.height); }
      if (b.height > 0) { const h = C.sha256(JSON.stringify({ height: b.height, timestamp: b.timestamp, prevHash: b.prevHash, tx: b.tx })); if (h === b.hash) hashOk++; else hashUnk++; }
    }
    const out = { ts: C.now(), height: blocks.length ? blocks[blocks.length - 1].height : null, checked: blocks.length, links, broken, hashOk, hashMismatch: hashUnk };
    C.writeJson(F("vchain.json"), out);
    return { in: "blocks:" + blocks.length, out, summary: `${blocks.length} blocchi, catena ${broken.length ? "ROTTA a " + broken.join(",") : "integra"}, hash ok ${hashOk}/${Math.max(0, blocks.length - 1)}` };
  },
  async anchor_check() {
    const r = await C.fetchJson("http://127.0.0.1:8899/api/vchain/anchors");
    const a = (r.json && r.json.anchors) || [];
    const ok = a.filter((x) => x.solanaSig && !String(x.solanaSig).startsWith("ERR"));
    const out = { ts: C.now(), total: a.length, ok: ok.length, failed: a.length - ok.length, latestOk: ok[0] || null, network: "devnet (da .env.anchor)" };
    C.writeJson(F("anchors.json"), out);
    return { in: "anchors:" + a.length, out, summary: `${ok.length}/${a.length} ancore con firma Solana` };
  },
  async zcomm_audit() {
    const r = await C.fetchJson("http://127.0.0.1:4192/zcomm/api/events?limit=200");
    const ev = (r.json && r.json.events) || []; const byType = {};
    for (const e of ev) byType[e.type] = (byType[e.type] || 0) + 1;
    const out = { ts: C.now(), lastSeq: ev[0] ? ev[0].seq : 0, window: ev.length, byType };
    return { in: "events:" + ev.length, out, summary: `ultimo seq ${out.lastSeq}, ${Object.keys(byType).length} tipi` };
  },
  async zai_inference() {
    const h = C.readJson(F("health.json"), {});
    const down = (h.services || []).filter((s) => !s.up).map((s) => s.name);
    const prompt = `Sei il controllo di salute ZDOS. In una sola frase in italiano, senza inventare dati: servizi attivi ${h.up}/${h.total}; servizi giù: ${down.join(", ") || "nessuno"}. Suggerisci la priorità.`;
    const r = await C.fetchJson("http://127.0.0.1:8900/api/vcpu/dispatch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domain: "zdos", prompt }) }, 30000);
    const reply = r.json && r.json.reply ? String(r.json.reply.body || r.json.reply.error || "").slice(0, 600) : "";
    const out = { ts: C.now(), taskId: r.json && r.json.taskId, core: r.json && r.json.routedCore, status: r.json && r.json.reply && r.json.reply.status, reply };
    C.writeJson(F("zai.json"), out);
    if (!(out.status >= 200 && out.status < 300)) throw new Error("vcpu risposta " + out.status);
    return { in: C.sha256(prompt), out, summary: `task ${out.taskId} su ${out.core}` };
  },
};

// ---------- bus zcomm ----------
async function publish(ev) {
  const body = JSON.stringify(ev); const ts = C.now();
  try { const r = await C.fetchJson("http://127.0.0.1:4192/zcomm/api/events", { method: "POST", headers: { "content-type": "application/json", "x-zcomm-ts": String(ts), "x-zcomm-signature": C.hsign(KEY, ts, body) }, body }, 5000); return r.json; }
  catch (e) { return { ok: false, error: e.message }; }
}

function merkle(hashes) {
  if (!hashes.length) return "0".repeat(64);
  let lv = hashes.slice();
  while (lv.length > 1) { const nx = []; for (let i = 0; i < lv.length; i += 2) nx.push(C.sha256(lv[i] + (lv[i + 1] || lv[i]))); lv = nx; }
  return lv[0];
}
function proofsSince(n0) {
  if (!fs.existsSync(PROOFS)) return [];
  return fs.readFileSync(PROOFS, "utf8").trim().split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((p) => p && p.n > n0);
}
async function maybeRoot(force = false) {
  const lastN = st.lastRoot ? st.lastRoot.toN : 0; const lastT = st.lastRoot ? st.lastRoot.ts : st.startedFirst;
  const ps = proofsSince(lastN); if (!ps.length) return;
  const first = !st.lastRoot && ps.length >= 10;
  if (!force && !first && C.now() - lastT < ROOT_EVERY) return;
  const root = merkle(ps.map((p) => p.hash));
  const pts = ps.reduce((a, p) => a + (p.ok ? p.pts : 0), 0);
  const jobs = {}; for (const p of ps) jobs[p.job] = (jobs[p.job] || 0) + 1;
  const payload = { type: "ZMINER_WORK_ROOT", fromN: ps[0].n, toN: ps[ps.length - 1].n, count: ps.length, merkleRoot: root, head: st.head, workPoints: pts, jobs, from: ps[0].t0, to: ps[ps.length - 1].t0 };
  const body = JSON.stringify(payload); const ts = C.now();
  const r = await C.fetchJson("http://127.0.0.1:8899/api/vchain/work-root", { method: "POST", headers: { "content-type": "application/json", "x-zcomm-ts": String(ts), "x-zcomm-signature": C.hsign(KEY, ts, body) }, body }, 8000).catch((e) => ({ json: { ok: false, error: e.message } }));
  if (r.json && r.json.ok) {
    st.lastRoot = { ts: C.now(), toN: payload.toN, height: r.json.block.height, hash: r.json.block.hash, merkleRoot: root, count: ps.length };
    st.roots.unshift(st.lastRoot); st.roots = st.roots.slice(0, 30); save();
    await publish({ key: `zminer:root:${payload.toN}`, type: "vchain_root", source: "zminer", data: { height: r.json.block.height, merkleRoot: root.slice(0, 16), count: ps.length, workPoints: pts } });
    console.log("radice registrata su vBLOCKCHAIN #" + r.json.block.height, root);
  } else console.error("radice non registrata", r.json && r.json.error);
}

let running = false;
async function tick() {
  if (running) return; running = true;
  try {
    if (fs.existsSync(F("STOP"))) { st.paused = true; save(); return; } st.paused = false;
    const t = C.now();
    const due = Object.keys(JOBS).filter((j) => t - (st.last[j] || 0) >= EVERY[j]).sort((a, b) => (st.last[a] || 0) - (st.last[b] || 0));
    if (!due.length) return;
    const job = due[0]; const t0 = Date.now(); let ok = true, res, err = null;
    try { res = await JOBS[job](); } catch (e) { ok = false; err = String(e.message || e).slice(0, 200); st.errors++; }
    const ms = Date.now() - t0; st.last[job] = C.now();
    const inH = C.sha256(String(res ? res.in : job)); const outH = C.sha256(JSON.stringify(res ? res.out : { err }));
    const n = st.n + 1; const hash = C.sha256([st.head, n, job, t0, inH, outH, ok ? 1 : 0].join("|"));
    const pts = ok ? POINTS[job] : 0;
    const proof = { n, job, t0: Math.floor(t0 / 1000), ms, ok, in: inH, out: outH, prev: st.head, hash, pts, summary: res ? res.summary : err };
    fs.appendFileSync(PROOFS, JSON.stringify(proof) + "\n");
    st.n = n; st.head = hash; st.points += pts;
    const bj = st.byJob[job] || (st.byJob[job] = { runs: 0, ok: 0, points: 0, msTotal: 0 }); bj.runs++; if (ok) bj.ok++; bj.points += pts; bj.msTotal += ms; bj.lastSummary = proof.summary; bj.lastAt = proof.t0;
    save();
    const pr = await publish({ key: `zminer:proof:${n}`, type: "work_proof", source: "zminer", data: { n, job, ok, ms, pts, hash: hash.slice(0, 16) } });
    if (!pr || !pr.ok) console.error("zcomm publish", pr && pr.error);
    await maybeRoot();
  } catch (e) { console.error("tick", e.message); } finally { running = false; }
}

// rotazione proofs.jsonl (mantiene le ultime 20000 righe)
setInterval(() => { try { const L = fs.readFileSync(PROOFS, "utf8").trim().split("\n"); if (L.length > 25000) fs.writeFileSync(PROOFS, L.slice(-20000).join("\n") + "\n"); } catch {} }, 3600_000).unref();

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const j = (c, o) => { res.writeHead(c, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(o)); };
  if (u.pathname === "/api/zminer/status") {
    let cpu = null; try { const s = fs.readFileSync("/proc/self/stat", "utf8").split(" "); cpu = { userS: +s[13] / 100, sysS: +s[14] / 100, uptimeS: process.uptime() }; } catch {}
    return j(200, { ok: true, name: "ZDOS Miner", kind: "lavoro utile (nessun mining crypto)", pid: process.pid, cpu, rss: process.memoryUsage().rss, ...st, points_note: "punti lavoro di rete: non sono VELVET né token", every: EVERY, pointsPerJob: POINTS });
  }
  if (u.pathname === "/api/zminer/proofs") { const ps = proofsSince(Math.max(0, st.n - Math.min(200, +(u.searchParams.get("limit") || 50)))); return j(200, { ok: true, proofs: ps.reverse() }); }
  if (u.pathname.startsWith("/api/zminer/cache/")) { const n = u.pathname.slice(18); if (!/^(health|pools|balances|vchain|anchors|zai)$/.test(n)) return j(404, { ok: false }); return j(200, C.readJson(F(n + ".json"), { ok: false, error: "non ancora calcolato" })); }
  if (u.pathname === "/api/zminer/health") return j(200, { ok: true, n: st.n, paused: !!st.paused });
  j(404, { ok: false, error: "non trovato" });
}).listen(PORT, "127.0.0.1", () => console.log("ZDOS Miner su 127.0.0.1:" + PORT));

if (process.argv.includes("--root-now")) setTimeout(() => maybeRoot(true), 3000);
setInterval(tick, 20_000); setTimeout(tick, 2000);
process.on("SIGTERM", () => { save(); process.exit(0); });
