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
  const a = await createCouple({ mode: 'couple', coupleName: 'Biz', displayName: 'Fırat' })
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
    { questionId: 'duygular' as const, text: 'sıkışmışlık', tags: ['gorulmemis', 'yalniz', 'diger'] },
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
    const other = await createCouple({ mode: 'couple', coupleName: 'Onlar', displayName: 'Mert' })
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
    expect(afterA.mine.answers.duygular.tags).toEqual(['gorulmemis', 'yalniz', 'diger'])
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
    const s = await createCouple({ mode: 'solo', coupleName: '', displayName: 'Fırat', partnerName: 'Ayşe' })
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

  it('bireysel modda partner adı zorunludur', async () => {
    await expect(createCouple({ mode: 'solo', coupleName: '', displayName: 'Fırat', partnerName: '' })).rejects.toThrow(
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
    expect(o.stats.emotions.A.gorulmemis).toBe(10)
    expect(o.stats.reactions.B.israr).toBe(10)
    expect(o.canRefresh).toBe(false)
  })
})
