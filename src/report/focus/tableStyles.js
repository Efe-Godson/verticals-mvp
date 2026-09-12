// Place at: src/report/focus/tableStyles.js
// Shared table cell styles for Focus Mode's full-results / records tables -
// matches the aggregated-data table already used in ../builder/ViewDataModal
// so both surfaces read as the same design language, not two different ones.
export const th = {
  textAlign: 'left', padding: '0.5rem 0.7rem', fontSize: '0.76rem',
  color: 'var(--color-muted)', borderBottom: '2px solid var(--color-border)',
  whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--color-surface)',
}

export const td = {
  padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--color-border)',
  fontVariantNumeric: 'tabular-nums',
}
