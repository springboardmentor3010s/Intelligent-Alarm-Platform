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
 * Application navigation hierarchy used by the sidebar and mobile drawer —
 * tracks the product dashboard IA: Dashboard · Alarms · Challenges ·
 * History · Profile · Settings · Admin.
 */
export const NAV_SECTIONS = [
  {
    label: 'Track',
    links: [
      { to: '/', label: 'Dashboard', icon: HomeIcon, title: "Today's cognitive status" },
      {
        to: '/dashboard',
        label: 'Insights',
        icon: ActivityIcon,
        title: 'Habits (score · tracking) · Sleep · Analytics · Recommendations',
      },
    ],
  },
  {
    label: 'Plan',
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