// Kurulum teşhisi: /durum adresi veritabanı (SQLite ya da Supabase), e-posta ve AI ayarlarının
// çalışıp çalışmadığını gizli bilgi göstermeden söyler. Anahtarların kendisi asla yanıta yazılmaz.
import { accessSync, constants, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Anahtarın türünü (değerini değil) tahmin et. */
export function keyKind(key) {
  if (!key) return 'yok'
  if (key.startsWith('sb_secret_')) return 'secret'
  if (key.startsWith('sb_publishable_')) return 'publishable'
  const parts = key.split('.')
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
      if (payload.role === 'service_role') return 'service_role'
      if (payload.role === 'anon') return 'anon'
    } catch {
      // çözülemeyen JWT
    }
  }
  return 'bilinmiyor'
}

const ADVICE = {
  supabase_yok:
    'Kalıcı veritabanı ayarı yok; veriler bellekte tutuluyor ve sunucu yeniden başlayınca silinir. Üretimde NODE_ENV=production olmalı (SQLite kendiliğinden açılır).',
  veritabani_acilamadi:
    'SQLite veritabanı dosyası açılamadı ya da klasöre yazılamıyor. MESELE_DATA_DIR (ya da MESELE_DB_PATH) ev dizininizde yazılabilir bir klasörü göstermeli (ör. /home/kullanici/mesele-veri).',
  ai_yok: 'OPENAI_API_KEY tanımlı değil; raporlar örnek (sahte) metinlerle üretilir. Ortam değişkenlerine OPENAI_API_KEY ekleyin.',
  adres_hatali:
    'SUPABASE_URL yalnızca https://xxxx.supabase.co biçiminde olmalı (sonunda /rest/v1 veya başka bir yol olmadan). Supabase → Project Settings → Data API → Project URL değerini kopyalayın.',
  adres_ulasilamiyor:
    'SUPABASE_URL adresine ulaşılamadı. Adresi kontrol edin; Supabase projesi duraklatılmış (paused) olabilir, Supabase panelinden "Restore" deyin.',
  yanlis_anahtar:
    'SUPABASE_SERVICE_ROLE_KEY olarak herkese açık (anon / publishable) anahtar girilmiş. Supabase → Project Settings → API Keys bölümünden "secret" (sb_secret_…) ya da "service_role" anahtarını kopyalayın.',
  anahtar_gecersiz:
    'Supabase anahtarı reddedildi. Anahtarı eksiksiz kopyaladığınızdan ve bu projeye ait olduğundan emin olun.',
  tablolar_yok:
    'Tablolar bulunamadı. Supabase → SQL Editor → New query içine supabase/kurulum.sql dosyasının tamamını yapıştırıp Run deyin.',
  eksik_kurulum:
    'Tablolar var ama kurulumun bir kısmı eksik. supabase/kurulum.sql dosyasının tamamını SQL Editor’de bir kez daha çalıştırın (mevcut veriler silinmez).',
  data_api_kapali:
    'Supabase Data API bu proje için kapalı ya da public şeması dışa açık değil. Project Settings → Data API bölümünden Data API’yi açın ve "Exposed schemas" listesinde public olduğundan emin olun.',
  guncelleme_gerekli:
    'Uygulama güncellendi ve veritabanına yeni alanlar gerekiyor (hesaplar, üyelik, silme talebi). Supabase → SQL Editor → New query içine supabase/guncelleme-hesap.sql dosyasının tamamını yapıştırıp Run deyin (mevcut veriler silinmez).',
  bilinmeyen: 'Supabase beklenmeyen bir hata döndürdü. Ayrıntıyı (kod ve mesaj) geliştiriciyle paylaşın.',
}

