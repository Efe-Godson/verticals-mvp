// Place at: src/ShortLinkRedirect.jsx
// Public /s/:code -> looks up short_links (RLS: anyone can read, see the
// migration) and bounces straight to the real /form/:id order screen. Its
// own tiny page rather than folding the lookup into PublicForm.jsx itself,
// so PublicForm never has to know short links exist.
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

function ShortLinkRedirect() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function resolve() {
      const { data } = await supabase.from('short_links').select('form_id').eq('code', code).maybeSingle()
      if (cancelled) return
      if (data?.form_id) navigate(`/form/${data.form_id}`, { replace: true })
      else setNotFound(true)
    }
    resolve()
    return () => { cancelled = true }
  }, [code, navigate])

  if (notFound) return <div className="page">This link doesn't exist or has expired.</div>
  return <div className="page">Redirecting...</div>
}

export default ShortLinkRedirect
