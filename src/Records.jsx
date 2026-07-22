import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { printReceipt } from './receiptPrint'
import { exportRecordsToExcel, exportRecordsToCSV, exportRecordsToPDF, printRecordsTable, openRecordsInGoogleSheets } from './recordsExport'

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
          <div className="dropdown-panel" style={{ ...dropdownStyle, right: 'auto', left: 0, minWidth: '260px' }}>
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
    <svg width="13" height="13" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1"
      strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 3 21 3 14 12 14 20 10 22 10 12" />
    </svg>
  )
}

function CubeIcon({ color = '#94a3b8' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M12 2 3 7v10l9 5 9-5V7z" />
      <path d="M3 7l9 5 9-5" />
      <path d="M12 12v10" />
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
  const [hoveredHeaderId, setHoveredHeaderId] = useState(null)

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
  const activeFilterCount = Object.keys(filters).length
  const hasActiveFilters = activeFilterCount > 0 || searchText.trim() !== '' || dateRange !== 'all'

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

  async function handleOpenInGoogleSheets() {
    try {
      await openRecordsInGoogleSheets(form, visible)
    } catch (error) {
      console.error(error)
      alert(error.message || 'Google Sheets could not be opened.')
    }
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

  function clearAllFilters() {
    setSearchText('')
    setDateRange('all')
    setCustomStart('')
    setCustomEnd('')
    setFilters({})
    setOpenFilterId(null)
    setCurrentPage(1)
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
      <style>{`
        .records-actions-desktop { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .records-actions-mobile { display: none; }
        @media (max-width: 900px) {
          .records-actions-desktop { display: none; }
          .records-actions-mobile { display: block; }
        }
        @media (max-width: 640px) {
          .records-actions-desktop { display: none; }
          .records-actions-mobile { display: block; }
        }
        .records-search { flex: 1 1 auto; min-width: 0; max-width: 400px; }
        @media (max-width: 640px) {
          .records-search { max-width: none; }
        }
        .date-range-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
        .date-range-group { display: flex; align-items: center; gap: 0.4rem; flex: 1 1 240px; min-width: 0; }
        .date-range-group input[type="date"] { flex: 1; min-width: 0; }
        @media (max-width: 900px) {
          .date-range-row { flex-direction: column; align-items: stretch; }
          .date-range-row select { width: 100%; }
          .date-range-group { width: 100%; }
        }
        .records-table th {
          background: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
          font-size: 0.82rem;
          padding: 0.7rem 0.75rem;
          transition: background 0.16s ease, color 0.16s ease;
        }
        .records-table th:hover {
          background: #eef6ff;
        }
        .records-table th.active-header {
          background: #dbeafe;
          color: var(--color-primary);
        }
        .records-table td {
          padding: 0.7rem 0.75rem;
          vertical-align: top;
        }
        .records-table tbody tr:hover {
          background: #f8fbff;
        }
        .records-table tbody tr:nth-child(even) {
          background: #fcfdff;
        }
        .records-table tbody tr:nth-child(even):hover {
          background: #f4f9ff;
        }
        @media (max-width: 640px) {
          .date-range-row select { width: 100%; }
          .date-range-group { width: 100%; }
          .records-table th, .records-table td {
            padding: 0.6rem 0.55rem;
            font-size: 0.82rem;
          }
          .table-scroll {
            margin-left: -0.2rem;
            margin-right: -0.2rem;
          }
        }
      `}</style>
      <h1>{form.name}</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
        <p style={{ color: '#666', margin: 0 }}>{visible.length} of {submissions.length} record{submissions.length !== 1 ? 's' : ''}</p>

        {/* Desktop: Print / Download / More as separate buttons — plenty of room */}
        <div className="records-actions-desktop">
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
                    <div className="dropdown-panel" style={dropdownStyle} onClick={(e) => e.stopPropagation()}>
                              <DropdownItem onClick={() => { handleExportExcel(); setActiveMenu(null) }}>Excel (.xlsx)</DropdownItem>
                      <DropdownItem onClick={() => { handleExportPDF(); setActiveMenu(null) }}>PDF (.pdf)</DropdownItem>
                      <DropdownItem onClick={() => { handleExportCSV(); setActiveMenu(null) }}>CSV (.csv)</DropdownItem>
                      <DropdownItem onClick={() => { handleOpenInGoogleSheets(); setActiveMenu(null) }}>Open in Google Sheets</DropdownItem>
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
                  <div className="dropdown-panel" style={{ ...dropdownStyle, minWidth: '220px' }} onClick={(e) => e.stopPropagation()}>
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
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginTop: '0.8rem',
          padding: '0.6rem 1rem', background: '#fff4e5', borderRadius: 'var(--radius)'
        }}>
          <span style={{ fontSize: '0.9rem' }}>{selectedIds.length} selected</span>
          <button className="secondary" style={{ color: '#c0392b' }} onClick={deleteSelected}>Move to Bin</button>
          <button className="secondary" onClick={() => setSelectedIds([])}>Clear selection</button>
        </div>
      )}

      {hasActiveFilters && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', marginTop: '0.7rem', marginBottom: '0.8rem', padding: '0.7rem 0.9rem', background: '#f8fbff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius)' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
            {activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount !== 1 ? 's' : ''}` : 'Search and filters are active'}
          </span>
          <button className="secondary" onClick={clearAllFilters} style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}>
            Clear all
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.6rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="records-search"
          placeholder="Search all records..."
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1) }}
          style={{ padding: '0.5rem' }}
        />

        {/* Mobile: everything else collapses into one overflow menu, next to search */}
        <div className="records-actions-mobile" style={{ position: 'relative', flexShrink: 0 }}>
          <button
            className="secondary"
            onClick={() => setActiveMenu(activeMenu === 'mobileAll' ? null : 'mobileAll')}
            title="More options"
          >
            ⋮
          </button>
          {activeMenu === 'mobileAll' && (
            <>
              <div style={overlayStyle} onClick={() => setActiveMenu(null)} />
              <div className="dropdown-panel" style={{ ...dropdownStyle, minWidth: '220px' }} onClick={(e) => e.stopPropagation()}>
                {visible.length > 0 && (
                  <>
                    <DropdownItem onClick={() => { handlePrintTable(); setActiveMenu(null) }}>Print</DropdownItem>
                    <DropdownItem onClick={() => { handleExportExcel(); setActiveMenu(null) }}>Download Excel (.xlsx)</DropdownItem>
                    <DropdownItem onClick={() => { handleExportPDF(); setActiveMenu(null) }}>Download PDF (.pdf)</DropdownItem>
                    <DropdownItem onClick={() => { handleExportCSV(); setActiveMenu(null) }}>Download CSV (.csv)</DropdownItem>
                    <DropdownItem onClick={() => { handleOpenInGoogleSheets(); setActiveMenu(null) }}>Open in Google Sheets</DropdownItem>
                    <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.7rem 0 0.5rem' }} />
                  </>
                )}

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
                    <span onClick={() => { applyPreset(preset); setActiveMenu(null) }} style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
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

      <div className="date-range-row" style={{ marginBottom: '0.8rem' }}>
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
          <div className="date-range-group">
            <input
              type="date"
              value={customStart}
              onChange={(e) => { setCustomStart(e.target.value); setCurrentPage(1) }}
              style={{ padding: '0.5rem' }}
            />
            <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem', flexShrink: 0 }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => { setCustomEnd(e.target.value); setCurrentPage(1) }}
              style={{ padding: '0.5rem' }}
            />
          </div>
        )}
      </div>

      {submissions.length === 0 ? (
        <div className="card" style={{ marginTop: '1.4rem', padding: '1.8rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.45rem' }}>No records yet</h3>
          <p style={{ margin: '0 0 0.9rem' }}>Once people submit this form, their responses will appear here with filters and export options ready to use.</p>
          <button onClick={() => window.history.back()}>Back to previous page</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="card" style={{ marginTop: '1.4rem', padding: '1.8rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.45rem' }}>No matches found</h3>
          <p style={{ margin: '0 0 0.9rem' }}>Try widening the date range or clearing a filter to see more records.</p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="secondary" onClick={clearAllFilters}>Clear filters</button>
            <button onClick={() => setSearchText('')}>Clear search</button>
          </div>
        </div>
      ) : (
        <>
          <div className="table-scroll table-breakout">
            <table className="records-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{
                    textAlign: 'left', borderBottom: '2px solid #e5e7eb', padding: '0.75rem 0.9rem',
                    background: '#fafafa', position: 'sticky', top: 0, zIndex: 6, width: '36px'
                  }}>
                    <input
                      type="checkbox"
                      checked={pageRows.length > 0 && pageRows.every(r => selectedIds.includes(r.id))}
                      onChange={toggleSelectAllOnPage}
                    />
                  </th>
                  {visibleFields.map(field => {
                    const isHovered = hoveredHeaderId === field.id
                    return (
                    <th
                      key={field.id}
                      onMouseEnter={() => setHoveredHeaderId(field.id)}
                      onMouseLeave={() => setHoveredHeaderId(null)}
                      className={sortFieldId === field.id ? 'active-header' : ''}
                      style={{
                        textAlign: 'left', borderBottom: '2px solid #e5e7eb',
                        padding: '0.75rem 0.9rem', position: 'sticky', top: 0, zIndex: 5,
                        whiteSpace: 'nowrap', minWidth: '140px',
                        background: isHovered || sortFieldId === field.id ? '#eef6ff' : '#fafafa',
                        transition: 'background 0.1s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.45rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                          <span title={field.type} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CubeIcon color={isHovered || sortFieldId === field.id ? 'var(--color-primary)' : '#94a3b8'} />
                          </span>

                          <span
                            onClick={() => toggleSort(field.id)}
                            style={{ cursor: 'pointer', color: isHovered || sortFieldId === field.id ? 'var(--color-primary)' : 'inherit', transition: 'color 0.1s ease', whiteSpace: 'nowrap' }}
                            title="Click to sort"
                          >
                            {field.label}
                            {sortFieldId === field.id ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                          </span>
                        </div>

                        {field.type !== 'cart' && (
                          <button
                            onClick={() => setOpenFilterId(openFilterId === field.id ? null : field.id)}
                            title="Filter"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '22px', height: '22px', padding: 0, borderRadius: '5px', flexShrink: 0,
                              background: filters[field.id] ? 'var(--color-primary)' : 'transparent',
                              border: filters[field.id] ? 'none' : '1px solid #cbd5e1'
                            }}
                          >
                            <FilterIcon color={filters[field.id] ? 'white' : (isHovered || sortFieldId === field.id ? 'var(--color-primary)' : '#64748b')} />
                          </button>
                        )}
                      </div>

                      {openFilterId === field.id && field.type !== 'cart' && (
                        <FilterPopover
                          field={field}
                          currentFilter={filters[field.id]}
                          onApply={(filterData) => applyFilter(field.id, filterData)}
                          onClear={() => clearFilter(field.id)}
                        />
                      )}
                    </th>
                    )
                  })}
                  <th
                    onMouseEnter={() => setHoveredHeaderId('__submitted')}
                    onMouseLeave={() => setHoveredHeaderId(null)}
                    className={sortFieldId === '__submitted' ? 'active-header' : ''}
                    style={{
                      textAlign: 'left', borderBottom: '2px solid #e5e7eb', padding: '0.75rem 0.9rem',
                      position: 'sticky', top: 0, zIndex: 5, whiteSpace: 'nowrap',
                      background: hoveredHeaderId === '__submitted' || sortFieldId === '__submitted' ? '#eef6ff' : '#fafafa',
                      transition: 'background 0.1s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span title="date">
                          <CubeIcon color={hoveredHeaderId === '__submitted' || sortFieldId === '__submitted' ? 'var(--color-primary)' : '#94a3b8'} />
                        </span>
                        <span
                          onClick={() => toggleSort('__submitted')}
                          style={{ cursor: 'pointer', color: hoveredHeaderId === '__submitted' || sortFieldId === '__submitted' ? 'var(--color-primary)' : 'inherit', transition: 'color 0.1s ease' }}
                        >
                          Submitted
                          {sortFieldId === '__submitted' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                        </span>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(sub => (
                  <tr
                    key={sub.id}
                    className="records-row"
                    onClick={() => setSelectedRecord(sub)}
                  >
                    <td
                      style={{ borderBottom: '1px solid #eee', padding: '0.75rem 0.9rem' }}
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
                        borderBottom: '1px solid #eee', padding: '0.75rem 0.9rem',
                        textAlign: field.type === 'number' ? 'right' : 'left',
                        whiteSpace: field.type === 'cart' ? 'nowrap' : 'normal',
                        verticalAlign: 'top'
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
                    <td style={{ borderBottom: '1px solid #eee', padding: '0.75rem 0.9rem', color: '#666', whiteSpace: 'nowrap' }}>
                      {new Date(sub.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
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
  const products = field.products || []
  const items = value?.items || []

  function updateQuantity(productId, rawQty) {
    const numQty = Math.max(0, Math.floor(Number(rawQty)) || 0)
    const catalogueProduct = products.find(p => p.id === productId)
    const existingItem = items.find(i => i.id === productId)
    const source = catalogueProduct || existingItem
    if (!source) return

    let newItems
    if (numQty === 0) {
      newItems = items.filter(i => i.id !== productId)
    } else if (existingItem) {
      newItems = items.map(i => i.id === productId ? { ...i, quantity: numQty } : i)
    } else {
      newItems = [...items, {
        id: source.id, name: source.name, price: source.price,
        category: source.category || '', quantity: numQty
      }]
    }

    const total = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    onChange({ items: newItems, total })
  }

  // Show every product in the form's catalogue (quantity 0 if not currently in the cart),
  // plus any cart item whose product has since been removed from the catalogue —
  // so it stays visible and adjustable rather than silently vanishing.
  const rows = products.map(p => {
    const existing = items.find(i => i.id === p.id)
    return { ...p, quantity: existing ? existing.quantity : 0 }
  })
  items.forEach(i => {
    if (!products.some(p => p.id === i.id)) rows.push({ ...i })
  })

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '260px', overflowY: 'auto' }}>
        {rows.map(row => (
          <div key={row.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '0.6rem', padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5'
          }}>
            <div style={{ fontSize: '0.85rem' }}>
              {row.name}{' '}
              <span style={{ color: '#999', fontSize: '0.75rem' }}>
                ₦{Number(row.price).toLocaleString()}
              </span>
            </div>
            <input
              type="number"
              min="0"
              value={row.quantity}
              onChange={(e) => updateQuantity(row.id, e.target.value)}
              style={{ width: '70px', padding: '0.3rem', textAlign: 'center' }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.7rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
        <span>Total</span>
        <span>₦{total.toLocaleString()}</span>
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
        alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '8px', padding: '1.5rem',
          width: '560px', maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto'
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
        alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', width: '360px', maxWidth: '100%' }}
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
        alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '12px', padding: '1.4rem 1.5rem',
          width: '520px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 18px 45px rgba(0,0,0,0.16)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>{showHistory ? 'Edit History' : 'Record Detail'}</h3>
            {!showHistory && (
              <div style={{ color: 'var(--color-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Submitted {new Date(record.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.35rem', fontWeight: 600 }}>{field.label}</div>
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
                  <div style={{ fontSize: '1rem', padding: '0.55rem 0.7rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #eef2f7', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
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
    border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.8rem',
    boxShadow: '0 10px 24px rgba(15,23,42,0.12)', zIndex: 10, width: '240px', maxWidth: '90vw',
    fontWeight: 'normal', fontSize: '0.85rem'
  }

  if (field.type === 'dropdown' || field.type === 'multiplechoice') {
    return (
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filter {field.label}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
          Pick one or more values to narrow the list.
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
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filter {field.label}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
          Choose a rule and enter a value.
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
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filter {field.label}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
          Choose a date rule and set the range.
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
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Filter {field.label}
        </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
        Use a keyword to narrow this column.
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