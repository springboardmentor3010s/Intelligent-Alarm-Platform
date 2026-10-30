// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';

/**
 * Subtle shimmer placeholder that mirrors the space of the content it
 * precedes. `tone` picks a block height: `line`, `block`, `avatar`, `btn`.
 */
export function Skeleton({ tone = 'line', style }) {
  return <span className={`skeleton skeleton--${tone}`} style={style} aria-hidden="true" />;
}

/**
 * Standard card skeleton used while metrics/charts load.
 */
export function CardSkeleton({ showChart = false }) {
  return (
    <div className="card card--skeleton" aria-hidden="true">
      <Skeleton tone="line" style={{ width: '40%' }} />
      <Skeleton tone="metric" style={{ width: '55%', marginTop: '0.9rem' }} />
      {showChart && <Skeleton tone="block" style={{ height: '96px', marginTop: '1rem' }} />}
    </div>
  );
}

/**
 * Skeleton set that mirrors a grid of metric/chart cards.
 */
export function GridSkeleton({ count = 4, showChart = false }) {
  return (
    <div className="grid-cards" role="status" aria-label="Loading content">
      {Array.from({ length: count }, (_, i) => <CardSkeleton key={i} showChart={showChart} />)}
    </div>
  );
}