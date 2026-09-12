// Place at: src/report/focus/FocusResultsTable.jsx
// The "All results" table in Focus Mode (brief §9-11): the complete result
// behind a visual, independent of whatever the chart above is limited to.
// Client-side search / sort / pagination - the whole app already loads all
// submissions into the browser for reports, so this matches that model
// rather than introducing a server round trip.
import { useMemo, useState } from 'react'
import { th, td } from './tableStyles'

const PAGE_SIZE = 50

function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a ?? '').localeCompare(String(b ?? ''))
}

export default function FocusResultsTable({
  columns, rows, countLabel, searchPlaceholder = 'Search...',
  defaultSort, onRowClick, selectedKey, rowKey = (r) => r.key,
  emptyTitle = 'No matching records', emptyHint = 'Try changing or clearing your filters.',
}) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(defaultSort || null)
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter(r => columns.some(c => {
      if (c.searchable === false) return false
      const v = c.format ? c.format(r) : r[c.key]
      return String(v ?? '').toLowerCase().includes(q)
    }))
  }, [rows, search, columns])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const col = columns.find(c => c.key === sort.key)
    if (!col) return filtered
    const getVal = col.sortValue || ((r) => r[col.key])
    const out = [...filtered].sort((a, b) => compareValues(getVal(a), getVal(b)))
    return sort.dir === 'desc' ? out.reverse() : out
  }, [filtered, sort, columns])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount - 1)
  const pageRows = sorted.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  function toggleSort(col) {
    if (!col.sortable) return
    setPage(0)
    setSort(prev => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: col.defaultDir || 'desc' }
      return { key: col.key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {countLabel && <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>{countLabel}</div>}
        <input
          type="text" value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          placeholder={searchPlaceholder}
          style={{
            fontSize: '0.82rem', padding: '0.35rem 0.6rem', borderRadius: '6px',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            color: 'var(--color-text)', minWidth: '180px', flex: '0 1 240px',
          }}
        />
      </div>

      {sorted.length === 0 ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.3rem', color: 'var(--color-text)' }}>{emptyTitle}</div>
          <div style={{ fontSize: '0.85rem', marginBottom: search ? '0.7rem' : 0 }}>{emptyHint}</div>
          {search && (
            <button className="secondary" style={{ fontSize: '0.8rem' }} onClick={() => setSearch('')}>Clear search</button>
          )}
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  {columns.map(c => (
                    <th
                      key={c.key}
                      onClick={() => toggleSort(c)}
                      style={{ ...th, textAlign: c.align || 'left', cursor: c.sortable ? 'pointer' : 'default', userSelect: 'none' }}
                      title={c.sortable ? 'Click to sort' : undefined}
                    >
                      {c.label}{sort?.key === c.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => {
                  const key = rowKey(r, i)
                  return (
                    <tr
                      key={key}
                      onClick={onRowClick ? () => onRowClick(r) : undefined}
                      style={{
                        cursor: onRowClick ? 'pointer' : 'default',
                        background: selectedKey && key === selectedKey ? 'var(--color-primary-soft)' : 'transparent',
                      }}
                    >
                      {columns.map(c => (
                        <td key={c.key} style={{ ...td, textAlign: c.align || 'left', fontWeight: c.emphasize ? 600 : 400 }}>
                          {c.format ? c.format(r) : r[c.key]}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
              <span>Showing {clampedPage * PAGE_SIZE + 1}-{Math.min(sorted.length, (clampedPage + 1) * PAGE_SIZE)} of {sorted.length}</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="secondary" style={{ fontSize: '0.78rem' }} disabled={clampedPage === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
                <button className="secondary" style={{ fontSize: '0.78rem' }} disabled={clampedPage >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
