/* Badge "wallet verificato" (solo testo). Uso: <span data-firma-badge="INDIRIZZO"></span> + questo script.
   Compare solo se il proprietario ha scelto il badge pubblico al momento della firma. © 2026 ZDOS1.3 */
(function () {
  "use strict";
  function paint(el, a) {
    fetch("/api/firma/badge?address=" + encodeURIComponent(a), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.verificato) { el.hidden = true; return; }
      el.hidden = false; el.className = "fm-chip"; el.textContent = "✓ wallet verificato";
      el.title = "Firma ZDOS verificata dal " + j.dal + " (ultimo accesso " + j.ultimo + ")";
    }).catch(function () { el.hidden = true; });
  }
  function scan() { var els = document.querySelectorAll("[data-firma-badge]"); for (var i = 0; i < els.length; i++) if (!els[i].__fm) { els[i].__fm = 1; paint(els[i], els[i].getAttribute("data-firma-badge")); } }
  window.ZDOSFirmaBadge = { scan: scan, paint: paint };
  if (document.readyState !== "loading") scan(); else document.addEventListener("DOMContentLoaded", scan);
})();
