/* Tag Google unico ZDOS · DISATTIVATO finché doc non fornisce l'ID GA4 (G-XXXXXXXXXX).
   Per attivarlo: impostare GA4_ID qui sotto (un solo file per tutti i siti) e ricaricare. Nessun ID inventato.
   Rispetta Do Not Track / Global Privacy Control. © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var GA4_ID = ""; // ← segnaposto: es. "G-ABCDE12345" (da fornire)
  if (!/^G-[A-Z0-9]{6,12}$/.test(GA4_ID)) return;
  if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true) return;
  if (window.__zdosTag) return; window.__zdosTag = true;
  var s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA4_ID, { anonymize_ip: true });
})();
