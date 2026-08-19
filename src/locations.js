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
    },
  }]).select().single()

  if (error || !data) throw new Error(error?.message || 'Could not create this location')
  return data
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

// Where a freshly created (or existing) location should open by default -
// cart/POS templates land on the order screen, everything else on the
// builder, same convention Templates.jsx already used for single instances.
// The order screen itself no longer auto-opens PosSidePanel's drawer
// (?panel=1) on arrival - the hamburger/back buttons are discoverable
// enough now that popping the menu open unprompted just gets in the way
// of the catalogue you actually came here to see. The builder still does.
export function locationDestination(template, formId) {
  const isCartTemplate = template.fields?.some(f => f.type === 'cart')
  return isCartTemplate ? `/form/${formId}` : `/form/${formId}/edit?panel=1`
}
