// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ChipRow from './ChipRow';

describe('ChipRow', () => {
  it('calls onSelect with the pressed option', () => {
    const onSelect = jest.fn();
    const { getByText } = render(<ChipRow options={['Math', 'Logic', 'Memory']} active="Math" onSelect={onSelect} />);
    fireEvent.press(getByText('Logic'));
    expect(onSelect).toHaveBeenCalledWith('Logic');
  });

  it('exposes selected state for the active chip', () => {
    const { getAllByRole } = render(<ChipRow options={['Daily', 'Weekend']} active="Weekend" onSelect={() => {}} />);
    const buttons = getAllByRole('button');
    const active = buttons.find((b) => b.props.accessibilityState.selected === true);
    expect(active).toBeTruthy();
  });
});