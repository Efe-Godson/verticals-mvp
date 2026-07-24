import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from './supabaseClient'

// Sheets/Drive access is requested incrementally via Supabase's Google OAuth
// session — not at login (see Login.jsx, which only requests openid/email/
// profile). The first time this scope hasn't been granted yet, we trigger a
// fresh signInWithOAuth requesting it; once granted, session.provider_token
// carries a usable Google access token.
const GOOGLE_SHEETS_SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file'

// Turns any field's stored value into a plain, human-readable string —
// shared by both the Excel export and the printable table below.
function cellToText(value, field) {
  if (value === undefined || value === null || value === '') return ''

  if (field.type === 'date') {
    const d = new Date(value)
    return isNaN(d) ? value.toString() : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  if (field.type === 'number') {
    const num = Number(value)
    return isNaN(num) ? value.toString() : num.toLocaleString()
  }
  if (field.type === 'cart') {
    if (!value.items || value.items.length === 0) return ''
    const lines = value.items.map(item => {
      const amount = Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return `${item.name} (Amount: ${amount} NGN, Quantity: ${item.quantity})`
    })
    const total = Number(value.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    lines.push(`Total: ${total} NGN`)
    return lines.join('\n')
  }
  if (Array.isArray(value)) return value.join(', ')
  if (field.type === 'multiplechoicegrid' && typeof value === 'object') {
    return Object.entries(value).map(([row, col]) => `${row}: ${col}`).join('; ')
  }
  if (field.type === 'checkboxgrid' && typeof value === 'object') {
    return Object.entries(value).map(([row, cols]) => `${row}: ${(cols || []).join(', ')}`).join('; ')
  }
  return value.toString()
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export function exportRecordsToExcel(form, records) {
  const rows = records.map(sub => {
    const row = {}
    form.fields.forEach(field => {
      row[field.label] = cellToText(sub.data[field.id], field)
    })
    row['Submitted'] = new Date(sub.created_at).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    return row
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Records')

  const safeName = form.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '')
  XLSX.writeFile(workbook, `${safeName || 'records'}-export.xlsx`)
}

export function buildRecordsCSV(form, records) {
  const columns = form.fields.map(f => f.label).concat(['Submitted'])

  function csvCell(value) {
    const str = value === undefined || value === null ? '' : value.toString()
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
    return str
  }

  const lines = [columns.map(csvCell).join(',')]

  records.forEach(sub => {
    const cells = form.fields.map(field => cellToText(sub.data[field.id], field))
    const submitted = new Date(sub.created_at).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    lines.push([...cells, submitted].map(csvCell).join(','))
  })

  return lines.join('\r\n')
}

export function exportRecordsToCSV(form, records) {
  const csvText = buildRecordsCSV(form, records)

  // Leading BOM so Excel opens the UTF-8 file without mangling special characters (e.g. ₦)
  const blob = new Blob(['\ufeff' + csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const safeName = form.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '')

  const link = document.createElement('a')
  link.href = url
  link.download = `${safeName || 'records'}-export.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function buildRecordsSheetValues(form, records) {
  const headers = form.fields.map(field => field.label).concat(['Submitted'])
  const rows = records.map(sub => {
    const cells = form.fields.map(field => cellToText(sub.data[field.id], field))
    const submitted = new Date(sub.created_at).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    return [...cells, submitted]
  })
  return [headers, ...rows]
}

// Sends the user through Google's consent screen via Supabase, scoped to
// just Sheets/Drive. This navigates the browser away, so nothing after the
// call site runs; once they're back, the session carries a fresh
// provider_token with the right scopes and the same button completes the export.
async function requestGoogleSheetsAccess() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.href,
      scopes: GOOGLE_SHEETS_SCOPES,
      queryParams: { access_type: 'offline', prompt: 'consent' }
    }
  })
  if (error) throw new Error(error.message)
}

// A 403 here means the request reached Google fine, but the current
// provider_token doesn't carry the Sheets/Drive scopes — e.g. the user's
// session predates ever granting them. A missing provider_token is the same
// situation. Either way, the fix is the same incremental consent redirect.
function isScopeError(status, body) {
  if (status === 403) return true
  return /insufficient.*scope/i.test(body?.error?.message || '')
}

async function fetchSheetsJson(url, accessToken, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  })
  const body = await res.json().catch(() => ({}))
  return { res, body }
}

// Creates a brand-new spreadsheet for this form and writes the current
// records into it. Used the first time a form is connected, and again if a
// previously-linked sheet has since been deleted or access to it revoked.
async function createFormGoogleSheet(form, records, accessToken) {
  const { res, body } = await fetchSheetsJson('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: `${form.name} records` },
      sheets: [{ properties: { title: 'Records' } }]
    })
  })

  if (!res.ok) {
    if (isScopeError(res.status, body)) return { needsConsent: true }
    if (res.status === 401) throw new Error('Your Google Sheets connection has expired. Please try again to reconnect.')
    throw new Error(body.error?.message || 'Could not create a Google Sheet.')
  }

  const spreadsheetId = body.spreadsheetId
  const values = buildRecordsSheetValues(form, records)
  const { res: updateRes, body: updateBody } = await fetchSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Records!A1:append?valueInputOption=RAW`,
    accessToken,
    { method: 'POST', body: JSON.stringify({ values }) }
  )

  if (!updateRes.ok) {
    if (isScopeError(updateRes.status, updateBody)) return { needsConsent: true }
    throw new Error(updateBody.error?.message || 'Could not populate the Google Sheet.')
  }

  return { spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`, created: true }
}

// Overwrites the existing linked sheet's "Records" tab with the current
// records — so re-syncing after the form has collected new submissions
// updates the same sheet in place rather than creating a new one.
async function resyncFormGoogleSheet(spreadsheetId, form, records, accessToken) {
  const values = buildRecordsSheetValues(form, records)

  const { res: clearRes, body: clearBody } = await fetchSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Records!A:ZZ:clear`,
    accessToken,
    { method: 'POST', body: JSON.stringify({}) }
  )

  if (!clearRes.ok) {
    if (isScopeError(clearRes.status, clearBody)) return { needsConsent: true }
    // The linked sheet is gone or no longer accessible (e.g. deleted, or
    // ownership/sharing changed) — fall back to creating a fresh one rather
    // than failing the sync outright.
    if (clearRes.status === 404 || clearRes.status === 403) return { staleLink: true }
    throw new Error(clearBody.error?.message || 'Could not sync the Google Sheet.')
  }

  const { res: updateRes, body: updateBody } = await fetchSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Records!A1?valueInputOption=RAW`,
    accessToken,
    { method: 'PUT', body: JSON.stringify({ values }) }
  )

  if (!updateRes.ok) {
    if (isScopeError(updateRes.status, updateBody)) return { needsConsent: true }
    throw new Error(updateBody.error?.message || 'Could not populate the Google Sheet.')
  }

  return { spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`, created: false }
}

// Requests Sheets/Drive access incrementally, via a fresh Supabase Google
// OAuth grant, the first time there's no provider_token with the right
// scopes — not at login. Once granted, subsequent syncs reuse the same
// session's token.
//
// `form.settings.googleSheetId`, if present, is reused so every sync updates
// the same spreadsheet (and the same shareable link) instead of creating a
// new one each time. The caller is responsible for persisting the returned
// spreadsheetId onto the form the first time one is created.
export async function syncFormGoogleSheet(form, records) {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.provider_token) {
    await requestGoogleSheetsAccess()
    return null
  }

  const existingId = form.settings?.googleSheetId
  let result = existingId
    ? await resyncFormGoogleSheet(existingId, form, records, session.provider_token)
    : await createFormGoogleSheet(form, records, session.provider_token)

  if (result.needsConsent) {
    await requestGoogleSheetsAccess()
    return null
  }

  if (result.staleLink) {
    result = await createFormGoogleSheet(form, records, session.provider_token)
    if (result.needsConsent) {
      await requestGoogleSheetsAccess()
      return null
    }
  }

  window.open(result.url, '_blank', 'noopener,noreferrer')
  return result
}

export function exportRecordsToPDF(form, records, filterSummary) {
  const doc = new jsPDF({ orientation: 'landscape' })
  const columns = form.fields.map(f => f.label).concat(['Submitted'])

  const rows = records.map(sub => {
    const cells = form.fields.map(field => cellToText(sub.data[field.id], field))
    const submitted = new Date(sub.created_at).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
    return [...cells, submitted]
  })

  doc.setFontSize(14)
  doc.text(form.name, 14, 15)

  doc.setFontSize(9)
  doc.setTextColor(120)
  const meta = `${records.length} record${records.length !== 1 ? 's' : ''}${filterSummary ? ' · ' + filterSummary : ''}`
  doc.text(meta, 14, 21)

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 26,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [0, 112, 243] },
  })

  const safeName = form.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '')
  doc.save(`${safeName || 'records'}-export.pdf`)
}

