import Database from "better-sqlite3"; import fs from "node:fs"; import nacl from "tweetnacl"; import bs58 from "bs58";
const k=JSON.parse(fs.readFileSync("/workspace/dsnx-test/keypair.json")); const sk=bs58.decode(k.secret);
fs.writeFileSync("/tmp/approver.pub",k.pub+"\n"); process.env.POOL_APPROVER_FILE="/tmp/approver.pub"; process.env.DEFI_URL="http://127.0.0.1:1"; process.env.ZCOMM_URL="http://127.0.0.1:1";
const {createPool}=await import("./pool.mjs");
const db=new Database(":memory:");
db.exec(`CREATE TABLE profiles(wallet TEXT PRIMARY KEY, handle TEXT, bio TEXT, status TEXT, ovid TEXT, created INTEGER);CREATE TABLE posts(id TEXT, wallet TEXT, status TEXT, published INTEGER, created INTEGER);CREATE TABLE likes(post TEXT, wallet TEXT, created INTEGER);CREATE TABLE follows(follower TEXT, followee TEXT, created INTEGER);`);
const now=Math.floor(Date.now()/1000);
db.prepare("INSERT INTO profiles VALUES(?,?,?,?,?,?)").run(k.pub,"a","Account di test DSN-X","attivo",null,now);
db.prepare("INSERT INTO profiles VALUES(?,?,?,?,?,?)").run("B".repeat(44),"b","utente reale","attivo",null,now);
db.prepare("INSERT INTO profiles VALUES(?,?,?,?,?,?)").run("C".repeat(44),"c","utente reale 2","attivo",null,now);
for(let i=0;i<8;i++) db.prepare("INSERT INTO posts VALUES(?,?,?,?,?)").run("p"+i,"B".repeat(44),"pubblico",now,now);
db.prepare("INSERT INTO posts VALUES(?,?,?,?,?)").run("pc","C".repeat(44),"pubblico",now,now);
db.prepare("INSERT INTO likes VALUES(?,?,?)").run("pc",k.pub,now); db.prepare("INSERT INTO likes VALUES(?,?,?)").run("pc","C".repeat(44),now); // auto-like ignorato
const P=createPool({db,badge:async()=>false,session:async()=>({address:k.pub})});
const st=await P.state(new URL("http://x/?epoch=current"),k.pub);
console.log(st.epoca.modalita, st.classifica.map(i=>[i.handle,i.punti,i.quota,i.importoProposto,i.test,i.pagabile]), st.budget.assegnatoL$D, "fee-less budget", st.budget.totaleL$D);
// approvazione
const msg=st.approvazione.messaggio; const sig=bs58.encode(nacl.sign.detached(new TextEncoder().encode(msg),sk));
const out={}; const res={writeHead(c){out.c=c},end(b){out.b=JSON.parse(b)}};
const req={method:"POST",headers:{},async*[Symbol.asyncIterator](){}};
const mk=(body)=>{const r={method:"POST",headers:{},on(){}};return r};
async function call(body){ const o={}; await P.handle({method:"POST",headers:{}},{writeHead(c){o.c=c},end(b){o.b=JSON.parse(b)}},"/api/social/pool/approve",new URL("http://x/"),{send:(r,c,j)=>{o.c=c;o.b=j},fail:(r,c,m)=>{o.c=c;o.b={errore:m}},readJson:async()=>body}); return o; }
console.log("ok",JSON.stringify(await call({epoca:st.epoca.id,hash:st.snapshot.hash,firma:sig})));
console.log("firma errata",JSON.stringify(await call({epoca:st.epoca.id,hash:st.snapshot.hash,firma:bs58.encode(new Uint8Array(64))})));
console.log("hash errato",JSON.stringify(await call({epoca:st.epoca.id,hash:"00",firma:sig})));
const st2=await P.state(new URL("http://x/"),null); console.log("registrate",st2.approvazione.registrate);
