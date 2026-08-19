// Place at: src/ArrowLeftIcon.jsx
// Shared "back" icon - a clean line-based chevron+shaft, matching the app's
// flat-icon convention (see SparkleIcon.jsx) instead of a plain "←" text
// character, which renders inconsistently thick/blunt depending on the
// font. Used by PosSidePanel.jsx and NavBar.jsx's back buttons.
function ArrowLeftIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4L3 12L11 20M3 12H21" />
    </svg>
  )
}

export default ArrowLeftIcon
