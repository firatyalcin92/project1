/**
 * Yerel kabuklarla köprü.
 *
 * - Expo (react-native-webview): window.ReactNativeWebView.postMessage
 * - Capacitor: window.Capacitor.Plugins
 *
 * Yerel LAN adresinden (http://192.168…) açılan sayfalar "güvenli bağlam" değildir;
 * orada navigator.clipboard yoktur. Bu yüzden kopyalama yerel köprüye ya da eski
 * yönteme düşer.
 */

type ReactNativeWebView = { postMessage(message: string): void }

export function reactNativeBridge(): ReactNativeWebView | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { ReactNativeWebView?: ReactNativeWebView }).ReactNativeWebView ?? null
}

export type NativeMessage =
  | { type: 'copy'; text: string }
  | { type: 'share'; title: string; text: string; url?: string }
  | { type: 'haptic' }

export function postToNative(message: NativeMessage): boolean {
  const bridge = reactNativeBridge()
  if (!bridge) return false
  bridge.postMessage(JSON.stringify(message))
  return true
}

export async function copyText(text: string): Promise<boolean> {
  if (postToNative({ type: 'copy', text })) return true
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // eski yönteme düş
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    el.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  } catch {
    return false
  }
}
