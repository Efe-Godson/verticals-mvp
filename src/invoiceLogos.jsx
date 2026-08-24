// Place at: src/invoiceLogos.jsx
// Default flat-icon logos a business can pick for its Retail invoice instead
// of uploading a PNG (forms.settings.logoIconKey vs settings.logoUrl - see
// FormSettings.jsx). Same flat, single-color line-icon convention as
// CategoryIcon in src/templateVisuals.jsx, so it reads consistently with the
// rest of the app - no fills/gradients, just a stroke tinted to whatever
// color the invoice is currently using (the chosen palette's primary, at
// generation time, not a fixed color).

export const LOGO_ICONS = [
  { key: 'fruit-basket', label: 'Fruit & Crop Basket' },
  { key: 'water-drop', label: 'Water Drop' },
  { key: 'shopping-bag', label: 'Shopping Bag' },
  { key: 'storefront', label: 'Storefront' },
  { key: 'wrench', label: 'Hardware' },
  { key: 'mortar-pestle', label: 'Pharmacy' },
  { key: 'coffee-cup', label: 'Cafe' },
  { key: 'shipping-box', label: 'Package' },
]

export function LogoIcon({ iconKey, color = '#111', size = 32 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (iconKey) {
    case 'fruit-basket':
      return (
        <svg {...common}>
          <path d="M3 10h18l-2 9H5l-2-9Z" />
          <path d="M3 10a9 9 0 0 1 18 0" />
          <circle cx="9" cy="7.5" r="1.3" />
          <circle cx="12" cy="6" r="1.3" />
          <circle cx="15" cy="7.5" r="1.3" />
        </svg>
      )
    case 'water-drop':
      return (
        <svg {...common}>
          <path d="M12 2.5S5 11 5 15.5a7 7 0 0 0 14 0C19 11 12 2.5 12 2.5Z" />
        </svg>
      )
    case 'shopping-bag':
      return (
        <svg {...common}>
          <path d="M6 8h12l-1 12H7L6 8Z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      )
    case 'storefront':
      return (
        <svg {...common}>
          <path d="M3 9l1.5-5h15L21 9" />
          <path d="M3 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
          <path d="M5 9v11h14V9" />
          <path d="M10 20v-6h4v6" />
        </svg>
      )
    case 'wrench':
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 4.9L3 17.5 6.5 21l6.3-6.3a4 4 0 0 0 4.9-5.4l-2.8 2.8-2.1-2.1 2.9-2.7Z" />
        </svg>
      )
    case 'mortar-pestle':
      return (
        <svg {...common}>
          <path d="M5 12a7 7 0 0 0 14 0" />
          <path d="M4 12h16l-1.2 5.5a2 2 0 0 1-2 1.5H7.2a2 2 0 0 1-2-1.5L4 12Z" />
          <path d="M9 8l7-5" />
        </svg>
      )
    case 'coffee-cup':
      return (
        <svg {...common}>
          <path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z" />
          <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />
          <path d="M7 6c0-1 1-1 1-2s-1-1-1-2M11 6c0-1 1-1 1-2s-1-1-1-2" />
        </svg>
      )
    case 'shipping-box':
      return (
        <svg {...common}>
          <path d="M3 8l9-5 9 5-9 5-9-5Z" />
          <path d="M3 8v9l9 5 9-5V8" />
          <path d="M12 13v9" />
        </svg>
      )
    default:
      return null
  }
}
