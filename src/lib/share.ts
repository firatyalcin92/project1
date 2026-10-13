/**
 * Paylaşım: Capacitor Share eklentisi (yerel uygulama) -> Web Share API -> panoya kopyala.
 */
type SharePlugin = {
  share(opts: { title?: string; text?: string; url?: string; dialogTitle?: string }): Promise<unknown>
}

export async function shareOrCopy(opts: {
  title: string
  text: string
  url?: string
}): Promise<'shared' | 'copied' | 'failed'> {
  const cap = (
    window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> } }
  ).Capacitor
  const native = cap?.isNativePlatform?.() ? (cap.Plugins?.Share as SharePlugin | undefined) : undefined
  try {
    if (native) {
      await native.share({ ...opts, dialogTitle: opts.title })
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share(opts)
      return 'shared'
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return 'failed'
  }
  try {
    await navigator.clipboard.writeText([opts.text, opts.url].filter(Boolean).join(' '))
    return 'copied'
  } catch {
    return 'failed'
  }
}

export function inviteMessage(code: string, origin: string, inviter: string) {
  return {
    title: 'MESELE daveti',
    text: `${inviter} seni MESELE'ye davet ediyor. Bir tartışmayı birlikte, daha iyi anlamak için. Çift kodumuz: ${code}`,
    url: `${origin}/katil?kod=${code}`,
  }
}
