// Test end-to-end OurVelvet Social con wallet effimeri (firma SIWS reale su zdos-firma). Uso (root sul VPS):
//   node test-e2e.mjs fase1   → crea dati di test e salva i token in /root/.social-test.json (600)
//   node test-e2e.mjs fase2   → export GDPR, cancellazione, pulizia
import nacl from "tweetnacl"; import bs58 from "bs58"; import fs from "node:fs"; import sharp from "sharp";
const BASE = "https://ourvelvet.online", DOMAIN = "ourvelvet.online", ORIGIN = { Origin: "https://" + DOMAIN, "X-OV-Social": "1" };
const ADMIN = "http://127.0.0.1:8910/api/social/admin", AKEY = fs.readFileSync("/etc/zdos-social/admin.key", "utf8").trim();
const TOK = "/root/.social-test.json";
let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  → " + extra : "")); };
async function call(method, path, { body, raw, ct, jwt, headers = {}, base = BASE } = {}) {
  const h = { ...headers }; if (jwt) h.Cookie = "zdos_firma=" + jwt;
  let b; if (raw) { b = raw; h["Content-Type"] = ct; } else if (body !== undefined) { b = JSON.stringify(body); h["Content-Type"] = "application/json"; }
  const r = await fetch(base + path, { method, headers: h, body: b });
  const txt = Buffer.from(await r.arrayBuffer()); let j; try { j = JSON.parse(txt.toString()); } catch { j = null; }
  return { status: r.status, json: j, buf: txt, headers: r.headers };
}
const adm = (m, p, body) => call(m, p, { body, base: ADMIN, headers: { "X-Social-Admin": AKEY, "X-Staff-User": "test-e2e" } });
const msgOf = (f, a) => `${f.domain} wants you to sign in with your Solana account:\n${a}\n\n${f.statement}\n\nURI: ${f.uri}\nVersion: ${f.version}\nChain ID: ${f.chainId}\nNonce: ${f.nonce}\nIssued At: ${f.issuedAt}\nExpiration Time: ${f.expirationTime}`;
async function login(pub) {
  const kp = nacl.sign.keyPair(), addr = bs58.encode(kp.publicKey);
  const n = await call("GET", "/api/firma/nonce"); const m = msgOf(n.json.signIn, addr);
  const sig = Buffer.from(nacl.sign.detached(Buffer.from(m), kp.secretKey)).toString("base64");
  const v = await call("POST", "/api/firma/verify", { body: { message: m, signature: sig, address: addr, badgePubblico: pub }, headers: { Origin: "https://" + DOMAIN } });
  return { addr, jwt: v.json.token };
}
async function img(w, h, fmt = "jpeg") {
  let s = sharp({ create: { width: w, height: h, channels: 3, background: { r: 120, g: 40, b: 160 } } })
    .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#f5c36c"/><text x="20" y="60" font-size="48" fill="#fff">TEST ZDOS</text></svg>`) }]);
  s = s.withExif({ IFD0: { Copyright: "EXIF-TEST-MARKER", Artist: "test-e2e", ImageDescription: "GPS e dati personali di prova" } });
  return fmt === "png" ? s.png().toBuffer() : s.jpeg().toBuffer();
}
const zcommCount = async () => { const r = await fetch("http://127.0.0.1:4192/zcomm/api/events?limit=200"); const j = await r.json(); return j.events.filter((e) => e.source === "creator").length; };

