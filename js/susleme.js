// Kitaplığım · 2. sürüm: raf süsleri (fener, mum, kitap desteği, çerçeve, biblo) ve renkler.
// Süsler raftaki sırayı kitaplarla paylaşır; kitaplar gibi sürüklenir.
import { db, yeniId } from './db.js';

const $ = (s, k = document) => k.querySelector(s);

export const SUS_TURLERI = {
  fener: { ad: 'Fener', simge: '🏮', isikli: true },
  mum: { ad: 'Mum', simge: '🕯️', isikli: true },
  isiklar: { ad: 'Peri ışıkları', simge: '✨', isikli: true, rafUstu: true },
  bitki: { ad: 'Saksı bitkisi', simge: '🪴', isikli: false },
  cay: { ad: 'Çay fincanı', simge: '🍵', isikli: false },
  kumsaati: { ad: 'Kum saati', simge: '⏳', isikli: false },
  kure: { ad: 'Küre', simge: '🌍', isikli: false },
  kedi: { ad: 'Uyuyan kedi', simge: '🐈', isikli: false },
  abajur: { ad: 'Abajur', simge: '🛋️', isikli: true },
  hokka: { ad: 'Hokka ve tüy kalem', simge: '🪶', isikli: false },
  plak: { ad: 'Plak çalar', simge: '🎶', isikli: false },
  cerceve: { ad: 'Çerçeve', simge: '🖼️', isikli: false, resimli: true },
  biblo: { ad: 'Biblo', simge: '🗿', isikli: false, resimli: true },
};
// 'destek' (kitap desteği) 3. sürümde kaldırıldı; eski kayıtlar çizilmez.

// Kitap arasına konan fener biçimli lamba (Library Lantern).
const FENER_SVG = `<svg class="sus-cizim" viewBox="0 0 50 124" width="48" height="120" aria-hidden="true">
  <defs>
    <linearGradient id="fpirinc" x1="0" x2="1"><stop offset="0" stop-color="#6b4a1c"/><stop offset=".45" stop-color="#e2bd6a"/><stop offset="1" stop-color="#6b4a1c"/></linearGradient>
  </defs>
  <path d="M25 3a8 8 0 0 1 8 8v4h-3v-4a5 5 0 0 0-10 0v4h-3v-4a8 8 0 0 1 8-8z" fill="url(#fpirinc)"/>
  <path d="M10 15h30l-5 11H15z" fill="url(#fpirinc)"/>
  <rect x="11" y="26" width="28" height="64" rx="2" fill="#2a2018" opacity=".7"/>
  <rect class="cam-isik" x="11" y="26" width="28" height="64" rx="2" fill="#ffb54a"/>
  <rect x="13" y="28" width="4" height="60" fill="#fff" opacity=".12"/>
  <rect x="21.5" y="70" width="7" height="18" rx="1" fill="#f2e3c2"/>
  <g class="alev"><ellipse cx="25" cy="63" rx="4" ry="8.5" fill="#ffc94d"/><ellipse cx="25" cy="65.5" rx="2" ry="4" fill="#fff6cf"/></g>
  <path d="M11 26v64M18 26v64M32 26v64M39 26v64" stroke="#3b2812" stroke-width="2.2"/>
  <path d="M7 90h36v5H7z" fill="url(#fpirinc)"/>
  <path d="M10 95h30l2 22H8z" fill="#2f2114"/>
  <path d="M6 117h38v5H6z" fill="url(#fpirinc)"/>
</svg>`;

const MUM_SVG = `<svg class="sus-cizim" viewBox="0 0 40 104" width="38" height="100" aria-hidden="true">
  <g class="alev"><ellipse cx="20" cy="14" rx="4.2" ry="10" fill="#ffc94d"/><ellipse cx="20" cy="17" rx="2" ry="4.5" fill="#fff6cf"/></g>
  <path d="M20 22v5" stroke="#2a1d10" stroke-width="1.6"/>
  <path d="M11 30q9-4 18 0v56H11z" fill="#efe1c0"/>
  <path d="M11 30q9-4 18 0v6q-2 0-2 6t-2 0v-4q-6 2-10 0v10q-2 2-2-4z" fill="#f8ecd2"/>
  <path d="M25 30v56" stroke="rgba(0,0,0,.08)" stroke-width="4"/>
  <ellipse cx="20" cy="90" rx="17" ry="5" fill="#b8893c"/>
  <path d="M4 90q16 14 32 0v4q-16 12-32 0z" fill="#8a6326"/>
</svg>`;

