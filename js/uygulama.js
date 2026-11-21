// Kitaplığım · ana uygulama: raflar, kitap ekleme, sürükle-bırak, kitap açılışı,
// Defterim, temalar, ses paneli.
import { db, yeniId, kaliciDepolamaIste } from './db.js';
import { kitapBilgisi } from './pdf.js';
import { rafOner, rafKelimeleri, HAZIR_KELIMELER, kucult } from './oneri.js';
import { okuyucuAc, okuyucuKapat, okuyucuKitabi, yakinlastir, cizimPaneliAc, cizimPaneliKur, kalemKur, kalemSec, sayfayaGit, sonraki, onceki, KALEMLER, ETIKETLER } from './okuyucu.js';
import * as ses from './ses.js';
import { susElemani, isiklarElemani, susPaneliKur, susMenuAc, renkleriUygula, SUS_TURLERI } from './susleme.js';
import { daktiloAc, daktiloKur } from './daktilo.js';

const $ = (s, k = document) => k.querySelector(s);
const $$ = (s, k = document) => [...k.querySelectorAll(s)];
const kacis = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let raflar = [];
let kitaplar = [];
let susler = [];   // 2. sürüm: raf süsleri
const susUrl = new Map(); // süs id -> resim adresi
const ayar = { tema: 'kagit', parlaklik: 100, sayfaSesi: true, muzikDuzey: 0.45, doga: {} };

// ---------- Başlangıç ----------
async function basla() {
  kaliciDepolamaIste();
  Object.assign(ayar, await db.ayar('genel', {}));
  temaUygula(ayar.tema);
  parlaklikUygula(ayar.parlaklik);
  pencereUygula();
  await yukle();
  arayuzKur();
  kalemKur();
  daktiloKur();
  cizimPaneliKur();
  sesPaneliKur();
  ses.dosyalariYokla().then(dogaSatirlariCiz);
  if (!raflar.length) kurulumAc();
  else ciz();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(h => console.warn('[Kitaplığım] service worker', h));
  }
}

async function yukle() {
  raflar = (await db.hepsi('raflar')).sort((a, b) => a.sira - b.sira);
  kitaplar = await db.hepsi('kitaplar');
  susler = await db.hepsi('susler');
}

function ayarKaydet() { db.ayarKoy('genel', ayar); }

let bildirimZaman;
function bildir(metin, kalici = false) {
  const b = $('#bildirim');
  b.textContent = metin; b.hidden = false;
  clearTimeout(bildirimZaman);
  if (!kalici) bildirimZaman = setTimeout(() => { b.hidden = true; }, 3200);
}
function bildirimKapat() { clearTimeout(bildirimZaman); $('#bildirim').hidden = true; }

// ---------- İlk kurulum ----------
const ORNEK_RAFLAR = ['Ders', 'Korku', 'Roman', 'Şiir', 'Kişisel gelişim', 'Bilim', 'Tarih', 'Felsefe'];

function kurulumAc() {
  const dlg = $('#kurulum-dlg');
  const secilen = [];
  const ciz2 = () => {
    $('#kurulum-oneri').innerHTML = ORNEK_RAFLAR.map(a =>
      `<button type="button" class="cip ${secilen.some(x => kucult(x) === kucult(a)) ? 'secili' : ''}" data-a="${kacis(a)}" aria-pressed="${secilen.some(x => kucult(x) === kucult(a))}">${kacis(a)}</button>`).join('');
    // alttaki listede yalnız elle yazılan raflar
    $('#kurulum-secilen').innerHTML = secilen.map((a, i) => ORNEK_RAFLAR.includes(a) ? '' :
      `<li>${kacis(a)} <button type="button" data-i="${i}" aria-label="Çıkar">×</button></li>`).join('');
    $('#kurulum-tamam').disabled = !secilen.length;
  };
  const ekle = a => { a = a.trim(); if (a && !secilen.some(x => kucult(x) === kucult(a))) secilen.push(a); ciz2(); };
  $('#kurulum-oneri').onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a; const i = secilen.findIndex(x => kucult(x) === kucult(a));
    if (i >= 0) secilen.splice(i, 1); else secilen.push(a);
    ciz2();
  };
  $('#kurulum-secilen').onclick = e => { const b = e.target.closest('[data-i]'); if (b) { secilen.splice(+b.dataset.i, 1); ciz2(); } };
  $('#kurulum-ekle').onclick = () => { ekle($('#kurulum-girdi').value); $('#kurulum-girdi').value = ''; $('#kurulum-girdi').focus(); };
  $('#kurulum-girdi').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#kurulum-ekle').click(); } };
  dlg.oncancel = e => e.preventDefault(); // raf kurmadan kapanmasın
  dlg.onclose = async () => {
    if (!secilen.length) { dlg.showModal(); return; }
    let i = 0;
    for (const ad of secilen) await db.koy('raflar', { id: yeniId(), ad, sira: i++, kelimeler: [] });
    await yukle();
    ciz();
    bildir('Raflar kuruldu. Şimdi PDF ekleyebilirsin.');
    if (kurulumSonrasi) { const d = kurulumSonrasi; kurulumSonrasi = null; dosyalariEkle(d); }
  };
  ciz2();
  dlg.showModal();
}

// ---------- Rafları çiz ----------
function sirtRengi(kitap) {
  if (kitap.renk) {
    // kapağın rengini koyulaştır: sırt koyu ve doygun olsun
    const [r, g, b] = kitap.renk;
    const k = 0.62;
    return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
  }
  const palet = ['#7a2e2e', '#2f4f6b', '#3d5a3a', '#6b4a2b', '#5a3b6b', '#2e5b5b', '#8a5a1f', '#4a2f4f', '#1f3b4a', '#6b2f3f'];
  return palet[karma(kitap.id) % palet.length];
}
function karma(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

function sirtOlustur(kitap) {
  const el = document.createElement('div');
  el.className = 'kitap-sirt raf-ogesi sirt-' + (karma(kitap.id + 's') % 4);
  el.dataset.tur = 'kitap';
  el.dataset.id = kitap.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.title = `${kitap.ad} · ${kitap.sayfaSayisi} sayfa` + (kitap.sonSayfa > 1 ? ` · s. ${kitap.sonSayfa}'de kaldın` : '');
  const kalinlik = Math.max(18, Math.min(72, 16 + kitap.sayfaSayisi * 0.09));
  el.style.setProperty('--k', kalinlik + 'px');
  el.style.setProperty('--bo', (0.8 + (karma(kitap.id + 'b') % 20) / 100).toFixed(2));
  el.style.setProperty('--r', sirtRengi(kitap));
  el.innerHTML = `<span>${kacis(kitap.ad)}</span>`;
  sirtSuruklemeKur(el);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kitapCikar(el); } });
  return el;
}

