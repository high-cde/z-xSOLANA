// OurVelvet Gateway · catalogo. Nessun prezzo inventato: i prezzi arrivano solo dal preventivo reale dello staff/partner.
// Tutti i partner sono segnaposto "partner in selezione" finché non c'è un contratto firmato. © 2026 ZDOS1.3
export const TERMS_V = "2026-11-28";

export const RULES = [
  "Solo maggiorenni (18+). Nessun minore, nessun contenuto o immagine che ricordi minori.",
  "Consenso esplicito e revocabile in ogni momento. Safeword: ROSSO, ferma tutto subito.",
  "OurVelvet non organizza, non intermedia e non incassa nulla per prestazioni sessuali. Nessuna persona è prenotabile.",
  "Le performer degli eventi sono professioniste maggiorenni contrattualizzate dal locale o dall'organizzatore autorizzato. Niente contatti privati, niente foto, niente contatto fisico.",
  "«Incontri» significa solo social: eventi, community e match reciproco tra adulti verificati, senza alcun pagamento legato a una persona.",
  "Amsterdam: dal 2020 i tour guidati non possono passare davanti alle vetrine; tour solo 08:00–22:00, massimo 15 persone, guida con esenzione comunale. Vietato fotografare le lavoratrici del sesso; vietati i pub crawl.",
];

const P = (nome, nota) => ({ nome, stato: "partner in selezione", nota });

export const MODULES = [
  { id: "viaggio", titolo: "Viaggio", desc: "Voli e treni con ricerche già compilate dall'agenzia Z-X (zx.x-zdos.it). Prezzi solo sui siti dei vettori.", link: "https://zx.x-zdos.it/#viaggi" },
  { id: "route", titolo: "Velvet Route", desc: "Amsterdam ↔ Lago di Garda: tappe, locali 18+ legali, cultura e serate in locali autorizzati.", link: "/gateway/velvet-route/" },
  { id: "richiesta", titolo: "Richiesta unica", desc: "Una sola richiesta di preventivo o lista d'attesa, con firma wallet. Risposta e messaggi in un solo posto.", link: "/gateway/#richiesta" },
  { id: "rivista", titolo: "ARIA 18+", desc: "La rivista porta qui con un widget leggero: stessi dati, stesso flusso.", link: "https://zx.x-zdos.it/rivista/#prenota" },
];

