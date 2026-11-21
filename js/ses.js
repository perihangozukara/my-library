// Kitaplığım · ses motoru.
// Doğa sesleri ve sayfa sesi Web Audio API ile kodla üretilir (dosya, lisans gerekmez).
// sesler/ klasörüne kus.mp3, yagmur.mp3, somine.mp3, dere.mp3 konursa onlar çalınır.

let ctx = null;
let ana = null;
let gurultuTampon = null;

function baglam() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    ana = ctx.createGain();
    ana.gain.value = 1;
    ana.connect(ctx.destination);
    // 4 saniyelik beyaz gürültü (white noise) tamponu, bütün sesler bunu kullanır.
    const uzunluk = ctx.sampleRate * 4;
    gurultuTampon = ctx.createBuffer(1, uzunluk, ctx.sampleRate);
    const v = gurultuTampon.getChannelData(0);
    for (let i = 0; i < uzunluk; i++) v[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Pembe gürültü (pink noise): kulağa beyaz gürültüden yumuşak ve doğal gelir.
let pembeT = null;
function pembe() {
  const c = baglam();
  if (!pembeT) {
    const n = c.sampleRate * 6;
    pembeT = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const v = pembeT.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        v[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
  }
  const k = c.createBufferSource();
  k.buffer = pembeT; k.loop = true;
  return k;
}
function yanaKoy(dugum, cikis, yer) {
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner(); p.pan.value = yer;
    dugum.connect(p).connect(cikis);
  } else dugum.connect(cikis);
}

function gurultu(kahverengi = false) {
  const c = baglam();
  const k = c.createBufferSource();
  if (kahverengi) {
    // Kahverengi gürültü (brown noise): daha boğuk, derin uğultu.
    const uz = c.sampleRate * 4;
    const t = c.createBuffer(1, uz, c.sampleRate);
    const v = t.getChannelData(0);
    let son = 0;
    for (let i = 0; i < uz; i++) {
      son = (son + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      v[i] = son * 3.5;
    }
    k.buffer = t;
  } else {
    k.buffer = gurultuTampon;
  }
  k.loop = true;
  return k;
}

function filtre(tur, frekans, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = tur;
  f.frequency.value = frekans;
  f.Q.value = q;
  return f;
}

// ---------- Sayfa çevirme sesi ----------
// Kâğıt hışırtısı: düzensiz küçük çıtırtılarla dolu bir gürültü tamponu (bir kez üretilir).
let kagitTampon = null;
function kagitTamponu() {
  if (kagitTampon) return kagitTampon;
  const sr = ctx.sampleRate, n = Math.floor(sr * 0.5);
  kagitTampon = ctx.createBuffer(1, n, sr);
  const v = kagitTampon.getChannelData(0);
  let citir = 0, son = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const zarf = t < 0.07 ? t / 0.07 : Math.exp(-(t - 0.07) * 6.5);
    if (Math.random() < 0.003) citir = 0.5 + Math.random();   // kâğıdın kırışma anları
    citir *= 0.9992;
    son = son * 0.6 + (Math.random() * 2 - 1) * 0.4;           // biraz yumuşatılmış gürültü
    v[i] = son * zarf * (0.45 + citir);
  }
  return kagitTampon;
}

export function sayfaSesi() {
  if (dosyaVar.sayfa) {
    const c = baglam();
    dosyaTamponu('sayfa').then(t => {
      if (!t) { dosyaVar.sayfa = false; sayfaSesiKod(); return; }
      const k = c.createBufferSource();
      k.buffer = t;
      k.playbackRate.value = 0.92 + Math.random() * 0.16; // her çevirişte biraz farklı
      const g = c.createGain(); g.gain.value = 0.9;
      k.connect(g).connect(ana);
      k.start();
    });
    return;
  }
  sayfaSesiKod();
}

function sayfaSesiKod() {
  const c = baglam();
  const t = c.currentTime;
  const hiz = 0.85 + Math.random() * 0.3;
  // hışırtı
  const k = c.createBufferSource();
  k.buffer = kagitTamponu();
  k.playbackRate.value = hiz;
  const bp = filtre('bandpass', 1500, 0.8);
  bp.frequency.setValueAtTime(1100, t);
  bp.frequency.exponentialRampToValueAtTime(3200, t + 0.16);
  bp.frequency.exponentialRampToValueAtTime(1600, t + 0.42);
  const hp = filtre('highpass', 350);
  const g = c.createGain(); g.gain.value = 0.55;
  k.connect(bp).connect(hp).connect(g).connect(ana);
  k.start(t);
  // sayfanın yumuşakça oturması
  const o = c.createBufferSource(); o.buffer = gurultuTampon;
  const lp = filtre('lowpass', 260, 0.7);
  const og = c.createGain();
  const t2 = t + 0.34 / hiz;
  og.gain.setValueAtTime(0.0001, t2);
  og.gain.exponentialRampToValueAtTime(0.35, t2 + 0.012);
  og.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.13);
  o.connect(lp).connect(og).connect(ana);
  o.start(t2, Math.random() * 3); o.stop(t2 + 0.15);
}