function ciz() {
  const kok = $('#raflar');
  kok.innerHTML = '';
  for (const raf of raflar) {
    const bolum = document.createElement('section');
    bolum.className = 'raf';
    const icindekiler = kitaplar.filter(k => k.rafId === raf.id).sort((a, b) => (a.sira ?? 0) - (b.sira ?? 0));
    bolum.innerHTML = `<button class="raf-levha" data-raf="${raf.id}" title="Rafı düzenle">${kacis(raf.ad)} <small>${icindekiler.length}</small></button>`;
    const ic = document.createElement('div');
    ic.className = 'raf-ic';
    ic.dataset.raf = raf.id;
    const rafSusleri = susler.filter(x => x.rafId === raf.id && SUS_TURLERI[x.tur]);
    const satirSusleri = rafSusleri.filter(x => !SUS_TURLERI[x.tur].rafUstu);
    const ogeler = [...icindekiler, ...satirSusleri].sort((a, b) => (a.sira ?? 0) - (b.sira ?? 0));
    if (!ogeler.length) ic.innerHTML = '<div class="raf-bos">Bu raf boş · kitapları buraya sürükleyebilirsin</div>';
    for (const o of ogeler) {
      const el = o.tur ? susOlustur(o) : sirtOlustur(o);
      if (!el) continue;
      const yuva = document.createElement('div');
      yuva.className = 'yuva';
      if (!o.tur && (o.sonSayfa > 1 || o.yerImi)) {        // yarım kalan kitaba kurdele ayraç
        yuva.classList.add('okunuyor');
        yuva.style.setProperty('--kurdele', ['#8a2c2c', '#2c5a8a', '#3d6b3a', '#7a4a8a', '#b07a2a'][karma(o.id + 'k') % 5]);
      }
      yuva.appendChild(el);
      ic.appendChild(yuva);
    }
    // raf tavanındaki peri ışıkları
    for (const x of rafSusleri.filter(x => SUS_TURLERI[x.tur].rafUstu)) {
      const el = isiklarElemani(x);
      const ac = () => susMenuAc(x, el, { kaldir: susKaldir });
      el.addEventListener('click', ac);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); } });
      ic.appendChild(el);
    }
    bolum.appendChild(ic);
    kok.appendChild(bolum);
  }
  $('#bos-ipucu').hidden = kitaplar.length > 0;
  karanlikIste();
}

function susOlustur(sus) {
  if (sus.resim && !susUrl.has(sus.id)) susUrl.set(sus.id, URL.createObjectURL(sus.resim));
  const el = susElemani(sus, susUrl.get(sus.id));
  if (!el) return null;
  sirtSuruklemeKur(el);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ogeTikla(el); } });
  return el;
}

function ogeTikla(el) {
  if (el.dataset.tur === 'kitap') { kitapCikar(el); return; }
  const sus = susler.find(x => x.id === el.dataset.id);
  if (!sus) return;
  susMenuAc(sus, el, { kaldir: susKaldir });
}

async function susKaldir(x) {
  await db.kaldir('susler', x.id);
  susler = susler.filter(y => y.id !== x.id);
  if (susUrl.has(x.id)) { URL.revokeObjectURL(susUrl.get(x.id)); susUrl.delete(x.id); }
  ciz();
  bildir('Süs kaldırıldı.');
}

// ---------- Işıklar kapalı: oda kararır, yanan süsler aydınlatır ----------
let karanlikKare = 0;
function karanlikIste() {
  if (karanlikKare) return;
  karanlikKare = requestAnimationFrame(() => { karanlikKare = 0; karanlikGuncelle(); });
}
function karanlikGuncelle() {
  const el = $('#karanlik');
  $('#isik-btn').setAttribute('aria-pressed', String(!!ayar.isiklarKapali));
  document.body.classList.toggle('karanlik-oda', !!ayar.isiklarKapali); // okurken: yalnız sayfa görünür
  if (!ayar.isiklarKapali) { el.hidden = true; return; }
  el.hidden = false;
  el.style.background = `rgba(6,4,2,${ayar.tema === 'gece' ? 0.74 : 0.58})`;
  const delikler = [];
  const gorunur = r => r.bottom > -250 && r.top < innerHeight + 250;
  $$('#raflar .sus.yanik').forEach(x => {
    const r = x.getBoundingClientRect(); if (!gorunur(r)) return;
    const yaricap = x.classList.contains('sus-abajur') ? 250 : x.classList.contains('sus-mum') ? 170 : 210;
    delikler.push(`radial-gradient(circle ${yaricap}px at ${Math.round(r.left + r.width / 2)}px ${Math.round(r.top + r.height * 0.4)}px, transparent 0, transparent 22%, #000 100%)`);
  });
  $$('#raflar .peri-isiklari.yanik').forEach(x => {
    const r = x.getBoundingClientRect(); if (!gorunur(r)) return;
    delikler.push(`radial-gradient(ellipse ${Math.round(r.width / 2 + 50)}px 110px at ${Math.round(r.left + r.width / 2)}px ${Math.round(r.top + 24)}px, transparent 0, transparent 25%, #000 100%)`);
  });
  const p = $('#pencere');
  if (!p.hidden && ayar.tema === 'gece') {           // ay ışığı: pencerenin önü biraz aydınlık
    const r = p.getBoundingClientRect();
    if (gorunur(r)) delikler.push(`radial-gradient(ellipse 200px 140px at ${Math.round(r.left + r.width / 2)}px ${Math.round(r.top + r.height / 2)}px, rgba(0,0,0,.35) 0, #000 100%)`);
  }
  const maske = delikler.length ? delikler.join(', ') : 'linear-gradient(#000, #000)';
  el.style.webkitMaskImage = maske; el.style.maskImage = maske;
  el.style.webkitMaskComposite = 'source-in'; el.style.maskComposite = 'intersect';
}
addEventListener('scroll', karanlikIste, { passive: true });
addEventListener('resize', karanlikIste);

// Ses durumunu sahneye yansıt: pencerede yağmur/kuş, plak çalarda dönen plak
function sesSiniflari() {
  const b = document.body.classList;
  b.toggle('ses-yagmur', ses.dogaAcikMi('yagmur'));
  b.toggle('ses-kus', ses.dogaAcikMi('kus'));
  b.toggle('ses-muzik', ses.muzikCaliyorMu());
}

function pencereUygula() {
  $('#pencere').hidden = ayar.pencere === false;
  $('#susle-pencere').checked = ayar.pencere !== false;
  karanlikIste();
}

