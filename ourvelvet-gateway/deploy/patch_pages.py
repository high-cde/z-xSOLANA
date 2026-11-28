# Aggiunge solo voci di menu (OurVelvet, Z-X) e la banda widget nella sezione «Prenota» di ARIA. Idempotente.
import sys
ovi, riv, zxi = sys.argv[1:4]
def patch(path, anchor, add, marker, after=True):
    s = open(path, encoding="utf-8").read()
    if marker in s: print("gia presente:", path); return
    if anchor not in s: sys.exit("ancora non trovata in " + path)
    s = s.replace(anchor, anchor + add if after else add + anchor, 1)
    open(path, "w", encoding="utf-8").write(s); print("ok:", path)
patch(ovi, '<a class="menu-item" href="https://ourvelvet.online/pool-party/"><span>🎉 Pool Party (proposta)</span><span>→</span></a>',
      '\n  <a class="menu-item" href="https://ourvelvet.online/gateway/"><span>🧳 Gateway · Velvet Route</span><span>→</span></a>', 'ourvelvet.online/gateway/')
patch(riv, '<p id="trip-out" class="links" aria-live="polite"></p></form>',
      '\n <!-- OurVelvet Gateway widget (rollback: /var/backups/gateway/) -->\n <div data-ov-gateway data-formula="velvet-route"></div><script src="https://ourvelvet.online/gateway/widget.js" async></script>', 'data-ov-gateway')
patch(zxi, '<a href="/rivista/">📰 Rivista</a>', '<a href="https://ourvelvet.online/gateway/">🧳 Gateway 18+</a>', 'ourvelvet.online/gateway/')
