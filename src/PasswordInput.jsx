// Place at: src/PasswordInput.jsx
// Password field with a show/hide toggle - used by Login.jsx, SignUp.jsx,
// and ResetPassword.jsx so typos are actually checkable before submitting,
// instead of every screen needing its own copy of the same eye-icon button.
import { useState } from 'react'

function EyeIcon({ open, size = 18 }) {
  return open ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.9 19.9 0 0 1 4.22-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a19.86 19.86 0 0 1-3.11 4.55M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function PasswordInput({ value, onChange, required, style, ...rest }) {
  const [visible, setVisible] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required={required}
        style={{ width: '100%', paddingRight: '2.3rem' }}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
          background: 'transparent', border: 'none', padding: '0.15rem', cursor: 'pointer',
          color: 'var(--color-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  )
}

export default PasswordInput