// Kitabı kitaplıktan kaldır: PDF, çizimler, daktilo notu da silinir (iki aşamalı onay).
async function kitapKaldir(kitap) {
  const cizimler = (await db.hepsi('cizimler')).filter(c => c.kitapId === kitap.id);
  await db.cokluSil([['kitaplar', kitap.id], ['dosyalar', kitap.id], ['notlar', kitap.id], ...cizimler.map(c => ['cizimler', c.id])]);
  try { localStorage.removeItem('kitapligim-dk-' + kitap.id); } catch (_) {}
  kitaplar = kitaplar.filter(k => k.id !== kitap.id);
}

// ---------- Sürükle-bırak (fare ve dokunma) ----------
let surukleme = null;
function sirtSuruklemeKur(el) {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const dokunma = e.pointerType !== 'mouse';
    const s = { el, x: e.clientX, y: e.clientY, basladi: false, iptal: false, id: e.pointerId, dokunma };
    surukleme = s;
    if (dokunma) s.zaman = setTimeout(() => { if (surukleme === s && !s.iptal) suruklemeBaslat(s, s.x, s.y); }, 320);
  });
}

function suruklemeBaslat(s, x, y) {
  s.basladi = true;
  const r = s.el.getBoundingClientRect();
  s.dx = x - r.left; s.dy = y - r.top;
  const h = s.el.cloneNode(true);
  h.classList.add('sirt-hayalet');
  h.style.width = r.width + 'px'; h.style.height = r.height + 'px';
  h.style.left = r.left + 'px'; h.style.top = r.top + 'px';
  document.body.appendChild(h);
  s.hayalet = h;
  s.el.classList.add('surukleniyor');
  if (navigator.vibrate && s.dokunma) navigator.vibrate(15);
}

function hedefBul(x, y) {
  // Hayaleti bir anlığına gizle; yoksa parmağın altındaki öğe hayaletin kendisi olabilir.
  const h = surukleme.hayalet;
  if (h) h.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  if (h) h.style.display = '';
  if (!el) return null;
  const ic = el.closest('.raf-ic');
  if (!ic) return null;
  // Sürüklenen öğe (ya da kopyası) hedef sayılmaz: kimlikle karşılaştır.
  const kendi = surukleme.el.dataset.id;
  const ustteki = el.closest('.raf-ogesi');
  const sirt = ustteki && ustteki.dataset.id !== kendi ? ustteki : null;
  let once = null;
  if (sirt) {
    const r = sirt.getBoundingClientRect();
    once = x < r.left + r.width / 2 ? sirt.dataset.id : sonrakiId(sirt);
  } else {
    // boş alanda: aynı sıradaki en yakın öğenin yanına
    const sirtlar = $$('.raf-ogesi', ic).filter(s => s.dataset.id !== kendi);
    for (const s of sirtlar) {
      const r = s.getBoundingClientRect();
      if (y < r.bottom + 30 && y > r.top - 40 && x < r.left + r.width / 2) { once = s.dataset.id; break; }
    }
  }
  return { rafId: ic.dataset.raf, ic, once };
}
function sonrakiId(sirt) {
  let y = sirt.parentElement.nextElementSibling;
  while (y) {
    const s = y.querySelector('.raf-ogesi');
    if (s && s.dataset.id !== surukleme.el.dataset.id) return s.dataset.id;
    y = y.nextElementSibling;
  }
  return null;
}

document.addEventListener('pointermove', e => {
  const s = surukleme;
  if (!s || e.pointerId !== s.id) return;
  const uzak = Math.hypot(e.clientX - s.x, e.clientY - s.y);
  if (!s.basladi) {
    if (s.dokunma) { if (uzak > 10) { s.iptal = true; clearTimeout(s.zaman); } return; }
    if (uzak > 6) suruklemeBaslat(s, s.x, s.y); else return;
  }
  s.hayalet.style.left = (e.clientX - s.dx) + 'px';
  s.hayalet.style.top = (e.clientY - s.dy) + 'px';
  const h = hedefBul(e.clientX, e.clientY);
  $$('.raf-ic.hedef').forEach(x => x !== (h && h.ic) && x.classList.remove('hedef'));
  if (h) h.ic.classList.add('hedef');
  s.hedef = h;
  // kenara yaklaşınca sayfayı kaydır
  if (e.clientY < 90) window.scrollBy(0, -12); else if (e.clientY > innerHeight - 110) window.scrollBy(0, 12);
});
document.addEventListener('touchmove', e => { if (surukleme && surukleme.basladi) e.preventDefault(); }, { passive: false });

document.addEventListener('pointerup', async e => {
  const s = surukleme;
  if (!s || e.pointerId !== s.id) return;
  surukleme = null;
  clearTimeout(s.zaman);
  if (!s.basladi) {
    if (!s.iptal) ogeTikla(s.el); // tıklama: kitabı raftan çıkar ya da süs menüsünü aç
    return;
  }
  s.hayalet.remove();
  s.el.classList.remove('surukleniyor');
  $$('.raf-ic.hedef').forEach(x => x.classList.remove('hedef'));
  if (s.hedef) await ogeTasi(s.el.dataset.tur, s.el.dataset.id, s.hedef.rafId, s.hedef.once);
});
document.addEventListener('pointercancel', () => {
  const s = surukleme; surukleme = null;
  if (s) { clearTimeout(s.zaman); if (s.hayalet) s.hayalet.remove(); s.el.classList.remove('surukleniyor'); }
});

function kitapTasi(kitapId, rafId, onceId) { return ogeTasi('kitap', kitapId, rafId, onceId); }

// Kitaplar ve süsler rafta tek bir sırayı paylaşır.
async function ogeTasi(tur, id, rafId, onceId) {
  const oge = (tur === 'kitap' ? kitaplar : susler).find(x => x.id === id);
  if (!oge) return;
  const eskiRaf = oge.rafId;
  const sira = [...kitaplar, ...susler].filter(x => x.rafId === rafId && x.id !== id).sort((a, b) => (a.sira ?? 0) - (b.sira ?? 0));
  const yer = onceId ? sira.findIndex(x => x.id === onceId) : -1;
  sira.splice(yer < 0 ? sira.length : yer, 0, oge);
  oge.rafId = rafId;
  for (let i = 0; i < sira.length; i++) { sira[i].sira = i; await db.koy(sira[i].tur ? 'susler' : 'kitaplar', sira[i]); }
  ciz();
  if (eskiRaf !== rafId && tur === 'kitap') bildir(`"${oge.ad}" → ${raflar.find(r => r.id === rafId).ad} rafına taşındı`);
}

