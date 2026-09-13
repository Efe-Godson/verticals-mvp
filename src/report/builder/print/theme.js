// Place at: src/report/builder/print/theme.js
// Theme system (Designer 2.0 Phase 2) - a small set of color/typography
// tokens applied per-report, not per-element. An element's own explicit
// color/fill (set via FormatInspector) always wins over the theme - the
// theme only supplies the default a freshly-added element starts from, via
// CSS custom properties scoped to the page canvas (see PrintPage.jsx's
// themeVars) so nothing here needs plumbing through every element
// component individually.
export const THEMES = {
  default: {
    label: 'Default',
    primary: '#2563eb', text: '#111827', muted: '#6b7280', background: '#ffffff', surface: '#f8fafc',
    headingFont: 'inherit', bodyFont: 'inherit',
  },
  bold: {
    label: 'Bold',
    primary: '#dc2626', text: '#111827', muted: '#7f1d1d', background: '#ffffff', surface: '#fef2f2',
    headingFont: '"Arial Black", Arial, sans-serif', bodyFont: 'inherit',
  },
  minimal: {
    label: 'Minimal',
    primary: '#111827', text: '#111827', muted: '#9ca3af', background: '#ffffff', surface: '#ffffff',
    headingFont: '"Helvetica Neue", Helvetica, Arial, sans-serif', bodyFont: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  warm: {
    label: 'Warm',
    primary: '#b45309', text: '#292524', muted: '#a8a29e', background: '#fffbeb', surface: '#fef3c7',
    headingFont: 'Georgia, serif', bodyFont: 'inherit',
  },
  corporate: {
    label: 'Corporate',
    primary: '#0f766e', text: '#0f172a', muted: '#64748b', background: '#ffffff', surface: '#f0fdfa',
    headingFont: '"Segoe UI", Tahoma, sans-serif', bodyFont: '"Segoe UI", Tahoma, sans-serif',
  },
}

export const DEFAULT_THEME_ID = 'default'

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES[DEFAULT_THEME_ID]
}

// CSS custom properties, scoped to the page canvas element - text/shape
// elements read these (via var(--designer-*, fallback)) for their default
// color, so a theme switch re-colors every element that hasn't been
// explicitly overridden without touching element data at all.
export function themeCssVars(themeId) {
  const t = getTheme(themeId)
  return {
    '--designer-primary': t.primary,
    '--designer-text': t.text,
    '--designer-muted': t.muted,
    '--designer-bg': t.background,
    '--designer-surface': t.surface,
    '--designer-heading-font': t.headingFont,
    '--designer-body-font': t.bodyFont,
  }
}
