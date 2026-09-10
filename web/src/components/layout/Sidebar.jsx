import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_SECTIONS } from '../../navSections';
import {
  BrandMark,
  LogOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ThemeSwitcher,
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
export default function Sidebar({
  name = 'User',
  email = '',
  initials = 'U',
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
  onLogout,
}) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-head">
        <div className="sidebar-brand">
          <BrandMark size={36} />
          <span className="sidebar-brand__word">CerebroKognit</span>
          <span className="led led--on led--live" title="System online" />
        </div>
        <button
          type="button"
          className="sidebar-collapse"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
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

      <div className="sidebar-footer">
        <ThemeSwitcher />
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