const HOKKA_SVG = `<svg class="sus-cizim" viewBox="0 0 70 110" width="66" height="104" aria-hidden="true">
  <g class="tuy">
    <path d="M33 76L58 6" stroke="#d9ccb2" stroke-width="1.6"/>
    <path d="M58 6C67 20 60 42 43 58C48 40 51 24 58 6z" fill="#efe6d4"/>
    <path d="M58 6C49 21 43 38 39 64C37 45 44 22 58 6z" fill="#d6c7aa"/>
    <path d="M52 22l6-3M48 32l7-3M45 42l6-2" stroke="#bfae8c" stroke-width=".8"/>
  </g>
  <rect x="24" y="64" width="22" height="4" rx="1" fill="#c9a24a"/>
  <rect x="26" y="67" width="18" height="10" rx="2" fill="#2a3a50"/>
  <path d="M14 77h42l4 25H10z" fill="#1e2a3a"/>
  <rect x="11" y="92" width="48" height="10" fill="#0b1120" opacity=".65"/>
  <path d="M18 80l2 19" stroke="rgba(255,255,255,.35)" stroke-width="3"/>
  <ellipse cx="35" cy="103" rx="27" ry="3" fill="#162130"/>
</svg>`;

const ABAJUR_SVG = `<svg class="sus-cizim" viewBox="0 0 80 125" width="78" height="122" aria-hidden="true">
  <path class="isik-koni" d="M14 50L-6 122H86L66 50z" fill="rgba(255,214,150,.22)"/>
  <path class="abajur-sapka" d="M21 12h38l13 38H8z" fill="#7a3f3f"/>
  <path d="M21 12h38l1.5 4H19.5z" fill="#c9a24a"/><path d="M8 50h64l-1.3-4H9.3z" fill="#c9a24a"/>
  <path d="M30 12l-8 38M50 12l8 38" stroke="rgba(0,0,0,.12)" stroke-width="4"/>
  <ellipse class="abajur-ic" cx="40" cy="50" rx="31" ry="3.5" fill="#ffd27a"/>
  <rect x="37" y="50" width="6" height="56" fill="#b8863a"/>
  <rect x="38" y="50" width="2" height="56" fill="#f0d48a" opacity=".6"/>
  <ellipse cx="40" cy="110" rx="22" ry="7" fill="#8a6326"/>
  <path d="M18 110q22 14 44 0v4q-22 12-44 0z" fill="#5f4318"/>
</svg>`;

const PLAK_SVG = `<svg class="sus-cizim" viewBox="0 0 110 76" width="108" height="74" aria-hidden="true">
  <rect x="4" y="40" width="102" height="32" rx="4" fill="#6e4424"/>
  <rect x="4" y="62" width="102" height="10" rx="2" fill="#4a2d18"/>
  <circle cx="16" cy="51" r="3.5" fill="#c9a24a"/><circle cx="27" cy="51" r="3.5" fill="#c9a24a"/>
  <path d="M10 40L22 26H100L105 40z" fill="#3b2a1e"/>
  <g transform="translate(60 33) scale(1 .26)">
    <g class="donen">
      <circle r="31" fill="#151515"/>
      <circle r="25" fill="none" stroke="#2c2c2c" stroke-width="1.2"/>
      <circle r="19" fill="none" stroke="#2c2c2c" stroke-width="1.2"/>
      <circle r="10" fill="#c24a3a"/>
      <rect x="-1.5" y="-10" width="3" height="10" fill="#f3e6c8"/>
      <circle r="1.6" fill="#f3e6c8"/>
    </g>
  </g>
  <path d="M33 30a27 7 0 0 1 22-4" stroke="rgba(255,255,255,.22)" stroke-width="2" fill="none"/>
  <path d="M99 28L90 22L74 31" stroke="#c9a24a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <circle cx="99" cy="28" r="4" fill="#c9a24a"/>
</svg>`;

