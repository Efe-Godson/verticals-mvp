// One tile per template you've actually put to use (mirrors Reports.jsx/
// BusinessesHome.jsx), except clicking a tile jumps straight into that
// business's records instead of its report/Manage page - this page exists
// purely as the landing spot for the mobile bottom nav's "Records" tab
// when there's no form already in context (see MobileBottomNav.jsx).
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { categoryColor, CategoryIcon } from './templateVisuals'
import { usePageTitle } from './PageTitleContext'

function RecordsTile({ template, locationCount, onOpen }) {
  const color = categoryColor(template.category)
  return (
    <div
      className="template-tile"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      style={{
        position: 'relative', aspectRatio: '1', border: '1px solid var(--color-border)', borderRadius: '12px',
        background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '0.4rem', padding: '0.9rem', textAlign: 'center', cursor: 'pointer'
      }}
    >
      <div style={{
        width: '44px', height: '44px', borderRadius: '10px', background: `${color}16`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <CategoryIcon category={template.category} color={color} />
      </div>
      <span style={{
        fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.25,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
      }}>
        {template.name}
      </span>
      {locationCount > 0 && (
        <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
          {locationCount} location{locationCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

function RecordsHome() {
  const { session } = useAuth()
  const navigate = useNavigate()
  usePageTitle('Records')

  const [usedTemplates, setUsedTemplates] = useState([]) // [{ template, locationCount, singleFormId }]
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

  function openRecords({ singleFormId }) {
    navigate(`/form/${singleFormId}/records`)
  }

  return (
    <div className="page" style={{ maxWidth: '860px' }}>
      <style>{`
        .template-tile { transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease; }
        .template-tile:hover { border-color: var(--color-primary); box-shadow: 0 4px 14px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .template-tile:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      `}</style>

      <h1 style={{ margin: 0 }}>Records</h1>
      <p style={{ color: 'var(--color-muted)', marginTop: '0.3rem', marginBottom: '1.5rem' }}>
        Pick a business to jump straight into its records.
      </p>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.8rem' }}>
          {[0, 1, 2].map(i => <div key={i} className="card" style={{ aspectRatio: '1' }} />)}
        </div>
      ) : usedTemplates.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          <p style={{ margin: '0 0 0.9rem' }}>Set up a business from a template to see its records here.</p>
          <Link to="/templates"><button>Browse Templates</button></Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.8rem' }}>
          {usedTemplates.map(({ template, locationCount, singleFormId }) => (
            <RecordsTile
              key={template.slug}
              template={template}
              locationCount={template.bundle?.length > 0 ? 0 : locationCount}
              onOpen={() => openRecords({ singleFormId })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default RecordsHome
