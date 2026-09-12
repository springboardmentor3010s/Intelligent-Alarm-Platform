import React from 'react';
import { LandingSection } from './primitives';

/* Product screenshots that drift around the arena like a bean-flinger game:
   each tile bobs on its own orbit with its own duration, delay, drift and tilt. */
const FLOATING_TILES = [
  { x: '6%',  y: '16%', w: 150, dur: 12, delay: 0.0, rot: -7,  dx: 14, dy: 8,   dx2: 4,   dy2: 20,  tilt: 4,  tilt2: -3 },
  { x: '14%', y: '62%', w: 140, dur: 10, delay: 0.6, rot: 5,   dx: 12, dy: -14, dx2: -8,  dy2: 8,   tilt: -5, tilt2: 2 },
  { x: '27%', y: '8%',  w: 160, dur: 13, delay: 1.2, rot: -10, dx: -10, dy: 16,  dx2: 12,  dy2: -4,  tilt: 6,  tilt2: -3 },
  { x: '24%', y: '74%', w: 120, dur: 9,  delay: 0.4, rot: 9,   dx: 14, dy: 10,  dx2: -6,  dy2: -12, tilt: -4, tilt2: 3 },
  { x: '40%', y: '18%', w: 150, dur: 11, delay: 2.0, rot: -4,  dx: -14, dy: 12, dx2: 8,   dy2: -16, tilt: 3,  tilt2: -2 },
  { x: '46%', y: '56%', w: 135, dur: 12, delay: 1.6, rot: 6,   dx: 10, dy: -12, dx2: -10, dy2: 6,   tilt: -3, tilt2: 4 },
  { x: '58%', y: '10%', w: 145, dur: 10, delay: 0.9, rot: -8,  dx: 12, dy: 14,  dx2: -12, dy2: 4,   tilt: 5,  tilt2: -4 },
  { x: '63%', y: '66%', w: 165, dur: 14, delay: 2.4, rot: 3,   dx: -12, dy: -10, dx2: 10,  dy2: 12,  tilt: -6, tilt2: 3 },
  { x: '76%', y: '22%', w: 140, dur: 11, delay: 1.0, rot: -5,  dx: -8, dy: 12,  dx2: 12,  dy2: -12, tilt: 4,  tilt2: -2 },
  { x: '82%', y: '60%', w: 130, dur: 12, delay: 0.2, rot: 8,   dx: 10, dy: -14, dx2: -8,  dy2: 8,   tilt: -4, tilt2: 5 },
  { x: '88%', y: '36%', w: 120, dur: 10, delay: 1.8, rot: -6,  dx: -12, dy: 8,  dx2: 6,   dy2: -8,  tilt: 3,  tilt2: -3 },
  { x: '8%',  y: '40%', w: 125, dur: 11, delay: 0.8, rot: 4,   dx: 14, dy: 10,  dx2: -10, dy2: -14, tilt: -3, tilt2: 4 },
  { x: '52%', y: '30%', w: 150, dur: 13, delay: 2.6, rot: -3,  dx: -10, dy: -12, dx2: 12,  dy2: 16,  tilt: 5,  tilt2: -4 },
  { x: '92%', y: '10%', w: 140, dur: 12, delay: 1.4, rot: 7,   dx: -14, dy: 12,  dx2: 10,  dy2: -6,  tilt: -5, tilt2: 3 },
];

const pad = n => String(n).padStart(2, '0');

/**
 * Floating product gallery. All 14 web/app screens drift in the arena on
 * independent orbits (bean-flinger style); hovering a card catches and
 * scales it. Purely decorative and accessibility-silent.
 */
export default function FloatingGallery() {
  return (
    <LandingSection
      id="floating"
      eyebrow="The full suite"
      title="One product, floating together."
      subtitle="Web dashboard, mobile app and lock-screen alarms orbiting a single command center. Hover a card to catch it."
    >
      <div className="lp-fling">
        <div className="lp-fling__arena" role="img" aria-label="Floating preview of all CerebroKognit screens">
          {FLOATING_TILES.map((t, i) => (
            <div
              key={i}
              className="lp-fling__tile"
              aria-hidden="true"
              style={{
                left: t.x,
                top: t.y,
                '--w': `${t.w}px`,
                '--dur': `${t.dur}s`,
                '--delay': `${t.delay}s`,
                '--rot': `${t.rot}deg`,
                '--dx': `${t.dx}px`,
                '--dy': `${t.dy}px`,
                '--dx2': `${t.dx2}px`,
                '--dy2': `${t.dy2}px`,
                '--tilt': `${t.tilt}deg`,
                '--tilt2': `${t.tilt2}deg`,
              }}
            >
              <img src={`/floating/screen-${pad(i + 1)}.webp`} alt="" draggable={false} loading="lazy" />
            </div>
          ))}
          <div className="lp-fling__hint" aria-hidden="true">
            <span className="led led--on led--live" /> 14 screens · one morning
          </div>
        </div>
      </div>
    </LandingSection>
  );
}