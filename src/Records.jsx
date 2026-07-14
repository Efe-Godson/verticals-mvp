import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { printReceipt } from './receiptPrint'
import { exportRecordsToExcel, exportRecordsToCSV, exportRecordsToPDF, printRecordsTable } from './recordsExport'

const PAGE_SIZE = 10

function formatCell(value, field) {
  if (value === undefined || value === null || value === '') {
    return <span style={{ color: '#ccc' }}>—</span>
  }
  if (field.type === 'date') {
    const d = new Date(value)
    if (!isNaN(d)) {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    return value
  }
  if (field.type === 'number') {
    const num = Number(value)
    return isNaN(num) ? value : num.toLocaleString()
  }
  if (field.type === 'cart') {
    if (!value || !value.items || value.items.length === 0) {
      return <span style={{ color: '#ccc' }}>—</span>
    }
    return `${value.items.length} item${value.items.length !== 1 ? 's' : ''} — ₦${value.total.toLocaleString()}`
  }
  return value.toString()
}

function CartCell({ value, cellKey, openCartCellKey, setOpenCartCellKey }) {
  if (!value || !value.items || value.items.length === 0) {
    return <span style={{ color: '#ccc' }}>—</span>
  }

  const isOpen = openCartCellKey === cellKey

  return (
    <span style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <span
        onClick={() => setOpenCartCellKey(isOpen ? null : cellKey)}
        style={{ cursor: 'pointer', color: 'var(--color-primary)', textDecoration: 'underline dotted' }}
      >
        {value.items.length} item{value.items.length !== 1 ? 's' : ''} — ₦{value.total.toLocaleString()}
      </span>

      {isOpen && (
        <>
          <div style={overlayStyle} onClick={() => setOpenCartCellKey(null)} />
          <div style={{ ...dropdownStyle, right: 'auto', left: 0, minWidth: '260px' }}>
            <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.5rem' }}>
              Order Details
            </div>
            {value.items.map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', gap: '0.6rem',
                fontSize: '0.85rem', padding: '0.3rem 0', borderBottom: '1px solid #f0f0f0'
              }}>
                <span>{item.name} <span style={{ color: '#999' }}>× {item.quantity}</span></span>
                <span style={{ whiteSpace: 'nowrap' }}>₦{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
              <span>Total</span>
              <span>₦{value.total.toLocaleString()}</span>
            </div>
          </div>
        </>
      )}
    </span>
  )
}

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: '3months', label: 'Last 3 months' },
  { value: '6months', label: 'Last 6 months' },
  { value: '12months', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
]

