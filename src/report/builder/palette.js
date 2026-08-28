// Place at: src/report/builder/palette.js
// Chart colours for the Builder catalogue. Mirrors --chart-series-1..8 /
// --chart-series-other from src/index.css so recharts (which needs explicit
// fill/stroke strings) matches the hand-rolled charts and both themes.
// Never cycle or reassign a slot - a series keeps its colour (dataviz rule).

const FALLBACK_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const FALLBACK_OTHER = '#9ca3af'

let cache = null

export function chartPalette() {
  if (cache) return cache
  if (typeof window === 'undefined') return { series: FALLBACK_LIGHT, other: FALLBACK_OTHER }
  try {
    const cs = getComputedStyle(document.documentElement)
    const series = FALLBACK_LIGHT.map((fb, i) => {
      const v = cs.getPropertyValue(`--chart-series-${i + 1}`).trim()
      return v || fb
    })
    const other = cs.getPropertyValue('--chart-series-other').trim() || FALLBACK_OTHER
    cache = { series, other }
    return cache
  } catch {
    return { series: FALLBACK_LIGHT, other: FALLBACK_OTHER }
  }
}

// Invalidate on theme flip so colours follow the toggle.
export function resetPaletteCache() { cache = null }

export function seriesColor(index) {
  const { series, other } = chartPalette()
  return index < series.length ? series[index] : other
}

export function cssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  } catch {
    return fallback
  }
}
