import VerticalsLogo from '../components/VerticalsLogo'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { to: '/forms', label: 'Forms' },
      { to: '/product/records', label: 'Records' },
      { to: '/product/reports', label: 'Reports' },
      { to: '/template-gallery', label: 'Templates' },
      { to: '/onboarding', label: 'Free Demo' },
    ],
  },
  {
    heading: 'Use Cases',
    links: [
      { to: '/sales-tracking', label: 'Sales Tracking' },
      { to: '/expense-tracking', label: 'Expense Tracking' },
      { to: '/inventory-management', label: 'Inventory' },
      { to: '/payroll', label: 'Payroll' },
      { to: '/for-restaurants', label: 'Restaurants' },
      { to: '/for-retail', label: 'Retail' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { to: '/resources', label: 'Resources' },
      { to: '/trust', label: 'Trust Center' },
      { to: '/security', label: 'Security' },
      { to: '/privacy', label: 'Privacy' },
      { to: '/terms', label: 'Terms' },
    ],
  },
]

// Mobile-only grouping (brief section 1): "Resources" collapses down to
// just the blog link, while everything legal/trust-related (desktop keeps
// these folded into the Resources column above, plus the bottom bar) gets
// its own "Trust & Legal" group instead.
const MOBILE_GROUPS = [
  COLUMNS[0],
  COLUMNS[1],
  { heading: 'Resources', links: [{ to: '/resources', label: 'Resources' }] },
  {
    heading: 'Trust & Legal',
    links: [
      { to: '/trust', label: 'Trust Center' },
      { to: '/security', label: 'Security' },
      { to: '/privacy', label: 'Privacy' },
      { to: '/terms', label: 'Terms' },
      { to: '/cookies', label: 'Cookies' },
      { to: '/subprocessors', label: 'Subprocessors' },
    ],
  },
]

export default function MarketingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mkt-footer">
      <div className="mkt-container">
        <div className="mkt-footer-inner">
          <div className="mkt-footer-cta">
            <div className="mkt-hero-cta-row">
              <Link to="/onboarding" className="mkt-btn mkt-btn--lg mkt-hero-primary-cta">Try a free demo</Link>
            </div>
            <div className="mkt-hero-secondary-actions">
              <Link to="/signup" className="mkt-nav-signin">Sign up</Link>
              <Link to="/login" className="mkt-nav-signin">Sign in</Link>
            </div>
          </div>
        </div>

        {/* Plain, explicit statement of what the product does - so it's
            extractable as fact by search/AI systems, and (brief section 1)
            what a mobile visitor sees first, before the collapsible groups. */}
        <p className="mkt-footer-description">
          Verticals is a web-based platform for collecting records, managing workflows and
          generating reports. Businesses use it to track things like sales, expenses,
          inventory and staff payments, and individuals use it for anything else worth
          tracking and understanding over time.
        </p>

        {/* Desktop: 4 labeled columns (Verticals/Product/Use Cases/Resources). */}
        <div className="mkt-footer-columns">
          <div className="mkt-footer-column mkt-footer-column--brand">
            <Link to="/" className="mkt-footer-column-heading" aria-label="Verticals home"><VerticalsLogo height={26} /></Link>
            <p className="mkt-footer-tagline">Capture. Understand. Act.</p>
            <p className="mkt-footer-brand-desc">
              Collect records, manage workflows and understand what your data is telling you.
            </p>
            <a href="mailto:hello@verticalsapp.com" className="mkt-footer-email">hello@verticalsapp.com</a>
          </div>
          {COLUMNS.map(col => (
            <div key={col.heading} className="mkt-footer-column">
              <span className="mkt-footer-column-heading">{col.heading}</span>
              <ul className="mkt-footer-column-links">
                {col.links.map(l => (
                  <li key={l.to}><Link to={l.to}>{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Mobile: description above already showed, then collapsible groups. */}
        <div className="mkt-footer-groups">
          {MOBILE_GROUPS.map(group => (
            <details key={group.heading} className="mkt-footer-group">
              <summary>
                {group.heading}
                <Plus size={16} className="mkt-faq-icon" />
              </summary>
              <ul className="mkt-footer-column-links">
                {group.links.map(l => (
                  <li key={l.to}><Link to={l.to}>{l.label}</Link></li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        <div className="mkt-footer-bottom">
          <span>&copy; {year} Verticals</span>
          <nav className="mkt-footer-legal-links" aria-label="Legal">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/security" className="mkt-footer-legal-links-desktop-only">Security</Link>
            <Link to="/cookies">Cookies</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