export const ROUTE = {
  id: "velvet-route",
  titolo: "Velvet Route · Amsterdam ↔ Lago di Garda",
  sottotitolo: "Due città d'acqua, una notte nordica e una lacustre. Cultura, club legali, lounge sul lago, serate in locali autorizzati.",
  tappe: [
    { id: "trasporto", luogo: "Amsterdam ↔ Verona / Garda", titolo: "Voli o treno",
      testo: "Volo diretto Amsterdam (AMS) ↔ Verona (VRN) o Milano Bergamo (BGY); in alternativa treno notturno Amsterdam → Innsbruck e poi Brennero → Verona / Peschiera del Garda. Orari e disponibilità da verificare al momento della richiesta.",
      partner: [P("Vettori aerei e ferroviari", "ricerca pubblica tramite zx.x-zdos.it, nessun accordo commerciale")] },
    { id: "hotel-ams", luogo: "Amsterdam", titolo: "Hotel boutique in centro",
      testo: "Camere adults-only o design hotel a distanza a piedi dal centro storico.",
      partner: [P("Hotel boutique Amsterdam", "segnaposto")] },
    { id: "nightlife-ams", luogo: "Amsterdam", titolo: "Club e nightlife 18+",
      testo: "Club e locali con licenza, ingresso solo maggiorenni, dress code e regole della casa. Nessun pub crawl (vietati in centro).",
      partner: [P("Club 18+ Amsterdam", "segnaposto")] },
    { id: "tour-ams", luogo: "Amsterdam · De Wallen", titolo: "Tour culturale del quartiere a luci rosse",
      testo: "Passeggiata storica nelle vie intorno a De Wallen con guida munita di esenzione comunale: storia del quartiere, della legge olandese e dei diritti di chi ci lavora. Il percorso non passa davanti alle vetrine (vietato dal 1° aprile 2020), si svolge tra le 08:00 e le 22:00, massimo 15 persone, niente foto alle persone.",
      partner: [P("Guida con esenzione del Comune di Amsterdam", "segnaposto, verifica esenzione obbligatoria")] },
    { id: "hotel-garda", luogo: "Lago di Garda", titolo: "Hotel sul lago",
      testo: "Hotel o resort adults-only sulla sponda veronese o bresciana, con spa.",
      partner: [P("Hotel lakeside Garda", "segnaposto")] },
    { id: "boat-garda", luogo: "Lago di Garda", titolo: "Lounge e boat party al tramonto",
      testo: "Imbarcazione privata con conducente e licenza di noleggio, DJ set e aperitivo. Gruppo chiuso di adulti iscritti, regole della casa, safeword ROSSO.",
      partner: [P("Noleggio imbarcazioni con conducente (Garda)", "segnaposto"), P("Lounge bar lakeside", "segnaposto")] },
    { id: "sushi", luogo: "Lago di Garda o Amsterdam", titolo: "Serata sushi premium",
      testo: "Cena sushi d'autore in un locale autorizzato, con presentazione artistica curata da performer professioniste maggiorenni, contrattualizzate dall'organizzatore. Le performer non sono prenotabili né contattabili; regola no-touch, foto vietate, safeword ROSSO. Sempre disponibile anche il servizio classico.",
      partner: [P("Locale autorizzato / organizzatore eventi", "segnaposto, servono licenze del locale e contratti delle performer")] },
    { id: "community", luogo: "Entrambe", titolo: "Incontri social",
      testo: "Eventi della community OurVelvet e match reciproco tra adulti verificati con la firma wallet. Nessun pagamento legato a una persona.",
      partner: [] },
  ],
  pacchetti: [
    { id: "ams-weekend", titolo: "Weekend Amsterdam", notti: "3 notti", tappe: ["trasporto", "hotel-ams", "nightlife-ams", "tour-ams", "community"] },
    { id: "garda-lounge", titolo: "Garda Lounge", notti: "2–3 notti", tappe: ["trasporto", "hotel-garda", "boat-garda", "sushi", "community"] },
    { id: "velvet-route", titolo: "Velvet Route completa", notti: "6–7 notti", tappe: ["trasporto", "hotel-ams", "nightlife-ams", "tour-ams", "hotel-garda", "boat-garda", "sushi", "community"] },
  ],
};
export const PACKAGE_IDS = new Set(ROUTE.pacchetti.map((p) => p.id).concat(["su-misura"]));
export const EXTRAS = new Set(ROUTE.tappe.map((t) => t.id));

// Rimborso crypto L$D (PROPOSTA, da confermare con doc) e merito.
export const REFUND = { basePct: 3, bonusFirmaVerificata: 1, bonusProfiloMerito: 1, maxPct: 5, maxEur: 150, stato: "proposta, da confermare con doc", pagamenti: false };
export const MERIT = { azione: "gateway_booking_completed", base: 10, ogni100Eur: 1, tetto: 40, stato: "proposta, da collegare a zcomm/Pool Party più avanti" };
export const LEGAL = {
  ruolo: "ZDOS1.3 (P.IVA 11040550961) raccoglie richieste e le gira a partner autorizzati. Non vende pacchetti turistici in proprio.",
  mancano: [
    "Agenzia di viaggi o tour operator partner con SCIA regionale, direttore tecnico, polizza RC e fondo di garanzia (Codice del Turismo, D.Lgs. 79/2011 e D.Lgs. 62/2018). In alternativa: aprire l'agenzia ZDOS con gli stessi requisiti.",
    "Contratti con hotel, locali e organizzatori; licenze dei locali per gli spettacoli; contratti e verifica dell'età delle performer a cura dell'organizzatore.",
    "Guida con esenzione del Comune di Amsterdam per il tour culturale.",
    "Pagamenti in crypto: fattura in euro al cambio del momento; niente custodia o cambio per conto terzi senza registrazione OAM/MiCA.",
    "Privacy (GDPR): informativa dedicata alle richieste di viaggio.",
  ],
};
