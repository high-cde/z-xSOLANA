'use strict';
const C = require('./constants');
function inviteUrl(appId) {
  return 'https://discord.com/oauth2/authorize?client_id=' + encodeURIComponent(appId) + '&scope=bot%20applications.commands&permissions=' + C.INVITE_PERMISSIONS.toString();
}
if (require.main === module) console.log(inviteUrl(process.argv[2] || process.env.APPLICATION_ID || ''));
module.exports = { inviteUrl };
