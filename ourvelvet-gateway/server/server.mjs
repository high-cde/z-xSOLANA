// OurVelvet Gateway v1 · un solo ingresso per viaggi, Velvet Route, richieste, messaggi, token e merito.
// Identità: SOLO la sessione della firma OurVelvet (zdos-firma, cookie zdos_firma / Bearer).
// Nessun pagamento, nessun movimento di fondi: preventivi e lista d'attesa salvati sul server, rimborso L$D e merito solo come PROPOSTA a registro.
// © 2026 ZDOS1.3 · Licenza ZSEL proprietaria.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { check as textCheck, normalize } from "./filter.mjs";
import { TERMS_V, RULES, MODULES, ROUTE, PACKAGE_IDS, EXTRAS, REFUND, MERIT, LEGAL } from "./catalog.mjs";

const E = process.env;
const PORT = +(E.PORT || 8912), HOST = "127.0.0.1";
const DATA = E.GATEWAY_DATA || "/var/lib/zdos-gateway";
const FIRMA = E.FIRMA_URL || "http://127.0.0.1:8905";
const DEFI = E.DEFI_URL || "http://127.0.0.1:4198";
const ZCOMM = E.ZCOMM_URL || "http://127.0.0.1:4192";
const SITE = E.GATEWAY_SITE || "ourvelvet.online";
const ADMIN_KEY = fs.readFileSync(E.GATEWAY_ADMIN_KEY_FILE || "/etc/zdos-gateway/admin.key", "utf8").trim();
const LSD_POOL = "383iZ9nNfnnMtpM6oY7Gu4Nn87EtjwdPikkwctExjkze";
const LSD_MINT = "FSwCz9qgcvfWGEU8QU3h4fQpyQ8TB2KLHYC9bmoMxDgP";
const THIN_USD = 1000; // sotto questa liquidità il cambio L$D è solo indicativo
const CORS_OK = new Set(["https://ourvelvet.online", "https://zx.x-zdos.it", "https://x-zdos.it", "https://velvet.x-zdos.it"]);
const STATI = ["nuova", "in_lavorazione", "preventivo_inviato", "confermata_partner", "completata", "annullata"];
const IP_SALT = crypto.randomBytes(32);
fs.mkdirSync(DATA, { recursive: true, mode: 0o700 });

// ---------- database ----------
const db = new Database(path.join(DATA, "gateway.db"));
db.pragma("journal_mode = WAL"); db.pragma("busy_timeout = 5000"); db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, wallet TEXT NOT NULL, kind TEXT NOT NULL, package TEXT NOT NULL, extras TEXT NOT NULL DEFAULT '[]',
  date_from TEXT, date_to TEXT, pax INTEGER NOT NULL, budget_eur INTEGER, note TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'gateway',
  status TEXT NOT NULL DEFAULT 'nuova', quote_eur REAL, quote_note TEXT, adult_at INTEGER NOT NULL, consent_at INTEGER NOT NULL, terms_v TEXT NOT NULL,
  test INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS req_wallet ON requests(wallet, created);
CREATE INDEX IF NOT EXISTS req_status ON requests(status, created);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT, request TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  author TEXT NOT NULL, staff TEXT, text TEXT NOT NULL, created INTEGER NOT NULL, seen_user INTEGER NOT NULL DEFAULT 0, seen_staff INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY AUTOINCREMENT, request TEXT NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE, wallet TEXT NOT NULL,
  eur REAL NOT NULL, pct REAL NOT NULL, refund_eur REAL NOT NULL, lsd_eur REAL, refund_lsd REAL, pool_tvl_usd REAL, sottile INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'proposta', created INTEGER NOT NULL, note TEXT);
