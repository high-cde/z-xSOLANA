/* Staff Gateway OurVelvet · dietro htpasswd staff. API: /gateway/staff/api/ (header admin aggiunto da nginx). © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var API = "/gateway/staff/api"; var F = ""; var CUR = null;
  var eur = function (x) { return Number(x).toLocaleString("it-IT", { style: "currency", currency: "EUR" }); };
  var when = function (ts) { return new Date(ts * 1000).toLocaleString("it-IT", { timeZone: "Europe/Rome" }); };
  function j(m, u, b) { return fetch(API + u, { method: m, headers: b ? { "content-type": "application/json" } : {}, body: b ? JSON.stringify(b) : undefined, cache: "no-store" }).then(function (r) { return r.json(); }); }
  function list() {
    j("GET", "/requests" + (F ? "?stato=" + F : "")).then(function (d) {
      var b = $("#list"); b.textContent = ""; if (!d.ok) { b.textContent = d.errore; return; }
      if (!d.richieste.length) b.appendChild(el("p", "muted", "Nessuna richiesta."));
      d.richieste.forEach(function (r) {
        var it = el("button", "it" + (r.id === CUR ? " on" : "")); it.type = "button";
        it.appendChild(el("b", "", r.id)); if (r.nonLetti) it.appendChild(el("span", "badge", String(r.nonLetti)));
        it.appendChild(el("small", "", r.stato + " · " + r.pacchetto + " · " + r.adulti + " adulti" + (r.test ? " · TEST" : "") + " · " + when(r.aggiornata)));
        it.addEventListener("click", function () { CUR = r.id; show(r.id); list(); }); b.appendChild(it);
      });
    });
  }
  function show(id) {
    j("GET", "/requests/" + id).then(function (d) {
      var b = $("#detail"); b.textContent = ""; if (!d.ok) { b.textContent = d.errore; return; } var r = d.richiesta;
      b.appendChild(el("h2", "", r.id + " · " + r.stato));
      b.appendChild(el("p", "small muted", "Wallet " + r.wallet + " · origine " + r.origine + " · " + (r.tipo === "lista_attesa" ? "lista d'attesa" : "preventivo") + " · creata " + when(r.creata)));
      b.appendChild(el("p", "", r.pacchetto + " · " + r.adulti + " adulti · " + (r.dal || "date libere") + (r.al ? " → " + r.al : "") + (r.budgetEur ? " · budget " + eur(r.budgetEur) : "")));
      if (r.extra.length) b.appendChild(el("p", "small", "Tappe: " + r.extra.join(", ")));
      if (r.nota) b.appendChild(el("p", "small", "Nota: " + r.nota));
      if (r.preventivoEur) {
        b.appendChild(el("p", "", "Preventivo " + eur(r.preventivoEur) + (r.equivalenti ? " ≈ " + r.equivalenti.sol + " SOL · " + (r.equivalenti.lsd || "n/d") + " L$D" : "")));
        if (r.rimborsoProposto) b.appendChild(el("p", "small", "Rimborso L$D proposto: " + r.rimborsoProposto.pct + "% = " + eur(r.rimborsoProposto.refundEur) + (r.rimborsoProposto.refundLsd ? " ≈ " + r.rimborsoProposto.refundLsd + " L$D" : "") + " · merito proposto " + r.meritoProposto + " punti · solo proposta"));
      }
      var ul = el("ul", "msgs"); r.messaggi.forEach(function (m) { var li = el("li", m.da); li.appendChild(el("span", "w", m.da + " · " + when(m.quando))); li.appendChild(document.createTextNode(m.testo)); ul.appendChild(li); }); b.appendChild(ul);
      var f = el("form", "req"); f.style.marginTop = "12px";
      var s = el("select"); ["nuova", "in_lavorazione", "preventivo_inviato", "confermata_partner", "completata", "annullata"].forEach(function (x) { var o = el("option", "", x); o.value = x; if (x === r.stato) o.selected = true; s.appendChild(o); });
      var q = el("input"); q.type = "number"; q.step = "0.01"; q.placeholder = "Importo in € (dal partner)"; if (r.preventivoEur) q.value = r.preventivoEur;
      var qn = el("input"); qn.placeholder = "Nota preventivo (partner, condizioni)"; qn.value = r.notaPreventivo || "";
      var bs = el("button", "btn", "Salva stato"); bs.type = "submit";
      var l1 = el("label", "", "Stato"); l1.appendChild(s); var l2 = el("label", "", "Preventivo €"); l2.appendChild(q); var l3 = el("label", "full", "Nota"); l3.appendChild(qn);
      f.appendChild(l1); f.appendChild(l2); f.appendChild(l3); f.appendChild(bs); var out = el("p", "out"); f.appendChild(out); b.appendChild(f);
      f.addEventListener("submit", function (e) { e.preventDefault(); j("POST", "/requests/" + id + "/status", { stato: s.value, preventivoEur: q.value || null, notaPreventivo: qn.value }).then(function (x) { out.textContent = x.ok ? "Salvato" + (x.registro ? " · proposta a registro" : "") : x.errore; show(id); list(); ledger(); }); });
      var f2 = el("form", "req"); f2.style.cssText = "grid-template-columns:1fr auto;margin-top:10px"; var ta = el("input"); ta.placeholder = "Messaggio al cliente…"; var bb = el("button", "btn ghost", "Invia"); bb.type = "submit";
      f2.appendChild(ta); f2.appendChild(bb); b.appendChild(f2);
      f2.addEventListener("submit", function (e) { e.preventDefault(); if (!ta.value.trim()) return; j("POST", "/requests/" + id + "/messages", { testo: ta.value }).then(function () { show(id); }); });
    });
  }
  function ledger() {
    j("GET", "/ledger").then(function (d) {
      var o = $("#ledgerOut"); o.textContent = ""; if (!d.ok) { o.textContent = d.errore; return; }
      o.appendChild(el("p", "", d.nota));
      var t = el("table"); var h = el("tr"); ["Richiesta", "Wallet", "€", "%", "Rimborso €", "L$D", "Stato"].forEach(function (x) { h.appendChild(el("th", "", x)); }); t.appendChild(h);
      d.rimborsi.forEach(function (r) { var tr = el("tr"); [r.request, r.wallet.slice(0, 4) + "…" + r.wallet.slice(-4), r.eur, r.pct, r.refund_eur, r.refund_lsd == null ? "n/d" : r.refund_lsd + (r.sottile ? " (indic.)" : ""), r.state].forEach(function (x) { tr.appendChild(el("td", "", String(x))); }); t.appendChild(tr); });
      o.appendChild(t);
      o.appendChild(el("p", "", "Merito proposto: " + d.merito.map(function (m) { return m.request + " " + m.points + " pt"; }).join(" · ")));
    });
  }
  document.querySelectorAll("[data-f]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); F = a.getAttribute("data-f"); list(); }); });
  list(); ledger();
})();
