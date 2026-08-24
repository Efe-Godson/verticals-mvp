// Place at: src/theme.js
// A small PowerPoint-style "theme color" picker: one solid accent, applied
// as CSS custom properties so everything already reading var(--color-primary)
// (buttons, links, focus rings, tile hover borders) follows it automatically.
// --color-primary-soft is a light tint of the same color, computed here too,
// so shared "soft" surfaces (selected rows, gradient header cards) follow
// the chosen color instead of staying hardcoded to the original blue.
//
// The account_settings table (see the matching migration) is the source of
// truth, so the color is consistent across every device/browser the account
// signs into, and visible read-only to that account's staff logins (RLS
// scopes it to the owner themselves, or staff via form_staff.created_by).
// localStorage is only a same-device cache for an instant paint at boot,
// before AuthContext.jsx has resolved a session and fetched the real value.
const STORAGE_KEY = 'verticals_theme_color'
// Device-local only (see applyThemeMode below) - unlike the accent color,
// light/dark is a "what's comfortable on the screen in front of me right
// now" preference, not a brand setting that should follow the account
// across devices, so this deliberately isn't synced to account_settings.
const MODE_KEY = 'verticals_theme_mode'

export const THEME_COLORS = [
  { name: 'Blue', hex: '#0070f3' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Green', hex: '#0ca30c' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Slate', hex: '#475569' },
]

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
}

// Blends `hex` toward `towardHex` by `amount` (0 = unchanged, 1 = fully `towardHex`).
function mix(hex, towardHex, amount) {
  const a = hexToRgb(hex)
  const b = hexToRgb(towardHex)
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  })
}

function isDarkMode() {
  // A forced mode (see applyThemeMode) wins over the OS setting - index.css's
  // dark block is scoped to data-theme="dark" OR (no data-theme and OS
  // dark), so this mirrors that same precedence for the accent-color mix.
  const forced = document.documentElement.dataset.theme
  if (forced === 'dark') return true
  if (forced === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function getThemeMode() {
  return localStorage.getItem(MODE_KEY) || 'system'
}

// Sets/clears the data-theme attribute index.css keys its dark palette off
// of, persists the choice, and recomputes the accent-color mix (its hover/
// soft variants depend on light vs dark, which just changed).
export function applyThemeMode(mode) {
  const root = document.documentElement
  if (mode === 'dark') root.dataset.theme = 'dark'
  else if (mode === 'light') root.dataset.theme = 'light'
  else delete root.dataset.theme
  localStorage.setItem(MODE_KEY, mode)
  applyThemeColor(localStorage.getItem(STORAGE_KEY) || THEME_COLORS[0].hex)
}

// Boot-time only: paints the last-chosen mode immediately, before React (or
// even applyCachedThemeColor) runs - main.jsx calls this first so the
// data-theme attribute is already in place when applyCachedThemeColor reads
// isDarkMode() right after, instead of painting one theme and flashing to
// another a moment later.
export function applyCachedThemeMode() {
  const mode = getThemeMode()
  if (mode === 'dark') document.documentElement.dataset.theme = 'dark'
  else if (mode === 'light') document.documentElement.dataset.theme = 'light'
}

// Applies to the page and refreshes the local same-device cache. Does not
// touch the database - callers that mean to persist the choice for the
// account do that separately (see AccountPage.jsx).
export function applyThemeColor(hex) {
  const dark = isDarkMode()
  const root = document.documentElement
  root.style.setProperty('--color-primary', hex)
  root.style.setProperty('--color-primary-hover', mix(hex, dark ? '#ffffff' : '#000000', dark ? 0.25 : 0.15))
  root.style.setProperty('--color-primary-soft', mix(hex, dark ? '#1c1e24' : '#ffffff', dark ? 0.82 : 0.92))
  localStorage.setItem(STORAGE_KEY, hex)
}

// Boot-time only: paints the last-known color immediately, before there's
// any session to fetch the real one from. Called from main.jsx, ahead of
// React even mounting.
export function applyCachedThemeColor() {
  applyThemeColor(localStorage.getItem(STORAGE_KEY) || THEME_COLORS[0].hex)
}

// The hover/soft mix direction depends on light vs dark, so an OS theme
// switch while the app is open needs the current color recomputed, not
// just re-read.
export function watchSystemTheme() {
  window.matchMedia?.('(prefers-color-scheme: dark)')
    .addEventListener('change', () => applyThemeColor(localStorage.getItem(STORAGE_KEY) || THEME_COLORS[0].hex))
}

// Called once AuthContext.jsx has a session - reads account_settings (RLS
// resolves it to either the signed-in owner's own row, or their employer's
// row if this is a staff login) and applies it if it differs from whatever
// the cache already painted. No row yet (owner never picked one) just
// leaves the cached/default color in place.
export async function syncThemeColorFromAccount(supabase) {
  const { data } = await supabase.from('account_settings').select('theme_color').maybeSingle()
  if (data?.theme_color) applyThemeColor(data.theme_color)
}

// Persists the choice for the account (owner only - see the table's RLS)
// and applies it immediately rather than waiting on the round-trip.
export async function saveThemeColor(supabase, userId, hex) {
  applyThemeColor(hex)
  const { error } = await supabase.from('account_settings').upsert({ user_id: userId, theme_color: hex })
  return { error }
}
