import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getDisputeFn } from '~/functions/dispute'
import type { DisputeView } from '~/lib/views'

export const disputeKey = (id: string) => ['dispute', id] as const

/** Partner beklenirken ya da üretim sürerken meseleyi düzenli yokla. */
function pollInterval(v: DisputeView | undefined): number | false {
  if (!v) return false
  if (v.generation.active || v.status === 'both_answers_completed' || v.status === 'reconsideration_completed')
    return 3500
  if (v.status === 'draft' || v.status === 'answers_in_progress') {
    const waitingForFirst = v.answerOrder === 'second' && !v.progress.partnerPart1 && !v.mine.whatHappened
    // İlk anlatan ilk 3 soruyu bitirdi, partnerini bekliyor
    const waitingForPartnerPart1 = v.answerOrder === 'first' && v.progress.mePart1 && !v.progress.partnerPart1
    return v.progress.meSubmitted || waitingForFirst || waitingForPartnerPart1 ? 5000 : false
  }
  if (v.status === 'perspectives_ready' || v.status === 'reconsideration_in_progress')
    return v.progress.meReconsidered ? 5000 : 15000
  if (v.status === 'completed' && v.report?.shared && !v.report.shared.unlocked && v.report.shared.approvedByMe)
    return 4000
  return false
}

export function useDispute(id: string) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: disputeKey(id),
    queryFn: () => getDisputeFn({ data: { disputeId: id } }),
    refetchInterval: (q) => pollInterval(q.state.data),
  })
  const setView = useCallback(
    (view: DisputeView) => {
      qc.setQueryData(disputeKey(id), view)
      void qc.invalidateQueries({ queryKey: ['panel'] })
    },
    [qc, id],
  )
  return { ...query, setView }
}
