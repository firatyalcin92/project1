import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { AppShell, PageTitle } from '~/components/layout'
import { Button, Card, Notice, TextField } from '~/components/ui'
import { adminStatsFn, createAccessCodesFn } from '~/functions/couple'
import { parseError } from '~/lib/errors'
import { formatDateTime } from '~/lib/turkish'

export const Route = createFileRoute('/yonetim')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Yönetim — MESELE' }, { name: 'robots', content: 'noindex' }] }),
  component: Admin,
})

type Stats = Awaited<ReturnType<typeof adminStatsFn>>

/** Test sürümünün sayaçları. Kişisel içerik (cevaplar, raporlar) gösterilmez. */
function Admin() {
  const [password, setPassword] = useState('')
  // Yenilerken son sonuç ekranda kalsın (üretilen kodlar kaybolmasın).
  const [data, setData] = useState<Stats | null>(null)
  const stats = useMutation({ mutationFn: () => adminStatsFn({ data: { password } }), onSuccess: setData })

  return (
    <AppShell back="/" title="Yönetim">
      {data ? (
        <StatsView
          s={data}
          password={password}
          onRefresh={() => stats.mutate()}
          refreshing={stats.isPending}
        />
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (password) stats.mutate()
          }}
        >
          <PageTitle title="Test sonuçları" lead="Yönetici şifresiyle girin." />
          <TextField label="Şifre" value={password} onChange={setPassword} autoComplete="current-password" />
          {stats.isError ? <Notice tone="error">{parseError(stats.error).message}</Notice> : null}
          <Button type="submit" full loading={stats.isPending} disabled={!password}>
            Göster
          </Button>
        </form>
      )}
    </AppShell>
  )
}

function Tile({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <Card className="space-y-1 p-4">
      <p className="text-[12px] font-semibold tracking-[0.12em] text-ink-faint uppercase">{label}</p>
      <p className="font-display text-[28px] leading-none font-semibold tabular-nums">{value}</p>
      {note ? <p className="text-[13px] text-ink-soft">{note}</p> : null}
    </Card>
  )
}

const pct = (n: number, of: number) => (of ? `%${Math.round((n / of) * 100)}` : '—')

function StatsView({
  s,
  password,
  onRefresh,
  refreshing,
}: {
  s: Stats
  password: string
  onRefresh: () => void
  refreshing: boolean
}) {
  const d = s.disputes
  const max = Math.max(1, ...s.days.map((x) => x.count))
  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-semibold">Test sonuçları</h1>
        <Button variant="secondary" size="sm" loading={refreshing} onClick={onRefresh}>
          Yenile
        </Button>
      </div>
      {s.beta.beta ? (
        <Notice tone="info">
          Test sürümü açık · günlük kontenjan {s.beta.limit} · bugün kalan {s.beta.remaining}
        </Notice>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <Tile label="Toplam mesele" value={d.total} note={`Bugün ${d.today}`} />
        <Tile label="Rapora ulaşan" value={d.completed} note={`${pct(d.completed, d.total)} tamamlandı`} />
        <Tile
          label="Partner katıldı"
          value={d.partnerJoined}
          note={`Çift meselelerinin ${pct(d.partnerJoined, d.couple)}`}
        />
        <Tile label="Tek kişilik" value={d.solo} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Anket ({s.survey.count} cevap)</h2>
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Ortalama puan" value={s.survey.count ? `${s.survey.avgRating} ★` : '—'} />
          <Tile label="Tekrar kullanır" value={s.survey.count ? `%${s.survey.againPercent}` : '—'} />
        </div>
        <Card className="space-y-2 p-4 text-sm">
          <p className="font-semibold">Arkadaşına önerir mi?</p>
          <p className="text-ink-soft">
            Evet {s.survey.recommend.evet} · Belki {s.survey.recommend.belki} · Hayır {s.survey.recommend.hayir}
          </p>
        </Card>
        {s.survey.latest.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {s.survey.latest.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-honey">{'★'.repeat(r.rating)}</span>
                <span className="text-ink-soft">
                  Tekrar: {r.again ? 'evet' : 'hayır'} · Öneri: {r.recommend}
                </span>
                <span className="text-[12px] text-ink-faint">{formatDateTime(r.at)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <CodeMaker password={password} onMade={onRefresh} />

      {s.codes.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Erişim kodları</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {s.codes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium">{c.label || 'Etiketsiz'}</span>
                <span className="shrink-0 text-ink-soft tabular-nums">
                  {c.usesLeft}/{c.usesTotal} hak · {c.redeemed ? 'kullanıldı' : 'bekliyor'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ücretli sürüm bekleme listesi ({s.waitlist.count})</h2>
        {s.waitlist.latest.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {s.waitlist.latest.map((w) => (
              <li key={w.email} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">{w.email}</span>
                <span className="shrink-0 text-[12px] text-ink-faint">{formatDateTime(w.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Henüz kimse yazılmadı.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Son 14 gün</h2>
        <div className="flex h-32 items-end gap-1" role="img" aria-label="Günlük açılan mesele sayısı">
          {s.days.map((x) => (
            <div key={x.day} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-ink-faint tabular-nums">{x.count || ''}</span>
              <div className="w-full rounded-t bg-clay/70" style={{ height: `${(x.count / max) * 90}px` }} />
            </div>
          ))}
        </div>
        <p className="text-[12px] text-ink-faint">
          {s.days[0]?.day} → {s.days[s.days.length - 1]?.day}
        </p>
      </section>
    </div>
  )
}

/** Erişim kodu üretimi: ham kod yalnızca burada, bir kez görünür. */
function CodeMaker({ password, onMade }: { password: string; onMade: () => void }) {
  const [label, setLabel] = useState('')
  const [uses, setUses] = useState('10')
  const [count, setCount] = useState('1')
  const [copied, setCopied] = useState(false)
  const make = useMutation({
    mutationFn: () =>
      createAccessCodesFn({ data: { password, label, uses: Number(uses), count: Number(count) } }),
    onSuccess: () => {
      setCopied(false)
      onMade()
    },
  })
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Erişim kodu oluştur</h2>
      <Card className="space-y-3 p-4">
        <TextField label="Kimin için? (yalnızca sizin göreceğiniz not)" value={label} onChange={setLabel} maxLength={80} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Mesele hakkı" value={uses} onChange={(v) => setUses(v.replace(/\D/g, ''))} inputMode="numeric" />
          <TextField label="Kaç kod?" value={count} onChange={(v) => setCount(v.replace(/\D/g, ''))} inputMode="numeric" />
        </div>
        {make.isError ? <Notice tone="error">{parseError(make.error).message}</Notice> : null}
        <Button full loading={make.isPending} disabled={!Number(uses) || !Number(count)} onClick={() => make.mutate()}>
          Kod oluştur
        </Button>
        {make.data ? (
          <div className="space-y-2 rounded-2xl bg-sage-soft p-3">
            <p className="text-[13px] text-ink-soft">
              Her kod {make.data.uses} mesele açtırır ve ilk kullanan çifte bağlanır. Kodları şimdi kopyalayın;
              güvenlik için bir daha gösterilmez.
            </p>
            <pre className="font-mono text-[15px] leading-relaxed whitespace-pre-wrap text-ink select-all">
              {make.data.codes.join('\n')}
            </pre>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await navigator.clipboard?.writeText(make.data!.codes.join('\n')).catch(() => {})
                setCopied(true)
              }}
            >
              {copied ? 'Kopyalandı' : 'Kopyala'}
            </Button>
          </div>
        ) : null}
      </Card>
    </section>
  )
}
