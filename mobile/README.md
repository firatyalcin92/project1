# MESELE — Expo kabuğu

MESELE bir web uygulamasıdır (TanStack Start). AI ve veritabanı anahtarları sunucuda kalmak zorunda olduğu için bu
Expo uygulaması MESELE'yi bir `WebView` içinde, yerel bir uygulama gibi açar:

- **Expo Go ile geliştirme:** Expo'nun bağlandığı bilgisayarın yerel IP adresini kendisi bulur ve
  `http://<o-IP>:3000` adresini açar. Bilgisayarda kök klasörde `npm run dev:lan` çalışıyor olmalı.
- **Yayın:** `mobile/.env` içine `EXPO_PUBLIC_MESELE_URL=https://…` yazılırsa o adresi açar.
- Paylaşım (yerel paylaşım sayfası), kopyalama, titreşim ve `tel:` bağlantıları (112, ALO 183) yerel tarafta çalışır;
  web sayfası bunları `window.ReactNativeWebView.postMessage` ile ister (`src/lib/native.ts`).

## Çalıştırma (Windows)

```powershell
# 1. pencere — kök klasörde
cd C:\MESELE
npm run dev:lan

# 2. pencere — bu klasörde
cd C:\MESELE\mobile
npm install        # bir kez
npx expo start     # QR kodu iPhone Kamera ile okut → Expo Go
```

Telefon ve bilgisayar **aynı Wi-Fi** ağında olmalı; Windows Güvenlik Duvarı Node.js'e **Özel ağlar** için izin
vermeli. Wi-Fi cihazları yalıtıyorsa telefonun kişisel erişim noktasını kullanın.

## Paket eklerken

Her zaman `npx expo install <paket>` kullanın; SDK 57 ile uyumlu sürümü seçer. Expo Go yalnızca kendi içindeki yerel
modülleri çalıştırır (`react-native-webview`, `expo-clipboard`, `expo-haptics`, `expo-constants` bunlardandır).

## App Store'a (Mac olmadan)

```powershell
npx eas-cli@latest login
npx eas-cli@latest build -p ios      # bulutta derler (Apple Developer hesabı gerekir)
npx eas-cli@latest submit -p ios     # App Store Connect'e gönderir
```

Bundle ID: `com.firatyalcin.mesele` (`app.json`). Yayından önce `EXPO_PUBLIC_MESELE_URL` mutlaka https bir adres
olmalı. App Store incelemesi (yönerge 4.2) salt web sarmalayıcılara karşı titizdir; yerel paylaşım, titreşim ve
ileride bildirimler gibi yerel özellikleri öne çıkarın.
