// Place at: src/FormPreview.jsx
// A live, in-browser preview of the form being built, mirrors PublicForm's
// layout and field rendering but never submits anywhere. Used by a floating
// "Preview" button on the Create/Edit form pages so builders can see exactly
// what a respondent will see without saving or leaving the editor.
import { useState } from 'react'
import { COUNTRIES, statesFor, citiesForField } from './lib/locationData'

// Mirrors PublicForm.jsx's buildPages, kept as a separate copy rather than
// a shared import since one lives in a modal with no data-submission
// concerns and the other is the real respondent flow; duplicating this
// small pure function is cheaper than coupling the two.
function buildPages(fields) {
  const pages = []
  let current = null
  fields.forEach(field => {
    if (field.type === 'section') {
      if (current) pages.push(current)
      current = { section: field, fields: [] }
    } else {
      if (!current) current = { section: null, fields: [] }
      current.fields.push(field)
    }
  })
  if (current) pages.push(current)
  if (pages.length === 0) pages.push({ section: null, fields: [] })
  return pages
}

function renderPreviewInput(field, value, onChange) {
  if (field.type === 'longtext') {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: '0.5rem', width: '100%', minHeight: '80px' }}
      />
    )
  }

  if (field.type === 'dropdown') {
    return (
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ padding: '0.5rem', width: '100%' }}>
        <option value="">Select an option</option>
        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    )
  }

  if (field.type === 'multiplechoice') {
    return (
      <div>
        {field.options?.map(opt => (
          <label key={opt} style={{ display: 'block', marginBottom: '0.3rem' }}>
            <input type="radio" name={field.id} value={opt} checked={value === opt} onChange={(e) => onChange(e.target.value)} />
            {' '}{opt}
          </label>
        ))}
      </div>
    )
  }

  if (field.type === 'checkbox') {
    const selected = value || []
    function toggle(opt) {
      onChange(selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt])
    }
    return (
      <div>
        {field.options?.map(opt => (
          <label key={opt} style={{ display: 'block', marginBottom: '0.3rem' }}>
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
            {' '}{opt}
          </label>
        ))}
      </div>
    )
  }

  if (field.type === 'linearscale') {
    const scaleMin = field.scaleMin ?? 1
    const scaleMax = field.scaleMax ?? 5
    const values = []
    for (let i = scaleMin; i <= scaleMax; i++) values.push(i)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        {field.minLabel && <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{field.minLabel}</span>}
        {values.map(val => (
          <button key={val} type="button" onClick={() => onChange(val)} className={value === val ? '' : 'secondary'} style={{ padding: '0.5rem 0.9rem', minWidth: '40px' }}>
            {val}
          </button>
        ))}
        {field.maxLabel && <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{field.maxLabel}</span>}
      </div>
    )
  }

  if (field.type === 'rating') {
    const maxStars = field.maxStars ?? 5
    const selected = Number(value) || 0
    return (
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        {Array.from({ length: maxStars }, (_, i) => i + 1).map(star => (
          <span key={star} onClick={() => onChange(star)} style={{ cursor: 'pointer', fontSize: '1.6rem', lineHeight: 1, color: star <= selected ? '#f5b400' : '#ddd' }}>★</span>
        ))}
      </div>
    )
  }

  if (field.type === 'multiplechoicegrid' || field.type === 'checkboxgrid') {
    const gridAnswers = value || {}
    const isCheckbox = field.type === 'checkboxgrid'

    function setCell(row, col) {
      if (isCheckbox) {
        const current = gridAnswers[row] || []
        onChange({ ...gridAnswers, [row]: current.includes(col) ? current.filter(c => c !== col) : [...current, col] })
      } else {
        onChange({ ...gridAnswers, [row]: col })
      }
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th></th>
              {field.columns?.map(col => <th key={col} style={{ fontSize: '0.8rem', fontWeight: 500, padding: '0.4rem', textAlign: 'center' }}>{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {field.rows?.map(row => (
              <tr key={row}>
                <td style={{ fontSize: '0.85rem', padding: '0.4rem' }}>{row}</td>
                {field.columns?.map(col => (
                  <td key={col} style={{ textAlign: 'center', padding: '0.4rem' }}>
                    <input
                      type={isCheckbox ? 'checkbox' : 'radio'}
                      name={isCheckbox ? undefined : `${field.id}-${row}`}
                      checked={isCheckbox ? (gridAnswers[row] || []).includes(col) : gridAnswers[row] === col}
                      onChange={() => setCell(row, col)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (field.type === 'fileupload') {
    return (
      <div>
        <input type="file" accept={field.acceptTypes || undefined} disabled />
        <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.4rem' }}>
          File upload is disabled in preview.
        </p>
      </div>
    )
  }

  if (field.type === 'cart') {
    const products = field.products || []
    return (
      <div>
        {products.length === 0 ? (
          <p style={{ color: '#999', margin: 0 }}>No products added to this cart yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.6rem' }}>
            {products.map(p => (
              <div key={p.id} className="card" style={{ padding: '0.7rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name || 'Untitled product'}</div>
                {p.category && <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>{p.category}</div>}
                <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: '0.3rem' }}>
                  ₦{Number(p.price || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (field.type === 'autocomplete') {
    return (
      <>
        <input
          type="text"
          list={`preview-autocomplete-${field.id}`}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ padding: '0.5rem', width: '100%' }}
        />
        <datalist id={`preview-autocomplete-${field.id}`}>
          {field.options?.map(opt => <option key={opt} value={opt} />)}
        </datalist>
      </>
    )
  }

  if (field.type === 'location') {
    const locationValue = value || {}
    const country = locationValue.country || field.defaultCountry || COUNTRIES[0]
    const stateOptions = statesFor(country)
    const cityOptions = locationValue.state ? citiesForField(field, country, locationValue.state) : []

    function setLocationPart(patch) {
      onChange({ country, ...locationValue, ...patch })
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <select value={country} onChange={(e) => setLocationPart({ country: e.target.value, state: '', city: '' })} style={{ padding: '0.5rem' }}>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={locationValue.state || ''} onChange={(e) => setLocationPart({ state: e.target.value, city: '' })} style={{ padding: '0.5rem' }}>
          <option value="">Select state...</option>
          {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={locationValue.city || ''} onChange={(e) => setLocationPart({ city: e.target.value })} style={{ padding: '0.5rem' }} disabled={!locationValue.state}>
          <option value="">Select city...</option>
          {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    )
  }

  const inputType =
    field.type === 'number' ? 'number' :
    field.type === 'email' ? 'email' :
    field.type === 'phone' ? 'tel' :
    field.type === 'date' ? 'date' :
    field.type === 'time' ? 'time' :
    'text'

  return <input type={inputType} value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ padding: '0.5rem', width: '100%' }} />
}

function FormPreviewModal({ formName, description, fields, onClose }) {
  const [answers, setAnswers] = useState({})
  const [pageIndex, setPageIndex] = useState(0)

  function updateAnswer(fieldId, value) {
    setAnswers(current => ({ ...current, [fieldId]: value }))
  }

  const pages = buildPages(fields)
  const currentPage = pages[Math.min(pageIndex, pages.length - 1)]
  const isLastPage = pageIndex >= pages.length - 1

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
        zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        padding: '3rem 1rem', overflowY: 'auto'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: '640px', width: '100%', padding: '1.5rem', background: 'var(--color-surface)', position: 'relative' }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '1rem', paddingBottom: '0.8rem', borderBottom: '1px solid var(--color-border)'
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)' }}>
            Preview - respondent view
          </span>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>

        <h1 style={{ marginTop: 0 }}>{formName || 'Untitled Form'}</h1>
        {description && <p>{description}</p>}

        {fields.length === 0 && (
          <p style={{ color: 'var(--color-muted)' }}>Add some fields to see them here.</p>
        )}

        {fields.length > 0 && pages.length > 1 && (
          <div style={{ margin: '0.6rem 0 1rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>
              Page {Math.min(pageIndex, pages.length - 1) + 1} of {pages.length}
            </div>
            <div style={{ height: '4px', background: '#eee', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${((Math.min(pageIndex, pages.length - 1) + 1) / pages.length) * 100}%`,
                background: 'var(--color-primary)', transition: 'width 0.2s ease'
              }} />
            </div>
          </div>
        )}

        {currentPage.section && (
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.15rem' }}>{currentPage.section.title || 'Untitled Section'}</h2>
            {currentPage.section.description && (
              <p style={{ margin: 0, color: 'var(--color-muted)' }}>{currentPage.section.description}</p>
            )}
          </div>
        )}

        {currentPage.fields.map(field => (
          <div key={field.id} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <label style={{ fontWeight: 600 }}>
              {field.label || 'Untitled question'}{field.required && <span style={{ color: '#c0392b' }}> *</span>}
            </label>
            <div style={{ marginTop: '0.5rem' }}>
              {renderPreviewInput(field, answers[field.id], (value) => updateAnswer(field.id, value))}
            </div>
          </div>
        ))}

        {fields.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem' }}>
            {pageIndex > 0 ? (
              <button className="secondary" onClick={() => setPageIndex(i => Math.max(0, i - 1))} style={{ padding: '0.7rem 1.5rem', fontSize: '1rem' }}>
                Back
              </button>
            ) : <span />}
            {isLastPage ? (
              <button disabled title="Preview only, submitting is disabled" style={{ padding: '0.7rem 1.5rem', fontSize: '1rem', opacity: 0.6, cursor: 'not-allowed' }}>
                Submit
              </button>
            ) : (
              <button onClick={() => setPageIndex(i => Math.min(pages.length - 1, i + 1))} style={{ padding: '0.7rem 1.5rem', fontSize: '1rem' }}>
                Next
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FormPreviewModal
