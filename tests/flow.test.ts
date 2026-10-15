import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockGenerate } from '~/server/ai-mock.server'
import { authenticateMember } from '~/server/auth.server'
import { buildPanel, createCouple, joinCouple, restoreSession } from '~/server/couples.server'
import {
  approveSharedReport,
  createDispute,
  ensurePerspectives,
  ensureReports,
  getDisputeView,
  reflectAnswers,
  saveAnswers,
  saveReconsideration,
} from '~/server/disputes.server'
import type { AiTask } from '~/server/mesele.server'
import { ensureOverview, getOverview } from '~/server/overview.server'
import { createMemoryStore } from '~/server/store-memory.server'
import { __setStoreForTests } from '~/server/store.server'

/**
 * Uçtan uca alan testleri: bellek içi depo + sahte OpenAI (fetch).
 * Gerçek OpenAI çağrı yolunu (json_schema gövdesi, ayrıştırma, doğrulama) çalıştırır
 * ve her istemi kaydeder.
 */

type Call = { task: AiTask; system: string; user: string; body: Record<string, unknown> }
let calls: Call[] = []

// Ayırt edici ham cevaplar: partnerin ekranına ASLA olduğu gibi dönmemeli.
const RAW_A = 'FIRAT-HAM-CEVAP sen hep telefona gömülüyorsun beni hiç umursamıyorsun'
const RAW_B = 'AYSE-HAM-CEVAP annemlerin gelişini son anda söylemesi beni deli etti'

beforeEach(() => {
  __setStoreForTests(createMemoryStore())
  calls = []
  vi.stubEnv('MESELE_AI_PROVIDER', 'openai')
  vi.stubEnv('OPENAI_API_KEY', 'sk-test')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        messages: { role: string; content: string }[]
        response_format: { json_schema: { name: string } }
      }
      const task = body.response_format.json_schema.name.replace('mesele_', '') as AiTask
      calls.push({ task, system: body.messages[0]!.content, user: body.messages[1]!.content, body })
      await new Promise((r) => setTimeout(r, 20))
      const solo = body.messages[1]!.content.includes('uygulamayı kullanmıyor')
      const content = JSON.stringify(
        mockGenerate(task, { a: 'Fırat', b: 'Ayşe', narrator: 'X', reader: 'Y', owner: 'X', partner: 'Y', solo }),
      )
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
    }),
  )
})

async function pair() {
  const a = await createCouple({ mode: 'couple', displayName: 'Fırat', partnerName: 'Ayşe' })
  const b = await joinCouple({ code: a.couple.code.toLowerCase(), displayName: 'Ayşe' })
  const ma = await authenticateMember(a.token)
  const mb = await authenticateMember(b.token)
  return { a, b, ma, mb }
}

const fullAnswers = (
  disputeId: string,
  raw = 'Cumartesi akşamı planı konuşurken sesimiz yükseldi ve ben odadan çıktım.',
) => ({
  disputeId,
  whatHappened: raw,
  answers: [
    { questionId: 'dusunce' as const, text: '“Yine beni dinlemiyor” diye düşündüm', tags: ['israr', 'uydurma-cip'] },
    {
      questionId: 'hisler' as const,
      text: 'sıkışmışlık',
      tags: ['ofkelendim', 'dinlenmedim', 'yalniz', 'diger', 'uydurma-his'],
    },
    { questionId: 'en_etkili' as const, text: 'Çünkü kapı kapanınca tek başıma kaldım', tags: ['yalniz'] },
    { questionId: 'ihtiyac' as const, text: 'Beni duyduğunu söylemesi', tags: [] },
    { questionId: 'partner_ihtiyac' as const, text: 'Yorgun olduğunu fark etmemi', tags: [] },
    { questionId: 'degisim' as const, text: 'Sesimi yükseltmemek', tags: [] },
  ],
  submit: true,
})

const reflections = (disputeId: string) => ({
  disputeId,
  items: [
    { id: 'dokunan' as const, text: 'Yalnız hissettiğini bilmiyordum' },
    { id: 'altinda' as const, text: 'Korku vardı' },
    { id: 'yeni_pay' as const, text: 'Çok çabuk savundum' },
    { id: 'tek_cumle' as const, text: 'Seni kaybetmekten korktum' },
  ],
  closeness: 4,
  submit: true,
})

