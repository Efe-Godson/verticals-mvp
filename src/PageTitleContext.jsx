// Place at: src/PageTitleContext.jsx
// Lets a page hand NavBar.jsx a title (and optionally a "back" destination)
// for the compact mobile bar, without NavBar needing route-specific logic
// of its own for every page that isn't form-scoped - form-context pages
// (Records/Report/Settings/...) skip the title half of this entirely since
// NavBar already fetches the form's name for its own isPayrollForm/
// linkedForms lookup, so it's reused directly there instead of duplicating
// a fetch.
import { createContext, useContext, useEffect, useState } from 'react'

const PageTitleContext = createContext({
  title: '', setTitle: () => {},
  backTo: null, setBackTo: () => {},
})

export function PageTitleProvider({ children }) {
  const [title, setTitle] = useState('')
  const [backTo, setBackTo] = useState(null) // { to, label } | null
  return (
    <PageTitleContext.Provider value={{ title, setTitle, backTo, setBackTo }}>
      {children}
    </PageTitleContext.Provider>
  )
}

// Call from a page component with its own title (e.g. usePageTitle('Reports')
// or usePageTitle(template?.name)). Clears itself on unmount so the next
// page doesn't inherit a stale title before its own effect runs.
export function usePageTitle(title) {
  const { setTitle } = useContext(PageTitleContext)
  useEffect(() => {
    setTitle(title || '')
    return () => setTitle('')
  }, [title, setTitle])
}

export function useCurrentPageTitle() {
  return useContext(PageTitleContext).title
}

// Registers a back destination for the compact mobile bar's right-hand back
// button (e.g. usePageBack('/', 'All Businesses') from TemplateLocations.jsx)
// - a page one level below the top isn't reachable any other way once the
// mobile bar's hamburger opens the general nav drawer rather than acting as
// a "back" control. Clears itself on unmount, same as usePageTitle.
export function usePageBack(to, label) {
  const { setBackTo } = useContext(PageTitleContext)
  useEffect(() => {
    setBackTo(to ? { to, label } : null)
    return () => setBackTo(null)
  }, [to, label, setBackTo])
}

export function useCurrentPageBack() {
  return useContext(PageTitleContext).backTo
}
