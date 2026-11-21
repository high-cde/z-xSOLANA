// DSN-X · znft-api · Galleria e marketplace zNFT di OurVelvet (SOLO DEVNET). ZDOS1.3.
// Ascolta su 127.0.0.1. Certificati Metaplex Core, pagamenti in Velvet Pay (VPAY, Token-2022 devnet), regole in Zlang (ZLB2).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { makeChain } from "../chain/lib.mjs";
const require = createRequire(import.meta.url);

const E = process.env;
const CFG = {
  port: +(E.ZNFT_PORT || 4190), data: E.ZNFT_DATA || "/var/lib/znft", rpc: E.ZNFT_RPC || "https://api.devnet.solana.com",
  mainnetRead: E.ZNFT_MAINNET_READ_RPC || "https://solana-rpc.publicnode.com",
  keypair: E.ZNFT_KEYPAIR || "/etc/znft/devnet-keypair.json", vpay: E.ZNFT_VPAY_MINT, collection: E.ZNFT_COLLECTION,
  adminKey: E.ZNFT_ADMIN_KEY || "", base: E.ZNFT_PUBLIC_BASE || "https://velvet.x-zdos.it/znft",
  zlang: E.ZNFT_ZLANG_DIR || path.resolve(path.dirname(new URL(import.meta.url).pathname), "../zlang"),
  faucetAmount: 1000n * 1000000n, faucetDaily: +(E.ZNFT_FAUCET_DAILY || 30),
};
if (!CFG.vpay || !CFG.collection) { console.error("ZNFT_VPAY_MINT e ZNFT_COLLECTION obbligatori"); process.exit(2); }
const ZR = require(path.join(CFG.zlang, "zrules.js"));
const RULES = Object.fromEntries(["znft_regole", "znft_vendita", "znft_acquisto"].map(n => {
  const bc = fs.readFileSync(path.join(CFG.zlang, n + ".zlb")); const src = fs.readFileSync(path.join(CFG.zlang, n + ".zlang"), "utf8");
  return [n, { bc, src, sha: crypto.createHash("sha256").update(bc).digest("hex") }];
}));
const chain = makeChain({ rpc: CFG.rpc, keypairPath: CFG.keypair, vpayMint: CFG.vpay, collection: CFG.collection });
fs.mkdirSync(path.join(CFG.data, "previews"), { recursive: true });
const db = new DatabaseSync(path.join(CFG.data, "znft.db"));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS artists(wallet TEXT PRIMARY KEY, nick TEXT, bio TEXT, ovid TEXT, created TEXT);
CREATE TABLE IF NOT EXISTS collections(id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, artist TEXT, description TEXT, example INTEGER DEFAULT 0, created TEXT);
CREATE TABLE IF NOT EXISTS works(id INTEGER PRIMARY KEY, slug TEXT UNIQUE, collection_id INTEGER, artist TEXT, title TEXT, technique TEXT, year TEXT,
  description TEXT, sha256 TEXT, people INTEGER, origin_nft TEXT, origin_net TEXT, status TEXT, example INTEGER DEFAULT 0, preview TEXT, preview_type TEXT,
  artist_msg TEXT, artist_sig TEXT, royalty_bps INTEGER DEFAULT 500, asset TEXT, mint_sig TEXT, owner TEXT, rules_json TEXT, created TEXT, updated TEXT);
