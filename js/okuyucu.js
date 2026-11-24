// Kitaplığım · okuyucu: PDF.js ile sayfa çizimi, StPageFlip (MIT) ile sayfa çevirme,
// renkli kalemle cümle çizme.
import { db, yeniId } from './db.js';
import { pdfAc, sayfaCiz, sayfaMetni, metinKatmaniCiz } from './pdf.js';
import { sayfaSesi } from './ses.js';

export const KALEMLER = [
  { ad: 'sari', etiket: 'Sarı', renk: '#f7d84a' },
  { ad: 'pembe', etiket: 'Pembe', renk: '#f59ac0' },
  { ad: 'yesil', etiket: 'Yeşil', renk: '#8fd88a' },
  { ad: 'mavi', etiket: 'Mavi', renk: '#8cc4f2' },
];
export const ETIKETLER = ['Özlü söz', 'Şiir', 'Bilgi'];

const $ = (s, k = document) => k.querySelector(s);
let d = null; // açık okuyucunun durumu
let acilisNo = 0; // açılış sürerken kapatılırsa açılışı iptal etmek için

function ipucu(m) {
  const b = $('#bildirim'); if (!b) return;
  b.textContent = m; b.hidden = false;
  clearTimeout(ipucu.z); ipucu.z = setTimeout(() => { b.hidden = true; }, 2600);
}

export function okuyucuAcikMi() { return !!d; }

// Sekme gizlenir ya da kapanırsa kaldığın sayfayı beklemeden kaydet.
function hemenKaydet() {
  if (!d) return;
  clearTimeout(d.kaydetZaman);
  const no = d.pf.getCurrentPageIndex() + 1;
  const kitap = d.kitap;
  db.al('kitaplar', kitap.id).then(k => { if (k) { k.sonSayfa = no; k.sonOkuma = Date.now(); db.koy('kitaplar', k); } });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) hemenKaydet(); });
addEventListener('pagehide', hemenKaydet);
export function okuyucuKitabi() { return d ? d.kitap : null; }

export async function okuyucuAc(kitap, baslangic, sec = {}) {
  if (d) await okuyucuKapat();
  const benim = ++acilisNo;
  const kok = $('#okuyucu');
  kok.hidden = false;
  document.body.classList.add('okuyor');
  $('#ok-baslik').textContent = kitap.ad;
  $('#ok-yukleniyor').hidden = false;

  const dosya = await db.al('dosyalar', kitap.id);
  if (!dosya) { $('#ok-yukleniyor').textContent = 'Dosya bulunamadı.'; return; }
  if (benim !== acilisNo) return;
  const pdf = await pdfAc(dosya.blob);
  if (benim !== acilisNo) { pdf.loadingTask.destroy(); return; }
  const N = pdf.numPages;
  const tum = await db.hepsi('cizimler');
  if (benim !== acilisNo) { pdf.loadingTask.destroy(); return; }

  d = {
    kitap, pdf, N, sec,
    cizilen: new Map(),     // sayfaNo -> genişlik
    metin: new Map(),       // sayfaNo -> Promise<parçalar>
    cizimler: tum.filter(c => c.kitapId === kitap.id),
    kalem: null,
    kuyruk: Promise.resolve(),
    kaydetZaman: null,
    zoom: 1,
    parlat: !!sec.parlat, // paragraf işareti açılışta parlasın
  };

  const sahne = $('#ok-sahne');
  const eski = $('#ok-kitap'); if (eski) eski.remove();
  const kitapEl = document.createElement('div');
  kitapEl.id = 'ok-kitap';
  sahne.prepend(kitapEl);
  boyutla(kitapEl);

  const sayfalar = [];
  for (let i = 1; i <= N; i++) {
    const s = document.createElement('div');
    s.className = 'sayfa';
    s.dataset.no = i;
    if (i === 1 || i === N) s.dataset.density = 'hard';
    s.classList.add(i % 2 === 0 ? 'sol-sayfa' : 'sag-sayfa'); // kapak tek başına sağda: çift sayfalar solda
    s.innerHTML = `<div class="sayfa-ic"></div><div class="sayfa-bombe"></div><div class="vurgu-katman"></div><div class="metin-katman textLayer"></div><div class="sayfa-alt">${i}</div>`;
    sayfalar.push(s);
    kitapEl.appendChild(s);
  }
  d.sayfalar = sayfalar;

  const oran = kitap.oran || 1.414;
  const pf = new St.PageFlip(kitapEl, {
    width: 500, height: Math.round(500 * oran),
    size: 'stretch',
    minWidth: 200, maxWidth: 1400,
    minHeight: Math.round(200 * oran), maxHeight: Math.round(1400 * oran),
    showCover: true,
    usePortrait: true,
    mobileScrollSupport: false,
    maxShadowOpacity: 0.45,
    flippingTime: 650,
    startPage: Math.max(0, Math.min(N - 1, (baslangic || 1) - 1)),
    autoSize: true,
    showPageCorners: true,
  });
  pf.loadFromHTML(sayfalar);
  d.pf = pf;
  kitapEl.appendChild($('#ok-kalem-katman'));
  try { pf.getUI().swipeTimeout = 700; } catch (_) {} // yavaş kaydırma da sayfa çevirsin (varsayılan 250 ms)
  zoomUygula(); // dikey ekranda tek sayfa

  pf.on('flip', e => {
    gostergeGuncelle();
    gorunurleriCiz();
    sayfaKaydet(e.data + 1);
    govdeGuncelle();
  });
  pf.on('changeState', e => {
    if (e.data === 'flipping' && (!d.sec.sesAcik || d.sec.sesAcik())) sayfaSesi();
  });
  pf.on('changeOrientation', () => { d.cizilen.clear(); gorunurleriCiz(); govdeGuncelle(); });

  $('#ok-yukleniyor').hidden = true;
  gostergeGuncelle();
  gorunurleriCiz();
  sayfaKaydet(pf.getCurrentPageIndex() + 1);
  window.addEventListener('resize', yenidenBoyutla);
  document.addEventListener('keydown', tusla);
}

// StPageFlip (autoSize) kutuyu %100 genişlikte tutar; yüksekliği sahne sınırlar (CSS: #ok-kitap height:100%).
function boyutla() {}

