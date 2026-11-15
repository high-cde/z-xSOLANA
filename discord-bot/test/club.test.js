'use strict';
const test = require('node:test');
const assert = require('node:assert');
const club = require('../src/club');
const { checkDeclaration, ageFrom } = require('../src/velvet');
const { makeRubina } = require('../src/rubina');
const { makeRelay, draftMessage } = require('../src/relay');
const { makeState } = require('../src/state');

const empty = { everyoneId: 'E', botId: 'B', botTopRolePosition: 10, roles: [], channels: [
  { id: 'c1', name: 'Text Channels', type: 4, parentId: null, overwrites: [] },
  { id: 't1', name: 'general', type: 0, parentId: 'c1', overwrites: [] },
  { id: 'v1', name: 'General', type: 2, parentId: null, overwrites: [] },
] };

test('permessi invito: intero esatto, niente Administrator', () => {
  assert.strictEqual(club.BOT_PERMS, 16n + 1024n + 2048n + 16384n + 32768n + 65536n + 268435456n + 2147483648n);
  assert.strictEqual(club.BOT_PERMS.toString(), '2416036880');
  assert.strictEqual(club.BOT_PERMS & 8n, 0n);
});

test('piano su server nuovo: crea ruoli, categorie, canali 18+ nsfw, archivia senza cancellare', () => {
  const p = club.plan(empty);
  const ops = p.actions.map((a) => a.op);
  assert.ok(!ops.some((o) => /delete/.test(o)));
  assert.strictEqual(p.actions.filter((a) => a.op === 'role.create').length, club.ROLES.length);
  const adult = p.actions.filter((a) => a.op === 'channel.create' && (a.key.startsWith('room18/') || a.key.startsWith('club/')));
  assert.strictEqual(adult.length, 15);
  for (const a of adult) {
    assert.strictEqual(a.nsfw, true, a.name);
    const ev = a.overwrites.find((o) => o.id === 'E');
    assert.ok(ev && (ev.deny & club.P.ViewChannel), 'everyone non vede ' + a.name);
    const v = a.overwrites.find((o) => o.id === 'new:v18');
    assert.ok(v && (v.allow & club.P.ViewChannel) && (v.deny & club.P.AttachFiles), 'v18 vede ma non carica ' + a.name);
  }
  const showcase = p.actions.find((a) => a.name === 'creator-showcase');
  assert.ok(showcase.overwrites.find((o) => o.id === 'new:creator' && (o.allow & club.P.AttachFiles)));
  const mm = p.actions.find((a) => a.name === 'mistress-master');
  assert.ok(mm.overwrites.find((o) => o.id === 'new:mistress'));
  assert.deepStrictEqual(p.actions.filter((a) => a.op === 'channel.archive').map((a) => a.name), ['General']);
  assert.ok(p.warnings.some((w) => /Text Channels/.test(w) && /restano intatte/.test(w)));
  assert.ok(!p.actions.some((a) => a.id === 't1'), 'i canali dentro categorie esistenti non si spostano');
  const lock = p.actions.find((a) => a.op === 'quarantine.lock');
  assert.ok(lock && lock.role === 'new:quarantena' && lock.channels.map((c) => c.id).sort().join() === 'c1,t1,v1', 'anti-raid: un solo override aggiunto sui canali esistenti');
  const p2 = club.plan(empty, { archiveOld: true });
  assert.ok(p2.actions.some((a) => a.op === 'category.rename' && a.name === '🗄️ Text Channels'));
  for (const a of p.actions) assert.ok(club.describe(a).length > 3);
});

test('piano idempotente: su un server già allineato non ci sono modifiche', () => {
  const p1 = club.plan(empty);
  // Simula l'applicazione
  const ids = {}; let n = 0; const id = (k) => (ids[k] = ids[k] || 'x' + (n++));
  const roles = club.ROLES.map((r) => ({ id: id('new:' + r.key), name: r.name, color: r.color, hoist: r.hoist, position: 1 }));
  const fix = (ow) => ow.map((o) => ({ ...o, id: String(o.id).startsWith('new:') ? id(o.id) : o.id }));
  const channels = [];
  for (const a of p1.actions) {
    if (a.op === 'category.create') channels.push({ id: id('new:' + a.key), name: a.name, type: 4, parentId: null, overwrites: fix(a.overwrites) });
    if (a.op === 'channel.create') channels.push({ id: id('new:' + a.key), name: a.name, type: 0, parentId: id(a.parent), topic: a.topic, nsfw: a.nsfw, overwrites: fix(a.overwrites) });
  }
  const qow = [{ id: id('new:quarantena'), type: 0, allow: 0n, deny: club.P.ViewChannel }];
  channels.push({ id: 'c1', name: 'Text Channels', type: 4, parentId: null, overwrites: qow }, { id: 't1', name: 'general', type: 0, parentId: 'c1', overwrites: qow }, { id: 'v1', name: 'General', type: 2, parentId: id('new:archivio'), overwrites: qow });
  const p2 = club.plan({ everyoneId: 'E', botId: 'B', botTopRolePosition: 10, roles, channels });
  assert.deepStrictEqual(p2.actions, []);
});

