// zcomm + miner merito · API locale (127.0.0.1). Pubblico solo in lettura tramite nginx.
// POST /zcomm/api/events accetta solo eventi firmati HMAC e solo da 127.0.0.1.
// Questo processo NON ha accesso alla chiave del fondo: i pagamenti li fa payout.mjs (timer separato).
// © 2026 ZDOS1.3 · Licenza ZSEL proprietaria.
import http from "node:http";
import * as L from "./lib.mjs";

const PORT = +(L.E.ZCOMM_PORT || 4192); const HOST = "127.0.0.1";
const RADAR_API = L.E.RADAR_API || "http://127.0.0.1:8763/api";
const db = L.openDb(); const KEY = L.readKey(true);
const DAY = 86400;

function ingest() { try { const r = L.ingestAll(db, KEY); if (r.new) console.log("zcomm: nuovi eventi", r.new); } catch (e) { console.error("ingest", e.message); } }
ingest(); setInterval(ingest, 60_000).unref();

const json = (res, code, obj, cache = "no-store") => { const b = JSON.stringify(obj); res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": cache, "x-content-type-options": "nosniff" }); res.end(b); };
const rl = new Map();
function limited(ip, n = 120, win = 60) { const k = ip + ":" + Math.floor(Date.now() / 1000 / win); const c = (rl.get(k) || 0) + 1; rl.set(k, c); if (rl.size > 5000) rl.clear(); return c > n; }
const readBody = (req, max = 4096) => new Promise((ok, ko) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > max) { ko(new Error("troppo grande")); req.destroy(); } }); req.on("end", () => ok(b)); req.on("error", ko); });
const pubUser = (u) => ({ id: u.ovid, nick: u.nick, role: L.roleKey(u), roleLabel: L.roleLabel(u), verified: !!u.verified });

