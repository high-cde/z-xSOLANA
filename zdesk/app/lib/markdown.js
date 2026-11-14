
'use strict';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMd(s) {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^\w])\*([^*]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return t;
}

function isTableSep(line) {
  return /^\s*\|?\s*:?-{3,}/.test(line);
}

function splitRow(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

function mdToHtml(md, opts = {}) {
  const maxLines = opts.maxLines || 0;
  let lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(-maxLines);
  }
  const out = [];
  let i = 0;
  let inCode = false;
  let codeBuf = [];
  let listType = null;

  const closeList = () => {
    if (listType) {
      out.push(listType === 'ol' ? '</ol>' : '</ul>');
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      if (inCode) {
        out.push('<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>');
        codeBuf = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeList();
      const headers = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && !isTableSep(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      let html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
      html += headers.map((h) => '<th>' + inlineMd(h) + '</th>').join('');
      html += '</tr></thead><tbody>';
      for (const r of rows) {
        html += '<tr>' + r.map((c) => '<td>' + inlineMd(c) + '</td>').join('') + '</tr>';
      }
      html += '</tbody></table></div>';
      out.push(html);
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      const n = h[1].length;
      out.push(`<h${n}>` + inlineMd(h[2]) + `</h${n}>`);
      i++;
      continue;
    }

    const hr = /^(-{3,}|\*{3,}|_{3,})\s*$/.exec(line);
    if (hr) {
      closeList();
      out.push('<hr/>');
      i++;
      continue;
    }

    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (listType !== 'ul') {
        closeList();
        out.push('<ul>');
        listType = 'ul';
      }
      out.push('<li>' + inlineMd(ul[1]) + '</li>');
      i++;
      continue;
    }

    if (line.trim() === '') {
      closeList();
      i++;
      continue;
    }

    closeList();
    out.push('<p>' + inlineMd(line) + '</p>');
    i++;
  }
  if (inCode) out.push('<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>');
  closeList();
  return out.join('\n');
}

module.exports = { mdToHtml, escapeHtml };
