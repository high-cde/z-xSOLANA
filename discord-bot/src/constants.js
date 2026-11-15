'use strict';
module.exports = {
  DSN_SOL: '35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4', // $DSN su Solana · Token-2022 · 6 decimali · nessuna pool
  DSN_POLYGON: '0xfc90516a1f736FaC557e09D8853dB80dA192c296',
  VELVET: '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump', // VELVET ($OV)
  COLORS: { violet: 0x9945ff, green: 0x14f195, cyan: 0x66e3ff, warn: 0xffc93c, fail: 0xff5c7a },
  HEALTH: [
    ['ZSwap', 'https://swap.x-zdos.it/'],
    ['zRoute', 'https://swap.x-zdos.it/zroute/'],
    ['ZQuest', 'https://quest.x-zdos.it/'],
    ['Red Velvet (18+)', 'https://velvet.x-zdos.it/'],
    ['Zlang IDE', 'https://x-zdos.it/ide/'],
    ['x-zdos.it', 'https://x-zdos.it/'],
  ],
  // Manage Roles (1<<28) + Send Messages (1<<11) + Embed Links (1<<14) + Use Application Commands (1<<31)
  INVITE_PERMISSIONS: (1n << 28n) | (1n << 11n) | (1n << 14n) | (1n << 31n),
};
