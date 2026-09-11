// Place at: src/locations.js
// Shared by Templates.jsx (adding a template's first location) and
// TemplateLocations.jsx (adding every location after that) - a "location"
// is just a regular form created from a template's fields, tagged with
// settings.locationName so it can be grouped and listed under that
// template instead of being its own top-level form. Fully independent:
// its own products/menu, own submissions, editable afterward without
// affecting any other location under the same template.
import { supabase } from './supabaseClient'

export async function createLocationForm({ session, template, locationName }) {
  const trimmed = locationName.trim()
  const { data, error } = await supabase.from('forms').insert([{
    name: trimmed,
    fields: template.fields,
    status: 'published',
    user_id: session.user.id,
    settings: {
      templateSlug: template.slug,
      locationName: trimmed,
      companyName: trimmed,
      ...expenseDefaults(template),
    },
  }]).select().single()

  if (error || !data) throw new Error(error?.message || 'Could not create this location')
  return data
}

// Extra settings an Expenses book (src/expenses/) starts with: business
// mode by default, the report engine pointed at the expense date rather
// than created_at, and the noisier columns hidden so the reused Records
// table opens lean (Date · Description · Category · Amount · Payment method).
function expenseDefaults(template) {
  if (template.slug !== 'expenses') return {}
  return {
    recordKind: 'expense',
    expenseMode: 'business',
    reportDateField: 'date',
    reportAmountField: 'amount',
    hiddenFieldIds: ['time', 'paid_from', 'notes', 'receipt'],
  }
}

// Clones an existing location's own fields (its actual menu/products/
// customizations, not the template's blank defaults) into a brand new,
// fully independent form - no submissions/records carry over, just the
// setup. Keeps the rest of the source's settings bag too (receipt details,
// hidden columns, promoted reports, etc.) since those are exactly what
// "duplicate" implies preserving; only the name-derived keys are
// overwritten for the new copy. Takes just the source form's id rather
// than a full form object, since TemplateLocations.jsx's own location list
// only selects id/name/settings (fields can be a large JSON blob with a
// full product catalogue, not worth fetching for every location just in
// case one gets duplicated) - fetches fields fresh here instead, only for
// whichever one location is actually being duplicated. sourceFormId is
// always a primary/standalone location here (that same list query already
// excludes bundle secondaries via settings->>primaryFormId), so there's no
// risk of accidentally cloning a form into someone else's bundle group.
export async function duplicateLocationForm({ session, sourceFormId, locationName }) {
  const { data: source, error: fetchError } = await supabase
    .from('forms').select('fields, settings').eq('id', sourceFormId).single()
  if (fetchError || !source) throw new Error(fetchError?.message || 'Could not load the location to duplicate')

  const trimmed = locationName.trim()
  const { data, error } = await supabase.from('forms').insert([{
    name: trimmed,
    fields: source.fields,
    status: 'published',
    user_id: session.user.id,
    settings: {
      ...source.settings,
      locationName: trimmed,
      companyName: trimmed,
    },
  }]).select().single()

  if (error || !data) throw new Error(error?.message || 'Could not duplicate this location')
  return data
}

// Bundle templates (multi-form, e.g. Employees + Salary Events) create
// several linked forms in one go instead of the single insert
// createLocationForm does - a $key placeholder in a bundle spec's
// linkedFormId/settings value resolves to whichever earlier-created form in
// this same call actually got that key, so the bundle's JSON never has to
// store real (and non-reusable) form ids. Returns { [spec.key]: formId }.
// Shared by Templates.jsx's "start a template" flow and the post-signup
// deferred workspace creation (src/lib/completeOnboardingEntry.js).
export async function createBundleTemplateForms({ session, template }) {
  const createdByKey = {}
  let primaryFormId = null

  function resolvePlaceholder(value) {
    return typeof value === 'string' && value.startsWith('$') ? createdByKey[value.slice(1)] : value
  }

  for (const spec of template.bundle) {
    const resolvedFields = spec.fields.map(field => (
      field.type === 'linked_record' ? { ...field, linkedFormId: resolvePlaceholder(field.linkedFormId) } : field
    ))
    const resolvedSpecSettings = spec.settings
      ? Object.fromEntries(Object.entries(spec.settings).map(([k, v]) => [k, resolvePlaceholder(v)]))
      : {}
    const resolvedSettings = {
      ...resolvedSpecSettings,
      templateSlug: template.slug,
      templateBundleKey: spec.key,
      ...(primaryFormId ? { primaryFormId } : {}),
    }

    const { data, error } = await supabase.from('forms').insert([{
      name: spec.name,
      fields: resolvedFields,
      settings: resolvedSettings,
      status: 'draft',
      user_id: session.user.id,
    }]).select().single()

    if (error || !data) throw new Error(error?.message || `Could not create "${spec.name}"`)
    if (!primaryFormId) primaryFormId = data.id
    createdByKey[spec.key] = data.id
  }

  return createdByKey
}

// Where the primary form of a just-created bundle should open - payroll-
// flavored bundles (settings.payrollRole === 'employees' on the first
// entry) have a purpose-built Dashboard, more useful as a landing page than
// the empty form builder every other bundle still opens to.
export function bundleDestination(template, primaryFormId) {
  const destination = template.bundle[0].settings?.payrollRole === 'employees'
    ? `/form/${primaryFormId}/payroll?panel=1`
    : `/form/${primaryFormId}/edit?panel=1`
  return destination
}

// Where a freshly created (or existing) location should open by default -
// cart/POS templates land on the order screen, everything else on the
// builder, same convention Templates.jsx already used for single instances.
// The order screen itself no longer auto-opens PosSidePanel's drawer
// (?panel=1) on arrival - the hamburger/back buttons are discoverable
// enough now that popping the menu open unprompted just gets in the way
// of the catalogue you actually came here to see. The builder still does.
export function locationDestination(template, formId) {
  // Expenses books open on their own Overview (src/expenses/), like a
  // cart template opens on its order screen - not the blank builder.
  if (template.slug === 'expenses') return `/form/${formId}/expenses`
  const isCartTemplate = template.fields?.some(f => f.type === 'cart')
  return isCartTemplate ? `/form/${formId}` : `/form/${formId}/edit?panel=1`
}
