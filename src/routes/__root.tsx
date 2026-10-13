/// <reference types="vite/client" />
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { SLOGAN } from '~/components/brand'
import { DefaultCatchBoundary, NotFound } from '~/components/boundaries'
import { restoreFromNative } from '~/lib/member-token'
import appCss from '~/styles.css?url'

const DESCRIPTION =
  'MESELE, çiftlerin tartışmalarındaki döngüyü sıcak ve şefkatli bir aynayla görmesini sağlayan, yapay zekâ destekli bir anlama ve onarım rehberidir. Psk. Dan. Fırat YALÇIN tarafından tasarlandı.'

/** iOS ana ekran açılış görselleri (cihaz CSS boyutu × piksel oranı). */
const SPLASH: { w: number; h: number; r: number }[] = [
  { w: 440, h: 956, r: 3 },
  { w: 402, h: 874, r: 3 },
  { w: 430, h: 932, r: 3 },
  { w: 393, h: 852, r: 3 },
  { w: 428, h: 926, r: 3 },
  { w: 390, h: 844, r: 3 },
  { w: 375, h: 812, r: 3 },
  { w: 414, h: 896, r: 2 },
  { w: 375, h: 667, r: 2 },
  { w: 820, h: 1180, r: 2 },
  { w: 1024, h: 1366, r: 2 },
]

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: `MESELE — ${SLOGAN}` },
      { name: 'description', content: DESCRIPTION },
      { name: 'application-name', content: 'MESELE' },
      { name: 'theme-color', content: '#fbf6ee', media: '(prefers-color-scheme: light)' },
      { name: 'theme-color', content: '#191411', media: '(prefers-color-scheme: dark)' },
      { name: 'color-scheme', content: 'light dark' },
      // iOS / Safari / Capacitor
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'MESELE' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'format-detection', content: 'telephone=no, email=no, address=no' },
      // Paylaşım önizlemesi
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'tr_TR' },
      { property: 'og:title', content: 'MESELE' },
      { property: 'og:description', content: SLOGAN },
      { property: 'og:image', content: '/icons/og-image.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'robots', content: 'index, follow' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/icons/icon-32.png', type: 'image/png', sizes: '32x32' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png', sizes: '180x180' },
      ...SPLASH.map(({ w, h, r }) => ({
        rel: 'apple-touch-startup-image',
        href: `/splash/splash-${w * r}x${h * r}.png`,
        media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
      })),
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: NotFound,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()

  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true'
    // iOS WebView depolamayı temizlediyse cihaz anahtarını yerel yedekten geri getir.
    void restoreFromNative()
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" dir="ltr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
