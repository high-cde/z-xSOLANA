/* L$D vesting Jupiter Lock · UI. Simula prima, firma A4JY5 in Phantom (signTransaction), poi la chiave base usa e getta. © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var L = window.LSDT, U = window.LSDTUI, $ = U.$;
  var PRESETS = { treasury: { rec: L.AUTH.toBase58(), amt: "90000000", freq: "month", cliff: "12", periods: "24" }, merito: { rec: L.MERIT.toBase58(), amt: "20000000", freq: "week", cliff: "0", periods: "26" } };
  var lastSim = null, busy = false;
  function key() { return ["preset", "rec", "amt", "freq", "cliff", "periods"].map(function (i) { return $(i).value.trim(); }).join("|"); }
  function refresh() { $("go").disabled = !(U.state.account && $("chk").checked && lastSim && !busy && lastSim.key === key()); }
  function apply(p) { var v = PRESETS[p]; $("meritWarn").hidden = p !== "merito"; $("preset").value = p; $("rec").value = v.rec; $("amt").value = v.amt; $("freq").value = v.freq; $("cliff").value = v.cliff; $("periods").value = v.periods; lastSim = null; $("summary").hidden = true; refresh(); }
  $("preset").addEventListener("change", function () { apply($("preset").value); });
  ["rec", "amt", "freq", "cliff", "periods"].forEach(function (i) { $(i).addEventListener("input", function () { lastSim = null; $("summary").hidden = true; refresh(); }); $(i).addEventListener("change", function () { lastSim = null; refresh(); }); });
  U.onChange(refresh); $("chk").addEventListener("change", refresh);
  var q = new URLSearchParams(location.search).get("preset"); if (q && PRESETS[q]) apply(q);

  function dt(ts) { return new Date(ts * 1000).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "medium", timeStyle: "short" }); }
  function build() {
    var amt = L.toBase($("amt").value), cliff = parseInt($("cliff").value, 10), periods = parseInt($("periods").value, 10);
    var freq = $("freq").value === "week" ? L.WEEK : L.MONTH;
    if (!amt) throw new Error("importo non valido");
    if (!(cliff >= 0 && cliff <= 120)) throw new Error("cliff non valido (0–120)");
    if (!(periods >= 1 && periods <= 520)) throw new Error("numero di rate non valido (1–520)");
    var start = Math.floor(Date.now() / 1000) + 60;
    return { amt: amt, sched: L.vestingSchedule(amt, start, cliff * freq, freq, periods), freq: freq, cliff: cliff, periods: periods };
  }
  function run() {
    var p; try { p = build(); } catch (e) { return Promise.reject(e); }
    var rec = $("rec").value;
    return Promise.all([L.tokenBalance(L.AUTH), L.solBalance(L.AUTH), L.rpc("getLatestBlockhash", [{ commitment: "confirmed" }])]).then(function (r) {
      var bal = r[0], sol = r[1], bh = r[2].value.blockhash;
      if (p.amt > bal) throw new Error("importo superiore al saldo L$D di A4JY5 (" + U.n(L.fromBase(bal), 6) + ")");
      var b = L.buildVesting(rec, p.sched, bh), d = L.describe(b.tx);
      if (d.pagatore !== U.AUTH || d.firmeRichieste !== 2 || d.istruzioni.length !== 2 || d.istruzioni[1].programma !== L.LOCK.toBase58() || d.istruzioni[1].datiHex.slice(-4) !== "0000")
        throw new Error("controllo interno fallito: la transazione non corrisponde a quanto previsto");
      $("detail").textContent = JSON.stringify(d, null, 2);
      return L.simulate(b.tx, [L.AUTH, L.ata(L.AUTH), b.escrow, b.escrowToken]).then(function (sim) {
        if (!sim || !sim.value || sim.value.err) throw new Error("simulazione fallita: " + JSON.stringify(sim && sim.value && sim.value.err) + " " + ((sim && sim.value && sim.value.logs) || []).slice(-3).join(" | "));
        var a = sim.value.accounts, after = Number(a[1].data.parsed.info.tokenAmount.uiAmountString), locked = Number(a[3].data.parsed.info.tokenAmount.uiAmountString);
        var s = p.sched, sup = L.SUPPLY, before = L.fromBase(bal), unit = p.freq === L.WEEK ? "settimane" : "mesi";
        var first = Number(s.cliff_time) + p.freq, end = Number(s.cliff_time) + p.freq * p.periods;
        var txt = "SIMULAZIONE RIUSCITA (" + new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" }) + " ora di Roma)\n" +
          "Programma:     Jupiter Lock LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn\n" +
          "Escrow:        " + b.escrow.toBase58() + "\n" +
          "Destinatario:  " + rec + "\n" +
          "Bloccati:      " + U.n(locked, 6) + " L$D = " + U.n(locked / sup * 100, 4) + "% della supply\n" +
          "Calendario:    inizio " + dt(Number(s.vesting_start_time)) + " · cliff " + p.cliff + " " + unit + " (" + dt(Number(s.cliff_time)) + ")\n" +
          "               poi " + p.periods + " rate da " + U.n(L.fromBase(s.amount_per_period), 6) + " L$D, prima " + dt(first) + ", ultima " + dt(end) + "\n" +
          "Al cliff:      " + U.n(L.fromBase(s.cliff_unlock_amount), 6) + " L$D (solo arrotondamento)\n" +
          "Cancellabile:  NO (cancel_mode 0) · destinatario modificabile: NO (update_recipient_mode 0)\n" +
          "A4JY5 prima:   " + U.n(before, 6) + " L$D (" + U.n(before / sup * 100, 4) + "%)\n" +
          "A4JY5 dopo:    " + U.n(after, 6) + " L$D (" + U.n(after / sup * 100, 4) + "%)\n" +
          "Rent escrow:   " + U.n(a[2].lamports / 1e9, 9) + " SOL · rent conto token escrow " + U.n(a[3].lamports / 1e9, 9) + " SOL\n" +
          "Costo totale:  " + U.n((sol - a[0].lamports) / 1e9, 9) + " SOL (rent + commissione 2 firme) · fee programma: 0\n" +
          "SOL A4JY5:     " + U.n(sol / 1e9, 9) + " → " + U.n(a[0].lamports / 1e9, 9) + "\n" +
          "Compute units: " + sim.value.unitsConsumed + "\n" +
          "Insider:       i token restano del progetto ma BLOCCATI (contati come insider bloccati)";
        $("summary").textContent = txt; $("summary").hidden = false;
        return { key: key(), tx: b.tx, base: b.base, escrow: b.escrow };
      });
    });
  }
  $("sim").addEventListener("click", function () {
    U.say("simStatus", "Simulo sulla rete…"); lastSim = null; refresh();
    run().then(function (s) { lastSim = s; U.say("simStatus", "Simulazione riuscita. Controlla il riepilogo.", "fm-ok"); refresh(); })
      .catch(function (e) { U.say("simStatus", "Non simulata: " + (e.message || e), "fm-err"); });
  });
  $("go").addEventListener("click", function () {
    if (busy || !U.state.account || !$("chk").checked || !lastSim) return;
    busy = true; refresh(); U.say("status", "Rifaccio la simulazione con un blockhash nuovo…");
    var cur;
    run().then(function (s) {
      cur = s;
      var f = U.state.wallet.features["solana:signTransaction"];
      if (!f) throw new Error("il wallet non supporta signTransaction (serve Phantom aggiornato)");
      U.say("status", "Simulazione riuscita. Firma nel wallet…");
      return f.signTransaction({ account: U.state.account, transaction: s.tx.serialize(), chain: U.chain() });
    }).then(function (out) {
      var o = Array.isArray(out) ? out[0] : out;
      var signed = L.VersionedTransaction.deserialize(o.signedTransaction);
      var a = signed.message.serialize(), b = cur.tx.message.serialize();
      if (a.length !== b.length || a.some(function (x, i) { return x !== b[i]; })) throw new Error("il wallet ha modificato la transazione: invio annullato per sicurezza");
      signed.sign([cur.base]);
      U.say("status", "Firmata. Invio alla rete…");
      return L.sendRaw(signed.serialize());
    }).then(function (sig) {
      $("sig").textContent = sig; $("scan").href = "https://solscan.io/tx/" + sig; $("esc").textContent = cur.escrow.toBase58();
      $("jl").href = "https://lock.jup.ag/escrow/" + cur.escrow.toBase58(); $("done").hidden = false;
      U.say("status", "Inviata. Attendo la conferma…", "fm-ok");
      return U.confirm(sig).then(function (ok) { U.say("status", ok ? "Vesting creato e confermato. Compare su /lsd-trasparenza/ entro un minuto." : "Conferma non ancora visibile: controlla su Solscan.", ok ? "fm-ok" : ""); });
    }).catch(function (e) { U.say("status", "Non eseguita: " + (e && e.message || e), "fm-err"); })
      .then(function () { busy = false; lastSim = null; refresh(); });
  });
})();
