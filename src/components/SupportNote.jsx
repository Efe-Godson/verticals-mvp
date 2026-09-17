// A quiet footnote, not a callout - opacity dims the border and link along
// with the text as one unit (rather than a separate rgba border colour),
// so it stays readable but recedes behind the real nav items regardless of
// which coloured sidebar/menu it's dropped into (see HomeSidePanel.jsx/
// NavBar.jsx, both green-on-white-text contexts).
export default function SupportNote() {
  return (
    <p style={{ margin: 'auto 0 0', padding: '0.5rem 0.6rem', border: '1px solid currentColor', borderRadius: 'var(--radius)', marginTop: 'auto', fontSize: '0.68rem', lineHeight: 1.5, opacity: 0.55 }}>
      Having any issues? Email us at{' '}
      <a href="mailto:support@verticalsapp.com" style={{ color: 'inherit', textDecoration: 'underline', overflowWrap: 'anywhere' }}>support@verticalsapp.com</a>.
    </p>
  )
}
