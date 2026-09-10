// The Location field's Country -> State -> City cascade, shared by the
// public form (PublicForm), the builder preview (FormPreview) and anywhere
// else that needs it. Options load lazily from the country-state-city CDN
// (see src/lib/locationData.js); value is { country, state, city } as plain
// names so stored submissions need no migration.
import { useEffect, useState } from 'react'
import { DEFAULT_COUNTRY, loadCountries, loadStates, loadCitiesForField } from '../lib/locationData'

export default function LocationField({ field, value, onChange, plain = false }) {
  const val = value || {}
  const country = val.country || field?.defaultCountry || DEFAULT_COUNTRY

  const [countries, setCountries] = useState([])
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [loadingStates, setLoadingStates] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)

  useEffect(() => {
    let alive = true
    loadCountries().then(list => { if (alive) setCountries(list) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    setLoadingStates(true)
    setStates([])
    loadStates(country).then(list => {
      if (!alive) return
      setStates(list)
      setLoadingStates(false)
    })
    return () => { alive = false }
  }, [country])

  useEffect(() => {
    let alive = true
    if (!val.state) { setCities([]); return }
    setLoadingCities(true)
    setCities([])
    loadCitiesForField(field, country, val.state).then(list => {
      if (!alive) return
      setCities(list)
      setLoadingCities(false)
    })
    return () => { alive = false }
    // field is stable per render of the parent; extraCities changes are a
    // builder concern, not something the respondent triggers mid-fill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, val.state])

  const cls = plain ? 'pf-control' : undefined
  const selStyle = plain ? undefined : { padding: '0.5rem', width: '100%' }

  function set(patch) {
    onChange({ country, ...val, ...patch })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: plain ? '0.7rem' : '0.5rem' }}>
      <div>
        {plain && <span className="pf-sublabel">Country</span>}
        <select
          className={cls} style={selStyle} value={country}
          onChange={(e) => set({ country: e.target.value, state: '', city: '' })}
        >
          {/* keep the current value selectable even before the list resolves */}
          {countries.length === 0 && <option value={country}>{country}</option>}
          {countries.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <div>
        {plain && <span className="pf-sublabel">State / Province</span>}
        <select
          className={cls} style={selStyle} value={val.state || ''}
          onChange={(e) => set({ state: e.target.value, city: '' })}
          disabled={loadingStates}
        >
          <option value="">{loadingStates ? 'Loading…' : 'Select state…'}</option>
          {val.state && !states.some(s => s.name === val.state) && (
            <option value={val.state}>{val.state}</option>
          )}
          {states.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
        </select>
      </div>

      <div>
        {plain && <span className="pf-sublabel">City</span>}
        <select
          className={cls} style={selStyle} value={val.city || ''}
          onChange={(e) => set({ city: e.target.value })}
          disabled={!val.state || loadingCities}
        >
          <option value="">{loadingCities ? 'Loading…' : 'Select city…'}</option>
          {val.city && !cities.includes(val.city) && <option value={val.city}>{val.city}</option>}
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  )
}
