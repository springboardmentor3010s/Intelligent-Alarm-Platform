/**
 * Web Audio Alarm Engine
 * Provides synthesized alarm sounds for each persona role without requiring external audio files.
 * Handles browser autoplay policies and audio context resumption.
 */

export function createAlarmEngine() {
  let ctx = null;
  let running = false;
  let intervalId = null;
  let oscList = [];
  let currentRole = "STANDARD";

  const getContext = () => {
    if (!ctx || ctx.state === "closed") {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  };

  // Helper to safely play a synthesized tone
  const playTone = (frequency, duration, volume = 0.5, type = "square") => {
    try {
      const audioCtx = getContext();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + duration + 0.05);

      oscList.push(osc);
      setTimeout(() => {
        oscList = oscList.filter(o => o !== osc);
      }, (duration + 0.1) * 1000);
    } catch (err) {
      console.warn("Audio synthesis error:", err);
    }
  };

  // Persona Sound Patterns
  const PATTERNS = {
    DRILL_SERGEANT: () => {
      // Rapid urgent triple alarm siren
      playTone(1100, 0.08, 0.65, "sawtooth");
      setTimeout(() => playTone(1400, 0.08, 0.65, "sawtooth"), 100);
      setTimeout(() => playTone(1100, 0.08, 0.65, "sawtooth"), 200);
      setTimeout(() => playTone(1400, 0.12, 0.7, "sawtooth"), 300);
    },
    ZEN_GURU: () => {
      // Resonant harmonic singing bowl chimes
      playTone(528, 0.6, 0.35, "sine");
      setTimeout(() => playTone(432, 0.7, 0.3, "sine"), 350);
      setTimeout(() => playTone(660, 0.5, 0.2, "sine"), 700);
    },
    CORPORATE_EXEC: () => {
      // Crisp 3-note executive triad chime
      playTone(880, 0.12, 0.5, "triangle");
      setTimeout(() => playTone(1046.5, 0.12, 0.5, "triangle"), 140);
      setTimeout(() => playTone(1318.5, 0.2, 0.5, "triangle"), 280);
    },
    MAD_SCIENTIST: () => {
      // Sci-fi arpeggiated laser pulses
      [700, 950, 1300, 1600, 1100].forEach((freq, idx) => {
        setTimeout(() => playTone(freq, 0.09, 0.55, "square"), idx * 80);
      });
    },
    FITNESS_COACH: () => {
      // High-energy double whistle pulse
      playTone(1000, 0.1, 0.6, "square");
      setTimeout(() => playTone(1300, 0.15, 0.65, "square"), 130);
    },
    STANDARD: () => {
      // Classic digital clock alarm beep-beep
      playTone(880, 0.14, 0.5, "square");
      setTimeout(() => playTone(880, 0.14, 0.5, "square"), 160);
    }
  };

  const INTERVALS = {
    DRILL_SERGEANT: 750,
    ZEN_GURU: 2200,
    CORPORATE_EXEC: 1300,
    MAD_SCIENTIST: 1000,
    FITNESS_COACH: 900,
    STANDARD: 1200
  };

  // Add one-time user gesture unlock for browser autoplay policy
  const unlockAudioContext = () => {
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("click", unlockAudioContext, { once: true });
    window.addEventListener("keydown", unlockAudioContext, { once: true });
    window.addEventListener("touchstart", unlockAudioContext, { once: true });
  }

  return {
    start(role = "STANDARD") {
      currentRole = role;
      getContext();
      if (running) {
        if (intervalId) clearInterval(intervalId);
      }
      running = true;

      const pattern = PATTERNS[role] || PATTERNS.STANDARD;
      const interval = INTERVALS[role] || 1200;

      // Play initial burst immediately
      pattern();
      intervalId = setInterval(() => {
        if (running) pattern();
      }, interval);
    },

    stop() {
      running = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      oscList.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch (_) {}
      });
      oscList = [];
    },

    get isRunning() {
      return running;
    },

    get activeRole() {
      return currentRole;
    }
  };
}

// Export a singleton instance for global sound playback across tabs
export const globalAlarmAudio = createAlarmEngine();
