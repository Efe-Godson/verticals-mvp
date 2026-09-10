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

// Sensible default for this app's main market - used where a country is
// needed before the async list has loaded (form builder defaults, SignUp).
export const DEFAULT_COUNTRY = 'Nigeria'

// A few Nigerian state names in the source data don't match common local
// usage / what older submissions stored. Normalise on the way out (display)
// and accept either spelling on the way in (lookups).
const STATE_ALIASES = {
  'Abuja Federal Capital Territory': 'Abuja (FCT)',
  'Nassarawa': 'Nasarawa',
}
const normalizeState = (name) => STATE_ALIASES[name] || name

// --- caches -------------------------------------------------------------
let countriesPromise = null // Promise<[{ name, code }]>
const statesCache = new Map() // countryCode -> Promise<[{ name, code }]>
const citiesCache = new Map() // `${countryCode}|${stateCode}` -> Promise<string[]>

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

// [{ name, code }] for a country name. `name` is already normalised.
export async function loadStates(countryName) {
  const code = await countryCode(countryName)
  if (!code) return []
  if (!statesCache.has(code)) {
    statesCache.set(code, getStatesOfCountry(code)
      .then(list => list
        .map(s => ({ name: normalizeState(s.name), code: s.iso2 }))
        .sort((a, b) => a.name.localeCompare(b.name)))
      .catch(() => { statesCache.delete(code); return [] }))
  }
  return statesCache.get(code)
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
