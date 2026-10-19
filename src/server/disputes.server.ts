import '@tanstack/react-start/server-only'
import {
  ANSWER_QUESTION_IDS,
  AGREE_TAG,
  EVENT_AGREE,
  FEELINGS,
  FEELING_MAX,
  NEEDS_MAX,
  FEELING_MIN,
  LIMITS,
  OTHER_CHIP,
  QUESTIONS,
  RECONSIDER_QUESTIONS,
  REFLECTION_ANSWER_ID,
  STRONGEST_FEELING,
  allowedChipsFor,
  feelingCount,
  strongestOptions,
  type AnswerQuestionId,
  type ReflectionId,
  FEELING_CHIPS,
  NEED_CHIPS,
} from '~/lib/questions'
import {
  MyReportSchema,
  PerspectiveSchema,
  ReflectionSchema,
  SharedReportSchema,
  type MyReport,
  type Perspective,
  type SharedReport,
} from '~/lib/report-schemas'
import {
  GENERATION_LOCK_MS,
  isAnswerPhase,
  isGenerating,
  isReconsiderPhase,
  perspectivesVisible,
  stepOf,
} from '~/lib/status'
import type {
  ActiveDisputeSummary,
  AnswerDraft,
  DisputeSummary,
  DisputeView,
  MemberInfo,
  ReconsiderationView,
} from '~/lib/views'
import { PAYWALL_MESSAGE, disputeAccess } from './account.server'
import { requireDispute, type AuthedMember } from './auth.server'
import { fail } from './errors.server'
import { generateJson } from './mesele.server'
import {
  buildMyReportPrompt,
  buildPerspectivePrompt,
  buildReflectionPrompt,
  buildSharedReportPrompt,
  buildSoloReportPrompt,
  type HistoryItem,
  type MemberMaterial,
} from './prompts.server'
import {
  getStore,
  type AnswerRow,
  type CoupleRow,
  type DisputeRow,
  type EntryRow,
  type MemberRow,
  type ReconsiderationRow,
  type Reflections,
  type ReportRow,
} from './store.server'

/**
 * Dil kuralı (v2): Gizlilik seçeneği yok; ama partnerin ham cevapları bu dosyadan
 * istemciye ASLA dönmez. Partner yalnızca danışmanın ihtiyaç diliyle yazdığı
 * metinleri ("…'nın Gözünden", raporlar) görür.
 */

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

const toInfo = (m: MemberRow): MemberInfo => ({ id: m.id, role: m.role, name: m.display_name })

function isLockStale(lockedAt: string | null) {
  return !lockedAt || Date.parse(lockedAt) < Date.now() - GENERATION_LOCK_MS
}

export function summarize(d: DisputeRow, memberId: string): DisputeSummary {
  return {
    id: d.id,
    title: d.title,
    status: d.status,
    step: stepOf(d.status),
    createdAt: d.created_at,
    completedAt: d.completed_at,
    createdByMe: d.created_by === memberId,
  }
}

type Bundle = {
  dispute: DisputeRow
  couple: CoupleRow
  members: MemberRow[]
  entries: EntryRow[]
  answers: AnswerRow[]
  reconsiderations: ReconsiderationRow[]
}

async function loadBundle(d: DisputeRow): Promise<Bundle> {
  const store = await getStore()
  const [couple, members, entries, answers, reconsiderations] = await Promise.all([
    store.getCouple(d.couple_id),
    store.listMembers(d.couple_id),
    store.getEntries([d.id]),
    store.getAnswers([d.id]),
    store.getReconsiderations([d.id]),
  ])
  if (!couple) return fail('NOT_FOUND', 'Aradığınız mesele bulunamadı.')
  return { dispute: d, couple, members, entries, answers, reconsiderations }
}

/**
 * Çift modunda meseleyi önce açan anlatır; diğeri ancak o bitirince başlar ve ilk
 * anlatımı görüp onaylayabilir ya da ekleme yapabilir.
 */
export type AnswerOrder = 'first' | 'second' | 'solo'

function orderOf(memberId: string, b: Pick<Bundle, 'couple' | 'dispute' | 'members'>): AnswerOrder {
  if (b.couple.mode === 'solo') return 'solo'
  const firstId = b.dispute.created_by ?? b.members.find((m) => m.role === 'A')?.id
  return firstId === memberId ? 'first' : 'second'
}

