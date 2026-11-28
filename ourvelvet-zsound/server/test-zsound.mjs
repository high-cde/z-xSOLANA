// Test end-to-end Z-Sound (audio nel profilo) con wallet effimeri. Uso (root sul VPS):
//   SOCIAL_BASE=http://127.0.0.1:8919 node test-zsound.mjs        (istanza di prova con DB temporaneo)
//   SOCIAL_BASE=https://ourvelvet.online node test-zsound.mjs      (servizio reale: crea e cancella i propri dati)
import nacl from "tweetnacl"; import bs58 from "bs58"; import fs from "node:fs"; import sharp from "sharp";
const BASE = process.env.SOCIAL_BASE || "https://ourvelvet.online", FIRMA = "https://ourvelvet.online", DOMAIN = "ourvelvet.online";
const ORIGIN = { Origin: "https://" + DOMAIN, "X-OV-Social": "1" };
const ADMIN = (process.env.SOCIAL_ADMIN || "http://127.0.0.1:8910") + "/api/social/admin", AKEY = fs.readFileSync("/etc/zdos-social/admin.key", "utf8").trim();
let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  → " + extra : "")); };
async function call(method, path, { body, raw, ct, jwt, headers = {}, base = BASE } = {}) {
  const h = { ...headers }; if (jwt) h.Cookie = "zdos_firma=" + jwt;
  let b; if (raw) { b = raw; h["Content-Type"] = ct; } else if (body !== undefined) { b = JSON.stringify(body); h["Content-Type"] = "application/json"; }
  let r; try { r = await fetch(base + path, { method, headers: h, body: b }); } catch { return { status: 0, json: null, buf: Buffer.alloc(0), headers: new Headers() }; } const buf = Buffer.from(await r.arrayBuffer()); let j; try { j = JSON.parse(buf.toString()); } catch { j = null; }
  return { status: r.status, json: j, buf, headers: r.headers };
}
const adm = (m, p, body) => call(m, p, { body, base: ADMIN, headers: { "X-Social-Admin": AKEY, "X-Staff-User": "test-zsound" } });
const msgOf = (f, a) => `${f.domain} wants you to sign in with your Solana account:\n${a}\n\n${f.statement}\n\nURI: ${f.uri}\nVersion: ${f.version}\nChain ID: ${f.chainId}\nNonce: ${f.nonce}\nIssued At: ${f.issuedAt}\nExpiration Time: ${f.expirationTime}`;
async function login() {
  const kp = nacl.sign.keyPair(), addr = bs58.encode(kp.publicKey);
  const n = await call("GET", "/api/firma/nonce", { base: FIRMA }); const m = msgOf(n.json.signIn, addr);
  const sig = Buffer.from(nacl.sign.detached(Buffer.from(m), kp.secretKey)).toString("base64");
  const v = await call("POST", "/api/firma/verify", { base: FIRMA, body: { message: m, signature: sig, address: addr, badgePubblico: false }, headers: { Origin: "https://" + DOMAIN } });
  return { addr, jwt: v.json.token };
}
function wav(sec, hz = 440) { const sr = 22050, n = Math.floor(sr * sec), b = Buffer.alloc(44 + n * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * hz * i / sr)), 44 + i * 2); return b; }
const png = () => sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 150, g: 40, b: 120 } } }).png().toBuffer();

