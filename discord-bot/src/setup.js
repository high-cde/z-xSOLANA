'use strict';
// /setup-server: fotografia del server, piano (src/club.js) e applicazione con discord.js. Idempotente.
const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const club = require('./club');

function snapshot(guild) {
  const me = guild.members.me;
  return {
    everyoneId: guild.roles.everyone.id,
    botId: me.id,
    botTopRolePosition: me.roles.highest.position,
    roles: guild.roles.cache.filter((r) => !r.managed && r.id !== guild.roles.everyone.id).map((r) => ({ id: r.id, name: r.name, color: r.color, hoist: r.hoist, position: r.position })),
    channels: guild.channels.cache.filter((c) => !c.isThread()).map((c) => ({
      id: c.id, name: c.name, type: c.type, parentId: c.parentId || null, nsfw: !!c.nsfw, topic: c.topic || '', position: c.rawPosition,
      overwrites: c.permissionOverwrites ? c.permissionOverwrites.cache.map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield })) : [],
    })),
  };
}

function resolveOw(ow, map) { return (ow || []).map((o) => ({ id: map(o.id), type: o.type, allow: o.allow, deny: o.deny })).filter((o) => o.id); }

function gateMessage() {
  return {
    embeds: [{
      title: '🔞 Ingresso 18+ ROOM · Velvet Club', color: 0xffd56a,
      description: 'La 18+ ROOM e il Velvet Club sono riservati ad adulti. Premendo il pulsante dichiari la tua data di nascita (non viene salvata) e accetti le regole:\n\n' + club.RULES_18.map((r) => '• ' + r).join('\n') + '\n\nDiscord mostra anche il proprio avviso per i canali con limite di età.',
      footer: { text: 'VelvetHub 18+ by ZDOS1.3 · consenso · safeword ROSSO' },
    }],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('v18:start').setLabel('Ho 18 anni o più · accetto le regole').setStyle(ButtonStyle.Primary).setEmoji('🖤'),
      new ButtonBuilder().setCustomId('v18:leave').setLabel('Esci dalla 18+ ROOM').setStyle(ButtonStyle.Secondary),
    )],
  };
}
function rulesMessage() {
  return { embeds: [{ title: '📜 Regole della 18+ ROOM e del Velvet Club', color: 0xff4ecd, description: club.RULES_18.map((r, i) => (i + 1) + '. ' + r).join('\n') + '\n\nCategorie: ' + club.LAYOUT.find((l) => l.key === 'club').channels.map((c) => '#' + c.name).join(' · '), footer: { text: 'Chi viola le regole perde il ruolo Verificato 18+.' } }] };
}

async function ensureMessage(channel, kind, build, state) {
  const g = state.guild(channel.guild.id); g.messages = g.messages || {};
  const id = g.messages[kind];
  if (id) { const m = await channel.messages.fetch(id).catch(() => null); if (m) { await m.edit(build()).catch(() => {}); return 'aggiornato'; } }
  const m = await channel.send(build());
  g.messages[kind] = m.id; state.save();
  return 'pubblicato';
}

async function apply(guild, state, { maxMax = 200, archiveOld = false } = {}) {
  await guild.roles.fetch(); await guild.channels.fetch();
  const snap = snapshot(guild);
  const p = club.plan(snap, { archiveOld });
  const created = {}; const done = []; const errors = [];
  const map = (id) => (typeof id === 'string' && id.startsWith('new:') ? created[id] : id);
  for (const a of p.actions.slice(0, maxMax)) {
    try {
      if (a.op === 'role.create') { const r = await guild.roles.create({ name: a.name, color: a.color, hoist: a.hoist, mentionable: false, permissions: [], reason: 'setup-server z-xSOLANA' }); created['new:' + a.key] = r.id; }
      else if (a.op === 'role.update') await guild.roles.edit(a.id, { color: a.color, hoist: a.hoist, reason: 'setup-server: colori x-zdos.it' });
      else if (a.op === 'category.create') { const c = await guild.channels.create({ name: a.name, type: ChannelType.GuildCategory, permissionOverwrites: resolveOw(a.overwrites, map), reason: 'setup-server' }); created['new:' + a.key] = c.id; }
      else if (a.op === 'category.rename') await guild.channels.edit(a.id, { name: a.name, reason: 'setup-server' });
      else if (a.op === 'category.perms') await guild.channels.edit(a.id, { permissionOverwrites: resolveOw(a.overwrites, map), reason: 'setup-server' });
      else if (a.op === 'channel.create') { const c = await guild.channels.create({ name: a.name, type: ChannelType.GuildText, parent: map(a.parent), topic: a.topic, nsfw: a.nsfw, permissionOverwrites: resolveOw(a.overwrites, map), reason: 'setup-server' }); created['new:' + a.key] = c.id; }
      else if (a.op === 'channel.update') {
        const ch = guild.channels.cache.get(a.id); const edit = {};
        if ('parent' in a) edit.parent = map(a.parent);
        if ('topic' in a) edit.topic = a.topic;
        if ('nsfw' in a) edit.nsfw = a.nsfw;
        if ('overwrites' in a) edit.permissionOverwrites = resolveOw(a.overwrites, map);
        edit.lockPermissions = false;
        await ch.edit({ ...edit, reason: 'setup-server' });
      } else if (a.op === 'channel.archive') await guild.channels.cache.get(a.id).setParent(map(a.parent), { lockPermissions: false, reason: 'setup-server: archiviato, non cancellato' });
      done.push(a);
    } catch (e) { errors.push(club.describe(a) + ': ' + e.message); }
  }
  // Ordine: categorie nell'ordine del layout, canali nell'ordine previsto dentro ogni categoria.
  try {
    await guild.channels.fetch();
    let ci = 0; const per = {}; const pos = [];
    for (const o of p.order) {
      const id = map(o.ref); if (!id) continue;
      if (o.kind === 'category') pos.push({ channel: id, position: ci++ });
      else { const par = map(o.parent); per[par] = (per[par] || 0); pos.push({ channel: id, position: per[par]++ }); }
    }
    await guild.channels.setPositions(pos);
  } catch (e) { errors.push('ordine canali: ' + e.message); }
  // Messaggi fissi: ingresso con pulsante, regole.
  await guild.channels.fetch();
  const byName = (n) => guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === n);
  const msgs = [];
  for (const [name, kind, build] of [['ingresso-18', 'gate', gateMessage], ['regole-18', 'rules', rulesMessage]]) {
    const ch = byName(name);
    if (ch) { try { msgs.push('#' + name + ': ' + await ensureMessage(ch, kind, build, state)); } catch (e) { errors.push('#' + name + ': ' + e.message); } }
  }
  const g = state.guild(guild.id);
  if (g.cursor == null) g.cursor = state.latestEventId != null ? state.latestEventId : 0;
  g.setupAt = new Date().toISOString(); state.save();
  return { planned: p.actions.length, done: done.length, errors, warnings: p.warnings, msgs };
}

function preview(guild, { archiveOld = false } = {}) {
  const snap = snapshot(guild);
  const p = club.plan(snap, { archiveOld });
  return { actions: p.actions, warnings: p.warnings, lines: p.actions.map(club.describe) };
}

module.exports = { snapshot, apply, preview, gateMessage, rulesMessage };
