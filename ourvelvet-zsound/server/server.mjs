// OurVelvet Social · backend reale della sezione Creator (/creator-radar/). © 2026 ZDOS1.3 · Licenza ZSEL proprietaria.
// Identità: SOLO la sessione della firma OurVelvet (cookie zdos_firma / Bearer), validata su zdos-firma /api/firma/session.
// Dati: SQLite locale. Immagini: ricodificate in WebP (EXIF e metadati rimossi), pubbliche solo dopo l'approvazione dello staff.
// IP: mai salvati; solo hash HMAC in memoria per il rate limit. Nessun contenuto generato da noi.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import sharp from "sharp";
import { check as textCheck } from "./filter.mjs";
import { publish as zbusPublish } from "/opt/zdos-filiera/zbus.mjs";
import { createPool } from "./pool.mjs"; // Pool Party inverso (sola lettura)
import { createZsoundAi } from "./zsound-ai.mjs"; // Z-Sound: adattatore AI (spento finché doc non approva fornitore e chiave)

const E = process.env;
const PORT = +(E.PORT || 8910), HOST = "127.0.0.1";
const DATA = E.SOCIAL_DATA || "/var/lib/zdos-social";
const MEDIA = path.join(DATA, "media");
const FIRMA = E.FIRMA_URL || "http://127.0.0.1:8905";
const ZCOMM = E.ZCOMM_URL || "http://127.0.0.1:4192";
const SITE = E.SOCIAL_SITE || "ourvelvet.online";
const ADMIN_KEY = fs.readFileSync(E.SOCIAL_ADMIN_KEY_FILE || "/etc/zdos-social/admin.key", "utf8").trim();
const IP_SALT = crypto.randomBytes(32); // cambia a ogni riavvio: gli hash IP non sono collegabili nel tempo
const TERMS_V = "2026-11-28";
const CATS = ["Cartoon", "Anime-style", "Cyber", "Gotico", "Fantasy", "Burlesque", "Roleplay", "Narrativa", "Musica", "Arte", "AI"];
const RESERVED = new Set(["admin", "staff", "ourvelvet", "zdos", "velvet", "rosso", "moderatore", "moderazione", "support", "supporto", "api", "root", "system", "creator", "official", "ufficiale"]);
const MAX_IMG = 5 * 1024 * 1024;
// Z-Sound: audio dei creator (mix e tracce registrati nel browser o caricati dal creator)
const MAX_AUDIO = 25 * 1024 * 1024, MAX_AUDIO_SEC = 1800, AUDIO_QUOTA = 200 * 1024 * 1024;
const AUDIO_MIME = { wav: "audio/wav", webm: "audio/webm", ogg: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4" };
fs.mkdirSync(MEDIA, { recursive: true, mode: 0o700 });

// ---------- database ----------
const db = new Database(path.join(DATA, "social.db"));
db.pragma("journal_mode = WAL"); db.pragma("busy_timeout = 5000"); db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS profiles(wallet TEXT PRIMARY KEY, handle TEXT NOT NULL UNIQUE, bio TEXT NOT NULL DEFAULT '', cats TEXT NOT NULL DEFAULT '[]',
  avatar TEXT, avatar_pending TEXT, status TEXT NOT NULL DEFAULT 'attivo', adult_at INTEGER NOT NULL, terms_at INTEGER NOT NULL, terms_v TEXT NOT NULL,
  consent_at INTEGER NOT NULL, ovid TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY, wallet TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'in_revisione', w INTEGER, h INTEGER,
  bytes INTEGER, created INTEGER NOT NULL, reviewed_at INTEGER, reviewer TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY, wallet TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', media TEXT, status TEXT NOT NULL, created INTEGER NOT NULL, published INTEGER);
CREATE INDEX IF NOT EXISTS posts_feed ON posts(status, created);
CREATE INDEX IF NOT EXISTS posts_wallet ON posts(wallet, created);
CREATE TABLE IF NOT EXISTS likes(post TEXT NOT NULL, wallet TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(post, wallet));
CREATE TABLE IF NOT EXISTS follows(follower TEXT NOT NULL, followee TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(follower, followee));
CREATE TABLE IF NOT EXISTS blocks(blocker TEXT NOT NULL, blocked TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(blocker, blocked));
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY AUTOINCREMENT, reporter TEXT NOT NULL, kind TEXT NOT NULL, target TEXT NOT NULL, reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aperta', created INTEGER NOT NULL, resolved_at INTEGER, action TEXT, UNIQUE(reporter, kind, target));
CREATE TABLE IF NOT EXISTS modlog(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, staff TEXT, action TEXT NOT NULL, target TEXT NOT NULL);
`);
for (const [t, c, d] of [["media", "mime", "TEXT"], ["media", "title", "TEXT"], ["media", "dur", "REAL"], ["posts", "audio", "TEXT"]]) {
  if (!db.prepare(`PRAGMA table_info(${t})`).all().some((x) => x.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${d}`);
}
const now = () => Math.floor(Date.now() / 1000);
const rid = (n = 9) => crypto.randomBytes(n).toString("base64url");

// ---------- utilità HTTP ----------
const SEC = { "x-content-type-options": "nosniff", "referrer-policy": "same-origin", "x-frame-options": "DENY" };
function send(res, code, obj, extra = {}) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...SEC, ...extra }); res.end(b);
}
const fail = (res, code, msg) => send(res, code, { ok: false, errore: msg });
function readBody(req, max) {
  return new Promise((ok, ko) => {
    const chunks = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > max) { ko(Object.assign(new Error("troppo grande"), { code: 413 })); req.destroy(); return; } chunks.push(c); });
    req.on("end", () => ok(Buffer.concat(chunks))); req.on("error", ko);
  });
}
async function readJson(req, max = 16384) { const b = await readBody(req, max); try { return JSON.parse(b.toString("utf8") || "{}"); } catch { throw Object.assign(new Error("JSON non valido"), { code: 400 }); } }
const ipHash = (req) => crypto.createHmac("sha256", IP_SALT).update(String(req.headers["x-real-ip"] || req.socket.remoteAddress || "?")).digest("hex").slice(0, 24);

// ---------- rate limit (in memoria) ----------
const buckets = new Map();
function limited(key, max, winS) {
  const k = key + ":" + Math.floor(Date.now() / 1000 / winS); const c = (buckets.get(k) || 0) + 1; buckets.set(k, c);
  if (buckets.size > 20000) buckets.clear(); return c > max;
}