CREATE TABLE IF NOT EXISTS merit(id INTEGER PRIMARY KEY AUTOINCREMENT, request TEXT NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE, wallet TEXT NOT NULL,
  action TEXT NOT NULL, points INTEGER NOT NULL, ovid TEXT, state TEXT NOT NULL DEFAULT 'proposta', created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS staff_log(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, staff TEXT, action TEXT NOT NULL, target TEXT NOT NULL);
`);
const now = () => Math.floor(Date.now() / 1000);
const rid = () => "GW-" + crypto.randomBytes(4).toString("hex").toUpperCase();

// ---------- HTTP ----------
const SEC = { "x-content-type-options": "nosniff", "referrer-policy": "same-origin", "x-frame-options": "DENY" };
function send(res, code, obj, extra = {}) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...SEC, ...extra }); res.end(b);
}
const fail = (res, code, msg, extra) => send(res, code, { ok: false, errore: msg, ...(extra || {}) });
function readJson(req, max = 16384) {
  return new Promise((ok, ko) => {
    const ch = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > max) { ko(Object.assign(new Error("richiesta troppo grande"), { code: 413 })); req.destroy(); return; } ch.push(c); });
    req.on("end", () => { try { ok(JSON.parse(Buffer.concat(ch).toString("utf8") || "{}")); } catch { ko(Object.assign(new Error("JSON non valido"), { code: 400 })); } });
    req.on("error", ko);
  });
}
const ipHash = (req) => crypto.createHmac("sha256", IP_SALT).update(String(req.headers["x-real-ip"] || req.socket.remoteAddress || "?")).digest("hex").slice(0, 24);
const buckets = new Map();
function limited(key, max, winS) {
  const k = key + ":" + Math.floor(Date.now() / 1000 / winS); const c = (buckets.get(k) || 0) + 1; buckets.set(k, c);
  if (buckets.size > 20000) buckets.clear(); return c > max;
}
async function getJson(url, ms = 4000, headers = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { headers, signal: ctl.signal }); return await r.json(); } finally { clearTimeout(t); }
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
    const j = await getJson(FIRMA + "/api/firma/session", 2500, { Authorization: "Bearer " + tok, "X-Forwarded-Host": SITE });
    const s = j && j.ok && j.autenticato === true && j.domain === SITE && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(j.address) ? { address: j.address, expiresAt: j.expiresAt } : null;
    sessCache.set(k, { s, until: Date.now() + (s ? 30000 : 5000) }); if (sessCache.size > 5000) sessCache.clear();
    return s;
  } catch { return null; }
}
async function badge(addr) {
  try { const j = await getJson(FIRMA + "/api/firma/badge?address=" + encodeURIComponent(addr), 2500, { "X-Forwarded-Host": SITE, "X-Real-IP": "127.0.0.2" }); return !!(j && j.verificato); } catch { return false; }
}
async function ovidOf(wallet) {
  try { const j = await getJson(ZCOMM + "/zcomm/api/ovid-by-wallet?wallet=" + encodeURIComponent(wallet), 2500); return j && j.ok && /^OV-[A-Z0-9]{4}-VELVET$/.test(j.ovid || "") ? j.ovid : null; } catch { return null; }
}

// ---------- prezzi reali (zdos-defi + BCE) ----------
let PRICE = null, PRICE_AT = 0, FX = null, FX_AT = 0;
async function prices() {
  const t = Date.now();
  if (!FX || t - FX_AT > 3600e3) {
    try { const j = await getJson("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR", 5000); if (j && j.rates && j.rates.EUR > 0) { FX = { eurPerUsd: j.rates.EUR, data: j.date }; FX_AT = t; } } catch {}
  }
  if (!PRICE || t - PRICE_AT > 60e3) {
    try {
      const j = await getJson(DEFI + "/api/defi/overview", 8000);
      const pool = (j.pools || []).find((p) => p.address === LSD_POOL);
      if (pool && pool.y && pool.y.priceUsd > 0) {
        PRICE = { solUsd: pool.y.priceUsd, lsdSol: pool.priceInY > 0 ? pool.priceInY : null, poolTvlUsd: pool.tvlUsd ?? null, volume24hUsd: pool.volume ? pool.volume["24h"] : null, aggiornato: j.updated || new Date().toISOString() };
        PRICE_AT = t;
      }
    } catch {}
  }
  if (!PRICE || !FX) return { ok: false, errore: "prezzi non disponibili in questo momento", fx: FX, mercato: PRICE };
  const solEur = PRICE.solUsd * FX.eurPerUsd, lsdEur = PRICE.lsdSol ? PRICE.lsdSol * solEur : null;
  return {
    ok: true, eurPerUsd: FX.eurPerUsd, fxData: FX.data, solUsd: PRICE.solUsd, solEur, lsdSol: PRICE.lsdSol, lsdEur, lsdMint: LSD_MINT, pool: LSD_POOL,
    poolTvlUsd: PRICE.poolTvlUsd, volume24hUsd: PRICE.volume24hUsd, sottile: !(PRICE.poolTvlUsd >= THIN_USD), aggiornato: PRICE.aggiornato,
    avviso: !(PRICE.poolTvlUsd >= THIN_USD) ? `Liquidità L$D molto bassa (pool Meteora ~${(PRICE.poolTvlUsd || 0).toFixed(2)} USD): l'equivalente in L$D è solo indicativo, non è un prezzo a cui si può davvero comprare o vendere.` : null,
    fonti: ["zdos-defi (Meteora DLMM, pool L$D-SOL)", "BCE via Frankfurter (USD→EUR)"],
  };
}
function equivalents(eur, p) {
  if (!p.ok || !(eur > 0)) return null;
  return { eur: r2(eur), sol: +(eur / p.solEur).toFixed(4), lsd: p.lsdEur ? Math.round(eur / p.lsdEur) : null, sottile: p.sottile };
}
const r2 = (x) => Math.round(x * 100) / 100;

