import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TabBar } from './MainTabs';

describe('TabBar', () => {
  it('renders the four bottom-navigation tabs', () => {
    const { getAllByText } = render(<TabBar active="HOME" onChange={() => {}} />);
    for (const label of ['Home', 'Alarms', 'Insights', 'Profile']) {
      expect(getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('calls onChange when a tab is pressed', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(<TabBar active="HOME" onChange={onChange} />);
    fireEvent.press(getByLabelText('Alarms'));
    expect(onChange).toHaveBeenCalledWith('ALARMS');
  });

  it('renders the rounded sliding pill once the bar is laid out', () => {
    const { getByTestId, queryByTestId } = render(<TabBar active="HOME" onChange={() => {}} />);
    expect(queryByTestId('tab-slider')).toBeNull();
    fireEvent(getByTestId('tab-bar'), 'layout', { nativeEvent: { layout: { width: 320, height: 62 } } });
    expect(getByTestId('tab-slider')).toBeTruthy();
  });
});