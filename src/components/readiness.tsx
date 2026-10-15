import type { ActiveDisputeSummary, DisputeView, MemberInfo } from '~/lib/views'
import { IconCheck } from './icons'
import { cx } from './ui'

/**
 * İki tarafın hazır olma durumu: kim hangi aşamada? Yalnızca durum gösterilir;
 * kimsenin cevabı, taslağı ya da özel notu açığa çıkmaz.
 */

type State = 'done' | 'doing' | 'waiting' | 'absent'
type Row = { who: string; state: State; label: string; partner: boolean }
type Readiness = { headline: string; rows: Row[] }

const DOT: Record<State, string> = {
  done: 'bg-sage text-white',
  doing: 'bg-honey text-white animate-breathe',
  waiting: 'bg-line-strong',
  absent: 'bg-line',
}

export function readinessFromView(view: DisputeView): Readiness | null {
  if (view.mode === 'solo') return null
  const p = view.partner?.name ?? view.partnerName ?? 'Partneriniz'
  const pr = view.progress
  const joined = Boolean(view.partner)
  const me = (state: State, label: string): Row => ({ who: 'Siz', state, label, partner: false })
  const them = (state: State, label: string): Row => ({ who: p, state, label, partner: true })

  switch (view.status) {
    case 'draft':
    case 'answers_in_progress': {
      const mine = pr.meSubmitted ? me('done', 'Anlattı') : me('doing', 'Anlatıyor')
      const theirs = !joined
        ? them('absent', 'Henüz katılmadı')
        : pr.partnerSubmitted
          ? them('done', 'Anlattı')
          : pr.partnerStarted
            ? them('doing', 'Anlatıyor')
            : them('waiting', 'Henüz başlamadı')
      const headline = !joined
        ? `${p} henüz katılmadı. Siz anlatmaya başlayabilirsiniz; o katılınca kendi tarafını anlatacak.`
        : pr.meSubmitted && !pr.partnerSubmitted
          ? `Siz hazırsınız; ${p} anlatmayı bitirince birbirinizin gözünden okuyacaksınız.`
          : !pr.meSubmitted && pr.partnerSubmitted
            ? `${p} anlattı ve hazır. Sıra sizde.`
            : 'İkiniz de kendi tarafınızı ayrı ayrı anlatıyorsunuz.'
      return { headline, rows: [mine, theirs] }
    }
    case 'both_answers_completed':
    case 'generating_perspectives':
      return {
        headline: 'İkiniz de anlattınız. Danışman şimdi birbirinizin gözünden metinleri hazırlıyor.',
        rows: [me('done', 'Anlattı'), them('done', 'Anlattı')],
      }
    case 'perspectives_ready':
    case 'reconsideration_in_progress': {
      const mine = pr.meReconsidered ? me('done', 'Yeniden değerlendirdi') : me('doing', 'Okuyor, düşünüyor')
      const theirs = pr.partnerReconsidered ? them('done', 'Yeniden değerlendirdi') : them('doing', 'Okuyor, düşünüyor')
      const headline =
        pr.meReconsidered && !pr.partnerReconsidered
          ? `Siz hazırsınız; ${p} hâlâ okuyor ve yeniden düşünüyor.`
          : !pr.meReconsidered && pr.partnerReconsidered
            ? `${p} hazır. Okuyup yeniden değerlendirdiğinizde raporlarınız hazırlanacak.`
            : 'İkiniz de birbirinizin gözünden okuyorsunuz.'
      return { headline, rows: [mine, theirs] }
    }
    case 'reconsideration_completed':
    case 'generating_reports':
      return {
        headline: 'İkiniz de hazırsınız. Raporlarınız hazırlanıyor.',
        rows: [me('done', 'Hazır'), them('done', 'Hazır')],
      }
    case 'completed': {
      const sh = view.report?.shared
      if (!sh) return null
      const mine = sh.approvedByMe ? me('done', 'Ortak rapora hazır') : me('waiting', '“Hazırım” demedi')
      const theirs = sh.approvedByPartner ? them('done', 'Ortak rapora hazır') : them('waiting', '“Hazırım” demedi')
      const headline = sh.unlocked
        ? 'Ortak raporunuz açık.'
        : sh.approvedByMe
          ? `Siz hazırsınız; ortak rapor ${p} de “hazırım” deyince açılacak.`
          : sh.approvedByPartner
            ? `${p} ortak raporu açmaya hazır. Siz de hazır olduğunuzda açılır.`
            : 'Önce size özel raporunuzu okuyun; ikiniz de hazır olunca ortak rapor açılır.'
      return { headline, rows: [mine, theirs] }
    }
  }
}

/** Panel için: özet bilgiden kaba durum. */
export function readinessFromSummary(
  a: ActiveDisputeSummary,
  partner: MemberInfo | null,
  partnerName: string | null,
): Readiness | null {
  const p = partner?.name ?? partnerName ?? 'Partneriniz'
  if (!partner) {
    return {
      headline: `${p} henüz katılmadı.`,
      rows: [
        { who: 'Siz', state: a.meDone ? 'done' : 'doing', label: a.meDone ? 'Hazır' : 'Devam ediyor', partner: false },
        { who: p, state: 'absent', label: 'Henüz katılmadı', partner: true },
      ],
    }
  }
  const row = (who: string, done: boolean, isPartner: boolean): Row => ({
    who,
    state: done ? 'done' : 'doing',
    label: done ? 'Hazır' : 'Devam ediyor',
    partner: isPartner,
  })
  const headline =
    a.meDone && !a.partnerDone
      ? `Siz hazırsınız; ${p} bekleniyor.`
      : !a.meDone && a.partnerDone
        ? `${p} hazır; sıra sizde.`
        : a.meDone && a.partnerDone
          ? 'İkiniz de hazırsınız.'
          : 'İkiniz de devam ediyorsunuz.'
  return { headline, rows: [row('Siz', a.meDone, false), row(p, a.partnerDone, true)] }
}

export function ReadinessCard({ readiness, compact }: { readiness: Readiness | null; compact?: boolean }) {
  if (!readiness) return null
  return (
    <section
      aria-label="Hazır olma durumu"
      className={cx('animate-rise rounded-2xl border border-line bg-surface', compact ? 'p-3' : 'p-4 shadow-soft')}
    >
      <p className={cx('leading-snug text-ink', compact ? 'text-[14px]' : 'text-[15px] font-medium')}>
        {readiness.headline}
      </p>
      <ul className="mt-2.5 grid grid-cols-2 gap-2">
        {readiness.rows.map((r) => (
          <li
            key={r.who + r.partner}
            className={cx('rounded-xl px-3 py-2', r.partner ? 'bg-partner-b-soft/60' : 'bg-partner-a-soft/60')}
          >
            <p className="truncate text-[12px] font-semibold text-ink-soft">{r.who}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink">
              <span
                className={cx('inline-flex size-4 shrink-0 items-center justify-center rounded-full', DOT[r.state])}
                aria-hidden
              >
                {r.state === 'done' ? <IconCheck size={11} /> : null}
              </span>
              {r.label}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
