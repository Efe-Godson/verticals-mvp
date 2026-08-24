// Place at: src/TemplateEditorDialog.jsx
// Used by Templates.jsx's inline "Manage"/"+ New Template" controls (admin
// account only) to create and edit templates directly on the Templates
// page, the access point for both starting and curating templates.
import { useState } from 'react'
import { supabase } from './supabaseClient'
import { useToast } from './Toast'
import TemplateFieldEditor from './TemplateFieldEditor'

export const CATEGORY_OPTIONS = ['Retail', 'Restaurant', 'Education', 'Healthcare', 'Nonprofit', 'Events', 'HR & Operations', 'Other']

export function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'template'
}

function bundleKeyFrom(name, existingKeys) {
  const base = slugify(name).replace(/-/g, '_') || 'form'
  let key = base
  let n = 2
  while (existingKeys.includes(key)) key = `${base}_${n++}`
  return key
}

// Single source of truth for both "single form" and "bundle" templates:
// a bundle is just a list of these, each independently field-edited, with
// linked_record fields able to target sibling entries.
function BundleEntryEditor({ entry, allEntries, onChange, onRemove, removable }) {
  const linkTargets = allEntries
    .filter(e => e.key !== entry.key)
    .map(e => ({ id: `$${e.key}`, name: e.name || '(unnamed form)', fields: e.fields }))

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '0.8rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.7rem', alignItems: 'center' }}>
        <input
          type="text"
          value={entry.name}
          onChange={(e) => onChange({ ...entry, name: e.target.value })}
          placeholder="Form name, e.g. Employees"
          style={{ flex: 1, padding: '0.5rem', fontWeight: 600 }}
        />
        {removable && (
          <button type="button" className="secondary" style={{ color: '#c0392b' }} onClick={onRemove}>Remove form</button>
        )}
      </div>
      <TemplateFieldEditor
        fields={entry.fields}
        onChange={(fields) => onChange({ ...entry, fields })}
        linkTargets={linkTargets}
      />
    </div>
  )
}

function TemplateEditorDialog({ template, realForms, onClose, onSaved }) {
  const { showToast } = useToast()
  const isEdit = !!template
  const isBundle = isEdit ? !!template.bundle : false

  const [name, setName] = useState(template?.name || '')
  const [category, setCategory] = useState(template?.category || CATEGORY_OPTIONS[0])
  const [eyebrow, setEyebrow] = useState(template?.eyebrow || '')
  const [description, setDescription] = useState(template?.description || '')
  const [highlightsText, setHighlightsText] = useState((template?.highlights || []).join(', '))
  const [mode, setMode] = useState(isBundle ? 'bundle' : 'single') // 'single' | 'bundle'
  const [fields, setFields] = useState(template?.fields || [])
  const [bundle, setBundle] = useState(
    template?.bundle || [{ key: 'form_1', name: '', fields: [] }]
  )
  const [saving, setSaving] = useState(false)

  const singleLinkTargets = realForms.map(f => ({ id: f.id, name: f.name, fields: f.fields }))

  function updateBundleEntry(index, next) {
    setBundle(current => current.map((e, i) => i === index ? { ...next, key: e.key } : e))
  }

  function addBundleEntry() {
    setBundle(current => [...current, { key: bundleKeyFrom(`form_${current.length + 1}`, current.map(e => e.key)), name: '', fields: [] }])
  }

  function removeBundleEntry(index) {
    setBundle(current => current.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!name.trim()) {
      showToast('Give the template a name.', 'error')
      return
    }
    if (mode === 'single' && fields.length === 0) {
      showToast('Add at least one field.', 'error')
      return
    }
    if (mode === 'bundle' && (bundle.length === 0 || bundle.some(e => !e.name.trim() || e.fields.length === 0))) {
      showToast('Every linked form needs a name and at least one field.', 'error')
      return
    }

    setSaving(true)
    const highlights = highlightsText.split(',').map(h => h.trim()).filter(Boolean)

    const payload = {
      name: name.trim(),
      category,
      eyebrow: eyebrow.trim() || null,
      description: description.trim() || null,
      highlights,
      fields: mode === 'single' ? fields : [],
      bundle: mode === 'bundle' ? bundle.map(({ key, name: entryName, fields: entryFields, settings: entrySettings }) => ({
        key, name: entryName.trim(), fields: entryFields, ...(entrySettings ? { settings: entrySettings } : {})
      })) : null,
    }

    let error
    if (isEdit) {
      ;({ error } = await supabase.from('templates').update(payload).eq('id', template.id))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      ;({ error } = await supabase.from('templates').insert([{
        ...payload,
        slug: `${slugify(name)}-${Date.now().toString(36)}`,
        created_by: user.id,
      }]))
    }

    setSaving(false)
    if (error) {
      showToast('Could not save template: ' + error.message, 'error')
      return
    }
    showToast(isEdit ? 'Template updated.' : 'Template published.', 'success')
    onSaved()
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
        style={{ background: 'var(--color-surface)', borderRadius: '8px', padding: '1.5rem', width: '620px', maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto' }}
      >
        <h3 style={{ margin: '0 0 1rem' }}>{isEdit ? `Edit "${template.name}"` : 'New Template'}</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Template name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Retail Sales" style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }}>
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Eyebrow (small label above the title)</label>
            <input type="text" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} placeholder="e.g. Sales & customer feedback" style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Highlights, comma separated</label>
            <input type="text" value={highlightsText} onChange={(e) => setHighlightsText(e.target.value)} placeholder="e.g. Product feedback, Order follow-up" style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }} />
          </div>

          {!isEdit && (
            <div style={{ display: 'flex', gap: '0.4rem', background: '#f2f4f7', borderRadius: '999px', padding: '0.25rem', width: 'fit-content' }}>
              <button type="button" onClick={() => setMode('single')} className={mode === 'single' ? '' : 'secondary'} style={{ borderRadius: '999px', padding: '0.35rem 0.9rem', fontSize: '0.82rem', border: 'none' }}>
                Single form
              </button>
              <button type="button" onClick={() => setMode('bundle')} className={mode === 'bundle' ? '' : 'secondary'} style={{ borderRadius: '999px', padding: '0.35rem 0.9rem', fontSize: '0.82rem', border: 'none' }}>
                Multiple linked forms
              </button>
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.5rem' }}>
              {mode === 'single' ? 'Fields' : 'Linked forms'}
            </label>

            {mode === 'single' ? (
              <TemplateFieldEditor fields={fields} onChange={setFields} linkTargets={singleLinkTargets} />
            ) : (
              <>
                {bundle.map((entry, index) => (
                  <BundleEntryEditor
                    key={entry.key}
                    entry={entry}
                    allEntries={bundle}
                    onChange={(next) => updateBundleEntry(index, next)}
                    onRemove={() => removeBundleEntry(index)}
                    removable={bundle.length > 1}
                  />
                ))}
                <button type="button" className="secondary" onClick={addBundleEntry}>+ Add another linked form</button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.3rem' }}>
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Publish Template'}</button>
        </div>
      </div>
    </div>
  )
}

export default TemplateEditorDialog
