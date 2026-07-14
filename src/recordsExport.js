import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

export function exportRecordsToCSV(form, records) {
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

  // Leading BOM so Excel opens the UTF-8 file without mangling special characters (e.g. ₦)
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
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
