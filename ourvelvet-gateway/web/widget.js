/* OurVelvet Gateway · widget per ARIA 18+ e altri siti ZDOS. Banda sottile, Shadow DOM, nessun cookie, nessun tracciamento.
   Uso: <div data-ov-gateway></div><script src="https://ourvelvet.online/gateway/widget.js" async></script>
   Attributi facoltativi sul div: data-formula="velvet-route|ams-weekend|garda-lounge", data-compact="1". © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var BASE = "https://ourvelvet.online";
  var CSS = ":host{all:initial;display:block;margin:14px 0}" +
    ".w{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid rgba(244,114,182,.30);border-radius:12px;background:linear-gradient(135deg,rgba(28,10,20,.92),rgba(16,12,28,.92));font:13px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#f4f2f7}" +
    ".k{font:700 11.5px/1.4 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.06em;color:#f472b6;min-width:150px}" +
    ".d{flex:1 1 240px;color:#d6d2de}.d b{color:#fff}" +
    ".m{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:4px 14px;font:11.5px/1.5 'IBM Plex Mono',ui-monospace,monospace;color:#a19cad}" +
    ".m i{font-style:normal;color:#94a3b8}.warn{color:#fde68a}" +
    "a{margin-left:auto;display:inline-block;padding:8px 14px;border-radius:999px;text-decoration:none;font-weight:600;color:#14040d;background:linear-gradient(135deg,#f472b6,#c084fc);white-space:nowrap}" +
    "@media(max-width:560px){.k{min-width:0;flex:1 1 100%}a{margin-left:0}}";
  function nf(x, d) { return Number(x).toLocaleString("it-IT", { maximumFractionDigits: d || 0 }); }
  function mount(host) {
    if (host.__ovgw) return; host.__ovgw = 1;
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var formula = /^[a-z-]{3,20}$/.test(host.getAttribute("data-formula") || "") ? host.getAttribute("data-formula") : "velvet-route";
    var st = document.createElement("style"); st.textContent = CSS; root.appendChild(st);
    var w = document.createElement("div"); w.className = "w";
    var k = document.createElement("span"); k.className = "k"; k.textContent = "OURVELVET GATEWAY · 18+";
    var d = document.createElement("span"); d.className = "d";
    d.innerHTML = "<b>Velvet Route · Amsterdam ↔ Lago di Garda.</b> Una sola richiesta per viaggio, hotel, locali 18+ legali e serate in locali autorizzati. Preventivo in euro, rimborso L$D proposto.";
    var a = document.createElement("a"); a.href = BASE + "/gateway/?da=aria&formula=" + formula + "#richiesta"; a.target = "_blank"; a.rel = "noopener"; a.textContent = "Richiedi un preventivo →";
    var m = document.createElement("div"); m.className = "m"; m.textContent = "Consenso · safeword ROSSO · nessuna persona prenotabile";
    w.appendChild(k); w.appendChild(d); w.appendChild(a); if (host.getAttribute("data-compact") !== "1") w.appendChild(m); root.appendChild(w);
    if (host.getAttribute("data-compact") === "1") return;
    fetch(BASE + "/api/gateway/prices", { credentials: "omit" }).then(function (r) { return r.json(); }).then(function (p) {
      if (!p || !p.ok) return; m.textContent = "";
      var s1 = document.createElement("span"); s1.innerHTML = "<i>SOL</i> "; s1.appendChild(document.createTextNode(nf(p.solEur, 2) + " €")); m.appendChild(s1);
      var s2 = document.createElement("span"); s2.innerHTML = "<i>L$D</i> "; s2.appendChild(document.createTextNode(p.lsdEur ? nf(p.lsdEur, 6) + " €" : "n/d")); m.appendChild(s2);
      if (p.sottile) { var s3 = document.createElement("span"); s3.className = "warn"; s3.textContent = "liquidità L$D molto bassa: equivalenti solo indicativi"; m.appendChild(s3); }
      var s4 = document.createElement("span"); s4.textContent = "ROSSO = stop"; m.appendChild(s4);
    }).catch(function () {});
  }
  function scan() { var n = document.querySelectorAll("[data-ov-gateway]"); for (var i = 0; i < n.length; i++) mount(n[i]); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan); else scan();
})();
