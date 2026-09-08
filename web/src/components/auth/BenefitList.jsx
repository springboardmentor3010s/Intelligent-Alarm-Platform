import React from 'react';
import { CheckIcon } from './icons';

const BENEFITS = [
  { label: 'Adaptive difficulty, personalized to you', tone: 'brand' },
  { label: '7 challenge types engineered for your brain', tone: 'cyan' },
  { label: 'Habit scoring & progress insights', tone: 'amber' },
];

/**
 * Hero benefit list with consistent semantic indicator dots (no emoji).
 */
export default function BenefitList() {
  return (
    <ul className="benefits">
      {BENEFITS.map(({ label, tone }) => (
        <li className="benefit" key={label}>
          <span className={`benefit-dot benefit-dot--${tone}`} aria-hidden="true">
            <CheckIcon />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}