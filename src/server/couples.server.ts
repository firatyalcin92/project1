import '@tanstack/react-start/server-only'
import { LIMITS } from '~/lib/questions'
import { OVERVIEW_THRESHOLD } from '~/lib/status'
import type { PanelView, SessionResult } from '~/lib/views'
import type { AuthedMember } from './auth.server'
import { authenticateMember } from './auth.server'
import { generateCoupleCode, generateMemberToken, hashMemberToken } from './crypto.server'
import { fail } from './errors.server'
import { activeSummary, summarize } from './disputes.server'
import { overviewStatus } from './overview.server'
import { getStore, type CoupleRow, type MemberRow } from './store.server'

function cleanName(raw: string, max: number, label: string) {
  const name = raw.replace(/\s+/g, ' ').trim()
  if (name.length < 1) fail('VALIDATION', `${label} boş kalamaz.`)
  if (name.length > max) fail('VALIDATION', `${label} en fazla ${max} karakter olabilir.`)
  if (/[<>{}\\]/.test(name)) fail('VALIDATION', `${label} içinde özel karakter kullanma.`)
  return name
}

/** Kullanıcının yazdığı kodu normalize et: boşluk/tire temizle, büyük harfe çevir. */
export function normalizeCode(raw: string) {
  return raw.replace(/[\s-]/g, '').toUpperCase()
}

async function issueMember(couple: CoupleRow, role: 'A' | 'B', displayName: string) {
  const store = await getStore()
  const token = generateMemberToken()
  const result = await store.addMember({
    couple_id: couple.id,
    role,
    display_name: displayName,
    auth_token_hash: await hashMemberToken(token),
  })
  return { token, result }
}

function session(token: string, member: MemberRow, couple: CoupleRow): SessionResult {
  return {
    token,
    member: { id: member.id, role: member.role, name: member.display_name },
    couple: { id: couple.id, name: couple.name, code: couple.code, mode: couple.mode },
  }
}

export async function createCouple(input: {
  mode: 'couple' | 'solo'
  coupleName: string
  displayName: string
  partnerName?: string
}): Promise<SessionResult> {
  const displayName = cleanName(input.displayName, LIMITS.displayName, 'Adınız')
  const solo = input.mode === 'solo'
  const partnerName = solo ? cleanName(input.partnerName ?? '', LIMITS.displayName, 'Eşinizin adı') : null
  const coupleName = solo ? displayName : cleanName(input.coupleName, LIMITS.coupleName, 'Çift adı')
  const store = await getStore()

  let couple: CoupleRow | null = null
  for (let i = 0; i < 6 && !couple; i++) {
    const created = await store.createCouple({
      code: generateCoupleCode(),
      name: coupleName,
      mode: solo ? 'solo' : 'couple',
      partner_name: partnerName,
    })
    if (created !== 'code_taken') couple = created
  }
  if (!couple) return fail('INTERNAL', 'Kod üretilemedi. Lütfen tekrar dene.')

  const { token, result } = await issueMember(couple, 'A', displayName)
  if (result === 'role_taken') return fail('INTERNAL', 'Çift oluşturulamadı. Lütfen tekrar dene.')
  return session(token, result, couple)
}

export async function joinCouple(input: { code: string; displayName: string }): Promise<SessionResult> {
  const code = normalizeCode(input.code)
  const displayName = cleanName(input.displayName, LIMITS.displayName, 'Adınız')
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) fail('VALIDATION', 'Çift kodu 6 karakterden oluşur (ör. WWPX6G).')

  const store = await getStore()
  const couple = await store.getCoupleByCode(code)
  if (!couple || couple.mode === 'solo')
    return fail('NOT_FOUND', 'Bu kodla bir çift bulamadık. Harfleri kontrol eder misiniz?')

  const members = await store.listMembers(couple.id)
  if (members.some((m) => m.role === 'B')) {
    // Kod yalnızca bir kez eşleştirir: bir şifre değildir, bu yüzden dolu bir çifte erişim vermez.
    return fail('CONFLICT', 'Bu çift kodu zaten eşleşmiş. Kendi cihazından anahtarınla geri dönebilirsin.')
  }

  const { token, result } = await issueMember(couple, 'B', displayName)
  if (result === 'role_taken') {
    return fail('CONFLICT', 'Bu çift kodu az önce eşleşti. Kendi cihazından anahtarınla geri dönebilirsin.')
  }
  return session(token, result, couple)
}

/** Yedeklenen cihaz anahtarıyla (token) yeni bir cihazda geri dönüş. */
export async function restoreSession(token: string): Promise<SessionResult> {
  const member = await authenticateMember(token)
  const store = await getStore()
  const couple = await store.getCouple(member.coupleId)
  if (!couple) return fail('UNAUTHORIZED', 'Bu anahtar artık geçerli değil.')
  const row = (await store.listMembers(couple.id)).find((m) => m.id === member.id)!
  return session(token, row, couple)
}

export async function buildPanel(member: AuthedMember): Promise<PanelView> {
  const store = await getStore()
  const [couple, members, disputes] = await Promise.all([
    store.getCouple(member.coupleId),
    store.listMembers(member.coupleId),
    store.listDisputes(member.coupleId),
  ])
  if (!couple) return fail('UNAUTHORIZED', 'Çift bulunamadı.')
  const me = members.find((m) => m.id === member.id)!
  const partner = members.find((m) => m.id !== member.id) ?? null
  const completed = disputes.filter((d) => d.status === 'completed')

  return {
    couple: { name: couple.name, code: couple.code, mode: couple.mode },
    me: { id: me.id, role: me.role, name: me.display_name },
    partner: partner ? { id: partner.id, role: partner.role, name: partner.display_name } : null,
    partnerName: couple.mode === 'solo' ? couple.partner_name : (partner?.display_name ?? null),
    active: await activeSummary(member, disputes),
    recent: completed.slice(0, 3).map((d) => summarize(d, member.id)),
    completedCount: completed.length,
    overview: {
      threshold: OVERVIEW_THRESHOLD,
      completed: completed.length,
      status: await overviewStatus(member.coupleId, completed.length),
    },
  }
}
