import nacl from "tweetnacl"; import bs58 from "bs58"; import fs from "node:fs";
export function loadKey2(){ const F="/workspace/dsnx-test/keypair2.json";
 if(!fs.existsSync(F)){const kp=nacl.sign.keyPair(); fs.writeFileSync(F,JSON.stringify({secret:bs58.encode(kp.secretKey),pub:bs58.encode(kp.publicKey),nota:"keypair TEST DSN-X #2, mai finanziato"}),{mode:0o600});}
 const j=JSON.parse(fs.readFileSync(F,"utf8")); return {pub:j.pub,secretKey:bs58.decode(j.secret)}; }
