/* Z-Sound · interfaccia: deck, mixer, FX, pad, forme d'onda, tastiera e MIDI. © 2026 ZDOS1.3 · Licenza ZSEL proprietaria. */
(function (W) {
  "use strict";
  var ZS = W.ZS, D = W.document, clamp = ZS.clamp;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function h(tag, cls, txt, at) { var e = D.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; if (at) for (var k in at) e.setAttribute(k, at[k]); return e; }
  ZS.h = h; ZS.$ = $; ZS.$$ = $$;
  var tT; ZS.toast = function (t) { var b = $("#toast"); b.textContent = t; b.classList.add("on"); clearTimeout(tT); tT = setTimeout(function () { b.classList.remove("on"); }, 2600); };
  function fmtT(s) { if (!isFinite(s) || s < 0) s = 0; var m = Math.floor(s / 60), x = s - m * 60; return (m < 10 ? "0" : "") + m + ":" + (x < 10 ? "0" : "") + x.toFixed(1); }
  ZS.fmtT = fmtT;

  /* ---------- registro dei controlli (per MIDI) ---------- */
  var CTL = ZS.controls = {}, after = [];
  function reg(id, o) { CTL[id] = o; }
  ZS.afterInit = function (f) { after.push(f); };
  function ensure() { if (!ZS.ready()) { ZS.init(); setState(); after.forEach(function (f) { f(); }); } else if (ZS.ctx.state === "suspended") ZS.ctx.resume(); return true; }
  ZS.ensure = ensure;
  function setState() { var s = $("#audioState"); if (!s) return; var on = ZS.ready() && ZS.ctx.state === "running"; s.textContent = on ? "Audio attivo · " + Math.round(ZS.ctx.sampleRate / 100) / 10 + " kHz" : "Tocca per attivare l'audio"; s.classList.toggle("on", on); }
  ZS.setState = setState;

  /* ---------- componenti ---------- */
  function knob(o) {
    var w = h("div", "knob-w"), k = h("div", "knob"), ind = h("i"), out = h("output", "kv"), lab = h("span", "kl", o.label), v = o.val;
    k.tabIndex = 0; k.setAttribute("role", "slider"); k.setAttribute("aria-label", o.aria || o.label); k.setAttribute("aria-valuemin", o.min); k.setAttribute("aria-valuemax", o.max); k.appendChild(ind);
    if (o.accent) w.style.setProperty("--ac", o.accent); w.setAttribute("data-ctl", o.id);
    function set(nv, user, silent) {
      v = clamp(nv, o.min, o.max); var t = (v - o.min) / (o.max - o.min); k.style.setProperty("--v", t); ind.style.transform = "rotate(" + (-135 + 270 * t) + "deg)";
      out.textContent = o.fmt ? o.fmt(v) : String(Math.round(v * 10) / 10); k.setAttribute("aria-valuenow", v); if (!silent && o.cb) o.cb(v, user);
    }
    var sy = 0, sv = 0, drag = false;
    k.addEventListener("pointerdown", function (e) { ensure(); drag = true; sy = e.clientY; sv = v; k.setPointerCapture(e.pointerId); e.preventDefault(); });
    k.addEventListener("pointermove", function (e) { if (!drag) return; set(sv + ((sy - e.clientY) / (e.shiftKey ? 700 : 150)) * (o.max - o.min), true); });
    k.addEventListener("pointerup", function () { drag = false; }); k.addEventListener("pointercancel", function () { drag = false; });
    k.addEventListener("wheel", function (e) { e.preventDefault(); ensure(); set(v + (e.deltaY < 0 ? 1 : -1) * (o.max - o.min) / 40, true); }, { passive: false });
    k.addEventListener("keydown", function (e) { var st = (o.max - o.min) / 40; if (e.key === "ArrowUp" || e.key === "ArrowRight") { ensure(); set(v + st, true); e.preventDefault(); } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { ensure(); set(v - st, true); e.preventDefault(); } });
    k.addEventListener("dblclick", function () { ensure(); set(o.def != null ? o.def : o.val, true); });
    w.appendChild(k); w.appendChild(out); w.appendChild(lab);
    set(o.val, false, true);
    reg(o.id, { kind: "range", el: w, set01: function (t) { ensure(); set(o.min + t * (o.max - o.min), true); }, get: function () { return v; }, set: set });
    after.push(function () { if (o.cb) o.cb(v, false); });
    return w;
  }
  function fader(o) {
    var w = h("div", "fader-w" + (o.vertical ? " v" : " hz")), i = h("input", "fader"), out = o.fmt ? h("output", "kv") : null, lab = o.label ? h("span", "kl", o.label) : null;
    i.type = "range"; i.min = o.min; i.max = o.max; i.step = o.step || "any"; i.value = o.val; i.setAttribute("aria-label", o.aria || o.label || o.id); w.setAttribute("data-ctl", o.id);
    if (o.accent) w.style.setProperty("--ac", o.accent);
    function upd(user) { if (out) out.textContent = o.fmt(+i.value); if (o.cb) o.cb(+i.value, user); }
    i.addEventListener("input", function () { ensure(); upd(true); }); i.addEventListener("dblclick", function () { i.value = o.def != null ? o.def : o.val; ensure(); upd(true); });
    w.appendChild(i); if (out) w.appendChild(out); if (lab) w.appendChild(lab);
    if (out) out.textContent = o.fmt(+i.value);
    reg(o.id, { kind: "range", el: w, set01: function (t) { ensure(); i.value = +o.min + t * (o.max - o.min); upd(true); }, get: function () { return +i.value; }, set: function (v) { i.value = v; upd(false); } });
    after.push(function () { if (o.cb) o.cb(+i.value, false); });
    return w;
  }
  function btn(id, label, o) {
    o = o || {}; var b = h("button", "pad-btn " + (o.cls || ""), label, { type: "button", "data-ctl": id }); if (o.title) b.title = o.title; if (o.aria) b.setAttribute("aria-label", o.aria);
    b.addEventListener("pointerdown", function (e) { if (e.button) return; ensure(); if (o.down) o.down(e); if (o.up) b.setPointerCapture(e.pointerId); });
    if (o.up) { b.addEventListener("pointerup", function (e) { o.up(e); }); b.addEventListener("pointercancel", function (e) { o.up(e); }); }
    b.addEventListener("click", function (e) { if (o.click) { ensure(); o.click(e); } });
    if (o.ctx) b.addEventListener("contextmenu", function (e) { e.preventDefault(); ensure(); o.ctx(e); });
    reg(id, { kind: "button", el: b, trigger: function (down) { ensure(); if (down) { if (o.down) o.down({}); if (o.click) o.click({}); } else if (o.up) o.up({}); } });
    return b;
  }
  ZS.knob = knob; ZS.fader = fader; ZS.btn = btn;

  /* ---------- deck ---------- */
  var COLORS = { A: "#ff3d7f", B: "#5ee6ff" };
  var UI = ZS.ui = { A: {}, B: {} };
  function dpr() { return Math.min(2, W.devicePixelRatio || 1); }
  function fit(c) { var r = dpr(), w = Math.max(10, Math.floor(c.clientWidth * r)), hh = Math.max(10, Math.floor(c.clientHeight * r)); if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; return true; } return false; }

  function buildDeck(id) {
    var root = $("#deck" + id), col = COLORS[id], u = UI[id], dk = function () { return ZS.decks && ZS.decks[id]; };
    root.className += " deck glass deck-" + id.toLowerCase(); root.style.setProperty("--ac", col);
    var head = h("div", "deck-h"), badge = h("span", "deck-badge", id), title = h("div", "deck-t"), name = h("b", "", "Nessuna traccia"), meta = h("small", "", "Carica un file audio o trascinalo qui");
    title.appendChild(name); title.appendChild(meta); u.name = name; u.meta = meta;
    var file = h("input", "", null, { type: "file", accept: "audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac", hidden: "" }), load = h("button", "pad-btn", "Carica", { type: "button" });
    var test = h("button", "pad-btn ghost", "Beat di prova", { type: "button", title: "Beat sintetico generato dal browser: serve solo per provare i deck, non è un brano" });
    head.appendChild(badge); head.appendChild(title); head.appendChild(test); head.appendChild(load); head.appendChild(file); root.appendChild(head);
    load.addEventListener("click", function () { ensure(); file.click(); });
    file.addEventListener("change", function () { if (file.files[0]) loadFile(id, file.files[0]); file.value = ""; });
    test.addEventListener("click", function () {
      ensure(); var bpm = id === "A" ? 124 : 128; meta.textContent = "Genero il beat di prova…";
      ZS.testBeat(bpm, id === "B").then(function (b) { return dk().load(b, "Beat di prova " + bpm + " BPM (sintetico)", "test" + id); }).then(function () { meta.textContent = "Beat sintetico generato dal browser · non è un brano"; }).catch(function (e) { meta.textContent = "Errore: " + e.message; });
    });
    root.addEventListener("dragover", function (e) { e.preventDefault(); root.classList.add("drop"); }); root.addEventListener("dragleave", function () { root.classList.remove("drop"); });
    root.addEventListener("drop", function (e) { e.preventDefault(); root.classList.remove("drop"); var f = e.dataTransfer.files[0]; if (f) { ensure(); loadFile(id, f); } });

    // forme d'onda
    var wf = h("div", "wf"), zoom = h("canvas", "wf-zoom", null, { "aria-label": "Forma d'onda del deck " + id }), ov = h("canvas", "wf-ov", null, { "aria-label": "Panoramica del deck " + id });
    wf.appendChild(zoom); wf.appendChild(ov); root.appendChild(wf); u.zoom = zoom; u.ov = ov;
    ov.addEventListener("pointerdown", function (e) { ensure(); var d = dk(); if (!d || !d.buf) return; var r = ov.getBoundingClientRect(); d.seek((e.clientX - r.left) / r.width * d.dur()); });
    var drag = null;
    zoom.addEventListener("pointerdown", function (e) { var d = dk(); if (!d || !d.buf) return; drag = { x: e.clientX, p: d.pos(), pl: d.playing }; zoom.setPointerCapture(e.pointerId); if (d.playing) d.pause(); });
    zoom.addEventListener("pointermove", function (e) { if (!drag) return; var d = dk(); d.offset = clamp(drag.p - (e.clientX - drag.x) * (6 / zoom.clientWidth), 0, d.dur()); });
    var endDrag = function () { if (!drag) return; var d = dk(); if (drag.pl) d.play(); drag = null; }; zoom.addEventListener("pointerup", endDrag); zoom.addEventListener("pointercancel", endDrag);

    // jog + tempo
    var mid = h("div", "deck-mid"), jog = h("div", "jog"), ring = h("i", "ring"), jl = h("span", "jog-l", id); jog.appendChild(ring); jog.appendChild(jl); u.jog = jog; u.ring = ring;
    var read = h("div", "reads"), bpmO = h("div", "bpm", "--"), bpmL = h("small", "", "BPM"), tOut = h("div", "tm", "00:00.0"), tRem = h("small", "", "-00:00.0");
    read.appendChild(bpmO); read.appendChild(bpmL); read.appendChild(tOut); read.appendChild(tRem); u.bpm = bpmO; u.tm = tOut; u.rem = tRem; mid.appendChild(jog); mid.appendChild(read);

    var pitchPct = 0;
    var pitch = fader({ id: id + ".pitch", label: "Pitch", aria: "Pitch e tempo deck " + id, min: -16, max: 16, step: 0.05, val: 0, def: 0, vertical: true, accent: col, fmt: function (v) { return (v > 0 ? "+" : "") + v.toFixed(1) + "%"; }, cb: function (v) { pitchPct = v; var d = dk(); if (d) d.setRate(1 + v / 100); } });
    u.pitch = pitch; u.setPitch = function (v) { var i = $("input", pitch); i.value = v; i.dispatchEvent(new Event("input")); };
    mid.appendChild(pitch); root.appendChild(mid);

    // trasporto
    var tr = h("div", "row transport");
    var cue = btn(id + ".cue", "CUE", { cls: "cue", down: function () { dk() && dk().cueDown(); }, up: function () { dk() && dk().cueUp(); } });
    var play = btn(id + ".play", "▶", { cls: "play", aria: "Play o pausa", click: function () { dk() && dk().toggle(); } }); u.play = play;
    var sync = btn(id + ".sync", "SYNC", { cls: "sync", click: function () { var d = dk(), o = ZS.decks[id === "A" ? "B" : "A"]; if (!d.buf || !o.buf) return ZS.toast("Servono due tracce caricate"); if (!d.bpm || !o.bpm) return ZS.toast("BPM non ancora rilevati"); d.sync(o); u.setPitch(Math.round((d.rate - 1) * 1000) / 10); ZS.toast("Deck " + id + " sincronizzato a " + (o.bpm * o.effRate()).toFixed(1) + " BPM"); } });
    var bm = btn(id + ".bendm", "−", { cls: "bend", title: "Rallenta temporaneamente (tieni premuto)", down: function () { dk().setBend(-0.04); }, up: function () { dk().setBend(0); } });
    var bp = btn(id + ".bendp", "+", { cls: "bend", title: "Accelera temporaneamente (tieni premuto)", down: function () { dk().setBend(0.04); }, up: function () { dk().setBend(0); } });
    [cue, play, sync, bm, bp].forEach(function (b) { tr.appendChild(b); }); root.appendChild(tr);

    var bt = h("div", "row small");
    bt.appendChild(btn(id + ".half", "½", { title: "Dimezza il BPM rilevato", click: function () { var d = dk(); if (d.bpm) { d.bpm /= 2; d.onbpm && d.onbpm(); } } }));
    bt.appendChild(btn(id + ".dbl", "×2", { title: "Raddoppia il BPM rilevato", click: function () { var d = dk(); if (d.bpm) { d.bpm *= 2; d.onbpm && d.onbpm(); } } }));
    var taps = [];
    bt.appendChild(btn(id + ".tap", "TAP", { title: "Batti il tempo", click: function () { var n = performance.now(); if (taps.length && n - taps[taps.length - 1] > 2000) taps = []; taps.push(n); if (taps.length > 3) { var iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); var d = dk(); if (d.buf) { d.bpm = Math.round(60000 / iv * 10) / 10; d.grid = d.pos() % (60 / d.bpm); d.onbpm && d.onbpm(); } } } }));
    bt.appendChild(btn(id + ".grid", "GRID", { title: "Imposta l'inizio della battuta qui", click: function () { var d = dk(); if (d.buf && d.bpm) { d.grid = d.pos() % (60 / d.bpm); ZS.toast("Griglia allineata"); } } }));
    root.appendChild(bt);

    // loop
    var lp = h("div", "row loops"), lbs = [];
    [["¼", 0.25], ["½", 0.5], ["1", 1], ["2", 2], ["4", 4], ["8", 8]].forEach(function (x) { var b = btn(id + ".loop" + x[1], x[0], { cls: "loopb", title: "Loop di " + x[0] + " battute", click: function () { dk().loopBeats(x[1]); } }); b.setAttribute("data-b", x[1]); lbs.push(b); lp.appendChild(b); });
    lp.appendChild(btn(id + ".lin", "IN", { title: "Inizio loop manuale", click: function () { dk().loopIn(); } })); lp.appendChild(btn(id + ".lout", "OUT", { title: "Fine loop manuale (attiva il loop)", click: function () { dk().loopOut(); } }));
    lp.appendChild(btn(id + ".loff", "EXIT", { click: function () { var d = dk(); if (d.loop.on) d.loopOff(); } })); u.loopBtns = lbs; root.appendChild(lp);

    // hot cue
    var hc = h("div", "row hots"); u.hots = [];
    for (var i = 0; i < 4; i++) (function (i) { var b = btn(id + ".hot" + (i + 1), String(i + 1), { cls: "hot hot" + i, title: "Hot cue " + (i + 1) + ": clic per impostare/saltare, tasto destro o Maiusc+clic per cancellare", down: function (e) { dk().hotDown(i, e && e.shiftKey); }, ctx: function () { dk().hotDown(i, true); } }); u.hots.push(b); hc.appendChild(b); })(i);
    root.appendChild(hc);

    // canale: trim, EQ, filtro, fader, VU, FX
    var ch = h("div", "chan");
    var kn = h("div", "knobs");
    kn.appendChild(knob({ id: id + ".trim", label: "GAIN", min: -12, max: 12, val: 0, def: 0, accent: col, fmt: function (v) { return (v > 0 ? "+" : "") + v.toFixed(0) + " dB"; }, cb: function (v) { var d = dk(); if (d) d.trim.gain.setTargetAtTime(Math.pow(10, v / 20), ZS.ctx.currentTime, 0.01); } }));
    function eq(nm, label, node) { return knob({ id: id + "." + nm, label: label, min: -26, max: 6, val: 0, def: 0, accent: col, fmt: function (v) { return v <= -25.5 ? "KILL" : (v > 0 ? "+" : "") + v.toFixed(0) + " dB"; }, cb: function (v) { var d = dk(); if (d) d[node].gain.setTargetAtTime(v <= -25.5 ? -60 : v, ZS.ctx.currentTime, 0.01); } }); }
    kn.appendChild(eq("hi", "HI", "hi")); kn.appendChild(eq("mid", "MID", "mid")); kn.appendChild(eq("lo", "LOW", "lo"));
    kn.appendChild(knob({ id: id + ".filter", label: "FILTRO", min: -1, max: 1, val: 0, def: 0, accent: col, fmt: function (v) { return Math.abs(v) < 0.03 ? "OFF" : v < 0 ? "LP" : "HP"; }, cb: function (v) {
      var d = dk(); if (!d) return; var f = d.filt, t = ZS.ctx.currentTime;
      if (Math.abs(v) < 0.03) { f.type = "lowpass"; f.frequency.setTargetAtTime(22000, t, 0.02); f.Q.value = 0.9; return; }
      var ty = v < 0 ? "lowpass" : "highpass"; if (f.type !== ty) f.type = ty; f.frequency.setTargetAtTime(v < 0 ? 20000 * Math.pow(90 / 20000, -v) : 20 * Math.pow(8000 / 20, v), t, 0.015); f.Q.value = 3; } }));
    ch.appendChild(kn);
    var strip = h("div", "strip");
    var vu = h("canvas", "vu", null, { "aria-hidden": "true" }); u.vu = vu;
    var vf = fader({ id: id + ".vol", label: "Volume", aria: "Volume canale " + id, min: 0, max: 1, step: 0.005, val: 0.85, def: 0.85, vertical: true, accent: col, fmt: function (v) { return Math.round(v * 100) + "%"; }, cb: function (v) { var d = dk(); if (d) d.vol.gain.setTargetAtTime(v * v, ZS.ctx.currentTime, 0.01); } });
    var fxb = btn(id + ".fxsend", "FX", { cls: "fxs", title: "Invia questo deck agli effetti (echo / riverbero)", click: function () { var on = !fxb.classList.contains("on"); fxb.classList.toggle("on", on); dk().send.gain.setTargetAtTime(on ? 1 : 0, ZS.ctx.currentTime, 0.02); } });
    strip.appendChild(vu); strip.appendChild(vf); strip.appendChild(fxb); ch.appendChild(strip); root.appendChild(ch);

    // callback del deck
    ZS.afterInit(function () {
      var d = dk(); u.deck = d;
      d.onload = function () { name.textContent = d.name; meta.textContent = fmtT(d.dur()) + " · analisi BPM…"; u.ovDirty = true; };
      d.onbpm = function () { bpmO.textContent = d.bpm ? (d.bpm * d.effRate()).toFixed(1) : "--"; meta.textContent = fmtT(d.dur()) + (d.bpm ? " · " + d.bpm.toFixed(1) + " BPM (rilevati" + (d.conf < 0.35 ? ", incerti: usa ½ ×2 o TAP" : "") + ")" : " · BPM non rilevati: usa TAP"); u.ovDirty = true; };
    });
  }
  function loadFile(id, f) {
    var u = UI[id]; if (f.size > 120 * 1024 * 1024) return ZS.toast("File troppo grande (massimo 120 MB)");
    u.meta.textContent = "Carico «" + f.name + "»…";
    return f.arrayBuffer().then(function (ab) { return ZS.decks[id].load(ab, f.name.replace(/\.[^.]+$/, ""), f.name + "|" + f.size); }).catch(function () { u.meta.textContent = "Impossibile leggere questo file audio."; ZS.toast("Formato non leggibile dal browser"); });
  }
  ZS.loadFile = loadFile;
  ZS.loadBuffer = function (id, buf, name, key) { ensure(); return ZS.decks[id].load(buf, name, key); };

  /* ---------- disegno ---------- */
  function drawOv(id) {
    var u = UI[id], d = ZS.decks && ZS.decks[id], c = u.ov, x = c.getContext("2d"); fit(c);
    var W_ = c.width, H = c.height; x.clearRect(0, 0, W_, H);
    if (!d || !d.buf) { x.fillStyle = "rgba(255,255,255,.06)"; x.fillRect(0, H / 2 - 1, W_, 2); return; }
    if (u.ovDirty || !u.ovCache || u.ovCache.width !== W_ || u.ovCache.height !== H) {
      var oc = D.createElement("canvas"); oc.width = W_; oc.height = H; var o = oc.getContext("2d"), pk = d.peaks, n = pk.length;
      for (var px = 0; px < W_; px++) { var a = Math.floor(px / W_ * n), b = Math.max(a + 1, Math.floor((px + 1) / W_ * n)), m = 0; for (var k = a; k < b; k++) if (pk[k] > m) m = pk[k]; var hh = Math.max(1, m * H * 0.92); o.fillStyle = "rgba(255,255,255,.35)"; o.fillRect(px, (H - hh) / 2, 1, hh); }
      if (d.bpm) { o.fillStyle = "rgba(255,255,255,.08)"; var bl = 60 / d.bpm; for (var t = d.grid; t < d.dur(); t += bl * 4) o.fillRect(Math.floor(t / d.dur() * W_), 0, 1, H); }
      u.ovCache = oc; u.ovDirty = false;
    }
    x.drawImage(u.ovCache, 0, 0);
    var p = d.pos() / d.dur() * W_; x.globalCompositeOperation = "source-atop"; x.fillStyle = COLORS[id]; x.globalAlpha = 0.85; x.fillRect(0, 0, p, H); x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
    x.fillStyle = "#fff"; x.fillRect(p - 1, 0, 2, H);
    if (d.loop.on) { x.fillStyle = "rgba(245,195,108,.35)"; x.fillRect(d.loop.start / d.dur() * W_, 0, (d.loop.end - d.loop.start) / d.dur() * W_, H); }
    d.hot.forEach(function (t, i) { if (t != null) { x.fillStyle = HOTC[i]; x.fillRect(t / d.dur() * W_, 0, 2, H); } });
  }
  var HOTC = ["#3ddc97", "#f5c36c", "#9b5cff", "#ff6b88"], WIN = 6;
  function drawZoom(id) {
    var u = UI[id], d = ZS.decks && ZS.decks[id], c = u.zoom, x = c.getContext("2d"); fit(c);
    var Wd = c.width, H = c.height; x.clearRect(0, 0, Wd, H);
    if (!d || !d.buf) { x.fillStyle = "rgba(255,255,255,.05)"; x.fillRect(0, H / 2 - 1, Wd, 2); return; }
    var pos = d.pos(), pk = d.peaks, pps = ZS.PPS, spp = WIN / Wd, col = COLORS[id];
    // griglia delle battute
    if (d.bpm) { var bl = 60 / d.bpm, t0 = pos - WIN / 2, b0 = Math.ceil((t0 - d.grid) / bl); for (var b = b0; ; b++) { var t = d.grid + b * bl; if (t > pos + WIN / 2) break; var gx = (t - t0) / spp; x.fillStyle = b % 4 === 0 ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.1)"; x.fillRect(Math.round(gx), 0, b % 4 === 0 ? 2 : 1, H); } }
    if (d.loop.on) { x.fillStyle = "rgba(245,195,108,.18)"; x.fillRect((d.loop.start - pos) / spp + Wd / 2, 0, (d.loop.end - d.loop.start) / spp, H); }
    for (var px = 0; px < Wd; px++) {
      var tt = pos + (px - Wd / 2) * spp, i = Math.floor(tt * pps); if (i < 0 || i >= pk.length) continue;
      var v = pk[i]; if (spp * pps > 1) { var e = Math.min(pk.length, Math.floor((tt + spp) * pps) + 1); for (var k = i + 1; k < e; k++) if (pk[k] > v) v = pk[k]; }
      var hh = Math.max(1, v * H * 0.46); x.fillStyle = tt < pos ? col : "rgba(255,255,255,.55)"; x.globalAlpha = tt < pos ? 0.95 : 0.8; x.fillRect(px, H / 2 - hh, 1, hh * 2);
    }
    x.globalAlpha = 1;
    [["#fff", d.cue, "C"]].concat(d.hot.map(function (t, i) { return [HOTC[i], t, String(i + 1)]; })).forEach(function (m) { if (m[1] == null) return; var mx = (m[1] - pos) / spp + Wd / 2; if (mx < -10 || mx > Wd + 10) return; x.fillStyle = m[0]; x.fillRect(mx, 0, 2, H); x.font = (11 * dpr()) + "px system-ui"; x.fillText(m[2], mx + 4, 12 * dpr()); });
    x.fillStyle = "#fff"; x.fillRect(Wd / 2 - 1, 0, 2, H);
  }
  var lastT = 0, ang = { A: 0, B: 0 };
  function frame() {
    var now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    ["A", "B"].forEach(function (id) {
      var u = UI[id], d = ZS.decks && ZS.decks[id]; if (!u.zoom) return;
      drawZoom(id); drawOv(id);
      if (d) {
        var p = d.pos(); u.tm.textContent = fmtT(p); u.rem.textContent = "-" + fmtT(d.dur() - p);
        if (d.playing) ang[id] = (ang[id] + dt * 200 * d.effRate()) % 360; u.ring.style.transform = "rotate(" + ang[id] + "deg)";
        u.play.textContent = d.playing ? "❚❚" : "▶"; u.play.classList.toggle("on", d.playing); u.jog.classList.toggle("spin", d.playing);
        u.bpm.textContent = d.bpm ? (d.bpm * d.effRate()).toFixed(1) : "--";
        u.loopBtns.forEach(function (b) { b.classList.toggle("on", d.loop.on && d.loop.beats === +b.getAttribute("data-b")); });
        u.hots.forEach(function (b, i) { b.classList.toggle("set", d.hot[i] != null); });
        meter(u.vu, d.an, COLORS[id], true);
      }
    });
    if (ZS.ready()) {
      // sweep automatico agganciato al BPM
      var F = ZS.fx; if (F.auto.on) { var bpm = ZS.masterBpm() || 120, per = F.auto.beats * 60 / bpm, ph = (performance.now() / 1000 % per) / per; F.setSweep(-0.92 * (0.5 - 0.5 * Math.cos(ph * 2 * Math.PI))); var kc = CTL["fx.sweep"]; if (kc) kc.set(F.sweep, false, true); }
      if (ZS.fx.echoBeats && ZS.masterBpm()) ZS.fx.syncEcho();
      masterDraw();
    }
    var rt = $("#recTime"); if (rt) rt.textContent = ZS.fmtT(ZS.rec.elapsed());
  }
  var buf8 = null;
  function meter(c, an, col, vertical) {
    if (!c) return; fit(c); var x = c.getContext("2d"), n = an.fftSize; if (!buf8 || buf8.length < n) buf8 = new Uint8Array(2048);
    an.getByteTimeDomainData(buf8); var pk = 0, i; for (i = 0; i < n; i++) { var v = Math.abs(buf8[i] - 128) / 128; if (v > pk) pk = v; }
    c._lv = Math.max(pk, (c._lv || 0) - 0.02); var lv = c._lv, Wd = c.width, H = c.height; x.clearRect(0, 0, Wd, H);
    var segs = vertical ? 14 : 24, i2;
    for (i2 = 0; i2 < segs; i2++) { var on = lv * 1.15 >= (i2 + 1) / segs, hot = i2 > segs * 0.85, mid = i2 > segs * 0.65; x.fillStyle = on ? (hot ? "#ff3d5a" : mid ? "#f5c36c" : col) : "rgba(255,255,255,.08)";
      if (vertical) { var sh = H / segs; x.fillRect(1, H - (i2 + 1) * sh + 1, Wd - 2, sh - 2); } else { var sw = Wd / segs; x.fillRect(i2 * sw + 1, 1, sw - 2, H - 2); } }
    return pk;
  }
  var mCanvas = {}, specBuf = null;
  function masterDraw() {
    var E = ZS.E;
    if (mCanvas.l) { var a = meter(mCanvas.l, E.anL, "#3ddc97", false), b = meter(mCanvas.r, E.anR, "#3ddc97", false); if (Math.max(a, b) > 0.985) { mCanvas.clip.classList.add("on"); mCanvas.clipT = performance.now(); } else if (performance.now() - (mCanvas.clipT || 0) > 1200) mCanvas.clip.classList.remove("on"); }
    var c = mCanvas.viz; if (!c) return; fit(c); var x = c.getContext("2d"), Wd = c.width, H = c.height; if (!specBuf) specBuf = new Uint8Array(E.spec.frequencyBinCount); E.spec.getByteFrequencyData(specBuf);
    x.clearRect(0, 0, Wd, H); var bars = 48, bw = Wd / bars, i, g = x.createLinearGradient(0, H, 0, 0); g.addColorStop(0, "#9b5cff"); g.addColorStop(0.6, "#ff3d7f"); g.addColorStop(1, "#f5c36c");
    for (i = 0; i < bars; i++) { var idx = Math.floor(Math.pow(i / bars, 1.6) * (specBuf.length * 0.8)) + 1, v = specBuf[idx] / 255, bh = Math.max(2, v * H * 0.92); x.fillStyle = g; x.globalAlpha = 0.35 + v * 0.65; x.fillRect(i * bw + 1, H - bh, bw - 2, bh); }
    x.globalAlpha = 1; x.fillStyle = "rgba(255,255,255,.55)"; x.font = "600 " + (12 * dpr()) + "px system-ui"; x.fillText("Z-Sound · OurVelvet 18+", 10 * dpr(), 18 * dpr());
  }

  /* ---------- mixer ---------- */
  function buildMixer() {
    var m = $("#mixer"); m.appendChild(h("h2", "ph", "Mixer"));
    var xf = h("div", "xf");
    xf.appendChild(h("span", "xl a", "A"));
    xf.appendChild(fader({ id: "xfader", label: "", aria: "Crossfader", min: 0, max: 1, step: 0.005, val: 0.5, def: 0.5, vertical: false, fmt: null, cb: function (v) { ZS.E.xf = v; ZS.applyXF(); } }));
    xf.appendChild(h("span", "xl b", "B")); m.appendChild(xf);
    var cv = h("div", "row small"); var curve = btn("xf.curve", "Curva: morbida", { click: function () { ZS.E.xfCurve = ZS.E.xfCurve === "soft" ? "cut" : "soft"; curve.textContent = "Curva: " + (ZS.E.xfCurve === "soft" ? "morbida" : "netta"); ZS.applyXF(); } });
    cv.appendChild(curve); cv.appendChild(btn("xf.center", "Centro", { click: function () { CTL.xfader.set(0.5); } }));
    cv.appendChild(btn("xf.toA", "◀ A", { click: function () { CTL.xfader.set(0); } })); cv.appendChild(btn("xf.toB", "B ▶", { click: function () { CTL.xfader.set(1); } })); m.appendChild(cv);
    var mr = h("div", "mrow");
    mr.appendChild(knob({ id: "master.vol", label: "MASTER", min: 0, max: 1, val: 0.85, def: 0.85, fmt: function (v) { return Math.round(v * 100) + "%"; }, cb: function (v) { ZS.E.vol && ZS.E.vol.gain.setTargetAtTime(v * v * 1.2, ZS.ctx.currentTime, 0.01); } }));
    var met = h("div", "mmeters"); var ml = h("canvas", "mm", null, { "aria-hidden": "true" }), mrr = h("canvas", "mm", null, { "aria-hidden": "true" }), clip = h("span", "clip", "CLIP");
    met.appendChild(ml); met.appendChild(mrr); met.appendChild(clip); mr.appendChild(met); m.appendChild(mr); mCanvas.l = ml; mCanvas.r = mrr; mCanvas.clip = clip;
    var viz = h("canvas", "viz", null, { "aria-label": "Spettro del master" }); m.appendChild(viz); mCanvas.viz = viz; ZS.vizCanvas = viz;
    var mb = h("div", "mbpm", "Master BPM: --"); m.appendChild(mb); ZS.onFrame(function () { var b = ZS.masterBpm(); mb.textContent = "Master BPM: " + (b ? b.toFixed(1) : "--"); });
  }

  /* ---------- FX ---------- */
  function buildFx() {
    var p = $("#fxp"); p.appendChild(h("h2", "ph", "Effetti"));
    p.appendChild(h("p", "muted sm", "Attiva «FX» sul deck per mandarlo agli effetti. Lo sweep agisce sul master."));
    var g = h("div", "fx-grid");
    var echo = h("div", "fxu"); echo.appendChild(h("h3", "", "Echo"));
    var er = h("div", "row small"), eb = [[0.25, "¼"], [0.5, "½"], [0.75, "¾"], [1, "1"]].map(function (x) { var b = btn("fx.echo" + x[0], x[1], { title: x[1] + " battuta", click: function () { ZS.fx.setEchoTime(x[0]); eb.forEach(function (y) { y.classList.toggle("on", y === b); }); } }); b.setAttribute("data-b", x[0]); if (x[0] === 0.75) b.classList.add("on"); er.appendChild(b); return b; });
    echo.appendChild(er);
    var ek = h("div", "knobs"); ek.appendChild(knob({ id: "fx.echoWet", label: "MIX", min: 0, max: 1, val: 0, def: 0, accent: "#f5c36c", fmt: function (v) { return Math.round(v * 100) + "%"; }, cb: function (v) { ZS.fx.setEcho(v * 0.9, null); } }));
    ek.appendChild(knob({ id: "fx.echoFb", label: "FEEDBACK", min: 0, max: 0.9, val: 0.4, def: 0.4, accent: "#f5c36c", fmt: function (v) { return Math.round(v * 100) + "%"; }, cb: function (v) { ZS.fx.setEcho(null, v); } })); echo.appendChild(ek); g.appendChild(echo);
    var rv = h("div", "fxu"); rv.appendChild(h("h3", "", "Riverbero")); var rk = h("div", "knobs");
    rk.appendChild(knob({ id: "fx.revWet", label: "MIX", min: 0, max: 1, val: 0, def: 0, accent: "#9b5cff", fmt: function (v) { return Math.round(v * 100) + "%"; }, cb: function (v) { ZS.fx.setReverb(v); } }));
    var rt; rk.appendChild(knob({ id: "fx.revSize", label: "AMBIENTE", min: 0.5, max: 5, val: 2.2, def: 2.2, accent: "#9b5cff", fmt: function (v) { return v.toFixed(1) + " s"; }, cb: function (v, user) { if (!user) return; clearTimeout(rt); rt = setTimeout(function () { ZS.fx.setReverbSize(v); }, 150); } })); rv.appendChild(rk); g.appendChild(rv);
    var sw = h("div", "fxu wide"); sw.appendChild(h("h3", "", "Filter sweep (master)")); var sk = h("div", "knobs");
    sk.appendChild(knob({ id: "fx.sweep", label: "SWEEP", min: -1, max: 1, val: 0, def: 0, accent: "#5ee6ff", fmt: function (v) { return Math.abs(v) < 0.03 ? "OFF" : v < 0 ? "LP" : "HP"; }, cb: function (v, user) { if (user) ZS.fx.auto.on = false, autoB.classList.remove("on"); ZS.fx.setSweep(v); } }));
    sk.appendChild(knob({ id: "fx.res", label: "RISONANZA", min: 0.7, max: 12, val: 0.7, def: 0.7, accent: "#5ee6ff", fmt: function (v) { return "Q " + v.toFixed(1); }, cb: function (v) { ZS.fx.sweepRes = v; ZS.fx.setSweep(ZS.fx.sweep); } }));
    var autoB = btn("fx.auto", "AUTO", { title: "Sweep automatico a tempo con il master BPM", click: function () { var F = ZS.fx; F.auto.on = !F.auto.on; autoB.classList.toggle("on", F.auto.on); if (!F.auto.on) { F.setSweep(0); CTL["fx.sweep"].set(0, false, true); } } });
    var ab = btn("fx.autolen", "8 battute", { click: function () { var F = ZS.fx; F.auto.beats = F.auto.beats === 8 ? 16 : F.auto.beats === 16 ? 32 : 8; ab.textContent = F.auto.beats + " battute"; } });
    var sr = h("div", "row small"); sr.appendChild(autoB); sr.appendChild(ab); sw.appendChild(sk); sw.appendChild(sr); g.appendChild(sw); p.appendChild(g);
  }

  /* ---------- pad ---------- */
  function buildPads() {
    var p = $("#padp"); p.appendChild(h("h2", "ph", "Campionatore")); p.appendChild(h("p", "muted sm", "Suoni sintetici generati dal browser: nessun campione di terzi. Tasti: Z X C V · A S D F"));
    var g = h("div", "padgrid");
    ZS.PADS.forEach(function (pd, i) { var b = btn("pad" + (i + 1), "", { cls: "pad pad" + i, down: function () { ZS.hit(i, 1); b.classList.add("hit"); setTimeout(function () { b.classList.remove("hit"); }, 120); } }); b.appendChild(h("b", "", pd.n)); b.appendChild(h("small", "", pd.key.toUpperCase())); g.appendChild(b); });
    p.appendChild(g);
    var k = h("div", "knobs");
    k.appendChild(knob({ id: "pad.vol", label: "VOLUME", min: 0, max: 1, val: 0.9, def: 0.9, fmt: function (v) { return Math.round(v * 100) + "%"; }, cb: function (v) { ZS.sampler.vol = v; } }));
    k.appendChild(knob({ id: "pad.pitch", label: "TONO", min: -12, max: 12, val: 0, def: 0, fmt: function (v) { return (v > 0 ? "+" : "") + Math.round(v) + " st"; }, cb: function (v) { ZS.sampler.pitch = Math.round(v); } }));
    var fxs = btn("pad.fx", "FX", { cls: "fxs", title: "Pad verso gli effetti", click: function () { ZS.sampler.send = !ZS.sampler.send; fxs.classList.toggle("on", ZS.sampler.send); } });
    var wrap = h("div", "knob-w"); wrap.appendChild(fxs); k.appendChild(wrap); p.appendChild(k);
  }

  /* ---------- tastiera e MIDI ---------- */
  var KEYS = {
    q: ["A.play", 1], w: ["A.cue", 2], e: ["A.sync", 1], r: ["A.loop4", 1], 1: ["A.hot1", 3], 2: ["A.hot2", 3], 3: ["A.hot3", 3], 4: ["A.hot4", 3],
    u: ["B.play", 1], i: ["B.cue", 2], o: ["B.sync", 1], y: ["B.loop4", 1], 7: ["B.hot1", 3], 8: ["B.hot2", 3], 9: ["B.hot3", 3], 0: ["B.hot4", 3],
    z: ["pad1", 2], x: ["pad2", 2], c: ["pad3", 2], v: ["pad4", 2], a: ["pad5", 2], s: ["pad6", 2], d: ["pad7", 2], f: ["pad8", 2]
  };
  function bindKeys() {
    var downK = {};
    D.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return; var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== "range") return; if (t && t.isContentEditable) return;
      var k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "arrowright") { if (t && t.type === "range") return; ensure(); var c = CTL.xfader; c.set(clamp(c.get() + (k === "arrowleft" ? -0.05 : 0.05), 0, 1)); e.preventDefault(); return; }
      if (k === "arrowdown") { if (t && t.type === "range") return; ensure(); CTL.xfader.set(0.5); e.preventDefault(); return; }
      if (k === "m") { ensure(); var rb = $("#recBtn"); rb && rb.click(); return; }
      var m = KEYS[k]; if (!m || e.repeat) return; ensure(); downK[k] = m[0];
      var id = m[0]; if (/loop4$/.test(id)) { ZS.decks[id[0]].loopBeats(4); } else { var c2 = CTL[id]; if (c2 && c2.trigger) c2.trigger(true); } e.preventDefault();
    });
    D.addEventListener("keyup", function (e) { var k = e.key.toLowerCase(), id = downK[k]; if (!id) return; delete downK[k]; var c = CTL[id]; if (c && c.trigger && (id.indexOf(".cue") > 0)) c.trigger(false); });
  }
  var learn = { on: false, target: null }, MAP = {};
  try { MAP = JSON.parse(W.localStorage.getItem("zs-midi") || "{}"); } catch (e) { MAP = {}; }
  function saveMap() { try { W.localStorage.setItem("zs-midi", JSON.stringify(MAP)); } catch (e) {} }
  function midiMsg(e) {
    var s = e.data[0], cmd = s & 0xf0, ch = s & 0x0f, d1 = e.data[1], d2 = e.data[2]; if (cmd !== 0x90 && cmd !== 0x80 && cmd !== 0xb0) return;
    var on = cmd === 0x90 && d2 > 0, key = (cmd === 0xb0 ? "cc" : "n") + ch + ":" + d1;
    if (learn.on && learn.target && (cmd === 0xb0 || on)) { MAP[key] = learn.target; saveMap(); ZS.toast("Collegato: " + learn.target); setLearnTarget(null); learnInfo(); return; }
    ensure();
    var id = MAP[key];
    if (!id && cmd !== 0xb0 && d1 >= 36 && d1 <= 43) { if (on) ZS.hit(d1 - 36, d2 / 127); return; }   // mappa predefinita GM: pad su note 36-43
    if (!id) return; var c = CTL[id]; if (!c) return;
    if (cmd === 0xb0 && c.set01) c.set01(d2 / 127); else if (c.trigger) { if (on) c.trigger(true); else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) c.trigger(false); }
  }
  function setLearnTarget(id) { learn.target = id; $$("[data-ctl]").forEach(function (n) { n.classList.toggle("learn-t", n.getAttribute("data-ctl") === id); }); }
  function learnInfo() { var n = Object.keys(MAP).length, i = $("#midiInfo"); if (i) i.textContent = n + " collegamenti salvati"; }
  function bindMidi() {
    var mb = $("#midiBtn"), panel = $("#midiPanel");
    mb.addEventListener("click", function () { panel.hidden = !panel.hidden; });
    $("#midiLearn").addEventListener("click", function () { learn.on = !learn.on; D.body.classList.toggle("learning", learn.on); $("#midiLearn").classList.toggle("on", learn.on); $("#midiLearn").textContent = learn.on ? "Learn attivo: tocca un controllo, poi muovi il tuo" : "MIDI learn"; if (!learn.on) setLearnTarget(null); });
    $("#midiClear").addEventListener("click", function () { MAP = {}; saveMap(); learnInfo(); ZS.toast("Collegamenti cancellati"); });
    D.addEventListener("click", function (e) { if (!learn.on) return; var n = e.target.closest && e.target.closest("[data-ctl]"); if (n) { setLearnTarget(n.getAttribute("data-ctl")); e.preventDefault(); e.stopPropagation(); ZS.toast("Ora muovi o premi un controllo del tuo dispositivo MIDI"); } }, true);
    learnInfo();
    var st = $("#midiState");
    if (!navigator.requestMIDIAccess) { st.textContent = "Il tuo browser non supporta Web MIDI (usa Chrome o Edge)."; $("#midiLearn").disabled = true; return; }
    st.textContent = "Clicca «Cerca dispositivi» per abilitare Web MIDI.";
    $("#midiScan").addEventListener("click", function () {
      navigator.requestMIDIAccess().then(function (a) {
        function wire() { var n = 0, names = []; a.inputs.forEach(function (i) { i.onmidimessage = midiMsg; n++; names.push(i.name); }); st.textContent = n ? "Collegati: " + names.join(", ") : "Nessun dispositivo MIDI trovato. Collega un controller e riprova."; }
        a.onstatechange = wire; wire();
      }).catch(function () { st.textContent = "Permesso MIDI negato dal browser."; });
    });
    ZS.midiMsg = midiMsg;
  }

  /* ---------- schede (mobile) ---------- */
  function bindTabs() {
    var main = $("#studio");
    $$("#tabs button").forEach(function (b) { b.addEventListener("click", function () { main.setAttribute("data-tab", b.getAttribute("data-tab")); $$("#tabs button").forEach(function (x) { x.classList.toggle("on", x === b); }); W.scrollTo(0, 0); }); });
  }

  function init() {
    buildDeck("A"); buildDeck("B"); buildMixer(); buildFx(); buildPads(); bindKeys(); bindMidi(); bindTabs();
    var first = function () { ensure(); setState(); };
    D.addEventListener("pointerdown", first, { once: true, capture: true }); D.addEventListener("keydown", first, { once: true, capture: true });
    setState(); lastT = performance.now(); (function loop() { try { frame(); } catch (e) { if (W.console) console.error(e); } W.requestAnimationFrame(loop); })();
    $("#helpBtn").addEventListener("click", function () { var p = $("#helpPanel"); p.hidden = !p.hidden; });
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", init); else init();
})(window);
