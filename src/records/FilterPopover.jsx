import { useState } from 'react'

export function FilterPopover({ field, currentFilter, onApply, onClear }) {
  const [condition, setCondition] = useState(currentFilter?.condition || 'gt')
  const [value, setValue] = useState(currentFilter?.value || '')
  const [value2, setValue2] = useState(currentFilter?.value2 || '')
  const [selected, setSelected] = useState(currentFilter?.selected || [])

  const boxStyle = {
    position: 'absolute', top: '100%', left: 0, background: 'white',
    border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.8rem',
    boxShadow: '0 10px 24px rgba(15,23,42,0.12)', zIndex: 10, width: '240px', maxWidth: '90vw',
    fontWeight: 'normal', fontSize: '0.85rem'
  }

  if (field.type === 'dropdown' || field.type === 'multiplechoice') {
    return (
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filter {field.label}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
          Pick one or more values to narrow the list.
        </div>
        {field.options?.map(opt => (
          <label key={opt} style={{ display: 'block', marginBottom: '0.3rem' }}>
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={(e) => {
                if (e.target.checked) setSelected([...selected, opt])
                else setSelected(selected.filter(o => o !== opt))
              }}
            /> {opt}
          </label>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <button onClick={onClear}>Clear</button>
          <button onClick={() => onApply({ selected })}>Apply</button>
        </div>
      </div>
    )
  }

  if (field.type === 'number') {
    return (
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filter {field.label}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
          Choose a rule and enter a value.
        </div>
        <select value={condition} onChange={(e) => setCondition(e.target.value)} style={{ width: '100%', marginBottom: '0.4rem' }}>
          <option value="gt">Greater than</option>
          <option value="lt">Less than</option>
          <option value="eq">Equal to</option>
          <option value="between">Between</option>
        </select>
        <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" style={{ width: '100%', marginBottom: '0.4rem' }} />
        {condition === 'between' && (
          <input type="number" value={value2} onChange={(e) => setValue2(e.target.value)} placeholder="And..." style={{ width: '100%', marginBottom: '0.4rem' }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClear}>Clear</button>
          <button onClick={() => onApply({ condition, value, value2 })}>Apply</button>
        </div>
      </div>
    )
  }

  if (field.type === 'date') {
    return (
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filter {field.label}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
          Choose a date rule and set the range.
        </div>
        <select value={condition} onChange={(e) => setCondition(e.target.value)} style={{ width: '100%', marginBottom: '0.4rem' }}>
          <option value="after">After</option>
          <option value="before">Before</option>
          <option value="between">Between</option>
        </select>
        <input type="date" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: '100%', marginBottom: '0.4rem' }} />
        {condition === 'between' && (
          <input type="date" value={value2} onChange={(e) => setValue2(e.target.value)} style={{ width: '100%', marginBottom: '0.4rem' }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClear}>Clear</button>
          <button onClick={() => onApply({ condition, value, value2 })}>Apply</button>
        </div>
      </div>
    )
  }

  return (
    <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filter {field.label}
        </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
        Use a keyword to narrow this column.
      </div>
      <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Contains..." style={{ width: '100%', marginBottom: '0.4rem' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onClear}>Clear</button>
        <button onClick={() => onApply({ condition: 'contains', value })}>Apply</button>
      </div>
    </div>
  )
}
