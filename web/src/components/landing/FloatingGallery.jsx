import React, { useLayoutEffect, useRef } from 'react';
import { LandingSection } from './primitives';

/* Screen tiles that drift around the arena like a bean-flinger game: every
   tile keeps moving on its own vector, bounces off the arena edges, and
   rotates slowly for the whole trip. Nothing is ever parked or still. */
const TILES = [
  { x: 6, y: 16, w: 150 },
  { x: 14, y: 62, w: 140 },
  { x: 27, y: 8, w: 160 },
  { x: 24, y: 74, w: 120 },
  { x: 40, y: 18, w: 150 },
  { x: 46, y: 56, w: 135 },
  { x: 58, y: 10, w: 145 },
  { x: 63, y: 66, w: 165 },
  { x: 76, y: 22, w: 140 },
  { x: 82, y: 60, w: 130 },
  { x: 88, y: 36, w: 120 },
  { x: 8, y: 40, w: 125 },
  { x: 52, y: 30, w: 150 },
  { x: 92, y: 10, w: 140 },
];

const pad = n => String(n).padStart(2, '0');

/**
 * Floating product gallery. All 14 web/app screens wander the arena on
 * independent vectors, bounce off the edges and spin slowly, so they glide
 * from corner to corner without ever leaving the space or stopping. Purely
 * decorative and accessibility-silent; motion is disabled for
 * prefers-reduced-motion.
 */
export default function FloatingGallery() {
  const arenaRef = useRef(null);
  const tilesRef = useRef([]);

  useLayoutEffect(() => {
    const arena = arenaRef.current;
    if (!arena || tilesRef.current.length < TILES.length) return undefined;

    const box = arena.getBoundingClientRect();
    if (!box.width || !box.height) return undefined;

    const w = Math.max(0, box.width);
    const h = Math.max(0, box.height);

    const state = TILES.map((t, i) => {
      const x0 = (t.x / 100) * w - t.w / 2;
      const y0 = (t.y / 100) * h - t.w / 2;
      return {
        el: tilesRef.current[i],
        x: x0,
        y: y0,
        vx: (i % 2 === 0 ? 1 : -1) * (28 + (i % 5) * 9),
        vy: (i % 3 === 0 ? 1 : -1) * (22 + (i % 4) * 8),
        rot: (i % 5) * 7 - 14,
        rs: (i % 2 === 0 ? 1 : -1) * (5 + (i % 3) * 3),
        w: t.w,
      };
    });

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      state.forEach(s => {
        s.el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0) rotate(${s.rot}deg)`;
      });
      return undefined;
    }

    let raf = 0;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      const r = arena.getBoundingClientRect();
      const W = r.width || w;
      const H = r.height || h;
      state.forEach(s => {
        s.x += s.vx / 60;
        s.y += s.vy / 60;
        s.rot += s.rs / 60;
        const maxX = Math.max(0, W - s.w);
        const maxY = Math.max(0, H - s.w);
        if (s.x < 0) { s.x = 0; s.vx = Math.abs(s.vx); }
        else if (s.x > maxX) { s.x = maxX; s.vx = -Math.abs(s.vx); }
        if (s.y < 0) { s.y = 0; s.vy = Math.abs(s.vy); }
        else if (s.y > maxY) { s.y = maxY; s.vy = -Math.abs(s.vy); }
        s.el.style.transform =
          `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0) rotate(${s.rot.toFixed(2)}deg)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <LandingSection
      id="floating"
      eyebrow="The full suite"
      title="One product, floating together."
      subtitle="Web dashboard, mobile app and lock-screen alarms drifting around a single command center. Hover a card to catch it."
    >
      <div className="lp-fling">
        <div className="lp-fling__arena" ref={arenaRef} role="img" aria-label="Floating preview of all CerebroKognit screens">
          {TILES.map((t, i) => (
            <div
              key={i}
              ref={el => { tilesRef.current[i] = el; }}
              className="lp-fling__tile"
              aria-hidden="true"
              style={{ '--w': `${t.w}px` }}
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