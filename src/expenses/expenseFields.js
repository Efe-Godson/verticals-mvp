// Place at: src/expenses/expenseFields.js
// The Expenses template's field set (see the expenses_template migration) is
// the same jsonb `fields` array every form carries. These helpers pick which
// of them to show for a given book.

// Only meaningful for a business - dropped when settings.expenseMode is
// 'personal'. Vendor/location/paid-from are noise for someone tracking their
// own spending.
export const BUSINESS_ONLY_FIELD_IDS = ['paid_from', 'vendor', 'location']

// The two fields Quick Add always shows up front; everything else lives
// behind "+ Add details".
export const QUICK_FIELD_IDS = ['amount', 'category']

export function expenseMode(form) {
  return form?.settings?.expenseMode || 'business'
}

// Every expense field that should be offered for this book, in template
// order, minus business-only ones in personal mode and anything the owner
// has explicitly hidden via Records' column controls is NOT filtered here -
// hidden columns still stay fillable, they're just off the default table.
export function visibleExpenseFields(form) {
  const personal = expenseMode(form) === 'personal'
  return (form?.fields || []).filter(f => !(personal && BUSINESS_ONLY_FIELD_IDS.includes(f.id)))
}

export const fieldById = (form, id) => (form?.fields || []).find(f => f.id === id) || null

// Amount / date field ids, honouring the settings the template seeds but
// falling back to the well-known ids so this still works on an older book.
export const amountFieldId = (form) => form?.settings?.reportAmountField || 'amount'
export const dateFieldId = (form) => form?.settings?.reportDateField || 'date'
