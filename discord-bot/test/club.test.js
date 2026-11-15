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
  assert.ok(!p.actions.some((a) => a.id === 't1'), 'i canali dentro categorie esistenti non si toccano');
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
  channels.push({ id: 'c1', name: 'Text Channels', type: 4, parentId: null, overwrites: [] }, { id: 't1', name: 'general', type: 0, parentId: 'c1', overwrites: [] }, { id: 'v1', name: 'General', type: 2, parentId: id('new:archivio'), overwrites: [] });
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
