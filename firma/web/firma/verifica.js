/* Logica della pagina /verifica/. © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var brand = window.ZDOSFirma ? window.ZDOSFirma.brand : "ZDOS";
  $("brandName").textContent = brand; $("brandLink").textContent = brand === "OurVelvet" ? "OURVELVET" : "ZDOS";
  $("pfx").textContent = brand + " Firma v1";
  document.title = "Verifica firma · " + (brand === "OurVelvet" ? "OurVelvet" : "ZDOS");

  function dl(rows) {
    var d = document.createElement("dl");
    rows.forEach(function (r) { var t = document.createElement("dt"), v = document.createElement("dd"); t.textContent = r[0]; v.textContent = r[1]; d.appendChild(t); d.appendChild(v); });
    return d;
  }
  function showRes(valid, title, rows, extra) {
    var r = $("res"); r.textContent = ""; r.className = "fm-res on " + (valid ? "v" : "n");
    var s = document.createElement("strong"); s.textContent = title; r.appendChild(s);
    if (extra) { var p = document.createElement("p"); p.className = "fm-small"; p.textContent = extra; r.appendChild(p); }
    if (rows && rows.length) r.appendChild(dl(rows));
  }
  $("chkForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var btn = $("chkBtn"); btn.disabled = true;
    fetch("/api/firma/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: $("msg").value, signature: $("sig").value.trim(), address: $("adr").value.trim() }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) return showRes(false, "Dati non validi", null, j.errore || "Controlla i campi.");
        var rows = [["Indirizzo", j.address], ["Formato", j.formato], ["Prefisso ZDOS", j.prefisso || "nessuno"]];
        if (j.dettagli) { var d = j.dettagli; rows.push(["Dominio", d.domain + (d.dominioZdos ? "" : " (non è un dominio ZDOS)")], ["Indirizzo nel messaggio", d.address + (d.indirizzoCoerente ? "" : " ≠ indirizzo indicato")], ["Emesso", d.issuedAt], ["Scade", d.expirationTime + (d.scaduto ? " (scaduto)" : "")], ["Nonce", d.nonce]); }
        showRes(j.valid, j.valid ? "Firma valida" : "Firma non valida", rows, j.valid ? j.nota : "La firma non corrisponde a questo messaggio e a questo indirizzo.");
      })
      .catch(function () { showRes(false, "Errore di rete", null, "Riprova tra poco."); })
      .then(function () { btn.disabled = false; });
  });

  function showSession(s) {
    if (s && s.autenticato) { $("sessBox").hidden = false; $("sessDom").textContent = s.domain + " · " + s.address.slice(0, 4) + "…" + s.address.slice(-4); }
    else $("sessBox").hidden = true;
  }
  fetch("/api/firma/session", { cache: "no-store" }).then(function (r) { return r.json(); }).then(showSession).catch(function () {});
  document.addEventListener("zdos-firma-login", function (e) { if (!e.detail.error) showSession({ autenticato: true, domain: e.detail.domain, address: e.detail.address }); });
  $("logoutBtn").addEventListener("click", function () { fetch("/api/firma/logout", { method: "POST" }).then(function () { showSession(null); }); });

  var host = location.hostname.replace(/^www\./, "");
  var pre = brand + " Firma v1";
  $("example").textContent = host + " wants you to sign in with your Solana account:\n<indirizzo del tuo wallet>\n\n" + pre + " - Accesso con wallet. Questa firma non e una transazione: non muove fondi e non autorizza alcuna spesa.\n\nURI: https://" + host + "/\nVersion: 1\nChain ID: mainnet\nNonce: <32 caratteri casuali, monouso>\nIssued At: <data e ora UTC>\nExpiration Time: <data e ora + 5 minuti>";
})();
