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
 * The Administration section is shown to Administrators only (see sectionsForRole).
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
      { to: '/profile', label: 'Profile', icon: UserIcon, title: 'Identity · personal information' },
      { to: '/settings', label: 'Settings', icon: SlidersIcon, title: 'Application behavior · preferences' },
    ],
  },
  {
    label: 'Administration',
    links: [
      { to: '/admin', label: 'Admin', icon: ShieldIcon, title: 'Platform oversight · users · roles' },
    ],
  },
];

/**
 * Coach-only section. Wellness Coaches get a dedicated cohort dashboard on
 * `/coach` instead of the Administrator-only Administration entry.
 */
export const COACH_SECTIONS = [
  {
    label: 'Coaching',
    links: [
      {
        to: '/coach',
        label: 'Cohort',
        icon: UserIcon,
        title: 'Assigned users · adherence · sleep trends · progress',
      },
    ],
  },
];

/**
 * Nav sections visible to a role. Mirror of the route guards in App.jsx:
 * Administrators get Administration; Wellness Coaches get Coaching; everyone
 * else gets the personal sections only.
 */
export function sectionsForRole(role) {
  if (role === 'Administrator') return NAV_SECTIONS;
  const personal = NAV_SECTIONS.filter(s => s.label !== 'Administration');
  if (role === 'Wellness Coach') return [...personal, ...COACH_SECTIONS];
  return personal;
}
