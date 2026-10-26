import { createServer, type Server } from 'node:net'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authMode, authOptions, sendEmailCode, verifyEmailCode } from '~/server/identity.server'
import { createSqliteStore } from '~/server/store-sqlite.server'
import { __setStoreForTests } from '~/server/store.server'

/** En basit sahte SMTP sunucusu: gelen iletileri kaydeder. */
function fakeSmtp() {
  const mails: { auth: string; data: string }[] = []
  const server: Server = createServer((sock) => {
    let buf = ''
    let inData = false
    let auth = ''
    let data = ''
    sock.write('220 sahte\r\n')
    sock.on('data', (chunk) => {
      buf += chunk.toString()
      let i: number
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i)
        buf = buf.slice(i + 2)
        if (inData) {
          if (line === '.') {
            inData = false
            mails.push({ auth, data })
            sock.write('250 tamam\r\n')
          } else data += `${line}\n`
          continue
        }
        if (line.startsWith('EHLO')) sock.write('250-sahte\r\n250 AUTH PLAIN\r\n')
        else if (line.startsWith('AUTH PLAIN')) {
          auth = Buffer.from(line.slice(11), 'base64').toString()
          sock.write('235 ok\r\n')
        } else if (line === 'DATA') {
          inData = true
          sock.write('354 devam\r\n')
        } else if (line === 'QUIT') {
          sock.write('221 bye\r\n')
          sock.end()
        } else sock.write('250 ok\r\n')
      }
    })
  })
  return { server, mails }
}

let smtp: ReturnType<typeof fakeSmtp>

beforeEach(async () => {
  vi.unstubAllEnvs()
  __setStoreForTests(createSqliteStore(':memory:'))
  smtp = fakeSmtp()
  await new Promise<void>((r) => smtp.server.listen(0, '127.0.0.1', r))
  const port = (smtp.server.address() as { port: number }).port
  vi.stubEnv('SMTP_HOST', '127.0.0.1')
  vi.stubEnv('SMTP_PORT', String(port))
  vi.stubEnv('SMTP_SECURE', 'none')
  vi.stubEnv('SMTP_USER', 'mesele@ornek.com')
  vi.stubEnv('SMTP_PASS', 'gizli-sifre')
})

afterEach(() => smtp.server.close())

const codeFrom = (data: string) => {
  const body = data.split('\n\n').slice(1).join('').replace(/\s/g, '')
  return /(\d{6})/.exec(Buffer.from(body, 'base64').toString())![1]!
}

it('kendi e-posta kodu: SMTP ile gönderilir, yalnızca hash saklanır, bir kez ve sınırlı denemeyle kullanılır', async () => {
  expect(authMode()).toBe('smtp')
  expect(authOptions()).toEqual({ email: true, google: false })
  await sendEmailCode('Ayse@Ornek.com')
  expect(smtp.mails).toHaveLength(1)
  expect(smtp.mails[0]!.auth).toBe('\0mesele@ornek.com\0gizli-sifre')
  expect(smtp.mails[0]!.data).toMatch(/^To: <ayse@ornek\.com>$/m)
  const code = codeFrom(smtp.mails[0]!.data)

  const wrong = code === '000000' ? '111111' : '000000'
  await expect(verifyEmailCode('ayse@ornek.com', wrong)).rejects.toThrow(/\[VALIDATION\]/)
  const id = await verifyEmailCode('ayse@ornek.com', code)
  expect(id.email).toBe('ayse@ornek.com')
  // Aynı e-posta → aynı kimlik; kod ikinci kez kullanılamaz
  await expect(verifyEmailCode('ayse@ornek.com', code)).rejects.toThrow(/\[VALIDATION\]/)
  await sendEmailCode('ayse@ornek.com')
  const again = await verifyEmailCode('ayse@ornek.com', codeFrom(smtp.mails[1]!.data))
  expect(again.userId).toBe(id.userId)
})

it('5 yanlış denemeden sonra doğru kod da geçmez', async () => {
  await sendEmailCode('can@ornek.com')
  const code = codeFrom(smtp.mails[0]!.data)
  const wrong = code === '000000' ? '111111' : '000000'
  for (let i = 0; i < 5; i++) await expect(verifyEmailCode('can@ornek.com', wrong)).rejects.toThrow()
  await expect(verifyEmailCode('can@ornek.com', code)).rejects.toThrow(/\[VALIDATION\]/)
})

it('üretimde ayar yoksa giriş kapalıdır (sahte kod 123456 çalışmaz)', async () => {
  vi.stubEnv('SMTP_HOST', '')
  vi.stubEnv('NODE_ENV', 'production')
  expect(authMode()).toBe('off')
  await expect(verifyEmailCode('a@ornek.com', '123456')).rejects.toThrow(/\[CONFIG\]/)
})