function materialFor(member: MemberRow, b: Bundle): MemberMaterial {
  const entry = b.entries.find((e) => e.member_id === member.id) ?? null
  return {
    order: orderOf(member.id, b),
    memberId: member.id,
    role: member.role,
    name: member.display_name,
    entry,
    answers: b.answers.filter((a) => a.member_id === member.id),
    reconsideration: b.reconsiderations.find((r) => r.member_id === member.id) ?? null,
  }
}

function emptyAnswers(): Record<AnswerQuestionId, AnswerDraft> {
  const out = {} as Record<AnswerQuestionId, AnswerDraft>
  for (const id of ANSWER_QUESTION_IDS) out[id] = { text: '', tags: [] }
  return out
}

function emptyReflections(): ReconsiderationView['items'] {
  return Object.fromEntries(RECONSIDER_QUESTIONS.map((q) => [q.id, { text: '' }])) as ReconsiderationView['items']
}

function partnerNameOf(b: Bundle, member: AuthedMember) {
  if (b.couple.mode === 'solo') return b.couple.partner_name
  return b.members.find((m) => m.id !== member.id)?.display_name ?? b.couple.partner_name
}

// ---------------------------------------------------------------------------
// Görünüm
// ---------------------------------------------------------------------------

export async function getDisputeView(member: AuthedMember, disputeId: string): Promise<DisputeView> {
  const dispute = await requireDispute(member, disputeId)
  const store = await getStore()
  const bundle = await loadBundle(dispute)
  const [reports, access] = await Promise.all([
    dispute.status === 'completed' ? store.getReports(dispute.id) : Promise.resolve([]),
    disputeAccess(dispute),
  ])
  return buildView(member, dispute, bundle, reports, access)
}

