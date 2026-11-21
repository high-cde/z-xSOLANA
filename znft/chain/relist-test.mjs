import fs from "fs"; import { Connection, Keypair, Transaction } from "@solana/web3.js"; import nacl from "tweetnacl"; import bs58 from "bs58";
const BASE = process.argv[2] || "http://127.0.0.1:8932/znft/api"; const workId = +process.argv[3]; const kpFile = process.argv[4] || "./test-buyer-keypair.json"; const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpFile))));
async function call(p, body, token) { const r = await fetch(BASE + p, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json(); if (!r.ok) throw new Error(p + " → " + r.status + " " + JSON.stringify(j)); return j; }
const sign = (msg) => bs58.encode(nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey));
const w = kp.publicKey.toBase58(); const n = await call("/auth/nonce", { wallet: w }); const t = (await call("/auth/verify", { wallet: w, nonce: n.nonce, signature: sign(n.message) })).token;
let rl = await call("/listings", { work_id: workId, price: 75 }, t);
if (rl.need_approve) { const tx = Transaction.from(Buffer.from(rl.tx, "base64")); tx.sign(kp); const s = await conn.sendRawTransaction(tx.serialize()); await conn.confirmTransaction(s, "confirmed"); console.log("approve", s); await new Promise(r => setTimeout(r, 2000)); rl = await call("/listings", { work_id: workId, price: 75 }, t); }
console.log(JSON.stringify(rl));
