// Kitaplığım · 2. sürüm: her kitap için ayrı daktilo notu. Kendiliğinden kaydedilir.
import { db } from './db.js';
import { tusSesi, boslukSesi, satirSesi } from './ses.js';

const $ = s => document.querySelector(s);
let acik = null;

// Taslak: her tuşta anında localStorage'a yazılır (eşzamanlı), sayfa birden kapansa da kaybolmaz.
// Veritabanına kayıt başarılı olunca taslak silinir.
const taslakAnahtar = id => 'kitapligim-dk-' + id;
function taslakYaz(id, metin) { try { localStorage.setItem(taslakAnahtar(id), JSON.stringify({ metin, t: Date.now() })); } catch (_) {} }
function taslakOku(id) { try { return JSON.parse(localStorage.getItem(taslakAnahtar(id)) || 'null'); } catch (_) { return null; } }
function taslakSil(id) { try { localStorage.removeItem(taslakAnahtar(id)); } catch (_) {} }

export function daktiloAcikMi() { return !!acik; }

export async function daktiloAc(kitap, sec = {}) {
  let kayit = await db.al('notlar', kitap.id);
  const taslak = taslakOku(kitap.id);
  if (taslak && (!kayit || taslak.t > kayit.guncelleme)) {
    // önceki oturumda kaydedilemeden kalan yazı
    kayit = { kitapId: kitap.id, kitapAd: kitap.ad, metin: taslak.metin, guncelleme: taslak.t };
    await db.koy('notlar', kayit);
    taslakSil(kitap.id);
  }
  acik = { kitap, sec, zaman: null };
  $('#daktilo').hidden = false;
  document.body.classList.add('daktiloda');
  $('#dk-kitap').textContent = kitap.ad;
  $('#dk-tarih').textContent = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const ta = $('#dk-metin');
  ta.value = kayit ? kayit.metin : '';
  durum(kayit ? 'Son yazım: ' + new Date(kayit.guncelleme).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Boş sayfa');
  sesDugmesi();
  boyla();
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

function durum(m) { $('#dk-durum').textContent = m; }
function sesDugmesi() {
  const b = $('#dk-ses');
  const ac = !acik.sec.sesAcik || acik.sec.sesAcik();
  b.setAttribute('aria-pressed', String(ac));
  b.textContent = ac ? '🔊 Tuş sesi' : '🔇 Tuş sesi';
}
function boyla() {
  const ta = $('#dk-metin');
  ta.style.height = 'auto';
  ta.style.height = Math.max(ta.scrollHeight, 420) + 'px';
}

async function kaydet() {
  if (!acik) return;
  clearTimeout(acik.zaman);
  const metin = $('#dk-metin').value;
  const id = acik.kitap.id;
  await db.koy('notlar', { kitapId: id, kitapAd: acik.kitap.ad, metin, guncelleme: Date.now() });
  if (acik && acik.kitap.id === id && $('#dk-metin').value === metin) taslakSil(id);
  durum('Kaydedildi · ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
}

export async function daktiloKapat() {
  if (!acik) return;
  await kaydet();
  acik = null;
  $('#daktilo').hidden = true;
  document.body.classList.remove('daktiloda');
}

export function daktiloKur() {
  // Sekme gizlenir ya da kapanırsa bekleyen yazıyı hemen kaydet.
  document.addEventListener('visibilitychange', () => { if (document.hidden) kaydet(); });
  addEventListener('pagehide', () => { kaydet(); });
  const ta = $('#dk-metin');
  const kagit = $('#dk-kagit');
  ta.addEventListener('keydown', e => {
    if (!acik) return;
    if (e.key === 'Escape') { daktiloKapat(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const sesli = !acik.sec.sesAcik || acik.sec.sesAcik();
    if (e.key === 'Enter') { if (sesli) satirSesi(); }
    else if (e.key === ' ') { if (sesli) boslukSesi(); }
    else if (e.key.length === 1 || e.key === 'Backspace') { if (sesli) tusSesi(); }
    else return;
    // vuruşta kâğıt hafifçe sarsılsın
    kagit.classList.remove('vurus'); void kagit.offsetWidth; kagit.classList.add('vurus');
  });
  ta.addEventListener('input', () => {
    if (!acik) return;
    taslakYaz(acik.kitap.id, ta.value);
    boyla();
    durum('Yazılıyor…');
    clearTimeout(acik.zaman);
    acik.zaman = setTimeout(kaydet, 700);
  });
  $('#dk-kapat').onclick = daktiloKapat;
  $('#dk-ses').onclick = () => {
    if (!acik || !acik.sec.sesDegistir) return;
    acik.sec.sesDegistir();
    sesDugmesi();
    ta.focus();
  };
}
