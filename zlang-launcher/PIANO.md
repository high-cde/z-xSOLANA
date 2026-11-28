# ZLang Launcher by ZDOS — piano di progetto

*ZDOS1.3 · P.IVA 11040550961 · versione 1.0 del 28 novembre 2026 · stato: proposta. La demo è su `https://x-zdos.it/launcher/` e funziona solo in simulazione: nessuna transazione reale.*

> Informazione tecnica, non è un consiglio di investimento. Nessun rendimento è promesso. Ogni parametro economico di questo piano è una **proposta da confermare** e può cambiare prima del lancio.

## 1. Che cosa vogliamo costruire

Un lanciatore di token su Solana che sia semplice, leggero e onesto, tutto con identità **ZLang by ZDOS**. Resta su Solana: nessuna nuova chain, nessun validatore da gestire. Quello che costruiamo è la parte nostra:

- una **specifica di lancio in ZLang**: ogni lancio è descritto da un testo dichiarativo che chiunque può leggere, con la sua impronta (hash) pubblicata;
- un **router delle commissioni ZDOS**: una quota fissa e visibile di ogni lancio va al *party pool*;
- il **party pool**: un indirizzo pubblico che finanzia faucet e airdrop a merito;
- un **front-end leggero**, mobile-first, senza librerie pesanti, senza timer finti.

L$D (Dom-Coin) resta la moneta di comunità dell'ecosistema: mint `FSwCz9qgcvfWGEU8QU3h4fQpyQ8TB2KLHYC9bmoMxDgP`, 6 decimali, 200M di supply, mint e freeze authority revocati. Il launcher non modifica L$D né i suoi parametri.

### Principi (non negoziabili)

1. **Nessun FOMO**: niente timer finti, niente contatori inventati, niente promesse di guadagno.
2. **Nessuna custodia**: chi lancia firma con il proprio wallet. ZDOS non tiene fondi di terzi né chiavi del titolare sul server.
3. **Sicuro di default**: mint e freeze revocati, liquidità bloccata, metadati completi.
4. **Numeri veri**: ogni cifra o è calcolata dai parametri o ha una fonte; il resto è scritto come *esempio*.
5. **Niente wash trading, niente distribuzione finta**; le soglie K.I.R.A. non cambiano.

## 2. Architettura

### 2.1 Flusso di creazione

1. **Spec ZLang.** Il form (nome, simbolo, supply, immagine, opzioni di sicurezza) produce una specifica `launch ZLangLaunch { … }` e ne calcola l'hash SHA-256.
2. **Compilazione in istruzioni.** Un costruttore deterministico traduce la specifica in istruzioni Solana, in 2–3 transazioni, tutte costruite nel browser di chi lancia:
   1. creazione del mint (SPL Token di default; Token-2022 come opzione con metadati dentro il mint);
   2. creazione del conto token del creatore e conio dell'intera supply;
   3. metadati (nome, simbolo, immagine);
   4. **revoca della mint authority** e **revoca della freeze authority**;
   5. creazione del pool di liquidità SOL + token e deposito iniziale;
   6. **blocco permanente della liquidità** (LP lock);
   7. trasferimenti della commissione ZDOS: quota al party pool, quota al servizio;
   8. un'istruzione Memo con l'hash della specifica (`ZLANG:LAUNCH:v1:<hash>`): è la *ricevuta ZLang*, verificabile da chiunque.
3. **Firma del creatore.** Il wallet mostra le istruzioni; il creatore firma. Il sito non firma e non invia nulla al posto suo.
4. **Controlli K.I.R.A.** dopo il lancio il token entra nella lettura K.I.R.A. in sola lettura, con le soglie esistenti (invariate).

### 2.2 Standard del token

- **SPL Token** è il default: massima compatibilità con wallet e aggregatori, metadati in un conto dedicato.
- **Token-2022** è un'opzione: metadati nel mint, meno conti. Va abilitato solo dopo prove su devnet, perché non tutti i wallet gestiscono ogni estensione. Estensioni pericolose (transfer fee, permanent delegate, freeze di default) **non sono ammesse** dal launcher.

### 2.3 Liquidità

Il pool nasce subito alla creazione, senza fase "a curva" che spinga alla corsa. Il creatore sceglie quanta parte della supply mettere nel pool e quanti SOL depositare; il prezzo iniziale è il rapporto tra i due. Di default il 100% della supply va nel pool e la posizione è bloccata per sempre.

> *Nota tecnica:* la liquidità sta su un protocollo Solana standard, aperto e verificabile on-chain; il pool è quindi visibile agli aggregatori che indicizzano i pool Solana. La visibilità non è garantita e dipende dall'indicizzazione e dalla liquidità.

