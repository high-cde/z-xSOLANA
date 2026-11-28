/* ZDOS · tag Google condiviso (GA4) — DISATTIVATO finché non c'è un ID.
   Per attivarlo: scrivere l'ID GA4 (forma G-XXXXXXXXXX) in GA4_ID qui sotto, nessun altro cambio.
   Rispetta il consenso: carica gtag.js solo se l'utente ha accettato gli analytics (localStorage zdos-consent=granted).
   Se GA4_ID è vuoto non carica nulla, non mostra banner e non fa richieste di rete.  © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var GA4_ID = ""; /* <-- ID GA4 che doc deve ancora fornire. Non inventarlo. */
  window.ZDOSGA = { id: GA4_ID, active: false };
  if (!/^G-[A-Z0-9]{6,}$/.test(GA4_ID)) return;
  var KEY = "zdos-consent";
  function load() {
    if (window.ZDOSGA.active) return;
    window.ZDOSGA.active = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA4_ID, { anonymize_ip: true });
    var s = document.createElement("script"); s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA4_ID);
    document.head.appendChild(s);
  }
  var c = null; try { c = localStorage.getItem(KEY); } catch (e) {}
  if (c === "granted") return load();
  if (c === "denied") return;
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.createElement("div"); b.className = "ga-consent";
    b.innerHTML = '<span>Statistiche anonime di utilizzo (Google Analytics). Puoi rifiutare.</span><button type="button" data-v="granted">Accetta</button><button type="button" data-v="denied">Rifiuta</button>';
    b.addEventListener("click", function (e) {
      var v = e.target && e.target.getAttribute && e.target.getAttribute("data-v"); if (!v) return;
      try { localStorage.setItem(KEY, v); } catch (x) {}
      b.remove(); if (v === "granted") load();
    });
    document.body.appendChild(b);
  });
})();