function rafSonSira(rafId) {
  return [...kitaplar, ...susler].filter(x => x.rafId === rafId).reduce((m, x) => Math.max(m, (x.sira ?? 0) + 1), 0);
}

// ---------- Kitap ekleme ----------
// Tek bir ekleme kuyruğu: pencere açıkken gelen dosyalar sıraya girer, kaybolmaz.
const kuyruk = [];
let ekleniyor = false;
let ekleSayac = { no: 0 };
let kurulumSonrasi = null;

function sayacYaz() {
  const toplam = ekleSayac.no + kuyruk.length;
  $('#ekle-sira').textContent = toplam > 1 ? `(${ekleSayac.no}/${toplam})` : '';
}

async function dosyalariEkle(dosyalar) {
  dosyalar = [...dosyalar].filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  if (!dosyalar.length) { bildir('Yalnızca PDF eklenebilir.'); return; }
  if (!raflar.length) { kurulumSonrasi = dosyalar; kurulumAc(); return; }
  kuyruk.push(...dosyalar);
  if (ekleniyor) { sayacYaz(); bildir(`${dosyalar.length} PDF sıraya eklendi.`); return; }
  ekleniyor = true;
  ekleSayac = { no: 0 };
  let eklenen = 0;
  try {
    while (kuyruk.length) {
      const f = kuyruk.shift();
      ekleSayac.no++;
      const toplam = ekleSayac.no + kuyruk.length;
      bildir(`"${f.name}" okunuyor…${toplam > 1 ? ` (${ekleSayac.no}/${toplam})` : ''}`, true);
      let bilgi;
      try { bilgi = await kitapBilgisi(f); }
      catch (h) { console.warn(h); bildir(`"${f.name}" açılamadı (bozuk ya da şifreli olabilir).`); continue; }
      const sonuc = await ekleSor(f, bilgi);
      if (!sonuc) continue;
      const id = yeniId();
      const kitap = {
        id, ad: sonuc.ad, rafId: sonuc.rafId, dosyaAdi: f.name, boyut: f.size,
        sayfaSayisi: bilgi.sayfaSayisi, oran: bilgi.oran, renk: bilgi.renk, kapak: bilgi.kapak,
        sonSayfa: 1, eklenme: Date.now(),
        sira: rafSonSira(sonuc.rafId),
      };
      try {
        await db.coklu([['dosyalar', { id, blob: f }], ['kitaplar', kitap]]);
      } catch (h) {
        console.warn(h);
        const dolu = h && (h.name === 'QuotaExceededError' || /quota/i.test(h.message || ''));
        bildir(dolu ? `Yer kalmadı: "${f.name}" kaydedilemedi. Tarayıcıda yer açıp yeniden dene.` : `"${f.name}" kaydedilemedi (${h && h.name || 'hata'}).`, true);
        setTimeout(bildirimKapat, 7000);
        continue;
      }
      kitaplar.push(kitap);
      eklenen++;
      ciz();
    }
  } finally {
    ekleniyor = false;
  }
  if (eklenen) bildir(`${eklenen} kitap rafa kondu.`);
}

