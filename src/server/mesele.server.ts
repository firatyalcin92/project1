import '@tanstack/react-start/server-only'
import type { z } from 'zod'
import { toModelJsonSchema } from '~/lib/report-schemas'
import { MeseleError } from './errors.server'

/**
 * MESELE AI katmanı.
 *
 * Sağlayıcı seçimi (öncelik sırasıyla):
 *   1. MESELE_AI_PROVIDER=openai | lovable | mock  (açıkça seçim)
 *   2. OPENAI_API_KEY varsa  -> doğrudan OpenAI
 *   3. LOVABLE_API_KEY varsa -> Lovable AI Gateway (OpenAI uyumlu)
 *   4. Geliştirme ortamında anahtar yoksa -> mock (sabit, örnek Türkçe çıktı)
 *
 * Modeller:
 *   MESELE_AI_MODEL       ana model (ortak/kişisel rapor, Genel Görüş)
 *   MESELE_AI_MODEL_FAST  hızlı model ("…'nın Gözünden" metinleri)
 *   Varsayılanlar: OpenAI -> gpt-4o / gpt-4o-mini, Lovable -> openai/gpt-5-mini
 *
 * Yapılandırılmış çıktı:
 *   MESELE_AI_STRUCTURED=json_schema | json_object
 *   OpenAI için varsayılan katı json_schema; Lovable için json_object (şema istemde verilir).
 *   Her iki durumda da yanıt zod ile doğrulanır; uymazsa bir kez onarım istenir.
 */

export type AiProviderName = 'openai' | 'lovable' | 'mock'

export type AiConfig = {
  provider: AiProviderName
  endpoint: string
  apiKey: string
  model: string
  fastModel: string
  structured: 'json_schema' | 'json_object'
  temperature: number | null
  timeoutMs: number
}

export type AiTask = 'perspective' | 'shared_report' | 'my_report' | 'relationship_report'

let warnedMock = false

export function getAiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  const explicit = env.MESELE_AI_PROVIDER?.trim().toLowerCase() as AiProviderName | undefined
  const openaiKey = env.OPENAI_API_KEY?.trim()
  const lovableKey = env.LOVABLE_API_KEY?.trim()

  let provider: AiProviderName | null = null
  if (explicit === 'mock') provider = 'mock'
  else if (explicit === 'openai') provider = openaiKey ? 'openai' : null
  else if (explicit === 'lovable') provider = lovableKey ? 'lovable' : null
  else if (openaiKey) provider = 'openai'
  else if (lovableKey) provider = 'lovable'
  else if (env.NODE_ENV !== 'production') provider = 'mock'

  if (!provider) {
    console.error('[mesele] AI sağlayıcısı yapılandırılmamış: OPENAI_API_KEY ya da LOVABLE_API_KEY tanımlayın.')
    throw new MeseleError('CONFIG', 'Danışman şu an hazır değil. Lütfen biraz sonra tekrar dene.')
  }

  const timeoutMs = Number(env.MESELE_AI_TIMEOUT_MS ?? 120_000)

  if (provider === 'mock') {
    if (!warnedMock) {
      warnedMock = true
      console.warn('[mesele] AI anahtarı yok: örnek (mock) yanıtlar kullanılıyor.')
    }
    return {
      provider,
      endpoint: '',
      apiKey: '',
      model: 'mock',
      fastModel: 'mock',
      structured: 'json_schema',
      temperature: null,
      timeoutMs,
    }
  }

  if (provider === 'openai') {
    const model = env.MESELE_AI_MODEL ?? env.OPENAI_MODEL ?? 'gpt-4o'
    return {
      provider,
      endpoint: `${(env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`,
      apiKey: openaiKey!,
      model,
      fastModel: env.MESELE_AI_MODEL_FAST ?? 'gpt-4o-mini',
      structured: (env.MESELE_AI_STRUCTURED as AiConfig['structured']) ?? 'json_schema',
      temperature: resolveTemperature(env, model),
      timeoutMs,
    }
  }

  const model = env.MESELE_AI_MODEL ?? 'openai/gpt-5-mini'
  return {
    provider,
    endpoint: env.LOVABLE_AI_URL ?? 'https://ai.gateway.lovable.dev/v1/chat/completions',
    apiKey: lovableKey!,
    model,
    fastModel: env.MESELE_AI_MODEL_FAST ?? model,
    structured: (env.MESELE_AI_STRUCTURED as AiConfig['structured']) ?? 'json_object',
    temperature: resolveTemperature(env, model),
    timeoutMs,
  }
}

/**
 * Akıl yürütme modelleri (gpt-5, o-serisi vb.) yalnızca varsayılan sıcaklığı kabul eder.
 * Sıcaklığı yalnızca açıkça istenirse ya da gpt-4 ailesinde gönderiyoruz.
 */
