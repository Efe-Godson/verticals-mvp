// Place at: src/invoicePalettes.js
// Color choices for the Retail invoice PDF itself - separate from the app's
// UI accent color (src/theme.js's THEME_COLORS). That one drives buttons/
// links in the app chrome and follows light/dark mode; this one tints a
// downloadable document that must look the same no matter what theme the
// app is in, so the two lists are deliberately not shared. Body copy in
// every invoice template stays fixed neutral (#111/#444/#666) - only accent
// elements (header rules, table header rows, section pills, totals rule,
// logo tint) use `primary`/`primarySoft` below.

export const INVOICE_PALETTES = [
  { key: 'crimson', name: 'Crimson', primary: '#c0272d', primarySoft: '#fbe9e9', border: '#e8b4b6' },
  { key: 'mint', name: 'Sage Mint', primary: '#3f7368', primarySoft: '#e3efec', border: '#b7d3cb' },
  { key: 'navy', name: 'Navy', primary: '#1c2b4a', primarySoft: '#e8ebf1', border: '#b9c2d6' },
  { key: 'sunset', name: 'Sunset Orange', primary: '#d1691a', primarySoft: '#fbecdf', border: '#eec9a3' },
  { key: 'forest', name: 'Forest Green', primary: '#1f6f3f', primarySoft: '#e5f1e9', border: '#b5d9c3' },
  { key: 'ocean', name: 'Ocean Blue', primary: '#0e6ba8', primarySoft: '#e4f0f8', border: '#aed0e8' },
  { key: 'slate', name: 'Slate', primary: '#475569', primarySoft: '#eceff3', border: '#c3cbd6' },
]

export function getPalette(key) {
  return INVOICE_PALETTES.find(p => p.key === key) || INVOICE_PALETTES[0]
}
