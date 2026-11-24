// Kitaplığım · PDF.js (Mozilla, Apache-2.0) yardımcıları.
import * as pdfjsLib from '../lib/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../lib/pdf.worker.min.mjs', import.meta.url).href;

const LIB = new URL('../lib/', import.meta.url).href;

export function pdfAc(blob) {
  return blob.arrayBuffer().then(veri => pdfjsLib.getDocument({
    data: veri,
    cMapUrl: LIB + 'cmaps/',
    cMapPacked: true,
    standardFontDataUrl: LIB + 'standard_fonts/',
    wasmUrl: LIB + 'wasm/',
    iccUrl: LIB + 'iccs/',
  }).promise);
}

// Sayfayı verilen genişlikte bir canvas'a çizer.
export async function sayfaCiz(pdf, no, genislik, canvas) {
  const sayfa = await pdf.getPage(no);
  const v1 = sayfa.getViewport({ scale: 1 });
  const olcek = genislik / v1.width;
  const viewport = sayfa.getViewport({ scale: olcek });
  canvas = canvas || document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const gorev = sayfa.render({ canvasContext: canvas.getContext('2d'), viewport });
  await gorev.promise;
  return { canvas, gorev };
}

// Seçilebilir, görünmez metin katmanı (PDF.js TextLayer). Canvas resim olduğu için
// fareyle seçilen metin bu katmandan gelir; Seç-Çevir gibi araçlar onu okur.
// Yazı boyutu `--total-scale-factor` ile ölçeklenir (katman genişliği / PDF genişliği).
export async function metinKatmaniCiz(pdf, no, kap) {
  const sayfa = await pdf.getPage(no);
  const viewport = sayfa.getViewport({ scale: 1 });
  kap.dataset.pdfGen = viewport.width;
  const katman = new pdfjsLib.TextLayer({ textContentSource: sayfa.streamTextContent(), container: kap, viewport });
  await katman.render();
  return katman;
}

// Sayfadaki metin parçaları, sayfaya göre 0..1 oranlarıyla.
export async function sayfaMetni(pdf, no) {
  const sayfa = await pdf.getPage(no);
  const vp = sayfa.getViewport({ scale: 1 });
  const icerik = await sayfa.getTextContent();
  const parcalar = [];
  for (const it of icerik.items) {
    if (!it.str || !it.str.trim()) continue;
    const tx = pdfjsLib.Util.transform(vp.transform, it.transform);
    const yuk = Math.hypot(tx[2], tx[3]) || 10;
    const x = tx[4];
    const taban = tx[5];
    parcalar.push({
      str: it.str,
      x: x / vp.width,
      y: (taban - yuk) / vp.height,
      w: (it.width * vp.scale) / vp.width,
      h: (yuk * 1.15) / vp.height,
    });
  }
  return satirlaraDiz(parcalar);
}

function satirlaraDiz(p) {
  p.sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
  let satir = -1, sonOrta = -1;
  for (const it of p) {
    const orta = it.y + it.h / 2;
    if (satir < 0 || Math.abs(orta - sonOrta) > it.h * 0.5) { satir++; sonOrta = orta; }
    it.satir = satir;
  }
  p.sort((a, b) => a.satir - b.satir || a.x - b.x);
  // İki sütun var mı? Satırların ortasında tekrar eden geniş boşluk sütun aralığıdır.
  const bolmeler = [];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    if (a.satir !== b.satir) continue;
    const bosluk = b.x - (a.x + a.w);
    const orta = a.x + a.w + bosluk / 2;
    if (bosluk > 0.025 && orta > 0.3 && orta < 0.7) bolmeler.push(orta);
  }
  if (bolmeler.length >= Math.max(3, (satir + 1) * 0.25)) {
    bolmeler.sort((a, b) => a - b);
    const ayir = bolmeler[Math.floor(bolmeler.length / 2)];
    // Okuma sırası: önce sol sütunun bütün satırları, sonra sağ sütun.
    for (const it of p) it.satir = ((it.x + it.w / 2) > ayir ? 100000 : 0) + it.satir;
    p.sort((a, b) => a.satir - b.satir || a.x - b.x);
  }
  return p;
}

// Kitap eklerken: sayfa sayısı, kapak resmi, ilk sayfa metni, kapak rengi.
export async function kitapBilgisi(blob) {
  const pdf = await pdfAc(blob);
  const sayfaSayisi = pdf.numPages;
  const { canvas } = await sayfaCiz(pdf, 1, 360);
  const kapak = await new Promise(c => canvas.toBlob(c, 'image/jpeg', 0.82));
  const renk = ortalamaRenk(canvas);
  let ilkMetin = '';
  try {
    const n = Math.min(2, sayfaSayisi);
    for (let i = 1; i <= n; i++) ilkMetin += ' ' + (await sayfaMetni(pdf, i)).map(x => x.str).join(' ');
  } catch (_) {}
  let baslik = '';
  try {
    const meta = await pdf.getMetadata();
    baslik = (meta.info && meta.info.Title) || '';
  } catch (_) {}
  const oran = canvas.height / canvas.width;
  pdf.loadingTask.destroy();
  return { sayfaSayisi, kapak, renk, ilkMetin, baslik, oran };
}

function ortalamaRenk(canvas) {
  const k = document.createElement('canvas');
  k.width = 24; k.height = 24;
  const c = k.getContext('2d');
  c.drawImage(canvas, 0, 0, 24, 24);
  const v = c.getImageData(0, 0, 24, 24).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < v.length; i += 4) {
    const doy = Math.max(v[i], v[i + 1], v[i + 2]) - Math.min(v[i], v[i + 1], v[i + 2]);
    if (doy < 25) continue; // gri/beyaz pikselleri sayma
    r += v[i]; g += v[i + 1]; b += v[i + 2]; n++;
  }
  if (n < 20) return null; // kapak renksizse, sırt rengi paletten seçilir
  return [r / n, g / n, b / n].map(Math.round);
}
