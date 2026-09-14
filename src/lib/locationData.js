// Place at: src/lib/locationData.js
// Country -> State -> City data for the "Location" field type.
//
// Backed by @countrystatecity/countries-browser: ~10KB up front, then each
// country's states and each state's cities lazy-load from the jsDelivr CDN
// on demand. Everything here is async and name-in / name-out - the Location
// field stores { country, state, city } as plain names (e.g. "Nigeria" /
// "Lagos" / "Ikeja"), so existing submissions keep working and there's no
// migration. Module-level Maps cache every response for the session.
import {
  getCountries,
  getStatesOfCountry,
  getCitiesOfState,
} from '@countrystatecity/countries-browser'
import { supabase } from '../supabaseClient'

// Sensible default for this app's main market - used where a country is
// needed before the async list has loaded (form builder defaults, SignUp).
export const DEFAULT_COUNTRY = 'Nigeria'

// --- caches -------------------------------------------------------------
let countriesPromise = null // Promise<[{ name, code }]>
const statesCache = new Map() // countryCode -> Promise<[{ name, code }]>
const citiesCache = new Map() // `${countryCode}|${stateCode}` -> Promise<string[]>
// A state name the CDN dataset uses can be wrong/unfamiliar (e.g. Nigerian
// states - see the seed rows in supabase/migrations/20260914100000_
// location_state_overrides.sql). Rather than hardcoding fixes here, they're
// editable from Lab (src/lab/LocationOverridesPage.jsx) - loaded once per
// session and applied on the way out of loadStates. Accept either spelling
// on the way in (stateCode below already searches the overridden list).
let stateOverridesPromise = null // Promise<Map<"country|sourceName" (lowercase), displayName>>

function loadStateOverrides() {
  if (!stateOverridesPromise) {
    stateOverridesPromise = supabase
      .from('location_state_overrides').select('country, source_name, display_name')
      .then(({ data, error }) => {
        if (error) throw error
        return new Map((data || []).map(r => [`${r.country.toLowerCase()}|${r.source_name.toLowerCase()}`, r.display_name]))
      })
      .catch(() => { stateOverridesPromise = null; return new Map() })
  }
  return stateOverridesPromise
}

// --- public API -------------------------------------------------------

// [{ name, code }] sorted by name. `code` is the ISO2 the CDN lookups need;
// callers only ever pass names around.
export function loadCountries() {
  if (!countriesPromise) {
    countriesPromise = getCountries()
      .then(list => list
        .map(c => ({ name: c.name, code: c.iso2 }))
        .sort((a, b) => a.name.localeCompare(b.name)))
      .catch(() => { countriesPromise = null; return [] })
  }
  return countriesPromise
}

async function countryCode(countryName) {
  if (!countryName) return null
  const list = await loadCountries()
  const hit = list.find(c => c.name.toLowerCase() === countryName.toLowerCase())
  return hit ? hit.code : null
}

// [{ name, code }] for a country name, with any Lab-configured overrides
// applied to `name`.
export async function loadStates(countryName) {
  const code = await countryCode(countryName)
  if (!code) return []
  if (!statesCache.has(code)) {
    statesCache.set(code, Promise.all([getStatesOfCountry(code), loadStateOverrides()])
      .then(([list, overrides]) => list
        .map(s => ({ name: overrides.get(`${countryName.toLowerCase()}|${s.name.toLowerCase()}`) || s.name, code: s.iso2 }))
        .sort((a, b) => a.name.localeCompare(b.name)))
      .catch(() => { statesCache.delete(code); return [] }))
  }
  return statesCache.get(code)
}

// The CDN's raw state list for a country, with no overrides applied - what
// Lab's LocationOverridesPage shows so an admin can see the "before" name
// they're overriding, separate from statesCache (which holds the
// already-overridden list every other caller wants).
export async function loadRawStates(countryName) {
  const code = await countryCode(countryName)
  if (!code) return []
  const list = await getStatesOfCountry(code)
  return list.map(s => ({ name: s.name, code: s.iso2 })).sort((a, b) => a.name.localeCompare(b.name))
}

async function stateCode(countryName, stateName) {
  if (!stateName) return null
  const states = await loadStates(countryName)
  const hit = states.find(s => s.name.toLowerCase() === stateName.toLowerCase())
  return hit ? hit.code : null
}

// [cityName] for a country + state name pair.
export async function loadCities(countryName, stateName) {
  const cCode = await countryCode(countryName)
  const sCode = await stateCode(countryName, stateName)
  if (!cCode || !sCode) return []
  const key = `${cCode}|${sCode}`
  if (!citiesCache.has(key)) {
    citiesCache.set(key, getCitiesOfState(cCode, sCode)
      .then(list => list.map(c => c.name).sort((a, b) => a.localeCompare(b)))
      .catch(() => { citiesCache.delete(key); return [] }))
  }
  return citiesCache.get(key)
}

// The CDN dataset still misses real towns in some states, so a Location
// field can carry its own extraCities: { [state]: string[] } patch (see
// FieldTypeConfig's "Add Missing Cities"). Merge helper - sync, takes an
// already-loaded base list.
export function mergeExtraCities(baseCities, field, stateName) {
  const extra = field?.extraCities?.[stateName] || []
  if (extra.length === 0) return baseCities
  return Array.from(new Set([...baseCities, ...extra])).sort((a, b) => a.localeCompare(b))
}

// Convenience: load the field's full city list for a state (base + extras).
export async function loadCitiesForField(field, countryName, stateName) {
  const base = await loadCities(countryName, stateName)
  return mergeExtraCities(base, field, stateName)
}
