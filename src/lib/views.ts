import type { AnswerQuestionId, ReflectionId } from './questions'
import type { MyReport, Perspective, RelationshipReport, SharedReport } from './report-schemas'
import type { PaymentMode, PlanPeriod } from './plans'
import type { DisputeStatus, Step } from './status'

/** Sunucu fonksiyonlarının istemciye döndürdüğü görünüm modelleri. Ham satırlar asla dönmez. */

export type Role = 'A' | 'B'

export type MemberInfo = { id: string; role: Role; name: string }

/** couple: iki partner birlikte · solo: kişi tek başına danışıyor */
export type Mode = 'couple' | 'solo'

export type SessionResult = {
  token: string
  member: MemberInfo
  couple: { id: string; name: string; code: string; mode: Mode }
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

export type MembershipView = {
  active: boolean
  period: PlanPeriod | null
  expiresAt: string | null
  purchasedByMe: boolean
  freeLimit: number
  disputesUsed: number
  canCreateDispute: boolean
  payments: PaymentMode
  prices: Record<PlanPeriod, string | null>
}

/** Bekleyen "tüm verileri sil" talebi (yoksa null) */
export type DeletionView = {
  requestedByMe: boolean
  requesterName: string | null
  requestedAt: string
} | null

export type PanelView = {
  couple: { name: string; code: string; mode: Mode }
  me: MemberInfo
  partner: MemberInfo | null
  /** Çift modunda partnerin adı (katıldıysa), bireysel modda kişinin yazdığı ad */
  partnerName: string | null
  active: ActiveDisputeSummary | null
  recent: DisputeSummary[]
  completedCount: number
  overview: { threshold: number; completed: number; status: OverviewStatus }
  membership: MembershipView
  deletion: DeletionView
  /** Partneriniz sizin için bir kurtarma kodu ürettiyse (siz istemediyseniz iptal edebilirsiniz) */
  recoveryPending: { createdByName: string | null; usableAfter: string } | null
}

export type AnswerDraft = { text: string; tags: string[] }

export type MyAnswersView = {
  whatHappened: string
  answers: Record<AnswerQuestionId, AnswerDraft>
  /** Danışmanın 3. sorudan önceki yansıtması */
  reflection: string
  submittedAt: string | null
}

export type ReconsiderationView = {
  items: Record<ReflectionId, { text: string }>
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
  mode: Mode
  me: MemberInfo
  partner: MemberInfo | null
  partnerName: string | null
  progress: {
    meSubmitted: boolean
    partnerSubmitted: boolean
    /** Partner anlatmaya başladı mı (içerik değil, yalnızca durum) */
    partnerStarted: boolean
    meReconsidered: boolean
    partnerReconsidered: boolean
  }
  /** Üretim sürüyor mu; kilit bayatsa istemci yeniden tetikleyebilir. */
  generation: { active: boolean; stale: boolean }
  mine: MyAnswersView
  /** "Partnerinin Gözünden": yalnızca perspectives_ready ve sonrasında dolu (AI metni; ham cevaplar asla). */
  partnerView: { perspective: Perspective | null } | null
  /** Senin anlatımının partnerine nasıl yansıtıldığı (şeffaflık). */
  myPerspective: Perspective | null
  myReconsideration: ReconsiderationView
  report: {
    mine: MyReport | null
    /** Bireysel modda ortak rapor yoktur. */
    shared: {
      approvedByMe: boolean
      approvedByPartner: boolean
      unlocked: boolean
      /** İki partner de onaylayana kadar null. */
      report: SharedReport | null
    } | null
  } | null
}

export type OverviewStats = {
  emotions: Record<Role, Record<string, number>>
  thoughts: Record<Role, Record<string, number>>
  reactions: Record<Role, Record<string, number>>
}

export type OverviewView = {
  mode: Mode
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
