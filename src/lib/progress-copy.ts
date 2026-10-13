import { genitive } from './turkish'
import type { ActiveDisputeSummary } from './views'

/** Paneldeki aktif mesele kartının kişiselleştirilmiş durum cümlesi. */
export function activeLine(
  a: ActiveDisputeSummary,
  partnerName: string | null,
): { text: string; cta: string; waiting: boolean } {
  const p = partnerName ?? 'Partnerin'
  switch (a.status) {
    case 'draft':
    case 'answers_in_progress':
      if (!a.meDone)
        return {
          text: 'Senin anlatman bekleniyor. Kimse sözünü kesmeyecek.',
          cta: 'Anlatmaya devam et',
          waiting: false,
        }
      if (!partnerName)
        return { text: 'Sen anlattın. Partnerin katıldığında o da anlatacak.', cta: 'Meseleyi aç', waiting: true }
      return { text: `Sen anlattın. Şimdi ${genitive(p)} anlatması bekleniyor.`, cta: 'Meseleyi aç', waiting: true }
    case 'both_answers_completed':
    case 'generating_perspectives':
      return {
        text: 'İkiniz de anlattınız. MESELE birbirinizin gözünden metinleri hazırlıyor.',
        cta: 'Meseleyi aç',
        waiting: false,
      }
    case 'perspectives_ready':
    case 'reconsideration_in_progress':
      if (!a.meDone)
        return { text: `${genitive(p)} gözünden okumaya hazırsın.`, cta: `${genitive(p)} gözünden oku`, waiting: false }
      return {
        text: `Sen yeniden değerlendirdin. Şimdi ${genitive(p)} tamamlaması bekleniyor.`,
        cta: 'Meseleyi aç',
        waiting: true,
      }
    case 'reconsideration_completed':
    case 'generating_reports':
      return { text: 'Çözüm raporunuz hazırlanıyor.', cta: 'Meseleyi aç', waiting: false }
    case 'completed':
      return { text: 'Çözüm raporunuz hazır.', cta: 'Raporu aç', waiting: false }
  }
}
