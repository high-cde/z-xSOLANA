// ZDOS Filiera · costanti condivise (sola lettura on-chain). © 2026 ZDOS1.3
import fs from "node:fs";
import crypto from "node:crypto";
import http from "node:http";

export const DATA = process.env.ZMINER_DATA || "/var/lib/zdos-miner";
export const HMAC_FILE = process.env.ZCOMM_KEY_FILE || "/etc/zcomm/hmac.key";
export const SOL_RPC = (process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com").split(",");
export const POLYGON_RPC = ["https://polygon-rpc.com", "https://polygon-bor-rpc.publicnode.com"];

export const COINS = [
  { sym: "VELVET", alias: "$OV", chain: "solana", mint: "2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump", note: "pump.fun · token della community OurVelvet e del fondo merito" },
  { sym: "xZDOS", alias: "$DSN", chain: "solana", mint: "35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4", note: "token ZDOS su Solana (attivazione Radar)" },
  { sym: "L$D", alias: "Dom-Coin", chain: "solana", mint: "FSwCz9qgcvfWGEU8QU3h4fQpyQ8TB2KLHYC9bmoMxDgP", note: "Dom-Coin · pool Meteora DLMM" },
  { sym: "DSN", alias: "$DSN Polygon", chain: "polygon", mint: "0xfc90516a1f736FaC557e09D8853dB80dA192c296", note: "contratto ERC-20 su Polygon (gate ÆSIR)" },
  { sym: "HOLD", alias: "$HOLD", chain: "none", mint: null, note: "nessun mint on-chain: esiste solo come voce interna (hybrid:HOLD:velvet)" },
];
export const WALLETS = [
  { label: "Tesoreria ZDOS", addr: "6C61wDacAtx3QHQYVw17fnm5GEaEAnc1XienNJKn2bsD" },
  { label: "Fondo merito VELVET", addr: "GEntwhyRQASi5n9uWSqYhMRtePGoogDpsbuoZBwCECDd" },
  { label: "Vault Sovereign DEX", addr: "Hss8o82jXJJEE2zq1mcsHyVVXJJfo5bDebEZihwtrLBk" },
  { label: "Wallet agente (desk HighKali)", addr: "5qke6mW7k3uEw4Bk67xSyGAk5zDgsLnpLK8P8J3V7dww" },
  { label: "Keypair ancore vBLOCKCHAIN", addr: "CEokSxDmnpArTTMWk8eL94ZXL6hLkyHZZ3hfmvTu4k9m" },
];
export const KNOWN_POOLS = [{ dex: "meteora-dlmm", addr: "383iZ9nNfnnMtpM6oY7Gu4Nn87EtjwdPikkwctExjkze", label: "L$D-SOL" }];

// name, port, path, layer
export const SERVICES = [
  ["vBLOCKCHAIN", 8899, "/health", "ledger"], ["zcomm bus + merito", 4192, "/zcomm/health", "bus"],
  ["zcore-vcpu (Brain-vCPU)", 8900, "/api/vcpu/status", "zAI"], ["K.I.R.A.", 3010, "/health", "zAI"],
  ["zdos-grok2 bridge", 8080, "/health", "zAI"], ["velvet-ai", 4195, "/", "zAI"], ["Zara AGI", 8811, "/", "zAI"],
  ["Z-Pool AI", 8844, "/api/zpool/status", "pool"], ["Sovereign RPC", 8895, "/health", "pool"],
  ["Sovereign DEX", 8897, "/api/dex/status", "dex"], ["zBASKET", 8864, "/", "dex"], ["Dom-Coin RPC", 8896, "/", "dex"],
  ["Mining engine (vecchio)", 8847, "/health", "miner"], ["Vault miner (vecchio)", 8846, "/", "miner"],
  ["Omni Nexus", 8901, "/", "core"], ["Monetary gateway", 8890, "/", "core"], ["Velvet Pay backend", 8855, "/", "velvet"],
  ["zNFT API (devnet)", 4190, "/", "velvet"], ["Velvet Radar", 8763, "/", "velvet"], ["Unified Studio", 8868, "/", "velvet"],
  ["OurVelvet backend", 3001, "/", "velvet"], ["ZQuest", 3200, "/", "velvet"], ["Meat Radar", 3100, "/", "velvet"],
  ["Agenzia", 3300, "/", "zx"], ["Z-X backend", 8860, "/", "zx"], ["zdesk", 8787, "/", "desk"],
];
export const PUBLIC = ["https://x-zdos.it/", "https://ourvelvet.online/", "https://ourvelvet.online/pay/", "https://swap.x-zdos.it/",
  "https://basket.x-zdos.it/", "https://kira.x-zdos.it/", "https://zx.x-zdos.it/", "https://ourvelvet.online/merito/", "https://x-zdos.it/api/vchain/status"];

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
export const now = () => Math.floor(Date.now() / 1000);
export function readKey() { return fs.readFileSync(HMAC_FILE, "utf8").trim(); }
export function hsign(key, ts, body) { return crypto.createHmac("sha256", key).update(String(ts) + "." + body).digest("hex"); }
export function readJson(f, d = null) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } }
export function writeJson(f, o) { const t = f + ".tmp"; fs.writeFileSync(t, JSON.stringify(o)); fs.renameSync(t, f); }

export function probe(port, path = "/", timeout = 2500) {
  return new Promise((ok) => {
    const t0 = Date.now();
    const r = http.get({ host: "127.0.0.1", port, path, timeout }, (res) => { res.resume(); ok({ up: res.statusCode < 500, code: res.statusCode, ms: Date.now() - t0 }); });
    r.on("error", () => ok({ up: false, code: 0, ms: Date.now() - t0 }));
    r.on("timeout", () => { r.destroy(); ok({ up: false, code: 0, ms: timeout }); });
  });
}
export async function fetchJson(url, opt = {}, ms = 9000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { ...opt, signal: c.signal, headers: { "user-agent": "zdos-filiera/1.0", ...(opt.headers || {}) } }); const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {} return { status: r.status, json: j, text: txt }; }
  finally { clearTimeout(t); }
}
export async function solRpc(method, params) {
  let last;
  for (const u of SOL_RPC) {
    try { const r = await fetchJson(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      if (r.json && r.json.result !== undefined) return r.json.result; last = (r.json && r.json.error && r.json.error.message) || "HTTP " + r.status; } catch (e) { last = e.message; }
  }
  throw new Error(last || "rpc");
}
export async function polyCall(to, data) {
  for (const u of POLYGON_RPC) {
    try { const r = await fetchJson(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }) });
      if (r.json && r.json.result) return r.json.result; } catch {}
  }
  return null;
}
