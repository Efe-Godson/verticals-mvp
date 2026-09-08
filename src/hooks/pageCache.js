// In-memory, session-lifetime cache so a screen you've already visited
// paints instantly from its last known data while a fresh copy loads
// silently behind it, instead of blanking to a skeleton every single time
// you come back to it. Lives for as long as the SPA tab does - a hard
// reload starts empty, same as before.
//
//   const cached = getPageCache(`records:${formId}`)
//   if (cached) { hydrate(cached); load({ quiet: true }) } else { load() }
//   ...
//   setPageCache(`records:${formId}`, { form, submissions })
const store = new Map()

export function getPageCache(key) {
  return key ? store.get(key) : undefined
}
export function setPageCache(key, data) {
  if (key) store.set(key, data)
}
export function clearPageCache(key) {
  store.delete(key)
}