// ---------- Daktilo tuşu (2. sürüm için hazır) ----------
export function tusSesi() {
  const c = baglam();
  const t = c.currentTime;
  const k = c.createBufferSource();
  k.buffer = gurultuTampon;
  const bp = filtre('bandpass', 2500, 2);
  const g = c.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  k.connect(bp).connect(g).connect(ana);
  k.start(t, Math.random() * 3);
  k.stop(t + 0.06);
}

// ---------- Doğa sesleri ----------
// Her ses: { baslat(cikis) -> durdur() }
const uretecler = {
  yagmur(cikis) {
    // geniş, yumuşak yağmur hışırtısı
    const p = pembe();
    const hp = filtre('highpass', 200);
    const lp = filtre('lowpass', 3000, 0.5);
    const g = ctx.createGain(); g.gain.value = 0.6;
    p.connect(hp).connect(lp).connect(g).connect(cikis);
    // ince cızırtı katmanı (çok az)
    const w = gurultu();
    const hp2 = filtre('highpass', 6000);
    const g2 = ctx.createGain(); g2.gain.value = 0.035;
    w.connect(hp2).connect(g2).connect(cikis);
    // rüzgârla yağmurun hafifçe artıp azalması
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lg = ctx.createGain(); lg.gain.value = 0.14;
    lfo.connect(lg).connect(g.gain);
    p.start(); w.start(); lfo.start();
    // yapraklara ve cama düşen yumuşak damlalar
    let acik = true;
    const damla = () => {
      if (!acik) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      const f = 1600 + Math.random() * 2400;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.03);
      const dg = ctx.createGain();
      dg.gain.setValueAtTime(0.0001, t);
      dg.gain.exponentialRampToValueAtTime(0.012 + Math.random() * 0.035, t + 0.002);
      dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      o.connect(dg);
      yanaKoy(dg, cikis, Math.random() * 1.6 - 0.8);
      o.start(t); o.stop(t + 0.06);
      setTimeout(damla, 25 + Math.random() * 140);
    };
    damla();
    return () => { acik = false; p.stop(); w.stop(); lfo.stop(); };
  },

  dere(cikis) {
    // akan suyun alttaki uğultusu
    const p = pembe();
    const bp = filtre('bandpass', 800, 0.5);
    const lp = filtre('lowpass', 2600);
    const g = ctx.createGain(); g.gain.value = 0.32;
    p.connect(bp).connect(lp).connect(g).connect(cikis);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.17;
    const lg = ctx.createGain(); lg.gain.value = 0.07;
    lfo.connect(lg).connect(g.gain);
    p.start(); lfo.start();
    // şırıltı: sesi yükselerek biten küçük su kabarcıkları (dere sesinin asıl kaynağı)
    let acik = true;
    const kabarcik = () => {
      if (!acik) return;
      const simdi = ctx.currentTime;
      const adet = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < adet; i++) {
        const t = simdi + Math.random() * 0.025;
        const f = 380 + Math.random() * 1000;
        const sure = 0.025 + Math.random() * 0.05;
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * (1.5 + Math.random() * 1.2), t + sure);
        const dg = ctx.createGain();
        dg.gain.setValueAtTime(0.0001, t);
        dg.gain.exponentialRampToValueAtTime(0.012 + Math.random() * 0.04, t + 0.004);
        dg.gain.exponentialRampToValueAtTime(0.0001, t + sure + 0.02);
        o.connect(dg);
        yanaKoy(dg, cikis, Math.random() * 1.4 - 0.7);
        o.start(t); o.stop(t + sure + 0.03);
      }
      setTimeout(kabarcik, 10 + Math.random() * 50);
    };
    kabarcik();
    return () => { acik = false; p.stop(); lfo.stop(); };
  },

  somine(cikis) {
    const durdurulacak = [];
    // 1) Alev uğultusu: derin, düzensiz titreyen
    const k = gurultu(true);
    const lp = filtre('lowpass', 200, 0.7);
    const ug = ctx.createGain(); ug.gain.value = 0.55;
    k.connect(lp).connect(ug).connect(cikis);
    k.start(); durdurulacak.push(k);
    // 2) Alevin hışırtısı: çok hafif, yukarıda
    const p = pembe();
    const bp = filtre('bandpass', 2400, 0.6);
    const hs = ctx.createGain(); hs.gain.value = 0.035;
    p.connect(bp).connect(hs).connect(cikis);
    p.start(); durdurulacak.push(p);
    let acik = true;
    // alev titremesi: uğultu ve hışırtı düzeyi rastgele dalgalanır
    const titre = () => {
      if (!acik) return;
      const t = ctx.currentTime, v = 0.35 + Math.random() * 0.4;
      ug.gain.setTargetAtTime(v, t, 0.25);
      hs.gain.setTargetAtTime(0.02 + Math.random() * 0.035, t, 0.2);
      setTimeout(titre, 250 + Math.random() * 700);
    };
    titre();
    // 3) Çıtırtılar: çoğu küçük, arada büyük (gerçek ateşteki dağılım)
    const citir = (zaman, buyukluk) => {
      const d = ctx.createBufferSource(); d.buffer = gurultuTampon;
      const f = filtre('bandpass', 1200 + Math.random() * 5000, 2 + Math.random() * 8);
      const g = ctx.createGain();
      const sure = 0.003 + Math.random() * 0.012 * buyukluk;
      g.gain.setValueAtTime(0.0001, zaman);
      g.gain.exponentialRampToValueAtTime(Math.min(0.9, 0.08 + buyukluk * 0.35), zaman + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, zaman + sure);
      d.connect(f).connect(g);
      yanaKoy(g, cikis, Math.random() * 0.8 - 0.4);
      d.start(zaman, Math.random() * 3); d.stop(zaman + sure + 0.01);
    };
    // 4) Odun çatlaması: daha dolgun, kısa bir "çat"
    const cat = zaman => {
      const d = ctx.createBufferSource(); d.buffer = gurultuTampon;
      const f = filtre('bandpass', 500 + Math.random() * 500, 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, zaman);
      g.gain.exponentialRampToValueAtTime(0.5, zaman + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, zaman + 0.07);
      d.connect(f).connect(g);
      yanaKoy(g, cikis, Math.random() * 0.6 - 0.3);
      d.start(zaman, Math.random() * 3); d.stop(zaman + 0.09);
      for (let i = 0; i < 4; i++) citir(zaman + 0.005 + Math.random() * 0.06, Math.random());
    };
    const dongu = () => {
      if (!acik) return;
      const t = ctx.currentTime + 0.02;
      const r = Math.random();
      if (r < 0.04) cat(t);
      else {
        const adet = r < 0.25 ? 2 + Math.floor(Math.random() * 4) : 1;   // bazen art arda
        for (let i = 0; i < adet; i++) citir(t + i * (0.008 + Math.random() * 0.03), Math.pow(Math.random(), 3));
      }
      setTimeout(dongu, 25 + Math.pow(Math.random(), 2) * 450);
    };
    dongu();
    return () => { acik = false; durdurulacak.forEach(x => x.stop()); };
  },

  kus(cikis) {
    let acik = true;
    const cik = (t, f1, f2, sure, ses) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(f2, t + sure);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(ses, t + sure * 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
      o.connect(g).connect(cikis);
      o.start(t); o.stop(t + sure + 0.02);
    };
    const kuslar = [
      // farklı ötüş kalıpları
      (t) => { for (let i = 0; i < 3 + Math.random() * 4; i++) cik(t + i * 0.12, 3200, 4200, 0.08, 0.12); },
      (t) => { cik(t, 2500, 4800, 0.18, 0.14); cik(t + 0.22, 4800, 2600, 0.2, 0.1); },
      (t) => { for (let i = 0; i < 6; i++) cik(t + i * 0.06, 5000 - i * 200, 4500 - i * 250, 0.05, 0.08); },
      (t) => { cik(t, 1800, 2200, 0.35, 0.09); cik(t + 0.4, 2200, 1700, 0.35, 0.08); },
    ];
    const ot = () => {
      if (!acik) return;
      const k = kuslar[Math.floor(Math.random() * kuslar.length)];
      k(ctx.currentTime + 0.05);
      setTimeout(ot, 900 + Math.random() * 3500);
    };
    ot();
    return () => { acik = false; };
  },
};

