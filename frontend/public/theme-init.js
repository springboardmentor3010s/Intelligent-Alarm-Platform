// Runs before first paint (external file so the strict CSP can stay free of inline scripts).
(function () {
  try {
    var m = localStorage.getItem('wakeful-theme') || 'system';
    var dark = m === 'dark' || (m === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
