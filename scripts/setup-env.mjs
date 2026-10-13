// MESELE kurulum yardımcısı: OpenAI API anahtarını .env dosyasına güvenle kaydeder.
//
//   npm run setup                 -> anahtarı sorar
//   npm run setup -- sk-proj-...  -> anahtarı doğrudan alır
//
// .env dosyası .gitignore içindedir; GitHub'a asla gönderilmez.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const envPath = join(root, '.env')

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

let key = (process.argv[2] ?? '').trim()
if (!key) key = await ask('OpenAI API anahtarını yapıştır ve Enter’a bas: ')
// Kopyalarken gelebilecek tırnakları ve boşlukları temizle.
key = key.replace(/^["']|["']$/g, '').replace(/\s+/g, '')

if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(key)) {
  console.error('\n✗ Bu bir OpenAI anahtarına benzemiyor (sk- ile başlamalı). Tekrar dene.')
  process.exit(1)
}

// Mevcut .env'yi koru, yalnızca OPENAI_API_KEY satırını güncelle.
const lines = existsSync(envPath)
  ? readFileSync(envPath, 'utf8').split(/\r?\n/)
  : ['# Yerel sırlar — bu dosya git’e GİRMEZ.']
const idx = lines.findIndex((l) => /^\s*OPENAI_API_KEY\s*=/.test(l))
if (idx >= 0) lines[idx] = `OPENAI_API_KEY=${key}`
else lines.push(`OPENAI_API_KEY=${key}`)
writeFileSync(envPath, lines.filter((l, i, a) => l !== '' || i < a.length - 1).join('\n') + '\n', 'utf8')
console.log(`\n✓ Anahtar kaydedildi: ${envPath}`)
console.log('  (Bu dosya .gitignore içinde; GitHub’a gönderilmez.)')

// Anahtarı OpenAI'ye karşı hızlıca doğrula.
try {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (res.ok) console.log('✓ OpenAI anahtarı doğrulandı. MESELE gerçek danışman yanıtlarını kullanacak.')
  else if (res.status === 401) console.error('✗ OpenAI anahtarı reddetti (401). Anahtarı OpenAI panelinden kontrol et.')
  else if (res.status === 429)
    console.warn('! OpenAI kota/limit uyarısı verdi (429). Hesabında bakiye olduğundan emin ol.')
  else console.warn(`! OpenAI beklenmeyen bir yanıt verdi (${res.status}).`)
} catch {
  console.warn('! OpenAI’ye şu an ulaşılamadı; anahtar yine de kaydedildi.')
}
console.log('\nŞimdi başlat:  npm run dev:lan')
