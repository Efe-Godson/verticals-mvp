// A card-grid selector: large lightweight cards instead of a native <select>
// or a stack of radios/checkboxes. Powers every cart-less public form's
// one-question-per-screen design (see PublicForm.jsx's steppedStyle) and
// reuses the visual language of the Lab onboarding flow. Theme-driven,
// works in light/dark.
//
//   <CardChoice options={['Yes','No']} value={v} onChange={setV} />
//   <CardChoice options={[{value,label,help}]} multi value={arr} onChange={setArr} maxSelect={3} />
//
// `options` accepts plain strings or { value, label, help } objects.
// Styles live in index.css (.cardchoice*).

export default function CardChoice({ options = [], value, multi = false, onChange, maxSelect }) {
  const arr = multi ? (Array.isArray(value) ? value : []) : []
  const norm = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const atMax = multi && maxSelect ? arr.length >= maxSelect : false

  function pick(v) {
    if (multi) {
      if (arr.includes(v)) onChange(arr.filter((x) => x !== v))
      else if (!atMax) onChange([...arr, v])
    } else {
      onChange(value === v ? '' : v)
    }
  }

  return (
    <div className="cardchoice">
      {norm.map((o) => {
        const on = multi ? arr.includes(o.value) : value === o.value
        return (
          <button
            key={o.value}
            type="button"
            className="cardchoice-opt"
            aria-pressed={on}
            disabled={multi && !on && atMax}
            onClick={() => pick(o.value)}
          >
            <span className={`cardchoice-tick${multi ? '' : ' round'}`}>{on ? '✓' : ''}</span>
            <span className="cardchoice-body">
              <span className="cardchoice-label">{o.label}</span>
              {o.help && <span className="cardchoice-help">{o.help}</span>}
            </span>
          </button>
        )
      })}
      {maxSelect && (
        <p className="cardchoice-count">{arr.length} of {maxSelect} selected</p>
      )}
    </div>
  )
}
