/* ZDOS home pulita · © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  function shortSig(s, head, tail) {
    s = String(s || "");
    head = head || 6; tail = tail || 4;
    return s.length > head + tail + 1 ? s.slice(0, head) + "…" + s.slice(-tail) : s;
  }
  function romeDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("it-IT", {
        timeZone: "Europe/Rome",
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch (e) { return ""; }
  }

  function zlReceipt() {
    var box = document.getElementById("zl-receipt");
    if (!box) return;
    var badge = box.querySelector(".zl-badge"), meta = box.querySelector(".zl-meta");
    fetch("/api/vchain/anchors", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      var it = d && d.ok && d.latest;
      if (!it) { badge.textContent = "in attesa"; meta.textContent = "Nessuna ricevuta disponibile in questo momento."; return; }
      badge.textContent = it.height == null ? "su Solana" : "n. " + it.height;
      meta.textContent = "";
      var when = it.ts ? romeDate(it.ts) : "";
      var line = document.createElement("span");
      line.textContent = when ? ("Registrata il " + when + " (ora di Roma).") : "Registrata sulla blockchain Solana.";
      meta.appendChild(line);
      var sig = it.solanaSig;
      if (sig && sig.indexOf("ERR") !== 0 && sig !== "LOCAL_ZLANG_ONLY") {
        var a = document.createElement("a");
        a.href = "https://solscan.io/tx/" + encodeURIComponent(sig);
        a.rel = "noopener";
        a.target = "_blank";
        a.title = sig;
        a.textContent = "Vedi la firma " + shortSig(sig, 6, 4);
        meta.appendChild(a);
      } else if (sig === "LOCAL_ZLANG_ONLY") {
        var s = document.createElement("span");
        s.textContent = "Ancora solo in locale, non ancora su Solana.";
        meta.appendChild(s);
      }
    }).catch(function () {
      badge.textContent = "offline";
      meta.textContent = "Ricevuta non raggiungibile in questo momento.";
    });
  }
  zlReceipt();

  var mel = $("merito-live");
  if (mel) fetch("/merito-api/summary", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
    var n = function (v) { return v == null ? "n/d" : Number(v).toLocaleString("it-IT", { maximumFractionDigits: 0 }); };
    var tot = d.profiles && d.profiles.total;
    var num = tot == null ? null : Number(tot);
    var prof = (num === 1) ? "1 profilo" : (n(tot) + " profili");
    mel.textContent = "";
    var b = document.createElement("b"); b.textContent = "Punti per contributi reali"; mel.appendChild(b);
    mel.appendChild(document.createTextNode(" — fondo " + n(d.fund && d.fund.velvet) + " VELVET · " + prof));
  }).catch(function () {});

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
    if (typeof t === "string" && t.indexOf("NOMINAL_SYNC") >= 0) return "Sistema sincronizzato. Puoi chiedere di ZLang, degli scambi su Solana, di Velvet City o dello stato dei servizi.";
    return typeof t === "string" ? t : JSON.stringify(t);
  }
  function send(q) {
    push("u", "TU · " + domain.toUpperCase(), q);
    fetch("/api/vcpu/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: domain, prompt: q }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { push("", "ASSISTENTE · " + String(d.routedCore || "CORE-0").toUpperCase(), clean((d.reply && (d.reply.body || d.reply.error)) || JSON.stringify(d))); })
      .catch(function () { push("", "ASSISTENTE · OFFLINE", "Il terminale non è raggiungibile in questo momento."); });
  }
  if (form) form.addEventListener("submit", function (e) { e.preventDefault(); var v = inp.value.trim(); if (!v) return; inp.value = ""; send(v); });
  Array.prototype.forEach.call(document.querySelectorAll(".qp button"), function (b) { b.addEventListener("click", function () { send(b.dataset.q); }); });

  function status() {
    var pill = $("vcpu-status-pill"); if (!pill) return;
    fetch("/api/vcpu/status", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok) pill.textContent = " · online";
    }).catch(function () { pill.textContent = " · in pausa"; });
  }
  status();
})();
