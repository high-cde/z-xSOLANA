/* Firma ZDOS / OurVelvet v1 — accesso con wallet (Wallet Standard + provider iniettato).
   Usa signIn (SIWS) se il wallet lo offre, altrimenti connect + signMessage(Uint8Array, "utf8").
   Il messaggio SIWS è ASCII stampabile: Phantom su mobile rifiuta lo statement con caratteri non ASCII.
   Non chiede e non costruisce mai transazioni. Nessuna chiave lascia il wallet. © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var BRAND = document.documentElement.getAttribute("data-brand") || "ZDOS";
  var API = "/api/firma/";

  /* ---- registro Wallet Standard (protocollo app-ready / register-wallet) ---- */
  var wallets = [], listeners = [];
  function isSolana(w) {
    var f = w.features || {};
    if (!f["standard:connect"]) return false;
    if (!f["solana:signIn"] && !f["solana:signMessage"]) return false;
    var ch = w.chains || [];
    return ch.length === 0 || ch.some(function (c) { return String(c).indexOf("solana:") === 0; });
  }
  function register() {
    for (var i = 0; i < arguments.length; i++) {
      var w = arguments[i];
      if (w && wallets.indexOf(w) < 0 && isSolana(w)) wallets.push(w);
    }
    listeners.forEach(function (fn) { try { fn(wallets.slice()); } catch (e) {} });
  }
  var api = Object.freeze({ register: register });
  try { window.addEventListener("wallet-standard:register-wallet", function (ev) { try { ev.detail(api); } catch (e) {} }); } catch (e) {}
  try { window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api })); } catch (e) {}

  /* ---- provider iniettato (Phantom in-app / window.solana), se Wallet Standard non lo ha già registrato ---- */
  function injectedProvider() {
    var p = (window.phantom && window.phantom.solana) || window.solana;
    if (!p) return null;
    if (p.isPhantom || p.isSolflare || typeof p.signMessage === "function" || typeof p.signIn === "function") return p;
    return null;
  }
  function injectedName(p) {
    if (p.isPhantom) return "Phantom";
    if (p.isSolflare) return "Solflare";
    return "Wallet Solana";
  }
  function alreadyHave(name) {
    return wallets.some(function (w) { return w.name === name; });
  }
  function asU8(x) {
    if (x instanceof Uint8Array) return x;
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (Array.isArray(x)) return new Uint8Array(x);
    throw new Error("formato della firma non valido");
  }
  function enc(s) { return new TextEncoder().encode(s); }
  function dec(u) { return new TextDecoder().decode(asU8(u)); }
  function pickSig(r) { return asU8(r && r.signature != null ? r.signature : r); }
  function pubstr(pk) {
    if (!pk) return null;
    if (typeof pk === "string") return pk;
    if (typeof pk.toBase58 === "function") return pk.toBase58();
    if (typeof pk.toString === "function") return pk.toString();
    return String(pk);
  }
  function addrOf(r, p) {
    if (r && r.account && r.account.address) return r.account.address;
    if (r && r.address) return r.address;
    if (r && r.publicKey) return pubstr(r.publicKey);
    if (p && p.publicKey) return pubstr(p.publicKey);
    throw new Error("nessun account nel wallet");
  }
  function isReject(e) {
    var m = (e && e.message) || String(e);
    var c = e && e.code;
    return c === 4001 || /reject|denied|cancel|rifiut|User rejected/i.test(m);
  }

  function wrapInjected(p) {
    var name = injectedName(p);
    var feats = {
      "standard:connect": {
        connect: function () {
          return Promise.resolve(p.connect()).then(function (r) {
            var address = addrOf(r, p);
            var acc = { address: address };
            return { accounts: [acc] };
          });
        }
      }
    };
    if (typeof p.signMessage === "function") {
      feats["solana:signMessage"] = {
        signMessage: function (opts) {
          var bytes = opts.message;
          if (typeof bytes === "string") bytes = enc(bytes);
          else bytes = asU8(bytes);
          return Promise.resolve(p.signMessage(bytes, "utf8")).then(function (r) {
            var signed = (r && r.signedMessage) ? asU8(r.signedMessage) : bytes;
            return { signature: pickSig(r), signedMessage: signed, account: opts.account };
          });
        }
      };
    }
    if (typeof p.signIn === "function") {
      feats["solana:signIn"] = {
        signIn: function (input) {
          return Promise.resolve(p.signIn(input)).then(function (r) {
            var o = Array.isArray(r) ? r[0] : r;
            return {
              account: { address: addrOf(o, p) },
              signature: pickSig(o),
              signedMessage: o.signedMessage ? asU8(o.signedMessage) : enc(buildMessage(input, addrOf(o, p)))
            };
          });
        }
      };
    }
    return { name: name, features: feats, accounts: [], chains: ["solana:mainnet"] };
  }
  function ensureInjected() {
    var p = injectedProvider();
    if (!p) return;
    var name = injectedName(p);
    if (alreadyHave(name)) return;
    register(wrapInjected(p));
  }
  ensureInjected();
  if (document.readyState === "complete") ensureInjected();
  else window.addEventListener("load", ensureInjected);
  setTimeout(ensureInjected, 300);
  setTimeout(ensureInjected, 1500);

  /* ---- util ---- */
  function b64(u8) { u8 = asU8(u8); var s = ""; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function fetchJson(url, opts) {
    return fetch(url, opts).then(function (r) { return r.json().catch(function () { return { ok: false, errore: "risposta non valida" }; }); });
  }
  function buildMessage(f, address) {
    return f.domain + " wants you to sign in with your Solana account:\n" + address + "\n\n" + f.statement + "\n\n" +
      "URI: " + f.uri + "\nVersion: " + f.version + "\nChain ID: " + f.chainId + "\nNonce: " + f.nonce + "\n" +
      "Issued At: " + f.issuedAt + "\nExpiration Time: " + f.expirationTime;
  }

  function signMessageFeat(feats, acc, message) {
    var bytes = enc(message);
    return feats["solana:signMessage"].signMessage({ account: acc, message: bytes }).then(function (out) {
      var o = Array.isArray(out) ? out[0] : out;
      return { message: dec(o.signedMessage || bytes), signature: pickSig(o), address: acc.address };
    });
  }

  function signInFeat(feats, input) {
    return feats["solana:signIn"].signIn(input).then(function (out) {
      var o = Array.isArray(out) ? out[0] : out;
      var address = o.account && o.account.address ? o.account.address : addrOf(o);
      return { message: dec(o.signedMessage), signature: pickSig(o), address: address };
    });
  }

  /* ---- login ---- */
  function login(wallet, opts) {
    opts = opts || {};
    var say = opts.onStatus || function () {};
    return fetchJson(API + "nonce", { cache: "no-store" }).then(function (n) {
      if (!n.ok) throw new Error(n.errore || "nonce non disponibile");
      var input = n.signIn, feats = wallet.features;
      say("Conferma la firma nel wallet…");
      function afterConnect() {
        return feats["standard:connect"].connect().then(function (r) {
          var acc = (r.accounts && r.accounts[0]) || wallet.accounts[0];
          if (!acc) throw new Error("nessun account nel wallet");
          var message = buildMessage(input, acc.address);
          if (input && !input.address) input.address = acc.address;
          if (!feats["solana:signMessage"]) throw new Error("il wallet non supporta signMessage");
          return signMessageFeat(feats, acc, message);
        });
      }
      if (feats["solana:signIn"]) {
        return signInFeat(feats, input).catch(function (e) {
          if (isReject(e)) throw e;
          /* signIn rifiutato da Phantom (invalid formatting / metodo assente) → signMessage(Uint8Array, "utf8"). */
          return afterConnect();
        });
      }
      return afterConnect();
    }).then(function (s) {
      say("Verifica sul server…");
      return fetchJson(API + "verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: s.message, signature: b64(s.signature), address: s.address, badgePubblico: !!opts.badgePubblico })
      });
    }).then(function (v) { if (!v.ok) throw new Error(v.errore || "verifica fallita"); return v; });
  }

  /* ---- pulsante di accesso: <button data-zdos-firma> ---- */
  function mount(box, cb) {
    var btn = box.querySelector("[data-zdos-firma]");
    var list = box.querySelector("[data-firma-wallets]");
    var status = box.querySelector("[data-firma-status]");
    var pub = box.querySelector("[data-firma-pubblico]");
    function setStatus(t, cls) { if (!status) return; status.textContent = t; status.className = "fm-status" + (cls ? " " + cls : ""); }
    btn.textContent = "Accedi con " + BRAND;
    function renderList(ws) {
      if (!list) return;
      list.textContent = "";
      if (!ws.length) { list.textContent = "Nessun wallet compatibile rilevato. Servono un wallet Solana con Wallet Standard (ad esempio Phantom, Solflare o Backpack) e una pagina aperta nel suo browser."; return; }
      ws.forEach(function (w) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "fm-wbtn"; b.textContent = w.name;
        b.addEventListener("click", function () { go(w); });
        list.appendChild(b);
      });
    }
    function go(w) {
      btn.disabled = true; setStatus("Apertura di " + w.name + "…");
      login(w, { onStatus: setStatus, badgePubblico: pub && pub.checked }).then(function (v) {
        setStatus("Accesso eseguito: " + v.address, "fm-ok");
        if (cb) cb(null, v);
      }).catch(function (e) {
        var m = (e && e.message) || String(e);
        if (/reject|denied|cancel|rifiut/i.test(m)) m = "Firma annullata nel wallet.";
        setStatus(m, "fm-err"); if (cb) cb(e);
      }).then(function () { btn.disabled = false; });
    }
    btn.addEventListener("click", function () {
      ensureInjected();
      if (wallets.length === 1) return go(wallets[0]);
      renderList(wallets);
      if (!wallets.length) setStatus("Nessun wallet compatibile trovato.", "fm-err");
      else setStatus("Scegli il wallet.");
    });
    listeners.push(function (ws) { if (list && list.children.length) renderList(ws); });
  }

  window.ZDOSFirma = { login: login, wallets: function () { ensureInjected(); return wallets.slice(); }, mount: mount, brand: BRAND, buildMessage: buildMessage };
  document.addEventListener("DOMContentLoaded", function () {
    ensureInjected();
    var boxes = document.querySelectorAll("[data-firma-box]");
    for (var i = 0; i < boxes.length; i++) mount(boxes[i], function (err, v) { document.dispatchEvent(new CustomEvent("zdos-firma-login", { detail: err ? { error: err.message } : v })); });
  });
})();
