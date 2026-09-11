// Place at: src/lab/DemoDataManagerPage.jsx
// Lab: create and manage reusable demo datasets (see the plan this was
// built from - Lab: Demo & Onboarding Controls, Phase 2). A "dataset" is
// just a real form the admin owns, flagged is_demo = true (the same
// mechanism the old single "Use as the demo business" toggle used, now
// generalized to as many as needed) - its real fields and real submissions
// ARE the sample data. Authoring the content itself reuses the exact same
// tools any real form already has (the builder, Records, Records' own CSV
// import) rather than a bespoke data-entry UI - "+ New Dataset" just drops
// the admin into the normal builder for a blank is_demo form.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { useToast } from '../Toast'
import ConfirmDialog from '../ConfirmDialog'
import Modal from '../components/Modal'
import LabSidePanel from '../LabSidePanel'
import PageSkeleton from '../components/PageSkeleton'
import { useDeferredLoading } from '../components/loadingHooks'
import { ErrorState } from '../ErrorState'
import { usePageBack } from '../PageTitleContext'

// Clones a dataset's underlying form *and* its submissions (unlike
// locations.js's duplicateLocationForm, which deliberately never copies
// submissions for a real business) - a dataset's sample data is the whole
// point of duplicating it, not something to start blank again.
async function duplicateDataset({ session, dataset, name }) {
  const { data: sourceForm, error: formError } = await supabase
    .from('forms').select('fields, settings').eq('id', dataset.form_id).single()
  if (formError || !sourceForm) throw new Error(formError?.message || 'Could not load the source dataset')

  const { data: newForm, error: insertFormError } = await supabase.from('forms').insert([{
    name, fields: sourceForm.fields, settings: sourceForm.settings, status: 'published',
    is_demo: true, user_id: session.user.id,
  }]).select().single()
  if (insertFormError || !newForm) throw new Error(insertFormError?.message || 'Could not create the new form')

  const { data: sourceSubmissions, error: subsError } = await supabase
    .from('submissions').select('data, created_at').eq('form_id', dataset.form_id).is('deleted_at', null)
  if (subsError) throw new Error(subsError.message)

  if (sourceSubmissions?.length > 0) {
    const rows = sourceSubmissions.map(s => ({ form_id: newForm.id, data: s.data, created_at: s.created_at }))
    const { error: insertSubsError } = await supabase.from('submissions').insert(rows)
    if (insertSubsError) throw new Error(insertSubsError.message)
  }

  const { data: newDataset, error: datasetError } = await supabase
    .from('demo_datasets').insert([{ name, form_id: newForm.id }]).select().single()
  if (datasetError || !newDataset) throw new Error(datasetError?.message || 'Could not save the new dataset')

  return newDataset
}

