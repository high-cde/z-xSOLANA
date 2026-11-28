/* ZDOS home pulita · © 2026 ZDOS1.3 */
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

  /* Merito (riga live) */
  var mel = $("merito-live");
  if (mel) fetch("/merito-api/summary", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
    var n = function (v) { return v == null ? "n/d" : Number(v).toLocaleString("it-IT", { maximumFractionDigits: 0 }); };
    mel.textContent = "";
    var b = document.createElement("b"); b.textContent = "Miner merito"; mel.appendChild(b);
    mel.appendChild(document.createTextNode(" — fondo " + n(d.fund && d.fund.velvet) + " VELVET · " + n(d.profiles && d.profiles.total) + " profili"));
  }).catch(function () {});

  /* Terminale zGrok2 (stesso endpoint di prima) */
  var domain = "auto", stream = $("chat-stream"), inp = $("agi-input"), form = $("agi-form");
  var det = $("agi-console");
  if (det && location.hash === "#agi-console") det.open = true;
  window.addEventListener("hashchange", function () { if (det && location.hash === "#agi-console") { det.open = true; det.scrollIntoView(); } });
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
    t.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (x) { x.classList.remove("on"); });
      t.classList.add("on"); domain = t.dataset.domain;
    });
  });
  function push(cls, meta, text) {
    var m = document.createElement("div"); m.className = "msg " + cls;
    var s = document.createElement("small"); s.textContent = meta;
    m.appendChild(s); m.appendChild(document.createTextNode(text));
    stream.appendChild(m); stream.scrollTop = stream.scrollHeight;
  }
  function clean(raw) {
    var t = raw;
    try { var p = JSON.parse(raw); t = p.response || p.reply || p.message || p.text || raw; } catch (e) {}
    if (typeof t === "string" && t.indexOf("NOMINAL_SYNC") >= 0) return "ZDOS-Cortex sincronizzato. Chiedimi pure di ZLang, ZSwap, Velvet City o dello stato dei servizi.";
    return typeof t === "string" ? t : JSON.stringify(t);
  }
  function send(q) {
    push("u", "TU · " + domain.toUpperCase(), q);
    fetch("/api/vcpu/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: domain, prompt: q }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { push("", "ZGROK2 · " + String(d.routedCore || "CORE-0").toUpperCase(), clean((d.reply && (d.reply.body || d.reply.error)) || JSON.stringify(d))); })
      .catch(function () { push("", "ZCORE-VCPU · OFFLINE", "Bus /api/vcpu/dispatch non raggiungibile."); });
  }
  if (form) form.addEventListener("submit", function (e) { e.preventDefault(); var v = inp.value.trim(); if (!v) return; inp.value = ""; send(v); });
  Array.prototype.forEach.call(document.querySelectorAll(".qp button"), function (b) { b.addEventListener("click", function () { send(b.dataset.q); }); });

  /* Stato vCPU: una sola scritta, ogni 30 s solo se il terminale è aperto */
  function status() {
    var pill = $("vcpu-status-pill"); if (!pill) return;
    fetch("/api/vcpu/status", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok) pill.textContent = "· online · " + Object.keys(d.health || {}).length + " nodi";
    }).catch(function () { pill.textContent = "· standby"; });
  }
  status();
})();