### 2.4 Router delle commissioni ZDOS

- **Fase 1 (senza programma nostro):** la commissione è formata da due istruzioni di trasferimento SOL dentro la stessa transazione del lancio, verso due indirizzi pubblici. Tutto è visibile su qualunque explorer. Limite onesto: la regola è applicata dal nostro front-end, non dalla chain.
- **Fase 5 (programma `zdos_fee_router`):** un programma ZDOS con configurazione on-chain (ripartizione in punti base, indirizzi, autorità in multisig) che applica la regola e scrive un evento a ogni lancio. Richiede audit e firma del titolare del tesoro.

<!--INTERNO-->
### 2.5 Nota tecnica interna (non pubblicata): protocolli usati

- **Pool:** DAMM v2 (pool a prodotto costante, posizione come NFT Token-2022) tramite l'SDK ufficiale del protocollo. Alternativa: DLMM, più costosa per via dei bin array non rimborsabili (circa 0,075 SOL ciascuno, fonte `docs.meteora.ag/user-guides/getting-started-with-meteora`); per un token nuovo, DAMM v2 è più economico e più semplice.
- **Blocco LP:** opzione "permanently lock" nella creazione del pool; la liquidità bloccata continua a maturare commissioni, il creatore può ancora riscuoterle (fonte `docs.meteora.ag/core-products/damm-v2/nft-positions`).
- **Fee del pool:** base fee da 1 bps (0,01%) a 9.900 bps, schedulatore opzionale (fonte `docs.meteora.ag/core-products/damm-v2/fees/overview`).
- **Aggregatori:** il pool viene indicizzato dai principali aggregatori; la *verifica* del token (badge) è un processo a parte e non è automatico.
- **Test su devnet** dell'SDK prima di qualunque passaggio su mainnet.
<!--/INTERNO-->

## 3. Modello commissioni ZDOS (proposta)

| Voce | Proposta | A chi va |
|---|---|---|
| Commissione di lancio ZDOS | **0,01 SOL** fissi per lancio | 50% party pool, 50% servizio ZDOS |
| Commissione di scambio ZDOS | **0%** | — |
| Commissione del pool | scelta del creatore, default **0,25%** | alla posizione di liquidità del creatore |
| Costi di rete (rent e firme) | al costo, senza ricarico | alla rete Solana |
| Pagamento in L$D | non in fase 1 (serve un prezzo affidabile, il pool L$D è sottile) | — |

Perché così: la commissione ZDOS è piccola, fissa e visibile, e non prende nulla sugli scambi. Il costo reale di un lancio è soprattutto il deposito di rete (rent) che Solana richiede per creare i conti. Il costo tipico stimato di un lancio, senza contare la liquidità che il creatore deposita, è **circa 0,045 SOL** (dettaglio al §8).

Possibili estensioni, da valutare dopo il pilota: commissione iniziale decrescente contro i bot (tetto basso, pochi minuti, mai al 99%), sconti per chi paga in L$D quando ci sarà un prezzo affidabile.

## 4. Party pool

**Cos'è.** Un indirizzo pubblico (meglio un multisig) che riceve la metà della commissione di lancio ZDOS. Ogni lancio "attiva" il party pool aggiungendogli 0,005 SOL: questo è tutto il meccanismo, e si verifica sulla chain.

**A cosa serve.** Finanzia, con regole pubbliche, i round di faucet e di airdrop a merito. Non è un fondo di rendimento: nessuno ci deposita aspettandosi un ritorno e nessuno riceve interessi.

**Parole oneste:**

- il party pool *non* garantisce nulla ai token lanciati e *non* sostiene il loro prezzo;
- l'importo è la somma reale delle commissioni, nient'altro; in demo si vede solo un contatore locale del tuo browser, non dati reali;
- ogni uscita dal party pool è una transazione pubblica firmata dal titolare del tesoro o dal multisig;
- eventuali conversioni in L$D (acquisti sul pool) sono dichiarate in anticipo e mai fatte per muovere il prezzo.

Il Pool Party a merito già descritto per l'ecosistema (distribuzione per attività verificata, il capitale pesa al massimo come moltiplicatore con tetto) resta il criterio con cui i fondi del party pool vengono distribuiti.

## 5. Faucet

**Scopo:** far provare L$D con piccole quantità, una volta per wallet e per periodo.

**Regole proposte (parametri di esempio, da decidere):**

