import * as Clipboard from 'expo-clipboard'
import Constants from 'expo-constants'
import * as Haptics from 'expo-haptics'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, Text, View, useColorScheme } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'

/**
 * MESELE — Expo kabuğu.
 *
 * MESELE bir web uygulamasıdır (TanStack Start); AI ve veritabanı anahtarları
 * sunucuda kalır. Bu kabuk, uygulamayı iPhone/Android'de yerel bir uygulama
 * gibi açar:
 *
 *  - Geliştirmede (Expo Go): Expo'nun bağlandığı bilgisayarın IP adresini bulur
 *    ve MESELE'yi http://<o-IP>:3000 adresinden açar (bilgisayarda
 *    `npm run dev:lan` çalışıyor olmalı).
 *  - Yayında: EXPO_PUBLIC_MESELE_URL ile yayınlanmış https adresini açar.
 *
 * Web sayfası paylaşım/kopyalama için window.ReactNativeWebView.postMessage ile
 * buraya mesaj gönderir (src/lib/native.ts).
 */

const PALETTE = {
  light: {
    paper: '#fbf6ee',
    surface: '#fffdf9',
    ink: '#2a211c',
    soft: '#5b4d44',
    clay: '#b4553a',
    onClay: '#fffaf5',
    line: '#e7dbcc',
  },
  dark: {
    paper: '#191411',
    surface: '#221b17',
    ink: '#f4ebe1',
    soft: '#d2c3b5',
    clay: '#e38c6d',
    onClay: '#1d1210',
    line: '#3a2f28',
  },
}

const DEV_PORT = 3000

function resolveAppUrl(): { url: string | null; hint: string } {
  const configured = process.env.EXPO_PUBLIC_MESELE_URL?.trim()
  if (configured) return { url: configured.replace(/\/+$/, ''), hint: 'EXPO_PUBLIC_MESELE_URL' }

  // Expo Go'da hostUri, Metro sunucusunun adresidir: ör. "192.168.1.20:8081".
  const host = Constants.expoConfig?.hostUri?.split(':')[0]
  if (host && (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === 'localhost' || host.endsWith('.local'))) {
    return { url: `http://${host}:${DEV_PORT}`, hint: 'bilgisayarının yerel ağ adresi' }
  }
  return { url: null, hint: '' }
}

type BridgeMessage =
  | { type: 'copy'; text: string }
  | { type: 'share'; title?: string; text?: string; url?: string }
  | { type: 'haptic' }

export default function App() {
  const scheme = useColorScheme()
  const c = scheme === 'dark' ? PALETTE.dark : PALETTE.light
  const { url, hint } = useMemo(resolveAppUrl, [])
  const webview = useRef<WebView>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const origin = useMemo(() => (url ? new URL(url).origin : ''), [url])

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    let msg: BridgeMessage
    try {
      msg = JSON.parse(event.nativeEvent.data) as BridgeMessage
    } catch {
      return
    }
    if (msg.type === 'copy') {
      await Clipboard.setStringAsync(msg.text)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } else if (msg.type === 'share') {
      const message = [msg.text, msg.url].filter(Boolean).join('\n')
      await Share.share({ title: msg.title, message, url: msg.url })
    } else if (msg.type === 'haptic') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [])

  // MESELE dışındaki bağlantılar (tel:112, ALO 183, dış siteler) sistemde açılır.
  const onShouldStart = useCallback(
    (req: ShouldStartLoadRequest) => {
      if (req.url.startsWith(origin) || req.url === 'about:blank') return true
      void Linking.openURL(req.url).catch(() => {})
      return false
    },
    [origin],
  )

  const retry = () => {
    setError(null)
    setLoading(true)
    setAttempt((a) => a + 1)
  }

  if (!url) {
    return (
      <Screen c={c}>
        <Title c={c}>MESELE adresi bulunamadı</Title>
        <Body c={c}>
          Expo’yu tünel modunda başlattıysan, mobile/.env dosyasına EXPO_PUBLIC_MESELE_URL=https://… satırını ekle ya da
          “npx expo start” ile (tünelsiz) yeniden başlat.
        </Body>
      </Screen>
    )
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.paper }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {error ? (
        <Screen c={c}>
          <Title c={c}>MESELE’ye ulaşılamadı</Title>
          <Body c={c}>Denenen adres: {url}</Body>
          <View style={styles.list}>
            <Body c={c}>1. Bilgisayarda “npm run dev:lan” açık mı?</Body>
            <Body c={c}>2. Telefon ve bilgisayar aynı Wi-Fi ağında mı?</Body>
            <Body c={c}>3. Windows Güvenlik Duvarı Node.js’e “Özel ağlar” için izin verdi mi?</Body>
            <Body c={c}>4. Bilgisayarın tarayıcısında {url} açılıyor mu?</Body>
          </View>
          <Pressable onPress={retry} style={[styles.button, { backgroundColor: c.clay }]} accessibilityRole="button">
            <Text style={[styles.buttonText, { color: c.onClay }]}>Tekrar dene</Text>
          </Pressable>
          <Text style={[styles.small, { color: c.soft }]}>Adres kaynağı: {hint}</Text>
        </Screen>
      ) : (
        <WebView
          key={attempt}
          ref={webview}
          source={{ uri: url }}
          style={[styles.fill, { backgroundColor: c.paper }]}
          originWhitelist={['http://*', 'https://*', 'tel:*', 'mailto:*']}
          onShouldStartLoadWithRequest={onShouldStart}
          onMessage={onMessage}
          onLoadEnd={() => setLoading(false)}
          onError={(e) => setError(e.nativeEvent.description || 'Bağlantı hatası')}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500 && e.nativeEvent.url.startsWith(origin)) {
              setError(`Sunucu hatası (${e.nativeEvent.statusCode})`)
            }
          }}
          onContentProcessDidTerminate={() => webview.current?.reload()}
          applicationNameForUserAgent="MESELE-Expo/1.0"
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          setSupportMultipleWindows={false}
          webviewDebuggingEnabled={__DEV__}
        />
      )}
      {loading && !error ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.paper }]} pointerEvents="none">
          <Text style={[styles.word, { color: c.ink }]}>MESELE</Text>
          <Text style={[styles.small, { color: c.soft }]}>Bir tartışmayı anlamanın daha iyi bir yolu.</Text>
          <ActivityIndicator color={c.clay} style={{ marginTop: 24 }} />
        </View>
      ) : null}
    </View>
  )
}

type Colors = (typeof PALETTE)['light']

function Screen({ c, children }: { c: Colors; children: ReactNode }) {
  return <View style={[styles.fill, styles.center, styles.pad, { backgroundColor: c.paper }]}>{children}</View>
}
function Title({ c, children }: { c: Colors; children: ReactNode }) {
  return <Text style={[styles.title, { color: c.ink }]}>{children}</Text>
}
function Body({ c, children }: { c: Colors; children: ReactNode }) {
  return <Text style={[styles.body, { color: c.soft }]}>{children}</Text>
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: 28, gap: 12 },
  list: { alignSelf: 'stretch', gap: 6, marginTop: 4 },
  word: { fontSize: 30, fontWeight: '600', letterSpacing: 6 },
  title: { fontSize: 22, fontWeight: '600', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'left', alignSelf: 'stretch' },
  small: { fontSize: 13, marginTop: 8, textAlign: 'center' },
  button: {
    marginTop: 12,
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
})
