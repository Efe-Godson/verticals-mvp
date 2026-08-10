// Place at: src/templateVisuals.jsx
// Shared between Templates.jsx (the gallery), BusinessesHome.jsx (the
// landing grid), and TemplateLocations.jsx (locations under one template) -
// the same flat category icon and color should read consistently no matter
// which of those three grids a template's tile appears in.

// Stable per-category color so the square reads as more than a label,
// consistent across sessions since it's keyed by name, not insertion order.
const CATEGORY_COLORS = {
  'Retail': '#0ea5e9', 'Restaurant': '#f97316', 'Education': '#8b5cf6',
  'Healthcare': '#ef4444', 'Nonprofit': '#16a34a', 'Events': '#d946ef',
  'HR & Operations': '#0070f3', 'Other': '#6b7280',
}
export function categoryColor(category) {
  return CATEGORY_COLORS[category] || '#6b7280'
}

// Flat, single-color line icons per category - deliberately plain (no
// fills, no gradients) so a whole grid of tiles reads calmly rather than
// like a row of app-store badges.
export function CategoryIcon({ category, color }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (category) {
    case 'Restaurant':
      return (
        <svg {...common}>
          <path d="M7 2v7a2 2 0 0 0 2 2v11" />
          <path d="M7 2v7" />
          <path d="M11 2v7" />
          <path d="M17 2c-1.5 0-3 1.5-3 4v4a2 2 0 0 0 2 2v10" />
        </svg>
      )
    case 'Retail':
      return (
        <svg {...common}>
          <path d="M6 8h12l-1 12H7L6 8Z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      )
    case 'Education':
      return (
        <svg {...common}>
          <path d="M2 8l10-4 10 4-10 4-10-4Z" />
          <path d="M6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
        </svg>
      )
    case 'Healthcare':
      return (
        <svg {...common}>
          <path d="M12 3v7M8.5 6.5h7" />
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M12 13v4M10 15h4" />
        </svg>
      )
    case 'Nonprofit':
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.5-9-9c-1.2-2.7 0.5-6 3.5-6 2 0 3.5 1.3 4.5 3 1-1.7 2.5-3 4.5-3 3 0 4.7 3.3 3.5 6-2 4.5-9 9-9 9Z" />
        </svg>
      )
    case 'Events':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      )
    case 'HR & Operations':
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
          <rect x="13" y="13" width="7" height="7" rx="1" />
        </svg>
      )
  }
}

// A flat pin icon for location tiles (TemplateLocations.jsx) - visually
// distinct from category icons so it's obvious these are places, not templates.
export function LocationIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}