CREATE TABLE IF NOT EXISTS consents(id INTEGER PRIMARY KEY, work_id INTEGER, model TEXT, msg TEXT, sig TEXT, created TEXT, UNIQUE(work_id, model));
CREATE TABLE IF NOT EXISTS listings(id INTEGER PRIMARY KEY, work_id INTEGER, seller TEXT, price TEXT, status TEXT, buyer TEXT, pay_sig TEXT UNIQUE, transfer_sig TEXT, created TEXT, updated TEXT);
CREATE TABLE IF NOT EXISTS purchases(id TEXT PRIMARY KEY, listing_id INTEGER, buyer TEXT, memo TEXT, created TEXT, done INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY, work_id INTEGER, kind TEXT, from_w TEXT, to_w TEXT, sig TEXT, detail TEXT, at TEXT);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, work_id INTEGER, reason TEXT, detail TEXT, ip_hash TEXT, status TEXT, created TEXT);
CREATE TABLE IF NOT EXISTS nonces(nonce TEXT PRIMARY KEY, wallet TEXT, purpose TEXT, message TEXT, exp INTEGER);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, wallet TEXT, exp INTEGER);
CREATE TABLE IF NOT EXISTS faucet(wallet TEXT, day TEXT, sig TEXT, PRIMARY KEY(wallet, day));
CREATE TABLE IF NOT EXISTS upgrades(wallet TEXT, nft TEXT, net TEXT, kind TEXT, at INTEGER, PRIMARY KEY(wallet, nft));`);
const now = () => new Date().toISOString();
const q = (sql, ...a) => db.prepare(sql).all(...a);
const q1 = (sql, ...a) => db.prepare(sql).get(...a);
const run = (sql, ...a) => db.prepare(sql).run(...a);
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const REASONS = { minore: "possibile persona minorenne", consenso: "consenso mancante o revocato", furto: "opera non dell'autore", esplicito: "contenuto fuori dalle regole", altro: "altro" };
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").trim().slice(0, n);
const slugify = (s) => clean(s, 60).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "opera";
const vpayFmt = (base) => { const b = BigInt(base); const i = b / 1000000n, f = (b % 1000000n).toString().padStart(6, "0").replace(/0+$/, ""); return i.toLocaleString("it-IT") + (f ? "," + f : ""); };

// ---- rate limit in memoria
const buckets = new Map();
function limited(key, max, winMs) { const t = Date.now(); const b = buckets.get(key) || []; const r = b.filter(x => t - x < winMs); r.push(t); buckets.set(key, r); return r.length > max; }
setInterval(() => { const t = Date.now(); for (const [k, v] of buckets) if (!v.some(x => t - x < 3600e3)) buckets.delete(k); run("DELETE FROM nonces WHERE exp<?", t); run("DELETE FROM sessions WHERE exp<?", t); }, 600e3).unref();

// ---- http helpers
function send(res, code, obj, headers = {}) {
  const body = typeof obj === "string" || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers }); res.end(body);
}
class HttpErr extends Error { constructor(code, msg, extra) { super(msg); this.code = code; this.extra = extra; } }
const fail = (code, msg, extra) => { throw new HttpErr(code, msg, extra); };
function body(req, max = 65536) {
  return new Promise((ok, ko) => { let n = 0; const ch = [];
    req.on("data", c => { n += c.length; if (n > max) { ko(new HttpErr(413, "richiesta troppo grande")); req.destroy(); } else ch.push(c); });
    req.on("end", () => { try { ok(ch.length ? JSON.parse(Buffer.concat(ch).toString("utf8")) : {}); } catch { ko(new HttpErr(400, "JSON non valido")); } }); req.on("error", ko); });
}
function ipOf(req) { return String(req.headers["x-real-ip"] || req.socket.remoteAddress || ""); }
function auth(req) {
  const t = String(req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
  const s = t && q1("SELECT wallet, exp FROM sessions WHERE token=?", t);
  if (!s || s.exp < Date.now()) fail(401, "accesso richiesto: collega Phantom e firma il messaggio");
  return s.wallet;
}
function isAdmin(req) { const h = String(req.headers["x-znft-admin"] || ""); return CFG.adminKey.length >= 32 && h.length === CFG.adminKey.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(CFG.adminKey)); }
function newNonce(wallet, purpose, message) { const n = crypto.randomBytes(12).toString("hex"); run("INSERT INTO nonces VALUES(?,?,?,?,?)", n, wallet, purpose, message(n), Date.now() + 600e3); return q1("SELECT * FROM nonces WHERE nonce=?", n); }
function useNonce(nonce, wallet, purpose, sig) {
  const r = q1("SELECT * FROM nonces WHERE nonce=? AND wallet=? AND purpose=?", String(nonce), wallet, purpose);
  if (!r || r.exp < Date.now()) fail(400, "nonce scaduto o non valido: riprova");
  if (!chain.verifySignature(wallet, r.message, String(sig))) fail(400, "firma non valida");
  run("DELETE FROM nonces WHERE nonce=?", r.nonce); return r;
}
const short = (w) => w ? w.slice(0, 4) + "…" + w.slice(-4) : "";
const artistNick = (w) => q1("SELECT nick FROM artists WHERE wallet=?", w)?.nick || short(w);
const openReports = (id) => q1("SELECT COUNT(*) n FROM reports WHERE work_id=? AND status='aperta'", id).n;
const validConsents = (id) => q1("SELECT COUNT(*) n FROM consents WHERE work_id=?", id).n;
const exp = (kind, a) => `https://explorer.solana.com/${kind}/${a}?cluster=devnet`;

