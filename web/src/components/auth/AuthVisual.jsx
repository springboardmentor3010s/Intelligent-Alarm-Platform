import React from 'react';

/**
 * Decorative "cognitive wake signal" for the auth brand panel: an abstract
 * EEG-like waveform with two traveling traces, ghost guide rails, a leading
 * pulse with comet tails on each trace, neuron nodes, and static constellation
 * dots. Purely illustrative (aria-hidden); every animation is disabled by CSS
 * under prefers-reduced-motion.
 */
export default function AuthVisual() {
  const primary =
    'M0 92 L40 92 Q 62 92 74 80 Q 86 66 98 74 Q 112 84 128 78 Q 146 70 164 88 Q 186 110 208 96 Q 232 80 256 88 Q 284 96 308 72 Q 330 52 352 66 Q 378 84 406 74 Q 434 64 462 82 Q 482 98 504 88 Q 526 78 560 84';
  const echo =
    'M0 128 L56 128 Q 80 128 96 140 Q 112 150 130 144 Q 150 138 172 148 Q 196 160 220 150 Q 248 138 276 146 Q 304 154 330 136 Q 352 122 376 132 Q 404 144 432 136 Q 460 128 488 142 Q 508 152 560 138';
  return (
    <div className="auth-visual" aria-hidden="true">
      <svg viewBox="0 0 560 180" role="presentation" focusable="false">
        {/* Ghost guide rails keep both traces readable as full-row snakes */}
        <path className="auth-visual__ghost auth-visual__ghost--1" d={primary} pathLength="1" />
        <path className="auth-visual__ghost auth-visual__ghost--2" d={echo} pathLength="1" />

        {/* Ambient dotted trace (subtle, slow) */}
        <g className="auth-visual__line auth-visual__line--3">
          <path d="M0 120 Q 40 60 80 84 T 160 96 T 240 108 T 320 60 T 400 96 T 480 66 T 560 90" pathLength="1" />
        </g>

        {/* Primary wake trace */}
        <g className="auth-visual__line auth-visual__line--1">
          <path d={primary} pathLength="1" id="auth-prime-trace" />
        </g>

        {/* Echo trace (offset, softer) */}
        <g className="auth-visual__line auth-visual__line--2">
          <path d={echo} pathLength="1" />
        </g>

        {/* Neuron nodes */}
        <circle className="auth-visual__node" cx="208" cy="96" r="3.5" />
        <circle className="auth-visual__node" cx="308" cy="72" r="4" />
        <circle className="auth-visual__node" cx="406" cy="74" r="3" />

        {/* Traveling pulses + comet tails ride both traces */}
        <g className="auth-visual__pulse">
          <circle className="auth-visual__travel" r="4" />
          <circle className="auth-visual__comet is-a" r="2.6" />
          <circle className="auth-visual__comet is-b" r="1.8" />
        </g>
        <g className="auth-visual__pulse auth-visual__pulse--2">
          <circle className="auth-visual__travel auth-visual__travel--2" r="3.5" />
          <circle className="auth-visual__comet auth-visual__comet--2 is-a" r="2.2" />
          <circle className="auth-visual__comet auth-visual__comet--2 is-b" r="1.5" />
        </g>

        {/* Static constellation dots */}
        <circle className="auth-visual__const" cx="120" cy="40" r="1.8" />
        <circle className="auth-visual__const" cx="240" cy="166" r="1.6" />
        <circle className="auth-visual__const" cx="368" cy="34" r="2" />
        <circle className="auth-visual__const--mint" cx="448" cy="150" r="2" />
        <circle className="auth-visual__const--mint" cx="512" cy="46" r="1.7" />
      </svg>
      <span className="auth-visual__label">Adaptive protocol · cognitive wake</span>
    </div>
  );
}