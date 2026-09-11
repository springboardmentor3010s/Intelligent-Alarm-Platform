import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';
import CommandCenter from '../components/landing/CommandCenter';

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );
}

describe('Landing page', () => {
  beforeEach(() => {
    // jsdom lacks IntersectionObserver + matchMedia; useReveal falls back to visible.
    vi.stubGlobal('IntersectionObserver', undefined);
    vi.stubGlobal('matchMedia', undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the hero message and CTAs', () => {
    renderLanding();
    expect(screen.getByText(/WAKE WITH PURPOSE/i)).toBeInTheDocument();
    expect(screen.getAllByText('Get Started').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sign in').length).toBeGreaterThan(0);
  });

  it('toggles the mobile navigation menu', () => {
    renderLanding();
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    // Mobile panel is present in the DOM with the anchor links + actions.
    expect(within(screen.getByLabelText('Mobile')).getByText('Features')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Mobile')).getByText('How it works')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('runs a full demo session: alarm → solve → dismiss → reset', () => {
    const deterministic = () => ({
      question: 'What is 2 + 2?',
      hint: 'Fingers count.',
      answer: '4',
    });

    render(
      <MemoryRouter>
        <CommandCenter getChallenge={deterministic} />
      </MemoryRouter>
    );

    // Armed state → fire the demo alarm.
    fireEvent.click(screen.getByRole('button', { name: /simulate alarm/i }));
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();

    // Wrong answer keeps streak at 0 and shows feedback + hint.
    const answer = screen.getByPlaceholderText('Type your answer…');
    fireEvent.change(answer, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));
    expect(screen.getByText(/Not quite\. Hint:/i)).toBeInTheDocument();

    // Correct answer raises the score, bumps the streak, unlocks dismissal.
    fireEvent.change(answer, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));
    expect(screen.getByText(/Correct — dismissal unlocked/i)).toBeInTheDocument();
    expect(screen.getByText(/streak 1\./)).toBeInTheDocument();
    expect(screen.getByText('10', { selector: '.cc__ring-num' })).toBeInTheDocument();

    const dismiss = screen.getByRole('button', { name: /dismiss alarm/i });
    expect(dismiss).toBeEnabled();
    fireEvent.click(dismiss);
    expect(screen.getByText(/Verified — you’re awake/i)).toBeInTheDocument();

    // Reset returns the demo to its armed zero state.
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    expect(screen.getByRole('button', { name: /simulate alarm/i })).toBeInTheDocument();
    expect(document.querySelector('.cc__streak')).toHaveTextContent('0 day streak');
  });

  it('lets visitors change challenge type and difficulty in the running session', () => {
    const deterministic = (type, difficulty) => ({
      question: `${type} at ${difficulty}`,
      hint: 'demo',
      answer: 'demo',
    });

    render(
      <MemoryRouter>
        <CommandCenter getChallenge={deterministic} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Memory' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
    fireEvent.click(screen.getByRole('button', { name: /simulate alarm/i }));
    expect(screen.getByText('Memory at Hard')).toBeInTheDocument();
  });

  it('expands the accessible FAQ accordion', () => {
    renderLanding();
    // First item is open by default.
    const first = screen.getByRole('button', { name: /How does the alarm actually dismiss\?/i });
    expect(first).toHaveAttribute('aria-expanded', 'true');

    // Swap to another question.
    const second = screen.getByRole('button', { name: /Is my data private\?/i });
    expect(second).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles feature card details and steps through the protocol tabs', () => {
    renderLanding();

    // Feature "Learn more" toggles a detail line.
    const learnMore = screen.getAllByRole('button', { name: /learn more/i })[0];
    fireEvent.click(learnMore);
    expect(learnMore).toHaveAttribute('aria-expanded', 'true');

    // Step tabs switch the visible protocol panel.
    const step = screen.getByRole('tab', { name: /Wake up, solve to dismiss/i });
    fireEvent.click(step);
    expect(step).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText(/stands between you and snooze/i)).toBeInTheDocument();
  });
});