'use strict';
// Zara Lsd · bot Discord separato (app 1572301251981611088). Persona AI dichiarata di OurVelvet by ZDOS1.3.
// - Risponde SOLO nel server di doc (DISCORD_GUILD_ID): a /zara, /ricordami, /dimentica e quando viene menzionata.
// - Niente post autonomi, niente DM, niente join. 18+ (flirt soft, mai esplicito) solo in canali nsfw a chi ha "Verificato 18+".
// - Safeword ROSSO. Le conversazioni restano in memoria 30 min e non vengono loggate. Token solo in /etc/zara/bot.env.
// © 2026 ZDOS1.3 — P.IVA 11040550961 · Licenza ZSEL proprietaria.
const { Client, GatewayIntentBits, Events, MessageFlags, REST, Routes, ActivityType } = require('discord.js');
const { makeAgi, makeApi } = require('./agi');

const TOKEN = (process.env.ZARA_DISCORD_TOKEN || '').trim();
const APP_ID = (process.env.ZARA_APPLICATION_ID || '').trim();
const GUILD = (process.env.DISCORD_GUILD_ID || '').trim();
const OV = process.env.OURVELVET_URL || 'http://127.0.0.1:8000';
const V18 = process.env.ROLE_V18 || 'Verificato 18+';
if (!TOKEN || !APP_ID || !GUILD) { console.error('Config mancante in /etc/zara/bot.env'); process.exit(1); }

const api = makeApi(OV);
const agi = makeAgi({ api });
const eph = { flags: MessageFlags.Ephemeral };
const CMDS = [
  { name: 'zara', description: 'Parla con Zara (IA) · 18+ solo nei canali nsfw · ROSSO la ferma', dm_permission: false, options: [
    { type: 3, name: 'messaggio', description: 'Il tuo messaggio', required: false, max_length: 1000 },
    { type: 5, name: 'riprendi', description: 'Riprendi dopo una pausa ROSSO', required: false },
  ] },
  { name: 'ricordami', description: 'Fai ricordare a Zara e Rubina una nota su di te (max 3, 30 giorni)', dm_permission: false, options: [
    { type: 3, name: 'nota', description: 'Es. mi chiamo Leo. Vuoto = mostra cosa ricordano', required: false, max_length: 200 },
  ] },
  { name: 'dimentica', description: 'Cancella tutto quello che Zara e Rubina ricordano di te', dm_permission: false },
];

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages], allowedMentions: { parse: [], repliedUser: false } });
const mode = (channel, member) => (channel && channel.nsfw && member && member.roles.cache.some((r) => r.name === V18) ? 'club' : 'public');

client.once(Events.ClientReady, async (c) => {
  console.log('Zara online come', c.user.tag, '· server:', c.guilds.cache.size);
  c.user.setPresence({ activities: [{ name: 'OurVelvet · /zara · ROSSO', type: ActivityType.Listening }], status: 'online' });
  try {
    const r = await new REST({ version: '10' }).setToken(TOKEN).put(Routes.applicationGuildCommands(APP_ID, GUILD), { body: CMDS });
    console.log('comandi registrati:', r.map((x) => '/' + x.name).join(' '));
  } catch (e) { console.error('registrazione comandi', e.message); }
});

client.on(Events.InteractionCreate, async (it) => {
  if (!it.isChatInputCommand()) return;
  if (it.guildId !== GUILD) return it.reply({ content: 'Zara risponde solo nel server OurVelvet / $DSN.', ...eph }).catch(() => {});
  try {
    const member = await it.guild.members.fetch(it.user.id);
    if (it.commandName === 'zara') {
      const text = it.options.getString('messaggio'); const resume = it.options.getBoolean('riprendi');
      const args = { persona: 'zara', userId: it.user.id, text, mode: mode(it.channel, member), resume };
      if (!text || /\brosso\b/i.test(text)) { const r = await agi.talk(args); return it.reply({ content: r.content, ...eph }); }
      await it.deferReply();
      const r = await agi.talk(args);
      if (r.ephemeral) { await it.deleteReply().catch(() => {}); return it.followUp({ content: r.content, ...eph }); }
      return it.editReply({ content: r.content });
    }
    if (it.commandName === 'ricordami' || it.commandName === 'dimentica') {
      await it.deferReply(eph);
      const note = it.commandName === 'ricordami' ? it.options.getString('nota') : null;
      const op = it.commandName === 'dimentica' ? 'forget' : (note ? 'add' : 'get');
      const r = await api('/memory', { platform: 'discord', user_id: String(it.user.id), op, note: note || undefined }, 15000).catch(() => ({ status: 0 }));
      if (r.status !== 200) return it.editReply((r.json && r.json.detail) || 'Memoria non disponibile ora.');
      if (op === 'forget') return it.editReply('Cancellato: ' + (r.json.deleted || 0) + ' nota/e.');
      const notes = r.json.notes || [];
      return it.editReply((op === 'add' ? 'Fatto. ' : '') + 'Cosa ricordiamo di te: ' + (notes.length ? notes.join('; ') : 'niente') + '. /dimentica cancella tutto.');
    }
  } catch (e) {
    console.error('comando', it.commandName, e.message);
    const msg = { content: 'Errore temporaneo, riprova tra poco.' };
    if (it.deferred || it.replied) await it.editReply(msg).catch(() => {}); else await it.reply({ ...msg, ...eph }).catch(() => {});
  }
});

// Menzioni: solo nel server di doc, mai ai bot, mai in DM. Il contenuto arriva solo per i messaggi che menzionano Zara.
client.on(Events.MessageCreate, async (m) => {
  try {
    if (m.author.bot || m.guildId !== GUILD || !client.user || !m.mentions.users.has(client.user.id)) return;
    const text = m.content.replace(/<@!?\d+>/g, ' ').trim();
    if (!text) return void m.reply('Dimmi. Oppure usa `/zara`. Scrivi ROSSO e mi fermo.');
    await m.channel.sendTyping().catch(() => {});
    const r = await agi.talk({ persona: 'zara', userId: m.author.id, text, mode: mode(m.channel, m.member) });
    await m.reply({ content: r.content.replace(/^> .*\n(> .*\n)*/, '') });
  } catch (e) { console.error('menzione', e.message); }
});

client.on(Events.GuildCreate, (g) => { if (g.id !== GUILD) console.log('aggiunta a un altro server', g.id, '· resta inattiva lì'); });
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { client.destroy(); process.exit(0); });
client.login(TOKEN).catch((e) => { console.error('login', e.message); process.exit(1); });
