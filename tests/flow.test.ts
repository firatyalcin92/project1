import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockGenerate } from '~/server/ai-mock.server'
import { authenticateMember } from '~/server/auth.server'
import { createCouple, joinCouple, buildPanel, restoreSession } from '~/server/couples.server'
import {
  approveSharedReport,
  createDispute,
  ensurePerspectives,
  ensureReports,
  getDisputeView,
  saveAnswers,
  saveReconsideration,
} from '~/server/disputes.server'
import { ensureOverview, getOverview } from '~/server/overview.server'
import { createMemoryStore } from '~/server/store-memory.server'
import { __setStoreForTests } from '~/server/store.server'
import type { AiTask } from '~/server/mesele.server'

/**
 * Uçtan uca alan testleri: bellek içi depo + sahte OpenAI (fetch).
 * Gerçek OpenAI çağrı yolunu (json_schema gövdesi, ayrıştırma, doğrulama) çalıştırır
 * ve her istemi kaydeder; böylece gizlilik kuralı istem düzeyinde doğrulanır.
 */

type Call = { task: AiTask; system: string; user: string; body: Record<string, unknown> }
let calls: Call[] = []

const SECRET_A = 'GIZLI-A-PAYI-KIMSE-BILMESIN'
const SECRET_B = 'GIZLI-B-OLAYI-SADECE-DANISMAN'
const SECRET_A_REFLECTION = 'GIZLI-A-YENIDEN'

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
      // Gerçekçi gecikme: eşzamanlı isteklerin üst üste binmesine izin ver.
      await new Promise((r) => setTimeout(r, 20))
      const content = JSON.stringify(
        mockGenerate(task, { a: 'Fırat', b: 'Ayşe', narrator: 'X', reader: 'Y', owner: 'X', partner: 'Y' }),
      )
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
    }),
  )
})

async function pair() {
  const a = await createCouple({ coupleName: 'Biz', displayName: 'Fırat' })
  const b = await joinCouple({ code: a.couple.code.toLowerCase(), displayName: 'Ayşe' })
  const ma = await authenticateMember(a.token)
  const mb = await authenticateMember(b.token)
  return { a, b, ma, mb }
}

const fullAnswers = (disputeId: string, opts: { secretEvent?: string; secretPay?: string } = {}) => ({
  disputeId,
  whatHappened: opts.secretEvent ?? 'Cumartesi akşamı planı konuşurken sesimiz yükseldi ve ben odadan çıktım.',
  eventVisibility: (opts.secretEvent ? 'private' : 'partner') as 'private' | 'partner',
  answers: [
    {
      questionId: 'duygular' as const,
      text: 'Görülmediğimi hissettim',
      tags: ['gorulmemis', 'yalniz', 'uydurma-cip'],
      visibility: 'partner' as const,
    },
    { questionId: 'tepkiler' as const, text: '', tags: ['israr'], visibility: 'partner' as const },
    { questionId: 'ihtiyac' as const, text: 'Beni duyduğunu söylemesi', visibility: 'partner' as const, tags: [] },
    {
      questionId: 'pay' as const,
      text: opts.secretPay ?? 'Sesimi yükselttim',
      tags: [],
      visibility: (opts.secretPay ? 'private' : 'partner') as 'private' | 'partner',
    },
  ],
  submit: true,
})

