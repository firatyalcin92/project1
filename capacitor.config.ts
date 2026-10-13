import type { CapacitorConfig } from '@capacitor/cli'

/**
 * MESELE — iOS (önce) ve Android için Capacitor kabuğu.
 *
 * MESELE tam yığın bir TanStack Start uygulamasıdır: sunucu fonksiyonları
 * (AI, Supabase service role) sunucuda çalışmak zorundadır. Bu yüzden yerel
 * uygulama, yayınlanmış web uygulamasını (MESELE_APP_URL) WebView içinde açar.
 * Böylece istekler aynı kökenden gider, CSRF korumasıyla uyumludur ve tüm
 * gizli anahtarlar sunucuda kalır.
 *
 *   MESELE_APP_URL=https://mesele.example.com npx cap sync ios
 *
 * capacitor-shell/ yalnızca bağlantı yokken gösterilen yedek sayfadır.
 * Cihaz anahtarı ayrıca @capacitor/preferences ile yerelde yedeklenir
 * (src/lib/member-token.ts).
 */
const appUrl = process.env.MESELE_APP_URL

const config: CapacitorConfig = {
  appId: 'com.firatyalcin.mesele',
  appName: 'MESELE',
  webDir: 'capacitor-shell',
  backgroundColor: '#fbf6ee',
  server: appUrl
    ? {
        url: appUrl,
        cleartext: false,
        allowNavigation: [new URL(appUrl).host],
        errorPath: 'index.html',
      }
    : undefined,
  ios: {
    contentInset: 'never',
    backgroundColor: '#fbf6ee',
    preferredContentMode: 'mobile',
    scheme: 'MESELE',
  },
  android: {
    backgroundColor: '#fbf6ee',
  },
}

export default config
