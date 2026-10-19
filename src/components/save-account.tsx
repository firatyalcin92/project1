import { useState } from 'react'
import { IconCheck } from './icons'
import { SignInOptions } from './sign-in'
import { Card } from './ui'

/** "Raporlarınızı kaybetmemek için hesabınızı kaydedin" — Apple / Google / e-posta. */
export function SaveAccountCard({ lead }: { lead?: string }) {
  const [done, setDone] = useState(false)
  if (done) {
    return (
      <Card className="flex items-center gap-2 text-sm font-semibold text-sage">
        <IconCheck size={18} /> Hesabınız kaydedildi.
      </Card>
    )
  }
  return (
    <Card className="animate-rise space-y-4">
      <div>
        <p className="font-semibold">Raporlarınızı kaybetmeyin</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          {lead ?? 'Hesabınızı kaydedin; telefonunuz değişse de meseleleriniz ve raporlarınız sizinle gelir.'}
        </p>
      </div>
      <SignInOptions onLinked={() => setDone(true)} />
    </Card>
  )
}
