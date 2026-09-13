// Reusable per-page metadata component (see the SEO Implementation plan,
// brief section 2). Renders <title>/<meta>/<link> directly in the component
// tree - React 19 automatically hoists these into <head> no matter where
// they're rendered, on both the client and during server rendering
// (scripts/entry-server.jsx), so no head-management library is needed.
//
// structuredData accepts one JSON-LD object or an array of them - each gets
// its own <script type="application/ld+json">. Inline scripts like this
// aren't hoisted by React 19 (only <script src="...">, async ones are), but
// that's fine: JSON-LD is valid anywhere in the document, search engines
// don't require it inside <head>.
import { SITE_NAME, DEFAULT_OG_IMAGE, absoluteUrl } from '../config/seo'

export default function SEO({
  title,
  description,
  canonical,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  noindex = false,
  structuredData,
}) {
  const url = canonical ? absoluteUrl(canonical) : undefined
  const schemas = !structuredData ? [] : Array.isArray(structuredData) ? structuredData : [structuredData]

  return (
    <>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      <meta name="robots" content={noindex ? 'noindex, follow' : 'index, follow'} />
      {url && <link rel="canonical" href={url} />}

      <meta property="og:site_name" content={SITE_NAME} />
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      {url && <meta property="og:url" content={url} />}
      <meta property="og:type" content={type} />
      {image && <meta property="og:image" content={image} />}

      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}

      {schemas.map((schema, i) => (
        <script
          key={schema['@type'] ? `${schema['@type']}-${i}` : i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  )
}
