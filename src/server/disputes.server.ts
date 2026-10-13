import '@tanstack/react-start/server-only'
import {
  ANSWER_QUESTION_IDS,
  LIMITS,
  QUESTIONS,
  RECONSIDER_QUESTIONS,
  allowedChipsFor,
  type AnswerQuestionId,
  type ReflectionId,
  type Visibility,
} from '~/lib/questions'
import {
  MyReportSchema,
  PerspectiveSchema,
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
import { requireDispute, type AuthedMember } from './auth.server'
import { fail } from './errors.server'
import { generateJson } from './mesele.server'
import {
  buildMyReportPrompt,
  buildPerspectivePrompt,
  buildSharedReportPrompt,
  type MemberMaterial,
} from './prompts.server'
import {
  getStore,
  type AnswerRow,
  type DisputeRow,
  type EntryRow,
  type MemberRow,
  type ReconsiderationRow,
  type Reflections,
  type ReportRow,
} from './store.server'

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
  members: MemberRow[]
  entries: EntryRow[]
  answers: AnswerRow[]
  reconsiderations: ReconsiderationRow[]
}

async function loadBundle(d: DisputeRow): Promise<Bundle> {
  const store = await getStore()
  const [members, entries, answers, reconsiderations] = await Promise.all([
    store.listMembers(d.couple_id),
    store.getEntries([d.id]),
    store.getAnswers([d.id]),
    store.getReconsiderations([d.id]),
  ])
  return { members, entries, answers, reconsiderations }
}

function materialFor(member: MemberRow, b: Bundle): MemberMaterial {
  const entry = b.entries.find((e) => e.member_id === member.id) ?? null
  return {
    memberId: member.id,
    role: member.role,
    name: member.display_name,
    entry,
    answers: b.answers.filter((a) => a.member_id === member.id),
    reconsideration: b.reconsiderations.find((r) => r.member_id === member.id) ?? null,
  }
}

function emptyAnswers(): Record<AnswerQuestionId, AnswerDraft> {
  const blank = (): AnswerDraft => ({ text: '', tags: [], visibility: 'partner' })
  return { duygular: blank(), tepkiler: blank(), ihtiyac: blank(), pay: blank() }
}

function emptyReflections(): ReconsiderationView['items'] {
  return Object.fromEntries(
    RECONSIDER_QUESTIONS.map((q) => [q.id, { text: '', visibility: 'partner' as Visibility }]),
  ) as ReconsiderationView['items']
}

// ---------------------------------------------------------------------------
// Görünüm
// ---------------------------------------------------------------------------

export async function getDisputeView(member: AuthedMember, disputeId: string): Promise<DisputeView> {
  const dispute = await requireDispute(member, disputeId)
  const store = await getStore()
  const bundle = await loadBundle(dispute)
  const reports = dispute.status === 'completed' ? await store.getReports(dispute.id) : []
  return buildView(member, dispute, bundle, reports)
}

