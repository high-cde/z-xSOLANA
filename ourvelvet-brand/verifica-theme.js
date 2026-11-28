/* Tema per dominio: x-zdos.it, ourvelvet.online, zx.x-zdos.it. © 2026 ZDOS1.3
   Su ourvelvet.online carica anche la skin «Dom-Coin & Velvet by ZDOS» (assets/velvet-zdos.css + velvet-skin.js). */
(function () {
  var h = location.hostname.replace(/^www\./, "");
  var t = h === "ourvelvet.online" ? "velvet" : h === "zx.x-zdos.it" ? "zx" : "zdos";
  document.documentElement.className += " t-" + t;
  document.documentElement.setAttribute("data-brand", t === "velvet" ? "OurVelvet" : "ZDOS");
  if (t === "velvet" && /^\/verifica\/?/.test(location.pathname)) {
    document.documentElement.className += " vz-verifica";
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/assets/velvet-zdos.css?v=1"; document.head.appendChild(l);
    var s = document.createElement("script"); s.src = "/assets/velvet-skin.js?v=1"; s.defer = true; document.head.appendChild(s);
  }
})();