function adTemizle(dosyaAdi) {
  return dosyaAdi.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function ekleSor(dosya, bilgi) {
  return new Promise(coz => {
    const dlg = $('#ekle-dlg');
    const oneri = rafOner(raflar, dosya.name, bilgi.ilkMetin);
    // Ad dosya adından gelir; PDF'in iç başlığı çoğu zaman anlamsızdır (ör. "Microsoft Word - ...").
    const temiz = adTemizle(dosya.name);
    const meta = (bilgi.baslik || '').trim();
    const dosyaAnlamsiz = /^[\d\s\-]+$|^[0-9a-f-]{16,}$/i.test(temiz);
    $('#ekle-ad').value = dosyaAnlamsiz && meta.length > 2 && !/\.(html?|docx?|pdf)$|^(untitled|microsoft|document)/i.test(meta) ? meta : temiz;
    sayacYaz();
    bildirimKapat();
    $('#ekle-raf').innerHTML = (oneri.rafId ? '' : '<option value="" selected disabled>Raf seç…</option>') + raflar.map(r =>
      `<option value="${r.id}" ${r.id === oneri.rafId ? 'selected' : ''}>${kacis(r.ad)}${r.id === oneri.rafId ? '  ★ önerilen' : ''}</option>`).join('');
    const ayni = kitaplar.find(k => k.dosyaAdi === dosya.name && k.sayfaSayisi === bilgi.sayfaSayisi && (!k.boyut || k.boyut === dosya.size));
    const ayniYazi = ayni ? `⚠ Bu kitap zaten "${(raflar.find(r => r.id === ayni.rafId) || {}).ad || ''}" rafında var ("${ayni.ad}"). İstersen "Bu kitabı geç" de. ` : '';
    $('#ekle-oneri').textContent = ayniYazi + (oneri.rafId
      ? `Öneri: ${raflar.find(r => r.id === oneri.rafId).ad} (eşleşen: ${oneri.eslesen.slice(0, 5).join(', ')}). Son karar senin.`
      : oneri.esitler ? `Öneri net değil: ${oneri.esitler.map(id => raflar.find(r => r.id === id).ad).join(' / ')}. Rafı sen seç.`
      : 'Öneri bulunamadı. Rafı sen seç.');
    $('#ekle-oneri').classList.toggle('uyari', !!ayni);
    $('#ekle-sayfa').textContent = `${bilgi.sayfaSayisi} sayfa · ${dosya.name}`;
    const url = URL.createObjectURL(bilgi.kapak);
    $('#ekle-kapak').src = url;
    dlg.onclose = () => {
      URL.revokeObjectURL(url);
      if (dlg.returnValue === 'ekle' && $('#ekle-ad').value.trim()) coz({ ad: $('#ekle-ad').value.trim(), rafId: $('#ekle-raf').value });
      else coz(null);
    };
    dlg.returnValue = '';
    dlg.showModal();
  });
}

// ---------- Raf ekle / düzenle ----------
function rafPenceresi(raf) {
  const dlg = $('#raf-dlg');
  $('#raf-dlg-baslik').textContent = raf ? 'Rafı düzenle' : 'Yeni raf';
  $('#raf-ad').value = raf ? raf.ad : '';
  $('#raf-kelimeler').value = raf ? (raf.kelimeler || []).join(', ') : '';
  const bosMu = raf && !kitaplar.some(k => k.rafId === raf.id) && !susler.some(x => x.rafId === raf.id);
  $('#raf-kaldir').hidden = !bosMu;
  const hazirGoster = () => {
    const h = HAZIR_KELIMELER[kucult($('#raf-ad').value.trim())];
    $('#raf-hazir').textContent = h ? `Bu raf için hazır kelimeler de kullanılır: ${h.slice(0, 8).join(', ')}…` : '';
  };
  const adKontrol = () => {
    const ad = kucult($('#raf-ad').value.trim());
    const ayni = ad && raflar.some(r => kucult(r.ad) === ad && (!raf || r.id !== raf.id));
    $('#raf-ad').setCustomValidity(ayni ? 'Bu adla bir raf zaten var.' : '');
  };
  $('#raf-ad').oninput = () => { hazirGoster(); adKontrol(); }; hazirGoster(); adKontrol();
  dlg.returnValue = '';
  dlg.onclose = async () => {
    const ad = $('#raf-ad').value.trim();
    const kelimeler = $('#raf-kelimeler').value.split(',').map(s => s.trim()).filter(Boolean);
    if (dlg.returnValue === 'kaydet' && ad) {
      const kayit = raf ? { ...raf, ad, kelimeler } : { id: yeniId(), ad, kelimeler, sira: raflar.length };
      await db.koy('raflar', kayit);
      bildir(raf ? 'Raf güncellendi.' : `"${ad}" rafı eklendi.`);
    } else if (dlg.returnValue === 'kaldir' && bosMu) {
      await db.kaldir('raflar', raf.id);
      bildir(`"${raf.ad}" rafı kaldırıldı.`);
    } else return;
    await yukle(); ciz();
  };
  dlg.showModal();
}

// ---------- Kitabı raftan çıkar (açılış hareketi) ----------
let acikKitap = null;
async function kitapCikar(sirt) {
  const kitap = kitaplar.find(k => k.id === sirt.dataset.id);
  if (!kitap || acikKitap) return;
  const sahne = $('#kapak-sahne');
  const panel = $('#kapak-panel');
  const r = sirt.getBoundingClientRect();
  const ucan = document.createElement('div');
  ucan.className = 'ucan-kitap';
  ucan.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;background:${getComputedStyle(sirt).backgroundImage}, ${sirtRengi(kitap)}`;
  const resim = document.createElement('img');
  resim.alt = '';
  resim.src = URL.createObjectURL(kitap.kapak);
  ucan.appendChild(resim);
  sahne.hidden = false;
  document.body.appendChild(ucan);
  sirt.classList.add('cikti');
  acikKitap = { kitap, sirt, ucan, resim, r, hazir: false };

  // hedef: ekranın ortası, panelin üstü
  const genMax = Math.min(260, innerWidth * 0.55);
  const yukMax = innerHeight - 330;
  let H = Math.max(160, Math.min(yukMax, genMax * (kitap.oran || 1.414)));
  let W = H / (kitap.oran || 1.414);
  const L = (innerWidth - W) / 2, T = Math.max(20, (innerHeight - H - 260) / 2);
  const hizli = matchMedia('(prefers-reduced-motion: reduce)').matches;
  await ucan.animate([
    { transform: 'translateY(0)' },
    { transform: `translateY(${-Math.min(40, r.top - 10)}px)` },
  ], { duration: hizli ? 1 : 220, easing: 'ease-out', fill: 'forwards' }).finished;
  const anim = ucan.animate([
    { left: r.left + 'px', top: (r.top - Math.min(40, r.top - 10)) + 'px', width: r.width + 'px', height: r.height + 'px', transform: 'none' },
    { left: L + 'px', top: T + 'px', width: W + 'px', height: H + 'px', transform: 'none' },
  ], { duration: hizli ? 1 : 480, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
  resim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: hizli ? 1 : 420, delay: hizli ? 0 : 160, fill: 'forwards' });
  await anim.finished;

  $('#kapak-ad').textContent = kitap.ad;
  const raf = raflar.find(x => x.id === kitap.rafId);
  $('#kapak-bilgi').textContent = `${kitap.sayfaSayisi} sayfa · ${raf ? raf.ad : ''}`;
  const devam = $('#devam-btn');
  const yi = kitap.yerImi;
  // İşaretten sonra en çok bir sayfa ilerlediyse "paragraftan devam"; daha ilerideyse iki seçenek.
  const paragraftan = !!yi && Math.abs((kitap.sonSayfa || 1) - yi.sayfa) <= 1;
  const devamVar = kitap.sonSayfa > 1 || !!yi;
  devam.hidden = !devamVar;
  devam.textContent = paragraftan ? `Kaldığın paragraftan devam (s. ${yi.sayfa})` : `Kaldığın yerden devam (s. ${kitap.sonSayfa})`;
  devam.dataset.sayfa = paragraftan ? yi.sayfa : kitap.sonSayfa;
  devam.dataset.parlat = paragraftan ? '1' : '';
  $('#kapak-yerimi').hidden = !(yi && yi.metin);
  $('#kapak-yerimi').textContent = yi && yi.metin ? `🔖 "${yi.metin}…"` : '';
  $('#yerimi-git').hidden = !(yi && !paragraftan);
  $('#yerimi-git').textContent = yi ? `🔖 İşaretli paragrafa git (s. ${yi.sayfa})` : '';
  $('#bastan-btn').classList.toggle('birincil', !devamVar);
  $('#bastan-btn').classList.toggle('hafif', devamVar);
  $('#kapak-raf').innerHTML = raflar.map(x => `<option value="${x.id}" ${x.id === kitap.rafId ? 'selected' : ''}>${kacis(x.ad)}</option>`).join('');
  panel.style.top = (T + H + 14) + 'px';
  panel.classList.add('gorunur');
  acikKitap.hazir = true;
  (kitap.sonSayfa > 1 ? devam : $('#bastan-btn')).focus();
}

async function rafaGeriKoy(okumayaGec) {
  const a = acikKitap; if (!a || !a.hazir) return;
  a.hazir = false;
  $('#kapak-panel').classList.remove('gorunur');
  if (okumayaGec) {
    await a.ucan.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.15)' }], { duration: 260, fill: 'forwards' }).finished;
  } else {
    const r = a.sirt.getBoundingClientRect();
    const u = a.ucan.getBoundingClientRect();
    a.resim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
    await a.ucan.animate([
      { left: u.left + 'px', top: u.top + 'px', width: u.width + 'px', height: u.height + 'px' },
      { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' },
    ], { duration: 380, easing: 'ease-in-out', fill: 'forwards' }).finished;
  }
  URL.revokeObjectURL(a.resim.src);
  a.ucan.remove();
  a.sirt.classList.remove('cikti');
  $('#kapak-sahne').hidden = true;
  acikKitap = null;
  if (!okumayaGec && a.sirt.isConnected) a.sirt.focus(); // odak kaybolmasın
}

async function oku(kitap, sayfa, defterdenMi = false, parlat = false) {
  await okuyucuAc(kitap, sayfa, {
    parlat,
    sesAcik: () => ayar.sayfaSesi,
    sayfaDegisti: k => { const i = kitaplar.findIndex(x => x.id === k.id); if (i >= 0) kitaplar[i] = k; },
    kapaninca: k => {
      if (k) { const i = kitaplar.findIndex(x => x.id === k.id); if (i >= 0) kitaplar[i] = k; }
      ciz();
      if (defterdenMi) defterAc();
      else { const el = $(`.kitap-sirt[data-id="${kitap.id}"]`); if (el) el.focus(); }
    },
  });
}

// ---------- Defterim ----------
const defter = { etiket: '', renk: '', kitap: '', ara: '' };
async function defterAc() {
  $('#defterim').hidden = false;
  await defterCiz();
}
async function defterCiz() {
  const tum = (await db.hepsi('cizimler')).sort((a, b) => b.tarih - a.tarih);
  $('#defter-etiketler').innerHTML = [['', 'Hepsi'], ...ETIKETLER.map(e => [e, e]), ['-', 'Etiketsiz']].map(([v, a]) =>
    `<button class="cip ${defter.etiket === v ? 'secili' : ''}" data-etiket="${kacis(v)}">${kacis(a)}</button>`).join('');
  $('#defter-renkler').innerHTML = [['', 'Bütün renkler', null], ...KALEMLER.map(k => [k.ad, k.etiket, k.renk])].map(([v, a, r]) =>
    `<button class="cip ${defter.renk === v ? 'secili' : ''}" data-renk="${v}">${r ? `<span class="nokta" style="background:${r}"></span> ` : ''}${a}</button>`).join('');
  const kitapAdlari = [...new Map(tum.map(c => [c.kitapId, (kitaplar.find(k => k.id === c.kitapId) || {}).ad || c.kitapAd])).entries()];
  $('#defter-kitap').innerHTML = '<option value="">Bütün kitaplar</option>' + kitapAdlari.map(([id, ad]) =>
    `<option value="${id}" ${defter.kitap === id ? 'selected' : ''}>${kacis(ad)}</option>`).join('');
  const ara = kucult(defter.ara);
  const liste = tum.filter(c =>
    (!defter.etiket || (defter.etiket === '-' ? !c.etiket : c.etiket === defter.etiket)) &&
    (!defter.renk || c.renk === defter.renk) &&
    (!defter.kitap || c.kitapId === defter.kitap) &&
    (!ara || kucult(c.metin).includes(ara) || kucult(c.kitapAd).includes(ara)));
  $('#defter-bos').hidden = tum.length > 0;
  $('#defter-liste').innerHTML = liste.map(c => {
    const kitapAd = (kitaplar.find(k => k.id === c.kitapId) || {}).ad || c.kitapAd;
    const renk = (KALEMLER.find(k => k.ad === c.renk) || KALEMLER[0]).renk;
    return `<li class="not" data-id="${c.id}">
      <div class="serit" style="background:${renk}"></div>
      <div>
        ${c.metin ? `<blockquote>${kacis(c.metin)}</blockquote>` : `<blockquote class="bos">Metin yakalanamadı (taranmış sayfa ya da çizgi satırın dışında kaldı). ✎ ile kendin yazabilirsin.</blockquote>`}
        <div class="not-alt">
          <a data-git="${c.kitapId}" data-sayfa="${c.sayfa}">${kacis(kitapAd)} · s. ${c.sayfa}</a>
          <select data-etiket-sec aria-label="Etiket">
            <option value="">Etiket yok</option>
            ${ETIKETLER.map(e => `<option ${c.etiket === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
          <span class="bosluk"></span>
          <span class="not-is">
            <button data-duzenle title="Metni düzenle" aria-label="Metni düzenle">✎</button>
            <button data-sil title="Çizimi kaldır">Kaldır</button>
          </span>
        </div>
      </div></li>`;
  }).join('') || (tum.length ? '<li class="kucuk" style="text-align:center">Bu süzgeçte çizim yok.</li>' : '');
}

async function defterTikla(e) {
  const li = e.target.closest('.not');
  const git = e.target.closest('[data-git]');
  if (git) {
    const kitap = kitaplar.find(k => k.id === git.dataset.git);
    if (!kitap) { bildir('Bu kitap artık kitaplıkta yok.'); return; }
    $('#defterim').hidden = true;
    await oku(kitap, +git.dataset.sayfa, true);
    return;
  }
  if (!li) return;
  const c = await db.al('cizimler', li.dataset.id);
  if (e.target.closest('[data-sil]')) {
    const b = e.target.closest('[data-sil]');
    if (b.dataset.emin) { await db.kaldir('cizimler', c.id); defterCiz(); bildir('Çizim kaldırıldı.'); }
    else { b.dataset.emin = '1'; b.textContent = 'Emin misin?'; setTimeout(() => { if (b.isConnected) { delete b.dataset.emin; b.textContent = 'Kaldır'; } }, 3000); }
    return;
  }
  if (e.target.closest('[data-duzenle]')) {
    const bq = li.querySelector('blockquote');
    const ta = document.createElement('textarea');
    ta.value = c.metin || '';
    ta.rows = 3;
    bq.replaceWith(ta);
    ta.focus();
    let bitti = false;
    const kaydet = async () => { if (bitti) return; bitti = true; c.metin = ta.value.trim(); await db.koy('cizimler', c); defterCiz(); };
    ta.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); bitti = true; defterCiz(); } // vazgeç
      else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); kaydet(); }
    });
    ta.addEventListener('blur', kaydet);
  }
}

