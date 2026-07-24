import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { exportRecordsToExcel, exportRecordsToCSV, exportRecordsToPDF, printRecordsTable, openRecordsInGoogleSheets } from './recordsExport'
import { DATE_RANGE_OPTIONS, getDateRangeBounds, compareValues, passesFilter } from './records/recordsUtils'
import { formatCell, FilterIcon, CubeIcon, overlayStyle, dropdownStyle, DropdownItem } from './records/recordsUiKit'
import { CartCell } from './records/CartCell'
import { FilterPopover } from './records/FilterPopover'
import { RecordDetail } from './records/RecordDetail'
import { RecycleBinDialog } from './records/RecycleBinDialog'
import { SavePresetDialog } from './records/SavePresetDialog'

const PAGE_SIZE = 10

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
        <input
          type="text"
          className="records-search"
          placeholder="Search all records..."
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1) }}
          style={{ padding: '0.5rem' }}
        />

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button className="secondary" onClick={() => setActiveMenu(activeMenu === 'options' ? null : 'options')}>
            Options ▾
          </button>
          {activeMenu === 'options' && (
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

      <div className="date-range-row" style={{ marginTop: '0.6rem', marginBottom: '0.8rem' }}>
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

export default Records
