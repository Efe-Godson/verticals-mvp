import { useId, useState } from 'react'

export default function NameInput({ onFocus, onBlur, onKeyDown, ...props }) {
  const tipId = useId()
  const [showTip, setShowTip] = useState(false)
  return (
    <div className="name-input-with-tip">
      <input {...props} aria-describedby={[props['aria-describedby'], tipId].filter(Boolean).join(' ')}
        onFocus={event => { setShowTip(true); onFocus?.(event) }}
        onBlur={event => { setShowTip(false); onBlur?.(event) }}
        onKeyDown={event => {
          if (event.key === 'Escape' && showTip) { event.stopPropagation(); setShowTip(false) }
          onKeyDown?.(event)
        }}
      />
      <div id={tipId} role="note" className="name-input-tip" hidden={!showTip}>
        Keep the name short so it?s easy to find and fits in navigation. Add extra information in Location details.
      </div>
    </div>
  )
}