function buildView(
  member: AuthedMember,
  d: DisputeRow,
  b: Bundle,
  reports: ReportRow[],
  access: { free: boolean; paywall: boolean },
): DisputeView {
  const solo = b.couple.mode === 'solo'
  const me = b.members.find((m) => m.id === member.id)!
  const partner = solo ? null : (b.members.find((m) => m.id !== member.id) ?? null)

  const myEntry = b.entries.find((e) => e.member_id === member.id)
  const partnerEntry = partner ? b.entries.find((e) => e.member_id === partner.id) : undefined
  const myRec = b.reconsiderations.find((r) => r.member_id === member.id)
  const partnerRec = partner ? b.reconsiderations.find((r) => r.member_id === partner.id) : undefined

  // Yalnızca KENDİ cevapları döner.
  const answers = emptyAnswers()
  let reflection = ''
  let suggestions = { feelings: [] as string[], needs: [] as string[] }
  for (const a of b.answers) {
    if (a.member_id !== member.id) continue
    if (a.question_id === REFLECTION_ANSWER_ID) {
      reflection = a.text_answer
      suggestions = suggestionsFromTags(a.selected_tags)
    } else if ((ANSWER_QUESTION_IDS as readonly string[]).includes(a.question_id)) {
      answers[a.question_id as AnswerQuestionId] = { text: a.text_answer, tags: a.selected_tags }
    }
  }

  const items = emptyReflections()
  if (myRec) {
    for (const q of RECONSIDER_QUESTIONS) {
      const item = myRec.reflections.items?.[q.id]
      if (item) items[q.id] = { text: item.text }
    }
  }

  // Partnerin Gözünden: yalnızca AI metni; ham cevaplar asla.
  const partnerView: DisputeView['partnerView'] =
    partner && perspectivesVisible(d.status)
      ? { perspective: (partnerEntry?.perspective as Perspective | null) ?? null }
      : null

  let report: DisputeView['report'] = null
  if (d.status === 'completed') {
    const mine = (reports.find((r) => r.member_id === member.id)?.my_report as MyReport | undefined) ?? null
    if (solo) {
      report = { mine, shared: null }
    } else {
      const approvedByMe = me.role === 'A' ? d.shared_approved_a : d.shared_approved_b
      const approvedByPartner = me.role === 'A' ? d.shared_approved_b : d.shared_approved_a
      const unlocked = d.shared_approved_a && d.shared_approved_b
      report = {
        mine,
        shared: {
          approvedByMe,
          approvedByPartner,
          unlocked,
          // İki partner de onaylayana kadar ortak rapor istemciye gönderilmez.
          report: unlocked ? ((d.shared_report as SharedReport | null) ?? null) : null,
        },
      }
    }
  }

  const order = orderOf(member.id, b)
  return {
    ...summarize(d, member.id),
    canCancel: d.created_by === member.id && isAnswerPhase(d.status),
    mode: b.couple.mode,
    freeDispute: access.free,
    // Kilit yalnızca anlatma adımında anlamlıdır; gönderilmiş anlatımlar sonraki adımlara geçer.
    paywall: access.paywall && isAnswerPhase(d.status) && !myEntry?.submitted_at,
    answerOrder: order,
    // Yalnızca 1. soru: ilk anlatan bitirdiyse ikinci anlatan onun olay anlatımını görür.
    partnerEvent: order === 'second' && partnerEntry?.submitted_at ? partnerEntry.what_happened || null : null,
    me: toInfo(me),
    partner: partner ? toInfo(partner) : null,
    partnerName: partnerNameOf(b, member),
    progress: {
      meSubmitted: Boolean(myEntry?.submitted_at),
      partnerSubmitted: Boolean(partnerEntry?.submitted_at),
      // Yalnızca "başladı mı" bilgisi; içerik asla.
      partnerStarted: Boolean(
        partner &&
        (partnerEntry?.what_happened.trim() ||
          b.answers.some((a) => a.member_id === partner.id && a.question_id !== REFLECTION_ANSWER_ID)),
      ),
      meReconsidered: Boolean(myRec?.submitted_at),
      partnerReconsidered: Boolean(partnerRec?.submitted_at),
    },
    generation: {
      active: isGenerating(d.status),
      stale: isGenerating(d.status) && isLockStale(d.status_locked_at),
    },
    mine: {
      whatHappened: myEntry?.what_happened ?? '',
      answers,
      reflection,
      suggestions,
      submittedAt: myEntry?.submitted_at ?? null,
    },
    partnerView,
    myPerspective: perspectivesVisible(d.status) ? ((myEntry?.perspective as Perspective | null) ?? null) : null,
    myReconsideration: {
      items,
      closeness: myRec?.reflections.closeness ?? null,
      submittedAt: myRec?.submitted_at ?? null,
    },
    report,
  }
}

// ---------------------------------------------------------------------------
// Liste ve oluşturma
// ---------------------------------------------------------------------------

export async function listDisputeSummaries(member: AuthedMember): Promise<DisputeSummary[]> {
  const store = await getStore()
  const rows = await store.listDisputes(member.coupleId)
  return rows.map((d) => summarize(d, member.id))
}

export async function activeSummary(
  member: AuthedMember,
  disputes: DisputeRow[],
): Promise<ActiveDisputeSummary | null> {
  const active = disputes.find((d) => d.status !== 'completed')
  if (!active) return null
  const store = await getStore()
  const phase = stepOf(active.status)
  let meDone = false
  let partnerDone = false
  let waitingForFirst = false
  if (phase === 1) {
    const entries = await store.getEntries([active.id])
    meDone = entries.some((e) => e.member_id === member.id && e.submitted_at)
    partnerDone = entries.some((e) => e.member_id !== member.id && e.submitted_at)
    const [couple, members] = await Promise.all([
      store.getCouple(active.couple_id),
      store.listMembers(active.couple_id),
    ])
    const second = couple ? orderOf(member.id, { couple, dispute: active, members }) === 'second' : false
    waitingForFirst = second && !partnerDone && !entries.some((e) => e.member_id === member.id)
  } else if (phase === 3) {
    const recs = await store.getReconsiderations([active.id])
    meDone = recs.some((r) => r.member_id === member.id && r.submitted_at)
    partnerDone = recs.some((r) => r.member_id !== member.id && r.submitted_at)
  } else {
    meDone = partnerDone = true
  }
  return { ...summarize(active, member.id), meDone, partnerDone, waitingForFirst }
}