const reflections = (disputeId: string, secret?: string) => ({
  disputeId,
  items: [
    { id: 'dokunan' as const, text: 'Yalnız hissettiğini bilmiyordum', visibility: 'partner' as const },
    { id: 'altinda' as const, text: 'Korku vardı', visibility: 'partner' as const },
    {
      id: 'yeni_pay' as const,
      text: secret ?? 'Çok çabuk savundum',
      visibility: (secret ? 'private' : 'partner') as 'private' | 'partner',
    },
    { id: 'tek_cumle' as const, text: 'Seni kaybetmekten korktum', visibility: 'partner' as const },
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
    const other = await createCouple({ coupleName: 'Onlar', displayName: 'Mert' })
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

describe('tam akış: gizlilik ve eşzamanlılık', () => {
  it('özel yanıtlar partnere ve partnerin göreceği istemlere asla girmez', async () => {
    const { ma, mb } = await pair()
    const { id } = await createDispute(ma, 'Cumartesi planı')

    // Eksik gönderim reddedilir
    await expect(saveAnswers(ma, { ...fullAnswers(id), whatHappened: 'kısa' })).rejects.toThrow(/\[VALIDATION\]/)

    const afterA = await saveAnswers(ma, fullAnswers(id, { secretPay: SECRET_A }))
    expect(afterA.status).toBe('answers_in_progress')
    expect(afterA.partnerView).toBeNull()
    // geçersiz çip ayıklanır
    expect(afterA.mine.answers.duygular.tags).toEqual(['gorulmemis', 'yalniz'])
    await expect(saveAnswers(ma, fullAnswers(id))).rejects.toThrow(/\[CONFLICT\]/)

    const afterB = await saveAnswers(mb, fullAnswers(id, { secretEvent: SECRET_B }))
    expect(afterB.status).toBe('both_answers_completed')

    // İki partner aynı anda "Partnerinin gözünden gör"e basar: yalnızca 2 AI çağrısı (her partner için 1).
    await Promise.all([ensurePerspectives(ma, id), ensurePerspectives(mb, id), ensurePerspectives(ma, id)])
    const perspectiveCalls = calls.filter((c) => c.task === 'perspective')
    expect(perspectiveCalls).toHaveLength(2)
    expect(perspectiveCalls[0]!.body.response_format).toMatchObject({ type: 'json_schema' })
    for (const c of perspectiveCalls) {
      expect(c.user).not.toContain(SECRET_A)
      expect(c.user).not.toContain(SECRET_B)
      expect(c.user).not.toMatch(/diğer kişi/i)
    }

    const viewA = await getDisputeView(ma, id)
    const viewB = await getDisputeView(mb, id)
    expect(viewA.status).toBe('perspectives_ready')
    expect(viewA.partnerView?.perspective?.headline).toBeTruthy()
    expect(JSON.stringify(viewA)).not.toContain(SECRET_B)
    expect(JSON.stringify(viewB)).not.toContain(SECRET_A)
    expect(viewA.partnerView?.shared.whatHappened).toBeNull()
    expect(viewB.partnerView?.shared.answers.pay).toBeUndefined()
    // kendi gizli yanıtını görebilir
    expect(viewA.mine.answers.pay.text).toBe(SECRET_A)

    // 3. Adım
    await saveReconsideration(ma, reflections(id, SECRET_A_REFLECTION))
    const r = await saveReconsideration(mb, reflections(id))
    expect(r.status).toBe('reconsideration_completed')

    // 4. Adım: aynı anda iki istek -> 3 AI çağrısı (1 ortak + 2 kişisel)
    calls = []
    await Promise.all([ensureReports(ma, id), ensureReports(mb, id)])
    expect(calls.map((c) => c.task).sort()).toEqual(['my_report', 'my_report', 'shared_report'])

    const shared = calls.find((c) => c.task === 'shared_report')!
    for (const secret of [SECRET_A, SECRET_B, SECRET_A_REFLECTION]) expect(shared.user).not.toContain(secret)
    expect(shared.user).not.toMatch(/yakınlık/i)

    const mine = calls.filter((c) => c.task === 'my_report')
    const forA = mine.find((c) => c.user.includes('Yalnızca Fırat'))!
    const forB = mine.find((c) => c.user.includes('Yalnızca Ayşe'))!
    expect(forA.user).toContain(SECRET_A)
    expect(forA.user).toContain(SECRET_A_REFLECTION)
    expect(forA.user).not.toContain(SECRET_B)
    expect(forB.user).toContain(SECRET_B)
    expect(forB.user).not.toContain(SECRET_A)
    expect(forB.user).not.toContain(SECRET_A_REFLECTION)

    // Ortak rapor iki onay gelene kadar kilitli
    let va = await getDisputeView(ma, id)
    expect(va.status).toBe('completed')
    expect(va.report?.mine?.greeting).toBeTruthy()
    expect(va.report?.shared.unlocked).toBe(false)
    expect(va.report?.shared.report).toBeNull()
    va = await approveSharedReport(ma, id)
    expect(va.report?.shared.approvedByMe).toBe(true)
    expect(va.report?.shared.report).toBeNull()
    const vb = await approveSharedReport(mb, id)
    expect(vb.report?.shared.unlocked).toBe(true)
    expect(vb.report?.shared.report?.repairSteps).toHaveLength(3)

    // Partnerin paylaşılan yansımaları görünür; gizli olan görünmez
    expect(vb.partnerReflections?.tek_cumle).toBe('Seni kaybetmekten korktum')
    expect(JSON.stringify(vb)).not.toContain(SECRET_A_REFLECTION)
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

describe('Genel Görüş', () => {
  it('10 meseleden önce kilitli, sonra 9 bölümlük rapor yalnızca paylaşılan veriden üretilir', async () => {
    const { ma, mb } = await pair()
    for (let i = 0; i < 10; i++) {
      const { id } = await createDispute(ma, `Mesele ${i + 1}`)
      await saveAnswers(ma, fullAnswers(id, { secretPay: SECRET_A }))
      await saveAnswers(mb, fullAnswers(id))
      await ensurePerspectives(ma, id)
      await saveReconsideration(ma, reflections(id, SECRET_A_REFLECTION))
      await saveReconsideration(mb, reflections(id))
      await ensureReports(mb, id)
      if (i === 8) {
        const locked = await getOverview(ma)
        expect(locked.status).toBe('locked')
        await expect(ensureOverview(ma)).rejects.toThrow(/\[CONFLICT\]/)
      }
    }
    const panel = await buildPanel(ma)
    expect(panel.completedCount).toBe(10)
    expect(panel.overview.status).toBe('available')

    calls = []
    const [o1] = await Promise.all([ensureOverview(ma), ensureOverview(mb)])
    expect(calls.filter((c) => c.task === 'relationship_report')).toHaveLength(1)
    expect(calls[0]!.user).not.toContain(SECRET_A)
    expect(calls[0]!.user).not.toContain(SECRET_A_REFLECTION)
    const o = await getOverview(mb)
    expect(o.status).toBe('ready')
    expect(o.report?.horsemen.items).toHaveLength(4)
    expect(o.stats.emotions.A.gorulmemis).toBe(10)
    expect(o1.basedOn ?? o.basedOn).toBe(10)
    expect(o.canRefresh).toBe(false)
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
    // Gecikmiş bir otomatik kayıt, gönderimden sonra sunucuya ulaşıyor:
    await store.upsertEntry({ dispute_id: id, member_id: ma.id, what_happened: 'taslak', event_visibility: 'partner' })
    const [entry] = await store.getEntries([id])
    expect(entry!.submitted_at).not.toBeNull()
  })
})
