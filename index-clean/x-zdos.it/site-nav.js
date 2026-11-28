/* Menu sito ZDOS: il logo apre un cassetto raggruppato. Esc e tap fuori chiudono. */
(function () {
  var HOME = "https://x-zdos.it";
  var groups = [
    { title: "Sito", items: [
      { href: HOME + "/", label: "Home", match: "^/$|^/index\\.html$|^/hub\\.html$" },
      { href: HOME + "/#agi-console", label: "zGrok2 Chat" },
      { href: HOME + "/rete/", label: "Rete zDOS", match: "^/rete/" },
      { href: HOME + "/verifica/", label: "Verifica firma", match: "^/verifica/" },
      { href: HOME + "/downloads.html", label: "Download ISO", match: "^/downloads\\.html$" },
      { href: HOME + "/home-completa.html", label: "Home completa (archivio)", match: "^/home-completa\\.html$" }
    ]},
    { title: "Strumenti", items: [
      { href: HOME + "/ide/", label: "ZLang IDE", match: "^/ide/" },
      { href: HOME + "/dev/", label: "Portale dev", match: "^/dev/" },
      { href: HOME + "/xcloud/", label: "xCLOUD", match: "^/xcloud/" },
      { href: HOME + "/defi/", label: "DeFi (Swap · Pool · Basket)", match: "^/defi/" },
      { href: "https://swap.x-zdos.it/zroute/", label: "zRoute", ext: true }
    ]},
    { title: "Ecosistema", items: [
      { href: "https://ourvelvet.online/", label: "OurVelvet", ext: true },
      { href: "https://ourvelvet.online/merito/", label: "Miner merito", ext: true },
      { href: "https://ourvelvet.online/badge/", label: "Badge", ext: true },
      { href: "https://swap.x-zdos.it/", label: "ZSwap", ext: true },
      { href: "https://basket.x-zdos.it/", label: "zBASKET", ext: true },
      { href: "https://zdesk.x-zdos.it/", label: "ZDesk", ext: true },
      { href: "https://quest.x-zdos.it/", label: "ZQuest", ext: true },
      { href: HOME + "/zlang/linguaggio/", label: "ZLang · VM ZLB2 · monete" },
      { href: HOME + "/fomo/", label: "Solana Terminal ($DSN · VELVET)" },
      { href: HOME + "/our-vault/", label: "Our Vault" },
      { href: "https://ourvelvet.online/creator-radar/", label: "Radar creator", ext: true },
      { href: "https://ourvelvet.online/magazine/", label: "Magazine", ext: true },
      { href: "https://ourvelvet.online/pay/", label: "Velvet Pay", ext: true },
      { href: "https://zx.x-zdos.it/", label: "Agenzia Z-X", ext: true },
      { href: "https://zx.x-zdos.it/rivista/", label: "Rivista", ext: true }
    ]},
    { title: "Community", items: [
      { href: "https://t.me/OurVelvetHub", label: "Telegram", ext: true },
      { href: "https://discord.gg/4CGZrAAxaq", label: "Discord", ext: true },
      { href: "https://x.com/ZDOS_Core", label: "X @ZDOS_Core", ext: true },
      { href: "https://x.com/Rubinvonblut", label: "X @Rubinvonblut", ext: true },
      { href: "https://github.com/high-cde", label: "GitHub", ext: true }
    ]}
  ];

  function $(id) { return document.getElementById(id); }

  function pathOf(href) {
    try {
      var u = new URL(href, location.href);
      return u.pathname + u.hash;
    } catch (e) {
      return href;
    }
  }

  function isCurrent(item) {
    var path = location.pathname;
    if (item.match && new RegExp(item.match).test(path)) return true;
    try {
      var u = new URL(item.href, HOME);
      if (u.origin === location.origin && u.pathname === path && !u.hash) return true;
    } catch (e) {}
    return false;
  }

  function buildPanel() {
    var nav = document.createElement("nav");
    nav.className = "zdos-panel";
    nav.id = "zdosMenu";
    nav.hidden = true;
    nav.setAttribute("aria-label", "Menu del sito");
    groups.forEach(function (g) {
      var sec = document.createElement("section");
      sec.className = "zdos-group";
      var h = document.createElement("h2");
      h.textContent = g.title;
      sec.appendChild(h);
      var ul = document.createElement("ul");
      g.items.forEach(function (it) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = it.href;
        a.textContent = it.label;
        if (it.hint) {
          var s = document.createElement("span");
          s.className = "hint";
          s.textContent = it.hint;
          a.appendChild(s);
        }
        if (it.ext) { a.target = "_blank"; a.rel = "noopener"; }
        if (isCurrent(it)) a.setAttribute("aria-current", "page");
        li.appendChild(a);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      nav.appendChild(sec);
    });
    return nav;
  }

  function init() {
    var header = $("zdosTop") || document.querySelector("header.zdos-top");
    var btn = $("zdosMenuBtn");
    if (!header || !btn) return;

    var backdrop = $("zdosBackdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "zdosBackdrop";
      backdrop.className = "zdos-backdrop";
      backdrop.hidden = true;
      backdrop.setAttribute("aria-hidden", "true");
      header.insertAdjacentElement("afterend", backdrop);
    }

    var panel = $("zdosMenu");
    if (!panel) {
      panel = buildPanel();
      header.appendChild(panel);
    }

    var lastFocus = null;
    var open = false;

    function focusables() {
      return Array.prototype.slice.call(
        panel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter(function (el) { return !el.hidden; });
    }

    function setOpen(next) {
      open = !!next;
      header.classList.toggle("is-open", open);
      document.body.classList.toggle("zdos-menu-open", open);
      panel.hidden = !open;
      backdrop.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Chiudi il menu" : "Apri il menu");
      if (open) {
        lastFocus = document.activeElement;
        var items = focusables();
        if (items[0]) items[0].focus();
      } else if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus();
      } else {
        btn.focus();
      }
    }

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      setOpen(!open);
    });
    backdrop.addEventListener("click", function () { setOpen(false); });

    document.addEventListener("keydown", function (e) {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      var items = focusables();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      var cur = document.activeElement;
      if (e.shiftKey) {
        if (cur === first || cur === btn || !panel.contains(cur)) {
          e.preventDefault();
          last.focus();
        }
      } else if (cur === last) {
        e.preventDefault();
        first.focus();
      }
    });

    document.addEventListener("click", function (e) {
      if (!open) return;
      if (header.contains(e.target) || backdrop.contains(e.target)) return;
      setOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