let boyutZaman = null;
function yenidenBoyutla() {
  if (!d) return;
  clearTimeout(boyutZaman);
  boyutZaman = setTimeout(() => { if (d) zoomUygula(); }, 250);
}

// ---------- Gerçek kitap görünümü: sert kapak ve sayfa yığını ----------
function govdeGuncelle() {
  if (!d) return;
  const blok = $('#ok-kitap .stf__block');
  if (!blok) return;
  let g = blok.querySelector('.kitap-govde');
  if (!g) {
    g = document.createElement('div');
    g.className = 'kitap-govde';
    g.innerHTML = '<div class="cilt"></div><div class="yigin sol"></div><div class="yigin sag"></div>';
    blok.prepend(g);
    const renk = d.kitap.renk ? `rgb(${d.kitap.renk.map(x => Math.round(x * 0.55)).join(',')})` : '#5a2f24';
    g.style.setProperty('--cilt', renk);
  }
  const b = d.pf.getBoundsRect();
  const tek = d.pf.getOrientation() === 'portrait';
  const i = d.pf.getCurrentPageIndex();
  const N = d.N;
  const kapakta = !tek && i === 0;                         // kapak tek başına sağda
  const sondaTek = !tek && i >= N - 1 && N % 2 === 0;     // arka kapak tek başına solda
  let x = b.left, w = b.width;
  if (tek || kapakta) { x = b.left + b.pageWidth; w = b.pageWidth; }
  else if (sondaTek) { w = b.pageWidth; }
  const okunan = N > 1 ? i / (N - 1) : 0;
  const enCok = Math.min(14, 3 + N / 30);                  // kalın kitapta yığın daha kalın
  const sol = tek || kapakta ? 0 : Math.max(1, okunan * enCok);
  const sag = sondaTek ? 0 : Math.max(1, (1 - okunan) * enCok);
  g.style.cssText += `;left:${x - sol}px;top:${b.top}px;width:${w + sol + sag}px;height:${b.height}px`;
  g.style.setProperty('--sol', sol + 'px');
  g.style.setProperty('--sag', sag + 'px');
  g.classList.toggle('tek', tek || kapakta || sondaTek);
  $('#ok-kitap').classList.toggle('tek-sayfa', tek);
}

// ---------- Kaldığın paragraf işareti ----------
// Dokunulan satırın ait olduğu paragrafın başını bulur.
function paragrafBasi(p, nokta) {
  if (!p.length) return null;
  const sat = new Map();
  for (const it of p) {
    let s = sat.get(it.satir);
    if (!s) sat.set(it.satir, s = { satir: it.satir, x: it.x, y: it.y, h: it.h, son: it.x + it.w, metin: '' });
    s.x = Math.min(s.x, it.x); s.y = Math.min(s.y, it.y); s.h = Math.max(s.h, it.h);
    s.son = Math.max(s.son, it.x + it.w);
    s.metin += (s.metin && !/\s$/.test(s.metin) ? ' ' : '') + it.str;
  }
  const L = [...sat.values()].sort((a, b) => a.satir - b.satir);
  const sutun = s => (s.satir >= 100000 ? 1 : 0);
  let i = 0, en = Infinity;
  L.forEach((s, k) => {
    const dy = nokta.y < s.y ? s.y - nokta.y : nokta.y > s.y + s.h ? nokta.y - s.y - s.h : 0;
    const dx = nokta.x < s.x ? s.x - nokta.x : nokta.x > s.son ? nokta.x - s.son : 0;
    const puan = dy * 4 + dx;
    if (puan < en) { en = puan; i = k; }
  });
  const ayni = L.filter(s => sutun(s) === sutun(L[i]));
  const araliklar = [];
  for (let k = 1; k < ayni.length; k++) { const a = ayni[k].y - ayni[k - 1].y; if (a > 0) araliklar.push(a); }
  araliklar.sort((a, b) => a - b);
  const tipik = araliklar.length ? araliklar[Math.floor(araliklar.length / 2)] : 0.03;
  const xler = ayni.map(s => s.x).sort((a, b) => a - b);
  const solKenar = xler[Math.floor(xler.length * 0.2)] ?? 0;
  const sonlar = ayni.map(s => s.son).sort((a, b) => a - b);
  const sagKenar = sonlar[Math.floor(sonlar.length * 0.8)] ?? 1;
  while (i > 0) {
    const a = L[i - 1], b = L[i];
    if (sutun(a) !== sutun(b)) break;
    const bosluk = b.y - a.y;
    const girinti = b.x - solKenar > 0.015;
    const oncekiKisa = a.son < sagKenar - 0.08;
    if (bosluk > tipik * 1.45 || girinti || oncekiKisa) break;
    i--;
  }
  return L[i];
}

async function yerImiKoy(sayfaEl, no, nokta) {
  const p = await metinAl(no);
  const s = paragrafBasi(p, nokta);
  const yer = s
    ? { sayfa: no, x: s.x, y: s.y, h: s.h, son: s.son, metin: s.metin.replace(/\s+/g, ' ').trim().slice(0, 70), tarih: Date.now() }
    : { sayfa: no, x: 0.06, y: Math.max(0, nokta.y - 0.012), h: 0.024, son: 0.94, metin: '', tarih: Date.now() }; // metinsiz sayfa
  const k = await db.al('kitaplar', d.kitap.id);
  if (!k) return;
  const eski = d.kitap.yerImi;
  k.yerImi = yer; k.sonSayfa = no; k.sonOkuma = Date.now();
  await db.koy('kitaplar', k);
  d.kitap.yerImi = yer; d.kitap.sonSayfa = no;
  if (eski && eski.sayfa !== no) vurgulariGoster(eski.sayfa);
  vurgulariGoster(no);
  kalemSec(null);
  ipucu(yer.metin ? `🔖 Kaldığın paragraf işaretlendi: "${yer.metin.slice(0, 40)}…"` : '🔖 Kaldığın yer işaretlendi.');
  d.sec.sayfaDegisti && d.sec.sayfaDegisti(k);
}