describe('kimlik doğrulama ve eşleştirme', () => {
  it('çift kodu bir kez eşleştirir; ikinci katılım reddedilir', async () => {
    const { a } = await pair()
    await expect(joinCouple({ code: a.couple.code, displayName: 'Üçüncü' })).rejects.toThrow(/\[CONFLICT\]/)
  })

  it('çift kodu bir şifre değildir: kodla kimlik doğrulanamaz', async () => {
    const { a } = await pair()
    await expect(authenticateMember(a.couple.code)).rejects.toThrow(/\[UNAUTHORIZED\]/)
    await expect(authenticateMember('x'.repeat(43))).rejects.toThrow(/\[UNAUTHORIZED\]/)
    await expect(authenticateMember(undefined)).rejects.toThrow(/\[UNAUTHORIZED\]/)
  })

  it('token 256-bit base64url ve cihaz anahtarıyla geri dönülebilir', async () => {
    const { a } = await pair()
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const restored = await restoreSession(a.token)
    expect(restored.member.id).toBe(a.member.id)
  })

  it('başka bir çiftin üyesi meseleyi göremez (IDOR)', async () => {
    const { ma } = await pair()
    const other = await createCouple({ mode: 'couple', displayName: 'Mert', partnerName: 'Ece' })
    const mo = await authenticateMember(other.token)
    const { id } = await createDispute(ma, 'Cumartesi planı')
    await expect(getDisputeView(mo, id)).rejects.toThrow(/\[NOT_FOUND\]/)
    await expect(saveAnswers(mo, fullAnswers(id))).rejects.toThrow(/\[NOT_FOUND\]/)
  })

  it('aynı anda yalnızca bir açık mesele olabilir', async () => {
    const { ma, mb } = await pair()
    await createDispute(ma, 'Bir')
    await expect(createDispute(mb, 'İki')).rejects.toThrow(/\[CONFLICT\]/)
  })
})

describe('çift akışı: ham cevaplar partnere dönmez, analiz hepsini kullanır', () => {
  it('tam akış', async () => {
    const { ma, mb } = await pair()
    const { id } = await createDispute(ma, 'Cumartesi planı')

    await expect(saveAnswers(ma, { ...fullAnswers(id), whatHappened: 'kısa' })).rejects.toThrow(/\[VALIDATION\]/)

    // 3. sorudan önce yansıtma: hızlı model, saklanır
    const r = await reflectAnswers(ma, { disputeId: id, whatHappened: RAW_A, thought: 'Yine beni dinlemiyor' })
    expect(r.reflection).toBeTruthy()
    const reflectionCall = calls.find((c) => c.task === 'reflection')!
    expect(reflectionCall.body.model).toBe('gpt-4o-mini')

    const afterA = await saveAnswers(ma, fullAnswers(id, RAW_A))
    expect(afterA.status).toBe('answers_in_progress')
    expect(afterA.mine.reflection).toBe(r.reflection)
    expect(afterA.mine.answers.dusunce.tags).toEqual(['israr']) // geçersiz çip ayıklanır
    expect(afterA.mine.answers.hisler).toEqual({
      text: 'sıkışmışlık',
      tags: ['ofkelendim', 'dinlenmedim', 'yalniz', 'diger'],
    })
    expect(afterA.mine.answers.en_etkili).toEqual({ text: 'Çünkü kapı kapanınca tek başıma kaldım', tags: ['yalniz'] })
    await expect(saveAnswers(ma, fullAnswers(id))).rejects.toThrow(/\[CONFLICT\]/)

    const afterB = await saveAnswers(mb, fullAnswers(id, RAW_B))
    expect(afterB.status).toBe('both_answers_completed')

    // Aynı anda basılan "gözünden gör": yalnızca 2 AI çağrısı.
    await Promise.all([ensurePerspectives(ma, id), ensurePerspectives(mb, id), ensurePerspectives(ma, id)])
    const perspectiveCalls = calls.filter((c) => c.task === 'perspective')
    expect(perspectiveCalls).toHaveLength(2)
    for (const c of perspectiveCalls) {
      expect(c.system).toMatch(/AYNEN ALINTILAMA/)
      expect(c.user).toMatch(/ASLA aynen alıntılama/)
    }
    // Analiz her şeyi kullanır (gizlilik seçeneği yok)
    expect(perspectiveCalls.some((c) => c.user.includes(RAW_A))).toBe(true)
    expect(perspectiveCalls.some((c) => c.user.includes(RAW_B))).toBe(true)

    // Ama ham cevaplar partnerin ekranına asla dönmez
    const viewA = await getDisputeView(ma, id)
    const viewB = await getDisputeView(mb, id)
    expect(viewA.status).toBe('perspectives_ready')
    expect(viewA.partnerView?.perspective?.headline).toBeTruthy()
    expect(JSON.stringify(viewA)).not.toContain('AYSE-HAM-CEVAP')
    expect(JSON.stringify(viewB)).not.toContain('FIRAT-HAM-CEVAP')
    expect(viewA.mine.whatHappened).toBe(RAW_A)

    await saveReconsideration(ma, reflections(id))
    const rec = await saveReconsideration(mb, reflections(id))
    expect(rec.status).toBe('reconsideration_completed')

    calls = []
    await Promise.all([ensureReports(ma, id), ensureReports(mb, id)])
    expect(calls.map((c) => c.task).sort()).toEqual(['my_report', 'my_report', 'shared_report'])

    const shared = calls.find((c) => c.task === 'shared_report')!
    expect(shared.user).toMatch(/Kişisel tavsiyeler.*burada YOK/)
    const mine = calls.filter((c) => c.task === 'my_report')
    for (const m of mine) {
      expect(m.user).toMatch(/TEKRAR ETME/) // ortak raporu tekrar etmemesi istenir
      expect(m.user).toMatch(/BİREBİR kurması gereken cümle/)
      expect(m.user).toMatch(/felaketleştirme, genelleme/)
    }

    let va = await getDisputeView(ma, id)
    expect(va.status).toBe('completed')
    expect(va.report?.mine?.needsLanguage.say).toBeTruthy()
    expect(va.report?.shared?.report).toBeNull()
    va = await approveSharedReport(ma, id)
    expect(va.report?.shared?.report).toBeNull()
    const vb = await approveSharedReport(mb, id)
    expect(vb.report?.shared?.unlocked).toBe(true)
    expect(vb.report?.shared?.report?.repairSteps).toHaveLength(3)
    expect(JSON.stringify(vb)).not.toContain('FIRAT-HAM-CEVAP')
  })

  it('üretim başarısız olursa kilit bırakılır ve tekrar denenebilir', async () => {
    const { ma, mb } = await pair()
    const { id } = await createDispute(ma, 'Tatil')
    await saveAnswers(ma, fullAnswers(id))
    await saveAnswers(mb, fullAnswers(id))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 400 })),
    )
    await expect(ensurePerspectives(ma, id)).rejects.toThrow(/\[AI_UNAVAILABLE\]/)
    expect((await getDisputeView(ma, id)).status).toBe('both_answers_completed')
  })
})

