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
  nonceTtlMs: Number(env.NONCE_TTL_MS || 10 * 60 * 1000),
};
