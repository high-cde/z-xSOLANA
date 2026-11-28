/* L$D trasparenza · lettura dal vivo (/lsd-trasparenza/verde.json = ZDESK /api/lsd-verde). Sola lettura. © 2026 ZDOS1.3 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function n(v, d) { return v == null ? "n/d" : Number(v).toLocaleString("it-IT", { maximumFractionDigits: d == null ? 2 : d }); }
  function pct(v) { return v == null ? "n/d" : n(v, v < 0.01 && v > 0 ? 5 : 2) + "%"; }
  function short(a) { return a ? a.slice(0, 5) + "…" + a.slice(-4) : ""; }
  function addr(a) { return '<a class="lt-mono" href="https://solscan.io/account/' + esc(a) + '" target="_blank" rel="noopener noreferrer" title="' + esc(a) + '">' + esc(short(a)) + "</a>"; }
  function stat(s) { return s === "ok" ? '<b class="lt-ok">✓ ok</b>' : s === "manca" ? '<b class="lt-bad">✗ manca</b>' : '<span class="lt-mut">n/d</span>'; }
  var CLS = { insider: "insider libero", insider_bloccato: "insider bloccato", pool: "pool LP", bloccato: "bloccato", altro: "altro holder", progetto: "progetto" };
  function render(d) {
    var lvl = (d.kira && d.kira.level) || "n/d";
    $("lvl").textContent = lvl; $("lvl").className = "lt-lvl " + lvl;
    $("upd").textContent = "· letto " + new Date(d.checkedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" }) + " ora di Roma" + (d.cached ? " (cache 60 s)" : "");
    $("regola").textContent = "Regola: " + d.regola;
    $("checks").innerHTML = d.checks.map(function (c) {
      return "<tr><td>" + esc(c.label) + (c.status !== "ok" && c.come ? '<br><span class="fm-small lt-mut">' + esc(c.come) + "</span>" : "") + "</td><td>" + (c.livello === "rosso" ? '<span class="lt-bad">rosso</span>' : '<span class="lt-warn">giallo</span>') + "</td><td>" + esc(c.soglia) + "</td><td>" + esc(c.valore) + "</td><td>" + stat(c.status) + "</td></tr>";
    }).join("");
    $("extra").innerHTML = d.extra.map(function (c) { return "<tr><td>" + esc(c.label) + '<br><span class="fm-small lt-mut">' + esc(c.nota) + "</span></td><td>" + esc(c.valore) + "</td><td>" + stat(c.status) + "</td></tr>"; }).join("");
    var c = d.concentration || {};
    if (c.ok) {
      $("kpis").innerHTML = [
        ["Top holder (grezzo)", pct(c.topHolder && c.topHolder.pct), c.topHolder ? short(c.topHolder.owner) + " · " + (CLS[c.topHolder.cls] || c.topHolder.cls) : ""],
        ["Insider dichiarati (totale)", pct(c.insiderTotalPct), "liberi " + pct(c.insiderLiquidPct) + " · bloccati " + pct(c.insiderLockedPct)],
        ["Pool LP", pct(c.poolPct), n(c.pool, 2) + " L$D"],
        ["Altri holder", pct(c.otherPct + (c.lockedOtherPct || 0)), c.holdersOnchain + " holder on-chain in totale"],
      ].map(function (k) { return '<div class="lt-kpi"><small>' + esc(k[0]) + '</small><div class="lt-big">' + esc(k[1]) + '</div><small>' + esc(k[2]) + "</small></div>"; }).join("");
      $("hold").innerHTML = c.rows.map(function (r) { return "<tr><td>" + addr(r.owner) + "</td><td>" + esc(CLS[r.cls] || r.cls) + '<br><span class="fm-small lt-mut">' + esc(r.role) + "</span></td><td>" + n(r.amount, 2) + "</td><td>" + pct(r.pct) + "</td></tr>"; }).join("");
    } else { $("kpis").innerHTML = '<p class="lt-bad">Holder non leggibili ora: ' + esc(c.error || "n/d") + "</p>"; }
    $("decl").innerHTML = (d.declared || []).map(function (w) { return "<tr><td>" + addr(w.address) + "</td><td>" + esc(w.role) + (w.insider ? ' <span class="lt-tag">insider</span>' : "") + "</td><td>" + n(w.lsd, 2) + "</td><td>" + pct(w.pct) + "</td></tr>"; }).join("");
    var L = d.locks;
    if (Array.isArray(L)) {
      $("locks").innerHTML = !L.length ? "Nessun vesting Jupiter Lock su L$D, per ora." : '<table class="lt-tbl"><thead><tr><th>Escrow</th><th>Destinatario</th><th>Totale</th><th>Calendario</th><th>Cancellabile</th></tr></thead><tbody>' + L.map(function (l) {
        var dt = function (t) { return new Date(t * 1000).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" }); };
        return "<tr><td>" + addr(l.escrow) + "</td><td>" + addr(l.recipient) + "</td><td>" + n(l.total, 0) + " (riscossi " + n(l.claimed, 0) + ")</td><td>cliff " + dt(l.cliffTime) + ", " + l.periods + " rate ogni " + n(l.frequency / 86400, 1) + " g</td><td>" + (l.cancellable ? '<b class="lt-bad">sì</b>' : '<b class="lt-ok">no</b>') + "</td></tr>";
      }).join("") + "</tbody></table>";
    } else $("locks").textContent = "n/d (" + ((L && L.error) || "") + ")";
  }
  function load() {
    fetch("/lsd-trasparenza/verde.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(render).catch(function (e) { $("checks").innerHTML = '<tr><td colspan="5" class="lt-bad">Dati non disponibili: ' + esc(e.message) + "</td></tr>"; });
  }
  load(); setInterval(load, 90000);
})();
