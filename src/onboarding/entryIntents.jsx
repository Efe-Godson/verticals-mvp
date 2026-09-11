// Place at: src/onboarding/entryIntents.jsx
// The 7 choices on the Setup Selection screen. id/label/icon/prompt here are
// visual/UX identity (not in the Lab's "Demo Setup" admin-configurable field
// list - see the design brief: Template/Demo Data/Starting Screen/CTA/Active
// only) and stay static. Everything about *where an intent actually goes* -
// template, demo dataset, starting screen, CTA text, whether it's shown at
// all - lives in the demo_routes table instead (see supabase/migrations/
// 20260911140000_demo_setup_and_demo_data.sql) so the Lab's Demo Setup page
// can change it without a redeploy. loadActiveDemoRoutes() is the one fetch
// that resolves all of that; OnboardingPage.jsx calls it once and threads
// the result through everything downstream.
import { supabase } from '../supabaseClient'

export const ENTRY_INTENTS = [
  { id: 'sales', label: 'Sales', icon: 'sales' },
  { id: 'expenses', label: 'Expenses', icon: 'expenses' },
  { id: 'payroll', label: 'Staff & Payroll', icon: 'payroll' },
  { id: 'data_collection', label: 'Data Collection', icon: 'data_collection' },
  { id: 'reporting', label: 'Reporting', icon: 'reporting' },
  {
    id: 'workflow', label: 'A Workflow', icon: 'workflow',
    prompt: 'What do you want to manage?',
    placeholderExamples: ['Inventory', 'Customer follow-ups', 'Staff attendance', 'Equipment maintenance'],
  },
  {
    id: 'other', label: 'Something Else', icon: 'other',
    prompt: 'What would you like to do?',
    placeholderExamples: [],
  },
]

// 'workflow'/'other' ask their one follow-up question before showing
// anything - a fixed part of the flow's shape, not something Demo Setup
// toggles per-route.
export function needsTextPrompt(intentId) {
  return intentId === 'workflow' || intentId === 'other'
}

export function getEntryIntent(id) {
  return ENTRY_INTENTS.find(i => i.id === id) || null
}

// One fetch, resolves every active intent's real destination. Falls back to
// null on error rather than throwing - OnboardingPage.jsx shows every intent
// (not admin-curated) if this fails, so a transient network hiccup never
// blanks Setup Selection entirely.
export async function loadActiveDemoRoutes() {
  const { data, error } = await supabase
    .from('demo_routes')
    .select('*, demo_datasets(form_id)')
    .eq('active', true)
  if (error || !data) return null
  const byIntent = {}
  data.forEach(route => { byIntent[route.entry_intent] = route })
  return byIntent
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
