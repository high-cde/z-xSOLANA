/* zhost — host dell'IDE per storage.read su percorsi chain/ (sola lettura).
 * In Zlang storage.read legge un percorso dentro un namespace autorizzato (vedi zlang/tools/zlang_storage_read.py).
 * Nell'IDE il namespace chain/ è risolto da questo host JavaScript con chiamate RPC pubbliche di sola lettura.
 * La VM Rust non esegue storage.read (UNKNOWN_OPCODE): il valore lo legge l'host, non il bytecode.
 * Nessuna firma, nessuna transazione, nessuna chiave.
 *
 * Percorsi supportati:
 *   chain/solana/<mainnet|devnet>/mint/<MINT>                 supply, decimali, authority, nome/simbolo
 *   chain/solana/<mainnet|devnet>/balance/<OWNER|@wallet>/<MINT>  saldo sul conto token associato (ATA)
 *   chain/solana/<mainnet|devnet>/sol/<OWNER|@wallet>          saldo SOL
 *   chain/polygon/erc20/<0xTOKEN>                               nome, simbolo, decimali, totalSupply
 *   chain/polygon/erc20/<0xTOKEN>/balance/<0xOWNER>             balanceOf */
(function (root) {
  'use strict';
  const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
  const TOKEN_V1 = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
  const METAPLEX = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
  const POLYGON_RPCS = ['https://polygon-bor-rpc.publicnode.com', 'https://polygon.drpc.org'];
  const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  const EVM = /^0x[0-9a-fA-F]{40}$/;
  const NET = { mainnet: 'mainnet-beta', devnet: 'devnet' };

  function fmtUnits(raw, dec) {
    const s = BigInt(raw).toString().padStart(dec + 1, '0');
    const int = s.slice(0, s.length - dec); const frac = dec ? s.slice(s.length - dec).replace(/0+$/, '') : '';
    return BigInt(int).toLocaleString('it-IT') + (frac ? ',' + frac : '');
  }
  function b64(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function metaplexNameSymbol(u8) {
    // Metadata v1: key(1) updateAuthority(32) mint(32) name(u32+bytes) symbol(u32+bytes) uri(u32+bytes)
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); const dec = new TextDecoder();
    let o = 65; const read = () => { const n = dv.getUint32(o, true); o += 4; const s = dec.decode(u8.slice(o, o + n)).replace(/\0+$/, ''); o += n; return s; };
    const name = read(); const symbol = read(); return { name, symbol };
  }

  async function solMint(cluster, mint) {
    const info = await root.ZComm.rpc(cluster, 'getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
    if (!info || !info.value) throw new Error('mint non trovato su ' + cluster);
    const v = info.value; const p = v.data && v.data.parsed;
    if (!p || p.type !== 'mint') throw new Error('l\'indirizzo non è un mint SPL');
    const i = p.info; const ext = i.extensions || [];
    const out = { programma: v.owner === TOKEN_2022 ? 'Token-2022' : v.owner === TOKEN_V1 ? 'SPL Token' : v.owner, supply: fmtUnits(i.supply, i.decimals), decimali: i.decimals,
      'mint authority': i.mintAuthority || 'revocata', 'freeze authority': i.freezeAuthority || 'revocata' };
    const tm = ext.find((x) => x.extension === 'tokenMetadata');
    const mp = ext.find((x) => x.extension === 'metadataPointer');
    if (tm) { out.nome = tm.state.name; out.simbolo = tm.state.symbol; }
    else if (mp && mp.state.metadataAddress && mp.state.metadataAddress !== mint) {
      const m = await root.ZComm.rpc(cluster, 'getAccountInfo', [mp.state.metadataAddress, { encoding: 'base64' }]);
      if (m && m.value && m.value.owner === METAPLEX) { const ns = metaplexNameSymbol(b64(m.value.data[0])); out.nome = ns.name; out.simbolo = ns.symbol; }
    }
    if (ext.length) out.estensioni = ext.map((x) => x.extension).join(', ');
    return out;
  }
  async function solBalance(cluster, owner, mint) {
    const mi = await root.ZComm.rpc(cluster, 'getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
    if (!mi || !mi.value) throw new Error('mint non trovato');
    const { PublicKey } = root.solanaWeb3;
    const [ata] = PublicKey.findProgramAddressSync([new PublicKey(owner).toBuffer(), new PublicKey(mi.value.owner).toBuffer(), new PublicKey(mint).toBuffer()], new PublicKey(ATA_PROGRAM));
    const a = await root.ZComm.rpc(cluster, 'getAccountInfo', [ata.toBase58(), { encoding: 'jsonParsed' }]);
    const dec = mi.value.data.parsed.info.decimals;
    if (!a || !a.value) return { wallet: owner, 'conto token': ata.toBase58(), saldo: '0', nota: 'conto token associato non ancora creato' };
    return { wallet: owner, 'conto token': ata.toBase58(), saldo: fmtUnits(a.value.data.parsed.info.tokenAmount.amount, dec), decimali: dec };
  }
  async function solSol(cluster, owner) {
    const r = await root.ZComm.rpc(cluster, 'getBalance', [owner]);
    return { wallet: owner, SOL: fmtUnits(String(r.value), 9) };
  }

  async function evmCall(to, data) {
    let lastErr = null;
    for (const url of POLYGON_RPCS) {
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }) });
        const j = await res.json();
        if (j.error) { lastErr = new Error(j.error.message || 'errore RPC'); continue; }
        return j.result;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('RPC Polygon non raggiungibile');
  }
  function abiString(hex) {
    const h = hex.slice(2); if (h.length < 128) return '';
    const len = parseInt(h.slice(64, 128), 16); const bytes = h.slice(128, 128 + len * 2);
    const u = new Uint8Array(len);
    for (let i = 0; i < len; i++) u[i] = parseInt(bytes.substr(i * 2, 2), 16);
    return new TextDecoder().decode(u);
  }
  async function erc20(token) {
    const [n, s, d, t] = await Promise.all(['0x06fdde03', '0x95d89b41', '0x313ce567', '0x18160ddd'].map((x) => evmCall(token, x)));
    const dec = Number(BigInt(d));
    return { rete: 'Polygon PoS', nome: abiString(n), simbolo: abiString(s), decimali: dec, totalSupply: fmtUnits(BigInt(t).toString(), dec) };
  }
  async function erc20Balance(token, owner) {
    const [d, b] = await Promise.all([evmCall(token, '0x313ce567'), evmCall(token, '0x70a08231' + owner.slice(2).toLowerCase().padStart(64, '0'))]);
    return { wallet: owner, saldo: fmtUnits(BigInt(b).toString(), Number(BigInt(d))) };
  }

  // Risolve un percorso chain/. ctx.wallet = indirizzo Phantom collegato (per @wallet), se c'è.
  async function resolve(path, ctx) {
    const p = path.split('/');
    if (p[0] !== 'chain') return null; // non è nel namespace chain/: l'IDE non lo gestisce
    const wallet = (x) => { if (x !== '@wallet') return x; if (!ctx || !ctx.wallet) throw new Error('@wallet: collega Phantom per usare il tuo indirizzo'); return ctx.wallet; };
    if (p[1] === 'solana') {
      const cl = NET[p[2]]; if (!cl) throw new Error('rete Solana non supportata: usa mainnet o devnet');
      if (p[3] === 'mint' && p.length === 5 && B58.test(p[4])) return solMint(cl, p[4]);
      if (p[3] === 'balance' && p.length === 6) { const o = wallet(p[4]); if (!B58.test(o) || !B58.test(p[5])) throw new Error('indirizzo non valido'); return solBalance(cl, o, p[5]); }
      if (p[3] === 'sol' && p.length === 5) { const o = wallet(p[4]); if (!B58.test(o)) throw new Error('indirizzo non valido'); return solSol(cl, o); }
    }
    if (p[1] === 'polygon' && p[2] === 'erc20' && EVM.test(p[3] || '')) {
      if (p.length === 4) return erc20(p[3]);
      if (p[4] === 'balance' && p.length === 6) { if (!EVM.test(p[5])) throw new Error('indirizzo 0x non valido (@wallet vale solo per Solana)'); return erc20Balance(p[3], p[5]); }
    }
    throw new Error('percorso chain/ non riconosciuto');
  }
  function format(obj) { return Object.keys(obj).map((k) => k + ' ' + obj[k]).join(' · '); }
  root.ZHost = { resolve, format, fmtUnits, abiString };
})(window);
