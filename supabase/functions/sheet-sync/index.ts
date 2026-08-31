// Place at: supabase/functions/sheet-sync/index.ts
// Deploy: supabase functions deploy sheet-sync
// verify_jwt = false - invoked by a Postgres trigger via pg_net, authorised
// by the x-sheet-sync-secret header (see 20260831163000_google_sheet_auto_sync.sql).
//
// Given { form_id }, rebuilds the form's linked Google Sheet ("Records" tab)
// from ALL its non-deleted submissions, using the owner's stored Google
// refresh token to mint a fresh access token. Header row is blue fill /
// white bold / frozen. No-ops unless the form has settings.googleSheetId
// and a stored refresh token.
//
// Required secrets (supabase secrets set ...):
//   SHEET_SYNC_SECRET          - matches private.sheet_sync_config.shared_secret
//   GOOGLE_OAUTH_CLIENT_ID     - the Google OAuth app (same as the Supabase
//   GOOGLE_OAUTH_CLIENT_SECRET   Auth Google provider) client id / secret

import { createClient } from '@supabase/supabase-js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// #0070f3 in 0-1
const HEADER_FILL = { red: 0, green: 0.4392, blue: 0.9529 }

function cellToText(value: unknown, field: { type?: string }): string {
  if (value === undefined || value === null || value === '') return ''
  const t = field?.type
  if (t === 'date') {
    const d = new Date(value as string)
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  if (t === 'number') {
    const n = Number(value)
    return isNaN(n) ? String(value) : n.toLocaleString()
  }
  if (t === 'linked_record') return (value as { label?: string })?.label ? String((value as { label?: string }).label) : ''
  if (t === 'location') {
    const v = value as { city?: string; state?: string; country?: string }
    return [v.city, v.state, v.country].filter(Boolean).join(', ')
  }
  if (t === 'cart') {
    const v = value as { items?: { name: string; price: number; quantity: number }[]; total?: number }
    if (!v.items || v.items.length === 0) return ''
    const lines = v.items.map(it => `${it.name} (Amount: ${Number(it.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN, Quantity: ${it.quantity})`)
    lines.push(`Total: ${Number(v.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN`)
    return lines.join('\n')
  }
  if (Array.isArray(value)) return value.join(', ')
  if ((t === 'multiplechoicegrid' || t === 'checkboxgrid') && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([row, col]) => `${row}: ${Array.isArray(col) ? col.join(', ') : col}`)
      .join('; ')
  }
  return String(value)
}

function buildValues(form: { fields: { id: string; label?: string; type?: string }[] }, records: { data: Record<string, unknown>; created_at: string }[]) {
  const fields = (form.fields || []).filter(f => f.type !== 'section')
  const headers = fields.map(f => f.label || f.id).concat(['Submitted'])
  const rows = records.map(sub => {
    const cells = fields.map(f => cellToText(sub.data?.[f.id], f))
    const submitted = new Date(sub.created_at).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    return [...cells, submitted]
  })
  return [headers, ...rows]
}

async function googleAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.access_token) {
    throw new Error(`Google token refresh failed (${res.status}): ${body.error_description || body.error || 'unknown'}`)
  }
  return body.access_token as string
}

async function sheets(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...JSON_HEADERS, ...(init?.headers || {}) },
  })
  const body = await res.json().catch(() => ({}))
  return { res, body }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  if (req.headers.get('x-sheet-sync-secret') !== Deno.env.get('SHEET_SYNC_SECRET')) {
    return new Response('Forbidden', { status: 403 })
  }

  let formId: string
  try {
    formId = (await req.json()).form_id
  } catch {
    return new Response(JSON.stringify({ error: 'form_id required' }), { status: 400, headers: JSON_HEADERS })
  }
  if (!formId) return new Response(JSON.stringify({ error: 'form_id required' }), { status: 400, headers: JSON_HEADERS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: form } = await supabase.from('forms').select('id, name, fields, settings').eq('id', formId).single()
  const spreadsheetId = form?.settings?.googleSheetId
  if (!form || !spreadsheetId) {
    return new Response(JSON.stringify({ skipped: 'not-linked' }), { headers: JSON_HEADERS })
  }

  const { data: tokenRow } = await supabase
    .schema('private').from('google_oauth_tokens').select('refresh_token').eq('form_id', formId).single()
  if (!tokenRow?.refresh_token) {
    return new Response(JSON.stringify({ skipped: 'no-token' }), { headers: JSON_HEADERS })
  }

  const { data: records } = await supabase
    .from('submissions').select('data, created_at').eq('form_id', formId).is('deleted_at', null)
    .order('created_at', { ascending: true })

  try {
    const token = await googleAccessToken(tokenRow.refresh_token)
    const values = buildValues(form, records || [])

    // Wipe + rewrite the Records tab.
    await sheets(`${spreadsheetId}/values/Records!A:ZZ:clear`, token, { method: 'POST', body: '{}' })
    const put = await sheets(`${spreadsheetId}/values/Records!A1?valueInputOption=RAW`, token, {
      method: 'PUT', body: JSON.stringify({ values }),
    })
    if (!put.res.ok) throw new Error(put.body.error?.message || `values PUT ${put.res.status}`)

    // Header formatting (best-effort).
    const meta = await sheets(`${spreadsheetId}?fields=sheets.properties(sheetId,title)`, token, { method: 'GET' })
    const sheetId = (meta.body.sheets || []).find((s: { properties: { title: string } }) => s.properties.title === 'Records')?.properties?.sheetId ?? 0
    await sheets(`${spreadsheetId}:batchUpdate`, token, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { backgroundColor: HEADER_FILL, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } } },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      }),
    }).catch(() => {})

    return new Response(JSON.stringify({ ok: true, rows: (records || []).length }), { headers: JSON_HEADERS })
  } catch (err) {
    console.error('sheet-sync', formId, err)
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 502, headers: JSON_HEADERS })
  }
})
