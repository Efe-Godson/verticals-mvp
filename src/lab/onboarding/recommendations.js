// Step 5 payoff: the main-focus line + up to 3 outcome cards + the reporting
// line. Everything is worded as an OUTCOME ("what you'll know that you don't
// today"), never as an internal Verticals feature name. The internal feature
// mapping is kept separately for the eventual recommendation engine and the
// Lab debug view. Lab prototype only.

import { resolveActions } from '../../flow/engine'
import { onboardingFlow } from './onboardingFlow'

// -- internal only: never rendered to the customer --------------------------
export const INTERNAL_FEATURE_MAP = {
  'sales-records-reports': 'Sales / Records / Reports',
  'expenses-financial-reports': 'Expenses / Records / Financial Reports',
  'inventory-records-reports': 'Inventory / Records / Reports',
  'customer-records-reports': 'Customer Records / Reports',
  'staff-payroll-reports': 'Staff / Payroll / Reports',
  'custom-form-records-reports': 'Custom Form / Records / Reports',
  'reports': 'Reports',
  'scheduled-reports': 'Scheduled Reports',
  'alerts': 'Alerts',
  'data-import': 'Data Import',
}

const AREA_LABELS = {
  sales: 'Sales', money: 'Money', inventory: 'Inventory',
  customers: 'Customers', staff: 'Staff',
}

const REPORT_WORD = { daily: 'daily', weekly: 'weekly', monthly: 'monthly' }

function focusOf(answers) {
  const interests = answers.interests || []
  return answers.primary_interest || (interests.length === 1 ? interests[0] : null)
}

// The customer-facing label for an interest value. `custom` becomes whatever
// they typed; an empty custom name falls back softly.
function areaLabel(value, answers) {
  if (value === 'custom') return (answers.custom_interest_name || '').trim() || 'Your workflow'
  return AREA_LABELS[value] || value
}

export function buildFocusSummary(answers) {
  const interests = answers.interests || []
  const primary = focusOf(answers)
  return {
    mainFocusLabel: primary ? areaLabel(primary, answers) : 'Your setup',
    otherLabels: interests.filter((i) => i !== primary).map((i) => areaLabel(i, answers)).filter(Boolean),
  }
}

const WORKFLOW_SUBJECT = {
  sales: 'sales', expenses: 'expenses', inventory: 'inventory', staff: 'staff',
  customers: 'customer', deliveries: 'delivery', bookings: 'bookings',
  projects: 'project', suppliers: 'supplier',
}

// What noun the reporting line + big-picture card should use.
function subjectWord(answers) {
  if (answers.setup_type === 'workflow') {
    const picked = Array.isArray(answers.workflow_template) ? answers.workflow_template : []
    const named = picked.filter((t) => t !== 'custom')
    if (named.length === 1) return WORKFLOW_SUBJECT[named[0]] || 'workflow'
    if (named.length > 1) return 'workflow'
    if (picked.includes('custom')) {
      return (answers.workflow_name || answers.custom_interest_name || '').trim().toLowerCase() || 'workflow'
    }
    return 'workflow'
  }
  return 'business'
}

// Outcome copy per focus area. `custom` and the composite cards are
// functions so they can read the typed name / goal / frequency.
const OUTCOME = {
  sales: () => ({
    iconKey: 'sales-records',
    title: "What's driving your sales",
    blurb: 'Your best-selling product, your best days and busiest times, average order value, and whether sales are trending up or down.',
  }),
  money: () => ({
    iconKey: 'expenses',
    title: 'Where your money is going',
    blurb: "Your biggest expenses, which costs are creeping up, how money in compares with money out, and where it's all going.",
  }),
  inventory: () => ({
    iconKey: 'inventory',
    title: 'How your stock is moving',
    blurb: "What's selling fastest, what's barely moving, what's running low, and roughly when you'll need to restock.",
  }),
  customers: () => ({
    iconKey: 'customers',
    title: "What's happening with your customers",
    blurb: 'Who your best customers are, who buys most often, what they usually buy, and how many keep coming back.',
  }),
  staff: () => ({
    iconKey: 'payroll',
    title: 'A clearer view of your team',
    blurb: "Who's in and when, hours and attendance, what each person is owed, and how that changes over time.",
  }),
  custom: (answers) => {
    const name = (answers.custom_interest_name || '').trim()
    const goal = (answers.custom_interest_goal || '').trim()
    const noun = name.toLowerCase() || 'workflow'
    return {
      iconKey: 'custom-workflow',
      title: name ? `Understand your ${noun}` : 'Understand your workflow',
      blurb: goal
        ? `Keep your ${noun} records together and turn them into the answers you're after, like "${goal.toLowerCase()}", as your data grows.`
        : `Keep your ${noun} records together and see totals, trends and changes as your data grows.`,
    }
  },
}

function bigPictureCard(answers) {
  const areas = (answers.interests || [])
    .filter((i) => i !== 'custom')
    .map((i) => (AREA_LABELS[i] || i).toLowerCase())
  const list = areas.length >= 2
    ? `${areas.slice(0, -1).join(', ')} and ${areas[areas.length - 1]}`
    : (areas[0] || 'the areas you care about')
  return {
    iconKey: 'dashboard',
    title: 'See the bigger picture',
    blurb: `Bring ${list} together so you can understand what's improving, what's changing and what needs attention.`,
  }
}

function reportingCard(answers) {
  const freq = answers.preferred_report_frequency
  if (!freq || freq === 'on_check') return null
  const subject = subjectWord(answers)
  if (REPORT_WORD[freq]) {
    const w = REPORT_WORD[freq]
    const blurbs = {
      daily: `Get a focused view of what matters to you every day.`,
      weekly: `See how the areas you care about moved during the week.`,
      monthly: `See what changed, what performed and where your attention may be needed.`,
    }
    return { iconKey: 'reporting', title: `Your ${w} ${subject} picture`, blurb: blurbs[w] }
  }
  // live / few_hours
  return {
    iconKey: 'reporting',
    title: `Your live ${subject} picture`,
    blurb: 'Watch the numbers that matter to you update as your data comes in.',
  }
}

export function buildRecommendations(answers) {
  const interests = answers.interests || []
  const primary = focusOf(answers)

  const scored = []
  const seen = new Set()
  const push = (key, card, score) => {
    if (!card || seen.has(key)) return
    seen.add(key)
    scored.push({ key, score, ...card })
  }

  if (primary && OUTCOME[primary]) push(`focus:${primary}`, OUTCOME[primary](answers), 100)
  if (interests.length >= 2) push('bigpicture', bigPictureCard(answers), 65)
  push('reporting', reportingCard(answers), 60)
  interests
    .filter((i) => i !== primary && OUTCOME[i])
    .forEach((i, n) => push(`area:${i}`, OUTCOME[i](answers), 45 - n))

  return scored.sort((a, b) => b.score - a.score).slice(0, 3)
}

// Internal feature list for the Lab debug view / future engine.
export function buildInternalFeatures(answers) {
  return resolveActions(onboardingFlow, answers).recommendations.map((k) => INTERNAL_FEATURE_MAP[k] || k)
}
