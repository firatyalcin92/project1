import { describe, expect, it } from 'vitest'
import {
  ANSWER_QUESTION_IDS,
  FEELING_CHIPS,
  FEELING_GROUPS,
  QUESTIONS,
  QUESTION_COUNT,
  allowedChipsFor,
  strongestOptions,
} from '~/lib/questions'
import { describeFeelings } from '~/server/prompts.server'

describe('his listesi', () => {
  it('7 grup, tüm seçenekler ve benzersiz kimlikler', () => {
    expect(FEELING_GROUPS).toHaveLength(7)
    expect(FEELING_GROUPS.map((g) => g.chips.length)).toEqual([8, 8, 8, 8, 8, 8, 7])
    const ids = FEELING_CHIPS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z_]{2,32}$/)
    expect(FEELING_CHIPS.map((c) => c.label)).toContain('Kendimi çaresizce açıklamaya çalıştım')
  })

  it('soru akışı: 7 soru, iki his alanı aynı soru numarasında', () => {
    expect(QUESTION_COUNT).toBe(7)
    expect(QUESTIONS.map((q) => q.id)).toEqual([
      'olay',
      'dusunce',
      'his_sirasinda',
      'his_sonrasinda',
      'en_etkili',
      'ihtiyac',
      'partner_ihtiyac',
      'degisim',
    ])
    const during = QUESTIONS.find((q) => q.id === 'his_sirasinda')!
    expect(during.prompt('')).toBe('Tartışma sırasında ve sonrasında neler hissettiniz?')
    expect(during.number).toBe(QUESTIONS.find((q) => q.id === 'his_sonrasinda')!.number)
    expect(QUESTIONS.find((q) => q.id === 'en_etkili')!.prompt('')).toBe(
      'Seçtiğiniz hisler arasından sizi en çok etkileyen hangisiydi? Neden?',
    )
    // answers tablosundaki question_id kısıtına uyar
    for (const id of ANSWER_QUESTION_IDS) expect(id).toMatch(/^[a-z_]{2,32}$/)
  })

  it('en etkili his seçenekleri iki alanın birleşimidir', () => {
    const opts = strongestOptions(
      { tags: ['ofkelendim', 'yalniz', 'diger'], text: 'boşluk' },
      { tags: ['yalniz', 'kirildim'], text: '' },
    )
    expect(opts.map((o) => [o.id, o.when])).toEqual([
      ['yalniz', 'both'],
      ['kirildim', 'after'],
      ['ofkelendim', 'during'],
      ['diger_sirasinda', 'during'],
    ])
    expect(allowedChipsFor('en_etkili')).toContain('diger_sonrasinda')
  })
})

describe('eski kayıtlarla uyum', () => {
  it('v2 "duygular" kaydı hâlâ istemde okunur', () => {
    const lines = describeFeelings({
      answers: [{ question_id: 'duygular', text_answer: 'tükenmişlik', selected_tags: ['gorulmemis', 'diger'] }],
    })
    expect(lines).toEqual(['Hissettikleri: Görülmemiş, diğer: «« tükenmişlik »»'])
  })

  it('his cevabı hiç yoksa satır eklenmez', () => {
    expect(describeFeelings({ answers: [] })).toEqual([])
  })
})
