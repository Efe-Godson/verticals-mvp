// Place at: src/lib/fetchAllRows.js
// Supabase/PostgREST caps an unbounded select at a fixed row count (1000 on
// this project) - fine for almost every form, but a form that crosses that
// many submissions (a bulk historical import, a long-running POS) silently
// loses the rest with no error. Pages through with .range() until a short
// page confirms there's nothing left.
const PAGE_SIZE = 1000

export async function fetchAllRows(buildQuery) {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return { data: rows, error: null }
}
