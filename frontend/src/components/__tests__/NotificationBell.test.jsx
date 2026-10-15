import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import NotificationBell from '../NotificationBell'

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import api from '../../services/api'

describe('NotificationBell', () => {
  it('renders without an unread badge when there are no notifications', async () => {
    api.get.mockResolvedValue({ data: { unread_count: 0, notifications: [] } })
    render(<NotificationBell />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/notifications'))
    expect(screen.queryByText('9+')).not.toBeInTheDocument()
  })

  it('shows the unread count badge when there are unread notifications', async () => {
    api.get.mockResolvedValue({
      data: {
        unread_count: 3,
        notifications: [
          { id: 1, type: 'WAKEUP_REMINDER', title: 'wakeup:1', message: 'Alarm rings at 07:00', is_read: false, created_at: new Date().toISOString() },
        ],
      },
    })
    render(<NotificationBell />)
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
  })

  it('opens the dropdown and lists notification messages on click', async () => {
    api.get.mockResolvedValue({
      data: {
        unread_count: 1,
        notifications: [
          { id: 1, type: 'HABIT_ALERT', title: 'habit_alert', message: 'Your habit score is low', is_read: false, created_at: new Date().toISOString() },
        ],
      },
    })
    const { getByTitle, findByText } = render(<NotificationBell />)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    fireEvent.click(getByTitle('Notifications'))
    expect(await findByText('Your habit score is low')).toBeInTheDocument()
  })
})
