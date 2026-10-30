// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import ConnectRow from './ConnectRow';

jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());

describe('ConnectRow', () => {
  it('renders label and sublabel', () => {
    const { getByText } = render(
      <ConnectRow icon="logo-github" label="GitHub" sublabel="github.com/PawanSimha" url="https://github.com/PawanSimha" />
    );
    expect(getByText('GitHub')).toBeTruthy();
    expect(getByText('github.com/PawanSimha')).toBeTruthy();
  });

  it('opens the url when pressed', () => {
    const { getByRole } = render(
      <ConnectRow icon="mail-outline" label="Email" sublabel="iampawansimha.2004@gmail.com" url="mailto:iampawansimha.2004@gmail.com" />
    );
    fireEvent.press(getByRole('link'));
    expect(Linking.openURL).toHaveBeenCalledWith('mailto:iampawansimha.2004@gmail.com');
  });
});