let sumCache = null;
async function summary() {
  if (sumCache && sumCache.exp > Date.now()) return sumCache.v;
  const cfg = L.loadConfig(); const radar = L.readRadar() || { users: [], rsvp: [] }; const t = L.now();
  const cal = L.calendarInfo(cfg, t); const rules = L.meritRules(cfg);
  const evs = L.scoredEvents(db, cfg, radar, 0, t + 60);
  // Serie: punti base per giorno (ultimi 30 giorni, ora di Roma) e per ruolo.
  const days = []; for (let i = 29; i >= 0; i--) days.push(L.dayKey(t - i * DAY));
  const roles = ["mistress", "fedele", "curioso", "slave"]; const series = Object.fromEntries(roles.map((r) => [r, days.map(() => 0)]));
  for (const e of evs) { const di = days.indexOf(L.dayKey(e.ts)); if (di >= 0 && series[e.role]) series[e.role][di] += e.pts; }
  const byRole = Object.fromEntries(roles.map((r) => [r, { profiles: 0, verified: 0, active: 0, points: 0 }]));
  for (const u of radar.users) { const k = L.roleKey(u); if (!byRole[k]) continue; byRole[k].profiles++; if (u.verified) byRole[k].verified++; }
  for (const e of evs) if (byRole[e.role]) byRole[e.role].points += e.pts;
  const ws = L.weekStart(t);
  let plan = null; try { plan = await L.planWeek(db, cfg, radar, ws); } catch (e) { console.error("plan", e.message); }
  for (const i of (plan ? plan.items : [])) if (i.mx.active && byRole[i.role]) byRole[i.role].active++;
  const domActive = plan ? plan.items.filter((i) => i.role === "mistress" && i.mx.verified && i.mx.active).length : 0;
  const domVerified = radar.users.filter((u) => u.role === "mistress" && u.verified).length;
  let fund = null; try { fund = await L.fundState(cfg); } catch (e) { fund = { error: "RPC non raggiungibile ora" }; }
  const batches = db.prepare("SELECT week, week_start, week_end, semester, pool_atomic, total_points, status, note, updated FROM batches ORDER BY week_start DESC LIMIT 20").all();
  const paid = db.prepare("SELECT week, ovid, amount_atomic, status, reason, signature, updated FROM payouts WHERE status IN ('sent','held','planned','dry_run_ok','dry_run_failed','to_verify') ORDER BY id DESC LIMIT 50").all();
  const sent = db.prepare("SELECT COALESCE(SUM(CAST(amount_atomic AS INTEGER)),0) s FROM payouts WHERE status='sent'").get().s;
  const kill = L.killSwitch(cfg);
  const lead = plan ? plan.items.filter((i) => i.points > 0).sort((a, b) => b.points - a.points).slice(0, 20).map((i) => ({ id: i.ovid, nick: i.nick, roleLabel: i.roleLabel, points: i.points, base: i.base, eligible: i.eligible, reason: i.eligible ? null : i.reason, estimate: L.fromAtomic(i.amountAtomic), x: Math.round(i.mx.total * 100) / 100 })) : [];
  const v = {
    ok: true, ts: t, tsRome: L.fmtRomeTs(t) + " (ora di Roma)",
    emissions: { live: !!cfg.emissionsLive && !kill, configLive: !!cfg.emissionsLive, stop: kill, approval: cfg.emissionsApproval || null, schedule: (cfg.payout || {}).scheduleText || null },
    token: cfg.token, fund: { address: cfg.wallet.address, ata: cfg.wallet.ata, funding: cfg.funding, ...fund },
    calendar: { started: cal.started, start: cal.start, startRome: cal.start ? L.fmtRomeTs(cal.start) : null, weekNo: cal.weekNo, semesterIndex: cal.semesterIndex, semesters: cal.semesters, end: cal.end || null },
    rules: { points: rules.points, questWeeklyMax: rules.questWeeklyMax, activeMultiplier: rules.activeMultiplier, dominantMultiplier: rules.dominantMultiplier, holderTiers: rules.holderTiers, holderBonusMax: rules.holderBonusMax, activeWindowDays: rules.activeWindowDays, activeDefinition: (cfg.rules || {}).activeProfileDefinition, weeklyCapPercent: (cfg.rules || {}).weeklyCapPercentOfPoolP },
    profiles: { total: radar.users.length, verified: radar.users.filter((u) => u.verified).length, byRole, dominantVerified: domVerified, dominantActive: domActive },
    series: { days, roles, points: series },
    week: plan ? { id: plan.week, start: plan.weekStart, end: plan.weekEnd, startRome: L.fmtRomeTs(plan.weekStart), endRome: L.fmtRomeTs(plan.weekEnd), frac: plan.frac, pool: L.fromAtomic(plan.poolAtomic), perProfileMax: L.fromAtomic(plan.perProfileMaxAtomic), totalPoints: plan.totalPoints, eligible: plan.eligible, held: plan.held, estimateTotal: L.fromAtomic(plan.totalAtomic), perActiveIfEqual: plan.eligible ? Math.min(L.fromAtomic(plan.poolAtomic) / plan.eligible, L.fromAtomic(plan.perProfileMaxAtomic)) : null, semesterSent: L.fromAtomic(plan.semesterSentAtomic) } : null,
    leaderboard: lead,
    register: { totalSent: Number(sent) / 1e6, batches: batches.map((b) => ({ ...b, pool: L.fromAtomic(b.pool_atomic), startRome: L.fmtRomeTs(b.week_start), updatedRome: L.fmtRomeTs(b.updated) })), payouts: paid.map((p) => ({ ...p, amount: L.fromAtomic(p.amount_atomic), updatedRome: L.fmtRomeTs(p.updated), solscan: p.signature ? "https://solscan.io/tx/" + p.signature : null })) },
    sources: { radar: true, badge: true, znft: true, zquest: true, zdiscord: true, zlang: false, zlangNote: "Il codice scritto nell'IDE Zlang resta nel browser e non è legato a un ID: oggi non è tracciabile, quindi non dà punti." },
  };
  sumCache = { v, exp: Date.now() + 30_000 }; return v;
}

