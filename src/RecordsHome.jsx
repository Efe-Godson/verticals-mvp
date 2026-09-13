// One tile per template you've actually put to use (mirrors Reports.jsx/
// BusinessesHome.jsx), except clicking a tile jumps straight into that
// business's records instead of its report/Manage page - this page exists
// purely as the landing spot for the mobile bottom nav's "Records" tab
// when there's no form already in context (see MobileBottomNav.jsx).
//
// Unlike Home's tiles, every card here shows a record count (not a
// location count) regardless of category - this page is specifically about
// how much data is in each workflow, so "1,284 records" is the relevant
// fact even for Restaurant/Retail, where Home would rather show locations.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { categoryColor, CategoryIcon } from './templateVisuals'
import { usePageTitle, usePageBack } from './PageTitleContext'

function RecordsTile({ template, recordCount, ownerEmail, onOpen }) {
  const color = categoryColor(template.category)
  return (
    <div
      className="template-tile"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      style={{
        border: '1px solid var(--color-border)', borderRadius: '12px',
        background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '0.9rem 0.8rem 0.85rem', textAlign: 'center', cursor: 'pointer'
      }}
    >
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px', background: `${color}16`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.7rem'
      }}>
        <CategoryIcon category={template.category} color={color} />
      </div>
      <span style={{
        fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.25, marginBottom: '0.3rem',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
      }}>
        {template.name}
      </span>
      <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
        {recordCount.toLocaleString()} record{recordCount !== 1 ? 's' : ''}
      </span>
      {ownerEmail && (
        <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
          Shared by {ownerEmail}
        </span>
      )}
    </div>
  )
}

function RecordsHome() {
  const { session } = useAuth()
  const navigate = useNavigate()
  usePageTitle('Records')
  usePageBack('/', 'Home')

  const [usedTemplates, setUsedTemplates] = useState([]) // [{ template, recordCount, singleFormId, locationCount, ownerId, role, ownerEmail }]
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Unlike BusinessesHome.jsx's Home tiles, Records keeps Viewer-role
      // rows - this (and Reports.jsx) is exactly where a Viewer collaborator
      // gets access, just never on Home. Grouped by (owner_id, template_slug),
      // not slug alone - the same slug isn't unique across different owners.
      const { data: rows } = await supabase.rpc('list_accessible_workflows')

      const byKey = {} // "ownerId:slug" -> { ownerId, slug, role, ownerEmail, formIds }
      ;(rows || []).forEach(r => {
        byKey[`${r.owner_id}:${r.template_slug}`] = {
          ownerId: r.owner_id, slug: r.template_slug, role: r.role,
          ownerEmail: r.owner_email, formIds: r.form_ids || [],
        }
      })

      const keys = Object.keys(byKey)
      if (keys.length === 0) {
        setUsedTemplates([])
        setLoading(false)
        return
      }

      const slugs = [...new Set(Object.values(byKey).map(e => e.slug))]
      const { data: templates } = await supabase.from('templates').select('*').in('slug', slugs)
      const list = (await Promise.all(Object.values(byKey).map(async entry => {
        const template = (templates || []).find(t => t.slug === entry.slug)
        if (!template) return null
        const { count } = await supabase.from('submissions').select('id', { count: 'exact', head: true })
          .in('form_id', entry.formIds).is('deleted_at', null)
        return {
          template, recordCount: count || 0, singleFormId: entry.formIds[0], locationCount: entry.formIds.length,
          ownerId: entry.ownerId, role: entry.role, ownerEmail: entry.ownerEmail,
        }
      }))).filter(Boolean)
      setUsedTemplates(list)
      setLoading(false)
    }
    load()
  }, [session])

  // A template with more than one location (Restaurant, Retail, ...) has no
  // single obvious "records" to jump into - route through the location
  // picker first (see TemplateLocations.jsx's ?goto=records handling)
  // instead of silently opening whichever location happened to load first.
  function openRecords({ template, singleFormId, locationCount, ownerId, role }) {
    if (!template.bundle?.length && locationCount > 1) {
      const ownerParam = role === 'owner' ? '' : `&owner=${ownerId}`
      navigate(`/templates/${template.slug}/locations?goto=records${ownerParam}`)
      return
    }
    navigate(`/form/${singleFormId}/records`)
  }

  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      <style>{`
        .template-tile { transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease; }
        .template-tile:hover { border-color: var(--color-primary); box-shadow: 0 4px 14px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .template-tile:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      `}</style>

      <p style={{ color: 'var(--color-muted)', margin: '0 0 1.5rem' }}>
        Choose a workflow to view its records.
      </p>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.8rem' }}>
          {[0, 1, 2].map(i => <div key={i} className="card" style={{ minHeight: '150px' }} />)}
        </div>
      ) : usedTemplates.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          <p style={{ margin: '0 0 0.9rem' }}>Set up a business from a template to see its records here.</p>
          <Link to="/templates"><button>Browse Templates</button></Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.8rem' }}>
          {usedTemplates.map(({ template, recordCount, singleFormId, locationCount, ownerId, role, ownerEmail }) => (
            <RecordsTile
              key={`${ownerId}:${template.slug}`}
              template={template}
              recordCount={recordCount}
              ownerEmail={role !== 'owner' ? ownerEmail : null}
              onOpen={() => openRecords({ template, singleFormId, locationCount, ownerId, role })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default RecordsHome
