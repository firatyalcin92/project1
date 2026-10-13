import type { RelationshipReport } from './report-schemas'

/** Genel Görüş bölümlerinin sırası ve başlıkları (istemci için zod'suz). */
export const RELATIONSHIP_SECTIONS = [
  { key: 'story', title: 'İlişkinizin Hikâyesi' },
  { key: 'coreCycle', title: 'Tekrarlayan Dansınız' },
  { key: 'triggers', title: 'Sık Tetikleyiciler' },
  { key: 'emotionMap', title: 'Birincil Duygu Haritanız' },
  { key: 'attachmentNeeds', title: 'Bağlanma İhtiyaçlarınız' },
  { key: 'horsemen', title: 'Dört Atlı Aynası' },
  { key: 'strengths', title: 'Güçlü Yanlarınız' },
  { key: 'growth', title: 'Büyüme Alanlarınız' },
  { key: 'path', title: 'Önümüzdeki Yol' },
] as const satisfies readonly { key: keyof RelationshipReport; title: string }[]