function yerImiGoster(n) {
  const katman = d.sayfalar[n - 1].querySelector('.vurgu-katman');
  katman.querySelectorAll('.yer-imi-isaret, .yer-imi-bant').forEach(x => x.remove());
  const y = d.kitap.yerImi;
  if (!y || y.sayfa !== n) return;
  const bant = document.createElement('div');
  bant.className = 'yer-imi-bant';
  bant.style.cssText = `left:${Math.max(0, y.x - 0.01) * 100}%;top:${(y.y - 0.004) * 100}%;width:${Math.min(1, y.son - y.x + 0.02) * 100}%;height:${(y.h + 0.008) * 100}%`;
  const isaret = document.createElement('div');
  isaret.className = 'yer-imi-isaret';
  isaret.title = 'Kaldığın paragraf';
  isaret.style.cssText = `left:${Math.max(0.005, y.x - 0.045) * 100}%;top:${(y.y - 0.012) * 100}%`;
  katman.append(bant, isaret);
  if (d.parlat) { d.parlat = false; bant.classList.add('parla'); isaret.classList.add('parla'); }
}

// ---------- Bu kitapta işaretlediğin cümleler (okurken yan panel) ----------
const kacisH = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function cizimPaneliAc() {
  if (!d) return;
  const p = $('#ok-cizimler');
  p.style.top = $('#ok-ust').offsetHeight + 'px'; // telefonda üst çubuk daha yüksek
  p.hidden = !p.hidden;
  if (!p.hidden) cizimPaneliCiz();
}
function cizimPaneliCiz() {
  const p = $('#ok-cizimler');
  if (!d || p.hidden) return;
  const liste = [...d.cizimler].sort((a, b) => a.sayfa - b.sayfa || (a.rects[0]?.y ?? 0) - (b.rects[0]?.y ?? 0));
  const yi = d.kitap.yerImi;
  $('#ok-cizimler-sayi').textContent = liste.length ? `(${liste.length})` : '';
  $('#ok-cizimler ul').innerHTML =
    (yi ? `<li class="oc-yerimi" data-sayfa="${yi.sayfa}" data-yerimi="1"><span class="oc-serit"></span><div><q>${kacisH(yi.metin || 'Kaldığın yer')}</q><small>🔖 Kaldığın paragraf · s. ${yi.sayfa}</small></div></li>` : '') +
    (liste.length ? liste.map(c => `<li data-sayfa="${c.sayfa}" data-id="${c.id}"><span class="oc-serit" style="background:${renkKodu(c.renk)}"></span><div><q>${c.metin ? kacisH(c.metin) : '<i>Metin yakalanamadı</i>'}</q><small>s. ${c.sayfa}${c.etiket ? ' · ' + kacisH(c.etiket) : ''}</small></div></li>`).join('')
      : '<li class="oc-bos">Bu kitapta henüz çizim yok. Renkli kalemlerden birini seç ve cümlenin üstünden geç.</li>');
}
export function cizimPaneliKur() {
  const p = $('#ok-cizimler');
  p.addEventListener('click', e => {
    if (e.target.closest('#ok-cizimler-kapat')) { p.hidden = true; return; }
    const li = e.target.closest('li[data-sayfa]');
    if (!li || !d) return;
    const no = +li.dataset.sayfa;
    if (li.dataset.yerimi) d.parlat = true; else d.parlaCizim = li.dataset.id;
    sayfayaGit(no);
    vurgulariGoster(no);
    setTimeout(() => { if (d) d.parlaCizim = null; }, 50);
    if (innerWidth < 700) p.hidden = true; // telefonda sayfayı görmek için panel kapansın
  });
  // dışarı dokununca kapansın
  document.addEventListener('pointerdown', e => {
    if (p.hidden || p.contains(e.target) || e.target.closest('#ok-cizim-btn')) return;
    p.hidden = true;
  }, true);
}

// ---------- Yakınlaştırma ----------
const ZOOMLAR = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];

function zoomGoster() {
  const b = $('#ok-zoom');
  if (b) b.textContent = Math.round((d ? d.zoom : 1) * 100) + '%';
}

function zoomUygula() {
  const el = $('#ok-kitap');
  const ayar = d.pf.getSettings();
  // Dikey ekranda (tablet dikey, telefon) tek büyük sayfa; yatayda çift sayfa.
  const sahne = $('#ok-sahne');
  const dikey = sahne.clientHeight > sahne.clientWidth * 1.05;
  // Önce %100'de ölç: kitabın sahneye sığan boyutu
  ayar.minWidth = dikey ? 100000 : 200; ayar.maxWidth = 1400;
  el.style.width = ''; el.style.height = '';
  d.pf.update();
  if (d.zoom > 1) {
    const b = d.pf.getBoundsRect();
    const tek = d.pf.getOrientation() === 'portrait';
    // Tek sayfa görünümü yakınlaşınca çift sayfaya dönmesin
    if (tek) ayar.minWidth = 100000;
    ayar.maxWidth = 100000;
    el.style.width = Math.round((tek ? b.pageWidth : b.pageWidth * 2) * d.zoom) + 'px';
    el.style.height = Math.round(b.height * d.zoom) + 'px';
    d.pf.update();
  }
  zoomGoster();
  govdeGuncelle();
  d.cizilen.clear();
  gorunurleriCiz();
}

// yon: +1 yakınlaş, -1 uzaklaş, 0 sığdır
export function yakinlastir(yon) {
  if (!d) return;
  const sahne = $('#ok-sahne');
  const cx = (sahne.scrollLeft + sahne.clientWidth / 2) / Math.max(1, sahne.scrollWidth);
  const cy = (sahne.scrollTop + sahne.clientHeight / 2) / Math.max(1, sahne.scrollHeight);
  let i = ZOOMLAR.findIndex(z => z >= d.zoom - 0.001);
  i = yon === 0 ? 0 : Math.max(0, Math.min(ZOOMLAR.length - 1, i + yon));
  if (ZOOMLAR[i] === d.zoom) return;
  d.zoom = ZOOMLAR[i];
  zoomUygula();
  sahne.scrollLeft = cx * sahne.scrollWidth - sahne.clientWidth / 2;
  sahne.scrollTop = cy * sahne.scrollHeight - sahne.clientHeight / 2;
}