test('ruolo sopra il bot: avviso', () => {
  const p = club.plan({ ...empty, roles: [{ id: 'r', name: 'Holder $DSN', color: 0x9945ff, hoist: false, position: 50 }] });
  assert.ok(p.warnings.some((w) => /Holder \$DSN/.test(w)));
});

test('dichiarazione età: maggiorenni sì, minorenni no, data non salvata', () => {
  const today = new Date(Date.UTC(2026, 10, 15));
  assert.strictEqual(ageFrom('15/11/2008', today), 18);
  assert.strictEqual(ageFrom('16/11/2008', today), 17);
  assert.strictEqual(ageFrom('31/02/1990', today), null);
  assert.ok(checkDeclaration({ birth: '15/11/2008', accept: 'accetto' }, today).ok);
  const no = checkDeclaration({ birth: '16/11/2008', accept: 'ACCETTO' }, today);
  assert.ok(!no.ok && !no.retry);
  assert.ok(checkDeclaration({ birth: '01/01/1990', accept: 'si' }, today).retry);
});

test('Rubina: neutra fuori dalla 18+ ROOM, ROSSO silenzia, rate limit, mode discord', async () => {
  let t = 1e9; const calls = [];
  const r = makeRubina({ now: () => t, post: async (body, key) => { calls.push({ body, key }); return { status: 200, json: { reply: 'Benvenuto nel club.', safeword: false } }; } });
  assert.match((await r.talk({ userId: 'u', text: 'ciao', allowed: false })).content, /solo nei canali 18\+/);
  assert.strictEqual(calls.length, 0);
  const ok = await r.talk({ userId: 'u', text: 'ciao', allowed: true });
  assert.ok(!ok.ephemeral); assert.match(ok.content, /Rubina:\*\* Benvenuto/);
  assert.strictEqual(calls[0].body.mode, 'discord'); assert.match(calls[0].key, /^dc-[0-9a-f]{16}$/); assert.ok(!calls[0].key.includes('u'));
  t += 1000; assert.match((await r.talk({ userId: 'u', text: 'ancora', allowed: true })).content, /Piano/);
  t += 30000; const red = await r.talk({ userId: 'u', text: 'ROSSO', allowed: true });
  assert.ok(red.safeword && red.ephemeral);
  t += 60000; assert.match((await r.talk({ userId: 'u', text: 'ciao', allowed: true })).content, /in pausa/);
  assert.strictEqual(calls.length, 1);
  const res = await r.talk({ userId: 'u', text: 'ciao', allowed: true, resume: true });
  assert.ok(!res.ephemeral); assert.strictEqual(calls.length, 2); assert.strictEqual(calls[1].body.messages.length, 1);
});

test('relay: pubblica solo nei server configurati, dopo il cursore, bozza X in #bozze-x', async () => {
  const st = makeState('');
  st.guild('g1').setupAt = 'x'; st.guild('g1').cursor = 1;
  const sent = [];
  const ev = (id, kind) => ({ id, kind, title: 'Contest ' + id, body: '', url: 'https://velvet.x-zdos.it/app', x_text: 't', x_intent: 'https://x.com/intent/post?text=t', created_at: 1 });
  const relay = makeRelay({ state: st, listGuilds: () => ['g1', 'g2'], fetchFeed: async (after) => ({ max_id: 3, events: [ev(1, 'contest'), ev(2, 'contest'), ev(3, 'radar')].filter((e) => e.id > after) }), send: async (g, ch) => { sent.push(g + '/' + ch); return true; } });
  await relay.tick();
  assert.deepStrictEqual(sent, ['g1/velvet-eventi', 'g1/annunci', 'g1/bozze-x', 'g1/velvet-eventi', 'g1/bozze-x']);
  assert.strictEqual(st.guild('g1').cursor, 3);
  sent.length = 0; await relay.tick(); assert.deepStrictEqual(sent, []);
  assert.match(JSON.stringify(draftMessage(ev(9, 'evento'))), /non pubblica su X/);
});

test('permessi extra: Manage Guild e Pin Messages solo nel link di invito', () => {
  assert.strictEqual(club.INVITE_PERMS, club.BOT_PERMS | 32n | (1n << 51n));
  assert.strictEqual(club.INVITE_PERMS.toString(), '2251802229722160');
  assert.strictEqual(club.INVITE_PERMS & 8n, 0n);
});

