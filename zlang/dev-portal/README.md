# Portale sviluppatori Zlang

Sito statico pubblicato su https://x-zdos.it/dev/. ZDOS1.3, licenza proprietaria ZSEL.

| Pagina | Contenuto |
| --- | --- |
| `/dev/` | Quickstart, esempi, monete in breve, stato reale dei componenti |
| `/dev/linguaggio/` | Sintassi supportata da zlangc v2.5 e dalla VM Rust, formato ZLB2, `storage.read` e namespace `chain/` |
| `/dev/esempi/` | I modelli dell'IDE con il codice e il link "Apri nell'IDE" (`/ide/?esempio=<nome>`) |
| `/dev/monete/` | $DSN su Solana e Polygon, VELVET su Solana: dati letti on-chain dal browser, link agli explorer |
| `/dev/api/` | `ecosystem.json`, API di verifica del bot Discord, RPC pubblici usati e loro limiti |

## Come si genera

```
python3 zlang/dev-portal/build.py
```

`build.py` legge i modelli da `zlang/ide/assets/ide.js`, li compila con `zlang/tools/zlangc.py` per riportarne byte e istruzioni, e scrive gli `index.html`. I valori di riserva delle schede (mostrati se l'RPC non risponde) e il numero di conti con saldo sono una rilevazione datata del 21/11/2026; tutto il resto viene letto dal browser con `getAccountInfo` (Solana) ed `eth_call` (Polygon), in sola lettura.

## Regole

- Nessuna chiave, nessuna firma, nessuna transazione dal portale.
- Nessun prezzo, nessuna promessa di rendimento, nessun link a launchpad.
- CSP: script solo dal sito; connessioni solo verso gli RPC pubblici elencati.
