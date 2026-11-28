// Pool Party inverso · calcolo meritocratico SOLO LETTURA per OurVelvet Social. © 2026 ZDOS1.3 · Licenza ZSEL proprietaria.
// Nessun pagamento, nessuna transazione, nessuna chiave: calcola punteggi e una distribuzione PROPOSTA.
// Ogni cifra di budget è una proposta da confermare con doc. Il pagamento richiede una firma manuale dell'approvatore (non eseguita qui).
import fs from "node:fs";
import crypto from "node:crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";

const DEFI = process.env.DEFI_URL || "http://127.0.0.1:4198";
const ZCOMM = process.env.ZCOMM_URL || "http://127.0.0.1:4192";
const MERIT_CFG = "/etc/zdos-fondo-merito/config.json";
const APPROVER_FILE = process.env.POOL_APPROVER_FILE || "/etc/zdos-social/pool-approver.pub";
const STOP_FILE = process.env.POOL_STOP_FILE || "/etc/zdos-social/POOL_STOP";
const LSD_MINT = "FSwCz9qgcvfWGEU8QU3h4fQpyQ8TB2KLHYC9bmoMxDgP";
const LSD_POOL = "383iZ9nNfnnMtpM6oY7Gu4Nn87EtjwdPikkwctExjkze";
const LSD_AUTH = "A4JY5VGS1oGSqMxW6a7EtwTg7q6wjG3uxVpNaHPyG9PJ";
const DAY = 86400, HOUR = 3600;

// ---- parametri: tutti PROPOSTE, non approvate da doc ----
export const PARAMS = {
  stato: "proposta, da confermare con doc",
  token: "L$D (Dom-Coin)", mint: LSD_MINT, pool: LSD_POOL,
  quotaProposta: { percentuale: 10, l$d: 20_000_000, settimane: 26, nota: "10% della supply (20M su 200M) in 26 settimane" },
  quotaFeeProposta: 0.5,            // frazione delle fee DLMM destinata al budget
  tettoProfiloPct: 5,               // come il fondo merito VELVET (5% del pool settimanale a profilo)
  punti: { post: { pt: 2, maxSettimana: 5 }, likeRicevuto: { pt: 1, maxSettimana: 10 }, nuovoFollower: { pt: 1, maxSettimana: 10 },
    badgeVerificato: { pt: 3 }, lpL$D: { ptMax: 20, nota: "proporzionale alle ore con liquidità nel pool L$D-SOL sulla settimana (max 168 h)" },
    zcomm: { nota: "punti del fondo merito per chi ha un profilo OV collegato (invito, quest_done max 5/sett., zNFT, RSVP)" },
    work_proof: { pt: 0, nota: "i work_proof dello ZDOS Miner sono lavoro dell'infrastruttura ZDOS, senza attore: oggi nessun contributore esterno li produce" } },
  holder: { tiers: [{ minL$D: 10_000, bonus: 0.10 }, { minL$D: 100_000, bonus: 0.20 }], max: 0.20, nota: "solo moltiplicatore su punti già guadagnati: detenere da solo vale 0" },
};
const WEEKLY_BUDGET = PARAMS.quotaProposta["l$d"] / PARAMS.quotaProposta.settimane;

