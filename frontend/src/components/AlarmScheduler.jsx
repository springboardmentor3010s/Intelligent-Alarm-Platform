
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../ring.css";
import { apiFetch } from "../api";
import { findDue } from "../alarmClock";
import { useAuth } from "../auth";
import { CHALLENGE_LABELS, ErrorBox, formatClock } from "./ui";

const FIRED_KEY = "ca_fired_alarms";

function loadFired() {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveFired(map) {
  const newest = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  try {
    localStorage.setItem(
      FIRED_KEY,
      JSON.stringify(Object.fromEntries(newest))
    );
  } catch {
    // Local storage may be unavailable.
  }
}

// AUDIO

let audioCtx = null;
let ringTimer = null;
let activeOscillators = new Set();

export async function unlockAudio() {
  try {
    if (typeof window === "undefined") return false;

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      console.error("Web Audio API is not supported.");
      return false;
    }

    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    return audioCtx.state === "running";
  } catch (error) {
    console.error("Could not enable alarm audio:", error);
    return false;
  }
}

function beep() {
  const context = audioCtx;

  if (!context || context.state !== "running") {
    return false;
  }

  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.35,
      context.currentTime + 0.025
    );
    gain.gain.setValueAtTime(
      0.35,
      context.currentTime + 0.2
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + 0.4
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    activeOscillators.add(oscillator);

    oscillator.onended = () => {
      activeOscillators.delete(oscillator);

      try {
        oscillator.disconnect();
        gain.disconnect();
      } catch {
        // Already disconnected.
      }
    };

    oscillator.start();
    oscillator.stop(context.currentTime + 0.42);

    return true;
  } catch (error) {
    console.error("Could not play alarm sound:", error);
    return false;
  }
}

function stopRing() {
  if (ringTimer !== null) {
    window.clearInterval(ringTimer);
    ringTimer = null;
  }

  activeOscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch {
      // Oscillator may already have stopped.
    }
  });

  activeOscillators.clear();

  if (
    typeof navigator !== "undefined" &&
    "vibrate" in navigator
  ) {
    try {
      navigator.vibrate(0);
    } catch {
      // Vibration is optional.
    }
  }
}

function startRing(onBlocked) {
  stopRing();

  const play = () => {
    const played = beep();
    onBlocked(!played);

    if (
      typeof navigator !== "undefined" &&
      "vibrate" in navigator
    ) {
      try {
        navigator.vibrate([300, 150, 300]);
      } catch {
        // Vibration is optional.
      }
    }
  };

  play();
  ringTimer = window.setInterval(play, 700);
}

// DESKTOP NOTIFICATIONS

export function notificationState() {
  if (
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }

  return Notification.permission;
}

export function enableNotifications() {
  if (
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    return Promise.resolve("unsupported");
  }

  return Notification.requestPermission();
}

// ALARM SCHEDULER