const BITKI_SVG = `<svg class="sus-cizim" viewBox="0 0 90 128" width="88" height="124" aria-hidden="true">
  <g class="yapraklar">
    <path d="M45 78C40 58 22 52 10 56c8 4 18 12 35 22z" fill="#4f7a43"/>
    <path d="M45 78C52 56 70 48 84 50c-9 5-20 13-39 28z" fill="#5d8c4e"/>
    <path d="M45 80C34 64 30 40 38 22c4 14 8 34 7 58z" fill="#3f6a37"/>
    <path d="M45 80C56 62 58 36 50 16c-3 16-7 38-5 64z" fill="#6a9a58"/>
    <path d="M45 80C30 72 14 74 6 82c12 0 26-2 39-2z" fill="#577f47"/>
    <path d="M45 80C60 70 76 70 86 78c-13 1-27 1-41 2z" fill="#4a7540"/>
    <path d="M38 22c4 14 8 34 7 58M50 16c-3 16-7 38-5 64" stroke="#2f5228" stroke-width="1" fill="none" opacity=".6"/>
    <circle cx="30" cy="40" r="3.2" fill="#f2c4cf"/><circle cx="62" cy="34" r="3" fill="#f6d27a"/><circle cx="20" cy="58" r="2.6" fill="#f2c4cf"/>
  </g>
  <path d="M22 80h46l-6 44H28z" fill="#b5653d"/>
  <path d="M19 76h52v9H19z" fill="#c97a4f"/>
  <path d="M28 88h34" stroke="#9a5232" stroke-width="2"/>
  <path d="M33 80l-1 44M57 80l1 44" stroke="rgba(0,0,0,.12)" stroke-width="5"/>
</svg>`;

const CAY_SVG = `<svg class="sus-cizim" viewBox="0 0 80 100" width="78" height="98" aria-hidden="true">
  <g class="buhar" fill="none" stroke="rgba(255,250,240,.7)" stroke-width="3" stroke-linecap="round">
    <path class="b1" d="M30 46c-6-8 6-12 0-20s6-12 0-20"/>
    <path class="b2" d="M42 46c-6-8 6-12 0-20s6-12 0-20"/>
  </g>
  <ellipse cx="40" cy="92" rx="34" ry="6" fill="#e9dcc2"/>
  <ellipse cx="40" cy="90" rx="26" ry="3.5" fill="#d4c3a2"/>
  <path d="M16 54h48c0 18-10 34-24 34S16 72 16 54z" fill="#f4ead6"/>
  <path d="M64 60c12 0 12 16 0 16" fill="none" stroke="#f4ead6" stroke-width="5"/>
  <ellipse cx="40" cy="54" rx="24" ry="5" fill="#8a4a1f"/>
  <path d="M22 64q18 6 36 0" stroke="#5f8fb5" stroke-width="3" fill="none" opacity=".75"/>
  <path d="M26 72q14 5 28 0" stroke="#c9a24a" stroke-width="1.5" fill="none" opacity=".8"/>
</svg>`;

const KUMSAATI_SVG = `<svg class="sus-cizim" viewBox="0 0 60 120" width="56" height="116" aria-hidden="true">
  <defs><clipPath id="kum-ust"><path d="M14 14h32c0 22-14 26-16 46-2-20-16-24-16-46z"/></clipPath>
  <clipPath id="kum-alt"><path d="M30 60c2 20 16 24 16 46H14c0-22 14-26 16-46z"/></clipPath></defs>
  <path d="M14 14h32c0 22-14 26-16 46 2 20 16 24 16 46H14c0-22 14-26 16-46-2-20-16-24-16-46z" fill="rgba(220,235,240,.28)" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>
  <g clip-path="url(#kum-ust)"><rect class="kum-ust" x="10" y="30" width="40" height="40" fill="#e0b46a"/></g>
  <g clip-path="url(#kum-alt)"><rect class="kum-alt" x="10" y="92" width="40" height="20" fill="#e0b46a"/></g>
  <rect class="kum-akis" x="29.2" y="58" width="1.6" height="44" fill="#e0b46a"/>
  <rect x="6" y="6" width="48" height="9" rx="2" fill="#6e4424"/><rect x="6" y="105" width="48" height="9" rx="2" fill="#6e4424"/>
  <rect x="9" y="14" width="4" height="92" fill="#8a5a33"/><rect x="47" y="14" width="4" height="92" fill="#8a5a33"/>
</svg>`;

