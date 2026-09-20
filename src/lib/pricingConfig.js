// Place at: src/lib/pricingConfig.js
// Display-only helpers - prices/limits themselves live in plan_catalogue
// (see the pricing_usage_foundation migration) and are fetched from there,
// never hardcoded here. This keeps exactly one source of truth: the
// database, which activate_plan() also reads server-side rather than
// trusting anything the client sends.
import { supabase } from '../supabaseClient'

// 'scale' is intentionally dropped from display (not deleted from
// plan_catalogue/the backend - any existing Scale subscriber keeps working,
// it's just no longer offered here). Re-add it to bring it back.
export const PLAN_ORDER = ['free', 'starter', 'business', 'growth', 'enterprise']

export const PLAN_LABELS = {
  free: 'Free',
  starter: 'Starter',
  business: 'Business',
  growth: 'Growth',
  scale: 'Scale',
  enterprise: 'Enterprise',
}

export const BILLING_INTERVAL_LABELS = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_year: '6 Months',
  yearly: 'Yearly',
}

// every(...) -> the price actually charged per bill; perMonth(...) -> what
// that works out to per month, for the "Equivalent to ₦X/month" line.
export const BILLING_INTERVAL_MONTHS = { monthly: 1, quarterly: 3, half_year: 6, yearly: 12 }

export function formatNaira(value) {
  const n = Number(value) || 0
  return `₦${n.toLocaleString()}`
}

// Fetches the whole catalogue once - small, static-ish table, safe to cache
// for the lifetime of a page view rather than refetching per render.
export async function fetchPlanCatalogue() {
  const { data, error } = await supabase.from('plan_catalogue').select('*')
  if (error) throw new Error(error.message)
  return data || []
}

// Groups flat plan_catalogue rows into { [plan]: { monthly: row, yearly: row, ... } }
// for easy lookup by the pricing cards.
export function groupCatalogueByPlan(rows) {
  const grouped = {}
  for (const row of rows) {
    if (!grouped[row.plan]) grouped[row.plan] = {}
    grouped[row.plan][row.billing_interval] = row
  }
  return grouped
}

export function perMonthEquivalent(row) {
  if (row?.price_ngn == null) return null
  const months = BILLING_INTERVAL_MONTHS[row.billing_interval] || 1
  return row.price_ngn / months
}

export function yearlySaving(catalogueForPlan) {
  const monthly = catalogueForPlan?.monthly
  const yearly = catalogueForPlan?.yearly
  if (!monthly?.price_ngn || !yearly?.price_ngn) return null
  return monthly.price_ngn * 12 - yearly.price_ngn
}
