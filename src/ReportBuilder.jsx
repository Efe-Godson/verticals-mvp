// Place at: src/ReportBuilder.jsx
import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useToast } from './Toast'
import { LoadingState } from './LoadingState'
import { ErrorState } from './ErrorState'
import HorizontalBarChart from './report/components/HorizontalBarChart'
import PieChart from './report/components/PieChart'
import PivotTable from './report/components/PivotTable'
import { getGroupableFields, getMeasureOptions, computePivot, toChartData } from './report/helpers/pivotEngine'
import { formatNaira } from './report/helpers/analysisUtils'
import { DATE_RANGE_OPTIONS, getDateRangeBounds } from './report/helpers/dateRange'

const EMPTY_DRAFT = { title: '', rowFieldId: '', colFieldId: '', measureId: '__count__', chartType: 'bar' }

function summarizeWidget(widget, groupableFields, measureOptions) {
  const row = groupableFields.find(f => f.id === widget.rowFieldId)?.label || '?'
  const col = widget.colFieldId ? groupableFields.find(f => f.id === widget.colFieldId)?.label : null
  const measure = measureOptions.find(m => m.id === widget.measureId)?.label || '?'
  return col ? `${measure} · ${row} × ${col}` : `${measure} · ${row}`
}

function ReportBuilder() {
  const { id } = useParams()
  const { showToast } = useToast()
  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dateRange, setDateRange] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState(null)

  const formRef = useRef(form)
  useEffect(() => { formRef.current = form }, [form])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const { data: formData, error: formError } = await supabase.from('forms').select('*').eq('id', id).single()
      if (formError) { setError('This form could not be found.'); setLoading(false); return }
      setForm(formData)

      const { data: subsData, error: subsError } = await supabase
        .from('submissions').select('*').eq('form_id', id).is('deleted_at', null).order('created_at', { ascending: true })
      if (subsError) { setError('Could not load records: ' + subsError.message); setLoading(false); return }
      setSubmissions(subsData)
      setLoading(false)
    }
    loadData()
  }, [id])

  // Same read-modify-write pattern as Records.jsx's updateFormSettings -
  // `settings` is a shared JSONB bag other pages stash their own keys in
  // (recordPresets, payroll, templateSlug...), so always spread the current
  // value first rather than replacing it outright.
  async function updateFormSettings(patch) {
    const updatedSettings = { ...(formRef.current.settings || {}), ...patch }
    const { error: updateError } = await supabase.from('forms').update({ settings: updatedSettings }).eq('id', formRef.current.id)
    if (updateError) {
      showToast('Could not save: ' + updateError.message, 'error')
      return { error: updateError }
    }
    const updatedForm = { ...formRef.current, settings: updatedSettings }
    formRef.current = updatedForm
    setForm(updatedForm)
    return { error: null }
  }

  if (loading) return <LoadingState label="Loading report builder..." />
  if (error) return <ErrorState message={error} />

  const groupableFields = getGroupableFields(form)
  const measureOptions = getMeasureOptions(form)
  const widgets = form.settings?.reportWidgets || []

  const rowField = groupableFields.find(f => f.id === draft.rowFieldId) || null
  const colField = draft.colFieldId ? groupableFields.find(f => f.id === draft.colFieldId) : null
  const measure = measureOptions.find(m => m.id === draft.measureId) || measureOptions[0]
  const formatValue = measure.kind === 'cartRevenue' ? formatNaira : (v) => v.toLocaleString()

  const { start: rangeStart, end: rangeEnd } = getDateRangeBounds(dateRange, customStart, customEnd)
  const filteredSubmissions = submissions.filter(s => {
    const created = new Date(s.created_at)
    if (rangeStart && created < rangeStart) return false
    if (rangeEnd && created > rangeEnd) return false
    return true
  })

  const pivotResult = rowField
    ? computePivot({ rowField, colField, measure, submissions: filteredSubmissions })
    : null

  function updateDraft(patch) {
    setDraft(current => {
      const next = { ...current, ...patch }
      // A 2D grid can't sensibly be a single bar/pie series - force Table
      // the moment a Columns field is picked, and let Bar/Pie back in once
      // it's cleared.
      if (next.colFieldId && next.chartType !== 'table') next.chartType = 'table'
      return next
    })
  }

  function startEditing(widget) {
    setDraft({
      title: widget.title, rowFieldId: widget.rowFieldId, colFieldId: widget.colFieldId || '',
      measureId: widget.measureId, chartType: widget.chartType,
    })
    setEditingId(widget.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditing() {
    setDraft(EMPTY_DRAFT)
    setEditingId(null)
  }

  async function promote() {
    if (!draft.title.trim() || !draft.rowFieldId) return
    const widget = {
      id: editingId || `w_${Date.now().toString(36)}`,
      title: draft.title.trim(),
      rowFieldId: draft.rowFieldId,
      colFieldId: draft.colFieldId || null,
      measureId: draft.measureId,
      chartType: draft.chartType,
      createdAt: new Date().toISOString(),
    }
    const updated = editingId
      ? widgets.map(w => w.id === editingId ? widget : w)
      : [...widgets, widget]
    const { error: saveError } = await updateFormSettings({ reportWidgets: updated })
    if (!saveError) {
      showToast(editingId ? 'Report updated.' : 'Promoted to Report.', 'success')
      cancelEditing()
    }
  }

  async function removeWidget(widgetId) {
    const updated = widgets.filter(w => w.id !== widgetId)
    const { error: removeError } = await updateFormSettings({ reportWidgets: updated })
    if (!removeError) {
      showToast('Removed from Report.', 'success')
      if (editingId === widgetId) cancelEditing()
    }
  }

  return (
    <div className="page" style={{ maxWidth: '960px' }}>
      <div style={{ marginBottom: '1.2rem' }}>
        <Link to={`/form/${id}/report`} style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>← Back to Report</Link>
        <h1 style={{ margin: '0.3rem 0 0' }}>Report Builder</h1>
        <p style={{ color: 'var(--color-muted)', margin: '0.3rem 0 0' }}>
          Pick a field to group by, an optional second field to cross-tab against, and a measure - then promote it to show permanently on the Report page.
        </p>
      </div>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label htmlFor="builder-date-range" style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Preview date range</label>
          <select id="builder-date-range" value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ padding: '0.5rem' }}>
            {DATE_RANGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          {dateRange === 'specific' && (
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ padding: '0.5rem' }} />
          )}
          {dateRange === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ padding: '0.5rem' }} />
              <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ padding: '0.5rem' }} />
            </>
          )}
        </div>

        <input
          type="text" placeholder="Report title (e.g. Revenue by Rep × Channel)" value={draft.title}
          onChange={(e) => updateDraft({ title: e.target.value })}
          style={{ width: '100%', padding: '0.6rem 0.7rem', marginBottom: '1rem', fontSize: '0.95rem' }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>Rows</label>
            <select value={draft.rowFieldId} onChange={(e) => updateDraft({ rowFieldId: e.target.value })} style={{ width: '100%', padding: '0.5rem' }}>
              <option value="">Choose a field…</option>
              {groupableFields.map(f => (
                <option key={f.id} value={f.id} disabled={f.id === draft.colFieldId}>{f.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>Columns (optional)</label>
            <select value={draft.colFieldId} onChange={(e) => updateDraft({ colFieldId: e.target.value })} style={{ width: '100%', padding: '0.5rem' }}>
              <option value="">None</option>
              {groupableFields.map(f => (
                <option key={f.id} value={f.id} disabled={f.id === draft.rowFieldId}>{f.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>Measure</label>
            <select value={draft.measureId} onChange={(e) => updateDraft({ measureId: e.target.value })} style={{ width: '100%', padding: '0.5rem' }}>
              {measureOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.3rem' }}>Chart type</label>
            <select
              value={draft.chartType} disabled={!!draft.colFieldId}
              onChange={(e) => updateDraft({ chartType: e.target.value })} style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="bar">Bar</option>
              <option value="pie">Pie</option>
              <option value="table">Table</option>
            </select>
            {draft.colFieldId && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', margin: '0.3rem 0 0' }}>Locked to Table - a Columns field needs a grid, not a single series.</p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button type="button" onClick={promote} disabled={!draft.title.trim() || !draft.rowFieldId}>
            {editingId ? 'Update Report' : 'Promote to Report'}
          </button>
          {editingId && <button type="button" className="secondary" onClick={cancelEditing}>Cancel edit</button>}
        </div>
      </div>

      <div className="card" style={{ padding: '1.75rem', marginBottom: '1.2rem' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.9rem' }}>Preview</div>
        {!rowField ? (
          <p style={{ color: 'var(--color-muted)' }}>Pick a field for Rows to see a preview.</p>
        ) : draft.chartType === 'table' || colField ? (
          <PivotTable pivotResult={pivotResult} formatValue={formatValue} />
        ) : draft.chartType === 'pie' ? (
          <PieChart data={toChartData(pivotResult)} />
        ) : (
          <HorizontalBarChart data={toChartData(pivotResult)} formatValue={formatValue} />
        )}
      </div>

      <div className="card" style={{ padding: '1.75rem' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.9rem' }}>Promoted to Report ({widgets.length})</div>
        {widgets.length === 0 ? (
          <p style={{ color: 'var(--color-muted)' }}>Nothing promoted yet - build something above and promote it to see it here and on the Report page.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {widgets.map(widget => (
              <div key={widget.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem',
                padding: '0.7rem 0.9rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{widget.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{summarizeWidget(widget, groupableFields, measureOptions)}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button type="button" className="secondary" onClick={() => startEditing(widget)}>Edit</button>
                  <button type="button" className="secondary" onClick={() => removeWidget(widget.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ReportBuilder
