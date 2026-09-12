import React from 'react';
import {
  AlarmClockIcon,
  BarChartIcon,
  BatteryIcon,
  FlameIcon,
  HomeIcon,
  TargetIcon,
  WifiIcon,
  ZapIcon,
} from '../ui';
import { DemoPill } from './primitives';

/**
 * Realistic phone mockup — a device bezel wrapping a genuine app layout
 * (status bar, greeting, habit ring, challenge card, bottom nav).
 * Pure CSS/SVG, no stock images. Decorative: hidden from the accessibility
 * tree; the browser dashboard beside it carries the real content.
 */
export default function PhoneMock() {
  return (
    <div className="lp-show__phone" aria-hidden="true">
      <div className="lp-show__phone-outer">
        <div className="lp-show__phone-frame">
          <div className="lp-show__phone-screen">
            <span className="lp-show__phone-island">
              <i className="lp-show__phone-lens" />
            </span>
            <span className="lp-show__phone-speaker" aria-hidden="true" />
          <div className="lp-show__phone-topbar">
            <span className="tabular">9:41</span>
            <span className="lp-show__phone-signal">
              <WifiIcon size={11} />
              <BatteryIcon size={15} />
            </span>
          </div>
          <div className="lp-show__phone-app">
            <div className="lp-show__phone-greet">
              <span className="sys-label">Good morning</span>
              <strong>Pawan Simha R</strong>
            </div>
            <div className="lp-show__phone-clock">
              <strong className="tabular">07:05</strong>
              <span>Next wake window</span>
            </div>
            <div className="lp-show__phone-scores">
              <span className="lp-show__ring lp-show__ring--sm">
                <svg viewBox="0 0 120 120">
                  <circle className="lp-show__ring-track" cx="60" cy="60" r="52" />
                  <circle
                    className="lp-show__ring-fill"
                    cx="60"
                    cy="60"
                    r="52"
                    strokeDasharray="326.7"
                    strokeDashoffset="97.7"
                  />
                </svg>
                <span className="lp-show__ring-num">
                  <strong className="tabular">70</strong>
                  <span>/100</span>
                </span>
              </span>
              <div className="lp-show__phone-stats">
                <span className="lp-show__phone-stat lp-show__phone-stat--streak">
                  <FlameIcon size={12} /> 6-day streak
                </span>
                <span className="lp-show__phone-stat">
                  <ZapIcon size={12} /> 92% accuracy
                </span>
              </div>
            </div>
            <div className="lp-show__phone-card">
              <span className="sys-label">Dismiss question</span>
              <strong className="lp-show__phone-card-q">7 + 3 = ?</strong>
              <div className="lp-show__phone-options">
                <span>10</span>
                <span>11</span>
                <span>12</span>
              </div>
              <span className="lp-show__phone-solve">Solve to unlock dismissal</span>
            </div>
            <div className="lp-show__phone-nav">
              <span className="is-on"><HomeIcon size={17} /></span>
              <span><AlarmClockIcon size={17} /></span>
              <span><BarChartIcon size={17} /></span>
              <span><TargetIcon size={17} /></span>
            </div>
          </div>
        </div>
      </div>
      </div>
      <DemoPill>Mobile preview</DemoPill>
    </div>
  );
}