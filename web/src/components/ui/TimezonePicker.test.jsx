import React from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import TimezonePicker from './TimezonePicker';

describe('TimezonePicker', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('shows the current zone label on the trigger button', () => {
    render(<TimezonePicker value="Asia/Kolkata" onChange={() => {}} />);
    expect(screen.getByRole('combobox').textContent).toContain('Asia/Kolkata');
  });

  it('opens a scrollable listbox on click with the full catalog', () => {
    render(<TimezonePicker value="UTC" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('combobox'));
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeTruthy();
    expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(300);
  });

  it('filters options when a country name is typed', () => {
    render(<TimezonePicker value="UTC" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'india' } });
    const opts = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(opts.length).toBeGreaterThan(0);
    // exact country match ranks first, ahead of substring "indian" ocean zones
    expect(opts[0].textContent).toMatch(/Asia\/(Kolkata|Calcutta)/);
  });

  it('returns zones when a city or offset is typed', () => {
    render(<TimezonePicker value="UTC" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'sydney' } });
    const opts = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(opts.length).toBeGreaterThan(0);
    expect(opts[0].textContent).toContain('Australia/Sydney');
  });

  it('selects an option and invokes onChange with the zone value, closing the panel', () => {
    const onChange = vi.fn();
    render(<TimezonePicker value="UTC" onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Tokyo' } });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Asia\/Tokyo/ }));
    expect(onChange).toHaveBeenCalledWith('Asia/Tokyo');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows an empty state when nothing matches', () => {
    render(<TimezonePicker value="UTC" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzznotaplace' } });
    expect(screen.getByText('No matching time zones')).toBeInTheDocument();
  });
});