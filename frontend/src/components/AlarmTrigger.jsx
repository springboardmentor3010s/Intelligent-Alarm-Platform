
import { useEffect, useRef, useState } from "react";

function AlarmTrigger() {
  const [triggeredAlarm, setTriggeredAlarm] = useState(null);
  const [showChallenge, setShowChallenge] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const audioContextRef = useRef(null);
  const alarmIntervalRef = useRef(null);
  const soundIntervalRef = useRef(null);
  const soundTimeoutRef = useRef(null);
  const triggeredRef = useRef(false);
  const email = localStorage.getItem("email");

  // =====================================================
  // CHALLENGE DATA
  // =====================================================

  const challengeData = {
    Math: {
      Beginner: [
        { question: "What is 4 × 3?", answer: "12" },
        { question: "What is 5 + 7?", answer: "12" },
        { question: "What is 10 - 4?", answer: "6" },
        { question: "What is 6 × 2?", answer: "12" },
        { question: "What is 20 ÷ 5?", answer: "4" },
      ],
      Easy: [
        { question: "What is 15 + 27?", answer: "42" },
        { question: "What is 18 × 3?", answer: "54" },
        { question: "What is 72 ÷ 8?", answer: "9" },
        { question: "What is 50 - 17?", answer: "33" },
        { question: "What is 12 × 4?", answer: "48" },
      ],
      Medium: [
        { question: "What is 24 × 15?", answer: "360" },
        { question: "What is 144 ÷ 12?", answer: "12" },
        { question: "What is 35 × 16?", answer: "560" },
        { question: "What is 250 - 87?", answer: "163" },
        { question: "What is 48 × 13?", answer: "624" },
      ],
      Hard: [
        { question: "What is 125 × 16?", answer: "2000" },
        { question: "What is 248 × 25?", answer: "6200" },
        { question: "What is 936 ÷ 18?", answer: "52" },
        { question: "What is 425 × 32?", answer: "13600" },
        { question: "What is 875 - 348?", answer: "527" },
      ],
      Expert: [
        { question: "What is 875 × 64?", answer: "56000" },
        { question: "What is 936 × 47?", answer: "43992" },
        { question: "What is 1248 ÷ 16?", answer: "78" },
        { question: "What is 725 × 38?", answer: "27550" },
        { question: "What is 1485 × 27?", answer: "40095" },
      ],
    },

    "Logic Puzzle": {
      Beginner: [
        { question: "What comes next: 2, 4, 6, 8, ?", answer: "10" },
        { question: "What comes next: 1, 2, 3, 4, ?", answer: "5" },
        { question: "What comes next: 5, 10, 15, 20, ?", answer: "25" },
        { question: "What comes next: 10, 20, 30, 40, ?", answer: "50" },
        { question: "What comes next: 3, 6, 9, 12, ?", answer: "15" },
      ],
      Easy: [
        { question: "What comes next: 5, 10, 15, 20, ?", answer: "25" },
        { question: "What comes next: 10, 15, 20, 25, ?", answer: "30" },
        { question: "What comes next: 2, 5, 8, 11, ?", answer: "14" },
        { question: "What comes next: 7, 14, 21, 28, ?", answer: "35" },
        { question: "What comes next: 20, 18, 16, 14, ?", answer: "12" },
      ],
      Medium: [
        { question: "What comes next: 3, 6, 12, 24, ?", answer: "48" },
        { question: "What comes next: 4, 8, 16, 32, ?", answer: "64" },
        { question: "What comes next: 2, 6, 18, 54, ?", answer: "162" },
        { question: "What comes next: 81, 27, 9, 3, ?", answer: "1" },
        { question: "What comes next: 5, 15, 45, 135, ?", answer: "405" },
      ],
      Hard: [
        { question: "What comes next: 2, 6, 12, 20, 30, ?", answer: "42" },
        { question: "What comes next: 1, 4, 9, 16, 25, ?", answer: "36" },
        { question: "What comes next: 3, 7, 13, 21, 31, ?", answer: "43" },
        { question: "What comes next: 2, 5, 10, 17, 26, ?", answer: "37" },
        { question: "What comes next: 4, 9, 16, 25, 36, ?", answer: "49" },
      ],
      Expert: [
        { question: "What comes next: 3, 8, 15, 24, 35, ?", answer: "48" },
        { question: "What comes next: 2, 7, 14, 23, 34, ?", answer: "47" },
        { question: "What comes next: 1, 5, 11, 19, 29, ?", answer: "41" },
        { question: "What comes next: 4, 10, 18, 28, 40, ?", answer: "54" },
        { question: "What comes next: 2, 9, 20, 35, 54, ?", answer: "77" },
      ],
    },

    Memory: {
      Beginner: [
        { question: "Remember this number: 123. What is the number?", answer: "123" },
        { question: "Remember this number: 456. What is the number?", answer: "456" },
        { question: "Remember this number: 789. What is the number?", answer: "789" },
        { question: "Remember this number: 321. What is the number?", answer: "321" },
        { question: "Remember this number: 654. What is the number?", answer: "654" },
      ],
      Easy: [
        { question: "Remember this number: 4827. What is the number?", answer: "4827" },
        { question: "Remember this number: 6139. What is the number?", answer: "6139" },
        { question: "Remember this number: 2754. What is the number?", answer: "2754" },
        { question: "Remember this number: 8392. What is the number?", answer: "8392" },
        { question: "Remember this number: 5048. What is the number?", answer: "5048" },
      ],
      Medium: [
        { question: "Remember this number: 73915. What is the number?", answer: "73915" },
        { question: "Remember this number: 48261. What is the number?", answer: "48261" },
        { question: "Remember this number: 91537. What is the number?", answer: "91537" },
        { question: "Remember this number: 62483. What is the number?", answer: "62483" },
        { question: "Remember this number: 35791. What is the number?", answer: "35791" },
      ],
      Hard: [
        { question: "Remember this number: 581642. What is the number?", answer: "581642" },
        { question: "Remember this number: 739251. What is the number?", answer: "739251" },
        { question: "Remember this number: 426815. What is the number?", answer: "426815" },
        { question: "Remember this number: 918374. What is the number?", answer: "918374" },
        { question: "Remember this number: 265739. What is the number?", answer: "265739" },
      ],
      Expert: [
        { question: "Remember this number: 9274158. What is the number?", answer: "9274158" },
        { question: "Remember this number: 5819364. What is the number?", answer: "5819364" },
        { question: "Remember this number: 7462915. What is the number?", answer: "7462915" },
        { question: "Remember this number: 3185742. What is the number?", answer: "3185742" },
        { question: "Remember this number: 8642139. What is the number?", answer: "8642139" },
      ],
    },

    "Word Game": {
      Beginner: [
        { question: "How many letters are in COGNIA?", answer: "6" },
        { question: "How many letters are in APPLE?", answer: "5" },
        { question: "How many letters are in COMPUTER?", answer: "8" },
        { question: "How many letters are in CODE?", answer: "4" },
        { question: "How many letters are in ALARM?", answer: "5" },
      ],
      Easy: [
        { question: "How many letters are in COMPUTER?", answer: "8" },
        { question: "How many letters are in JAVASCRIPT?", answer: "10" },
        { question: "How many letters are in DATABASE?", answer: "8" },
        { question: "How many letters are in KEYBOARD?", answer: "8" },
        { question: "How many letters are in SOFTWARE?", answer: "8" },
      ],
      Medium: [
        { question: "How many letters are in PROGRAMMING?", answer: "11" },
        { question: "How many letters are in ALGORITHM?", answer: "9" },
        { question: "How many letters are in DEVELOPMENT?", answer: "11" },
        { question: "How many letters are in ARTIFICIAL?", answer: "10" },
        { question: "How many letters are in INTELLIGENT?", answer: "11" },
      ],
      Hard: [
        { question: "How many letters are in ARTIFICIAL?", answer: "10" },
        { question: "How many letters are in PROGRAMMING?", answer: "11" },
        { question: "How many letters are in TRANSFORMATION?", answer: "14" },
        { question: "How many letters are in CLASSIFICATION?", answer: "14" },
        { question: "How many letters are in OPTIMIZATION?", answer: "12" },
      ],
      Expert: [
        { question: "How many letters are in INTELLIGENCE?", answer: "12" },
        { question: "How many letters are in PERSONALIZATION?", answer: "15" },
        { question: "How many letters are in NEUROSCIENCE?", answer: "12" },
        { question: "How many letters are in IMPLEMENTATION?", answer: "14" },
        { question: "How many letters are in ADAPTIVEALGORITHM?", answer: "17" },
      ],
    },

    "Pattern Recognition": {
      Beginner: [
        { question: "What comes next: 1, 3, 5, 7, ?", answer: "9" },
        { question: "What comes next: 2, 4, 6, 8, ?", answer: "10" },
        { question: "What comes next: 10, 20, 30, 40, ?", answer: "50" },
        { question: "What comes next: 5, 10, 15, 20, ?", answer: "25" },
        { question: "What comes next: 3, 6, 9, 12, ?", answer: "15" },
      ],
      Easy: [
        { question: "What comes next: 2, 4, 8, 16, ?", answer: "32" },
        { question: "What comes next: 3, 6, 12, 24, ?", answer: "48" },
        { question: "What comes next: 5, 10, 20, 40, ?", answer: "80" },
        { question: "What comes next: 1, 2, 4, 8, ?", answer: "16" },
        { question: "What comes next: 4, 8, 16, 32, ?", answer: "64" },
      ],
      Medium: [
        { question: "What comes next: 2, 4, 8, 16, ?", answer: "32" },
        { question: "What comes next: 3, 9, 27, 81, ?", answer: "243" },
        { question: "What comes next: 5, 15, 45, 135, ?", answer: "405" },
        { question: "What comes next: 7, 14, 28, 56, ?", answer: "112" },
        { question: "What comes next: 6, 18, 54, 162, ?", answer: "486" },
      ],
      Hard: [
        { question: "What comes next: 1, 4, 9, 16, ?", answer: "25" },
        { question: "What comes next: 4, 9, 16, 25, ?", answer: "36" },
        { question: "What comes next: 9, 16, 25, 36, ?", answer: "49" },
        { question: "What comes next: 16, 25, 36, 49, ?", answer: "64" },
        { question: "What comes next: 25, 36, 49, 64, ?", answer: "81" },
      ],
      Expert: [
        { question: "What comes next: 2, 6, 18, 54, ?", answer: "162" },
        { question: "What comes next: 3, 12, 48, 192, ?", answer: "768" },
        { question: "What comes next: 4, 20, 100, 500, ?", answer: "2500" },
        { question: "What comes next: 5, 30, 180, 1080, ?", answer: "6480" },
        { question: "What comes next: 7, 42, 252, 1512, ?", answer: "9072" },
      ],
    },

    Riddle: {
      Beginner: [
        { question: "What has hands but cannot clap?", answer: "clock" },
        { question: "What has a face and two hands but no arms or legs?", answer: "clock" },
        { question: "What has keys but cannot open locks?", answer: "keyboard" },
        { question: "What gets wetter as it dries?", answer: "towel" },
        { question: "What has legs but cannot walk?", answer: "table" },
      ],
      Easy: [
        { question: "What has keys but cannot open locks?", answer: "keyboard" },
        { question: "What gets wetter as it dries?", answer: "towel" },
        { question: "What has a neck but no head?", answer: "bottle" },
        { question: "What has one eye but cannot see?", answer: "needle" },
        { question: "What has many teeth but cannot bite?", answer: "comb" },
      ],
      Medium: [
        { question: "What gets wetter as it dries?", answer: "towel" },
        { question: "What has a head and a tail but no body?", answer: "coin" },
        { question: "What can travel around the world while staying in one corner?", answer: "stamp" },
        { question: "What has words but never speaks?", answer: "book" },
        { question: "What belongs to you but other people use it more than you?", answer: "name" },
      ],
      Hard: [
        { question: "What has a head and a tail but no body?", answer: "coin" },
        { question: "What can travel around the world while staying in one corner?", answer: "stamp" },
        { question: "What has cities but no houses, forests but no trees, and rivers but no water?", answer: "map" },
        { question: "What disappears as soon as you say its name?", answer: "silence" },
        { question: "What has an endless supply of letters but starts empty?", answer: "mailbox" },
      ],
      Expert: [
        { question: "I speak without a mouth and hear without ears. What am I?", answer: "echo" },
        { question: "The more you take, the more you leave behind. What are they?", answer: "footsteps" },
        { question: "I have branches but no fruit, trunk, or leaves. What am I?", answer: "bank" },
        { question: "I am always in front of you but can never be seen. What am I?", answer: "future" },
        { question: "What can fill a room but takes up no space?", answer: "light" },
      ],
    },

    "Quick Quiz": {
      Beginner: [
        { question: "How many days are there in a week?", answer: "7" },
        { question: "How many hours are there in a day?", answer: "24" },
        { question: "How many months are there in a year?", answer: "12" },
        { question: "How many legs does a dog have?", answer: "4" },
        { question: "How many letters are in the English alphabet?", answer: "26" },
      ],
      Easy: [
        { question: "How many months are there in a year?", answer: "12" },
        { question: "How many continents are there?", answer: "7" },
        { question: "How many sides does a triangle have?", answer: "3" },
        { question: "How many minutes are there in one hour?", answer: "60" },
        { question: "How many seconds are there in one minute?", answer: "60" },
      ],
      Medium: [
        { question: "How many planets are in our Solar System?", answer: "8" },
        { question: "How many sides does a hexagon have?", answer: "6" },
        { question: "How many degrees are in a right angle?", answer: "90" },
        { question: "How many players are on a football team on the field?", answer: "11" },
        { question: "How many colors are traditionally in a rainbow?", answer: "7" },
      ],
      Hard: [
        { question: "How many bones are in an adult human body?", answer: "206" },
        { question: "How many chromosomes are in a normal human cell?", answer: "46" },
        { question: "How many elements are currently known in the periodic table?", answer: "118" },
        { question: "How many keys are on a standard piano?", answer: "88" },
        { question: "How many teeth does a typical adult human have?", answer: "32" },
      ],
      Expert: [
        { question: "How many bits are there in one byte?", answer: "8" },
        { question: "How many bytes are in one kilobyte using the binary convention?", answer: "1024" },
        { question: "How many vertices does a cube have?", answer: "8" },
        { question: "How many edges does a cube have?", answer: "12" },
        { question: "How many degrees are there in the interior angles of a triangle combined?", answer: "180" },
      ],
    },
  };

  // =====================================================
  // DATE AND ANSWER HELPERS
  // =====================================================

  const getTodayKey = () => {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const normalizeAnswer = (value) =>
    String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

  // =====================================================
  // SELECT RANDOM CHALLENGE
  // =====================================================

  const selectChallenge = (alarm) => {
    const challengeType = alarm?.challenge || "Math";
    const difficulty = alarm?.difficulty || "Beginner";
    const questions = challengeData[challengeType]?.[difficulty];

    if (!Array.isArray(questions) || questions.length === 0) {
      return { question: "What is 5 + 3?", answer: "8" };
    }

    return questions[Math.floor(Math.random() * questions.length)];
  };

  // =====================================================
  // STOP ALARM SOUND
  // =====================================================

  const stopAlarmSound = () => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }

    if (soundTimeoutRef.current) {
      clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = null;
    }

    if (audioContextRef.current) {
      const context = audioContextRef.current;
      audioContextRef.current = null;

      if (context.state !== "closed") {
        context.close().catch((error) => {
          console.error("Audio close error:", error);
        });
      }
    }
  };

  // =====================================================
  // START ALARM SOUND
  // =====================================================

  const playAlarmSound = () => {
    stopAlarmSound();

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const playBeep = async () => {
        if (audioContext.state === "closed") return;

        try {
          if (audioContext.state === "suspended") {
            await audioContext.resume();
          }

          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.value = 800;
          oscillator.type = "sine";
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);

          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
          console.error("Alarm beep error:", error);
        }
      };

      playBeep();

      soundIntervalRef.current = setInterval(playBeep, 1000);

      soundTimeoutRef.current = setTimeout(() => {
        if (soundIntervalRef.current) {
          clearInterval(soundIntervalRef.current);
          soundIntervalRef.current = null;
        }
      }, 10000);
    } catch (error) {
      console.error("Alarm sound error:", error);
    }
  };

  // =====================================================
  // CHECK ALARMS
  // =====================================================

  const checkAlarms = async () => {
    if (!email || triggeredRef.current) return;

    try {
      const response = await fetch(
        `http://localhost:8001/alarms/${encodeURIComponent(email)}`
      );

      if (!response.ok) return;

      const data = await response.json();
      const alarms = Array.isArray(data.alarms) ? data.alarms : [];

      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const today = getTodayKey();

      for (const alarm of alarms) {
        if (alarm.active === false || !alarm.alarm_time) continue;

        const alarmTime = String(alarm.alarm_time).substring(0, 5);
        if (alarmTime !== currentTime) continue;

        const alarmId =
          alarm._id ||
          alarm.id ||
          `${alarmTime}-${alarm.challenge}-${alarm.difficulty}-${alarm.alarm_type}`;

        const triggerKey = `cognia_alarm_${alarmId}_${today}`;

        if (localStorage.getItem(triggerKey)) continue;

        localStorage.setItem(triggerKey, "triggered");
        triggeredRef.current = true;

        console.log("COGNIA ALARM TRIGGERED:", alarm);

        const selectedChallenge = selectChallenge(alarm);

        setTriggeredAlarm(alarm);
        setCurrentChallenge(selectedChallenge);
        setAnswer("");
        setMessage("");
        setShowChallenge(true);

        playAlarmSound();
        break;
      }
    } catch (error) {
      console.error("Alarm checking error:", error);
    }
  };

  // =====================================================
  // START GLOBAL ALARM CHECKER
  // =====================================================

  useEffect(() => {
    if (!email) return undefined;

    checkAlarms();

    alarmIntervalRef.current = setInterval(checkAlarms, 5000);

    return () => {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
      }

      stopAlarmSound();
    };
  }, [email]);

  // =====================================================
  // HANDLE ANSWER AND SAVE WAKE-UP
  // =====================================================

  const handleAnswer = async () => {
    if (isSubmitting) return;

    if (!currentChallenge || !triggeredAlarm) return;

    if (!answer.trim()) {
      setMessage("Please enter your answer.");
      return;
    }

    if (normalizeAnswer(answer) !== normalizeAnswer(currentChallenge.answer)) {
      setMessage("❌ Incorrect. Try again to dismiss the alarm.");
      return;
    }

    if (!email) {
      setMessage("User email not found. Please log in again.");
      return;
    }

    setIsSubmitting(true);
    setMessage("✅ Correct! Saving wake-up record...");

    try {
      // Step 1: Verify the challenge with the backend.
      const verifyResponse = await fetch(
        "http://localhost:8001/wake-up/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            challenge_completed: true,
          }),
        }
      );

      const verifyData = await verifyResponse.json().catch(() => ({}));
      console.log("Wake-up verification:", verifyData);

      if (!verifyResponse.ok || verifyData.verified !== true) {
        setMessage(
          verifyData.detail ||
            verifyData.message ||
            "Wake-up verification failed. Please try again."
        );
        return;
      }

      // Step 2: Save the successful wake-up to history.
      const historyResponse = await fetch(
        "http://localhost:8001/wake-up/history",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            wake_up_time: new Date().toISOString(),
            scheduled_time: triggeredAlarm.alarm_time,
            verified: true,
            snoozed: false,
            snooze_count: 0,
            verification_time_seconds: 0,
          }),
        }
      );

      const historyData = await historyResponse.json().catch(() => ({}));
      console.log("Wake-up history response:", historyData);

      if (!historyResponse.ok) {
        setMessage(
          historyData.detail ||
            historyData.message ||
            "Wake-up verified, but saving the record failed."
        );
        return;
      }

      setMessage("✅ Wake-up verified and saved successfully!");
      stopAlarmSound();

      // Step 3: Dismiss the alarm after successful saving.
      setTimeout(() => {
        setShowChallenge(false);
        setTriggeredAlarm(null);
        setCurrentChallenge(null);
        setAnswer("");
        setMessage("");
        setIsSubmitting(false);
        triggeredRef.current = false;
      }, 1500);
    } catch (error) {
      console.error("Wake-up tracking error:", error);
      setMessage("Could not save wake-up. Check that the backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // =====================================================
  // NOTHING TO SHOW
  // =====================================================

  if (!showChallenge || !triggeredAlarm || !currentChallenge) {
    return null;
  }

  // =====================================================
  // ALARM POPUP
  // =====================================================

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "500px",
          background: "white",
          borderRadius: "24px",
          padding: "35px",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ fontSize: "55px", marginBottom: "10px" }}>⏰</div>

        <h1 style={{ margin: "0 0 10px", color: "#111827" }}>
          Wake Up!
        </h1>

        <p style={{ color: "#6b7280", marginBottom: "25px" }}>
          Your COGNIA alarm is ringing.
        </p>

        <div
          style={{
            background: "#f3f4f6",
            padding: "15px",
            borderRadius: "14px",
            marginBottom: "25px",
          }}
        >
          <strong style={{ fontSize: "28px", color: "#111827" }}>
            {triggeredAlarm.alarm_time}
          </strong>

          <p style={{ margin: "5px 0", color: "#6b7280" }}>
            {triggeredAlarm.alarm_type || "Daily"}
          </p>

          <p
            style={{
              margin: "5px 0 0",
              color: "#6366f1",
              fontWeight: "bold",
            }}
          >
            {triggeredAlarm.challenge || "Math"} •{" "}
            {triggeredAlarm.difficulty || "Beginner"}
          </p>
        </div>

        <div
          style={{
            background: "#eef2ff",
            padding: "20px",
            borderRadius: "16px",
            marginBottom: "20px",
          }}
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              color: "#6366f1",
              marginBottom: "10px",
            }}
          >
            🧠 COGNITIVE CHALLENGE
          </p>

          <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "10px" }}>
            Difficulty:{" "}
            <strong>{triggeredAlarm.difficulty || "Beginner"}</strong>
          </p>

          <h2 style={{ color: "#111827", fontSize: "22px" }}>
            {currentChallenge.question}
          </h2>

          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAnswer();
            }}
            placeholder="Enter your answer"
            autoFocus
            disabled={isSubmitting}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
              fontSize: "18px",
              marginTop: "15px",
              outline: "none",
              color: "#111827",
            }}
          />
        </div>

        {message && (
          <p
            style={{
              fontWeight: "bold",
              color: message.startsWith("✅") ? "#16a34a" : "#dc2626",
            }}
          >
            {message}
          </p>
        )}

        <button
          onClick={handleAnswer}
          disabled={isSubmitting}
          style={{
            width: "100%",
            padding: "15px",
            border: "none",
            borderRadius: "12px",
            background: isSubmitting ? "#9ca3af" : "#6366f1",
            color: "white",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: isSubmitting ? "not-allowed" : "pointer",
          }}
        >
          {isSubmitting ? "Saving..." : "🧠 Submit Answer"}
        </button>

        <p style={{ marginTop: "15px", fontSize: "12px", color: "#9ca3af" }}>
          Solve the challenge to dismiss the alarm.
        </p>
      </div>
    </div>
  );
}

export default AlarmTrigger;
