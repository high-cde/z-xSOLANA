// Firma ZDOS / OurVelvet v1 — servizio di verifica firme wallet (formato Sign-In With Solana).
// Non custodisce chiavi, non costruisce né chiede mai transazioni. © 2026 ZDOS1.3
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import nacl from "tweetnacl";
import bs58 from "bs58";

const PORT = Number(process.env.PORT || 8905);
const HOST = "127.0.0.1";
const STATE_DIR = process.env.STATE_DIRECTORY || "/var/lib/zdos-firma";
const SECRET_FILE = process.env.FIRMA_SECRET_FILE || "/etc/zdos-firma/jwt.secret";
const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_S = 24 * 3600;
const MAX_BODY = 8 * 1024;

// Domini ammessi → prefisso obbligatorio della dichiarazione firmata.
const DOMAINS = {
  "x-zdos.it": { brand: "ZDOS", prefix: "ZDOS Firma v1" },
  "zx.x-zdos.it": { brand: "ZDOS", prefix: "ZDOS Firma v1" },
  "ourvelvet.online": { brand: "OurVelvet", prefix: "OurVelvet Firma v1" },
};
const PREFIXES = ["ZDOS Firma v1", "OurVelvet Firma v1"];
// Statement SIWS: una sola riga di ASCII stampabile (32-126). Phantom su mobile rifiuta
// "invalid formatting" se compaiono caratteri non ASCII (es. "·", "è").
const STATEMENT_TAIL = " - Accesso con wallet. Questa firma non e una transazione: non muove fondi e non autorizza alcuna spesa.";
const STATEMENT_TAIL_LEGACY = " · Accesso con wallet. Questa firma non è una transazione: non muove fondi e non autorizza alcuna spesa.";
const statementFor = (domain) => DOMAINS[domain].prefix + STATEMENT_TAIL;
const statementsOk = (domain) => [statementFor(domain), DOMAINS[domain].prefix + STATEMENT_TAIL_LEGACY];
function assertAsciiLine(s, name) {
  if (typeof s !== "string" || !s.length || /[^\x20-\x7E]/.test(s)) throw new Error(name + " deve essere ASCII stampabile");
}

let SECRET;
try { SECRET = fs.readFileSync(SECRET_FILE); if (SECRET.length < 32) throw new Error("segreto troppo corto"); }
catch (e) { console.error("[firma] segreto JWT non leggibile:", e.message); process.exit(1); }

