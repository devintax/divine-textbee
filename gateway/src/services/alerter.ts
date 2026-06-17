const MAIL_HOST = process.env.MAIL_HOST || ''
const MAIL_PORT = parseInt(process.env.MAIL_PORT || '587', 10)
const MAIL_USER = process.env.MAIL_USER || ''
const MAIL_PASS = process.env.MAIL_PASS || ''
const MAIL_FROM = process.env.MAIL_FROM || 'noreply@dfgworld.com'
const ALERT_EMAIL = process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL || ''

function base64Encode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}

function createEmailBody(from: string, to: string, subject: string, body: string): string {
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Encode(body),
  ].join('\r\n')
}

async function sendRawEmail(raw: string): Promise<void> {
  if (!MAIL_HOST) return
  const tls = MAIL_PORT === 465
  const host = MAIL_HOST
  const port = MAIL_PORT
  const from = MAIL_FROM
  const to = ALERT_EMAIL || process.env.ADMIN_EMAIL || ''

  try {
    const connector = tls
      ? await import('tls').then((m) => m.connect(port, host, { rejectUnauthorized: false }))
      : await import('net').then((m) => {
          const socket = m.connect(port, host)
          return socket
        })

    const ac = new AbortController()
    const timeout = setTimeout(() => ac.abort(), 10000)

    await new Promise<void>((resolve, reject) => {
      let step = 0
      let buffer = ''
      const onAbort = () => { cleanup(); reject(new Error('SMTP timeout')) }
      ac.signal.addEventListener('abort', onAbort)

      function cleanup() {
        ac.signal.removeEventListener('abort', onAbort)
        clearTimeout(timeout)
        connector.removeAllListeners()
        connector.end()
      }

      function send(cmd: string) {
        connector.write(cmd + '\r\n')
      }

      connector.setEncoding('utf-8')
      connector.on('data', (data: string) => {
        buffer += data
        const code = parseInt(buffer.slice(0, 3), 10)
        if (buffer.includes('\r\n')) {
          const line = buffer.slice(0, buffer.indexOf('\r\n'))
          buffer = buffer.slice(buffer.indexOf('\r\n') + 2)

          if (step === 0 && code === 220) {
            step = 1
            send(`EHLO textbee-gateway`)
          } else if (step === 1 && (code === 250 || code === 220)) {
            step = 2
            if (MAIL_USER && MAIL_PASS) {
              send('AUTH LOGIN')
            } else {
              send(`MAIL FROM:<${from}>`)
            }
          } else if (step === 2 && code === 334 && buffer.includes('VXNlcm5hbWU6')) {
            step = 3
            send(base64Encode(MAIL_USER))
          } else if (step === 3 && code === 334 && buffer.includes('UGFzc3dvcmQ6')) {
            step = 4
            send(base64Encode(MAIL_PASS))
          } else if ((step === 2 || step === 4) && code === 235) {
            step = 5
            send(`MAIL FROM:<${from}>`)
          } else if (step === 5 && code === 250) {
            step = 6
            send(`RCPT TO:<${to}>`)
          } else if (step === 6 && code === 250) {
            step = 7
            send('DATA')
          } else if (step === 7 && code === 354) {
            step = 8
            send(raw)
            send('.')
          } else if (step === 8 && code === 250) {
            step = 9
            send('QUIT')
          } else if (step === 9 && code === 221) {
            cleanup()
            resolve()
          }
        }
      })

      connector.on('error', (err: Error) => { cleanup(); reject(err) })
      connector.on('close', () => { if (step < 9) { cleanup(); reject(new Error('Connection closed unexpectedly')) } })
    })
  } catch (err) {
    console.error('Email send failed:', err)
  }
}

export async function sendAlert(subject: string, body: string): Promise<void> {
  if (!ALERT_EMAIL || !MAIL_HOST) {
    console.log(`[Alert suppressed] To: ${ALERT_EMAIL || '(none)'} Subject: ${subject}`)
    return
  }
  const raw = createEmailBody(MAIL_FROM, ALERT_EMAIL, subject, body)
  await sendRawEmail(raw)
  console.log(`Alert sent: ${subject}`)
}