async function me(req) {
  const tok = String(req.headers["x-radar-token"] || "").slice(0, 200);
  if (!tok) return [401, { ok: false, error: "Entra nel Radar per vedere il tuo merito." }];
  const r = await fetch(RADAR_API + "/me", { headers: { "X-Radar-Token": tok }, signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!r || r.status !== 200) return [401, { ok: false, error: "Sessione Radar scaduta o non valida." }];
  const j = await r.json(); const id = String((j.user || {}).id || "").toUpperCase();
  if (!L.OVID_RE.test(id)) return [401, { ok: false, error: "Sessione Radar non valida." }];
  return [200, await profile(id, true)];
}
async function profile(id, mine = false) {
  const cfg = L.loadConfig(); const radar = L.readRadar() || { users: [] }; const u = radar.users.find((x) => x.ovid === id);
  if (!u) return { ok: false, error: "ID non trovato" };
  const t = L.now(); const plan = await L.planWeek(db, cfg, radar, L.weekStart(t)); const it = plan.items.find((i) => i.ovid === id);
  const all = L.scoredEvents(db, cfg, radar, 0, t + 60).filter((e) => e.actor === id);
  const breakdown = {}; for (const e of all) { breakdown[e.type] = breakdown[e.type] || { n: 0, pts: 0 }; breakdown[e.type].n++; breakdown[e.type].pts += e.pts; }
  let inv = null; try { const r = await fetch(RADAR_API + "/invite/" + id, { signal: AbortSignal.timeout(5000) }); if (r.ok) inv = await r.json(); } catch {}
  const pays = db.prepare("SELECT week, amount_atomic, status, reason, signature, updated FROM payouts WHERE ovid=? ORDER BY id DESC LIMIT 20").all(id);
  return { ok: true, user: pubUser(u), week: plan.week, weekPoints: it.points, weekBase: it.base, allTimeBase: all.reduce((s, e) => s + e.pts, 0), breakdown,
    multipliers: { active: it.mx.active, activeX: it.mx.activeX, dominant: it.mx.dominant, dominantX: it.mx.dominantX, holderBonus: it.mx.holderBonus, total: Math.round(it.mx.total * 100) / 100 },
    eligible: it.eligible, reason: it.reason, estimate: L.fromAtomic(it.amountAtomic), invites: inv ? { limit: inv.invite_limit, left: inv.invites_left } : null,
    walletLinked: mine ? !!u.wallet : undefined, payouts: pays.map((p) => ({ ...p, amount: L.fromAtomic(p.amount_atomic), updatedRome: L.fmtRomeTs(p.updated), solscan: p.signature ? "https://solscan.io/tx/" + p.signature : null })) };
}
const KNOWN = { "5qke6mW7k3uEw4Bk67xSyGAk5zDgsLnpLK8P8J3V7dww": "wallet agente HighKali", "GEntwhyRQASi5n9uWSqYhMRtePGoogDpsbuoZBwCECDd": "fondo merito",
  "8gRVYw9oqgjfi2UpPfpgfJntPomrKroX42HKtrTrGYL6": "Rubina (AI)", "HGkVsYyXpbrxqrhnbKeSe5epERLwWnA4oL4q6Z3joLt4": "Zara (AI)", "6qSyMUB1g7eXoiFSELt2Vf4B4Lv3YEUkWFxAQkfNyobU": "A$apKali (AI)" };
async function ov() {
  const cfg = L.loadConfig(); const m = await L.mintState(cfg);
  // Conti token del mint (una chiamata, cache 10 min): proprietario e saldo leggibili direttamente.
  const accs = await L.cached("gpa", 600, async () => {
    const r = await L.rpc("getProgramAccounts", [L.TOKEN_2022, { encoding: "jsonParsed", filters: [{ memcmp: { offset: 0, bytes: cfg.token.mint } }] }]);
    return r.map((a) => ({ address: a.pubkey, owner: a.account.data.parsed.info.owner, velvet: Number(a.account.data.parsed.info.tokenAmount.uiAmountString || 0) }));
  }).catch(() => null);
  const largest = accs ? accs.filter((a) => a.velvet > 0).sort((x, y) => y.velvet - x.velvet).slice(0, 10) : m.largest;
  return { ok: true, mint: cfg.token.mint, symbol: "VELVET", ticker: "$OV", ...m, accounts: accs ? { total: accs.length, withBalance: accs.filter((a) => a.velvet > 0).length } : null,
    largest: largest.map((a) => { const o = a.owner || null; const label = KNOWN[o] || (a.velvet > m.supply * 0.5 ? "curva di lancio (contratto)" : null); return { address: a.address, owner: o, velvet: a.velvet, label, pct: Math.round((a.velvet / m.supply) * 10000) / 100 }; }) };
}

const srv = http.createServer(async (req, res) => {
  const ip = req.socket.remoteAddress || ""; const fwd = req.headers["x-real-ip"] || ip;
  try {
    if (limited(fwd)) return json(res, 429, { ok: false, error: "troppe richieste" });
    const u = new URL(req.url, "http://x"); const p = u.pathname.replace(/^\/(merito|zcomm)\/api\//, "/$1/");
    if (req.method === "GET" && (p === "/zcomm/health" || p === "/merito/health")) return json(res, 200, { ok: true, service: "zcomm", ts: L.now() });
    if (req.method === "GET" && p === "/merito/summary") return json(res, 200, await summary(), "public, max-age=20");
    if (req.method === "GET" && p === "/merito/me") { const [c, o] = await me(req); return json(res, c, o); }
    if (req.method === "GET" && p.startsWith("/merito/profile/")) { const id = decodeURIComponent(p.slice(16)).toUpperCase(); if (!L.OVID_RE.test(id)) return json(res, 400, { ok: false, error: "formato OV-XXXX-VELVET" }); const o = await profile(id); return json(res, o.ok ? 200 : 404, o, "public, max-age=20"); }
    if (req.method === "GET" && p === "/merito/ov") return json(res, 200, await ov(), "public, max-age=60");
    if (req.method === "GET" && p === "/merito/payouts") { const s = await summary(); return json(res, 200, { ok: true, ...s.register }, "public, max-age=20"); }
    if (req.method === "GET" && p === "/zcomm/events") {
      const lim = Math.min(200, Math.max(1, +(u.searchParams.get("limit") || 50)));
      const rows = db.prepare("SELECT seq, type, source, actor, subject, ts FROM events ORDER BY seq DESC LIMIT ?").all(lim);
      return json(res, 200, { ok: true, events: rows.map((r) => ({ ...r, tsRome: L.fmtRomeTs(r.ts) })), note: "Registro firmato HMAC lato server. Solo ID tecnici: nessun handle, email o wallet completo." }, "public, max-age=15");
    }
    if (req.method === "GET" && p === "/zcomm/ovid-by-wallet") {
      // Solo locale (OurVelvet Social): dice se un wallet ha già un profilo merito. Restituisce solo l'ID tecnico OV-XXXX.
      if (!(ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") || req.headers["x-forwarded-for"] || req.headers["x-real-ip"]) return json(res, 403, { ok: false, error: "solo locale" });
      const w = String(u.searchParams.get("wallet") || ""); if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w)) return json(res, 400, { ok: false, error: "wallet non valido" });
      const r = L.readRadar(); const x = r && r.users.find((z) => z.wallet === w);
      return json(res, 200, { ok: true, ovid: x ? x.ovid : null });
    }
    if (req.method === "POST" && p === "/zcomm/events") {
      // Solo dal server stesso (bot e servizi locali); nginx non inoltra POST pubblici.
      if (!(ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") || req.headers["x-forwarded-for"] || req.headers["x-real-ip"]) return json(res, 403, { ok: false, error: "solo locale" });
      const body = await readBody(req);
      const r = L.ingestSigned(db, KEY, req.headers["x-zcomm-ts"], body, req.headers["x-zcomm-signature"]);
      if (r.ok) sumCache = null;
      return json(res, r.ok ? 200 : r.code, r);
    }
    return json(res, 404, { ok: false, error: "non trovato" });
  } catch (e) { console.error("errore", e.message); return json(res, 500, { ok: false, error: "errore interno" }); }
});
srv.listen(PORT, HOST, () => console.log(`zcomm in ascolto su ${HOST}:${PORT}`));
