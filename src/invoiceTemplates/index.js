// Place at: src/invoiceTemplates/index.js
import { ClassicTemplate } from './ClassicTemplate'
import { BoldHeaderTemplate } from './BoldHeaderTemplate'
import { MintPillTemplate } from './MintPillTemplate'
import { LedgerTemplate } from './LedgerTemplate'
import { FormalTemplate } from './FormalTemplate'

export const INVOICE_TEMPLATES = [
  { key: 'classic', name: 'Simple', Component: ClassicTemplate },
  { key: 'bold-header', name: 'Bold', Component: BoldHeaderTemplate },
  { key: 'mint-pill', name: 'Modern', Component: MintPillTemplate },
  { key: 'ledger', name: 'Ledger', Component: LedgerTemplate },
  { key: 'formal', name: 'Formal', Component: FormalTemplate },
]

export function getInvoiceTemplate(key) {
  return INVOICE_TEMPLATES.find(t => t.key === key) || INVOICE_TEMPLATES[0]
}
