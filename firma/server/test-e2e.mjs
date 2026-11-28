// Test end-to-end: keypair effimera, firma valida / alterata / riuso nonce / dominio sbagliato / scaduta.
import nacl from "tweetnacl"; import bs58 from "bs58"; import http from "node:http"; import https from "node:https";
const [,, BASE = "http://127.0.0.1:8905", DOMAIN = "x-zdos.it"] = process.argv;
const u = new URL(BASE); const lib = u.protocol === "https:" ? https : http;
function call(method, path, body, headers = {}, host = DOMAIN) {
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : null;
    const r = lib.request({ hostname: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80), path, method, servername: u.hostname,
      headers: { Host: host, ...(process.env.FAKE_IP ? { "X-Real-IP": process.env.FAKE_IP } : {}), ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}), ...headers } }, (x) => {
      let b = ""; x.on("data", (c) => b += c); x.on("end", () => { let j; try { j = JSON.parse(b); } catch { j = b; } res({ status: x.statusCode, json: j, headers: x.headers }); });
    }); r.on("error", rej); if (data) r.write(data); r.end();
  });
}
const isoz = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, ".000Z");
const kp = nacl.sign.keyPair(); const addr = bs58.encode(kp.publicKey);
const sign = (m) => Buffer.from(nacl.sign.detached(Buffer.from(m), kp.secretKey)).toString("base64");
const msgOf = (f, a = addr) => `${f.domain} wants you to sign in with your Solana account:\n${a}\n\n${f.statement}\n\nURI: ${f.uri}\nVersion: ${f.version}\nChain ID: ${f.chainId}\nNonce: ${f.nonce}\nIssued At: ${f.issuedAt}\nExpiration Time: ${f.expirationTime}`;
let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  → " + extra : "")); };
const origin = { Origin: "https://" + DOMAIN };

let n = await call("GET", "/api/firma/nonce"); t("nonce 200 + dominio", n.status === 200 && n.json.signIn.domain === DOMAIN, n.json.signIn?.statement?.slice(0, 20));
t("statement SIWS ASCII stampabile", typeof n.json.signIn.statement === "string" && !/[^\x20-\x7E]/.test(n.json.signIn.statement), "len " + (n.json.signIn.statement||"").length);
let f = n.json.signIn, m = msgOf(f);
let v = await call("POST", "/api/firma/verify", { message: m, signature: sign(m), address: addr, badgePubblico: true }, origin);
t("verify firma VALIDA → 200 + JWT", v.status === 200 && v.json.ok && v.json.token?.split(".").length === 3, `status ${v.status} addr ${v.json.address?.slice(0,6)}…`);
const jwt = v.json.token;
let s = await call("GET", "/api/firma/session", null, { Authorization: "Bearer " + jwt });
t("session con JWT", s.json.autenticato === true && s.json.address === addr);
s = await call("GET", "/api/firma/session", null, { Authorization: "Bearer " + jwt.slice(0, -2) + "xx" });
t("session con JWT manomesso rifiutata", s.json.autenticato === false);
let r2 = await call("POST", "/api/firma/verify", { message: m, signature: sign(m), address: addr }, origin);
t("riuso dello stesso nonce rifiutato", r2.status === 400, r2.json.errore);
let b = await call("GET", "/api/firma/badge?address=" + addr); t("badge pubblico (opt-in) = verificato", b.json.verificato === true);

// statement legacy (con "·" e "è"): ancora accettato in verify, ma non più emesso
n = await call("GET", "/api/firma/nonce");
f = { ...n.json.signIn, statement: n.json.signIn.statement.replace(" - Accesso", " · Accesso").replace(" non e una", " non è una") };
if (f.statement === n.json.signIn.statement) { t("legacy statement distinto dal nuovo", false, "replace non ha cambiato lo statement"); }
else {
  m = msgOf(f);
  let vLeg = await call("POST", "/api/firma/verify", { message: m, signature: sign(m), address: addr, badgePubblico: true }, origin);
  t("verify accetta ancora lo statement legacy (transizione)", vLeg.status === 200 && vLeg.json.ok, vLeg.json.errore || ("status " + vLeg.status));
}