function getDateRangeBounds(range, customStart, customEnd) {
  if (range === 'all') return { start: null, end: null }

  const now = new Date()
  let start = null

  if (range === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (range === '7days') {
    start = new Date(now); start.setDate(start.getDate() - 7)
  } else if (range === '30days') {
    start = new Date(now); start.setDate(start.getDate() - 30)
  } else if (range === '3months') {
    start = new Date(now); start.setMonth(start.getMonth() - 3)
  } else if (range === '6months') {
    start = new Date(now); start.setMonth(start.getMonth() - 6)
  } else if (range === '12months') {
    start = new Date(now); start.setFullYear(start.getFullYear() - 1)
  } else if (range === 'custom') {
    return {
      start: customStart ? new Date(customStart) : null,
      end: customEnd ? new Date(customEnd + 'T23:59:59') : null
    }
  }

  return { start, end: null }
}

function compareValues(a, b, field) {
  const valA = a.data[field.id]
  const valB = b.data[field.id]
  if (valA === undefined || valA === null || valA === '') return 1
  if (valB === undefined || valB === null || valB === '') return -1
  if (field.type === 'number') return Number(valA) - Number(valB)
  if (field.type === 'date') return new Date(valA) - new Date(valB)
  return valA.toString().localeCompare(valB.toString())
}

function passesFilter(sub, field, filter) {
  const value = sub.data[field.id]
  if (field.type === 'number') {
    if (value === undefined || value === '') return false
    const num = Number(value)
    if (filter.condition === 'gt') return num > Number(filter.value)
    if (filter.condition === 'lt') return num < Number(filter.value)
    if (filter.condition === 'eq') return num === Number(filter.value)
    if (filter.condition === 'between') return num >= Number(filter.value) && num <= Number(filter.value2)
  }
  if (field.type === 'date') {
    if (!value) return false
    const d = new Date(value)
    if (filter.condition === 'before') return d < new Date(filter.value)
    if (filter.condition === 'after') return d > new Date(filter.value)
    if (filter.condition === 'between') return d >= new Date(filter.value) && d <= new Date(filter.value2)
  }
  if (field.type === 'dropdown' || field.type === 'multiplechoice') {
    if (!filter.selected || filter.selected.length === 0) return true
    return filter.selected.includes(value)
  }
  if (!value) return false
  return value.toString().toLowerCase().includes((filter.value || '').toLowerCase())
}

function FilterIcon({ color }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round">
      <polygon points="4 4 20 4 14 12.5 14 19 10 21 10 12.5 4 4" />
    </svg>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 15 }

const dropdownStyle = {
  position: 'absolute', top: '100%', right: 0, marginTop: '0.3rem',
  background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 20, minWidth: '190px', padding: '0.6rem'
}

function DropdownItem({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="secondary"
      style={{
        display: 'block', width: '100%', textAlign: 'left', border: 'none',
        padding: '0.45rem 0.3rem', fontSize: '0.85rem', background: 'transparent'
      }}
    >
      {children}
    </button>
  )
}

function Records() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [sortFieldId, setSortFieldId] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const [filters, setFilters] = useState({})
  const [openFilterId, setOpenFilterId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [hiddenFieldIds, setHiddenFieldIds] = useState([])
  const [activeMenu, setActiveMenu] = useState(null) // null | 'download' | 'more'
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [openCartCellKey, setOpenCartCellKey] = useState(null)
  const [binCount, setBinCount] = useState(0)
  const [showBin, setShowBin] = useState(false)
  const [trashedSubmissions, setTrashedSubmissions] = useState([])
  const [loadingBin, setLoadingBin] = useState(false)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const { data: formData, error: formError } = await supabase
        .from('forms').select('*').eq('id', id).single()

      if (formError) {
        setError('This form could not be found.')
        setLoading(false)
        return
      }
      setForm(formData)
      setHiddenFieldIds(formData.settings?.hiddenColumns || [])

      const { data: subsData, error: subsError } = await supabase
        .from('submissions').select('*').eq('form_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (subsError) {
        setError('Could not load records: ' + subsError.message)
        setLoading(false)
        return
      }
      setSubmissions(subsData)

      const { count } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('form_id', id)
        .not('deleted_at', 'is', null)
      setBinCount(count || 0)

      setLoading(false)
    }
    loadData()
  }, [id])

  function handleRecordUpdated(updatedRecord) {
    setSubmissions(submissions.map(s => s.id === updatedRecord.id ? updatedRecord : s))
    setSelectedRecord(updatedRecord)
  }

  if (loading) return <div className="page">Loading records...</div>
  if (error) return <div className="page" style={{ color: 'red' }}>{error}</div>

  const { start: rangeStart, end: rangeEnd } = getDateRangeBounds(dateRange, customStart, customEnd)

  let visible = submissions.filter(sub => {
    const created = new Date(sub.created_at)
    if (rangeStart && created < rangeStart) return false
    if (rangeEnd && created > rangeEnd) return false
    return true
  })

  visible = visible.filter(sub => {
    if (searchText.trim() === '') return true
    return form.fields.some(field => {
      const val = sub.data[field.id]
      if (field.type === 'cart') return false
      return val && val.toString().toLowerCase().includes(searchText.toLowerCase())
    })
  })

  visible = visible.filter(sub => {
    return Object.keys(filters).every(fieldId => {
      const field = form.fields.find(f => f.id === fieldId)
      const filter = filters[fieldId]
      if (!filter || filter.cleared) return true
      return passesFilter(sub, field, filter)
    })
  })

  if (sortFieldId) {
    const field = form.fields.find(f => f.id === sortFieldId)
    visible = [...visible].sort((a, b) => {
      const result = compareValues(a, b, field)
      return sortDirection === 'asc' ? result : -result
    })
  }

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageRows = visible.slice(startIndex, startIndex + PAGE_SIZE)

  const visibleFields = form.fields.filter(f => !hiddenFieldIds.includes(f.id))
  const presets = form.settings?.recordPresets || []

  function buildFilterSummary() {
    const parts = []
    if (searchText.trim() !== '') parts.push(`Search: "${searchText.trim()}"`)
    if (dateRange !== 'all') {
      const rangeLabel = DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label
      parts.push(dateRange === 'custom'
        ? `Date: ${customStart || '…'} to ${customEnd || '…'}`
        : rangeLabel)
    }
    const activeFilterCount = Object.keys(filters).length
    if (activeFilterCount > 0) parts.push(`${activeFilterCount} column filter${activeFilterCount !== 1 ? 's' : ''} applied`)
    return parts.join(' · ')
  }

  function handleExportExcel() {
    exportRecordsToExcel(form, visible)
  }

  function handleExportCSV() {
    exportRecordsToCSV(form, visible)
  }

  function handleExportPDF() {
    exportRecordsToPDF(form, visible, buildFilterSummary())
  }

  function handlePrintTable() {
    printRecordsTable(form, visible, buildFilterSummary())
  }

  async function toggleColumnVisibility(fieldId) {
    const updated = hiddenFieldIds.includes(fieldId)
      ? hiddenFieldIds.filter(id => id !== fieldId)
      : [...hiddenFieldIds, fieldId]
    setHiddenFieldIds(updated)

    const updatedSettings = { ...(form.settings || {}), hiddenColumns: updated }
    const { error } = await supabase.from('forms').update({ settings: updatedSettings }).eq('id', form.id)
    if (!error) setForm({ ...form, settings: updatedSettings })
  }

  function toggleSelectRow(subId) {
    setSelectedIds(selectedIds.includes(subId)
      ? selectedIds.filter(sid => sid !== subId)
      : [...selectedIds, subId])
  }

  function toggleSelectAllOnPage() {
    const pageIds = pageRows.map(r => r.id)
    const allSelected = pageIds.length > 0 && pageIds.every(pid => selectedIds.includes(pid))
    if (allSelected) {
      setSelectedIds(selectedIds.filter(sid => !pageIds.includes(sid)))
    } else {
      setSelectedIds([...new Set([...selectedIds, ...pageIds])])
    }
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return
    const confirmed = window.confirm(
      `Move ${selectedIds.length} selected record${selectedIds.length !== 1 ? 's' : ''} to the Recycle Bin?`
    )
    if (!confirmed) return

    const { data, error } = await supabase
      .from('submissions')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', selectedIds)
      .select('id')

    if (error) {
      alert('Could not delete records: ' + error.message)
      return
    }

    const deletedIds = (data || []).map(d => d.id)

    if (deletedIds.length < selectedIds.length) {
      alert(
        `Only ${deletedIds.length} of ${selectedIds.length} record(s) were actually moved to the bin. ` +
        `This usually means a database permission is missing — check the update policy on the submissions table.`
      )
    }

    setSubmissions(submissions.filter(s => !deletedIds.includes(s.id)))
    setSelectedIds(selectedIds.filter(sid => !deletedIds.includes(sid)))
    setBinCount(binCount + deletedIds.length)
  }

  async function openBin() {
    setShowBin(true)
    setLoadingBin(true)
    const { data, error } = await supabase
      .from('submissions').select('*').eq('form_id', id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (!error) setTrashedSubmissions(data)
    setLoadingBin(false)
  }

  async function restoreRecord(subId) {
    const { data, error } = await supabase
      .from('submissions')
      .update({ deleted_at: null })
      .eq('id', subId)
      .select()
      .single()

    if (error) {
      alert('Could not restore record: ' + error.message)
      return
    }
    setTrashedSubmissions(trashedSubmissions.filter(s => s.id !== subId))
    setSubmissions([data, ...submissions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    setBinCount(Math.max(0, binCount - 1))
  }

  async function permanentlyDeleteRecord(subId) {
    const confirmed = window.confirm('Permanently delete this record? This cannot be undone.')
    if (!confirmed) return

    const { error } = await supabase.from('submissions').delete().eq('id', subId)
    if (error) {
      alert('Could not permanently delete: ' + error.message)
      return
    }
    setTrashedSubmissions(trashedSubmissions.filter(s => s.id !== subId))
    setBinCount(Math.max(0, binCount - 1))
  }

  async function emptyBin() {
    if (trashedSubmissions.length === 0) return
    const confirmed = window.confirm(
      `Permanently delete all ${trashedSubmissions.length} record(s) in the bin? This cannot be undone.`
    )
    if (!confirmed) return

    const ids = trashedSubmissions.map(s => s.id)
    const { error } = await supabase.from('submissions').delete().in('id', ids)
    if (error) {
      alert('Could not empty the bin: ' + error.message)
      return
    }
    setTrashedSubmissions([])
    setBinCount(0)
  }

  async function savePreset(name) {
    const newPreset = { name: name.trim(), searchText, dateRange, customStart, customEnd, filters }
    const updatedPresets = [...presets, newPreset]
    const updatedSettings = { ...(form.settings || {}), recordPresets: updatedPresets }

    const { error } = await supabase.from('forms').update({ settings: updatedSettings }).eq('id', form.id)
    if (!error) {
      setForm({ ...form, settings: updatedSettings })
      setShowSaveDialog(false)
    }
  }

  function applyPreset(preset) {
    setSearchText(preset.searchText || '')
    setDateRange(preset.dateRange || 'all')
    setCustomStart(preset.customStart || '')
    setCustomEnd(preset.customEnd || '')
    setFilters(preset.filters || {})
    setCurrentPage(1)
    setActiveMenu(null)
  }

  async function deletePreset(index) {
    const updatedPresets = presets.filter((_, i) => i !== index)
    const updatedSettings = { ...(form.settings || {}), recordPresets: updatedPresets }
    const { error } = await supabase.from('forms').update({ settings: updatedSettings }).eq('id', form.id)
    if (!error) setForm({ ...form, settings: updatedSettings })
  }

  function toggleSort(fieldId) {
    if (sortFieldId === fieldId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortFieldId(fieldId)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  function applyFilter(fieldId, filterData) {
    setFilters({ ...filters, [fieldId]: filterData })
    setOpenFilterId(null)
    setCurrentPage(1)
  }

  function clearFilter(fieldId) {
    const updated = { ...filters }
    delete updated[fieldId]
    setFilters(updated)
    setOpenFilterId(null)
    setCurrentPage(1)
  }

  return (
    <div className="page">
      <h1>{form.name}</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
        <p style={{ color: '#666', margin: 0 }}>{visible.length} of {submissions.length} record{submissions.length !== 1 ? 's' : ''}</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {visible.length > 0 && (
            <>
              <button className="secondary" onClick={handlePrintTable}>Print</button>

              <div style={{ position: 'relative' }}>
                <button className="secondary" onClick={() => setActiveMenu(activeMenu === 'download' ? null : 'download')}>
                  Download ▾
                </button>
                {activeMenu === 'download' && (
                  <>
                    <div style={overlayStyle} onClick={() => setActiveMenu(null)} />
                    <div style={dropdownStyle} onClick={(e) => e.stopPropagation()}>
                      <DropdownItem onClick={() => { handleExportExcel(); setActiveMenu(null) }}>Excel (.xlsx)</DropdownItem>
                      <DropdownItem onClick={() => { handleExportPDF(); setActiveMenu(null) }}>PDF (.pdf)</DropdownItem>
                      <DropdownItem onClick={() => { handleExportCSV(); setActiveMenu(null) }}>CSV (.csv)</DropdownItem>
                  </div>
                </>
              )}
            </div>
            </>
          )}

          <div style={{ position: 'relative' }}>
            <button className="secondary" onClick={() => setActiveMenu(activeMenu === 'more' ? null : 'more')}>
              More ▾
            </button>
            {activeMenu === 'more' && (
              <>
                <div style={overlayStyle} onClick={() => setActiveMenu(null)} />
                  <div style={{ ...dropdownStyle, minWidth: '220px' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.4rem' }}>
                      Columns
                    </div>
                    {form.fields.map(field => (
                      <label key={field.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!hiddenFieldIds.includes(field.id)}
                          onChange={() => toggleColumnVisibility(field.id)}
                        />
                        {field.label}
                      </label>
                    ))}

                    <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.7rem 0 0.5rem' }} />

                    <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.4rem' }}>
                      Presets
                    </div>
                    {presets.length === 0 && (
                      <p style={{ fontSize: '0.8rem', color: '#999', margin: '0 0 0.5rem' }}>No saved presets yet.</p>
                    )}
                    {presets.map((preset, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', padding: '0.3rem 0' }}>
                        <span onClick={() => applyPreset(preset)} style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                          {preset.name}
                        </span>
                        <span onClick={() => deletePreset(i)} style={{ cursor: 'pointer', color: '#c0392b', fontSize: '0.75rem' }}>
                          Delete
                        </span>
                      </div>
                    ))}
                    <button
                      className="secondary"
                      onClick={() => { setActiveMenu(null); setShowSaveDialog(true) }}
                      style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.8rem' }}
                    >
                      + Save current filters
                    </button>

                    <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.7rem 0 0.5rem' }} />

                    <button
                      className="secondary"
                      onClick={() => { setActiveMenu(null); openBin() }}
                      style={{ width: '100%', fontSize: '0.8rem' }}
                    >
                      Recycle Bin{binCount > 0 ? ` (${binCount})` : ''}
                    </button>
                  </div>
                </>
              )}
            </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.8rem',
          padding: '0.6rem 1rem', background: '#fff4e5', borderRadius: 'var(--radius)'
        }}>
          <span style={{ fontSize: '0.9rem' }}>{selectedIds.length} selected</span>
          <button className="secondary" style={{ color: '#c0392b' }} onClick={deleteSelected}>Move to Bin</button>
          <button className="secondary" onClick={() => setSelectedIds([])}>Clear selection</button>
        </div>
      )}

      <input
        type="text"
        placeholder="Search all records..."
        value={searchText}
        onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1) }}
        style={{ padding: '0.5rem', width: '300px', marginBottom: '0.7rem', display: 'block' }}
      />

      <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <select
          value={dateRange}
          onChange={(e) => { setDateRange(e.target.value); setCurrentPage(1) }}
          style={{ padding: '0.5rem' }}
        >
          {DATE_RANGE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {dateRange === 'custom' && (
          <>
            <input
              type="date"
              value={customStart}
              onChange={(e) => { setCustomStart(e.target.value); setCurrentPage(1) }}
              style={{ padding: '0.5rem' }}
            />
            <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => { setCustomEnd(e.target.value); setCurrentPage(1) }}
              style={{ padding: '0.5rem' }}
            />
          </>
        )}
      </div>

      {submissions.length === 0 ? (
        <p style={{ marginTop: '2rem', color: '#999' }}>
          No records yet. Once people submit this form, their responses will show up here.
        </p>
      ) : visible.length === 0 ? (
        <p style={{ marginTop: '2rem', color: '#999' }}>No records match your search or filters.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '65vh', marginTop: '1rem', border: '1px solid #eee', borderRadius: 'var(--radius)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{
                    textAlign: 'left', borderBottom: '2px solid #ddd', padding: '0.6rem',
                    background: '#fafafa', position: 'sticky', top: 0, zIndex: 6, width: '36px'
                  }}>
                    <input
                      type="checkbox"
                      checked={pageRows.length > 0 && pageRows.every(r => selectedIds.includes(r.id))}
                      onChange={toggleSelectAllOnPage}
                    />
                  </th>
                  {visibleFields.map(field => (
                    <th key={field.id} style={{
                      textAlign: 'left', borderBottom: '2px solid #ddd',
                      padding: '0.6rem', background: '#fafafa', position: 'sticky', top: 0, zIndex: 5
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span onClick={() => toggleSort(field.id)} style={{ cursor: 'pointer' }} title="Click to sort">
                          {field.label}
                          {sortFieldId === field.id ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </span>
                        {field.type !== 'cart' && (
                          <button
                            onClick={() => setOpenFilterId(openFilterId === field.id ? null : field.id)}
                            title="Filter"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '22px', height: '22px', padding: 0, borderRadius: '5px',
                              background: filters[field.id] ? 'var(--color-primary)' : 'transparent',
                              border: filters[field.id] ? 'none' : '1px solid #cbd5e1'
                            }}
                          >
                            <FilterIcon color={filters[field.id] ? 'white' : '#64748b'} />
                          </button>
                        )}
                      </div>
                      <div style={{ fontWeight: 'normal', fontSize: '0.75rem', color: '#999' }}>{field.type}</div>

                      {openFilterId === field.id && field.type !== 'cart' && (
                        <FilterPopover
                          field={field}
                          currentFilter={filters[field.id]}
                          onApply={(filterData) => applyFilter(field.id, filterData)}
                          onClear={() => clearFilter(field.id)}
                        />
                      )}
                    </th>
                  ))}
                  <th style={{
                    textAlign: 'left', borderBottom: '2px solid #ddd', padding: '0.6rem',
                    background: '#fafafa', position: 'sticky', top: 0, zIndex: 5
                  }}>
                    <div>Submitted</div>
                    <div style={{ fontWeight: 'normal', fontSize: '0.75rem', color: '#999' }}>date</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(sub => (
                  <tr
                    key={sub.id}
                    onClick={() => setSelectedRecord(sub)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f8ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td
                      style={{ borderBottom: '1px solid #eee', padding: '0.6rem' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(sub.id)}
                        onChange={() => toggleSelectRow(sub.id)}
                      />
                    </td>
                    {visibleFields.map(field => (
                      <td key={field.id} style={{
                        borderBottom: '1px solid #eee', padding: '0.6rem',
                        textAlign: field.type === 'number' ? 'right' : 'left'
                      }}>
                        {field.type === 'cart' ? (
                          <CartCell
                            value={sub.data[field.id]}
                            cellKey={`${sub.id}-${field.id}`}
                            openCartCellKey={openCartCellKey}
                            setOpenCartCellKey={setOpenCartCellKey}
                          />
                        ) : (
                          formatCell(sub.data[field.id], field)
                        )}
                      </td>
                    ))}
                    <td style={{ borderBottom: '1px solid #eee', padding: '0.6rem', color: '#666' }}>
                      {new Date(sub.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
            <span style={{ color: '#666', fontSize: '0.9rem' }}>
              Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, visible.length)} of {visible.length}
            </span>
            <button disabled={safePage === 1} onClick={() => setCurrentPage(safePage - 1)}>
              Previous
            </button>
            <span>Page {safePage} of {totalPages}</span>
            <button disabled={safePage === totalPages} onClick={() => setCurrentPage(safePage + 1)}>
              Next
            </button>
          </div>
        </>
      )}

      {selectedRecord && (
        <RecordDetail
          form={form}
          record={selectedRecord}
          fields={form.fields}
          onClose={() => setSelectedRecord(null)}
          onUpdated={handleRecordUpdated}
        />
      )}

      {showSaveDialog && (
        <SavePresetDialog
          onSave={savePreset}
          onClose={() => setShowSaveDialog(false)}
        />
      )}

      {showBin && (
        <RecycleBinDialog
          form={form}
          submissions={trashedSubmissions}
          loading={loadingBin}
          onRestore={restoreRecord}
          onPermanentDelete={permanentlyDeleteRecord}
          onEmptyBin={emptyBin}
          onClose={() => setShowBin(false)}
        />
      )}
    </div>
  )
}

function CartEditInput({ field, value, onChange }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  const products = field.products || []
  const items = value?.items || []

  const categories = ['All', ...Array.from(new Set(
    products.map(p => p.category).filter(c => c && c.trim() !== '')
  ))]

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || p.category === category
    return matchesSearch && matchesCategory
  })

  function getQuantity(productId) {
    const item = items.find(i => i.id === productId)
    return item ? item.quantity : 0
  }

  function setQuantity(product, rawQty) {
    const numQty = Math.max(0, Math.floor(Number(rawQty)) || 0)
    const existing = items.find(i => i.id === product.id)

    let newItems
    if (numQty === 0) {
      newItems = items.filter(i => i.id !== product.id)
    } else if (existing) {
      newItems = items.map(i => i.id === product.id ? { ...i, quantity: numQty } : i)
    } else {
      newItems = [...items, {
        id: product.id, name: product.name, price: product.price,
        category: product.category || '', quantity: numQty
      }]
    }

    const total = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    onChange({ items: newItems, total })
  }

  function increment(product) {
    setQuantity(product, getQuantity(product.id) + 1)
  }

  function decrement(product) {
    setQuantity(product, Math.max(0, getQuantity(product.id) - 1))
  }

  function removeItem(productId) {
    const newItems = items.filter(i => i.id !== productId)
    const total = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    onChange({ items: newItems, total })
  }

  // Cart items whose product has since been removed from the catalogue —
  // kept visible in the summary below (with a Remove option) even though
  // they won't appear in the searchable browse list above.
  const orphanItems = items.filter(i => !products.some(p => p.id === i.id))

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <div>
      <input
        type="text"
        placeholder="Search products to add..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.6rem' }}
      />

      {categories.length > 1 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={category === cat ? '' : 'secondary'}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '20px' }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px', marginBottom: '0.8rem' }}>
        {filteredProducts.length === 0 ? (
          <p style={{ padding: '0.7rem', color: '#999', margin: 0, fontSize: '0.85rem' }}>No products match.</p>
        ) : (
          filteredProducts.map(p => {
            const qty = getQuantity(p.id)
            return (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.5rem 0.7rem', borderBottom: '1px solid #f5f5f5'
              }}>
                <div style={{ fontSize: '0.85rem' }}>
                  {p.name}{' '}
                  <span style={{ color: '#999', fontSize: '0.75rem' }}>
                    ₦{Number(p.price).toLocaleString()}
                  </span>
                </div>

                {qty === 0 ? (
                  <button type="button" onClick={() => increment(p)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                    Add
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button type="button" className="secondary" onClick={() => decrement(p)} style={{ padding: '0.2rem 0.55rem', fontSize: '0.8rem' }}>−</button>
                    <input
                      type="number"
                      min="0"
                      value={qty}
                      onChange={(e) => setQuantity(p, e.target.value)}
                      style={{ width: '48px', padding: '0.2rem', textAlign: 'center', fontSize: '0.8rem' }}
                    />
                    <button type="button" className="secondary" onClick={() => increment(p)} style={{ padding: '0.2rem 0.55rem', fontSize: '0.8rem' }}>+</button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="card" style={{ padding: '0.8rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
          Cart ({items.length})
        </div>

        {items.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.8rem', margin: 0 }}>No items yet.</p>
        ) : (
          items.map(item => (
            <div key={item.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: '0.85rem', padding: '0.3rem 0', borderBottom: '1px solid #f5f5f5'
            }}>
              <span>
                {item.name} <span style={{ color: '#999' }}>× {item.quantity}</span>
                {orphanItems.some(o => o.id === item.id) && (
                  <span style={{ color: '#c0392b', fontSize: '0.7rem', marginLeft: '0.4rem' }}>(removed from catalogue)</span>
                )}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span>₦{(item.price * item.quantity).toLocaleString()}</span>
                <span onClick={() => removeItem(item.id)} style={{ color: '#c0392b', cursor: 'pointer', fontSize: '0.75rem' }}>
                  Remove
                </span>
              </div>
            </div>
          ))
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
          <span>Total</span>
          <span>₦{total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

function RecordEditInput({ field, value, onChange }) {
  if (field.type === 'longtext') {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: '0.5rem', width: '100%', minHeight: '70px' }}
      />
    )
  }
  if (field.type === 'dropdown') {
    return (
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ padding: '0.5rem', width: '100%' }}>
        <option value="">Select an option</option>
        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    )
  }
  if (field.type === 'multiplechoice') {
    return (
      <div>
        {field.options?.map(opt => (
          <label key={opt} style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'normal' }}>
            <input
              type="radio"
              name={`edit-${field.id}`}
              checked={value === opt}
              onChange={() => onChange(opt)}
            /> {opt}
          </label>
        ))}
      </div>
    )
  }
  const inputType =
    field.type === 'number' ? 'number' :
    field.type === 'email' ? 'email' :
    field.type === 'phone' ? 'tel' :
    field.type === 'date' ? 'date' :
    'text'
  return (
    <input
      type={inputType}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: '0.5rem', width: '100%' }}
    />
  )
}

function RecycleBinDialog({ form, submissions, loading, onRestore, onPermanentDelete, onEmptyBin, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 100
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '8px', padding: '1.5rem',
          width: '560px', maxHeight: '80vh', overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
          <h3 style={{ margin: 0 }}>Recycle Bin</h3>
          <button onClick={onClose} className="secondary">Close</button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.2rem', marginBottom: '1rem' }}>
          Deleted records stay here until restored or permanently erased.
        </p>

        {loading ? (
          <p style={{ color: '#999' }}>Loading…</p>
        ) : submissions.length === 0 ? (
          <p style={{ color: '#999' }}>The bin is empty.</p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem' }}>
              <button className="secondary" style={{ color: '#c0392b' }} onClick={onEmptyBin}>
                Empty Bin
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {submissions.map(sub => {
                const previewField = form.fields.find(f => {
                  const val = sub.data[f.id]
                  return f.type !== 'cart' && val !== undefined && val !== null && val.toString().trim() !== ''
                })
                const previewText = previewField ? sub.data[previewField.id].toString() : `Record ${sub.id.slice(0, 8)}`

                return (
                  <div key={sub.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.8rem', border: '1px solid #eee', borderRadius: '6px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{previewText}</div>
                      <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.15rem' }}>
                        Deleted {new Date(sub.deleted_at).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="secondary" onClick={() => onRestore(sub.id)}>Restore</button>
                      <button className="secondary" style={{ color: '#c0392b' }} onClick={() => onPermanentDelete(sub.id)}>
                        Delete Forever
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SavePresetDialog({ onSave, onClose }) {
  const [name, setName] = useState('')

  function handleSave() {
    if (name.trim() === '') return
    onSave(name.trim())
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 100
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', width: '360px' }}
      >
        <h3 style={{ margin: '0 0 1rem' }}>Save Filter Preset</h3>

        <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Preset name</label>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          placeholder="e.g. This week's orders"
          style={{ padding: '0.5rem', width: '100%', marginTop: '0.4rem', marginBottom: '1.2rem' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={name.trim() === ''}>Save</button>
        </div>
      </div>
    </div>
  )
}

function RecordDetail({ form, record, fields, onClose, onUpdated }) {
  const { session } = useAuth()
  const hasCartField = fields.some(f => f.type === 'cart')

  const [isEditing, setIsEditing] = useState(false)
  const [editedValues, setEditedValues] = useState(record.data)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [showHistory, setShowHistory] = useState(false)
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  function startEditing() {
    setEditedValues(record.data)
    setSaveError('')
    setIsEditing(true)
  }

  function cancelEditing() {
    setEditedValues(record.data)
    setIsEditing(false)
    setSaveError('')
  }

  async function saveEdits() {
    const changes = []

    fields.forEach(field => {
      const oldVal = record.data[field.id]
      const newVal = editedValues[field.id]

      if (field.type === 'cart') {
        const oldItems = oldVal?.items || []
        const newItems = newVal?.items || []
        const oldStr = oldItems.map(i => `${i.name} ×${i.quantity}`).join(', ') || '(empty cart)'
        const newStr = newItems.map(i => `${i.name} ×${i.quantity}`).join(', ') || '(empty cart)'
        if (oldStr !== newStr) {
          changes.push({
            submission_id: record.id,
            form_id: form.id,
            changed_by: session.user.id,
            changed_by_email: session.user.email,
            field_label: field.label,
            old_value: oldStr,
            new_value: newStr
          })
        }
        return
      }

      const oldStr = (oldVal === undefined || oldVal === null) ? '' : oldVal.toString()
      const newStr = (newVal === undefined || newVal === null) ? '' : newVal.toString()
      if (oldStr !== newStr) {
        changes.push({
          submission_id: record.id,
          form_id: form.id,
          changed_by: session.user.id,
          changed_by_email: session.user.email,
          field_label: field.label,
          old_value: oldStr,
          new_value: newStr
        })
      }
    })

    if (changes.length === 0) {
      setIsEditing(false)
      return
    }

    setSaving(true)
    setSaveError('')

    const mergedData = { ...record.data, ...editedValues }

    const { error: updateError } = await supabase
      .from('submissions')
      .update({ data: mergedData })
      .eq('id', record.id)

    if (updateError) {
      setSaveError('Could not save changes: ' + updateError.message)
      setSaving(false)
      return
    }

    const { error: logError } = await supabase.from('submission_logs').insert(changes)
    if (logError) {
      // The edit itself succeeded — logging failure shouldn't block the save,
      // but we surface it so it's not silently lost.
      setSaveError('Saved, but the change log failed to record: ' + logError.message)
    }

    setSaving(false)
    setIsEditing(false)
    onUpdated({ ...record, data: mergedData })
  }

  async function openHistory() {
    setShowHistory(true)
    setLoadingLogs(true)
    const { data, error } = await supabase
      .from('submission_logs')
      .select('*')
      .eq('submission_id', record.id)
      .order('created_at', { ascending: false })

    if (!error) setLogs(data)
    setLoadingLogs(false)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 100
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '8px', padding: '2rem',
          width: '480px', maxHeight: '85vh', overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>{showHistory ? 'Edit History' : 'Record Detail'}</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!showHistory && !isEditing && (
              <>
                {hasCartField && (
                  <button className="secondary" onClick={() => printReceipt(form, record)}>Print Receipt</button>
                )}
                <button className="secondary" onClick={openHistory}>History</button>
                <button className="secondary" onClick={startEditing}>Edit</button>
              </>
            )}
            {isEditing && (
              <>
                <button className="secondary" onClick={cancelEditing} disabled={saving}>Cancel</button>
                <button onClick={saveEdits} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </>
            )}
            {showHistory && (
              <button className="secondary" onClick={() => setShowHistory(false)}>Back</button>
            )}
            <button onClick={onClose}>Close</button>
          </div>
        </div>

        {saveError && <p style={{ color: '#c0392b', fontSize: '0.9rem', marginBottom: '1rem' }}>{saveError}</p>}

        {showHistory ? (
          loadingLogs ? (
            <p style={{ color: '#999' }}>Loading history...</p>
          ) : logs.length === 0 ? (
            <p style={{ color: '#999' }}>No edits have been made to this record yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {logs.map(log => (
                <div key={log.id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '0.7rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{log.field_label}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.2rem' }}>
                    <span style={{ textDecoration: 'line-through', color: '#c0392b' }}>{log.old_value || '(empty)'}</span>
                    {' → '}
                    <span style={{ color: '#1a7f37' }}>{log.new_value || '(empty)'}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.2rem' }}>
                    {log.changed_by_email} · {new Date(log.created_at).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {fields.map(field => (
              <div key={field.id} style={{ marginBottom: '0.9rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.3rem' }}>{field.label}</div>
                {isEditing && field.type === 'cart' ? (
                  <CartEditInput
                    field={field}
                    value={editedValues[field.id]}
                    onChange={(val) => setEditedValues({ ...editedValues, [field.id]: val })}
                  />
                ) : isEditing && field.type !== 'cart' ? (
                  <RecordEditInput
                    field={field}
                    value={editedValues[field.id]}
                    onChange={(val) => setEditedValues({ ...editedValues, [field.id]: val })}
                  />
                ) : (
                  <div style={{ fontSize: '1rem' }}>
                    {formatCell(record.data[field.id], field)}
                  </div>
                )}
              </div>
            ))}

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
              <div style={{ fontSize: '0.8rem', color: '#999' }}>Submitted</div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                {new Date(record.created_at).toLocaleString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function FilterPopover({ field, currentFilter, onApply, onClear }) {
  const [condition, setCondition] = useState(currentFilter?.condition || 'gt')
  const [value, setValue] = useState(currentFilter?.value || '')
  const [value2, setValue2] = useState(currentFilter?.value2 || '')
  const [selected, setSelected] = useState(currentFilter?.selected || [])

  const boxStyle = {
    position: 'absolute', top: '100%', left: 0, background: 'white',
    border: '1px solid #ddd', borderRadius: '6px', padding: '0.8rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10, width: '220px',
    fontWeight: 'normal', fontSize: '0.85rem'
  }

  if (field.type === 'dropdown' || field.type === 'multiplechoice') {
    return (
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filter: {field.label}
        </div>
        {field.options?.map(opt => (
          <label key={opt} style={{ display: 'block', marginBottom: '0.3rem' }}>
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={(e) => {
                if (e.target.checked) setSelected([...selected, opt])
                else setSelected(selected.filter(o => o !== opt))
              }}
            /> {opt}
          </label>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <button onClick={onClear}>Clear</button>
          <button onClick={() => onApply({ selected })}>Apply</button>
        </div>
      </div>
    )
  }

  if (field.type === 'number') {
    return (
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filter: {field.label}
        </div>
        <select value={condition} onChange={(e) => setCondition(e.target.value)} style={{ width: '100%', marginBottom: '0.4rem' }}>
          <option value="gt">Greater than</option>
          <option value="lt">Less than</option>
          <option value="eq">Equal to</option>
          <option value="between">Between</option>
        </select>
        <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" style={{ width: '100%', marginBottom: '0.4rem' }} />
        {condition === 'between' && (
          <input type="number" value={value2} onChange={(e) => setValue2(e.target.value)} placeholder="And..." style={{ width: '100%', marginBottom: '0.4rem' }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClear}>Clear</button>
          <button onClick={() => onApply({ condition, value, value2 })}>Apply</button>
        </div>
      </div>
    )
  }

  if (field.type === 'date') {
    return (
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filter: {field.label}
        </div>
        <select value={condition} onChange={(e) => setCondition(e.target.value)} style={{ width: '100%', marginBottom: '0.4rem' }}>
          <option value="after">After</option>
          <option value="before">Before</option>
          <option value="between">Between</option>
        </select>
        <input type="date" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: '100%', marginBottom: '0.4rem' }} />
        {condition === 'between' && (
          <input type="date" value={value2} onChange={(e) => setValue2(e.target.value)} style={{ width: '100%', marginBottom: '0.4rem' }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClear}>Clear</button>
          <button onClick={() => onApply({ condition, value, value2 })}>Apply</button>
        </div>
      </div>
    )
  }

  return (
    <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filter: {field.label}
        </div>
      <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Contains..." style={{ width: '100%', marginBottom: '0.4rem' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onClear}>Clear</button>
        <button onClick={() => onApply({ condition: 'contains', value })}>Apply</button>
      </div>
    </div>
  )
}

export default Records
