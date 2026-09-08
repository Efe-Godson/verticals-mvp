import { useMemo, useState } from 'react'

// Excel-style column dropdown for the Records table: sort the column, and
// filter it by ticking specific values (with a "(Blanks)" option and a
// contains-text box). Replaces the old per-type FilterPopover.
//
//   valueSummary : { values: [{ v, count }], hasBlanks, blankCount }
//                  `values` already in the order they should display.
//   currentFilter: the saved filter for this column, or undefined.
//   currentSort  : 'asc' | 'desc' | null  (only set when THIS column is the
//                  sorted one).
export function ColumnHeaderMenu({
  field, valueSummary, currentFilter, currentSort,
  onSort, onApply, onClear, onClose,
}) {
  const allValues = useMemo(() => valueSummary.values.map(x => x.v), [valueSummary])

  // Seed the tick state from the saved filter. No filter -> everything on.
  const seededChecked = () => {
    if (currentFilter?.kind === 'values' && currentFilter.values != null) {
      return new Set(currentFilter.values)
    }
    return new Set(allValues)
  }
  const [checked, setChecked] = useState(seededChecked)
  const [blankOn, setBlankOn] = useState(
    currentFilter?.kind === 'values' ? !!currentFilter.includeBlanks : true,
  )
  const [text, setText] = useState(currentFilter?.kind === 'values' ? (currentFilter.text || '') : '')
  const [listSearch, setListSearch] = useState('')

  const q = listSearch.trim().toLowerCase()
  const shownValues = q
    ? valueSummary.values.filter(x => x.v.toLowerCase().includes(q))
    : valueSummary.values

  const sortLabels = field.type === 'number'
    ? ['Sort 0 → 9', 'Sort 9 → 0']
    : field.type === 'date'
      ? ['Sort oldest first', 'Sort newest first']
      : ['Sort A → Z', 'Sort Z → A']

  function toggleValue(v) {
    setChecked(cur => {
      const next = new Set(cur)
      if (next.has(v)) next.delete(v); else next.add(v)
      return next
    })
  }
  function selectAll() { setChecked(new Set(allValues)); setBlankOn(true) }
  function selectNone() { setChecked(new Set()); setBlankOn(false) }

  function apply() {
    const everyValue = checked.size === allValues.length
    const everything = everyValue && (!valueSummary.hasBlanks || blankOn) && !text.trim()
    if (everything) { onClear(); return }
    onApply({
      kind: 'values',
      values: everyValue ? null : [...checked],
      includeBlanks: blankOn,
      text: text.trim(),
    })
  }

  const box = {
    position: 'absolute', top: '100%', left: 0, marginTop: '0.25rem',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: '10px', boxShadow: '0 12px 28px rgba(15,23,42,0.16)',
    zIndex: 21, width: '260px', maxWidth: '92vw', padding: '0.5rem',
    fontWeight: 400, fontSize: '0.85rem',
  }
  const sortBtn = (active) => ({
    display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%',
    textAlign: 'left', border: 'none', background: active ? 'var(--color-primary-soft)' : 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: active ? 700 : 400,
    padding: '0.45rem 0.5rem', borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer',
  })
  const rule = { height: 1, background: 'var(--color-border)', margin: '0.4rem 0' }

  return (
    <div style={box} onClick={(e) => e.stopPropagation()}>
      <button type="button" style={sortBtn(currentSort === 'asc')} onClick={() => { onSort(currentSort === 'asc' ? null : 'asc'); onClose() }}>
        {currentSort === 'asc' ? '✓ ' : ''}{sortLabels[0]}
      </button>
      <button type="button" style={sortBtn(currentSort === 'desc')} onClick={() => { onSort(currentSort === 'desc' ? null : 'desc'); onClose() }}>
        {currentSort === 'desc' ? '✓ ' : ''}{sortLabels[1]}
      </button>

      <div style={rule} />

      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Contains text…`}
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.4rem' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <strong style={{ fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
          Filter by value
        </strong>
        <span style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={selectAll} style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}>All</button>
          <button type="button" onClick={selectNone} style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}>None</button>
        </span>
      </div>

      {valueSummary.values.length > 8 && (
        <input
          type="text"
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          placeholder="Search values…"
          style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.35rem' }}
        />
      )}

      <div style={{ maxHeight: '190px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.35rem 0.4rem' }}>
        {valueSummary.hasBlanks && !q && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.2rem 0' }}>
            <input type="checkbox" checked={blankOn} onChange={() => setBlankOn(v => !v)} />
            <span style={{ fontStyle: 'italic', color: 'var(--color-muted)' }}>(Blanks)</span>
            <span style={{ marginLeft: 'auto', color: 'var(--color-muted)', fontSize: '0.75rem' }}>{valueSummary.blankCount}</span>
          </label>
        )}
        {shownValues.length === 0 && (
          <div style={{ color: 'var(--color-muted)', fontSize: '0.8rem', padding: '0.3rem 0' }}>No values.</div>
        )}
        {shownValues.map(({ v, count }) => (
          <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.2rem 0' }}>
            <input type="checkbox" checked={checked.has(v)} onChange={() => toggleValue(v)} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--color-muted)', fontSize: '0.75rem' }}>{count}</span>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
        <button type="button" className="secondary" onClick={() => { onClear(); onClose() }}>Clear filter</button>
        <button type="button" onClick={() => { apply(); onClose() }}>Apply</button>
      </div>
    </div>
  )
}
