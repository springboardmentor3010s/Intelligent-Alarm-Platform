// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';

/**
 * Card component - a styled wrapper div using the design system
 */
export function Card({ className = '', children, ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

/**
 * Grid component - responsive card grid
 */
export function Grid({ className = '', children, ...props }) {
  return (
    <div className={`grid-cards ${className}`} {...props}>
      {children}
    </div>
  );
}

export default { Card, Grid };
