import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../ProtectedRoute'

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../../context/AuthContext'

function renderWithRoute() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/protected" element={<ProtectedRoute><div>Secret Content</div></ProtectedRoute>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  it('shows a loading state while auth is resolving', () => {
    useAuth.mockReturnValue({ user: null, loading: true })
    renderWithRoute()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('redirects to /login when there is no authenticated user', () => {
    useAuth.mockReturnValue({ user: null, loading: false })
    renderWithRoute()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('renders the protected children when a user is authenticated', () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'USER' }, loading: false })
    renderWithRoute()
    expect(screen.getByText('Secret Content')).toBeInTheDocument()
  })
})
