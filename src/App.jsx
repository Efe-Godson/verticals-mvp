import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Home from './Home'
import CreateForm from './CreateForm'
import EditForm from './EditForm'
import PublicForm from './PublicForm'
import Records from './Records'
import Report from './Report'
import AIAnalystPage from './AIAnalystPage'
import FormSettings from './FormSettings'
import Login from './Login'
import SignUp from './SignUp'
import ConfirmEmail from './ConfirmEmail'
import ResetPassword from './ResetPassword'
import Templates from './Templates'
import NavBar from './NavBar'

function PrivateRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="page">Loading...</div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

function PublicOnlyRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="page">Loading...</div>
  if (session) return <Navigate to="/" replace />
  return children
}

function AppShell() {
  const location = useLocation()
  const isPublicForm = /^\/form\/[^/]+$/.test(location.pathname)
  const isLogin = location.pathname === '/login'
  const isSignUp = location.pathname === '/signup'
  const isConfirmEmail = location.pathname === '/confirm-email'
  const isResetPassword = location.pathname === '/reset-password'

  return (
    <>
      {!isPublicForm && !isLogin && !isSignUp && !isConfirmEmail && !isResetPassword && <NavBar />}
      <Routes>
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/signup" element={<PublicOnlyRoute><SignUp /></PublicOnlyRoute>} />
        <Route path="/confirm-email" element={<PublicOnlyRoute><ConfirmEmail /></PublicOnlyRoute>} />
        {/* No auth guard here — Supabase's reset link creates a temporary session
            on its own, and PublicOnlyRoute would incorrectly redirect it away. */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/templates" element={<PrivateRoute><Templates /></PrivateRoute>} />
        <Route path="/create" element={<PrivateRoute><CreateForm /></PrivateRoute>} />
        <Route path="/form/:id" element={<PublicForm />} />
        <Route path="/form/:id/edit" element={<PrivateRoute><EditForm /></PrivateRoute>} />
        <Route path="/form/:id/records" element={<PrivateRoute><Records /></PrivateRoute>} />
        <Route path="/form/:id/report" element={<PrivateRoute><Report /></PrivateRoute>} />
        <Route path="/form/:id/ai-analyst" element={<PrivateRoute><AIAnalystPage /></PrivateRoute>} />
        <Route path="/form/:id/settings" element={<PrivateRoute><FormSettings /></PrivateRoute>} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App