export function printRecordsTable(form, records, filterSummary) {
  const columns = form.fields.map(f => f.label).concat(['Submitted'])

  const rowsHtml = records.map(sub => {
    const cells = form.fields
      .map(field => `<td>${escapeHtml(cellToText(sub.data[field.id], field))}</td>`)
      .join('')
    const submitted = new Date(sub.created_at).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
    return `<tr>${cells}<td>${submitted}</td></tr>`
  }).join('')

  const headerHtml = columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')
  const generatedStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(form.name)} — Records</title>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 2rem;
          color: #111;
        }
        .toolbar {
          display: flex;
          gap: 0.6rem;
          margin-bottom: 1.2rem;
        }
        .toolbar button {
          font-family: inherit;
          font-size: 0.85rem;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          border: none;
          cursor: pointer;
        }
        .print-btn { background: #0070f3; color: white; }
        .close-btn { background: white; color: #333; border: 1px solid #ccc; }
        h1 { font-size: 1.4rem; margin: 0 0 0.2rem 0; }
        .meta { color: #666; font-size: 0.85rem; margin-bottom: 1.2rem; }
        table { border-collapse: collapse; width: 100%; font-size: 0.8rem; }
        th, td { border: 1px solid #ddd; padding: 0.5rem 0.6rem; text-align: left; white-space: pre-line; }
        th { background: #f5f5f5; }
        tr:nth-child(even) td { background: #fafafa; }
        @media print {
          .toolbar { display: none; }
          body { padding: 0; }
          tr:nth-child(even) td { background: transparent; }
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        <button class="close-btn" onclick="window.close()">Close</button>
      </div>

      <h1>${escapeHtml(form.name)}</h1>
      <div class="meta">
        ${records.length} record${records.length !== 1 ? 's' : ''}${filterSummary ? ' · ' + escapeHtml(filterSummary) : ''} · Generated ${generatedStr}
      </div>

      <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body>
    </html>
  `

  const win = window.open('', '_blank', 'width=950,height=700')
  if (!win) {
    alert('Please allow pop-ups to print or save records as PDF.')
    return
  }
  win.document.write(html)
  win.document.close()
}