// firma alterata
n = await call("GET", "/api/firma/nonce"); f = n.json.signIn; m = msgOf(f);
let sg = Buffer.from(sign(m), "base64"); sg[5] ^= 1;
v = await call("POST", "/api/firma/verify", { message: m, signature: sg.toString("base64"), address: addr }, origin);
t("firma ALTERATA rifiutata (401)", v.status === 401 && !v.json.token, v.json.errore);
// messaggio alterato dopo la firma
n = await call("GET", "/api/firma/nonce"); f = n.json.signIn; m = msgOf(f);
v = await call("POST", "/api/firma/verify", { message: m.replace("Version: 1", "Version: 1 "), signature: sign(m), address: addr }, origin);
t("messaggio alterato rifiutato", v.status === 400 || v.status === 401, v.json.errore);
// chiave diversa
const kp2 = nacl.sign.keyPair(); n = await call("GET", "/api/firma/nonce"); f = n.json.signIn; m = msgOf(f, bs58.encode(kp2.publicKey));
v = await call("POST", "/api/firma/verify", { message: m, signature: sign(m), address: addr }, origin);
t("firma di un'altra chiave rifiutata", v.status === 401 || v.status === 400, v.json.errore);
// dominio sbagliato
n = await call("GET", "/api/firma/nonce"); f = { ...n.json.signIn, domain: "evil.example", uri: "https://evil.example/" }; m = msgOf(f);
v = await call("POST", "/api/firma/verify", { message: m, signature: sign(m), address: addr }, origin);
t("dominio non ammesso rifiutato", v.status === 400, v.json.errore);
// altro dominio ZDOS ma non quello del sito
const other = DOMAIN === "ourvelvet.online" ? "x-zdos.it" : "ourvelvet.online";
n = await call("GET", "/api/firma/nonce"); f = { ...n.json.signIn, domain: other, uri: "https://" + other + "/" }; m = msgOf(f);
v = await call("POST", "/api/firma/verify", { message: m, signature: sign(m), address: addr }, origin);
t("firma per un altro dominio ZDOS rifiutata sul sito corrente", v.status === 400, v.json.errore);
// origin sbagliata
n = await call("GET", "/api/firma/nonce"); f = n.json.signIn; m = msgOf(f);
v = await call("POST", "/api/firma/verify", { message: m, signature: sign(m), address: addr }, { Origin: "https://evil.example" });
t("Origin estranea rifiutata (403)", v.status === 403, v.json.errore);
// statement senza prefisso
n = await call("GET", "/api/firma/nonce"); f = { ...n.json.signIn, statement: "Approva il trasferimento di fondi" }; m = msgOf(f);
v = await call("POST", "/api/firma/verify", { message: m, signature: sign(m), address: addr }, origin);
t("dichiarazione senza prefisso rifiutata", v.status === 400, v.json.errore);
// nonce inventato
f = { domain: DOMAIN, statement: (await call("GET", "/api/firma/nonce")).json.signIn.statement, uri: `https://${DOMAIN}/`, version: "1", chainId: "mainnet", nonce: "a".repeat(32), issuedAt: isoz(Date.now()), expirationTime: isoz(Date.now() + 300000) }; m = msgOf(f);
v = await call("POST", "/api/firma/verify", { message: m, signature: sign(m), address: addr }, origin);
t("nonce non emesso dal server rifiutato", v.status === 400, v.json.errore);
// scadenza
n = await call("GET", "/api/firma/nonce"); f = { ...n.json.signIn, issuedAt: isoz(Date.now() - 600000), expirationTime: isoz(Date.now() - 300000) }; m = msgOf(f);
v = await call("POST", "/api/firma/verify", { message: m, signature: sign(m), address: addr }, origin);
t("messaggio scaduto rifiutato", v.status === 400, v.json.errore);

// check pubblico
const free = "ZDOS Firma v1 — prova di firma libera"; 
let c = await call("POST", "/api/firma/check", { message: free, signature: sign(free), address: addr });
t("check: testo libero valido", c.json.valid === true && c.json.prefisso === "ZDOS Firma v1" && c.json.formato === "testo libero");
const sig58 = bs58.encode(Buffer.from(sign(free), "base64"));
c = await call("POST", "/api/firma/check", { message: free, signature: sig58, address: addr }); t("check: firma in base58 valida", c.json.valid === true);
sg = Buffer.from(sign(free), "base64"); sg[0] ^= 0x80;
c = await call("POST", "/api/firma/check", { message: free, signature: sg.toString("base64"), address: addr }); t("check: firma alterata → non valida", c.json.valid === false);
c = await call("POST", "/api/firma/check", { message: free + "!", signature: sign(free), address: addr }); t("check: messaggio alterato → non valida", c.json.valid === false);
n = await call("GET", "/api/firma/nonce"); m = msgOf(n.json.signIn);
c = await call("POST", "/api/firma/check", { message: m, signature: sign(m), address: addr }); t("check: messaggio SIWS valido, dettagli", c.json.valid === true && c.json.formato === "Sign-In With Solana" && c.json.dettagli.dominioZdos === true);
c = await call("POST", "/api/firma/check", { message: free, signature: "zzz", address: addr }); t("check: input malformato → 400", c.status === 400);
c = await call("POST", "/api/firma/check", { message: free, signature: sign(free), address: "abc" }); t("check: indirizzo malformato → 400", c.status === 400);
console.log(`\nRisultato: ${pass} ok, ${fail} falliti`); process.exit(fail ? 1 : 0);