// ---------- sessione firma ----------
const sessCache = new Map();
async function session(req) {
  const tok = (String(req.headers.authorization || "").startsWith("Bearer ") ? String(req.headers.authorization).slice(7) : "") ||
    (String(req.headers.cookie || "").match(/(?:^|;\s*)zdos_firma=([^;]+)/) || [])[1] || "";
  if (!tok || tok.length > 4096) return null;
  const k = crypto.createHash("sha256").update(tok).digest("hex"); const c = sessCache.get(k);
  if (c && c.until > Date.now()) return c.s;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(FIRMA + "/api/firma/session", { headers: { Authorization: "Bearer " + tok, "X-Forwarded-Host": SITE }, signal: ctl.signal });
    clearTimeout(t); const j = await r.json();
    const s = j && j.ok && j.autenticato === true && j.domain === SITE && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(j.address) ? { address: j.address, expiresAt: j.expiresAt } : null;
    sessCache.set(k, { s, until: Date.now() + (s ? 30000 : 5000) }); if (sessCache.size > 5000) sessCache.clear();
    return s;
  } catch { return null; }
}

// ---------- badge "wallet verificato" (opt-in, via zdos-firma) ----------
const badgeCache = new Map();
async function badge(addr) {
  const c = badgeCache.get(addr); if (c && c.until > Date.now()) return c.v;
  let v = false;
  try { const r = await fetch(FIRMA + "/api/firma/badge?address=" + encodeURIComponent(addr), { headers: { "X-Forwarded-Host": SITE, "X-Real-IP": "127.0.0.2" } }); const j = await r.json(); v = !!(j && j.verificato); } catch {}
  badgeCache.set(addr, { v, until: Date.now() + 10 * 60000 }); return v;
}

const pool = createPool({ db, badge, session });

// ---------- merito (zcomm): solo se il profilo merito OV-XXXX esiste già ----------
async function ovidOf(wallet) {
  try { const r = await fetch(ZCOMM + "/zcomm/api/ovid-by-wallet?wallet=" + encodeURIComponent(wallet)); const j = await r.json(); return j && j.ok && /^OV-[A-Z0-9]{4}-VELVET$/.test(j.ovid || "") ? j.ovid : null; } catch { return null; }
}
async function merit(wallet, key, type, data) {
  try {
    const ov = await ovidOf(wallet); if (!ov) return { emesso: false, motivo: "nessun profilo merito collegato al wallet" };
    db.prepare("UPDATE profiles SET ovid=? WHERE wallet=?").run(ov, wallet);
    const r = await zbusPublish({ key, type, source: "creator", actor: ov, data });
    return { emesso: !!(r && r.ok), inserito: !!(r && r.inserted) };
  } catch (e) { console.error("[social] zcomm:", e.message); return { emesso: false, motivo: "zcomm non raggiungibile" }; }
}

// ---------- immagini ----------
async function storeImage(buf, wallet, kind) {
  if (!buf.length) throw Object.assign(new Error("immagine vuota"), { code: 400 });
  const sig = buf.subarray(0, 12);
  const isJpg = sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff;
  const isPng = sig.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = sig.subarray(0, 4).toString("latin1") === "RIFF" && sig.subarray(8, 12).toString("latin1") === "WEBP";
  if (!isJpg && !isPng && !isWebp) throw Object.assign(new Error("formato non ammesso: solo JPG, PNG o WebP"), { code: 415 });
  let img = sharp(buf, { limitInputPixels: 40_000_000, failOn: "error", animated: false }).rotate(); // rotate applica l'orientamento EXIF, poi i metadati non vengono copiati
  img = kind === "avatar" ? img.resize(512, 512, { fit: "cover", position: "attention" }) : img.resize(1280, 1280, { fit: "inside", withoutEnlargement: true });
  const { data, info } = await img.webp({ quality: 82, effort: 4 }).toBuffer({ resolveWithObject: true });
  const id = rid(12);
  fs.writeFileSync(path.join(MEDIA, id + ".webp"), data, { mode: 0o600 });
  db.prepare("INSERT INTO media(id,wallet,kind,status,w,h,bytes,created) VALUES(?,?,?,?,?,?,?,?)").run(id, wallet, kind, "in_revisione", info.width, info.height, data.length, now());
  return { id, w: info.width, h: info.height, bytes: data.length };
}
function deleteMediaFile(id) { for (const e of ["webp", ...Object.keys(AUDIO_MIME)]) { try { fs.unlinkSync(path.join(MEDIA, id + "." + e)); } catch {} } }
function mediaPath(m) { return path.join(MEDIA, m.id + "." + (m.kind === "audio" ? Object.keys(AUDIO_MIME).find((e) => AUDIO_MIME[e] === m.mime) || "wav" : "webp")); }
// invia un file media (immagine o audio) con supporto Range per l'audio
function serveMedia(req, res, m, priv) {
  let buf; try { buf = fs.readFileSync(mediaPath(m)); } catch { return fail(res, 404, "non trovata"); }
  const cc = priv ? "private, no-store" : "public, max-age=86400";
  if (m.kind !== "audio") { res.writeHead(200, { "content-type": "image/webp", "content-length": buf.length, "cache-control": cc, ...SEC, "content-security-policy": "default-src 'none'" }); return res.end(buf); }
  const base = { "content-type": m.mime || "audio/wav", "accept-ranges": "bytes", "cache-control": cc, ...SEC, "content-security-policy": "default-src 'none'" };
  const rg = String(req.headers.range || "").match(/^bytes=(\d*)-(\d*)$/);
  if (rg && (rg[1] || rg[2])) {
    let a = rg[1] ? +rg[1] : Math.max(0, buf.length - +rg[2]), b = rg[1] && rg[2] ? Math.min(+rg[2], buf.length - 1) : buf.length - 1;
    if (a > b || a >= buf.length) { res.writeHead(416, { "content-range": "bytes */" + buf.length, ...SEC }); return res.end(); }
    res.writeHead(206, { ...base, "content-range": `bytes ${a}-${b}/${buf.length}`, "content-length": b - a + 1 }); return res.end(buf.subarray(a, b + 1));
  }
  res.writeHead(200, { ...base, "content-length": buf.length }); return res.end(buf);
}
// riconoscimento del formato dai primi byte (non ci si fida dell'estensione)
function sniffAudio(b) {
  if (b.length < 16) return null;
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WAVE") {
    const br = b.length > 32 ? b.readUInt32LE(28) : 0; return { ext: "wav", dur: br > 0 ? (b.length - 44) / br : null };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: "webm", dur: null };
  if (b.subarray(0, 4).toString("latin1") === "OggS") return { ext: "ogg", dur: null };
  if (b.subarray(0, 3).toString("latin1") === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { ext: "mp3", dur: null };
  if (b.subarray(4, 8).toString("latin1") === "ftyp" && ["M4A ", "mp42", "isom", "iso2", "dash", "M4B "].includes(b.subarray(8, 12).toString("latin1"))) return { ext: "m4a", dur: null };
  return null;
}
const AI = createZsoundAi({ db, now });
const trackUsed = (id) => !!db.prepare("SELECT 1 FROM posts WHERE media=? OR audio=?").get(id, id);

