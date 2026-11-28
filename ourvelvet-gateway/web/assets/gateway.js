/* OurVelvet Gateway · front-end. Dati solo da /api/gateway/* (catalogo, prezzi reali, richieste), identità = firma OurVelvet. © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function getJson(u, ms) { var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms || 8000); return fetch(u, { cache: "no-store", signal: c.signal, credentials: "same-origin" }).then(function (r) { clearTimeout(t); return r.json(); }); }
  function send(m, u, b) { return fetch(u, { method: m, credentials: "same-origin", headers: { "content-type": "application/json", "x-ov-gateway": "1" }, body: b ? JSON.stringify(b) : undefined }).then(function (r) { return r.json().then(function (j) { j._s = r.status; return j; }); }); }
  var eur = function (x) { return Number(x).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }); };
  var num = function (x, d) { return Number(x).toLocaleString("it-IT", { maximumFractionDigits: d == null ? 0 : d }); };
  var when = function (ts) { return new Date(ts * 1000).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
  var STATI = { nuova: "Nuova", in_lavorazione: "In lavorazione", preventivo_inviato: "Preventivo inviato", confermata_partner: "Confermata dal partner", completata: "Completata", annullata: "Annullata" };
  var CAT = null, PX = null, ME = null;

  /* ---- gate 18+ ---- */
  var gate = $("#gate");
  if (gate) {
    var ok = false; try { ok = localStorage.getItem("ov18") === "1"; } catch (e) {}
    if (!ok) gate.hidden = false;
    $("#gateYes").addEventListener("click", function () { try { localStorage.setItem("ov18", "1"); } catch (e) {} gate.hidden = true; });
  }

  /* ---- prezzi ---- */
  function loadPrices() {
    return getJson("/api/gateway/prices").then(function (p) {
      PX = p; var meta = $("#pxMeta"), b = $("#pxBadge"); if (!meta) return p;
      meta.textContent = "";
      if (!p.ok) { b.textContent = "N/D"; meta.textContent = "Prezzi non disponibili in questo momento."; return p; }
      b.textContent = p.sottile ? "LIQUIDITÀ BASSA" : "LIVE";
      [["SOL", eur(p.solEur)], ["L$D", p.lsdEur ? num(p.lsdEur, 6) + " €" : "n/d"], ["Pool L$D-SOL", "~" + num(p.poolTvlUsd, 2) + " USD"], ["Cambio BCE", "1 USD = " + num(p.eurPerUsd, 4) + " € (" + p.fxData + ")"]]
        .forEach(function (kv) { var s = el("span"); s.appendChild(el("b", "", kv[0] + " ")); s.appendChild(document.createTextNode(kv[1])); meta.appendChild(s); });
      if (p.sottile && $("#thin")) { $("#thin").hidden = false; $("#thinTxt").textContent = p.avviso; }
      return p;
    }).catch(function () { var m = $("#pxMeta"); if (m) m.textContent = "Prezzi non raggiungibili."; });
  }
  function calc() {
    var v = +$("#calcEur").value, out = $("#calcOut"); out.textContent = "";
    if (!(v >= 50)) { out.appendChild(el("p", "muted", "Inserisci un importo da 50 €.")); return; }
    getJson("/api/gateway/convert?eur=" + v).then(function (j) {
      out.textContent = ""; if (!j.ok) { out.appendChild(el("p", "muted", j.errore || "errore")); return; }
      var q = j.equivalenti, rb = j.rimborsoBase;
      function box(lbl, val, note) { var d = el("div"); d.appendChild(el("span", "muted small", lbl)); d.appendChild(el("b", "", val)); if (note) d.appendChild(el("span", "muted small", note)); out.appendChild(d); }
      box("Equivalente in SOL", q ? num(q.sol, 4) + " SOL" : "n/d", "al cambio di adesso");
      box("Equivalente in L$D", q && q.lsd ? num(q.lsd) + " L$D" : "n/d", q && q.sottile ? "solo indicativo: liquidità molto bassa" : "");
      box("Rimborso L$D proposto", eur(rb.eur) + (rb.lsd ? " ≈ " + num(rb.lsd) + " L$D" : ""), rb.pct + "% base · proposta, da confermare con doc");
    });
  }

  /* ---- catalogo ---- */
  function loadCatalog() {
    return getJson("/api/gateway/catalog").then(function (c) {
      CAT = c; var t = {}; c.route.tappe.forEach(function (x) { t[x.id] = x; });
      var mods = $("#mods"); if (mods) c.moduli.forEach(function (m, i) { var a = el("a"); a.href = m.link; a.appendChild(el("span", "n", "0" + (i + 1))); a.appendChild(el("h3", "", m.titolo)); a.appendChild(el("p", "", m.desc)); mods.appendChild(a); });
      var pk = $("#pk"); if (pk) c.route.pacchetti.forEach(function (p) { var d = el("div", "p"); d.appendChild(el("span", "nt", p.notti)); d.appendChild(el("h3", "", p.titolo)); var ul = el("ul"); p.tappe.forEach(function (id) { ul.appendChild(el("li", "", t[id].titolo)); }); d.appendChild(ul); pk.appendChild(d); });
      var sel = $("#fPkg"); if (sel) { c.route.pacchetti.forEach(function (p) { var o = el("option", "", p.titolo + " · " + p.notti); o.value = p.id; sel.appendChild(o); }); var o2 = el("option", "", "Su misura"); o2.value = "su-misura"; sel.appendChild(o2);
        var q = new URLSearchParams(location.search).get("formula"); if (q) sel.value = q; }
      var ex = $("#fExtras"); if (ex) c.route.tappe.forEach(function (x) { var l = el("label"), i = el("input"); i.type = "checkbox"; i.value = x.id; l.appendChild(i); l.appendChild(document.createTextNode(x.titolo)); ex.appendChild(l); });
      var r = $("#rules"); if (r) c.regole.forEach(function (x) { r.appendChild(el("li", "", x)); });
      if ($("#legalRole")) $("#legalRole").textContent = c.legale.ruolo;
      var lm = $("#legalMissing"); if (lm) c.legale.mancano.forEach(function (x) { lm.appendChild(el("li", "", x)); });
      var route = $("#routeList"); if (route) renderRoute(route, c);
      return c;
    });
  }
  function renderRoute(ol, c) {
    c.route.tappe.forEach(function (x) {
      var li = el("li"); li.id = "t-" + x.id; li.appendChild(el("span", "where", x.luogo)); li.appendChild(el("h3", "", x.titolo)); li.appendChild(el("p", "", x.testo));
      x.partner.forEach(function (p) { li.appendChild(el("span", "ph", p.nome + " · " + p.stato)); }); ol.appendChild(li);
    });
    var pk = $("#pkRoute"); if (pk) c.route.pacchetti.forEach(function (p) { var d = el("div", "p"); d.appendChild(el("span", "nt", p.notti)); d.appendChild(el("h3", "", p.titolo)); var a = el("a", "btn ghost", "Chiedi questa formula"); a.href = "/gateway/?formula=" + p.id + "#richiesta"; a.style.marginTop = "12px"; d.appendChild(a); pk.appendChild(d); });
  }

  /* ---- sessione ---- */
  function refreshMe() {
    return getJson("/api/gateway/me").then(function (j) {
      ME = j && j.autenticato ? j : null;
      if ($("#loginBox")) $("#loginBox").hidden = !!ME;
      if ($("#meBox")) { $("#meBox").hidden = !ME; if (ME) { $("#meChip").textContent = ME.address.slice(0, 4) + "…" + ME.address.slice(-4); $("#meTxt").textContent = "Connesso con firma OurVelvet" + (ME.nonLetti ? " · " + ME.nonLetti + " messaggi nuovi" : ""); } }
      if ($("#wipe")) $("#wipe").hidden = !ME;
      return loadMine();
    });
  }
  function loadMine() {
    var box = $("#mine"); if (!box) return;
    if (!ME) { box.textContent = ""; box.appendChild(el("p", "muted", "Accedi per vedere le tue richieste.")); return; }
    return getJson("/api/gateway/requests").then(function (j) {
      box.textContent = "";
      if (!j.ok) { box.appendChild(el("p", "muted", j.errore || "errore")); return; }
      if (!j.richieste.length) { box.appendChild(el("p", "muted", "Nessuna richiesta ancora.")); return; }
      j.richieste.forEach(function (r) {
        var d = el("div", "rq"), hd = el("div", "hd");
        hd.appendChild(el("b", "", r.id)); hd.appendChild(el("span", "st", STATI[r.stato] || r.stato));
        hd.appendChild(el("span", "muted small", (r.tipo === "lista_attesa" ? "Lista d'attesa" : "Preventivo") + " · " + r.pacchetto + " · " + r.adulti + " adulti" + (r.dal ? " · " + r.dal + (r.al ? " → " + r.al : "") : "")));
        d.appendChild(hd);
        if (r.preventivoEur) { var q = el("p", "", "Preventivo: " + eur(r.preventivoEur)); if (r.equivalenti) q.appendChild(el("span", "muted small", " · ≈ " + num(r.equivalenti.sol, 4) + " SOL" + (r.equivalenti.lsd ? " · ≈ " + num(r.equivalenti.lsd) + " L$D" + (r.equivalenti.sottile ? " (indicativo)" : "") : ""))); d.appendChild(q); }
        if (r.rimborso) d.appendChild(el("p", "small", "Rimborso L$D a registro: " + eur(r.rimborso.eur) + " (" + r.rimborso.pct + "%)" + (r.rimborso.lsd ? " ≈ " + num(r.rimborso.lsd) + " L$D" : "") + " · " + r.rimborso.stato + ", nessun pagamento automatico"));
        if (r.merito) d.appendChild(el("p", "small", "Merito: " + r.merito.punti + " punti · " + r.merito.stato));
        var ul = el("ul", "msgs"); r.messaggi.forEach(function (m) { var li = el("li", m.da); li.appendChild(el("span", "w", (m.da === "staff" ? "Staff OurVelvet" : "Tu") + " · " + when(m.quando))); li.appendChild(document.createTextNode(m.testo)); ul.appendChild(li); }); d.appendChild(ul);
        if (r.stato !== "annullata" && r.stato !== "completata") {
          var f = el("form", "req"); f.style.cssText = "grid-template-columns:1fr auto;margin-top:10px;padding:10px";
          var ta = el("input"); ta.placeholder = "Scrivi allo staff…"; ta.maxLength = 1000; var b = el("button", "btn ghost", "Invia"); b.type = "submit";
          var c = el("button", "btn ghost", "Annulla richiesta"); c.type = "button";
          f.appendChild(ta); f.appendChild(b); d.appendChild(f); d.appendChild(c);
          f.addEventListener("submit", function (e) { e.preventDefault(); if (!ta.value.trim()) return; send("POST", "/api/gateway/requests/" + r.id + "/messages", { testo: ta.value }).then(function (x) { if (!x.ok) alert(x.errore); loadMine(); }); });
          c.addEventListener("click", function () { if (confirm("Annullare la richiesta " + r.id + "?")) send("POST", "/api/gateway/requests/" + r.id + "/cancel").then(loadMine); });
        }
        box.appendChild(d);
      });
    });
  }

  /* ---- invio richiesta ---- */
  function bindForm() {
    var f = $("#reqForm"); if (!f) return;
    f.addEventListener("submit", function (e) {
      e.preventDefault(); var out = $("#fOut"); out.className = "out";
      if (!ME) { out.className = "out err"; out.textContent = "Prima accedi con OurVelvet (firma wallet) qui sopra."; return; }
      var extras = [].slice.call(document.querySelectorAll("#fExtras input:checked")).map(function (i) { return i.value; });
      var body = { kind: $("#fKind").value, package: $("#fPkg").value, dateFrom: $("#fFrom").value || null, dateTo: $("#fTo").value || null, pax: +$("#fPax").value,
        budgetEur: $("#fBudget").value ? +$("#fBudget").value : null, extras: extras, note: $("#fNote").value, adult: $("#fAdult").checked, consent: $("#fConsent").checked,
        terms: $("#fTerms").checked ? (CAT && CAT.termini) : null, source: new URLSearchParams(location.search).get("da") === "aria" ? "widget-aria" : "gateway" };
      $("#fSend").disabled = true; out.textContent = "Invio…";
      send("POST", "/api/gateway/requests", body).then(function (j) {
        $("#fSend").disabled = false;
        if (!j.ok) { out.className = "out err"; out.textContent = j.errore || "Errore"; return; }
        out.className = "out ok";
        var t = "Richiesta " + j.id + " inviata. Ti rispondiamo in «Le mie richieste».";
        if (j.rimborsoProposto) t += " Sul budget indicato il rimborso L$D proposto sarebbe " + eur(j.rimborsoProposto.refundEur) + " (" + j.rimborsoProposto.pct + "%), da confermare con doc.";
        out.textContent = t; f.reset(); refreshMe();
      }).catch(function () { $("#fSend").disabled = false; out.className = "out err"; out.textContent = "Rete non raggiungibile, riprova."; });
    });
    if ($("#logout")) $("#logout").addEventListener("click", function () { fetch("/api/firma/logout", { method: "POST", credentials: "same-origin" }).then(refreshMe); });
    if ($("#wipe")) $("#wipe").addEventListener("click", function () { if (confirm("Cancellare tutte le tue richieste e i messaggi del Gateway? Non si torna indietro.")) send("DELETE", "/api/gateway/me/data").then(function (j) { alert("Cancellate: " + (j.cancellate || 0)); refreshMe(); }); });
    document.addEventListener("zdos-firma-login", function (e) { if (e.detail && e.detail.ok) refreshMe(); });
  }

  loadPrices(); loadCatalog().then(function () { bindForm(); refreshMe(); });
  if ($("#calcBtn")) { $("#calcBtn").addEventListener("click", calc); $("#calcEur").addEventListener("change", calc); setTimeout(calc, 300); }
})();
