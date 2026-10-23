import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { FullPageLoader } from './components/ui'
import AppShell from './components/AppShell'
import RingOverlay from './components/RingOverlay'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import AuthCallback from './pages/AuthCallback'
import NotFound from './pages/NotFound'

const Onboarding = lazy(() => import('./pages/member/Onboarding'))
const Dashboard = lazy(() => import('./pages/member/Dashboard'))
const Alarms = lazy(() => import('./pages/member/Alarms'))
const Sleep = lazy(() => import('./pages/member/Sleep'))
const Insights = lazy(() => import('./pages/member/Insights'))
const History = lazy(() => import('./pages/member/History'))
const Reports = lazy(() => import('./pages/member/Reports'))
const Notifications = lazy(() => import('./pages/member/Notifications'))
const Settings = lazy(() => import('./pages/member/Settings'))
const CoachOverview = lazy(() => import('./pages/coach/CoachOverview'))
const MemberDetail = lazy(() => import('./pages/coach/MemberDetail'))
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminApprovals = lazy(() => import('./pages/admin/AdminApprovals'))
const AdminRecommendations = lazy(() => import('./pages/admin/AdminRecommendations'))
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit'))
const AdminSystem = lazy(() => import('./pages/admin/AdminSystem'))

function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/app/dashboard" replace />
  return children
}

export default function App() {
  const { user } = useAuth()
  return (
    <>
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
          <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="alarms" element={<Alarms />} />
            <Route path="sleep" element={<Sleep />} />
            <Route path="insights" element={<Insights />} />
            <Route path="history" element={<History />} />
            <Route path="reports" element={<Reports />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="coach" element={<RequireAuth roles={['wellness_coach']}><CoachOverview /></RequireAuth>} />
            <Route path="coach/members/:id" element={<RequireAuth roles={['wellness_coach']}><MemberDetail /></RequireAuth>} />
            <Route path="admin" element={<RequireAuth roles={['admin']}><AdminOverview /></RequireAuth>} />
            <Route path="admin/users" element={<RequireAuth roles={['admin']}><AdminUsers /></RequireAuth>} />
            <Route path="admin/approvals" element={<RequireAuth roles={['admin']}><AdminApprovals /></RequireAuth>} />
            <Route path="admin/recommendations" element={<RequireAuth roles={['admin']}><AdminRecommendations /></RequireAuth>} />
            <Route path="admin/audit" element={<RequireAuth roles={['admin']}><AdminAudit /></RequireAuth>} />
            <Route path="admin/system" element={<RequireAuth roles={['admin']}><AdminSystem /></RequireAuth>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {user && <RingOverlay />}
    </>
  )
}
