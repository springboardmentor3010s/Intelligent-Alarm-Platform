// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';

/**
 * Restrained metadata badge used sparingly for status / category / difficulty.
 * Tones: brand, subtle, success, warm, mint, dark, danger. Green/red are
 * reserved for semantics (success = good/online, danger = bad/offline).
 * Never used for body text.
 */
export default function Badge({ tone = 'subtle', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}