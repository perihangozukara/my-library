// KitaplÄ±ÄŸÄ±m Â· service worker: uygulamayÄ± internetsiz aÃ§ar. DÄ±ÅŸarÄ±ya istek gÃ¶ndermez.
const SURUM = 'kitapligim-v20';
const KABUK = [
  './', 'index.html', 'manifest.webmanifest', 'css/stil.css',
  'js/uygulama.js', 'js/db.js', 'js/pdf.js', 'js/okuyucu.js', 'js/oneri.js', 'js/ses.js', 'js/susleme.js', 'js/daktilo.js', 'js/yedek.js', 'sesler/liste.json',
  'lib/pdf.min.mjs', 'lib/pdf.worker.min.mjs', 'lib/page-flip.browser.js',
  'ikonlar/ikon.svg', 'ikonlar/ikon-192.png', 'ikonlar/ikon-512.png',
  'fontlar/courier-prime-400-italic-latin-ext.woff2', 'fontlar/courier-prime-400-italic-latin.woff2', 'fontlar/courier-prime-400-normal-latin-ext.woff2', 'fontlar/courier-prime-400-normal-latin.woff2', 'fontlar/courier-prime-700-normal-latin-ext.woff2', 'fontlar/courier-prime-700-normal-latin.woff2', 'fontlar/courier-prime.css',
  // gömülü olmayan yazı tipleri için (internetsiz ilk açılışta yazı bozulmasın)
  'lib/standard_fonts/FoxitDingbats.pfb', 'lib/standard_fonts/FoxitFixed.pfb', 'lib/standard_fonts/FoxitFixedBold.pfb', 'lib/standard_fonts/FoxitFixedBoldItalic.pfb', 'lib/standard_fonts/FoxitFixedItalic.pfb', 'lib/standard_fonts/FoxitSerif.pfb', 'lib/standard_fonts/FoxitSerifBold.pfb', 'lib/standard_fonts/FoxitSerifBoldItalic.pfb', 'lib/standard_fonts/FoxitSerifItalic.pfb', 'lib/standard_fonts/FoxitSymbol.pfb', 'lib/standard_fonts/LICENSE_FOXIT', 'lib/standard_fonts/LICENSE_LIBERATION', 'lib/standard_fonts/LiberationSans-Bold.ttf', 'lib/standard_fonts/LiberationSans-BoldItalic.ttf', 'lib/standard_fonts/LiberationSans-Italic.ttf', 'lib/standard_fonts/LiberationSans-Regular.ttf',
];

self.addEventListener('install', e => {
  // cache: 'reload' → tarayıcının HTTP önbelleğindeki eski kopya değil, sunucudaki güncel dosya alınır
  e.waitUntil(caches.open(SURUM).then(c => c.addAll(KABUK.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(adlar => Promise.all(adlar.filter(a => a !== SURUM).map(a => caches.delete(a))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Range isteÄŸi (ses dosyalarÄ±) de tam dosyayla yanÄ±tlanÄ±r.
  const anahtar = new Request(url.href.split('#')[0]);
  e.respondWith((async () => {
    const onbellek = await caches.open(SURUM);
    const var_ = await onbellek.match(anahtar, { ignoreSearch: true });
    // Kabuk dosyalarÄ±: Ã¶nce aÄŸ (gÃ¼ncel kalsÄ±n), olmazsa Ã¶nbellek. DiÄŸerleri: Ã¶nce Ã¶nbellek.
    const kabukMu = /\.(html|js|mjs|css|webmanifest|json)$/.test(url.pathname) || url.pathname.endsWith('/');
    if (var_ && !kabukMu) return var_;
    try {
      const yanit = await fetch(anahtar, { cache: 'no-cache' }); // sunucuya sor, eski kopyayı kullanma
      if (yanit.ok && yanit.status === 200) onbellek.put(anahtar, yanit.clone());
      return yanit;
    } catch (h) {
      if (var_) return var_;
      throw h;
    }
  })());
});
