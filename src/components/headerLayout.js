// Shrink filters to their usable minimum before moving them into Options.
export function getHeaderLayout(available, titleWidth, buttonWidth, preferredFilterWidth, minimumFilterWidth, gap = 16) {
  const remaining = Math.floor(available - titleWidth - buttonWidth - gap * 2)
  return {
    condensed: remaining < minimumFilterWidth,
    filterWidth: Math.max(0, Math.min(preferredFilterWidth, remaining)),
  }
}
