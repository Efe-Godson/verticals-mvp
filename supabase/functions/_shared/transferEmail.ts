export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export function transferEmail({ title, message, link, label }: { title: string; message: string; link?: string; label?: string }) {
  return `<html><body style="font-family:Arial,sans-serif;color:#17202a;background:#f7f8fa;padding:24px"><div style="max-width:560px;margin:auto;background:white;padding:28px;border-radius:12px"><img src="https://verticalsapp.com/verticals-main-logo.svg" width="143" height="48" alt="Verticals" style="display:block;border:0"><h2>${escapeEmailHtml(title)}</h2><p style="line-height:1.6">${escapeEmailHtml(message)}</p>${link ? `<p><a href="${escapeEmailHtml(link)}" style="display:inline-block;background:#0070f3;color:white;padding:12px 18px;border-radius:6px;text-decoration:none">${escapeEmailHtml(label || 'Review transfer')}</a></p>` : ''}<p style="font-size:13px;color:#667085">Having any issues? Email <a href="mailto:support@verticalsapp.com">support@verticalsapp.com</a>.</p></div></body></html>`
}

export async function hashTransferToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}
