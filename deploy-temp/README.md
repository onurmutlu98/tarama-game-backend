<<<<<<< HEAD
# Çevreleme Oyunu (Enclosure Game)

Modern ve interaktif bir çevreleme oyunu. İki oyuncu sırayla noktalara tıklayarak çevreleme yapmaya çalışır.

## Özellikler

- 🎮 **12x12 Grid** - Optimize edilmiş oyun alanı
- ⚡ **Hızlı Performans** - Akıcı oynanış
- 🎯 **Akıllı Çevreleme** - Otomatik çevreleme tespiti
- 📊 **Canlı Skor** - Anlık puan takibi
- 🎨 **Modern UI** - Güzel ve kullanıcı dostu arayüz

## Nasıl Oynanır

1. Oyuncular sırayla grid üzerindeki noktalara tıklar
2. Mavi oyuncu ve Kırmızı oyuncu dönüşümlü oynار
3. 4 veya daha fazla nokta ile çevreleme yapıldığında puan kazanılır
4. Çevrelenen rakip noktalar etkisiz hale gelir
5. En fazla puan alan oyuncu kazanır

## Teknoloji

- Pure HTML5, CSS3, JavaScript
- Responsive tasarım
- Modern browser desteği

## Deploy

Bu oyun Netlify üzerinde deploy edilebilir.
=======
# Tarama Game Backend

Bu backend server, Tarama Grid oyununun çok oyunculu özelliklerini sağlar.

## Özellikler

- Socket.IO ile gerçek zamanlı iletişim
- Oda oluşturma ve katılma
- Oyuncu durumu yönetimi
- Oyun mantığı
- Otomatik oda temizleme
- Health check endpoint'i

## Deployment

### Render.com'da Deploy Etme

1. GitHub'a kod yükle
2. Render.com'da yeni Web Service oluştur
3. GitHub repo'sunu bağla
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Environment: Node

### Environment Variables

- `PORT`: Server portu (otomatik ayarlanır)

## API Endpoints

- `GET /`: Server durumu
- `GET /health`: Detaylı sağlık kontrolü

## Socket Events

### Client to Server
- `createRoom`: Oda oluştur
- `joinRoom`: Odaya katıl
- `toggleReady`: Hazır durumu değiştir
- `makeMove`: Oyun hamlesi
- `startEnclosure`: Çevreleme başlat
- `finishEnclosure`: Çevreleme bitir
- `cancelEnclosure`: Çevreleme iptal et
- `passTurn`: Sıra geç
- `restartGame`: Oyunu yeniden başlat

### Server to Client
- `roomCreated`: Oda oluşturuldu
- `roomJoined`: Odaya katıldı
- `playersUpdate`: Oyuncu listesi güncellendi
- `gameStarted`: Oyun başladı
- `gameUpdate`: Oyun durumu güncellendi
- `error`: Hata mesajı
>>>>>>> 83f53106706232f99bd4795705050b3ed01ff0a6
