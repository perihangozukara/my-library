# Sesler · kaynak ve lisans listesi

Her yeni ses buraya yazılır: dosya, kaynak, lisans, atıf gerekir mi.

| Dosya | Ne | Kaynak | Lisans | Atıf |
|---|---|---|---|---|
| `sesler/fresh-air.mp3` | Müzik: "Fresh Air" | Kevin MacLeod, incompetech.com | CC BY 4.0 | Gerekir → Hakkında'da yazılı |
| `sesler/midnight-tale.mp3` | Müzik: "Midnight Tale" | Kevin MacLeod, incompetech.com | CC BY 4.0 | Gerekir → Hakkında'da yazılı |
| `sesler/morning.mp3` | Müzik: "Morning" | Kevin MacLeod, incompetech.com | CC BY 4.0 | Gerekir → Hakkında'da yazılı |
| (dosya yok) | Kuş, yağmur, şömine, dere | Kodla üretildi: `js/ses.js` (Web Audio API). Şömine 21.11.2026'da yeniden yazıldı: uğultu, hışırtı, çıtırtı, odun çatlaması | Kendi kodumuz | Gerekmez |
| `sesler/yagmur.mp3` | Yağmur ("Rain against the window"), dikişsiz döngüye çevrildi | cori · https://commons.wikimedia.org/wiki/File:Rain_against_the_window.ogg | Kamu malı (public domain) | Gerekmez (Hakkında'da yazılı) |
| `sesler/somine.mp3` | Şömine ("Dry grass burning in open fireplace"), dikişsiz döngü | ezwa · https://commons.wikimedia.org/wiki/File:Dry_grass_burning_in_open_fireplace.ogg | Kamu malı | Gerekmez (Hakkında'da yazılı) |
| `sesler/sayfa.mp3` | Sayfa çevirme ("Turning a page"), 1,3 sn'lik bölüm | planish · https://commons.wikimedia.org/wiki/File:Turning_a_page.ogg | Kamu malı | Gerekmez (Hakkında'da yazılı) |
| (dosya yok) | Sayfa çevirme sesi (yedek) | Kodla üretildi: `js/ses.js`; dosya açılamazsa çalar | Kendi kodumuz | Gerekmez |
| (dosya yok) | Daktilo tuş, boşluk ve satır zili sesleri (2. sürüm) | Kodla üretildi: `js/ses.js` | Kendi kodumuz | Gerekmez |

## Kendi sesini koymak
`sesler/` klasörüne şu adlarla bir MP3 dosyası koyarsan, uygulama kodla üretilen ses yerine o dosyayı çalar:
`kus.mp3`, `yagmur.mp3`, `somine.mp3`, `dere.mp3`, `sayfa.mp3` (sayfa çevirme).
Doğa sesleri dikişsiz döngüyle çalar; sayfa sesi her çevirişte biraz farklı hızda çalar.
Yalnızca CC0 ya da kamu malı (atıf istemeyen) dosya koy. Sonra dosyanın adını `sesler/liste.json` içindeki listeye ekle ve bu tabloya satırını yaz.
