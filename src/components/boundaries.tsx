import { useNavigate, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { parseError } from '~/lib/errors'
import { clearMember } from '~/lib/member-token'
import { AppShell } from './layout'
import { Button, LinkButton, Notice } from './ui'

export function DefaultCatchBoundary({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const { code, message } = parseError(error)
  if (code === 'UNAUTHORIZED') return <UnknownDevice />
  return (
    <AppShell>
      <div className="space-y-5 py-10 text-center">
        <h1 className="text-2xl font-semibold">Bir şeyler ters gitti</h1>
        <p className="text-ink-soft">{message}</p>
        <div className="flex justify-center gap-3">
          <Button
            onClick={() => {
              reset()
              void router.invalidate()
            }}
          >
            Tekrar dene
          </Button>
          <LinkButton to="/" variant="secondary">
            Ana sayfa
          </LinkButton>
        </div>
      </div>
    </AppShell>
  )
}

export function NotFound() {
  return (
    <AppShell>
      <div className="space-y-5 py-12 text-center">
        <p className="font-display text-5xl text-clay">404</p>
        <h1 className="text-2xl font-semibold">Bu sayfa burada değil</h1>
        <p className="text-ink-soft">Belki bağlantı eskidi. Seni panele götürelim.</p>
        <LinkButton to="/panel">Panele dön</LinkButton>
      </div>
    </AppShell>
  )
}

/** Cihazdaki anahtar sunucuda tanınmadığında. */
export function UnknownDevice() {
  return (
    <AppShell>
      <UnknownDeviceContent />
    </AppShell>
  )
}

function UnknownDeviceContent() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5 py-10">
      <h1 className="text-2xl font-semibold">Bu cihaz tanınmadı</h1>
      <Notice tone="warn">
        Bu cihazdaki anahtar artık geçerli görünmüyor. Yedeklediğin bir cihaz anahtarın varsa onunla geri dönebilir ya
        da yeniden başlayabilirsin.
      </Notice>
      <div className="flex flex-col gap-3">
        <LinkButton to="/katil" search={{ mod: 'anahtar' }} full>
          Cihaz anahtarımla dön
        </LinkButton>
        <Button
          variant="secondary"
          full
          onClick={() => {
            clearMember()
            void navigate({ to: '/' })
          }}
        >
          Bu cihazda yeniden başla
        </Button>
      </div>
    </div>
  )
}

export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { code, message } = parseError(error)
  if (code === 'UNAUTHORIZED') return <UnknownDeviceContent />
  return (
    <div className="space-y-3 py-6">
      <Notice tone="error" title="Yüklenemedi">
        {message}
      </Notice>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Tekrar dene
        </Button>
      ) : null}
    </div>
  )
}