function buildView(member: AuthedMember, d: DisputeRow, b: Bundle, reports: ReportRow[]): DisputeView {
  const me = b.members.find((m) => m.id === member.id)!
  const partner = b.members.find((m) => m.id !== member.id) ?? null

  const myEntry = b.entries.find((e) => e.member_id === member.id)
  const partnerEntry = partner ? b.entries.find((e) => e.member_id === partner.id) : undefined
  const myRec = b.reconsiderations.find((r) => r.member_id === member.id)
  const partnerRec = partner ? b.reconsiderations.find((r) => r.member_id === partner.id) : undefined

  const answers = emptyAnswers()
  for (const a of b.answers) {
    if (a.member_id !== member.id || !(ANSWER_QUESTION_IDS as readonly string[]).includes(a.question_id)) continue
    answers[a.question_id as AnswerQuestionId] = {
      text: a.text_answer,
      tags: a.selected_tags,
      visibility: a.visibility,
    }
  }

  const items = emptyReflections()
  if (myRec) {
    for (const q of RECONSIDER_QUESTIONS) {
      const item = myRec.reflections.items?.[q.id]
      if (item) items[q.id] = { text: item.text, visibility: item.visibility }
    }
  }

  // --- Partnerin Gözünden: yalnızca paylaşılanlar, yalnızca perspectives_ready'den sonra ---
  let partnerView: DisputeView['partnerView'] = null
  if (partner && perspectivesVisible(d.status)) {
    const shared: NonNullable<DisputeView['partnerView']>['shared'] = { whatHappened: null, answers: {} }
    if (partnerEntry && partnerEntry.event_visibility === 'partner' && partnerEntry.what_happened.trim()) {
      shared.whatHappened = partnerEntry.what_happened
    }
    for (const a of b.answers) {
      if (a.member_id !== partner.id || a.visibility !== 'partner') continue
      if (!(ANSWER_QUESTION_IDS as readonly string[]).includes(a.question_id)) continue
      shared.answers[a.question_id as AnswerQuestionId] = { text: a.text_answer, tags: a.selected_tags }
    }
    partnerView = { perspective: (partnerEntry?.perspective as Perspective | null) ?? null, shared }
  }

  // --- Partnerin yeniden değerlendirme notları: yalnızca paylaşılanlar, yalnızca tamamlanınca ---
  let partnerReflections: DisputeView['partnerReflections'] = null
  if (d.status === 'completed' && partnerRec) {
    partnerReflections = {}
    for (const q of RECONSIDER_QUESTIONS) {
      const item = partnerRec.reflections.items?.[q.id]
      if (item && item.visibility === 'partner' && item.text.trim()) partnerReflections[q.id] = item.text
    }
  }

  let report: DisputeView['report'] = null
  if (d.status === 'completed') {
    const approvedByMe = me.role === 'A' ? d.shared_approved_a : d.shared_approved_b
    const approvedByPartner = me.role === 'A' ? d.shared_approved_b : d.shared_approved_a
    const unlocked = d.shared_approved_a && d.shared_approved_b
    report = {
      mine: (reports.find((r) => r.member_id === member.id)?.my_report as MyReport | undefined) ?? null,
      shared: {
        approvedByMe,
        approvedByPartner,
        unlocked,
        // Kırılmaz kural: iki partner de onaylayana kadar ortak rapor istemciye gönderilmez.
        report: unlocked ? ((d.shared_report as SharedReport | null) ?? null) : null,
      },
    }
  }

  return {
    ...summarize(d, member.id),
    canCancel: d.created_by === member.id && isAnswerPhase(d.status),
    me: toInfo(me),
    partner: partner ? toInfo(partner) : null,
    progress: {
      meSubmitted: Boolean(myEntry?.submitted_at),
      partnerSubmitted: Boolean(partnerEntry?.submitted_at),
      meReconsidered: Boolean(myRec?.submitted_at),
      partnerReconsidered: Boolean(partnerRec?.submitted_at),
    },
    generation: {
      active: isGenerating(d.status),
      stale: isGenerating(d.status) && isLockStale(d.status_locked_at),
    },
    mine: {
      whatHappened: myEntry?.what_happened ?? '',
      eventVisibility: myEntry?.event_visibility ?? 'partner',
      answers,
      submittedAt: myEntry?.submitted_at ?? null,
    },
    partnerView,
    myPerspective: perspectivesVisible(d.status) ? ((myEntry?.perspective as Perspective | null) ?? null) : null,
    myReconsideration: {
      items,
      closeness: myRec?.reflections.closeness ?? null,
      submittedAt: myRec?.submitted_at ?? null,
    },
    partnerReflections,
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
  if (phase === 1) {
    const entries = await store.getEntries([active.id])
    meDone = entries.some((e) => e.member_id === member.id && e.submitted_at)
    partnerDone = entries.some((e) => e.member_id !== member.id && e.submitted_at)
  } else if (phase === 3) {
    const recs = await store.getReconsiderations([active.id])
    meDone = recs.some((r) => r.member_id === member.id && r.submitted_at)
    partnerDone = recs.some((r) => r.member_id !== member.id && r.submitted_at)
  } else {
    meDone = partnerDone = true
  }
  return { ...summarize(active, member.id), meDone, partnerDone }
}

export async function createDispute(member: AuthedMember, title: string): Promise<{ id: string }> {
  const store = await getStore()
  const clean = title.replace(/\s+/g, ' ').trim()
  if (clean.length < 2) fail('VALIDATION', 'Meseleye kısa da olsa bir ad ver.')
  const existing = await store.listDisputes(member.coupleId)
  const open = existing.find((d) => d.status !== 'completed')
  if (open) {
    fail('CONFLICT', `Önce açık olan "${open.title}" meselesini birlikte tamamlayalım.`)
  }
  const d = await store.createDispute({
    couple_id: member.coupleId,
    created_by: member.id,
    title: clean.slice(0, LIMITS.title),
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
  eventVisibility: Visibility
  answers: { questionId: AnswerQuestionId; text: string; tags: string[]; visibility: Visibility }[]
  submit: boolean
}

export async function saveAnswers(member: AuthedMember, input: SaveAnswersInput): Promise<DisputeView> {
  const d = await requireDispute(member, input.disputeId)
  if (!isAnswerPhase(d.status)) fail('CONFLICT', 'Bu meselede anlatma adımı tamamlandı.')

  const store = await getStore()
  const [entry] = (await store.getEntries([d.id])).filter((e) => e.member_id === member.id)
  if (entry?.submitted_at) fail('CONFLICT', 'Anlatımını zaten gönderdin. Şimdi partnerini bekliyoruz.')

  const whatHappened = input.whatHappened.trim().slice(0, LIMITS.text)
  const answers = input.answers.map((a) => {
    const allowed = allowedChipsFor(a.questionId)
    const tags = [...new Set(a.tags)].filter((t) => allowed.includes(t))
    return { ...a, text: a.text.trim().slice(0, LIMITS.text), tags }
  })

  if (input.submit) {
    if (whatHappened.length < (QUESTIONS[0]?.minLength ?? 20)) {
      fail('VALIDATION', 'Olayı biraz daha anlatır mısın? Birkaç cümle yeterli.')
    }
    for (const q of QUESTIONS) {
      if (q.id === 'olay') continue
      const a = answers.find((x) => x.questionId === q.id)
      if (q.chipsRequired && !(a && a.tags.length > 0)) {
        fail('VALIDATION', `"${q.title}" için en az bir seçenek işaretle.`)
      }
      if (q.textRequired && !(a && a.text.length >= q.minLength)) {
        fail('VALIDATION', `"${q.title}" sorusunu biraz açar mısın?`)
      }
    }
  }

  await store.upsertEntry({
    dispute_id: d.id,
    member_id: member.id,
    what_happened: whatHappened,
    event_visibility: input.eventVisibility,
    ...(input.submit ? { submitted_at: new Date().toISOString() } : {}),
  })
  await store.upsertAnswers(
    answers.map((a) => ({
      dispute_id: d.id,
      member_id: member.id,
      question_id: a.questionId,
      text_answer: a.text,
      selected_tags: a.tags,
      visibility: a.visibility,
    })),
  )
  await store.syncProgress(d.id)
  return getDisputeView(member, d.id)
}

// ---------------------------------------------------------------------------
// 2. Adım: Partnerinin Gözünden (AI)
// ---------------------------------------------------------------------------

/** Partner hiçbir şeyi paylaşmamayı seçtiyse AI çağrılmaz; nazik bir sabit metin gösterilir. */
function quietPerspective(narrator: string, reader: string): Perspective {
  return {
    headline: `${narrator} bu kez anlatımını yalnızca danışmanla paylaşmayı seçti.`,
    story: `Bazen bir şeyi başkasına anlatmadan önce kendimize anlatmamız gerekir. ${narrator} bu meseleyi düşündü, yazdı ve şimdilik kendine sakladı.\n\nBu bir kapı kapatma değil; belki sadece biraz zamana ihtiyaç duyan bir kapı.`,
    beneath: 'Paylaşmamanın altında çoğu zaman korunma ihtiyacı yatar.',
    need: `${narrator} şu an belki de en çok, acele ettirilmemeye ihtiyaç duyuyor.`,
    readingNote: `${reader}, bunu bir ret gibi değil, güvenin yavaş yavaş inşa edildiği bir an gibi okumayı dene.`,
  }
}

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
    if (!a || !b) fail('CONFLICT', 'Partnerin henüz katılmadı.')
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
        perspectives[narrator.id] = prompt.hasContent
          ? await generateJson({
              task: 'perspective',
              schema: PerspectiveSchema,
              system: prompt.system,
              user: prompt.user,
              speed: 'fast',
              mockContext: { narrator: narrator.display_name, reader: reader.display_name },
            })
          : quietPerspective(narrator.display_name, reader.display_name)
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
// 3. Adım: Yeniden Değerlendir
// ---------------------------------------------------------------------------

export type SaveReconsiderationInput = {
  disputeId: string
  items: { id: ReflectionId; text: string; visibility: Visibility }[]
  closeness: number | null
  submit: boolean
}

export async function saveReconsideration(member: AuthedMember, input: SaveReconsiderationInput): Promise<DisputeView> {
  const d = await requireDispute(member, input.disputeId)
  if (!isReconsiderPhase(d.status)) fail('CONFLICT', 'Bu meselede yeniden değerlendirme adımı açık değil.')

  const store = await getStore()
  const [existing] = (await store.getReconsiderations([d.id])).filter((r) => r.member_id === member.id)
  if (existing?.submitted_at) fail('CONFLICT', 'Yeniden değerlendirmeni zaten gönderdin.')

  const reflections: Reflections = { items: {}, closeness: null }
  for (const q of RECONSIDER_QUESTIONS) {
    const item = input.items.find((i) => i.id === q.id)
    reflections.items[q.id] = {
      text: (item?.text ?? '').trim().slice(0, LIMITS.reflection),
      visibility: item?.visibility ?? 'partner',
    }
  }
  if (typeof input.closeness === 'number') {
    reflections.closeness = Math.min(5, Math.max(1, Math.round(input.closeness)))
  }

  if (input.submit) {
    for (const q of RECONSIDER_QUESTIONS) {
      if (q.required && (reflections.items[q.id]?.text.length ?? 0) < 3) {
        fail('VALIDATION', 'Yeniden değerlendirme sorularını kısaca da olsa yanıtlar mısın?')
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
    const a = bundle.members.find((m) => m.role === 'A')
    const b = bundle.members.find((m) => m.role === 'B')
    if (!a || !b) fail('CONFLICT', 'Partnerin henüz katılmadı.')
    const matA = materialFor(a!, bundle)
    const matB = materialFor(b!, bundle)

    // Önce ortak rapor: kişisel raporlar onunla aynı döngü dilini konuşsun.
    const sharedPrompt = buildSharedReportPrompt({ title: d.title, a: matA, b: matB })
    const shared = await generateJson({
      task: 'shared_report',
      schema: SharedReportSchema,
      system: sharedPrompt.system,
      user: sharedPrompt.user,
      mockContext: { a: a!.display_name, b: b!.display_name },
    })

    const [mineA, mineB] = await Promise.all(
      [
        [matA, matB],
        [matB, matA],
      ].map(([owner, partner]) => {
        const p = buildMyReportPrompt({ title: d.title, owner: owner!, partner: partner!, shared })
        return generateJson({
          task: 'my_report',
          schema: MyReportSchema,
          system: p.system,
          user: p.user,
          mockContext: { owner: owner!.name, partner: partner!.name },
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

/** Ortak rapor, iki partner de "hazırım" diyene kadar kilitli kalır. */
export async function approveSharedReport(member: AuthedMember, disputeId: string): Promise<DisputeView> {
  const d = await requireDispute(member, disputeId)
  if (d.status !== 'completed') fail('CONFLICT', 'Çözüm raporu henüz hazır değil.')
  const store = await getStore()
  await store.setSharedApproval(d.id, member.role)
  return getDisputeView(member, d.id)
}