function tusla(e) {
  if (!d || e.target.matches('input, textarea')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') d.pf.flipNext();
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') d.pf.flipPrev();
  else if (e.key === 'Escape') { if (d.kalem) kalemSec(null); else okuyucuKapat(); }
}

function gostergeGuncelle() {
  const i = d.pf.getCurrentPageIndex() + 1;
  $('#ok-sayfa').value = i;
  $('#ok-toplam').textContent = '/ ' + d.N;
}

export function sayfayaGit(no) {
  if (!d) return;
  no = Math.max(1, Math.min(d.N, no | 0));
  d.pf.turnToPage(no - 1);
  gostergeGuncelle();
  gorunurleriCiz();
  sayfaKaydet(no);
}
export function sonraki() { d && d.pf.flipNext(); }
export function onceki() { d && d.pf.flipPrev(); }

function sayfaKaydet(no) {
  clearTimeout(d.kaydetZaman);
  const kitap = d.kitap;
  d.kaydetZaman = setTimeout(async () => {
    const k = await db.al('kitaplar', kitap.id);
    if (!k) return;
    k.sonSayfa = no;
    k.sonOkuma = Date.now();
    await db.koy('kitaplar', k);
    kitap.sonSayfa = no;
    d && d.sec.sayfaDegisti && d.sec.sayfaDegisti(k);
  }, 300);
}

// Yalnızca görünen ve yakın sayfaları çiz; uzaktakileri bellekten at.
function gorunurleriCiz() {
  if (!d) return;
  const durum = d;
  const i = durum.pf.getCurrentPageIndex() + 1;
  const sayfaGen = durum.pf.getBoundsRect().pageWidth;
  const gen = Math.min(3000, Math.round(sayfaGen * Math.min(window.devicePixelRatio || 1, 2.5))); // bellek sınırı
  const istenen = [];
  for (let n = i - 1; n <= i + 3; n++) if (n >= 1 && n <= durum.N) istenen.push(n);
  istenen.sort((a, b) => Math.abs(a - i) - Math.abs(b - i));

  for (const [n] of durum.cizilen) {
    if (Math.abs(n - i) > 8) {
      const ic = durum.sayfalar[n - 1].querySelector('.sayfa-ic');
      ic.innerHTML = '';
      durum.sayfalar[n - 1].querySelector('.metin-katman').innerHTML = '';
      durum.cizilen.delete(n);
    }
  }
  for (const n of istenen) {
    if (durum.cizilen.get(n) === gen) continue;
    durum.cizilen.set(n, gen);
    durum.kuyruk = durum.kuyruk.then(async () => {
      if (d !== durum) return;
      try {
        const { canvas } = await sayfaCiz(durum.pdf, n, gen);
        if (d !== durum) return;
        const ic = durum.sayfalar[n - 1].querySelector('.sayfa-ic');
        ic.innerHTML = '';
        ic.appendChild(canvas);
        katmanOturt(durum.sayfalar[n - 1], canvas.width / canvas.height, durum.kitap.oran || 1.414);
        vurgulariGoster(n);
        metinAl(n); // kalem için metni önceden hazırla
        metinKatmaniKur(durum, n);
      } catch (h) { console.warn('[Kitaplığım] sayfa çizilemedi', n, h); durum.cizilen.delete(n); }
    });
  }
}

// Sayfa kutusu kitabın ilk sayfasının oranında; bu sayfanın oranı farklıysa (yatay sayfa)
// resim ortalanır (object-fit: contain), vurgu katmanı da tam resmin üstüne oturtulur.
function katmanOturt(sayfaEl, resimOrani, kitapOrani) {
  const kutuOrani = 1 / kitapOrani; // genişlik / yükseklik
  const k = sayfaEl.querySelector('.vurgu-katman');
  // Metin katmanının satır içi stiline PDF.js de yazar; konumu CSS değişkenleriyle verilir.
  const mk = sayfaEl.querySelector('.metin-katman');
  const yer = (sol, ust, gen, yuk) => {
    k.style.cssText = `left:${sol}%;top:${ust}%;width:${gen}%;height:${yuk}%`;
    mk.style.setProperty('--yer-sol', sol + '%'); mk.style.setProperty('--yer-ust', ust + '%');
    mk.style.setProperty('--yer-gen', gen + '%'); mk.style.setProperty('--yer-yuk', yuk + '%');
  };
  if (Math.abs(resimOrani - kutuOrani) < 0.01) yer(0, 0, 100, 100);
  else if (resimOrani > kutuOrani) {
    const h = kutuOrani / resimOrani * 100;
    yer(0, (100 - h) / 2, 100, h);
  } else {
    const w = resimOrani / kutuOrani * 100;
    yer((100 - w) / 2, 0, w, 100);
  }
}

// Görünmez, seçilebilir metin katmanı: fareyle cümle seçip kopyalamak için (Seç-Çevir).
// Sayfa büyüyüp küçülünce yazı boyutu da uysun diye katmanın genişliği izlenir.
const katmanOlcer = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver(girdiler => { for (const g of girdiler) metinOlcekle(g.target); })
  : null;
function metinOlcekle(mk) {
  const pdfGen = +mk.dataset.pdfGen;
  if (pdfGen && mk.offsetWidth) mk.style.setProperty('--total-scale-factor', mk.offsetWidth / pdfGen);
}
async function metinKatmaniKur(durum, n) {
  const mk = durum.sayfalar[n - 1].querySelector('.metin-katman');
  if (mk.childElementCount) return; // zaten var (yalnız resmin çözünürlüğü değişti)
  try {
    await metinKatmaniCiz(durum.pdf, n, mk);
    if (d !== durum) return;
    metinOlcekle(mk);
    if (katmanOlcer) katmanOlcer.observe(mk);
  } catch (h) { mk.innerHTML = ''; }
}

function metinAl(n) {
  if (!d.metin.has(n)) d.metin.set(n, sayfaMetni(d.pdf, n).catch(() => []));
  return d.metin.get(n);
}

function vurgulariGoster(n) {
  const katman = d.sayfalar[n - 1].querySelector('.vurgu-katman');
  katman.querySelectorAll('.vurgu:not(.onizleme)').forEach(x => x.remove());
  for (const c of d.cizimler.filter(c => c.sayfa === n)) {
    for (const r of c.rects) {
      const v = vurguDiv(r, c.renk);
      if (d.parlaCizim === c.id) v.classList.add('parla');
      katman.appendChild(v);
    }
  }
  yerImiGoster(n);
}

function vurguDiv(r, renk, onizleme = false) {
  const v = document.createElement('div');
  v.className = 'vurgu' + (onizleme ? ' onizleme' : '');
  v.style.cssText = `left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%;background:${renkKodu(renk)}`;
  return v;
}

function renkKodu(ad) { return ad === 'cevir' ? '#a9cdf5' : (KALEMLER.find(k => k.ad === ad) || KALEMLER[0]).renk; }

// ---------- Kalem ----------
// StPageFlip fare hareketini ve bırakmayı bütün pencereden dinler; kalem açıkken
// köşe kıvrılıp sayfa çevrilmesin diye bu olaylar ona ulaşmadan durdurulur.
// Kalem pointer olaylarıyla çalıştığı için etkilenmez.
const KALEM_ENGEL = ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend'];
let tutamEngel = false, tutamEngelZaman = 0; // iki parmakla büyütürken de StPageFlip olayları durdurulur
function kalemEngeli(e) {
  if (!d || (!d.kalem && !tutamEngel)) return;
  if (e.target.closest && e.target.closest('#ok-ust, #alt, #ses-panel, #etiket-kutu, dialog')) return;
  e.stopPropagation();
}
let engelKurulu = false;
function engelAyarla(acik) {
  if (acik === engelKurulu) return;
  KALEM_ENGEL.forEach(t => (acik ? window.addEventListener : window.removeEventListener).call(window, t, kalemEngeli, true));
  engelKurulu = acik;
}

// Fareyle metnin üstünden sürüklemeye başlanınca bu sürükleme metin seçimidir.
// StPageFlip görürse köşeyi kıvırıp sayfayı çevirir; bırakana kadar olaylar ona ulaşmaz.
// (stopPropagation tarayıcının kendi seçimini engellemez.)
let fareSecim = false;
window.addEventListener('mousedown', e => {
  if (!d || d.kalem || e.button !== 0) return;
  if (!e.target.closest || !e.target.closest('.metin-katman span')) return;
  fareSecim = true;
  e.stopPropagation();
}, true);
window.addEventListener('mousemove', e => { if (fareSecim) e.stopPropagation(); }, true);
window.addEventListener('mouseup', e => { if (fareSecim) { fareSecim = false; e.stopPropagation(); } }, true);

export function kalemSec(ad) {
  if (!d) return;
  d.kalem = ad;
  engelAyarla(!!ad);
  const katman = $('#ok-kalem-katman');
  katman.hidden = !ad;
  document.querySelectorAll('.kalem-btn').forEach(b => b.classList.toggle('secili', b.dataset.kalem === (ad || '')));
}

// Sayfalar resim (canvas) olarak çizildiği için tarayıcıda seçili metin yoktur; Ctrl+C boş
// kalırdı. Kalemle çizilen son metin, çizimden sonraki 10 saniye içinde Ctrl+C ile
// kopyalanır. Böylece Seç-Çevir gibi Ctrl+C ile okuyan araçlar da cümleyi alır.
// Sayfada gerçek bir seçim ya da bir yazı kutusunda imleç varsa ona dokunulmaz.
let sonKalemMetni = null;
document.addEventListener('copy', e => {
  const s = sonKalemMetni;
  if (!s || Date.now() - s.zaman > 10000) return;
  const odak = document.activeElement;
  if (odak && (odak.isContentEditable || /^(INPUT|TEXTAREA)$/.test(odak.tagName))) return;
  if (String(window.getSelection() || '').trim()) return;
  e.clipboardData.setData('text/plain', s.metin);
  e.preventDefault();
});

export function kalemKur() {
  const katman = $('#ok-kalem-katman');
  let cizim = null;

  // Dokunmatikte sayfanın sağ/sol kenarına kısa dokunuş sayfayı çevirir.
  const sahne = $('#ok-sahne');
  let dokun = null;
  sahne.addEventListener('pointerdown', e => {
    if (!d || d.kalem || e.pointerType === 'mouse') { dokun = null; return; }
    dokun = { x: e.clientX, y: e.clientY, t: Date.now(), sayfa: d.pf.getCurrentPageIndex() };
  }, true);
  sahne.addEventListener('pointerup', e => {
    const k = dokun; dokun = null;
    if (!k || !d || d.kalem) return;
    if (Math.hypot(e.clientX - k.x, e.clientY - k.y) > 12 || Date.now() - k.t > 350) return;
    const r = sahne.getBoundingClientRect();
    const oran = (e.clientX - r.left) / r.width;
    setTimeout(() => {
      if (!d || d.pf.getCurrentPageIndex() !== k.sayfa) return; // StPageFlip zaten çevirdiyse dokunma
      if (oran > 0.68) d.pf.flipNext();
      else if (oran < 0.32) d.pf.flipPrev();
    }, 90);
  }, true);

  // ---------- Parmakla büyütme (iki parmak) ve büyütülmüşken tek parmakla gezinme ----------
  const parmaklar = new Map();
  let tutam = null;   // iki parmak hareketi
  let kaydir = null;  // büyütülmüşken tek parmakla gezinme
  const uzaklik = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  sahne.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || !d || d.kalem) return;
    parmaklar.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (parmaklar.size === 2) {
      const [a, b] = [...parmaklar.values()];
      const kitapEl = $('#ok-kitap');
      const kr = kitapEl.getBoundingClientRect();
      kitapEl.style.transformOrigin = `${(a.x + b.x) / 2 - kr.left}px ${(a.y + b.y) / 2 - kr.top}px`;
      tutam = { bas: Math.max(20, uzaklik(a, b)), zoom: d.zoom, hedef: d.zoom };
      kaydir = null; dokun = null;
      // İki parmak hareketi sürerken StPageFlip dokunuşları görmesin (yoksa kaydırma sanıp sayfa/yön değiştiriyor)
      clearTimeout(tutamEngelZaman); tutamEngel = true; engelAyarla(true);
      // StPageFlip ilk parmağı kaydetmiş olabilir: 700 ms sonra kendiliğinden katlamaya başlamasın
      try { d.pf.getUI().touchPoint = null; } catch (_) {}
    } else if (parmaklar.size === 1 && d.zoom > 1) {
      kaydir = { x: e.clientX, y: e.clientY };
    }
  }, true);
  sahne.addEventListener('pointermove', e => {
    if (!parmaklar.has(e.pointerId) || !d) return;
    parmaklar.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tutam && parmaklar.size >= 2) {
      const [a, b] = [...parmaklar.values()];
      tutam.hedef = Math.max(1, Math.min(3, tutam.zoom * uzaklik(a, b) / tutam.bas));
      $('#ok-kitap').style.transform = `scale(${tutam.hedef / tutam.zoom})`; // canlı önizleme
    } else if (kaydir) {
      sahne.scrollLeft -= e.clientX - kaydir.x;
      sahne.scrollTop -= e.clientY - kaydir.y;
      kaydir = { x: e.clientX, y: e.clientY };
      if (dokun && Math.hypot(e.clientX - dokun.x, e.clientY - dokun.y) > 12) dokun = null;
    }
  }, true);
  const parmakBitti = e => {
    if (!parmaklar.delete(e.pointerId)) return;
    if (tutam && parmaklar.size < 2) {
      const t = tutam; tutam = null; kaydir = null;
      const kitapEl = $('#ok-kitap');
      kitapEl.style.transform = ''; kitapEl.style.transformOrigin = '';
      if (!d) return;
      // en yakın büyütme adımına otur, parmakların ortası yerinde kalsın
      const enYakin = ZOOMLAR.reduce((m, z) => Math.abs(z - t.hedef) < Math.abs(m - t.hedef) ? z : m, ZOOMLAR[0]);
      if (enYakin !== d.zoom) {
        const cx = (sahne.scrollLeft + sahne.clientWidth / 2) / Math.max(1, sahne.scrollWidth);
        const cy = (sahne.scrollTop + sahne.clientHeight / 2) / Math.max(1, sahne.scrollHeight);
        d.zoom = enYakin;
        zoomUygula();
        sahne.scrollLeft = cx * sahne.scrollWidth - sahne.clientWidth / 2;
        sahne.scrollTop = cy * sahne.scrollHeight - sahne.clientHeight / 2;
      }
    }
    if (!parmaklar.size) {
      kaydir = null;
      // son parmağın touchend olayı da StPageFlip'e gitmesin; sonra engeli kalem durumuna geri al
      if (tutamEngel) tutamEngelZaman = setTimeout(() => { tutamEngel = false; engelAyarla(!!(d && d.kalem)); }, 80);
    }
  };
  sahne.addEventListener('pointerup', parmakBitti, true);
  sahne.addEventListener('pointercancel', parmakBitti, true);
  // İki parmak varken ya da büyütülmüşken StPageFlip dokunmayı sayfa çevirme sanmasın;
  // tarayıcının kendi sayfa büyütmesi de devreye girmesin.
  const dokunmaEngeli = e => {
    if (!d || d.kalem || !e.target.closest || !e.target.closest('#ok-sahne')) return;
    if (e.touches.length >= 2 || tutam || d.zoom > 1) {
      e.stopPropagation();
      if (e.type === 'touchmove' && e.cancelable) e.preventDefault();
    }
  };
  ['touchstart', 'touchmove', 'touchend'].forEach(t => window.addEventListener(t, dokunmaEngeli, { capture: true, passive: false }));

  const sayfaBul = (x, y) => {
    katman.style.pointerEvents = 'none';
    const el = document.elementFromPoint(x, y);
    katman.style.pointerEvents = '';
    return el && el.closest('.sayfa');
  };
  const oranla = (sayfaEl, x, y) => {
    const r = (sayfaEl.querySelector('.vurgu-katman') || sayfaEl).getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (x - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (y - r.top) / r.height)),
    };
  };

  katman.addEventListener('pointerdown', async e => {
    if (!d || !d.kalem) return;
    const sayfaEl = sayfaBul(e.clientX, e.clientY);
    if (!sayfaEl) return;
    e.preventDefault();
    katman.setPointerCapture(e.pointerId);
    const no = +sayfaEl.dataset.no;
    if (d.kalem === 'yerimi') { await yerImiKoy(sayfaEl, no, oranla(sayfaEl, e.clientX, e.clientY)); return; }
    cizim = { sayfaEl, no, bas: oranla(sayfaEl, e.clientX, e.clientY), parcalar: null, secim: null };
    cizim.son = cizim.bas;
    cizim.parcalar = await metinAl(no);
  });

  katman.addEventListener('pointermove', e => {
    if (!cizim || !cizim.parcalar) return;
    cizim.son = oranla(cizim.sayfaEl, e.clientX, e.clientY);
    onizle();
  });

  const bitir = async e => {
    if (!cizim) return;
    const c = cizim; cizim = null;
    const katmanEl = c.sayfaEl.querySelector('.vurgu-katman');
    katmanEl.querySelectorAll('.onizleme').forEach(x => x.remove());
    if (!c.parcalar) return;
    let secim = secimHesapla(c.parcalar, c.bas, c.son);
    if (secim && secim.metin) sonKalemMetni = { metin: secim.metin, zaman: Date.now() };
    if (!secim && c.parcalar.length) {
      ipucu('Burada metin yok. Kalemi satırın üstünden geçir.');
      return;
    }
    if (d.kalem === 'cevir') {
      if (!secim || !secim.metin) { taramaIpucu(e.clientX, e.clientY); return; }
      ceviriGoster(secim.metin, e.clientX, e.clientY);
      return;
    }
    if (!secim) {
      // Metni olmayan sayfa (taranmış PDF): çizilen alanın kendisi kaydedilir.
      const x = Math.min(c.bas.x, c.son.x), y = Math.min(c.bas.y, c.son.y);
      const w = Math.abs(c.son.x - c.bas.x), h = Math.max(Math.abs(c.son.y - c.bas.y), 0.018);
      if (w < 0.02) return;
      secim = { metin: '', rects: [{ x, y, w, h }] };
    }
    const kayit = {
      id: yeniId(), kitapId: d.kitap.id, kitapAd: d.kitap.ad, sayfa: c.no,
      renk: d.kalem, metin: secim.metin, rects: secim.rects, etiket: null, tarih: Date.now(),
    };
    await db.koy('cizimler', kayit);
    d.cizimler.push(kayit);
    vurgulariGoster(c.no);
    cizimPaneliCiz();
    etiketSor(kayit, e.clientX, e.clientY);
    d.sec.cizimEklendi && d.sec.cizimEklendi(kayit);
  };
  katman.addEventListener('pointerup', bitir);
  katman.addEventListener('pointercancel', () => { cizim = null; });

  function onizle() {
    const c = cizim;
    const katmanEl = c.sayfaEl.querySelector('.vurgu-katman');
    katmanEl.querySelectorAll('.onizleme').forEach(x => x.remove());
    const s = secimHesapla(c.parcalar, c.bas, c.son);
    const rects = s ? s.rects : [{
      x: Math.min(c.bas.x, c.son.x), y: Math.min(c.bas.y, c.son.y),
      w: Math.abs(c.son.x - c.bas.x), h: Math.max(Math.abs(c.son.y - c.bas.y), 0.018),
    }];
    for (const r of rects) katmanEl.appendChild(vurguDiv(r, d.kalem, true));
  }
}

