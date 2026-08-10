// Place at: src/AccountPage.jsx
// Route: /account
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { useToast } from './Toast'
import StatTile from './report/components/StatTile'
import PieChart from './report/components/PieChart'
import HorizontalBarChart from './report/components/HorizontalBarChart'
import { THEME_COLORS, saveThemeColor } from './theme'

const STATUS_LABEL = { draft: 'Draft', published: 'Live', paused: 'Paused', archived: 'Archived' }

function Avatar({ label, size = 64 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: 'var(--color-primary)', color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, flexShrink: 0
    }}>
      {label}
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="card" style={{ padding: '1.4rem', marginBottom: '1.2rem' }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function AccountPage() {
  const { session } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const user = session.user
  const provider = user.app_metadata?.provider || 'email'
  const isEmailAccount = provider === 'email'
  const displayName = user.user_metadata?.full_name || ''
  const initials = (displayName || user.email || '?').trim().slice(0, 1).toUpperCase()

  const [nameInput, setNameInput] = useState(displayName)
  const [savingName, setSavingName] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [forms, setForms] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)

  const [themeColor, setThemeColor] = useState(THEME_COLORS[0].hex)

  useEffect(() => {
    supabase.from('account_settings').select('theme_color').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.theme_color) setThemeColor(data.theme_color) })
  }, [user.id])

  async function chooseThemeColor(hex) {
    setThemeColor(hex)
    const { error } = await saveThemeColor(supabase, user.id, hex)
    if (error) showToast('Could not save theme color: ' + error.message, 'error')
  }

  useEffect(() => {
    async function loadAnalytics() {
      setLoadingAnalytics(true)
      const { data: formsData } = await supabase
        .from('forms').select('id, name, status, created_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
      setForms(formsData || [])

      const formIds = (formsData || []).map(f => f.id)
      if (formIds.length > 0) {
        const { data: subsData } = await supabase
          .from('submissions').select('form_id, created_at')
          .in('form_id', formIds)
          .is('deleted_at', null)
        setSubmissions(subsData || [])
      }
      setLoadingAnalytics(false)
    }
    loadAnalytics()
  }, [user.id])

  const statusBreakdown = useMemo(() => {
    const counts = {}
    forms.forEach(f => { counts[f.status] = (counts[f.status] || 0) + 1 })
    return Object.entries(counts).map(([status, count]) => ({ label: STATUS_LABEL[status] || status, count }))
  }, [forms])

  const topForms = useMemo(() => {
    const counts = {}
    submissions.forEach(s => { counts[s.form_id] = (counts[s.form_id] || 0) + 1 })
    return forms
      .map(f => ({ label: f.name, count: counts[f.id] || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [forms, submissions])

  const monthlyTrend = useMemo(() => {
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-GB', { month: 'short' }) })
    }
    const counts = {}
    submissions.forEach(s => {
      const key = s.created_at?.slice(0, 7)
      if (key) counts[key] = (counts[key] || 0) + 1
    })
    return months.map(m => ({ label: m.label, count: counts[m.key] || 0 }))
  }, [submissions])

  async function handleSaveName() {
    setSavingName(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: nameInput.trim() } })
    setSavingName(false)
    if (error) {
      showToast('Could not update name: ' + error.message, 'error')
      return
    }
    showToast('Name updated.', 'success')
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error')
      return
    }

    setSavingPassword(true)
    // Supabase's updateUser() doesn't require re-entering the current
    // password (the session itself is already the proof of identity), but
    // verifying it first catches "someone left this browser logged in"
    // before letting a password change through silently.
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
    if (verifyError) {
      setSavingPassword(false)
      showToast('Current password is incorrect.', 'error')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      showToast('Could not change password: ' + error.message, 'error')
      return
    }
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    showToast('Password changed.', 'success')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const totalSubmissions = submissions.length
  const publishedCount = forms.filter(f => f.status === 'published').length

  return (
    <div className="page" style={{ maxWidth: '760px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Avatar label={initials} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', overflowWrap: 'break-word' }}>{displayName || user.email}</h1>
          <div style={{ color: 'var(--color-muted)', fontSize: '0.88rem', overflowWrap: 'break-word' }}>
            {user.email} · Member since {new Date(user.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
          </div>
          <span style={{
            display: 'inline-block', marginTop: '0.4rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.04em', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.15rem 0.6rem'
          }}>
            Signed in with {provider === 'google' ? 'Google' : 'Email'}
          </span>
        </div>
      </div>

      <SectionCard title="Profile">
        <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Display name</label>
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.3rem' }}>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your name"
            style={{ flex: 1, padding: '0.5rem' }}
          />
          <button onClick={handleSaveName} disabled={savingName || nameInput.trim() === displayName}>
            {savingName ? 'Saving…' : 'Save'}
          </button>
        </div>
      </SectionCard>

      {isEmailAccount && (
        <SectionCard title="Security">
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', maxWidth: '340px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Current password</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>New password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Confirm new password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.3rem' }} />
            </div>
            <button type="submit" disabled={savingPassword} style={{ alignSelf: 'flex-start' }}>
              {savingPassword ? 'Changing…' : 'Change Password'}
            </button>
          </form>
        </SectionCard>
      )}

      <SectionCard title="Appearance">
        <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.8rem' }}>
          Theme color - applies everywhere the app uses its accent color, including the softer tinted cards and highlights.
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {THEME_COLORS.map(({ name, hex }) => (
            <button
              key={hex}
              type="button"
              onClick={() => chooseThemeColor(hex)}
              title={name}
              aria-label={`Use ${name} as the theme color`}
              aria-pressed={themeColor === hex}
              style={{
                width: '34px', height: '34px', padding: 0, borderRadius: '50%',
                background: hex, border: themeColor === hex ? '3px solid var(--color-text)' : '1px solid var(--color-border)',
                boxShadow: themeColor === hex ? '0 0 0 2px var(--color-surface)' : 'none',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Your Analytics">
        {loadingAnalytics ? (
          <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
        ) : forms.length === 0 ? (
          <p style={{ color: 'var(--color-muted)' }}>Create your first form to start seeing usage stats here.</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
              <StatTile label="Total Forms" value={forms.length} />
              <StatTile label="Published" value={publishedCount} />
              <StatTile label="Total Submissions" value={totalSubmissions.toLocaleString()} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>Forms by status</div>
                {statusBreakdown.length > 0
                  ? <PieChart size={130} data={statusBreakdown} />
                  : <p style={{ color: '#999', fontSize: '0.85rem' }}>No forms yet.</p>}
              </div>
              <div>
                <HorizontalBarChart title="Submissions, last 6 months" data={monthlyTrend} bare />
              </div>
            </div>

            {topForms.some(f => f.count > 0) && (
              <div style={{ marginTop: '1.2rem' }}>
                <HorizontalBarChart title="Most active forms" data={topForms} bare />
              </div>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="Account">
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="secondary" onClick={handleLogout}>Log out</button>
          <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)' }}>
            Need to delete your account? Contact support - this isn't self-serve since it permanently removes all your forms and records.
          </span>
        </div>
      </SectionCard>
    </div>
  )
}

export default AccountPage