const KURE_SVG = `<svg class="sus-cizim" viewBox="0 0 90 124" width="86" height="120" aria-hidden="true">
  <defs>
    <clipPath id="kure-kes"><circle cx="45" cy="50" r="30"/></clipPath>
    <radialGradient id="kure-isik" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
  </defs>
  <circle cx="45" cy="50" r="30" fill="#3f6f8f"/>
  <g clip-path="url(#kure-kes)"><g class="karalar" fill="#c8b07a">
    <path d="M0 30c8-6 16 2 22-4s14 2 12 10-12 6-14 14-12 4-14-4S-4 36 0 30z"/>
    <path d="M40 54c6-2 12 4 10 10s-8 14-14 10-2-18 4-20z"/>
    <path d="M60 24c10-4 20 2 18 10s-14 4-18 0-6-8 0-10z"/>
    <path d="M90 30c8-6 16 2 22-4s14 2 12 10-12 6-14 14-12 4-14-4-10-10-6-16z"/>
    <path d="M130 54c6-2 12 4 10 10s-8 14-14 10-2-18 4-20z"/>
    <path d="M150 24c10-4 20 2 18 10s-14 4-18 0-6-8 0-10z"/>
  </g></g>
  <circle cx="45" cy="50" r="30" fill="url(#kure-isik)"/>
  <path d="M45 14a36 36 0 0 1 0 72" fill="none" stroke="#c9a24a" stroke-width="3"/>
  <path d="M45 86v18" stroke="#6e4424" stroke-width="5"/>
  <path d="M24 116c4-10 38-10 42 0z" fill="#6e4424"/><rect x="20" y="114" width="50" height="6" rx="2" fill="#5a3820"/>
</svg>`;

const KEDI_SVG = `<svg class="sus-cizim" viewBox="0 0 120 70" width="116" height="68" aria-hidden="true">
  <g class="kedi-govde">
    <path d="M14 62c-8-24 14-44 44-44s50 16 46 36c-2 8-8 10-14 10H24c-6 0-9-1-10-2z" fill="var(--kedi, #6b6460)"/>
    <path d="M100 58c10 2 14-10 6-14" fill="none" stroke="var(--kedi, #6b6460)" stroke-width="8" stroke-linecap="round"/>
    <path d="M30 40c0-10 8-18 18-18" fill="none" stroke="rgba(0,0,0,.15)" stroke-width="3"/>
    <path d="M62 30c8 2 14 8 16 14" fill="none" stroke="rgba(0,0,0,.15)" stroke-width="3"/>
  </g>
  <g class="kedi-bas">
    <path d="M10 64c-6-12 0-26 14-28 12-2 22 8 20 22-1 6-6 8-12 8H14z" fill="var(--kedi, #6b6460)"/>
    <path d="M12 42l2-14 9 9zM30 37l8-11 2 14z" fill="var(--kedi, #6b6460)"/>
    <path d="M14 39l1.5-7 4.5 4.5zM31 36l5-6 1 7z" fill="#e9b7a8"/>
    <path d="M17 52q3 2 6 0M28 52q3 2 6 0" stroke="#2a2420" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M24.5 57l1.5 1.5 1.5-1.5z" fill="#d98b80"/>
  </g>
</svg>`;

