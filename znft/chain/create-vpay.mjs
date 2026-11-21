// DSN-X · Velvet Pay (VPAY) — moneta di TEST su Solana DEVNET. Token-2022, 6 decimali, metadata on-chain.
// Rifiuta mainnet (controllo genesis). Uso: node create-vpay.mjs
import fs from "fs";
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, ExtensionType, getMintLen, LENGTH_SIZE, TYPE_SIZE,
  createInitializeMetadataPointerInstruction, createInitializeMintInstruction,
  getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { createInitializeInstruction, pack } from "@solana/spl-token-metadata";
const RPC = "https://api.devnet.solana.com";
const conn = new Connection(RPC, "confirmed");
if ((await conn.getGenesisHash()) === "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d") throw new Error("mainnet: stop");
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync("./devnet-keypair.json"))));
if (fs.existsSync("./vpay-mint.json")) { console.log("già creata:", fs.readFileSync("./vpay-mint.json","utf8")); process.exit(0); }
const mint = Keypair.generate();
const meta = { mint: mint.publicKey, name: "Velvet Pay (TEST devnet)", symbol: "VPAY",
  uri: "https://velvet.x-zdos.it/znft/vpay.json", updateAuthority: payer.publicKey,
  additionalMetadata: [["rete", "devnet"], ["uso", "zNFT test"], ["emittente", "ZDOS1.3"]] };
const mintLen = getMintLen([ExtensionType.MetadataPointer]);
const metaLen = TYPE_SIZE + LENGTH_SIZE + pack(meta).length;
const lamports = await conn.getMinimumBalanceForRentExemption(mintLen + metaLen);
const tx = new Transaction().add(
  SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey, space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID }),
  createInitializeMetadataPointerInstruction(mint.publicKey, payer.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID),
  createInitializeMintInstruction(mint.publicKey, 6, payer.publicKey, null, TOKEN_2022_PROGRAM_ID),
  createInitializeInstruction({ programId: TOKEN_2022_PROGRAM_ID, metadata: mint.publicKey, updateAuthority: payer.publicKey,
    mint: mint.publicKey, mintAuthority: payer.publicKey, name: meta.name, symbol: meta.symbol, uri: meta.uri }),
);
const sig = await sendAndConfirmTransaction(conn, tx, [payer, mint]);
const ata = await getOrCreateAssociatedTokenAccount(conn, payer, mint.publicKey, payer.publicKey, false, "confirmed", undefined, TOKEN_2022_PROGRAM_ID);
const sig2 = await mintTo(conn, payer, mint.publicKey, ata.address, payer, 100_000_000n * 1_000_000n, [], undefined, TOKEN_2022_PROGRAM_ID);
const out = { cluster: "devnet", mint: mint.publicKey.toBase58(), decimals: 6, program: "Token-2022", name: meta.name, symbol: "VPAY",
  mint_authority: payer.publicKey.toBase58(), freeze_authority: null, treasury_ata: ata.address.toBase58(),
  initial_supply: "100000000", create_signature: sig, mint_signature: sig2, created: new Date().toISOString() };
fs.writeFileSync("./vpay-mint.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