const HND = "zs_t_" + Math.random().toString(36).slice(2, 8); const A = await login(); t("login firma (wallet effimero)", !!A.jwt);
let r = await call("PUT", "/api/social/me/profile", { jwt: A.jwt, headers: ORIGIN, body: { handle: HND, bio: "Prova Z-Sound", cats: ["Musica"], maggiorenne: true, termini: true, consenso: true } }); t("profilo creator creato", r.status === 201, r.json && r.json.errore);
const W = wav(2);
r = await call("POST", "/api/social/audio?titolo=Test%20tono&dur=2", { raw: W, ct: "audio/wav", headers: ORIGIN }); t("audio senza login rifiutato (401)", r.status === 401);
r = await call("POST", "/api/social/audio?titolo=Test%20tono", { jwt: A.jwt, raw: W, ct: "image/png", headers: ORIGIN }); t("content-type non audio rifiutato (415)", r.status === 415);
r = await call("POST", "/api/social/audio", { jwt: A.jwt, raw: Buffer.from("questo non e audio, e testo qualsiasi lungo abbastanza"), ct: "audio/wav", headers: ORIGIN }); t("file finto con ct audio rifiutato (415)", r.status === 415, r.json && r.json.errore);
r = await call("POST", "/api/social/audio?titolo=" + encodeURIComponent("tracce con minorenne"), { jwt: A.jwt, raw: W, ct: "audio/wav", headers: ORIGIN }); t("titolo vietato dal filtro rifiutato (400)", r.status === 400, r.json && r.json.errore);
r = await call("POST", "/api/social/audio", { jwt: A.jwt, raw: Buffer.concat([wav(1), Buffer.alloc(26 * 1024 * 1024)]), ct: "audio/wav", headers: ORIGIN }); t("audio oltre 25 MB rifiutato (413)", r.status === 413 || r.status === 0, String(r.status));
r = await call("POST", "/api/social/audio?titolo=Test%20tono&dur=2", { jwt: A.jwt, raw: W, ct: "audio/wav", headers: ORIGIN }); t("upload WAV valido (201, in revisione)", r.status === 201 && r.json.stato === "in_revisione" && r.json.durata === 2, JSON.stringify(r.json));
const AUD = r.json.media;
r = await call("GET", "/api/social/media/" + AUD, { jwt: A.jwt, headers: { Range: "bytes=0-99" } }); t("proprietario ascolta la traccia con Range (206, audio/wav)", r.status === 206 && /audio\/wav/.test(r.headers.get("content-type")) && r.buf.length === 100 && /bytes 0-99\//.test(r.headers.get("content-range")), r.status + " " + r.headers.get("content-type"));
r = await call("GET", "/api/social/media/" + AUD); t("anonimo non vede la traccia non approvata (404)", r.status === 404);
const cov = await png(); r = await call("POST", "/api/social/media", { jwt: A.jwt, raw: cov, ct: "image/png", headers: ORIGIN }); t("copertina caricata", r.status === 201); const COV = r.json.media;
r = await call("POST", "/api/social/posts", { jwt: A.jwt, headers: ORIGIN, body: { text: "Il mio primo mix", audio: AUD, media: COV } }); t("post musica creato in revisione", r.status === 201 && r.json.stato === "in_revisione" && r.json.post.audio && r.json.post.audio.titolo === "Test tono", JSON.stringify(r.json).slice(0, 200)); const P1 = r.json.post.id;
r = await call("GET", "/api/social/feed"); t("feed non mostra il post in revisione", !r.json.post.some((p) => p.id === P1));
let q = await adm("GET", "/queue"); const qa = q.json.coda.find((x) => x.id === AUD); t("coda staff mostra la traccia (tipo audio, titolo, durata)", !!qa && qa.tipo === "audio" && qa.titolo === "Test tono" && qa.durata === 2, JSON.stringify(qa));
r = await adm("GET", "/media/" + AUD); t("staff ascolta la traccia", r.status === 200 && /audio\/wav/.test(r.headers.get("content-type")));
r = await adm("POST", "/media/" + AUD, { azione: "approva" }); t("staff approva la traccia", r.status === 200);
r = await call("GET", "/api/social/me", { jwt: A.jwt }); t("con la copertina ancora in revisione il post resta in revisione", r.json.post.find((p) => p.id === P1).stato === "in_revisione");
r = await adm("POST", "/media/" + COV, { azione: "approva" }); t("staff approva la copertina", r.status === 200);
r = await call("GET", "/api/social/feed"); const fp = r.json.post.find((p) => p.id === P1); t("post musica pubblico nel feed con audio e copertina", !!fp && fp.audio && fp.audio.url === "/api/social/media/" + AUD && !!fp.media, fp && JSON.stringify(fp.audio));
r = await call("GET", "/api/social/media/" + AUD, { headers: { Range: "bytes=44-" } }); t("anonimo ascolta la traccia approvata (206, cache pubblica)", r.status === 206 && /public/.test(r.headers.get("cache-control")));
r = await call("GET", "/api/social/creators/" + HND); t("nel profilo pubblico compaiono i post con traccia", r.json.post.some((p) => p.id === P1 && p.audio));
// seconda traccia con la stessa copertina (foto del profilo riusata) 
r = await call("POST", "/api/social/audio?titolo=Seconda&dur=3", { jwt: A.jwt, raw: wav(3, 330), ct: "audio/wav", headers: ORIGIN }); const AUD2 = r.json.media;
r = await call("POST", "/api/social/posts", { jwt: A.jwt, headers: ORIGIN, body: { text: "", audio: AUD2, media: COV } }); t("copertina approvata riusabile in un secondo post musica", r.status === 201 && r.json.stato === "in_revisione", JSON.stringify(r.json).slice(0, 160)); const P2 = r.json.post.id;
r = await call("POST", "/api/social/posts", { jwt: A.jwt, headers: ORIGIN, body: { text: "senza traccia", media: COV } }); t("senza traccia la copertina già usata resta non riusabile (400)", r.status === 400);
await adm("POST", "/media/" + AUD2, { azione: "approva" }); r = await call("GET", "/api/social/feed"); t("secondo post pubblico dopo l'approvazione della sola traccia", r.json.post.some((p) => p.id === P2));
r = await call("GET", "/api/social/me/tracks", { jwt: A.jwt }); t("libreria personale: 2 tracce + foto approvata", r.json.tracce.length === 2 && r.json.foto.length === 1 && r.json.tracce.every((x) => x.inPost), JSON.stringify(r.json.tracce.map((x) => x.titolo)));
r = await call("DELETE", "/api/social/audio/" + AUD2, { jwt: A.jwt, headers: ORIGIN }); t("traccia usata in un post non eliminabile (409)", r.status === 409);
r = await call("DELETE", "/api/social/posts/" + P2, { jwt: A.jwt, headers: ORIGIN }); t("post musica eliminabile", r.status === 200);
r = await call("GET", "/api/social/media/" + COV, { jwt: A.jwt }); t("la copertina condivisa resta (usata dal primo post)", r.status === 200);
r = await call("DELETE", "/api/social/audio/" + AUD2, { jwt: A.jwt, headers: ORIGIN }); t("traccia non più usata eliminabile", r.status === 200);
r = await call("GET", "/api/social/me/export", { jwt: A.jwt }); t("export GDPR include tracce e post con audio", r.json.immagini.some((m) => m.kind === "audio" && m.title === "Test tono") && r.json.post.some((p) => p.audio === AUD));
r = await call("GET", "/api/social/zsound/ai/status"); t("AI: stato in attivazione, nessun finto", r.json.stato === "in_attivazione", r.json.stato);
r = await call("POST", "/api/social/zsound/ai/generate", { jwt: A.jwt, headers: ORIGIN, body: { prompt: "techno scura 124 bpm", seconds: 30 } }); t("AI: generazione risponde 503 finché spenta", r.status === 503 && r.json.stato === "in_attivazione");
r = await call("GET", "/api/social/meta"); t("meta annuncia limiti audio", r.json.audio && r.json.audio.max === 25 * 1024 * 1024);
// rifiuto audio
r = await call("POST", "/api/social/audio?titolo=Da%20rifiutare&dur=1", { jwt: A.jwt, raw: wav(1), ct: "audio/wav", headers: ORIGIN }); const AUD3 = r.json.media;
r = await call("POST", "/api/social/posts", { jwt: A.jwt, headers: ORIGIN, body: { text: "x", audio: AUD3 } }); const P3 = r.json.post.id;
await adm("POST", "/media/" + AUD3, { azione: "rifiuta", nota: "test" }); r = await call("GET", "/api/social/me", { jwt: A.jwt }); t("audio rifiutato: post rifiutato e file cancellato", r.json.post.find((p) => p.id === P3).stato === "rifiutato");
r = await call("DELETE", "/api/social/me", { jwt: A.jwt, headers: ORIGIN, body: { conferma: "ELIMINA" } }); t("cancellazione profilo (GDPR) ok", r.status === 200 && r.json.cancellato, JSON.stringify(r.json));
r = await call("GET", "/api/social/media/" + AUD); t("dopo la cancellazione la traccia non esiste più", r.status === 404);
console.log(`\n${pass}/${pass + fail} test superati`); process.exit(fail ? 1 : 0);
