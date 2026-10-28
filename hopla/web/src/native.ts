/**
 * Yerel kabuk köprüsü (hopla/mobile Expo uygulaması). Tarayıcıda hiçbir şey yapmaz.
 * Kabuk, kayıtlı değerleri sayfa yüklenmeden önce window.__HOPLA_NATIVE__ ile verir;
 * oyun değişiklikleri postMessage ile geri yollar (iOS WebView depolamasını temizlese bile
 * cihaz anahtarı ve rekor kaybolmaz).
 */

interface NativeBridge {
  postMessage(data: string): void
}

declare global {
  interface Window {
    ReactNativeWebView?: NativeBridge
    /** Uygulama kabuğunun sayfa yüklenmeden önce verdiği değerler (kayıtlı veriler, sunucu adresi) */
    __HOPLA_NATIVE__?: { store?: Record<string, string>; platform?: string; api?: string }
  }
}

export const isNative = typeof window !== 'undefined' && !!window.ReactNativeWebView

export function postNative(msg: Record<string, unknown>) {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(msg))
  } catch {
    // köprü yoksa sessizce geç
  }
}

const PREFIX = 'hopla.v1.'

export const storage = {
  get(key: string): string | null {
    try {
      const v = localStorage.getItem(PREFIX + key)
      if (v !== null) return v
    } catch {
      // gizli sekme vb.
    }
    return window.__HOPLA_NATIVE__?.store?.[key] ?? null
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(PREFIX + key)
      else localStorage.setItem(PREFIX + key, value)
    } catch {
      // depolama yoksa oyun yine çalışır
    }
    if (isNative) postNative({ type: 'store', key, value })
  },
  json<T>(key: string): T | null {
    const raw = storage.get(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  },
}

/** Kısa titreşim: Android tarayıcıda navigator.vibrate, uygulamada yerel haptik. */
export function haptic(kind: 'light' | 'medium' | 'success' | 'heavy') {
  if (isNative) {
    postNative({ type: 'haptic', kind })
    return
  }
  try {
    const ms = kind === 'light' ? 8 : kind === 'medium' ? 14 : kind === 'success' ? [10, 40, 16] : 30
    navigator.vibrate?.(ms)
  } catch {
    // desteklenmiyor (iOS Safari)
  }
}