// Tarayıcıdaki metin seçmeye benzer: başlangıç ve bitiş noktası arasındaki kelimeler.
function secimHesapla(p, bas, son) {
  if (!p.length) return null;
  const yakin = nokta => {
    let en = null, enP = Infinity;
    p.forEach((it, i) => {
      const dy = nokta.y < it.y ? it.y - nokta.y : nokta.y > it.y + it.h ? nokta.y - it.y - it.h : 0;
      const dx = nokta.x < it.x ? it.x - nokta.x : nokta.x > it.x + it.w ? nokta.x - it.x - it.w : 0;
      const puan = dy * 3 + dx;
      if (puan < enP) { enP = puan; en = i; }
    });
    const it = p[en];
    const oran = Math.max(0, Math.min(1, (nokta.x - it.x) / (it.w || 1)));
    return { i: en, ch: Math.round(oran * it.str.length), uzak: enP };
  };
  let a = yakin(bas), b = yakin(son);
  if (a.uzak > 0.12 && b.uzak > 0.12) return null;
  if (a.i > b.i || (a.i === b.i && a.ch > b.ch)) [a, b] = [b, a];

  const satirlar = new Map();
  const metinler = [];
  for (let i = a.i; i <= b.i; i++) {
    const it = p[i];
    const L = it.str.length;
    let bas2 = i === a.i ? a.ch : 0;
    let son2 = i === b.i ? b.ch : L;
    while (bas2 > 0 && /\S/.test(it.str[bas2 - 1])) bas2--;          // kelime başına
    while (son2 < L && /\S/.test(it.str[son2])) son2++;              // kelime sonuna
    if (son2 <= bas2) continue;
    const parca = it.str.slice(bas2, son2);
    if (!parca.trim()) continue;
    const r = { x: it.x + it.w * bas2 / L, y: it.y, w: it.w * (son2 - bas2) / L, h: it.h };
    const s = satirlar.get(it.satir);
    if (s) {
      const sag = Math.max(s.x + s.w, r.x + r.w);
      s.x = Math.min(s.x, r.x); s.w = sag - s.x;
      const alt = Math.max(s.y + s.h, r.y + r.h);
      s.y = Math.min(s.y, r.y); s.h = alt - s.y;
    } else satirlar.set(it.satir, { ...r });
    metinler.push({ satir: it.satir, str: parca });
  }
  if (!metinler.length) return null;
  let metin = '';
  let oncekiSatir = null;
  for (const m of metinler) {
    if (oncekiSatir !== null) {
      if (m.satir !== oncekiSatir && /[-‐]$/.test(metin)) metin = metin.replace(/[-‐]$/, ''); // satır sonu tirelemesi
      else if (!/\s$/.test(metin) && !/^\s/.test(m.str)) metin += ' ';
    }
    metin += m.str;
    oncekiSatir = m.satir;
  }
  return { metin: metin.replace(/\s+/g, ' ').trim(), rects: [...satirlar.values()] };
}