function rulesInput(w) {
  return { "znft/opera/hash_ok": HEX64.test(w.sha256 || "") ? 1 : 0, "znft/opera/persone_ritratte": w.people, "znft/opera/consensi_validi": validConsents(w.id),
    "znft/artista/maggiorenne_dichiarato": w.artist_sig ? 1 : 0, "znft/artista/diritti_dichiarati": w.artist_sig ? 1 : 0, "znft/opera/segnalazioni_aperte": openReports(w.id) };
}
const PUBLIC_STATUSES = ["certificata", "esempio"];
function workPublic(w, full = false) {
  const col = q1("SELECT slug, name FROM collections WHERE id=?", w.collection_id);
  const l = q1("SELECT id, price, seller FROM listings WHERE work_id=? AND status='attivo'", w.id);
  const o = { id: w.id, slug: w.slug, title: w.title, technique: w.technique, year: w.year, status: w.status, example: !!w.example,
    artist: w.artist, artist_nick: artistNick(w.artist), owner: w.owner, owner_nick: w.owner ? artistNick(w.owner) : null,
    collection: col, preview: w.preview && PUBLIC_STATUSES.includes(w.status) ? `/znft/api/preview/${w.id}` : null, preview_type: w.preview_type,
    sha256: w.sha256, asset: w.asset, listing: l ? { id: l.id, price: l.price, price_fmt: vpayFmt(l.price), seller: l.seller } : null };
  if (full) {
    Object.assign(o, { description: w.description, people: w.people, origin_nft: w.origin_nft, origin_net: w.origin_net, royalty_bps: w.royalty_bps,
      mint_sig: w.mint_sig, created: w.created,
      certificate: { autore: w.artist, autore_firma: w.artist_sig ? crypto.createHash("sha256").update(w.artist_sig).digest("hex") : null,
        consensi: q("SELECT model, created, sig FROM consents WHERE work_id=?", w.id).map(c => ({ model: short(c.model), firmato: c.created, firma_sha256: crypto.createHash("sha256").update(c.sig).digest("hex") })),
        persone_ritratte: w.people, eta: w.example ? "non applicabile (opera astratta di esempio)" : "autodichiarata con firma (KYC documentale non ancora integrato)",
        sha256: w.sha256, provenienza: w.origin_nft ? `upgrade di ${w.origin_nft} (${w.origin_net}), possesso verificato` : w.example ? "opera astratta di esempio generata dalla piattaforma" : "opera originale dichiarata dall'artista",
        regole: { programma: "znft_regole.zlang", bytecode_sha256: RULES.znft_regole.sha, esito: w.rules_json ? JSON.parse(w.rules_json).esito : null, input: rulesInput(w) } },
      history: q("SELECT kind, from_w, to_w, sig, detail, at FROM history WHERE work_id=? ORDER BY id", w.id),
      reports_open: openReports(w.id), explorer: w.asset ? exp("address", w.asset) : null });
  }
  return o;
}
function history(work, kind, from, to, sig, detail) { run("INSERT INTO history(work_id,kind,from_w,to_w,sig,detail,at) VALUES(?,?,?,?,?,?,?)", work, kind, from || null, to || null, sig || null, detail || null, now()); }
function ensureCollection(name, artist, example = 0) {
  const base = slugify(name); let slug = base, i = 1;
  const ex = q1("SELECT * FROM collections WHERE name=? AND artist=?", name, artist); if (ex) return ex;
  while (q1("SELECT 1 FROM collections WHERE slug=?", slug)) slug = `${base}-${++i}`;
  run("INSERT INTO collections(slug,name,artist,description,example,created) VALUES(?,?,?,?,?,?)", slug, name, artist, "", example, now());
  return q1("SELECT * FROM collections WHERE slug=?", slug);
}
function uniqueWorkSlug(t) { const base = slugify(t); let s = base, i = 1; while (q1("SELECT 1 FROM works WHERE slug=?", s)) s = `${base}-${++i}`; return s; }
// JPEG: rimuove i segmenti APP1..APP15 (EXIF, GPS, XMP). PNG/WebP passano invariati.
function stripJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf; const out = [buf.subarray(0, 2)]; let i = 2;
  while (i < buf.length - 4) { if (buf[i] !== 0xff) break; const m = buf[i + 1]; if (m === 0xda) { out.push(buf.subarray(i)); return Buffer.concat(out); }
    const len = buf.readUInt16BE(i + 2); if (!(m >= 0xe1 && m <= 0xef) && m !== 0xfe) out.push(buf.subarray(i, i + 2 + len)); i += 2 + len; }
  return Buffer.concat(out);
}
function savePreview(id, dataUrl) {
  const m = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || "")); if (!m) fail(400, "anteprima: solo PNG, JPEG o WebP");
  let buf = Buffer.from(m[3], "base64"); if (buf.length > 2 * 1024 * 1024) fail(413, "anteprima oltre 2 MB");
  const sig = buf.subarray(0, 12).toString("hex");
  const okMagic = (m[2] === "png" && sig.startsWith("89504e47")) || (m[2] === "jpeg" && sig.startsWith("ffd8")) || (m[2] === "webp" && buf.subarray(8, 12).toString() === "WEBP");
  if (!okMagic) fail(400, "anteprima: il file non corrisponde al formato dichiarato");
  if (m[2] === "jpeg") buf = stripJpeg(buf);
  const name = `${id}-${crypto.randomBytes(6).toString("hex")}.${m[2] === "jpeg" ? "jpg" : m[2]}`; fs.writeFileSync(path.join(CFG.data, "previews", name), buf);
  return { name, type: m[1] };
}

async function mintWork(w) {
  const attrs = [["rete", "devnet-TEST"], ["autore", w.artist], ["sha256", w.sha256], ["persone_ritratte", w.people], ["consensi_firmati", validConsents(w.id)],
    ["eta", w.example ? "n.a. opera astratta" : "autodichiarata-firmata"], ["provenienza", w.origin_nft ? `upgrade:${w.origin_net}:${w.origin_nft}` : "originale"],
    ["tecnica", w.technique || "-"], ["anno", w.year || "-"], ["regole_zlang_sha256", RULES.znft_regole.sha.slice(0, 32)], ["piattaforma", "OurVelvet zNFT · ZDOS1.3"]];
  const r = await chain.mintCertificate({ owner: w.owner || w.artist, name: w.title, uri: `${CFG.base}/api/meta/${w.id}.json`, attributes: attrs, royaltyBps: w.royalty_bps, creator: w.artist });
  run("UPDATE works SET asset=?, mint_sig=?, owner=?, updated=? WHERE id=?", r.asset, r.signature, w.owner || w.artist, now(), w.id);
  history(w.id, "mint", null, w.owner || w.artist, r.signature, "certificato Metaplex Core (devnet)");
  return r;
}

const routes = [];
const R = (m, re, fn) => routes.push([m, new RegExp("^" + re + "$"), fn]);

R("GET", "/api/health", async () => ({ ok: true, rete: "devnet", vpay: CFG.vpay, collection: CFG.collection }));
R("GET", "/api/stats", async () => ({
  opere_certificate: q1("SELECT COUNT(*) n FROM works WHERE status='certificata'").n, opere_esempio: q1("SELECT COUNT(*) n FROM works WHERE status='esempio'").n,
  artisti: q1("SELECT COUNT(DISTINCT artist) n FROM works WHERE status IN ('certificata') AND example=0").n,
  annunci_attivi: q1("SELECT COUNT(*) n FROM listings WHERE status='attivo'").n, vendite: q1("SELECT COUNT(*) n FROM listings WHERE status='venduto'").n,
  collezioni: q1("SELECT COUNT(*) n FROM collections").n, rete: "devnet" }));
R("GET", "/api/vpay", async () => ({ name: "Velvet Pay", symbol: "VPAY", rete: "devnet", mint: CFG.vpay, decimals: 6, program: "Token-2022",
  explorer: exp("address", CFG.vpay), collection: CFG.collection, collection_explorer: exp("address", CFG.collection), faucet_vpay: 1000, platform: chain.platform }));
R("GET", "/api/regole", async () => Object.fromEntries(Object.entries(RULES).map(([k, v]) => [k, { sorgente: v.src, bytecode_b64: v.bc.toString("base64"), sha256: v.sha, byte: v.bc.length }])));
R("GET", "/api/collections", async () => q("SELECT * FROM collections ORDER BY example, id DESC").map(c => ({ ...c,
  opere: q1(`SELECT COUNT(*) n FROM works WHERE collection_id=? AND status IN ('certificata','esempio')`, c.id).n, artist_nick: artistNick(c.artist),
  cover: (q1(`SELECT id FROM works WHERE collection_id=? AND status IN ('certificata','esempio') AND preview IS NOT NULL ORDER BY id LIMIT 1`, c.id) || {}).id || null }))
  .filter(c => c.opere > 0).map(c => ({ ...c, cover: c.cover ? `/znft/api/preview/${c.cover}` : null })));
