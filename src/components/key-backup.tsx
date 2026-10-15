import { useState } from 'react'
import { markBackedUp, useBackedUp } from '~/lib/backup'
import { useMember } from '~/lib/hooks'
import { readMember } from '~/lib/member-token'
import { shareOrCopy } from '~/lib/share'
import { IconCheck, IconKey, IconShare } from './icons'
import { Button, CopyButton, Notice } from './ui'

/** Anahtar kaybolursa ne olur? Herkesin anlayacağı dille. */
export function KeyFacts({ solo }: { solo: boolean }) {
  return (
    <ul className="space-y-2 text-[14px] leading-relaxed text-ink-soft">
      <li>
        <span className="font-semibold text-ink">Şifre yok, e-posta yok.</span> Bu telefona size özel, gizli bir anahtar
        kaydedildi. Uygulamayı her açtığınızda kendiliğinden girersiniz.
      </li>
      <li>
        <span className="font-semibold text-ink">Ne zaman kaybolur?</span> Telefonu değiştirirseniz, uygulamayı ya da
        ana ekran simgesini silerseniz, tarayıcı verilerini temizlerseniz.
      </li>
      <li>
        <span className="font-semibold text-ink">Yedeğiniz varsa:</span> “Cihaz anahtarımla geri dön” deyip anahtarı
        yapıştırırsınız; tüm meseleleriniz ve raporlarınız geri gelir.
      </li>
      <li>
        <span className="font-semibold text-ink">Yedeğiniz yoksa:</span>{' '}
        {solo
          ? 'tek başınıza kullanırken geri dönmenin başka yolu yoktur; kayıtlarınıza bir daha ulaşamazsınız.'
          : 'partneriniz kendi Hesap sayfasından size bir “yeniden bağlanma kodu” üretebilir; güvenlik için kod 12 saat sonra çalışır. İkinizin de anahtarı kaybolursa kayıtlara ulaşılamaz.'}
      </li>
    </ul>
  )
}

/**
 * Oturum açıldıktan sonra ve hesap sayfasında: anahtarı göster, kopyala / paylaş
 * (Notlar, parola yöneticisi, kendine mesaj), "kaydettim" onayı.
 */
export function KeyBackup({ solo, onDone }: { solo: boolean; onDone?: () => void }) {
  const [skipAsk, setSkipAsk] = useState(false)
  const member = useMember()
  const backedUp = useBackedUp()
  const token = member?.token ?? readMember()?.token ?? ''
  const [saved, setSaved] = useState(backedUp)
  const [note, setNote] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl border border-line bg-sunken p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <IconKey size={16} /> Cihaz anahtarınız
        </p>
        <code className="block rounded-xl bg-surface px-3 py-2 font-mono text-[13px] break-all text-ink">{token}</code>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={token} label="Anahtarı kopyala" />
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              const r = await shareOrCopy({
                title: 'MESELE cihaz anahtarım',
                text: `MESELE cihaz anahtarım (kimseyle paylaşma): ${token}`,
              })
              setNote(r === 'shared' ? 'Paylaşım ekranı açıldı.' : r === 'copied' ? 'Panoya kopyalandı.' : null)
            }}
          >
            <IconShare size={16} /> Notlara / parola yöneticisine kaydet
          </Button>
        </div>
        {note ? <p className="text-[13px] text-sage">{note}</p> : null}
      </div>

      <KeyFacts solo={solo} />

      <Notice tone="warn">
        Bu anahtarı partneriniz dâhil kimseyle paylaşmayın; anahtarı bilen kişi sizin yerinize yanıt verebilir.
      </Notice>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line-strong bg-surface p-4">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-[var(--color-clay)]"
          checked={saved}
          onChange={(e) => {
            setSaved(e.target.checked)
            if (e.target.checked) markBackedUp()
          }}
        />
        <span className="text-[15px] leading-snug text-ink">Anahtarımı güvenli bir yere kaydettim</span>
      </label>

      {onDone ? (
        <div className="space-y-2">
          <Button full size="lg" disabled={!saved} onClick={onDone}>
            {saved ? (
              <>
                <IconCheck size={18} /> Devam
              </>
            ) : (
              'Önce anahtarı kaydedin'
            )}
          </Button>
          {saved ? null : skipAsk ? (
            <div className="space-y-2 rounded-2xl bg-sunken p-3 text-center text-[13px] text-ink-soft">
              <p>Yedek olmadan telefon değişirse kayıtlarınıza ulaşamayabilirsiniz. Panelde size hatırlatacağız.</p>
              <Button variant="quiet" size="sm" onClick={onDone}>
                Yine de şimdilik geç
              </Button>
            </div>
          ) : (
            <Button variant="quiet" size="sm" full onClick={() => setSkipAsk(true)}>
              Daha sonra yapacağım
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