// ---------- Çevir kalemi ----------
// Çeviri Chrome'un kendi çevirmeniyle (Translator API) bilgisayarda yapılır; metin dışarı gitmez.
// İlk kullanımda Chrome dil paketini bir kez indirir. Çevirmen yoksa metin panoya kopyalanır
// (Seç-Çevir oradan okuyabilir) ve istenirse Google Çeviri'de açılır.
let cevirmen = null;
async function cevirmenAl() {
  if (cevirmen) return cevirmen;
  if (!('Translator' in self)) return null;
  const dil = { sourceLanguage: 'en', targetLanguage: 'tr' };
  const durum = await Translator.availability(dil);
  if (durum === 'unavailable') return null;
  cevirmen = Translator.create({
    ...dil,
    monitor(m) {
      m.addEventListener('downloadprogress', e => {
        const k = $('#ceviri-kutu .hedef');
        if (k && e.loaded < 1) k.textContent = `Chrome çeviri paketini indiriyor (yalnız ilk seferde): %${Math.round(e.loaded * 100)}`;
      });
    },
  }).catch(h => { cevirmen = null; throw h; });
  return cevirmen;
}
const kacir = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Taranmış sayfa: PDF'te metin yok, yalnız resim var. Metni ekrandan Seç-Çevir okur.
// Çevir kalemi açıkken sürüklemek sayfayı çevirmez; Seç-Çevir'in alanı rahatça çizilir.
function taramaIpucu(x, y) {
  const kutu = $('#ceviri-kutu');
  const gen = Math.min(380, window.innerWidth - 16);
  kutu.style.left = Math.max(8, Math.min(window.innerWidth - gen - 8, x - gen / 2)) + 'px';
  kutu.style.top = Math.max(8, Math.min(window.innerHeight - 200, y + 16)) + 'px';
  kutu.innerHTML = `<p class="hedef"><b>Bu sayfa taranmış:</b> PDF'te yazı yok, sayfa bir resim. Bu yüzden Kitaplığım cümleyi okuyamıyor.</p>
    <p class="kaynak">Seç-Çevir ile çevir: <b>Ctrl+Alt+O</b>'ya bas, sonra cümlenin çevresine fareyle bir dikdörtgen çiz. Seç-Çevir ekrandaki yazıyı okuyup çevirir.</p>
    <div class="alt"><button data-k="kapat">Tamam</button></div>`;
  kutu.hidden = false;
  const kapat = () => { kutu.hidden = true; document.removeEventListener('pointerdown', ceviriGoster.disari, true); };
  document.removeEventListener('pointerdown', ceviriGoster.disari, true);
  ceviriGoster.disari = ev => { if (!kutu.contains(ev.target)) kapat(); };
  setTimeout(() => document.addEventListener('pointerdown', ceviriGoster.disari, true), 0);
  kutu.onclick = ev => { if (ev.target.closest('button')) kapat(); };
}