function classify(status, body) {
  const code = body?.code ?? ''
  const message = String(body?.message ?? '')
  if (code === 'PGRST106' || /schema must be one of/i.test(message)) return 'data_api_kapali'
  if (code === '42P01' || code === 'PGRST205' || /could not find the table|does not exist/i.test(message))
    return /column/i.test(message) ? 'eksik_kurulum' : 'tablolar_yok'
  if (code === '42703' || code === 'PGRST204' || /column/i.test(message)) return 'eksik_kurulum'
  if (code === 'PGRST202' || /could not find the function/i.test(message)) return 'eksik_kurulum'
  if (code === '42501' || /permission denied/i.test(message)) return 'yanlis_anahtar'
  if (status === 401 || status === 403 || /invalid api key|jwt|unregistered api key/i.test(message))
    return 'anahtar_gecersiz'
  return 'bilinmeyen'
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {typeof fetch} fetchImpl
 */
export async function diagnose(env = process.env, fetchImpl = fetch) {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const ai = env.MESELE_AI_PROVIDER || (env.LOVABLE_API_KEY ? 'lovable' : env.OPENAI_API_KEY ? 'openai' : 'yok')
  const result = { ok: false, depo: 'bellek', ai, anahtarTuru: keyKind(key), sorun: null, oneri: null, ayrinti: null }

  const done = (sorun, ayrinti = null) => ({ ...result, sorun, oneri: ADVICE[sorun], ayrinti })

  if (!url || !key) {
    const sqlite = env.MESELE_STORE !== 'memory' && (env.NODE_ENV === 'production' || env.MESELE_DB_PATH)
    if (!sqlite) return done('supabase_yok')
    return diagnoseSqlite(env, result, done)
  }
  result.depo = 'supabase'
  let base
  try {
    base = new URL(url)
  } catch {
    return done('adres_hatali')
  }
  if (base.protocol !== 'https:' || (base.pathname !== '/' && base.pathname !== '')) return done('adres_hatali')
  if (result.anahtarTuru === 'anon' || result.anahtarTuru === 'publishable') return done('yanlis_anahtar')

  const headers = { apikey: key, accept: 'application/json', 'content-type': 'application/json' }
  if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`

  const call = async (path, init = {}) => {
    const res = await fetchImpl(`${base.origin}/rest/v1/${path}`, { ...init, headers })
    let body = null
    try {
      body = await res.json()
    } catch {
      // gövde yok
    }
    return { res, body }
  }

  try {
    const tables = await call('couples?select=id,mode,partner_name&limit=1')
    if (!tables.res.ok) {
      return done(classify(tables.res.status, tables.body), {
        kod: tables.body?.code ?? String(tables.res.status),
        mesaj: String(tables.body?.message ?? '').slice(0, 200),
      })
    }
    // v4: hesaplar, üyelik ve silme talepleri (guncelleme-hesap.sql)
    for (const path of [
      'couple_members?select=auth_user_id&limit=1',
      'subscriptions?select=owner_user_id&limit=1',
      'deletion_requests?select=id&limit=1',
    ]) {
      const t = await call(path)
      if (!t.res.ok) {
        const kind = classify(t.res.status, t.body)
        return done(kind === 'tablolar_yok' || kind === 'eksik_kurulum' ? 'guncelleme_gerekli' : kind, {
          kod: t.body?.code ?? String(t.res.status),
          mesaj: String(t.body?.message ?? '').slice(0, 200),
        })
      }
    }
    const rpc = await call('rpc/mesele_sync_progress', {
      method: 'POST',
      body: JSON.stringify({ p_dispute_id: '00000000-0000-0000-0000-000000000000' }),
    })
    if (!rpc.res.ok) {
      return done(classify(rpc.res.status, rpc.body), {
        kod: rpc.body?.code ?? String(rpc.res.status),
        mesaj: String(rpc.body?.message ?? '').slice(0, 200),
      })
    }
  } catch {
    return done('adres_ulasilamiyor')
  }

  return { ...result, ok: true }
}

async function diagnoseSqlite(env, result, done) {
  const dbPath = env.MESELE_DB_PATH?.trim() || join(env.MESELE_DATA_DIR?.trim() || join(homedir(), 'mesele-veri'), 'mesele.db')
  result.depo = 'sqlite'
  result.eposta = env.SUPABASE_URL ? 'supabase' : env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS ? 'smtp' : 'kapali'
  result.uyarilar = []
  if (result.eposta === 'kapali') result.uyarilar.push('E-postayla giriş kapalı: SMTP_HOST, SMTP_USER ve SMTP_PASS tanımlayın.')
  try {
    mkdirSync(dirname(dbPath), { recursive: true })
    accessSync(dirname(dbPath), constants.W_OK)
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(dbPath)
    const t = db.prepare("select count(*) n from sqlite_master where type = 'table' and name = 'couples'").get()
    result.cift = t.n ? Number(db.prepare('select count(*) n from couples').get().n) : 0
    db.close()
  } catch (e) {
    return done('veritabani_acilamadi', { mesaj: String(e?.message ?? e).slice(0, 200) })
  }
  if (result.ai !== 'openai' && result.ai !== 'lovable') return done('ai_yok')
  return { ...result, ok: true }
}
