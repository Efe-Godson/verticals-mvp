// Small visible breadcrumb trail, shared by the marketing sub-pages - both
// the UI element and the backing BreadcrumbList JSON-LD (see
// buildBreadcrumbList in src/seo/structuredData.js) that each page passes to
// <SEO structuredData>. `current` is the current page's label; it isn't a
// link.
import { Link } from 'react-router-dom'

export default function PageBreadcrumb({ current }) {
  return (
    <nav className="mkt-breadcrumb" aria-label="Breadcrumb">
      <Link to="/">Home</Link>
      <span aria-hidden="true">/</span>
      <span className="mkt-breadcrumb-current">{current}</span>
    </nav>
  )
}