export const DOGA = [
  { ad: 'kus', etiket: 'Kuş', simge: '🐦' },
  { ad: 'yagmur', etiket: 'Yağmur', simge: '🌧️' },
  { ad: 'somine', etiket: 'Şömine', simge: '🔥' },
  { ad: 'dere', etiket: 'Dere', simge: '💧' },
];

const doga = {}; // ad -> { kazanc, durdur, audio }
const tamponlar = {}; // ad -> Promise<AudioBuffer|null>  (sesler/<ad>.mp3)
function dosyaTamponu(ad) {
  if (!tamponlar[ad]) {
    tamponlar[ad] = fetch(`sesler/${ad}.mp3`)
      .then(y => (y.ok ? y.arrayBuffer() : null))
      .then(v => (v ? baglam().decodeAudioData(v) : null))
      .catch(() => null);
  }
  return tamponlar[ad];
}
const dosyaVar = {}; // ad -> bool (sesler/<ad>.mp3 var mı)

export async function dosyalariYokla() {
  await Promise.all([...DOGA, { ad: 'sayfa' }].map(async d => {
    try {
      const r = await fetch(`sesler/${d.ad}.mp3`, { method: 'HEAD' });
      dosyaVar[d.ad] = r.ok;
    } catch (_) { dosyaVar[d.ad] = false; }
  }));
}

