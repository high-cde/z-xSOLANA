'use strict';
// Configurazione da variabili d'ambiente. Il token sta solo in /etc/zdiscord/bot.env (640), mai nel repo.
const env = process.env;
module.exports = {
  token: env.DISCORD_TOKEN || '',
  applicationId: env.APPLICATION_ID || '',
  guildId: env.DISCORD_GUILD_ID || '',
  host: env.HOST || '127.0.0.1',
  port: Number(env.PORT || 8790),
  verifyUrl: env.VERIFY_URL || 'https://x-zdos.it/discord/verify/',
  zdeskUrl: env.ZDESK_URL || 'http://127.0.0.1:8787',
  rpcUrls: [env.SOLANA_RPC_URL, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'].filter(Boolean),
  roles: { dsn: env.ROLE_DSN || 'Holder $DSN', velvet: env.ROLE_VELVET || 'Holder VELVET' },
  ourvelvetUrl: env.OURVELVET_URL || 'http://127.0.0.1:8000',
  stateDir: env.STATE_DIRECTORY || env.STATE_DIR || '',
  relayMs: Number(env.RELAY_MS || 60000),
  nonceTtlMs: Number(env.NONCE_TTL_MS || 10 * 60 * 1000),
  // Anti-raid: età minima dell'account (giorni), soglia ingressi in finestra (secondi), durata modalità raid (minuti).
  antiRaid: {
    minAccountDays: Number(env.MIN_ACCOUNT_DAYS || 7),
    joins: Number(env.RAID_JOINS || 8),
    windowS: Number(env.RAID_WINDOW_S || 60),
    raidMinutes: Number(env.RAID_MINUTES || 15),
  },
};