async function ceviriGoster(metin, x, y) {
  const kutu = $('#ceviri-kutu');
  const gen = Math.min(380, window.innerWidth - 16);
  kutu.style.left = Math.max(8, Math.min(window.innerWidth - gen - 8, x - gen / 2)) + 'px';
  kutu.style.top = Math.max(8, Math.min(window.innerHeight - 220, y + 16)) + 'px';
  const google = 'https://translate.google.com/?sl=en&tl=tr&op=translate&text=' + encodeURIComponent(metin);
  const ciz = hedef => {
    kutu.innerHTML = `<p class="kaynak">${kacir(metin)}</p><p class="hedef">${hedef}</p>
      <div class="alt"><button data-k="kopyala">İngilizcesini kopyala</button><a href="${google}" target="_blank" rel="noopener">Google Çeviri</a><button data-k="kapat">Kapat</button></div>`;
  };
  ciz('Çevriliyor…');
  kutu.hidden = false;
  const kapat = () => { kutu.hidden = true; document.removeEventListener('pointerdown', disari, true); };
  const disari = ev => { if (!kutu.contains(ev.target)) kapat(); };
  document.removeEventListener('pointerdown', ceviriGoster.disari, true);
  ceviriGoster.disari = disari;
  setTimeout(() => document.addEventListener('pointerdown', disari, true), 0);
  kutu.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.k === 'kapat') kapat();
    if (b.dataset.k === 'kopyala') { try { await navigator.clipboard.writeText(metin); ipucu('Kopyalandı.'); } catch (_) { ipucu('Kopyalanamadı.'); } }
  };
  // Hâlâ bu cümle mi gösteriliyor? (bu arada yeni bir cümle seçilmiş ya da kutu kapanmış olabilir)
  const gecerli = () => !kutu.hidden && $('#ceviri-kutu .kaynak')?.textContent === metin;
  const yaz = t => { const k = $('#ceviri-kutu .hedef'); if (gecerli() && k) k.textContent = t; };
  // Uzun sürerse (Chrome dil paketini hazırlıyor) kutuda bunu yaz; çok uzarsa başka yolları göster
  const uyari1 = setTimeout(() => yaz('Chrome çeviri paketini hazırlıyor (yalnız ilk seferde biraz sürer)…'), 4000);
  const uyari2 = setTimeout(() => {
    navigator.clipboard.writeText(metin).catch(() => {});
    yaz('Chrome çevirmeni hâlâ hazırlanıyor. İngilizcesi panoya kopyalandı; şimdilik Seç-Çevir ya da Google Çeviri ile çevirebilirsin. Hazır olunca çeviri buraya gelir.');
  }, 20000);
  try {
    const c = await cevirmenAl();
    if (!c) {
      try { await navigator.clipboard.writeText(metin); } catch (_) {}
      yaz('Bu tarayıcıda yerleşik çevirmen yok. İngilizcesi panoya kopyalandı; Seç-Çevir ya da Google Çeviri ile çevirebilirsin.');
      return;
    }
    const sonuc = await c.translate(metin);
    yaz(sonuc);
  } catch (h) {
    console.warn('[Kitaplığım] çeviri', h);
    yaz('Çevrilemedi. Birazdan tekrar dene ya da Google Çeviri düğmesini kullan.');
  } finally {
    clearTimeout(uyari1); clearTimeout(uyari2);
  }
}