test('anti-raid: In verifica non vede i canali pubblici, vede solo #verifica-accesso', () => {
  const p = club.plan(empty);
  const info = p.actions.find((a) => a.op === 'channel.create' && a.name === 'info');
  assert.ok(info.overwrites.find((o) => o.id === 'new:quarantena' && (o.deny & club.P.ViewChannel)));
  const v = p.actions.find((a) => a.op === 'channel.create' && a.name === 'verifica-accesso');
  assert.ok(v.overwrites.find((o) => o.id === 'E' && (o.deny & club.P.ViewChannel)));
  assert.ok(v.overwrites.find((o) => o.id === 'new:quarantena' && (o.allow & club.P.ViewChannel) && (o.deny & club.P.SendMessages)));
  assert.ok(p.actions.find((a) => a.op === 'channel.create' && a.name === 'mod-log' && a.key === 'staff/mod-log'));
  assert.ok(p.actions.find((a) => a.op === 'channel.create' && a.name === 'regole'));
});

test('raid guard: account nuovo in verifica con sblocco, picco di ingressi in verifica senza sblocco', () => {
  const { makeRaidGuard, DAY } = require('../src/antiraid');
  let t = 1e12; const g = makeRaidGuard({ minAccountDays: 7, joins: 3, windowS: 60, raidMinutes: 15, now: () => t });
  const young = g.onJoin('G', t - 2 * DAY);
  assert.ok(young.quarantine && young.autoRelease === t - 2 * DAY + 7 * DAY);
  assert.strictEqual(g.onJoin('G', t - 100 * DAY).quarantine, false);
  const third = g.onJoin('G', t - 100 * DAY);
  assert.ok(third.quarantine && third.raidStarted && third.autoRelease === null);
  t += 16 * 60000;
  assert.strictEqual(g.onJoin('G', t - 100 * DAY).quarantine, false);
});

test('AutoMod: 5 regole ZDOS, whitelist link, idempotente, non tocca regole altrui', () => {
  const am = require('../src/automod');
  const d = am.desired('ML');
  assert.strictEqual(d.length, 5);
  const link = d.find((r) => r.name.endsWith('link esterni'));
  for (const dom of ['x-zdos.it', 'discord.gg', 'solscan.io', 'polygonscan.com', 'jup.ag']) assert.ok(link.meta.allowList.includes('*://' + dom));
  assert.ok(link.meta.allowList.every((x) => x.length <= 60) && link.meta.allowList.length <= 100);
  assert.ok(!JSON.stringify(d).includes('pump.fun'));
  const tg = d.find((r) => r.name.includes('Telegram'));
  assert.deepStrictEqual(tg.meta.allowList, ['t.me/OurVelvetHub', 'telegram.me/OurVelvetHub']);
  assert.ok(new RegExp(tg.meta.regexPatterns[0]).test('https://t.me/qualcosa'));
  assert.ok(new RegExp(link.meta.regexPatterns[0]).exec('vedi https://evil.example/x')[0] === 'https://evil.example');
  const p1 = am.plan([], 'ML');
  assert.strictEqual(p1.actions.length, 5);
  const existing = d.map((r, i) => ({ ...r, id: 'r' + i, enabled: true }));
  assert.deepStrictEqual(am.plan(existing, 'ML').actions, []);
  const changed = am.plan(existing, 'ALTRO');
  assert.strictEqual(changed.actions.filter((a) => a.op === 'automod.update').length, 5);
  const other = am.plan([{ id: 'x', name: 'Spam di qualcun altro', triggerType: 3, meta: {}, actions: [] }], 'ML');
  assert.ok(!other.actions.some((a) => a.name.endsWith('anti-spam')) && other.warnings.length === 1);
  for (const a of p1.actions) assert.ok(club.describe(a).includes('AutoMod'));
});

test('guide: link ufficiali, niente pump.fun né promesse, impronta stabile', () => {
  const guides = require('../src/guides');
  const all = guides.build({ minAccountDays: 7 });
  const txt = JSON.stringify(all);
  for (const ch of ['benvenuto', 'regole', 'annunci', 'info', 'zroute', 'ide', 'zquest', 'verifica-accesso']) assert.ok(all.find((m) => m.channel === ch), ch);
  for (const l of ['https://swap.x-zdos.it/zroute/', 'https://quest.x-zdos.it', 'https://x-zdos.it/ide/', 'https://t.me/OurVelvetHub', '35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4', '0xfc90516a1f736FaC557e09D8853dB80dA192c296']) assert.ok(txt.includes(l), l);
  assert.ok(/non esiste un pool/.test(txt));
  assert.ok(!/pump\.fun/i.test(txt) && !/\bOV\b(?! \))/.test(txt.replace(/\(\$OV\)/g, '')));
  assert.ok(/non è affiliata a Elon Musk, SpaceX/.test(txt));
  assert.strictEqual(guides.hashPayload(all[0].payload), guides.hashPayload(guides.build({ minAccountDays: 7 })[0].payload));
  assert.notStrictEqual(guides.hashPayload(all[0].payload), guides.hashPayload(all[1].payload));
  const names = new Set(club.LAYOUT.flatMap((L) => L.channels.map((c) => c.name)));
  for (const m of all) assert.ok(names.has(m.channel), 'canale nella struttura: ' + m.channel);
});
