# Tarama Oyunu - Play Store Yayın Rehberi

## 📱 Uygulama Bilgileri
- **Uygulama Adı:** Tarama Oyunu
- **Paket Adı:** com.tarama.app
- **Kategori:** Oyunlar > Bulmaca
- **Hedef Kitle:** 3+ yaş

## 🚀 Deploy Durumu
✅ **Web Uygulaması:** https://grid-game-v1.netlify.app
✅ **PWA Özellikleri:** Manifest, Service Worker, İkonlar
✅ **Android APK:** Capacitor ile hazır

## 📋 Play Store İçin Gerekli Adımlar

### 1. APK Oluşturma
```bash
# Android Studio ile APK build etme
npx cap open android
# Android Studio'da Build > Generate Signed Bundle/APK
```

### 2. Gerekli Dosyalar
- ✅ App Icon (192x192, 512x512)
- ✅ Manifest.json
- ✅ Service Worker
- ⚠️ Feature Graphic (1024x500) - Oluşturulacak
- ⚠️ Screenshots (Telefon, Tablet) - Alınacak
- ⚠️ Privacy Policy - Yazılacak

### 3. Uygulama Açıklaması

**Kısa Açıklama:**
Grid tabanlı strateji oyunu. Noktaları seç, alanları çevrele, rakibini yen!

**Uzun Açıklama:**
İki kişilik grid tabanlı strateji oyunu. Oyuncular sırayla grid üzerinde noktalar seçer ve bu noktaları birleştirerek alanlar oluşturur. Amacınız rakibinizden daha fazla alan çevrelemek!

**Özellikler:**
- İki kişilik oyun modu
- Akıllı çevreleme algoritması
- Responsive tasarım
- PWA desteği
- Offline oynanabilir

### 4. Anahtar Kelimeler
grid oyunu, strateji, iki kişilik, bulmaca, çevreleme, alan kontrolü

### 5. İletişim Bilgileri
- **Geliştirici:** [Geliştirici Adı]
- **E-posta:** [E-posta Adresi]
- **Web Sitesi:** https://grid-game-v1.netlify.app

## 🔧 Teknik Detaylar
- **Minimum Android Sürümü:** API 22 (Android 5.1)
- **Hedef Android Sürümü:** API 34 (Android 14)
- **Boyut:** ~2MB
- **İzinler:** İnternet (opsiyonel, PWA güncellemeleri için)

## 📸 Ekran Görüntüleri Alınacak Yerler
1. Ana oyun ekranı
2. Oyun başlangıcı
3. Çevreleme işlemi
4. Oyun sonu ekranı
5. Skor tablosu

## 🎨 Grafik Materyaller
- ✅ Uygulama ikonu (SVG formatında)
- ⚠️ Feature graphic (1024x500) - Tasarlanacak
- ⚠️ Promo video (opsiyonel) - Hazırlanacak