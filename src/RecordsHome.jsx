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
import { usePageTitle } from './PageTitleContext'

function RecordsTile({ template, recordCount, onOpen }) {
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
    </div>
  )
}

function RecordsHome() {
  const { session } = useAuth()
  const navigate = useNavigate()
  usePageTitle('Records')

  const [usedTemplates, setUsedTemplates] = useState([]) // [{ template, recordCount, singleFormId, locationCount }]
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: forms } = await supabase
        .from('forms').select('id, settings')
        .eq('user_id', session.user.id)
        .is('deleted_at', null)
        .not('settings->>templateSlug', 'is', null)
        .is('settings->>primaryFormId', null)

      const bySlug = {} // slug -> { firstFormId, formIds }
      ;(forms || []).forEach(f => {
        const slug = f.settings?.templateSlug
        if (!slug) return
        if (!bySlug[slug]) bySlug[slug] = { firstFormId: f.id, formIds: [] }
        bySlug[slug].formIds.push(f.id)
      })

      const slugs = Object.keys(bySlug)
      if (slugs.length === 0) {
        setUsedTemplates([])
        setLoading(false)
        return
      }

      const { data: templates } = await supabase.from('templates').select('*').in('slug', slugs)
      const list = await Promise.all((templates || []).map(async template => {
        const entry = bySlug[template.slug]
        const { count } = await supabase.from('submissions').select('id', { count: 'exact', head: true })
          .in('form_id', entry.formIds).is('deleted_at', null)
        return { template, recordCount: count || 0, singleFormId: entry.firstFormId, locationCount: entry.formIds.length }
      }))
      setUsedTemplates(list)
      setLoading(false)
    }
    load()
  }, [session])

  // A template with more than one location (Restaurant, Retail, ...) has no
  // single obvious "records" to jump into - route through the location
  // picker first (see TemplateLocations.jsx's ?goto=records handling)
  // instead of silently opening whichever location happened to load first.
  function openRecords({ template, singleFormId, locationCount }) {
    if (!template.bundle?.length && locationCount > 1) {
      navigate(`/templates/${template.slug}/locations?goto=records`)
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
          {usedTemplates.map(({ template, recordCount, singleFormId, locationCount }) => (
            <RecordsTile
              key={template.slug}
              template={template}
              recordCount={recordCount}
              onOpen={() => openRecords({ template, singleFormId, locationCount })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default RecordsHome
