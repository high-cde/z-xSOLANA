'use strict';
// /setup-server: fotografia del server, piano (src/club.js) e applicazione con discord.js. Idempotente.
// Oltre alla struttura: messaggi guida fissati (src/guides.js), regole AutoMod native (src/automod.js),
// quarantena anti-raid (ruolo "In verifica"). Nulla viene cancellato.
const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const club = require('./club');
const guides = require('./guides');
const automod = require('./automod');

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

// Tutti i messaggi fissi gestiti: canale, chiave nello stato, titolo, contenuto.
function allMessages(opts = {}) {
  return [
    { channel: 'ingresso-18', kind: 'gate', title: 'Ingresso 18+ ROOM', payload: gateMessage() },
    { channel: 'regole-18', kind: 'rules', title: 'Regole della 18+ ROOM', payload: rulesMessage() },
    ...guides.build(opts),
  ];
}

const textByName = (guild, n) => guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === n);
const willExist = (name) => club.LAYOUT.some((L) => L.channels.some((c) => c.name === name));

// Piano dei messaggi: guarda lo stato (id + impronta) e, se possibile, il messaggio reale.
async function planMessages(guild, state, opts) {
  const g = state.guild(guild.id); const ids = g.messages || {}; const hashes = g.msgHash || {};
  const out = [];
  for (const m of allMessages(opts)) {
    const ch = textByName(guild, m.channel);
    if (!ch && !willExist(m.channel)) continue;
    const h = guides.hashPayload(m.payload);
    let msg = null;
    if (ch && ids[m.kind]) msg = await ch.messages.fetch(ids[m.kind]).catch(() => null);
    if (!msg) out.push({ op: 'guide.publish', channel: m.channel, kind: m.kind, title: m.title });
    else if (hashes[m.kind] !== h) out.push({ op: 'guide.update', channel: m.channel, kind: m.kind, title: m.title });
    else if (!msg.pinned) out.push({ op: 'guide.pin', channel: m.channel, kind: m.kind, title: m.title });
  }
  return out;
}

async function ensureMessage(channel, m, state, canPin) {
  const g = state.guild(channel.guild.id); g.messages = g.messages || {}; g.msgHash = g.msgHash || {};
  const h = guides.hashPayload(m.payload);
  let msg = g.messages[m.kind] ? await channel.messages.fetch(g.messages[m.kind]).catch(() => null) : null;
  let res;
  if (msg) { if (g.msgHash[m.kind] !== h) { await msg.edit(m.payload); res = 'aggiornato'; } else res = 'già allineato'; }
  else { msg = await channel.send(m.payload); g.messages[m.kind] = msg.id; res = 'pubblicato'; }
  g.msgHash[m.kind] = h; state.save();
  if (!msg.pinned) {
    if (canPin) { await msg.pin('setup-server: messaggio guida').then(() => { res += ' e fissato'; }).catch((e) => { res += ' (non fissato: ' + e.message + ')'; }); }
    else res += ' (non fissato: manca il permesso Pin Messages)';
  }
  return res;
}

function permsInfo(guild, memberIntent) {
  const me = guild.members.me;
  const missingExtra = Object.entries(club.EXTRA_PERMS).filter(([, bit]) => !me.permissions.has(bit)).map(([k]) => k);
  const warnings = [];
  if (missingExtra.includes('ManageGuild')) warnings.push('Manca **Manage Guild** (Gestisci server): le regole AutoMod non possono essere lette né create. Riautorizza il bot con il nuovo link di invito.');
  if (missingExtra.includes('PinMessages')) warnings.push('Manca **Pin Messages** (Fissa messaggi): i messaggi guida vengono pubblicati ma non fissati. Riautorizza il bot con il nuovo link di invito.');
  if (!memberIntent) warnings.push('Anti-raid in attesa: attiva "Server Members Intent" nel Discord Developer Portal (Bot → Privileged Gateway Intents). Senza, il bot non vede gli ingressi; il resto funziona.');
  return { missingExtra, warnings, canAutomod: !missingExtra.includes('ManageGuild'), canPin: !missingExtra.includes('PinMessages') };
}

