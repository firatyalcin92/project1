import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

/**
 * Sunucu fonksiyonlarına yalnızca kendi kökenimizden gelen istekleri kabul et.
 * Sayfa gezintileri (ör. WhatsApp'tan açılan bir bağlantı) etkilenmez; filtre
 * yalnızca /_serverFn uçlarını denetler. Capacitor kabuğu uygulamayı uzak
 * URL'den yüklediği için köken aynı kalır.
 */
export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: ({ request }) => new URL(request.url).pathname.startsWith('/_serverFn'),
    }),
  ],
}))
