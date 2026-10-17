import { genitive } from './turkish'
import type { ActiveDisputeSummary } from './views'

/** Paneldeki aktif mesele kartının kişiselleştirilmiş durum cümlesi. */
export function activeLine(
  a: ActiveDisputeSummary,
  partnerName: string | null,
  solo = false,
): { text: string; cta: string; waiting: boolean } {
  const p = partnerName ?? 'Partneriniz'
  switch (a.status) {
    case 'draft':
    case 'answers_in_progress':
      if (a.waitingForFirst)
        return {
          text: `${p} bu meseleyi anlatıyor. Bitirdiğinde sıra size gelecek; başlık girmenize gerek yok, buradan devam edeceksiniz.`,
          cta: 'Meseleyi açın',
          waiting: true,
        }
      if (!a.meDone && a.partnerDone)
        return {
          text: `${p} anlattı. Sıra sizde: onun olay anlatımını okuyup kendi tarafınızı ekleyin.`,
          cta: 'Anlatmaya başlayın',
          waiting: false,
        }
      if (!a.meDone)
        return {
          text: 'Sizin anlatmanız bekleniyor. Kimse sözünüzü kesmeyecek.',
          cta: 'Anlatmaya devam edin',
          waiting: false,
        }
      if (!partnerName)
        return { text: 'Anlattınız. Partneriniz katıldığında o da anlatacak.', cta: 'Meseleyi açın', waiting: true }
      return { text: `Anlattınız. Şimdi ${genitive(p)} anlatması bekleniyor.`, cta: 'Meseleyi açın', waiting: true }
    case 'both_answers_completed':
    case 'generating_perspectives':
      return {
        text: 'İkiniz de anlattınız. MESELE birbirinizin gözünden metinleri hazırlıyor.',
        cta: 'Meseleyi açın',
        waiting: false,
      }
    case 'perspectives_ready':
    case 'reconsideration_in_progress':
      if (!a.meDone)
        return {
          text: `${genitive(p)} gözünden okumaya hazırsınız.`,
          cta: `${genitive(p)} gözünden okuyun`,
          waiting: false,
        }
      return {
        text: `Yeniden değerlendirdiniz. Şimdi ${genitive(p)} tamamlaması bekleniyor.`,
        cta: 'Meseleyi açın',
        waiting: true,
      }
    case 'reconsideration_completed':
    case 'generating_reports':
      return {
        text: solo ? 'Danışman raporunuz hazırlanıyor.' : 'Çözüm raporunuz hazırlanıyor.',
        cta: 'Meseleyi açın',
        waiting: false,
      }
    case 'completed':
      return { text: 'Raporunuz hazır.', cta: 'Raporu açın', waiting: false }
  }
}