export function dogaKaynagi(ad) { return dosyaVar[ad] ? 'dosya' : 'kod'; }

export function dogaAc(ad, duzey) {
  if (doga[ad]) return;
  baglam();
  const kazanc = ctx.createGain();
  kazanc.gain.value = duzey;
  kazanc.connect(ana);
  if (dosyaVar[ad]) {
    // Gerçek kayıt: dikişsiz döngü. Dosya açılamazsa kodla üretilen sese düşer.
    let kaynak = null, durdu = false, kodDur = null;
    doga[ad] = { kazanc, durdur: () => { durdu = true; if (kaynak) kaynak.stop(); if (kodDur) kodDur(); } };
    dosyaTamponu(ad).then(t => {
      if (durdu) return;
      if (!t) { kodDur = uretecler[ad](kazanc); return; }
      kaynak = ctx.createBufferSource();
      kaynak.buffer = t; kaynak.loop = true;
      kaynak.connect(kazanc);
      kaynak.start(0, Math.random() * Math.max(0, t.duration - 1)); // her açılışta farklı yerden
    });
  } else {
    doga[ad] = { kazanc, durdur: uretecler[ad](kazanc) };
  }
}

export function dogaKapat(ad) {
  const d = doga[ad];
  if (!d) return;
  const t = ctx.currentTime;
  d.kazanc.gain.setTargetAtTime(0, t, 0.15);
  setTimeout(() => { d.durdur(); d.kazanc.disconnect(); }, 700);
  delete doga[ad];
}

export function dogaDuzey(ad, duzey) {
  const d = doga[ad];
  if (d) d.kazanc.gain.setTargetAtTime(duzey, ctx.currentTime, 0.05);
}

export function dogaAcikMi(ad) { return !!doga[ad]; }

// ---------- Müzik (incompetech, Kevin MacLeod, CC BY 4.0) ----------
export const PARCALAR = [
  { dosya: 'sesler/fresh-air.mp3', ad: 'Fresh Air' },
  { dosya: 'sesler/midnight-tale.mp3', ad: 'Midnight Tale' },
  { dosya: 'sesler/morning.mp3', ad: 'Morning' },
];

const muzik = new Audio();
muzik.preload = 'none';
let sira = 0;
muzik.addEventListener('ended', () => muzikSonraki());

export function muzikCal() {
  if (!muzik.src) muzik.src = PARCALAR[sira].dosya;
  return muzik.play();
}
export function muzikDur() { muzik.pause(); }
export function muzikCaliyorMu() { return !muzik.paused; }
export function muzikSonraki() {
  sira = (sira + 1) % PARCALAR.length;
  const calsin = !muzik.paused || muzik.ended;
  muzik.src = PARCALAR[sira].dosya;
  if (calsin) muzik.play();
  return PARCALAR[sira].ad;
}
export function muzikAdi() { return PARCALAR[sira].ad; }
export function muzikDuzey(d) { muzik.volume = d; }

// ---------- Daktilo sesleri (2. sürüm) ----------
export function boslukSesi() {
  const c = baglam();
  const t = c.currentTime;
  const k = c.createBufferSource(); k.buffer = gurultuTampon;
  const lp = filtre('lowpass', 900, 1);
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  k.connect(lp).connect(g).connect(ana);
  k.start(t, Math.random() * 3); k.stop(t + 0.1);
}

// Satır sonu: zil + şaryo (kâğıt taşıyıcı) kayma sesi
export function satirSesi() {
  const c = baglam();
  const t = c.currentTime;
  [2350, 4700].forEach((f, i) => {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(i ? 0.05 : 0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g).connect(ana); o.start(t); o.stop(t + 1.2);
  });
  const k = c.createBufferSource(); k.buffer = gurultuTampon;
  const bp = filtre('bandpass', 700, 1.5);
  bp.frequency.setValueAtTime(500, t + 0.05);
  bp.frequency.linearRampToValueAtTime(1400, t + 0.35);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  k.connect(bp).connect(g).connect(ana);
  k.start(t + 0.05, Math.random() * 3); k.stop(t + 0.4);
}
