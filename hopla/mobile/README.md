# Hopla — iOS / Android uygulaması (Expo)

Oyunun tamamı `game/html.ts` içinde uygulamaya **gömülüdür**: uygulama internet olmadan açılır ve oynanır.
Sunucu yalnızca sıralama (isim, skor) için kullanılır. Mac gerekmez: geliştirme Expo Go ile, mağaza derlemesi
EAS ile bulutta yapılır.

## Telefonda dene (Windows + iPhone/Android, Expo Go)

```powershell
cd C:\MESELE\hopla\mobile
npm install          # bir kez
npx expo start       # QR kodu iPhone Kamera (ya da Android'de Expo Go) ile okut
```

Bilgisayar ve telefon aynı Wi-Fi'de olmalı; olmuyorsa `npx expo start --tunnel`. Expo Go'yu App Store / Play
Store'dan güncel tutun (SDK 57).

## Oyunda değişiklik yaptıysan

Oyun kodu `hopla/web` ve `hopla/core` klasörlerindedir. Değişiklikten sonra kök klasörde:

```powershell
npm run hopla:native   # game/html.ts dosyasını yeniden üretir (depoya eklenmeli)
```

## Sıralama sunucusu

Varsayılan: `https://mesele-0zvp.onrender.com`. Başka bir adres için bu klasörde `.env` dosyası:

```
EXPO_PUBLIC_HOPLA_API=https://ornek-alan-adi.com
```

## Mağazaya (EAS, Mac gerekmez)

```powershell
npx eas-cli@latest login
npx eas-cli@latest build -p ios --profile production       # Apple Developer hesabı gerekir
npx eas-cli@latest submit -p ios --profile production
npx eas-cli@latest build -p android --profile production   # Google Play Console hesabı gerekir
npx eas-cli@latest build -p android --profile preview      # telefona doğrudan kurulabilen .apk
```

Paket kimlikleri: `com.firatyalcin.hopdog` (`app.json`).