R("GET", "/api/collections/([a-z0-9-]+)", async (req, m) => {
  const c = q1("SELECT * FROM collections WHERE slug=?", m[1]); if (!c) fail(404, "collezione non trovata");
  const works = q(`SELECT * FROM works WHERE collection_id=? AND status IN ('certificata','esempio') ORDER BY id`, c.id).map(w => workPublic(w));
  const prices = works.filter(w => w.listing).map(w => BigInt(w.listing.price));
  return { ...c, artist_nick: artistNick(c.artist), works, floor: prices.length ? vpayFmt(prices.reduce((a, b) => a < b ? a : b)) : null,
    owners: new Set(works.map(w => w.owner).filter(Boolean)).size };
});
R("GET", "/api/works", async (req, m, u) => {
  const sort = u.searchParams.get("ordine") || "recenti"; const onlyListed = u.searchParams.get("in_vendita") === "1"; const qq = clean(u.searchParams.get("q"), 60).toLowerCase();
  let ws = q(`SELECT * FROM works WHERE status IN ('certificata','esempio') ORDER BY id DESC`).map(w => workPublic(w));
  if (onlyListed) ws = ws.filter(w => w.listing);
  if (qq) ws = ws.filter(w => (w.title + " " + w.artist_nick + " " + (w.technique || "") + " " + (w.collection?.name || "")).toLowerCase().includes(qq));
  if (sort === "prezzo_su") ws.sort((a, b) => (a.listing ? Number(a.listing.price) : Infinity) - (b.listing ? Number(b.listing.price) : Infinity));
  if (sort === "prezzo_giu") ws.sort((a, b) => (b.listing ? Number(b.listing.price) : -1) - (a.listing ? Number(a.listing.price) : -1));
  return ws;
});
R("GET", "/api/works/([a-z0-9-]+)", async (req, m) => {
  const w = q1("SELECT * FROM works WHERE slug=?", m[1]); if (!w) fail(404, "opera non trovata");
  if (!PUBLIC_STATUSES.includes(w.status)) {
    const t = String(req.headers["authorization"] || "").replace(/^Bearer\s+/i, ""); const s = t && q1("SELECT wallet FROM sessions WHERE token=? AND exp>?", t, Date.now());
    if (!(s && s.wallet === w.artist) && !isAdmin(req)) fail(404, w.status === "sospesa" ? "opera sospesa per verifica dopo una segnalazione" : "opera non pubblica");
  }
  return workPublic(w, true);
});
R("GET", "/api/artists/([1-9A-HJ-NP-Za-km-z]{32,44})", async (req, m) => {
  const a = q1("SELECT wallet, nick, bio, created FROM artists WHERE wallet=?", m[1]) || { wallet: m[1], nick: null, bio: null };
  return { ...a, nick: a.nick || short(m[1]), creazioni: q(`SELECT * FROM works WHERE artist=? AND status IN ('certificata','esempio') ORDER BY id DESC`, m[1]).map(w => workPublic(w)),
    possedute: q(`SELECT * FROM works WHERE owner=? AND status IN ('certificata','esempio') ORDER BY id DESC`, m[1]).map(w => workPublic(w)) };
});
R("GET", "/api/preview/(\\d+)", async (req, m, u, res) => {
  const w = q1("SELECT * FROM works WHERE id=?", +m[1]); if (!w || !w.preview || !PUBLIC_STATUSES.includes(w.status)) fail(404, "anteprima non disponibile");
  const f = path.join(CFG.data, "previews", path.basename(w.preview)); if (!fs.existsSync(f)) fail(404, "anteprima non disponibile");
  res.writeHead(200, { "content-type": w.preview_type, "cache-control": "public, max-age=300", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
  res.end(fs.readFileSync(f)); return null;
});
R("GET", "/api/meta/collection\\.json", async () => ({ name: "zNFT Certificati TEST", symbol: "ZNFT", description: "Certificati di autenticità e proprietà di opere d'arte 18+ di OurVelvet. Rete DEVNET, solo test.", external_url: CFG.base + "/", image: CFG.base + "/assets/znft-cert.svg" }));
R("GET", "/api/meta/(\\d+)\\.json", async (req, m) => {
  const w = q1("SELECT * FROM works WHERE id=?", +m[1]); if (!w || !w.asset) fail(404, "metadata non trovato");
  return { name: w.title, symbol: "ZNFT", description: `Certificato zNFT (DEVNET, test). ${w.example ? "Opera astratta di esempio." : "L'opera originale è conservata dall'artista; on-chain c'è solo il suo hash SHA-256."}`,
    image: w.preview && PUBLIC_STATUSES.includes(w.status) ? `${CFG.base}/api/preview/${w.id}` : `${CFG.base}/assets/znft-cert.svg`, external_url: `${CFG.base}/#/opera/${w.slug}`,
    attributes: [{ trait_type: "sha256", value: w.sha256 }, { trait_type: "rete", value: "devnet" }, { trait_type: "persone_ritratte", value: w.people }],
    properties: { category: "image", creators: [{ address: w.artist, share: 100 }] } };
});

// ---- accesso SIWS
R("POST", "/api/auth/nonce", async (req) => {
  const b = await body(req); const w = String(b.wallet || ""); if (!B58.test(w)) fail(400, "wallet non valido");
  if (limited("nonce:" + ipOf(req), 30, 600e3)) fail(429, "troppe richieste, riprova tra poco");
  const n = newNonce(w, "login", (n) => `OurVelvet zNFT (DEVNET)\nAzione: accesso alla galleria\nWallet: ${w}\nNonce: ${n}\nEmesso: ${now()}\nNessuna transazione e nessun costo.`);
  return { nonce: n.nonce, message: n.message };
});
R("POST", "/api/auth/verify", async (req) => {
  const b = await body(req); const w = String(b.wallet || ""); useNonce(b.nonce, w, "login", b.signature);
  const token = crypto.randomBytes(24).toString("hex"); run("INSERT INTO sessions VALUES(?,?,?)", token, w, Date.now() + 12 * 3600e3);
  if (!q1("SELECT 1 FROM artists WHERE wallet=?", w)) run("INSERT INTO artists(wallet,created) VALUES(?,?)", w, now());
  return { token, wallet: w, scade_ore: 12 };
});
R("GET", "/api/me", async (req) => {
  const w = auth(req); const a = q1("SELECT * FROM artists WHERE wallet=?", w);
  return { wallet: w, nick: a?.nick || null, bio: a?.bio || null, vpay: vpayFmt(await chain.vpayBalance(w)), sol: (await chain.solBalance(w)) / 1e9,
    opere: q("SELECT * FROM works WHERE artist=? OR owner=? ORDER BY id DESC", w, w).map(x => ({ ...workPublic(x), consensi: validConsents(x.id), persone: x.people, rules: x.rules_json ? JSON.parse(x.rules_json) : null })),
    annunci: q("SELECT l.*, w.title, w.slug FROM listings l JOIN works w ON w.id=l.work_id WHERE l.seller=? ORDER BY l.id DESC", w).map(l => ({ ...l, price_fmt: vpayFmt(l.price) })) };
});
R("POST", "/api/me", async (req) => {
  const w = auth(req); const b = await body(req); run("UPDATE artists SET nick=?, bio=? WHERE wallet=?", clean(b.nick, 32) || null, clean(b.bio, 400) || null, w); return { ok: true };
});

// ---- creazione opera (bozza) con dichiarazione firmata dell'artista
R("POST", "/api/works/declaration", async (req) => {
  const w = auth(req); const b = await body(req); const sha = String(b.sha256 || "").toLowerCase(); if (!HEX64.test(sha)) fail(400, "hash SHA-256 non valido");
  const title = clean(b.title, 80); if (title.length < 2) fail(400, "titolo mancante");
  const n = newNonce(w, "declare:" + sha, (n) => `OurVelvet zNFT (DEVNET) · DICHIARAZIONE ARTISTA\nOpera: ${title}\nSHA-256: ${sha}\nIo, titolare del wallet ${w}, dichiaro di avere almeno 18 anni, di essere autore/autrice dell'opera e di detenerne i diritti, e che ogni persona ritratta è maggiorenne e darà il proprio consenso firmato.\nNonce: ${n}`);
  return { nonce: n.nonce, message: n.message };
});
R("POST", "/api/works", async (req) => {
  const w = auth(req); const b = await body(req, 3 * 1024 * 1024);
  if (limited("create:" + w, 10, 3600e3)) fail(429, "troppe opere in un'ora");
  const sha = String(b.sha256 || "").toLowerCase(); if (!HEX64.test(sha)) fail(400, "hash SHA-256 non valido");
  if (q1("SELECT 1 FROM works WHERE sha256=? AND status NOT IN ('rifiutata')", sha)) fail(409, "esiste già un certificato per questo file");
  const decl = useNonce(b.nonce, w, "declare:" + sha, b.signature);
  const people = Math.max(0, Math.min(10, parseInt(b.people, 10) || 0));
  let origin = null, onet = null;
  if (b.origin_nft) { const up = q1("SELECT * FROM upgrades WHERE wallet=? AND nft=? AND at>?", w, String(b.origin_nft), Date.now() - 3600e3); if (!up) fail(400, "verifica prima il possesso dell'NFT da aggiornare"); origin = up.nft; onet = up.net; }
  const col = ensureCollection(clean(b.collection, 60) || "Opere di " + (artistNick(w)), w);
  const title = clean(b.title, 80); const slug = uniqueWorkSlug(title);
  const r = run(`INSERT INTO works(slug,collection_id,artist,title,technique,year,description,sha256,people,origin_nft,origin_net,status,artist_msg,artist_sig,royalty_bps,owner,created,updated)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,'bozza',?,?,?,?,?,?)`, slug, col.id, w, title, clean(b.technique, 60), clean(b.year, 10), clean(b.description, 1200), sha, people, origin, onet,
    decl.message, String(b.signature), Math.max(0, Math.min(1000, parseInt(b.royalty_bps, 10) || 500)), w, now(), now());
  const id = Number(r.lastInsertRowid);
  if (b.preview) { const p = savePreview(id, b.preview); run("UPDATE works SET preview=?, preview_type=? WHERE id=?", p.name, p.type, id); }
  history(id, origin ? "upgrade" : "bozza", w, null, null, origin ? `da ${origin} (${onet})` : "bozza creata");
  return { id, slug, consent_link: `${CFG.base}/#/consenso/${id}`, persone: people };
});
R("GET", "/api/consent/(\\d+)", async (req, m) => {
  const w = q1("SELECT * FROM works WHERE id=?", +m[1]); if (!w || w.status !== "bozza") fail(404, "richiesta di consenso non attiva");
  return { id: w.id, title: w.title, sha256: w.sha256, artist: w.artist, artist_nick: artistNick(w.artist), persone: w.people, firmati: validConsents(w.id) };
});
R("POST", "/api/consent/(\\d+)/nonce", async (req, m) => {
  const me = auth(req); const w = q1("SELECT * FROM works WHERE id=?", +m[1]); if (!w || w.status !== "bozza") fail(404, "richiesta di consenso non attiva");
  if (me === w.artist && w.people > 0 && !(await body(req)).self) { /* l'artista può essere anche modello: lo dichiara esplicitamente */ }
  const n = newNonce(me, "consent:" + w.id, (n) => `OurVelvet zNFT (DEVNET) · CONSENSO MODELLO\nOpera: ${w.title}\nSHA-256: ${w.sha256}\nArtista: ${w.artist}\nIo, titolare del wallet ${me}, dichiaro di avere almeno 18 anni, di essere ritratto/a in questa opera e di acconsentire alla sua certificazione e vendita come zNFT. Posso revocare il consenso scrivendo allo staff OurVelvet.\nNonce: ${n}`);
  return { nonce: n.nonce, message: n.message };
});
R("POST", "/api/consent/(\\d+)", async (req, m) => {
  const me = auth(req); const b = await body(req); const w = q1("SELECT * FROM works WHERE id=?", +m[1]); if (!w || w.status !== "bozza") fail(404, "richiesta di consenso non attiva");
  const n = useNonce(b.nonce, me, "consent:" + w.id, b.signature);
  if (validConsents(w.id) >= w.people) fail(409, "consensi già completi");
  run("INSERT OR IGNORE INTO consents(work_id,model,msg,sig,created) VALUES(?,?,?,?,?)", w.id, me, n.message, String(b.signature), now());
  history(w.id, "consenso", me, null, null, "consenso firmato");
  return { ok: true, firmati: validConsents(w.id), persone: w.people };
});
R("POST", "/api/works/(\\d+)/submit", async (req, m) => {
  const me = auth(req); const w = q1("SELECT * FROM works WHERE id=?", +m[1]); if (!w || w.artist !== me) fail(404, "opera non trovata");
  if (w.status !== "bozza") fail(409, "l'opera non è in bozza");
  const r = ZR.run(RULES.znft_regole.bc, rulesInput(w)); const rj = JSON.stringify({ esito: r.esito, motivo: r.motivo, trace: r.trace, sha: RULES.znft_regole.sha, at: now() });
  run("UPDATE works SET rules_json=?, status=?, updated=? WHERE id=?", rj, r.ok ? "in_revisione" : "bozza", now(), w.id);
  if (r.ok) history(w.id, "revisione", me, null, null, "regole Zlang superate, in revisione dello staff");
  return { ok: r.ok, esito: r.esito, motivo: r.motivo, trace: r.trace };
});

// ---- upgrade di un NFT esistente: possesso verificato on-chain (sola lettura)
R("POST", "/api/upgrade", async (req) => {
  const me = auth(req); const b = await body(req); const nft = String(b.nft || ""); const net = b.rete === "mainnet" ? "mainnet" : "devnet";
  if (!B58.test(nft)) fail(400, "indirizzo NFT non valido"); if (limited("up:" + me, 20, 3600e3)) fail(429, "troppe verifiche");
  const r = await chain.checkOwnership(net === "mainnet" ? CFG.mainnetRead : CFG.rpc, nft, me);
  if (r.ok) run("INSERT OR REPLACE INTO upgrades VALUES(?,?,?,?,?)", me, nft, net, r.kind, Date.now());
  return { ...r, rete: net };
});

// ---- marketplace in VPAY
R("POST", "/api/listings", async (req) => {
  const me = auth(req); const b = await body(req); const w = q1("SELECT * FROM works WHERE id=?", +b.work_id); if (!w || !w.asset) fail(404, "opera non certificata");
  const priceInt = parseInt(b.price, 10);
  if (q1("SELECT 1 FROM listings WHERE work_id=? AND status IN ('attivo','pagato')", w.id)) fail(409, "opera già in vendita");
  const info = await chain.assetInfo(w.asset);
  const input = { "znft/vendita/opera_certificata": PUBLIC_STATUSES.includes(w.status) ? 1 : 0, "znft/vendita/proprietario_onchain": info.owner === me ? 1 : 0,
    "znft/vendita/prezzo_vpay": Number.isFinite(priceInt) ? priceInt : 0, "znft/vendita/segnalazioni_aperte": openReports(w.id) };
  const r = ZR.run(RULES.znft_vendita.bc, input); if (!r.ok) fail(400, r.motivo, { regole: r });
  if (info.delegate !== chain.platform) { const tx = await chain.buildApproveDelegateTx(w.asset, me); return { need_approve: true, ...tx, spiegazione: "Firma in Phantom per autorizzare la piattaforma a consegnare l'opera all'acquirente dopo il pagamento. Puoi revocarla annullando l'annuncio." }; }
  if (w.owner !== me) run("UPDATE works SET owner=? WHERE id=?", me, w.id);
  const id = Number(run("INSERT INTO listings(work_id,seller,price,status,created,updated) VALUES(?,?,?,'attivo',?,?)", w.id, me, (BigInt(priceInt) * 1000000n).toString(), now(), now()).lastInsertRowid);
  history(w.id, "annuncio", me, null, null, `in vendita a ${priceInt} VPAY`);
  return { ok: true, listing: id, regole: r.esito };
});
R("POST", "/api/listings/(\\d+)/cancel", async (req, m) => {
  const me = auth(req); const l = q1("SELECT * FROM listings WHERE id=?", +m[1]); if (!l || l.seller !== me || l.status !== "attivo") fail(404, "annuncio non attivo");
  run("UPDATE listings SET status='annullato', updated=? WHERE id=?", now(), l.id); history(l.work_id, "annullato", me, null, null, "annuncio ritirato"); return { ok: true };
});
R("POST", "/api/buy/(\\d+)", async (req, m) => {
  const me = auth(req); const l = q1("SELECT * FROM listings WHERE id=?", +m[1]); if (!l || l.status !== "attivo") fail(404, "annuncio non attivo");
  if (l.seller === me) fail(400, "non puoi comprare la tua opera");
  const w = q1("SELECT * FROM works WHERE id=?", l.work_id); if (openReports(w.id)) fail(409, "opera in verifica");
  const info = await chain.assetInfo(w.asset); if (info.owner !== l.seller || info.delegate !== chain.platform) { run("UPDATE listings SET status='annullato', updated=? WHERE id=?", now(), l.id); fail(409, "il venditore non possiede più l'opera: annuncio ritirato"); }
  const bal = BigInt(await chain.vpayBalance(me)); if (bal < BigInt(l.price)) fail(400, `saldo VPAY insufficiente (${vpayFmt(bal)} su ${vpayFmt(l.price)}). Usa il faucet di test.`);
  const pid = crypto.randomBytes(8).toString("hex"); const memo = `zNFT annuncio ${l.id} ${pid}`;
  run("INSERT INTO purchases VALUES(?,?,?,?,?,0)", pid, l.id, me, memo, now());
  const tx = await chain.buildPaymentTx({ buyer: me, seller: l.seller, amountBase: l.price, memo });
  return { purchase: pid, memo, prezzo: vpayFmt(l.price), ...tx };
});
R("POST", "/api/buy/(\\d+)/confirm", async (req, m) => {
  const me = auth(req); const b = await body(req); const p = q1("SELECT * FROM purchases WHERE id=? AND buyer=? AND listing_id=?", String(b.purchase), me, +m[1]);
  if (!p || p.done) fail(404, "acquisto non trovato"); const sig = String(b.signature || ""); if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) fail(400, "firma transazione non valida");
  const l = q1("SELECT * FROM listings WHERE id=?", p.listing_id);
  if (q1("SELECT 1 FROM listings WHERE pay_sig=?", sig)) fail(409, "pagamento già usato");
  const v = await chain.verifyPayment({ signature: sig, buyer: me, seller: l.seller, amountBase: l.price, memo: p.memo });
  const r = ZR.run(RULES.znft_acquisto.bc, { "znft/acquisto/tx_confermata": v.tx_confermata, "znft/acquisto/acquirente_firmatario": v.acquirente_firmatario,
    "znft/acquisto/importo_ok": v.importo_ok, "znft/acquisto/memo_ok": v.memo_ok, "znft/acquisto/annuncio_attivo": l.status === "attivo" ? 1 : 0 });
  if (!r.ok) fail(400, r.motivo, { regole: r, pagamento: v });
  run("UPDATE listings SET status='pagato', buyer=?, pay_sig=?, updated=? WHERE id=? AND status='attivo'", me, sig, now(), l.id); run("UPDATE purchases SET done=1 WHERE id=?", p.id);
  const w = q1("SELECT * FROM works WHERE id=?", l.work_id);
  try {
    const ts = await chain.transferAsDelegate(w.asset, me);
    run("UPDATE listings SET status='venduto', transfer_sig=?, updated=? WHERE id=?", ts, now(), l.id); run("UPDATE works SET owner=?, updated=? WHERE id=?", me, now(), w.id);
    history(w.id, "vendita", l.seller, me, ts, `pagamento ${vpayFmt(l.price)} VPAY · tx ${sig}`);
    return { ok: true, pagamento: sig, trasferimento: ts, explorer: exp("tx", ts) };
  } catch (e) {
    run("UPDATE listings SET status='trasferimento_in_attesa', updated=? WHERE id=?", now(), l.id); history(w.id, "pagato", l.seller, me, sig, "pagamento ricevuto, consegna in attesa dello staff");
    return { ok: false, pagamento: sig, errore: "pagamento ricevuto ma consegna non riuscita: lo staff completa a mano", dettaglio: String(e.message).slice(0, 200) };
  }
});
R("POST", "/api/faucet", async (req) => {
  const me = auth(req); const day = now().slice(0, 10);
  if (q1("SELECT 1 FROM faucet WHERE wallet=? AND day=?", me, day)) fail(429, "faucet già usato oggi da questo wallet");
  if (q1("SELECT COUNT(*) n FROM faucet WHERE day=?", day).n >= CFG.faucetDaily) fail(429, "faucet esaurito per oggi");
  if (limited("faucet:" + ipOf(req), 3, 86400e3)) fail(429, "faucet: limite per rete raggiunto");
  run("INSERT INTO faucet VALUES(?,?,?)", me, day, "in_corso");
  try { const sig = await chain.faucet(me, CFG.faucetAmount); run("UPDATE faucet SET sig=? WHERE wallet=? AND day=?", sig, me, day); return { ok: true, vpay: 1000, signature: sig, explorer: exp("tx", sig) }; }
  catch (e) { run("DELETE FROM faucet WHERE wallet=? AND day=?", me, day); fail(502, "invio non riuscito, riprova: " + String(e.message).slice(0, 120)); }
});

// ---- segnalazioni
R("POST", "/api/reports", async (req) => {
  const b = await body(req); const w = q1("SELECT * FROM works WHERE id=?", +b.work_id); if (!w) fail(404, "opera non trovata");
  const reason = Object.hasOwn(REASONS, b.reason) ? b.reason : "altro"; const ip = crypto.createHash("sha256").update(ipOf(req) + "znft").digest("hex").slice(0, 16);
  if (limited("rep:" + ip, 5, 3600e3)) fail(429, "troppe segnalazioni, riprova più tardi");
  if (q1("SELECT 1 FROM reports WHERE work_id=? AND ip_hash=? AND status='aperta'", w.id, ip)) return { ok: true, gia_segnalata: true };
  run("INSERT INTO reports(work_id,reason,detail,ip_hash,status,created) VALUES(?,?,?,?, 'aperta', ?)", w.id, reason, clean(b.detail, 600), ip, now());
  const severe = reason === "minore" || reason === "consenso"; let sospesa = false;
  if ((severe || openReports(w.id) >= 3) && w.status === "certificata") { run("UPDATE works SET status='sospesa', updated=? WHERE id=?", now(), w.id); run("UPDATE listings SET status='sospeso' WHERE work_id=? AND status='attivo'", w.id); sospesa = true; }
  return { ok: true, sospesa, messaggio: sospesa ? "Opera sospesa subito in attesa della verifica dello staff." : "Segnalazione ricevuta: la verifica lo staff." };
});

// ---- staff (nginx: password staff + header segreto)
R("GET", "/api/admin/queue", async (req) => { if (!isAdmin(req)) fail(403, "solo staff");
  return { revisione: q("SELECT * FROM works WHERE status='in_revisione' ORDER BY id").map(w => ({ ...workPublic(w, true), preview_admin: w.preview ? `/znft/api/admin/preview/${w.id}` : null })),
    segnalazioni: q("SELECT r.*, w.title, w.slug, w.status AS work_status FROM reports r JOIN works w ON w.id=r.work_id WHERE r.status='aperta' ORDER BY r.id"),
    consegne: q("SELECT * FROM listings WHERE status='trasferimento_in_attesa'"), saldo_sol: (await chain.solBalance(chain.platform)) / 1e9, vpay_tesoreria: vpayFmt(await chain.vpayBalance(chain.platform)) }; });
R("GET", "/api/admin/preview/(\\d+)", async (req, m, u, res) => { if (!isAdmin(req)) fail(403, "solo staff");
  const w = q1("SELECT * FROM works WHERE id=?", +m[1]); if (!w?.preview) fail(404, "nessuna anteprima");
  res.writeHead(200, { "content-type": w.preview_type, "cache-control": "no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" }); res.end(fs.readFileSync(path.join(CFG.data, "previews", path.basename(w.preview)))); return null; });
R("POST", "/api/admin/works/(\\d+)/(approva|rifiuta)", async (req, m) => { if (!isAdmin(req)) fail(403, "solo staff");
  const w = q1("SELECT * FROM works WHERE id=?", +m[1]); if (!w || w.status !== "in_revisione") fail(409, "opera non in revisione"); const staff = clean(req.headers["x-staff-user"], 40) || "staff";
  if (m[2] === "rifiuta") { const b = await body(req); run("UPDATE works SET status='rifiutata', updated=? WHERE id=?", now(), w.id); history(w.id, "rifiutata", null, null, null, `da ${staff}: ${clean(b.motivo, 200)}`); return { ok: true }; }
  const r = ZR.run(RULES.znft_regole.bc, rulesInput(w)); if (!r.ok) fail(400, "regole non superate: " + r.motivo);
  const mres = await mintWork(w); run("UPDATE works SET status='certificata', updated=? WHERE id=?", now(), w.id); history(w.id, "certificata", null, null, null, `approvata da ${staff}`);
  return { ok: true, ...mres, explorer: exp("address", mres.asset) }; });
R("POST", "/api/admin/reports/(\\d+)/(archivia|rimuovi)", async (req, m) => { if (!isAdmin(req)) fail(403, "solo staff");
  const rp = q1("SELECT * FROM reports WHERE id=?", +m[1]); if (!rp) fail(404, "segnalazione non trovata");
  if (m[2] === "archivia") { run("UPDATE reports SET status='archiviata' WHERE id=?", rp.id);
    const w = q1("SELECT * FROM works WHERE id=?", rp.work_id); if (w.status === "sospesa" && !openReports(w.id)) { run("UPDATE works SET status='certificata' WHERE id=?", w.id); run("UPDATE listings SET status='attivo' WHERE work_id=? AND status='sospeso'", w.id); } }
  else { run("UPDATE reports SET status='accolta' WHERE work_id=? AND status='aperta'", rp.work_id); run("UPDATE works SET status='rimossa', updated=? WHERE id=?", now(), rp.work_id); run("UPDATE listings SET status='annullato' WHERE work_id=? AND status IN ('attivo','sospeso')", rp.work_id); history(rp.work_id, "rimossa", null, null, null, "rimossa dopo segnalazione"); }
  return { ok: true }; });
R("POST", "/api/admin/listings/(\\d+)/consegna", async (req, m) => { if (!isAdmin(req)) fail(403, "solo staff");
  const l = q1("SELECT * FROM listings WHERE id=? AND status='trasferimento_in_attesa'", +m[1]); if (!l) fail(404, "nessuna consegna in attesa");
  const w = q1("SELECT * FROM works WHERE id=?", l.work_id); const ts = await chain.transferAsDelegate(w.asset, l.buyer);
  run("UPDATE listings SET status='venduto', transfer_sig=? WHERE id=?", ts, l.id); run("UPDATE works SET owner=? WHERE id=?", l.buyer, w.id); history(w.id, "vendita", l.seller, l.buyer, ts, "consegna completata dallo staff"); return { ok: true, ts }; });

export const internals = { db, q1, run, mintWork, ensureCollection, uniqueWorkSlug, history, CFG, chain, RULES, ZR, rulesInput };

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"); let p = u.pathname.replace(/^\/znft/, "");
  for (const [mth, re, fn] of routes) {
    if (mth !== req.method) continue; const m = p.match(re); if (!m) continue;
    try { const out = await fn(req, m, u, res); if (out !== null) send(res, 200, out); }
    catch (e) { if (e instanceof HttpErr) send(res, e.code, { error: e.message, ...(e.extra || {}) }); else { console.error(now(), p, e); send(res, 500, { error: "errore interno" }); } }
    return;
  }
  send(res, 404, { error: "non trovato" });
});
if (!process.env.ZNFT_NO_LISTEN) server.listen(CFG.port, "127.0.0.1", () => console.log(`znft-api devnet su 127.0.0.1:${CFG.port} · VPAY ${CFG.vpay} · collezione ${CFG.collection}`));