- importo piccolo e fisso per richiesta (es. 50 L$D), una richiesta ogni 7 giorni per wallet;
- **età del wallet**: almeno N giorni (es. 14) e almeno una transazione precedente, letti dalla chain;
- **firma di un messaggio** (non una transazione) che prova il possesso del wallet, con nonce e dominio per evitare il riuso;
- **limite di frequenza** per indirizzo, per IP e per budget giornaliero totale;
- una **ricevuta di richiesta per wallet** (conto on-chain o registro firmato) che impedisce il doppio incasso nello stesso periodo.

**Come si finanzia, senza tenere chiavi del titolare sul server:**

- **Versione semplice (fase 3):** il titolare del tesoro trasferisce con la propria firma una quantità limitata di L$D a un **wallet dedicato al faucet**, con una chiave nuova, creata solo per questo e diversa da quelle di doc. Quel wallet invia l'importo fisso a chi supera i controlli. Il rischio massimo è il saldo di quel wallet, deciso dal titolare, e il faucet si ferma togliendo la chiave o svuotando il saldo.
- **Versione a programma (dopo audit):** il conto del faucet è controllato da un programma che rilascia l'importo solo a chi presenta un'attestazione valida e non ancora usata; la chiave dell'attestatore firma l'idoneità, non muove fondi.

**Limiti onesti:** nessuna difesa anti-sybil è perfetta. Qui l'importo è piccolo, così sfruttare più wallet non conviene; il faucet si può mettere in pausa in qualsiasi momento.

## 6. Airdrop a merito

**Principi:** solo per attività reali (merito, creator, uso dei servizi), regole pubbliche *prima* del round, nessun acquisto di punti, nessuna promessa di valore.

**Meccanismo (Merkle claim):**

1. si pubblicano le regole e la data dello snapshot;
2. ZDOS calcola l'elenco indirizzo → importo e lo pubblica insieme alla **radice di Merkle** (hash dell'intero elenco), così chiunque può ricalcolarla;
3. il titolare del tesoro firma il deposito dei token del round in un conto di distribuzione e la pubblicazione della radice;
4. ogni beneficiario fa **claim** presentando la sua prova di Merkle; il programma verifica la prova e segna il claim come usato;
5. alla scadenza, i token non reclamati tornano al tesoro.

Il distributore può essere un programma open source standard per Solana, oppure un programma ZLang/ZDOS dedicato dopo audit. La demo contiene un controllo di prova di Merkle **reale** (SHA-256 nel browser) su un elenco di esempio chiaramente finto.

## 7. Sicurezza

- **Default anti-rug:** mint revocato, freeze revocato, LP lock permanente, metadati completi. Chi disattiva qualcosa vede un avviso e il lancio viene marcato come "non standard".
- **Estensioni vietate** su Token-2022 (transfer fee, permanent delegate, default frozen).
- **K.I.R.A.:** ogni token lanciato viene letto con i controlli esistenti (autorità, concentrazione dei holder, blocco LP, metadati). Le soglie non cambiano. Un token con un solo holder iniziale (il pool) sarà giallo sulla concentrazione: è corretto così.
- **Audit:** programmi nostri (`zdos_fee_router`, eventuale distributore, faucet a programma) solo dopo revisione indipendente; fino ad allora il lancio usa solo istruzioni di sistema, istruzioni standard del token e Memo.
- **Chiavi:** nessuna chiave del titolare sul server; upgrade authority dei programmi in multisig; chiave del faucet dedicata, con saldo limitato e sostituibile.
- **Front-end:** nessuno script di terzi, Content-Security-Policy stretta, nessun dato personale raccolto.
- **Onestà sui limiti:** "sicuro di default" non vuol dire "senza rischio". Un token nuovo può perdere tutto il suo valore; il launcher non dà consigli di investimento.

## 8. Costi in SOL, passo per passo (stime)

Basate sul costo di rent di 5.080 lamport per byte indicato dalle fonti pubbliche al 22 novembre 2026; **la cifra esatta va riletta on-chain** (`getMinimumBalanceForRentExemption`) al momento della firma.

