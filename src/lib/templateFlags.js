// Place at: src/lib/templateFlags.js
// The downloadable Invoice (InvoiceModal.jsx) is Retail-only - Restaurant
// and every custom/non-template cart form keep the original thermal-style
// printReceipt() popup (receiptPrint.js). Matched by templateSlug rather
// than category, since that's what's actually stamped onto a form at
// creation time (see locations.js) - 'retail-shop' is the Retail template's
// fixed seed slug (supabase/migrations/20260812130000_retail_shop_template.sql),
// not the dynamic slugify()+timestamp one admin-authored custom templates get.
export const RETAIL_TEMPLATE_SLUG = 'retail-shop'

export function isRetailTemplate(form) {
  return form?.settings?.templateSlug === RETAIL_TEMPLATE_SLUG
}
