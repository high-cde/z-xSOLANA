'use strict';
const test = require('node:test');
const assert = require('node:assert');
const club = require('../src/club');
const setup = require('../src/setup');

const snap = { everyoneId: 'E', botId: 'B', botTopRolePosition: 10, roles: [], channels: [
  { id: 'cc', name: 'collabland-config', type: 0, parentId: null, overwrites: [{ id: 'E', type: 0, allow: 0n, deny: 1024n }] },
  { id: 'cj', name: 'collabland-join', type: 0, parentId: null, overwrites: [] },
  { id: 'tz', name: 'terminale-z', type: 0, parentId: null, overwrites: [] },
  { id: 'pi', name: 'porta-pubblica', type: 0, parentId: null, overwrites: [] },
  { id: 'an', name: 'annunci', type: 0, parentId: null, overwrites: [] },
] };
const touched = (p, id) => p.actions.some((a) => a.id === id || (a.channels || []).some((c) => c.id === id));

test('protezione per nome: i canali "collab" restano dove sono, senza override', () => {
  const p = club.plan(snap, { protect: { names: ['collab'] } });
  assert.ok(!touched(p, 'cc')); assert.ok(!touched(p, 'cj'));
  assert.ok(p.actions.some((a) => a.op === 'channel.archive' && a.id === 'tz'));
  assert.ok(p.warnings.some((w) => /collabland-config/.test(w) && /protetti/.test(w)));
});

test('senza protezione: comportamento invariato (collab archiviato)', () => {
  const p = club.plan(snap);
  assert.ok(p.actions.some((a) => a.op === 'channel.archive' && a.id === 'cc'));
});

test('protezione per ID e per canale con invito permanente', () => {
  const p = club.plan(snap, { protect: { names: [], ids: ['tz'], inviteChannelIds: ['pi'] } });
  assert.ok(!touched(p, 'tz')); assert.ok(!touched(p, 'pi'));
  assert.ok(touched(p, 'cc'));
});

test('canale del layout protetto: nessuna modifica e nessun duplicato', () => {
  const p = club.plan(snap, { protect: { inviteChannelIds: ['an'] } });
  assert.ok(!touched(p, 'an'));
  assert.ok(!p.actions.some((a) => a.op === 'channel.create' && a.name === 'annunci'));
  assert.ok(p.warnings.some((w) => /#annunci è protetto/.test(w)));
});

test('protectOpts: conta solo inviti permanenti non del bot e non quello salvato', async () => {
  const invs = [
    { code: '9fDdURTevG', channelId: 'cc', maxAge: 0, maxUses: 0, temporary: false, inviterId: 'U1' },
    { code: 'BOTINV', channelId: 'bv', maxAge: 0, maxUses: 0, temporary: false, inviterId: 'B' },
    { code: 'SAVED', channelId: 'bv2', maxAge: 0, maxUses: 0, temporary: false, inviterId: 'U2' },
    { code: 'TEMP', channelId: 'x', maxAge: 86400, maxUses: 0, temporary: false, inviterId: 'U3' },
  ];
  const guild = { id: 'G', members: { me: { id: 'B' } }, invites: { fetch: async () => new Map(invs.map((i) => [i.code, i])) } };
  const state = { guild: () => ({ invite: { code: 'SAVED' } }) };
  const r = await setup.protectOpts(guild, state, { names: ['collab'], ids: [] });
  assert.deepStrictEqual(r.protect.inviteChannelIds, ['cc']);
  const off = await setup.protectOpts(guild, state, { names: ['collab'], inviteChannels: false });
  assert.deepStrictEqual(off.protect.inviteChannelIds, []);
  const bad = await setup.protectOpts({ ...guild, invites: { fetch: async () => { throw new Error('Missing Permissions'); } } }, state, {});
  assert.ok(bad.warnings.length === 1);
});
