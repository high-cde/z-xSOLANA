/* ZDOS × OV♥ · tocca per rivedere l'incontro · © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var el = document.getElementById("zdosDuo");
  if (!el) return;
  el.addEventListener("click", function () {
    el.classList.remove("go");
    void el.getBoundingClientRect();
    el.classList.add("go");
  });
})();
