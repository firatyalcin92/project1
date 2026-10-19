import '@tanstack/react-start/server-only'
import { LIMITS } from '~/lib/questions'
import { OVERVIEW_THRESHOLD } from '~/lib/status'
import type { PanelView, SessionResult } from '~/lib/views'
import type { AuthedMember } from './auth.server'
import { generateCoupleCode, generateMemberToken, hashMemberToken } from './crypto.server'
import { fail } from './errors.server'
import { deletionFor, membershipFor } from './account.server'
import type { Identity } from './identity.server'
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

async function issueMember(couple: CoupleRow, role: 'A' | 'B', displayName: string, identity: Identity | null) {
  const store = await getStore()
  const token = generateMemberToken()
  // Bu hesap zaten bir çifte bağlıysa yeni üye hesapsız başlar (iki çifte aynı hesap bağlanamaz).
  const taken = identity ? Boolean(await store.getMemberByAuthUser(identity.userId)) : true
  const result = await store.addMember({
    couple_id: couple.id,
    role,
    display_name: displayName,
    auth_token_hash: await hashMemberToken(token),
    ...(identity && !taken ? { auth_user_id: identity.userId, email: identity.email } : {}),
  })
  if (identity && !taken && result !== 'role_taken') {
    await store.claimOrphanSubscriptions(identity.userId, couple.id, result.id, new Date().toISOString())
  }
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
  /** Giriş yapmış ama kaydı olmayan kişi: hesap yeni üyeye bağlanır. */
  identity?: Identity | null
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

  const { token, result } = await issueMember(couple, 'A', displayName, input.identity ?? null)
  if (result === 'role_taken') return fail('INTERNAL', 'Çift oluşturulamadı. Lütfen tekrar dene.')
  return session(token, result, couple)
}

/** Davet linkini açan kişiye: kim davet etti, hangi adla katılması bekleniyor. */
export async function invitePreview(rawCode: string) {
  const code = normalizeCode(rawCode)
  const store = await getStore()
  const couple = /^[A-HJ-NP-Z2-9]{6}$/.test(code) ? await store.getCoupleByCode(code) : null
  if (!couple || couple.mode === 'solo') return null
  const members = await store.listMembers(couple.id)
  if (members.some((m) => m.role === 'B')) return null
  const inviter = members.find((m) => m.role === 'A')
  return { inviter: inviter?.display_name ?? null, suggestedName: couple.partner_name }
}

export async function joinCouple(input: {
  code: string
  displayName: string
  identity?: Identity | null
}): Promise<SessionResult> {
  const code = normalizeCode(input.code)
  const displayName = cleanName(input.displayName, LIMITS.displayName, 'Adınız')
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) fail('VALIDATION', 'Davet kodu 6 karakterden oluşur (ör. WWPX6G).')

  const store = await getStore()
  const couple = await store.getCoupleByCode(code)
  if (!couple || couple.mode === 'solo')
    return fail('NOT_FOUND', 'Bu kodla bir çift bulamadık. Harfleri kontrol eder misiniz?')

  const members = await store.listMembers(couple.id)
  if (members.some((m) => m.role === 'B')) {
    // Kod yalnızca bir kez eşleştirir: bir şifre değildir, bu yüzden dolu bir çifte erişim vermez.
    return fail(
      'CONFLICT',
      'Bu davet zaten kullanılmış. Daha önce katıldıysanız “Giriş yap” ile hesabınıza dönebilirsiniz.',
    )
  }

  const { token, result } = await issueMember(couple, 'B', displayName, input.identity ?? null)
  if (result === 'role_taken') {
    return fail(
      'CONFLICT',
      'Bu davet az önce kullanıldı. Daha önce katıldıysanız “Giriş yap” ile hesabınıza dönebilirsiniz.',
    )
  }
  return session(token, result, couple)
}

// ---------------------------------------------------------------------------
// Hesap: kaydet ya da giriş yap
// ---------------------------------------------------------------------------

export type SignInResult =
  /** Bu cihazdaki (hesapsız) kayıtlar hesaba bağlandı; oturum aynı kalır */
  | { status: 'linked'; email: string | null }
  /** Hesaba bağlı kayıtlara giriş yapıldı; yeni oturum */
  | { status: 'signed_in'; session: SessionResult }
  /** Bu hesapla kayıt yok: adlar yazılınca hesap bağlanır (bilet 30 dk geçerli) */
  | { status: 'no_account'; ticket: string; email: string | null }

/**
 * Doğrulanmış hesapla ne yapılacağına karar verir.
 * - Bu hesaba bağlı bir üye varsa ona giriş yapılır (diğer cihazdaki oturum kapanır).
 * - Yoksa ve bu cihazda hesapsız bir üye varsa, kayıtları bu hesaba bağlanır.
 * - Hiçbiri yoksa yeni başlangıç için bilet döner.
 */
export async function signIn(
  identity: Identity,
  current: AuthedMember | null,
  ticketFor: (i: Identity) => string,
): Promise<SignInResult> {
  const store = await getStore()
  const existing = await store.getMemberByAuthUser(identity.userId)

  if (existing && existing.id !== current?.id) {
    const couple = await store.getCouple(existing.couple_id)
    if (!couple) return fail('UNAUTHORIZED', 'Hesabınıza bağlı kayıt bulunamadı.')
    const token = generateMemberToken()
    await store.setMemberTokenHash(existing.id, await hashMemberToken(token))
    return { status: 'signed_in', session: session(token, existing, couple) }
  }

  if (current) {
    const row = (await store.listMembers(current.coupleId)).find((m) => m.id === current.id)
    if (row?.auth_user_id && row.auth_user_id !== identity.userId)
      fail('CONFLICT', 'Bu cihazdaki kayıtlar başka bir hesaba bağlı.')
    if ((await store.linkMemberAuth(current.id, identity.userId, identity.email)) === 'taken')
      fail('CONFLICT', 'Bu hesap başka kayıtlara bağlı.')
    await store.claimOrphanSubscriptions(identity.userId, current.coupleId, current.id, new Date().toISOString())
    return { status: 'linked', email: identity.email }
  }

  return { status: 'no_account', ticket: ticketFor(identity), email: identity.email }
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
    account: { saved: Boolean(me.auth_user_id), email: me.email },
  }
}
