// zcomm · bus eventi firmato tra ZDOS e OurVelvet, e calcolo del merito VELVET.
// Solo dati reali: Radar (profili, inviti, verifiche, RSVP stanze), zNFT (opere certificate),
// ZQuest (quest fatte), zdiscord (collegamenti ruolo). Nessun dato inventato.
// Il merito è un premio per contributi verificabili, con tetto: non è un rendimento,
// non dipende dal saldo (il bonus holder è a scaglioni, con tetto, e vale solo se ci sono punti).
// © 2026 ZDOS1.3 · Licenza ZSEL proprietaria.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";

export const E = process.env;
export const CFG_PATH = E.MERITO_CONFIG || "/etc/zdos-fondo-merito/config.json";
export const PATHS = {
  data: E.ZCOMM_DATA || "/var/lib/zcomm",
  hmac: E.ZCOMM_KEY_FILE || "/etc/zcomm/hmac.key",
  radar: E.RADAR_DB || "/var/lib/velvet-radar/radar.db",
  znft: E.ZNFT_DB || "/var/lib/znft/znft.db",
  zquest: E.ZQUEST_DB || "/opt/zquest/data/zquest.sqlite",
  stop: E.MERITO_STOP_FILE || "/etc/zdos-fondo-merito/STOP",
};
export const RPC = [E.SOLANA_RPC_URL, "https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"].filter(Boolean);
export const OVID_RE = /^OV-[A-Z0-9]{4}-VELVET$/;
export const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const DAY = 86400;

export function loadConfig() {
  const c = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
  // Valori di sicurezza se mancano (mai più permissivi del config).
  c.merit = c.merit || {};
  return c;
}
export function killSwitch(cfg) {
  if (!cfg.emissionsLive) return "emissionsLive=false nel config";
  if (fs.existsSync(PATHS.stop)) return "file STOP presente (" + PATHS.stop + ")";
  if (!cfg.wallet || !cfg.wallet.signingEnabled) return "firma disattivata (wallet.signingEnabled=false)";
  return null;
}

