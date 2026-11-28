/* ZDOS × OV♥ · tocca per rivedere l'incontro · © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var el = document.getElementById("zdosDuo");
  if (!el) return;
  function play() {
    el.classList.remove("go");
    void el.getBoundingClientRect();
    el.classList.add("go");
  }
  function start() {
    if (!el.classList.contains("go")) play();
  }
  el.addEventListener("click", play);
  var splash = document.getElementById("zdosSplash");
  if (splash && !splash.hasAttribute("hidden")) {
    document.addEventListener("zdos-splash-done", start, { once: true });
    setTimeout(start, 3200);
  } else {
    start();
  }
})();
