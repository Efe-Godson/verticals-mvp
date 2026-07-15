// Place at: src/report/components/ExpandableList.jsx
import { useState } from 'react'

// Shows the first `limit` items, with a "Show all" toggle to reveal the rest —
// keeps long lists (text responses) from dominating the card.
function ExpandableList({ items, limit = 5, renderItem }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, limit)

  return (
    <>
      {visible.map((item, i) => renderItem(item, i))}
      {items.length > limit && (
        <span
          onClick={() => setExpanded(!expanded)}
          style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-primary)', cursor: 'pointer' }}
        >
          {expanded ? 'Show less' : `Show all ${items.length}`}
        </span>
      )}
    </>
  )
}

export default ExpandableList