| Passo on-chain | Costo stimato | Note |
|---|---|---|
| Conto mint (SPL, 82 byte) | 0,0010668 SOL | deposito di rete |
| Conto token del creatore | 0,0014884 SOL | deposito di rete, recuperabile chiudendo il conto |
| Metadati (SPL Token) | 0,0037338 SOL + 0,01 SOL | rent + commissione del programma metadati; con Token-2022 circa 0,0026 SOL, nessuna commissione |
| Revoca mint e freeze | solo firma di rete (circa 0,000005 SOL l'una) | |
| Pool di liquidità | 0,0093 SOL | rent del pool |
| Posizione di liquidità | 0,0087 SOL | recuperabile solo se non bloccata; con LP lock è permanente |
| Blocco LP | solo firma di rete | |
| Commissione ZDOS | 0,01 SOL | 0,005 party pool + 0,005 servizio |
| Firme e priorità (margine) | circa 0,0005 SOL | |
| **Totale tipico** | **circa 0,045 SOL** | più la liquidità iniziale scelta dal creatore, che resta sua |

**Costi lato ZDOS (non pagati dai creatori):**

| Voce | Stima | Quando |
|---|---|---|
| Indirizzo party pool e tesoreria (multisig) | frazioni di centesimo di SOL di rent | una tantum |
| Programma `zdos_fee_router` | circa 1–2 SOL di rent (dipende dalla dimensione), in buona parte recuperabili chiudendo il programma; un buffer temporaneo durante il deploy | fase 5 |
| Distributore Merkle (istanza propria) | circa 1–2 SOL come sopra, più 0,0015 SOL per il conto dei token | fase 4 |
| Per ogni claim airdrop | circa 0,0015 SOL (conto token) + 0,001 SOL (registro del claim) + firma | a carico del beneficiario o del party pool |
| Wallet del faucet (chiave dedicata) | rent minimo e qualche centesimo di SOL di firme | fase 3 |

<!--INTERNO-->
Il wallet pubblico dell'ecosistema oggi ha circa 0,07 SOL: per i passi di fase 2–5 serviranno SOL aggiuntivi, decisi da doc.
<!--/INTERNO-->

## 9. Fasi e firme del titolare del tesoro

| Fase | Contenuto | Costo SOL reale | Serve la firma del titolare? |
|---|---|---|---|
| **0 · Demo** (fatta) | pagina `/launcher/` e questo piano, tutto simulato | 0 | no |
| **1 · Devnet** | costruttore delle transazioni, prove di pool, lock e Memo su devnet con un wallet di prova (non del titolare); verifica Merkle e attestatore su devnet | 0 (SOL devnet gratuiti) | no |
| **2 · Pilota chiuso** | 1–3 lanci di token di prova su mainnet fatti dal titolare, con party pool e tesoreria già creati | circa 0,05 SOL a lancio + liquidità scelta | **sì**: creazione degli indirizzi (meglio multisig), approvazione scritta dei parametri, firma di ogni lancio |
| **3 · Faucet** | wallet dedicato del faucet con saldo limitato | rent minimo + L$D scelti dal titolare | **sì**: trasferimento di L$D al faucet |
| **4 · Airdrop a merito** | regole pubbliche, radice di Merkle, conto di distribuzione | circa 1–2 SOL se programma proprio; altrimenti poco | **sì**: deposito dei token e pubblicazione della radice |
| **5 · Apertura pubblica e router** | launcher aperto a tutti con K.I.R.A. su ogni lancio; programma `zdos_fee_router` dopo audit | circa 1–2 SOL di rent del programma | **sì**: deploy e autorità in multisig |

<!--INTERNO-->
Per il tesoro, il vesting già in attesa (90M L$D, Jupiter Lock, cliff di 12 mesi) è una decisione separata e non è toccato da questo piano.
<!--/INTERNO-->

**Cosa non facciamo:** nessuna transazione, nessun mint e nessun deposito di liquidità senza l'ok esplicito e la firma del titolare del tesoro.

## 10. Rischi aperti

- Le commissioni e i costi di rete possono cambiare: le cifre vanno riverificate prima di ogni fase.
- In fase 1 la commissione è applicata dal front-end, non dalla chain: va bene per il pilota, non è una garanzia fino alla fase 5.
- Un pool sottile è sensibile agli scambi piccoli: il launcher lo mostra, non lo nasconde.
- Responsabilità legali e fiscali di un lanciatore pubblico (termini d'uso, privacy, avvertenze): da rivedere con consulenza prima della fase 5.

<!--INTERNO-->
## Appendice interna A — commissioni reali dei lanciatori (ricerca del 28 novembre 2026)

*Non pubblicata. Fonti: documentazione pubblica dei servizi, letta il 28/11/2026. Gli indirizzi sono scritti senza schema per non creare link cliccabili.*

| Servizio | Creazione | Commissione di scambio | Altri costi | Fonte |
|---|---|---|---|---|
| **pump.fun** | nessuna commissione di piattaforma; solo rete e rent | curva: **1,25%** (0,30% creatore + 0,95% protocollo); dopo la graduazione 1,25% fino a 420 SOL di market cap, poi decresce (1,20% → …) | graduazione 0,015 SOL a moneta | `pump.fun/docs/fees` (aggiornata 16/11/2026), `pump.fun/docs/bonding-curve` |
| **Raydium LaunchLab** | circa 0,115 SOL (≈0,015 rent + 0,1 commissione) | curva: **1%** di default (50% al pool, 50% al tesoro) + commissione di piattaforma fino al 5% + commissione creatore fino a 0,5%; dopo la graduazione 0,25% | migrazione circa 0,04 SOL dalle riserve | `docs.raydium.io/reference/fee-comparison`, `docs.raydium.io/products/launchlab/platform-config` |
| **Meteora DBC (curva dinamica)** | commissione di creazione pool opzionale, 0,001–100 SOL (10% protocollo, 90% partner) | base minima **0,25%**; il protocollo prende il 20% della commissione | commissione di migrazione fissa 0,2% + una configurabile fino al 99% | `docs.meteora.ag/core-products/dbc/fees/overview`, `…/launch-configurations`, `…/migration-and-liquidity` |
| **Jupiter Studio** | meno di 0,05 SOL totali (rete + rent), nessun deposito di liquidità | **1%** (modalità meme) oppure 1% o 2% (custom), per tutta la vita del token; 50% al creatore, 50% a Jupiter; anti-sniper fino al 99% iniziale | Jupiter Lock senza commissioni di protocollo; verifica del token gratuita (standard) o 1.000 JUP (express) | `docs.jup.ag/user-docs/launch/studio/launching-a-token`, `…/graduation-and-fees`, `docs.jup.ag/user-docs/launch/lock/faq`, `docs.jup.ag/user-docs/launch/vrfd/token-verification` |
| **Pool diretto su DAMM v2 / DLMM (solo costi di rete)** | DAMM v2: pool 0,0093 + posizione 0,0087 SOL; DLMM: pool 0,0253 + bin array 0,052 ciascuno + posizione 0,04–0,25 | scelta del creatore (DAMM v2: da 0,01% a 99%) | nessuna commissione del protocollo per la creazione | `docs.meteora.ag/user-guides/creating-a-liquidity-pool`, `jumpbit.io/en/resources/research/how-much-it-costs-to-create-a-liquidity-pool-on-solana-measured` (misure, 22/11/2026) |
| **Costi di rete comuni** | mint 0,0010668 SOL (82 byte a 5.080 lamport/byte); metadati Metaplex 0,0037338 SOL rent + 0,01 SOL di commissione | — | — | `soltidy.com/blog/solana-rent-exempt-minimum-by-account-type`, `23stud.io/blog/how-to-create-a-solana-token` (fonti secondarie; la cifra va riletta on-chain) |

### Lettura onesta del confronto

- **Commissione di scambio:** ZDOS 0% + pool 0,25% di default, contro 1–1,25% delle curve dei lanciatori più usati e 0,25% minimo della base di Meteora DBC. È dove siamo davvero più bassi. Il pool al 0,25% va alla posizione del creatore, non a ZDOS.
- **Costo di creazione:** pump.fun non ha commissione di piattaforma, quindi in assoluto non possiamo essere sotto: loro costano solo la rete. Noi aggiungiamo 0,01 SOL di commissione, che per metà finisce nel party pool. Rispetto a Raydium LaunchLab (circa 0,115 SOL) siamo più bassi; rispetto a Jupiter Studio (< 0,05 SOL) siamo nello stesso ordine (circa 0,045 SOL con le stime di §8).
- **Differenza di modello:** loro usano una curva di prezzo con graduazione; noi un pool diretto con LP lock, senza fase di corsa. Non è "uguale" o "migliore" in senso assoluto: cambia il tipo di lancio.
- **Dati che possono cambiare:** la commissione massima di piattaforma di LaunchLab è stata alzata a 5% il 26/08/2026; le tabelle di pump.fun risultano aggiornate al 16/11/2026. La commissione di piattaforma di LaunchLab al 5% è descritta come aggiornamento in arrivo del programma: confermare sul programma in produzione. Ricontrollare prima di citare cifre fuori da questo documento.
- **Come citarle:** mai nell'interfaccia pubblica né nella pagina del piano (richiesta di doc: identità solo ZLang by ZDOS, niente confronti).

### Note di metodo

- Le cifre di rent derivano da 5.080 lamport/byte; una stima del programma `zdos_fee_router` da 200 KB è (200.000 + 128 + 45) × 5.080 lamport ≈ 1,02 SOL per il conto dei dati, più un buffer temporaneo di pari dimensione durante il deploy (recuperato a fine deploy).
- Token-2022 con metadati: rent circa (166 + 68 + 84 + lunghezza di nome, simbolo e URI + 128) × 5.080 lamport; la demo usa questa formula con la lunghezza reale dei campi.
<!--/INTERNO-->
