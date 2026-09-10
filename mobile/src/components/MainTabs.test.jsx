import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TabBar } from './MainTabs';

describe('TabBar', () => {
  it('renders the four bottom-navigation tabs', () => {
    const { getAllByText } = render(<TabBar active="HOME" onChange={() => {}} />);
    for (const label of ['HOME', 'ALARMS', 'INSIGHTS', 'PROFILE']) {
      expect(getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('calls onChange when a tab is pressed', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(<TabBar active="HOME" onChange={onChange} />);
    fireEvent.press(getByLabelText('ALARMS'));
    expect(onChange).toHaveBeenCalledWith('ALARMS');
  });
});