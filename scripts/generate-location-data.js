// Regenerates src/lib/locationData.js from the `country-state-city` npm
// package instead of hand-maintaining city lists. Run: node scripts/generate-location-data.js
//
// To add another country, add its name to the COUNTRY_NAMES array below —
// country-state-city already has the states/cities data for it, this just
// controls which countries actually ship in the app's Location field.
import { Country, State, City } from 'country-state-city'
import nodeFs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const COUNTRY_NAMES = ['Nigeria']

// A few state names in the source data don't match common Nigerian usage.
function normalizeStateName(name) {
  if (name === 'Abuja Federal Capital Territory') return 'Abuja (FCT)'
  if (name === 'Nassarawa') return 'Nasarawa'
  return name
}

const data = {}
for (const countryName of COUNTRY_NAMES) {
  const country = Country.getAllCountries().find(c => c.name === countryName)
  if (!country) throw new Error(`Country not found in country-state-city: ${countryName}`)

  const states = State.getStatesOfCountry(country.isoCode)
    .map(s => ({ ...s, name: normalizeStateName(s.name) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const countryData = {}
  for (const state of states) {
    const cities = City.getCitiesOfState(country.isoCode, state.isoCode)
      .map(c => c.name.trim())
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b))
    countryData[state.name] = cities
  }
  data[countryName] = countryData
}

const lines = []
lines.push('// Place at: src/lib/locationData.js')
lines.push('// Reference data for the "Location" field type\'s Country -> State -> City')
lines.push('// cascade. Generated from the country-state-city npm package — run')
lines.push('// `node scripts/generate-location-data.js` to regenerate or add a country')
lines.push('// (edit COUNTRY_NAMES there), rather than hand-editing this file.')
lines.push('export const LOCATION_DATA = {')
for (const [countryName, states] of Object.entries(data)) {
  lines.push(`  ${JSON.stringify(countryName)}: {`)
  for (const [stateName, cities] of Object.entries(states)) {
    lines.push(`    ${JSON.stringify(stateName)}: ${JSON.stringify(cities)},`)
  }
  lines.push('  },')
}
lines.push('}')
lines.push('')
lines.push('export const COUNTRIES = Object.keys(LOCATION_DATA)')
lines.push('')
lines.push('export function statesFor(country) {')
lines.push('  return Object.keys(LOCATION_DATA[country] || {})')
lines.push('}')
lines.push('')
lines.push('export function citiesFor(country, state) {')
lines.push('  return (LOCATION_DATA[country] || {})[state] || []')
lines.push('}')
lines.push('')

const outPath = path.join(__dirname, '..', 'src', 'lib', 'locationData.js')
nodeFs.writeFileSync(outPath, lines.join('\n'))

const stateCount = Object.values(data).reduce((sum, states) => sum + Object.keys(states).length, 0)
const cityCount = Object.values(data).reduce((sum, states) => sum + Object.values(states).reduce((s, c) => s + c.length, 0), 0)
console.log(`Wrote ${outPath}: ${Object.keys(data).length} countries, ${stateCount} states, ${cityCount} cities.`)
