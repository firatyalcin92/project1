import '@tanstack/react-start/server-only'
import { connect as netConnect, type Socket } from 'node:net'
import { connect as tlsConnect, type TLSSocket } from 'node:tls'

/**
 * Bağımlılıksız, küçük bir SMTP istemcisi: yalnızca giriş kodu gibi kısa, düz metin
 * e-postalar için. cPanel e-posta hesabıyla çalışır.
 *
 * SMTP_HOST (ör. mail.firatyalcin.blog), SMTP_PORT (465 = SSL, 587 = STARTTLS),
 * SMTP_USER (ör. mesele@firatyalcin.blog), SMTP_PASS, isteğe bağlı SMTP_FROM.
 */

export type SmtpConfig = {
  host: string
  port: number
  user: string
  pass: string
  from: string
  /** tls: 465 (SSL) · starttls: 587 · none: yalnızca yerel testler */
  secure: 'tls' | 'starttls' | 'none'
}

export function smtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim()
  const user = env.SMTP_USER?.trim()
  const pass = env.SMTP_PASS
  if (!host || !user || !pass) return null
  const port = Number(env.SMTP_PORT ?? 465) || 465
  const secure = env.SMTP_SECURE === 'none' ? 'none' : port === 465 ? 'tls' : 'starttls'
  return { host, port, user, pass, from: env.SMTP_FROM?.trim() || user, secure }
}

/** Başlık ve adreslere satır sonu sızmasın (SMTP / başlık enjeksiyonu). */
const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()

function encodeHeader(s: string) {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`
}

class Conversation {
  private buffer = ''
  private waiters: ((line: string) => void)[] = []
  constructor(private socket: Socket | TLSSocket) {
    this.attach(socket)
  }
  attach(socket: Socket | TLSSocket) {
    this.socket.removeAllListeners('data')
    this.socket = socket
    socket.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8')
      // Çok satırlı yanıt "250-..." ile sürer, "250 ..." ile biter.
      let m: RegExpExecArray | null
      while ((m = /(^|\n)(\d{3}) [^\n]*\n/.exec(this.buffer))) {
        const end = m.index + m[0].length
        const reply = this.buffer.slice(0, end)
        this.buffer = this.buffer.slice(end)
        this.waiters.shift()?.(reply)
      }
    })
  }
  read(): Promise<string> {
    return new Promise((resolve) => this.waiters.push(resolve))
  }
  async send(line: string, expect: number[]) {
    this.socket.write(`${line}\r\n`)
    return this.expect(expect)
  }
  async expect(codes: number[]) {
    const reply = await this.read()
    const last = reply.trim().split('\n').pop() ?? ''
    const code = Number(last.slice(0, 3))
    if (!codes.includes(code)) throw new Error(`SMTP ${code}: ${last.slice(4, 200)}`)
    return reply
  }
}

export async function sendMail(cfg: SmtpConfig, msg: { to: string; subject: string; text: string }) {
  const to = clean(msg.to)
  if (!/^[^\s@<>]+@[^\s@<>]+$/.test(to)) throw new Error('Geçersiz alıcı')
  const implicitTls = cfg.secure === 'tls'
  const socket: Socket | TLSSocket = implicitTls
    ? tlsConnect({ host: cfg.host, port: cfg.port, servername: cfg.host })
    : netConnect({ host: cfg.host, port: cfg.port })
  socket.setTimeout(20_000, () => socket.destroy(new Error('SMTP zaman aşımı')))
  const failed = new Promise<never>((_, reject) => socket.once('error', reject))
  const talk = async () => {
    const c = new Conversation(socket)
    await c.expect([220])
    await c.send(`EHLO ${cfg.host}`, [250])
    if (cfg.secure === 'starttls') {
      await c.send('STARTTLS', [220])
      const secure = tlsConnect({ socket, servername: cfg.host })
      secure.once('error', (e) => socket.destroy(e))
      await new Promise<void>((resolve) => secure.once('secureConnect', () => resolve()))
      c.attach(secure)
      await c.send(`EHLO ${cfg.host}`, [250])
    }
    const auth = Buffer.from(`\0${cfg.user}\0${cfg.pass}`).toString('base64')
    await c.send(`AUTH PLAIN ${auth}`, [235])
    await c.send(`MAIL FROM:<${clean(cfg.from)}>`, [250])
    await c.send(`RCPT TO:<${to}>`, [250, 251])
    await c.send('DATA', [354])
    const body = Buffer.from(msg.text, 'utf8')
      .toString('base64')
      .replace(/.{1,76}/g, '$&\r\n')
    const data = [
      `From: MESELE <${clean(cfg.from)}>`,
      `To: <${to}>`,
      `Subject: ${encodeHeader(clean(msg.subject))}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@${cfg.host}>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      body,
      '.',
    ].join('\r\n')
    await c.send(data, [250])
    await c.send('QUIT', [221]).catch(() => {})
  }
  try {
    await Promise.race([talk(), failed])
  } finally {
    socket.destroy()
  }
}