const phase = process.argv[2];
if (phase === "fase1") {
  const z0 = await zcommCount();
  let r = await call("POST", "/api/social/posts", { body: { text: "ciao" }, headers: ORIGIN }); t("anonimo non può pubblicare (401)", r.status === 401);
  const A = await login(true), B = await login(false); t("login firma A e B (JWT)", !!A.jwt && !!B.jwt);
  r = await call("GET", "/api/social/me", { jwt: A.jwt }); t("/me autenticato via sessione firma", r.json.autenticato === true && r.json.address === A.addr && r.json.profilo === null);
  r = await call("PUT", "/api/social/me/profile", { jwt: A.jwt, headers: ORIGIN, body: { handle: "test_e2e_a", bio: "Prova", cats: ["Arte"] } }); t("profilo senza 18+/termini/consenso rifiutato", r.status === 400, r.json.errore);
  r = await call("PUT", "/api/social/me/profile", { jwt: A.jwt, headers: ORIGIN, body: { handle: "test_e2e_a", bio: "contenuti teen", cats: ["Arte"], maggiorenne: true, termini: true, consenso: true } }); t("filtro: bio con 'teen' rifiutata", r.status === 400, r.json.errore?.slice(0, 50));
  r = await call("PUT", "/api/social/me/profile", { jwt: A.jwt, headers: ORIGIN, body: { handle: "admin", bio: "x", maggiorenne: true, termini: true, consenso: true } }); t("handle riservato rifiutato", r.status === 400);
  r = await call("PUT", "/api/social/me/profile", { jwt: A.jwt, headers: ORIGIN, body: { handle: "test_e2e_a", bio: "Profilo di test automatico: illustrazione gotica, solo adulti. Safeword ROSSO.", cats: ["Arte", "Gotico", "Nonesiste"], maggiorenne: true, termini: true, consenso: true } });
  t("A crea profilo (201)", r.status === 201 && r.json.profilo.handle === "test_e2e_a", "merito: " + JSON.stringify(r.json.merito));
  t("categorie filtrate sulla lista ammessa", JSON.stringify(r.json.profilo.cats) === '["Arte","Gotico"]');
  t("merito: nessun evento senza profilo OV", r.json.merito && r.json.merito.emesso === false);
  t("badge wallet verificato (opt-in) su A", r.json.profilo.verificato === true && r.json.profilo.wallet === A.addr);
  r = await call("PUT", "/api/social/me/profile", { jwt: B.jwt, headers: ORIGIN, body: { handle: "test_e2e_a", bio: "x", maggiorenne: true, termini: true, consenso: true } }); t("handle duplicato rifiutato (409)", r.status === 409);
  r = await call("PUT", "/api/social/me/profile", { jwt: B.jwt, headers: ORIGIN, body: { handle: "test_e2e_b", bio: "Secondo profilo di test.", cats: ["Musica"], maggiorenne: true, termini: true, consenso: true } }); t("B crea profilo", r.status === 201);
  t("B senza badge: wallet non esposto", r.json.profilo.verificato === false && r.json.profilo.wallet === null);
  // immagini
  r = await call("POST", "/api/social/me/avatar", { jwt: A.jwt, headers: ORIGIN, raw: Buffer.from("non sono un'immagine, sono testo"), ct: "image/png" }); t("file non immagine rifiutato (415)", r.status === 415, r.json?.errore);
  r = await call("POST", "/api/social/me/avatar", { jwt: A.jwt, headers: ORIGIN, raw: Buffer.from("GIF89a....."), ct: "image/gif" }); t("GIF rifiutata (415)", r.status === 415);
  r = await call("POST", "/api/social/me/avatar", { jwt: A.jwt, headers: ORIGIN, raw: Buffer.alloc(6 * 1024 * 1024 + 10, 1), ct: "image/jpeg" }); t("oltre 5 MB rifiutato (413)", r.status === 413);
  const src = await img(1600, 1200); const srcMeta = await sharp(src).metadata(); t("immagine di prova contiene EXIF", !!srcMeta.exif && src.includes("EXIF-TEST-MARKER"));
  r = await call("POST", "/api/social/me/avatar", { jwt: A.jwt, headers: ORIGIN, raw: await img(900, 700, "png"), ct: "image/png" }); const avId = r.json.media; t("avatar caricato → in revisione", r.status === 201 && r.json.stato === "in_revisione");
  r = await call("POST", "/api/social/media", { jwt: A.jwt, headers: ORIGIN, raw: src, ct: "image/jpeg" }); const mId = r.json.media; t("immagine post caricata → in revisione", r.status === 201 && !!mId);
  r = await call("GET", "/api/social/media/" + mId, { jwt: A.jwt }); const meta = await sharp(r.buf).metadata();
  t("immagine salvata: WebP, ridimensionata ≤1280, senza EXIF", r.status === 200 && meta.format === "webp" && meta.width <= 1280 && !meta.exif && !r.buf.includes("EXIF-TEST-MARKER"), `${meta.format} ${meta.width}x${meta.height} exif=${!!meta.exif}`);
  r = await call("GET", "/api/social/media/" + avId, { jwt: A.jwt }); const am = await sharp(r.buf).metadata(); t("avatar 512×512 WebP", am.width === 512 && am.height === 512 && am.format === "webp");
  r = await call("GET", "/api/social/media/" + mId); t("immagine in revisione invisibile agli altri (404)", r.status === 404);
  // post
  r = await call("POST", "/api/social/posts", { jwt: A.jwt, headers: ORIGIN, body: { text: "storia step sister" } }); t("filtro: post con 'step' rifiutato", r.status === 400);
  r = await call("POST", "/api/social/posts", { jwt: A.jwt, headers: ORIGIN, body: { text: "scena senza consenso" } }); t("filtro: post 'senza consenso' rifiutato", r.status === 400);
  r = await call("POST", "/api/social/posts", { jwt: A.jwt, headers: ORIGIN, body: { text: "Primo post di test: una tavola gotica a lume di candela. Safeword ROSSO." } }); const p1 = r.json.post?.id; t("post solo testo pubblicato", r.status === 201 && r.json.stato === "pubblico");
  r = await call("POST", "/api/social/posts", { jwt: A.jwt, headers: ORIGIN, body: { text: "Post di test con immagine.", media: mId } }); const p2 = r.json.post?.id; t("post con immagine → in revisione", r.status === 201 && r.json.stato === "in_revisione");
  r = await call("GET", "/api/social/feed"); t("feed globale: solo il post pubblico", r.json.post.some((p) => p.id === p1) && !r.json.post.some((p) => p.id === p2));
  // moderazione staff
  r = await call("GET", "/creator-radar/admin/api/queue"); t("admin via nginx senza credenziali → 401", r.status === 401);
  r = await call("GET", "/creator-radar/admin/api/queue", { headers: { Authorization: "Basic " + Buffer.from("staff:sbagliata").toString("base64") } }); t("admin via nginx con password errata → 401", r.status === 401);
  r = await call("GET", "/api/social/admin/queue", { headers: { "X-Social-Admin": AKEY } }); t("API admin non raggiungibile da /api/social/ pubblico (404)", r.status === 404);
  r = await call("GET", "/queue", { base: ADMIN }); t("backend admin senza chiave interna → 403", r.status === 403);
  r = await adm("GET", "/queue"); t("coda moderazione contiene avatar e immagine post", r.json.coda.some((m) => m.id === mId && m.testo.includes("immagine")) && r.json.coda.some((m) => m.id === avId && m.tipo === "avatar"));
  r = await adm("POST", "/media/" + mId, { azione: "approva" }); t("staff approva immagine post", r.json.ok && r.json.stato === "approvato");
  r = await adm("POST", "/media/" + avId, { azione: "approva" }); t("staff approva avatar", r.json.ok);
  r = await call("GET", "/api/social/feed"); t("dopo l'approvazione il post con immagine è pubblico", r.json.post.some((p) => p.id === p2 && p.media));
  r = await call("GET", "/api/social/media/" + mId); t("immagine approvata pubblica (200)", r.status === 200 && r.headers.get("content-type") === "image/webp");
  r = await call("GET", "/api/social/creators/test_e2e_a"); t("profilo pubblico A con avatar approvato", r.json.profilo.avatar === "/api/social/media/" + avId && r.json.post.length === 2);
  // rifiuto
  r = await call("POST", "/api/social/media", { jwt: B.jwt, headers: ORIGIN, raw: await img(400, 400), ct: "image/jpeg" }); const mB = r.json.media;
  r = await call("POST", "/api/social/posts", { jwt: B.jwt, headers: ORIGIN, body: { text: "Immagine da rifiutare (test).", media: mB } }); const pB = r.json.post.id;
  r = await adm("POST", "/media/" + mB, { azione: "rifiuta", nota: "test" }); r = await call("GET", "/api/social/me", { jwt: B.jwt });
  t("staff rifiuta: post resta privato con stato 'rifiutato'", r.json.post.find((p) => p.id === pB)?.stato === "rifiutato");
  // follow, like, feed seguiti
  r = await call("POST", "/api/social/creators/test_e2e_a/follow", { jwt: B.jwt, headers: ORIGIN, body: {} }); t("B segue A", r.json.segui === true && r.json.follower === 1);
  r = await call("GET", "/api/social/feed?scope=seguiti", { jwt: B.jwt }); t("feed 'chi segui' di B mostra i post di A", r.json.post.length === 2 && r.json.post.every((p) => p.autore.handle === "test_e2e_a"));
  r = await call("POST", `/api/social/posts/${p1}/like`, { jwt: B.jwt, headers: ORIGIN, body: {} }); t("B mette like", r.json.piace === true && r.json.like === 1);
  r = await call("POST", `/api/social/posts/${p1}/like`, { jwt: B.jwt, headers: ORIGIN, body: {} }); t("like di nuovo = toglie", r.json.piace === false && r.json.like === 0);
  r = await call("POST", `/api/social/posts/${p1}/like`, { jwt: B.jwt, headers: ORIGIN, body: {} }); t("like rimesso", r.json.like === 1);
  r = await call("POST", "/api/social/creators/test_e2e_a/follow", { jwt: A.jwt, headers: ORIGIN, body: {} }); t("non puoi seguire te stesso", r.status === 400);
  // segnalazioni
  r = await call("POST", "/api/social/report", { jwt: B.jwt, headers: ORIGIN, body: { kind: "post", target: p2, reason: "test segnalazione post" } }); t("B segnala un post", r.status === 201);
  r = await call("POST", "/api/social/report", { jwt: B.jwt, headers: ORIGIN, body: { kind: "profile", target: "test_e2e_a", reason: "test segnalazione profilo" } }); t("B segnala un profilo", r.status === 201);
  r = await call("POST", "/api/social/report", { jwt: A.jwt, headers: ORIGIN, body: { kind: "profile", target: "test_e2e_a", reason: "auto" } }); t("non puoi segnalare te stesso", r.status === 400);
  r = await adm("GET", "/reports"); const rp = r.json.segnalazioni.find((x) => x.kind === "post" && x.target === p2); t("lo staff vede le segnalazioni con dettaglio", !!rp && rp.dettaglio.handle === "test_e2e_a" && r.json.segnalazioni.some((x) => x.kind === "profile"));
  r = await adm("POST", "/reports/" + rp.id, { azione: "archivia" }); t("staff archivia la segnalazione", r.json.ok);
  const rpp = (await adm("GET", "/reports")).json.segnalazioni.find((x) => x.kind === "profile"); r = await adm("POST", "/reports/" + rpp.id, { azione: "archivia" }); t("staff archivia segnalazione profilo", r.json.ok);
  // blocco
  r = await call("POST", "/api/social/creators/test_e2e_a/block", { jwt: B.jwt, headers: ORIGIN, body: {} }); t("B blocca A", r.json.bloccato === true);
  r = await call("GET", "/api/social/feed", { jwt: B.jwt }); t("B non vede più i post di A", !r.json.post.some((p) => p.autore.handle === "test_e2e_a"));
  r = await call("GET", "/api/social/creators/test_e2e_b"); r = await call("POST", "/api/social/creators/test_e2e_b/follow", { jwt: A.jwt, headers: ORIGIN, body: {} }); t("A non può seguire chi l'ha bloccato", r.status === 404 || r.status === 403);
  r = await call("GET", "/api/social/me", { jwt: B.jwt }); r = await call("GET", "/api/social/feed?scope=seguiti", { jwt: B.jwt }); t("il blocco rimuove il follow", r.json.post.length === 0);
  r = await call("POST", "/api/social/creators/test_e2e_a/block", { jwt: B.jwt, headers: ORIGIN, body: {} }); t("B sblocca A", r.json.bloccato === false);
  r = await call("POST", "/api/social/creators/test_e2e_a/follow", { jwt: B.jwt, headers: ORIGIN, body: {} }); t("B torna a seguire A", r.json.segui === true);
  // CSRF / rate limit
  r = await call("POST", "/api/social/posts", { jwt: B.jwt, headers: { Origin: "https://evil.example", "X-OV-Social": "1" }, body: { text: "x" } }); t("Origin estranea rifiutata (403)", r.status === 403);
  r = await call("POST", "/api/social/posts", { jwt: B.jwt, headers: { Origin: "https://" + DOMAIN }, body: { text: "x" } }); t("senza X-OV-Social rifiutato (403)", r.status === 403);
  // B ha già creato 1 post (quello rifiutato): il limite è 10 post/ora per wallet, quindi ne passano altri 9 e l'11° totale riceve 429
  let codes = []; for (let i = 0; i < 10; i++) codes.push((await call("POST", "/api/social/posts", { jwt: B.jwt, headers: ORIGIN, body: { text: "Rate limit test " + i } })).status);
  t("rate limit: oltre 10 post/ora per wallet → 429", codes.slice(0, 9).every((c) => c === 201) && codes[9] === 429, codes.join(","));
  // chat AI con la sessione
  r = await call("POST", "/api/velvet-ai/chat", { jwt: A.jwt, body: { text: "" }, headers: { Origin: "https://" + DOMAIN } }); t("chat velvet-ai raggiungibile con la sessione (validazione input)", r.status === 400 && /Scrivi/.test(r.json.error));
  r = await call("GET", "/api/velvet-ai/status"); t("velvet-ai status senza cronologia pubblica", r.status === 200 && !JSON.stringify(r.json).includes("userText"));
  t("merito: nessun evento zcomm 'creator' emesso (nessun profilo OV)", (await zcommCount()) === z0);
  r = await call("GET", "/api/social/creators?cat=Gotico"); t("ricerca per categoria", r.json.creator.length === 1 && r.json.creator[0].handle === "test_e2e_a");
  fs.writeFileSync(TOK, JSON.stringify({ A, B, p1, p2, mId, avId }), { mode: 0o600 });
} else if (phase === "fase2") {
  const { A, B, mId, avId } = JSON.parse(fs.readFileSync(TOK, "utf8"));
  let r = await call("GET", "/api/social/me/export", { jwt: A.jwt }); const ex = r.json;
  t("export GDPR: profilo, post, immagini, consensi", r.status === 200 && ex.profilo.handle === "test_e2e_a" && ex.post.length === 2 && ex.immagini.length === 2 && !!ex.profilo.adult_at && !!ex.profilo.consent_at, r.headers.get("content-disposition"));
  t("export GDPR: nessun IP salvato", !JSON.stringify(ex).match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/));
  r = await call("DELETE", "/api/social/me", { jwt: A.jwt, headers: ORIGIN, body: {} }); t("cancellazione senza conferma rifiutata", r.status === 400);
  r = await call("DELETE", "/api/social/me", { jwt: A.jwt, headers: ORIGIN, body: { conferma: "ELIMINA" } }); t("cancellazione GDPR di A", r.json.cancellato === true && r.json.immagini === 2, JSON.stringify(r.json));
  t("file immagine di A rimossi dal disco", !fs.existsSync(`/var/lib/zdos-social/media/${mId}.webp`) && !fs.existsSync(`/var/lib/zdos-social/media/${avId}.webp`));
  r = await call("GET", "/api/social/creators/test_e2e_a"); t("profilo A non più visibile (404)", r.status === 404);
  r = await call("GET", "/api/social/media/" + mId); t("immagine A non più servita (404)", r.status === 404);
  r = await call("GET", "/api/social/me", { jwt: B.jwt }); t("follow verso A rimossi", r.json.profilo.seguiti === 0);
  r = await call("DELETE", "/api/social/me", { jwt: B.jwt, headers: ORIGIN, body: { conferma: "ELIMINA" } }); t("cancellazione GDPR di B", r.json.cancellato === true);
  r = await adm("GET", "/stats"); t("DB senza profili, post e immagini", r.json.profili.length === 0 && r.json.post.length === 0 && r.json.immagini.length === 0, JSON.stringify(r.json));
  fs.writeFileSync("/root/.social-test-addrs", A.addr + "\n" + B.addr + "\n", { mode: 0o600 }); fs.unlinkSync(TOK);
}
console.log(`\nRisultato ${phase}: ${pass} ok, ${fail} falliti`); process.exit(fail ? 1 : 0);
