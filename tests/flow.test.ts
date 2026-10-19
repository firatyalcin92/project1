import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockGenerate } from '~/server/ai-mock.server'
import { authenticateMember } from '~/server/auth.server'
import { buildPanel, createCouple, invitePreview, joinCouple, signIn } from '~/server/couples.server'
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
import { approveDeletion, dismissDeletion, purchase, requestDeletion } from '~/server/account.server'
import { finishOAuth, issueTicket, readTicket, sendEmailCode, verifyEmailCode } from '~/server/identity.server'
import { __setStoreForTests, getStore } from '~/server/store.server'

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
      // Önceki mesele varsa örnek "Sizi tanıdıkça" metni üretilsin
      const history = /ÖNCEKİ MESELELER \(en yeniden[^\n]*\n- «« (.+?) »»/.exec(body.messages[1]!.content)?.[1] ?? ''
      const content = JSON.stringify(
        mockGenerate(task, {
          a: 'Fırat',
          b: 'Ayşe',
          narrator: 'X',
          reader: 'Y',
          owner: 'X',
          partner: 'Y',
          solo,
          history,
        }),
      )
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
    }),
  )
})

/** Testlerde ödeme yerine doğrudan üyelik tanımlar. */
async function grantMembership(coupleId: string, memberId: string) {
  const store = await getStore()
  await store.createSubscription({
    couple_id: coupleId,
    member_id: memberId,
    period: 'monthly',
    provider: 'test',
    provider_ref: null,
    owner_user_id: null,
    expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  })
}

