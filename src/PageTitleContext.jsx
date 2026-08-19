// Place at: src/PageTitleContext.jsx
// Lets a page hand NavBar.jsx a title for the compact mobile bar (e.g. a
// template's name, "Reports") without NavBar needing route-specific
// fetching of its own for every page that isn't form-scoped - form-context
// pages (Records/Report/Settings/...) skip this entirely since NavBar
// already fetches the form's name for its own isPayrollForm/linkedForms
// lookup, so it's reused directly there instead of duplicating a fetch.
import { createContext, useContext, useEffect, useState } from 'react'

const PageTitleContext = createContext({ title: '', setTitle: () => {} })

export function PageTitleProvider({ children }) {
  const [title, setTitle] = useState('')
  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>
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
