// Place at: src/SparkleIcon.jsx
// Shared flat icon for "this is an AI action" - a plain single-color 4-point
// star, matching the app's flat-icon convention (see templateVisuals.jsx)
// instead of an emoji. Pulled out of ProductManager.jsx so every AI-powered
// entry point (product import, order autofill, whatever comes next) reads
// as the same feature at a glance instead of each screen picking its own
// icon/emoji.
function SparkleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5Z" />
    </svg>
  )
}

export default SparkleIcon
