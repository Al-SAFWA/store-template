/* Restore — theme initialization (inline script replacement for strict CSP).
   This script runs immediately to set the HTML lang/dir/theme attributes
   before the first paint, avoiding a flash of incorrect theme/language. */
(() => {
  "use strict";

  const LS_LANG = "restore_lang_v1";
  const LS_THEME = "restore_theme_v1";

  // Read persisted preferences
  const lang = localStorage.getItem(LS_LANG) === "fr" ? "fr" : "ar";
  const theme =
    localStorage.getItem(LS_THEME) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === "ar" ? "rtl" : "ltr";
  html.dataset.lang = lang;
  html.dataset.theme = theme;

  const preconnect = (href, cross) => {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    if (cross) link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  };
  preconnect("https://fonts.googleapis.com");
  preconnect("https://fonts.gstatic.com", true);
  const cairo = document.createElement("link");
  cairo.rel = "stylesheet";
  cairo.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap";
  document.head.appendChild(cairo);

  // Expose for other scripts
  window.RESTORE_THEME_INIT = { lang, theme };
})();
