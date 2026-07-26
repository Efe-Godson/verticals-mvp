// Place at: src/RecycleBinContext.jsx
// NavBar renders the Recycle Bin button, but the bin's actual state (forms
// list, open/restore/delete logic) lives in Home.jsx, which NavBar isn't a
// parent of. Home registers a trigger (open handler + current count) here on
// mount; NavBar reads it and renders nothing if no page has registered one.
import { createContext, useContext, useState } from 'react'

const RecycleBinContext = createContext(null)

export function RecycleBinProvider({ children }) {
  const [trigger, setTrigger] = useState(null) // { onOpen, count } | null
  return (
    <RecycleBinContext.Provider value={{ trigger, setTrigger }}>
      {children}
    </RecycleBinContext.Provider>
  )
}

export function useRecycleBinTrigger() {
  const ctx = useContext(RecycleBinContext)
  if (!ctx) throw new Error('useRecycleBinTrigger must be used within a RecycleBinProvider')
  return ctx
}