// ---------- rimborso L$D e merito (solo proposta) ----------
async function refundProposal(wallet, eur, p) {
  const verificato = await badge(wallet), ovid = await ovidOf(wallet);
  const pct = Math.min(REFUND.maxPct, REFUND.basePct + (verificato ? REFUND.bonusFirmaVerificata : 0) + (ovid ? REFUND.bonusProfiloMerito : 0));
  const refundEur = Math.min(REFUND.maxEur, r2((eur * pct) / 100));
  return { pct, refundEur, refundLsd: p.ok && p.lsdEur ? Math.round(refundEur / p.lsdEur) : null, lsdEur: p.ok ? p.lsdEur : null, sottile: p.ok ? p.sottile : true,
    verificato, ovid, stato: REFUND.stato, pagamenti: false };
}
const meritPoints = (eur) => Math.min(MERIT.tetto, MERIT.base + Math.floor((eur || 0) / 100) * MERIT.ogni100Eur);

// ---------- validazione ----------
const SERVICES_RE = [/\bescort\w*/, /\bprostitu\w*/, /\bsesso a pagamento\b/, /\bprestazion\w* (sessual\w*|a pagamento)\b/, /\bsex ?work\w* (a pagamento|prenot\w*)/, /\bhappy ending\b/, /\bprenot\w* (una|la|le|delle) (ragazz|donn|girl|performer|accompagnatric)\w*/, /\baccompagnatric\w*/, /\bbook (a|the) girl\b/, /\bgirl ?friend experience\b/, /\bgfe\b/];
function textOk(t) {
  const a = textCheck(t); if (!a.ok) return a;
  const n = normalize(t);
  for (const r of SERVICES_RE) if (r.test(n)) return { ok: false, motivo: "OurVelvet non organizza, non intermedia e non incassa nulla per prestazioni sessuali, e nessuna persona è prenotabile. Riformula la richiesta: viaggio, alloggi, locali, eventi." };
  return { ok: true };
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function cleanReq(b) {
  const kind = b.kind === "lista_attesa" ? "lista_attesa" : "preventivo";
  const pkg = String(b.package || ""); if (!PACKAGE_IDS.has(pkg)) throw Object.assign(new Error("pacchetto non valido"), { code: 400 });
  const extras = Array.isArray(b.extras) ? [...new Set(b.extras.map(String).filter((x) => EXTRAS.has(x)))].slice(0, 12) : [];
  const df = b.dateFrom ? String(b.dateFrom) : null, dt = b.dateTo ? String(b.dateTo) : null;
  if ((df && !DATE_RE.test(df)) || (dt && !DATE_RE.test(dt))) throw Object.assign(new Error("date non valide"), { code: 400 });
  if (df && dt && dt < df) throw Object.assign(new Error("la data di ritorno è prima della partenza"), { code: 400 });
  const pax = Math.trunc(+b.pax || 0); if (pax < 1 || pax > 15) throw Object.assign(new Error("partecipanti: da 1 a 15 adulti"), { code: 400 });
  const budget = b.budgetEur == null || b.budgetEur === "" ? null : Math.trunc(+b.budgetEur);
  if (budget != null && !(budget >= 50 && budget <= 200000)) throw Object.assign(new Error("budget non valido (50–200.000 €)"), { code: 400 });
  const note = String(b.note || "").slice(0, 1200).trim();
  if (note) { const c = textOk(note); if (!c.ok) throw Object.assign(new Error(c.motivo), { code: 422 }); }
  if (b.adult !== true || b.consent !== true || b.terms !== TERMS_V) throw Object.assign(new Error("servono la conferma 18+, il consenso alle regole (safeword ROSSO) e l'accettazione dei termini " + TERMS_V), { code: 400 });
  const source = ["gateway", "widget-aria", "velvet-route", "zx"].includes(b.source) ? b.source : "gateway";
  return { kind, pkg, extras, df, dt, pax, budget, note, source };
}

// ---------- viste ----------
function reqView(r, withMsgs = true) {
  const o = { id: r.id, tipo: r.kind, pacchetto: r.package, extra: JSON.parse(r.extras), dal: r.date_from, al: r.date_to, adulti: r.pax, budgetEur: r.budget_eur,
    nota: r.note, origine: r.source, stato: r.status, preventivoEur: r.quote_eur, notaPreventivo: r.quote_note, creata: r.created, aggiornata: r.updated, test: !!r.test };
  if (withMsgs) o.messaggi = db.prepare("SELECT author, staff, text, created FROM messages WHERE request=? ORDER BY id").all(r.id).map((m) => ({ da: m.author, testo: m.text, quando: m.created }));
  const l = db.prepare("SELECT * FROM ledger WHERE request=?").get(r.id); if (l) o.rimborso = { pct: l.pct, eur: l.refund_eur, lsd: l.refund_lsd, sottile: !!l.sottile, stato: l.state };
  const m = db.prepare("SELECT points, state FROM merit WHERE request=?").get(r.id); if (m) o.merito = { punti: m.points, stato: m.state };
  return o;
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x"); const p = url.pathname;
  const origin = String(req.headers.origin || "");
  const cors = CORS_OK.has(origin) ? { "access-control-allow-origin": origin, vary: "Origin" } : {};
  try {
    if (p.startsWith("/api/gateway/admin/")) {
      const k = String(req.headers["x-gateway-admin"] || "");
      if (!k || k.length !== ADMIN_KEY.length || !crypto.timingSafeEqual(Buffer.from(k), Buffer.from(ADMIN_KEY))) return fail(res, 404, "non trovato");
      return await admin(req, res, p.slice("/api/gateway/admin".length), url, String(req.headers["x-staff-user"] || "staff").slice(0, 40));
    }
    if (req.method === "OPTIONS") { res.writeHead(204, { ...cors, "access-control-allow-methods": "GET", "access-control-max-age": "600" }); return res.end(); }
    const ip = ipHash(req);
    if (limited(ip, 120, 60)) return fail(res, 429, "troppe richieste, riprova tra un minuto");

    if (req.method === "GET" && p === "/api/gateway/health") return send(res, 200, { ok: true, servizio: "zdos-gateway", versione: 1, pagamenti: false, richieste: db.prepare("SELECT COUNT(*) n FROM requests WHERE test=0").get().n });
    if (req.method === "GET" && p === "/api/gateway/catalog") return send(res, 200, { ok: true, termini: TERMS_V, regole: RULES, moduli: MODULES, route: ROUTE, rimborso: REFUND, merito: MERIT, legale: LEGAL }, cors);
    if (req.method === "GET" && p === "/api/gateway/prices") return send(res, 200, await prices(), cors);
    if (req.method === "GET" && p === "/api/gateway/convert") {
      const eur = +url.searchParams.get("eur"); if (!(eur > 0 && eur <= 200000)) return fail(res, 400, "importo non valido");
      const pr = await prices(); const pct = REFUND.basePct, refundEur = Math.min(REFUND.maxEur, r2(eur * pct / 100));
      return send(res, 200, { ok: true, equivalenti: equivalents(eur, pr), rimborsoBase: { pct, eur: refundEur, lsd: pr.ok && pr.lsdEur ? Math.round(refundEur / pr.lsdEur) : null, stato: REFUND.stato, nota: "Percentuale base; +1% con badge «wallet verificato», +1% con profilo merito OV, massimo 5% e 150 €." }, avviso: pr.avviso || null }, cors);
    }

    const me = await session(req);
    if (p === "/api/gateway/me" && req.method === "GET") {
      if (!me) return send(res, 200, { ok: true, autenticato: false });
      const n = db.prepare("SELECT COUNT(*) n FROM requests WHERE wallet=?").get(me.address).n;
      const unread = db.prepare("SELECT COUNT(*) n FROM messages m JOIN requests r ON r.id=m.request WHERE r.wallet=? AND m.author='staff' AND m.seen_user=0").get(me.address).n;
      return send(res, 200, { ok: true, autenticato: true, address: me.address, scade: me.expiresAt, richieste: n, nonLetti: unread });
    }
    if (!me) return fail(res, 401, "Accedi con OurVelvet (firma wallet) per continuare.");
    // anti-CSRF: le richieste che cambiano dati devono arrivare dalle nostre pagine (header custom = preflight obbligatorio cross-origin)
    if (req.method !== "GET" && (req.headers["x-ov-gateway"] !== "1" || (origin && origin !== "https://" + SITE))) return fail(res, 403, "richiesta non ammessa");

    if (p === "/api/gateway/requests" && req.method === "GET") {
      const rows = db.prepare("SELECT * FROM requests WHERE wallet=? ORDER BY created DESC LIMIT 50").all(me.address);
      db.prepare("UPDATE messages SET seen_user=1 WHERE author='staff' AND request IN (SELECT id FROM requests WHERE wallet=?)").run(me.address);
      const pr = await prices();
      return send(res, 200, { ok: true, richieste: rows.map((r) => { const v = reqView(r); if (r.quote_eur) v.equivalenti = equivalents(r.quote_eur, pr); return v; }) });
    }
    if (p === "/api/gateway/requests" && req.method === "POST") {
      if (limited("w:" + me.address, 5, 3600) || limited("ip:" + ip, 8, 3600)) return fail(res, 429, "hai già inviato diverse richieste nell'ultima ora: rispondiamo a quelle prima");
      const open = db.prepare("SELECT COUNT(*) n FROM requests WHERE wallet=? AND status IN ('nuova','in_lavorazione','preventivo_inviato')").get(me.address).n;
      if (open >= 5) return fail(res, 409, "hai già 5 richieste aperte");
      const c = cleanReq(await readJson(req)); const t = now(); const id = rid();
      const test = /\[test\]/i.test(c.note) ? 1 : 0;
      db.prepare(`INSERT INTO requests(id,wallet,kind,package,extras,date_from,date_to,pax,budget_eur,note,source,status,adult_at,consent_at,terms_v,test,created,updated)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,'nuova',?,?,?,?,?,?)`).run(id, me.address, c.kind, c.pkg, JSON.stringify(c.extras), c.df, c.dt, c.pax, c.budget, c.note, c.source, t, t, TERMS_V, test, t, t);
      db.prepare("INSERT INTO messages(request,author,text,created,seen_user) VALUES(?,?,?,?,0)").run(id, "staff",
        "Richiesta ricevuta. La giriamo a un partner autorizzato e ti rispondiamo qui con un preventivo in euro. Nessun pagamento viene chiesto in questa fase.", t);
      const pr = await prices();
      const out = { ok: true, id, stato: "nuova" };
      if (c.budget) { out.equivalenti = equivalents(c.budget, pr); out.rimborsoProposto = await refundProposal(me.address, c.budget, pr); }
      return send(res, 201, out);
    }
    let m;
    if ((m = p.match(/^\/api\/gateway\/requests\/(GW-[0-9A-F]{8})\/messages$/)) && req.method === "POST") {
      const r = db.prepare("SELECT * FROM requests WHERE id=? AND wallet=?").get(m[1], me.address); if (!r) return fail(res, 404, "richiesta non trovata");
      if (limited("m:" + me.address, 20, 3600)) return fail(res, 429, "troppi messaggi, riprova più tardi");
      const b = await readJson(req, 4096); const text = String(b.testo || "").trim().slice(0, 1000); if (!text) return fail(res, 400, "messaggio vuoto");
      const c = textOk(text); if (!c.ok) return fail(res, 422, c.motivo);
      db.prepare("INSERT INTO messages(request,author,text,created,seen_user) VALUES(?,?,?,?,1)").run(r.id, "utente", text, now());
      db.prepare("UPDATE requests SET updated=? WHERE id=?").run(now(), r.id);
      return send(res, 201, { ok: true });
    }
    if ((m = p.match(/^\/api\/gateway\/requests\/(GW-[0-9A-F]{8})\/cancel$/)) && req.method === "POST") {
      const r = db.prepare("SELECT * FROM requests WHERE id=? AND wallet=?").get(m[1], me.address); if (!r) return fail(res, 404, "richiesta non trovata");
      if (["completata", "annullata"].includes(r.status)) return fail(res, 409, "la richiesta è già chiusa");
      db.prepare("UPDATE requests SET status='annullata', updated=? WHERE id=?").run(now(), r.id);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/gateway/me/data" && req.method === "DELETE") {
      const n = db.prepare("DELETE FROM requests WHERE wallet=?").run(me.address).changes;
      return send(res, 200, { ok: true, cancellate: n });
    }
    return fail(res, 404, "non trovato");
  } catch (e) {
    const code = e.code && Number.isInteger(e.code) ? e.code : 500; if (code === 500) console.error("[gateway]", e);
    return fail(res, code, code === 500 ? "errore interno" : e.message);
  }
});

