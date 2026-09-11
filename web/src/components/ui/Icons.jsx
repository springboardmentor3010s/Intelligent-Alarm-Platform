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

export function SearchIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
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

export function ArrowRightIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </Icon>
  );
}

export function CheckIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Icon>
  );
}

export function BrainIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M9.5 3A2.5 2.5 0 0 0 7 5.5c-.6-.3-1.3-.5-2-.5A2.5 2.5 0 0 0 2.5 7.5C2.5 8.8 3.5 9.8 4.8 10 3.8 10.8 3 12.2 3 13.7A3.3 3.3 0 0 0 6.3 17c0 .9.7 1.6 1.6 1.6h8.1a4 4 0 0 0 4-4c0-1.5-.8-2.9-2-3.7A1 1 0 0 0 17 6.8 2.5 2.5 0 0 0 15 4.5 2.5 2.5 0 0 0 9.5 3Z" />
      <path d="M12 19.2v-9" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </Icon>
  );
}

export function TargetIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function FlameIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M12 3s6 4.5 6 10a6 6 0 0 1-12 0c0-2 .6-3.8 1.6-5.2C8.6 9.6 10 9 10.4 7.6 11 6.2 12 3 12 3Z" />
      <path d="M12 13a3 3 0 0 1 3 3" />
    </Icon>
  );
}

export function LockIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
  );
}

export function ZapIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </Icon>
  );
}

export function BedIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7" />
      <path d="M3 14h18v4H3z" />
      <path d="M6 9V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3" />
    </Icon>
  );
}

export function KeyboardIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M8 14h8" />
    </Icon>
  );
}

export function XIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function SignalIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M4 18v-3M9 18V9M14 18V5M19 18V2" />
    </Icon>
  );
}

export function WifiIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M2 8.5a15 15 0 0 1 20 0" />
      <path d="M5 12a10 10 0 0 1 14 0" />
      <path d="M8.5 15.5a5 5 0 0 1 7 0" />
      <circle cx="12" cy="18.5" r="0.4" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function BatteryIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <rect x="2" y="8" width="16" height="8" rx="2" />
      <path d="M20 11v2" />
      <path d="M4 10.5h8.5v3H4Z" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function GithubIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
    </Icon>
  );
}

export function LinkedinIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </Icon>
  );
}

export function GlobeIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </Icon>
  );
}

export function ArrowUpIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </Icon>
  );
}

export function BriefcaseIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </Icon>
  );
}

export function GraduationCapIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M21.4 8.9 12 4 2.6 8.9 12 13.8l9.4-4.9Z" />
      <path d="M6 10.4V16c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5.6" />
      <path d="M21.4 8.9V14" />
    </Icon>
  );
}

export function AwardIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.5 13 17 22l-5-3-5 3 1.5-9" />
    </Icon>
  );
}

export function BuildingIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h2M8 10h2M8 14h2M14 6h2M14 10h2M14 14h2" />
    </Icon>
  );
}

export function RotateIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </Icon>
  );
}

export function QuoteIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M8 6a3 3 0 0 0-3 3v4a2 2 0 0 0 2 2h1.5v1.5A1.5 1.5 0 0 1 7 18" />
      <path d="M18 6a3 3 0 0 0-3 3v4a2 2 0 0 0 2 2h1.5v1.5a1.5 1.5 0 0 1-1.5 1.5" />
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