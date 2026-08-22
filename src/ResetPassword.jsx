import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import PasswordInput from './PasswordInput'

function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setMessage(error.message)
    } else {
      setDone(true)
      setTimeout(() => navigate('/'), 1200)
    }
  }

  if (done) {
    return (
      <div className="page" style={{ maxWidth: '380px' }}>
        <h1>Password updated</h1>
        <p style={{ color: '#1a7f37', marginTop: '1rem' }}>
          Your password has been changed. Taking you to your forms…
        </p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: '380px' }}>
      <h1>Set a new password</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
        <div>
          <label>New Password</label><br />
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Confirm Password</label><br />
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>

      {message && <p style={{ marginTop: '1rem', color: '#c0392b' }}>{message}</p>}
    </div>
  )
}

export default ResetPassword
