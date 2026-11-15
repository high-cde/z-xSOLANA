/* Evidenziazione sintassi ZLang per CodeMirror 5 (simple mode). */
CodeMirror.defineSimpleMode('zlang', {
  start: [
    { regex: /#.*/, token: 'comment' },
    { regex: /\/\/.*/, token: 'comment' },
    { regex: /"(?:[^\\"]|\\.)*?(?:"|$)/, token: 'string' },
    { regex: /'(?:[^\\']|\\.)*?(?:'|$)/, token: 'string' },
    { regex: /^\s*(emit|let|if|wait|storage\.read)\b/, token: 'keyword', sol: true },
    { regex: /\b(jump|func|return|module|import|while|true|false|entrypoint|node|field|function|driver)\b/, token: 'keyword' },
    { regex: /^\s*[A-Za-z_]\w*:\s*$/, token: 'tag', sol: true },
    { regex: /0x[0-9a-fA-F]+|\d+(?:\.\d+)?/, token: 'number' },
    { regex: /==|!=|<=|>=|[-+*/=<>]/, token: 'operator' },
    { regex: /[A-Za-z_]\w*/, token: 'variable' },
  ],
  meta: { lineComment: '#' },
});
