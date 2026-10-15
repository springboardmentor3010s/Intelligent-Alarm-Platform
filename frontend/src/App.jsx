import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, getDashboardPath } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import OAuthCallback from './pages/OAuthCallback'
import UserDashboard from './pages/UserDashboard'
import CoachDashboard from './pages/CoachDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Profile from './pages/Profile'
import Habits from './pages/Habits'
import Alarms from './pages/Alarms'
import AlarmForm from './pages/AlarmForm'
import Analytics from './pages/Analytics'
import ChallengeHistory from './pages/ChallengeHistory'
import HabitDashboard from './pages/HabitDashboard'

function Layout({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}

// Enforces role — redirects to own dashboard if wrong role
function RoleRoute({ children, roles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to={getDashboardPath(user.role)} replace />
  return children
}

// /dashboard → redirect to role-specific dashboard
function DashboardRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={getDashboardPath(user.role)} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />

          {/* Smart redirect — keeps old /dashboard links working */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />

          {/* USER dashboard */}
          <Route path="/dashboard/user" element={
            <ProtectedRoute>
              <RoleRoute roles={['USER']}>
                <Layout><UserDashboard /></Layout>
              </RoleRoute>
            </ProtectedRoute>
          } />

          {/* WELLNESS_COACH dashboard */}
          <Route path="/dashboard/coach" element={
            <ProtectedRoute>
              <RoleRoute roles={['WELLNESS_COACH', 'ADMINISTRATOR']}>
                <Layout><CoachDashboard /></Layout>
              </RoleRoute>
            </ProtectedRoute>
          } />

          {/* ADMINISTRATOR dashboard */}
          <Route path="/dashboard/admin" element={
            <ProtectedRoute>
              <RoleRoute roles={['ADMINISTRATOR']}>
                <Layout><AdminDashboard /></Layout>
              </RoleRoute>
            </ProtectedRoute>
          } />

          {/* Shared authenticated pages — all roles */}
          <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
          <Route path="/habits"  element={<ProtectedRoute><Layout><Habits /></Layout></ProtectedRoute>} />
          <Route path="/alarms"  element={<ProtectedRoute><Layout><Alarms /></Layout></ProtectedRoute>} />
          <Route path="/alarms/create"   element={<ProtectedRoute><Layout><AlarmForm /></Layout></ProtectedRoute>} />
          <Route path="/alarms/edit/:id" element={<ProtectedRoute><Layout><AlarmForm /></Layout></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
          <Route path="/challenges/history" element={<ProtectedRoute><Layout><ChallengeHistory /></Layout></ProtectedRoute>} />
          <Route path="/habits/dashboard" element={<ProtectedRoute><Layout><HabitDashboard /></Layout></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