/** Başlık sorulmaz: ilk anlatanın 1. sorusundan yapay zekâ kısa bir ad çıkarır. */
export const DEFAULT_TITLE = 'Yeni mesele'

function cleanTitle(raw: string) {
  return raw
    .replace(/["“”«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!]+$/, '')
    .slice(0, LIMITS.title)
}

/** Yapay zekâ ad veremediyse: "19 Ekim meselesi" */
function dateTitle() {
  const day = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }).format(
    new Date(),
  )
  return `${day} meselesi`
}

export async function createDispute(member: AuthedMember, title?: string): Promise<{ id: string }> {
  const store = await getStore()
  const clean = cleanTitle(title ?? '') || DEFAULT_TITLE
  const existing = await store.listDisputes(member.coupleId)
  const open = existing.find((d) => d.status !== 'completed')
  if (open) fail('CONFLICT', `Önce açık olan "${open.title}" meselesini tamamlayalım.`)
  // Ücretsiz hak bitse de mesele açılır; 1. sorudan sonrası için üyelik istenir (saveAnswers).
  const d = await store.createDispute({
    couple_id: member.coupleId,
    created_by: member.id,
    title: clean,
  })
  return { id: d.id }
}

export async function cancelDispute(member: AuthedMember, disputeId: string) {
  const d = await requireDispute(member, disputeId)
  if (d.created_by !== member.id || !isAnswerPhase(d.status)) {
    fail('CONFLICT', 'Bu mesele artık kapatılamaz; tamamlanan ve ilerleyen meseleler arşivde korunur.')
  }
  const store = await getStore()
  await store.deleteDispute(d.id)
}

// ---------------------------------------------------------------------------
// 1. Adım: Anlat
// ---------------------------------------------------------------------------

export type SaveAnswersInput = {
  disputeId: string
  whatHappened: string
  answers: { questionId: AnswerQuestionId; text: string; tags: string[] }[]
  submit: boolean
}

async function assertCanAnswer(member: AuthedMember, disputeId: string) {
  const d = await requireDispute(member, disputeId)
  if (!isAnswerPhase(d.status)) fail('CONFLICT', 'Bu meselede anlatma adımı tamamlandı.')
  const store = await getStore()
  const entries = await store.getEntries([d.id])
  const entry = entries.find((e) => e.member_id === member.id)
  if (entry?.submitted_at) fail('CONFLICT', 'Anlatımınızı zaten gönderdiniz.')
  // Sırayla anlatım: ikinci anlatan, ilk anlatan bitirene kadar başlayamaz (önceden taslağı varsa dokunulmaz).
  const [couple, members] = await Promise.all([store.getCouple(d.couple_id), store.listMembers(d.couple_id)])
  if (couple && orderOf(member.id, { couple, dispute: d, members }) === 'second' && !entry) {
    const first = members.find((m) => m.id !== member.id)
    const firstDone = entries.some((e) => e.member_id === first?.id && e.submitted_at)
    if (!firstDone) {
      fail(
        'CONFLICT',
        `Önce ${first?.display_name ?? 'partneriniz'} anlatmayı bitirmeli; bitirdiğinde sıra size gelecek.`,
      )
    }
  }
  return d
}

type AnswerInput = SaveAnswersInput['answers'][number]

/**
 * Çipleri izinli listeyle sınırla, metinleri kırp.
 * - His listesinde "başka bir şey" seçili değilse metin tutulmaz; en fazla 7 his tutulur.
 * - En çok etkileyen his tek seçimdir ve aynı gönderimde his listesinde
 *   işaretlenmiş olmalıdır; değilse seçim düşer (nedeni korunur).
 */