async function defterDisaAktar() {
  const tum = (await db.hepsi('cizimler')).sort((a, b) => a.kitapAd.localeCompare(b.kitapAd, 'tr') || a.sayfa - b.sayfa);
  let md = `# Defterim\n\n_Kitaplığım'dan dışa aktarıldı: ${new Date().toLocaleDateString('tr-TR')}_\n`;
  let son = null;
  for (const c of tum) {
    const ad = (kitaplar.find(k => k.id === c.kitapId) || {}).ad || c.kitapAd;
    if (ad !== son) { md += `\n## ${ad}\n\n`; son = ad; }
    md += `> ${(c.metin || '(metin yok)').replace(/\n/g, '\n> ')}\n\n— s. ${c.sayfa}${c.etiket ? ` · #${c.etiket.replace(/\s+/g, '-')}` : ''}\n\n`;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
  a.download = 'Defterim.md';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Tema ve parlaklık ----------
function temaUygula(t) {
  document.body.dataset.tema = t;
  renkleriUygula(ayar);
  karanlikIste();
  $$('.tema-btn').forEach(b => b.classList.toggle('secili', b.dataset.tema === t));
  const renk = { kagit: '#e7d8b9', sepya: '#cdb38a', gece: '#1d1a16' }[t];
  $('meta[name=theme-color]').setAttribute('content', renk);
}
function parlaklikUygula(p) {
  $('#karartma').style.opacity = ((100 - p) / 100 * 0.85).toFixed(3);
  $('#parlaklik').value = p;
}

// ---------- Ses paneli ----------
function sesPaneliKur() {
  const btn = $('#ses-panel-btn');
  btn.onclick = () => {
    const p = $('#ses-panel');
    p.hidden = !p.hidden;
    btn.setAttribute('aria-expanded', String(!p.hidden));
  };
  $('#muzik-ad').textContent = ses.muzikAdi() + ' · Kevin MacLeod';
  $('#muzik-duzey').value = Math.round(ayar.muzikDuzey * 100);
  ses.muzikDuzey(ayar.muzikDuzey);
  $('#muzik-btn').onclick = async () => {
    if (ses.muzikCaliyorMu()) ses.muzikDur();
    else { try { await ses.muzikCal(); } catch (h) { bildir('Müzik çalınamadı.'); } }
    $('#muzik-btn').setAttribute('aria-pressed', String(ses.muzikCaliyorMu()));
    sesSiniflari();
  };
  $('#muzik-sonraki').onclick = () => { $('#muzik-ad').textContent = ses.muzikSonraki() + ' · Kevin MacLeod'; };
  $('#muzik-duzey').oninput = e => { ayar.muzikDuzey = e.target.value / 100; ses.muzikDuzey(ayar.muzikDuzey); };
  $('#muzik-duzey').onchange = ayarKaydet;
  const sb = $('#sayfa-ses-btn');
  sb.setAttribute('aria-pressed', String(ayar.sayfaSesi));
  sb.onclick = () => {
    ayar.sayfaSesi = !ayar.sayfaSesi;
    sb.setAttribute('aria-pressed', String(ayar.sayfaSesi));
    if (ayar.sayfaSesi) ses.sayfaSesi();
    ayarKaydet();
  };
  dogaSatirlariCiz();
}

function dogaSatirlariCiz() {
  $('#doga-satirlar').innerHTML = ses.DOGA.map(d => {
    const duzey = ayar.doga[d.ad] ?? 0.5;
    return `<div class="ses-satir">
      <button class="ses-ac" data-doga="${d.ad}" aria-pressed="${ses.dogaAcikMi(d.ad)}" title="${d.etiket}">${d.simge}</button>
      <div class="ses-ad">${d.etiket} <small>${ses.dogaKaynagi(d.ad) === 'dosya' ? 'ses dosyası' : 'kodla üretilen ses'}</small></div>
      <input type="range" min="0" max="100" value="${Math.round(duzey * 100)}" data-doga-duzey="${d.ad}" aria-label="${d.etiket} ses düzeyi">
    </div>`;
  }).join('');
}

// ---------- Arayüz bağlantıları ----------
function arayuzKur() {
  $('#dosya-sec').onchange = e => { dosyalariEkle(e.target.files); e.target.value = ''; };
  $('#kitap-ekle-btn').onclick = () => $('#dosya-sec').click();
  $('#yeni-raf-btn').onclick = () => rafPenceresi(null);
  $('#raflar').addEventListener('click', e => {
    const l = e.target.closest('.raf-levha');
    if (l) rafPenceresi(raflar.find(r => r.id === l.dataset.raf));
  });
  $('#hakkinda-btn').onclick = () => $('#hakkinda-dlg').showModal();

  // PDF'i pencereye sürükleyip bırakmak
  let derinlik = 0;
  const dosyaMi = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  addEventListener('dragenter', e => { if (dosyaMi(e)) { derinlik++; $('#birak-ipucu').hidden = false; } });
  addEventListener('dragleave', e => { if (dosyaMi(e) && --derinlik <= 0) { derinlik = 0; $('#birak-ipucu').hidden = true; } });
  addEventListener('dragover', e => { if (dosyaMi(e)) e.preventDefault(); });
  addEventListener('drop', e => {
    if (!dosyaMi(e)) return;
    e.preventDefault(); derinlik = 0; $('#birak-ipucu').hidden = true;
    dosyalariEkle(e.dataTransfer.files);
  });

  // kitap açılışı
  $('#kapak-kapat').onclick = () => rafaGeriKoy(false);
  $('#kapak-kaldir').onclick = async e => {
    const a = acikKitap; if (!a || !a.hazir) return;
    const b = e.currentTarget;
    if (!b.dataset.emin) {
      b.dataset.emin = '1';
      b.textContent = 'Emin misin? PDF, çizimler ve not silinir';
      setTimeout(() => { delete b.dataset.emin; b.textContent = 'Kitaplıktan kaldır'; }, 4000);
      return;
    }
    delete b.dataset.emin; b.textContent = 'Kitaplıktan kaldır';
    a.hazir = false;
    $('#kapak-panel').classList.remove('gorunur');
    try { await kitapKaldir(a.kitap); } catch (h) { bildir('Kitap kaldırılamadı.'); a.hazir = true; $('#kapak-panel').classList.add('gorunur'); return; }
    await a.ucan.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.8)' }], { duration: 300, fill: 'forwards' }).finished;
    URL.revokeObjectURL(a.resim.src);
    a.ucan.remove();
    $('#kapak-sahne').hidden = true;
    acikKitap = null;
    ciz();
    bildir(`"${a.kitap.ad}" kitaplıktan kaldırıldı.`);
  };
  $('#isik-btn').onclick = () => { ayar.isiklarKapali = !ayar.isiklarKapali; ayarKaydet(); karanlikGuncelle(); if (ayar.isiklarKapali && !document.body.classList.contains('okuyor') && !document.querySelector('#raflar .sus.yanik, #raflar .peri-isiklari.yanik')) bildir('Oda karanlık. Süsle ile bir fener, mum ya da abajur koy.'); };
  $('#susle-pencere').onchange = e => { ayar.pencere = e.target.checked; ayarKaydet(); pencereUygula(); };
  // süslerin ışığı yanınca/sönünce karanlık maskesi güncellensin
  new MutationObserver(karanlikIste).observe($('#raflar'), { attributes: true, attributeFilter: ['class'], subtree: true });
  $('#kapak-sahne').addEventListener('click', e => { if (e.target.id === 'kapak-sahne') rafaGeriKoy(false); });
  $('#bastan-btn').onclick = async () => { if (!acikKitap || !acikKitap.hazir) return; const k = acikKitap.kitap; await rafaGeriKoy(true); oku(k, 1); };
  $('#devam-btn').onclick = async e => {
    if (!acikKitap || !acikKitap.hazir) return;
    const k = acikKitap.kitap; const b = e.currentTarget;
    const sayfa = +b.dataset.sayfa || k.sonSayfa; const parlat = !!b.dataset.parlat;
    await rafaGeriKoy(true); oku(k, sayfa, false, parlat);
  };
  $('#yerimi-git').onclick = async () => {
    if (!acikKitap || !acikKitap.hazir || !acikKitap.kitap.yerImi) return;
    const k = acikKitap.kitap;
    await rafaGeriKoy(true); oku(k, k.yerImi.sayfa, false, true);
  };
  $('#kapak-raf').onchange = async e => {
    if (!acikKitap) return;
    const k = acikKitap.kitap;
    await kitapTasi(k.id, e.target.value, null);
    // yeni rafındaki sırta bağla ki geri koyunca oraya gitsin
    acikKitap.sirt = $(`.kitap-sirt[data-id="${k.id}"]`);
    acikKitap.sirt.classList.add('cikti');
    $('#kapak-bilgi').textContent = `${k.sayfaSayisi} sayfa · ${raflar.find(x => x.id === k.rafId).ad}`;
  };
  addEventListener('keydown', e => { if (e.key === 'Escape' && acikKitap) rafaGeriKoy(false); });

  // okuyucu
  $('#ok-kapat').onclick = () => okuyucuKapat();
  $('#ok-onceki').onclick = onceki;
  $('#ok-sonraki').onclick = sonraki;
  $('#ok-sayfa').onchange = e => sayfayaGit(+e.target.value);
  $('#ok-cizim-btn').onclick = cizimPaneliAc;
  $('#ok-yakin').onclick = () => yakinlastir(1);
  $('#ok-uzak').onclick = () => yakinlastir(-1);
  $('#ok-zoom').onclick = () => yakinlastir(0);
  $('#ok-sahne').addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    yakinlastir(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  $('#ok-kalemler').insertAdjacentHTML('beforeend', KALEMLER.map(k =>
    `<button class="kalem-btn" data-kalem="${k.ad}" style="--kr:${k.renk}" title="${k.etiket} kalem"></button>`).join(''));
  $('#ok-kalemler').onclick = e => { const b = e.target.closest('.kalem-btn'); if (b) kalemSec(b.dataset.kalem || null); };

  // defterim
  $('#defterim-btn').onclick = defterAc;

  // Açılan paneller ekranın başka bir yerine dokununca kapansın
  const sesPaneliKapat = () => { $('#ses-panel').hidden = true; $('#ses-panel-btn').setAttribute('aria-expanded', 'false'); };
  document.addEventListener('pointerdown', e => {
    const p = $('#ses-panel');
    if (!p.hidden && !p.contains(e.target) && !e.target.closest('#ses-panel-btn')) sesPaneliKapat();
  }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#ses-panel').hidden) sesPaneliKapat(); });
  // Pencereler (dialog): kutunun dışına (karartılmış alana) tıklayınca kapansın. İlk kurulum hariç.
  $$('dialog').forEach(dl => {
    if (dl.id === 'kurulum-dlg') return;
    dl.addEventListener('click', e => {
      if (e.target !== dl) return;
      const r = dl.getBoundingClientRect();
      const disarida = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (disarida) { dl.returnValue = ''; dl.close(); }
    });
  });

  // 2. sürüm: süsleme ve daktilo
  const susleAc = susPaneliKur({
    raflar: () => raflar, ayar, ayarKaydet, bildir,
    susEkle: async sus => { sus.sira = rafSonSira(sus.rafId); await db.koy('susler', sus); susler.push(sus); ciz(); },
  });
  $('#susle-btn').onclick = () => { if (!raflar.length) { kurulumAc(); return; } susleAc(); };
  const daktiloSec = {
    sesAcik: () => ayar.tusSesi !== false,
    sesDegistir: () => { ayar.tusSesi = ayar.tusSesi === false; ayarKaydet(); },
  };
  $('#kapak-daktilo').onclick = async () => { if (!acikKitap || !acikKitap.hazir) return; const k = acikKitap.kitap; await rafaGeriKoy(false); daktiloAc(k, daktiloSec); };
  $('#ok-daktilo').onclick = () => { const k = okuyucuKitabi(); if (k) daktiloAc(k, daktiloSec); };
  $('#defter-kapat').onclick = () => { $('#defterim').hidden = true; };
  $('#defter-disa').onclick = defterDisaAktar;
  $('#defter-etiketler').onclick = e => { const b = e.target.closest('[data-etiket]'); if (b) { defter.etiket = b.dataset.etiket; defterCiz(); } };
  $('#defter-renkler').onclick = e => { const b = e.target.closest('[data-renk]'); if (b) { defter.renk = b.dataset.renk; defterCiz(); } };
  $('#defter-kitap').onchange = e => { defter.kitap = e.target.value; defterCiz(); };
  $('#defter-ara').oninput = e => { defter.ara = e.target.value; defterCiz(); };
  $('#defter-liste').addEventListener('click', defterTikla);
  $('#defter-liste').addEventListener('change', async e => {
    if (!e.target.matches('[data-etiket-sec]')) return;
    const c = await db.al('cizimler', e.target.closest('.not').dataset.id);
    c.etiket = e.target.value || null;
    await db.koy('cizimler', c);
    if (defter.etiket) defterCiz(); // süzgeç açıksa liste güncellensin
  });

  // tema, parlaklık
  $$('.tema-btn').forEach(b => b.onclick = () => { ayar.tema = b.dataset.tema; temaUygula(ayar.tema); ayarKaydet(); });
  $('#parlaklik').oninput = e => { ayar.parlaklik = +e.target.value; parlaklikUygula(ayar.parlaklik); };
  $('#parlaklik').onchange = ayarKaydet;

  // doğa sesleri
  $('#doga-satirlar').addEventListener('click', e => {
    const b = e.target.closest('[data-doga]'); if (!b) return;
    const ad = b.dataset.doga;
    if (ses.dogaAcikMi(ad)) ses.dogaKapat(ad); else ses.dogaAc(ad, ayar.doga[ad] ?? 0.5);
    b.setAttribute('aria-pressed', String(ses.dogaAcikMi(ad)));
    sesSiniflari();
  });
  $('#doga-satirlar').addEventListener('input', e => {
    const ad = e.target.dataset.dogaDuzey; if (!ad) return;
    ayar.doga[ad] = e.target.value / 100;
    ses.dogaDuzey(ad, ayar.doga[ad]);
  });
  $('#doga-satirlar').addEventListener('change', ayarKaydet);
}

basla();
