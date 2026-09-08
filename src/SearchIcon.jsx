// Place at: src/SearchIcon.jsx
// Shared magnifier icon - a clean line-based circle + handle, matching the
// app's flat-icon convention (see ArrowLeftIcon.jsx / SparkleIcon.jsx)
// instead of the 🔍 emoji, which renders as a full-colour glyph and sizes
// inconsistently across platforms.
function SearchIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8" />
    </svg>
  )
}

export default SearchIcon
