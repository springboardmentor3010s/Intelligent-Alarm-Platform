// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import {
  HomeIcon,
  ActivityIcon,
  AlarmClockIcon,
  SparklesIcon,
  FileTextIcon,
  UserIcon,
  SlidersIcon,
  ShieldIcon,
} from './components/ui';

/**
 * Application navigation hierarchy used by the sidebar and mobile drawer:
 * Overview (Dashboard · Analytics) · Wake (Alarms · Challenges) ·
 * Insights (History) · Account (Profile · Settings) · Administration (Admin).
 */
export const NAV_SECTIONS = [
  {
    label: 'Overview',
    links: [
      { to: '/', label: 'Dashboard', icon: HomeIcon, title: "Today's cognitive status" },
      {
        to: '/dashboard',
        label: 'Analytics',
        icon: ActivityIcon,
        title: 'Habits (score · tracking) · Sleep · Analytics · Recommendations',
      },
    ],
  },
  {
    label: 'Wake',
    links: [
      { to: '/alarms', label: 'Alarms', icon: AlarmClockIcon, title: 'Active · History · Create' },
      { to: '/challenges', label: 'Challenges', icon: SparklesIcon, title: 'Generator · History · Performance' },
    ],
  },
  {
    label: 'Insights',
    links: [
      { to: '/reports', label: 'History', icon: FileTextIcon, title: 'Habit · Wake-up · Challenge history & exports' },
    ],
  },
  {
    label: 'Account',
    links: [
      { to: '/profile', label: 'Profile', icon: UserIcon, title: 'Identity & personal information' },
      { to: '/settings', label: 'Settings', icon: SlidersIcon, title: 'Application behavior & preferences' },
    ],
  },
  {
    label: 'Administration',
    links: [
      { to: '/admin', label: 'Admin', icon: ShieldIcon, title: 'Users · Reports · Configuration (staff)' },
    ],
  },
];

/**
 * Nav sections visible to a role. `Administration` is staff-only and is
 * relabelled "Coaching" for Wellness Coaches (their view is the cohort, not
 * platform admin). Users never see the section at all.
 */
export function sectionsForRole(role) {
  if (role === 'Administrator') return NAV_SECTIONS;
  if (role === 'Wellness Coach') {
    return NAV_SECTIONS.map(s =>
      s.label === 'Administration' ? { ...s, label: 'Coaching' } : s
    );
  }
  return NAV_SECTIONS.filter(s => s.label !== 'Administration');
}
