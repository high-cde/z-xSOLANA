/* Z-X home pulita · © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
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

  /* Leaflet CSS non bloccante (la mappa sta in una fascia chiusa) */
  var lc = document.createElement("link"); lc.rel = "stylesheet"; lc.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(lc);

  /* Menu */
  var mb = $("zxMenuBtn"), mn = $("zxMenu");
  function menu(open) { mn.hidden = !open; mb.setAttribute("aria-expanded", open ? "true" : "false"); }
  if (mb && mn) {
    mb.addEventListener("click", function (e) { e.stopPropagation(); menu(mn.hidden); });
    document.addEventListener("click", function (e) { if (!mn.hidden && !mn.contains(e.target)) menu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") menu(false); });
    mn.addEventListener("click", function (e) { if (e.target.tagName === "A") menu(false); });
  }

  /* Fasce apribili */
  var mapFixed = false, twLoaded = false;
  function onOpen(d) {
    if (d.id === "viaggi" && !mapFixed) {
      mapFixed = true;
      setTimeout(function () {
        try { if (typeof map !== "undefined") map.invalidateSize(); } catch (e) {}
        var f = $("tripForm"); if (f && f.requestSubmit) { try { f.requestSubmit(); } catch (e) {} }
      }, 60);
    }
    if (d.id === "integrazioni" && !twLoaded) {
      twLoaded = true;
      var s = document.createElement("script"); s.src = "https://platform.twitter.com/widgets.js"; s.async = true; s.charset = "utf-8"; document.body.appendChild(s);
    }
  }
  Array.prototype.forEach.call(document.querySelectorAll("details.zsec"), function (d) {
    d.addEventListener("toggle", function () { if (d.open) onOpen(d); });
  });
  function openHash() {
    var h = location.hash.slice(1); if (!h) return;
    if (/^(tok|dom|wal|lst)$/.test(h)) h = "scudo";
    var el = $(h); if (!el) return;
    var d = el.closest ? el.closest("details.zsec") : null;
    if (d) { d.open = true; setTimeout(function () { d.scrollIntoView(); }, 80); }
  }
  openHash();
  window.addEventListener("hashchange", openHash);
})();
