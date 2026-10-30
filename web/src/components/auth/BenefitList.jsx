// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { CheckIcon } from './icons';

const BENEFITS = [
  { label: 'Adaptive difficulty, personalized to you' },
  { label: '7 challenge types engineered for your brain' },
  { label: 'Habit scoring & progress insights' },
];

/**
 * Hero benefit list with consistent mint ticks (no boxes, no emoji).
 */
export default function BenefitList() {
  return (
    <ul className="benefits">
      {BENEFITS.map(({ label }) => (
        <li className="benefit" key={label}>
          <span className="benefit-dot" aria-hidden="true">
            <CheckIcon />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}