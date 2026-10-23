import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as api from './api/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { AlarmProvider } from './context/AlarmContext'
import { ToastProvider } from './components/ui'
import fx from './__fixtures__/api.json'

// The API client is replaced by recorded REAL backend responses (see backend demo seed), so these tests
// verify that every page renders correctly against the data shapes the backend actually sends.
vi.mock('./api/client', async () => {
  const fixtures = (await import('./__fixtures__/api.json')).default
  const state = { role: 'member', active: null, answers: [] }
  const resolve = (url) => {
    const path = url.split('?')[0]
    if (path === '/wake/active') return { session: state.active }
    if (path === '/users/me') return fixtures[state.role].login.user
    const hit = fixtures[state.role][path]
    if (hit === undefined) throw Object.assign(new Error(`No fixture for ${url}`), { response: { status: 404, data: {} } })
    return hit
  }
  const post = vi.fn(async (url) => {
    if (url === '/wake/test') return { data: fixtures.member.wake_test }
    if (/\/wake\/.+\/answer/.test(url)) return { data: state.answers.shift() }
    if (url === '/coach/invite') return { data: { detail: 'If an account with that email exists, an invitation has been sent.' } }
    return { data: {} }
  })
  const client = { get: vi.fn(async (url) => ({ data: resolve(url) })), post, put: vi.fn(async () => ({ data: {} })), patch: vi.fn(async () => ({ data: {} })), delete: vi.fn(async () => ({ data: {} })), request: vi.fn(async () => ({ data: {} })) }
  return {
    default: client, __state: state,
    refreshSession: vi.fn(async () => ({ access_token: 'tok', user: fixtures[state.role].login.user })),
    setAccessToken: () => {}, setAuthLostHandler: () => {}, errorMessage: (e, f) => f || 'error', download: vi.fn(async () => {}),
  }
})

const errors = []
beforeEach(() => { errors.length = 0; vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.map(String).join(' '))) })
afterEach(() => {
  cleanup(); vi.restoreAllMocks()
  const fatal = errors.filter((e) => /(The above error occurred|Cannot read|is not a function|is not defined|Invalid hook call|Objects are not valid|Minified React error)/.test(e))
  expect(fatal, fatal.join('\n')).toEqual([])
})

function renderAt(path, role = 'member', active = null) {
  api.__state.role = role
  api.__state.active = active
  return render(
    <ThemeProvider><MemoryRouter initialEntries={[path]}><AuthProvider><AlarmProvider><ToastProvider><App /></ToastProvider></AlarmProvider></AuthProvider></MemoryRouter></ThemeProvider>,
  )
}
const see = async (t) => (await screen.findAllByText(t, undefined, { timeout: 8000 }))[0]

