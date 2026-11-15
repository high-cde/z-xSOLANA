'use strict';
// Bot Discord z-xSOLANA · © 2026 ZDOS1.3 — P.IVA 11040550961 · Licenza ZSEL proprietaria.
// Intent: solo Guilds (nessun intent privilegiato, nessuna lettura dei messaggi). Risponde solo ai comandi slash.
const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');
const cfg = require('./config');
const C = require('./constants');
const { makeSolana } = require('./solana');
const { makeNonceStore } = require('./verify');
const { dispatch } = require('./commands');
const { makeServer } = require('./http');

if (!cfg.token) { console.error('DISCORD_TOKEN mancante: lancia /opt/zdiscord/setup-token.sh'); process.exit(1); }

const sol = makeSolana({ rpcUrls: cfg.rpcUrls });
const store = makeNonceStore({ ttlMs: cfg.nonceTtlMs });
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const mask = (s) => (String(s).length > 10 ? String(s).slice(0, 4) + '…' + String(s).slice(-4) : String(s));

async function ensureRole(guild, name) {
  await guild.roles.fetch();
  return guild.roles.cache.find((r) => r.name === name) || guild.roles.create({ name, mentionable: false, hoist: false, permissions: [], reason: 'Ruolo holder z-xSOLANA (verifica con firma wallet)' });
}

async function assignRoles({ guildId, userId, dsn, velvet }) {
  const guild = await client.guilds.fetch(guildId);
  const member = await guild.members.fetch(userId);
  const out = [];
  for (const [has, name] of [[dsn, cfg.roles.dsn], [velvet, cfg.roles.velvet]]) {
    const role = await ensureRole(guild, name);
    if (has && !member.roles.cache.has(role.id)) { await member.roles.add(role, 'holder verificato con firma wallet'); out.push('+' + name); }
    else if (!has && member.roles.cache.has(role.id)) { await member.roles.remove(role, 'saldo zero alla verifica'); out.push('-' + name); }
  }
  console.log('verifica', mask(userId), 'dsn=' + dsn, 'velvet=' + velvet, out.join(' '));
  return out;
}

const deps = {
  rpc: sol.rpc, fetchJson: sol.fetchJson,
  fetchStatus: async (url) => (await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000) })).status,
  zdeskJson: async (path) => { const r = await fetch(cfg.zdeskUrl + path, { signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); },
  store, verifyUrl: cfg.verifyUrl, roles: cfg.roles,
  tokenBalance: sol.tokenBalance, assignRoles, mints: { dsn: C.DSN_SOL, velvet: C.VELVET },
  discordReady: () => client.isReady(),
};

client.once(Events.ClientReady, (c) => console.log('zdiscord online come', c.user.tag, '· server:', c.guilds.cache.size));
client.on(Events.InteractionCreate, async (it) => {
  if (!it.isChatInputCommand()) return;
  const ctx = { guildId: it.guildId, userId: it.user.id, options: { mint: it.options.getString('mint') } };
  try {
    const eph = ['verifica', 'radar'].includes(it.commandName);
    await it.deferReply(eph ? { flags: MessageFlags.Ephemeral } : {});
    const r = await dispatch(it.commandName, ctx, deps);
    await it.editReply({ content: r.content || undefined, embeds: r.embeds || [] });
  } catch (e) {
    console.error('comando', it.commandName, e.message);
    const msg = { content: 'Errore temporaneo, riprova tra poco.' };
    if (it.deferred || it.replied) await it.editReply(msg).catch(() => {}); else await it.reply({ ...msg, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

makeServer(deps).listen(cfg.port, cfg.host, () => console.log('API verifica su', cfg.host + ':' + cfg.port));
client.login(cfg.token);
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { client.destroy(); process.exit(0); });
