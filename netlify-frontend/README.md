# Tarama Game - Frontend Deployment

Bu klasör Netlify deployment için hazırlanmış frontend dosyalarını içerir.

## Deployment Talimatları

### Netlify'da Deploy Etme:

1. **Netlify Dashboard**'a gidin: https://app.netlify.com/
2. **"Add new site"** > **"Deploy manually"** seçin
3. Bu klasörün içindeki tüm dosyaları sürükleyip bırakın:
   - index.html
   - manifest.json
   - icon-192.png
   - icon-512.png
   - sw.js
   - netlify.toml

### Alternatif: Git ile Deploy

1. Bu klasörü ayrı bir Git repository'si yapın
2. Netlify'da **"Import from Git"** seçin
3. Repository'yi bağlayın

## Özellikler

- ✅ Backend Render.com'da çalışıyor: `https://tarama-game-backend.onrender.com`
- ✅ Socket.IO bağlantısı yapılandırılmış
- ✅ PWA desteği (manifest.json, service worker)
- ✅ Responsive tasarım
- ✅ Netlify konfigürasyonu hazır

## Dosya Açıklamaları

- **index.html**: Ana oyun dosyası (tüm frontend kodu)
- **manifest.json**: PWA manifest dosyası
- **icon-192.png, icon-512.png**: Uygulama ikonları
- **sw.js**: Service Worker (offline çalışma)
- **netlify.toml**: Netlify konfigürasyonu

## Backend Bağlantısı

Backend URL: `https://tarama-game-backend.onrender.com`

Backend GitHub: https://github.com/onurmutlu98/tarama-game-backend
Backend Render: https://dashboard.render.com/web/srv-d3a360odl3ps73c5cseg