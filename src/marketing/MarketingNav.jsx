import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

const LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export default function MarketingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 8) }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    function onKey(e) { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <>
      <nav className={`mkt-nav${scrolled ? ' is-scrolled' : ''}`}>
        <div className="mkt-container mkt-nav-inner">
          <Link to="/" className="mkt-logo">
            VerticalS
          </Link>
          <ul className="mkt-nav-links">
            {LINKS.map(l => (
              <li key={l.href}><a href={l.href}>{l.label}</a></li>
            ))}
          </ul>
          <div className="mkt-nav-auth">
            <Link to="/login" className="mkt-nav-signin">Sign in</Link>
            <Link to="/signup" className="mkt-btn mkt-btn--secondary">Sign up</Link>
            <Link to="/onboarding" className="mkt-btn">Try free demo</Link>
          </div>
          <button
            type="button"
            className="mkt-nav-burger"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="mkt-mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mkt-mobile-menu-top">
            <Link to="/" className="mkt-logo" onClick={() => setMenuOpen(false)}>
              VerticalS
            </Link>
            <button
              type="button"
              className="mkt-mobile-menu-close"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <ul className="mkt-mobile-menu-links">
            {LINKS.map(l => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</a>
              </li>
            ))}
          </ul>
          <div className="mkt-mobile-menu-actions">
            <Link to="/login" className="mkt-btn mkt-btn--ghost mkt-btn--block" onClick={() => setMenuOpen(false)}>
              Sign in
            </Link>
            <Link to="/signup" className="mkt-btn mkt-btn--secondary mkt-btn--block" onClick={() => setMenuOpen(false)}>
              Sign up
            </Link>
            <Link to="/onboarding" className="mkt-btn mkt-btn--block" onClick={() => setMenuOpen(false)}>
              Try free demo
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