// ---------- viste pubbliche ----------
const P = (w) => db.prepare("SELECT * FROM profiles WHERE wallet=?").get(w);
const PH = (h) => db.prepare("SELECT * FROM profiles WHERE handle=?").get(String(h || "").toLowerCase());
function blockedBetween(a, b) { if (!a || !b) return false; return !!db.prepare("SELECT 1 FROM blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)").get(a, b, b, a); }
function hiddenFor(viewer) { return viewer ? db.prepare("SELECT blocked w FROM blocks WHERE blocker=? UNION SELECT blocker FROM blocks WHERE blocked=?").all(viewer, viewer).map((r) => r.w) : []; }
async function pubProfile(p, viewer) {
  const v = await badge(p.wallet);
  const o = {
    handle: p.handle, bio: p.bio, cats: JSON.parse(p.cats || "[]"), avatar: p.avatar ? "/api/social/media/" + p.avatar : null,
    verificato: v, wallet: v ? p.wallet : null, // l'indirizzo compare solo se il creator ha scelto il badge pubblico
    follower: db.prepare("SELECT COUNT(*) n FROM follows WHERE followee=?").get(p.wallet).n,
    seguiti: db.prepare("SELECT COUNT(*) n FROM follows WHERE follower=?").get(p.wallet).n,
    post: db.prepare("SELECT COUNT(*) n FROM posts WHERE wallet=? AND status='pubblico'").get(p.wallet).n,
    dal: new Date(p.created * 1000).toISOString().slice(0, 10), merito: !!p.ovid,
  };
  if (viewer) { o.segui = !!db.prepare("SELECT 1 FROM follows WHERE follower=? AND followee=?").get(viewer, p.wallet); o.bloccato = !!db.prepare("SELECT 1 FROM blocks WHERE blocker=? AND blocked=?").get(viewer, p.wallet); o.mio = viewer === p.wallet; }
  return o;
}
async function pubPost(r, viewer, own = false) {
  const a = P(r.wallet); if (!a) return null;
  const o = { id: r.id, text: r.text, media: r.media && (r.status === "pubblico" || own) ? "/api/social/media/" + r.media : null, creato: r.created,
    like: db.prepare("SELECT COUNT(*) n FROM likes WHERE post=?").get(r.id).n,
    autore: { handle: a.handle, avatar: a.avatar ? "/api/social/media/" + a.avatar : null, verificato: await badge(a.wallet) } };
  if (r.audio && (r.status === "pubblico" || own)) {
    const am = db.prepare("SELECT * FROM media WHERE id=?").get(r.audio);
    if (am) o.audio = { url: "/api/social/media/" + am.id, titolo: am.title || "Senza titolo", durata: am.dur, tipo: am.mime };
  }
  if (viewer) { o.piace = !!db.prepare("SELECT 1 FROM likes WHERE post=? AND wallet=?").get(r.id, viewer); o.mio = viewer === r.wallet; }
  if (own) o.stato = r.status;
  return o;
}

// ---------- validazione profilo ----------
function validProfile(b) {
  const handle = String(b.handle || "").trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_]{3,24}$/.test(handle)) return { err: "Handle: 3–24 caratteri tra lettere, numeri e _." };
  if (RESERVED.has(handle)) return { err: "Questo handle è riservato." };
  const bio = String(b.bio || "").trim().slice(0, 280);
  const cats = Array.isArray(b.cats) ? [...new Set(b.cats.map(String))].filter((c) => CATS.includes(c)).slice(0, 4) : [];
  const t = textCheck(handle + " " + bio); if (!t.ok) return { err: t.motivo };
  return { handle, bio, cats };
}

// ---------- GDPR ----------
function exportData(w) {
  const p = P(w);
  return {
    generato: new Date().toISOString(), titolare: "ZDOS1.3 · P.IVA 11040550961", wallet: w,
    profilo: p ? { ...p, cats: JSON.parse(p.cats || "[]") } : null,
    immagini: db.prepare("SELECT id,kind,status,w,h,bytes,created,reviewed_at,mime,title,dur FROM media WHERE wallet=?").all(w),
    post: db.prepare("SELECT id,text,media,audio,status,created,published FROM posts WHERE wallet=?").all(w),
    mi_piace: db.prepare("SELECT post,created FROM likes WHERE wallet=?").all(w),
    seguiti: db.prepare("SELECT p.handle, f.created FROM follows f LEFT JOIN profiles p ON p.wallet=f.followee WHERE f.follower=?").all(w),
    bloccati: db.prepare("SELECT p.handle, b.created FROM blocks b LEFT JOIN profiles p ON p.wallet=b.blocked WHERE b.blocker=?").all(w),
    segnalazioni_inviate: db.prepare("SELECT kind,target,reason,status,created FROM reports WHERE reporter=?").all(w),
    nota: "Non salviamo indirizzi IP: per il rate limit usiamo solo un hash temporaneo in memoria. Le immagini sono ricodificate senza metadati EXIF.",
  };
}
const deleteAll = db.transaction((w) => {
  const media = db.prepare("SELECT id FROM media WHERE wallet=?").all(w).map((r) => r.id);
  const posts = db.prepare("SELECT id FROM posts WHERE wallet=?").all(w).map((r) => r.id);
  for (const id of posts) { db.prepare("DELETE FROM likes WHERE post=?").run(id); db.prepare("DELETE FROM reports WHERE kind='post' AND target=?").run(id); }
  db.prepare("DELETE FROM posts WHERE wallet=?").run(w);
  db.prepare("DELETE FROM likes WHERE wallet=?").run(w);
  db.prepare("DELETE FROM follows WHERE follower=? OR followee=?").run(w, w);
  db.prepare("DELETE FROM blocks WHERE blocker=? OR blocked=?").run(w, w);
  db.prepare("DELETE FROM reports WHERE reporter=?").run(w);
  const p = P(w); if (p) db.prepare("DELETE FROM reports WHERE kind='profile' AND target=?").run(p.handle);
  db.prepare("DELETE FROM media WHERE wallet=?").run(w);
  db.prepare("DELETE FROM profiles WHERE wallet=?").run(w);
  return { media, posts: posts.length };
});

