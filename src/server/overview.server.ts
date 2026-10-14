import '@tanstack/react-start/server-only'
import { RelationshipReportSchema, type RelationshipReport, type SharedReport } from '~/lib/report-schemas'
import { GENERATION_LOCK_MS, OVERVIEW_REFRESH_EVERY, OVERVIEW_THRESHOLD } from '~/lib/status'
import type { OverviewStats, OverviewStatus, OverviewView, Role } from '~/lib/views'
import type { AuthedMember } from './auth.server'
import { fail } from './errors.server'
import { generateJson } from './mesele.server'
import { buildRelationshipPrompt, type OverviewDispute } from './prompts.server'
import { getStore, type RelationshipReportRow } from './store.server'

/** Genel Görüş istemine giren en fazla mesele sayısı (en yeniler). */
const MAX_DISPUTES_IN_PROMPT = 20

function isGeneratingFresh(row: RelationshipReportRow | null) {
  return (
    row?.status === 'generating' &&
    row.status_locked_at !== null &&
    Date.parse(row.status_locked_at) >= Date.now() - GENERATION_LOCK_MS
  )
}

export async function overviewStatus(coupleId: string, completed: number): Promise<OverviewStatus> {
  if (completed < OVERVIEW_THRESHOLD) return 'locked'
  const store = await getStore()
  const [latest, ready] = await Promise.all([
    store.getLatestRelationshipReport(coupleId),
    store.getReadyRelationshipReport(coupleId),
  ])
  if (isGeneratingFresh(latest) && !ready) return 'generating'
  if (ready) return 'ready'
  return 'available'
}

/**
 * Yalnızca paylaşılan içerikten türetilen veriler: ortak raporlar (ikisinin de
 * okuduğu) ve partnerle paylaşılmış çip seçimleri. Gizli yanıtlar ve yakınlık
 * puanları burada asla kullanılmaz.
 */
async function collect(coupleId: string) {
  const store = await getStore()
  const [members, disputes] = await Promise.all([store.listMembers(coupleId), store.listDisputes(coupleId)])
  const completed = disputes.filter((d) => d.status === 'completed')
  const ids = completed.map((d) => d.id)
  const answers = await store.getAnswers(ids)
  const roleOf = new Map(members.map((m) => [m.id, m.role] as const))

  const stats: OverviewStats = {
    emotions: { A: {}, B: {} },
    reactions: { A: {}, B: {} },
  }
  const perDispute = new Map<string, OverviewDispute['chips']>()
  for (const d of completed)
    perDispute.set(d.id, { A: { emotions: [], reactions: [] }, B: { emotions: [], reactions: [] } })

  for (const a of answers) {
    const role = roleOf.get(a.member_id)
    if (!role) continue
    // v2: tepki çipleri "dusunce" sorusunda; v1 kayıtları için "tepkiler" de sayılır.
    const bucket =
      a.question_id === 'duygular'
        ? 'emotions'
        : a.question_id === 'dusunce' || a.question_id === 'tepkiler'
          ? 'reactions'
          : null
    if (!bucket) continue
    for (const tag of a.selected_tags) {
      stats[bucket][role][tag] = (stats[bucket][role][tag] ?? 0) + 1
    }
    perDispute.get(a.dispute_id)?.[role][bucket].push(...a.selected_tags)
  }

  const couple = await store.getCouple(coupleId)
  return { members, completed, stats, perDispute, mode: couple?.mode ?? 'couple' }
}

export async function getOverview(member: AuthedMember): Promise<OverviewView> {
  const store = await getStore()
  const { members, completed, stats, mode } = await collect(member.coupleId)
  const ready = await store.getReadyRelationshipReport(member.coupleId)
  const status = await overviewStatus(member.coupleId, completed.length)
  const me = members.find((m) => m.id === member.id)!
  const partner = members.find((m) => m.id !== member.id) ?? null

  const canRefresh =
    completed.length >= OVERVIEW_THRESHOLD &&
    status !== 'generating' &&
    (!ready || completed.length - ready.dispute_count >= OVERVIEW_REFRESH_EVERY)

  return {
    mode,
    threshold: OVERVIEW_THRESHOLD,
    completed: completed.length,
    status,
    canRefresh,
    basedOn: ready?.dispute_count ?? null,
    generatedAt: ready?.unlocked_at ?? null,
    me: { id: me.id, role: me.role, name: me.display_name },
    partner: partner ? { id: partner.id, role: partner.role, name: partner.display_name } : null,
    stats,
    report: (ready?.overall_analysis as RelationshipReport | null) ?? null,
  }
}

export async function ensureOverview(member: AuthedMember): Promise<OverviewView> {
  const store = await getStore()
  const { members, completed, stats, perDispute, mode } = await collect(member.coupleId)
  if (mode === 'solo') fail('CONFLICT', 'Genel Görüş, iki partnerin birlikte kullandığı çift modunda açılır.')

  if (completed.length < OVERVIEW_THRESHOLD) {
    fail('CONFLICT', `Genel Görüş, ${OVERVIEW_THRESHOLD} mesele birlikte tamamlandığında açılır.`)
  }
  const ready = await store.getReadyRelationshipReport(member.coupleId)
  if (ready && completed.length - ready.dispute_count < OVERVIEW_REFRESH_EVERY) return getOverview(member)

  const claim = await store.claimRelationshipReport(member.coupleId, completed.length)
  if (!claim) return getOverview(member)

  try {
    const names = Object.fromEntries(members.map((m) => [m.role, m.display_name])) as Record<Role, string>
    const recent = completed.slice(0, MAX_DISPUTES_IN_PROMPT)
    const prompt = buildRelationshipPrompt({
      names,
      disputes: recent.map((d) => ({
        title: d.title,
        completedAt: d.completed_at,
        shared: (d.shared_report as SharedReport | null) ?? null,
        chips: perDispute.get(d.id)!,
      })),
      totals: {
        A: { emotions: stats.emotions.A, reactions: stats.reactions.A },
        B: { emotions: stats.emotions.B, reactions: stats.reactions.B },
      },
    })
    const analysis = await generateJson({
      task: 'relationship_report',
      schema: RelationshipReportSchema,
      system: prompt.system,
      user: prompt.user,
      mockContext: { a: names.A, b: names.B },
    })
    await store.finishRelationshipReport(claim.id, claim.lock, analysis)
  } catch (err) {
    await store.failRelationshipReport(claim.id, claim.lock)
    throw err
  }
  return getOverview(member)
}
