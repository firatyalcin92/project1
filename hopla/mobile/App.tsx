import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Linking, Platform, StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'
import GAME_HTML from './game/html'

/**
 * Hopla — iOS / Android kabuğu.
 *
 * Oyunun tamamı (three.js dahil) game/html.ts içinde uygulamaya gömülüdür: internet olmadan
 * açılır ve oynanır. Sunucu yalnızca sıralama için kullanılır (EXPO_PUBLIC_HOPLA_API).
 *
 * Köprü (hopla/web/src/native.ts):
 *  - Oyun → uygulama: {type:'store'} kayıtları AsyncStorage'a yazılır (iOS WebView depolamasını
 *    temizlese bile cihaz anahtarı ve rekor kaybolmaz), {type:'haptic'} yerel titreşim çalar.
 *  - Oyun → uygulama: {type:'push', ask} bildirim izni (ask: izin penceresi gösterilsin mi) ve
 *    Expo bildirim anahtarı istenir; anahtar window.hopla.pushToken(token|null) ile oyuna verilir.
 *  - Uygulama → oyun: kayıtlı değerler ve sunucu adresi sayfa yüklenmeden window.__HOPLA_NATIVE__
 *    ile verilir; uygulama arka plana geçince window.hopla.pause() çağrılır.
 */

const BG = '#f3efe8'
const BASE_URL = 'https://localhost/'
const PREFIX = 'hopla.'
const API = (process.env.EXPO_PUBLIC_HOPLA_API ?? 'https://mesele-0zvp.onrender.com').trim().replace(/\/+$/, '')
/** EAS proje kimliği (app.json → extra.eas.projectId ile aynı); bildirim anahtarı için gerekir */
const PROJECT_ID = '1de21188-23b7-4522-b498-3680fd473632'

// Uygulama açıkken gelen bildirim de üstte gösterilsin
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

/** Bildirim izni (ask ise izin penceresi gösterilir) ve Expo bildirim anahtarı; izin yoksa null */
async function pushToken(ask: boolean): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Hopdog',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }
  let { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status
  if (status !== 'granted') return null
  return (await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID })).data
}

type BridgeMessage =
  | { type: 'store'; key: string; value: string | null }
  | { type: 'haptic'; kind: 'light' | 'medium' | 'success' | 'heavy' }
  | { type: 'push'; ask?: boolean }

function haptic(kind: string) {
  if (kind === 'success') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  const style =
    kind === 'heavy'
      ? Haptics.ImpactFeedbackStyle.Heavy
      : kind === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
  return Haptics.impactAsync(style)
}

export default function App() {
  const [saved, setSaved] = useState<Record<string, string> | null>(null)
  const web = useRef<WebView>(null)

  // Kayıtlı değerleri yükle (oyun açılmadan önce)
  useEffect(() => {
    AsyncStorage.getAllKeys()
      .then((keys) => AsyncStorage.multiGet(keys.filter((k) => k.startsWith(PREFIX))))
      .then((pairs) => {
        const out: Record<string, string> = {}
        for (const [k, v] of pairs) if (v !== null) out[k.slice(PREFIX.length)] = v
        setSaved(out)
      })
      .catch(() => setSaved({}))
  }, [])

  // Arka plana geçince basılı tutma iptal edilir (zıplamadan bırakır)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') web.current?.injectJavaScript('window.hopla && window.hopla.pause(); true;')
    })
    return () => sub.remove()
  }, [])

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let msg: BridgeMessage
    try {
      msg = JSON.parse(event.nativeEvent.data) as BridgeMessage
    } catch {
      return
    }
    if (msg.type === 'store' && typeof msg.key === 'string' && /^[a-z]{1,32}$/.test(msg.key)) {
      if (msg.value === null) void AsyncStorage.removeItem(PREFIX + msg.key)
      else if (typeof msg.value === 'string' && msg.value.length < 512_000)
        void AsyncStorage.setItem(PREFIX + msg.key, msg.value)
    } else if (msg.type === 'haptic') {
      void haptic(msg.kind).catch(() => {})
    } else if (msg.type === 'push') {
      void pushToken(!!msg.ask)
        .catch(() => null)
        .then((token) =>
          web.current?.injectJavaScript(
            `window.hopla && window.hopla.pushToken && window.hopla.pushToken(${JSON.stringify(token)}); true;`,
          ),
        )
    }
  }, [])

  // Oyun dışına gezinme yok; dış bağlantılar sistem tarayıcısında açılır.
  const onShouldStart = useCallback((req: ShouldStartLoadRequest) => {
    if (req.url.startsWith(BASE_URL) || req.url === 'about:blank') return true
    if (/^https?:/.test(req.url)) void Linking.openURL(req.url).catch(() => {})
    return false
  }, [])

  if (!saved) return <View style={styles.fill} />

  const inject = `window.__HOPLA_NATIVE__ = ${JSON.stringify({ store: saved, platform: Platform.OS, api: API })}; true;`

  return (
    <View style={styles.fill}>
      <StatusBar style="dark" />
      <WebView
        ref={web}
        source={{ html: GAME_HTML, baseUrl: BASE_URL }}
        injectedJavaScriptBeforeContentLoaded={inject}
        originWhitelist={['*']}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStart}
        style={styles.fill}
        containerStyle={styles.fill}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        allowsBackForwardNavigationGestures={false}
        allowsLinkPreview={false}
        mediaPlaybackRequiresUserAction={false}
        androidLayerType="hardware"
        webviewDebuggingEnabled={__DEV__}
        onContentProcessDidTerminate={() => web.current?.reload()}
        onRenderProcessGone={() => web.current?.reload()}
        applicationNameForUserAgent="Hopla/0.1"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: BG },
})
