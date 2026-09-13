// JSON-LD builders, passed to <SEO structuredData={...}> (see SEO.jsx).
// Each function only describes things that are actually true/present -
// no Offer/pricing (the public pricing section shows no real numbers), no
// sameAs (no official social profiles exist yet), no fabricated review or
// rating data.
import { SITE_URL, SITE_NAME, absoluteUrl } from '../config/seo.js'

export function buildOrganization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/verticals-logo.png`,
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'hello@verticalsapp.com',
      contactType: 'customer support',
    },
  }
}

export function buildWebSite() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${SITE_URL}/`,
  }
}

export function buildSoftwareApplication() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'Verticals helps businesses and individuals collect records, manage workflows and turn their data into clear reports and insights.',
  }
}

// items: [{ name, path }], in order from Home. path is omitted on the last
// (current-page) item, matching how BreadcrumbList expects the final crumb.
export function buildBreadcrumbList(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.path ? { item: absoluteUrl(item.path) } : {}),
    })),
  }
}

// qaPairs: [{ q, a }] - only use this for a real, visible Q&A block on the
// page (see the brief's warning against FAQ spam / schema added just
// because the type exists).
export function buildFAQPage(qaPairs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qaPairs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  }
}

// Not used yet - no /resources/:slug articles have been written (see the
// /resources index page, which deliberately doesn't link to any yet rather
// than publish placeholder content). Ready for whenever the first real
// article is added: pass real values only, never a fabricated
// datePublished - see the brief's explicit warning against inventing dates.
export function buildArticle({ headline, description, path, datePublished, dateModified, image, authorName = SITE_NAME }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    url: absoluteUrl(path),
    datePublished,
    dateModified: dateModified || datePublished,
    author: { '@type': 'Organization', name: authorName },
    ...(image ? { image } : {}),
  }
}
