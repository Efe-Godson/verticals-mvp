// Place at: src/onboarding/entryIntents.js
// The 7 choices on the new Setup Selection screen, and - for this first
// (Phase 1) pass, before the Lab gets a "Demo Setup" config screen to make
// this admin-editable - where each one hardcodes to. See the plan this was
// built from: sales/reporting share the one seeded is_demo restaurant
// (there's no per-intent dataset yet, that's Phase 2's Demo Data Manager),
// everything else previews a real template's own field shape rather than a
// fabricated dataset, and workflow/other ask one follow-up question first.
//
// `kind`:
//   'demo'          -> PublicDemo.jsx: the seeded is_demo business's stats
//                      + Report view (read-only, real data, real component).
//   'real-template' -> RealTemplatePreview.jsx: a non-submitting preview of
//                      that template's real fields (FormPreviewModal), the
//                      actual workspace is created for real right after
//                      signup (see the deferred-creation effect).
//   'text-prompt'   -> IntentTextPrompt.jsx first, then the same
//                      real-template flow once they've answered (workflow
//                      routes to the blank "Forms" template so their answer
//                      becomes the new form's starting name).
export const ENTRY_INTENTS = [
  {
    id: 'sales',
    label: 'Sales',
    kind: 'demo',
    icon: 'sales',
  },
  {
    id: 'expenses',
    label: 'Expenses',
    kind: 'real-template',
    templateSlug: 'expenses',
    icon: 'expenses',
  },
  {
    id: 'payroll',
    label: 'Staff & Payroll',
    kind: 'real-template',
    templateSlug: 'payroll',
    icon: 'payroll',
  },
  {
    id: 'data_collection',
    label: 'Data Collection',
    kind: 'real-template',
    templateSlug: 'forms',
    icon: 'data_collection',
  },
  {
    id: 'reporting',
    label: 'Reporting',
    kind: 'demo',
    icon: 'reporting',
  },
  {
    id: 'workflow',
    label: 'A Workflow',
    kind: 'text-prompt',
    prompt: 'What do you want to manage?',
    placeholderExamples: ['Inventory', 'Customer follow-ups', 'Staff attendance', 'Equipment maintenance'],
    // Answering routes into the blank Forms template, named after the answer.
    templateSlug: 'forms',
    icon: 'workflow',
  },
  {
    id: 'other',
    label: 'Something Else',
    kind: 'text-prompt',
    prompt: 'What would you like to do?',
    placeholderExamples: [],
    templateSlug: 'forms',
    icon: 'other',
  },
]

export function getEntryIntent(id) {
  return ENTRY_INTENTS.find(i => i.id === id) || null
}

// Flat, single-color line icons, same visual language as
// templateVisuals.jsx's CategoryIcon (no fills/gradients, one stroke width).
export function EntryIntentIcon({ id, color = 'currentColor', size = 26 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (id) {
    case 'sales':
      return (
        <svg {...common}>
          <path d="M6 8h12l-1 12H7L6 8Z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      )
    case 'expenses':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M4 10h16" />
          <path d="M8 14h4" />
        </svg>
      )
    case 'payroll':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <circle cx="17" cy="9" r="2.4" />
          <path d="M15.5 14.3c2.3.4 4 2.3 4.5 5.7" />
        </svg>
      )
    case 'data_collection':
      return (
        <svg {...common}>
          <rect x="6" y="4" width="12" height="16" rx="2" />
          <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
          <path d="M9 11h6M9 15h6M9 19h3" />
        </svg>
      )
    case 'reporting':
      return (
        <svg {...common}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      )
    case 'workflow':
      return (
        <svg {...common}>
          <circle cx="5" cy="6" r="2.2" />
          <circle cx="19" cy="6" r="2.2" />
          <circle cx="12" cy="18" r="2.2" />
          <path d="M7 7l3.5 9M17 7l-3.5 9" />
        </svg>
      )
    default: // 'other'
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
  }
}
