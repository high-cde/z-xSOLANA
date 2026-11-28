/* Moderazione OurVelvet Creator — staff. © 2026 ZDOS1.3. Le chiamate passano da /creator-radar/admin/api/ (htpasswd staff). */
(function () {
  "use strict";
  var API = "/creator-radar/admin/api";
  var $ = function (s) { return document.querySelector(s); };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var tt; function toast(t) { var b = $("#toast"); b.textContent = t; b.classList.add("on"); clearTimeout(tt); tt = setTimeout(function () { b.classList.remove("on"); }, 2000); }
  function get(p) { return fetch(API + p, { cache: "no-store", credentials: "same-origin" }).then(function (r) { return r.json(); }); }
  function post(p, b) { return fetch(API + p, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); }
  function when(t) { return new Date(t * 1000).toLocaleString("it-IT", { timeZone: "Europe/Rome" }); }
  function stats() { get("/stats").then(function (j) { if (!j.ok) return; var f = function (a) { return a.map(function (x) { return x.status + " " + x.n; }).join(", ") || "0"; };
    $("#stats").textContent = "Profili: " + f(j.profili) + " · Post: " + f(j.post) + " · Immagini: " + f(j.immagini) + " · Segnalazioni aperte: " + j.segnalazioniAperte; }); }
  function coda() {
    get("/queue").then(function (j) {
      var g = $("#coda"); g.textContent = ""; $("#codaEmpty").hidden = j.coda && j.coda.length > 0;
      (j.coda || []).forEach(function (m) {
        var it = el("div", "item"), isA = m.tipo === "audio";
        if (isA) { var au = el("audio"); au.controls = true; au.preload = "none"; au.src = m.url; it.appendChild(au); } else { var im = el("img"); im.src = m.url; im.alt = "Immagine in revisione"; im.loading = "lazy"; it.appendChild(im); }
        var b = el("div", "b"); b.appendChild(el("b", "", "@" + (m.handle || "?") + " · " + (m.tipo === "avatar" ? "avatar" : isA ? "traccia audio" : "post")));
        b.appendChild(el("small", "", when(m.creato) + " · " + (isA ? (m.titolo ? "«" + m.titolo + "» · " : "") + (m.durata ? Math.round(m.durata) + " s · " : "") : m.w + "×" + m.h + " · ") + Math.round(m.bytes / 1024) + " KB"));
        if (m.testo) b.appendChild(el("p", "", m.testo));
        var r = el("div", "row"), ok = el("button", "btn ok", "Approva"), no = el("button", "btn no", "Rifiuta");
        ok.onclick = function () { post("/media/" + m.id, { azione: "approva" }).then(function (x) { toast(x.ok ? "Approvata" : x.errore); coda(); stats(); }); };
        no.onclick = function () { var n = prompt("Motivo del rifiuto (facoltativo)") || ""; post("/media/" + m.id, { azione: "rifiuta", nota: n }).then(function (x) { toast(x.ok ? "Rifiutata" : x.errore); coda(); stats(); }); };
        r.appendChild(ok); r.appendChild(no); b.appendChild(r); it.appendChild(b); g.appendChild(it);
      });
    });
  }
  function segn() {
    get("/reports").then(function (j) {
      var box = $("#segn"); box.textContent = ""; $("#segnEmpty").hidden = j.segnalazioni && j.segnalazioni.length > 0;
      (j.segnalazioni || []).forEach(function (r) {
        var d = el("div", "rep"); d.appendChild(el("b", "", (r.kind === "post" ? "Post " : "Profilo @") + r.target));
        d.appendChild(el("small", "", " · " + when(r.created))); d.appendChild(el("p", "", "Motivo: " + r.reason));
        if (r.dettaglio) { var t = r.dettaglio; d.appendChild(el("p", "", (t.handle ? "@" + t.handle + " · " : "") + "stato: " + t.stato + (t.testo ? " · «" + t.testo + "»" : "") + (t.bio ? " · bio: " + t.bio : "")));
          if (t.immagine) { var im = el("img"); im.src = t.immagine; im.alt = ""; d.appendChild(im); } }
        var row = el("div", "row"), a = el("button", "btn ok", "Archivia"), h = el("button", "btn no", r.kind === "post" ? "Nascondi post" : "Sospendi profilo");
        a.onclick = function () { post("/reports/" + r.id, { azione: "archivia" }).then(function () { toast("Archiviata"); segn(); stats(); }); };
        h.onclick = function () { post("/reports/" + r.id, { azione: "nascondi" }).then(function () { toast("Fatto"); segn(); stats(); }); };
        row.appendChild(a); row.appendChild(h); d.appendChild(row); box.appendChild(d);
      });
    });
  }
  function log() { get("/log").then(function (j) { var b = $("#log"); b.textContent = ""; (j.log || []).forEach(function (l) { var tr = el("tr"); [when(l.ts), l.staff || "utente", l.action, l.target].forEach(function (v) { tr.appendChild(el("td", "", v)); }); b.appendChild(tr); }); }); }
  document.querySelectorAll(".tabs button").forEach(function (b) { b.onclick = function () {
    document.querySelectorAll(".tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
    ["coda", "segn", "log"].forEach(function (t) { $("#t-" + t).hidden = t !== b.dataset.t; });
    ({ coda: coda, segn: segn, log: log })[b.dataset.t]();
  }; });
  stats(); coda(); setInterval(stats, 30000);
})();
