// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildTimeZoneOptions } from '../../utils/timezones';
import { ChevronDownIcon, SearchIcon } from './index';

const OPTIONS = buildTimeZoneOptions();
const PANEL_ESTIMATE = 332; // search row + max-height list + borders, for flip logic
const MIN_WIDTH = 280;

/**
 * Searchable timezone picker: a combobox button opens a fixed-positioned
 * dropdown (portal-rendered so it is never clipped by scroll containers) with
 * a type-to-filter search box. Searching works on the friendly name, the zone
 * id, region, and plain country names (e.g. "india" → Asia/Kolkata).
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
  const [pos, setPos] = useState({ top: 0, left: 0, width: MIN_WIDTH });
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  const current = OPTIONS.find(o => o.value === value) || OPTIONS[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OPTIONS;
    const matches = OPTIONS.filter(o => {
      if (o.label.toLowerCase().includes(q)) return true;
      if (o.friendly && o.friendly.toLowerCase().includes(q)) return true;
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

  const reposition = () => {
    const b = btnRef.current;
    if (!b) return;
    const br = b.getBoundingClientRect();
    const width = Math.max(MIN_WIDTH, Math.min(br.width, 520));
    const ph = panelRef.current ? Math.min(panelRef.current.offsetHeight, window.innerHeight - 16) : PANEL_ESTIMATE;
    const spaceBelow = window.innerHeight - 8 - br.bottom;
    const flip = spaceBelow < ph && br.top > spaceBelow;
    const top = flip
      ? Math.max(8, br.top - ph)
      : br.bottom + 6;
    const left = Math.max(8, Math.min(br.left, window.innerWidth - width - 8));
    setPos({ top, left, width });
  };

  const select = opt => {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    reposition();
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    setActive(Math.max(0, filtered.findIndex(o => o.value === value)));
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
      if (
        open &&
        rootRef.current &&
        !rootRef.current.contains(e.target) &&
        !(panelRef.current && panelRef.current.contains(e.target))
      ) {
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
        ref={btnRef}
        type="button"
        id={id}
        className="tz-picker__button form-control"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="tz-listbox"
        aria-invalid={error ? true : undefined}
        onClick={() => setOpen(v => !v)}
      >
        <span className="tz-picker__value">
          {current ? `${current.value} (${current.offsetLabel})` : value}
        </span>
        <span className="tz-picker__caret" aria-hidden="true">
          <ChevronDownIcon size={16} />
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id="tz-listbox"
            className="tz-picker__panel"
            role="listbox"
            aria-label="Time zone"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          >
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
                    <span className="tz-picker__option-name">{o.friendly}</span>
                    <span className="tz-picker__option-meta">
                      {o.offsetLabel} · {o.value}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}