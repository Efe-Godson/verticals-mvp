// Place at: src/lab/LocationOverridesPage.jsx
// Lab -> Location Names (/lab/location-names). Lets the admin fix a state
// name the @countrystatecity CDN returns for the Location field (src/
// components/LocationField.jsx) without a code change - replaces the old
// hardcoded STATE_ALIASES object in src/lib/locationData.js, which is now
// seeded from supabase/migrations/20260914100000_location_state_overrides.sql
// and read live by loadStates() there. Pick a country, see every one of its
// raw state names, and type what it should display as instead; blank clears
// the override back to the raw name.
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../Toast'
import { ErrorState } from '../ErrorState'
import { usePageBack } from '../PageTitleContext'
import LabSidePanel from '../LabSidePanel'
import { DEFAULT_COUNTRY, loadCountries, loadRawStates } from '../lib/locationData'

export default function LocationOverridesPage() {
  usePageBack('/lab', 'Lab')
  const { showToast } = useToast()

  const [countries, setCountries] = useState([])
  const [country, setCountry] = useState(DEFAULT_COUNTRY)
  const [rawStates, setRawStates] = useState([])
  const [overrides, setOverrides] = useState({}) // sourceName.toLowerCase() -> override row
  const [edits, setEdits] = useState({}) // sourceName.toLowerCase() -> uncommitted input value
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingKey, setSavingKey] = useState(null)

  useEffect(() => { loadCountries().then(setCountries) }, [])

  async function loadCountryData() {
    setLoading(true)
    setError('')
    setEdits({})
    try {
      const [states, { data, error: fetchError }] = await Promise.all([
        loadRawStates(country),
        supabase.from('location_state_overrides').select('*').eq('country', country),
      ])
      if (fetchError) throw new Error(fetchError.message)
      setRawStates(states)
      setOverrides(Object.fromEntries((data || []).map(r => [r.source_name.toLowerCase(), r])))
    } catch (err) {
      setError('Could not load states: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCountryData() }, [country])

  function valueFor(sourceName) {
    const key = sourceName.toLowerCase()
    return edits[key] !== undefined ? edits[key] : (overrides[key]?.display_name || '')
  }

  function isDirty(sourceName) {
    const key = sourceName.toLowerCase()
    if (edits[key] === undefined) return false
    return edits[key].trim() !== (overrides[key]?.display_name || '').trim()
  }

  async function saveOverride(sourceName) {
    const key = sourceName.toLowerCase()
    const value = (edits[key] || '').trim()
    setSavingKey(key)
    try {
      if (!value || value === sourceName) {
        if (overrides[key]) {
          const { error: deleteError } = await supabase.from('location_state_overrides').delete().eq('id', overrides[key].id)
          if (deleteError) throw new Error(deleteError.message)
          setOverrides(current => { const next = { ...current }; delete next[key]; return next })
        }
      } else {
        const { data, error: upsertError } = await supabase
          .from('location_state_overrides')
          .upsert(
            { country, source_name: sourceName, display_name: value, updated_at: new Date().toISOString() },
            { onConflict: 'country,source_name' }
          )
          .select().single()
        if (upsertError) throw new Error(upsertError.message)
        setOverrides(current => ({ ...current, [key]: data }))
      }
      setEdits(current => { const next = { ...current }; delete next[key]; return next })
      showToast('Saved.', 'success')
    } catch (err) {
      showToast('Could not save: ' + err.message, 'error')
    } finally {
      setSavingKey(null)
    }
  }

  if (error) return <ErrorState message={error} onRetry={loadCountryData} />

  const filtered = rawStates.filter(s => s.name.toLowerCase().includes(filter.trim().toLowerCase()))

  return (
    <div className="page">
      <LabSidePanel />
      <h1 style={{ marginBottom: '0.3rem' }}>Location Names</h1>
      <p style={{ color: 'var(--color-muted)', marginTop: 0, marginBottom: '1.5rem' }}>
        Fix a state name shown in the Location field's dropdown. Leave a field blank to show the raw name again.
      </p>

      <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
        <select value={country} onChange={e => setCountry(e.target.value)} style={{ minWidth: '200px' }}>
          {countries.length === 0 && <option value={country}>{country}</option>}
          {countries.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
        </select>
        <input
          type="text" value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filter states..." style={{ flex: 1, minWidth: '160px' }}
        />
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-muted)' }}>Loading states...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>No states match "{filter}".</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map(s => (
            <div key={s.code} style={{
              padding: '0.7rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: '0.6rem', borderBottom: '1px solid var(--color-border)',
            }}>
              <div style={{ minWidth: '160px', fontWeight: 600 }}>{s.name}</div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, minWidth: '220px' }}>
                <input
                  type="text"
                  value={valueFor(s.name)}
                  onChange={e => setEdits(current => ({ ...current, [s.name.toLowerCase()]: e.target.value }))}
                  placeholder={s.name}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  disabled={!isDirty(s.name) || savingKey === s.name.toLowerCase()}
                  onClick={() => saveOverride(s.name)}
                >
                  {savingKey === s.name.toLowerCase() ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
