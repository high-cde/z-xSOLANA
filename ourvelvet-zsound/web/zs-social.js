/* Z-Sound · collegamento al profilo creator (zdos-social) e pannello AI. © 2026 ZDOS1.3 · Licenza ZSEL proprietaria.
   Identità = firma OurVelvet (cookie zdos_firma). Pubblicazione = post «musica» con traccia + copertina (una tua foto). */
(function (W) {
  "use strict";
  var ZS = W.ZS, D = W.document, h = ZS.h, $ = ZS.$;
  var ME = { addr: null, prof: null, tracks: [], foto: [] }, src = null, cover = { id: null, file: null };
  function api(method, path, body, raw) {
    var o = { method: method, credentials: "same-origin", cache: "no-store", headers: { "X-OV-Social": "1" } };
    if (raw) { o.body = raw; o.headers["Content-Type"] = raw.type || "application/octet-stream"; } else if (body !== undefined) { o.body = JSON.stringify(body); o.headers["Content-Type"] = "application/json"; }
    return fetch("/api/social" + path, o).then(function (r) { return r.json().catch(function () { return { ok: false, errore: "Risposta non valida (" + r.status + ")" }; }).then(function (j) { j.__s = r.status; return j; }); });
  }
  function dl(blob, name) { var a = h("a", "", null, { href: URL.createObjectURL(blob), download: name }); D.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  function stamp() { var d = new Date(); function p(n) { return (n < 10 ? "0" : "") + n; } return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()); }
  function ext(m) { return /mp4/.test(m) ? "m4a" : /ogg/.test(m) ? "ogg" : /wav/.test(m) ? "wav" : "webm"; }

  /* ---------- registrazione ---------- */
  function buildRec() {
    var p = $("#recp"); p.appendChild(h("h2", "ph", "Registra il mix"));
    p.appendChild(h("p", "muted sm", "Registra tutto quello che senti dal master (deck, effetti, pad)."));
    var row = h("div", "row rec-row"), rb = h("button", "pad-btn rec", "● REC", { type: "button", id: "recBtn" }), tm = h("span", "rec-t", "00:00.0", { id: "recTime" });
    row.appendChild(rb); row.appendChild(tm); p.appendChild(row);
    var out = h("div", "rec-out", null, { id: "recOut", hidden: "" }); p.appendChild(out);
    var vr = h("div", "row small"), vb = h("button", "pad-btn ghost", "● Clip video", { type: "button", title: "Registra lo spettro animato + il mix in un file WebM (solo sul tuo dispositivo)" }); vr.appendChild(vb); p.appendChild(vr);
    var vnote = h("p", "fine", ""); p.appendChild(vnote);
    if (!ZS.rec.supported()) { rb.disabled = true; vb.disabled = true; p.appendChild(h("p", "guard bad", "Questo browser non supporta MediaRecorder: usa Chrome, Edge o Firefox.")); return; }
    rb.addEventListener("click", function () {
      ZS.ensure();
      if (!ZS.rec.mr) { ZS.rec.start(); rb.textContent = "■ STOP"; rb.classList.add("on"); out.hidden = true; return; }
      rb.disabled = true;
      ZS.rec.stop().then(function (r) { rb.disabled = false; rb.textContent = "● REC"; rb.classList.remove("on"); showRec(r); });
    });
    var vrec = false;
    vb.addEventListener("click", function () {
      ZS.ensure();
      if (!vrec) { if (ZS.rec.startVideo(ZS.vizCanvas)) { vrec = true; vb.textContent = "■ Ferma clip"; vb.classList.add("on"); vnote.textContent = ""; } else vnote.textContent = "Clip video non supportato da questo browser."; return; }
      vrec = false; vb.textContent = "● Clip video"; vb.classList.remove("on");
      ZS.rec.stopVideo().then(function (b) { if (!b) return; vnote.textContent = "Clip pronto (" + Math.round(b.size / 1024) + " KB)."; dl(b, "z-sound-clip-" + stamp() + ".webm"); });
    });
    function showRec(r) {
      out.hidden = false; out.textContent = ""; if (!r || !r.blob.size) { out.appendChild(h("p", "guard bad", "Registrazione vuota.")); return; }
      var au = h("audio", "", null, { controls: "", src: URL.createObjectURL(r.blob) }); out.appendChild(au);
      out.appendChild(h("p", "fine", Math.round(r.seconds) + " s · " + (r.blob.size / 1024 / 1024).toFixed(2) + " MB · " + r.mime));
      var b = h("div", "row small");
      var b1 = h("button", "pad-btn", "Scarica " + ext(r.mime).toUpperCase(), { type: "button" }); b1.addEventListener("click", function () { dl(r.blob, "z-sound-mix-" + stamp() + "." + ext(r.mime)); });
      var b2 = h("button", "pad-btn", "Scarica WAV", { type: "button" }); b2.addEventListener("click", function () { b2.disabled = true; ZS.rec.toWav(r.blob).then(function (w) { b2.disabled = false; dl(w, "z-sound-mix-" + stamp() + ".wav"); }).catch(function () { b2.disabled = false; ZS.toast("Conversione WAV non riuscita"); }); });
      var b3 = h("button", "pad-btn primary", "Usa per pubblicare", { type: "button" }); b3.addEventListener("click", function () { setSrc({ blob: r.blob, mime: r.mime, name: "Mix " + stamp(), dur: r.seconds }); location.hash = "#pubblica"; $("#studio").setAttribute("data-tab", "pub"); });
      b.appendChild(b1); b.appendChild(b2); b.appendChild(b3); out.appendChild(b);
      ZS.lastRecInfo = r;
    }
  }

  /* ---------- pubblicazione ---------- */
  function setSrc(s) {
    src = s; var i = $("#pubSrc"); i.textContent = s ? "Sorgente: " + s.name + " · " + (s.blob.size / 1024 / 1024).toFixed(2) + " MB" + (s.dur ? " · " + Math.round(s.dur) + " s" : "") : "Nessuna traccia selezionata: registra un mix oppure scegli un file tuo.";
    if (s && !$("#pubTitle").value) $("#pubTitle").value = s.name.slice(0, 60);
    upd();
  }
  function upd() {
    var ok = !!(ME.addr && ME.prof) && !!src && $("#pubRights").checked;
    $("#pubGo").disabled = !ok;
    $("#pubHint").textContent = !ME.addr ? "Accedi con OurVelvet per pubblicare." : !ME.prof ? "Crea prima il tuo profilo creator (con dichiarazione 18+ e consenso)." : !src ? "Scegli la traccia da pubblicare." : !$("#pubRights").checked ? "Conferma i diritti sulla traccia." : "";
  }
  function buildPub() {
    var p = $("#pubp"); p.appendChild(h("h2", "ph", "Pubblica nel tuo profilo"));
    p.appendChild(h("p", "muted sm", "La traccia diventa un post «musica» del tuo profilo creator, insieme a foto e post. Passa dalla revisione dello staff, come ogni contenuto."));
    var box = h("div", "glass boxp", null, { id: "loginBox", "data-firma-box": "" });
    box.appendChild(h("p", "muted", "Per pubblicare serve la firma OurVelvet con il tuo wallet (nessun costo, nessuna transazione)."));
    var r = h("div", "row"); r.appendChild(h("button", "pad-btn primary", "Accedi con OurVelvet", { type: "button", "data-zdos-firma": "" })); box.appendChild(r);
    box.appendChild(h("div", "wallets", null, { "data-firma-wallets": "" }));
    var lb = h("label", "check"); lb.appendChild(h("input", "", null, { type: "checkbox", "data-firma-pubblico": "" })); lb.appendChild(h("span", "", " Mostra il badge «wallet verificato» sul mio profilo (facoltativo).")); box.appendChild(lb);
    box.appendChild(h("p", "fm-status", "", { "data-firma-status": "", role: "status", "aria-live": "polite" })); p.appendChild(box);
    var form = h("div", "pubform", null, { id: "pubForm" });
    form.appendChild(h("p", "src", "", { id: "pubSrc" }));
    var sr = h("div", "row small"), fb = h("button", "pad-btn ghost", "Scegli un file audio", { type: "button" }), fi = h("input", "", null, { type: "file", accept: "audio/*,.wav,.mp3,.m4a,.ogg,.webm", hidden: "" });
    sr.appendChild(fb); sr.appendChild(fi); form.appendChild(sr);
    fb.addEventListener("click", function () { fi.click(); });
    fi.addEventListener("change", function () { var f = fi.files[0]; if (!f) return; if (f.size > 25 * 1024 * 1024) { ZS.toast("File troppo grande: massimo 25 MB"); return; } var t = f.type || ""; if (t.indexOf("audio/") !== 0) { ZS.toast("Serve un file audio"); return; } setSrc({ blob: f, mime: t, name: f.name.replace(/\.[^.]+$/, ""), dur: 0 }); fi.value = ""; });
    form.appendChild(h("label", "lbl", "Titolo (max 60)", { for: "pubTitle" })); form.appendChild(h("input", "txt", null, { id: "pubTitle", maxlength: "60", placeholder: "Titolo della traccia" }));
    form.appendChild(h("label", "lbl", "Testo del post (facoltativo)", { for: "pubText" })); form.appendChild(h("textarea", "txt", null, { id: "pubText", maxlength: "500", rows: "2", placeholder: "Racconta il brano…" }));
    form.appendChild(h("span", "lbl", "Copertina (una tua foto)")); var cv = h("div", "covers", null, { id: "covers" }); form.appendChild(cv);
    var cr = h("div", "row small"), cb = h("button", "pad-btn ghost", "Carica una nuova foto", { type: "button" }), ci = h("input", "", null, { type: "file", accept: "image/jpeg,image/png,image/webp", hidden: "" }); cr.appendChild(cb); cr.appendChild(ci); form.appendChild(cr);
    cb.addEventListener("click", function () { ci.click(); });
    ci.addEventListener("change", function () { var f = ci.files[0]; if (!f) return; if (["image/jpeg", "image/png", "image/webp"].indexOf(f.type) < 0 || f.size > 5 * 1024 * 1024) { ZS.toast("Foto JPG, PNG o WebP fino a 5 MB"); return; } cover = { id: null, file: f }; drawCovers(); });
    var rl = h("label", "check"); rl.appendChild(h("input", "", null, { type: "checkbox", id: "pubRights" }));
    rl.appendChild(h("span", "", " Confermo che la traccia è mia o che ho i diritti per pubblicarla, che non contiene minori né contenuti senza consenso, e accetto le regole 18+ di OurVelvet (safeword ROSSO)."));
    form.appendChild(rl);
    var go = h("button", "pad-btn primary big", "Pubblica", { type: "button", id: "pubGo", disabled: "" }); form.appendChild(go);
    form.appendChild(h("p", "guard", "", { id: "pubMsg", role: "status" })); form.appendChild(h("p", "fine", "", { id: "pubHint" }));
    p.appendChild(form);
    $("#pubRights").addEventListener("change", upd);
    go.addEventListener("click", publish);
    p.appendChild(h("h3", "", "Le mie tracce")); p.appendChild(h("div", "tracks", null, { id: "tracks" }));
    setSrc(null);
  }
  function drawCovers() {
    var cv = $("#covers"); cv.textContent = "";
    function item(label, on, fn, url) { var b = h("button", "cov" + (on ? " on" : ""), null, { type: "button", "aria-label": label, "aria-pressed": on ? "true" : "false" }); if (url) { var im = h("img", "", null, { src: url, alt: "" }); b.appendChild(im); } else b.appendChild(h("span", "", label)); b.addEventListener("click", fn); cv.appendChild(b); }
    item("Nessuna", !cover.id && !cover.file, function () { cover = { id: null, file: null }; drawCovers(); });
    if (cover.file) item("Nuova foto", true, function () {}, URL.createObjectURL(cover.file));
    ME.foto.forEach(function (f) { item("Foto del profilo", cover.id === f.id, function () { cover = { id: f.id, file: null }; drawCovers(); }, f.url); });
  }
  function msg(t, cls) { var m = $("#pubMsg"); m.textContent = t; m.className = "guard " + (cls || ""); }
  function publish() {
    var go = $("#pubGo"); if (go.disabled) return; go.disabled = true; msg("Carico la traccia…");
    var title = $("#pubTitle").value.trim().slice(0, 60), text = $("#pubText").value.trim().slice(0, 500), audioId, coverId = cover.id;
    var q = "?titolo=" + encodeURIComponent(title) + (src.dur ? "&dur=" + Math.round(src.dur) : "");
    api("POST", "/audio" + q, undefined, src.blob.type ? src.blob : new Blob([src.blob], { type: src.mime })).then(function (a) {
      if (!a.ok) throw new Error(a.errore || "Caricamento non riuscito"); audioId = a.media;
      if (cover.file) { msg("Carico la copertina…"); return api("POST", "/media", undefined, cover.file).then(function (m) { if (!m.ok) throw new Error(m.errore || "Copertina non caricata"); coverId = m.media; }); }
    }).then(function () { return api("POST", "/posts", { text: text, audio: audioId, media: coverId || null }); }).then(function (x) {
      if (!x.ok) throw new Error(x.errore || "Pubblicazione non riuscita");
      msg(x.stato === "in_revisione" ? "Inviato! La traccia passa dalla revisione dello staff e poi compare nel tuo profilo e nel feed." : "Pubblicato nel tuo profilo!", "ok");
      src = null; setSrc(null); $("#pubTitle").value = ""; $("#pubText").value = ""; $("#pubRights").checked = false; cover = { id: null, file: null }; loadTracks();
    }).catch(function (e) { msg(e.message, "bad"); }).then(upd);
  }
  var ST = { in_revisione: "in revisione", approvato: "pubblica", rifiutato: "rifiutata" };
  function loadTracks() {
    if (!(ME.addr && ME.prof)) { $("#tracks").textContent = ""; ME.foto = []; drawCovers(); return Promise.resolve(); }
    return api("GET", "/me/tracks").then(function (j) {
      if (!j.ok) return; ME.tracks = j.tracce; ME.foto = j.foto; drawCovers();
      var box = $("#tracks"); box.textContent = ""; if (!j.tracce.length) box.appendChild(h("p", "muted sm", "Nessuna traccia ancora. Le tracce non usate in un post vengono rimosse dopo 24 ore."));
      j.tracce.forEach(function (t) {
        var it = h("div", "trk"), nm = h("div", "trk-n"); nm.appendChild(h("b", "", t.titolo)); nm.appendChild(h("small", "", (ST[t.stato] || t.stato) + (t.durata ? " · " + Math.round(t.durata) + " s" : "") + (t.inPost ? " · in un post" : " · non ancora in un post")));
        it.appendChild(nm); it.appendChild(h("audio", "", null, { controls: "", preload: "none", src: t.url }));
        var r = h("div", "row small");
        ["A", "B"].forEach(function (id) { var b = h("button", "pad-btn", "Deck " + id, { type: "button" }); b.addEventListener("click", function () { ZS.ensure(); fetch(t.url, { credentials: "same-origin" }).then(function (r) { return r.arrayBuffer(); }).then(function (ab) { return ZS.loadBuffer(id, ab, t.titolo, "trk" + t.id); }).then(function () { ZS.toast("Caricata sul deck " + id); }).catch(function () { ZS.toast("Traccia non leggibile dal browser"); }); }); r.appendChild(b); });
        if (!t.inPost && t.stato !== "rifiutato") { var pb = h("button", "pad-btn primary", "Pubblica", { type: "button" }); pb.addEventListener("click", function () { fetch(t.url, { credentials: "same-origin" }).then(function (r) { return r.blob(); }).then(function (bl) { setSrc({ blob: bl, mime: t.tipo, name: t.titolo, dur: t.durata || 0, existing: t.id }); }); }); r.appendChild(pb); }
        if (!t.inPost) { var del = h("button", "pad-btn ghost", "Elimina", { type: "button" }); del.addEventListener("click", function () { if (!confirm("Eliminare la traccia?")) return; api("DELETE", "/audio/" + t.id).then(function (x) { ZS.toast(x.ok ? "Traccia eliminata" : x.errore); loadTracks(); }); }); r.appendChild(del); }
        it.appendChild(r); box.appendChild(it);
      });
    });
  }
  function setSession(j) {
    ME.addr = j && j.autenticato ? j.address : null; ME.prof = j && j.profilo ? j.profilo : null;
    var chip = $("#meChip"), ll = $("#loginLink");
    $("#loginBox").hidden = !!ME.addr; $("#pubForm").hidden = !(ME.addr && ME.prof);
    if (ME.addr) { chip.hidden = false; chip.textContent = ME.prof ? "@" + ME.prof.handle : ME.addr.slice(0, 4) + "…" + ME.addr.slice(-4); ll.hidden = true; } else { chip.hidden = true; ll.hidden = false; }
    var np = $("#noProf"); np.hidden = !(ME.addr && !ME.prof);
    upd(); loadTracks();
  }
  function refresh() { return api("GET", "/me").then(setSession).catch(function () { setSession(null); }); }

  /* ---------- AI ---------- */
  function buildAi() {
    var p = $("#aip"); p.appendChild(h("h2", "ph", "Genera con AI"));
    var st = h("div", "ai-st", "Controllo lo stato…", { id: "aiSt" }); p.appendChild(st);
    p.appendChild(h("label", "lbl", "Descrivi la musica (solo strumentale)", { for: "aiPrompt" }));
    p.appendChild(h("textarea", "txt", null, { id: "aiPrompt", rows: "2", maxlength: "300", placeholder: "es. techno scura 124 BPM, synth caldi, atmosfera notturna", disabled: "" }));
    var r = h("div", "row small"); var sel = h("select", "txt sm", null, { id: "aiDur", disabled: "", "aria-label": "Durata" }); [15, 30, 60].forEach(function (s) { sel.appendChild(h("option", "", s + " s", { value: s })); }); sel.value = "30";
    var go = h("button", "pad-btn primary", "Genera", { type: "button", id: "aiGo", disabled: "" }); r.appendChild(sel); r.appendChild(go); p.appendChild(r);
    p.appendChild(h("p", "guard", "", { id: "aiMsg" })); p.appendChild(h("p", "fine", "Niente è finto: finché non c'è un fornitore approvato, questo pannello resta spento. Non indicare nomi di artisti o testi protetti."));
    api("GET", "/zsound/ai/status").then(function (j) {
      var on = j && j.stato === "attivo"; st.className = "ai-st " + (on ? "on" : "off"); st.textContent = on ? "Attivo · " + j.fornitore + " · fino a " + j.maxSecondi + " s" : "In attivazione";
      if (!on) p.insertBefore(h("p", "muted sm", (j && j.messaggio) || "In attivazione."), $("#aiPrompt").previousSibling);
      ["aiPrompt", "aiDur", "aiGo"].forEach(function (id) { $("#" + id).disabled = !on; });
      if (on) { sel.textContent = ""; [15, 30, 60].filter(function (s) { return s <= j.maxSecondi; }).concat(j.maxSecondi > 60 ? [] : []).forEach(function (s) { sel.appendChild(h("option", "", s + " s", { value: s })); }); }
    }).catch(function () { st.textContent = "Stato non disponibile"; });
    go.addEventListener("click", function () {
      var m = $("#aiMsg"); if (!(ME.addr && ME.prof)) { m.textContent = "Accedi e crea il profilo creator per generare."; m.className = "guard bad"; return; }
      go.disabled = true; m.textContent = "Generazione in corso… può richiedere fino a un minuto."; m.className = "guard";
      fetch("/api/social/zsound/ai/generate", { method: "POST", credentials: "same-origin", headers: { "X-OV-Social": "1", "Content-Type": "application/json" }, body: JSON.stringify({ prompt: $("#aiPrompt").value, seconds: +$("#aiDur").value }) }).then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.errore || "Errore"); }); return r.arrayBuffer();
      }).then(function (ab) { return ZS.loadBuffer("B", ab, "AI · " + $("#aiPrompt").value.slice(0, 40), "ai" + Date.now()); }).then(function () { m.textContent = "Fatto: la traccia è sul deck B. Mixala e registrala."; m.className = "guard ok"; })
        .catch(function (e) { m.textContent = e.message; m.className = "guard bad"; }).then(function () { go.disabled = false; });
    });
  }

  function init() {
    buildRec(); buildPub(); buildAi(); drawCovers();
    D.addEventListener("zdos-firma-login", function (e) { if (e.detail && e.detail.ok) { refresh(); ZS.toast("Accesso eseguito"); } });
    refresh();
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", init); else init();
})(window);
