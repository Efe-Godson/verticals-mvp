// Place at: src/components/DataCards.jsx
// The phone-side counterpart to a wide data table. Desktop keeps its dense
// multi-column <table>; below the mobile breakpoint a screen renders the same
// rows as a short stack of these cards instead - 3-4 key fields visible, the
// rest behind a tap that opens that screen's existing detail modal/drawer
// (doc point #13: desktop = density, mobile = progressive disclosure).
//
// Presentational only - no data fetching, no breakpoint logic. Each call site
// owns `const isMobile = useIsMobile()` and picks which fields matter on a
// phone:
//
//   isMobile ? (
//     <DataCardList>
//       {rows.map(r => (
//         <DataCard key={r.id} title={r.name} status={<Badge .../>}
//                   selected={sel.has(r.id)} onToggle={() => toggle(r.id)}
//                   onOpen={() => open(r)}>
//           <DataCard.Row label="Net pay" value={money(r.net)} strong />
//           <DataCard.Row label="Base" value={money(r.base)} muted />
//         </DataCard>
//       ))}
//       <DataCardTotals label="Total payable" value={money(total)} />
//     </DataCardList>
//   ) : (
//     <div className="table-wrap"><table>...</table></div>
//   )

const listStyle = { display: 'flex', flexDirection: 'column', gap: '0.7rem' }

export function DataCardList({ children, style }) {
  return <div style={{ ...listStyle, ...style }}>{children}</div>
}

const rowBase = {
  display: 'flex', justifyContent: 'space-between', gap: '0.6rem',
  fontSize: '0.83rem', lineHeight: 1.4,
}

// One label -> value line inside a card. `strong` promotes it to the card's
// headline figure; `muted` greys the whole line; numbers should pass
// pre-formatted strings and are right-aligned + tabular by default.
function Row({ label, value, muted = false, strong = false, align = 'right' }) {
  return (
    <div style={{
      ...rowBase,
      ...(strong ? { fontSize: '0.95rem', fontWeight: 800 } : null),
      ...(muted && !strong ? { color: 'var(--color-muted)' } : null),
      marginTop: strong ? '0.1rem' : 0,
    }}>
      <span style={{ color: strong ? undefined : 'var(--color-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{
        textAlign: align, minWidth: 0,
        fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </span>
    </div>
  )
}

// One record. The whole card is the tap target when `onOpen` is given (with a
// trailing chevron to signal it); the optional leading checkbox stops that
// tap from propagating so bulk-select still works. `footer` renders a divided
// row at the bottom for a row-level action (Delete, etc.) - its clicks don't
// bubble to `onOpen`.
export function DataCard({
  title, subtitle, status,
  selected = false, onToggle,
  onOpen, children, footer, style,
}) {
  const tappable = typeof onOpen === 'function'
  return (
    <div
      className="card"
      role={tappable ? 'button' : undefined}
      tabIndex={tappable ? 0 : undefined}
      onClick={tappable ? onOpen : undefined}
      onKeyDown={tappable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
      } : undefined}
      style={{
        padding: '0.9rem 1rem',
        cursor: tappable ? 'pointer' : undefined,
        background: selected ? 'var(--color-primary-soft)' : undefined,
        borderColor: selected ? 'var(--color-primary)' : undefined,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: children ? '0.5rem' : 0 }}>
        {onToggle && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            aria-label={typeof title === 'string' ? `Select ${title}` : 'Select row'}
            style={{ flexShrink: 0 }}
          />
        )}
        <span style={{
          fontWeight: 700, flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
        {status}
        {tappable && <span aria-hidden="true" style={{ color: 'var(--color-muted)', flexShrink: 0, fontSize: '1.1rem', lineHeight: 1 }}>›</span>}
      </div>

      {subtitle != null && subtitle !== '' && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: children ? '0.45rem' : 0 }}>
          {subtitle}
        </div>
      )}

      {children}

      {footer != null && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end',
            marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--color-border)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  )
}

DataCard.Row = Row

// The trailing "Total payable / Grand total" summary several tables carry.
// Sits flush under the last card in a list, visually separated.
export function DataCardTotals({ label = 'Total', value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: '0.6rem',
      padding: '0.5rem 1rem 0.2rem', fontWeight: 800,
    }}>
      <span style={{ color: 'var(--color-muted)' }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}
