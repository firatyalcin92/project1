import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { QueryError } from '~/components/boundaries'
import { AnswerWizard, answerBody } from '~/components/dispute/answer-wizard'
import { MyPerspectiveDisclosure, PerspectiveCard } from '~/components/dispute/perspective'
import { ReconsiderForm } from '~/components/dispute/reconsider-form'
import { MyReportView, SharedGate, SharedReportView } from '~/components/dispute/resolution'
import { useDispute } from '~/components/dispute/use-dispute'
import { Generating, WaitingForPartner } from '~/components/dispute/waiting'
import { ReadinessCard, readinessFromView } from '~/components/readiness'
import { IconArrowRight } from '~/components/icons'
import { AppShell, BottomBar } from '~/components/layout'
import { Disclaimer, SafetyNote } from '~/components/safety'
import { StepTrack } from '~/components/steps'
import { Button, Card, Disclosure, LinkButton, Notice } from '~/components/ui'
import { cancelDisputeFn } from '~/functions/dispute'
import { parseError } from '~/lib/errors'
import { requireMember } from '~/lib/guard'
import { QUESTIONS } from '~/lib/questions'
import { formatDate, genitive } from '~/lib/turkish'
import type { DisputeView } from '~/lib/views'

export const Route = createFileRoute('/mesele/$id')({
  ssr: false,
  beforeLoad: requireMember,
  head: () => ({ meta: [{ title: 'Mesele — MESELE' }] }),
  component: DisputePage,
})

function DisputePage() {
  const { id } = Route.useParams()
  const query = useDispute(id)
  const view = query.data
  // 2. adım (okuma) ve 3. adım (yeniden değerlendirme) aynı sunucu durumunu paylaşır.
  // false: Gözünden metni · 'normal' | 'objection': yeniden değerlendirme formu
  const [reflecting, setReflecting] = useState<Reflecting>(false)
  const displayStep = view && view.step === 3 && !view.progress.meReconsidered && !reflecting ? 2 : view?.step

  return (
    <AppShell back="/panel" title={view?.title ?? 'Mesele'}>
      {query.isPending ? (
        <div className="space-y-4" aria-busy>
          <div className="h-6 w-full animate-pulse rounded-xl bg-sunken" />
          <div className="h-64 animate-pulse rounded-3xl bg-sunken" />
        </div>
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <div className="space-y-5 pb-6">
          <StepTrack
            step={displayStep!}
            done={view!.status === 'completed'}
            partnerName={view!.partner?.name}
            solo={view!.mode === 'solo'}
          />
          <ReadinessCard readiness={readinessFromView(view!)} />
          <Phase view={view!} onView={query.setView} reflecting={reflecting} setReflecting={setReflecting} />
        </div>
      )}
    </AppShell>
  )
}

type Reflecting = false | 'normal' | 'objection'

type PhaseProps = {
  view: DisputeView
  onView: (v: DisputeView) => void
  reflecting: Reflecting
  setReflecting: (v: Reflecting) => void
}

function Phase({ view, onView, reflecting, setReflecting }: PhaseProps) {
  switch (view.status) {
    case 'draft':
    case 'answers_in_progress':
      // Sırayla anlatım: ilk anlatan bitirmeden ikinci anlatan başlamaz.
      if (
        view.answerOrder === 'second' &&
        !view.progress.partnerSubmitted &&
        !view.progress.meSubmitted &&
        !view.mine.whatHappened
      ) {
        return <WaitingForFirst name={view.partner?.name ?? view.partnerName ?? 'Partneriniz'} />
      }
      return view.progress.meSubmitted ? (
        <WaitingForPartner view={view} />
      ) : (
        <>
          <AnswerWizard view={view} onView={onView} />
          {view.canCancel ? <CancelDispute view={view} /> : null}
        </>
      )
    case 'both_answers_completed':
    case 'generating_perspectives':
      return <Generating view={view} kind="perspectives" onView={onView} />
    case 'perspectives_ready':
    case 'reconsideration_in_progress':
      return <ReconsiderPhase view={view} onView={onView} reflecting={reflecting} setReflecting={setReflecting} />
    case 'reconsideration_completed':
    case 'generating_reports':
      return <Generating view={view} kind="reports" onView={onView} />
    case 'completed':
      return <Resolution view={view} onView={onView} />
  }
}

