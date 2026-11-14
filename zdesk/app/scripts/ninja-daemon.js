#!/usr/bin/env node
'use strict';

/**
 * HighKali Ninja daemon.
 * Read-only market watcher. No private keys, no signing, no sends.
 */

const path = require('path');
const fs = require('fs');
const ninja = require('../lib/ninja');

const PID_FILE = process.env.NINJA_PID_FILE || path.join(__dirname, '..', 'ninja.pid');

function writePid() {
  fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');
}

function clearPid() {
  try {
    const cur = fs.readFileSync(PID_FILE, 'utf8').trim();
    if (cur === String(process.pid)) fs.unlinkSync(PID_FILE);
  } catch { /* */ }
}

let stopping = false;
let inTick = false;

async function loop() {
  ninja.appendLog(`DAEMON_START pid=${process.pid} interval=${ninja.THRESH.INTERVAL_MS}ms keys=false`);
  writePid();
  const boot = ninja.loadState() || ninja.defaultState();
  boot.daemon = {
    ...(boot.daemon || {}),
    pid: process.pid,
    status: 'running',
    lastTickRome: ninja.romeStamp(),
    keys: false,
    signs: false,
  };
  ninja.writeState(boot);

  while (!stopping) {
    const t0 = Date.now();
    let open = 0;
    if (!inTick) {
      inTick = true;
      try {
        const res = await ninja.tick();
        open = (res.state.positions || []).length;
        if (res.events && res.events.length) {
          for (const e of res.events) {
            console.log(`${ninja.romeStamp()} ${e.kind} ${e.symbol} ${e.detail}`);
          }
        } else {
          const worst = res.state.daemon && res.state.daemon.worst;
          console.log(`${ninja.romeStamp()} tick lag=${res.lagMs}ms open=${open} worst=${worst || 'OK'}`);
        }
      } catch (e) {
        console.error('tick error', e);
        ninja.appendLog(`ERROR tick: ${e && e.stack ? e.stack.split('\n')[0] : e}`);
      } finally {
        inTick = false;
      }
    }
    const interval = open > 0 ? ninja.THRESH.INTERVAL_MS : ninja.THRESH.IDLE_INTERVAL_MS;
    const wait = Math.max(400, interval - (Date.now() - t0));
    await new Promise((r) => setTimeout(r, wait));
  }
}

function shutdown(sig) {
  if (stopping) return;
  stopping = true;
  ninja.appendLog(`DAEMON_STOP pid=${process.pid} sig=${sig}`);
  try {
    const st = ninja.loadState() || ninja.defaultState();
    if (st.daemon) {
      st.daemon.status = 'stopped';
      st.daemon.stoppedAtRome = ninja.romeStamp();
    }
    ninja.writeState(st);
  } catch { /* */ }
  clearPid();
  setTimeout(() => process.exit(0), 50);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (e) => {
  console.error('uncaught', e);
  ninja.appendLog(`ERROR uncaught: ${e.message}`);
});
process.on('unhandledRejection', (e) => {
  console.error('unhandled', e);
  ninja.appendLog(`ERROR unhandled: ${e && e.message ? e.message : e}`);
});

loop();
