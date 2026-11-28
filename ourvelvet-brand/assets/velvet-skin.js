/* Skin «Dom-Coin & Velvet by ZDOS» per /verifica/ su ourvelvet.online. © ZDOS1.3
   Caricato da /firma/theme.js solo sul dominio OurVelvet. Solo DOM e classi (la pagina ha CSP senza stili inline). */
(function () {
  "use strict";
  var d = document;
  function run() {
    var top = d.querySelector(".fm-top"); if (!top || top.__vz) return; top.__vz = 1;
    var nav = top.querySelector("nav");
    var hdr = d.createElement("header"); hdr.className = "vz-top";
    var w = d.createElement("div"); w.className = "vz-wrap";
    w.innerHTML = '<a class="vz-lockup" href="/" aria-label="Dom-Coin &amp; Velvet by ZDOS"><span class="vz-logos" aria-hidden="true"><img class="vz-ov" src="/assets/vz-ov.png" width="34" height="34" alt=""><img class="vz-coin" src="/assets/vz-coin.png" width="34" height="34" alt=""></span><span class="vz-name"><b>Dom-Coin <i>&amp;</i> Velvet</b><small>by ZDOS</small></span></a><span class="vz-page">Verifica firma</span>';
    var n = d.createElement("nav"); n.className = "vz-nav"; n.setAttribute("aria-label", "Pagina");
    n.innerHTML = '<a href="#accedi">Accedi</a><a href="#verifica">Verifica</a><a href="#formato">Formato</a><a href="/creator-radar/">Creator</a><a href="/gateway/">Gateway</a>';
    w.appendChild(n); hdr.appendChild(w);
    d.body.insertBefore(hdr, d.body.firstChild);
    top.parentNode.removeChild(top);
    var aur = d.createElement("div"); aur.className = "vz-aurora"; aur.setAttribute("aria-hidden", "true"); aur.innerHTML = "<i></i><i></i><i></i>";
    d.body.insertBefore(aur, d.body.firstChild);
    var wrap = d.querySelector(".fm-wrap"); if (wrap) { wrap.className += " vz-rv"; }
    // pulsante TikTok sotto l'accesso con wallet
    var st = d.querySelector("[data-firma-status]");
    if (st) {
      var p = d.createElement("p"); p.className = "fm-small"; p.textContent = "Oppure, solo per il social OurVelvet (profilo, feed, Z-Sound). Per Gateway e badge serve la firma del wallet.";
      var box = d.createElement("div"); box.className = "vz-tt-box"; box.setAttribute("data-vz-tiktok", ""); box.setAttribute("data-next", "/verifica/");
      st.parentNode.insertBefore(p, st); st.parentNode.insertBefore(box, st);
    }
    // footer
    var f = d.querySelector(".fm-foot"); var ft = d.createElement("footer"); ft.className = "vz-foot";
    ft.innerHTML = '<div class="vz-wrap"><a class="vz-lockup" href="/" aria-label="Dom-Coin &amp; Velvet by ZDOS"><span class="vz-logos" aria-hidden="true"><img class="vz-ov" src="/assets/vz-ov.png" width="34" height="34" alt=""><img class="vz-coin" src="/assets/vz-coin.png" width="34" height="34" alt=""></span><span class="vz-name"><b>Dom-Coin <i>&amp;</i> Velvet</b><small>by ZDOS</small></span></a><div class="vz-copy"><p>© ZDOS1.3 · Licenza proprietaria · P.IVA 11040550961</p><p>Solo adulti 18+ · consenso reciproco · safeword <b>ROSSO</b>. I nomi dei wallet compaiono solo come testo; nessuna affiliazione implicita.</p></div><nav aria-label="Link utili"><a href="/gateway/">Gateway</a><a href="/pool-party/">Pool Party</a><a href="/creator/z-sound/">Z-Sound</a><a href="/creator-radar/">Creator</a><a href="/privacy/">Privacy</a><a href="/termini/">Termini</a></nav></div>';
    d.body.appendChild(ft);
    var s = d.createElement("script"); s.src = "/assets/vz-tiktok.js?v=1"; s.defer = true; d.body.appendChild(s);
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", run); else run();
})();