export function normalizeAnswers(input: AnswerInput[]): AnswerInput[] {
  const byId = new Map<string, AnswerInput>()
  for (const a of input) {
    const allowed = allowedChipsFor(a.questionId)
    let tags = [...new Set(a.tags)].filter((t) => allowed.includes(t))
    let text = a.text.trim()
    if (a.questionId === FEELINGS) {
      tags = tags.slice(0, FEELING_MAX) // en fazla 7 his ("başka bir şey" de bir sayılır)
      text = tags.includes(OTHER_CHIP) ? text.slice(0, LIMITS.other) : ''
      if (!text) tags = tags.filter((t) => t !== OTHER_CHIP)
    } else {
      text = text.slice(0, LIMITS.text)
    }
    if (a.questionId === 'ihtiyac') tags = tags.slice(0, NEEDS_MAX)
    byId.set(a.questionId, { questionId: a.questionId, text, tags })
  }

  const strongest = byId.get(STRONGEST_FEELING)
  if (strongest) {
    const options = strongestOptions({ [FEELINGS]: byId.get(FEELINGS) ?? { tags: [], text: '' } })
    const pick = strongest.tags.find((t) => options.some((o) => o.id === t))
    strongest.tags = pick ? [pick] : []
  }
  return [...byId.values()]
}

export async function saveAnswers(member: AuthedMember, input: SaveAnswersInput): Promise<DisputeView> {
  const d = await assertCanAnswer(member, input.disputeId)
  const store = await getStore()

  const whatHappened = input.whatHappened.trim().slice(0, LIMITS.text)
  let answers = normalizeAnswers(input.answers)

  // Üyelik gerekiyorsa yalnızca 1. soru (olay / onay) kaydedilir; gönderim için üyelik şart.
  const { paywall } = await disputeAccess(d)
  if (paywall) {
    if (input.submit) fail('PAYMENT_REQUIRED', PAYWALL_MESSAGE)
    answers = answers.filter((a) => a.questionId === EVENT_AGREE)
  }

  if (input.submit) {
    const olay = QUESTIONS.find((q) => q.id === 'olay')!
    const find = (id: string) => answers.find((x) => x.questionId === id)
    const second = (await loadBundle(d).then((b) => orderOf(member.id, b))) === 'second'
    const agreed = second && Boolean(find(EVENT_AGREE)?.tags.includes(AGREE_TAG))
    // İkinci anlatan ilk anlatımı aynen onaylayabilir ya da kısa da olsa ekleme yapar.
    if (!agreed && whatHappened.length < (second ? 10 : olay.minLength))
      fail('VALIDATION', 'Olayı biraz daha anlatır mısınız? Birkaç cümle yeterli.')
    for (const q of QUESTIONS) {
      if (q.id === 'olay') continue
      const a = find(q.id)
      if (q.textRequired && !(a && a.text.length >= q.minLength))
        fail('VALIDATION', `"${q.title}" sorusunu biraz açar mısınız?`)
      if (q.chipsRequired && !a?.tags.length)
        fail('VALIDATION', q.chipsError?.replace('Devam etmek için', 'Lütfen') ?? 'Bir seçim yapar mısınız?')
    }
    const feelings = find(FEELINGS)
    if (!feelings || feelingCount(feelings) < FEELING_MIN)
      fail('VALIDATION', 'Hissettiklerinizden en az birini seçer misiniz?')
    if (find(STRONGEST_FEELING)?.tags.length !== 1) fail('VALIDATION', 'Sizi en çok etkileyen hissi seçer misiniz?')
  }

  if (input.submit && d.title === DEFAULT_TITLE) await store.setDisputeTitle(d.id, dateTitle())

  await store.upsertEntry({
    dispute_id: d.id,
    member_id: member.id,
    what_happened: whatHappened,
    event_visibility: 'partner',
    ...(input.submit ? { submitted_at: new Date().toISOString() } : {}),
  })
  await store.upsertAnswers(
    answers.map((a) => ({
      dispute_id: d.id,
      member_id: member.id,
      question_id: a.questionId,
      text_answer: a.text,
      selected_tags: a.tags,
      visibility: 'partner' as const,
    })),
  )
  await store.syncProgress(d.id)
  return getDisputeView(member, d.id)
}

