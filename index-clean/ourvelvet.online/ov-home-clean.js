/* OurVelvet home pulita · © 2026 ZDOS1.3 */
(function () {
  "use strict";
  /* Fascia ricevuta ZLang / Solana (sola lettura da /api/vchain/anchors) */
  function zlReceipt() {
    var box = document.getElementById("zl-receipt");
    if (!box) return;
    var badge = box.querySelector(".zl-badge"), meta = box.querySelector(".zl-meta");
    function sh(s) { s = String(s || ""); return s.length > 18 ? s.slice(0, 10) + "…" + s.slice(-6) : s; }
    function item(k, v) {
      var s = document.createElement("span"); s.title = v || "";
      var b = document.createElement("b"); b.textContent = k + " ";
      s.appendChild(b); s.appendChild(document.createTextNode(sh(v) || "n/d")); return s;
    }
    fetch("/api/vchain/anchors", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      var it = d && d.ok && d.latest;
      if (!it) { badge.textContent = "NO RECEIPT"; meta.textContent = "Nessuna ricevuta disponibile."; return; }
      badge.textContent = "HEIGHT #" + (it.height == null ? "?" : it.height);
      meta.textContent = "";
      meta.appendChild(item("HEAD", it.headHash));
      meta.appendChild(item("RECEIPT", it.receiptHash));
      meta.appendChild(item("SOLANA", it.solanaSig || "LOCAL_ZLANG_ONLY"));
      if (it.ts) meta.appendChild(item("TS", String(it.ts)));
    }).catch(function () { badge.textContent = "OFFLINE"; meta.textContent = "Ricevuta non raggiungibile."; });
  }
  zlReceipt();
})();
