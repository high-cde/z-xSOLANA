// OurVelvet Social · adattatore «Registrati con TikTok» (Login Kit for Web, OAuth 2.0 v2). © ZDOS1.3 · Licenza proprietaria.
// Flusso: /api/social/tiktok/start → https://www.tiktok.com/v2/auth/authorize/ → /api/social/tiktok/callback.
//  - state anti-CSRF: casuale, monouso, 10 minuti, legato al browser con un cookie HttpOnly (nonce).
//  - PKCE (S256, hex come da guida TikTok Desktop): opzionale con "pkce": true nel file di configurazione. La guida Web non lo richiede.
//  - Scambio del codice con client_secret solo lato server. I token NON vengono salvati: access token usato una volta per leggere
//    open_id, nome e avatar, poi revocato. Il refresh token non viene mai conservato.
//  - Con sessione firma (wallet) attiva: collega TikTok al profilo di quel wallet. Senza: crea un account solo-social (tt:<hash>),
//    che per pubblicare deve comunque passare dichiarazione 18+, termini e consenso (PUT /api/social/me/profile).
//  - Spento di default: /etc/zdos-social/tiktok.json {"enabled": false} e /etc/zdos-social/tiktok.secret vuoto.
import fs from "node:fs";
import crypto from "node:crypto";