describe('bireysel (solo) mod', () => {
  it('tek kişi anlatır, tek bir danışman raporu alır; ortak rapor ve kod ile katılım yoktur', async () => {
    const s = await createCouple({ mode: 'solo', displayName: 'Fırat', partnerName: 'Ayşe' })
    expect(s.couple.mode).toBe('solo')
    await expect(joinCouple({ code: s.couple.code, displayName: 'Ayşe' })).rejects.toThrow(/\[NOT_FOUND\]/)
    const m = await authenticateMember(s.token)
    const panel = await buildPanel(m)
    expect(panel.partnerName).toBe('Ayşe')
    expect(panel.couple.mode).toBe('solo')

    const { id } = await createDispute(m, 'Annemlerin ziyareti')
    const v = await saveAnswers(m, fullAnswers(id, RAW_A))
    expect(v.status).toBe('reconsideration_completed')
    expect(v.partnerName).toBe('Ayşe')

    calls = []
    const done = await ensureReports(m, id)
    expect(calls.map((c) => c.task)).toEqual(['my_report'])
    expect(calls[0]!.user).toMatch(/uygulamayı kullanmıyor/)
    expect(calls[0]!.user).toContain('Ayşe')
    expect(done.status).toBe('completed')
    expect(done.report?.shared).toBeNull()
    expect(done.report?.mine?.needGuess.match).toBe('tahmin')
    await expect(ensureOverview(m)).rejects.toThrow(/\[CONFLICT\]/)
  })

  it('partner adı her iki modda da zorunludur', async () => {
    await expect(createCouple({ mode: 'solo', displayName: 'Fırat', partnerName: '' })).rejects.toThrow(
      /\[VALIDATION\]/,
    )
    await expect(createCouple({ mode: 'couple', displayName: 'Fırat', partnerName: ' ' })).rejects.toThrow(
      /\[VALIDATION\]/,
    )
  })
})

