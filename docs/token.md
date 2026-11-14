# Token dell'ecosistema: decisione

**Decisione (14 novembre 2026, ZDOS1.3).**

## $DSN: ufficiale su entrambe le catene

| Catena | Standard | Indirizzo | Decimali | Supply |
| --- | --- | --- | --- | --- |
| Polygon PoS (chain id 137) | ERC-20 | `0xfc90516a1f736FaC557e09D8853dB80dA192c296` | 18 | 1.000.000.000 |
| Solana mainnet | Token-2022 | `35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4` | 6 | 1.000.000.000.000 |

## xZDOS pump.fun (legacy, non $DSN ufficiale)

| Catena | Standard | Mint | Nota |
| --- | --- | --- | --- |
| Solana mainnet | (pump.fun) | `EnxZzNG8ZarHt1Tez4ipu5yUnXj8rAbyAnXttxnMpump` | Resta in watchlist con questa etichetta. Non è il $DSN ufficiale e non va cancellato: è il vecchio token xZDOS lanciato su pump.fun. |

## VELVET ($OV): token community

| Catena | Standard | Mint | Decimali | Supply |
| --- | --- | --- | --- | --- |
| Solana mainnet | Token-2022 | `2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump` | 6 | 1.000.000.000 |

VELVET è un token community: **nessun rendimento, nessuna promessa finanziaria**.

## Come li usa Æsir

- `DSN_CHAIN=both` è il default: una richiesta non umana passa se **uno qualsiasi** dei wallet del richiedente (`requester_wallet` / `requester_wallets`) supera la soglia della sua catena. `0x…` si controlla su Polygon, base58 su Solana.
- Soglie in token interi, scalate dai decimali e modificabili in `dsn.env`: $DSN Polygon 1 / 10, $DSN Solana 1000 / 10000 (stessa quota di supply).
- VELVET è un asset **opzionale e spento** (`VELVET_ENABLED=0`). Scelta: il gate nasce come accesso $DSN, e VELVET non deve sembrare un requisito né un investimento. Se acceso, soglie 100.000 / 1.000.000 VELVET (0,01% e 0,1% della supply), modificabili.
- Sui saldi Solana il gate prova la chiamata indicizzata e, se l'RPC la rifiuta, legge direttamente il conto associato (ATA) con `getAccountInfo`.
- $DSN e VELVET in zdesk compaiono solo come «staking a punti, nessun rendimento» (solo progetto).

## Dove compaiono nel monorepo

- `aesir/`: gate multi-catena (`DSN_CHAIN=both|polygon|solana`, default `both`), VELVET opzionale e spento. Test: `aesir/tests/test_aesir.py` (26).
- `zdesk/app/`: Radar → Watchlist e watchlist del desk (`lib/sources.js`) con $DSN ufficiale Solana, VELVET e xZDOS pump.fun legacy. In Staking, $DSN e VELVET solo come «staking a punti, nessun rendimento». Se un mint non ha ancora un mercato su DexScreener, il dettaglio non va in errore (`noPair`).
- `zdos/`, `zlang/`, `labs/hybrid-prototype/`: README con entrambi gli indirizzi $DSN.
