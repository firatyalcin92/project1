import { copyText, postToNative } from './native'

/**
 * Paylaşım: Expo kabuğu -> Capacitor Share eklentisi -> Web Share API -> panoya kopyala.
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
  if (postToNative({ type: 'share', ...opts })) return 'shared'
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
  return (await copyText([opts.text, opts.url].filter(Boolean).join(' '))) ? 'copied' : 'failed'
}

export function inviteMessage(code: string, origin: string, inviter: string) {
  return {
    title: 'MESELE daveti',
    text: `${inviter} seni MESELE’ye davet ediyor: aramızdaki meseleye birlikte bakalım. Linke dokunman yeterli.`,
    url: `${origin}/katil?kod=${code}`,
  }
}
