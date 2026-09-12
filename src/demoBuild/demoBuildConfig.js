// Place at: src/demoBuild/demoBuildConfig.js
// Figures out which capture flow (POS order vs plain form) a demo sample
// needs and what its finishing action should be called, purely from the
// shape of form.fields + form.name - not from a hardcoded list of the demo
// dataset UUIDs, so this keeps working if the seed data is regenerated.

export const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer']

const KIND_COPY = {
  restaurant: {
    submitLabel: 'Complete Order',
    successTitle: 'Order completed',
    successBody: 'Your order is now in Records.',
  },
  retail: {
    submitLabel: 'Record Sale',
    successTitle: 'Sale recorded',
    successBody: 'Your sale has been added to Records.',
  },
  expense: {
    submitLabel: 'Submit Expense',
    successTitle: 'Expense recorded',
    successBody: 'Your expense has been added to Records.',
  },
  feedback: {
    submitLabel: 'Submit Feedback',
    successTitle: 'Feedback submitted',
    successBody: 'The response has been added to Records.',
  },
  inventory: {
    submitLabel: 'Update Stock',
    successTitle: 'Stock updated',
    successBody: 'This update has been added to Records.',
  },
  staff: {
    submitLabel: 'Add Employee',
    successTitle: 'Employee added',
    successBody: 'This entry has been added to Records.',
  },
  generic: {
    submitLabel: 'Submit',
    successTitle: 'Submitted',
    successBody: 'Your response has been added to Records.',
  },
}

function idsAndLabels(fields) {
  return fields.map(f => `${f.id} ${f.label || ''}`.toLowerCase())
}

export function detectBuildKind(form) {
  const fields = form?.fields || []
  const name = (form?.name || '').toLowerCase()
  const haystack = idsAndLabels(fields)
  const has = (re) => haystack.some(s => re.test(s))
  const cartField = fields.find(f => f.type === 'cart')

  let kind = 'generic'
  if (cartField) {
    const hasOrderType = has(/order.?type/)
    kind = hasOrderType || /restaurant|kitchen|food/.test(name) ? 'restaurant' : 'retail'
  } else if (/expense/.test(name) || (has(/\bamount\b/) && has(/categor/))) {
    kind = 'expense'
  } else if (/feedback|survey/.test(name) || fields.some(f => f.type === 'rating')) {
    kind = 'feedback'
  } else if (/inventory|stock/.test(name) || (has(/\bsku\b/) && has(/quantity/))) {
    kind = 'inventory'
  } else if (/staff|employee/.test(name) || (has(/department/) && has(/full.?name/))) {
    kind = 'staff'
  }

  return { kind, cartField, ...KIND_COPY[kind] }
}