function WaitingForFirst({ name }: { name: string }) {
  return (
    <Card className="animate-rise space-y-3 py-8 text-center">
      <h2 className="text-[22px] font-semibold">Önce {name} anlatıyor</h2>
      <p className="mx-auto max-w-sm leading-relaxed text-ink-soft">
        {name} bitirdiğinde sıra size gelecek. Onun olay anlatımını okuyacak, eklemek ya da düzeltmek istediklerinizi
        yazacaksınız. Bu ekran kendiliğinden ilerler; yeni bir başlık girmenize gerek yok.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 2–3. Adım: Partnerinin Gözünden Gör + Yeniden Değerlendir
// ---------------------------------------------------------------------------

function ReconsiderPhase({ view, onView, reflecting, setReflecting }: PhaseProps) {
  const partner = view.partner?.name ?? 'Partneriniz'
  const perspective = view.partnerView?.perspective

  if (view.progress.meReconsidered) {
    return (
      <WaitingForPartner view={view}>
        {perspective ? (
          <Disclosure summary={<span>{genitive(partner)} gözünden metni yeniden okuyun</span>}>
            <PerspectiveCard perspective={perspective} name={partner} tone={view.partner?.role === 'A' ? 'a' : 'b'} />
          </Disclosure>
        ) : null}
      </WaitingForPartner>
    )
  }

  if (reflecting) {
    return (
      <ReconsiderForm
        view={view}
        onView={onView}
        startWithObjection={reflecting === 'objection'}
        onBack={() => {
          setReflecting(false)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="animate-rise space-y-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-clay-strong">
          2. Adım · Partnerinin Gözünden Gör
        </p>
        <p className="leading-relaxed text-ink-soft">
          Şimdi bir an kendi hikâyenizi kenara koyun. Bu, {genitive(partner)} o an yaşadıkları; doğru ya da yanlış
          değil, onun gerçeği. Danışman, onun cevaplarını ihtiyaç diliyle sizin için yeniden anlattı.
        </p>
      </div>
      {perspective ? (
        <PerspectiveCard perspective={perspective} name={partner} tone={view.partner?.role === 'A' ? 'a' : 'b'} />
      ) : (
        <Notice tone="info">{partner} için metin hazırlanamadı.</Notice>
      )}
      <MyPerspectiveDisclosure view={view} />
      <BottomBar>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="shrink-0 whitespace-nowrap"
            onClick={() => {
              setReflecting('objection')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            İtirazım var
          </Button>
          <Button
            full
            size="lg"
            onClick={() => {
              setReflecting('normal')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            Okudum, devam <IconArrowRight size={18} />
          </Button>
        </div>
      </BottomBar>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. Adım: Çözüm Raporu
// ---------------------------------------------------------------------------

const COUNSELOR_URL = import.meta.env.VITE_COUNSELOR_URL as string | undefined

function Resolution({ view, onView }: { view: DisputeView; onView: (v: DisputeView) => void }) {
  const report = view.report
  const solo = view.mode === 'solo'
  const partner = view.partnerName ?? 'Partneriniz'
  const unlocked = Boolean(report?.shared?.unlocked && report.shared.report)
  const [tab, setTab] = useState<'mine' | 'shared'>(unlocked ? 'shared' : 'mine')
  const topRef = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  // İki onay tamamlandığı an (yoklamayla) ortak rapora geç.
  useEffect(() => {
    if (unlocked) setTab('shared')
  }, [unlocked])
  // Sekme değişince (ör. ortak rapor açılınca) raporun en başına git.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [tab])
  if (!report) return <Notice tone="info">Rapor yükleniyor…</Notice>
  const showMine = !unlocked || tab === 'mine'

  return (
    <div ref={topRef} className="scroll-mt-20 space-y-5">
      <div className="animate-rise space-y-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-clay-strong">
          {solo ? 'Danışman Raporu' : '4. Adım · Çözüm Raporu'}
        </p>
        <h1 className="text-[26px] leading-tight font-semibold">
          {solo ? 'Bu akşam için bir yol haritası' : 'Döngü Analizi ve İhtiyaç Aynası'}
        </h1>
        {view.completedAt ? <p className="text-sm text-ink-faint">{formatDate(view.completedAt)}</p> : null}
      </div>

      {unlocked ? (
        <div className="grid grid-cols-2 rounded-full border border-line bg-sunken p-1 text-sm" role="tablist">
          {(
            [
              ['shared', 'Ortak Rapor'],
              ['mine', 'Size Özel Ayna'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`min-h-10 rounded-full font-semibold transition ${tab === key ? 'bg-surface text-ink shadow-soft' : 'text-ink-faint'}`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {showMine && report.mine ? (
        <>
          <SafetyNote safety={report.mine.safety} />
          {solo ? null : (
            <Notice tone="info" title="Bu sizin özel raporunuz">
              Yalnızca siz görüyorsunuz. Okuduktan sonra sayfanın en altından ortak raporunuzu görüntüleyebilirsiniz.
            </Notice>
          )}
          <MyReportView report={report.mine} partnerName={view.partnerName ?? ''} solo={solo} />
          {unlocked ? (
            <Button full size="lg" onClick={() => setTab('shared')}>
              Ortak raporu görüntüle <IconArrowRight size={18} />
            </Button>
          ) : null}
        </>
      ) : null}

      {solo ? null : unlocked ? (
        tab === 'shared' ? (
          <SharedReportView report={report.shared!.report!} view={view} />
        ) : null
      ) : (
        <SharedGate view={view} onView={onView} />
      )}

      <Disclosure summary={<span>Bu meselenin kayıtları</span>}>
        <div className="space-y-5">
          <MyAnswersSummary view={view} />
          {view.partnerView?.perspective ? (
            <PerspectiveCard
              perspective={view.partnerView.perspective}
              name={partner}
              tone={view.partner?.role === 'A' ? 'a' : 'b'}
            />
          ) : null}
        </div>
      </Disclosure>

      <Card className="space-y-3">
        <p className="font-semibold">Bu döngü sık tekrar ediyorsa</p>
        <p className="text-sm leading-relaxed text-ink-soft">
          Bazen ilişkideki döngüleri değiştirmek için dışarıdan bir bakışa ihtiyaç duyulur. Bir aile veya çift
          danışmanıyla yapacağınız görüşmeler, burada fark ettiklerinizi günlük hayatınıza taşımanıza yardımcı olabilir.
        </p>
        {COUNSELOR_URL ? (
          <a
            href={COUNSELOR_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-sm font-semibold text-clay-strong"
          >
            Psk. Dan. Fırat YALÇIN ile görüşme <IconArrowRight size={16} className="ml-1" />
          </a>
        ) : null}
      </Card>

      <LinkButton to="/panel" variant="secondary" full>
        Panele dön
      </LinkButton>
      <Disclaimer />
    </div>
  )
}

function MyAnswersSummary({ view }: { view: DisputeView }) {
  return (
    <dl className="space-y-3">
      <p className="text-sm font-semibold">Anlattıklarınız</p>
      {QUESTIONS.map((q) => {
        const body = answerBody(q, view.mine)
        if (!body) return null
        return (
          <div key={q.id}>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{q.title}</dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-ink">{body}</dd>
          </div>
        )
      })}
    </dl>
  )
}

function CancelDispute({ view }: { view: DisputeView }) {
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const mutation = useMutation({
    mutationFn: () => cancelDisputeFn({ data: { disputeId: view.id } }),
    onSuccess: () => navigate({ to: '/panel' }),
  })
  return (
    <div className="pt-2 text-center">
      {confirm ? (
        <div className="space-y-2">
          <p className="text-sm text-ink-soft">Bu mesele ve taslaklar silinecek. Emin misiniz?</p>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirm(false)}>
              Vazgeç
            </Button>
            <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Meseleyi kapat
            </Button>
          </div>
          {mutation.isError ? <Notice tone="error">{parseError(mutation.error).message}</Notice> : null}
        </div>
      ) : (
        <Button variant="quiet" size="sm" onClick={() => setConfirm(true)}>
          Bu meseleyi kapat
        </Button>
      )}
    </div>
  )
}
