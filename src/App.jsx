import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import { isFirstVisit } from './firstVisit'
import { ToastProvider } from './Toast'
import { RecycleBinProvider } from './RecycleBinContext'
import { PageTitleProvider } from './PageTitleContext'
import Home from './Home'
import BusinessesHome from './BusinessesHome'
import TemplateLocations from './TemplateLocations'
import { TEMPLATE_ADMIN_USER_ID } from './adminAccount'
import Reports from './Reports'
import RecordsHome from './RecordsHome'
import CreateForm from './CreateForm'
import EditForm from './EditForm'
import PublicForm from './PublicForm'
import Records from './Records'
import Inventory from './Inventory'
import ShortLinkRedirect from './ShortLinkRedirect'
import Report from './Report'
import ReportBuilder from './ReportBuilder'
import AIAnalystPage from './AIAnalystPage'
import FormSettings from './FormSettings'
import AdminStaff from './AdminStaff'
import QuizHome from './QuizHome'
import CreateQuizRoom from './CreateQuizRoom'
import JoinQuizRoom from './JoinQuizRoom'
import QuizRoom from './QuizRoom'
import QuizAdminDashboard from './QuizAdminDashboard'
import QuizPointHistory from './QuizPointHistory'
import PayrollShell from './payroll/PayrollShell'
import PayrollOverview from './payroll/PayrollOverview'
import PayrollEmployees from './payroll/PayrollEmployees'
import PayrollEmployeeProfile from './payroll/PayrollEmployeeProfile'
import PayrollEntries from './payroll/PayrollEntries'
import PayrollMonthly from './payroll/PayrollMonthly'
import PayrollPayments from './payroll/PayrollPayments'
import PayrollSettings from './payroll/PayrollSettings'
import Login from './Login'
import SignUp from './SignUp'
import ConfirmEmail from './ConfirmEmail'
import ResetPassword from './ResetPassword'
import Templates from './Templates'
import AccountPage from './AccountPage'
import NavBar from './NavBar'
import DarkModeToggle from './DarkModeToggle'
import { LoadingState } from './LoadingState'
import OfflineBanner from './OfflineBanner'

function PrivateRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingState />
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
  if (staffFormId === undefined) return <LoadingState />
  if (!staffFormId) return children
  const allowed = new RegExp(`^/form/${staffFormId}(/edit|/records|/report|/inventory)?/?$`).test(location.pathname)
  if (!allowed) return <Navigate to={`/form/${staffFormId}`} replace />
  return children
}

// The pre-templates app (full form list, generic "+ New Form" builder) is
// now "Lab" - kept around for the account that curates templates, not
// shown or reachable for anyone using the streamlined templates flow.
function AdminOnlyRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingState />
  if (!session || session.user.id !== TEMPLATE_ADMIN_USER_ID) return <Navigate to="/" replace />
  return children
}

function PublicOnlyRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingState />
  if (session) return <Navigate to="/" replace />
  return children
}

