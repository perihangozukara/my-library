// Kitaplığım · okuyucu: PDF.js ile sayfa çizimi, StPageFlip (MIT) ile sayfa çevirme,
// renkli kalemle cümle çizme.
import { db, yeniId } from './db.js';
import { pdfAc, sayfaCiz, sayfaMetni } from './pdf.js';
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
    s.innerHTML = `<div class="sayfa-ic"></div><div class="vurgu-katman"></div><div class="sayfa-alt">${i}</div>`;
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
  });
  pf.on('changeState', e => {
    if (e.data === 'flipping' && (!d.sec.sesAcik || d.sec.sesAcik())) sayfaSesi();
  });
  pf.on('changeOrientation', () => { d.cizilen.clear(); gorunurleriCiz(); });

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
      } catch (h) { console.warn('[Kitaplığım] sayfa çizilemedi', n, h); durum.cizilen.delete(n); }
    });
  }
}

// Sayfa kutusu kitabın ilk sayfasının oranında; bu sayfanın oranı farklıysa (yatay sayfa)
// resim ortalanır (object-fit: contain), vurgu katmanı da tam resmin üstüne oturtulur.
function katmanOturt(sayfaEl, resimOrani, kitapOrani) {
  const kutuOrani = 1 / kitapOrani; // genişlik / yükseklik
  const k = sayfaEl.querySelector('.vurgu-katman');
  if (Math.abs(resimOrani - kutuOrani) < 0.01) { k.style.cssText = ''; return; }
  if (resimOrani > kutuOrani) {
    const h = kutuOrani / resimOrani * 100;
    k.style.cssText = `left:0;width:100%;top:${(100 - h) / 2}%;height:${h}%`;
  } else {
    const w = resimOrani / kutuOrani * 100;
    k.style.cssText = `top:0;height:100%;left:${(100 - w) / 2}%;width:${w}%`;
  }
}

function metinAl(n) {
  if (!d.metin.has(n)) d.metin.set(n, sayfaMetni(d.pdf, n).catch(() => []));
  return d.metin.get(n);
}

function vurgulariGoster(n) {
  const katman = d.sayfalar[n - 1].querySelector('.vurgu-katman');
  katman.querySelectorAll('.vurgu:not(.onizleme)').forEach(x => x.remove());
  for (const c of d.cizimler.filter(c => c.sayfa === n)) {
    for (const r of c.rects) katman.appendChild(vurguDiv(r, c.renk));
  }
}

function vurguDiv(r, renk, onizleme = false) {
  const v = document.createElement('div');
  v.className = 'vurgu' + (onizleme ? ' onizleme' : '');
  v.style.cssText = `left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%;background:${renkKodu(renk)}`;
  return v;
}

function renkKodu(ad) { return (KALEMLER.find(k => k.ad === ad) || KALEMLER[0]).renk; }

// ---------- Kalem ----------
// StPageFlip fare hareketini ve bırakmayı bütün pencereden dinler; kalem açıkken
// köşe kıvrılıp sayfa çevrilmesin diye bu olaylar ona ulaşmadan durdurulur.
// Kalem pointer olaylarıyla çalıştığı için etkilenmez.
const KALEM_ENGEL = ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend'];
function kalemEngeli(e) {
  if (!d || !d.kalem) return;
  if (e.target.closest && e.target.closest('#ok-ust, #alt, #ses-panel, #etiket-kutu, dialog')) return;
  e.stopPropagation();
}
let engelKurulu = false;
function engelAyarla(acik) {
  if (acik === engelKurulu) return;
  KALEM_ENGEL.forEach(t => (acik ? window.addEventListener : window.removeEventListener).call(window, t, kalemEngeli, true));
  engelKurulu = acik;
}

export function kalemSec(ad) {
  if (!d) return;
  d.kalem = ad;
  engelAyarla(!!ad);
  const katman = $('#ok-kalem-katman');
  katman.hidden = !ad;
  document.querySelectorAll('.kalem-btn').forEach(b => b.classList.toggle('secili', b.dataset.kalem === (ad || '')));
}

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
    if (!secim && c.parcalar.length) {
      ipucu('Burada metin yok. Kalemi satırın üstünden geçir.');
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
  d = null;
  engelAyarla(false);
  $('#ok-sahne').appendChild($('#ok-kalem-katman'));
  try { durum.pf.destroy(); } catch (_) {}
  const el = $('#ok-kitap'); if (el) el.remove();
  durum.pdf.loadingTask.destroy();
  $('#okuyucu').hidden = true;
  $('#ok-kalem-katman').hidden = true;
  $('#etiket-kutu').hidden = true;
  document.body.classList.remove('okuyor');
  durum.sec.kapaninca && durum.sec.kapaninca(k);
}
