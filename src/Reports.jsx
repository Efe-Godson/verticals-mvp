// One tile per template you've actually put to use (mirrors
// BusinessesHome.jsx), except clicking a tile jumps straight into that
// business's report instead of its Manage/locations page - this page
// exists purely as a fast way into reports, nothing else.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { categoryColor, CategoryIcon } from './templateVisuals'
import { usePageTitle } from './PageTitleContext'

function ReportTile({ template, locationCount, onOpen }) {
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
      {locationCount > 0 && (
        <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
          {locationCount} location{locationCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

function Reports() {
  const { session } = useAuth()
  const navigate = useNavigate()
  usePageTitle('Reports')

  const [usedTemplates, setUsedTemplates] = useState([]) // [{ template, locationCount, singleFormId, isBundle }]
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

      const bySlug = {} // slug -> { count, firstFormId }
      ;(forms || []).forEach(f => {
        const slug = f.settings?.templateSlug
        if (!slug) return
        if (!bySlug[slug]) bySlug[slug] = { count: 0, firstFormId: f.id }
        bySlug[slug].count += 1
      })

      const slugs = Object.keys(bySlug)
      if (slugs.length === 0) {
        setUsedTemplates([])
        setLoading(false)
        return
      }

      const { data: templates } = await supabase.from('templates').select('*').in('slug', slugs)
      const list = (templates || []).map(template => ({
        template,
        locationCount: bySlug[template.slug].count,
        singleFormId: bySlug[template.slug].firstFormId,
      }))
      setUsedTemplates(list)
      setLoading(false)
    }
    load()
  }, [session])

  // A template with more than one location (Restaurant, Retail, ...) has no
  // single obvious "report" to jump into - route through the location
  // picker first (see TemplateLocations.jsx's ?goto=report handling)
  // instead of silently opening whichever location happened to load first.
  function openReport({ template, singleFormId, locationCount }) {
    if (!template.bundle?.length && locationCount > 1) {
      navigate(`/templates/${template.slug}/locations?goto=report`)
      return
    }
    navigate(`/form/${singleFormId}/report`)
  }

  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      <style>{`
        .template-tile { transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease; }
        .template-tile:hover { border-color: var(--color-primary); box-shadow: 0 4px 14px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .template-tile:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      `}</style>

      <p style={{ color: 'var(--color-muted)', margin: '0 0 1.5rem' }}>
        Choose a workflow to view its reports.
      </p>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.8rem' }}>
          {[0, 1, 2].map(i => <div key={i} className="card" style={{ minHeight: '150px' }} />)}
        </div>
      ) : usedTemplates.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          <p style={{ margin: '0 0 0.9rem' }}>Set up a business from a template to see its report here.</p>
          <Link to="/templates"><button>Browse Templates</button></Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.8rem' }}>
          {usedTemplates.map(({ template, locationCount, singleFormId }) => (
            <ReportTile
              key={template.slug}
              template={template}
              locationCount={template.bundle?.length > 0 ? 0 : locationCount}
              onOpen={() => openReport({ template, singleFormId, locationCount })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Reports
