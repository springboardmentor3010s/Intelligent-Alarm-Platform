// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';

/**
 * Brand logo image with theme-aware variants (dark + light lockups).
 * `variant="wide"` renders the horizontal wordmark lockup; `variant="mark"`
 * renders the square brand mark. The correct file is shown via CSS driven by
 * the `data-theme` attribute on <html> (see `.brand-logo-img` in index.css).
 */
export default function BrandLogo({ variant = 'wide', className = '', alt = '', style }) {
  if (variant === 'mark') {
    return <img src="/logos/JustLogo.webp" alt={alt} className={`brand-logo-img brand-logo-img--mark ${className}`} style={style} />;
  }
  return (
    <span className={`brand-logo-img brand-logo-img--wide ${className}`} style={style}>
      <img src="/logos/WideLight.webp" alt={alt} className="brand-logo-img__asset brand-logo-img__asset--light" />
      <img src="/logos/WideDark.webp" alt="" aria-hidden="true" className="brand-logo-img__asset brand-logo-img__asset--dark" />
    </span>
  );
}