// Place at: src/firstVisit.js
// Decides whether an unauthenticated visitor should land on Sign Up (their
// very first time here) or Login (they've been here before, even if they
// never finished creating an account). Module-level cache avoids the flag
// flipping mid-session if this gets called more than once during a series
// of re-renders before the redirect actually happens.
const FLAG_KEY = 'verticals_has_visited'
let cachedFirstVisit = null

export function isFirstVisit() {
  if (cachedFirstVisit !== null) return cachedFirstVisit
  const visited = localStorage.getItem(FLAG_KEY)
  cachedFirstVisit = !visited
  if (!visited) localStorage.setItem(FLAG_KEY, 'true')
  return cachedFirstVisit
}

// Call once the visitor has been through onboarding (or otherwise seen the
// entry flow), so landing straight on /onboarding from a marketing link
// still counts as "been here" afterwards.
export function markVisited() {
  cachedFirstVisit = false
  try { localStorage.setItem(FLAG_KEY, 'true') } catch { /* private mode */ }
}
