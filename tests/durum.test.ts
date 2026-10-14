import { describe, expect, it } from 'vitest'
// @ts-expect-error -- düz JS modülü
import { diagnose, keyKind } from '../durum.mjs'

const jwt = (role: string) => `x.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.y`
const env = (over: Record<string, string>) => ({ SUPABASE_URL: 'https://abc.supabase.co', ...over })
const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status })

describe('/durum teşhisi', () => {
  it('anahtar türünü değerini göstermeden tanır', () => {
    expect(keyKind(jwt('service_role'))).toBe('service_role')
    expect(keyKind(jwt('anon'))).toBe('anon')
    expect(keyKind('sb_secret_abc')).toBe('secret')
    expect(keyKind('sb_publishable_abc')).toBe('publishable')
    expect(keyKind(undefined)).toBe('yok')
  })

  it('yaygın kurulum hatalarını ayırt eder', async () => {
    expect((await diagnose({}, reply(200, []))).sorun).toBe('supabase_yok')
    expect(
      (
        await diagnose(
          env({ SUPABASE_URL: 'https://abc.supabase.co/rest/v1', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' }),
        )
      ).sorun,
    ).toBe('adres_hatali')
    expect((await diagnose(env({ SUPABASE_SERVICE_ROLE_KEY: jwt('anon') }))).sorun).toBe('yanlis_anahtar')
    const secret = env({ SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' })
    expect(
      (await diagnose(secret, reply(404, { code: 'PGRST205', message: "Could not find the table 'public.couples'" })))
        .sorun,
    ).toBe('tablolar_yok')
    expect(
      (await diagnose(secret, reply(400, { code: '42703', message: 'column couples.mode does not exist' }))).sorun,
    ).toBe('eksik_kurulum')
    expect((await diagnose(secret, reply(401, { message: 'Invalid API key' }))).sorun).toBe('anahtar_gecersiz')
    const down = async () => {
      throw new Error('ENOTFOUND')
    }
    expect((await diagnose(secret, down)).sorun).toBe('adres_ulasilamiyor')
  })

  it('her şey yolundaysa ok döner ve anahtarı yanıta yazmaz', async () => {
    const secret = env({ SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_GIZLI', OPENAI_API_KEY: 'sk-GIZLI' })
    const seen: Record<string, string>[] = []
    const ok = async (_url: string, init: RequestInit) => {
      seen.push(init.headers as Record<string, string>)
      return new Response('null', { status: 200 })
    }
    const r = await diagnose(secret, ok)
    expect(r).toMatchObject({ ok: true, depo: 'supabase', ai: 'openai', anahtarTuru: 'secret' })
    expect(JSON.stringify(r)).not.toContain('GIZLI')
    // Yeni tür anahtarlar Bearer olarak gönderilmez
    expect(seen[0]!.authorization).toBeUndefined()
  })
})
