// Place at: src/onboarding/RealTemplatePreview.jsx
// The "real-template" kind of entry intent (Expenses, Staff & Payroll, Data
// Collection, and Workflow/Other once they've answered the follow-up
// question) - and the reason it's a *preview*, not a live workspace: a form
// can't actually be created while the visitor is still anonymous (forms'
// insert policy is `with check (user_id = auth.uid())`, and there's no
// auth.uid() yet). So this shows the template's own real field structure
// through the existing non-submitting FormPreviewModal (src/FormPreview.jsx)
// instead - still "show the product," just its shape rather than a live
// database row. The actual workspace gets created for real right after
// signup - see PendingWorkspace.jsx, which reads the same sessionStorage
// this screen doesn't need to touch (OnboardingPage already persists
// entry_intent/custom_intent_text before navigating to /signup).
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import FormPreviewModal from '../FormPreview'
import { InlineLoader } from '../components/InlineLoader'
import { ErrorState } from '../ErrorState'

export default function RealTemplatePreview({ intent, customIntentText, onCreateWorkspace }) {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    supabase.from('templates').select('*').eq('slug', intent.templateSlug).single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) setState({ status: 'error', message: 'Could not load this template right now.' })
        else setState({ status: 'ready', template: data })
      })
    return () => { cancelled = true }
  }, [intent.templateSlug])

  const formName = customIntentText || state.template?.name || intent.label

  return (
    <>
      {/* Layered above FormPreviewModal's own overlay (z-index 200) so the
          CTA stays reachable while the preview is open, instead of the
          modal's own backdrop hiding it - see the design brief's "keep a
          clear CTA available" rule. */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 250,
        padding: '0.8rem 1rem calc(0.8rem + env(safe-area-inset-bottom))',
        background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
      }}>
        <button type="button" onClick={onCreateWorkspace} style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'block', padding: '0.85rem', fontSize: '1rem', fontWeight: 600 }}>
          Create your workspace →
        </button>
      </div>

      {state.status === 'loading' && (
        <div style={{ padding: '3rem 1rem', textAlign: 'center' }}><InlineLoader label="Loading..." /></div>
      )}
      {state.status === 'error' && (
        <div style={{ padding: '2rem 1rem' }}><ErrorState message={state.message} /></div>
      )}
      {/* Some templates (Payroll: a dedicated module, not a generic field
          list - its own top-level `fields` and its bundle members' are both
          empty) have nothing field-shaped to preview. Rather than showing
          FormPreviewModal's "Add some fields to see them here" placeholder,
          a short explainer card is the honest version of "show the
          product" here - there's a real one waiting, just not a form. */}
      {state.status === 'ready' && (state.template.fields || []).length === 0 && !state.template.bundle?.[0]?.fields?.length ? (
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem 6rem' }}>
          <div className="card" style={{ maxWidth: 420, padding: '1.6rem', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 0.5rem' }}>{state.template.name}</h2>
            <p style={{ color: 'var(--color-muted)', margin: 0 }}>
              {state.template.description || "This one's a dedicated workspace, ready to configure as soon as you sign up."}
            </p>
          </div>
        </div>
      ) : state.status === 'ready' && (
        <FormPreviewModal
          formName={formName}
          description={state.template.description}
          fields={(state.template.fields?.length ? state.template.fields : state.template.bundle?.[0]?.fields) || []}
          onClose={onCreateWorkspace}
        />
      )}
    </>
  )
}
