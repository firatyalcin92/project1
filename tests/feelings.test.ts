import { describe, expect, it } from 'vitest'
import {
  ANSWER_QUESTION_IDS,
  FEELING_CHIPS,
  FEELING_GROUPS,
  QUESTIONS,
  QUESTION_COUNT,
  allowedChipsFor,
  feelingLabel,
  strongestOptions,
} from '~/lib/questions'
import { describeFeelings } from '~/server/prompts.server'

describe('his listesi', () => {
  it('yalnızca duygular: 6 grup, 21 duygu ve benzersiz kimlikler', () => {
    expect(FEELING_GROUPS).toHaveLength(6)
    expect(FEELING_CHIPS).toHaveLength(21)
    // Düşünce ve davranış olanlar duygu listesinde yok
    for (const id of ['haksizlik', 'anlasilmadim', 'ice_kapandim', 'savunma_zorunlu'])
      expect(FEELING_CHIPS.map((c) => c.id)).not.toContain(id)
    const ids = FEELING_CHIPS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z_]{2,32}$/)
    // Çıkarılan hisler eski kayıtlarda adıyla görünmeye devam eder
    expect(FEELING_CHIPS.map((c) => c.id)).not.toContain('sinirlendim')
    expect(feelingLabel('sinirlendim')).toBe('Sinirlendim')
    expect(feelingLabel('gorulmemis')).toBe('Görülmemiş') // v2
  })

  it('soru akışı: 7 soru, 7 sayfa; sırasında ve sonrasında tek listede', () => {
    expect(QUESTION_COUNT).toBe(7)
    expect(QUESTIONS.map((q) => q.id)).toEqual([
      'olay',
      'dusunce',
      'hisler',
      'en_etkili',
      'ihtiyac',
      'partner_ihtiyac',
      'degisim',
    ])
    expect(QUESTIONS.map((q) => q.number)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(QUESTIONS.find((q) => q.id === 'hisler')!.prompt('')).toBe(
      'Tartışma sırasında ve sonrasında neler hissettiniz?',
    )
    expect(QUESTIONS.find((q) => q.id === 'en_etkili')!.prompt('')).toBe(
      'Seçtiğiniz hisler arasından sizi en çok etkileyen hangisiydi? Neden?',
    )
    // answers tablosundaki question_id kısıtına uyar
    for (const id of ANSWER_QUESTION_IDS) expect(id).toMatch(/^[a-z_]{2,32}$/)
  })

  it('en etkili his seçenekleri işaretlenen hislerden oluşur', () => {
    const opts = strongestOptions({ hisler: { tags: ['yalniz', 'ofkelendim', 'diger'], text: 'boşluk' } })
    expect(opts.map((o) => [o.id, o.label, o.when])).toEqual([
      ['yalniz', 'Yalnız hissettim', null],
      ['ofkelendim', 'Öfkelendim', null],
      ['diger', 'boşluk', null],
    ])
    expect(allowedChipsFor('en_etkili')).toContain('diger')
  })

  it('eski iki listeli kayıtlarda seçenekler birleşir ve zaman bilgisi korunur', () => {
    const opts = strongestOptions({
      his_sirasinda: { tags: ['ofkelendim', 'yalniz', 'diger'], text: 'boşluk' },
      his_sonrasinda: { tags: ['yalniz', 'kirildim'], text: '' },
    })
    expect(opts.map((o) => [o.id, o.when])).toEqual([
      ['ofkelendim', 'during'],
      ['yalniz', 'both'],
      ['kirildim', 'after'],
      ['diger_sirasinda', 'during'],
    ])
    // Listeden çıkarılmış bir his de eski kayıtta adıyla görünür
    expect(strongestOptions({ his_sirasinda: { tags: ['dinlenmedim'], text: '' } })[0]?.label).toBe(
      'Dinlenmediğimi hissettim',
    )
  })
})

describe('eski kayıtlarla uyum', () => {
  it('v2 "duygular" kaydı hâlâ istemde okunur', () => {
    const lines = describeFeelings({
      answers: [{ question_id: 'duygular', text_answer: 'tükenmişlik', selected_tags: ['gorulmemis', 'diger'] }],
    })
    expect(lines).toEqual(['Hissettikleri: Görülmemiş, diğer: «« tükenmişlik »»'])
  })

  it('kısa süre kullanılan iki listeli kayıt değişimiyle okunur', () => {
    const lines = describeFeelings({
      answers: [
        { question_id: 'his_sirasinda', text_answer: '', selected_tags: ['ofkelendim'] },
        { question_id: 'his_sonrasinda', text_answer: '', selected_tags: ['yalniz'] },
        { question_id: 'en_etkili', text_answer: '', selected_tags: ['yalniz'] },
      ],
    })
    expect(lines[0]).toBe('Tartışma SIRASINDA hissettikleri: Öfkelendim [öfke]')
    expect(lines[2]).toContain('sonradan ortaya çıkan: Yalnız hissettim')
    expect(lines[3]).toBe('Onu en çok etkileyen his: Yalnız hissettim (tartışma sonrasında)')
  })

  it('his seçilmemişse danışmana tahmin yürütmemesi söylenir', () => {
    const lines = describeFeelings({ answers: [{ question_id: 'hisler', text_answer: '', selected_tags: [] }] })
    expect(lines).toEqual([
      'Tartışma sırasında ve sonrasında hissettikleri (DUYGU): işaretlemedi (bilgi yok; tahmin yürütme)',
    ])
  })

  it('his cevabı hiç yoksa satır eklenmez', () => {
    expect(describeFeelings({ answers: [] })).toEqual([])
  })
})

describe('soru ifadeleri her meselede değişir', () => {
  it('aynı soru, farklı mesele → farklı ifade olabilir; aynı mesele → hep aynı', async () => {
    const { QUESTIONS: qs, seedFor } = await import('~/lib/questions')
    const q = qs.find((x) => x.id === 'degisim')!
    const seen = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => q.prompt('Gamze', seedFor(id, q.id))))
    expect(seen.size).toBeGreaterThan(1)
    expect(q.prompt('Gamze', seedFor('x', q.id))).toBe(q.prompt('Gamze', seedFor('x', q.id)))
    const need = qs.find((x) => x.id === 'ihtiyac')!
    expect(need.prompt('Gamze')).toBe('Yaşadığınız bu olayda sizin tam olarak ihtiyacınız neydi?')
    expect(need.followUp!('Gamze', 0)).toBe('Bu durumun daha fazla büyümemesi için Gamze neyi farklı yapabilirdi?')
    expect(need.followUp!('Gamze', 1)).toBe(
      'Aynı olay tekrar yaşansa Gamze’nin nasıl davranması işleri kolaylaştırırdı?',
    )
  })
})
