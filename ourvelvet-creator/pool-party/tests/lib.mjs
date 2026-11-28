import nacl from "tweetnacl"; import bs58 from "bs58"; import fs from "node:fs";
export const KF="/workspace/dsnx-test/keypair.json";
export function loadKey(){
  if(!fs.existsSync(KF)){ const kp=nacl.sign.keyPair(); fs.writeFileSync(KF,JSON.stringify({secret:bs58.encode(kp.secretKey),pub:bs58.encode(kp.publicKey),creato:new Date().toISOString(),nota:"keypair di TEST DSN-X, mai finanziato"}),{mode:0o600}); }
  const j=JSON.parse(fs.readFileSync(KF,"utf8")); return {pub:j.pub, secretKey:bs58.decode(j.secret)};
}
export function msgFor(si,addr){ return `${si.domain} wants you to sign in with your Solana account:\n${addr}\n\n${si.statement}\n\nURI: ${si.uri}\nVersion: ${si.version}\nChain ID: ${si.chainId}\nNonce: ${si.nonce}\nIssued At: ${si.issuedAt}\nExpiration Time: ${si.expirationTime}`; }
export async function login(host,{badge=false,second=false}={}){
  const k=second?(await import("./lib2.mjs")).loadKey2():loadKey(); const base="https://"+host;
  const n=await (await fetch(base+"/api/firma/nonce")).json(); if(!n.ok) throw new Error("nonce "+JSON.stringify(n));
  const message=msgFor(n.signIn,k.pub);
  const sig=nacl.sign.detached(new TextEncoder().encode(message),k.secretKey);
  const r=await fetch(base+"/api/firma/verify",{method:"POST",headers:{"content-type":"application/json",origin:base},body:JSON.stringify({message,signature:bs58.encode(sig),address:k.pub,badgePubblico:badge})});
  const j=await r.json(); return {status:r.status,body:j,cookie:r.headers.get("set-cookie"),pub:k.pub,message,sig:bs58.encode(sig)};
}
export function api(host,token){ const base="https://"+host;
  return async (method,path,body,extra={})=>{ const h={cookie:"zdos_firma="+token,origin:base,"x-ov-social":"1",...extra}; let b; if(body instanceof Buffer){b=body}else if(body!==undefined){h["content-type"]="application/json";b=JSON.stringify(body)}
    let r,t; for(let i=0;i<4;i++){ try{ r=await fetch(base+path,{method,headers:h,body:b}); t=await r.text(); break;}catch(e){ if(i==3) throw e; await new Promise(z=>setTimeout(z,700)); } } let j; try{j=JSON.parse(t)}catch{j=t.slice(0,200)} return {status:r.status,j,headers:r.headers}; } }
