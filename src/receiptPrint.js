// Opens a preview window styled like a standard printed receipt — numbered
// items, business details header, bold total, order number footer — with a
// Print button the person clicks when ready.

export function printReceipt(form, submission) {
  const cartFields = form.fields.filter(f => f.type === 'cart')
  const otherFields = form.fields.filter(f => f.type !== 'cart')
  const settings = form.settings || {}

  function formatFieldValue(field, value) {
    if (Array.isArray(value)) return value.join(', ')
    if (field.type === 'multiplechoicegrid' && value && typeof value === 'object') {
      return Object.entries(value).map(([row, col]) => `${row}: ${col}`).join('; ')
    }
    if (field.type === 'checkboxgrid' && value && typeof value === 'object') {
      return Object.entries(value).map(([row, cols]) => `${row}: ${(cols || []).join(', ')}`).join('; ')
    }
    if (field.type === 'rating') return `${value} / ${field.maxStars ?? 5} stars`
    return value.toString()
  }

  let itemsHtml = ''
  let grandTotal = 0
  let itemNumber = 0

  cartFields.forEach(field => {
    const cartData = submission.data[field.id]
    if (cartData && cartData.items && cartData.items.length > 0) {
      cartData.items.forEach(item => {
        itemNumber += 1
        const lineTotal = item.price * item.quantity
        grandTotal += lineTotal
        itemsHtml += `
          <div class="item-row">
            <span class="item-name">${itemNumber}. ${escapeHtml(item.name)}${item.quantity > 1 ? ` &times;${item.quantity}` : ''}</span>
            <span class="item-price">${lineTotal.toLocaleString()}</span>
          </div>
        `
      })
    }
  })

  let detailsHtml = ''
  otherFields.forEach(field => {
    const value = submission.data[field.id]
    const isEmpty = value === undefined || value === null ||
      (Array.isArray(value) ? value.length === 0 : value.toString().trim() === '')
    if (!isEmpty) {
      detailsHtml += `
        <div class="line">
          <span>${escapeHtml(field.label)}</span>
          <span>${escapeHtml(formatFieldValue(field, value))}</span>
        </div>
      `
    }
  })

  const createdDate = new Date(submission.created_at)
  const dateStr = createdDate.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = createdDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()

  // A short, receipt-style order number derived from the submission's own ID —
  // no extra numbering system needed, just makes it look/feel like a real receipt.
  const orderNumber = submission.id.replace(/-/g, '').slice(-12).toUpperCase()

  const businessName = settings.companyName?.trim() || form.name
  const businessPhone = settings.companyPhone?.trim()
  const businessAddress = settings.companyAddress?.trim()

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Receipt Preview</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        * { box-sizing: border-box; }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #eef0f2;
          margin: 0;
          padding: 1.5rem 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .toolbar {
          width: 72mm;
          display: flex;
          justify-content: center;
          gap: 0.6rem;
          margin-bottom: 1rem;
        }

        .toolbar button {
          font-family: inherit;
          font-size: 0.85rem;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          border: none;
          cursor: pointer;
        }

        .toolbar .print-btn { background: #0070f3; color: white; }
        .toolbar .close-btn { background: white; color: #333; border: 1px solid #ccc; }

        /* Torn-paper zigzag edge — purely decorative, screen only */
        .tear {
          width: 72mm;
          height: 10px;
          background:
            linear-gradient(135deg, #eef0f2 50%, transparent 50%) 0 0,
            linear-gradient(225deg, #eef0f2 50%, transparent 50%) 0 0;
          background-size: 10px 10px;
          background-repeat: repeat-x;
          background-color: white;
        }
        .tear.bottom { transform: rotate(180deg); }

        .receipt {
          font-family: 'Courier New', monospace;
          width: 72mm;
          background: white;
          padding: 5mm 6mm;
          font-size: 12px;
          color: #000;
          box-shadow: 0 2px 10px rgba(0,0,0,0.12);
        }

        .shop-name {
          font-size: 17px;
          font-weight: bold;
          text-align: center;
          letter-spacing: 0.5px;
          margin: 0 0 4px 0;
          text-transform: uppercase;
        }
        .business-detail {
          text-align: center;
          font-size: 10px;
          color: #333;
        }
        .meta {
          text-align: center;
          font-size: 10px;
          margin: 8px 0 4px 0;
          display: flex;
          justify-content: space-between;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
        .double-divider {
          border-top: 2px solid #000;
          margin: 6px 0;
        }
        .line, .item-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin: 4px 0;
        }
        .item-name { flex: 1; }
        .item-price { white-space: nowrap; }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 15px;
          margin: 4px 0;
        }
        .footer {
          text-align: center;
          font-size: 9px;
          margin-top: 12px;
          letter-spacing: 1px;
        }
        .powered-by {
          text-align: center;
          font-size: 9px;
          color: #999;
          margin-top: 4px;
        }

        @media print {
          body { background: white; padding: 0; }
          .toolbar, .tear { display: none; }
          .receipt { box-shadow: none; padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <button class="print-btn" onclick="window.print()">Print</button>
        <button class="close-btn" onclick="window.close()">Close</button>
      </div>

      <div class="tear top"></div>
      <div class="receipt">
        <div class="shop-name">${escapeHtml(businessName)}</div>
        ${businessAddress ? `<div class="business-detail">${escapeHtml(businessAddress)}</div>` : ''}
        ${businessPhone ? `<div class="business-detail">${escapeHtml(businessPhone)}</div>` : ''}

        <div class="meta">
          <span>${dateStr}</span>
          <span>${timeStr}</span>
        </div>

        ${detailsHtml ? `<div class="divider"></div>${detailsHtml}` : ''}

        ${itemsHtml ? `
          <div class="divider"></div>
          ${itemsHtml}
          <div class="double-divider"></div>
          <div class="total-row">
            <span>TOTAL</span>
            <span>${grandTotal.toLocaleString()}</span>
          </div>
          <div class="divider"></div>
        ` : ''}

        <div class="footer">#${orderNumber}#</div>
        <div class="powered-by">Powered by Verticals</div>
      </div>
      <div class="tear bottom"></div>
    </body>
    </html>
  `

  const previewWindow = window.open('', '_blank', 'width=420,height=760')
  if (!previewWindow) {
    alert('Please allow pop-ups to preview and print receipts.')
    return
  }
  previewWindow.document.write(html)
  previewWindow.document.close()
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
