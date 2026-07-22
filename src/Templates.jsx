import { Link } from 'react-router-dom'

const templates = [
  {
    slug: 'retail',
    title: 'Retail',
    eyebrow: 'Sales & customer feedback',
    description: 'Capture product feedback, order requests, return reasons, and customer satisfaction in a polished experience.',
    highlights: ['Product feedback', 'Order follow-up', 'Store experience'],
    cta: 'Start Retail template',
  },
  {
    slug: 'restaurant',
    title: 'Restaurant',
    eyebrow: 'Dining & service experience',
    description: 'Collect table feedback, delivery requests, menu preferences, and staff performance insights with ease.',
    highlights: ['Service feedback', 'Order preferences', 'Guest experience'],
    cta: 'Start Restaurant template',
  },
  {
    slug: 'school',
    title: 'School',
    eyebrow: 'Admin & student engagement',
    description: 'Streamline attendance, parent communication, event signups, and student feedback for everyday operations.',
    highlights: ['Student feedback', 'Event signup', 'Parent forms'],
    cta: 'Start School template',
  },
]

function Templates() {
  return (
    <div className="page" style={{ maxWidth: '1080px' }}>
      <div className="card" style={{ padding: '1.4rem 1.5rem', marginBottom: '1.2rem', background: 'linear-gradient(135deg, #f9fbff 0%, #f3f7ff 100%)' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Templates
        </div>
        <h1 style={{ margin: '0.35rem 0 0.55rem', fontSize: '1.8rem' }}>Start faster with ready-made form ideas</h1>
        <p style={{ margin: 0, color: 'var(--color-muted)', maxWidth: '720px', lineHeight: 1.6 }}>
          Pick a starting point for your business or organization and launch a polished form in minutes.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {templates.map((template) => (
          <div key={template.slug} className="card" style={{ padding: '1.2rem 1.2rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {template.eyebrow}
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{template.title}</div>
            <div style={{ color: 'var(--color-muted)', lineHeight: 1.55, fontSize: '0.94rem' }}>
              {template.description}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {template.highlights.map((item) => (
                <span key={item} style={{ border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.28rem 0.6rem', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                  {item}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: 'auto', flexWrap: 'wrap' }}>
              <Link to="/create">
                <button>{template.cta}</button>
              </Link>
              <Link to="/">
                <button className="secondary">View forms</button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '1.2rem', padding: '1.2rem 1.25rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Why templates help
        </div>
        <div style={{ display: 'grid', gap: '0.8rem', marginTop: '0.8rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div style={{ background: '#f8fbff', border: '1px solid #eef3fa', borderRadius: '0.8rem', padding: '0.9rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Launch quickly</div>
            <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Use a strong starting point instead of building from a blank page.</div>
          </div>
          <div style={{ background: '#f8fbff', border: '1px solid #eef3fa', borderRadius: '0.8rem', padding: '0.9rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Stay consistent</div>
            <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Keep your forms structured and easy for teams to reuse.</div>
          </div>
          <div style={{ background: '#f8fbff', border: '1px solid #eef3fa', borderRadius: '0.8rem', padding: '0.9rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Collect better data</div>
            <div style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Each template is designed around common business and school use cases.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Templates
