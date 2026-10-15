import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import OAuthButtons from '../OAuthButtons'

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    defaults: { baseURL: 'http://127.0.0.1:8000' },
  },
}))

import api from '../../services/api'

describe('OAuthButtons', () => {
  it('renders nothing when no providers are configured', async () => {
    api.get.mockResolvedValue({ data: { google: false, github: false } })
    const { container } = render(<OAuthButtons />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/oauth/providers'))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders only the configured provider buttons', async () => {
    api.get.mockResolvedValue({ data: { google: true, github: false } })
    render(<OAuthButtons />)
    expect(await screen.findByText('Continue with Google')).toBeInTheDocument()
    expect(screen.queryByText('Continue with GitHub')).not.toBeInTheDocument()
  })

  it('renders both buttons when both providers are configured', async () => {
    api.get.mockResolvedValue({ data: { google: true, github: true } })
    render(<OAuthButtons />)
    expect(await screen.findByText('Continue with Google')).toBeInTheDocument()
    expect(await screen.findByText('Continue with GitHub')).toBeInTheDocument()
  })
})