export function susElemani(sus, resimUrl) {
  if (!SUS_TURLERI[sus.tur] || SUS_TURLERI[sus.tur].rafUstu) return null; // bilinmeyen ya da raf üstü süs
  const el = document.createElement('div');
  el.className = `raf-ogesi sus sus-${sus.tur}` + (sus.yanik ? ' yanik' : '');
  el.dataset.tur = 'sus';
  el.dataset.id = sus.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.title = SUS_TURLERI[sus.tur].ad + (SUS_TURLERI[sus.tur].isikli ? (sus.yanik ? ' · yanıyor' : ' · sönük') : '');
  if (sus.tur === 'fener') el.innerHTML = '<div class="isik">' + '<i></i>'.repeat(6) + '</div>' + FENER_SVG;
  else if (sus.tur === 'mum') el.innerHTML = '<div class="isik">' + '<i></i>'.repeat(6) + '</div>' + MUM_SVG;
  else if (sus.tur === 'bitki') el.innerHTML = BITKI_SVG;
  else if (sus.tur === 'hokka') el.innerHTML = HOKKA_SVG;
  else if (sus.tur === 'plak') el.innerHTML = PLAK_SVG;
  else if (sus.tur === 'abajur') el.innerHTML = '<div class="isik">' + '<i></i>'.repeat(6) + '</div>' + ABAJUR_SVG;
  else if (sus.tur === 'cay') el.innerHTML = CAY_SVG;
  else if (sus.tur === 'kumsaati') el.innerHTML = KUMSAATI_SVG;
  else if (sus.tur === 'kure') el.innerHTML = KURE_SVG;
  else if (sus.tur === 'kedi') { el.innerHTML = KEDI_SVG; el.style.setProperty('--kedi', ['#c08a52', '#d9cbb8', '#a39a92', '#e0a36a'][parseInt(sus.id.slice(-2), 36) % 4]); }
  else if (sus.tur === 'cerceve') el.innerHTML = `<div class="cerceve-ic"><img alt="" draggable="false" src="${resimUrl}"></div>`;
  else if (sus.tur === 'biblo') el.innerHTML = `<img alt="" draggable="false" src="${resimUrl}">`;
  el.addEventListener('contextmenu', e => e.preventDefault());
  return el;
}

// Peri ışıkları: rafın tavanından sarkan, göz kırpan ampuller. Raf genişliğine yayılır.
export function isiklarElemani(sus) {
  const el = document.createElement('div');
  el.className = 'peri-isiklari' + (sus.yanik ? ' yanik' : '');
  el.dataset.id = sus.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.title = 'Peri ışıkları · ' + (sus.yanik ? 'yanıyor' : 'sönük');
  const KAVIS = 6, AMPUL = 5; // 6 kavis, her kavisde 5 ampul
  let tel = 'M0 4';
  for (let i = 0; i < KAVIS; i++) {
    const x0 = (i / KAVIS) * 1000, x1 = ((i + 1) / KAVIS) * 1000;
    tel += ` Q${(x0 + x1) / 2} 44 ${x1} 4`;
  }
  const renkler = ['#ffd27a', '#ffb3c7', '#b5e3ff', '#c7f0a8', '#ffe9b3'];
  let ampuller = '';
  for (let i = 0; i < KAVIS; i++) {
    for (let j = 1; j <= AMPUL; j++) {
      const u = j / (AMPUL + 1);
      const x = ((i + u) / KAVIS) * 100;
      const y = 4 + 2 * (1 - u) * u * 40; // ikinci derece eğri üstündeki nokta
      const renk = renkler[(i * AMPUL + j) % renkler.length];
      ampuller += `<i style="left:${x}%;top:${y}px;--ar:${renk};animation-delay:${((i * 7 + j * 3) % 10) / 4}s"></i>`;
    }
  }
  el.innerHTML = `<svg viewBox="0 0 1000 50" preserveAspectRatio="none" aria-hidden="true"><path d="${tel}" fill="none" stroke="#3a2a1a" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>${ampuller}`;
  return el;
}

// Kullanıcının resmini küçült: veritabanı şişmesin. Biblo şeffaflığı korunsun diye PNG.
export function resimKucult(dosya, png) {
  return new Promise((coz, red) => {
    const img = new Image();
    const url = URL.createObjectURL(dosya);
    img.onload = () => {
      const enBuyuk = 480;
      const o = Math.min(1, enBuyuk / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * o); c.height = Math.round(img.height * o);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? coz(b) : red(new Error('resim')), png ? 'image/png' : 'image/jpeg', 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); red(new Error('Resim açılamadı')); };
    img.src = url;
  });
}

