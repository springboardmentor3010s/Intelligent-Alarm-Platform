import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { NAV_SECTIONS } from '../../navSections';
import { BrandMark, LogOutIcon, MenuIcon, ThemeSwitcher } from '../ui';

/**
 * Global authenticated navigation — a floating pill header (desktop) that
 * contracts to a compact pill + dropdown drawer on mobile.
 *
 * Props:
 * - name/email/initials: user identity shown in the drawer user area + pill avatar
 * - mobileOpen / onToggleMobile: mobile drawer state
 * - onNavigate: called after any navigation (closes the mobile drawer)
 * - onLogout: preserves the existing logout behaviour
 */
export default function Sidebar({
  name = 'User',
  email = '',
  initials = 'U',
  mobileOpen = false,
  onToggleMobile,
  onNavigate,
  onLogout,
}) {
  return (
    <>
      <header className="nav-pill">
        <button
          type="button"
          className="nav-menu-toggle nav-pill__menu"
          onClick={onToggleMobile}
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
        >
          <MenuIcon size={20} />
        </button>

        <Link to="/" className="nav-pill__brand" onClick={onNavigate} title="CerebroKognit dashboard">
          <BrandMark size={26} />
          <span className="nav-pill__word">CerebroKognit</span>
          <span className="led led--on led--live" title="System online" />
        </Link>

        <nav className="nav-pill__nav" aria-label="Primary navigation">
          {NAV_SECTIONS.map(section => (
            <div className="nav-pill__group" key={section.label}>
              <span className="nav-pill__grouplabel">{section.label}</span>
              {section.links.map(link => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === '/'}
                    title={link.label}
                    aria-label={link.label}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `nav-pill__link${isActive ? ' is-active' : ''}`
                    }
                  >
                    <Icon size={16} />
                    <span className="nav-pill__link__text">{link.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="nav-pill__tools">
          <div className="nav-pill__theme">
            <ThemeSwitcher />
          </div>
          <span className="nav-avatar" aria-hidden="true" title={name}>
            {initials}
          </span>
          <button
            type="button"
            className="nav-pill__logout"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOutIcon size={18} />
          </button>
        </div>
      </header>

      <aside className="nav-drawer">
        <nav className="sidebar-nav" aria-label="Mobile navigation">
          {NAV_SECTIONS.map(section => (
            <div className="sidebar-section" key={section.label}>
              <span className="sidebar-section__label">{section.label}</span>
              <ul className="sidebar-links">
                {section.links.map(link => {
                  const Icon = link.icon;
                  return (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        end={link.to === '/'}
                        title={link.title}
                        aria-label={link.label}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `sidebar-link${isActive ? ' is-active' : ''}`
                        }
                      >
                        <Icon size={18} />
                        <span className="sidebar-link__text">{link.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-user sidebar-user--drawer">
          <span className="nav-avatar" aria-hidden="true">
            {initials}
          </span>
          <div className="sidebar-user__meta">
            <span className="sidebar-user__name">{name}</span>
            <span className="sidebar-user__email">{email}</span>
          </div>
          <button
            type="button"
            className="btn-icon sidebar-logout"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOutIcon size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}