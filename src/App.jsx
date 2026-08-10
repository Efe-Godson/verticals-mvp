import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import { isFirstVisit } from './firstVisit'
import { ToastProvider } from './Toast'
import { RecycleBinProvider } from './RecycleBinContext'
import Home from './Home'
import BusinessesHome from './BusinessesHome'
import TemplateLocations from './TemplateLocations'
import { TEMPLATE_ADMIN_USER_ID } from './adminAccount'
import Reports from './Reports'
import CreateForm from './CreateForm'
import EditForm from './EditForm'
import PublicForm from './PublicForm'
import Records from './Records'
import Report from './Report'
import AIAnalystPage from './AIAnalystPage'
import FormSettings from './FormSettings'
import AdminStaff from './AdminStaff'
import PayrollPage from './PayrollPage'
import PayrollDashboard from './PayrollDashboard'
import Login from './Login'
import SignUp from './SignUp'
import ConfirmEmail from './ConfirmEmail'
import ResetPassword from './ResetPassword'
import Templates from './Templates'
import AccountPage from './AccountPage'
import NavBar from './NavBar'

function PrivateRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="page">Loading...</div>
  if (!session) return <Navigate to={isFirstVisit() ? '/signup' : '/login'} replace />
  return children
}

// Staff accounts (see AdminStaff.jsx) only ever get Order Screen, Add
// Products, Records, and Reports for the one form they're assigned to -
// everything else in the app (Home, Settings, other forms, Admin itself)
// bounces them back to their order screen. staffFormId is undefined while
// AuthContext is still checking, so this only enforces once it's resolved.
// Report.jsx itself further caps what date range Reports shows them, see
// settings.staffReportRange.
function StaffScopedRoute({ children }) {
  const { staffFormId } = useAuth()
  const location = useLocation()
  if (staffFormId === undefined) return <div className="page">Loading...</div>
  if (!staffFormId) return children
  const allowed = new RegExp(`^/form/${staffFormId}(/edit|/records|/report)?/?$`).test(location.pathname)
  if (!allowed) return <Navigate to={`/form/${staffFormId}`} replace />
  return children
}

// The pre-templates app (full form list, generic "+ New Form" builder) is
// now "Lab" - kept around for the account that curates templates, not
// shown or reachable for anyone using the streamlined templates flow.
function AdminOnlyRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="page">Loading...</div>
  if (!session || session.user.id !== TEMPLATE_ADMIN_USER_ID) return <Navigate to="/" replace />
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
  const isPublicForm = /^\/form\/[^/]+(\/response\/[^/]+)?$/.test(location.pathname)
  const isLogin = location.pathname === '/login'
  const isSignUp = location.pathname === '/signup'
  const isConfirmEmail = location.pathname === '/confirm-email'
  const isResetPassword = location.pathname === '/reset-password'
  // Links opened from the POS side panel (Records/Settings/Add Products)
  // append this so those pages open on their own, without the app's nav -
  // a cashier jumping over to edit the menu shouldn't land in the full app shell.
  const isFocusMode = new URLSearchParams(location.search).get('focus') === '1'

  return (
    <>
      {!isPublicForm && !isLogin && !isSignUp && !isConfirmEmail && !isResetPassword && !isFocusMode && <NavBar />}
      <Routes>
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/signup" element={<PublicOnlyRoute><SignUp /></PublicOnlyRoute>} />
        <Route path="/confirm-email" element={<PublicOnlyRoute><ConfirmEmail /></PublicOnlyRoute>} />
        {/* No auth guard here: Supabase's reset link creates a temporary session
            on its own, and PublicOnlyRoute would incorrectly redirect it away. */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<PrivateRoute><StaffScopedRoute><BusinessesHome /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/lab" element={<PrivateRoute><StaffScopedRoute><AdminOnlyRoute><Home /></AdminOnlyRoute></StaffScopedRoute></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><StaffScopedRoute><Reports /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/templates" element={<PrivateRoute><StaffScopedRoute><Templates /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/templates/:slug/locations" element={<PrivateRoute><StaffScopedRoute><TemplateLocations /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/account" element={<PrivateRoute><StaffScopedRoute><AccountPage /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/create" element={<PrivateRoute><StaffScopedRoute><CreateForm /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id" element={<PublicForm />} />
        <Route path="/form/:id/response/:token" element={<PublicForm />} />
        <Route path="/form/:id/edit" element={<PrivateRoute><StaffScopedRoute><EditForm /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/records" element={<PrivateRoute><StaffScopedRoute><Records /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/report" element={<PrivateRoute><StaffScopedRoute><Report /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/ai-analyst" element={<PrivateRoute><StaffScopedRoute><AIAnalystPage /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/settings" element={<PrivateRoute><StaffScopedRoute><FormSettings /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/admin" element={<PrivateRoute><StaffScopedRoute><AdminStaff /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/payroll" element={<PrivateRoute><StaffScopedRoute><PayrollDashboard /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/payroll/payments" element={<PrivateRoute><StaffScopedRoute><PayrollPage /></StaffScopedRoute></PrivateRoute>} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RecycleBinProvider>
          <AppShell />
        </RecycleBinProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App