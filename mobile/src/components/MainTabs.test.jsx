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

  it('marks the active tab selected and inactive tabs unselected', () => {
    const { getByLabelText } = render(<TabBar active="HOME" onChange={() => {}} />);
    expect(getByLabelText('Home').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('Alarms').props.accessibilityState.selected).toBe(false);
    expect(getByLabelText('Insights').props.accessibilityState.selected).toBe(false);
    expect(getByLabelText('Profile').props.accessibilityState.selected).toBe(false);
  });

  it('no longer renders a floating slider pill overlay', () => {
    const { getByTestId, queryByTestId } = render(<TabBar active="HOME" onChange={() => {}} />);
    fireEvent(getByTestId('tab-bar'), 'layout', { nativeEvent: { layout: { width: 320, height: 60 } } });
    expect(queryByTestId('tab-slider')).toBeNull();
  });
});