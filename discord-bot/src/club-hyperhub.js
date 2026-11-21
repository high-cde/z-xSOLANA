'use strict';
// Estensione proposta per /setup-server (Hyper Hub / community creator).
// NON è richiesta da club.js né da setup.js: applicare questo piano non succede
// finché non viene collegata a club.LAYOUT/ROLES e non si lancia apply.js.
// Il bot è fermo (token non valido). Non applicare senza ok esplicito di doc.
// © 2026 ZDOS1.3 — P.IVA 11040550961 · Licenza ZSEL proprietaria.

const ENABLED = false; // lasciare false: questo file da solo non modifica il server

// Ruoli già presenti sul server o in club.js: non duplicarli.
const ROLES_ALREADY = [
  { requested: 'Fondatore', existing: '👑・Founders', where: 'server (non gestito da club.js)', action: 'nessuno' },
  { requested: 'Creator Verificato', existing: 'Creator', where: 'club.js (assegnato dagli admin ai creator verificati)', action: 'nessuno: usare il ruolo già esistente' },
  { requested: 'Slave / Fedele', existing: 'Fedele (e Curioso)', where: 'club.js, opt-in con /radar-collega e /curioso', action: 'nessuno: non aggiungo un ruolo chiamato Slave' },
  { requested: 'Nodo / Staff', existing: '💥・Admin, 👮‍♂️・Moderators', where: 'server', action: 'nessuno' },
  { requested: 'Mistress (umana)', existing: 'Mistress / Master', where: 'club.js', action: 'nessuno' },
  { requested: 'Verificato 18+', existing: 'Verificato 18+', where: 'club.js, #ingresso-18', action: 'nessuno' },
];

// Ruoli nuovi, solo se doc conferma. Non applicati.
const ROLES_NEW = [
  {
    key: 'mistress-agi',
    name: 'Mistress AGI',
    color: 0xb01a4a,
    hoist: false,
    note: 'Per bot o persona AI dichiarata. Oggi esiste il ruolo bot «Rubina» e il ruolo umano «Mistress». Questo raggruppa le AGI.',
  },
  {
    key: 'adepte',
    name: 'Adepte',
    color: 0x8a8f98,
    hoist: false,
    note: 'Ingresso base dopo le regole 18+. Si sovrappone in parte a Verificato 18+: serve conferma se va creato o se basta il ruolo già presente.',
  },
];

// Canali già coperti dalla struttura attuale: non crearne di omonimi.
const CHANNELS_ALREADY = [
  { requested: '#regole-18+', existing: '#regole-18', cat: '🔞 18+ ROOM', nsfw: true },
  { requested: '#contest-carne-lattice', existing: '#contest', cat: '🔞 18+ ROOM', nsfw: true },
  { requested: '#feed-creator', existing: '#creator-showcase', cat: '🖤 VELVET CLUB', nsfw: true },
  { requested: '#radar-mistress', existing: '#radar-della-carne', cat: '🔞 18+ ROOM', nsfw: true },
  { requested: '#sala-rubina', existing: '#rubina', cat: '🔞 18+ ROOM', nsfw: true, note: 'Rubina è già dichiarata IA. Safeword ROSSO. /rubina.' },
  { requested: '#annunci', existing: '#annunci', cat: '📢 ANNUNCI' },
  { requested: '#mod-log', existing: '#mod-log', cat: '🛡️ STAFF' },
];