// ---------- utilità ----------
const nowMs = () => Date.now();
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, ".000Z");
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function normHost(h) {
  h = String(h || "").toLowerCase().split(":")[0].replace(/\.$/, "");
  if (h.startsWith("www.")) h = h.slice(4);
  return h;
}
function decodePubkey(s) {
  if (typeof s !== "string" || s.length < 32 || s.length > 44) return null;
  try { const b = bs58.decode(s); return b.length === 32 ? b : null; } catch { return null; }
}
function decodeSig(s) {
  if (typeof s !== "string") return null;
  s = s.trim();
  if (!s || s.length > 200) return null;
  const tries = [];
  if (/^[0-9a-fA-F]{128}$/.test(s)) tries.push(() => Buffer.from(s, "hex"));
  tries.push(() => bs58.decode(s));
  tries.push(() => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  for (const t of tries) { try { const b = t(); if (b && b.length === 64) return new Uint8Array(b); } catch {} }
  return null;
}
function verifyEd25519(message, sigBytes, pubBytes) {
  return nacl.sign.detached.verify(new Uint8Array(Buffer.from(message, "utf8")), sigBytes, pubBytes);
}

// ---------- messaggio SIWS ----------
function buildMessage(f) {
  return `${f.domain} wants you to sign in with your Solana account:\n${f.address}\n\n${f.statement}\n\n` +
    `URI: ${f.uri}\nVersion: ${f.version}\nChain ID: ${f.chainId}\nNonce: ${f.nonce}\n` +
    `Issued At: ${f.issuedAt}\nExpiration Time: ${f.expirationTime}`;
}
function parseMessage(msg) {
  if (typeof msg !== "string" || msg.length > 2048) return null;
  const m = /^([^\s\n]+) wants you to sign in with your Solana account:\n([1-9A-HJ-NP-Za-km-z]{32,44})\n\n([^\n]*)\n\nURI: ([^\n]+)\nVersion: ([^\n]+)\nChain ID: ([^\n]+)\nNonce: ([A-Za-z0-9]{8,64})\nIssued At: ([^\n]+)\nExpiration Time: ([^\n]+)$/.exec(msg);
  if (!m) return null;
  return { domain: m[1], address: m[2], statement: m[3], uri: m[4], version: m[5], chainId: m[6], nonce: m[7], issuedAt: m[8], expirationTime: m[9] };
}

// ---------- nonce monouso (in memoria, 5 minuti) ----------
const nonces = new Map(); // nonce -> {domain, issuedAt, exp}
function gcNonces() { const t = nowMs(); for (const [k, v] of nonces) if (v.exp < t) nonces.delete(k); }
setInterval(gcNonces, 30_000).unref();

// ---------- rate limit per IP ----------
const buckets = new Map();
function limited(ip, key, max, windowMs = 60_000) {
  const k = key + "|" + ip, t = nowMs();
  let b = buckets.get(k);
  if (!b || b.reset < t) { b = { n: 0, reset: t + windowMs }; buckets.set(k, b); }
  return ++b.n > max;
}
setInterval(() => { const t = nowMs(); for (const [k, v] of buckets) if (v.reset < t) buckets.delete(k); }, 60_000).unref();

// ---------- JWT HS256 ----------
function signJwt(claims) {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(JSON.stringify(claims));
  const s = b64u(crypto.createHmac("sha256", SECRET).update(h + "." + p).digest());
  return `${h}.${p}.${s}`;
}
function verifyJwt(tok, aud) {
  const parts = String(tok || "").split(".");
  if (parts.length !== 3) return null;
  const exp = b64u(crypto.createHmac("sha256", SECRET).update(parts[0] + "." + parts[1]).digest());
  if (!safeEq(exp, parts[2])) return null;
  try {
    const hdr = JSON.parse(Buffer.from(parts[0], "base64url"));
    if (hdr.alg !== "HS256") return null;
    const c = JSON.parse(Buffer.from(parts[1], "base64url"));
    if (c.iss !== "zdos-firma" || c.exp * 1000 < nowMs() || (aud && c.aud !== aud)) return null;
    return c;
  } catch { return null; }
}

// ---------- registro "wallet verificato" (solo indirizzi che hanno scelto il badge pubblico) ----------
const REG_FILE = path.join(STATE_DIR, "wallets.json");
let registry = {};
try { registry = JSON.parse(fs.readFileSync(REG_FILE, "utf8")); } catch {}
function saveRegistry() {
  try { const tmp = REG_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(registry), { mode: 0o600 }); fs.renameSync(tmp, REG_FILE); }
  catch (e) { console.error("[firma] registro non salvato:", e.message); }
}
function recordLogin(address, domain, pubblico) {
  const t = iso(nowMs());
  const r = registry[address] || { first: t, count: 0, domains: [], pubblico: false };
  r.last = t; r.count++;
  if (!r.domains.includes(domain)) r.domains.push(domain);
  r.pubblico = !!pubblico; // l'ultima scelta dell'utente prevale
  registry[address] = r;
  saveRegistry();
}

// ---------- HTTP ----------
function send(res, code, obj, extra = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra });
  res.end(body);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on("data", (c) => { n += c.length; if (n > MAX_BODY) { reject(Object.assign(new Error("troppo grande"), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(Object.assign(new Error("JSON non valido"), { code: 400 })); } });
    req.on("error", reject);
  });
}
function clientIp(req) { return req.headers["x-real-ip"] || req.socket.remoteAddress || "?"; }
function parseCookies(req) { const o = {}; String(req.headers.cookie || "").split(/;\s*/).forEach((p) => { const i = p.indexOf("="); if (i > 0) o[p.slice(0, i)] = p.slice(i + 1); }); return o; }
function tokenFrom(req) {
  const a = String(req.headers.authorization || "");
  if (a.startsWith("Bearer ")) return a.slice(7).trim();
  return parseCookies(req).zdos_firma || "";
}
function originOk(req, domain) {
  const o = req.headers.origin;
  if (!o) return true; // chiamate non-browser (curl, server a server)
  return o === "https://" + domain || o === "https://www." + domain;
}