// ---- settimana (lunedì 00:00 Europe/Rome, come zcomm) ----
const fmtRome = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short" });
function romeParts(ts) { const o = {}; for (const p of fmtRome.formatToParts(new Date(ts * 1000))) o[p.type] = p.value; return { y: +o.year, m: +o.month, d: +o.day, H: +o.hour, M: +o.minute, S: +o.second, wd: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(o.weekday) }; }
const romeOffset = (ts) => { const p = romeParts(ts); return Date.UTC(p.y, p.m - 1, p.d, p.H, p.M, p.S) / 1000 - ts; };
function romeMidnight(y, m, d) { const g = Date.UTC(y, m - 1, d) / 1000; let t = g - romeOffset(g); t = g - romeOffset(t); return t; }
function weekStart(ts) { const p = romeParts(ts); const mid = romeMidnight(p.y, p.m, p.d); const b = romeParts(mid - p.wd * DAY + 7200); return romeMidnight(b.y, b.m, b.d); }
function weekId(ts) { const ws = weekStart(ts); const p = romeParts(ws + 3 * DAY + 7200); const w1 = weekStart(romeMidnight(p.y, 1, 4)); return `${p.y}-W${String(Math.round((ws - w1) / (7 * DAY)) + 1).padStart(2, "0")}`; }
const fmtTs = (ts) => { const p = romeParts(ts); return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y} ${String(p.H).padStart(2, "0")}:${String(p.M).padStart(2, "0")}`; };
function epochFromArg(arg, now) {
  if (arg === "previous") return weekStart(weekStart(now) - 3600);
  const m = /^(\d{4})-W(\d{2})$/.exec(arg || ""); if (!m) return weekStart(now);
  return weekStart(weekStart(romeMidnight(+m[1], 1, 4)) + (+m[2] - 1) * 7 * DAY + 7200);
}

// ---- fetch locale con cache ----
const cache = new Map();
async function cached(k, ttlMs, fn) {
  const c = cache.get(k); if (c && c.exp > Date.now()) return c.v;
  try { const v = await fn(); cache.set(k, { v, exp: Date.now() + ttlMs }); return v; } catch (e) { if (c) return { ...c.v, _stale: true }; throw e; }
}
async function getJson(url, ms = 8000) { const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: "application/json" } }); return r.json(); }

async function lsdMarket() {
  return cached("lsd", 120_000, async () => {
    const [ov, pool] = await Promise.all([getJson(DEFI + "/api/defi/overview", 15000), getJson(DEFI + "/api/defi/pool/" + LSD_POOL, 15000)]);
    const t = (ov.tokens || []).find((x) => x.mint === LSD_MINT) || {}; const pr = (t.pairs || [])[0] || {}; const pl = pool.pool || {};
    const fees24 = Number(pl.fees && pl.fees["24h"]) || 0, price = Number(pr.priceUsd) || null;
    const feeWeekUsd = fees24 * 7 * PARAMS.quotaFeeProposta;
    return {
      fonte: "zdos-defi → Meteora DLMM API, Jupiter, DexScreener (sola lettura)", letto: new Date().toISOString(),
      prezzoUsd: price, liquiditaUsd: pr.liquidityUsd ?? null, tvlPoolUsd: pl.tvlUsd ?? null, volume24hUsd: pl.volume ? pl.volume["24h"] : null, fee24hUsd: fees24,
      supply: t.market && t.market.supply, holder: t.market && t.market.holders,
      mintAuthority: t.audit ? t.audit.mintAuthority : undefined, freezeAuthority: t.audit ? t.audit.freezeAuthority : undefined,
      topHolderPct: t.audit ? t.audit.topHoldersPercentage : null,
      kira: t.kira || null, pool: LSD_POOL, meteoraUrl: pl.meteoraUrl || null,
      feeSettimanaStimaUsd: feeWeekUsd, feeSettimanaStimaL$D: price ? feeWeekUsd / price : null,
    };
  });
}
async function walletInfo(addr) {
  return cached("w:" + addr, 600_000, async () => { const j = await getJson(DEFI + "/api/defi/wallet/" + addr, 12000); if (!j.ok) throw new Error("wallet"); return j; });
}
async function minerBand() {
  return cached("miner", 60_000, async () => { const j = await getJson(DEFI + "/api/defi/ecosystem", 10000); const m = j.miner || {}; return { prove: m.proofs ?? null, head: m.head ?? null, lavori: m.jobs ? Object.keys(m.jobs).length : null, vchain: j.vchain ? { altezza: j.vchain.height, head: j.vchain.headHash } : null }; });
}
async function zcommSummary() {
  return cached("zc", 60_000, async () => { const j = await getJson(ZCOMM + "/merito/api/summary", 10000); return { emissions: j.emissions || null, leaderboard: Array.isArray(j.leaderboard) ? j.leaderboard : [], week: j.week || null }; });
}
function exclusions() {
  const w = new Set([LSD_AUTH]), o = new Set();
  try { const c = JSON.parse(fs.readFileSync(MERIT_CFG, "utf8")); for (const x of (c.exclusions || {}).wallets || []) w.add(x); for (const x of (c.exclusions || {}).ovids || []) o.add(String(x).toUpperCase()); } catch {}
  return { wallets: w, ovids: o };
}
function approvers() { try { return fs.readFileSync(APPROVER_FILE, "utf8").split(/\s+/).filter((s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)); } catch { return []; } }
const isTest = (bio) => /account di test dsn-x/i.test(bio || "");
const holderBonus = (bal) => { let b = 0; for (const t of PARAMS.holder.tiers) if (bal != null && bal >= t.minL$D) b = Math.max(b, t.bonus); return Math.min(b, PARAMS.holder.max); };

export function createPool({ db, badge, session }) {
  db.exec(`
