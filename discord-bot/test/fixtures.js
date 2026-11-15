'use strict';
const T22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const mintInfo = (o) => ({ value: { owner: o.owner || T22, data: { parsed: { type: 'mint', info: { decimals: 6, supply: '1000000000000', mintAuthority: o.mintAuthority || null, freezeAuthority: o.freezeAuthority || null, extensions: o.extensions || [] } } } } });
function fakeRpc(map) {
  return async (method, params) => {
    const k = method + ':' + params[0];
    if (!(k in map)) throw new Error('rpc non disponibile (' + method + ')');
    const v = map[k]; if (v instanceof Error) throw v; return v;
  };
}
module.exports = { T22, mintInfo, fakeRpc };
