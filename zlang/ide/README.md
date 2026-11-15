# Zlang IDE

IDE web statico in stile Remix per ZLang su z-xSOLANA. Online su https://x-zdos.it/ide/.
ZDOS1.3 — P.IVA 11040550961. Licenza proprietaria ZSEL, tutti i diritti riservati
(le librerie in `vendor/` restano sotto le loro licenze MIT, incluse accanto ai file).

## Cosa fa davvero

| Pannello | Cosa succede | Reale? |
| --- | --- | --- |
| File | File `.zlang` / `.zl` in `localStorage` del browser: nuovo, rinomina, elimina, carica, scarica, modelli. | Sì, solo locale. |
| Editor | CodeMirror 5 (vendor locale, niente CDN) con evidenziazione ZLang. | Sì. |
| Compila · zlangc | Port JS di `zlang/tools/zlangc.py`: bytecode ZLB2 v2.5 e header C. Identico byte per byte all'originale (`tests/zlangc-parity.mjs`). | Sì. |
| Compila · Rust | `zlang/src/compiler` + `zlang/src/vm` compilati in WASM senza modifiche (`zlang/wasm/`, sorgenti inclusi via `#[path]`). | Sì. |
| Esegui | `ZVirtualMachine` (vCPU 16 registri, 4 KB vRAM, max 3000 cicli) nel browser. | Sì. |
| Deploy & Run | Ancoraggio: transazione Memo con lo SHA-256 del bytecode, firmata dall'utente in Phantom, inviata via zcomm-rpc. Devnet di default; mainnet solo dopo conferma esplicita. Verifica di una firma esistente. | Sì, ma **non è un deploy di contratti**. |
| K.I.R.A. Guard | (1) Regole statiche sui due toolchain. (2) Port parziale di `kiraChecks()` di `zdesk/app/lib/radar.js`: mint/freeze authority, supply, estensioni Token-2022 via RPC. Top holder, LP, insider e RugCheck restano nel Radar di zdesk. | Parziale, dichiarato. |
| zcomm | Log di ogni chiamata RPC nella busta del gateway Zcomm; endpoint personalizzabile; test connessione. | Sì. |

## Limiti onesti

- ZLang oggi non genera programmi Solana (SBF/BPF), né Rust/Anchor. Non esiste quindi un deploy di smart contract su Solana: "Deploy" registra on-chain l'hash del bytecode.
- I due compilatori reali supportano un sottoinsieme minimo: `emit`, `let` (interi; la VM Rust esegue solo `a - b`), e per zlangc anche `if … jump`, etichette, `wait`, `storage.read`. La VM Rust ignora le istruzioni che non conosce (`UNKNOWN_OPCODE`). La specifica `docs/language-spec.md` (funzioni, tipi, moduli) è un progetto non ancora implementato.
- Il faucet RPC di devnet è chiuso: i SOL di test si prendono da faucet.solana.com.
- L'RPC pubblico mainnet di Solana Labs rifiuta le chiamate dai browser (403): per mainnet si usa `solana-rpc.publicnode.com`, come in ZSwap.
- In Phantom va attivata la modalità testnet su Devnet, altrimenti l'anteprima della firma può mostrare un avviso.

## zcomm: cosa è e come è usato

Nel codice di high-cde:
- `high-cde/Zcomm`: README di una riga, `api/zcomm_gateway.js` (classe `ZCommGateway` v4.0.0-sovereign con `encryptPayload(sender, recipient, payload)` che **non cifra**: restituisce `{ sender, recipient, payload, timestamp }`), un descrittore `.zl` di driver per sensori e una landing page.
- `high-cde/zlang-core/zcomm/zcomm_core.zlang`: modulo che stampa messaggi di modalità rete (mesh/VPS); nessun trasporto reale.

Non c'è quindi un protocollo di comunicazione funzionante da riusare. Nell'IDE `assets/zcomm.js` è lo strato di comunicazione verso Solana JSON-RPC (zcomm-rpc): usa la stessa busta del gateway per registrare ogni chiamata e, come il gateway, non aggiunge cifratura applicativa (il canale è HTTPS). Nessuna chiave privata passa da zcomm: firma solo Phantom.

## Sicurezza

- Nessuna chiave sul server, nessuna firma automatica, nessun trasferimento di token.
- CSP restrittiva: script solo dal sito, `wasm-unsafe-eval` per il compilatore, connessioni solo HTTPS.

## Build e test

```
bash zlang/ide/build.sh                         # ricompila zlang.wasm + test di parità zlangc
node zlang/ide/tests/e2e.cjs http://127.0.0.1:8931/   # test headless (playwright-core + Chrome)
```

Versioni vendor: CodeMirror 5.65.21, @solana/web3.js 1.99.0 (solo Transaction, TransactionInstruction, PublicKey, bundle esbuild).