function AppShell() {
  const location = useLocation()
  const isPublicForm = /^\/form\/[^/]+(\/response\/[^/]+)?$/.test(location.pathname)
  // /s/:code (see ShortLinkRedirect.jsx) is just a brief hop through to the
  // above before the real /form/:id replaces it in history - same reason to
  // skip the app shell here as isPublicForm itself.
  const isShortLink = /^\/s\/[^/]+$/.test(location.pathname)
  // Anonymous quiz players (no Verticals account, see quizIdentity.js) land
  // straight on these two pages from a shared room link/code - same reason
  // isPublicForm hides the app shell for form respondents below.
  const isQuizPlayer = /^\/lab\/quiz\/(join|room\/[^/]+\/play)/.test(location.pathname)
  const isLogin = location.pathname === '/login'
  const isSignUp = location.pathname === '/signup'
  const isConfirmEmail = location.pathname === '/confirm-email'
  const isResetPassword = location.pathname === '/reset-password'
  // Links opened from the POS side panel (Records/Settings/Add Products)
  // append this so those pages open on their own, without the app's nav -
  // a cashier jumping over to edit the menu shouldn't land in the full app shell.
  const isFocusMode = new URLSearchParams(location.search).get('focus') === '1'
  const showNavBar = !isPublicForm && !isShortLink && !isQuizPlayer && !isLogin && !isSignUp && !isConfirmEmail && !isResetPassword && !isFocusMode

  return (
    <>
      <OfflineBanner />
      {showNavBar && <NavBar />}
      {showNavBar && <DarkModeToggle />}
      {/* Only pages with NavBar get its fixed navbar-bottom-bar on mobile,
          so only they need the matching bottom padding reserved (see the
          .app-content-under-navbar rule in index.css) - a focus-mode/public
          form page has no such bar and would just get pointless empty
          space at the bottom otherwise. */}
      <div className={showNavBar ? 'app-content-under-navbar' : undefined}>
      <Routes>
        <Route path="/s/:code" element={<ShortLinkRedirect />} />
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/signup" element={<PublicOnlyRoute><SignUp /></PublicOnlyRoute>} />
        <Route path="/confirm-email" element={<PublicOnlyRoute><ConfirmEmail /></PublicOnlyRoute>} />
        {/* No auth guard here: Supabase's reset link creates a temporary session
            on its own, and PublicOnlyRoute would incorrectly redirect it away. */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<PrivateRoute><StaffScopedRoute><BusinessesHome /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/lab" element={<PrivateRoute><StaffScopedRoute><AdminOnlyRoute><Home /></AdminOnlyRoute></StaffScopedRoute></PrivateRoute>} />
        {/* Quiz: real-time multiplayer AI quiz game. Hosting (create/admin/
            history) stays Lab-only - still an admin-curated MVP tool, same
            as the rest of /lab. Joining and playing are deliberately NOT
            gated: players have no Verticals account at all (see
            quizIdentity.js), so requiring a login here would defeat the
            point of sharing a room code. The real access control for a
            room's data lives server-side (RLS + the quiz-* edge functions),
            not in this route guard - see the quiz_tables migration. */}
        <Route path="/lab/quiz" element={<PrivateRoute><StaffScopedRoute><AdminOnlyRoute><QuizHome /></AdminOnlyRoute></StaffScopedRoute></PrivateRoute>} />
        <Route path="/lab/quiz/create" element={<PrivateRoute><StaffScopedRoute><AdminOnlyRoute><CreateQuizRoom /></AdminOnlyRoute></StaffScopedRoute></PrivateRoute>} />
        <Route path="/lab/quiz/join" element={<JoinQuizRoom />} />
        <Route path="/lab/quiz/room/:roomId/play" element={<QuizRoom />} />
        <Route path="/lab/quiz/room/:roomId/admin" element={<PrivateRoute><StaffScopedRoute><AdminOnlyRoute><QuizAdminDashboard /></AdminOnlyRoute></StaffScopedRoute></PrivateRoute>} />
        <Route path="/lab/quiz/history" element={<PrivateRoute><StaffScopedRoute><AdminOnlyRoute><QuizPointHistory /></AdminOnlyRoute></StaffScopedRoute></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><StaffScopedRoute><Reports /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/records" element={<PrivateRoute><StaffScopedRoute><RecordsHome /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/templates" element={<PrivateRoute><StaffScopedRoute><Templates /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/templates/:slug/locations" element={<PrivateRoute><StaffScopedRoute><TemplateLocations /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/account" element={<PrivateRoute><StaffScopedRoute><AccountPage /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/create" element={<PrivateRoute><StaffScopedRoute><CreateForm /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id" element={<PublicForm />} />
        <Route path="/form/:id/response/:token" element={<PublicForm />} />
        <Route path="/form/:id/edit" element={<PrivateRoute><StaffScopedRoute><EditForm /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/records" element={<PrivateRoute><StaffScopedRoute><Records /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/inventory" element={<PrivateRoute><StaffScopedRoute><Inventory /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/report" element={<PrivateRoute><StaffScopedRoute><Report /></StaffScopedRoute></PrivateRoute>} />
        {/* Deliberately NOT added to StaffScopedRoute's allowed-paths regex above -
            staff navigating here directly get bounced back to their order screen,
            same as /settings and /admin do today, so this stays owner-only. */}
        <Route path="/form/:id/report/builder" element={<PrivateRoute><StaffScopedRoute><ReportBuilder /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/ai-analyst" element={<PrivateRoute><StaffScopedRoute><AIAnalystPage /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/settings" element={<PrivateRoute><StaffScopedRoute><FormSettings /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/admin" element={<PrivateRoute><StaffScopedRoute><AdminStaff /></StaffScopedRoute></PrivateRoute>} />
        {/* Payroll module (owner-only, same as /settings above - left out of
            StaffScopedRoute's allow-list on purpose). PayrollShell loads the
            anchor form once and shares it with every tab via <Outlet>. */}
        <Route path="/form/:id/payroll" element={<PrivateRoute><StaffScopedRoute><PayrollShell /></StaffScopedRoute></PrivateRoute>}>
          <Route index element={<PayrollOverview />} />
          <Route path="employees" element={<PayrollEmployees />} />
          <Route path="employees/:empId" element={<PayrollEmployeeProfile />} />
          <Route path="entries" element={<PayrollEntries />} />
          <Route path="monthly" element={<PayrollMonthly />} />
          <Route path="payments" element={<PayrollPayments />} />
          <Route path="settings" element={<PayrollSettings />} />
        </Route>
      </Routes>
      </div>
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RecycleBinProvider>
          <PageTitleProvider>
            <AppShell />
          </PageTitleProvider>
        </RecycleBinProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App