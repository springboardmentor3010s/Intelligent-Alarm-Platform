import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getDueAlarms, isDemoActive } from "../services/api";
import { showAlarmBrowserNotification } from "../services/notificationService";

export default function AlarmWatcher() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeAlert, setActiveAlert] = useState(null);
  const audioRef = useRef(null);
  const notifiedAlarmKeys = useRef(new Set());
  const locationRef = useRef(location.pathname);
  const isCheckingRef = useRef(false);

  // Keep locationRef synchronized without re-binding the background timer loop
  useEffect(() => {
    locationRef.current = location.pathname;
    // Auto-dismiss banner if user arrives at cognitive alarm page
    if (location.pathname === "/cognitive-alarm") {
      setActiveAlert(null);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;
    let worker = null;
    let fallbackInterval = null;

    async function checkAlarms() {
      if (isCheckingRef.current || !isMounted) return;

      const token = localStorage.getItem("access_token");
      const demo = isDemoActive();
      if (!token && !demo) return;

      isCheckingRef.current = true;

      try {
        const todayStr = new Date().toISOString().slice(0, 10);

        // 1. Primary check: Query backend /api/alarms/triggers/due
        // This evaluates user timezone, tolerance window (3 mins), repeat patterns,
        // duplicate protection, and creates the persistent notification in PostgreSQL.
        const res = await getDueAlarms();
        const dueList = Array.isArray(res?.due_alarms) ? res.due_alarms : [];

        if (dueList.length > 0) {
          for (const dueAlarm of dueList) {
            const alarmId = dueAlarm.alarm_id || dueAlarm.id;
            const notificationKey = `notified_${alarmId}_${todayStr}`;

            if (notifiedAlarmKeys.current.has(notificationKey)) {
              continue;
            }
            notifiedAlarmKeys.current.add(notificationKey);

            console.info(`[AlarmWatcher] Due alarm detected and triggered: ID #${alarmId} ('${dueAlarm.alarm_name}')`);

            // Dispatch browser Web Notification (utilizes Service Worker if active)
            showAlarmBrowserNotification(
              {
                id: alarmId,
                name: dueAlarm.alarm_name,
              },
              () => {
                navigate(dueAlarm.target_route || `/cognitive-alarm?alarmId=${alarmId}`);
              }
            );

            // If user is currently not on the CognitiveAlarm page, activate in-app floating banner & sound
            if (locationRef.current !== "/cognitive-alarm") {
              setActiveAlert({
                id: alarmId,
                name: dueAlarm.alarm_name,
                challenge_type: dueAlarm.challenge_type,
                difficulty: dueAlarm.difficulty,
                target_route: dueAlarm.target_route || `/cognitive-alarm?alarmId=${alarmId}`,
              });

              // Play audio alert
              const soundPref = localStorage.getItem("alarm_sound_enabled");
              if (soundPref !== "false") {
                try {
                  if (!audioRef.current) {
                    audioRef.current = new Audio("/alarm.mp3");
                    audioRef.current.loop = true;
                  }
                  audioRef.current.play().catch((audioErr) => {
                    console.debug("[AlarmWatcher] Background audio play deferred:", audioErr);
                  });
                } catch (e) {
                  console.debug("[AlarmWatcher] Audio init note:", e);
                }
              }
            }
            break;
          }
        }
      } catch (err) {
        console.debug("[AlarmWatcher] Periodic check notice:", err);
      } finally {
        isCheckingRef.current = false;
      }
    }

    // Run initial check immediately
    checkAlarms();

    // 2. High-precision background ticking using an inline Web Worker.
    // Dedicated Web Worker timers are NOT throttled to 1-minute intervals by
    // Chromium / WebKit when the tab is backgrounded or hidden.
    try {
      const workerBlob = new Blob(
        [
          `let t = null;
           self.onmessage = function(e) {
             if (e.data === 'START') {
               if (t) clearInterval(t);
               t = setInterval(function() { self.postMessage('TICK'); }, 8000);
             } else if (e.data === 'STOP') {
               if (t) clearInterval(t);
               t = null;
             }
           };`,
        ],
        { type: "application/javascript" }
      );
      const workerUrl = URL.createObjectURL(workerBlob);
      worker = new Worker(workerUrl);
      worker.onmessage = () => {
        if (isMounted) checkAlarms();
      };
      worker.postMessage("START");
    } catch (workerErr) {
      console.debug("[AlarmWatcher] Web Worker background timer unavailable, falling back to interval:", workerErr);
    }

    // 3. Fallback / companion interval on window (10 seconds)
    fallbackInterval = setInterval(checkAlarms, 10000);

    // 4. Catch-up listeners: check immediately when tab becomes visible or focused
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkAlarms();
      }
    };
    const handleWindowFocus = () => {
      checkAlarms();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isMounted = false;
      if (worker) {
        try {
          worker.postMessage("STOP");
          worker.terminate();
        } catch (workerErr) {
          console.debug("[AlarmWatcher] Worker stop note:", workerErr);
        }
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [navigate]);

  function handleOpenAlarm() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (activeAlert) {
      const target = activeAlert.target_route || `/cognitive-alarm?alarmId=${activeAlert.id}`;
      setActiveAlert(null);
      navigate(target);
    }
  }

  function handleDismissBanner() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setActiveAlert(null);
  }

  if (!activeAlert) {
    return null;
  }

  return (
    <aside
      className="alarm-floating-trigger-banner"
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 99999,
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
        border: "2px solid #818cf8",
        borderRadius: "16px",
        padding: "16px 20px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(129, 140, 248, 0.4)",
        color: "#ffffff",
        maxWidth: "420px",
        animation: "pulseBanner 1.5s infinite alternate ease-in-out",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "2rem" }}>⏰</span>
        <div>
          <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#e0e7ff" }}>
            Wake Up — Cognitive Challenge
          </h4>
          <p style={{ margin: "2px 0 0", fontSize: "0.88rem", color: "#c7d2fe" }}>
            Alarm <strong>'{activeAlert.name}'</strong> is ringing!
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
        <button
          onClick={handleOpenAlarm}
          style={{
            flex: 1,
            background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 14px",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
          }}
        >
          🧠 Open Alarm & Challenge
        </button>
        <button
          onClick={handleDismissBanner}
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            color: "#e2e8f0",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