describe('taslak kaydı yarışı', () => {
  it('submitted_at verilmeyen bir taslak kaydı, önceki gönderimi geri almaz', async () => {
    const store = createMemoryStore()
    __setStoreForTests(store)
    const { ma } = await pair()
    const { id } = await createDispute(ma, 'Yarış')
    await store.upsertEntry({
      dispute_id: id,
      member_id: ma.id,
      what_happened: 'gönderildi',
      event_visibility: 'partner',
      submitted_at: new Date().toISOString(),
    })
    await store.upsertEntry({ dispute_id: id, member_id: ma.id, what_happened: 'taslak', event_visibility: 'partner' })
    const [entry] = await store.getEntries([id])
    expect(entry!.submitted_at).not.toBeNull()
  })
})

describe('Genel Görüş', () => {
  it('10 meseleden önce kilitli, sonra 9 bölümlük rapor tek kez üretilir', async () => {
    const { ma, mb } = await pair()
    for (let i = 0; i < 10; i++) {
      const { id } = await createDispute(ma, `Mesele ${i + 1}`)
      await saveAnswers(ma, fullAnswers(id))
      await saveAnswers(mb, fullAnswers(id))
      await ensurePerspectives(ma, id)
      await saveReconsideration(ma, reflections(id))
      await saveReconsideration(mb, reflections(id))
      await ensureReports(mb, id)
      if (i === 8) {
        expect((await getOverview(ma)).status).toBe('locked')
        await expect(ensureOverview(ma)).rejects.toThrow(/\[CONFLICT\]/)
      }
    }
    const panel = await buildPanel(ma)
    expect(panel.completedCount).toBe(10)
    expect(panel.overview.status).toBe('available')

    calls = []
    await Promise.all([ensureOverview(ma), ensureOverview(mb)])
    expect(calls.filter((c) => c.task === 'relationship_report')).toHaveLength(1)
    const o = await getOverview(mb)
    expect(o.status).toBe('ready')
    expect(o.report?.horsemen.items).toHaveLength(4)
    // Hem sırasında hem sonrasında seçilen his, mesele başına bir kez sayılır.
    expect(o.stats.emotions.A.dinlenmedim).toBe(10)
    expect(o.stats.emotions.B.ofkelendim).toBe(10)
    expect(o.stats.emotions.A.diger).toBeUndefined()
    expect(calls[0]!.user).toContain('Dinlenmediğimi hissettim')
    expect(o.stats.reactions.B.israr).toBe(10)
    expect(o.canRefresh).toBe(false)
  })
})

describe('çift oluşturma: çift adı sorulmaz', () => {
  it('ad ve partner adı yeterli; partner katılana kadar panelde yazılan ad görünür', async () => {
    const a = await createCouple({ mode: 'couple', displayName: 'Fırat', partnerName: 'Ayşe' })
    expect(a.couple.name).toBe('Fırat & Ayşe')
    const ma = await authenticateMember(a.token)
    expect((await buildPanel(ma)).partnerName).toBe('Ayşe')
    await joinCouple({ code: a.couple.code, displayName: 'Ayşegül' })
    expect((await buildPanel(ma)).partnerName).toBe('Ayşegül')
  })
})

