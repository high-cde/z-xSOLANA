import fs from "fs"; import { makeChain } from "./lib.mjs";
if (fs.existsSync("./collection.json")) { console.log(fs.readFileSync("./collection.json","utf8")); process.exit(0); }
const c = makeChain({ rpc: "https://api.devnet.solana.com", keypairPath: "./devnet-keypair.json" });
const col = await c.createCollection("zNFT Certificati TEST", "https://velvet.x-zdos.it/znft/api/meta/collection.json");
const out = { cluster: "devnet", collection: col, update_authority: c.platform, created: new Date().toISOString() };
fs.writeFileSync("./collection.json", JSON.stringify(out, null, 2)); console.log(out);