/** 3. sorudan önce: danışmanın kısa yansıtması. Hızlı modelle üretilir ve saklanır. */
export async function reflectAnswers(
  member: AuthedMember,
  input: { disputeId: string; whatHappened: string; thought: string },
): Promise<{ reflection: string; suggestions: { feelings: string[]; needs: string[] } }> {
  const d = await assertCanAnswer(member, input.disputeId)
  if ((await disputeAccess(d)).paywall) fail('PAYMENT_REQUIRED', PAYWALL_MESSAGE)
  const bundle = await loadBundle(d)
  let whatHappened = input.whatHappened.trim().slice(0, LIMITS.text)
  // İkinci anlatan: ilk anlatanın olay anlatımı ortak zemindir; kendi eklemesi varsa ona eklenir.
  if (orderOf(member.id, bundle) === 'second') {
    const first = bundle.entries.find((e) => e.member_id !== member.id && e.submitted_at)
    if (first?.what_happened)
      whatHappened = [first.what_happened, whatHappened && `Kendi eklemesi: ${whatHappened}`]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, LIMITS.text)
  }
  const thought = input.thought.trim().slice(0, LIMITS.text)
  if (whatHappened.length < 20 || thought.length < 3) {
    fail('VALIDATION', 'Önce ilk iki soruyu biraz anlatır mısınız?')
  }
  const prompt = buildReflectionPrompt({
    name: member.name,
    partnerName: partnerNameOf(bundle, member) ?? '',
    whatHappened,
    thought,
  })
  const { reflection, title, suggestedFeelings, suggestedNeeds } = await generateJson({
    task: 'reflection',
    schema: ReflectionSchema,
    system: prompt.system,
    user: prompt.user,
    speed: 'fast',
    mockContext: { owner: member.name },
  })
  const store = await getStore()
  // Meseleye adı ilk anlatanın yansıtmasıyla birlikte verilir.
  if (d.title === DEFAULT_TITLE && orderOf(member.id, bundle) !== 'second' && cleanTitle(title).length >= 2) {
    await store.setDisputeTitle(d.id, cleanTitle(title))
  }
  await store.upsertAnswers([
    {
      dispute_id: d.id,
      member_id: member.id,
      question_id: REFLECTION_ANSWER_ID,
      text_answer: reflection.slice(0, LIMITS.reflection),
      // Önerilen his ve ihtiyaçlar yansıtmanın yanında saklanır (f:… / n:…).
      selected_tags: [
        ...suggestedFeelings
          .filter((id) => FEELING_IDS.includes(id))
          .slice(0, 4)
          .map((id) => `f:${id}`),
        ...suggestedNeeds
          .filter((id) => NEED_IDS.includes(id))
          .slice(0, 4)
          .map((id) => `n:${id}`),
      ],
      visibility: 'partner',
    },
  ])
  return {
    reflection,
    suggestions: suggestionsFromTags([
      ...suggestedFeelings.map((x) => `f:${x}`),
      ...suggestedNeeds.map((x) => `n:${x}`),
    ]),
  }
}

const FEELING_IDS: readonly string[] = FEELING_CHIPS.map((c) => c.id)
const NEED_IDS: readonly string[] = NEED_CHIPS.map((c) => c.id)

/** Yapay zekânın anlatılana göre önerdiği hisler ve ihtiyaçlar (yalnızca listedekiler). */
function suggestionsFromTags(tags: readonly string[]) {
  const pick = (prefix: string, allowed: readonly string[]) =>
    [...new Set(tags.filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length)))]
      .filter((id) => allowed.includes(id))
      .slice(0, 4)
  return { feelings: pick('f:', FEELING_IDS), needs: pick('n:', NEED_IDS) }
}

// ---------------------------------------------------------------------------
// 2. Adım: Partnerinin Gözünden (AI) — yalnızca çift modu
// ---------------------------------------------------------------------------