// ---------- API ----------
async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const ih = ipHash(req);
  if (limited("ip:" + ih, 600, 600)) return fail(res, 429, "Troppe richieste: riprova tra qualche minuto.");
  const isAdmin = p.startsWith("/api/social/admin/");
  const M = req.method;

  // --- area staff: solo via nginx (htpasswd staff) che aggiunge la chiave interna ---
  if (isAdmin) {
    const k = String(req.headers["x-social-admin"] || "");
    if (!k || k.length !== ADMIN_KEY.length || !crypto.timingSafeEqual(Buffer.from(k), Buffer.from(ADMIN_KEY))) return fail(res, 403, "solo staff");
    const staff = String(req.headers["x-staff-user"] || "staff").slice(0, 40);
    return admin(req, res, p.slice("/api/social/admin".length), url, staff);
  }

  // --- protezione CSRF per tutte le modifiche ---
  const mutating = M !== "GET" && M !== "HEAD";
  if (mutating) {
    const o = req.headers.origin; if (o && o !== "https://" + SITE && o !== "https://www." + SITE) return fail(res, 403, "origine non ammessa");
    if (req.headers["x-ov-social"] !== "1") return fail(res, 403, "intestazione X-OV-Social mancante");
    if (limited("ipm:" + ih, 120, 600)) return fail(res, 429, "Troppe azioni: riprova tra qualche minuto.");
  }

  if (M === "GET" && p === "/api/social/health") return send(res, 200, { ok: true, servizio: "zdos-social", versione: 1, profili: db.prepare("SELECT COUNT(*) n FROM profiles WHERE status='attivo'").get().n });
  if (M === "GET" && p === "/api/social/meta") return send(res, 200, { ok: true, categorie: CATS, termini: TERMS_V, safeword: "ROSSO", maxImmagine: MAX_IMG, formati: ["image/jpeg", "image/png", "image/webp"], audio: { max: MAX_AUDIO, maxSecondi: MAX_AUDIO_SEC, formati: Object.values(AUDIO_MIME) } });

  if (p.startsWith("/api/social/pool/")) return pool.handle(req, res, p, url, { send, fail, readJson });

  const s = await session(req); const me = s ? s.address : null; const mine = me ? P(me) : null;

  // --- immagini ---
  if ((M === "GET" || M === "HEAD") && p.startsWith("/api/social/media/")) {
    const id = p.slice(18); if (!/^[A-Za-z0-9_-]{16}$/.test(id)) return fail(res, 404, "non trovata");
    const m = db.prepare("SELECT * FROM media WHERE id=?").get(id); if (!m) return fail(res, 404, "non trovata");
    if (m.status !== "approvato" && m.wallet !== me) return fail(res, 404, "non trovata");
    return serveMedia(req, res, m, m.status !== "approvato");
  }

  // --- io ---
  if (M === "GET" && p === "/api/social/me") {
    if (!me) return send(res, 200, { ok: true, autenticato: false });
    const out = { ok: true, autenticato: true, address: me, scade: s.expiresAt, profilo: null };
    if (mine) {
      out.profilo = await pubProfile(mine, me); out.profilo.stato = mine.status;
      out.profilo.avatarInRevisione = mine.avatar_pending ? "/api/social/media/" + mine.avatar_pending : null;
      out.profilo.consensi = { maggiorenne: mine.adult_at, termini: mine.terms_at, versioneTermini: mine.terms_v, consenso: mine.consent_at };
      out.post = await Promise.all(db.prepare("SELECT * FROM posts WHERE wallet=? ORDER BY created DESC LIMIT 50").all(me).map((r) => pubPost(r, me, true)));
    }
    return send(res, 200, out);
  }
  if (!me && mutating) return fail(res, 401, "Accedi con OurVelvet (firma wallet) per continuare.");
  if (me && mutating && limited("w:" + me, 240, 600)) return fail(res, 429, "Troppe azioni: riprova tra qualche minuto.");

  if (M === "PUT" && p === "/api/social/me/profile") {
    const b = await readJson(req);
    const v = validProfile(b); if (v.err) return fail(res, 400, v.err);
    const t = now();
    if (!mine) {
      if (b.maggiorenne !== true || b.termini !== true || b.consenso !== true) return fail(res, 400, "Per pubblicare servono: dichiarazione 18+, accettazione dei termini e consenso.");
      if (limited("prof:" + me, 3, 3600)) return fail(res, 429, "Troppi tentativi: riprova più tardi.");
      if (PH(v.handle)) return fail(res, 409, "Handle già in uso.");
      db.prepare("INSERT INTO profiles(wallet,handle,bio,cats,status,adult_at,terms_at,terms_v,consent_at,created,updated) VALUES(?,?,?,?, 'attivo',?,?,?,?,?,?)")
        .run(me, v.handle, v.bio, JSON.stringify(v.cats), t, t, TERMS_V, t, t, t);
      const m = await merit(me, "creator:profile:" + crypto.createHash("sha256").update(me).digest("hex").slice(0, 16), "creator_profile_published", { handle: v.handle });
      return send(res, 201, { ok: true, creato: true, profilo: await pubProfile(P(me), me), merito: m });
    }
    if (mine.status !== "attivo") return fail(res, 403, "Profilo sospeso dallo staff.");
    const other = PH(v.handle); if (other && other.wallet !== me) return fail(res, 409, "Handle già in uso.");
    db.prepare("UPDATE profiles SET handle=?, bio=?, cats=?, updated=? WHERE wallet=?").run(v.handle, v.bio, JSON.stringify(v.cats), t, me);
    return send(res, 200, { ok: true, creato: false, profilo: await pubProfile(P(me), me) });
  }
  if (!mine && mutating && p !== "/api/social/me") return fail(res, 403, "Crea prima il tuo profilo creator (con dichiarazione 18+ e consenso).");
  if (mine && mine.status !== "attivo" && mutating && !(M === "DELETE" && p === "/api/social/me")) return fail(res, 403, "Profilo sospeso dallo staff.");

  if (p.startsWith("/api/social/zsound/")) return AI.handle(req, res, p, { me, mine, send, fail, readJson, limited, textCheck });

  // --- Z-Sound: upload audio ---
  if (M === "POST" && p === "/api/social/audio") {
    if (limited("aud:" + me, 8, 3600)) return fail(res, 429, "Troppi caricamenti audio in un'ora: riprova più tardi.");
    const ct = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!ct.startsWith("audio/")) return fail(res, 415, "Formato non ammesso: solo audio WAV, WebM, OGG, MP3 o M4A.");
    if (+req.headers["content-length"] > MAX_AUDIO) return fail(res, 413, "Audio troppo grande: massimo 25 MB.");
    const used = db.prepare("SELECT COALESCE(SUM(bytes),0) n FROM media WHERE wallet=? AND kind='audio'").get(me).n;
    const buf = await readBody(req, MAX_AUDIO);
    if (!buf.length) return fail(res, 400, "audio vuoto");
    if (used + buf.length > AUDIO_QUOTA) return fail(res, 413, "Spazio audio esaurito (massimo 200 MB per profilo): elimina qualche traccia.");
    const sn = sniffAudio(buf); if (!sn) return fail(res, 415, "Formato non riconosciuto: solo WAV, WebM, OGG, MP3 o M4A.");
    let dur = Math.min(MAX_AUDIO_SEC + 1, Math.max(0, +(url.searchParams.get("dur") || 0) || 0));
    if (sn.dur != null) dur = sn.dur; // per il WAV la durata si ricava dall'header
    if (dur > MAX_AUDIO_SEC) return fail(res, 413, "Traccia troppo lunga: massimo 30 minuti.");
    const title = String(url.searchParams.get("titolo") || "").trim().slice(0, 60);
    if (title) { const tc = textCheck(title); if (!tc.ok) return fail(res, 400, tc.motivo); }
    const id = rid(12);
    fs.writeFileSync(path.join(MEDIA, id + "." + sn.ext), buf, { mode: 0o600 });
    db.prepare("INSERT INTO media(id,wallet,kind,status,bytes,created,mime,title,dur) VALUES(?,?,?,?,?,?,?,?,?)").run(id, me, "audio", "in_revisione", buf.length, now(), AUDIO_MIME[sn.ext], title || null, dur ? Math.round(dur * 10) / 10 : null);
    return send(res, 201, { ok: true, media: id, stato: "in_revisione", tipo: AUDIO_MIME[sn.ext], bytes: buf.length, durata: dur ? Math.round(dur) : null, nota: "La traccia diventa pubblica dopo l'approvazione dello staff." });
  }
  const mad = p.match(/^\/api\/social\/audio\/([A-Za-z0-9_-]{16})$/);
  if (mad && M === "DELETE") {
    const m = db.prepare("SELECT * FROM media WHERE id=? AND wallet=? AND kind='audio'").get(mad[1], me); if (!m) return fail(res, 404, "Traccia non trovata.");
    if (trackUsed(m.id)) return fail(res, 409, "La traccia è usata in un post: elimina prima il post.");
    db.prepare("DELETE FROM media WHERE id=?").run(m.id); deleteMediaFile(m.id); return send(res, 200, { ok: true, eliminata: true });
  }
  if (M === "GET" && p === "/api/social/me/tracks") {
    const rows = db.prepare("SELECT * FROM media WHERE wallet=? AND kind='audio' ORDER BY created DESC LIMIT 100").all(me);
    const foto = db.prepare("SELECT * FROM media WHERE wallet=? AND kind='post' AND status='approvato' ORDER BY created DESC LIMIT 40").all(me);
    return send(res, 200, { ok: true,
      tracce: rows.map((m) => ({ id: m.id, titolo: m.title || "Senza titolo", url: "/api/social/media/" + m.id, tipo: m.mime, bytes: m.bytes, durata: m.dur, stato: m.status, creata: m.created, inPost: trackUsed(m.id) })),
      foto: foto.map((m) => ({ id: m.id, url: "/api/social/media/" + m.id })) });
  }

  if (M === "POST" && (p === "/api/social/me/avatar" || p === "/api/social/media")) {
    const kind = p.endsWith("avatar") ? "avatar" : "post";
    if (limited("img:" + me, 20, 3600)) return fail(res, 429, "Troppe immagini in un'ora: riprova più tardi.");
    const ct = String(req.headers["content-type"] || "").split(";")[0].trim();
    if (!["image/jpeg", "image/png", "image/webp"].includes(ct)) return fail(res, 415, "Formato non ammesso: solo JPG, PNG o WebP.");
    const buf = await readBody(req, MAX_IMG);
    let m; try { m = await storeImage(buf, me, kind); } catch (e) { return fail(res, e.code || 400, e.code ? e.message : "Immagine non leggibile."); }
    if (kind === "avatar") { const old = mine.avatar_pending; db.prepare("UPDATE profiles SET avatar_pending=?, updated=? WHERE wallet=?").run(m.id, now(), me); if (old) { db.prepare("DELETE FROM media WHERE id=? AND status='in_revisione'").run(old); deleteMediaFile(old); } }
    return send(res, 201, { ok: true, media: m.id, stato: "in_revisione", nota: "L'immagine diventa pubblica dopo l'approvazione dello staff." });
  }

  if (M === "GET" && p === "/api/social/me/export") {
    if (!me) return fail(res, 401, "Accedi per esportare i tuoi dati.");
    return send(res, 200, exportData(me), { "content-disposition": "attachment; filename=\"ourvelvet-dati.json\"" });
  }
  if (M === "DELETE" && p === "/api/social/me") {
    const b = await readJson(req); if (b.conferma !== "ELIMINA") return fail(res, 400, "Per cancellare scrivi ELIMINA nel campo di conferma.");
    const r = deleteAll(me); for (const id of r.media) deleteMediaFile(id);
    db.prepare("INSERT INTO modlog(ts,staff,action,target) VALUES(?,?,?,?)").run(now(), null, "gdpr_cancellazione", "profilo cancellato dall'utente");
    return send(res, 200, { ok: true, cancellato: true, immagini: r.media.length, post: r.posts });
  }

  // --- creator ---
  if (M === "GET" && p === "/api/social/creators") {
    const q = String(url.searchParams.get("q") || "").toLowerCase().slice(0, 40), cat = String(url.searchParams.get("cat") || "");
    const hide = new Set(hiddenFor(me));
    const rows = db.prepare("SELECT * FROM profiles WHERE status='attivo' ORDER BY created DESC LIMIT 300").all()
      .filter((r) => !hide.has(r.wallet) && (!cat || JSON.parse(r.cats).includes(cat)) && (!q || (r.handle + " " + r.bio + " " + r.cats).toLowerCase().includes(q)));
    return send(res, 200, { ok: true, creator: await Promise.all(rows.slice(0, 120).map((r) => pubProfile(r, me))) });
  }
  const mc = p.match(/^\/api\/social\/creators\/([a-z0-9_]{3,24})(\/follow|\/block)?$/);
  if (mc) {
    const t = PH(mc[1]); if (!t || t.status !== "attivo" || (blockedBetween(me, t.wallet) && !mc[2])) return fail(res, 404, "Creator non trovato.");
    if (M === "GET" && !mc[2]) {
      const posts = db.prepare("SELECT * FROM posts WHERE wallet=? AND status='pubblico' ORDER BY created DESC LIMIT 50").all(t.wallet);
      return send(res, 200, { ok: true, profilo: await pubProfile(t, me), post: await Promise.all(posts.map((r) => pubPost(r, me))) });
    }
    if (M === "POST" && mc[2] === "/follow") {
      if (t.wallet === me) return fail(res, 400, "Non puoi seguire te stesso.");
      if (blockedBetween(me, t.wallet)) return fail(res, 403, "Azione non disponibile.");
      if (limited("fol:" + me, 60, 600)) return fail(res, 429, "Troppe azioni: riprova tra qualche minuto.");
      const on = !!db.prepare("SELECT 1 FROM follows WHERE follower=? AND followee=?").get(me, t.wallet);
      if (on) db.prepare("DELETE FROM follows WHERE follower=? AND followee=?").run(me, t.wallet); else db.prepare("INSERT INTO follows VALUES(?,?,?)").run(me, t.wallet, now());
      return send(res, 200, { ok: true, segui: !on, follower: db.prepare("SELECT COUNT(*) n FROM follows WHERE followee=?").get(t.wallet).n });
    }
    if (M === "POST" && mc[2] === "/block") {
      if (t.wallet === me) return fail(res, 400, "Non puoi bloccare te stesso.");
      const on = !!db.prepare("SELECT 1 FROM blocks WHERE blocker=? AND blocked=?").get(me, t.wallet);
      if (on) db.prepare("DELETE FROM blocks WHERE blocker=? AND blocked=?").run(me, t.wallet);
      else { db.prepare("INSERT INTO blocks VALUES(?,?,?)").run(me, t.wallet, now()); db.prepare("DELETE FROM follows WHERE (follower=? AND followee=?) OR (follower=? AND followee=?)").run(me, t.wallet, t.wallet, me); }
      return send(res, 200, { ok: true, bloccato: !on });
    }
  }

  // --- post e feed ---
  if (M === "GET" && p === "/api/social/feed") {
    const scope = url.searchParams.get("scope") === "seguiti" ? "seguiti" : "tutti";
    const before = Math.max(0, +(url.searchParams.get("prima") || 0)) || 9e9;
    if (scope === "seguiti" && !me) return fail(res, 401, "Accedi per vedere chi segui.");
    const hide = new Set(hiddenFor(me));
    const rows = scope === "seguiti"
      ? db.prepare("SELECT p.* FROM posts p JOIN follows f ON f.followee=p.wallet AND f.follower=? JOIN profiles pr ON pr.wallet=p.wallet AND pr.status='attivo' WHERE p.status='pubblico' AND p.created<? ORDER BY p.created DESC LIMIT 30").all(me, before)
      : db.prepare("SELECT p.* FROM posts p JOIN profiles pr ON pr.wallet=p.wallet AND pr.status='attivo' WHERE p.status='pubblico' AND p.created<? ORDER BY p.created DESC LIMIT 30").all(before);
    const out = (await Promise.all(rows.filter((r) => !hide.has(r.wallet)).map((r) => pubPost(r, me)))).filter(Boolean);
    return send(res, 200, { ok: true, scope, post: out });
  }
  if (M === "POST" && p === "/api/social/posts") {
    const b = await readJson(req);
    const text = String(b.text || "").trim().slice(0, 500);
    const mediaId = b.media ? String(b.media) : null, audioId = b.audio ? String(b.audio) : null;
    if (!text && !mediaId && !audioId) return fail(res, 400, "Scrivi qualcosa o allega un'immagine o una traccia.");
    const tc = textCheck(text); if (!tc.ok) return fail(res, 400, tc.motivo);
    if (limited("post:" + me, 10, 3600)) return fail(res, 429, "Massimo 10 post all'ora.");
    let am = null, cm = null;
    if (audioId) {
      am = db.prepare("SELECT * FROM media WHERE id=? AND wallet=? AND kind='audio'").get(audioId, me);
      if (!am || am.status === "rifiutato") return fail(res, 400, "Traccia non valida.");
    }
    if (mediaId) {
      cm = db.prepare("SELECT * FROM media WHERE id=? AND wallet=? AND kind='post'").get(mediaId, me);
      // con una traccia la copertina può essere una foto già approvata del creator (riusabile); senza traccia vale la regola di sempre
      const reusable = !!am && cm && cm.status === "approvato";
      if (!cm || cm.status === "rifiutato" || (!reusable && db.prepare("SELECT 1 FROM posts WHERE media=?").get(mediaId))) return fail(res, 400, "Immagine non valida.");
    }
    const status = [am, cm].every((m) => !m || m.status === "approvato") ? "pubblico" : "in_revisione";
    const id = rid(9), t = now();
    db.prepare("INSERT INTO posts(id,wallet,text,media,audio,status,created,published) VALUES(?,?,?,?,?,?,?,?)").run(id, me, text, mediaId, audioId, status, t, status === "pubblico" ? t : null);
    let mer = null; if (status === "pubblico") mer = await merit(me, "creator:post:" + id, "creator_post_published", { post: id });
    return send(res, 201, { ok: true, post: await pubPost(P(me) && db.prepare("SELECT * FROM posts WHERE id=?").get(id), me, true), stato: status, merito: mer,
      nota: status === "in_revisione" ? "Il post con immagine o traccia è in revisione: diventa pubblico dopo l'approvazione dello staff." : undefined });
  }
  const mp = p.match(/^\/api\/social\/posts\/([A-Za-z0-9_-]{12})(\/like)?$/);
  if (mp) {
    const r = db.prepare("SELECT * FROM posts WHERE id=?").get(mp[1]);
    if (!r || (r.status !== "pubblico" && r.wallet !== me) || blockedBetween(me, r.wallet)) return fail(res, 404, "Post non trovato.");
    if (M === "POST" && mp[2]) {
      if (r.status !== "pubblico") return fail(res, 400, "Il post non è pubblico.");
      if (r.wallet === me) return fail(res, 400, "Non puoi mettere mi piace ai tuoi post.");
      if (limited("like:" + me, 120, 600)) return fail(res, 429, "Troppe azioni: riprova tra qualche minuto.");
      const on = !!db.prepare("SELECT 1 FROM likes WHERE post=? AND wallet=?").get(r.id, me);
      if (on) db.prepare("DELETE FROM likes WHERE post=? AND wallet=?").run(r.id, me); else db.prepare("INSERT INTO likes VALUES(?,?,?)").run(r.id, me, now());
      return send(res, 200, { ok: true, piace: !on, like: db.prepare("SELECT COUNT(*) n FROM likes WHERE post=?").get(r.id).n });
    }
    if (M === "DELETE" && !mp[2]) {
      if (r.wallet !== me) return fail(res, 403, "Puoi eliminare solo i tuoi post.");
      db.prepare("DELETE FROM likes WHERE post=?").run(r.id); db.prepare("DELETE FROM reports WHERE kind='post' AND target=?").run(r.id); db.prepare("DELETE FROM posts WHERE id=?").run(r.id);
      // le tracce restano nella libreria del creator; le foto si cancellano solo se nessun altro post le usa
      if (r.media && !trackUsed(r.media)) { db.prepare("DELETE FROM media WHERE id=?").run(r.media); deleteMediaFile(r.media); }
      return send(res, 200, { ok: true, eliminato: true });
    }
  }

  // --- segnalazioni ---
  if (M === "POST" && p === "/api/social/report") {
    const b = await readJson(req);
    const kind = b.kind === "profile" ? "profile" : b.kind === "post" ? "post" : null; if (!kind) return fail(res, 400, "Tipo non valido.");
    const target = kind === "post" ? String(b.target || "").slice(0, 20) : String(b.target || "").toLowerCase().replace(/^@/, "").slice(0, 24);
    const reason = String(b.reason || "").trim().slice(0, 300); if (reason.length < 3) return fail(res, 400, "Scrivi il motivo della segnalazione.");
    if (limited("rep:" + me, 20, 3600)) return fail(res, 429, "Troppe segnalazioni in un'ora.");
    let owner = null;
    if (kind === "post") { const r = db.prepare("SELECT * FROM posts WHERE id=?").get(target); if (!r || r.status !== "pubblico") return fail(res, 404, "Post non trovato."); owner = r.wallet; }
    else { const t = PH(target); if (!t) return fail(res, 404, "Creator non trovato."); owner = t.wallet; }
    if (owner === me) return fail(res, 400, "Non puoi segnalare te stesso.");
    db.prepare("INSERT OR IGNORE INTO reports(reporter,kind,target,reason,created) VALUES(?,?,?,?,?)").run(me, kind, target, reason, now());
    // 3 segnalazioni distinte su un post: lo nascondo subito in attesa dello staff
    let nascosto = false;
    if (kind === "post" && db.prepare("SELECT COUNT(*) n FROM reports WHERE kind='post' AND target=? AND status='aperta'").get(target).n >= 3) { db.prepare("UPDATE posts SET status='in_revisione' WHERE id=? AND status='pubblico'").run(target); nascosto = true; }
    return send(res, 201, { ok: true, segnalato: true, nascosto });
  }
  if (M === "GET" && p === "/api/social/me/blocks") {
    if (!me) return fail(res, 401, "Accedi.");
    return send(res, 200, { ok: true, bloccati: db.prepare("SELECT p.handle FROM blocks b JOIN profiles p ON p.wallet=b.blocked WHERE b.blocker=?").all(me).map((r) => r.handle) });
  }
  return fail(res, 404, "non trovato");
}

