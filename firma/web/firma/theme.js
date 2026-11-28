/* Tema per dominio: x-zdos.it, ourvelvet.online, zx.x-zdos.it. © 2026 ZDOS1.3 */
(function () {
  var h = location.hostname.replace(/^www\./, "");
  var t = h === "ourvelvet.online" ? "velvet" : h === "zx.x-zdos.it" ? "zx" : "zdos";
  document.documentElement.className += " t-" + t;
  document.documentElement.setAttribute("data-brand", t === "velvet" ? "OurVelvet" : "ZDOS");
})();
