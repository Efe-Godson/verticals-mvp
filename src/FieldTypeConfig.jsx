import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { COUNTRIES, statesFor, citiesForField } from './lib/locationData'

const TYPES_WITH_GRID = ['multiplechoicegrid', 'checkboxgrid']

function updateListField(field, index, updateField, key, text) {
  const items = text.split(',').map(o => o.trim()).filter(o => o !== '')
  updateField(index, { [`${key}Text`]: text, [key]: items })
}

// A dropdown whose options come from another one of your own forms' records
// (e.g. a "Salary Events" form linking to "Employees") instead of a fixed
// list, lets one form reference specific records in another.
function LinkedRecordConfig({ field, index, updateField }) {
  const { session } = useAuth()
  const [forms, setForms] = useState([])

  useEffect(() => {
    async function loadForms() {
      const { data } = await supabase
        .from('forms').select('id, name, fields')
        .eq('user_id', session.user.id)
        .is('deleted_at', null)
        .order('name', { ascending: true })
      setForms(data || [])
    }
    loadForms()
  }, [session])

  const linkedForm = forms.find(f => f.id === field.linkedFormId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.3rem' }}>
      <select
        value={field.linkedFormId || ''}
        onChange={(e) => updateField(index, { linkedFormId: e.target.value || undefined, linkedDisplayFieldId: undefined })}
        style={{ padding: '0.4rem' }}
      >
        <option value="">Link to form...</option>
        {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>

      {linkedForm && (
        <select
          value={field.linkedDisplayFieldId || ''}
          onChange={(e) => updateField(index, { linkedDisplayFieldId: e.target.value || undefined })}
          style={{ padding: '0.4rem' }}
        >
          <option value="">Field to display...</option>
          {(linkedForm.fields || []).filter(f => f.type !== 'cart' && f.type !== 'section').map(f => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}

// Own component (not inline JSX in the big if/else below) purely so it can
// hold showCitiesModal - hooks can't live inside a plain if-branch.
function LocationConfig({ field, index, updateField }) {
  const [showCitiesModal, setShowCitiesModal] = useState(false)

  return (
    <div style={{ marginTop: '0.3rem' }}>
      <label style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Default country</label>
      <select
        value={field.defaultCountry || COUNTRIES[0]}
        onChange={(e) => updateField(index, { defaultCountry: e.target.value })}
        style={{ padding: '0.4rem', marginTop: '0.2rem', maxWidth: '100%', display: 'block' }}
      >
        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <button
        type="button" className="secondary" onClick={() => setShowCitiesModal(true)}
        style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
      >
        + Add Missing Cities
      </button>

      {showCitiesModal && (
        <ManageCitiesModal field={field} index={index} updateField={updateField} onClose={() => setShowCitiesModal(false)} />
      )}
    </div>
  )
}

// The country-state-city dataset this app ships (see locationData.js) is
// genuinely missing real towns in a lot of states. Rather than that being a
// dead end, a Location field can patch in its own extra cities per state -
// stored on the field itself (extraCities), merged in everywhere cities are
// listed (citiesForField).
function ManageCitiesModal({ field, index, updateField, onClose }) {
  const country = field.defaultCountry || COUNTRIES[0]
  const stateOptions = statesFor(country)
  const [state, setState] = useState(stateOptions[0] || '')
  const [cityName, setCityName] = useState('')

  const extraCities = field.extraCities || {}
  const addedStates = Object.keys(extraCities).filter(s => extraCities[s]?.length > 0)

  function addCity() {
    const trimmed = cityName.trim()
    if (!trimmed || !state) return
    const existing = citiesForField(field, country, state)
    if (existing.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setCityName('')
      return // already there (base dataset or already added) - nothing to do
    }
    updateField(index, { extraCities: { ...extraCities, [state]: [...(extraCities[state] || []), trimmed] } })
    setCityName('')
  }

  function removeCity(fromState, city) {
    const remaining = (extraCities[fromState] || []).filter(c => c !== city)
    const next = { ...extraCities }
    if (remaining.length > 0) next[fromState] = remaining
    else delete next[fromState]
    updateField(index, { extraCities: next })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ background: 'white', padding: '1.5rem', width: '420px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <h3 style={{ margin: '0 0 0.3rem' }}>Add Missing Cities</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: '0 0 1rem' }}>
          If a city isn't in the list for a state, add it here - it'll show up alongside the built-in ones for this field.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <select value={state} onChange={(e) => setState(e.target.value)} style={{ flex: 1, padding: '0.5rem', minWidth: 0 }}>
            {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="text" value={cityName} onChange={(e) => setCityName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCity() } }}
            placeholder="City name" style={{ flex: 1, padding: '0.5rem', minWidth: 0 }}
          />
          <button type="button" disabled={!cityName.trim()} onClick={addCity} style={{ flexShrink: 0 }}>Add</button>
        </div>

        {addedStates.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>No cities added yet.</p>
        ) : (
          addedStates.map(s => (
            <div key={s} style={{ marginBottom: '0.7rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', marginBottom: '0.3rem' }}>{s}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {extraCities[s].map(city => (
                  <span
                    key={city}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem',
                      padding: '0.25rem 0.6rem', borderRadius: '999px', border: '1px solid var(--color-border)'
                    }}
                  >
                    {city}
                    <span onClick={() => removeCity(s, city)} style={{ color: '#c0392b', cursor: 'pointer' }}>✕</span>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" className="secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

// Renders the extra builder inputs a field type needs beyond label/type/options:
// grid rows & columns, scale range, star count, or upload constraints.
function FieldTypeConfig({ field, index, updateField }) {
  if (TYPES_WITH_GRID.includes(field.type)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.3rem' }}>
        <input
          type="text"
          value={field.rowsText !== undefined ? field.rowsText : (field.rows || []).join(', ')}
          onChange={(e) => updateListField(field, index, updateField, 'rows', e.target.value)}
          placeholder="Rows (questions), comma separated e.g. Quality, Price, Service"
          style={{ padding: '0.5rem' }}
        />
        <input
          type="text"
          value={field.columnsText !== undefined ? field.columnsText : (field.columns || []).join(', ')}
          onChange={(e) => updateListField(field, index, updateField, 'columns', e.target.value)}
          placeholder="Columns (options), comma separated e.g. Poor, Average, Good"
          style={{ padding: '0.5rem' }}
        />
      </div>
    )
  }

  if (field.type === 'linearscale') {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
        <input
          type="number"
          placeholder="Min (e.g. 1)"
          value={field.scaleMin ?? ''}
          onChange={(e) => updateField(index, { scaleMin: e.target.value === '' ? undefined : Number(e.target.value) })}
          style={{ flex: 1, padding: '0.4rem', minWidth: '80px' }}
        />
        <input
          type="number"
          placeholder="Max (e.g. 5)"
          value={field.scaleMax ?? ''}
          onChange={(e) => updateField(index, { scaleMax: e.target.value === '' ? undefined : Number(e.target.value) })}
          style={{ flex: 1, padding: '0.4rem', minWidth: '80px' }}
        />
        <input
          type="text"
          placeholder="Min label (optional)"
          value={field.minLabel ?? ''}
          onChange={(e) => updateField(index, { minLabel: e.target.value })}
          style={{ flex: 2, padding: '0.4rem', minWidth: '120px' }}
        />
        <input
          type="text"
          placeholder="Max label (optional)"
          value={field.maxLabel ?? ''}
          onChange={(e) => updateField(index, { maxLabel: e.target.value })}
          style={{ flex: 2, padding: '0.4rem', minWidth: '120px' }}
        />
      </div>
    )
  }

  if (field.type === 'rating') {
    return (
      <div style={{ marginTop: '0.3rem' }}>
        <input
          type="number"
          min="2"
          max="10"
          placeholder="Number of stars (default 5)"
          value={field.maxStars ?? ''}
          onChange={(e) => updateField(index, { maxStars: e.target.value === '' ? undefined : Number(e.target.value) })}
          style={{ padding: '0.4rem', width: '220px', maxWidth: '100%' }}
        />
      </div>
    )
  }

  if (field.type === 'linked_record') {
    return <LinkedRecordConfig field={field} index={index} updateField={updateField} />
  }

  if (field.type === 'location') {
    return <LocationConfig field={field} index={index} updateField={updateField} />
  }

  if (field.type === 'fileupload') {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Accepted file types e.g. .pdf,.jpg,.png (optional)"
          value={field.acceptTypes ?? ''}
          onChange={(e) => updateField(index, { acceptTypes: e.target.value })}
          style={{ flex: 2, padding: '0.4rem', minWidth: '200px' }}
        />
        <input
          type="number"
          min="1"
          placeholder="Max size MB (default 5)"
          value={field.maxSizeMB ?? ''}
          onChange={(e) => updateField(index, { maxSizeMB: e.target.value === '' ? undefined : Number(e.target.value) })}
          style={{ flex: 1, padding: '0.4rem', minWidth: '140px' }}
        />
      </div>
    )
  }

  return null
}

export default FieldTypeConfig
