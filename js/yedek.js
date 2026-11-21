// Kitaplığım · yedek al / geri yükle. Bütün kitaplık tek bir .kitapligim dosyasına yazılır.
// Dosya yalnızca kullanıcının cihazında oluşur; hiçbir sunucuya gönderilmez.
// Biçim: "KTPLGM01" + 4 bayt başlık uzunluğu + başlık (JSON) + art arda dosyalar (PDF, kapak, resim).
import { db } from './db.js';

const SIHIR = 'KTPLGM01';
const DEPOLAR = ['raflar', 'kitaplar', 'dosyalar', 'cizimler', 'notlar', 'susler', 'ayarlar'];

export async function yedekOlustur() {
  const bloblar = [];
  const veri = {};
  for (const ad of DEPOLAR) {
    const kayitlar = await db.hepsi(ad);
    veri[ad] = kayitlar.map(k => {
      const kopya = {};
      for (const [alan, deger] of Object.entries(k)) {
        if (deger instanceof Blob) { kopya[alan] = { __blob: bloblar.length, tur: deger.type }; bloblar.push(deger); }
        else kopya[alan] = deger;
      }
      return kopya;
    });
  }
  const baslik = JSON.stringify({ surum: 1, tarih: Date.now(), veri, bloblar: bloblar.map(b => ({ boyut: b.size, tur: b.type })) });
  const bb = new TextEncoder().encode(baslik);
  const uz = new Uint8Array(4);
  new DataView(uz.buffer).setUint32(0, bb.length);
  const blob = new Blob([SIHIR, uz, bb, ...bloblar], { type: 'application/octet-stream' });
  return { blob, sayilar: say(veri) };
}

function say(veri) {
  return { kitap: (veri.kitaplar || []).length, raf: (veri.raflar || []).length, cizim: (veri.cizimler || []).length, not: (veri.notlar || []).length, sus: (veri.susler || []).length };
}

export function yedekDosyaAdi() {
  const t = new Date();
  const g = n => String(n).padStart(2, '0');
  return `kitapligim-yedek-${t.getFullYear()}-${g(t.getMonth() + 1)}-${g(t.getDate())}.kitapligim`;
}

// Geri yükleme: var olan kitaplığın üstüne ekler. Aynı kimlikli kayıt (aynı kitap) yedektekiyle değişir.
// Bu cihazın ayarları (tema, parlaklık…) korunur.
export async function yedekYukle(dosya, ilerleme = () => {}) {
  const bas = new Uint8Array(await dosya.slice(0, 12).arrayBuffer());
  if (new TextDecoder().decode(bas.slice(0, 8)) !== SIHIR) throw new Error('Bu bir Kitaplığım yedek dosyası değil.');
  const uz = new DataView(bas.buffer).getUint32(8);
  const baslik = JSON.parse(new TextDecoder().decode(await dosya.slice(12, 12 + uz).arrayBuffer()));
  if (baslik.surum !== 1) throw new Error('Bu yedek daha yeni bir sürümle alınmış.');
  let ofset = 12 + uz;
  const parcalar = baslik.bloblar.map(b => { const p = dosya.slice(ofset, ofset + b.boyut, b.tur); ofset += b.boyut; return p; });
  const geriKoy = k => {
    const o = {};
    for (const [alan, deger] of Object.entries(k)) o[alan] = deger && typeof deger === 'object' && '__blob' in deger ? parcalar[deger.__blob] : deger;
    return o;
  };
  const varAyar = await db.al('ayarlar', 'genel');
  const toplam = DEPOLAR.reduce((n, ad) => n + (baslik.veri[ad] || []).length, 0);
  let biten = 0;
  for (const ad of DEPOLAR) {
    const kayitlar = (baslik.veri[ad] || []).map(geriKoy);
    if (ad === 'ayarlar' && varAyar) continue; // bu cihazın ayarları kalsın
    // Büyük dosyalar (PDF) tek tek, küçük kayıtlar topluca yazılır
    const tek = ad === 'dosyalar';
    for (let i = 0; i < kayitlar.length; i += tek ? 1 : 200) {
      const dilim = kayitlar.slice(i, i + (tek ? 1 : 200));
      await db.coklu(dilim.map(k => [ad, k]));
      biten += dilim.length;
      ilerleme(biten, toplam);
    }
  }
  return say(baslik.veri);
}

export async function depoBilgisi() {
  const sonuc = { kullanilan: null, kota: null, kalici: null };
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      sonuc.kullanilan = e.usage; sonuc.kota = e.quota;
    }
    if (navigator.storage && navigator.storage.persisted) sonuc.kalici = await navigator.storage.persisted();
  } catch (_) {}
  return sonuc;
}

export async function kaliciIste() {
  try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (_) { return false; }
}