// ---------- Renkler ----------
export const DUVARLAR = [
  { ad: 'Krem', renk: '#e7d8b9' }, { ad: 'Adaçayı', renk: '#b8c4a6' }, { ad: 'Gül kurusu', renk: '#d9b8ae' },
  { ad: 'Lavanta', renk: '#c3b6cc' }, { ad: 'Gece mavisi', renk: '#3c4a5e' }, { ad: 'Bordo', renk: '#6b3a3a' },
  { ad: 'Orman', renk: '#3f5240' }, { ad: 'Toprak', renk: '#9c6f4f' },
];
export const AHSAPLAR = [
  { ad: 'Meşe', a: '#8a5a33', b: '#6e4424', c: '#a46c3d', arka: '#4b2f1a' },
  { ad: 'Ceviz', a: '#5e3b22', b: '#4a2d18', c: '#74492b', arka: '#2c1a0e' },
  { ad: 'Maun', a: '#7a2f22', b: '#5e2218', c: '#8f3d2c', arka: '#33120c' },
  { ad: 'Akçaağaç', a: '#b9895a', b: '#9c7046', c: '#d2a26e', arka: '#6b4a2c' },
  { ad: 'Abanoz', a: '#2e2622', b: '#201a17', c: '#3d332d', arka: '#120e0c' },
  { ad: 'Boyalı yeşil', a: '#3f5a4a', b: '#2f4538', c: '#4d6b58', arka: '#1c2a22' },
];

function karistir(hex, hedef, oran) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(hex), p(hedef)];
  return '#' + a.map((x, i) => Math.round(x * oran + b[i] * (1 - oran)).toString(16).padStart(2, '0')).join('');
}

export function renkleriUygula(ayar) {
  const st = document.body.style;
  const gece = ayar.tema === 'gece';
  if (ayar.duvar) {
    st.setProperty('--duvar', gece ? karistir(ayar.duvar, '#000000', 0.24) : ayar.duvar);
    st.setProperty('--duvar2', gece ? karistir(ayar.duvar, '#000000', 0.16) : karistir(ayar.duvar, '#000000', 0.88));
    // koyu duvarda yazı açık olsun
    const [r, g, b] = [1, 3, 5].map(i => parseInt(ayar.duvar.slice(i, i + 2), 16));
    const koyu = gece || (0.299 * r + 0.587 * g + 0.114 * b) < 120;
    st.setProperty('--duvar-yazi', koyu ? '#e9dcc3' : '#3b2a1e');
  } else {
    st.removeProperty('--duvar'); st.removeProperty('--duvar2'); st.removeProperty('--duvar-yazi');
  }
  const ah = AHSAPLAR.find(x => x.ad === ayar.ahsap);
  if (ah) {
    const k = (h, o) => gece ? karistir(h, '#000000', o) : h;
    st.setProperty('--ahsap-a', k(ah.a, 0.6)); st.setProperty('--ahsap-b', k(ah.b, 0.6));
    st.setProperty('--ahsap-c', k(ah.c, 0.6)); st.setProperty('--arka', k(ah.arka, 0.55));
  } else {
    ['--ahsap-a', '--ahsap-b', '--ahsap-c', '--arka'].forEach(x => st.removeProperty(x));
  }
}