async function admin(req, res, p, url, staff) {
  const log = (action, target) => db.prepare("INSERT INTO staff_log(ts,staff,action,target) VALUES(?,?,?,?)").run(now(), staff, action, target);
  if (p === "/requests" && req.method === "GET") {
    const st = url.searchParams.get("stato"); const rows = st && STATI.includes(st) ? db.prepare("SELECT * FROM requests WHERE status=? ORDER BY updated DESC LIMIT 200").all(st) : db.prepare("SELECT * FROM requests ORDER BY updated DESC LIMIT 200").all();
    const unread = db.prepare("SELECT request, COUNT(*) n FROM messages WHERE author='utente' AND seen_staff=0 GROUP BY request").all(); const um = Object.fromEntries(unread.map((u) => [u.request, u.n]));
    return send(res, 200, { ok: true, stati: STATI, richieste: rows.map((r) => ({ ...reqView(r, false), wallet: r.wallet, nonLetti: um[r.id] || 0 })) });
  }
  let m;
  if ((m = p.match(/^\/requests\/(GW-[0-9A-F]{8})$/)) && req.method === "GET") {
    const r = db.prepare("SELECT * FROM requests WHERE id=?").get(m[1]); if (!r) return fail(res, 404, "non trovata");
    db.prepare("UPDATE messages SET seen_staff=1 WHERE request=? AND author='utente'").run(r.id);
    const pr = await prices(); const v = { ...reqView(r), wallet: r.wallet };
    if (r.quote_eur) { v.equivalenti = equivalents(r.quote_eur, pr); v.rimborsoProposto = await refundProposal(r.wallet, r.quote_eur, pr); v.meritoProposto = meritPoints(r.quote_eur); }
    return send(res, 200, { ok: true, richiesta: v });
  }
  if ((m = p.match(/^\/requests\/(GW-[0-9A-F]{8})\/messages$/)) && req.method === "POST") {
    const r = db.prepare("SELECT * FROM requests WHERE id=?").get(m[1]); if (!r) return fail(res, 404, "non trovata");
    const b = await readJson(req, 4096); const text = String(b.testo || "").trim().slice(0, 2000); if (!text) return fail(res, 400, "messaggio vuoto");
    db.prepare("INSERT INTO messages(request,author,staff,text,created,seen_staff) VALUES(?,?,?,?,?,1)").run(r.id, "staff", staff, text, now());
    db.prepare("UPDATE requests SET updated=? WHERE id=?").run(now(), r.id); log("messaggio", r.id);
    return send(res, 201, { ok: true });
  }
  if ((m = p.match(/^\/requests\/(GW-[0-9A-F]{8})\/status$/)) && req.method === "POST") {
    const r = db.prepare("SELECT * FROM requests WHERE id=?").get(m[1]); if (!r) return fail(res, 404, "non trovata");
    const b = await readJson(req, 4096); const st = String(b.stato || ""); if (!STATI.includes(st)) return fail(res, 400, "stato non valido");
    let q = r.quote_eur; if (b.preventivoEur != null && b.preventivoEur !== "") { q = +b.preventivoEur; if (!(q > 0 && q <= 500000)) return fail(res, 400, "preventivo non valido"); }
    const qn = b.notaPreventivo != null ? String(b.notaPreventivo).slice(0, 600) : r.quote_note;
    if (st === "completata" && !(q > 0)) return fail(res, 400, "per completare serve l'importo confermato in euro");
    const t = now();
    db.prepare("UPDATE requests SET status=?, quote_eur=?, quote_note=?, updated=? WHERE id=?").run(st, q || null, qn || null, t, r.id); log("stato:" + st, r.id);
    if (st === "preventivo_inviato" && q > 0 && r.status !== "preventivo_inviato")
      db.prepare("INSERT INTO messages(request,author,staff,text,created,seen_staff) VALUES(?,?,?,?,?,1)").run(r.id, "staff", staff, `Preventivo: ${q.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}${qn ? " · " + qn : ""}. Il pagamento si fa solo con il partner autorizzato indicato nel preventivo.`, t);
    let reg = null;
    if (st === "completata" && !r.test) {
      const pr = await prices(); const rf = await refundProposal(r.wallet, q, pr); const pts = meritPoints(q);
      db.prepare(`INSERT OR IGNORE INTO ledger(request,wallet,eur,pct,refund_eur,lsd_eur,refund_lsd,pool_tvl_usd,sottile,state,created,note) VALUES(?,?,?,?,?,?,?,?,?,'proposta',?,?)`)
        .run(r.id, r.wallet, q, rf.pct, rf.refundEur, rf.lsdEur, rf.refundLsd, pr.ok ? pr.poolTvlUsd : null, rf.sottile ? 1 : 0, t, "rimborso L$D proposto, da confermare con doc; nessun pagamento automatico");
      db.prepare("INSERT OR IGNORE INTO merit(request,wallet,action,points,ovid,state,created) VALUES(?,?,?,?,?,'proposta',?)").run(r.id, r.wallet, MERIT.azione, pts, rf.ovid, t);
      reg = { rimborso: rf, merito: pts };
    }
    return send(res, 200, { ok: true, registro: reg });
  }
  if (p === "/ledger" && req.method === "GET") {
    return send(res, 200, { ok: true, nota: "Solo proposte. Nessun pagamento parte da qui: ogni rimborso va confermato e firmato da doc.",
      rimborsi: db.prepare("SELECT request, wallet, eur, pct, refund_eur, refund_lsd, sottile, state, created FROM ledger ORDER BY id DESC LIMIT 200").all(),
      merito: db.prepare("SELECT request, wallet, action, points, ovid, state, created FROM merit ORDER BY id DESC LIMIT 200").all() });
  }
  if (p === "/stats" && req.method === "GET") return send(res, 200, { ok: true, perStato: db.prepare("SELECT status, COUNT(*) n FROM requests GROUP BY status").all() });
  return fail(res, 404, "non trovato");
}

server.listen(PORT, HOST, () => console.log(`[gateway] in ascolto su ${HOST}:${PORT}`));