// ---------- ora di Roma ----------
const fmtRome = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short" });
export function romeParts(ts) {
  const o = {}; for (const p of fmtRome.formatToParts(new Date(ts * 1000))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, H: +o.hour, M: +o.minute, S: +o.second, wd: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(o.weekday) };
}
function romeOffset(ts) { const p = romeParts(ts); return Date.UTC(p.y, p.m - 1, p.d, p.H, p.M, p.S) / 1000 - ts; }
export function romeMidnight(y, m, d) { const guess = Date.UTC(y, m - 1, d) / 1000; let t = guess - romeOffset(guess); t = guess - romeOffset(t); return t; }
export function dayKey(ts) { const p = romeParts(ts); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; }
export function weekStart(ts) { const p = romeParts(ts); const mid = romeMidnight(p.y, p.m, p.d); const back = romeParts(mid - p.wd * DAY + 7200); return romeMidnight(back.y, back.m, back.d); }
export function weekId(ts) {
  const ws = weekStart(ts); const p = romeParts(ws + 3 * DAY + 7200); // giovedì della settimana (ISO)
  const jan4 = romeMidnight(p.y, 1, 4); const w1 = weekStart(jan4);
  return `${p.y}-W${String(Math.round((ws - w1) / (7 * DAY)) + 1).padStart(2, "0")}`;
}
export function fmtRomeTs(ts) { const p = romeParts(ts); return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y} ${String(p.H).padStart(2, "0")}:${String(p.M).padStart(2, "0")}`; }
export const now = () => Math.floor(Date.now() / 1000);
export function parseStart(cfg) { const s = cfg.calendar && cfg.calendar.startAt; if (!s) return null; const t = Date.parse(s); return Number.isFinite(t) ? Math.floor(t / 1000) : null; }

// Calendario: settimane da lunedì 00:00 Roma. La settimana 1 è quella che contiene startAt.
export function calendarInfo(cfg, ts = now()) {
  const start = parseStart(cfg);
  const sems = (cfg.calendar && cfg.calendar.semesters) || [];
  if (!start) return { started: false, start: null, semesters: sems };
  const w0 = weekStart(start); const idx = Math.floor((weekStart(ts) - w0) / (7 * DAY));
  const semIdx = Math.floor(idx / 26);
  return { started: ts >= start, start, week0: w0, weekIndex: idx, weekNo: idx + 1, semesterIndex: semIdx, semester: sems[semIdx] || null, semesters: sems, end: w0 + 104 * 7 * DAY };
}

// ---------- HMAC ----------
export function readKey(create = false) {
  if (fs.existsSync(PATHS.hmac)) return fs.readFileSync(PATHS.hmac, "utf8").trim();
  if (!create) throw new Error("chiave HMAC zcomm assente");
  fs.mkdirSync(path.dirname(PATHS.hmac), { recursive: true, mode: 0o750 });
  const k = crypto.randomBytes(32).toString("hex"); fs.writeFileSync(PATHS.hmac, k + "\n", { mode: 0o640 }); return k;
}
export function sign(key, ts, body) { return crypto.createHmac("sha256", key).update(String(ts) + "." + body).digest("hex"); }
export function verifySig(key, ts, body, sig) {
  if (!/^[0-9a-f]{64}$/.test(String(sig || ""))) return false;
  if (Math.abs(now() - Number(ts)) > 300) return false;
  const a = Buffer.from(sign(key, ts, body), "hex"); const b = Buffer.from(sig, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- registro zcomm ----------
export const EVENT_TYPES = new Set(["profile_created", "role_set", "invite_accepted", "profile_verified", "invitee_verified", "profile_revoked",
  "stage_rsvp", "work_certified", "quest_done", "discord_linked", "discord_unlinked", "payout_planned", "payout_sent", "payout_held", "badge_verified",
  // Filiera ZDOS (senza attore: non generano punti merito né VELVET)
  "work_proof", "vchain_root", "service_health", "pool_snapshot"]);
export const SOURCES = new Set(["radar", "badge", "znft", "zquest", "zdiscord", "zara-bot", "telegram", "merito", "zminer", "filiera", "vchain", "zpool", "zbasket", "dex", "vcpu", "kira"]);

export function openDb() {
  fs.mkdirSync(PATHS.data, { recursive: true });
  const db = new Database(path.join(PATHS.data, "zcomm.db"));
  db.pragma("journal_mode = WAL"); db.pragma("busy_timeout = 5000");
  db.exec(`
CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, type TEXT NOT NULL, source TEXT NOT NULL,
  actor TEXT, subject TEXT, data TEXT NOT NULL DEFAULT '{}', ts INTEGER NOT NULL, received INTEGER NOT NULL, sig TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS events_actor ON events(actor, ts);