export async function ensurePerspectives(member: AuthedMember, disputeId: string): Promise<DisputeView> {
  const d = await requireDispute(member, disputeId)
  const canStart =
    d.status === 'both_answers_completed' || (d.status === 'generating_perspectives' && isLockStale(d.status_locked_at))
  if (!canStart) return getDisputeView(member, d.id)

  const store = await getStore()
  const lock = await store.claimStatus(d.id, 'both_answers_completed', 'generating_perspectives')
  // Kilit alınamadıysa partnerin isteği zaten üretiyor: çift AI çağrısı yapılmaz.
  if (!lock) return getDisputeView(member, d.id)

  try {
    const bundle = await loadBundle(d)
    const [a, b] = bundle.members
    if (!a || !b) fail('CONFLICT', 'Partneriniz henüz katılmadı.')
    const pairs: [MemberRow, MemberRow][] = [
      [a!, b!],
      [b!, a!],
    ]
    const perspectives: Record<string, Perspective> = {}
    await Promise.all(
      pairs.map(async ([narrator, reader]) => {
        const prompt = buildPerspectivePrompt({
          title: d.title,
          narrator: materialFor(narrator, bundle),
          reader: { name: reader.display_name },
        })
        perspectives[narrator.id] = await generateJson({
          task: 'perspective',
          schema: PerspectiveSchema,
          system: prompt.system,
          user: prompt.user,
          speed: 'fast',
          mockContext: { narrator: narrator.display_name, reader: reader.display_name },
        })
      }),
    )
    const ok = await store.finishPerspectives(d.id, lock, perspectives)
    if (!ok) console.warn(`[mesele] ${d.id}: perspektif kilidi el değiştirmiş, sonuç yazılmadı.`)
  } catch (err) {
    await store.releaseStatus(d.id, lock, 'both_answers_completed')
    throw err
  }
  return getDisputeView(member, d.id)
}

// ---------------------------------------------------------------------------
// 3. Adım: Yeniden Değerlendir — yalnızca çift modu
// ---------------------------------------------------------------------------

export type SaveReconsiderationInput = {
  disputeId: string
  items: { id: ReflectionId; text: string }[]
  closeness: number | null
  submit: boolean
}

export async function saveReconsideration(member: AuthedMember, input: SaveReconsiderationInput): Promise<DisputeView> {
  const d = await requireDispute(member, input.disputeId)
  if (!isReconsiderPhase(d.status)) fail('CONFLICT', 'Bu meselede yeniden değerlendirme adımı açık değil.')

  const store = await getStore()
  const [existing] = (await store.getReconsiderations([d.id])).filter((r) => r.member_id === member.id)
  if (existing?.submitted_at) fail('CONFLICT', 'Yeniden değerlendirmenizi zaten gönderdiniz.')

  const reflections: Reflections = { items: {}, closeness: null }
  for (const q of RECONSIDER_QUESTIONS) {
    const item = input.items.find((i) => i.id === q.id)
    reflections.items[q.id] = { text: (item?.text ?? '').trim().slice(0, LIMITS.reflection), visibility: 'partner' }
  }
  if (typeof input.closeness === 'number') {
    reflections.closeness = Math.min(5, Math.max(1, Math.round(input.closeness)))
  }

  if (input.submit) {
    for (const q of RECONSIDER_QUESTIONS) {
      if (q.required && (reflections.items[q.id]?.text.length ?? 0) < 3) {
        fail('VALIDATION', 'Yeniden değerlendirme sorularını kısaca da olsa yanıtlar mısınız?')
      }
    }
  }

  await store.upsertReconsideration({
    dispute_id: d.id,
    member_id: member.id,
    reflections,
    ...(input.submit ? { submitted_at: new Date().toISOString() } : {}),
  })
  await store.syncProgress(d.id)
  return getDisputeView(member, d.id)
}

// ---------------------------------------------------------------------------
// 4. Adım: Çözüm Raporu (AI)
// ---------------------------------------------------------------------------