CREATE TABLE IF NOT EXISTS pool_lp(wallet TEXT NOT NULL, hour INTEGER NOT NULL, PRIMARY KEY(wallet, hour));
CREATE TABLE IF NOT EXISTS pool_approvals(id INTEGER PRIMARY KEY AUTOINCREMENT, epoch TEXT NOT NULL, hash TEXT NOT NULL, approver TEXT NOT NULL, sig TEXT NOT NULL, ts INTEGER NOT NULL, UNIQUE(epoch, hash, approver));`);
  const now = () => Math.floor(Date.now() / 1000);
  const q = (s, ...a) => db.prepare(s).all(...a);

  // ---- collettore LP: una volta all'ora registra chi ha liquidità nel pool L$D-SOL (dati on-chain reali via zdos-defi) ----
  async function collectLp() {
    const hour = Math.floor(now() / HOUR);
    for (const p of q("SELECT wallet FROM profiles WHERE status='attivo'")) {
      try {
        const w = await walletInfo(p.wallet);
        if ((w.positions || []).some((x) => x.pool === LSD_POOL && (Number(x.x) > 0 || Number(x.y) > 0))) db.prepare("INSERT OR IGNORE INTO pool_lp(wallet,hour) VALUES(?,?)").run(p.wallet, hour);
      } catch {}
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  setTimeout(() => collectLp().catch(() => {}), 90_000).unref();
  setInterval(() => collectLp().catch(() => {}), HOUR * 1000).unref();

  async function compute(ws) {
    const we = ws + 7 * DAY, t = now(), X = exclusions();
    const profiles = q("SELECT * FROM profiles WHERE status='attivo'");
    const active = new Set(profiles.map((p) => p.wallet));
    const zc = await zcommSummary().catch(() => ({ leaderboard: [], emissions: null }));
    const items = [];
    for (const p of profiles) {
      const nPost = db.prepare("SELECT COUNT(*) n FROM posts WHERE wallet=? AND status='pubblico' AND COALESCE(published,created)>=? AND COALESCE(published,created)<?").get(p.wallet, ws, we).n;
      const likers = q("SELECT DISTINCT l.wallet w FROM likes l JOIN posts po ON po.id=l.post WHERE po.wallet=? AND po.status='pubblico' AND l.wallet<>? AND l.created>=? AND l.created<?", p.wallet, p.wallet, ws, we).filter((r) => active.has(r.w)).length;
      const fols = q("SELECT follower w FROM follows WHERE followee=? AND follower<>? AND created>=? AND created<?", p.wallet, p.wallet, ws, we).filter((r) => active.has(r.w)).length;
      const verified = await badge(p.wallet);
      const lpH = db.prepare("SELECT COUNT(*) n FROM pool_lp WHERE wallet=? AND hour>=? AND hour<?").get(p.wallet, Math.floor(ws / HOUR), Math.floor(we / HOUR)).n;
      const z = p.ovid ? zc.leaderboard.find((e) => e && e.ovid === p.ovid) : null;
      const P = PARAMS.punti;
      const pts = {
        post: Math.min(nPost, P.post.maxSettimana) * P.post.pt, like: Math.min(likers, P.likeRicevuto.maxSettimana) * P.likeRicevuto.pt,
        follower: Math.min(fols, P.nuovoFollower.maxSettimana) * P.nuovoFollower.pt, badge: verified ? P.badgeVerificato.pt : 0,
        lp: Math.round(Math.min(lpH, 168) / 168 * P.lpL$D.ptMax * 100) / 100, zcomm: z ? Number(z.points || z.pts || 0) || 0 : 0, work_proof: 0,
      };
      const base = Object.values(pts).reduce((s, v) => s + v, 0);
      let bal = null; if (base > 0) { try { const w = await walletInfo(p.wallet); bal = Number((w.balances || {})["L$D"] || 0); } catch {} }
      const hb = base > 0 ? holderBonus(bal) : 0;
      const test = isTest(p.bio);
      let motivo = null;
      if (X.wallets.has(p.wallet) || (p.ovid && X.ovids.has(String(p.ovid).toUpperCase()))) motivo = "escluso: fondatore, agente o AI ufficiale";
      else if (base <= 0) motivo = "nessun punto in questa settimana";
      items.push({ handle: p.handle, test, base, hb, punti: Math.round(base * (1 + hb) * 100) / 100, pts, nPost, likers, fols, lpOre: lpH, verificato: verified, holderBonus: hb, wallet: p.wallet, ovid: p.ovid || null, motivo });
    }
    // modalità: se nessun profilo reale (non test) ha punti, il calcolo è una DEMO su account di test
    const real = items.filter((i) => !i.motivo && !i.test);
    const demo = real.length === 0;
    for (const i of items) { i.idoneo = !i.motivo && (demo || !i.test); i.pagabile = !i.motivo && !i.test; }
    const el = items.filter((i) => i.idoneo); const tot = el.reduce((s, i) => s + i.punti, 0);
    const mk = await lsdMarket().catch(() => null);
    const feeL = mk && mk.feeSettimanaStimaL$D ? mk.feeSettimanaStimaL$D : 0;
    const budget = WEEKLY_BUDGET + feeL; const cap = budget * PARAMS.tettoProfiloPct / 100;
    let assegnato = 0;
    for (const i of items) { i.quota = 0; i.importoProposto = 0; if (!i.idoneo || tot <= 0) continue; i.quota = i.punti / tot; i.importoProposto = Math.min(budget * i.quota, cap); i.importoProposto = Math.floor(i.importoProposto * 100) / 100; assegnato += i.importoProposto; }
    items.sort((a, b) => b.punti - a.punti || a.handle.localeCompare(b.handle));
    items.forEach((i, k) => { i.rango = k + 1; });
    const out = {
      epoca: weekId(ws), inizio: ws, fine: we, inizioRoma: fmtTs(ws), fineRoma: fmtTs(we - 1), inCorso: t < we, modalita: demo ? "demo" : "reale",
      budget: { stato: PARAMS.stato, quotaSettimanaL$D: Math.round(WEEKLY_BUDGET * 100) / 100, quotaFeeL$D: Math.round(feeL * 100) / 100, totaleL$D: Math.round(budget * 100) / 100, tettoProfiloL$D: Math.round(cap * 100) / 100, tettoProfiloPct: PARAMS.tettoProfiloPct,
        assegnatoL$D: Math.round(assegnato * 100) / 100, ritornaAlFondoL$D: Math.round((budget - assegnato) * 100) / 100 },
      puntiTotali: Math.round(tot * 100) / 100, profili: items.length, idonei: el.length, items,
    };
    out.hash = crypto.createHash("sha256").update(JSON.stringify({ e: out.epoca, p: PARAMS.quotaProposta, b: out.budget, i: items.map((i) => [i.handle, i.punti, i.importoProposto]) })).digest("hex");
    return out;
  }

  const publicItem = (i, me) => {
    const o = { rango: i.rango, handle: i.handle, test: i.test, punti: i.punti, quota: Math.round(i.quota * 10000) / 100, importoProposto: i.importoProposto, idoneo: i.idoneo, pagabile: i.pagabile, motivo: i.motivo, tu: !!(me && me === i.wallet) };
    if (o.tu) o.dettaglio = { punti: i.pts, base: i.base, bonusHolder: i.hb, post: i.nPost, likeDaProfiliDistinti: i.likers, nuoviFollower: i.fols, oreLP: i.lpOre, badgeVerificato: i.verificato, ovid: i.ovid };
    return o;
  };

  async function state(url, me) {
    const ws = epochFromArg(url.searchParams.get("epoch") || "current", now());
    const e = await compute(ws);
    const [mk, mi, zc] = await Promise.all([lsdMarket().catch(() => null), minerBand().catch(() => null), zcommSummary().catch(() => null)]);
    const tot = { post: 0, like: 0, follower: 0, badge: 0, lp: 0, zcomm: 0, work_proof: 0 }; for (const i of e.items) for (const k in tot) tot[k] += i.pts[k];
    const ap = approvers(); const appr = q("SELECT approver, ts FROM pool_approvals WHERE epoch=? AND hash=?", e.epoca, e.hash);
    return {
      ok: true, epoca: { id: e.epoca, inizioRoma: e.inizioRoma, fineRoma: e.fineRoma, inCorso: e.inCorso, modalita: e.modalita }, ora: new Date().toISOString(),
      etichetta: e.modalita === "demo" ? "DEMO: calcolato solo su account di test DSN-X. Nessun pagamento possibile." : "Calcolo su profili reali. Distribuzione solo PROPOSTA.",
      parametri: PARAMS, budget: e.budget, puntiTotali: e.puntiTotali, profili: e.profili, idonei: e.idonei,
      puntiPerFonte: { ...tot, nota: "somma dei punti di tutti i profili idonei e non, per fonte" },
      classifica: e.items.map((i) => publicItem(i, me)),
      snapshot: { hash: e.hash, ancoraggio: "non ancorato: serve ok di doc per ancorare su Solana", ricevuta: "ZLANG // POOL RECEIPT" },
      mercato: mk, miner: mi,
      antifakeToken: mk ? { fonte: "K.I.R.A. / regole antifake ZDESK sui dati pubblici", livello: mk.kira && mk.kira.level, segnali: mk.kira && mk.kira.flags, mintAuthorityAttiva: !!mk.mintAuthority, blocca: !!(mk.kira && mk.kira.level === "rosso") } : null,
      identita: { metodo: "firma wallet SIWS (zdos-firma) + gate 18+; account unico per wallet", antifakeZdesk: "lo sniffer ZDESK valuta token, non persone: sul profilo valgono i controlli sociali (likes/follower solo da profili attivi distinti, tetti, niente auto-like)", esclusi: "fondatore, agente e AI ufficiali (stesse esclusioni del fondo merito); account di test mai pagabili" },
      approvazione: { richiede: "firma manuale del wallet approvatore sull'hash dell'epoca", approvatoriConfigurati: ap.length, messaggio: approvalMessage(e.epoca, e.hash), registrate: appr.length, tuSeiApprovatore: !!(me && ap.includes(me)), pagamentiEseguitiDaQuestoSistema: 0 },
      killSwitch: { pagamentiAbilitati: false, motivo: "nessun esecutore di pagamenti esiste: questo sistema calcola e mostra soltanto", fileSTOP: fs.existsSync(STOP_FILE) ? "presente" : "assente (" + STOP_FILE + ")", fondoMeritoVELVET: zc && zc.emissions ? { live: zc.emissions.live, stop: zc.emissions.stop } : null, nota: "il fondo merito VELVET è un programma separato: qui non viene toccato" },
      bloccanti: [
        { id: "A4JY5", stato: "in attesa di doc", testo: "Chi controlla il wallet A4JY5…G9PJ? È anche mint authority di L$D e tiene il 99,95% della supply." },
        { id: "mint-authority", stato: "in attesa di doc", testo: "Revoca della mint authority di L$D: irreversibile, serve ok esplicito di doc. Finché è attiva la supply può crescere (K.I.R.A. rosso)." },
        { id: "quota-merito", stato: "in attesa di doc", testo: "Quota per il merito: 10% = 20M L$D su 26 settimane è una proposta, nessuna cifra approvata." },
        { id: "wallet-merito", stato: "non creato", testo: "Wallet merito L$D dedicato: non esiste ancora, nessun fondo allocato." },
        { id: "fondo-velvet", stato: "in attesa di doc", testo: "Migrazione del fondo merito dal VELVET fermo: non decisa." },
      ],
      note: "Nessun rendimento promesso. Detenere L$D da solo vale 0 punti. Dati di mercato in sola lettura da fonti pubbliche; se una fonte non risponde il campo resta vuoto.",
    };
  }
  const approvalMessage = (epoch, hash) => `ZDOS Pool Party v1\nAzione: approvo la distribuzione PROPOSTA\nEpoca: ${epoch}\nSnapshot: ${hash}\nQuesta firma non è una transazione e non muove fondi.`;

  async function handle(req, res, p, url, h) {
    const { send, fail, readJson } = h; const s = await session(req); const me = s ? s.address : null;
    if (req.method === "GET" && p === "/api/social/pool/state") return send(res, 200, await state(url, me));
    if (req.method === "POST" && p === "/api/social/pool/approve") {
      if (!me) return fail(res, 401, "Accedi con firma wallet.");
      const ap = approvers(); if (!ap.length) return fail(res, 503, "Nessun approvatore configurato: le approvazioni sono disattivate.");
      if (!ap.includes(me)) return fail(res, 403, "Questo wallet non è un approvatore.");
      const b = await readJson(req); const e = await compute(epochFromArg(String(b.epoca || ""), now()));
      if (b.hash !== e.hash) return fail(res, 409, "Lo snapshot è cambiato: ricarica la pagina.");
      let sig; try { sig = bs58.decode(String(b.firma || "")); } catch { return fail(res, 400, "Firma non valida."); }
      if (sig.length !== 64 || !nacl.sign.detached.verify(new TextEncoder().encode(approvalMessage(e.epoca, e.hash)), sig, bs58.decode(me))) return fail(res, 401, "Firma non valida.");
      db.prepare("INSERT OR IGNORE INTO pool_approvals(epoch,hash,approver,sig,ts) VALUES(?,?,?,?,?)").run(e.epoca, e.hash, me, bs58.encode(sig), now());
      return send(res, 201, { ok: true, registrata: true, nota: "Approvazione registrata. Questo sistema non esegue pagamenti." });
    }
    return fail(res, 404, "non trovato");
  }
  return { handle, compute, collectLp, state, _approvalMessage: approvalMessage };
}