async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const ip = clientIp(req);
  const host = normHost(req.headers["x-forwarded-host"] || req.headers.host);

  if (req.method === "OPTIONS" && p === "/api/firma/check") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" });
    return res.end();
  }

  // GET /api/firma/nonce
  if (req.method === "GET" && p === "/api/firma/nonce") {
    if (limited(ip, "nonce", 20)) return send(res, 429, { ok: false, errore: "troppe richieste, riprova tra un minuto" });
    const cfg = DOMAINS[host];
    if (!cfg) return send(res, 400, { ok: false, errore: "dominio non ammesso" });
    if (nonces.size > 20000) gcNonces();
    if (nonces.size > 20000) return send(res, 503, { ok: false, errore: "servizio occupato" });
    const nonce = crypto.randomBytes(16).toString("hex");
    const t = nowMs(), exp = t + NONCE_TTL_MS;
    const statement = statementFor(host);
    assertAsciiLine(statement, "statement");
    nonces.set(nonce, { domain: host, exp });
    return send(res, 200, {
      ok: true, nonce, expiresAt: iso(exp),
      signIn: { domain: host, statement, uri: "https://" + host + "/", version: "1", chainId: "mainnet", nonce, issuedAt: iso(t), expirationTime: iso(exp) },
    });
  }

  // POST /api/firma/verify
  if (req.method === "POST" && p === "/api/firma/verify") {
    if (limited(ip, "verify", 20)) return send(res, 429, { ok: false, errore: "troppe richieste, riprova tra un minuto" });
    let body; try { body = await readJson(req); } catch (e) { return send(res, e.code || 400, { ok: false, errore: e.message }); }
    const fail = (code, errore) => send(res, code, { ok: false, errore });
    const f = parseMessage(body.message);
    if (!f) return fail(400, "messaggio non nel formato Sign-In With Solana di ZDOS");
    const cfg = DOMAINS[f.domain];
    if (!cfg) return fail(400, "dominio non ammesso");
    if (f.domain !== host) return fail(400, "il dominio del messaggio non corrisponde al sito");
    if (!originOk(req, f.domain)) return fail(403, "origine della richiesta non ammessa");
    // nonce: si consuma al primo tentativo valido nel formato, riuscito o no
    const rec = nonces.get(f.nonce);
    if (!rec) return fail(400, "nonce sconosciuto o già usato");
    nonces.delete(f.nonce);
    if (rec.exp < nowMs()) return fail(400, "nonce scaduto");
    if (rec.domain !== f.domain) return fail(400, "nonce emesso per un altro dominio");
    if (!statementsOk(f.domain).includes(f.statement)) return fail(400, "dichiarazione non riconosciuta (prefisso " + cfg.prefix + " mancante)");
    if (f.uri !== "https://" + f.domain + "/") return fail(400, "URI non valido");
    if (f.version !== "1") return fail(400, "versione non supportata");
    if (f.chainId !== "mainnet") return fail(400, "chain ID non valido");
    const iat = Date.parse(f.issuedAt), exp = Date.parse(f.expirationTime);
    if (!Number.isFinite(iat) || !Number.isFinite(exp)) return fail(400, "date non valide");
    if (f.issuedAt !== iso(iat) || f.expirationTime !== iso(exp)) return fail(400, "formato date non valido (ISO 8601 UTC)");
    const t = nowMs();
    if (iat > t + 60_000) return fail(400, "issued-at nel futuro");
    if (exp < t) return fail(400, "messaggio scaduto");
    if (exp - iat > NONCE_TTL_MS + 1000) return fail(400, "finestra di validità troppo lunga");
    if (buildMessage(f) !== body.message) return fail(400, "messaggio non canonico");
    const pub = decodePubkey(f.address);
    const sig = decodeSig(body.signature);
    if (!pub) return fail(400, "indirizzo non valido");
    if (!sig) return fail(400, "firma non valida (attesi 64 byte, base58 o base64)");
    if (body.address && body.address !== f.address) return fail(400, "indirizzo diverso da quello nel messaggio");
    if (!verifyEd25519(body.message, sig, pub)) return fail(401, "firma non valida");
    recordLogin(f.address, f.domain, body.badgePubblico === true);
    const iatS = Math.floor(t / 1000);
    const claims = { iss: "zdos-firma", aud: f.domain, sub: f.address, iat: iatS, exp: iatS + SESSION_TTL_S, jti: crypto.randomBytes(8).toString("hex"), v: 1 };
    const token = signJwt(claims);
    const cookie = `zdos_firma=${token}; Path=/; Max-Age=${SESSION_TTL_S}; HttpOnly; Secure; SameSite=Lax`;
    return send(res, 200, { ok: true, address: f.address, domain: f.domain, token, expiresAt: iso(claims.exp * 1000), badgePubblico: body.badgePubblico === true }, { "Set-Cookie": cookie });
  }

  // POST /api/firma/check — verifica pubblica di una qualsiasi coppia messaggio+firma+pubkey
  if (req.method === "POST" && p === "/api/firma/check") {
    const cors = { "Access-Control-Allow-Origin": "*" };
    if (limited(ip, "check", 60)) return send(res, 429, { ok: false, errore: "troppe richieste, riprova tra un minuto" }, cors);
    let body; try { body = await readJson(req); } catch (e) { return send(res, e.code || 400, { ok: false, errore: e.message }, cors); }
    const message = body.message, address = body.address || body.publicKey || body.pubkey;
    if (typeof message !== "string" || !message.length || Buffer.byteLength(message) > 4096) return send(res, 400, { ok: false, errore: "messaggio mancante o oltre 4 KB" }, cors);
    const pub = decodePubkey(address);
    if (!pub) return send(res, 400, { ok: false, errore: "indirizzo non valido (base58, 32 byte)" }, cors);
    const sig = decodeSig(body.signature);
    if (!sig) return send(res, 400, { ok: false, errore: "firma non valida nel formato (attesi 64 byte, base58, base64 o hex)" }, cors);
    const valid = verifyEd25519(message, sig, pub);
    const out = { ok: true, valid, address, prefisso: PREFIXES.find((x) => message.includes(x)) || null };
    const f = parseMessage(message);
    if (f) {
      const exp = Date.parse(f.expirationTime);
      out.formato = "Sign-In With Solana";
      out.dettagli = { domain: f.domain, address: f.address, dominioZdos: !!DOMAINS[f.domain], indirizzoCoerente: f.address === address, statement: f.statement, uri: f.uri, chainId: f.chainId, nonce: f.nonce, issuedAt: f.issuedAt, expirationTime: f.expirationTime, scaduto: Number.isFinite(exp) ? exp < nowMs() : null };
    } else out.formato = "testo libero";
    out.nota = "Verifica solo la firma crittografica: l'esito non dice se il messaggio era richiesto da ZDOS né se il nonce è stato emesso da noi.";
    return send(res, 200, out, cors);
  }

  // GET /api/firma/session — sessione corrente (cookie o Bearer)
  if (req.method === "GET" && p === "/api/firma/session") {
    const c = verifyJwt(tokenFrom(req), host);
    if (!c) return send(res, 200, { ok: true, autenticato: false });
    return send(res, 200, { ok: true, autenticato: true, address: c.sub, domain: c.aud, expiresAt: iso(c.exp * 1000) });
  }

  // POST /api/firma/logout
  if (req.method === "POST" && p === "/api/firma/logout") {
    if (!originOk(req, host)) return send(res, 403, { ok: false, errore: "origine non ammessa" });
    return send(res, 200, { ok: true }, { "Set-Cookie": "zdos_firma=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax" });
  }

  // GET /api/firma/badge?address=… — "wallet verificato", solo per chi ha scelto il badge pubblico
  if (req.method === "GET" && p === "/api/firma/badge") {
    if (limited(ip, "badge", 60)) return send(res, 429, { ok: false, errore: "troppe richieste" });
    const a = url.searchParams.get("address") || "";
    if (!decodePubkey(a)) return send(res, 400, { ok: false, errore: "indirizzo non valido" });
    const r = registry[a];
    if (!r || !r.pubblico) return send(res, 200, { ok: true, verificato: false });
    return send(res, 200, { ok: true, verificato: true, dal: r.first.slice(0, 10), ultimo: r.last.slice(0, 10) });
  }

  if (p === "/api/firma/health") return send(res, 200, { ok: true, servizio: "zdos-firma", versione: 1 });
  return send(res, 404, { ok: false, errore: "non trovato" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => { console.error("[firma] errore:", e.message); if (!res.headersSent) send(res, 500, { ok: false, errore: "errore interno" }); else res.end(); });
});
server.headersTimeout = 10_000; server.requestTimeout = 15_000;
server.listen(PORT, HOST, () => console.log(`[firma] in ascolto su ${HOST}:${PORT}`));
