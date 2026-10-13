import { useMutation } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { approveSharedReportFn } from '~/functions/dispute'
import { parseError } from '~/lib/errors'
import type { MyReport, SharedReport } from '~/lib/report-schemas'
import { genitive, withName } from '~/lib/turkish'
import type { DisputeView, Role } from '~/lib/views'
import { IconArrowRight, IconCheck, IconHeart, IconLock, IconLoop, IconSparkle, IconUnlock } from '../icons'
import { SafetyNote } from '../safety'
import { Button, Card, CopyButton, Eyebrow, Notice, Paragraphs, cx } from '../ui'

const partnerColor = (r: Role) => (r === 'A' ? 'var(--color-partner-a)' : 'var(--color-partner-b)')

function SectionTitle({ eyebrow, title, icon }: { eyebrow?: string; title: string; icon?: ReactNode }) {
  return (
    <div className="space-y-1">
      {eyebrow ? (
        <Eyebrow className="flex items-center gap-1.5">
          {icon}
          {eyebrow}
        </Eyebrow>
      ) : null}
      <h3 className="text-[22px] leading-snug font-semibold">{title}</h3>
    </div>
  )
}

function Phrase({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-sunken px-4 py-3">
      <p className="font-display text-[17px] italic leading-relaxed text-ink">“{text}”</p>
      <div className="mt-1 flex justify-end">
        <CopyButton text={text} label="Cümleyi kopyala" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kişisel rapor — Sana Özel Ayna
// ---------------------------------------------------------------------------

export function MyReportView({ report, partnerName }: { report: MyReport; partnerName: string }) {
  return (
    <Card as="article" className="animate-rise space-y-6">
      <div className="space-y-2">
        <Eyebrow className="flex items-center gap-1.5">
          <IconLock size={14} /> Sana Özel Ayna · yalnızca sen görüyorsun
        </Eyebrow>
        <p className="text-[18px] leading-relaxed text-ink">{report.greeting}</p>
      </div>

      <section className="space-y-3 rounded-2xl bg-partner-b-soft/70 p-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Ayna</p>
        {report.mirror.partnerWords ? (
          <p className="font-display text-xl italic text-ink">“{report.mirror.partnerWords}”</p>
        ) : null}
        <p className="leading-relaxed text-ink">{report.mirror.meaning}</p>
      </section>

      <section className="space-y-2">
        <SectionTitle title="Döngüdeki yerin" />
        <Paragraphs text={report.yourPlace} className="text-ink-soft" />
      </section>

      <section className="space-y-3">
        <SectionTitle title="İletişim kör noktaların" />
        <ul className="space-y-3">
          {report.blindSpots.map((b) => (
            <li key={b.title} className="rounded-2xl border border-line p-4">
              <p className="font-semibold">{b.title}</p>
              <p className="mt-1 leading-relaxed text-ink-soft">{b.insight}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex gap-3 rounded-2xl bg-sage-soft p-4">
        <IconSparkle size={20} className="mt-0.5 shrink-0 text-sage" />
        <div>
          <p className="font-semibold">Güçlü yanın</p>
          <p className="mt-1 leading-relaxed text-ink">{report.strength}</p>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle title="Sana özel onarım önerisi" />
        <p className="leading-relaxed text-ink-soft">{report.repair.suggestion}</p>
        <p className="text-sm font-medium text-ink">
          {partnerName ? withName(partnerName) : 'Partnerinle'} paylaşabileceğin bir cümle:
        </p>
        <Phrase text={report.repair.phrase} />
      </section>

      <p className="border-t border-line pt-4 text-center font-display text-[17px] italic text-ink-soft">
        {report.selfCompassion}
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Ortak rapor kapısı — iki onay
// ---------------------------------------------------------------------------

export function SharedGate({ view, onView }: { view: DisputeView; onView: (v: DisputeView) => void }) {
  const shared = view.report!.shared
  const partner = view.partner?.name ?? 'Partnerin'
  const approve = useMutation({
    mutationFn: () => approveSharedReportFn({ data: { disputeId: view.id } }),
    onSuccess: onView,
  })

  return (
    <Card className="animate-rise space-y-4 border-honey/40 bg-honey-soft/50 text-center">
      <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-surface text-honey shadow-soft">
        <IconLock size={26} />
      </span>
      <h3 className="text-[22px] font-semibold">Ortak raporunuz hazır</h3>
      <p className="mx-auto max-w-sm leading-relaxed text-ink-soft">
        Döngü analiziniz ve ihtiyaç aynanız, ikiniz de “hazırım” dediğinizde açılır. Önce kendi aynanı okumanı öneririz;
        sonra mümkünse yan yana oturup birlikte açın.
      </p>
      <ul className="mx-auto flex max-w-xs flex-col gap-2 text-left text-sm">
        <ApprovalRow label="Sen" done={shared.approvedByMe} />
        <ApprovalRow label={partner} done={shared.approvedByPartner} />
      </ul>
      {approve.isError ? <Notice tone="error">{parseError(approve.error).message}</Notice> : null}
      {shared.approvedByMe ? (
        <p className="flex items-center justify-center gap-2 text-sm text-ink-soft">
          <span className="inline-block size-2 animate-breathe rounded-full bg-honey" aria-hidden />
          {genitive(partner)} hazır olmasını bekliyoruz.
        </p>
      ) : (
        <Button full size="lg" loading={approve.isPending} onClick={() => approve.mutate()}>
          <IconUnlock size={18} /> Hazırım, ortak raporu aç
        </Button>
      )}
    </Card>
  )
}

function ApprovalRow({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center justify-between rounded-xl bg-surface px-3 py-2">
      <span className="font-medium text-ink">{label}</span>
      <span className={cx('inline-flex items-center gap-1 text-[13px]', done ? 'text-sage' : 'text-ink-faint')}>
        {done ? (
          <>
            <IconCheck size={14} /> Hazır
          </>
        ) : (
          'Bekleniyor'
        )}
      </span>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Ortak rapor — Döngü Analizi ve İhtiyaç Aynası
// ---------------------------------------------------------------------------

/** Döngü: A ve B'nin adımları dikey akışta, son adımdan ilk adıma geri dönüş. */
export function CycleLoop({ steps, names }: { steps: SharedReport['cycle']['steps']; names: Record<Role, string> }) {
  return (
    <div className="relative">
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="relative">
            <div className="rounded-2xl border border-line bg-surface p-3.5 shadow-soft">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: partnerColor(s.partner) }}
                  aria-hidden
                />
                {names[s.partner]}
              </p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px] leading-snug">
                <dt className="text-ink-faint">Tetikleyen</dt>
                <dd className="text-ink">{s.trigger}</dd>
                <dt className="text-ink-faint">İçeride</dt>
                <dd className="font-medium text-ink">{s.feeling}</dd>
                <dt className="text-ink-faint">Dışarıda</dt>
                <dd className="text-ink">{s.reaction}</dd>
              </dl>
            </div>
            {i < steps.length - 1 ? (
              <div className="flex justify-center py-0.5 text-ink-faint" aria-hidden>
                ↓
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-3 flex items-center justify-center gap-2 text-[13px] font-medium text-clay-strong">
        <IconLoop size={18} /> …ve döngü yeniden başlar
      </p>
    </div>
  )
}

export function SharedReportView({ report, view }: { report: SharedReport; view: DisputeView }) {
  const names = {
    A: view.me.role === 'A' ? view.me.name : (view.partner?.name ?? 'A'),
    B: view.me.role === 'B' ? view.me.name : (view.partner?.name ?? 'B'),
  } as Record<Role, string>
  const myLine =
    view.myReconsideration.items.tek_cumle?.visibility === 'partner' ? view.myReconsideration.items.tek_cumle.text : ''
  const partnerLine = view.partnerReflections?.tek_cumle ?? ''

  return (
    <article className="animate-rise space-y-5">
      <SafetyNote safety={report.safety} />

      <Card className="space-y-3">
        <Eyebrow className="flex items-center gap-1.5">
          <IconUnlock size={14} /> Ortak Rapor · Döngü Analizi ve İhtiyaç Aynası
        </Eyebrow>
        <Paragraphs text={report.opening} className="text-[17px] text-ink" />
      </Card>

      {myLine || partnerLine ? (
        <Card className="space-y-3">
          <SectionTitle title="Birbirinize söylemek istedikleriniz" />
          {partnerLine && view.partner ? (
            <div className="rounded-2xl bg-sunken px-4 py-3">
              <p className="text-[13px] text-ink-faint">{view.partner.name}</p>
              <p className="font-display text-[17px] italic text-ink">“{partnerLine}”</p>
            </div>
          ) : null}
          {myLine ? (
            <div className="rounded-2xl bg-sunken px-4 py-3">
              <p className="text-[13px] text-ink-faint">Sen</p>
              <p className="font-display text-[17px] italic text-ink">“{myLine}”</p>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="space-y-4">
        <SectionTitle eyebrow="Ortak döngünüz" title={report.cycle.name} icon={<IconLoop size={14} />} />
        <p className="rounded-2xl bg-clay-soft/60 px-4 py-3 font-display text-[18px] leading-relaxed text-ink">
          {report.cycle.summary}
        </p>
        <CycleLoop steps={report.cycle.steps} names={names} />
        <p className="leading-relaxed text-ink-soft">{report.cycle.enemy}</p>
      </Card>

      <Card className="space-y-4">
        <SectionTitle eyebrow="Kim haklı?" title="Dürüst bir cevap" />
        <Paragraphs text={report.whoIsRight.answer} className="text-ink" />
        <div className="grid gap-3">
          {(['A', 'B'] as const).map((r) => (
            <div key={r} className="rounded-2xl border border-line p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: partnerColor(r) }}
                  aria-hidden
                />
                {names[r]} haklı, çünkü…
              </p>
              <p className="mt-1.5 leading-relaxed text-ink-soft">
                {r === 'A' ? report.whoIsRight.pointA : report.whoIsRight.pointB}
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-honey-soft px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Asıl mesele</p>
          <p className="mt-1 leading-relaxed text-ink">{report.whoIsRight.realIssue}</p>
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionTitle eyebrow="Temel ihtiyaç kesişimi" title="Aslında ikiniz de…" icon={<IconHeart size={14} />} />
        <div className="grid gap-3 sm:grid-cols-2">
          {(['A', 'B'] as const).map((r) => (
            <div key={r} className={cx('rounded-2xl p-4', r === 'A' ? 'bg-partner-a-soft' : 'bg-partner-b-soft')}>
              <p className="text-sm font-semibold text-ink">{names[r]}</p>
              <p className="mt-1 leading-relaxed text-ink">{r === 'A' ? report.needs.a : report.needs.b}</p>
            </div>
          ))}
        </div>
        <p className="text-center font-display text-[18px] leading-relaxed text-ink">{report.needs.commonGround}</p>
      </Card>

      <Card className="space-y-4">
        <SectionTitle eyebrow="Ortak çözüm ve onarım adımları" title="Döngü bir dahaki sefere başladığında" />
        <ol className="space-y-4">
          {report.repairSteps.slice(0, 3).map((s, i) => (
            <li key={i} className="space-y-2">
              <p className="flex items-center gap-2 font-semibold">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-clay font-display text-sm text-on-clay">
                  {i + 1}
                </span>
                {s.title}
              </p>
              <p className="text-sm text-ink-faint">{s.when}</p>
              <Phrase text={s.phrase} />
              <p className="text-[14px] leading-relaxed text-ink-soft">{s.why}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="space-y-2 border-sage/40 bg-sage-soft">
        <p className="flex items-center gap-2 font-semibold">
          <IconArrowRight size={18} className="text-sage" /> Bugün için
        </p>
        <p className="leading-relaxed text-ink">{report.tonight}</p>
      </Card>

      <p className="px-2 text-center font-display text-[18px] italic leading-relaxed text-ink-soft">{report.closing}</p>
    </article>
  )
}
