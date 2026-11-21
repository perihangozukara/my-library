// Kitaplığım · raf önerisi: PDF adı ve ilk sayfalardaki anahtar kelime eşleşmesi.
// Son kararı her zaman kullanıcı verir.

export const HAZIR_KELIMELER = {
  'ders': ['ders', 'matematik', 'fizik', 'kimya', 'biyoloji', 'tarih', 'coğrafya', 'edebiyat', 'sınav', 'test', 'ünite', 'konu anlatımı', 'soru', 'çözüm', 'alıştırma', 'formül', 'lise', 'üniversite', 'yks', 'kpss', 'tyt', 'ayt', 'lecture', 'chapter', 'exercise', 'exam', 'homework', 'kitapçık', 'deneme'],
  'korku': ['korku', 'dehşet', 'hayalet', 'vampir', 'cin', 'lanet', 'lanetli', 'ölü', 'ölüm', 'kan', 'karanlık', 'şeytan', 'cadı', 'zombi', 'kâbus', 'kabus', 'horror', 'ghost', 'haunted', 'terror', 'stephen king', 'lovecraft', 'poe'],
  'roman': ['roman', 'birinci bölüm', 'bölüm 1', 'novel', 'hikâye', 'hikaye', 'öykü', 'aşk', 'yazar', 'chapter one', 'prologue', 'önsöz', 'çeviren'],
  'şiir': ['şiir', 'şiirler', 'dize', 'mısra', 'divan', 'gazel', 'poems', 'poetry', 'kaside'],
  'kişisel gelişim': ['kişisel gelişim', 'alışkanlık', 'başarı', 'motivasyon', 'zihin', 'mutluluk', 'verimlilik', 'self-help', 'habit', 'mindset', 'productivity'],
  'bilim': ['bilim', 'evren', 'fizik', 'kuantum', 'evrim', 'beyin', 'science', 'universe', 'genetik'],
  'tarih': ['tarih', 'osmanlı', 'savaş', 'imparatorluk', 'devlet', 'history', 'empire', 'cumhuriyet'],
  'felsefe': ['felsefe', 'filozof', 'etik', 'varoluş', 'nietzsche', 'platon', 'aristoteles', 'philosophy'],
  'çocuk': ['çocuk', 'masal', 'boyama', 'okul öncesi', 'children', 'fairy tale'],
  'yemek': ['yemek', 'tarif', 'mutfak', 'pasta', 'recipe', 'cook'],
  'yazılım': ['yazılım', 'programlama', 'python', 'javascript', 'kod', 'algoritma', 'yapay zeka', 'yapay zekâ', 'programming', 'software', 'machine learning'],
};

export function kucult(s) {
  return (s || '').toLocaleLowerCase('tr').normalize('NFC');
}

export function rafKelimeleri(raf) {
  const ad = kucult(raf.ad).trim();
  const hazir = HAZIR_KELIMELER[ad] || [];
  const kendi = (raf.kelimeler || []).map(kucult).filter(Boolean);
  const adParca = ad.split(/\s+/).filter(x => x.length > 2);
  return [...new Set([ad, ...adParca, ...hazir, ...kendi])];
}

function sayKac(metin, kelime) {
  if (!kelime) return 0;
  const kacis = kelime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Kısa kelimeler (≤4 harf) tam kelime ya da yalnız Türkçe çekim ekiyle eşleşir:
  // "şiir" → "şiirler" olur, "kan" → "kanun", "poe" → "poems" olmaz.
  // Uzun kelimelerde baştan eşleşme yeter.
  const EK = '(?:ler|lar|leri|ları|lerde|larda|lerin|ların|i|ı|e|a|de|da|te|ta|den|dan|ten|tan|si|sı|nin|nın|in|ın|yi|yı|ye|ya)?';
  const son = [...kelime].length <= 4 ? `${EK}(?![\\p{L}])` : '';
  const r = new RegExp(`(^|[^\\p{L}])${kacis}${son}`, 'gu');
  return (metin.match(r) || []).length;
}

// Dönüş: { rafId, puan, eslesen[] } en iyi raf; hiç eşleşme yoksa rafId null.
export function rafOner(raflar, dosyaAdi, ilkMetin) {
  const ad = kucult(dosyaAdi).replace(/[_\-.]+/g, ' ');
  const metin = kucult(ilkMetin).slice(0, 6000);
  let enIyi = { rafId: null, puan: 0, eslesen: [] };
  let esitler = [];
  for (const raf of raflar) {
    let puan = 0;
    const eslesen = [];
    for (const k of rafKelimeleri(raf)) {
      const a = sayKac(ad, k) * 3;
      const m = Math.min(sayKac(metin, k), 3);
      if (a + m > 0) { puan += a + m; eslesen.push(k); }
    }
    if (puan > enIyi.puan) { enIyi = { rafId: raf.id, puan, eslesen }; esitler = [raf.id]; }
    else if (puan > 0 && puan === enIyi.puan) esitler.push(raf.id);
  }
  // Puanlar eşitse öneri yapma; kullanıcı seçsin.
  if (esitler.length > 1) return { rafId: null, puan: enIyi.puan, eslesen: [], esitler };
  return enIyi;
}