CREATE INDEX IF NOT EXISTS events_type ON events(type, ts);
CREATE TABLE IF NOT EXISTS batches(week TEXT PRIMARY KEY, week_start INTEGER NOT NULL, week_end INTEGER NOT NULL, semester INTEGER, pool_atomic TEXT NOT NULL,
  per_profile_max_atomic TEXT NOT NULL, total_points REAL NOT NULL, status TEXT NOT NULL, note TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS payouts(id INTEGER PRIMARY KEY AUTOINCREMENT, week TEXT NOT NULL, ovid TEXT NOT NULL, wallet TEXT, points REAL NOT NULL, amount_atomic TEXT NOT NULL,
  status TEXT NOT NULL, reason TEXT, dry_run TEXT, signature TEXT UNIQUE, created INTEGER NOT NULL, updated INTEGER NOT NULL, UNIQUE(week, ovid));
`);
  return db;
}
export function publish(db, key, ev) {
  // Ogni evento è firmato (HMAC) e verificato prima di entrare nel registro, anche quelli degli ingestori interni.
  const body = JSON.stringify(ev); const ts = now(); const sig = sign(key, ts, body);
  return ingestSigned(db, key, ts, body, sig);
}
export function ingestSigned(db, key, ts, body, sig) {
  if (!verifySig(key, ts, body, sig)) return { ok: false, code: 401, error: "firma non valida o scaduta" };
  let ev; try { ev = JSON.parse(body); } catch { return { ok: false, code: 400, error: "JSON non valido" }; }
  if (!ev || typeof ev !== "object") return { ok: false, code: 400, error: "evento non valido" };
  if (!EVENT_TYPES.has(ev.type)) return { ok: false, code: 400, error: "tipo non ammesso" };
  if (!SOURCES.has(ev.source)) return { ok: false, code: 400, error: "sorgente non ammessa" };
  const k = String(ev.key || "").slice(0, 160); if (!/^[a-z0-9_.:\-]{6,160}$/i.test(k)) return { ok: false, code: 400, error: "key non valida" };
  for (const f of ["actor", "subject"]) if (ev[f] != null && ev[f] !== "" && !OVID_RE.test(ev[f]) && !/^(dc|w|tg)-[0-9a-z]{8,64}$/.test(ev[f])) return { ok: false, code: 400, error: f + " non valido" };
  const data = JSON.stringify(ev.data || {}); if (data.length > 2000) return { ok: false, code: 413, error: "dati troppo grandi" };
  const t = Number.isFinite(+ev.ts) && +ev.ts > 1.7e9 && +ev.ts <= now() + 60 ? Math.floor(+ev.ts) : now();
  const r = db.prepare("INSERT OR IGNORE INTO events(key,type,source,actor,subject,data,ts,received,sig) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(k, ev.type, ev.source, ev.actor || null, ev.subject || null, data, t, now(), sig);
  return { ok: true, inserted: r.changes === 1, key: k };
}

// ---------- letture sorgenti (sola lettura) ----------
function ro(p) { if (!fs.existsSync(p)) return null; try { return new Database(p, { readonly: true, fileMustExist: true }); } catch { return null; } }
export function readRadar() {
  const d = ro(PATHS.radar); if (!d) return null;
  try {
    const users = d.prepare("SELECT ovid, nick, role, slave_kind, verified, invited_by, created, wallet FROM users").all();
    let rsvp = []; try { rsvp = d.prepare("SELECT ovid, created FROM stage_rsvp").all(); } catch {}
    return { users, rsvp };
  } finally { d.close(); }
}
export function readZnft() {
  const d = ro(PATHS.znft); if (!d) return [];
  try { return d.prepare("SELECT id, artist, status, example, updated, created FROM works WHERE status='certificata' AND example=0").all(); } catch { return []; } finally { d.close(); }
}
export function readZquest() {
  const d = ro(PATHS.zquest); if (!d) return [];
  try { return d.prepare("SELECT q.id, q.code, q.updated_at, u.wallet FROM quest_progress q JOIN users u ON u.id=q.user_id WHERE q.status='fatta' AND u.wallet IS NOT NULL").all(); } catch { return []; } finally { d.close(); }
}
const isoTs = (s) => { const t = Date.parse(s || ""); return Number.isFinite(t) ? Math.floor(t / 1000) : now(); };

// Ingestione idempotente: ogni fatto reale diventa un evento con chiave unica.
export function ingestAll(db, key) {
  const radar = readRadar(); if (!radar) return { ok: false, error: "radar non leggibile" };
  let n = 0; const P = (k, ev) => { const r = publish(db, key, { key: k, ...ev }); if (r.inserted) n++; };
  const byOvid = new Map(radar.users.map((u) => [u.ovid, u]));
  const byWallet = new Map(radar.users.filter((u) => u.wallet).map((u) => [u.wallet, u.ovid]));
  for (const u of radar.users) {
    const kind = u.role === "slave" ? (u.slave_kind || "slave") : u.role;
    P(`radar:created:${u.ovid}`, { type: "profile_created", source: "radar", actor: u.ovid, ts: u.created, data: { role: u.role, kind } });
    P(`radar:role:${u.ovid}:${kind}`, { type: "role_set", source: "radar", actor: u.ovid, data: { role: u.role, kind } });
    if (u.invited_by && byOvid.has(u.invited_by)) {
      P(`radar:invite:${u.ovid}`, { type: "invite_accepted", source: "radar", actor: u.invited_by, subject: u.ovid, ts: u.created, data: { via: "invito Radar" } });
    }
    if (u.verified) {
      P(`badge:verified:${u.ovid}`, { type: "profile_verified", source: "badge", actor: u.ovid, data: { role: u.role } });
      if (u.invited_by && byOvid.has(u.invited_by)) P(`radar:inviteever:${u.ovid}`, { type: "invitee_verified", source: "radar", actor: u.invited_by, subject: u.ovid });
    }
  }
  // Revoca: un profilo cancellato dal Radar non porta più punti (né a sé né a chi l'ha invitato).
  for (const r of db.prepare("SELECT DISTINCT actor FROM events WHERE type='profile_created'").all()) {
    if (r.actor && !byOvid.has(r.actor)) P(`radar:revoked:${r.actor}`, { type: "profile_revoked", source: "radar", actor: r.actor });
  }
  for (const s of radar.rsvp) if (byOvid.has(s.ovid)) P(`radar:rsvp:${s.ovid}:${s.created}`, { type: "stage_rsvp", source: "radar", actor: s.ovid, ts: s.created });
  for (const w of readZnft()) {
    const ov = byWallet.get(w.artist) || null;
    P(`znft:cert:${w.id}`, { type: "work_certified", source: "znft", actor: ov, ts: isoTs(w.updated), data: { work: w.id, wallet: w.artist.slice(0, 4) + "…" + w.artist.slice(-4) } });
  }
  for (const q of readZquest()) {
    const ov = byWallet.get(q.wallet) || null;
    P(`zquest:done:${q.id}`, { type: "quest_done", source: "zquest", actor: ov, ts: isoTs(q.updated_at), data: { code: q.code } });
  }
  return { ok: true, new: n, profiles: radar.users.length };
}

// ---------- calcolo merito ----------
export const DEFAULT_MERIT = {
  points: { invite_accepted: 4, invitee_verified: 8, profile_verified: 5, work_certified: 20, quest_done: 3, stage_rsvp: 2 },
  questWeeklyMax: 5,
  activeWindowDays: 28,
  dominantMultiplier: 1.5,
  holderTiers: [{ minVelvet: 10000, bonus: 0.10 }, { minVelvet: 100000, bonus: 0.20 }],
  holderBonusMax: 0.20,
};
export function meritRules(cfg) {
  const m = { ...DEFAULT_MERIT, ...(cfg.merit || {}) };
  m.points = { ...DEFAULT_MERIT.points, ...((cfg.merit || {}).points || {}) };
  m.activeMultiplier = Number((cfg.rules || {}).activeProfilePointsMultiplier || 1);
  m.holderBonusMax = Math.min(Number(m.holderBonusMax), 0.20);
  m.dominantMultiplier = Math.min(Number(m.dominantMultiplier), 1.5);
  return m;
}
export function roleLabel(u) {
  if (!u) return "—";
  if (u.role === "mistress") return "Mistress/Master";
  if (u.role === "slave") return u.slave_kind === "fedele" ? "Slave · Fedele" : u.slave_kind === "curioso" ? "Slave · Curioso" : "Slave";
  return u.role;
}
export const roleKey = (u) => (!u ? "altro" : u.role === "mistress" ? "mistress" : u.slave_kind === "fedele" ? "fedele" : u.slave_kind === "curioso" ? "curioso" : "slave");
export function holderBonus(rules, velvet) {
  let b = 0; for (const t of rules.holderTiers || []) if (velvet != null && velvet >= t.minVelvet) b = Math.max(b, t.bonus);
  return Math.min(b, rules.holderBonusMax);
}

// Punti base di ogni evento valido (profili esistenti, non revocati, quest con tetto settimanale).
export function scoredEvents(db, cfg, radar, from = 0, to = now() + 60) {
  const rules = meritRules(cfg); const users = new Map(radar.users.map((u) => [u.ovid, u]));
  const rows = db.prepare("SELECT key,type,actor,subject,ts FROM events WHERE ts>=? AND ts<? AND actor IS NOT NULL ORDER BY ts").all(from, to);
  const questCount = new Map(); const out = [];
  for (const e of rows) {
    const pts = rules.points[e.type]; if (!pts) continue;
    const a = users.get(e.actor); if (!a) continue; // attore revocato
    if (e.subject && OVID_RE.test(e.subject) && !users.has(e.subject)) continue; // invitato revocato
    if (e.type === "quest_done") { const k = e.actor + "|" + weekId(e.ts); const c = (questCount.get(k) || 0) + 1; questCount.set(k, c); if (c > rules.questWeeklyMax) continue; }
    out.push({ ...e, pts, role: roleKey(a) });
  }
  return out;
}
export function multipliers(cfg, rules, u, evs, velvet, at = now()) {
  const verified = !!(u && u.verified);
  const recent = evs.some((e) => e.actor === u.ovid && (e.type === "invite_accepted" || e.type === "work_certified") && e.ts >= at - rules.activeWindowDays * DAY);
  const active = verified && recent;
  const dominant = verified && u.role === "mistress";
  const hb = holderBonus(rules, velvet);
  return { verified, active, dominant, activeX: active ? rules.activeMultiplier : 1, dominantX: dominant ? rules.dominantMultiplier : 1, holderBonus: hb,
    total: (active ? rules.activeMultiplier : 1) * (dominant ? rules.dominantMultiplier : 1) * (1 + hb) };
}
export function exclusions(cfg) {
  const x = cfg.exclusions || {};
  return { ovids: new Set((x.ovids || []).map((s) => String(s).toUpperCase())), wallets: new Set(x.wallets || []) };
}

// ---------- letture on-chain ----------
export async function rpc(method, params) {
  let last;
  for (const u of RPC) {
    try {
      const r = await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(10000) });
      const j = await r.json(); if (j.error) throw new Error(j.error.message || "rpc"); return j.result;
    } catch (e) { last = e; }
  }
  throw last || new Error("rpc");
}
const cache = new Map();
export async function cached(k, ttl, fn) {
  const c = cache.get(k); if (c && c.exp > Date.now()) return c.v;
  try { const v = await fn(); cache.set(k, { v, exp: Date.now() + ttl * 1000 }); return v; }
  catch (e) { if (c) return c.v; throw e; }
}
export async function velvetBalance(cfg, owner) {
  return cached("bal:" + owner, 600, async () => {
    const r = await rpc("getTokenAccountsByOwner", [owner, { mint: cfg.token.mint }, { encoding: "jsonParsed", commitment: "confirmed" }]);
    let ui = 0; for (const a of r.value || []) ui += Number(a.account.data.parsed.info.tokenAmount.uiAmountString || 0);
    return { velvet: ui, accounts: (r.value || []).length };
  });
}
export async function fundState(cfg) {
  return cached("fund", 60, async () => {
    const [tb, sol] = await Promise.all([rpc("getTokenAccountBalance", [cfg.wallet.ata, { commitment: "confirmed" }]), rpc("getBalance", [cfg.wallet.address, { commitment: "confirmed" }])]);
    return { velvet: Number(tb.value.uiAmountString), velvetAtomic: tb.value.amount, sol: sol.value / 1e9, lamports: sol.value, readAt: now() };
  });
}
export async function mintState(cfg) {
  return cached("mint", 300, async () => {
    const acc = await rpc("getAccountInfo", [cfg.token.mint, { encoding: "jsonParsed", commitment: "confirmed" }]);
    const v = acc.value; const info = v.data.parsed.info;
    const largest = [];
    return { program: v.owner === TOKEN_2022 ? "Token-2022" : "SPL Token", decimals: info.decimals, supply: Number(BigInt(info.supply) / 10n ** BigInt(info.decimals)),
      mintAuthority: info.mintAuthority || null, freezeAuthority: info.freezeAuthority || null,
      extensions: (info.extensions || []).map((x) => x.extension), largest: largest.map((a) => ({ address: a.address, velvet: Number(a.uiAmountString) })), readAt: now() };
  });
}

// ---------- piano settimanale (stesso codice per stima pubblica e pagamento) ----------
const ATOM = 1_000_000n;
export function toAtomic(v) { return BigInt(Math.floor(Number(v) * 1e6)); }
export function fromAtomic(a) { return Number(BigInt(a)) / 1e6; }
export async function planWeek(db, cfg, radar, ws, opts = {}) {
  const rules = meritRules(cfg); const cal = calendarInfo(cfg, ws + 3600); const start = parseStart(cfg);
  const we = ws + 7 * DAY; const from = Math.max(ws, start || ws);
  const sem = cal.semester; const X = exclusions(cfg);
  const evs = scoredEvents(db, cfg, radar, 0, we); // tutta la storia serve per la finestra "attivo"
  const inWeek = evs.filter((e) => e.ts >= from && e.ts < we);
  const frac = start && start > ws ? Math.max(0, (we - start) / (7 * DAY)) : 1;
  const pool = sem ? toAtomic(sem.weeklyPoolMax * frac) : 0n;
  const perMax = sem ? toAtomic(sem.weeklyPerProfileMax) : 0n;
  const items = [];
  for (const u of radar.users) {
    const mine = inWeek.filter((e) => e.actor === u.ovid); const base = mine.reduce((s, e) => s + e.pts, 0);
    let bal = null;
    if (u.wallet && base > 0 && opts.balances !== false) { try { bal = (await velvetBalance(cfg, u.wallet)).velvet; } catch { bal = null; } }
    const mx = multipliers(cfg, rules, u, evs, bal, Math.min(we, now()));
    const points = Math.round(base * mx.total * 100) / 100;
    let reason = null;
    if (X.ovids.has(u.ovid)) reason = "escluso: fondatore o AI ufficiale (il fondo non paga chi l'ha fondato)";
    else if (!u.verified) reason = "profilo non ancora verificato";
    else if (!u.wallet) reason = "nessun wallet collegato al Radar (accedi con Phantom)";
    else if (X.wallets.has(u.wallet)) reason = "wallet escluso (fondo, agente o AI)";
    else if (points <= 0) reason = "nessun punto questa settimana";
    items.push({ ovid: u.ovid, nick: u.nick, role: roleKey(u), roleLabel: roleLabel(u), wallet: u.wallet || null, base, points, mx, eligible: !reason, reason, events: mine.length });
  }
  const elig = items.filter((i) => i.eligible); const tot = elig.reduce((s, i) => s + i.points, 0);
  let sumA = 0n;
  for (const i of items) {
    i.amountAtomic = "0";
    if (!i.eligible || tot <= 0) continue;
    let a = (pool * BigInt(Math.round(i.points * 100))) / BigInt(Math.round(tot * 100));
    if (a > perMax) a = perMax; a = (a / ATOM) * ATOM; // VELVET interi
    i.amountAtomic = a.toString(); sumA += a;
  }
  // Tetto del semestre: mai oltre capVelvet (somma di quanto già inviato nel semestre).
  let semSent = 0n;
  if (sem) for (const r of db.prepare("SELECT p.amount_atomic a FROM payouts p JOIN batches b ON b.week=p.week WHERE b.semester=? AND p.status='sent'").all(cal.semesterIndex)) semSent += BigInt(r.a);
  const semLeft = sem ? toAtomic(sem.capVelvet) - semSent : 0n;
  if (sumA > semLeft && sumA > 0n) { for (const i of items) i.amountAtomic = (((BigInt(i.amountAtomic) * semLeft) / sumA / ATOM) * ATOM).toString(); sumA = items.reduce((s, i) => s + BigInt(i.amountAtomic), 0n); }
  const held = items.filter((i) => !i.eligible && i.points > 0);
  return { week: weekId(ws), weekStart: ws, weekEnd: we, from, frac, semesterIndex: cal.semesterIndex, semester: sem, poolAtomic: pool.toString(), perProfileMaxAtomic: perMax.toString(),
    totalPoints: tot, totalAtomic: sumA.toString(), semesterSentAtomic: semSent.toString(), items, eligible: elig.length, held: held.length, rules };
}
