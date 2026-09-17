import nodemailer from 'npm:nodemailer@6.10.1'

export function emailConfigured() {
  return !!Deno.env.get('RESEND_API_KEY') || !!(Deno.env.get('SMTP_HOST') && Deno.env.get('SMTP_USER') && Deno.env.get('SMTP_PASS') && Deno.env.get('EMAIL_FROM'))
}

export async function sendTransactionalEmail(to: string, subject: string, html: string, text: string, idempotencyKey: string) {
  const from = Deno.env.get('EMAIL_FROM') || 'Verticals <support@verticalsapp.com>'
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (apiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    })
    if (!response.ok) throw new Error('Email delivery failed. Please try again later.')
    return
  }
  if (!emailConfigured()) throw new Error('Transfer email delivery has not been configured yet.')
  const port = Number(Deno.env.get('SMTP_PORT') || 587)
  const transport = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST'), port, secure: port === 465, requireTLS: port !== 465,
    auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASS') },
    connectionTimeout: 10000, socketTimeout: 15000,
  })
  try { await transport.sendMail({ from, to, subject, html, text }) }
  catch { throw new Error('Email delivery failed. Please try again later.') }
  finally { transport.close() }
}