// ---------- staff ----------
async function admin(req, res, p, url, staff) {
  const M = req.method; const log = (a, t) => db.prepare("INSERT INTO modlog(ts,staff,action,target) VALUES(?,?,?,?)").run(now(), staff, a, t);
  if (M === "GET" && p === "/stats") return send(res, 200, { ok: true,
    profili: db.prepare("SELECT status, COUNT(*) n FROM profiles GROUP BY status").all(), post: db.prepare("SELECT status, COUNT(*) n FROM posts GROUP BY status").all(),
    immagini: db.prepare("SELECT status, COUNT(*) n FROM media GROUP BY status").all(), segnalazioniAperte: db.prepare("SELECT COUNT(*) n FROM reports WHERE status='aperta'").get().n });
  if (M === "GET" && p === "/queue") {
    const rows = db.prepare("SELECT m.*, pr.handle FROM media m LEFT JOIN profiles pr ON pr.wallet=m.wallet WHERE m.status='in_revisione' ORDER BY m.created LIMIT 100").all();
    return send(res, 200, { ok: true, coda: rows.map((m) => ({ id: m.id, tipo: m.kind, handle: m.handle, w: m.w, h: m.h, bytes: m.bytes, creato: m.created,
      testo: m.kind === "post" || m.kind === "audio" ? (db.prepare("SELECT text FROM posts WHERE media=? OR audio=?").get(m.id, m.id) || {}).text || "" : "", titolo: m.title || null, durata: m.dur || null, tipoMime: m.mime || null, url: "/creator-radar/admin/api/media/" + m.id })) });
  }
  const mm = p.match(/^\/media\/([A-Za-z0-9_-]{16})$/);
  if (mm && M === "GET") {
    const am0 = db.prepare("SELECT * FROM media WHERE id=?").get(mm[1]); if (!am0) return fail(res, 404, "non trovata");
    return serveMedia(req, res, am0, true);
  }
  if (mm && M === "POST") {
    const b = await readJson(req); const m = db.prepare("SELECT * FROM media WHERE id=?").get(mm[1]); if (!m) return fail(res, 404, "non trovata");
    if (b.azione === "approva") {
      db.prepare("UPDATE media SET status='approvato', reviewed_at=?, reviewer=? WHERE id=?").run(now(), staff, m.id);
      const merits = [];
      if (m.kind === "avatar") db.prepare("UPDATE profiles SET avatar=?, avatar_pending=NULL WHERE wallet=? AND avatar_pending=?").run(m.id, m.wallet, m.id);
      else for (const ps of db.prepare("SELECT * FROM posts WHERE (media=? OR audio=?) AND status='in_revisione'").all(m.id, m.id)) {
        // un post con copertina e traccia diventa pubblico solo quando tutto ciò che contiene è approvato
        const pend = db.prepare("SELECT COUNT(*) n FROM media WHERE id IN (?,?) AND status!='approvato'").get(ps.media || "-", ps.audio || "-").n;
        if (pend) continue;
        db.prepare("UPDATE posts SET status='pubblico', published=? WHERE id=?").run(now(), ps.id);
        merits.push(await merit(ps.wallet, "creator:post:" + ps.id, "creator_post_published", { post: ps.id }));
      }
      log("approva_immagine", m.id); return send(res, 200, { ok: true, stato: "approvato", merito: merits });
    }
    if (b.azione === "rifiuta") {
      db.prepare("UPDATE media SET status='rifiutato', reviewed_at=?, reviewer=?, note=? WHERE id=?").run(now(), staff, String(b.nota || "").slice(0, 200), m.id);
      if (m.kind === "avatar") db.prepare("UPDATE profiles SET avatar_pending=NULL WHERE avatar_pending=?").run(m.id);
      db.prepare("UPDATE posts SET status='rifiutato' WHERE media=? OR audio=?").run(m.id, m.id); deleteMediaFile(m.id);
      log("rifiuta_immagine", m.id); return send(res, 200, { ok: true, stato: "rifiutato" });
    }
    return fail(res, 400, "azione: approva | rifiuta");
  }
  if (M === "GET" && p === "/reports") {
    const rows = db.prepare("SELECT id,kind,target,reason,status,created FROM reports WHERE status='aperta' ORDER BY created LIMIT 200").all();
    for (const r of rows) {
      if (r.kind === "post") { const ps = db.prepare("SELECT p.text, p.status, p.media, pr.handle FROM posts p LEFT JOIN profiles pr ON pr.wallet=p.wallet WHERE p.id=?").get(r.target); r.dettaglio = ps ? { handle: ps.handle, testo: ps.text, stato: ps.status, immagine: ps.media ? "/creator-radar/admin/api/media/" + ps.media : null } : null; }
      else { const pr = PH(r.target); r.dettaglio = pr ? { handle: pr.handle, bio: pr.bio, stato: pr.status } : null; }
    }
    return send(res, 200, { ok: true, segnalazioni: rows });
  }
  const mr = p.match(/^\/reports\/(\d+)$/);
  if (mr && M === "POST") {
    const b = await readJson(req); const r = db.prepare("SELECT * FROM reports WHERE id=?").get(+mr[1]); if (!r) return fail(res, 404, "non trovata");
    if (b.azione === "archivia") { db.prepare("UPDATE reports SET status='archiviata', resolved_at=?, action='archivia' WHERE kind=? AND target=? AND status='aperta'").run(now(), r.kind, r.target);
      if (r.kind === "post") db.prepare("UPDATE posts SET status='pubblico' WHERE id=? AND status='in_revisione' AND (media IS NULL OR media IN (SELECT id FROM media WHERE status='approvato'))").run(r.target);
      log("archivia_segnalazione", r.kind + ":" + r.target); return send(res, 200, { ok: true }); }
    if (b.azione === "nascondi") {
      if (r.kind === "post") db.prepare("UPDATE posts SET status='nascosto' WHERE id=?").run(r.target); else db.prepare("UPDATE profiles SET status='sospeso' WHERE handle=?").run(r.target);
      db.prepare("UPDATE reports SET status='azione', resolved_at=?, action='nascondi' WHERE kind=? AND target=? AND status='aperta'").run(now(), r.kind, r.target);
      log("nascondi_" + r.kind, r.target); return send(res, 200, { ok: true });
    }
    return fail(res, 400, "azione: archivia | nascondi");
  }
  const mpr = p.match(/^\/profiles\/([a-z0-9_]{3,24})$/);
  if (mpr && M === "POST") {
    const b = await readJson(req); const t = PH(mpr[1]); if (!t) return fail(res, 404, "non trovato");
    if (b.azione === "sospendi" || b.azione === "ripristina") { db.prepare("UPDATE profiles SET status=? WHERE wallet=?").run(b.azione === "sospendi" ? "sospeso" : "attivo", t.wallet); log(b.azione, t.handle); return send(res, 200, { ok: true }); }
    return fail(res, 400, "azione: sospendi | ripristina");
  }
  if (M === "GET" && p === "/log") return send(res, 200, { ok: true, log: db.prepare("SELECT * FROM modlog ORDER BY id DESC LIMIT 100").all() });
  return fail(res, 404, "non trovato");
}

// Z-Sound: ogni ora cancello le tracce caricate da più di 24 ore e mai usate in un post
setInterval(() => {
  try { for (const m of db.prepare("SELECT id FROM media WHERE kind='audio' AND created<?").all(now() - 86400)) if (!trackUsed(m.id)) { db.prepare("DELETE FROM media WHERE id=?").run(m.id); deleteMediaFile(m.id); } }
  catch (e) { console.error("[social] pulizia audio:", e.message); }
}, 3600_000).unref();

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => { if (!e.code || typeof e.code !== "number") console.error("[social] errore:", e.message); if (!res.headersSent) fail(res, typeof e.code === "number" ? e.code : 500, typeof e.code === "number" ? e.message : "errore interno"); else res.end(); });
});
server.headersTimeout = 15_000; server.requestTimeout = 30_000;
server.listen(PORT, HOST, () => console.log(`[social] in ascolto su ${HOST}:${PORT}`));