function DemoDataManagerPage() {
  usePageBack('/lab', 'Lab')
  const { session } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [datasets, setDatasets] = useState(null) // null while loading, else [{ id, name, form_id, recordCount }]
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState(null) // dataset.id whose "name the copy" modal is open
  const [duplicateNameInput, setDuplicateNameInput] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  async function load() {
    setError('')
    const { data, error: fetchError } = await supabase
      .from('demo_datasets').select('id, name, form_id, created_at').order('created_at', { ascending: false })
    if (fetchError) {
      setError('Could not load demo datasets: ' + fetchError.message)
      return
    }
    const withCounts = await Promise.all((data || []).map(async d => {
      const { count } = await supabase
        .from('submissions').select('id', { count: 'exact', head: true }).eq('form_id', d.form_id).is('deleted_at', null)
      return { ...d, recordCount: count || 0 }
    }))
    setDatasets(withCounts)
  }

  useEffect(() => { load() }, [])

  function openAddModal() {
    setNameInput('')
    setShowAddModal(true)
  }

  async function confirmAdd(e) {
    e.preventDefault()
    if (!nameInput.trim()) return
    setCreating(true)
    try {
      const { data: form, error: formError } = await supabase.from('forms').insert([{
        name: nameInput.trim(), fields: [], status: 'published', is_demo: true, user_id: session.user.id,
      }]).select().single()
      if (formError || !form) throw new Error(formError?.message || 'Could not create the form')

      const { error: datasetError } = await supabase
        .from('demo_datasets').insert([{ name: nameInput.trim(), form_id: form.id }])
      if (datasetError) throw new Error(datasetError.message)

      showToast(`"${nameInput.trim()}" created - add fields and sample records now.`, 'success')
      navigate(`/form/${form.id}/edit?panel=1`)
    } catch (err) {
      showToast('Could not create this dataset: ' + err.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  function openDuplicateModal(dataset) {
    setDuplicatingId(dataset.id)
    setDuplicateNameInput(`${dataset.name} (Copy)`)
  }

  async function confirmDuplicate(e) {
    e.preventDefault()
    const dataset = datasets.find(d => d.id === duplicatingId)
    if (!dataset || !duplicateNameInput.trim()) return
    setCreating(true)
    try {
      await duplicateDataset({ session, dataset, name: duplicateNameInput.trim() })
      showToast(`"${duplicateNameInput.trim()}" duplicated.`, 'success')
      setDuplicatingId(null)
      load()
    } catch (err) {
      showToast('Could not duplicate this dataset: ' + err.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  async function performDelete() {
    const id = pendingDeleteId
    setPendingDeleteId(null)
    const dataset = datasets.find(d => d.id === id)
    if (!dataset) return
    // The dataset row and its underlying form are one unit - deleting one
    // without the other would either leave a dangling is_demo form nobody
    // manages from here again, or a dataset row pointing at nothing.
    const { error: deleteError } = await supabase.from('forms').delete().eq('id', dataset.form_id)
    if (deleteError) {
      showToast('Could not delete: ' + deleteError.message, 'error')
      return
    }
    setDatasets(current => current.filter(d => d.id !== id))
    showToast('Dataset deleted.', 'success')
  }

  const showSkel = useDeferredLoading(datasets === null)
  if (datasets === null) return showSkel ? <PageSkeleton variant="cards" /> : null
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="page">
      <LabSidePanel />
      <div className="toolbar-row" style={{ justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Demo Data</h1>
        <button type="button" onClick={openAddModal}>+ New Dataset</button>
      </div>
      <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>
        Reusable sample businesses that power the onboarding demo (see <Link to="/lab/demo-setup">Demo Setup</Link> to
        connect one to an entry option) and the public <Link to="/demo" target="_blank" rel="noreferrer">/demo</Link> page
        - link that one directly from outside the app. Each dataset is a real form you own, flagged as demo data -
        build it out with the normal builder and Records, same as any other form.
      </p>

      {datasets.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          <p>No demo datasets yet.</p>
          <button type="button" style={{ marginTop: '0.5rem' }} onClick={openAddModal}>Create the first one</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {datasets.map(dataset => (
            <div key={dataset.id} style={{
              padding: '0.9rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: '0.7rem', borderBottom: '1px solid var(--color-border)',
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{dataset.name}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                  {dataset.recordCount} record{dataset.recordCount !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link to={`/form/${dataset.form_id}/records`}><button type="button" className="secondary">Preview Records</button></Link>
                <Link to={`/form/${dataset.form_id}/report`}><button type="button" className="secondary">Preview Report</button></Link>
                <Link to={`/form/${dataset.form_id}/edit?panel=1`}><button type="button" className="secondary">Edit</button></Link>
                <button type="button" className="secondary" onClick={() => openDuplicateModal(dataset)}>Duplicate</button>
                <button type="button" className="secondary" style={{ color: '#c0392b' }} onClick={() => setPendingDeleteId(dataset.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <Modal size="sm" onClose={() => setShowAddModal(false)} title="Name this dataset">
          <form onSubmit={confirmAdd}>
            <input
              type="text" required autoFocus value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Glow Beauty Demo"
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button type="button" className="secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {duplicatingId && (
        <Modal size="sm" onClose={() => setDuplicatingId(null)} title="Name this duplicate">
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            A new, independent copy with the same fields and records.
          </p>
          <form onSubmit={confirmDuplicate}>
            <input
              type="text" required autoFocus value={duplicateNameInput}
              onChange={(e) => setDuplicateNameInput(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button type="button" className="secondary" onClick={() => setDuplicatingId(null)}>Cancel</button>
              <button type="submit" disabled={creating}>{creating ? 'Duplicating...' : 'Duplicate'}</button>
            </div>
          </form>
        </Modal>
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="Delete this dataset?"
          message="This permanently deletes the underlying form and all of its sample records. Any onboarding intent connected to it in Demo Setup will need reconnecting."
          confirmLabel="Delete"
          danger
          onConfirm={performDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  )
}

export default DemoDataManagerPage
