// Place at: src/report/engine/aiContext.js
// Every visual exposes enough structured context for a future AI pass to
// reason about both the selected datapoint and the population it belongs to
// (brief §21). Not an AI feature - just the serialisable bundle.
export function buildVisualContext(visualDef, result, selectedDatapoint) {
  if (!result) return null
  const aggregated = (result.perRow || result.rows || []).map(r => ({
    label: r.label,
    value: r.value,
    percentOfTotal: r.percentOfTotal,
    rank: r.rank,
    diffFromMean: r.diffFromMean,
    pctDiffFromMean: r.pctDiffFromMean,
    bySeries: r.bySeries,
  }))

  let selected = null
  if (selectedDatapoint) {
    const row = (result.perRow || result.rows || []).find(r => r.label === selectedDatapoint.value)
    selected = { ...selectedDatapoint, ...(row || {}) }
  }

  return {
    visual_definition: {
      id: visualDef.id, type: visualDef.type, title: visualDef.title,
    },
    query: visualDef.query,
    filters: visualDef.filters || [],
    selected_datapoint: selected,
    aggregated_data: aggregated,
    population_statistics: result.population || null,
    result_kind: result.kind,
    source_data_reference: {
      submissionIds: result.sourceSubmissionIds || [],
      count: (result.sourceSubmissionIds || []).length,
    },
  }
}
