'use strict';
// Rubina e Zara nel bot Discord: usano /api/personas/chat di OurVelvet (knowledge base + modello leggero, fallback).
// - Modalità club (flirt soft, mai esplicito): canali nsfw. Nel server $DSN serve anche il ruolo Verificato 18+ e la 18+ ROOM.
// - Modalità pubblica (niente flirt): tutti gli altri canali e i server che invitano il bot.
// - Conversazioni solo in memoria (30 min), mai salvate né loggate. ROSSO ferma e silenzia per 60 minuti.
// - Memoria lunga solo con /ricordami (max 3 note, 30 giorni) e /dimentica. Bozze X solo come link intent: il bot non pubblica.
// © 2026 ZDOS1.3 — P.IVA 11040550961 · Licenza ZSEL proprietaria.
const fs = require('fs');
const SAFE_RE = /\brosso\b/i;
const NAMES = { rubina: 'Rubina', zara: 'Zara' };
const SAFEWORD_REPLY = (p) => 'ROSSO ricevuto. Mi fermo subito ed esco dal ruolo. 🖤 Come stai? Prenditi un momento. Per 60 minuti non ti scrivo più; se vuoi riprendere prima, usa `/' + p + ' riprendi:True`.';
const INVITE_BOT = 'https://discord.com/oauth2/authorize?client_id=1571339297574092862&scope=bot%20applications.commands&permissions=2251802229722160';
const SERVER = 'https://discord.gg/4CGZrAAxaq';
const TG_INVITE = 'https://t.me/RedVelvetOfficial_bot?startgroup=velvet';

function readKey(file) { try { return fs.readFileSync(file, 'utf8').trim(); } catch (_) { return ''; } }

