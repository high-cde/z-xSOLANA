// Test adattatore TikTok di zdos-social contro un finto TikTok/firma locale (nessuna chiamata a TikTok, nessun dato reale).
// Uso: node test-tiktok.mjs  (avvia da solo mock e istanza di prova con dati temporanei)
import http from "node:http"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto"; import { spawn } from "node:child_process";
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "tt-test-")); const MP = 8991, SP = 8992;
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
let pass = 0, fail = 0; const t = (n, ok, x = "") => { (ok ? pass++ : fail++); console.log((ok ? "PASS " : "FAIL ") + n + (x ? "  → " + x : "")); };
const WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
// ---- mock: TikTok + firma ----
const seen = { token: [], revoke: [], info: [] }; let mode = "ok", openId = "oid-test-1", ACCESS = "act.TESTACCESS" + crypto.randomBytes(8).toString("hex"), REFRESH = "rft.TESTREFRESH" + crypto.randomBytes(8).toString("hex");
const mock = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"); let body = ""; for await (const c of req) body += c;
  const J = (c, o) => { res.writeHead(c, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (u.pathname === "/api/firma/session") { const tok = String(req.headers.authorization || "").slice(7); return tok === "wallet-A" ? J(200, { ok: true, autenticato: true, address: WALLET, domain: "ourvelvet.online", expiresAt: new Date(Date.now() + 3600e3).toISOString() }) : J(401, { ok: false }); }
  if (u.pathname === "/api/firma/badge") return J(200, { ok: true, verificato: false });
  if (u.pathname === "/v2/oauth/token/") { const f = Object.fromEntries(new URLSearchParams(body)); seen.token.push(f); if (mode === "tokfail") return J(400, { error: "invalid_grant", error_description: "x" }); return J(200, { access_token: ACCESS, expires_in: 7200, open_id: openId, refresh_expires_in: 15552000, refresh_token: REFRESH, scope: "user.info.basic", token_type: "Bearer" }); }
  if (u.pathname === "/v2/user/info/") { seen.info.push({ auth: req.headers.authorization, fields: u.searchParams.get("fields") }); return J(200, { data: { user: { open_id: openId, display_name: "Utente <b>Prova</b>", avatar_url: "https://p16.tiktokcdn.com/x.jpeg" } }, error: { code: "ok", message: "" } }); }
  if (u.pathname === "/v2/oauth/revoke/") { seen.revoke.push(Object.fromEntries(new URLSearchParams(body))); return J(200, {}); }
  J(404, {});
}); await new Promise((r) => mock.listen(MP, "127.0.0.1", r));
// ---- istanza di prova ----
const CONF = path.join(DIR, "tiktok.json"), SEC = path.join(DIR, "tiktok.secret"), AK = path.join(DIR, "admin.key");
fs.writeFileSync(AK, "x".repeat(40)); fs.writeFileSync(SEC, ""); fs.writeFileSync(CONF, JSON.stringify({ client_key: "", enabled: false }));
const srv = spawn("node", ["server.mjs"], { cwd: process.cwd(), env: { ...process.env, PORT: String(SP), SOCIAL_DATA: DIR, SOCIAL_ADMIN_KEY_FILE: AK, FIRMA_URL: "http://127.0.0.1:" + MP, ZCOMM_URL: "http://127.0.0.1:1", TIKTOK_CONFIG: CONF, TIKTOK_SECRET_FILE: SEC, TIKTOK_AUTH_URL: "http://127.0.0.1:" + MP + "/auth", TIKTOK_API: "http://127.0.0.1:" + MP }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => (log += d)); srv.stderr.on("data", (d) => (log += d));
await new Promise((r) => setTimeout(r, 1800));
const B = "http://127.0.0.1:" + SP, H = { Origin: "https://ourvelvet.online", "X-OV-Social": "1" };
const call = async (m, p, { headers = {}, body, redirect = "manual" } = {}) => { const r = await fetch(B + p, { method: m, headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body && JSON.stringify(body), redirect }); const tx = await r.text(); let j = null; try { j = JSON.parse(tx); } catch {} return { st: r.status, j, h: r.headers, loc: r.headers.get("location"), sc: r.headers.getSetCookie ? r.headers.getSetCookie() : [] }; };
const ck = (sc, n) => ((sc.find((c) => c.startsWith(n + "=")) || "").split(";")[0].split("=")[1]) || "";
function enable(extra = {}) { fs.writeFileSync(SEC, "S".repeat(40)); fs.writeFileSync(CONF, JSON.stringify({ client_key: "TESTKEY12345", enabled: true, ...extra })); }
async function flow({ cookies = "", nonceOverride, stateOverride, query = "", next = "/creator-radar/" } = {}) {
  const s = await call("GET", "/api/social/tiktok/start?next=" + encodeURIComponent(next), { headers: { cookie: cookies, accept: "text/html" } });
  const loc = new URL(s.loc); const state = loc.searchParams.get("state"); const nonce = ck(s.sc, "zdos_tt_st");
  return { s, loc, state, nonce };
}
try {
  // 1. spento
  let r = await call("GET", "/api/social/tiktok/status"); t("spento: status attivo=false / in_attivazione", r.j && r.j.attivo === false && r.j.stato === "in_attivazione");
  r = await call("GET", "/api/social/tiktok/start", { headers: { accept: "text/html" } }); t("spento: /start da browser torna con ?tiktok=in_attivazione", r.st === 302 && /tiktok=in_attivazione/.test(r.loc), r.loc);
  r = await call("GET", "/api/social/tiktok/start"); t("spento: /start JSON = 503", r.st === 503);
  fs.writeFileSync(CONF, JSON.stringify({ client_key: "TESTKEY12345", enabled: true })); await new Promise((x) => setTimeout(x, 5200));
  r = await call("GET", "/api/social/tiktok/status"); t("enabled senza secret: resta spento", r.j.attivo === false);
  // 2. acceso con PKCE
  enable({ pkce: true }); await new Promise((x) => setTimeout(x, 5200));
  r = await call("GET", "/api/social/tiktok/status"); t("acceso: attivo=true", r.j.attivo === true && r.j.scope === "user.info.basic");
  let f = await flow();
  const P = f.loc.searchParams;
  t("authorize: URL, client_key, scope, response_type, redirect_uri", f.s.st === 302 && f.loc.pathname === "/auth" && P.get("client_key") === "TESTKEY12345" && P.get("scope") === "user.info.basic" && P.get("response_type") === "code" && P.get("redirect_uri") === "https://ourvelvet.online/api/social/tiktok/callback");
  t("authorize: state casuale ≥ 32 car. + PKCE S256", f.state.length >= 32 && P.get("code_challenge_method") === "S256" && /^[0-9a-f]{64}$/.test(P.get("code_challenge")));
  const stc = f.s.sc.find((c) => c.startsWith("zdos_tt_st=")) || ""; t("cookie nonce: HttpOnly, Secure, SameSite=Lax, 10 min", /HttpOnly/.test(stc) && /Secure/.test(stc) && /SameSite=Lax/.test(stc) && /Max-Age=600/.test(stc));
  // 3. CSRF
  r = await call("GET", "/api/social/tiktok/callback?code=abc12345&state=" + f.state); t("callback senza cookie nonce rifiutata", /tiktok=errore/.test(r.loc) && !ck(r.sc, "zdos_tt"));
  r = await call("GET", "/api/social/tiktok/callback?code=abc12345&state=" + f.state, { headers: { cookie: "zdos_tt_st=" + f.nonce } }); t("state già consumato (anche se la prima era fallita): rifiutato", /tiktok=errore/.test(r.loc));
  f = await flow(); r = await call("GET", "/api/social/tiktok/callback?code=abc12345&state=" + f.state, { headers: { cookie: "zdos_tt_st=" + "A".repeat(32) } }); t("nonce di un altro browser rifiutato", /tiktok=errore/.test(r.loc));
  r = await call("GET", "/api/social/tiktok/callback?code=abc12345&state=inventato1234567890"); t("state inventato rifiutato", /tiktok=errore/.test(r.loc));
  f = await flow(); r = await call("GET", "/api/social/tiktok/callback?error=access_denied&state=" + f.state, { headers: { cookie: "zdos_tt_st=" + f.nonce } }); t("utente nega: ?tiktok=negato, nessuna sessione", /tiktok=negato/.test(r.loc) && !ck(r.sc, "zdos_tt"));
  f = await flow({ next: "//evil.example/x" }); r = await call("GET", "/api/social/tiktok/callback?error=access_denied&state=" + f.state, { headers: { cookie: "zdos_tt_st=" + f.nonce } }); t("open redirect bloccato (next=//evil)", r.loc.startsWith("/creator-radar/"), r.loc);
  mode = "tokfail"; f = await flow(); r = await call("GET", "/api/social/tiktok/callback?code=abc12345&state=" + f.state, { headers: { cookie: "zdos_tt_st=" + f.nonce } }); t("scambio codice fallito: errore, nessuna sessione", /tiktok=errore/.test(r.loc) && !ck(r.sc, "zdos_tt")); mode = "ok";
  // 4. flusso completo solo-social
  seen.token.length = 0; seen.revoke.length = 0; f = await flow({ next: "/creator/z-sound/#pubblica" });
  r = await call("GET", "/api/social/tiktok/callback?code=CODE%2Fxyz_12345&state=" + f.state + "&scopes=user.info.basic", { headers: { cookie: "zdos_tt_st=" + f.nonce } });
  const tt1 = ck(r.sc, "zdos_tt");
  t("callback ok: 302 su next con ?tiktok=ok e fragment", r.st === 302 && r.loc === "/creator/z-sound/?tiktok=ok#pubblica", r.loc);
  t("sessione: cookie HttpOnly Secure Lax", !!tt1 && /HttpOnly/.test(r.sc.find((c) => c.startsWith("zdos_tt=")) || "") && /Secure/.test(r.sc.join(";")));
  const tk = seen.token[0] || {}; t("scambio: client_secret solo server, grant_type, redirect_uri, code decodificato", tk.client_secret === "S".repeat(40) && tk.grant_type === "authorization_code" && tk.code === "CODE/xyz_12345" && tk.redirect_uri === "https://ourvelvet.online/api/social/tiktok/callback");
  t("PKCE: sha256(code_verifier) = code_challenge", sha(tk.code_verifier || "") === f.loc.searchParams.get("code_challenge"));
  t("user info chiesto con Bearer e campi minimi", seen.info.at(-1).auth === "Bearer " + ACCESS && seen.info.at(-1).fields === "open_id,display_name,avatar_url");
  await new Promise((x) => setTimeout(x, 300)); t("access token revocato subito", seen.revoke.length === 1 && seen.revoke[0].token === ACCESS);
  // nessun token salvato
  for (const e of ["", "-wal", "-shm"]) { try { const raw = fs.readFileSync(path.join(DIR, "social.db" + e)).toString("latin1"); t("db" + e + ": nessun access/refresh token", !raw.includes(ACCESS) && !raw.includes(REFRESH) && !raw.includes("S".repeat(40))); } catch {} }
  r = await call("GET", "/api/social/me", { headers: { cookie: "zdos_tt=" + tt1 } }); const ident = r.j.address;
  t("/me con sessione TikTok: autenticato, identità tt:, nessun profilo", r.j.autenticato === true && /^tt:[0-9a-f]{32}$/.test(ident) && r.j.profilo === null, ident);
  r = await call("GET", "/api/social/tiktok/me", { headers: { cookie: "zdos_tt=" + tt1 } }); t("/tiktok/me: solo-social, nome ripulito dai tag HTML", r.j.collegato && r.j.tipo === "social" && r.j.nome === "Utente Prova", r.j.nome);
  // 18+ gate
  const C = { cookie: "zdos_tt=" + tt1, ...H };
  r = await call("PUT", "/api/social/me/profile", { headers: C, body: { handle: "tt_prova_1", bio: "Prova.", cats: ["Arte"] } }); t("account TikTok senza 18+/termini/consenso: profilo rifiutato (400)", r.st === 400, r.j && r.j.errore);
  r = await call("POST", "/api/social/posts", { headers: C, body: { text: "ciao" } }); t("account TikTok senza profilo non può pubblicare (403)", r.st === 403);
  r = await call("PUT", "/api/social/me/profile", { headers: C, body: { handle: "tt_prova_1", bio: "Profilo di prova per il test automatico, solo adulti.", cats: ["Arte"], maggiorenne: true, termini: true, consenso: true } }); t("con 18+/termini/consenso: profilo creato (201)", r.st === 201, JSON.stringify(r.j).slice(0, 120));
  r = await call("POST", "/api/social/tiktok/logout", { headers: { cookie: "zdos_tt=" + tt1 } }); t("logout senza X-OV-Social rifiutato (CSRF)", r.st === 403);
  // 5. login di ritorno stesso TikTok
  f = await flow(); r = await call("GET", "/api/social/tiktok/callback?code=CODE2_12345&state=" + f.state, { headers: { cookie: "zdos_tt_st=" + f.nonce } }); const tt2 = ck(r.sc, "zdos_tt");
  r = await call("GET", "/api/social/me", { headers: { cookie: "zdos_tt=" + tt2 } }); t("secondo login: stessa identità e profilo", r.j.address === ident && r.j.profilo && r.j.profilo.handle === "tt_prova_1");
  // 6. collegamento a un wallet
  openId = "oid-test-2"; f = await flow({ cookies: "zdos_firma=wallet-A" }); r = await call("GET", "/api/social/tiktok/callback?code=CODE3_12345&state=" + f.state, { headers: { cookie: "zdos_tt_st=" + f.nonce + "; zdos_firma=wallet-A" } });
  t("collegamento con sessione firma: ?tiktok=collegato, nessun cookie di sessione TikTok", /tiktok=collegato/.test(r.loc) && !ck(r.sc, "zdos_tt"), r.loc);
  r = await call("GET", "/api/social/tiktok/me", { headers: { cookie: "zdos_firma=wallet-A" } }); t("/tiktok/me via wallet: collegato tipo wallet", r.j.collegato === true && r.j.tipo === "wallet" && r.j.via === "firma");
  f = await flow(); r = await call("GET", "/api/social/tiktok/callback?code=CODE4_12345&state=" + f.state, { headers: { cookie: "zdos_tt_st=" + f.nonce } }); t("TikTok legato a un wallet: l'accesso senza firma NON dà il wallet (gia_collegato)", /tiktok=gia_collegato/.test(r.loc) && !ck(r.sc, "zdos_tt"));
  openId = "oid-test-1"; f = await flow({ cookies: "zdos_firma=wallet-A" }); r = await call("GET", "/api/social/tiktok/callback?code=CODE5_12345&state=" + f.state, { headers: { cookie: "zdos_tt_st=" + f.nonce + "; zdos_firma=wallet-A" } }); t("TikTok già usato da un account solo-social: non si collega a un altro profilo", /tiktok=altro_profilo/.test(r.loc), r.loc);
  openId = "oid-test-2"; f = await flow({ cookies: "zdos_firma=wallet-A" }); r = await call("GET", "/api/social/tiktok/callback?code=CODE6_12345&state=" + f.state, { headers: { cookie: "zdos_tt_st=" + f.nonce } }); t("collegamento senza sessione firma al ritorno: rifiutato", /tiktok=gia_collegato|tiktok=errore/.test(r.loc) && !ck(r.sc, "zdos_tt"), r.loc);
  // 7. scollega, export, cancellazione
  r = await call("DELETE", "/api/social/tiktok/link", { headers: { cookie: "zdos_firma=wallet-A", ...H } }); t("scollega TikTok dal wallet", r.j.ok && r.j.scollegati === 1);
  r = await call("GET", "/api/social/me/export", { headers: { cookie: "zdos_tt=" + tt2 } }); t("export GDPR include il collegamento TikTok", Array.isArray(r.j.tiktok) && r.j.tiktok.length === 1 && r.j.tiktok[0].kind === "social");
  r = await call("DELETE", "/api/social/me", { headers: { cookie: "zdos_tt=" + tt2, ...H }, body: { conferma: "ELIMINA" } }); t("cancellazione profilo", r.st === 200, JSON.stringify(r.j));
  const db = (await import("better-sqlite3")).default; const d = new db(path.join(DIR, "social.db"), { readonly: true });
  t("cancellazione: link e sessioni TikTok eliminati", d.prepare("SELECT COUNT(*) n FROM tiktok_links WHERE identity=?").get(ident).n === 0 && d.prepare("SELECT COUNT(*) n FROM tiktok_sessions WHERE identity=?").get(ident).n === 0);
  t("nessuna riga 'tiktok_links' con colonne token", !d.prepare("PRAGMA table_info(tiktok_links)").all().some((c) => /token|refresh|secret/i.test(c.name)));
  // 8. spegnimento a caldo
  fs.writeFileSync(CONF, JSON.stringify({ client_key: "TESTKEY12345", enabled: false })); await new Promise((x) => setTimeout(x, 5200));
  r = await call("GET", "/api/social/tiktok/status"); t("spegnimento a caldo (enabled:false)", r.j.attivo === false);
} catch (e) { t("eccezione", false, e.stack); }
srv.kill("SIGTERM"); mock.close(); fs.rmSync(DIR, { recursive: true, force: true });
console.log(`\n${pass} PASS, ${fail} FAIL`); if (fail) console.log(log.slice(-1500)); process.exit(fail ? 1 : 0);
