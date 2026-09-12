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

const DIFFICULTY_TONE = {
  Beginner: 'subtle',
  Easy: 'mint',
  Medium: 'brand',
  Hard: 'warm',
  Expert: 'dark',
};

export function difficultyTone(difficulty) {
  return DIFFICULTY_TONE[difficulty] || 'subtle';
}

export function DifficultyBadge({ difficulty }) {
  return <Badge tone={difficultyTone(difficulty)}>{difficulty}</Badge>;
}