export async function ensureReports(member: AuthedMember, disputeId: string): Promise<DisputeView> {
  const d = await requireDispute(member, disputeId)
  const canStart =
    d.status === 'reconsideration_completed' || (d.status === 'generating_reports' && isLockStale(d.status_locked_at))
  if (!canStart) return getDisputeView(member, d.id)

  const store = await getStore()
  const lock = await store.claimStatus(d.id, 'reconsideration_completed', 'generating_reports')
  if (!lock) return getDisputeView(member, d.id)

  try {
    const bundle = await loadBundle(d)

    if (bundle.couple.mode === 'solo') {
      const owner = bundle.members[0]
      if (!owner) fail('CONFLICT', 'Hesap bulunamadı.')
      const partnerName = bundle.couple.partner_name ?? 'Eşiniz'
      const history = await historyFor(d.couple_id, d.id, [owner!.id])
      const p = buildSoloReportPrompt({
        title: d.title,
        owner: materialFor(owner!, bundle),
        partnerName,
        history: history.mine[owner!.id],
      })
      const mine = await generateJson({
        task: 'my_report',
        schema: MyReportSchema,
        system: p.system,
        user: p.user,
        mockContext: {
          owner: owner!.display_name,
          partner: partnerName,
          solo: true,
          history: history.shared[0]?.title ?? '',
        },
      })
      const ok = await store.finishReports(d.id, lock, null, { [owner!.id]: mine })
      if (!ok) console.warn(`[mesele] ${d.id}: rapor kilidi el değiştirmiş, sonuç yazılmadı.`)
      return getDisputeView(member, d.id)
    }

    const a = bundle.members.find((m) => m.role === 'A')
    const b = bundle.members.find((m) => m.role === 'B')
    if (!a || !b) fail('CONFLICT', 'Partneriniz henüz katılmadı.')
    const matA = materialFor(a!, bundle)
    const matB = materialFor(b!, bundle)

    // Önce ortak rapor: kişisel raporlar onu tekrar etmesin diye ona bakar.
    const history = await historyFor(d.couple_id, d.id, [a!.id, b!.id])
    const sharedPrompt = buildSharedReportPrompt({ title: d.title, a: matA, b: matB, history: history.shared })
    const shared = await generateJson({
      task: 'shared_report',
      schema: SharedReportSchema,
      system: sharedPrompt.system,
      user: sharedPrompt.user,
      mockContext: { a: a!.display_name, b: b!.display_name, history: history.shared[0]?.title ?? '' },
    })

    const [mineA, mineB] = await Promise.all(
      [
        [matA, matB],
        [matB, matA],
      ].map(([owner, partner]) => {
        const p = buildMyReportPrompt({
          title: d.title,
          owner: owner!,
          partner: partner!,
          shared,
          history: history.mine[owner!.memberId],
        })
        return generateJson({
          task: 'my_report',
          schema: MyReportSchema,
          system: p.system,
          user: p.user,
          mockContext: { owner: owner!.name, partner: partner!.name, history: history.shared[0]?.title ?? '' },
        })
      }),
    )

    const ok = await store.finishReports(d.id, lock, shared, { [a!.id]: mineA, [b!.id]: mineB })
    if (!ok) console.warn(`[mesele] ${d.id}: rapor kilidi el değiştirmiş, sonuç yazılmadı.`)
  } catch (err) {
    await store.releaseStatus(d.id, lock, 'reconsideration_completed')
    throw err
  }
  return getDisputeView(member, d.id)
}

/** Bağlam için en fazla bu kadar önceki mesele istemlere girer (en yeniler). */
const HISTORY_LIMIT = 5

/**
 * Önceki tamamlanmış meseleler: ortak rapor özeti (ikisi de okur) ve yalnızca
 * istenen üyenin kendi kişisel raporu. Partnerin kişisel raporu asla girmez.
 */
async function historyFor(coupleId: string, currentId: string, memberIds: string[]) {
  const store = await getStore()
  const done = (await store.listDisputes(coupleId))
    .filter((d) => d.id !== currentId && d.status === 'completed')
    .slice(0, HISTORY_LIMIT)
  const reports = await Promise.all(done.map((d) => store.getReports(d.id)))
  const forMember = (memberId: string | null): HistoryItem[] =>
    done.map((d, i) => ({
      title: d.title,
      completedAt: d.completed_at,
      shared: (d.shared_report as SharedReport | null) ?? null,
      mine: memberId
        ? ((reports[i]!.find((r) => r.member_id === memberId)?.my_report as MyReport | undefined) ?? null)
        : null,
    }))
  return { shared: forMember(null), mine: Object.fromEntries(memberIds.map((id) => [id, forMember(id)])) }
}

/** Ortak rapor, iki partner de "hazırım" diyene kadar kilitli kalır. */
export async function approveSharedReport(member: AuthedMember, disputeId: string): Promise<DisputeView> {
  const d = await requireDispute(member, disputeId)
  if (d.status !== 'completed') fail('CONFLICT', 'Çözüm raporu henüz hazır değil.')
  const store = await getStore()
  await store.setSharedApproval(d.id, member.role)
  return getDisputeView(member, d.id)
}
