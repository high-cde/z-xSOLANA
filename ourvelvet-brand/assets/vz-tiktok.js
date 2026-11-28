/* Pulsante «Registrati con TikTok» — Dom-Coin & Velvet by ZDOS. © ZDOS1.3
   Legge /api/social/tiktok/status: se il login non è attivo mostra «in attivazione» (pulsante non cliccabile).
   Nessun cookie, nessun tracciamento. Il flusso OAuth vero è sul server (zdos-social). */
(function () {
  "use strict";
  var MSG = {
    ok: ["ok", "Accesso con TikTok eseguito. Per pubblicare serve ancora la dichiarazione 18+."],
    collegato: ["ok", "TikTok collegato al tuo profilo."],
    negato: ["err", "Accesso con TikTok annullato."],
    errore: ["err", "Accesso con TikTok non riuscito. Riprova più tardi."],
    gia_collegato: ["err", "Questo TikTok è già collegato a un wallet: accedi con la firma."],
    altro_profilo: ["err", "Questo TikTok è collegato a un altro profilo."],
    in_attivazione: ["", "Il login con TikTok è in attivazione."]
  };
  var state = null;
  function status() {
    if (state) return state;
    state = fetch("/api/social/tiktok/status", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.json(); }).catch(function () { return { ok: false, attivo: false }; });
    return state;
  }
  function render(box) {
    if (box.__vztt) return; box.__vztt = 1;
    var next = box.getAttribute("data-next") || location.pathname;
    if (next.charAt(0) !== "/" || next.charAt(1) === "/") next = "/creator-radar/";
    var a = document.createElement("a"); a.className = "vz-tt"; a.setAttribute("aria-disabled", "true"); a.href = "#";
    a.innerHTML = '<span class="n" aria-hidden="true">♪</span><span>Registrati con TikTok</span>';
    var soon = document.createElement("span"); soon.className = "vz-soon"; soon.textContent = "in attivazione"; a.appendChild(soon);
    a.addEventListener("click", function (e) { if (a.getAttribute("aria-disabled") === "true") e.preventDefault(); });
    var msg = document.createElement("span"); msg.className = "vz-tt-msg"; msg.setAttribute("role", "status"); msg.setAttribute("aria-live", "polite");
    box.appendChild(a); box.appendChild(msg);
    var q = new URLSearchParams(location.search).get("tiktok");
    if (q && MSG[q]) { msg.textContent = MSG[q][1]; msg.className = "vz-tt-msg " + MSG[q][0]; }
    status().then(function (j) {
      if (j && j.attivo === true) {
        a.removeAttribute("aria-disabled"); a.href = "/api/social/tiktok/start?next=" + encodeURIComponent(next); soon.remove();
        a.setAttribute("rel", "nofollow");
      }
    });
  }
  function scan(root) { var n = (root || document).querySelectorAll("[data-vz-tiktok]"); for (var i = 0; i < n.length; i++) render(n[i]); }
  window.VZTT = { scan: scan };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { scan(); }); else scan();
})();
