// Kitaplığım · yerel veritabanı (IndexedDB). Hiçbir veri dışarı gönderilmez.
const DB_ADI = 'kitapligim';
const SURUM = 2; // 2: susler ve notlar eklendi
let dbSoz = null;

function ac() {
  if (dbSoz) return dbSoz;
  dbSoz = new Promise((coz, red) => {
    const istek = indexedDB.open(DB_ADI, SURUM);
    istek.onupgradeneeded = () => {
      const db = istek.result;
      if (!db.objectStoreNames.contains('raflar')) db.createObjectStore('raflar', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kitaplar')) {
        const s = db.createObjectStore('kitaplar', { keyPath: 'id' });
        s.createIndex('rafId', 'rafId');
      }
      if (!db.objectStoreNames.contains('dosyalar')) db.createObjectStore('dosyalar', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('cizimler')) {
        const s = db.createObjectStore('cizimler', { keyPath: 'id' });
        s.createIndex('kitapId', 'kitapId');
      }
      if (!db.objectStoreNames.contains('ayarlar')) db.createObjectStore('ayarlar', { keyPath: 'anahtar' });
      if (!db.objectStoreNames.contains('susler')) db.createObjectStore('susler', { keyPath: 'id' });   // 2. sürüm
      if (!db.objectStoreNames.contains('notlar')) db.createObjectStore('notlar', { keyPath: 'kitapId' }); // 2. sürüm
    };
    istek.onsuccess = () => coz(istek.result);
    istek.onerror = () => red(istek.error);
  });
  return dbSoz;
}

function sozlestir(istek) {
  return new Promise((coz, red) => {
    istek.onsuccess = () => coz(istek.result);
    istek.onerror = () => red(istek.error);
  });
}

async function depo(ad, kip = 'readonly') {
  const db = await ac();
  return db.transaction(ad, kip).objectStore(ad);
}

export const db = {
  async hepsi(ad) { return sozlestir((await depo(ad)).getAll()); },
  async al(ad, id) { return sozlestir((await depo(ad)).get(id)); },
  async koy(ad, kayit) { return sozlestir((await depo(ad, 'readwrite')).put(kayit)); },
  async kaldir(ad, id) { return sozlestir((await depo(ad, 'readwrite')).delete(id)); },
  async ayar(anahtar, varsayilan = null) {
    const k = await this.al('ayarlar', anahtar);
    return k ? k.deger : varsayilan;
  },
  async ayarKoy(anahtar, deger) { return this.koy('ayarlar', { anahtar, deger }); },
  // Birden çok kaydı tek işlemde siler: [[depo, id], ...]
  async cokluSil(liste) {
    const d = await ac();
    return new Promise((coz, red) => {
      const tx = d.transaction([...new Set(liste.map(x => x[0]))], 'readwrite');
      for (const [ad, id] of liste) tx.objectStore(ad).delete(id);
      tx.oncomplete = () => coz();
      tx.onerror = () => red(tx.error);
      tx.onabort = () => red(tx.error || new Error('Silinemedi'));
    });
  },
  // Birden çok kaydı tek işlemde (transaction) yazar: ya hepsi yazılır ya hiçbiri.
  async coklu(liste) {
    const d = await ac();
    return new Promise((coz, red) => {
      const tx = d.transaction([...new Set(liste.map(x => x[0]))], 'readwrite');
      for (const [ad, kayit] of liste) tx.objectStore(ad).put(kayit);
      tx.oncomplete = () => coz();
      tx.onerror = () => red(tx.error);
      tx.onabort = () => red(tx.error || new Error('Kayıt yapılamadı'));
    });
  },
};

export function yeniId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Tarayıcıdan verileri silmemesini iste (yer daralınca otomatik temizliğe karşı).
export async function kaliciDepolamaIste() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {}
}