describe('public pages', () => {
  it('landing', async () => { api.__state.role = 'none'; fx.none = { login: { user: null } }; api.refreshSession.mockRejectedValueOnce(new Error('no session')); renderAt('/'); await see(/won't let your/i); expect(screen.getByText(/Open administrator portal/i)).toBeTruthy() })
  it('login with portals', async () => { api.refreshSession.mockRejectedValueOnce(new Error('x')); renderAt('/login'); await see('Welcome back'); expect(screen.getByRole('tab', { name: /Coach/ })).toBeTruthy(); expect(screen.getByRole('tab', { name: /Admin/ })).toBeTruthy() })
  it('register', async () => { api.refreshSession.mockRejectedValueOnce(new Error('x')); renderAt('/register'); await see('Build the habit'); expect(screen.getByText('Wellness Coach')).toBeTruthy() })
})

describe('member portal', () => {
  const pages = [['/app/dashboard', 'Habit score'], ['/app/sleep', 'Log a night'], ['/app/insights', 'Learning patterns'], ['/app/history', 'Alarm history'],
    ['/app/reports', 'Wake-up report'], ['/app/notifications', 'Bedtime and wake-up reminders, habit alerts, progress updates and announcements.'], ['/app/settings', 'Profile & sleep schedule'], ['/onboarding', "Let's set up your mornings"]]
  it.each(pages)('renders %s', async (path, text) => { renderAt(path); await see(text) })

  it('dashboard shows real demo data and the member sidebar only', async () => {
    renderAt('/app/dashboard'); await see('Habit score')
    expect(screen.getAllByText(/Current streak/i).length).toBeGreaterThan(0)
    expect(screen.queryByText('Coach approvals')).toBeNull(); expect(screen.queryByText('My members')).toBeNull()
  })
  it('role guard sends a member away from /app/admin', async () => { renderAt('/app/admin'); await see('Habit score') })

  it('alarms page lists alarms and create + edit flows send correct payloads', async () => {
    renderAt('/app/alarms'); await see('Gym')
    fireEvent.click(screen.getAllByRole('button', { name: /New alarm/ })[0])
    const dlg = await screen.findByRole('dialog'); expect(within(dlg).getByText('New alarm')).toBeTruthy()
    fireEvent.change(within(dlg).getByDisplayValue('Morning'), { target: { value: 'Study' } })
    fireEvent.click(within(dlg).getByRole('button', { name: 'Create alarm' }))
    await waitFor(() => expect(api.default.post).toHaveBeenCalledWith('/alarms', expect.objectContaining({ label: 'Study', time: '07:00:00', alarm_type: 'daily', verification_method: 'puzzle', repeat_days: [0, 1, 2, 3, 4, 5, 6] })))
    cleanup(); renderAt('/app/alarms'); await see('Gym')
    fireEvent.click(screen.getAllByRole('button', { name: /Edit/ })[0])
    const ed = await screen.findByRole('dialog'); expect(within(ed).getByText('Edit alarm')).toBeTruthy()
    fireEvent.click(within(ed).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(api.default.put).toHaveBeenCalledWith(expect.stringMatching(/^\/alarms\/.+/), expect.objectContaining({ time: expect.stringMatching(/^\d\d:\d\d:00$/) })))
  })
})

describe('ringing experience (real-time alarm flow)', () => {
  const base = fx.member.wake_test.session
  const chal = (id, prompt) => ({ id, challenge_type: 'math', difficulty: 'easy', prompt, options: null, display: null, reveal_seconds: 0, time_limit_seconds: 60, seconds_left: 60 })
  const ringing = { ...base, is_practice: false, label: 'Morning', status: 'ringing', challenge: chal('c1', 'What is 7 + 5?') }

  it('shows the full-screen challenge, rejects a wrong answer, then dismisses', async () => {
    api.__state.answers = [
      { correct: false, timed_out: false, outcome: 'continue', message: 'Not quite. Here\'s a new challenge.', session: { ...ringing, challenge: undefined }, challenge: chal('c2', 'What is 9 + 3?') },
      { correct: true, timed_out: false, outcome: 'dismissed', message: 'Alarm dismissed.', session: { ...base, status: 'dismissed', label: 'Morning' }, summary: { alertness_score: 88, seconds_to_dismiss: 14, wrong_answers: 1, snoozes: 0 } },
    ]
    renderAt('/app/dashboard', 'member', ringing)
    await see('What is 7 + 5?')
    expect(screen.getByRole('dialog', { name: /Alarm ringing/ })).toBeTruthy()
    expect(screen.getByText(/Snooze \d+ min · \d+ left/)).toBeTruthy()
    const input = screen.getByLabelText('Your answer')
    fireEvent.change(input, { target: { value: '99' } }); fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    await see(/Not quite/); await see('What is 9 + 3?')
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '12' } }); fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    await see("You're up!"); expect(screen.getByText('88')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start my day' }))
    await waitFor(() => expect(screen.queryByText("You're up!")).toBeNull())
    const call = api.default.post.mock.calls.find((c) => /answer/.test(c[0])); expect(call[1]).toEqual({ instance_id: 'c1', answer: '99' })
  })

  it('shows multiple-choice quiz options and the memory-reveal phase', async () => {
    const quiz = { ...ringing, challenge: { ...chal('q1', 'Which planet is known as the Red Planet?'), challenge_type: 'quiz', options: ['Earth', 'Mars', 'Venus', 'Jupiter'] } }
    renderAt('/app/dashboard', 'member', quiz); await see('Which planet is known as the Red Planet?'); expect(screen.getByRole('button', { name: 'Mars' })).toBeTruthy()
    cleanup()
    const mem = { ...ringing, challenge: { ...chal('m1', 'What was the FIRST digit?'), challenge_type: 'memory', display: '4 9 2 7', reveal_seconds: 5, time_limit_seconds: 50, seconds_left: 50 } }
    renderAt('/app/dashboard', 'member', mem); await see('4 9 2 7'); expect(screen.getByText(/Memorise this sequence/)).toBeTruthy()
  })

  it('a snoozed alarm shows the banner and no overlay', async () => {
    renderAt('/app/dashboard', 'member', { ...ringing, status: 'snoozed', snoozed_until: new Date(Date.now() + 240000).toISOString(), challenge: null })
    await see(/is snoozed — rings again in/); expect(screen.queryByRole('dialog', { name: /Alarm ringing/ })).toBeNull()
  })
})

describe('coach portal', () => {
  it('overview lists consenting members', async () => { renderAt('/app/coach', 'coach'); await see('Aarav Mehta (Demo)'); expect(screen.getByText('Invite a member')).toBeTruthy(); expect(screen.getByText('My members', { selector: 'a span, a' })).toBeTruthy() })
  it('member detail', async () => { renderAt(`/app/coach/members/${fx.coach.member_id}`, 'coach'); await see('Send encouragement'); expect(screen.getByText('Sleep trend')).toBeTruthy() })
  it('invite flow', async () => {
    renderAt('/app/coach', 'coach'); await see('Invite a member')
    fireEvent.change(screen.getByPlaceholderText('member@example.com'), { target: { value: 'x@example.com' } }); fireEvent.click(screen.getByRole('button', { name: /Send invitation/ }))
    await waitFor(() => expect(api.default.post).toHaveBeenCalledWith('/coach/invite', { email: 'x@example.com' }))
  })
})

describe('admin portal', () => {
  const pages = [['/app/admin', 'Platform announcement'], ['/app/admin/users', 'Assign coach'], ['/app/admin/approvals', 'Kiran Applicant'], ['/app/admin/recommendations', 'Recommendation monitoring'],
    ['/app/admin/audit', 'Audit log'], ['/app/admin/system', 'MongoDB (event log)']]
  it.each(pages)('renders %s', async (path, text) => { renderAt(path, 'admin'); await see(text) })
  it('admin sidebar exposes the administration section', async () => { renderAt('/app/admin', 'admin'); await see('Platform announcement'); expect(screen.getAllByText('Coach approvals').length).toBeGreaterThan(0); expect(screen.getAllByText('Audit log').length).toBeGreaterThan(0) })
  it('users table shows roles, lock state and actions', async () => { renderAt('/app/admin/users', 'admin'); await see('Assign coach'); await see('Aarav Mehta (Demo)'); expect(screen.getAllByText('Deactivate').length).toBeGreaterThan(0) })
})
