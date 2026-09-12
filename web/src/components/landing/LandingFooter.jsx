import React from 'react';
import { Link } from 'react-router-dom';
import {
  ActivityIcon,
  ArrowUpIcon,
  AwardIcon,
  BriefcaseIcon,
  BuildingIcon,
  GithubIcon,
  GlobeIcon,
  GraduationCapIcon,
  LinkedinIcon,
  MailIcon,
  GoogleDevIcon,
  SparklesIcon,
  TargetIcon,
} from '../ui';
import { BrandLogo } from '../ui';

/**
 * Landing footer: brand, product & resource navigation, academic project
 * attribution, connect (for real sponsor/owner links), an attribution badge
 * strip, disclaimer and a copyright bar.
 */

const PROJECT_URL =
  'https://github.com/PawanSimha/CerebroKognit-InfosysInternship-B3';

const HIGHLIGHTS = [
  { icon: SparklesIcon, label: 'Smarter mornings' },
  { icon: ActivityIcon, label: 'Measurable progress' },
  { icon: TargetIcon, label: 'A more intentional you' },
];

const PRODUCT_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/dashboard', label: 'Analytics' },
  { to: '/alarms', label: 'Alarms' },
  { to: '/challenges', label: 'Challenges' },
  { to: '/reports', label: 'History' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
  { to: '/admin', label: 'Admin' },
];

const RESOURCE_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
  { href: '#faq', label: 'Privacy Policy', title: 'See “Is my data private?” in the FAQ' },
  { href: '#principles', label: 'Terms of Use', title: 'Product behavior & scope' },
  { href: PROJECT_URL, label: 'Project Documentation', external: true },
];

const BADGES = [
  { icon: BriefcaseIcon, label: 'Infosys Virtual Internship 7.0' },
  { icon: AwardIcon, label: 'Internship Project' },
  { icon: GraduationCapIcon, label: 'MCA Student' },
  { icon: BuildingIcon, label: 'Sapthagiri NPS University' },
];

const SOCIALS = [
  {
    key: 'email',
    icon: MailIcon,
    label: 'Email',
    href: 'mailto:iampawansimha.2004@gmail.com',
  },
  {
    key: 'github',
    icon: GithubIcon,
    label: 'GitHub',
    href: 'https://github.com/PawanSimha',
  },
  {
    key: 'linkedin',
    icon: LinkedinIcon,
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/pawansimha',
  },
  {
    key: 'portfolio',
    icon: GlobeIcon,
    label: 'Portfolio',
    href: 'https://portfolio-pawansimha.vercel.app',
  },
  {
    key: 'googledev',
    icon: GoogleDevIcon,
    label: 'Google Developer',
    href: 'https://g.dev/pawansimha',
  },
];

function backToTop() {
  const reduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }
}

export default function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer__glow" aria-hidden="true" />

      <div className="lp-footer__inner">
        <div className="lp-footer__brand">
          <span className="lp-footer__brandmark">
            <BrandLogo variant="wide" className="lp-footer__logo" alt="CerebroKognit" />
          </span>
          <p className="lp-footer__lede">
            An intelligent cognitive alarm and habit platform designed to make mornings
            more meaningful.
          </p>
          <ul className="lp-footer__highlights">
            {HIGHLIGHTS.map(h => {
              const Icon = h.icon;
              return (
                <li key={h.label}>
                  <Icon size={14} /> {h.label}
                </li>
              );
            })}
          </ul>
          <p className="lp-footer__statement">
            Small steps each morning create a brighter tomorrow.
          </p>
        </div>

        <nav className="lp-footer__col lp-footer__col--product" aria-label="Product">
          <span className="sys-label sys-label--violet">Product</span>
          <ul className="lp-footer__links">
            {PRODUCT_LINKS.map(l => (
              <li key={l.to}>
                <Link
                  className="lp-footer__link"
                  to={`/auth?next=${encodeURIComponent(l.to)}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="lp-footer__col lp-footer__col--resources" aria-label="Resources">
          <span className="sys-label sys-label--violet">Resources</span>
          <ul className="lp-footer__links">
            {RESOURCE_LINKS.map(l =>
              l.external ? (
                <li key={l.label}>
                  <a
                    className="lp-footer__link"
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {l.label}
                  </a>
                </li>
              ) : (
                <li key={l.label}>
                  <a className="lp-footer__link" href={l.href} title={l.title || undefined}>
                    {l.label}
                  </a>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="lp-footer__attrib">
          <span className="sys-label sys-label--violet">Project Attribution</span>
          <p>
            CerebroKognit is an internship project developed as part of the Infosys Virtual
            Internship 7.0 program by Pawan Simha, an MCA student at Sapthagiri NPS University.
          </p>
          <p>Project Guide and Mentor: Shanmukha Priya.</p>
          <div className="lp-footer__status-wrap">
            <span className="sys-label sys-label--mint">Project Status</span>
            <p>
              Internship project. Product concepts, interface, and demonstration
              features are presented for educational purposes.
            </p>
          </div>
        </div>

        <address className="lp-footer__connect">
          <span className="sys-label sys-label--violet">Connect</span>
          <ul className="lp-footer__socials">
            {SOCIALS.map(s => {
              const Icon = s.icon;
              return (
                <li key={s.key}>
                  <a
                    className="lp-footer__social"
                    href={s.href}
                    aria-label={`${s.label} - CerebroKognit project owner`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon size={15} /> {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
          <a
            className="lp-footer__cta"
            href={PROJECT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            View project docs
          </a>
        </address>
      </div>

      <div className="lp-footer__badges">
        {BADGES.map(b => {
          const Icon = b.icon;
          return (
            <span className="lp-footer__badge" key={b.label}>
              <Icon size={13} /> {b.label}
            </span>
          );
        })}
      </div>

      <p className="lp-footer__disclaimer">
        Behavioral habit tool, not a medical device. All landing-page previews use sample
        data and never schedule a real alarm.
      </p>

      <div className="lp-footer__bar">
        <p className="lp-footer__copy">© 2026 CerebroKognit. Built with purpose.</p>
        <button type="button" className="lp-footer__top" onClick={backToTop}>
          <ArrowUpIcon size={15} /> Back to top
        </button>
      </div>
    </footer>
  );
}