function AlarmScheduler() {
  const { user, checking } = useAuth();
  const navigate = useNavigate();

  const alarmsRef = useRef([]);
  const snoozedRef = useRef([]);
  const firedRef = useRef(loadFired());
  const ringingRef = useRef(null);
  const tickRef = useRef(() => {});

  const [ringing, setRinging] = useState(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [snoozesLeft, setSnoozesLeft] = useState(null);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  // Load enabled alarms from the backend.
  const loadAlarms = useCallback(async () => {
    if (checking || !user?.id) {
      alarmsRef.current = [];
      return;
    }

    try {
      const list = await apiFetch(`/alarms/user/${user.id}`);

      if (!Array.isArray(list)) {
        console.error(
          "Unexpected alarm list returned by the server."
        );
        return;
      }

      alarmsRef.current = list.filter(
        (alarm) => alarm.enabled && alarm.next_trigger
      );
    } catch (error) {
      console.error("Failed to load alarms:", error.message);
    }
  }, [user?.id, checking]);

  // Trigger an alarm.
  const fire = useCallback(
    async (alarm, key, snoozeItem) => {
      if (!alarm || ringingRef.current || !user?.id) {
        return;
      }

      ringingRef.current = alarm;

      if (snoozeItem) {
        snoozedRef.current = snoozedRef.current.filter(
          (item) => item !== snoozeItem
        );
      }

      if (key) {
        firedRef.current[key] = Date.now();
        saveFired(firedRef.current);
      }

      setRinging(alarm);
      setMessage("");
      setSnoozesLeft(null);
      setSoundBlocked(false);

      // Start the alarm sound.
      startRing(setSoundBlocked);

      // Show a desktop notification if the page is hidden.
      if (
        document.hidden &&
        notificationState() === "granted"
      ) {
        try {
          const notification = new Notification(
            `Alarm: ${alarm.title}`,
            {
              body:
                "Your alarm is ringing. Open the app to complete your wake-up challenge.",
              requireInteraction: true,
              tag: `alarm-${alarm.id}`,
            }
          );

          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch (error) {
          console.warn(
            "Desktop notification failed:",
            error
          );
        }
      }

      // Record the alarm trigger on the backend.
      try {
        const result = await apiFetch(
          `/alarms/${alarm.id}/trigger`,
          { method: "POST" }
        );

        if (ringingRef.current?.id === alarm.id) {
          setSnoozesLeft(result.snoozes_remaining);
        }
      } catch (error) {
        console.error(
          "Could not record the alarm trigger:",
          error.message
        );
      }

      await loadAlarms();
    },
    [loadAlarms, user?.id]
  );

  // Check whether an alarm is due.
  tickRef.current = () => {
    if (checking || !user?.id || ringingRef.current) {
      return;
    }

    const due = findDue(
      alarmsRef.current,
      snoozedRef.current,
      firedRef.current,
      Date.now()
    );

    if (due) {
      fire(due.alarm, due.key, due.snoozeItem);
    }
  };

  // Refresh alarms periodically and when the page becomes active.
  useEffect(() => {
    if (checking || !user?.id) {
      alarmsRef.current = [];
      return undefined;
    }

    loadAlarms();

    const refreshTimer = window.setInterval(
      loadAlarms,
      15000
    );

    const onVisible = () => {
      if (!document.hidden) {
        loadAlarms();
      }
    };

    window.addEventListener("alarms-changed", loadAlarms);
    window.addEventListener("focus", loadAlarms);

    document.addEventListener(
      "visibilitychange",
      onVisible
    );

    return () => {
      window.clearInterval(refreshTimer);

      window.removeEventListener(
        "alarms-changed",
        loadAlarms
      );

      window.removeEventListener("focus", loadAlarms);

      document.removeEventListener(
        "visibilitychange",
        onVisible
      );
    };
  }, [user?.id, checking, loadAlarms]);

  // Keep checking the clock using a Web Worker.
  useEffect(() => {
    if (checking || !user?.id) {
      return undefined;
    }

    let worker = null;
    let timer = null;
    let workerUrl = null;

    try {
      const workerCode = `
        setInterval(() => {
          postMessage("tick");
        }, 1000);
      `;

      const blob = new Blob([workerCode], {
        type: "application/javascript",
      });

      workerUrl = URL.createObjectURL(blob);
      worker = new Worker(workerUrl);

      worker.onmessage = () => tickRef.current();

      worker.onerror = (error) => {
        console.error(
          "Alarm clock worker failed:",
          error.message
        );

        if (!timer) {
          timer = window.setInterval(
            () => tickRef.current(),
            1000
          );
        }

        if (worker) {
          worker.terminate();
          worker = null;
        }
      };
    } catch (error) {
      console.warn(
        "Web Worker unavailable; using a regular timer:",
        error
      );

      timer = window.setInterval(
        () => tickRef.current(),
        1000
      );
    }

    return () => {
      if (worker) worker.terminate();

      if (workerUrl) {
        URL.revokeObjectURL(workerUrl);
      }

      if (timer !== null) {
        window.clearInterval(timer);
      }

      stopRing();
      ringingRef.current = null;
    };
  }, [user?.id, checking]);

  // Enable audio after ordinary user interaction.
  // No visible sound-test button is displayed.
  useEffect(() => {
    const handleInteraction = async () => {
      await unlockAudio();
    };

    window.addEventListener(
      "pointerdown",
      handleInteraction
    );

    window.addEventListener(
      "keydown",
      handleInteraction
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        handleInteraction
      );

      window.removeEventListener(
        "keydown",
        handleInteraction
      );
    };
  }, []);

  // Automatically dismiss toast messages.
  useEffect(() => {
    if (!toast) return undefined;

    const timer = window.setTimeout(
      () => setToast(""),
      4000
    );

    return () => window.clearTimeout(timer);
  }, [toast]);

  // Stop the ringing sound and clear the active alarm.
  const clearRinging = useCallback(() => {
    stopRing();

    ringingRef.current = null;

    setRinging(null);
    setSoundBlocked(false);
    setMessage("");
  }, []);

  // Navigate to the wake-up challenge.
  const startChallenge = () => {
    if (!ringing) return;

    const alarm = ringing;
    const remaining = snoozesLeft;

    clearRinging();

    navigate("/wake-up-verification", {
      state: {
        alarmId: alarm.id,
        snoozesLeft: remaining,
      },
    });
  };

  // Snooze the active alarm.
  const snooze = async () => {
    if (!ringing || busy) return;

    setBusy(true);
    setMessage("");

    try {
      const result = await apiFetch(
        `/alarms/${ringing.id}/snooze`,
        { method: "POST" }
      );

      const minutes =
        Number(result.snooze_minutes) || 5;

      snoozedRef.current.push({
        alarm: ringing,
        at: Date.now() + minutes * 60 * 1000,
      });

      const title = ringing.title;

      clearRinging();

      setToast(
        `"${title}" snoozed for ${minutes} minutes.`
      );
    } catch (error) {
      setMessage(
        error.message || "Could not snooze this alarm."
      );

      setSnoozesLeft(0);
    } finally {
      setBusy(false);
    }
  };

  if (checking || !user?.id) {
    return null;
  }

  return (
    <>
      {/* Snooze confirmation */}
      {toast && (
        <div className="ring-toast" role="status">
          {toast}
        </div>
      )}

      {/* Active alarm modal */}
      {ringing && (
        <div
          className="modal-backdrop ring-backdrop"
          onPointerDown={async () => {
            const enabled = await unlockAudio();

            if (enabled) {
              setSoundBlocked(false);
            }
          }}
          role="presentation"
        >
          <div
            className="modal ring-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-alarm-title"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="ring-icon" aria-hidden="true">
              ⏰
            </div>

            <h2 id="active-alarm-title">
              {ringing.title}
            </h2>

            <p className="ring-time">
              {formatClock(ringing.alarm_time).time}{" "}
              {formatClock(ringing.alarm_time).period}
            </p>

            <p>
              Time to wake up! Complete your{" "}
              {(
                CHALLENGE_LABELS[ringing.challenge_type] ||
                "wake-up"
              ).toLowerCase()}{" "}
              challenge to dismiss this alarm.
            </p>

            {/* Show audio warning only if playback fails */}
            {soundBlocked && (
              <div className="rec-basis" role="alert">
                <p>
                  Alarm audio is not playing. Click or tap
                  the alarm window to allow audio, and check
                  your browser and system volume.
                </p>
              </div>
            )}

            <ErrorBox message={message} />

            <button
              type="button"
              className="generate-button"
              onClick={startChallenge}
            >
              Start wake-up challenge
            </button>

            <button
              type="button"
              className="small-button"
              onClick={snooze}
              disabled={busy || snoozesLeft === 0}
            >
              {busy
                ? "Snoozing..."
                : snoozesLeft === 0
                  ? "No snoozes left"
                  : `Snooze 5 min${
                      snoozesLeft !== null
                        ? ` (${snoozesLeft} left)`
                        : ""
                    }`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default AlarmScheduler;
