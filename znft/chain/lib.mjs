// DSN-X · zNFT chain lib (SOLO DEVNET). Metaplex Core per i certificati, Token-2022 per Velvet Pay (VPAY).
import fs from "fs";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction, getOrCreateAssociatedTokenAccount, transferChecked } from "@solana/spl-token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, generateSigner, publicKey as umiPk, createNoopSigner } from "@metaplex-foundation/umi";
import { mplCore, create, createCollection, fetchAsset, fetchCollection, transfer, approvePluginAuthorityV1, PluginType } from "@metaplex-foundation/mpl-core";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import bs58 from "bs58";
import nacl from "tweetnacl";

export const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
export const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const CORE_PROGRAM = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";

export function makeChain({ rpc, keypairPath, vpayMint, collection }) {
  const conn = new Connection(rpc, "confirmed");
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath))));
  const umi = createUmi(rpc, "confirmed").use(mplCore());
  const ukp = umi.eddsa.createKeypairFromSecretKey(kp.secretKey);
  umi.use(keypairIdentity(ukp));
  const mint = vpayMint ? new PublicKey(vpayMint) : null;
  let checked = false;
  async function guard() {
    if (checked) return; const g = await conn.getGenesisHash();
    if (g === MAINNET_GENESIS) throw new Error("genesis mainnet: zNFT gira solo su devnet"); checked = true;
  }
  const C = {
    conn, umi, platform: kp.publicKey.toBase58(), vpayMint: mint && mint.toBase58(), collection,
    guard,
    verifySignature(wallet, message, sigB58) {
      try { return nacl.sign.detached.verify(new TextEncoder().encode(message), bs58.decode(sigB58), bs58.decode(wallet)); } catch { return false; }
    },
    async createCollection(name, uri) {
      await guard(); const col = generateSigner(umi);
      await createCollection(umi, { collection: col, name, uri }).sendAndConfirm(umi);
      return col.publicKey.toString();
    },
    async mintCertificate({ owner, name, uri, attributes, royaltyBps, creator }) {
      await guard();
      const asset = generateSigner(umi);
      const col = await fetchCollection(umi, umiPk(collection));
      const plugins = [
        { type: "Attributes", attributeList: attributes.map(([key, value]) => ({ key, value: String(value).slice(0, 120) })) },
        { type: "TransferDelegate", authority: { type: "Address", address: umiPk(C.platform) } },
      ];
      if (royaltyBps > 0) plugins.push({ type: "Royalties", basisPoints: royaltyBps, creators: [{ address: umiPk(creator), percentage: 100 }], ruleSet: { type: "None" } });
      const res = await create(umi, { asset, collection: col, name: name.slice(0, 32), uri, owner: umiPk(owner), plugins }).sendAndConfirm(umi);
      return { asset: asset.publicKey.toString(), signature: bs58.encode(res.signature) };
    },
    async assetInfo(address) {
      await guard();
      const a = await fetchAsset(umi, umiPk(address), { skipDerivePlugins: false });
      return { owner: a.owner.toString(), name: a.name, uri: a.uri, delegate: a.transferDelegate?.authority?.address?.toString() || null,
        delegateType: a.transferDelegate?.authority?.type || null, attributes: a.attributes?.attributeList || [] };
    },
    async transferAsDelegate(address, to) {
      await guard();
      const a = await fetchAsset(umi, umiPk(address));
      const col = a.updateAuthority.type === "Collection" ? await fetchCollection(umi, a.updateAuthority.address) : undefined;
      const res = await transfer(umi, { asset: a, collection: col, newOwner: umiPk(to), authority: umi.identity }).sendAndConfirm(umi);
      return bs58.encode(res.signature);
    },
    // Transazione (legacy) che il proprietario firma in Phantom per ridare alla piattaforma il ruolo di delegato di trasferimento.
    async buildApproveDelegateTx(address, owner) {
      await guard();
      const a = await fetchAsset(umi, umiPk(address));
      const ownerSigner = createNoopSigner(umiPk(owner));
      const ix = approvePluginAuthorityV1(umi, { asset: umiPk(address), collection: a.updateAuthority.type === "Collection" ? a.updateAuthority.address : undefined,
        payer: ownerSigner, authority: ownerSigner, pluginType: PluginType.TransferDelegate, newAuthority: { __kind: "Address", address: umiPk(C.platform) } }).getInstructions();
      const tx = new Transaction(); ix.forEach(i => tx.add(toWeb3JsInstruction(i)));
      return C._finish(tx, owner);
    },
    async _finish(tx, feePayer) {
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash; tx.feePayer = new PublicKey(feePayer);
      return { message: bs58.encode(tx.serializeMessage()), tx: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"), lastValidBlockHeight };
    },
    async buildPaymentTx({ buyer, seller, amountBase, memo }) {
      await guard();
      const b = new PublicKey(buyer), s = new PublicKey(seller);
      const from = getAssociatedTokenAddressSync(mint, b, false, TOKEN_2022_PROGRAM_ID);
      const to = getAssociatedTokenAddressSync(mint, s, false, TOKEN_2022_PROGRAM_ID);
      const tx = new Transaction()
        .add(createAssociatedTokenAccountIdempotentInstruction(b, to, s, mint, TOKEN_2022_PROGRAM_ID))
        .add(createTransferCheckedInstruction(from, mint, to, b, BigInt(amountBase), 6, [], TOKEN_2022_PROGRAM_ID))
        .add(new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [{ pubkey: b, isSigner: true, isWritable: false }], data: Buffer.from(memo, "utf8") }));
      return C._finish(tx, buyer);
    },
    async verifyPayment({ signature, buyer, seller, amountBase, memo }) {
      await guard();
      let tx = null;
      for (let i = 0; i < 10 && !tx; i++) { tx = await conn.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }); if (!tx) await new Promise(r => setTimeout(r, 1500)); }
      const r = { tx_confermata: 0, acquirente_firmatario: 0, importo_ok: 0, memo_ok: 0 };
      if (!tx || tx.meta?.err) return r;
      r.tx_confermata = 1;
      const keys = tx.transaction.message.accountKeys;
      r.acquirente_firmatario = keys.some(k => k.signer && k.pubkey.toBase58() === buyer) ? 1 : 0;
      const delta = (owner) => {
        const f = (arr) => (arr || []).filter(x => x.mint === C.vpayMint && x.owner === owner).reduce((s, x) => s + BigInt(x.uiTokenAmount.amount), 0n);
        return f(tx.meta.postTokenBalances) - f(tx.meta.preTokenBalances);
      };
      r.importo_ok = delta(seller) >= BigInt(amountBase) ? 1 : 0;
      const logs = (tx.meta.logMessages || []).join("\n");
      const memoIx = tx.transaction.message.instructions.find(i => i.programId.toBase58() === MEMO_PROGRAM.toBase58());
      r.memo_ok = (memoIx && (memoIx.parsed === memo)) || logs.includes(memo) ? 1 : 0;
      return r;
    },
    async faucet(wallet, amountBase) {
      await guard();
      const w = new PublicKey(wallet);
      const src = getAssociatedTokenAddressSync(mint, kp.publicKey, false, TOKEN_2022_PROGRAM_ID);
      const dst = await getOrCreateAssociatedTokenAccount(conn, kp, mint, w, false, "confirmed", undefined, TOKEN_2022_PROGRAM_ID);
      return await transferChecked(conn, kp, src, mint, dst.address, kp, BigInt(amountBase), 6, [], undefined, TOKEN_2022_PROGRAM_ID);
    },
    async vpayBalance(wallet) {
      try { const ata = getAssociatedTokenAddressSync(mint, new PublicKey(wallet), false, TOKEN_2022_PROGRAM_ID); const b = await conn.getTokenAccountBalance(ata); return b.value.amount; } catch { return "0"; }
    },
    async solBalance(wallet) { return await conn.getBalance(new PublicKey(wallet)); },
    // Possesso di un NFT esistente (Core o Token Metadata) su devnet o mainnet, SOLO LETTURA.
    async checkOwnership(rpcUrl, nftAddress, wallet) {
      const c2 = new Connection(rpcUrl, "confirmed");
      const info = await c2.getAccountInfo(new PublicKey(nftAddress));
      if (!info) return { ok: false, kind: null, reason: "indirizzo non trovato su questa rete" };
      if (info.owner.toBase58() === CORE_PROGRAM) {
        // Asset Core: byte 0 = Key (1 = AssetV1), owner nei byte 1..33
        if (info.data[0] !== 1) return { ok: false, kind: "core", reason: "non è un asset Core" };
        const owner = new PublicKey(info.data.subarray(1, 33)).toBase58();
        return { ok: owner === wallet, kind: "core", owner };
      }
      // Mint SPL/Token-2022 con supply 1 e 0 decimali: cerca un conto token del wallet con saldo 1
      const prog = info.owner.toBase58();
      if (prog !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" && prog !== TOKEN_2022_PROGRAM_ID.toBase58()) return { ok: false, kind: null, reason: "non è un NFT riconosciuto" };
      const mi = await c2.getParsedAccountInfo(new PublicKey(nftAddress));
      const p = mi.value?.data?.parsed;
      if (!p || p.type !== "mint" || p.info.decimals !== 0 || p.info.supply !== "1") return { ok: false, kind: "spl", reason: "il mint non è un NFT (supply 1, 0 decimali)" };
      const accts = await c2.getParsedTokenAccountsByOwner(new PublicKey(wallet), { mint: new PublicKey(nftAddress) });
      const has = accts.value.some(a => a.account.data.parsed.info.tokenAmount.amount === "1");
      return { ok: has, kind: "spl-nft" };
    },
  };
  return C;
}
