import { createFileRoute } from '@tanstack/react-router'
import { getRequestIP } from '@tanstack/react-start/server'
import { handleHopla } from '~/server/hopla/api.server'

/** Hopla oyununun sıralama API'si: /api/hopla/v1/... (ayrıntı: src/server/hopla/api.server.ts) */
function handle({ request }: { request: Request }) {
  let ip = 'unknown'
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? 'unknown'
  } catch {
    // istek bağlamı yoksa
  }
  return handleHopla(request, ip)
}

export const Route = createFileRoute('/api/hopla/$')({
  server: {
    handlers: { GET: handle, POST: handle, PATCH: handle, DELETE: handle, OPTIONS: handle },
  },
})
