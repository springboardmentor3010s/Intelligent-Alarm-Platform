// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import LoginScreen from './LoginScreen';
import { THEMES, makeUi } from '../theme/tokens';
import { fonts } from '../theme/fonts';

const mockColors = THEMES.dark;
const mockUi = makeUi(THEMES.dark);
const mockFonts = fonts;

const mockLogin = jest.fn();
const mockLoginWithGoogle = jest.fn();

jest.mock('../theme/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
    resolved: 'dark',
    colors: mockColors,
    ui: mockUi,
    fonts: mockFonts,
  }),
}));

jest.mock('../context/AuthContext', () => ({
  useAuthContext: () => ({ login: mockLogin, loginWithGoogle: mockLoginWithGoogle }),
}));

let mockGoogleEnabled = false;
jest.mock('../auth/googleAuth', () => ({
  isGoogleSignInConfigured: () => mockGoogleEnabled,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGoogleEnabled = false;
});

describe('LoginScreen Google sign-in', () => {
  it('hides the Google button when not configured', () => {
    const { queryByLabelText, getByText } = render(<LoginScreen />);
    expect(getByText('Wake with purpose.')).toBeTruthy();
    expect(queryByLabelText('Continue with Google')).toBeNull();
  });

  it('shows the Google button when configured', () => {
    mockGoogleEnabled = true;
    const { getByLabelText } = render(<LoginScreen />);
    expect(getByLabelText('Continue with Google')).toBeTruthy();
  });

  it('invokes loginWithGoogle when pressed', async () => {
    mockGoogleEnabled = true;
    mockLoginWithGoogle.mockResolvedValue({ success: true });

    const { getByLabelText } = render(<LoginScreen />);
    fireEvent.press(getByLabelText('Continue with Google'));

    await waitFor(() => expect(mockLoginWithGoogle).toHaveBeenCalledTimes(1));
  });
});
