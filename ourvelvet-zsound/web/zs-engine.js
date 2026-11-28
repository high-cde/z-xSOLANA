/* Z-Sound · motore audio (Web Audio API). © 2026 ZDOS1.3 · Licenza ZSEL proprietaria.
   Due deck, EQ a 3 bande + filtro, crossfader, FX (echo, riverbero, sweep), campionatore con suoni sintetici generati qui,
   rilevamento BPM, sync, hot cue, loop e registrazione del master. Nessun campione protetto da copyright. */
(function (W) {
  "use strict";
  var ZS = W.ZS = W.ZS || {};
  var AC = W.AudioContext || W.webkitAudioContext;
  var ctx = null, E = ZS.E = {};          // E = nodi principali
  var tick = [];                           // callback chiamate ad ogni frame (UI)
  ZS.onFrame = function (f) { tick.push(f); };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  ZS.clamp = clamp;

  /* ---------- BPM ---------- */
  function mono(buf, maxSec) {
    var n = Math.min(buf.length, Math.floor(buf.sampleRate * maxSec)), out = new Float32Array(n), ch = buf.numberOfChannels, i, c, d;
    for (c = 0; c < ch; c++) { d = buf.getChannelData(c); for (i = 0; i < n; i++) out[i] += d[i] / ch; }
    return out;
  }
  ZS.detectBPM = function (buf) {
    var sr = buf.sampleRate, secs = Math.min(buf.length / sr, 150);
    var m = mono(buf, secs);
    var off = new (W.OfflineAudioContext || W.webkitOfflineAudioContext)(1, m.length, sr);
    var b = off.createBuffer(1, m.length, sr); b.copyToChannel(m, 0);
    var s = off.createBufferSource(); s.buffer = b; var lp = off.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 160; lp.Q.value = 0.7;
    s.connect(lp); lp.connect(off.destination); s.start();
    return off.startRendering().then(function (r) {
      var x = r.getChannelData(0), hop = Math.max(1, Math.floor(sr / 200)), R = sr / hop, N = Math.floor(x.length / hop), env = new Float32Array(N), i, k, j;
      for (i = 0; i < N; i++) { var a = 0; for (j = 0; j < hop; j++) a += Math.abs(x[i * hop + j]); env[i] = a / hop; }
      var flux = new Float32Array(N), mx = 0; for (i = 1; i < N; i++) { flux[i] = Math.max(0, env[i] - env[i - 1]); if (flux[i] > mx) mx = flux[i]; }
      if (mx < 1e-5) return { bpm: 0, first: 0, conf: 0 };
      for (i = 0; i < N; i++) flux[i] /= mx;
      function at(t) { var i0 = Math.floor(t); if (i0 < 0 || i0 + 1 >= N) return 0; var f = t - i0; return flux[i0] * (1 - f) + flux[i0 + 1] * f; }
      function score(bpm) { var lag = 60 * R / bpm, sc = 0, t; for (t = 0; t < N - 2 * lag - 2; t += 1) { var v = flux[t]; if (v > 0.05) sc += v * (at(t + lag) + 0.6 * at(t + 2 * lag) + 0.4 * at(t + 4 * lag)); } return sc; }
      var best = 0, bs = -1, tot = 0, cnt = 0, bpm;
      for (bpm = 70; bpm <= 180; bpm += 0.5) { var sc = score(bpm); tot += sc; cnt++; if (sc > bs) { bs = sc; best = bpm; } }
      var b2 = best, s2 = bs; for (bpm = best - 0.5; bpm <= best + 0.5; bpm += 0.05) { var q = score(bpm); if (q > s2) { s2 = q; b2 = bpm; } }
      best = Math.round(b2 * 100) / 100;
      while (best < 85) best *= 2; while (best > 175) best /= 2;
      var P = 60 * R / best, bo = 0, bv = -1, o;
      for (o = 0; o < P; o += 0.5) { var sum = 0; for (k = o; k < N; k += P) sum += at(k); if (sum > bv) { bv = sum; bo = o; } }
      return { bpm: Math.round(best * 100) / 100, first: bo / R, conf: Math.min(1, bs / ((tot / cnt) * 3 + 1e-9)) };
    });
  };
  function peaksOf(buf, pps) {
    var n = Math.ceil(buf.duration * pps), out = new Float32Array(n), blk = Math.floor(buf.sampleRate / pps), c, i, j, d, v;
    for (c = 0; c < buf.numberOfChannels; c++) { d = buf.getChannelData(c); for (i = 0; i < n; i++) { v = out[i]; var s = i * blk, e = Math.min(d.length, s + blk); for (j = s; j < e; j += 2) { var a = d[j] < 0 ? -d[j] : d[j]; if (a > v) v = a; } out[i] = v; } }
    return out;
  }
  ZS.PPS = 100;

  /* ---------- WAV ---------- */
  ZS.encodeWav = function (buf) {
    var ch = Math.min(2, buf.numberOfChannels), len = buf.length, sr = buf.sampleRate, bytes = 44 + len * ch * 2, ab = new ArrayBuffer(bytes), dv = new DataView(ab), o = 0, i, c;
    function str(s) { for (var k = 0; k < s.length; k++) dv.setUint8(o++, s.charCodeAt(k)); }
    str("RIFF"); dv.setUint32(o, bytes - 8, true); o += 4; str("WAVEfmt "); dv.setUint32(o, 16, true); o += 4; dv.setUint16(o, 1, true); o += 2; dv.setUint16(o, ch, true); o += 2;
    dv.setUint32(o, sr, true); o += 4; dv.setUint32(o, sr * ch * 2, true); o += 4; dv.setUint16(o, ch * 2, true); o += 2; dv.setUint16(o, 16, true); o += 2; str("data"); dv.setUint32(o, len * ch * 2, true); o += 4;
    var data = []; for (c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    for (i = 0; i < len; i++) for (c = 0; c < ch; c++) { var v = clamp(data[c][i], -1, 1); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return new Blob([ab], { type: "audio/wav" });
  };

  /* ---------- costruzione del grafo ---------- */
  function mkReverbIR(sec) {
    var sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr), c, i;
    for (c = 0; c < 2; c++) { var d = b.getChannelData(c); for (i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  }
  ZS.init = function () {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return ctx; }
    if (!AC) throw new Error("Questo browser non supporta Web Audio.");
    ctx = ZS.ctx = new AC({ latencyHint: "interactive" });
    E.dry = ctx.createGain(); E.fxIn = ctx.createGain(); E.fxOut = ctx.createGain(); E.mix = ctx.createGain();
    // echo
    E.echoDelay = ctx.createDelay(4); E.echoDelay.delayTime.value = 0.375; E.echoFb = ctx.createGain(); E.echoFb.gain.value = 0.4; E.echoTone = ctx.createBiquadFilter(); E.echoTone.type = "lowpass"; E.echoTone.frequency.value = 4200; E.echoWet = ctx.createGain(); E.echoWet.gain.value = 0;
    E.fxIn.connect(E.echoDelay); E.echoDelay.connect(E.echoTone); E.echoTone.connect(E.echoFb); E.echoFb.connect(E.echoDelay); E.echoTone.connect(E.echoWet); E.echoWet.connect(E.fxOut);
    // riverbero
    E.rev = ctx.createConvolver(); E.rev.buffer = mkReverbIR(2.2); E.revWet = ctx.createGain(); E.revWet.gain.value = 0; E.fxIn.connect(E.rev); E.rev.connect(E.revWet); E.revWet.connect(E.fxOut);
    E.fxOut.connect(E.mix); E.dry.connect(E.mix);
    // sweep (filtro sul master)
    E.sweep = ctx.createBiquadFilter(); E.sweep.type = "lowpass"; E.sweep.frequency.value = 22000; E.sweep.Q.value = 0.7;
    E.vol = ctx.createGain(); E.vol.gain.value = 0.85;
    E.lim = ctx.createDynamicsCompressor(); E.lim.threshold.value = -3; E.lim.knee.value = 0; E.lim.ratio.value = 20; E.lim.attack.value = 0.003; E.lim.release.value = 0.12;
    E.mix.connect(E.sweep); E.sweep.connect(E.vol); E.vol.connect(E.lim); E.lim.connect(ctx.destination);
    E.split = ctx.createChannelSplitter(2); E.anL = ctx.createAnalyser(); E.anR = ctx.createAnalyser(); E.anL.fftSize = E.anR.fftSize = 1024; E.lim.connect(E.split); E.split.connect(E.anL, 0); E.split.connect(E.anR, 1);
    E.spec = ctx.createAnalyser(); E.spec.fftSize = 512; E.spec.smoothingTimeConstant = 0.8; E.lim.connect(E.spec);
    E.recDest = ctx.createMediaStreamDestination(); E.lim.connect(E.recDest);
    E.xf = 0.5; E.xfCurve = "soft";
    ZS.decks = { A: new Deck("A"), B: new Deck("B") };
    ZS.applyXF();
    buildSamples();
    (function loop() { for (var i = 0; i < tick.length; i++) { try { tick[i](); } catch (e) {} } W.requestAnimationFrame(loop); })();
    return ctx;
  };
  ZS.ready = function () { return !!ctx; };
  ZS.applyXF = function () {
    var x = E.xf, a, b;
    if (E.xfCurve === "cut") { a = x < 0.92 ? 1 : (1 - x) / 0.08; b = x > 0.08 ? 1 : x / 0.08; }
    else { a = Math.cos(x * Math.PI / 2); b = Math.sin(x * Math.PI / 2); }
    ZS.decks.A.xf.gain.setTargetAtTime(a, ctx.currentTime, 0.01); ZS.decks.B.xf.gain.setTargetAtTime(b, ctx.currentTime, 0.01);
  };

  /* ---------- deck ---------- */
  function Deck(id) {
    var d = this; d.id = id; d.buf = null; d.name = ""; d.peaks = null; d.bpm = 0; d.grid = 0; d.conf = 0;
    d.playing = false; d.offset = 0; d.startedAt = 0; d.rate = 1; d.bend = 0; d.cue = 0; d.hot = [null, null, null, null]; d.loop = { on: false, start: 0, end: 0 }; d.src = null; d.previewing = false; d.key = "";
    d.trim = ctx.createGain(); d.lo = ctx.createBiquadFilter(); d.mid = ctx.createBiquadFilter(); d.hi = ctx.createBiquadFilter(); d.filt = ctx.createBiquadFilter();
    d.lo.type = "lowshelf"; d.lo.frequency.value = 250; d.mid.type = "peaking"; d.mid.frequency.value = 1000; d.mid.Q.value = 0.8; d.hi.type = "highshelf"; d.hi.frequency.value = 4000;
    d.filt.type = "lowpass"; d.filt.frequency.value = 22000; d.filt.Q.value = 0.9;
    d.vol = ctx.createGain(); d.xf = ctx.createGain(); d.send = ctx.createGain(); d.send.gain.value = 0; d.an = ctx.createAnalyser(); d.an.fftSize = 512;
    d.trim.connect(d.lo); d.lo.connect(d.mid); d.mid.connect(d.hi); d.hi.connect(d.filt); d.filt.connect(d.vol); d.vol.connect(d.an); d.vol.connect(d.xf); d.xf.connect(E.dry); d.xf.connect(d.send); d.send.connect(E.fxIn);
  }
  var DP = Deck.prototype;
  DP.dur = function () { return this.buf ? this.buf.duration : 0; };
  DP.effRate = function () { return this.rate * (1 + this.bend); };
  DP.pos = function () {
    if (!this.buf) return 0;
    if (!this.playing) return this.offset;
    var p = this.offset + (ctx.currentTime - this.startedAt) * this.effRate(), L = this.loop;
    if (L.on && L.end > L.start && p >= L.end) p = L.start + ((p - L.start) % (L.end - L.start));
    return clamp(p, 0, this.buf.duration);
  };
  DP.beatLen = function () { return this.bpm ? 60 / this.bpm : 0; };
  DP._stopSrc = function () { if (this.src) { var s = this.src; this.src = null; s.onended = null; try { s.stop(); } catch (e) {} try { s.disconnect(); } catch (e) {} } };
  DP._startSrc = function () {
    var d = this, s = ctx.createBufferSource(); s.buffer = d.buf; s.playbackRate.value = d.effRate();
    if (d.loop.on) { s.loop = true; s.loopStart = d.loop.start; s.loopEnd = d.loop.end; }
    s.connect(d.trim); d.src = s; d.startedAt = ctx.currentTime;
    s.onended = function () { if (d.src === s && d.playing && !d.loop.on) { d.src = null; d.playing = false; d.offset = d.buf.duration; d.previewing = false; } };
    s.start(0, clamp(d.offset, 0, Math.max(0, d.buf.duration - 0.001)));
  };
  DP.load = function (ab, name, key) {
    var d = this;
    var p = ab instanceof ArrayBuffer ? new Promise(function (ok, ko) { ctx.decodeAudioData(ab, ok, ko); }) : Promise.resolve(ab);
    return p.then(function (buf) {
      d._stopSrc(); d.playing = false; d.buf = buf; d.name = name || "Traccia"; d.key = key || "";
      d.offset = 0; d.cue = 0; d.loop = { on: false, start: 0, end: 0 }; d.hot = [null, null, null, null]; d.bpm = 0; d.grid = 0; d.rate = 1; d.bend = 0;
      d.peaks = peaksOf(buf, ZS.PPS);
      try { var sv = JSON.parse(W.localStorage.getItem("zs-hot:" + d.key) || "null"); if (sv && sv.hot) d.hot = sv.hot.slice(0, 4); } catch (e) {}
      if (d.onload) d.onload();
      return ZS.detectBPM(buf).then(function (r) { d.bpm = r.bpm; d.grid = r.first; d.conf = r.conf; if (d.onbpm) d.onbpm(); return d; });
    });
  };
  DP.saveHot = function () { if (this.key) { try { W.localStorage.setItem("zs-hot:" + this.key, JSON.stringify({ hot: this.hot })); } catch (e) {} } };
  DP.play = function () { if (!this.buf || this.playing) return; ZS.init(); if (this.offset >= this.buf.duration - 0.05) this.offset = 0; this.playing = true; this._startSrc(); };
  DP.pause = function () { if (!this.playing) return; var p = this.pos(); this._stopSrc(); this.playing = false; this.offset = p; };
  DP.toggle = function () { this.playing ? this.pause() : this.play(); };
  DP.seek = function (t) { if (!this.buf) return; this.offset = clamp(t, 0, this.buf.duration); if (this.playing) { this._stopSrc(); this._startSrc(); } };
  DP.setRate = function (r) { var p = this.pos(); this.rate = clamp(r, 0.5, 2); if (this.playing) { this.offset = p; this.startedAt = ctx.currentTime; if (this.src) this.src.playbackRate.setTargetAtTime(this.effRate(), ctx.currentTime, 0.005); } };
  DP.setBend = function (b) { var p = this.pos(); this.bend = b; if (this.playing) { this.offset = p; this.startedAt = ctx.currentTime; if (this.src) this.src.playbackRate.setTargetAtTime(this.effRate(), ctx.currentTime, 0.005); } };
  DP.cueDown = function () {
    if (!this.buf) return;
    if (this.playing) { this.pause(); this.seek(this.cue); }
    else if (Math.abs(this.offset - this.cue) < 0.03) { this.previewing = true; this.play(); }
    else this.cue = this.offset;
  };
  DP.cueUp = function () { if (this.previewing) { this.previewing = false; this.pause(); this.seek(this.cue); } };
  DP.hotDown = function (i, clear) {
    if (!this.buf) return;
    if (clear) { this.hot[i] = null; this.saveHot(); return; }
    if (this.hot[i] == null) { this.hot[i] = this.pos(); this.saveHot(); } else { this.seek(this.hot[i]); if (!this.playing) this.play(); }
  };
  function snapBeat(d, t) { if (!d.bpm) return t; var bl = 60 / d.bpm; return d.grid + Math.floor((t - d.grid) / bl + 0.02) * bl; }
  DP.loopBeats = function (n) {
    if (!this.buf) return;
    var d = this, L = d.loop;
    if (L.on && L.beats === n) { d.loopOff(); return; }
    var p = d.pos(), bl = d.beatLen() || 0.5, st = d.bpm ? Math.max(0, snapBeat(d, p)) : p;
    L.start = st; L.end = Math.min(d.buf.duration, st + n * bl); L.beats = n; L.on = true; d._applyLoop();
  };
  DP.loopIn = function () { if (!this.buf) return; this.loop.start = this.pos(); this.loop.end = 0; this.loop.on = false; this.loop.beats = 0; this.loop.pending = true; };
  DP.loopOut = function () { var L = this.loop; if (!this.buf || !L.pending) return; var e = this.pos(); if (e - L.start < 0.05) return; L.end = e; L.on = true; L.pending = false; L.beats = 0; this._applyLoop(); };
  DP.loopOff = function () { var p = this.pos(); this.loop.on = false; this.loop.pending = false; if (this.playing) { this.offset = p; this._stopSrc(); this._startSrc(); } };
  DP._applyLoop = function () {
    var d = this, L = d.loop, p = d.pos();
    if (d.playing) { if (p < L.start || p >= L.end) { d.offset = L.start; } else d.offset = p; d._stopSrc(); d._startSrc(); }
  };
  function phaseOf(d) { var bl = d.beatLen(); if (!bl) return null; var x = ((d.pos() - d.grid) / bl) % 1; return x < 0 ? x + 1 : x; }
  DP.sync = function (o) {
    if (!this.bpm || !o || !o.bpm) return false;
    var target = o.bpm * o.effRate(), r = target / this.bpm;
    while (r > 1.3) r /= 2; while (r < 0.7) r *= 2;
    this.bend = 0; this.setRate(clamp(r, 0.84, 1.16));
    if (this.playing && o.playing) { var a = phaseOf(this), b = phaseOf(o); if (a != null && b != null) { var diff = b - a; if (diff > 0.5) diff -= 1; if (diff < -0.5) diff += 1; this.seek(this.pos() + diff * this.beatLen()); } }
    return true;
  };

  /* ---------- campionatore (suoni generati qui, nessun campione esterno) ---------- */
  ZS.PADS = [
    { id: "kick", n: "Kick", key: "z" }, { id: "snare", n: "Snare", key: "x" }, { id: "clap", n: "Clap", key: "c" }, { id: "hat", n: "Hat", key: "v" },
    { id: "ohat", n: "Open hat", key: "a" }, { id: "bass", n: "Bass", key: "s" }, { id: "zap", n: "Zap", key: "d" }, { id: "stab", n: "Stab", key: "f" }];
  var samples = {};
  function render(sec, fn) {
    var sr = 44100, oc = new (W.OfflineAudioContext || W.webkitOfflineAudioContext)(1, Math.floor(sr * sec), sr); fn(oc);
    return oc.startRendering();
  }
  function noise(oc, sec) { var b = oc.createBuffer(1, Math.floor(oc.sampleRate * sec), oc.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; var s = oc.createBufferSource(); s.buffer = b; return s; }
  function env(oc, g, t0, a, dec, peak) { g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec); }
  function osc(oc, type, f, t0, t1) { var o = oc.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); return o; }
  function buildSamples() {
    var jobs = {
      kick: render(0.5, function (oc) { var o = osc(oc, "sine", 160, 0), g = oc.createGain(); o.frequency.exponentialRampToValueAtTime(42, 0.22); env(oc, g, 0, 0.002, 0.42, 1); o.connect(g); g.connect(oc.destination); o.start(); o.stop(0.5); }),
      snare: render(0.35, function (oc) { var n = noise(oc, 0.35), hp = oc.createBiquadFilter(), g = oc.createGain(), o = osc(oc, "triangle", 190, 0), og = oc.createGain(); hp.type = "highpass"; hp.frequency.value = 1800; env(oc, g, 0, 0.001, 0.2, 0.7); env(oc, og, 0, 0.001, 0.12, 0.5); n.connect(hp); hp.connect(g); g.connect(oc.destination); o.connect(og); og.connect(oc.destination); n.start(); o.start(); o.stop(0.3); }),
      clap: render(0.4, function (oc) { var n = noise(oc, 0.4), bp = oc.createBiquadFilter(), g = oc.createGain(); bp.type = "bandpass"; bp.frequency.value = 1500; bp.Q.value = 0.8; var t = [0, 0.012, 0.026], i; g.gain.setValueAtTime(0.0001, 0); for (i = 0; i < 3; i++) { g.gain.linearRampToValueAtTime(0.9, t[i] + 0.002); g.gain.exponentialRampToValueAtTime(0.1, t[i] + 0.011); } g.gain.linearRampToValueAtTime(0.8, 0.03); g.gain.exponentialRampToValueAtTime(0.0001, 0.3); n.connect(bp); bp.connect(g); g.connect(oc.destination); n.start(); }),
      hat: render(0.12, function (oc) { var n = noise(oc, 0.12), hp = oc.createBiquadFilter(), g = oc.createGain(); hp.type = "highpass"; hp.frequency.value = 7500; env(oc, g, 0, 0.001, 0.06, 0.5); n.connect(hp); hp.connect(g); g.connect(oc.destination); n.start(); }),
      ohat: render(0.6, function (oc) { var n = noise(oc, 0.6), hp = oc.createBiquadFilter(), g = oc.createGain(); hp.type = "highpass"; hp.frequency.value = 6500; env(oc, g, 0, 0.001, 0.36, 0.5); n.connect(hp); hp.connect(g); g.connect(oc.destination); n.start(); }),
      bass: render(0.7, function (oc) { var o = osc(oc, "sawtooth", 55, 0), lp = oc.createBiquadFilter(), g = oc.createGain(); lp.type = "lowpass"; lp.frequency.setValueAtTime(900, 0); lp.frequency.exponentialRampToValueAtTime(140, 0.4); lp.Q.value = 6; env(oc, g, 0, 0.005, 0.6, 0.8); o.connect(lp); lp.connect(g); g.connect(oc.destination); o.start(); o.stop(0.7); }),
      zap: render(0.4, function (oc) { var o = osc(oc, "square", 2400, 0), lp = oc.createBiquadFilter(), g = oc.createGain(); o.frequency.exponentialRampToValueAtTime(180, 0.3); lp.type = "lowpass"; lp.frequency.value = 5000; env(oc, g, 0, 0.001, 0.3, 0.35); o.connect(lp); lp.connect(g); g.connect(oc.destination); o.start(); o.stop(0.4); }),
      stab: render(0.9, function (oc) { var g = oc.createGain(), lp = oc.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(3200, 0); lp.frequency.exponentialRampToValueAtTime(500, 0.6); lp.Q.value = 3; env(oc, g, 0, 0.004, 0.75, 0.3); [220, 261.63, 329.63].forEach(function (f) { [-6, 6].forEach(function (c) { var o = osc(oc, "sawtooth", f, 0); o.detune.value = c; o.connect(lp); o.start(); o.stop(0.9); }); }); lp.connect(g); g.connect(oc.destination); })
    };
    Object.keys(jobs).forEach(function (k) { jobs[k].then(function (b) { samples[k] = b; }); });
    ZS.samplesReady = Promise.all(Object.keys(jobs).map(function (k) { return jobs[k]; }));
  }
  ZS.sampler = { vol: 0.9, pitch: 0, send: false };
  ZS.hit = function (i, vel) {
    ZS.init(); var p = ZS.PADS[i]; if (!p || !samples[p.id]) return;
    var s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = samples[p.id]; s.playbackRate.value = Math.pow(2, ZS.sampler.pitch / 12);
    g.gain.value = ZS.sampler.vol * (vel == null ? 1 : clamp(vel, 0.1, 1));
    s.connect(g); g.connect(E.dry); if (ZS.sampler.send) g.connect(E.fxIn);
    s.start(); s.onended = function () { try { g.disconnect(); } catch (e) {} };
  };
  // beat di prova: 8 battute sintetiche. Serve solo per provare i deck senza file: non è un brano.
  ZS.testBeat = function (bpm, variant) {
    ZS.init();
    return ZS.samplesReady.then(function () {
      var sr = 44100, bl = 60 / bpm, bars = 8, len = Math.floor(sr * bl * 4 * bars), b = ctx.createBuffer(2, len, sr), c, d;
      function put(name, t, gain, shift) { var s = samples[name], o = Math.floor(t * sr), i; if (!s) return; for (c = 0; c < 2; c++) { d = b.getChannelData(c); var sd = s.getChannelData(0); for (i = 0; i < sd.length && o + i < len; i++) d[o + i] += sd[i] * gain * (c ? 0.96 : 1); } }
      for (var bar = 0; bar < bars; bar++) for (var beat = 0; beat < 4; beat++) {
        var t = (bar * 4 + beat) * bl; put("kick", t, 0.9); put("hat", t + bl / 2, 0.55); if (variant) put("hat", t + bl / 4, 0.25), put("hat", t + 3 * bl / 4, 0.25);
        if (beat === 1 || beat === 3) put(variant ? "clap" : "snare", t, 0.6); if (beat === 0 && bar % 2 === 0) put("bass", t + bl / 2, 0.5);
        if (variant && beat === 2) put("bass", t + bl * 0.75, 0.45); if (bar % 4 === 3 && beat === 3) put("ohat", t + bl / 2, 0.4);
      }
      var pk = 0; for (c = 0; c < 2; c++) { d = b.getChannelData(c); for (var i = 0; i < len; i++) if (Math.abs(d[i]) > pk) pk = Math.abs(d[i]); } if (pk > 0.95) for (c = 0; c < 2; c++) { d = b.getChannelData(c); for (var j = 0; j < len; j++) d[j] *= 0.95 / pk; }
      return b;
    });
  };
  ZS.toneBuffer = function (hz, sec) { ZS.init(); var sr = 44100, b = ctx.createBuffer(2, Math.floor(sr * sec), sr); for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < d.length; i++) d[i] = 0.4 * Math.sin(2 * Math.PI * hz * i / sr); } return b; };

  /* ---------- FX ---------- */
  ZS.fx = {
    echoBeats: 0.75, echoOn: false,
    setEcho: function (wet, fb) { if (wet != null) E.echoWet.gain.setTargetAtTime(wet, ctx.currentTime, 0.02); if (fb != null) E.echoFb.gain.setTargetAtTime(Math.min(fb, 0.92), ctx.currentTime, 0.02); },
    setEchoTime: function (beats) { ZS.fx.echoBeats = beats; ZS.fx.syncEcho(); },
    syncEcho: function () { var bpm = ZS.masterBpm() || 120; E.echoDelay.delayTime.setTargetAtTime(clamp(60 / bpm * ZS.fx.echoBeats, 0.02, 3.9), ctx.currentTime, 0.03); },
    setReverb: function (wet) { E.revWet.gain.setTargetAtTime(wet, ctx.currentTime, 0.02); },
    setReverbSize: function (sec) { E.rev.buffer = mkReverbIR(sec); },
    sweep: 0, sweepRes: 0.7, auto: { on: false, beats: 8 },
    setSweep: function (s) {
      ZS.fx.sweep = s; var f = E.sweep;
      if (Math.abs(s) < 0.03) { f.type = "lowpass"; f.frequency.setTargetAtTime(22000, ctx.currentTime, 0.02); f.Q.setTargetAtTime(0.7, ctx.currentTime, 0.02); return; }
      var type = s < 0 ? "lowpass" : "highpass"; if (f.type !== type) f.type = type;
      f.frequency.setTargetAtTime(s < 0 ? 20000 * Math.pow(70 / 20000, -s) : 20 * Math.pow(9000 / 20, s), ctx.currentTime, 0.015);
      f.Q.setTargetAtTime(ZS.fx.sweepRes, ctx.currentTime, 0.02);
    }
  };
  ZS.masterBpm = function () { var A = ZS.decks && ZS.decks.A, B = ZS.decks && ZS.decks.B; if (A && A.playing && A.bpm) return A.bpm * A.effRate(); if (B && B.playing && B.bpm) return B.bpm * B.effRate(); if (A && A.bpm) return A.bpm * A.effRate(); if (B && B.bpm) return B.bpm * B.effRate(); return 0; };

  /* ---------- WebM: MediaRecorder non scrive la durata, così il player mostra «∞» e non si può cercare. La inseriamo noi nell'Info. ---------- */
  function vlen(b) { var l = 1, m = 0x80; while (l <= 8 && !(b & m)) { l++; m >>= 1; } return l; }
  ZS.fixWebmDuration = function (blob, seconds) {
    return blob.arrayBuffer().then(function (ab) {
      try {
        var u = new Uint8Array(ab), o = 0, i;
        function elem(at) { var il = vlen(u[at]), sl = vlen(u[at + il]), id = 0, sz = 0, i2, first = u[at + il] & (0xff >> sl), unk = first === (0xff >> sl); for (i2 = 0; i2 < il; i2++) id = id * 256 + u[at + i2]; sz = first; for (i2 = 1; i2 < sl; i2++) { sz = sz * 256 + u[at + il + i2]; if (u[at + il + i2] !== 0xff) unk = false; } return { id: id, il: il, sl: sl, size: sz, unk: unk, head: il + sl }; }
        var e = elem(0); if (e.id !== 0x1a45dfa3) return blob; o = e.head + e.size;
        var seg = elem(o); if (seg.id !== 0x18538067 || !seg.unk) return blob; o += seg.head;
        for (var n = 0; n < 40; n++) {
          var c = elem(o); if (c.id === 0x1f43b675) return blob;
          if (c.id === 0x1549a966) {
            var ps = o + c.head, pe = ps + c.size, q = ps;
            while (q < pe) { var ch = elem(q); if (ch.id === 0x4489) return blob; q += ch.head + ch.size; }
            var dur = new Uint8Array(11); dur[0] = 0x44; dur[1] = 0x89; dur[2] = 0x88; new DataView(dur.buffer).setFloat64(3, seconds * 1000, false);
            var ns = c.size + 11, sz = ns < 127 ? [0x80 | ns] : [0x40 | (ns >> 8), ns & 255];
            return new Blob([u.subarray(0, o + c.il), new Uint8Array(sz), u.subarray(ps, pe), dur, u.subarray(pe)], { type: blob.type });
          }
          if (c.unk) return blob; o += c.head + c.size;
        }
      } catch (er) { /* resta il file originale */ }
      return blob;
    });
  };

  /* ---------- registrazione del master ---------- */
  var MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  ZS.rec = {
    mr: null, chunks: [], t0: 0, last: null, mime: "",
    supported: function () { return !!(W.MediaRecorder); },
    start: function () {
      ZS.init(); var R = ZS.rec; if (R.mr) return;
      var mime = MIMES.filter(function (m) { return W.MediaRecorder.isTypeSupported && W.MediaRecorder.isTypeSupported(m); })[0] || "";
      R.mr = new W.MediaRecorder(E.recDest.stream, mime ? { mimeType: mime, audioBitsPerSecond: 192000 } : undefined); R.mime = R.mr.mimeType || mime; R.chunks = [];
      R.mr.ondataavailable = function (e) { if (e.data && e.data.size) R.chunks.push(e.data); };
      R.mr.start(500); R.t0 = Date.now();
    },
    stop: function () {
      var R = ZS.rec; return new Promise(function (ok) {
        if (!R.mr) return ok(null);
        var mr = R.mr; R.mr = null;
        mr.onstop = function () {
          var blob = new Blob(R.chunks, { type: R.mime || "audio/webm" }), sec = (Date.now() - R.t0) / 1000, fin = /webm/.test(blob.type) ? ZS.fixWebmDuration(blob, sec) : Promise.resolve(blob);
          fin.then(function (b2) { R.last = { blob: b2, mime: b2.type, seconds: sec, at: Date.now() }; ok(R.last); });
        };
        mr.stop();
      });
    },
    elapsed: function () { return ZS.rec.mr ? (Date.now() - ZS.rec.t0) / 1000 : 0; },
    toWav: function (blob) { ZS.init(); return blob.arrayBuffer().then(function (ab) { return new Promise(function (ok, ko) { ctx.decodeAudioData(ab, ok, ko); }); }).then(ZS.encodeWav); },
    // clip video (canvas + master): file locale WebM
    video: { mr: null, chunks: [] },
    startVideo: function (canvas) {
      ZS.init(); var V = ZS.rec.video; if (V.mr || !canvas.captureStream) return false;
      var tracks = canvas.captureStream(30).getVideoTracks().concat(E.recDest.stream.getAudioTracks()), ms = new W.MediaStream(tracks);
      var mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].filter(function (m) { return W.MediaRecorder.isTypeSupported(m); })[0] || "";
      V.chunks = []; V.mr = new W.MediaRecorder(ms, mime ? { mimeType: mime, videoBitsPerSecond: 2500000 } : undefined);
      V.mr.ondataavailable = function (e) { if (e.data && e.data.size) V.chunks.push(e.data); }; V.mr.start(500); V.t0 = Date.now(); return true;
    },
    stopVideo: function () { var V = ZS.rec.video; return new Promise(function (ok) { if (!V.mr) return ok(null); var mr = V.mr; V.mr = null; mr.onstop = function () { var vb = new Blob(V.chunks, { type: "video/webm" }), t1 = (Date.now() - V.t0) / 1000; ZS.fixWebmDuration(vb, t1).then(ok); }; mr.stop(); }); }
  };
})(window);