async function planAutomod(guild, modLogId, canAutomod) {
  if (!canAutomod) return { actions: [], warnings: [], skipped: true };
  const rules = await guild.autoModerationRules.fetch();
  return automod.plan([...rules.values()].map(automod.fromDiscord), modLogId);
}

async function apply(guild, state, { maxMax = 200, archiveOld = false, memberIntent = false, minAccountDays = 7 } = {}) {
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
      else if (a.op === 'quarantine.lock') {
        // Aggiunge solo l'override del ruolo "In verifica" (deny View Channel): gli altri override restano com'erano.
        const role = map(a.role); let ok = 0; const fail = [];
        for (const c of a.channels) {
          const ch = guild.channels.cache.get(c.id);
          if (!ch) continue;
          try { await ch.permissionOverwrites.edit(role, { ViewChannel: false }, { reason: 'setup-server: anti-raid, In verifica non vede' }); ok++; } catch (e) { fail.push('#' + c.name); }
        }
        if (fail.length) errors.push('anti-raid: override non impostato su ' + fail.length + ' canali (il bot non li vede o non ha permessi): ' + fail.join(', ').slice(0, 500));
        if (!ok && fail.length) throw new Error('nessun canale aggiornato');
      }
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
  // Messaggi fissi: ingresso con pulsante, regole 18+, guide dei canali principali.
  await guild.channels.fetch();
  const perms = permsInfo(guild, memberIntent);
  const msgs = [];
  for (const m of allMessages({ minAccountDays })) {
    const ch = textByName(guild, m.channel);
    if (ch) { try { msgs.push('#' + m.channel + ': ' + await ensureMessage(ch, m, state, perms.canPin)); } catch (e) { errors.push('#' + m.channel + ': ' + e.message); } }
  }
  // AutoMod nativo (serve Manage Guild).
  const modLog = textByName(guild, 'mod-log');
  let am = { actions: [], warnings: [] };
  if (perms.canAutomod) {
    try {
      am = await planAutomod(guild, modLog ? modLog.id : null, true);
      for (const a of am.actions) {
        try {
          if (a.op === 'automod.create') await guild.autoModerationRules.create(automod.toDiscord(a.rule));
          else await guild.autoModerationRules.edit(a.id, automod.toDiscord(a.rule));
          msgs.push(club.describe(a));
        } catch (e) { errors.push(club.describe(a) + ': ' + e.message); }
      }
    } catch (e) { errors.push('AutoMod: ' + e.message); }
  }
  const g = state.guild(guild.id);
  if (g.cursor == null) g.cursor = state.latestEventId != null ? state.latestEventId : 0;
  g.setupAt = new Date().toISOString(); state.save();
  return { planned: p.actions.length + am.actions.length, done: done.length, errors, warnings: [...p.warnings, ...perms.warnings, ...am.warnings], msgs };
}

async function preview(guild, state, { archiveOld = false, memberIntent = false, minAccountDays = 7 } = {}) {
  const snap = snapshot(guild);
  const p = club.plan(snap, { archiveOld });
  const perms = permsInfo(guild, memberIntent);
  const warnings = [...p.warnings, ...perms.warnings];
  const msgActions = await planMessages(guild, state, { minAccountDays }).catch((e) => { warnings.push('messaggi fissi: ' + e.message); return []; });
  const modLog = textByName(guild, 'mod-log');
  let am = { actions: [], warnings: [] };
  try { am = await planAutomod(guild, modLog ? modLog.id : 'new:staff/mod-log', perms.canAutomod); } catch (e) { warnings.push('AutoMod non leggibile: ' + e.message); }
  if (am.skipped) warnings.push('AutoMod: 5 regole ZDOS (anti-spam, menzioni di massa, link esterni, Telegram solo ufficiale, frasi truffa) verranno create quando il bot avrà Manage Guild.');
  warnings.push(...am.warnings);
  const actions = [...p.actions, ...msgActions, ...am.actions];
  return { actions, warnings, lines: actions.map(club.describe), perms };
}

module.exports = { snapshot, apply, preview, gateMessage, rulesMessage, allMessages, permsInfo };
