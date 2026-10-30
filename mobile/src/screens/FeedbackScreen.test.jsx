// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import FeedbackScreen from './FeedbackScreen';
import { apiFetch, authHeaders, parseApiError } from '../utils/api';
import { THEMES, makeUi } from '../theme/tokens';
import { fonts } from '../theme/fonts';

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
  authHeaders: jest.fn((token) => ({ Authorization: `Bearer ${token}` })),
  parseApiError: jest.fn(async (r) => `detail-${r.status}`),
}));

const mockColors = THEMES.dark;
const mockUi = makeUi(THEMES.dark);
const mockFonts = fonts;

jest.mock('../theme/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
    colors: mockColors,
    ui: mockUi,
    fonts: mockFonts,
  }),
}));

jest.mock('../context/AuthContext', () => ({
  useAuthContext: () => ({ user: { email: 'pawan@cerebro.dev' }, token: 'tok' }),
}));

const nav = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FeedbackScreen', () => {
  it('renders category chips, rating stars, message input, and submit button', () => {
    const { getByText, getAllByText, getByLabelText, getByTestId } = render(<FeedbackScreen navigation={nav} />);
    expect(getAllByText('Send feedback').length).toBeGreaterThanOrEqual(2);
    for (const label of ['Suggestion', 'Bug report', 'Compliment', 'Other']) {
      expect(getByText(label)).toBeTruthy();
    }
    expect(getByTestId('feedback-message')).toBeTruthy();
    expect(getByLabelText('Submit feedback')).toBeTruthy();
  });

  it('starts with the submit button disabled', () => {
    const { getByLabelText } = render(<FeedbackScreen navigation={nav} />);
    const button = getByLabelText('Submit feedback');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('selects a category chip', () => {
    const { getByLabelText } = render(<FeedbackScreen navigation={nav} />);
    fireEvent.press(getByLabelText('Bug report'));
    expect(getByLabelText('Bug report').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('Suggestion').props.accessibilityState.selected).toBe(false);
  });

  it('submits with category, rating, and message then shows the success state', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    const { getByLabelText, getByTestId, getByText } = render(<FeedbackScreen navigation={nav} />);
    fireEvent.press(getByLabelText('Compliment'));
    fireEvent.press(getByLabelText('Rate 3 stars'));
    fireEvent.changeText(getByTestId('feedback-message'), 'Love the wake-up drills');
    fireEvent.press(getByLabelText('Submit feedback'));

    await waitFor(() => expect(getByText('Feedback sent')).toBeTruthy());

    expect(apiFetch).toHaveBeenCalledWith('/api/v1/feedback', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
      body: JSON.stringify({ category: 'compliment', rating: 3, message: 'Love the wake-up drills' }),
    });
  });

  it('handles a server rejection with an error message', async () => {
    apiFetch.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({}) });

    const { getByLabelText, getByTestId, getByText } = render(<FeedbackScreen navigation={nav} />);
    fireEvent.changeText(getByTestId('feedback-message'), 'Something broke');
    fireEvent.press(getByLabelText('Submit feedback'));

    await waitFor(() => expect(getByText('detail-422')).toBeTruthy());
  });

  it('submits without a rating when none was chosen', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    const { getByLabelText, getByTestId, getByText } = render(<FeedbackScreen navigation={nav} />);
    fireEvent.changeText(getByTestId('feedback-message'), 'Just saying hi');
    fireEvent.press(getByLabelText('Submit feedback'));

    await waitFor(() => expect(getByText('Feedback sent')).toBeTruthy());
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/feedback', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
      body: JSON.stringify({ category: 'suggestion', rating: null, message: 'Just saying hi' }),
    });
  });
});