function etiketSor(kayit, x, y) {
  const kutu = $('#etiket-kutu');
  kutu.hidden = false;
  const gen = 280;
  kutu.style.left = Math.max(8, Math.min(window.innerWidth - gen - 8, x - gen / 2)) + 'px';
  kutu.style.top = Math.max(8, Math.min(window.innerHeight - 70, y + 16)) + 'px';
  kutu.innerHTML = '<span>Etiket:</span>' + ETIKETLER.map(e => `<button data-e="${e}">${e}</button>`).join('') + '<button data-e="">Geç</button>';
  const kapat = () => { kutu.hidden = true; document.removeEventListener('pointerdown', disari, true); };
  const disari = ev => { if (!kutu.contains(ev.target)) kapat(); };
  setTimeout(() => document.addEventListener('pointerdown', disari, true), 0);
  kutu.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.e) { kayit.etiket = b.dataset.e; await db.koy('cizimler', kayit); }
    kapat();
  };
}

export async function okuyucuKapat() {
  if (!d) {
    // kitap henüz açılırken kapatıldı: açılışı iptal et
    acilisNo++;
    $('#okuyucu').hidden = true;
    document.body.classList.remove('okuyor');
    return;
  }
  const durum = d;
  clearTimeout(durum.kaydetZaman);
  const no = durum.pf.getCurrentPageIndex() + 1;
  const k = await db.al('kitaplar', durum.kitap.id);
  if (k) { k.sonSayfa = no; k.sonOkuma = Date.now(); await db.koy('kitaplar', k); }
  window.removeEventListener('resize', yenidenBoyutla);
  document.removeEventListener('keydown', tusla);
  kalemSec(null); // yeniden açılınca eski kalem seçili görünmesin
  d = null;
  engelAyarla(false);
  $('#ok-sahne').appendChild($('#ok-kalem-katman'));
  $('#ok-cizimler').hidden = true;
  try { durum.pf.destroy(); } catch (_) {}
  const el = $('#ok-kitap'); if (el) el.remove();
  durum.pdf.loadingTask.destroy();
  $('#okuyucu').hidden = true;
  $('#ok-kalem-katman').hidden = true;
  $('#etiket-kutu').hidden = true;
  document.body.classList.remove('okuyor');
  durum.sec.kapaninca && durum.sec.kapaninca(k);
}
