'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeAgi, eventsEmbed, INTRO } = require('../src/agi');

function fakeApi(reply = { reply: 'Benvenuto.', source: 'llm', ms: 10 }) {
  const calls = [];
  const api = async (path, body) => { calls.push({ path, body }); return { status: 200, json: reply }; };
  return { api, calls };
}

test('Zara e Rubina: modalità passata al server, sessioni separate per persona', async () => {
  let t = 0; const f = fakeApi();
  const agi = makeAgi({ api: f.api, now: () => t });
  const a = await agi.talk({ persona: 'zara', userId: 'u1', text: 'ciao', mode: 'club' });
  assert.match(a.content, /\*\*Zara:\*\* Benvenuto\./); assert.match(a.content, /18\+/);
  t += 20000;
  const b = await agi.talk({ persona: 'rubina', userId: 'u1', text: 'ciao', mode: 'public' });
  assert.match(b.content, /\*\*Rubina:\*\*/); assert.doesNotMatch(b.content, /18\+/);
  assert.strictEqual(f.calls[0].body.mode, 'club'); assert.strictEqual(f.calls[1].body.mode, 'public');
  assert.strictEqual(f.calls[1].body.messages.length, 1);
});

test('ROSSO ferma senza chiamare il modello e silenzia; riprendi sblocca', async () => {
  let t = 0; const f = fakeApi();
  const agi = makeAgi({ api: f.api, now: () => t });
  const r = await agi.talk({ persona: 'zara', userId: 'u2', text: 'Rosso', mode: 'club' });
  assert.ok(r.safeword && r.ephemeral); assert.strictEqual(f.calls.length, 0);
  t += 20000;
  const p = await agi.talk({ persona: 'zara', userId: 'u2', text: 'ciao', mode: 'club' });
  assert.match(p.content, /pausa dopo ROSSO/);
  const q = await agi.talk({ persona: 'zara', userId: 'u2', text: 'ciao', mode: 'club', resume: true });
  assert.match(q.content, /\*\*Zara:\*\*/);
});

test('limite di frequenza e errore del server gestiti', async () => {
  let t = 0;
  const agi = makeAgi({ api: async () => ({ status: 504, json: null }), now: () => t });
  const a = await agi.talk({ persona: 'rubina', userId: 'u3', text: 'ciao' });
  assert.match(a.content, /non risponde ora/);
  const b = await agi.talk({ persona: 'rubina', userId: 'u3', text: 'ancora' });
  assert.match(b.content, /Un messaggio ogni/);
});

test('eventi vuoti: nessun dato inventato; presentazione senza DM né 18+ fuori dai canali nsfw', () => {
  assert.match(eventsEmbed([]).description, /non ci sono eventi/);
  assert.match(eventsEmbed([{ title: 'Contest', body: 'x', url: 'https://velvet.x-zdos.it' }]).description, /Contest/);
  assert.match(INTRO, /Nessun DM non richiesto/); assert.match(INTRO, /nsfw/); assert.match(INTRO, /ROSSO/);
});