/** Üyeyi e-posta koduyla (sahte sağlayıcı) bir hesaba bağlar. */
async function saveAccount(member: Awaited<ReturnType<typeof authenticateMember>> | null, email: string) {
  await sendEmailCode(email)
  return signIn(await verifyEmailCode(email, '123456'), member, issueTicket)
}

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
    { questionId: 'dusunce_kalip' as const, text: '', tags: ['onemsemiyor', 'hep_boyle', 'israr'] },
    {
      questionId: 'hisler' as const,
      text: 'sıkışmışlık',
      tags: ['ofkelendim', 'kirildim', 'yalniz', 'diger', 'uydurma-his', 'dinlenmedim'],
    },
    { questionId: 'en_etkili' as const, text: 'Çünkü kapı kapanınca tek başıma kaldım', tags: ['yalniz'] },
    { questionId: 'ihtiyac' as const, text: 'Beni duyduğunu söylemesi', tags: ['duyulmak', 'anlasilmak'] },
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

  it("oturum token'ı 256-bit base64url", async () => {
    const { a } = await pair()
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('davet linki: kim davet etti ve önerilen ad; kullanıldıktan sonra boş döner', async () => {
    const a = await createCouple({ mode: 'couple', displayName: 'Fırat', partnerName: 'Ayşe' })
    expect(await invitePreview(a.couple.code.toLowerCase())).toEqual({ inviter: 'Fırat', suggestedName: 'Ayşe' })
    await joinCouple({ code: a.couple.code, displayName: 'Ayşe' })
    expect(await invitePreview(a.couple.code)).toBeNull()
    expect(await invitePreview('ZZZZZZ')).toBeNull()
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
      tags: ['ofkelendim', 'kirildim', 'yalniz', 'diger'], // eski/çıkarılmış his ('dinlenmedim') kabul edilmez
    })
    expect(afterA.mine.answers.dusunce_kalip.tags).toEqual(['onemsemiyor', 'hep_boyle']) // davranış çipi düşünceye girmez
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
    // Sırayla anlatım: yalnızca ilk anlatanın olay anlatımı ikinciye gösterilir; başka hiçbir ham cevap.
    expect(JSON.stringify(viewA)).not.toContain('AYSE-HAM-CEVAP')
    expect(viewB.partnerEvent).toBe(RAW_A)
    expect(viewA.partnerEvent).toBeNull()
    expect(JSON.stringify({ ...viewB, partnerEvent: null })).not.toContain('FIRAT-HAM-CEVAP')
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
    expect(JSON.stringify({ ...vb, partnerEvent: null })).not.toContain('FIRAT-HAM-CEVAP')
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
  it('5 meseleden önce kilitli, sonra 9 bölümlük rapor tek kez üretilir', async () => {
    const { ma, mb } = await pair()
    await grantMembership(ma.coupleId, ma.id)
    for (let i = 0; i < 5; i++) {
      const { id } = await createDispute(ma, `Mesele ${i + 1}`)
      await saveAnswers(ma, fullAnswers(id))
      await saveAnswers(mb, fullAnswers(id))
      await ensurePerspectives(ma, id)
      await saveReconsideration(ma, reflections(id))
      await saveReconsideration(mb, reflections(id))
      await ensureReports(mb, id)
      if (i === 3) {
        expect((await getOverview(ma)).status).toBe('locked')
        await expect(ensureOverview(ma)).rejects.toThrow(/\[CONFLICT\]/)
      }
    }
    const panel = await buildPanel(ma)
    expect(panel.completedCount).toBe(5)
    expect(panel.overview.status).toBe('available')

    calls = []
    await Promise.all([ensureOverview(ma), ensureOverview(mb)])
    expect(calls.filter((c) => c.task === 'relationship_report')).toHaveLength(1)
    const o = await getOverview(mb)
    expect(o.status).toBe('ready')
    expect(o.report?.horsemen.items).toHaveLength(4)
    // Hem sırasında hem sonrasında seçilen his, mesele başına bir kez sayılır.
    expect(o.stats.emotions.A.kirildim).toBe(5)
    expect(o.stats.thoughts.A.hep_boyle).toBe(5)
    expect(o.stats.emotions.B.ofkelendim).toBe(5)
    expect(o.stats.emotions.A.diger).toBeUndefined()
    expect(calls[0]!.user).toContain('Kırıldım')
    expect(calls[0]!.user).toContain('Hep böyle oluyor, hiç değişmeyecek: 5')
    expect(o.stats.reactions.B.israr).toBe(5)
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
        hisler: { text: RAW_OTHER, tags: ['ofkelendim', 'kirildim', 'yalniz', 'diger'] },
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
      'Tartışma sırasında ve sonrasında hissettikleri (DUYGU): Öfkelendim [öfke]; Kırıldım [kırgınlık ve üzüntü]; Yalnız hissettim [kırgınlık ve üzüntü]',
    )
    expect(fromA.user).toContain(
      'Aklından geçenler (DÜŞÜNCE — seçtiği kalıplar): Beni önemsemiyor [partnerin niyetine dair yorum]; Hep böyle oluyor, hiç değişmeyecek [genelleme (hep / hiç)]',
    )
    expect(fromA.user).toContain('O an yaptıkları (DAVRANIŞ): Üstüne gittim, ısrar ettim [üstüne gitme / takip]')
    expect(fromA.system).toMatch(/## Duygu, düşünce ve davranışı ayır/)
    expect(fromA.system).toMatch(/cezalandırma isteği/)
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

/** Bir meseleyi iki taraf için de sonuna kadar götürür. */
async function completeDispute(ma: Awaited<ReturnType<typeof pair>>['ma'], mb: typeof ma, title: string) {
  const { id } = await createDispute(ma, title)
  await saveAnswers(ma, fullAnswers(id, RAW_A))
  await saveAnswers(mb, fullAnswers(id, RAW_B))
  await ensurePerspectives(ma, id)
  await saveReconsideration(ma, reflections(id))
  await saveReconsideration(mb, reflections(id))
  await ensureReports(ma, id)
  return id
}

describe('üyelik: bir mesele ücretsiz, sonrası çift düzeyinde üyelik', () => {
  it('ikinci mesele açılır ama 1. sorudan sonrası üyelik ister; birinin alması ikisine yeter', async () => {
    const { ma, mb } = await pair()
    const firstId = await completeDispute(ma, mb, 'İlk')
    expect(await getDisputeView(ma, firstId)).toMatchObject({ freeDispute: true, paywall: false })
    expect((await buildPanel(ma)).membership).toMatchObject({
      active: false,
      nextDisputeFree: false,
      disputesUsed: 1,
      trialAvailable: true,
      trialDays: 3,
      prices: { monthly: 249, yearly: 1999 },
    })

    // Ücretsiz hak bitti: mesele yine de açılır, 1. soru kaydedilir
    const { id } = await createDispute(mb, 'İkinci')
    expect(await getDisputeView(mb, id)).toMatchObject({ freeDispute: false, paywall: true })
    const draft = await saveAnswers(mb, { ...fullAnswers(id), submit: false })
    expect(draft.mine.whatHappened).toContain('Cumartesi')
    expect(draft.mine.answers.dusunce.text).toBe('') // 1. sorudan sonrası kaydedilmez
    await expect(saveAnswers(mb, fullAnswers(id))).rejects.toThrow(/\[PAYMENT_REQUIRED\]/)
    await expect(
      reflectAnswers(mb, { disputeId: id, whatHappened: RAW_B, thought: 'Yine beni dinlemiyor' }),
    ).rejects.toThrow(/\[PAYMENT_REQUIRED\]/)

    // Ödeme altyapısı yokken satın alma kapalı
    await expect(purchase(ma, { period: 'monthly' })).rejects.toThrow(/\[ACCOUNT_REQUIRED\]/)
    await saveAccount(ma, 'firat@ornek.com')
    await expect(purchase(ma, { period: 'monthly' })).rejects.toThrow(/\[CONFIG\]/)

    vi.stubEnv('MESELE_PAYMENTS', 'test')
    const m = await purchase(ma, { period: 'monthly' })
    expect(m).toMatchObject({
      active: true,
      trial: false,
      period: 'monthly',
      purchasedByMe: true,
      nextDisputeFree: true,
    })
    expect((await buildPanel(mb)).membership).toMatchObject({ active: true, purchasedByMe: false })
    // Kilit kalktı: aynı meseleye kaldığı yerden devam
    expect(await getDisputeView(mb, id)).toMatchObject({ paywall: false })
    const done = await saveAnswers(mb, fullAnswers(id))
    expect(done.progress.meSubmitted).toBe(true)
  })

  it('yıllık üyelik çift başına bir kez 3 gün ücretsiz denenir; deneme sırasında alınan üyelik üstüne eklenir', async () => {
    vi.stubEnv('MESELE_PAYMENTS', 'test')
    vi.stubEnv('MESELE_PRICE_MONTHLY', '299,90 TL')
    vi.stubEnv('MESELE_PRICE_YEARLY', '2.499 ₺')
    const { ma, mb } = await pair()
    await saveAccount(ma, 'firat@ornek.com')
    await saveAccount(mb, 'ayse@ornek.com')
    expect((await buildPanel(ma)).membership.prices).toEqual({ monthly: 299.9, yearly: 2499 })
    await expect(purchase(ma, { period: 'monthly', trial: true })).rejects.toThrow(/yalnızca yıllık/)

    const t = await purchase(ma, { period: 'yearly', trial: true })
    expect(t).toMatchObject({ active: true, trial: true, period: 'yearly', trialAvailable: false })
    const days = (Date.parse(t.expiresAt!) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(2.9)
    expect(days).toBeLessThan(3.1)
    // Partner için de açık; ikinci deneme yok
    expect((await buildPanel(mb)).membership).toMatchObject({ active: true, trial: true })
    await expect(purchase(mb, { period: 'yearly', trial: true })).rejects.toThrow(/deneme hakkınızı kullandınız/)

    // Deneme sırasında yıllık alındı: kalan deneme günleri korunur
    const paid = await purchase(mb, { period: 'yearly' })
    expect(paid).toMatchObject({ active: true, trial: false, period: 'yearly', purchasedByMe: true })
    expect(Date.parse(paid.expiresAt!) - Date.parse(t.expiresAt!)).toBeGreaterThan(364 * 86_400_000)
  })

  it('haftalık plan satılmaz; uzatma süre üstüne eklenir', async () => {
    vi.stubEnv('MESELE_PAYMENTS', 'test')
    const a = await createCouple({ mode: 'couple', displayName: 'Fırat', partnerName: 'Ayşe' })
    const ma = await authenticateMember(a.token)
    await saveAccount(ma, 'firat@ornek.com')
    await expect(purchase(ma, { period: 'weekly' as never })).rejects.toThrow(/Geçersiz üyelik süresi/)
    const m = await purchase(ma, { period: 'monthly' })
    expect(m.period).toBe('monthly')
    const longer = await purchase(ma, { period: 'yearly' })
    expect(Date.parse(longer.expiresAt!) - Date.parse(m.expiresAt!)).toBeGreaterThan(364 * 86_400_000)
  })
})

describe('hesap: Apple / Google / e-posta kodu', () => {
  it('hesapsız başlanır; hesap kaydedilince başka cihazdan giriş yapılır, eski oturum kapanır', async () => {
    const { a, ma } = await pair()
    expect((await buildPanel(ma)).account).toEqual({ saved: false, email: null })
    await expect(verifyEmailCode('firat@ornek.com', '000000')).rejects.toThrow(/\[VALIDATION\]/)
    await expect(sendEmailCode('geçersiz')).rejects.toThrow(/\[VALIDATION\]/)

    const linked = await saveAccount(ma, 'Firat@Ornek.com')
    expect(linked).toEqual({ status: 'linked', email: 'firat@ornek.com' })
    expect((await buildPanel(ma)).account).toEqual({ saved: true, email: 'firat@ornek.com' })

    // Yeni cihaz: oturum yok → hesaba bağlı kayıtlara giriş
    const r = await saveAccount(null, 'firat@ornek.com')
    expect(r.status).toBe('signed_in')
    const session = (r as Extract<typeof r, { status: 'signed_in' }>).session
    expect(session.member.id).toBe(a.member.id)
    await expect(authenticateMember(a.token)).rejects.toThrow(/\[UNAUTHORIZED\]/)
    expect((await authenticateMember(session.token)).id).toBe(a.member.id)
  })

  it('kaydı olmayan hesap: bilet döner; adlar yazılınca hesap yeni üyeye bağlanır', async () => {
    const r = await saveAccount(null, 'yeni@ornek.com')
    expect(r.status).toBe('no_account')
    const ticket = (r as Extract<typeof r, { status: 'no_account' }>).ticket
    expect(readTicket(ticket)?.email).toBe('yeni@ornek.com')
    expect(readTicket(ticket + 'x')).toBeNull()
    const c = await createCouple({
      mode: 'solo',
      displayName: 'Deniz',
      partnerName: 'Can',
      identity: readTicket(ticket),
    })
    const mc = await authenticateMember(c.token)
    expect((await buildPanel(mc)).account).toEqual({ saved: true, email: 'yeni@ornek.com' })
    // Aynı hesapla tekrar giriş → bu kayıt
    const again = await saveAccount(null, 'yeni@ornek.com')
    expect(again.status).toBe('signed_in')
  })

  it('Apple / Google (sahte sağlayıcı) aynı akışı izler; bir hesap iki kayda bağlanamaz', async () => {
    const { ma, mb } = await pair()
    const google = await finishOAuth('mock-google', 'x'.repeat(43))
    expect(await signIn(google, ma, issueTicket)).toMatchObject({ status: 'linked' })
    // Aynı Google hesabıyla partnerin cihazında: o hesap zaten Fırat'a bağlı → Fırat'a giriş yapılır
    const r = await signIn(google, mb, issueTicket)
    expect(r.status).toBe('signed_in')
    await expect(finishOAuth('sahte', 'x'.repeat(43))).rejects.toThrow(/\[VALIDATION\]/)
  })
})

describe('mesele başlığı sorulmaz', () => {
  it('ilk anlatanın yansıtmasıyla birlikte ad verilir; yansıtma yoksa tarihli ad', async () => {
    const { ma, mb } = await pair()
    const { id } = await createDispute(ma)
    expect((await getDisputeView(ma, id)).title).toBe('Yeni mesele')
    const r = await reflectAnswers(ma, { disputeId: id, whatHappened: RAW_A, thought: 'Yine beni dinlemiyor' })
    expect((await getDisputeView(mb, id)).title).toBe('Akşamki tartışma')
    // Anlatılana göre önerilen his ve ihtiyaçlar saklanır; yalnızca sahibine döner
    expect(r.suggestions).toEqual({ feelings: ['kirildim', 'gorulmedim'], needs: ['duyulmak', 'onemsenmek'] })
    expect((await getDisputeView(ma, id)).mine.suggestions).toEqual(r.suggestions)
    expect((await getDisputeView(mb, id)).mine.suggestions).toEqual({ feelings: [], needs: [] })

    const solo = await createCouple({ mode: 'solo', displayName: 'Deniz', partnerName: 'Can' })
    const ms = await authenticateMember(solo.token)
    const d2 = await createDispute(ms)
    await saveAnswers(ms, fullAnswers(d2.id))
    expect((await getDisputeView(ms, d2.id)).title).toMatch(/^\d{1,2} \p{L}+ meselesi$/u)
  })
})

describe('tüm verileri sil: partnerin onayıyla; üyelik hesapta kalır', () => {
  it('çift modunda partner onaylayınca silinir; üyelik aynı hesapla yeni kayda geçer', async () => {
    vi.stubEnv('MESELE_PAYMENTS', 'test')
    const { a, b, ma, mb } = await pair()
    await completeDispute(ma, mb, 'Ev işleri')
    await saveAccount(ma, 'firat@ornek.com')
    await purchase(ma, { period: 'yearly' })

    const r = await requestDeletion(ma)
    expect(r).toEqual({ deleted: false, membershipKept: true })
    expect((await buildPanel(mb)).deletion).toMatchObject({ requestedByMe: false, requesterName: 'Fırat' })
    await expect(approveDeletion(ma)).rejects.toThrow(/\[CONFLICT\]/) // kendi talebini onaylayamaz
    await expect(requestDeletion(mb)).rejects.toThrow(/\[CONFLICT\]/)

    // Reddedilirse hiçbir şey silinmez
    await dismissDeletion(mb)
    expect((await buildPanel(ma)).deletion).toBeNull()
    expect((await buildPanel(ma)).completedCount).toBe(1)

    await requestDeletion(ma)
    expect(await approveDeletion(mb)).toEqual({ deleted: true, membershipKept: true })
    await expect(authenticateMember(a.token)).rejects.toThrow(/\[UNAUTHORIZED\]/)
    await expect(authenticateMember(b.token)).rejects.toThrow(/\[UNAUTHORIZED\]/)

    // Aynı hesapla yeniden başlayınca üyelik kendiliğinden bağlanır
    const login = await saveAccount(null, 'firat@ornek.com')
    expect(login.status).toBe('no_account')
    const ticket = readTicket((login as Extract<typeof login, { status: 'no_account' }>).ticket)
    const solo = await createCouple({ mode: 'solo', displayName: 'Fırat', partnerName: 'Ayşe', identity: ticket })
    const ms = await authenticateMember(solo.token)
    expect((await buildPanel(ms)).membership).toMatchObject({ active: true, purchasedByMe: true, period: 'yearly' })
  })

  it('bireysel modda ya da partner katılmadıysa hemen silinir', async () => {
    const solo = await createCouple({ mode: 'solo', displayName: 'Fırat', partnerName: 'Ayşe' })
    const ms = await authenticateMember(solo.token)
    expect(await requestDeletion(ms)).toEqual({ deleted: true, membershipKept: false })
    await expect(authenticateMember(solo.token)).rejects.toThrow(/\[UNAUTHORIZED\]/)
  })
})

describe('meseleler arası bağlam ve hazır olma durumu', () => {
  it('ikinci meselede danışman öncekini hatırlar; partnerin kişisel raporu karışmaz', async () => {
    const { ma, mb } = await pair()
    await grantMembership(ma.coupleId, ma.id)
    await completeDispute(ma, mb, 'Ev işleri')
    calls = []
    await completeDispute(ma, mb, 'Annemlerin ziyareti')
    const shared = calls.find((c) => c.task === 'shared_report')!
    expect(shared.user).toContain('ÖNCEKİ MESELELER')
    expect(shared.user).toContain('«« Ev işleri »»')
    expect(shared.user).not.toContain('Kendinde değiştirmeyi seçtiği') // ortak rapora kişisel rapor girmez
    const mine = calls.filter((c) => c.task === 'my_report')
    expect(mine).toHaveLength(2)
    for (const m of mine) {
      expect(m.user).toContain('«« Ev işleri »»')
      expect(m.user).toContain('Kendinde değiştirmeyi seçtiği')
      expect(m.user).toMatch(/- history: /)
    }
    const v = await getDisputeView(ma, (await buildPanel(ma)).recent[0]!.id)
    expect(v.report?.mine?.history).toContain('Ev işleri')
  })

  it('ilk meselede history boştur', async () => {
    const { ma, mb } = await pair()
    calls = []
    await completeDispute(ma, mb, 'İlk')
    expect(calls.find((c) => c.task === 'shared_report')!.user).toContain('ÖNCEKİ MESELELER: yok')
  })

  it('partnerin başladığı görünür ama içeriği görünmez', async () => {
    const { ma, mb } = await pair()
    const { id } = await createDispute(mb, 'Taslak') // Ayşe açtı: önce o anlatır
    expect((await getDisputeView(ma, id)).progress.partnerStarted).toBe(false)
    await saveAnswers(mb, { ...fullAnswers(id, 'TASLAK-HAM yarım kalan anlatım burada duruyor'), submit: false })
    const v = await getDisputeView(ma, id)
    expect(v.progress).toMatchObject({ partnerStarted: true, partnerSubmitted: false })
    expect(JSON.stringify(v)).not.toContain('TASLAK-HAM')
  })
})

describe('sırayla anlatım: önce açan anlatır, diğeri onun olay anlatımını görüp ekler', () => {
  it('ikinci anlatan ilk anlatan bitirmeden başlayamaz; bitince olay anlatımını görür', async () => {
    const { ma, mb } = await pair()
    const { id } = await createDispute(ma, 'Kutlama')
    const vb0 = await getDisputeView(mb, id)
    expect(vb0.answerOrder).toBe('second')
    expect(vb0.partnerEvent).toBeNull()
    await expect(saveAnswers(mb, fullAnswers(id, RAW_B))).rejects.toThrow(/Önce Fırat anlatmayı bitirmeli/)

    // Taslak hâlinde görünmez
    await saveAnswers(ma, { ...fullAnswers(id, RAW_A), submit: false })
    expect((await getDisputeView(mb, id)).partnerEvent).toBeNull()
    await saveAnswers(ma, fullAnswers(id, RAW_A))
    const vb = await getDisputeView(mb, id)
    expect(vb.partnerEvent).toBe(RAW_A)
    expect((await buildPanel(mb)).active?.waitingForFirst).toBe(false)

    // Aynen onaylayabilir: kendi olay metni boş kalabilir
    const agreeing = {
      ...fullAnswers(id, ''),
      answers: [...fullAnswers(id, '').answers, { questionId: 'olay_onay' as const, text: '', tags: ['onay'] }],
    }
    const done = await saveAnswers(mb, agreeing)
    expect(done.status).toBe('both_answers_completed')
    await ensurePerspectives(ma, id)
    const forA = calls.find((c) => c.task === 'perspective' && c.user.includes('Ayşe (Partner B) anlatıyor'))!
    expect(forA.user).toContain('partnerinin olay anlatımını okudu ve aynen onayladı')
  })

  it('ikinci anlatan onaylamazsa kısa da olsa ekleme yazmalı; ekleme istemde ayrı etiketlenir', async () => {
    const { ma, mb } = await pair()
    const { id } = await createDispute(ma, 'Kutlama')
    await saveAnswers(ma, fullAnswers(id, RAW_A))
    expect((await buildPanel(mb)).active?.waitingForFirst).toBe(false)
    await expect(saveAnswers(mb, fullAnswers(id, 'kısa'))).rejects.toThrow(/\[VALIDATION\]/)
    const adding = fullAnswers(id, 'Ben biraz farklı hatırlıyorum')
    await saveAnswers(mb, {
      ...adding,
      answers: [...adding.answers, { questionId: 'olay_onay' as const, text: '', tags: [] }],
    })
    await ensurePerspectives(ma, id)
    const forA = calls.find((c) => c.task === 'perspective' && c.user.includes('Ayşe (Partner B) anlatıyor'))!
    expect(forA.user).toContain('kendi eklediği / düzelttiği')
  })

  it('panelde ikinci partner sırasını bekler', async () => {
    const { ma, mb } = await pair()
    await createDispute(ma, 'Kutlama')
    expect((await buildPanel(mb)).active?.waitingForFirst).toBe(true)
    expect((await buildPanel(ma)).active?.waitingForFirst).toBe(false)
  })

  it('ihtiyaç seçimi zorunlu ve en fazla 5', async () => {
    const { ma } = await pair()
    const { id } = await createDispute(ma, 'İhtiyaç')
    const base = fullAnswers(id, RAW_A)
    const withNeeds = (tags: string[]) => ({
      ...base,
      submit: false,
      answers: base.answers.map((a) => (a.questionId === 'ihtiyac' ? { ...a, tags } : a)),
    })
    const v = await saveAnswers(
      ma,
      withNeeds(['duyulmak', 'anlasilmak', 'onemsenmek', 'saygi', 'takdir', 'kabul', 'uydurma']),
    )
    expect(v.mine.answers.ihtiyac.tags).toEqual(['duyulmak', 'anlasilmak', 'onemsenmek', 'saygi', 'takdir'])
    await expect(saveAnswers(ma, { ...withNeeds([]), submit: true })).rejects.toThrow(/ihtiyaç/)
    await ensurePerspectives(ma, id).catch(() => {})
  })
})
