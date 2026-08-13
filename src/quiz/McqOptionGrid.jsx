// Place at: src/quiz/McqOptionGrid.jsx
// Renders a question's options as tappable cards. Locks after a selection
// is made (no changing your answer once submitted, per the product spec)
// and, once correctIndex is known (the scoreboard/reveal phase), recolors
// to show right/wrong instead of the plain selection highlight.
function McqOptionGrid({ options, selectedIndex, correctIndex, disabled, onSelect }) {
  const revealed = correctIndex != null

  function colorFor(i) {
    if (revealed) {
      if (i === correctIndex) return { border: 'var(--status-good)', background: 'var(--color-primary-soft)' }
      if (i === selectedIndex) return { border: 'var(--status-critical)', background: 'var(--color-surface)' }
      return { border: 'var(--color-border)', background: 'var(--color-surface)' }
    }
    if (i === selectedIndex) return { border: 'var(--color-primary)', background: 'var(--color-primary-soft)' }
    return { border: 'var(--color-border)', background: 'var(--color-surface)' }
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: options.length > 2 ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)',
      gap: '0.7rem', marginTop: '1rem'
    }}>
      {options.map((option, i) => {
        const { border, background } = colorFor(i)
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(i)}
            className="secondary"
            style={{
              padding: '1rem', fontSize: '1rem', textAlign: 'left',
              border: `2px solid ${border}`, background,
              opacity: disabled && i !== selectedIndex && !revealed ? 0.6 : 1,
            }}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

export default McqOptionGrid
