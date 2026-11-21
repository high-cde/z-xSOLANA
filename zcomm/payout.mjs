// Pagamenti settimanali del fondo merito VELVET.
// Uso: node payout.mjs status | dry-run [current|previous|YYYY-Www] | settle [previous]
// Regole: paga SOLO dal fondo (wallet.address del config), SOLO profili Radar verificati con punti reali,
// mai il fondatore né le AI ufficiali, mai oltre i tetti del config. Prima di ogni invio fa una simulazione (dry-run).
// Kill switch: emissionsLive=false nel config, oppure il file /etc/zdos-fondo-merito/STOP.
// Un pagamento rimasto a metà (crash) va in "to_verify" e non viene mai reinviato in automatico.
// © 2026 ZDOS1.3 · Licenza ZSEL proprietaria.
import fs from "node:fs";
import { Connection, PublicKey, Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createTransferCheckedInstruction, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as L from "./lib.mjs";

const DAY = 86400; const FEE = 5000; const RENT_RESERVE = 900_000; // lamport che il fondo deve sempre tenere
const KEYFILE = L.E.FONDO_KEY_FILE || "/etc/zdos-agi-wallets/fondo-merito.json";
const conn = new Connection(L.RPC[0], "confirmed");
const log = (...a) => console.log(...a);

function weekFromArg(arg) {
  const t = L.now();
  if (!arg || arg === "previous") return L.weekStart(L.weekStart(t) - 3600);
  if (arg === "current") return L.weekStart(t);
  const m = /^(\d{4})-W(\d{2})$/.exec(arg); if (!m) throw new Error("settimana non valida");
  let ws = L.weekStart(L.romeMidnight(+m[1], 1, 4)); ws += (+m[2] - 1) * 7 * DAY; return L.weekStart(ws + 7200);
}
function buildTx(cfg, toWallet, amountAtomic, blockhash) {
  const mint = new PublicKey(cfg.token.mint); const fund = new PublicKey(cfg.wallet.address);
  const src = getAssociatedTokenAddressSync(mint, fund, false, TOKEN_2022_PROGRAM_ID);
  if (src.toBase58() !== cfg.wallet.ata) throw new Error("ATA del fondo non corrisponde al config");
  const dst = getAssociatedTokenAddressSync(mint, new PublicKey(toWallet), false, TOKEN_2022_PROGRAM_ID);
  const ix = createTransferCheckedInstruction(src, mint, dst, fund, BigInt(amountAtomic), cfg.token.decimals, [], TOKEN_2022_PROGRAM_ID);
  const msg = new TransactionMessage({ payerKey: fund, recentBlockhash: blockhash, instructions: [ix] }).compileToV0Message();
  return { tx: new VersionedTransaction(msg), dst: dst.toBase58() };
}
async function dryRunItems(cfg, items) {
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  for (const i of items) {
    if (!i.eligible || BigInt(i.amountAtomic) <= 0n) continue;
    const { tx, dst } = buildTx(cfg, i.wallet, i.amountAtomic, blockhash);
    const acc = await conn.getAccountInfo(new PublicKey(dst));
    if (!acc) { i.dry = { ok: false, reason: "il wallet non ha ancora un conto VELVET (serve aprirlo: il fondo non paga l'apertura)" }; continue; }
    const sim = await conn.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed" });
    i.dry = sim.value.err ? { ok: false, reason: "simulazione fallita: " + JSON.stringify(sim.value.err), logs: (sim.value.logs || []).slice(-4) } : { ok: true, units: sim.value.unitsConsumed };
  }
}
async function fundCheck(cfg, plan) {
  const f = await L.fundState(cfg); const n = plan.items.filter((i) => i.dry && i.dry.ok).length;
  const need = plan.items.filter((i) => i.dry && i.dry.ok).reduce((s, i) => s + BigInt(i.amountAtomic), 0n);
  const okTok = BigInt(f.velvetAtomic) >= need; const okSol = f.lamports - n * FEE >= RENT_RESERVE;
  return { f, n, need, okTok, okSol };
}
function printPlan(plan) {
  log(`Settimana ${plan.week} · ${L.fmtRomeTs(plan.weekStart)} → ${L.fmtRomeTs(plan.weekEnd)} (ora di Roma) · semestre ${plan.semesterIndex + 1}`);
  log(`Pool ${L.fromAtomic(plan.poolAtomic)} VELVET (quota settimana ${Math.round(plan.frac * 100)}%) · max a profilo ${L.fromAtomic(plan.perProfileMaxAtomic)} · punti idonei ${plan.totalPoints}`);
  for (const i of plan.items) log(` - ${i.ovid} ${i.roleLabel} · base ${i.base} · x${Math.round(i.mx.total * 100) / 100} = ${i.points} pt · ${i.eligible ? "IDONEO " + L.fromAtomic(i.amountAtomic) + " VELVET" : "non idoneo: " + i.reason}${i.dry ? " · dry-run " + (i.dry.ok ? "OK" : "NO: " + i.dry.reason) : ""}`);
  log(`Totale previsto ${L.fromAtomic(plan.totalAtomic)} VELVET a ${plan.eligible} profili · in attesa ${plan.held}`);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const cfg = L.loadConfig(); const db = L.openDb(); const key = L.readKey(false);
  if (cfg.wallet.address !== "GEntwhyRQASi5n9uWSqYhMRtePGoogDpsbuoZBwCECDd") throw new Error("il config non punta al fondo merito: fermo");
  L.ingestAll(db, key);
  const radar = L.readRadar(); if (!radar) throw new Error("Radar non leggibile");
  if (cmd === "status") {
    const f = await L.fundState(cfg); log("Fondo:", f.velvet, "VELVET ·", f.sol, "SOL"); log("Kill switch:", L.killSwitch(cfg) || "nessuno (emissioni attive)");
    printPlan(await L.planWeek(db, cfg, radar, L.weekStart(L.now()))); return;
  }
  if (cmd === "dry-run") {
    const plan = await L.planWeek(db, cfg, radar, weekFromArg(arg || "current")); await dryRunItems(cfg, plan.items); printPlan(plan);
    const c = await fundCheck(cfg, plan); log(`Fondo ${c.f.velvet} VELVET · ${c.f.sol} SOL · token sufficienti ${c.okTok} · SOL per commissioni ${c.okSol}`);
    log("Kill switch:", L.killSwitch(cfg) || "nessuno"); log("DRY-RUN: nessuna transazione inviata."); return;
  }
  if (cmd !== "settle") { log("uso: status | dry-run [current|previous|YYYY-Www] | settle [previous|YYYY-Www]"); return; }

  const ws = weekFromArg(arg || "previous"); const t = L.now();
  if (ws + 7 * DAY > t) throw new Error("la settimana non è ancora chiusa");
  const start = L.parseStart(cfg); if (!start || ws + 7 * DAY <= start) { log("settimana precedente all'avvio dei premi: niente da fare"); return; }
  const wid = L.weekId(ws);
  const prev = db.prepare("SELECT * FROM batches WHERE week=?").get(wid);
  // pagamenti rimasti a metà: mai reinviati in automatico
  db.prepare("UPDATE payouts SET status='to_verify', reason='invio interrotto: verificare su Solscan prima di qualsiasi nuovo invio', updated=? WHERE status='sending'").run(t);
  if (prev && ["sent", "held", "empty", "partial"].includes(prev.status)) { log("settimana", wid, "già chiusa:", prev.status); return; }
  const plan = await L.planWeek(db, cfg, radar, ws); await dryRunItems(cfg, plan.items); printPlan(plan);
  const up = db.prepare(`INSERT INTO batches(week,week_start,week_end,semester,pool_atomic,per_profile_max_atomic,total_points,status,note,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(week) DO UPDATE SET total_points=excluded.total_points,status=excluded.status,note=excluded.note,updated=excluded.updated`);
  const putItem = db.prepare(`INSERT INTO payouts(week,ovid,wallet,points,amount_atomic,status,reason,dry_run,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(week,ovid) DO UPDATE SET points=excluded.points,amount_atomic=excluded.amount_atomic,status=excluded.status,reason=excluded.reason,dry_run=excluded.dry_run,updated=excluded.updated WHERE payouts.status NOT IN ('sent','to_verify','sending')`);
  for (const i of plan.items) {
    if (i.points <= 0) continue;
    const okDry = i.eligible && i.dry && i.dry.ok && BigInt(i.amountAtomic) > 0n;
    const st = okDry ? "dry_run_ok" : "held";
    const reason = !i.eligible ? i.reason : i.dry && !i.dry.ok ? i.dry.reason : BigInt(i.amountAtomic) <= 0n ? "quota arrotondata a zero" : null;
    putItem.run(wid, i.ovid, i.wallet, i.points, okDry ? i.amountAtomic : "0", st, reason, i.dry ? JSON.stringify(i.dry) : null, t, t);
  }
  const ready = db.prepare("SELECT * FROM payouts WHERE week=? AND status='dry_run_ok'").all(wid);
  const kill = L.killSwitch(cfg); const c = await fundCheck(cfg, plan);
  if (!ready.length) { const anyHeld = db.prepare("SELECT COUNT(*) n FROM payouts WHERE week=? AND status='held'").get(wid).n; up.run(wid, ws, ws + 7 * DAY, plan.semesterIndex, plan.poolAtomic, plan.perProfileMaxAtomic, plan.totalPoints, anyHeld ? "held" : "empty", anyHeld ? "nessun profilo pagabile: pagamenti in attesa (vedi motivo per ID)" : "nessun punto idoneo", t, L.now()); log("Nessun pagamento da inviare."); return; }
  if (kill) { up.run(wid, ws, ws + 7 * DAY, plan.semesterIndex, plan.poolAtomic, plan.perProfileMaxAtomic, plan.totalPoints, "stopped", "kill switch: " + kill, t, L.now()); log("FERMO:", kill); return; }
  if (!c.okTok || !c.okSol) { up.run(wid, ws, ws + 7 * DAY, plan.semesterIndex, plan.poolAtomic, plan.perProfileMaxAtomic, plan.totalPoints, "stopped", !c.okTok ? "VELVET insufficienti nel fondo" : "SOL del fondo insufficienti per le commissioni", t, L.now()); log("FERMO: fondi insufficienti"); return; }
  // Firma: solo qui si legge la chiave del fondo, e solo se corrisponde all'indirizzo del config.
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(KEYFILE, "utf8"))));
  if (kp.publicKey.toBase58() !== cfg.wallet.address) throw new Error("la chiave non è quella del fondo: fermo");
  let sent = 0;
  for (const p of ready) {
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    const { tx } = buildTx(cfg, p.wallet, p.amount_atomic, blockhash); tx.sign([kp]);
    db.prepare("UPDATE payouts SET status='sending', updated=? WHERE id=?").run(L.now(), p.id);
    try {
      const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
      db.prepare("UPDATE payouts SET signature=?, updated=? WHERE id=?").run(sig, L.now(), p.id);
      const r = await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      if (r.value.err) throw new Error(JSON.stringify(r.value.err));
      db.prepare("UPDATE payouts SET status='sent', reason=NULL, updated=? WHERE id=?").run(L.now(), p.id); sent++;
      L.publish(db, L.readKey(false), { key: `merito:sent:${wid}:${p.ovid}`, type: "payout_sent", source: "merito", actor: p.ovid, data: { week: wid, velvet: L.fromAtomic(p.amount_atomic), sig } });
      log("inviato", p.ovid, L.fromAtomic(p.amount_atomic), "VELVET", sig);
    } catch (e) {
      const row = db.prepare("SELECT signature FROM payouts WHERE id=?").get(p.id);
      db.prepare("UPDATE payouts SET status=?, reason=?, updated=? WHERE id=?").run(row.signature ? "to_verify" : "dry_run_failed", "invio non riuscito: " + String(e.message).slice(0, 200), L.now(), p.id);
      log("errore invio", p.ovid, e.message);
    }
  }
  up.run(wid, ws, ws + 7 * DAY, plan.semesterIndex, plan.poolAtomic, plan.perProfileMaxAtomic, plan.totalPoints, sent === ready.length ? "sent" : "partial", `${sent}/${ready.length} inviati`, t, L.now());
}
main().catch((e) => { console.error("ERRORE:", e.message); process.exit(1); });
