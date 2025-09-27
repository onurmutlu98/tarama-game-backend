# Tarama Oyunu - Deploy Rehberi

## Proje Yapısı

Bu proje iki ana bileşenden oluşur:

### 1. Frontend (Ana Dizin)
- `index.html` - Local oyun modu
- `manifest.json` - PWA ayarları
- `sw.js` - Service Worker
- `icon-192.png`, `icon-512.png` - PWA ikonları

### 2. Online Oyun (deploy-temp/)
- `index.html` - Online oyun modu (Socket.IO ile)
- `server.js` - Frontend server (port 3000)
- `tarama-game-backend/server.js` - Backend server (Socket.IO)

## GitHub'a Deploy Etme

1. GitHub'da yeni repository oluşturun
2. Bu komutu çalıştırın:
```bash
git remote add origin https://github.com/KULLANICI_ADI/REPO_ADI.git
git branch -M main
git push -u origin main
```

## Netlify Deploy

1. GitHub repository'sini Netlify'a bağlayın
2. Build ayarları:
   - Build command: (boş bırakın)
   - Publish directory: `/` (ana dizin)

## Render.com Backend Deploy

Backend zaten otomatik olarak Render.com'da deploy edilmiştir:
- URL: https://tarama-game-backend.onrender.com

## Özellikler

- ✅ Local oyun modu (2 oyuncu, aynı cihaz)
- ✅ Online oyun modu (Socket.IO ile gerçek zamanlı)
- ✅ PWA desteği (mobil cihazlarda uygulama gibi çalışır)
- ✅ Responsive tasarım
- ✅ Çevreleme sistemi
- ✅ Puan sistemi
- ✅ Etkisiz nokta sistemi

## Teknik Detaylar

- Frontend: Vanilla JavaScript, HTML5, CSS3
- Backend: Node.js, Socket.IO, Express
- PWA: Service Worker, Web App Manifest
- Deploy: Netlify (Frontend), Render.com (Backend)