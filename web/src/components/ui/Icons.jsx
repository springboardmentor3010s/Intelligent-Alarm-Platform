import React from 'react';

/**
 * Shared inline icon set for the CerebroKognit application shell.
 * One family (Lucide-style outlines), 2px stroke, `currentColor` so every
 * icon adapts to both themes. Keep this as the single source for app icons.
 */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Icon({ size = 18, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base} {...rest}>
      {children}
    </svg>
  );
}

export function HomeIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </Icon>
  );
}

export function ActivityIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="M22 12h-3.5L15.5 20l-6-16-3 8H2" />
    </Icon>
  );
}

export function AlarmClockIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="M5 3.5 3 5.5M19 3.5 21 5.5" />
      <path d="M12 19a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z" />
      <path d="M12 8.5V12l2.3 1.8" />
    </Icon>
  );
}

export function SparklesIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="M12 3l1.9 4.7 4.7 1.9-4.7 1.9L12 16.3l-1.9-4.7L5.4 9.6l4.7-1.9L12 3Z" />
      <path d="M19 15l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1Z" />
    </Icon>
  );
}

export function FileTextIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h5" />
    </Icon>
  );
}

export function UserIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
  );
}

export function SlidersIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15.5" cy="7" r="1.5" />
      <circle cx="8.5" cy="17" r="1.5" />
    </Icon>
  );
}

export function ShieldIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3Z" />
      <path d="m9 11.5 2 2 4-4.5" />
    </Icon>
  );
}

export function LogOutIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </Icon>
  );
}

export function PlusIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function PlayIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="m7.5 4.5 12 7.5-12 7.5v-15Z" />
    </Icon>
  );
}

export function TrashIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="m5.5 7 1 13h11l1-13" />
      <path d="M10 11v6M14 11v6" />
    </Icon>
  );
}

export function MoreIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="5.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function ClockIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

export function CalendarIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M8 2v4M16 2v4M3 8h18" />
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
    </Icon>
  );
}

export function DownloadIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </Icon>
  );
}

export function ChevronDownIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function ChevronLeftIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  );
}

export function ChevronRightIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

export function MenuIcon({ size = 20 }) {
  return (
    <Icon size={size}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function AlertCircleIcon({ size = 24 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </Icon>
  );
}

export function CheckCircleIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </Icon>
  );
}

export function InfoIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </Icon>
  );
}

export function BarChartIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M3 20h18" />
      <path d="M7 20v-6M12 20V8M17 20v-9" />
    </Icon>
  );
}

export function SunIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function MoonIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </Icon>
  );
}

export function BrandMark({ size = 30 }) {
  return (
    <span className="app-brand-mark" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 24 24"
        width={size * 0.58}
        height={size * 0.58}
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12h3.4L9 6l4.5 12 2.6-6H21" />
      </svg>
    </span>
  );
}