// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from './ThemeContext';

function Probe() {
  const { mode, resolved, colors, fonts, setMode } = useTheme();
  return (
    <>
      <Text testID="mode">{mode}</Text>
      <Text testID="resolved">{resolved}</Text>
      <Text testID="bg">{colors.bg}</Text>
      <Text testID="font">{fonts.displaySemi}</Text>
      <Text testID="choose-light" onPress={() => setMode('light')} />
    </>
  );
}

describe('ThemeProvider', () => {
  it('defaults to dark without a stored preference', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(getByTestId('mode').props.children).toBe('dark');
    expect(getByTestId('resolved').props.children).toBe('dark');
    expect(getByTestId('bg').props.children).toBe('#111826');
    expect(getByTestId('font').props.children).toBe('PlusJakartaSans_600SemiBold');
  });

  it('persists the selected mode and re-resolves the palette', async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    fireEvent.press(getByTestId('choose-light'));
    await waitFor(() => expect(getByTestId('mode').props.children).toBe('light'));
    expect(getByTestId('resolved').props.children).toBe('light');
    expect(getByTestId('bg').props.children).toBe('#F8FAFC');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('ck-theme', 'light');
  });
});