function makeApi(baseUrl, keyFile = process.env.AGI_KEY_FILE || '/etc/ourvelvet/agi.key') {
  return async (path, body, timeoutMs = 95000) => {
    const r = await fetch(baseUrl + '/api/personas' + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agi-key': readKey(keyFile) }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    let json = null; try { json = await r.json(); } catch (_) { /* */ }
    return { status: r.status, json };
  };
}

function makeAgi({ api, now = () => Date.now(), gapMs = 15000, perHour = 20, silenceMs = 60 * 60000, ttlMs = 30 * 60000 } = {}) {
  const sess = new Map(); // persona:userId -> { msgs, at, silentUntil, hits }
  const get = (k) => { let s = sess.get(k); if (!s) { s = { msgs: [], at: 0, silentUntil: 0, hits: [] }; sess.set(k, s); } return s; };
  function sweep() { const t = now(); for (const [k, s] of sess) if (t - s.at > ttlMs && s.silentUntil < t) sess.delete(k); }
  async function talk({ persona, userId, text, mode, resume }) {
    sweep();
    persona = NAMES[persona] ? persona : 'rubina';
    const name = NAMES[persona]; const s = get(persona + ':' + userId); const t = now();
    if (resume) { s.silentUntil = 0; s.msgs = []; if (!text) return { ephemeral: true, content: 'Pausa finita. Quando vuoi, scrivimi con /' + persona + '.' }; }
    text = String(text || '').trim().slice(0, 1000);
    if (!text) return { ephemeral: true, content: 'Scrivi qualcosa: `/' + persona + ' messaggio:...`' };
    if (SAFE_RE.test(text)) { s.msgs = []; s.silentUntil = t + silenceMs; s.at = t; return { ephemeral: true, content: SAFEWORD_REPLY(persona), safeword: true }; }
    if (s.silentUntil > t) return { ephemeral: true, content: 'Sei in pausa dopo ROSSO: ' + name + ' riprende tra ' + Math.ceil((s.silentUntil - t) / 60000) + ' minuti, oppure usa `/' + persona + ' riprendi:True`.' };
    s.hits = s.hits.filter((x) => t - x < 3600000);
    if (s.hits.length && t - s.hits[s.hits.length - 1] < gapMs) return { ephemeral: true, content: 'Piano. Un messaggio ogni ' + Math.round(gapMs / 1000) + ' secondi.' };
    if (s.hits.length >= perHour) return { ephemeral: true, content: 'Basta per quest\'ora. Torna più tardi.' };
    s.hits.push(t); s.at = t;
    const msgs = [...s.msgs, { role: 'user', content: text }].slice(-10);
    let r;
    try { r = await api('/chat', { persona, mode: mode === 'club' ? 'club' : 'public', messages: msgs, platform: 'discord', user_id: String(userId) }); } catch (_) { r = { status: 0 }; }
    if (r.status !== 200 || !r.json || !r.json.reply) return { ephemeral: true, content: name + ' non risponde ora. Riprova tra poco.' };
    if (r.json.safeword) { s.msgs = []; s.silentUntil = t + silenceMs; return { ephemeral: true, content: SAFEWORD_REPLY(persona), safeword: true }; }
    if (r.json.source === 'llm' || r.json.source === 'kb') s.msgs = [...msgs, { role: 'assistant', content: r.json.reply }].slice(-10);
    const quote = text.length > 300 ? text.slice(0, 299) + '…' : text;
    return { content: '> ' + quote.replace(/\n/g, '\n> ') + '\n**' + name + ':** ' + String(r.json.reply).slice(0, 1500) + '\n-# IA che interpreta ' + name + (mode === 'club' ? ' · 18+' : '') + ' · ROSSO la ferma', source: r.json.source, ms: r.json.ms };
  }
  return { talk, size: () => sess.size };
}

const INTRO = [
  '🖤 **Rubina e Zara** di **OurVelvet** (by ZDOS1.3) sono qui perché un admin ha invitato il bot.',
  'Siamo due intelligenze artificiali e rispondiamo solo quando ci chiamate:',
  '• `/rubina` e `/zara` — parla con noi (nei canali non 18+ restiamo in modalità pubblica)',
  '• `/eventi` — eventi e attività OurVelvet · `/condividi-evento` — un admin lo pubblica qui',
  '• `/ricordami` · `/dimentica` — memoria solo se la chiedi',
  'Contenuti 18+ (flirt soft, mai espliciti) solo nei canali **nsfw**. Consenso sempre, safeword **ROSSO**, niente minori.',
  'Nessun DM non richiesto, nessuno spam. Server ufficiale: ' + SERVER,
].join('\n');

// Primo canale testuale dove il bot può scrivere: canale di sistema, poi il primo per posizione.
function introChannel(guild, me, ChannelType, PermissionFlagsBits) {
  const can = (c) => c && c.type === ChannelType.GuildText && !c.nsfw && c.permissionsFor(me) && c.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);
  if (can(guild.systemChannel)) return guild.systemChannel;
  return [...guild.channels.cache.values()].filter(can).sort((a, b) => a.rawPosition - b.rawPosition)[0] || null;
}

function eventsEmbed(evs) {
  if (!evs || !evs.length) return { title: 'Eventi OurVelvet', color: 0x9b1d3a, description: 'Per ora non ci sono eventi pubblicati. Le novità arrivano su https://t.me/OurVelvetHub e nel server ufficiale ' + SERVER + '.' };
  return { title: 'Eventi e attività OurVelvet', color: 0x9b1d3a, url: 'https://velvet.x-zdos.it', description: evs.slice(0, 5).map((e) => '**' + String(e.title || '').slice(0, 120) + '**' + (e.body ? ' — ' + String(e.body).slice(0, 160) : '') + (e.url ? '\n' + e.url : '')).join('\n\n').slice(0, 4000), footer: { text: 'OurVelvet 18+ by ZDOS1.3 · consenso sempre · ROSSO' } };
}

module.exports = { makeAgi, makeApi, INTRO, introChannel, eventsEmbed, INVITE_BOT, SERVER, TG_INVITE, NAMES };