function resolveTemperature(env: Record<string, string | undefined>, model: string): number | null {
  if (env.MESELE_AI_TEMPERATURE) {
    const t = Number(env.MESELE_AI_TEMPERATURE)
    return Number.isFinite(t) ? t : null
  }
  return /(^|\/)gpt-4/.test(model) ? 0.7 : null
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type GenerateOptions<T> = {
  task: AiTask
  schema: z.ZodType<T>
  system: string
  user: string
  speed?: 'main' | 'fast'
  /** Mock sağlayıcısının kişiselleştirme için kullandığı bağlam (adlar vb.). */
  mockContext?: Record<string, unknown>
}

export async function generateJson<T>(opts: GenerateOptions<T>): Promise<T> {
  const config = getAiConfig()

  if (config.provider === 'mock') {
    const { mockGenerate } = await import('./ai-mock.server')
    const delay = Number(process.env.MESELE_MOCK_DELAY_MS ?? 600)
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    return opts.schema.parse(mockGenerate(opts.task, opts.mockContext ?? {}))
  }

  const model = opts.speed === 'fast' ? config.fastModel : config.model
  const jsonSchema = toModelJsonSchema(opts.schema)

  const system =
    config.structured === 'json_object'
      ? `${opts.system}\n\nYanıtın şu JSON şemasına birebir uymalı (tüm alanlar zorunlu, fazladan alan yok):\n${JSON.stringify(jsonSchema)}`
      : opts.system

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: opts.user },
  ]

  let lastIssue = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await callChat(config, model, messages, opts.task, jsonSchema)
    const parsed = safeJson(content)
    if (parsed.ok) {
      const result = opts.schema.safeParse(parsed.value)
      if (result.success) return result.data
      lastIssue = result.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join('.') || '(kök)'}: ${i.message}`)
        .join('; ')
    } else {
      lastIssue = 'Yanıt geçerli JSON değil.'
    }
    console.warn(`[mesele] ${opts.task} şemaya uymadı (deneme ${attempt + 1}): ${lastIssue}`)
    messages.push(
      { role: 'assistant', content: content.slice(0, 12_000) },
      {
        role: 'user',
        content: `Yanıtın şemaya uymadı: ${lastIssue}\nLütfen aynı içeriği şemaya birebir uyan geçerli JSON olarak yeniden ver.`,
      },
    )
  }

  throw new MeseleError('AI_UNAVAILABLE', 'Danışman bu kez toparlayamadı. Lütfen birkaç dakika sonra tekrar dene.')
}

function safeJson(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch {
    return { ok: false }
  }
}

async function callChat(
  config: AiConfig,
  model: string,
  messages: ChatMessage[],
  task: AiTask,
  jsonSchema: Record<string, unknown>,
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages,
    response_format:
      config.structured === 'json_schema'
        ? { type: 'json_schema', json_schema: { name: `mesele_${task}`, strict: true, schema: jsonSchema } }
        : { type: 'json_object' },
  }
  if (config.temperature !== null) body.temperature = config.temperature

  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutMs)
    let res: Response
    try {
      res = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timer)
      console.error(`[mesele] ${config.provider} isteği başarısız (deneme ${attempt}):`, (err as Error).message)
      if (attempt < maxAttempts) {
        await backoff(attempt)
        continue
      }
      throw new MeseleError('AI_UNAVAILABLE', 'Danışmana şu an ulaşılamıyor. Lütfen biraz sonra tekrar dene.')
    }
    clearTimeout(timer)

    if (res.ok) {
      const json = (await res.json()) as {
        choices?: { message?: { content?: string | null; refusal?: string | null } }[]
      }
      const msg = json.choices?.[0]?.message
      if (msg?.refusal) {
        console.warn(`[mesele] ${task} model tarafından reddedildi: ${msg.refusal}`)
        throw new MeseleError(
          'AI_UNAVAILABLE',
          'Danışman bu anlatım üzerine rapor yazamadı. Eğer kendini güvende hissetmiyorsan lütfen 112 ya da ALO 183 ile iletişime geç.',
        )
      }
      return msg?.content ?? ''
    }

    const detail = (await res.text().catch(() => '')).slice(0, 500)
    console.error(`[mesele] ${config.provider} ${res.status} (deneme ${attempt}): ${detail}`)

    if (res.status === 402) {
      throw new MeseleError(
        'AI_UNAVAILABLE',
        'Danışmanın kullanım kotası doldu. Lütfen uygulama yöneticisine haber ver.',
      )
    }
    if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
      await backoff(attempt, res.headers.get('retry-after'))
      continue
    }
    throw new MeseleError('AI_UNAVAILABLE', 'Danışman şu an çok yoğun. Lütfen birkaç dakika sonra tekrar dene.')
  }
  throw new MeseleError('AI_UNAVAILABLE', 'Danışmana şu an ulaşılamıyor.')
}

function backoff(attempt: number, retryAfter?: string | null) {
  const fromHeader = retryAfter ? Number(retryAfter) * 1000 : NaN
  const ms = Number.isFinite(fromHeader) ? Math.min(fromHeader, 10_000) : 800 * 2 ** (attempt - 1)
  return new Promise((r) => setTimeout(r, ms))
}
