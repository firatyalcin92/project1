export const DISPUTE_STATUSES = [
  'draft',
  'answers_in_progress',
  'both_answers_completed',
  'generating_perspectives',
  'perspectives_ready',
  'reconsideration_in_progress',
  'reconsideration_completed',
  'generating_reports',
  'completed',
] as const

export type DisputeStatus = (typeof DISPUTE_STATUSES)[number]

export type Step = 1 | 2 | 3 | 4

export const STEPS: readonly { step: Step; title: string; short: string }[] = [
  { step: 1, title: 'Anlat', short: 'Anlat' },
  { step: 2, title: 'Partnerinin Gözünden Gör', short: 'Gözünden' },
  { step: 3, title: 'Yeniden Değerlendir', short: 'Yeniden' },
  { step: 4, title: 'Çözüm Raporu', short: 'Çözüm' },
]

export function stepOf(status: DisputeStatus): Step {
  switch (status) {
    case 'draft':
    case 'answers_in_progress':
      return 1
    case 'both_answers_completed':
    case 'generating_perspectives':
      return 2
    case 'perspectives_ready':
    case 'reconsideration_in_progress':
      return 3
    case 'reconsideration_completed':
    case 'generating_reports':
    case 'completed':
      return 4
  }
}

export function isGenerating(status: DisputeStatus) {
  return status === 'generating_perspectives' || status === 'generating_reports'
}

export function isAnswerPhase(status: DisputeStatus) {
  return status === 'draft' || status === 'answers_in_progress'
}

export function isReconsiderPhase(status: DisputeStatus) {
  return status === 'perspectives_ready' || status === 'reconsideration_in_progress'
}

/** Partnerin anlatımı ve "…'nın Gözünden" metni bu durumlardan itibaren görünür. */
export function perspectivesVisible(status: DisputeStatus) {
  return DISPUTE_STATUSES.indexOf(status) >= DISPUTE_STATUSES.indexOf('perspectives_ready')
}

export const STATUS_LABEL: Record<DisputeStatus, string> = {
  draft: 'Yeni açıldı',
  answers_in_progress: 'Anlatılıyor',
  both_answers_completed: 'İkiniz de anlattınız',
  generating_perspectives: 'Gözünden metinleri hazırlanıyor',
  perspectives_ready: 'Partnerinin gözünden okunabilir',
  reconsideration_in_progress: 'Yeniden değerlendiriliyor',
  reconsideration_completed: 'Çözüm raporu bekleniyor',
  generating_reports: 'Çözüm raporu hazırlanıyor',
  completed: 'Tamamlandı',
}

/** Genel Görüş raporunun açılması için gereken tamamlanmış mesele sayısı. */
export const OVERVIEW_THRESHOLD = 10
/** Genel Görüş, en az bu kadar yeni mesele tamamlandığında yenilenebilir. */
export const OVERVIEW_REFRESH_EVERY = 5
/** Üretim kilidi bu süreden eskiyse bayat sayılır (SQL'deki 4 dakikayla aynı). */
export const GENERATION_LOCK_MS = 4 * 60 * 1000
