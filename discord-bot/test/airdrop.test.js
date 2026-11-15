'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const club = require('../src/club');
const guides = require('../src/guides');
const inv = require('../src/invite');
const { makeAdminServer, listenAdmin, request } = require('../src/admin');

test('airdrop: categoria con #airdrop-velvet in sola lettura e #airdrop-domande, nessun ruolo airdrop', () => {
  const L = club.LAYOUT.find((x) => x.key === 'airdrop');
  assert.ok(L && !L.nsfw);
  assert.deepStrictEqual(L.channels.map((c) => c.name), ['airdrop-velvet', 'airdrop-domande']);
  const p = club.plan({ everyoneId: 'E', botId: 'B', botTopRolePosition: 10, roles: [], channels: [] });
  const ro = p.actions.find((a) => a.op === 'channel.create' && a.name === 'airdrop-velvet');
  const ev = ro.overwrites.find((o) => o.id === 'E');
  assert.ok(ev && (ev.deny & club.P.SendMessages), 'solo lettura');
  const q = p.actions.find((a) => a.op === 'channel.create' && a.name === 'airdrop-domande');
  assert.ok(!q.overwrites.some((o) => o.id === 'E' && (o.deny & club.P.SendMessages)), 'domande: si scrive');
  assert.ok(!club.ROLES.some((r) => /airdrop/i.test(r.name + r.key)));
  assert.ok(!p.actions.some((a) => a.op === 'role.create' && /airdrop/i.test(a.name)));
});

test('airdrop: testo sobrio, dati esatti, segnaposto ruolo, solo link x-zdos.it', () => {
  const msgs = guides.airdrop({});
  const txt = JSON.stringify(msgs);
  for (const s of ['15/12/2026', '24/03/2027', 'massimo 100 wallet', '20.000 VELVET ($OV)', 'DYOR', 'https://quest.x-zdos.it', 'non scrive mai in DM per primo', 'seed phrase', 'DA COMUNICARE', 'su X']) assert.ok(txt.includes(s), s);
  const urls = (txt.match(/https?:\/\/[^\s"'\\)]+/g) || []).map((u) => u.replace(/[.,]+$/, ''));
  assert.ok(urls.length > 0 && urls.every((u) => /^https:\/\/([a-z0-9-]+\.)*x-zdos\.it(\/|$)/.test(u)), 'link solo x-zdos.it: ' + urls.join(' '));
  assert.ok(!/pump\.fun|garantit[oa] (guadagn|rendiment)|rendimento garantito|guadagno garantito|profit/i.test(txt));
  assert.ok(!/\bOV\b(?! \))/.test(txt.replace(/\(\$OV\)/g, '')), '$OV si chiama sempre VELVET');
  const withRole = JSON.stringify(guides.airdrop({ airdropRole: 'Holder VELVET' }));
  assert.ok(withRole.includes('**Holder VELVET**') && !withRole.includes('DA COMUNICARE'));
  assert.notStrictEqual(guides.hashPayload(msgs[0].payload), guides.hashPayload(guides.airdrop({ airdropRole: 'X' })[0].payload));
  const all = guides.build({});
  assert.ok(all.some((m) => m.channel === 'airdrop-velvet') && all.some((m) => m.channel === 'airdrop-domande'));
  assert.ok(!/Nessun airdrop/.test(JSON.stringify(all)), 'niente testi in contraddizione con l\'airdrop');
});

test('invito pubblico: riuso salvato, riuso esistente, creazione, permanente solo con max_age 0', () => {
  const perm = { code: 'AAA', channelId: 'W', maxAge: 0, maxUses: 0, temporary: false, inviterId: 'U' };
  const mine = { ...perm, code: 'BOT', inviterId: 'B' };
  const temp = { ...perm, code: 'TMP', maxAge: 86400 };
  assert.deepStrictEqual(inv.planInvite({ stored: { code: 'BOT' }, invites: [perm, mine], channelId: 'W', botId: 'B', canCreate: true }).op, 'invite.ok');
  const r = inv.planInvite({ stored: { code: 'GONE' }, invites: [perm, mine, temp], channelId: 'W', botId: 'B', canCreate: true });
  assert.strictEqual(r.op, 'invite.reuse'); assert.strictEqual(r.code, 'BOT');
  assert.strictEqual(inv.planInvite({ invites: [perm], channelId: 'W', botId: 'B' }).code, 'AAA');
  assert.strictEqual(inv.planInvite({ invites: [temp, { ...perm, channelId: 'ALTRO' }, { ...perm, maxUses: 5 }, { ...perm, temporary: true }], channelId: 'W', botId: 'B', canCreate: true }).op, 'invite.create');
  assert.strictEqual(inv.planInvite({ invites: [], channelId: 'W', canCreate: false }).op, 'invite.blocked');
  assert.strictEqual(inv.planInvite({ invites: [], channelId: null }).op, 'invite.pending');
  assert.strictEqual(inv.publicUrl('X1'), 'https://discord.gg/X1');
  assert.ok(club.describe({ op: 'invite.create', channel: 'benvenuto' }).includes('max_age 0'));
  assert.ok(inv.inviteUrl('1').endsWith('permissions=2251802229722160'));
});

test('socket admin: una riga JSON, file 0600, errori gestiti', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zd-')); const sock = path.join(dir, 'admin.sock');
  const srv = makeAdminServer(async (req) => ({ ok: true, echo: req.mode }));
  await new Promise((r) => listenAdmin(srv, sock, r));
  try {
    assert.strictEqual(fs.statSync(sock).mode & 0o777, 0o600);
    assert.deepStrictEqual(await request(sock, { mode: 'preview' }), { ok: true, echo: 'preview' });
  } finally { srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
