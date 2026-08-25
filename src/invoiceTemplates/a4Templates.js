// Place at: src/invoiceTemplates/a4Templates.js
// A4 counterpart of index.js - same style keys/names as INVOICE_TEMPLATES so
// InvoiceModal.jsx's single Style picker drives both the compact and A4
// views with one piece of state.
import { A4Template } from './A4Template'
import { A4BoldHeaderTemplate } from './A4BoldHeaderTemplate'
import { A4MintPillTemplate } from './A4MintPillTemplate'
import { A4LedgerTemplate } from './A4LedgerTemplate'

export const A4_TEMPLATES = [
  { key: 'classic', name: 'Simple', Component: A4Template },
  { key: 'bold-header', name: 'Bold', Component: A4BoldHeaderTemplate },
  { key: 'mint-pill', name: 'Modern', Component: A4MintPillTemplate },
  { key: 'ledger', name: 'Ledger', Component: A4LedgerTemplate },
]

export function getA4Template(key) {
  return A4_TEMPLATES.find(t => t.key === key) || A4_TEMPLATES[0]
}
