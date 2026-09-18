// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV_SECTIONS } from '../../navSections';
import {
  BrandLogo,
  LogOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../ui';

/**
 * Global authenticated application sidebar.
 *
 * Props:
 * - name/email/initials: user identity shown in the footer user area
 * - collapsed: icon-only mode on desktop (`app-shell--collapsed`)
 * - onToggleCollapsed: collapse/expand control
 * - onNavigate: called after any navigation (closes the mobile drawer)
 * - onLogout: preserves the existing logout behaviour
 */
/** Matches App.jsx breadcrumb logic: which nav section owns the current route. */
function activeSectionLabel(pathname) {
  for (const section of NAV_SECTIONS) {
    const hit = section.links.some(l =>
      l.to === '/' ? pathname === '/' : pathname.startsWith(l.to)
    );
    if (hit) return section.label;
  }
  return null;
}

export default function Sidebar({
  name = 'User',
  email = '',
  initials = 'U',
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
  onLogout,
}) {
  const { pathname } = useLocation();
  const activeSection = activeSectionLabel(pathname);

  return (
    <aside className="app-sidebar">
      <div className="sidebar-head">
        <div className="sidebar-brand">
          <BrandLogo variant="wide" className="sidebar-brand__logo sidebar-brand__logo--wide" alt="CerebroKognit" />
          <BrandLogo variant="mark" className="sidebar-brand__logo sidebar-brand__logo--mark" alt="CerebroKognit" />
        </div>
        <button
          type="button"
          className="sidebar-collapse"
          onClick={e => {
            e.currentTarget.blur();
            onToggleCollapsed();
          }}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
        </button>
      </div>

      <div className="sidebar-cta-wrap" style={{ padding: '0.75rem 0.75rem 0' }}>
        <NavLink
          to="/alarms"
          onClick={onNavigate}
          className="btn btn-primary sidebar-quick-btn"
          style={{ width: '100%', justifyContent: collapsed ? 'center' : 'center', padding: '0.6rem 0.875rem' }}
          title="Create or set a new alarm"
        >
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>+</span>
          {!collapsed && <span>New Alarm</span>}
        </NavLink>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {NAV_SECTIONS.map(section => (
          <div className="sidebar-section" key={section.label}>
            <span
              className={`sidebar-section__label${section.label === activeSection ? ' is-active' : ''}`}
            >
              {section.label}
            </span>
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
                      <span className="sidebar-link__icon">
                        <Icon size={18} />
                      </span>
                      <span className="sidebar-link__text">{link.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
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
      </div>
    </aside>
  );
}