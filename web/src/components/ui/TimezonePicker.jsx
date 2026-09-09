import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildTimeZoneOptions } from '../../utils/timezones';
import { ChevronDownIcon, SearchIcon } from './index';

const OPTIONS = buildTimeZoneOptions();

/**
 * Searchable timezone picker: a button opens a scrollable dropdown with a
 * type-to-filter search box. Searching works on the zone label, region, and
 * plain country names (e.g. "india" → Asia/Kolkata, "usa" → US zones).
 */
export default function TimezonePicker({
  id,
  value = 'UTC',
  onChange,
  className = '',
  placeholder = 'Search timezone or country…',
  error,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const current = OPTIONS.find(o => o.value === value) || OPTIONS[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OPTIONS;
    const matches = OPTIONS.filter(o => {
      if (o.label.toLowerCase().includes(q)) return true;
      return (o.tags || []).some(tag => tag.includes(q));
    });
    const score = o => {
      const region = String(o.value).split('/')[0].toLowerCase();
      let s = 0;
      if ((o.tags || []).some(tag => tag === q)) s += 6; // exact country alias
      if (region === q) s += 4; // whole region, e.g. typing "asia"
      if (o.label.toLowerCase().includes(q)) s += 2; // city/zone name
      return s;
    };
    return matches.sort((a, b) => score(b) - score(a) || a.value.localeCompare(b.value));
  }, [query]);

  const last = Math.max(0, filtered.length - 1);

  const select = opt => {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (!open) return undefined;
    setActive(Math.max(0, filtered.findIndex(o => o.value === value)));
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = e => {
      if (!open) return;
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(a => Math.min(a + 1, last));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(a => Math.max(a - 1, 0));
      } else if (e.key === 'Enter' && filtered[active]) {
        e.preventDefault();
        select(filtered[active]);
      } else if (e.key === 'Tab') {
        setOpen(false);
      }
    };
    const onDown = e => {
      if (open && rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, filtered, active, last]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={rootRef} className={`tz-picker ${className} ${error ? 'tz-picker--error' : ''}`}>
      <button
        type="button"
        id={id}
        className="tz-picker__button form-control"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        onClick={() => setOpen(v => !v)}
      >
        <span className="tz-picker__value">{current ? current.label : value}</span>
        <span className="tz-picker__caret" aria-hidden="true">
          <ChevronDownIcon size={16} />
        </span>
      </button>

      {open && (
        <div className="tz-picker__panel" role="listbox" aria-label="Time zone">
          <div className="tz-picker__search">
            <SearchIcon size={14} />
            <input
              ref={inputRef}
              role="searchbox"
              placeholder={placeholder}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setActive(0);
              }}
              aria-label="Search time zones"
            />
          </div>
          <ul className="tz-picker__list">
            {filtered.length === 0 && (
              <li className="tz-picker__empty">No matching time zones</li>
            )}
            {filtered.map((o, i) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`tz-picker__option ${
                    i === active ? 'tz-picker__option--active' : ''
                  } ${o.value === value ? 'tz-picker__option--selected' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => select(o)}
                >
                  <span className="tz-picker__option-zone">{o.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}