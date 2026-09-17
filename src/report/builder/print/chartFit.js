export function fitChartInBox(boxWidth, boxHeight, contentWidth, contentHeight) {
  if (![boxWidth, boxHeight, contentWidth, contentHeight].every(v => Number.isFinite(v) && v > 0)) return { scale: 0, x: 0, y: 0 }
  const scale = Math.min(1, boxWidth / contentWidth, boxHeight / contentHeight)
  return { scale, x: (boxWidth - contentWidth * scale) / 2, y: (boxHeight - contentHeight * scale) / 2 }
}
