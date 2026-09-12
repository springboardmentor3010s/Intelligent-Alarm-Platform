import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo, MenuIcon, XIcon, ArrowRightIcon } from '../ui';
import ThemeToggle from '../auth/ThemeToggle';
import { NAV_LINKS } from './demo';

/**
 * Landing navigation: compact left brand, centered anchor links, single
 * "Get Started" CTA on the right, plus an inline light/dark theme toggle.
 * Becomes solid + shadowed after scrolling. Mobile gets a keyboard-accessible
 * menu (button + Escape-to-close + focus management).
 */
export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuBtn, setMenuBtn] = useState(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu on Escape and restore focus to the toggle button.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') {
        setOpen(false);
        menuBtn?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, menuBtn]);

  const closeMenu = () => setOpen(false);

  return (
    <header className={`lp-nav ${scrolled || open ? 'lp-nav--solid' : ''}`}>
      <div className="lp-nav__inner">
        <Link to="/" className="lp-nav__brand" aria-label="CerebroKognit home">
          <BrandLogo variant="wide" className="lp-nav__brand-logo" alt="CerebroKognit" />
        </Link>

        <nav className="lp-nav__links" aria-label="Primary">
          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href} className="lp-nav__link" onClick={closeMenu}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="lp-nav__right">
          <ThemeToggle />

          <Link to="/auth" className="btn btn-primary lp-nav__cta" onClick={closeMenu}>
            Get Started <ArrowRightIcon size={15} />
          </Link>

          <button
            type="button"
            className="lp-nav__toggle"
            ref={setMenuBtn}
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            aria-controls="lp-mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <XIcon size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="lp-mobile-menu" className="lp-nav__mobile" aria-label="Mobile">
          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href} className="lp-nav__mobile-link" onClick={closeMenu}>
              {link.label}
            </a>
          ))}
          <div className="lp-nav__mobile-actions">
            <Link to="/auth" className="btn btn-primary btn--block" onClick={closeMenu}>
              Get Started <ArrowRightIcon size={15} />
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}