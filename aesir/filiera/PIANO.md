# Filiera ZDOS · piano a fasi
_28/11/2026 · ÆSIR / z-xSOLANA · redatto dopo la ricerca sul VPS vmi3082470 (5.189.180.13)_

## Visione (come la presentiamo)
**vBLOCKCHAIN è il ledger ZDOS programmabile in Zlang, ancorato su Solana.** La sua forza non è la velocità
o la sicurezza contro Solana (che resta la base di regolamento), ma le **dinamiche che una chain singola non offre**:
- tutte le monete in un registro unico (VELVET/$OV, xZDOS/$DSN, L$D Dom-Coin, $DSN Polygon);
- merito, miner, zAI, DEX e badge che parlano tra loro tramite eventi firmati (bus zcomm);
- regole programmabili in Zlang (premi, sblocchi, quest, gate) che reagiscono a eventi cross-servizio;
- prova pubblica su Solana tramite ancore Memo (radici hash), senza emettere nuovi token.

## Fase 1 — fatta (questo giro)
| Pezzo | Dove | Stato |
|---|---|---|
| ÆSIR · Filiera (admin) | https://x-zdos.it/aesir/ (auth staff esistente `htpasswd-velvet-staff`, non modificato) | online |
| Aggregatore sola lettura | `aesir-filiera.service` · 127.0.0.1:4196 · `/opt/zdos-filiera` | online |
| ZDOS Miner (sostituisce l'idea XMRig) | `zdos-miner.service` · 127.0.0.1:4197 · `/opt/zdos-miner` · `Restart=always`, `CPUQuota=25%`, `Nice=19`, CPU/IO idle | sempre attivo |
| Bus unico | zcomm (HMAC) con nuovi tipi `work_proof`, `vchain_root`, `service_health`, `pool_snapshot` e sorgenti `zminer`, `filiera`, `vchain`, `zpool`, `zbasket`, `dex`, `vcpu`, `kira`; client `/opt/zdos-filiera/zbus.mjs` | online |
| vBLOCKCHAIN | nuovo endpoint locale `POST /api/vchain/work-root` (solo 127.0.0.1 + firma HMAC, max 1/ora) → blocchi `ZMINER_WORK_ROOT` | online |

Lavori del miner (ogni lavoro = prova hash-concatenata → evento zcomm; ogni 6 h radice Merkle → blocco vBLOCKCHAIN → ancora Memo esistente):
`health` (26 servizi + 9 URL, 2 min) · `index_pools` (DexScreener + Meteora DLMM + Jupiter, 5 min) · `index_balances` (5 wallet ufficiali + supply, 10 min) ·
`vchain_verify` (catena e hash, 10 min) · `anchor_check` (15 min) · `zcomm_audit` (10 min) · `zai_inference` (riassunto salute via zcore-vcpu, 3 h).
I **punti lavoro** sono un contatore di rete: non sono VELVET, non sono token e non entrano nei premi merito (eventi senza attore).

## Fase 2 — connettori Zlang (monete e pool)
- `zlang/std/coins.zl`: tabella monete (mint, decimali, rete) generata da `/opt/zdos-miner/common.mjs` → unica fonte di verità.
- Connettori in sola lettura esposti alla VM ZLB2 come syscall: `coin.balance(wallet, mint)`, `coin.supply(mint)`, `pool.get(addr)`, `price.jup(mint)`; servite dal miner (cache) per non martellare le RPC.
- Il Web IDE `/ide/` ottiene un pannello "Filiera" con questi connettori (solo lettura, nessuna chiave nel browser).
- Correzione da fare: le `RAILS` di vBLOCKCHAIN puntano a porte sbagliate (desk 8868 = Unified Studio, swap 8895 = RPC; il DEX vero è 8897, zdesk 8787).

## Fase 3 — strumenti stile Meteora in Zlang
Base: Meteora DLMM Data API `https://dlmm.datapi.meteora.ag` (pubblica, 30 rps) + SDK `@meteora-ag/dlmm` (TypeScript).
1. **Quote** (sola lettura): prezzo e bin attivo del pool, stima uscita con fee dinamica → `zlang: dlmm.quote(pool, amountIn, side)`.
2. **Posizioni** (sola lettura): posizioni di un wallet via `/positions` del Data API → pannello in Pay e in ÆSIR.
3. **Add/Remove liquidity solo con firma utente**: il server costruisce la transazione non firmata con l'SDK, il browser la firma con Phantom; nessuna chiave sul server, nessun fondo nostro.
4. Liquidità "di casa" (tesoreria/fondo) **solo con ok esplicito di doc e importo scritto**, una operazione alla volta.
Oggi i pool reali sono: **L$D-SOL Meteora DLMM** `383iZ9…jkze` (~37 $ TVL, Jupiter: liquidità ~0,83 $, segnalato); **VELVET** ancora sulla curva pump.fun (liquidità Jupiter ~2.100 $); **xZDOS** nessun pool né prezzo.

## Fase 4 — Pay come portale cartoon BDSM (non esplicito)
Si lascia com'è (manifesto HOLD e deck XMRig restano su richiesta di doc) e si aggiunge sopra:
- i 4 personaggi (Mr. Paddle, Miss Wand, Lady Whip, Twin Cuffs) diventano "agenti" della Filiera: ognuno mostra dati veri di un servizio (saldi, rete, Phantom, firme) e reagisce agli eventi del bus (es. Lady Whip "schiocca" quando arriva una prova del miner);
- mini-giochi che danno solo **punti/badge** (eventi zcomm), mai token;
- percorso "Dungeon della Filiera": monete → pool Meteora (quote) → merito → vBLOCKCHAIN, tutto animato con dati live;
- stile cartoon, nessun nudo né contenuto esplicito; 18+ per tono.

## Fase 5 — miner di rete aperto
- Nodi esterni (MSI `msi-zpool-worker.js`, poi community) eseguono gli stessi lavori e firmano le prove con una chiave del nodo; il server ricontrolla a campione.
- Solo allora le prove possono avere un **attore OV-XXXX** e generare punti merito, con tetto settimanale e senza cambiare le regole del fondo (ok di doc richiesto).

## Realistico / non realistico
- ✅ Composabilità tra tutte le monete e i servizi, regole Zlang, eventi cross-servizio, prove ancorate su Solana.
- ✅ Strumenti Meteora reali (quote, posizioni, liquidità con firma utente).
- ❌ "Blockchain più potente di tutte" in senso di throughput/sicurezza: vBLOCKCHAIN è un ledger di un solo server ancorato su Solana; lo diciamo così.
- ❌ Mining crypto su Contabo (XMRig resta fermo: rischio sospensione VPS).
- ❌ Nuovi token o mint, liquidità automatica, movimenti di fondi senza ok esplicito.

## Cose trovate da sistemare (non toccate in questo giro)
- **Ancore vBLOCKCHAIN su devnet**, non mainnet (`.env.anchor`): le firme "Solana" sono di devnet; 1 riuscita su 9 nel registro. Per passare a mainnet servono SOL sul keypair `CEok…4k9m` (oggi 0 su mainnet) → serve ok di doc con cifra.
- `zdos-bonk-treasury-miner` invia ogni 12 s un hashrate fisso (5.400 H/s) a Z-Pool: è simulato. Z-Pool mostra quindi hashrate non verificati.
- `zdos-bonk-real` fermo in pm2; `velvet-hub-app` (:3000) e `velvet-hub-standalone` (:8898) sono doppioni.
- Hash di vBLOCKCHAIN: il miner ricalcola 2 hash su 3 non-genesi; uno è stato scritto con una formula diversa (da verificare, nessuna perdita).
- ÆSIR esiste come repo `high-cde/zdos-aesir` (script Python: gate DSN Polygon, policy Rust default-deny, status server) ma non come pannello web: la Filiera su `/aesir/` è il suo pannello.
- `$HOLD` non ha un mint on-chain (`hybrid:HOLD:velvet`).
