// Place at: src/lib/MarkdownContent.jsx
// Shared Markdown renderer for every Trust/Legal/Resources page AND the Lab
// editor's own Preview button, so what an admin previews is pixel-identical
// to what ships live - no separate rendering paths to drift apart. Renders
// into plain semantic tags styled by .mkt-prose (src/marketing/marketing.css)
// rather than its own parallel style system. No rehype-raw - raw HTML in
// pasted content is never executed, just shown as literal text.
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const components = {
  table: ({ children }) => (
    <div className="mkt-table-wrap"><table>{children}</table></div>
  ),
  a: ({ href, children }) => (
    <a href={href} target={href?.startsWith('/') ? undefined : '_blank'} rel={href?.startsWith('/') ? undefined : 'noopener noreferrer'}>
      {children}
    </a>
  ),
}

export default function MarkdownContent({ content, className }) {
  if (!content) return null
  return (
    <div className={['mkt-prose', className].filter(Boolean).join(' ')}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
