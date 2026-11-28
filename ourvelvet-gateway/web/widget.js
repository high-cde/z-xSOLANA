/* OurVelvet Gateway · widget per ARIA 18+ e altri siti ZDOS. Banda sottile, Shadow DOM, nessun cookie, nessun tracciamento.
   Uso: <div data-ov-gateway></div><script src="https://ourvelvet.online/gateway/widget.js" async></script>
   Attributi facoltativi sul div: data-formula="velvet-route|ams-weekend|garda-lounge", data-compact="1". © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var BASE = "https://ourvelvet.online";
  var CSS = ":host{all:initial;display:block;margin:14px 0}" +
    ".w{position:relative;display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;padding:13px 16px;border:1px solid rgba(245,195,108,.28);border-radius:16px;background:radial-gradient(420px 120px at 0 0,rgba(155,92,255,.18),transparent 70%),linear-gradient(135deg,rgba(26,12,30,.96),rgba(12,8,26,.96));font:13px/1.5 Inter,-apple-system,'Segoe UI',system-ui,sans-serif;color:#f6eefc;box-shadow:0 10px 30px -14px rgba(0,0,0,.6)}" +
    ".lg{display:inline-flex;align-items:center;gap:9px;flex:none}.lg img{width:30px;height:30px;border-radius:50%;border:1.5px solid rgba(245,195,108,.65);background:#120a20}" +
    ".lg b{display:block;font:700 13px/1.1 Georgia,'Times New Roman',serif;letter-spacing:.03em;color:#f6eefc}.lg small{display:block;font:600 9px/1 ui-monospace,Menlo,monospace;letter-spacing:.24em;color:#f5c36c;margin-top:4px;text-transform:uppercase}" +
    ".k{font:700 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.07em;color:#5ee6ff;flex:none;padding:3px 9px;border:1px solid rgba(94,230,255,.3);border-radius:999px}" +
    ".d{flex:1 1 240px;color:#d9cfe8}.d b{color:#fff}" +
    ".m{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:4px 14px;font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#b8a8cc}" +
    ".m i{font-style:normal;color:#8f80a8}.warn{color:#f5c36c}" +
    "a{margin-left:auto;display:inline-block;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:700;color:#fff;background:linear-gradient(135deg,#9b5cff,#ff3d7f);white-space:nowrap;box-shadow:0 8px 22px -10px rgba(255,61,127,.7);transition:transform .2s}a:hover{transform:translateY(-1px)}" +
    "@media(max-width:560px){a{margin-left:0;width:100%;text-align:center;box-sizing:border-box}}" +
    "@media(prefers-reduced-motion:reduce){a{transition:none}}";
  function nf(x, d) { return Number(x).toLocaleString("it-IT", { maximumFractionDigits: d || 0 }); }
  function mount(host) {
    if (host.__ovgw) return; host.__ovgw = 1;
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var formula = /^[a-z-]{3,20}$/.test(host.getAttribute("data-formula") || "") ? host.getAttribute("data-formula") : "velvet-route";
    var st = document.createElement("style"); st.textContent = CSS; root.appendChild(st);
    var w = document.createElement("div"); w.className = "w";
    var lg = document.createElement("span"); lg.className = "lg"; lg.innerHTML = "<img alt='' width='30' height='30'><span><b>Dom-Coin &amp; Velvet</b><small>by ZDOS · Gateway</small></span>"; lg.firstChild.src = BASE + "/assets/vz-coin.png";
    var k = document.createElement("span"); k.className = "k"; k.textContent = "SOLO ADULTI 18+";
    var d = document.createElement("span"); d.className = "d";
    d.innerHTML = "<b>Velvet Route · Amsterdam ↔ Lago di Garda.</b> Una sola richiesta per viaggio, hotel, locali 18+ legali e serate in locali autorizzati. Preventivo in euro, rimborso L$D proposto.";
    var a = document.createElement("a"); a.href = BASE + "/gateway/?da=aria&formula=" + formula + "#richiesta"; a.target = "_blank"; a.rel = "noopener"; a.textContent = "Richiedi un preventivo →";
    var m = document.createElement("div"); m.className = "m"; m.textContent = "Consenso · safeword ROSSO · nessuna persona prenotabile";
    w.appendChild(lg); w.appendChild(k); w.appendChild(d); w.appendChild(a); if (host.getAttribute("data-compact") !== "1") w.appendChild(m); root.appendChild(w);
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
