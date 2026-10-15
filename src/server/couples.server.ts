import '@tanstack/react-start/server-only'
import { LIMITS } from '~/lib/questions'
import { OVERVIEW_THRESHOLD } from '~/lib/status'
import type { PanelView, SessionResult } from '~/lib/views'
import type { AuthedMember } from './auth.server'
import { authenticateMember } from './auth.server'
import { generateCoupleCode, generateMemberToken, hashMemberToken } from './crypto.server'
import { fail } from './errors.server'
import {
  deletionFor,
  generateReadableCode,
  hashReadableCode,
  membershipFor,
  normalizeReadableCode,
} from './account.server'
import { activeSummary, summarize } from './disputes.server'
import { overviewStatus } from './overview.server'
import { getStore, type CoupleRow, type MemberRow } from './store.server'

function cleanName(raw: string, max: number, label: string) {
  const name = raw.replace(/\s+/g, ' ').trim()
  if (name.length < 1) fail('VALIDATION', `${label} boş kalamaz.`)
  if (name.length > max) fail('VALIDATION', `${label} en fazla ${max} karakter olabilir.`)
  if (/[<>{}\\]/.test(name)) fail('VALIDATION', `${label} içinde özel karakter kullanma.`)
  // "fırat" -> "Fırat", "ayşe gül" -> "Ayşe Gül" (Türkçe büyük harf: i -> İ)
  return name.replace(/(^|\s)(\p{Ll})/gu, (_, sp: string, ch: string) => sp + ch.toLocaleUpperCase('tr'))
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

/** Çift adı artık sorulmaz; iki addan kendiliğinden oluşur (ör. "Fırat & Ayşe"). */
export function coupleNameFor(displayName: string, partnerName: string | null) {
  return partnerName ? `${displayName} & ${partnerName}` : displayName
}

export async function createCouple(input: {
  mode: 'couple' | 'solo'
  displayName: string
  partnerName?: string
}): Promise<SessionResult> {
  const displayName = cleanName(input.displayName, LIMITS.displayName, 'Adınız')
  const solo = input.mode === 'solo'
  const partnerName = cleanName(input.partnerName ?? '', LIMITS.displayName, 'Partnerinizin adı')
  const coupleName = solo ? displayName : coupleNameFor(displayName, partnerName)
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
    // Partner henüz katılmadıysa, çifti oluşturanın yazdığı ad kullanılır.
    partnerName: couple.mode === 'solo' ? couple.partner_name : (partner?.display_name ?? couple.partner_name),
    active: await activeSummary(member, disputes),
    recent: completed.slice(0, 3).map((d) => summarize(d, member.id)),
    completedCount: completed.length,
    overview: {
      threshold: OVERVIEW_THRESHOLD,
      completed: completed.length,
      status: await overviewStatus(member.coupleId, completed.length),
    },
    membership: await membershipFor(member.coupleId, member.id),
    deletion: await deletionFor(member.coupleId, member.id),
    recoveryPending: couple.mode === 'solo' ? null : await pendingRecoveryFor(member, members),
  }
}

// ---------------------------------------------------------------------------
// Cihazını kaybeden partner için yeniden bağlanma kodu
// ---------------------------------------------------------------------------

/**
 * Kötüye kullanıma karşı: kod üretildikten ancak bir bekleme süresi (varsayılan 12 saat) sonra çalışır.
 * Bu sürede hesap sahibinin (hâlâ açıksa) eski cihazında uyarı görünür ve iptal edebilir.
 */
const recoveryDelayMs = () => {
  // Yalnızca sunucu tarafında, işletmeci tarafından değiştirilebilir (ör. testler için 0).
  const minutes = Number(process.env.MESELE_RECOVERY_DELAY_MINUTES ?? 720)
  return Number.isFinite(minutes) && minutes >= 0 ? minutes * 60 * 1000 : 12 * 60 * 60 * 1000
}
const RECOVERY_VALID_MS = 48 * 60 * 60 * 1000

/**
 * Partnerinin cihazı kaybolduysa (anahtarı yedeklenmemişse) diğer partner ona tek
 * kullanımlık bir kod üretir. Kod çift koduyla birlikte kullanılır; eski cihazdaki
 * anahtar geçersiz olur.
 */
export async function createPartnerRecovery(member: AuthedMember) {
  const store = await getStore()
  const partner = (await store.listMembers(member.coupleId)).find((m) => m.id !== member.id)
  if (!partner) return fail('CONFLICT', 'Partneriniz henüz katılmadı.')
  const code = generateReadableCode(8)
  const delay = recoveryDelayMs()
  const usableAfter = new Date(Date.now() + delay).toISOString()
  const expiresAt = new Date(Date.now() + delay + RECOVERY_VALID_MS).toISOString()
  await store.createRecovery({
    member_id: partner.id,
    created_by: member.id,
    code_hash: await hashReadableCode(code),
    usable_after: usableAfter,
    expires_at: expiresAt,
  })
  return { code, usableAfter, expiresAt, partnerName: partner.display_name }
}

/** Hesap sahibi "bu kodu ben istemedim" der: bekleyen kodlar iptal edilir. */
export async function cancelMyRecovery(member: AuthedMember) {
  const store = await getStore()
  await store.cancelRecoveries(member.id)
  return { cancelled: true }
}

/** Bu üye için bekleyen kurtarma kodu (panelde uyarı için) */
export async function pendingRecoveryFor(member: AuthedMember, members: MemberRow[]) {
  const store = await getStore()
  const r = await store.getPendingRecovery(member.id, new Date().toISOString())
  if (!r) return null
  return {
    createdByName: members.find((m) => m.id === r.created_by)?.display_name ?? null,
    usableAfter: r.usable_after,
  }
}

export async function redeemRecovery(input: { coupleCode: string; recoveryCode: string }): Promise<SessionResult> {
  const coupleCode = normalizeCode(input.coupleCode)
  const recovery = normalizeReadableCode(input.recoveryCode)
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(coupleCode) || !/^[A-HJ-NP-Z2-9]{8}$/.test(recovery)) {
    fail('VALIDATION', 'Çift kodu 6, yeniden bağlanma kodu 8 karakterdir.')
  }
  const store = await getStore()
  const couple = await store.getCoupleByCode(coupleCode)
  const notFound = () =>
    fail('NOT_FOUND', 'Kodlar eşleşmedi ya da sürenin dolduğu görülüyor. Partnerinizden yeni bir kod isteyin.')
  if (!couple) return notFound()
  const members = await store.listMembers(couple.id)
  const ids = members.map((m) => m.id)
  const hash = await hashReadableCode(recovery)
  const at = new Date().toISOString()
  const used = await store.useRecovery(hash, ids, at)
  if (!used) {
    const waiting = await store.findRecovery(hash, ids, at)
    if (waiting && waiting.usable_after > at) {
      const when = new Date(waiting.usable_after).toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
      return fail('CONFLICT', `Güvenliğiniz için bu kod ${when} itibarıyla çalışmaya başlayacak.`)
    }
    return notFound()
  }
  const target = members.find((m) => m.id === used.member_id)
  if (!target) return notFound()
  const token = generateMemberToken()
  await store.setMemberTokenHash(target.id, await hashMemberToken(token))
  return session(token, target, couple)
}