// Canali nuovi proposti, NSFW dove è 18+, safeword ROSSO in topic. Non applicati.
const CHANNELS_NEW = [
  {
    key: 'creator-hub',
    name: '✦ CREATOR HUB',
    access: 'adult',
    nsfw: true,
    channels: [
      { name: 'verifica-creator', access: 'adult-ro', topic: 'Verifica creator 18+: staff. Si indica un profilo pubblico e, se si vuole, un link OnlyFans o Fansly in uscita. OurVelvet non ospita i contenuti. Safeword ROSSO.' },
      { name: 'studio-18+', topic: 'Anteprime e avvisi dello Studio 18+ su velvet.x-zdos.it. I contenuti li caricano i Creator verificati. Safeword ROSSO.' },
      { name: 'onlyfans-support', topic: 'Solo link in uscita OnlyFans/Fansly dei Creator verificati. Nessun contenuto ospitato qui. Niente richieste di denaro in privato. Safeword ROSSO.' },
    ],
  },
  {
    key: 'sale-agi',
    name: '✦ SALE AGI',
    access: 'adult',
    nsfw: true,
    channels: [
      { name: 'sala-zara', topic: 'Sala di Zara, persona AI dichiarata. Gioco in canale, nessun incontro reale. Safeword ROSSO ferma tutto. Il bot non genera testi sessuali espliciti.' },
    ],
    note: 'Zara è già presente nel sito (scheda lodge / contatto). Rubina ha già #rubina: non la duplico.',
  },
  {
    key: 'community-extra',
    name: null, // da inserire in COMMUNITY / ANNUNCI esistenti, non una categoria nuova obbligatoria
    access: 'public',
    nsfw: false,
    channels: [
      { name: 'chat-generale', topic: 'Chat pubblica del server $DSN / ZDOS. Niente contenuti 18+ qui: quelli stanno nella 18+ ROOM.' },
      { name: 'smartshop', access: 'readonly', topic: 'Link allo Smartshop su https://velvet.x-zdos.it/ (sezione shop). Niente pagamenti in questo canale.' },
    ],
  },
  {
    key: 'staff-extra',
    name: null,
    access: 'staff',
    nsfw: false,
    channels: [
      { name: 'agi-control', topic: 'Controllo staff delle AGI (Rubina, Zara). Le AGI non postano da sole su X, Discord o Telegram: solo bozze o risposta dove sono state invitate.' },
    ],
  },
];

// Esclusi di proposito.
const EXCLUDED = [
  { name: '#token-ov', reason: 'Niente canale dedicato a promesse, premi o rendimenti sul token. VELVET è un gettone di comunità; le info stanno già in #info, #airdrop-velvet e nel comando /token.' },
  { name: '#sala-valeska', reason: 'Valeska non risulta nel codice attuale (zdiscord, VelvetHub, OurVelvet). Nuovo personaggio: non creo la sala senza ok di doc.' },
  { name: '#sala-helga', reason: 'Helga non risulta nel codice attuale. Nuovo personaggio: non creo la sala senza ok di doc.' },
  { name: '#sala-doll', reason: 'Doll non risulta nel codice attuale come persona AI. Nuovo personaggio: non creo la sala senza ok di doc.' },
  { name: '#sala-furia', reason: 'Furia non risulta nel codice attuale. Nuovo personaggio: non creo la sala senza ok di doc.' },
];

// Comandi già presenti e proposte NON registrate (il bot è fermo; niente apply e niente register).
const COMMANDS = {
  existing: [
    { name: '/verifica', note: 'Esiste già: ruoli holder $DSN / VELVET con firma del wallet, non è la verifica creator.' },
    { name: '/radar', note: 'Esiste già: segnali del Radar zdesk (sola lettura). Non è il Radar della Carne. Il Radar 18+ si collega con /radar-collega e /velvet.' },
    { name: '/token', note: 'Esiste già: informazioni su $DSN e VELVET (nessun rendimento). Rende inutile un comando /ov da «premi».' },
    { name: '/rubina', note: 'Esiste già, solo nei canali 18+. Safeword ROSSO.' },
    { name: '/velvet', note: 'Esiste già: link a VelvetHub, regole, ruoli del club.' },
    { name: '/contest', note: 'Assente. Non lo registro ora.' },
    { name: '/studio', note: 'Assente. Non lo registro ora.' },
    { name: '/ov', note: 'Assente e non lo propongo come comando di premi o trasferimenti. Per il token basta /token.' },
  ],
  proposed_if_approved: [
    { name: '/studio', description: 'Link allo Studio 18+ su velvet.x-zdos.it. Nessun contenuto generato dal bot.' },
    { name: '/contest', description: 'Link al Contest Carne e Lattice e alle regole. Nessuna promessa di premio in token.' },
  ],
};

module.exports = {
  ENABLED,
  ROLES_ALREADY,
  ROLES_NEW,
  CHANNELS_ALREADY,
  CHANNELS_NEW,
  EXCLUDED,
  COMMANDS,
};
