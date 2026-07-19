// Registers the service worker (sw.js) and shows a persistent banner whenever
// the device has no connection, so "why isn't this loading" is never a mystery —
// the app tells you you're offline instead of a screen just hanging.

(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // Non-fatal — the app still works online without it, just without
        // offline caching. No need to surface this to the user.
      });
    });
  }

  function ensureBanner() {
    let banner = document.getElementById('offline-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'offline-banner';
      banner.className = 'offline-banner';
      banner.textContent = "📴 You're offline — showing the last saved data.";
      document.body.insertBefore(banner, document.body.firstChild);
    }
    return banner;
  }

  function updateBannerVisibility() {
    const banner = ensureBanner();
    banner.style.display = navigator.onLine ? 'none' : 'block';
  }

  window.addEventListener('online', updateBannerVisibility);
  window.addEventListener('offline', updateBannerVisibility);
  document.addEventListener('DOMContentLoaded', updateBannerVisibility);
})();