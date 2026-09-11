import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import { isFirstVisit } from './firstVisit'
import { ToastProvider } from './Toast'
import { RecycleBinProvider } from './RecycleBinContext'
import { PageTitleProvider } from './PageTitleContext'
import { TEMPLATE_ADMIN_USER_ID } from './adminAccount'
import ErrorBoundary from './ErrorBoundary'
import NavBar from './NavBar'
import PosSidePanel from './PosSidePanel'
import DarkModeToggle from './DarkModeToggle'
import { LoadingState } from './LoadingState'
import OfflineBanner from './OfflineBanner'

// Every route's own page component is lazy-loaded instead of imported
// up front - previously all of them (Payroll's calculators, the Quiz game
// engine, the Report Builder's drag-and-drop workspace, every Lab/admin
// page, ...) landed in one single ~3.3MB (~930KB gzipped) bundle that had
// to download and parse before *anything* could render, on every fresh
// visit or reload - the concrete cause behind "some things take forever".
// Splitting per route means a fresh visitor only ever pays for the pages
// they actually open; NavBar/PosSidePanel/DarkModeToggle/OfflineBanner/
// ErrorBoundary/LoadingState above stay eager since they're app-shell
// chrome mounted outside <Routes>, not routed pages.
const Home = lazy(() => import('./Home'))
const BusinessesHome = lazy(() => import('./BusinessesHome'))
const TemplateLocations = lazy(() => import('./TemplateLocations'))
const FormsTemplateHome = lazy(() => import('./FormsTemplateHome'))
const Reports = lazy(() => import('./Reports'))
const RecordsHome = lazy(() => import('./RecordsHome'))
const CreateForm = lazy(() => import('./CreateForm'))
const EditForm = lazy(() => import('./EditForm'))
const PublicForm = lazy(() => import('./PublicForm'))
const Records = lazy(() => import('./Records'))
const Inventory = lazy(() => import('./Inventory'))
const ShortLinkRedirect = lazy(() => import('./ShortLinkRedirect'))
const Report = lazy(() => import('./Report'))
const ReportBuilderWorkspace = lazy(() => import('./report/builder/ReportBuilderWorkspace'))
const AIAnalystPage = lazy(() => import('./AIAnalystPage'))
const FormSettings = lazy(() => import('./FormSettings'))
const AdminStaff = lazy(() => import('./AdminStaff'))
const QuizHome = lazy(() => import('./QuizHome'))
const CreateQuizRoom = lazy(() => import('./CreateQuizRoom'))
const JoinQuizRoom = lazy(() => import('./JoinQuizRoom'))
const QuizRoom = lazy(() => import('./QuizRoom'))
const QuizAdminDashboard = lazy(() => import('./QuizAdminDashboard'))
const QuizPointHistory = lazy(() => import('./QuizPointHistory'))
const AlertsPage = lazy(() => import('./AlertsPage'))
const EmailMonitorPage = lazy(() => import('./EmailMonitorPage'))
const OnboardingPrototype = lazy(() => import('./lab/onboarding/OnboardingPrototype'))
const DemoSetupPage = lazy(() => import('./lab/DemoSetupPage'))
const DemoDataManagerPage = lazy(() => import('./lab/DemoDataManagerPage'))
const PublicDemoShell = lazy(() => import('./PublicDemoExperience'))
const PublicDemoHome = lazy(() => import('./PublicDemoExperience').then(m => ({ default: m.PublicDemoHome })))
const PublicDemoRecords = lazy(() => import('./PublicDemoExperience').then(m => ({ default: m.PublicDemoRecords })))
const PublicDemoReport = lazy(() => import('./PublicDemoExperience').then(m => ({ default: m.PublicDemoReport })))
const OnboardingPage = lazy(() => import('./onboarding/OnboardingPage'))
const PayrollShell = lazy(() => import('./payroll/PayrollShell'))
const PayrollEmployees = lazy(() => import('./payroll/PayrollEmployees'))
const PayrollEmployeeProfile = lazy(() => import('./payroll/PayrollEmployeeProfile'))
const PayrollEntries = lazy(() => import('./payroll/PayrollEntries'))
const PayrollMonthly = lazy(() => import('./payroll/PayrollMonthly'))
const ExpenseShell = lazy(() => import('./expenses/ExpenseShell'))
const ExpenseOverview = lazy(() => import('./expenses/ExpenseOverview'))
const Login = lazy(() => import('./Login'))
const SignUp = lazy(() => import('./SignUp'))
const ConfirmEmail = lazy(() => import('./ConfirmEmail'))
const ResetPassword = lazy(() => import('./ResetPassword'))
const Templates = lazy(() => import('./Templates'))
const AccountPage = lazy(() => import('./AccountPage'))

function PrivateRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingState />
  // First time here -> the onboarding flow (it hands off to Sign Up at the
  // end). Been here before -> straight to Login.
  if (!session) return <Navigate to={isFirstVisit() ? '/onboarding' : '/login'} replace />
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
  const isOnboarding = location.pathname === '/onboarding'
  const isConfirmEmail = location.pathname === '/confirm-email'
  const isResetPassword = location.pathname === '/reset-password'
  // Links opened from the POS side panel (Records/Settings/Add Products)
  // append this so those pages open on their own, without the app's nav -
  // a cashier jumping over to edit the menu shouldn't land in the full app shell.
  const isFocusMode = new URLSearchParams(location.search).get('focus') === '1'
  // The Report Builder is a contained full-screen workspace with its own
  // chrome (see report/builder/ReportBuilderWorkspace.jsx) - no app NavBar.
  const isReportBuilder = /^\/form\/[^/]+\/report\/builder\/?$/.test(location.pathname)
  // A read-only report shared to an outside email (see FormSettings.jsx's
  // "Share the report") - no app nav, no side panel, just the report.
  const isSharedReport = /^\/form\/[^/]+\/report\/?$/.test(location.pathname) &&
    new URLSearchParams(location.search).get('shared') === '1'
  // Payroll is a contained environment with its own slide-out nav + back
  // button (see payroll/PayrollSidePanel.jsx), like the POS focus flow.
  const isPayrollEnv = /^\/form\/[^/]+\/payroll(\/|$)/.test(location.pathname)
  // Expenses books (src/expenses/) are the same kind of contained environment,
  // navigated via PosSidePanel's expense links - no app NavBar.
  const isExpenseEnv = /^\/form\/[^/]+\/expenses(\/|$)/.test(location.pathname)
  // /demo is a public, contained environment with its own top bar + Home/
  // Records/Report tabs (see src/PublicDemoExperience.jsx) - no app NavBar,
  // same reasoning as isPublicForm above.
  const isPublicDemo = location.pathname.startsWith('/demo')
  const showNavBar = !isPublicForm && !isShortLink && !isQuizPlayer && !isLogin && !isSignUp && !isOnboarding && !isConfirmEmail && !isResetPassword && !isFocusMode && !isReportBuilder && !isPayrollEnv && !isExpenseEnv && !isSharedReport && !isPublicDemo

  // The POS side panel is mounted here (not inside each focus-mode page) so
  // it stays put across navigation between Records / Reports / Settings /
  // etc. instead of unmounting and re-fetching every time. The public order
  // screen (PublicForm) keeps its own instance - it needs bottomBarPresent.
  const focusFormMatch = location.pathname.match(/^\/form\/([^/]+)/)
  const posPanelFormId = isFocusMode && !isReportBuilder && !isPayrollEnv && focusFormMatch
    ? focusFormMatch[1]
    : null

  return (
    <>
      <OfflineBanner />
      {showNavBar && <NavBar />}
      {showNavBar && <DarkModeToggle />}
      {posPanelFormId && <PosSidePanel formId={posPanelFormId} />}
      {/* Only pages with NavBar get its fixed navbar-bottom-bar on mobile,
          so only they need the matching bottom padding reserved (see the
          .app-content-under-navbar rule in index.css) - a focus-mode/public
          form page has no such bar and would just get pointless empty
          space at the bottom otherwise. */}
      <div className={[showNavBar && 'app-content-under-navbar', posPanelFormId && 'pos-flow'].filter(Boolean).join(' ') || undefined}>
      <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/s/:code" element={<ShortLinkRedirect />} />
        <Route path="/onboarding" element={<PublicOnlyRoute><OnboardingPage /></PublicOnlyRoute>} />
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
        <Route path="/lab/alerts" element={<PrivateRoute><StaffScopedRoute><AdminOnlyRoute><AlertsPage /></AdminOnlyRoute></StaffScopedRoute></PrivateRoute>} />
        <Route path="/lab/email-monitor" element={<PrivateRoute><StaffScopedRoute><AdminOnlyRoute><EmailMonitorPage /></AdminOnlyRoute></StaffScopedRoute></PrivateRoute>} />
        <Route path="/lab/onboarding" element={<PrivateRoute><StaffScopedRoute><AdminOnlyRoute><OnboardingPrototype /></AdminOnlyRoute></StaffScopedRoute></PrivateRoute>} />
        {/* Demo Setup / Demo Data supersede the old single-toggle "/lab/demo"
            page - see the Lab: Demo & Onboarding Controls plan. */}
        <Route path="/lab/demo-setup" element={<PrivateRoute><StaffScopedRoute><AdminOnlyRoute><DemoSetupPage /></AdminOnlyRoute></StaffScopedRoute></PrivateRoute>} />
        <Route path="/lab/demo-data" element={<PrivateRoute><StaffScopedRoute><AdminOnlyRoute><DemoDataManagerPage /></AdminOnlyRoute></StaffScopedRoute></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><StaffScopedRoute><Reports /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/records" element={<PrivateRoute><StaffScopedRoute><RecordsHome /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/templates" element={<PrivateRoute><StaffScopedRoute><Templates /></StaffScopedRoute></PrivateRoute>} />
        {/* The "Forms" template (blank-canvas, build-your-own) gets its own
            richer home page - search/pin/Draft-Live-Paused-Archived states,
            see FormsTemplateHome.jsx - instead of the generic tile grid
            every other template's locations page uses. A literal path beats
            the dynamic :slug one below regardless of declaration order
            (React Router ranks static segments higher), but it's kept above
            it here too for anyone reading the list top to bottom. */}
        <Route path="/templates/forms/locations" element={<PrivateRoute><StaffScopedRoute><FormsTemplateHome /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/templates/:slug/locations" element={<PrivateRoute><StaffScopedRoute><TemplateLocations /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/account" element={<PrivateRoute><StaffScopedRoute><AccountPage /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/create" element={<PrivateRoute><StaffScopedRoute><CreateForm /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id" element={<PublicForm />} />
        <Route path="/form/:id/response/:token" element={<PublicForm />} />
        {/* Fully public - no PrivateRoute/StaffScopedRoute, same as
            PublicForm above - meant to be linked to directly from outside
            the app. See src/PublicDemoExperience.jsx. */}
        <Route path="/demo" element={<PublicDemoShell />}>
          <Route index element={<PublicDemoHome />} />
          <Route path="records" element={<PublicDemoRecords />} />
          <Route path="report" element={<PublicDemoReport />} />
        </Route>
        {/* A specific dataset (the switcher inside PublicDemoShell navigates
            here) - same three child routes, mirrored rather than made
            optional in one route, since react-router v6 has no clean
            optional-segment syntax for this shape. */}
        <Route path="/demo/:datasetId" element={<PublicDemoShell />}>
          <Route index element={<PublicDemoHome />} />
          <Route path="records" element={<PublicDemoRecords />} />
          <Route path="report" element={<PublicDemoReport />} />
        </Route>
        <Route path="/form/:id/edit" element={<PrivateRoute><StaffScopedRoute><EditForm /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/records" element={<PrivateRoute><StaffScopedRoute><Records /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/inventory" element={<PrivateRoute><StaffScopedRoute><Inventory /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/report" element={<PrivateRoute><StaffScopedRoute><Report /></StaffScopedRoute></PrivateRoute>} />
        {/* Deliberately NOT added to StaffScopedRoute's allowed-paths regex above -
            staff navigating here directly get bounced back to their order screen,
            same as /settings and /admin do today, so this stays owner-only. */}
        <Route path="/form/:id/report/builder" element={<PrivateRoute><StaffScopedRoute><ReportBuilderWorkspace /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/ai-analyst" element={<PrivateRoute><StaffScopedRoute><AIAnalystPage /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/settings" element={<PrivateRoute><StaffScopedRoute><FormSettings /></StaffScopedRoute></PrivateRoute>} />
        <Route path="/form/:id/admin" element={<PrivateRoute><StaffScopedRoute><AdminStaff /></StaffScopedRoute></PrivateRoute>} />
        {/* Payroll module (owner-only, same as /settings above - left out of
            StaffScopedRoute's allow-list on purpose). PayrollShell loads the
            anchor form once and shares it with every tab via <Outlet>. */}
        <Route path="/form/:id/payroll" element={<PrivateRoute><StaffScopedRoute><PayrollShell /></StaffScopedRoute></PrivateRoute>}>
          <Route index element={<PayrollMonthly />} />
          <Route path="staff" element={<PayrollEmployees />} />
          <Route path="staff/:empId" element={<PayrollEmployeeProfile />} />
          <Route path="events" element={<PayrollEntries />} />
        </Route>
        {/* Expenses book: a contained environment like Payroll. ExpenseShell
            loads the anchor form once and shares it via <Outlet>. */}
        <Route path="/form/:id/expenses" element={<PrivateRoute><StaffScopedRoute><ExpenseShell /></StaffScopedRoute></PrivateRoute>}>
          <Route index element={<ExpenseOverview />} />
        </Route>
      </Routes>
      </Suspense>
      </ErrorBoundary>
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