// ---------- Süsle penceresi ----------
// sec: { raflar(), ayar, ayarKaydet(), susEkle(sus), bildir(metin) }
export function susPaneliKur(sec) {
  const dlg = $('#susle-dlg');
  $('#susle-turler').innerHTML = Object.entries(SUS_TURLERI).map(([tur, t]) =>
    `<button type="button" class="sus-sec" data-tur="${tur}"><span>${t.simge}</span>${t.ad}${t.resimli ? '<small>resim seç</small>' : ''}</button>`).join('');

  const renkCiz = () => {
    $('#susle-duvar').innerHTML = `<button type="button" class="renk-ornek tema-renk ${!sec.ayar.duvar ? 'secili' : ''}" data-duvar="" title="Temanın rengi">Temanın rengi</button>` +
      DUVARLAR.map(d => `<button type="button" class="renk-ornek ${sec.ayar.duvar === d.renk ? 'secili' : ''}" data-duvar="${d.renk}" title="${d.ad}" style="background:${d.renk}"></button>`).join('') +
      `<label class="renk-ornek ozel" title="Kendi rengin"><input type="color" id="susle-ozel" value="${sec.ayar.duvar || '#e7d8b9'}">+</label>`;
    $('#susle-ahsap').innerHTML = `<button type="button" class="ahsap-ornek ${!sec.ayar.ahsap ? 'secili' : ''}" data-ahsap="">Temanın rengi</button>` +
      AHSAPLAR.map(a => `<button type="button" class="ahsap-ornek ${sec.ayar.ahsap === a.ad ? 'secili' : ''}" data-ahsap="${a.ad}" style="--o1:${a.c};--o2:${a.a}">${a.ad}</button>`).join('');
  };

  let bekleyenTur = null;
  $('#susle-turler').onclick = e => {
    const b = e.target.closest('.sus-sec'); if (!b) return;
    const tur = b.dataset.tur;
    if (SUS_TURLERI[tur].resimli) { bekleyenTur = tur; $('#susle-resim').click(); return; }
    ekle(tur, null);
  };
  $('#susle-resim').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f || !bekleyenTur) return;
    try { ekle(bekleyenTur, await resimKucult(f, bekleyenTur === 'biblo')); }
    catch (_) { sec.bildir('Bu resim açılamadı.'); }
  };
  async function ekle(tur, resim) {
    const rafId = $('#susle-raf').value;
    const sus = { id: yeniId(), tur, rafId, resim, yanik: SUS_TURLERI[tur].isikli };
    await sec.susEkle(sus);
    dlg.close();
    sec.bildir(`${SUS_TURLERI[tur].ad} rafa kondu. Sürükleyerek yerini değiştirebilirsin.`);
  }

  $('#susle-duvar').addEventListener('click', e => {
    const b = e.target.closest('[data-duvar]'); if (!b) return;
    sec.ayar.duvar = b.dataset.duvar || null;
    renkleriUygula(sec.ayar); sec.ayarKaydet(); renkCiz();
  });
  $('#susle-duvar').addEventListener('input', e => {
    if (e.target.id !== 'susle-ozel') return;
    sec.ayar.duvar = e.target.value;
    renkleriUygula(sec.ayar);
  });
  $('#susle-duvar').addEventListener('change', e => { if (e.target.id === 'susle-ozel') { sec.ayarKaydet(); renkCiz(); } });
  $('#susle-ahsap').addEventListener('click', e => {
    const b = e.target.closest('[data-ahsap]'); if (!b) return;
    sec.ayar.ahsap = b.dataset.ahsap || null;
    renkleriUygula(sec.ayar); sec.ayarKaydet(); renkCiz();
  });

  return function ac() {
    $('#susle-raf').innerHTML = sec.raflar().map(r => `<option value="${r.id}">${r.ad.replace(/</g, '&lt;')}</option>`).join('');
    renkCiz();
    dlg.showModal();
  };
}

// ---------- Süse tıklayınca küçük menü ----------
export function susMenuAc(sus, el, sec) {
  const m = $('#sus-menu');
  const t = SUS_TURLERI[sus.tur];
  m.innerHTML = `<b>${t.simge} ${t.ad}</b>` +
    (t.isikli ? `<button data-is="isik">${sus.yanik ? 'Söndür' : 'Yak'}</button>` : '') +
    `<button data-is="kaldir">Kaldır</button>`;
  const r = el.getBoundingClientRect();
  m.hidden = false;
  const gen = m.offsetWidth;
  m.style.left = Math.max(8, Math.min(innerWidth - gen - 8, r.left + r.width / 2 - gen / 2)) + 'px';
  m.style.top = Math.max(8, r.top - m.offsetHeight - 8) + 'px';
  const kapat = () => { m.hidden = true; document.removeEventListener('pointerdown', disari, true); };
  const disari = ev => { if (!m.contains(ev.target)) kapat(); };
  setTimeout(() => document.addEventListener('pointerdown', disari, true), 0);
  m.onclick = async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.is === 'isik') {
      sus.yanik = !sus.yanik;
      await db.koy('susler', sus);
      el.classList.toggle('yanik', sus.yanik);
      kapat();
    } else if (b.dataset.is === 'kaldir') {
      if (!b.dataset.emin) { b.dataset.emin = '1'; b.textContent = 'Emin misin?'; return; }
      kapat();
      await sec.kaldir(sus);
    }
  };
}