const E = process.env;
const CONF_FILE = E.TIKTOK_CONFIG || "/etc/zdos-social/tiktok.json";
const SECRET_FILE = E.TIKTOK_SECRET_FILE || "/etc/zdos-social/tiktok.secret";
const AUTH_URL = E.TIKTOK_AUTH_URL || "https://www.tiktok.com/v2/auth/authorize/";
const API = (E.TIKTOK_API || "https://open.tiktokapis.com").replace(/\/+$/, "");
const COOKIE_SESSION = "zdos_tt", COOKIE_STATE = "zdos_tt_st";
const STATE_TTL = 600, SESSION_TTL = 86400;
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const rnd = (n = 24) => crypto.randomBytes(n).toString("base64url");
const cookieOf = (req, name) => (String(req.headers.cookie || "").match(new RegExp("(?:^|;\\s*)" + name + "=([A-Za-z0-9_-]{16,128})")) || [])[1] || "";
const eq = (a, b) => a.length === b.length && a.length > 0 && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function createTiktok({ db, now, limited, ipHash, getSession, SITE }) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS tiktok_links(open_id TEXT PRIMARY KEY, identity TEXT NOT NULL, kind TEXT NOT NULL, display_name TEXT NOT NULL DEFAULT '', avatar_url TEXT,
    linked INTEGER NOT NULL, last_login INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS tiktok_links_identity ON tiktok_links(identity);
  CREATE TABLE IF NOT EXISTS tiktok_states(sh TEXT PRIMARY KEY, nonce_h TEXT NOT NULL, identity TEXT, next TEXT NOT NULL, verifier TEXT, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS tiktok_sessions(sh TEXT PRIMARY KEY, identity TEXT NOT NULL, open_id TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL);
  `);
  const q = (s) => db.prepare(s);

  // ---- configurazione (riletta ogni 5 s: per attivare basta scrivere i file, nessun riavvio) ----
  let cache = { t: 0, v: null };
  function conf() {
    if (cache.v && Date.now() - cache.t < 5000) return cache.v;
    let c = {}, secret = "";
    try { c = JSON.parse(fs.readFileSync(CONF_FILE, "utf8")); } catch {}
    try { secret = fs.readFileSync(SECRET_FILE, "utf8").trim(); } catch {}
    const key = String(c.client_key || "").trim();
    const v = {
      key, secret, scope: "user.info.basic", pkce: c.pkce === true, revoke: c.revoke_after_login !== false,
      redirect: String(c.redirect_uri || "https://" + SITE + "/api/social/tiktok/callback"),
      attivo: c.enabled === true && /^[A-Za-z0-9_-]{8,64}$/.test(key) && secret.length >= 16,
    };
    cache = { t: Date.now(), v }; return v;
  }

  // ---- sessione solo-social (cookie opaco, riga lato server, revocabile) ----
  function session(req) {
    const tok = cookieOf(req, COOKIE_SESSION); if (!tok) return null;
    const r = q("SELECT * FROM tiktok_sessions WHERE sh=?").get(sha(tok));
    if (!r || r.expires < now()) return null;
    return { address: r.identity, expiresAt: new Date(r.expires * 1000).toISOString(), via: "tiktok" };
  }
  const setCookie = (name, val, maxAge, path) => `${name}=${val}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

  // ---- redirect di ritorno sicuro: solo percorsi locali ----
  function safeNext(n) {
    n = String(n || "");
    if (!n.startsWith("/") || n.startsWith("//") || n.includes("\\") || /[\r\n\s]/.test(n) || n.length > 200) return "/creator-radar/";
    return n;
  }
  function back(res, next, code, extra = []) {
    const u = new URL(safeNext(next), "https://" + SITE); u.searchParams.set("tiktok", code);
    res.writeHead(302, { Location: u.pathname + u.search + u.hash, "cache-control": "no-store", "referrer-policy": "no-referrer", "set-cookie": extra }); res.end();
  }
  const wantsHtml = (req) => String(req.headers.accept || "").includes("text/html");

  // ---- chiamate TikTok (timeout 8 s, mai log di token o segreti) ----
  async function tt(method, path, { form, bearer } = {}) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const h = { accept: "application/json" }; let body;
      if (form) { h["content-type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString(); }
      if (bearer) h.authorization = "Bearer " + bearer;
      const r = await fetch(API + path, { method, headers: h, body, signal: ctl.signal, redirect: "error" });
      const txt = await r.text(); let j = null; try { j = JSON.parse(txt.slice(0, 20000)); } catch {}
      return { status: r.status, json: j };
    } finally { clearTimeout(t); }
  }
  const cleanName = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 60);
  const cleanUrl = (s) => { s = String(s || ""); return /^https:\/\/[^\s"'<>]{4,480}$/.test(s) ? s : null; };

  async function start(req, res, url) {
    const c = conf(), next = safeNext(url.searchParams.get("next"));
    if (!c.attivo) {
      if (wantsHtml(req)) return back(res, next, "in_attivazione");
      return json(res, 503, { ok: false, stato: "in_attivazione", errore: "Il login con TikTok è in attivazione." });
    }
    if (limited("ttstart:" + ipHash(req), 20, 600)) return json(res, 429, { ok: false, errore: "Troppe richieste: riprova tra qualche minuto." });
    const s = await getSession(req);
    const identity = s && s.via !== "tiktok" ? s.address : null; // collegamento solo con sessione firma (wallet)
    const state = rnd(24), nonce = rnd(24), verifier = c.pkce ? crypto.randomBytes(48).toString("base64url") : null;
    q("DELETE FROM tiktok_states WHERE created<?").run(now() - STATE_TTL);
    q("INSERT INTO tiktok_states(sh,nonce_h,identity,next,verifier,created) VALUES(?,?,?,?,?,?)").run(sha(state), sha(nonce), identity, next, verifier, now());
    const p = { client_key: c.key, scope: c.scope, response_type: "code", redirect_uri: c.redirect, state };
    if (verifier) { p.code_challenge = sha(verifier); p.code_challenge_method = "S256"; } // hex di SHA256, come da guida TikTok
    res.writeHead(302, { Location: AUTH_URL + "?" + new URLSearchParams(p).toString(), "cache-control": "no-store", "referrer-policy": "no-referrer",
      "set-cookie": [setCookie(COOKIE_STATE, nonce, STATE_TTL, "/api/social/tiktok/")] });
    res.end();
  }

  async function callback(req, res, url) {
    const c = conf(); const clr = setCookie(COOKIE_STATE, "", 0, "/api/social/tiktok/");
    if (!c.attivo) return back(res, "/creator-radar/", "in_attivazione", [clr]);
    if (limited("ttcb:" + ipHash(req), 30, 600)) return back(res, "/creator-radar/", "errore", [clr]);
    const state = String(url.searchParams.get("state") || ""), nonce = cookieOf(req, COOKIE_STATE);
    const row = /^[A-Za-z0-9_-]{16,64}$/.test(state) ? q("SELECT * FROM tiktok_states WHERE sh=?").get(sha(state)) : null;
    if (row) q("DELETE FROM tiktok_states WHERE sh=?").run(row.sh); // monouso
    if (!row || row.created < now() - STATE_TTL || !eq(sha(nonce), row.nonce_h)) return back(res, "/creator-radar/", "errore", [clr]);
    const next = row.next;
    if (url.searchParams.get("error")) return back(res, next, "negato", [clr]);
    const code = String(url.searchParams.get("code") || "");
    if (!/^[\x21-\x7e]{8,2048}$/.test(code)) return back(res, next, "errore", [clr]);
    let access = "", info = null;
    try {
      const form = { client_key: c.key, client_secret: c.secret, code, grant_type: "authorization_code", redirect_uri: c.redirect };
      if (row.verifier) form.code_verifier = row.verifier;
      const t = await tt("POST", "/v2/oauth/token/", { form });
      const tj = t.json || {}; access = String(tj.access_token || "");
      if (t.status !== 200 || !access || !tj.open_id || tj.error) throw new Error("token");
      const scopes = String(tj.scope || ""); if (!scopes.split(",").includes("user.info.basic")) throw new Error("scope");
      const u = await tt("GET", "/v2/user/info/?fields=" + encodeURIComponent("open_id,display_name,avatar_url"), { bearer: access });
      const user = u.json && u.json.data && u.json.data.user;
      if (u.status !== 200 || !user || String(user.open_id) !== String(tj.open_id) || (u.json.error && u.json.error.code && u.json.error.code !== "ok")) throw new Error("user");
      info = { open_id: String(user.open_id), name: cleanName(user.display_name), avatar: cleanUrl(user.avatar_url) };
      if (!/^[A-Za-z0-9._-]{8,128}$/.test(info.open_id)) throw new Error("open_id");
    } catch (e) {
      console.error("[tiktok] scambio non riuscito:", e.message); // nessun dettaglio sensibile nel log
      if (access) tt("POST", "/v2/oauth/revoke/", { form: { client_key: c.key, client_secret: c.secret, token: access } }).catch(() => {});
      return back(res, next, "errore", [clr]);
    }
    // l'access token ha fatto il suo lavoro: lo revoco subito e non lo conservo. Il refresh token non viene nemmeno letto.
    if (c.revoke) tt("POST", "/v2/oauth/revoke/", { form: { client_key: c.key, client_secret: c.secret, token: access } }).catch(() => {});
    access = "";

    const t = now(); const ex = q("SELECT * FROM tiktok_links WHERE open_id=?").get(info.open_id);
    if (row.identity) { // collegamento a un wallet con sessione firma ancora valida
      const s = await getSession(req);
      if (!s || s.via === "tiktok" || s.address !== row.identity) return back(res, next, "errore", [clr]);
      if (ex && !(ex.kind === "wallet" && ex.identity === row.identity)) return back(res, next, "altro_profilo", [clr]);
      db.transaction(() => {
        q("DELETE FROM tiktok_links WHERE identity=? AND kind='wallet'").run(row.identity);
        q("INSERT INTO tiktok_links(open_id,identity,kind,display_name,avatar_url,linked,last_login) VALUES(?,?,?,?,?,?,?)").run(info.open_id, row.identity, "wallet", info.name, info.avatar, ex ? ex.linked : t, t);
      })();
      return back(res, next, "collegato", [clr]);
    }
    let identity;
    if (ex) {
      if (ex.kind === "wallet") return back(res, next, "gia_collegato", [clr]); // un TikTok legato a un wallet non dà accesso a quel wallet
      identity = ex.identity; q("UPDATE tiktok_links SET display_name=?, avatar_url=?, last_login=? WHERE open_id=?").run(info.name, info.avatar, t, info.open_id);
    } else {
      identity = "tt:" + sha("tt|" + info.open_id).slice(0, 32);
      q("INSERT INTO tiktok_links(open_id,identity,kind,display_name,avatar_url,linked,last_login) VALUES(?,?,?,?,?,?,?)").run(info.open_id, identity, "social", info.name, info.avatar, t, t);
    }
    const tok = rnd(32);
    q("INSERT INTO tiktok_sessions(sh,identity,open_id,created,expires) VALUES(?,?,?,?,?)").run(sha(tok), identity, info.open_id, t, t + SESSION_TTL);
    return back(res, next, "ok", [clr, setCookie(COOKIE_SESSION, tok, SESSION_TTL, "/")]);
  }

  const json = (res, code, obj, extra = {}) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra }); res.end(JSON.stringify(obj)); };

  async function handle(req, res, p, url) {
    const M = req.method, sub = p.slice("/api/social/tiktok".length);
    if (M === "GET" && sub === "/status") { const c = conf(); return json(res, 200, { ok: true, attivo: c.attivo, stato: c.attivo ? "attivo" : "in_attivazione", scope: c.scope, redirect: c.redirect }); }
    if (M === "GET" && sub === "/start") return start(req, res, url);
    if (M === "GET" && sub === "/callback") return callback(req, res, url);
    if (M === "GET" && sub === "/me") {
      const s = await getSession(req); if (!s) return json(res, 200, { ok: true, autenticato: false });
      const l = q("SELECT kind,display_name,linked FROM tiktok_links WHERE identity=?").get(s.address);
      return json(res, 200, { ok: true, autenticato: true, via: s.via || "firma", collegato: !!l, tipo: l ? l.kind : null, nome: l ? l.display_name : null, dal: l ? l.linked : null });
    }
    if (M === "POST" && sub === "/logout") { // chiude solo la sessione TikTok (la firma si chiude da /api/firma/logout)
      const tok = cookieOf(req, COOKIE_SESSION); if (tok) q("DELETE FROM tiktok_sessions WHERE sh=?").run(sha(tok));
      return json(res, 200, { ok: true }, { "set-cookie": setCookie(COOKIE_SESSION, "", 0, "/") });
    }
    if (M === "DELETE" && sub === "/link") { // scollega TikTok da un profilo con wallet (l'account solo-social si elimina con «Cancella il mio profilo»)
      const s = await getSession(req); if (!s || s.via === "tiktok") return json(res, 401, { ok: false, errore: "Serve l'accesso con la firma del wallet." });
      const r = q("DELETE FROM tiktok_links WHERE identity=? AND kind='wallet'").run(s.address);
      return json(res, 200, { ok: true, scollegati: r.changes });
    }
    return json(res, 404, { ok: false, errore: "non trovato" });
  }

  // GDPR: esportazione e cancellazione (chiamate da server.mjs insieme agli altri dati del profilo)
  const exportFor = (id) => q("SELECT kind,display_name,avatar_url,linked,last_login,open_id FROM tiktok_links WHERE identity=?").all(id);
  const purge = (id) => { q("DELETE FROM tiktok_sessions WHERE identity=?").run(id); q("DELETE FROM tiktok_links WHERE identity=?").run(id); };
  setInterval(() => { try { q("DELETE FROM tiktok_states WHERE created<?").run(now() - STATE_TTL); q("DELETE FROM tiktok_sessions WHERE expires<?").run(now()); } catch {} }, 3600_000).unref();
  return { handle, session, exportFor, purge, conf };
}
