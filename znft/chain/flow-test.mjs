// Test end-to-end su DEVNET via HTTP (stesso percorso del browser, con wallet di test al posto di Phantom).
import fs from "fs"; import crypto from "crypto"; import zlib from "zlib";
import { Connection, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl"; import bs58 from "bs58";
const BASE = process.argv[2] || "http://127.0.0.1:8932/znft/api"; const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const load = (f) => { if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify([...Keypair.generate().secretKey]), { mode: 0o600 }); return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(f)))); };
const artist = load("./test-artist-keypair.json"), model = load("./test-model-keypair.json"), buyer = load("./test-buyer-keypair.json");
const platform = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync("./devnet-keypair.json"))));
const log = (...a) => console.log("•", ...a);
async function call(p, body, token) { const r = await fetch(BASE + p, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json(); if (!r.ok) throw new Error(p + " → " + r.status + " " + JSON.stringify(j)); return j; }
const sign = (kp, msg) => bs58.encode(nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey));
async function login(kp) { const w = kp.publicKey.toBase58(); const n = await call("/auth/nonce", { wallet: w }); return (await call("/auth/verify", { wallet: w, nonce: n.nonce, signature: sign(kp, n.message) })).token; }
async function signSend(kp, txb64) { const tx = Transaction.from(Buffer.from(txb64, "base64")); tx.sign(kp); const sig = await conn.sendRawTransaction(tx.serialize()); await conn.confirmTransaction(sig, "confirmed"); return sig; }
function png(seed) { // PNG astratto 64x80 (gradiente), solo per la prova dell'anteprima
  const w = 64, h = 80, raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 60 + (x * 3 + seed) % 180; raw[o + 1] = 10; raw[o + 2] = 80 + y * 2 % 160; } }
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const ADMIN = process.env.ADMIN_BASE; // se impostato, usa questo per /admin (es. tunnel con header)
// 0. SOL di prova all'acquirente (fee + eventuale conto token)
if ((await conn.getBalance(buyer.publicKey)) < 10_000_000) { await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: platform.publicKey, toPubkey: buyer.publicKey, lamports: 20_000_000 })), [platform]); log("0,02 SOL devnet all'acquirente di test"); }
// 1. artista
const ta = await login(artist); await call("/me", { nick: "Artista di prova (TEST)", bio: "Wallet di test usato per verificare la piattaforma su devnet." }, ta);
const file = Buffer.from("zNFT file di prova " + (process.env.TAGF || "") + crypto.randomBytes(8).toString("hex")); const sha = crypto.createHash("sha256").update(file).digest("hex");
const d = await call("/works/declaration", { sha256: sha, title: "Primo zNFT di prova" }, ta);
const wk = await call("/works", { sha256: sha, title: "Primo zNFT di prova", nonce: d.nonce, signature: sign(artist, d.message), collection: "Prove di certificazione", technique: "file di prova (nessuna immagine reale)", year: "2026",
  description: "Certificato di prova creato dal test end-to-end: il file è un testo casuale, l'anteprima un gradiente astratto. Serve a verificare firme, consenso, regole Zlang, mint e vendita.", people: 1, royalty_bps: 500,
  preview: "data:image/png;base64," + png(7).toString("base64") }, ta);
log("bozza", wk.id, wk.slug);
let sub = await call(`/works/${wk.id}/submit`, {}, ta); log("submit senza consenso →", sub.esito);
// 2. modello
const tm = await login(model); const cn = await call(`/consent/${wk.id}/nonce`, {}, tm); log("consenso", JSON.stringify(await call(`/consent/${wk.id}`, { nonce: cn.nonce, signature: sign(model, cn.message) }, tm)));
sub = await call(`/works/${wk.id}/submit`, {}, ta); log("submit con consenso →", sub.esito);
// 3. staff
const ap = process.env.ADMIN_BASE ? await (async () => { const r = await fetch(process.env.ADMIN_BASE + `/admin/works/${wk.id}/approva`, { method: "POST", headers: { "content-type": "application/json", "x-znft-admin": process.env.ADMIN_KEY, "x-staff-user": "dsn-x-test" }, body: "{}" }); const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j)); return j; })() : await call(`/admin/works/${wk.id}/approva`, {}); log("certificato", ap.asset, ap.signature);
// 4. vendita
const ls = await call("/listings", { work_id: wk.id, price: 50 }, ta); log("annuncio", JSON.stringify(ls));
// 5. acquirente
const tb = await login(buyer); try { log("faucet", (await call("/faucet", {}, tb)).signature); } catch (e) { log("faucet:", e.message.slice(0, 120)); }
const by = await call(`/buy/${ls.listing}`, {}, tb); const paySig = await signSend(buyer, by.tx); log("pagamento", paySig);
const cf = await call(`/buy/${ls.listing}/confirm`, { purchase: by.purchase, signature: paySig }, tb); log("conferma", JSON.stringify(cf));
// 6. riuso pagamento bloccato
try { await call(`/buy/${ls.listing}/confirm`, { purchase: by.purchase, signature: paySig }, tb); log("ERRORE: riuso accettato"); } catch (e) { log("riuso bloccato ok"); }
// 7. upgrade: possesso dell'asset appena comprato
log("upgrade check", JSON.stringify(await call("/upgrade", { nft: ap.asset, rete: "devnet" }, tb)));
// 8. rimessa in vendita dal nuovo proprietario (serve riautorizzare il delegato?)
let rl = await call("/listings", { work_id: wk.id, price: 75 }, tb);
if (rl.need_approve) { log("serve approvazione delegato: firmo"); log("approve", await signSend(buyer, rl.tx)); await new Promise(r => setTimeout(r, 2000)); rl = await call("/listings", { work_id: wk.id, price: 75 }, tb); }
log("rimessa in vendita", JSON.stringify(rl));
const out = { work: wk, asset: ap.asset, mint_sig: ap.signature, listing: ls.listing, pay: paySig, transfer: cf.trasferimento, relist: rl.listing, artist: artist.publicKey.toBase58(), model: model.publicKey.toBase58(), buyer: buyer.publicKey.toBase58() };
fs.writeFileSync(`./flow-result-${new URL(BASE).hostname}.json`, JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2));
