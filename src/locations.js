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

// Where a freshly created (or existing) location should open by default -
// cart/POS templates land on the order screen, everything else on the
// builder, same convention Templates.jsx already used for single instances.
export function locationDestination(template, formId) {
  const isCartTemplate = template.fields?.some(f => f.type === 'cart')
  return isCartTemplate ? `/form/${formId}?panel=1` : `/form/${formId}/edit?panel=1`
}