describe('his soruları (tek liste + en çok etkileyen)', () => {
  const RAW_WHY = 'NEDEN-HAM-CEVAP o an bana bir yabancı gibi baktı'
  const RAW_OTHER = 'DIGER-HAM-HIS içimde bir boşluk'

  const feelingAnswers = (
    disputeId: string,
    overrides: Record<string, { text: string; tags: string[] }>,
    raw = RAW_A,
  ) => {
    const base = fullAnswers(disputeId, raw)
    return {
      ...base,
      answers: base.answers.map((a) => (overrides[a.questionId] ? { ...a, ...overrides[a.questionId] } : a)),
    }
  }

  it('his listesi ve en etkili his ayrı satırlarda, doğru kişiye bağlı saklanır; partner göremez', async () => {
    const store = createMemoryStore()
    __setStoreForTests(store)
    const { ma, mb } = await pair()
    const { id } = await createDispute(ma, 'Akşam yemeği')
    await saveAnswers(
      ma,
      feelingAnswers(id, {
        hisler: { text: RAW_OTHER, tags: ['ofkelendim', 'yalniz', 'diger'] },
        en_etkili: { text: RAW_WHY, tags: ['yalniz'] },
      }),
    )

    const rows = (await store.getAnswers([id])).filter((r) => r.member_id === ma.id)
    const row = (q: string) => rows.find((r) => r.question_id === q)
    expect(row('hisler')?.selected_tags).toEqual(['ofkelendim', 'yalniz', 'diger'])
    expect(row('hisler')?.text_answer).toBe(RAW_OTHER)
    expect(row('en_etkili')?.selected_tags).toEqual(['yalniz'])
    expect(row('en_etkili')?.text_answer).toBe(RAW_WHY)

    const vb = await getDisputeView(mb, id)
    expect(vb.mine.answers.en_etkili).toEqual({ text: '', tags: [] })
    expect(JSON.stringify(vb)).not.toContain('NEDEN-HAM-CEVAP')
    expect(JSON.stringify(vb)).not.toContain('DIGER-HAM-HIS')
  })

  it('geçersiz seçimler ayıklanır: tek en etkili his, seçilmemiş his kabul edilmez', async () => {
    const { ma } = await pair()
    const { id } = await createDispute(ma, 'Tatil')
    const set = (o: Record<string, { text: string; tags: string[] }>) =>
      saveAnswers(ma, { ...feelingAnswers(id, o), submit: false })

    let v = await set({ hisler: { text: '', tags: ['ofkelendim'] }, en_etkili: { text: 'çünkü', tags: ['yalniz'] } })
    expect(v.mine.answers.en_etkili).toEqual({ text: 'çünkü', tags: [] })

    v = await set({
      hisler: { text: '', tags: ['ofkelendim', 'kirildim'] },
      en_etkili: { text: '', tags: ['uydurma', 'kirildim', 'ofkelendim'] },
    })
    expect(v.mine.answers.en_etkili.tags).toEqual(['kirildim'])

    v = await set({ hisler: { text: 'yazı ama çip yok', tags: ['ofkelendim'] }, en_etkili: { text: '', tags: [] } })
    expect(v.mine.answers.hisler).toEqual({ text: '', tags: ['ofkelendim'] })
    v = await set({ hisler: { text: '  ', tags: ['diger'] }, en_etkili: { text: '', tags: [] } })
    expect(v.mine.answers.hisler).toEqual({ text: '', tags: [] })

    // Kendi yazdığı his de "en etkili" seçilebilir.
    v = await set({ hisler: { text: 'boşluk', tags: ['diger'] }, en_etkili: { text: '', tags: ['diger'] } })
    expect(v.mine.answers.en_etkili.tags).toEqual(['diger'])

    // His, en etkili his ve "o an ne yaptınız" artık zorunlu; en fazla 7 his tutulur.
    const submit = (o: Record<string, { text: string; tags: string[] }>) =>
      saveAnswers(ma, { ...feelingAnswers(id, o), submit: true })
    await expect(submit({ hisler: { text: '', tags: [] }, en_etkili: { text: '', tags: [] } })).rejects.toThrow(
      /en az birini/,
    )
    await expect(
      submit({ hisler: { text: '', tags: ['kirildim'] }, en_etkili: { text: '', tags: [] } }),
    ).rejects.toThrow(/en çok etkileyen/)
    await expect(
      submit({ dusunce: { text: 'Yine dinlemiyor dedim', tags: [] }, en_etkili: { text: '', tags: ['yalniz'] } }),
    ).rejects.toThrow(/ne yaptığınızı/)
    v = await set({
      hisler: {
        text: 'sekizinci',
        tags: [
          'kirildim',
          'uzuldum',
          'yalniz',
          'guvensiz',
          'ofkelendim',
          'kaygilandim',
          'utanmis',
          'yetersiz',
          'diger',
        ],
      },
      en_etkili: { text: '', tags: ['yetersiz'] },
    })
    expect(v.mine.answers.hisler).toEqual({
      text: '',
      tags: ['kirildim', 'uzuldum', 'yalniz', 'guvensiz', 'ofkelendim', 'kaygilandim', 'utanmis'],
    })
    expect(v.mine.answers.en_etkili.tags).toEqual([]) // kesilen his seçilemez
    v = await submit({ hisler: { text: '', tags: ['kirildim'] }, en_etkili: { text: '', tags: ['kirildim'] } })
    expect(v.mine.submittedAt).toBeTruthy()
  })

  it('yapay zekâ istemleri hisleri ve en çok etkileyen hissi kullanır; ortak rapor döngü kırma rehberini içerir', async () => {
    const { ma, mb } = await pair()
    const { id } = await createDispute(ma, 'Ev işleri')
    await saveAnswers(
      ma,
      feelingAnswers(id, {
        hisler: { text: RAW_OTHER, tags: ['ofkelendim', 'dinlenmedim', 'yalniz', 'diger'] },
        en_etkili: { text: RAW_WHY, tags: ['yalniz'] },
      }),
    )
    await saveAnswers(
      mb,
      feelingAnswers(
        id,
        { hisler: { text: '', tags: ['kaygilandim'] }, en_etkili: { text: '', tags: ['kaygilandim'] } },
        RAW_B,
      ),
    )
    await ensurePerspectives(ma, id)
    const fromA = calls.find((c) => c.task === 'perspective' && c.user.includes('FIRAT-HAM-CEVAP'))!
    expect(fromA.user).toContain(
      'Tartışma sırasında ve sonrasında hissettikleri: Öfkelendim [öfke ve haksızlık]; Dinlenmediğimi hissettim',
    )
    expect(fromA.user).toContain(`kendi ifadesiyle: «« ${RAW_OTHER} »»`)
    expect(fromA.user).toContain('Onu en çok etkileyen his: Yalnız hissettim\n')
    expect(fromA.user).toContain(`Nedeni: «« ${RAW_WHY} »»`)
    expect(fromA.user).toMatch(/niyetinin kanıtı gibi sunma/)
    expect(fromA.system).toMatch(/## Duygular/)
    expect(fromA.system).toMatch(/liste hâlinde geri sayma/)
    expect(fromA.system).toMatch(/tanı çıkarma/)
    expect(fromA.system).toMatch(/belirsizliği açıkça söyle/)
    expect(fromA.system).toMatch(/eşit ciddiyetle/)
    expect(fromA.system).toMatch(/## Sade ve gündelik ol/)
    expect(fromA.system).toMatch(/Yürüyüşe çıkmak/)

    const fromB = calls.find((c) => c.task === 'perspective' && c.user.includes('AYSE-HAM-CEVAP'))!
    expect(fromB.user).toContain('Onu en çok etkileyen his: Kaygılandım')

    const objection = 'ITIRAZ-HAM ben telefonu fırlatmadım, masaya bıraktım'
    const withObjection = reflections(id)
    await saveReconsideration(mb, {
      ...withObjection,
      items: [...withObjection.items, { id: 'itiraz', text: objection }],
    })
    await saveReconsideration(ma, reflections(id))
    expect(JSON.stringify(await getDisputeView(ma, id))).not.toContain('ITIRAZ-HAM')
    calls = []
    await ensureReports(ma, id)
    const mine = calls.filter((c) => c.task === 'my_report')
    expect(mine).toHaveLength(2)
    expect(calls.find((c) => c.task === 'shared_report')!.user).toContain(`İTİRAZI (Fırat’ın gözünden metne`)
    expect(calls.find((c) => c.task === 'shared_report')!.user).toContain(objection)
    expect(calls[0]!.system).toMatch(/kimin doğru hatırladığına karar verme/)
    for (const m of mine) {
      expect(m.user).toMatch(/- feelings: .*LİSTE HÂLİNDE TEKRAR ETMEDEN/)
      expect(m.user).toContain('Döngüyü adlandırma cümlesi') // ortak rapordakini tekrar etmez
    }
    const shared = calls.find((c) => c.task === 'shared_report')!
    expect(shared.user).toContain(RAW_WHY)
    expect(shared.user).toMatch(/DÖNGÜ KIRMA REHBERİ/)
    expect(shared.user).toMatch(/çatışmanın biçimini değiştirmektir/)
    expect(shared.user).toMatch(/Onarım girişimini kabul etmek/)
    expect(shared.user).toMatch(/short alanı ad olmadan 2-5 kelime/)

    await approveSharedReport(ma, id)
    const vb = await approveSharedReport(mb, id)
    expect(vb.report?.shared?.report?.breakCycle.exits).toHaveLength(2)
    expect(vb.report?.shared?.report?.cycle.steps[0]?.short).toBeTruthy()
    expect(vb.report?.mine?.feelings).toBeTruthy()
  })

  it('isimler büyük harfle başlar', async () => {
    const a = await createCouple({ mode: 'couple', displayName: 'fırat', partnerName: 'ayşe gül' })
    expect(a.member.name).toBe('Fırat')
    expect(a.couple.name).toBe('Fırat & Ayşe Gül')
    const b = await joinCouple({ code: a.couple.code, displayName: 'ilknur' })
    expect(b.member.name).toBe('İlknur')
  })
})
