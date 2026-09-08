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
 * §21-style navigation hierarchy used by the sidebar and mobile drawer.
 * Every destination reuses an existing page.
 */
export const NAV_SECTIONS = [
  {
    label: 'Track',
    links: [
      { to: '/', label: 'Home', icon: HomeIcon, title: "Today's progress" },
      {
        to: '/dashboard',
        label: 'Analytics',
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
      { to: '/reports', label: 'Reports', icon: FileTextIcon, title: 'Habit · Wake-up · Challenge exports' },
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