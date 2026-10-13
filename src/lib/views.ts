import type { AnswerQuestionId, ReflectionId, Visibility } from './questions'
import type { MyReport, Perspective, RelationshipReport, SharedReport } from './report-schemas'
import type { DisputeStatus, Step } from './status'

/** Sunucu fonksiyonlarının istemciye döndürdüğü görünüm modelleri. Ham satırlar asla dönmez. */

export type Role = 'A' | 'B'

export type MemberInfo = { id: string; role: Role; name: string }

export type SessionResult = {
  token: string
  member: MemberInfo
  couple: { id: string; name: string; code: string }
}

export type DisputeSummary = {
  id: string
  title: string
  status: DisputeStatus
  step: Step
  createdAt: string
  completedAt: string | null
  createdByMe: boolean
}

export type ActiveDisputeSummary = DisputeSummary & {
  meDone: boolean
  partnerDone: boolean
}

export type OverviewStatus = 'locked' | 'available' | 'generating' | 'ready'

export type PanelView = {
  couple: { name: string; code: string }
  me: MemberInfo
  partner: MemberInfo | null
  active: ActiveDisputeSummary | null
  recent: DisputeSummary[]
  completedCount: number
  overview: { threshold: number; completed: number; status: OverviewStatus }
}

export type AnswerDraft = { text: string; tags: string[]; visibility: Visibility }

export type MyAnswersView = {
  whatHappened: string
  eventVisibility: Visibility
  answers: Record<AnswerQuestionId, AnswerDraft>
  submittedAt: string | null
}

export type PartnerSharedView = {
  whatHappened: string | null
  answers: Partial<Record<AnswerQuestionId, { text: string; tags: string[] }>>
}

export type ReconsiderationView = {
  items: Record<ReflectionId, { text: string; visibility: Visibility }>
  closeness: number | null
  submittedAt: string | null
}

export type DisputeView = {
  id: string
  title: string
  status: DisputeStatus
  step: Step
  createdAt: string
  completedAt: string | null
  createdByMe: boolean
  canCancel: boolean
  me: MemberInfo
  partner: MemberInfo | null
  progress: {
    meSubmitted: boolean
    partnerSubmitted: boolean
    meReconsidered: boolean
    partnerReconsidered: boolean
  }
  /** Üretim sürüyor mu; kilit bayatsa istemci yeniden tetikleyebilir. */
  generation: { active: boolean; stale: boolean }
  mine: MyAnswersView
  /** "Partnerinin Gözünden": yalnızca perspectives_ready ve sonrasında dolu. */
  partnerView: { perspective: Perspective | null; shared: PartnerSharedView } | null
  /** Senin anlatımının partnerine nasıl yansıtıldığı (şeffaflık). */
  myPerspective: Perspective | null
  myReconsideration: ReconsiderationView
  /** Partnerinin paylaşmayı seçtiği yeniden değerlendirme notları; mesele tamamlanınca görünür. */
  partnerReflections: Partial<Record<ReflectionId, string>> | null
  report: {
    mine: MyReport | null
    shared: {
      approvedByMe: boolean
      approvedByPartner: boolean
      unlocked: boolean
      /** İki partner de onaylayana kadar null. */
      report: SharedReport | null
    }
  } | null
}

export type OverviewStats = {
  emotions: Record<Role, Record<string, number>>
  reactions: Record<Role, Record<string, number>>
}

export type OverviewView = {
  threshold: number
  completed: number
  status: OverviewStatus
  canRefresh: boolean
  basedOn: number | null
  generatedAt: string | null
  me: MemberInfo
  partner: MemberInfo | null
  stats: OverviewStats
  report: RelationshipReport | null
}
