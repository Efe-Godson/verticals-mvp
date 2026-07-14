import jsPDF from 'jspdf'
import pptxgen from 'pptxgenjs'
import html2canvas from 'html2canvas'

function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function getFieldValues(sub, field) {
  const val = sub.data[field.id]
  if (field.type === 'checkbox') return Array.isArray(val) ? val : []
  if (val === undefined || val === null || val === '') return []
  return [val]
}

function safeFileName(name) {
  return name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'report'
}

function orderFieldsCartFirst(fields) {
  return [...fields].sort((a, b) => (a.type === 'cart' ? 0 : 1) - (b.type === 'cart' ? 0 : 1))
}

function getAnsweredFor(field, submissions) {
  return submissions.filter(s => {
    const v = s.data[field.id]
    if (field.type === 'cart') return v && v.items && v.items.length > 0
    if (field.type === 'multiplechoicegrid' || field.type === 'checkboxgrid') {
      return v && typeof v === 'object' && Object.keys(v).length > 0
    }
    return v !== undefined && v !== null && v.toString().trim() !== ''
  })
}

// ---------------------------------------------------------------------------
// PRINT (unchanged) — opens a formatted HTML page; the person can print it or
// use their browser's own "Save as PDF" destination if they just want a quick
// look without a real downloadable file.
// ---------------------------------------------------------------------------

function statBox(label, value) {
  return `<div class="stat-box"><div class="stat-label">${escapeHtml(label)}</div><div class="stat-value">${escapeHtml(value)}</div></div>`
}

