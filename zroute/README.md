# zRoute · swap con K.I.R.A. sopra Jupiter

© 2026 ZDOS1.3 — P.IVA 11040550961 · Licenza ZSEL proprietaria (vedi `../LICENSE`).

Live: https://swap.x-zdos.it/zroute/

## Cosa fa
- **Quotazione**: API pubblica Jupiter swap v1 (`lite-api.jup.ag/swap/v1`, riserva `api.jup.ag/swap/v1`), `/quote` e `/swap`.
- **K.I.R.A. prima della quotazione** (`site/kira-core.js`, lo stesso modulo usato dal bot Discord):
  - mint e freeze authority;
  - estensioni Token-2022 (permanent delegate, non trasferibile, stato frozen di default, transfer hook, tassa sui trasferimenti, pausabile);
  - supply e decimali;
  - holder principali, con le pool/AMM escluse: via RPC `getTokenLargestAccounts` se l'endpoint lo permette, altrimenti con `topHolders` di RugCheck;
  - rischi e stato "rugged" da RugCheck, liquidità stimata.
- **Blocco**: se il token che **compri** ha un controllo `fail`, il pulsante Swap si disattiva. La vendita non viene mai bloccata. Con avvisi (`warn`) serve una conferma esplicita.
- **Percorso**: `routePlan` spiegato in italiano, con passi, percentuali e DEX, più impatto sul prezzo, minimo garantito e slippage.
- **Firma**: solo nel Phantom dell'utente. Senza Jito: `signAndSendTransaction`, priority fee fino a 0,0001 SOL. Nessuna chiave sul server.
- **Commissioni**: zero. `platformFeeBps` e `feeAccount` non vengono inviati. Per attivare una fee bisognerebbe passare `platformFeeBps` a `/quote` e un `feeAccount` a `/swap`. Oggi è volutamente spento.

## Protezione MEV (Jito)
Con l'opzione attiva:
1. `/swap` viene chiamato con `prioritizationFeeLamports: { jitoTipLamports: <tip scelta> }`, e Jupiter aggiunge alla transazione un trasferimento SOL verso un tip account Jito.
2. zRoute decodifica la transazione (`VersionedTransaction`) e controlla che ci sia **esattamente un** trasferimento dal tuo wallet a un tip account, letto da `getTipAccounts` del block engine, con importo uguale alla tip scelta. Se non torna, l'invio viene annullato.
3. Phantom firma soltanto (`signTransaction`). La transazione firmata va a `https://mainnet.block-engine.jito.wtf/api/v1/transactions?bundleOnly=true` (`sendTransaction`), quindi passa solo come bundle e non viene inoltrata in chiaro al mempool degli RPC.

Verificato il 15/11/2026:
- CORS del block engine aperto per `swap.x-zdos.it`;
- tip presente e verificabile nella transazione generata da Jupiter.

Il passo 3 su mainnet richiede fondi reali, quindi non l'abbiamo eseguito nei test: l'ultima tappa resta da provare con un primo swap piccolo.

## Limiti dichiarati
- $DSN su Solana (`35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4`) non ha pool: Jupiter risponde `TOKEN_NOT_TRADABLE` e zRoute lo mostra.
- Gli RPC pubblici limitano `getTokenLargestAccounts`; in quel caso gli holder arrivano da RugCheck oppure risultano "n/d".
- K.I.R.A. è un filtro su red flag noti, non un audit: un token che passa i controlli non è per questo sicuro.

## Build
`vendor/solana-web3-zroute.min.js` è un bundle esbuild di `@solana/web3.js` 1.x (`VersionedTransaction`, `PublicKey`) a partire da `sol-entry.js`, con licenza MIT (vedi `vendor/solana-web3.LICENSE`).

## Test
`node tests/e2e-local.cjs http://127.0.0.1:8899/zroute/ ./screens/` usa quote reali di Jupiter e controlli K.I.R.A. reali. Phantom è simulato e rifiuta sempre la firma.
