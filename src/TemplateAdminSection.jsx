// Place at: src/TemplateAdminSection.jsx
// Home-page-only section, visible solely to TEMPLATE_ADMIN_USER_ID, for
// curating the shared template library. Turns one of the admin's own forms
// into a template by copying its `fields` — reuses real, already-tested
// field definitions instead of asking the admin to redefine fields from
// scratch in a second place.
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useToast } from './Toast'

const CATEGORY_OPTIONS = ['Retail', 'Restaurant', 'Education', 'Healthcare', 'Nonprofit', 'Events', 'HR & Operations', 'Other']

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'template'
}

function NewTemplateDialog({ forms, onClose, onCreated }) {
  const { showToast } = useToast()
  const [formId, setFormId] = useState(forms[0]?.id || '')
  const [name, setName] = useState('')
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0])
  const [eyebrow, setEyebrow] = useState('')
  const [description, setDescription] = useState('')
  const [highlightsText, setHighlightsText] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const sourceForm = forms.find(f => f.id === formId)
    if (!sourceForm) {
      showToast('Pick a form to base this template on.', 'error')
      return
    }
    if (!name.trim()) {
      showToast('Give the template a name.', 'error')
      return
    }

    setSaving(true)
    const highlights = highlightsText.split(',').map(h => h.trim()).filter(Boolean)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('templates').insert([{
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      name: name.trim(),
      category,
      eyebrow: eyebrow.trim() || null,
      description: description.trim() || null,
      highlights,
      fields: sourceForm.fields,
      created_by: user.id,
    }])

    setSaving(false)
    if (error) {
      showToast('Could not save template: ' + error.message, 'error')
      return
    }
    showToast('Template published.', 'success')
    onCreated()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', width: '460px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <h3 style={{ margin: '0 0 1rem' }}>New Template</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Base on form</label>
            <select value={formId} onChange={(e) => setFormId(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }}>
              {forms.length === 0 && <option value="">No forms available</option>}
              {forms.map(f => <option key={f.id} value={f.id}>{f.name} ({f.fields?.length || 0} fields)</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Template name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Retail Sales" style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }}>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Eyebrow (small label above the title)</label>
            <input type="text" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} placeholder="e.g. Sales & customer feedback" style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Highlights, comma separated</label>
            <input type="text" value={highlightsText} onChange={(e) => setHighlightsText(e.target.value)} placeholder="e.g. Product feedback, Order follow-up" style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.3rem' }}>
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={saving || forms.length === 0}>{saving ? 'Saving…' : 'Publish Template'}</button>
        </div>
      </div>
    </div>
  )
}

function TemplateAdminSection({ forms }) {
  const { showToast } = useToast()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  async function loadTemplates() {
    setLoading(true)
    const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false })
    if (!error) setTemplates(data || [])
    setLoading(false)
  }

  useEffect(() => { loadTemplates() }, [])

  async function deleteTemplate(id) {
    const { error } = await supabase.from('templates').delete().eq('id', id)
    if (error) {
      showToast('Could not delete template: ' + error.message, 'error')
      return
    }
    setTemplates(current => current.filter(t => t.id !== id))
    showToast('Template deleted.', 'success')
  }

  return (
    <div style={{ marginTop: '2.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Manage Templates
        </h3>
        <button className="secondary" onClick={() => setShowNew(true)}>+ New Template</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
      ) : templates.length === 0 ? (
        <div className="card" style={{ padding: '1.2rem', color: 'var(--color-muted)' }}>
          No templates published yet. Templates you create here show up for every user on the Templates page.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {templates.map(t => (
            <div key={t.id} className="card" style={{
              padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap'
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>{t.category} · {t.fields?.length || 0} fields</div>
              </div>
              <button className="secondary" style={{ color: '#c0392b' }} onClick={() => deleteTemplate(t.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewTemplateDialog
          forms={forms}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); loadTemplates() }}
        />
      )}
    </div>
  )
}

export default TemplateAdminSection