function buildFieldSectionHtml(field, submissions, totalResponses) {
  const answered = getAnsweredFor(field, submissions)
  const completionRate = totalResponses > 0 ? Math.round((answered.length / totalResponses) * 100) : 0

  let bodyHtml = ''

  if (field.type === 'number' || field.type === 'rating' || field.type === 'linearscale') {
    const values = answered.map(s => Number(s.data[field.id])).filter(v => !isNaN(v))
    if (values.length === 0) {
      bodyHtml = '<p class="muted">No numeric responses yet.</p>'
    } else {
      const total = values.reduce((a, b) => a + b, 0)
      const avg = total / values.length
      bodyHtml = `<div class="stat-row">
        ${statBox('Total', total.toLocaleString())}
        ${statBox('Average', avg.toLocaleString(undefined, { maximumFractionDigits: 2 }))}
        ${statBox('Median', median(values).toLocaleString())}
        ${statBox('Min', Math.min(...values).toLocaleString())}
        ${statBox('Max', Math.max(...values).toLocaleString())}
      </div>`
    }
  } else if (['dropdown', 'multiplechoice', 'checkbox'].includes(field.type)) {
    if (answered.length === 0) {
      bodyHtml = '<p class="muted">No responses yet.</p>'
    } else {
      const countMap = {}
      answered.forEach(s => {
        getFieldValues(s, field).forEach(v => { countMap[v] = (countMap[v] || 0) + 1 })
      })
      const rows = Object.entries(countMap)
        .map(([label, count]) => ({ label, count, percent: Math.round((count / answered.length) * 100) }))
        .sort((a, b) => b.count - a.count)
      bodyHtml = `<table class="report-table"><tbody>${rows.map(r => `
        <tr><td>${escapeHtml(r.label)}</td><td class="right">${r.percent}% (${r.count})</td></tr>
      `).join('')}</tbody></table>`
    }
  } else if (field.type === 'date') {
    if (answered.length === 0) {
      bodyHtml = '<p class="muted">No responses yet.</p>'
    } else {
      const dayCounts = {}
      answered.forEach(s => {
        const d = new Date(s.data[field.id])
        if (isNaN(d)) return
        const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' })
        dayCounts[dayName] = (dayCounts[dayName] || 0) + 1
      })
      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      const rows = dayOrder.filter(d => dayCounts[d]).map(d => ({
        label: d, count: dayCounts[d], percent: Math.round((dayCounts[d] / answered.length) * 100)
      }))
      bodyHtml = `<table class="report-table"><tbody>${rows.map(r => `
        <tr><td>${r.label}</td><td class="right">${r.percent}% (${r.count})</td></tr>
      `).join('')}</tbody></table>`
    }
  } else if (field.type === 'cart') {
    if (answered.length === 0) {
      bodyHtml = '<p class="muted">No orders yet.</p>'
    } else {
      const totals = answered.map(s => s.data[field.id].total)
      const totalRevenue = totals.reduce((a, b) => a + b, 0)
      const avgOrder = totalRevenue / totals.length

      const itemRevenue = {}
      answered.forEach(s => {
        s.data[field.id].items.forEach(item => {
          itemRevenue[item.name] = (itemRevenue[item.name] || 0) + item.price * item.quantity
        })
      })
      const topByRevenue = Object.entries(itemRevenue)
        .map(([name, revenue]) => ({ name, revenue, percent: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0 }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      bodyHtml = `
        <div class="stat-row">
          ${statBox('Total Revenue', totalRevenue.toLocaleString())}
          ${statBox('Orders', answered.length.toLocaleString())}
          ${statBox('Average Order', avgOrder.toLocaleString(undefined, { maximumFractionDigits: 2 }))}
        </div>
        <div class="sub-label">Top Items by Revenue${topByRevenue.length === 10 ? ' (top 10)' : ''}</div>
        <table class="report-table"><tbody>${topByRevenue.map(r => `
          <tr><td>${escapeHtml(r.name)}</td><td class="right">${r.percent}% (${r.revenue.toLocaleString()})</td></tr>
        `).join('')}</tbody></table>
      `
    }
  } else if (!['fileupload', 'time', 'multiplechoicegrid', 'checkboxgrid'].includes(field.type)) {
    bodyHtml = `<p class="muted">${answered.length} of ${totalResponses} responses (${completionRate}% completion rate)</p>`
    if (answered.length > 0) {
      const shown = answered.slice(0, 10)
      bodyHtml += `<ul class="response-list">${shown.map(s => `<li>${escapeHtml(s.data[field.id].toString())}</li>`).join('')}</ul>`
      if (answered.length > 10) {
        bodyHtml += `<p class="muted small">Showing first 10 of ${answered.length} responses.</p>`
      }
    }
  } else {
    bodyHtml = `<p class="muted">${answered.length} of ${totalResponses} responses (${completionRate}% completion rate)</p>`
  }

  return `<div class="field-card"><h3>${escapeHtml(field.label)}</h3>${bodyHtml}</div>`
}

export function printReport(form, submissions, filterSummary) {
  const totalResponses = submissions.length
  const orderedFields = orderFieldsCartFirst(form.fields)
  const fieldSectionsHtml = orderedFields.map(f => buildFieldSectionHtml(f, submissions, totalResponses)).join('')
  const generatedStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(form.name)} — Report</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 2rem; color: #111; }
        .toolbar { display: flex; gap: 0.6rem; margin-bottom: 1.2rem; }
        .toolbar button { font-family: inherit; font-size: 0.85rem; padding: 0.5rem 1rem; border-radius: 6px; border: none; cursor: pointer; }
        .print-btn { background: #0070f3; color: white; }
        .close-btn { background: white; color: #333; border: 1px solid #ccc; }
        h1 { font-size: 1.5rem; margin: 0 0 0.2rem 0; }
        .meta { color: #666; font-size: 0.85rem; margin-bottom: 1.5rem; }
        .field-card { border: 1px solid #ddd; border-radius: 8px; padding: 1.2rem; margin-bottom: 1rem; page-break-inside: avoid; }
        .field-card h3 { margin: 0 0 0.8rem 0; font-size: 1.05rem; }
        .stat-row { display: flex; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
        .stat-box { border: 1px solid #eee; border-radius: 6px; padding: 0.6rem 0.9rem; background: #fafafa; min-width: 110px; }
        .stat-label { font-size: 0.7rem; color: #999; }
        .stat-value { font-size: 1.05rem; font-weight: bold; margin-top: 0.2rem; }
        .sub-label { font-size: 0.8rem; color: #999; margin: 0.6rem 0 0.4rem; }
        table.report-table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
        table.report-table td { padding: 0.35rem 0.2rem; border-bottom: 1px solid #f0f0f0; }
        table.report-table td.right { text-align: right; color: #555; }
        ul.response-list { margin: 0.4rem 0 0; padding-left: 1.2rem; font-size: 0.85rem; }
        ul.response-list li { margin-bottom: 0.25rem; }
        .muted { color: #999; font-size: 0.85rem; }
        .muted.small { font-size: 0.75rem; }
        @media print {
          .toolbar { display: none; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        <button class="close-btn" onclick="window.close()">Close</button>
      </div>

      <h1>${escapeHtml(form.name)} — Report</h1>
      <div class="meta">
        ${totalResponses} response${totalResponses !== 1 ? 's' : ''}${filterSummary ? ' · ' + escapeHtml(filterSummary) : ''} · Generated ${generatedStr}
      </div>

      <div class="field-card">
        <h3>Overview</h3>
        <div class="stat-row">${statBox('Total Responses', totalResponses.toLocaleString())}</div>
      </div>

      ${fieldSectionsHtml}
    </body>
    </html>
  `

  const win = window.open('', '_blank', 'width=950, height=750')
  if (!win) {
    alert('Please allow pop-ups to print or save the report as PDF.')
    return
  }
  win.document.write(html)
  win.document.close()
}

// ---------------------------------------------------------------------------
// PDF DOWNLOAD — captures the actual rendered report page (hero, KPI cards,
// bar charts, everything) as an image and slices it across PDF pages. This
// is what makes the PDF visually match what's on screen, rather than a
// reconstructed set of plain data tables (which is what jsPDF alone would
// produce, since it can't render arbitrary HTML/CSS or draw the bar charts).
// ---------------------------------------------------------------------------

export async function exportReportToPDF(element, fileName) {
  if (!element) {
    alert('Could not find the report content to export. Please try again.')
    return
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  pdf.save(`${fileName}.pdf`)
}

// ---------------------------------------------------------------------------
// POWERPOINT DOWNLOAD (pptxgenjs) — real, editable native bar charts, one
// slide per chart-friendly field. Text-heavy fields are skipped here since
// they don't translate well to slides.
// ---------------------------------------------------------------------------

export function exportReportToPPTX(form, submissions, filterSummary) {
  const pptx = new pptxgen()
  const totalResponses = submissions.length
  const generatedStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const titleSlide = pptx.addSlide()
  titleSlide.addText(form.name, { x: 0.5, y: 1.4, w: 9, h: 1, fontSize: 32, bold: true })
  titleSlide.addText('Report', { x: 0.5, y: 2.2, w: 9, h: 0.6, fontSize: 18, color: '666666' })
  titleSlide.addText(
    `${totalResponses} response${totalResponses !== 1 ? 's' : ''}${filterSummary ? ' · ' + filterSummary : ''} · Generated ${generatedStr}`,
    { x: 0.5, y: 2.9, w: 9, h: 0.5, fontSize: 12, color: '999999' }
  )

  const overviewSlide = pptx.addSlide()
  overviewSlide.addText('Overview', { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 24, bold: true })
  overviewSlide.addText(`Total Responses: ${totalResponses}`, { x: 0.5, y: 1.3, w: 9, h: 0.5, fontSize: 16 })

  const orderedFields = orderFieldsCartFirst(form.fields)

  orderedFields.forEach(field => {
    const answered = getAnsweredFor(field, submissions)
    if (answered.length === 0) return

    if (['dropdown', 'multiplechoice', 'checkbox'].includes(field.type)) {
      const countMap = {}
      answered.forEach(s => {
        getFieldValues(s, field).forEach(v => { countMap[v] = (countMap[v] || 0) + 1 })
      })
      const labels = Object.keys(countMap)
      const values = Object.values(countMap)
      if (labels.length === 0) return

      const slide = pptx.addSlide()
      slide.addText(field.label, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true })
      slide.addChart(pptx.ChartType.bar, [{ name: field.label, labels, values }], {
        x: 0.5, y: 1.0, w: 9, h: 4.5, barDir: 'col',
        showValue: true, showLegend: false, chartColors: ['0070F3']
      })
    } else if (field.type === 'cart') {
      const itemQty = {}
      const itemRevenue = {}
      answered.forEach(s => {
        s.data[field.id].items.forEach(item => {
          itemQty[item.name] = (itemQty[item.name] || 0) + item.quantity
          itemRevenue[item.name] = (itemRevenue[item.name] || 0) + item.price * item.quantity
        })
      })

      const qtyLabels = Object.keys(itemQty)
      if (qtyLabels.length > 0) {
        const slideQty = pptx.addSlide()
        slideQty.addText(`${field.label} — Quantity Sold`, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true })
        slideQty.addChart(pptx.ChartType.bar, [{ name: 'Quantity', labels: qtyLabels, values: Object.values(itemQty) }], {
          x: 0.5, y: 1.0, w: 9, h: 4.5, barDir: 'col',
          showValue: true, showLegend: false, chartColors: ['22C55E']
        })
      }

      const revLabels = Object.keys(itemRevenue)
      if (revLabels.length > 0) {
        const slideRev = pptx.addSlide()
        slideRev.addText(`${field.label} — Revenue`, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true })
        slideRev.addChart(pptx.ChartType.bar, [{ name: 'Revenue', labels: revLabels, values: Object.values(itemRevenue) }], {
          x: 0.5, y: 1.0, w: 9, h: 4.5, barDir: 'col',
          showValue: true, showLegend: false, chartColors: ['F59E0B']
        })
      }
    } else if (field.type === 'number' || field.type === 'rating' || field.type === 'linearscale') {
      const values = answered.map(s => Number(s.data[field.id])).filter(v => !isNaN(v))
      if (values.length === 0) return
      const total = values.reduce((a, b) => a + b, 0)

      const slide = pptx.addSlide()
      slide.addText(field.label, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true })
      slide.addText(
        `Total: ${total.toLocaleString()}\nAverage: ${(total / values.length).toLocaleString(undefined, { maximumFractionDigits: 2 })}\nMin: ${Math.min(...values).toLocaleString()}   Max: ${Math.max(...values).toLocaleString()}`,
        { x: 0.5, y: 1.3, w: 9, h: 2, fontSize: 16, lineSpacingMultiple: 1.4 }
      )
    } else if (field.type === 'date') {
      const dayCounts = {}
      answered.forEach(s => {
        const d = new Date(s.data[field.id])
        if (isNaN(d)) return
        const dn = d.toLocaleDateString('en-GB', { weekday: 'long' })
        dayCounts[dn] = (dayCounts[dn] || 0) + 1
      })
      const labels = Object.keys(dayCounts)
      if (labels.length === 0) return

      const slide = pptx.addSlide()
      slide.addText(`${field.label} — By Day of Week`, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true })
      slide.addChart(pptx.ChartType.bar, [{ name: 'Responses', labels, values: Object.values(dayCounts) }], {
        x: 0.5, y: 1.0, w: 9, h: 4.5, barDir: 'col',
        showValue: true, showLegend: false, chartColors: ['8B5CF6']
      })
    }
    // Text-like fields (text, longtext, email, phone, fileupload, time, grids)
    // are intentionally skipped — they don't translate into chart slides.
  })

  pptx.writeFile({ fileName: `${safeFileName(form.name)}.pptx` })
}
