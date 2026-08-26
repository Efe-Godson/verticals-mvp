// Place at: src/PageTitleContext.jsx
// Lets a page hand NavBar.jsx a title (and optionally a "back" destination)
// for the compact mobile bar, without NavBar needing route-specific logic
// of its own for every page that isn't form-scoped - form-context pages
// (Records/Report/Settings/...) skip the title half of this entirely since
// NavBar already fetches the form's name for its own isPayrollForm/
// linkedForms lookup, so it's reused directly there instead of duplicating
// a fetch.
import { createContext, useContext, useEffect, useRef, useState } from 'react'

const PageTitleContext = createContext({
  title: '', setTitle: () => {},
  backTo: null, setBackTo: () => {},
  pageOptions: null, setPageOptions: () => {},
})

export function PageTitleProvider({ children }) {
  const [title, setTitle] = useState('')
  const [backTo, setBackTo] = useState(null) // { to, label } | null
  const [pageOptions, setPageOptions] = useState(null) // { onClick } | null
  return (
    <PageTitleContext.Provider value={{ title, setTitle, backTo, setBackTo, pageOptions, setPageOptions }}>
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

// Registers a page's own "Options" trigger (Report.jsx's Print/Download/
// Report Builder menu, Records.jsx's Export/Save View/Recycle Bin menu) so
// the compact mobile bar can surface a single "⋯" button for it next to the
// hamburger, instead of that page needing its own inline trigger competing
// for space with its filters (see the matching CSS in index.css hiding
// .page-options-trigger below 768px). The page keeps owning its own
// open/closed state and menu content - this just hands NavBar something to
// call when its button is tapped. Clears itself on unmount, same as the
// other page-registered hooks here.
// `enabled` gates whether the button shows at all (Report.jsx only wants it
// once the full report is loaded and has data, not during its loading/
// error/empty-state early returns - but hooks still have to run on every
// render including those, so this takes the boolean rather than the page
// conditionally calling the hook itself). `onClick` is read through a ref
// instead of being a dependency directly - callers pass an inline arrow
// function (a fresh reference every render), and depending on that would
// re-register every render, which updates PageTitleProvider's state, which
// re-renders the calling page, which creates a new arrow function... an
// infinite loop. `enabled` is a plain boolean so it's safe to depend on
// directly - it only actually changes value when the page's own condition
// does, not every render.
export function usePageOptions(enabled, onClick) {
  const { setPageOptions } = useContext(PageTitleContext)
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick
  useEffect(() => {
    setPageOptions(enabled ? { onClick: () => onClickRef.current?.() } : null)
    return () => setPageOptions(null)
  }, [enabled, setPageOptions])
}

export function useCurrentPageOptions() {
  return useContext(PageTitleContext).pageOptions
}
