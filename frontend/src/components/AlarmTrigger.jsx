
import { useEffect, useRef, useState } from "react";

function AlarmTrigger() {
  const [triggeredAlarm, setTriggeredAlarm] = useState(null);
  const [showChallenge, setShowChallenge] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState(null);

  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");

  const audioContextRef = useRef(null);
  const alarmIntervalRef = useRef(null);

  const email = localStorage.getItem("email");

  // =====================================================
  // CHALLENGE DATA
  // 7 TYPES × 5 DIFFICULTIES × 5 QUESTIONS
  // =====================================================

  const challengeData = {
    Math: {
      Beginner: [
        {
          question: "What is 4 × 3?",
          answer: "12",
        },
        {
          question: "What is 5 + 7?",
          answer: "12",
        },
        {
          question: "What is 10 - 4?",
          answer: "6",
        },
        {
          question: "What is 6 × 2?",
          answer: "12",
        },
        {
          question: "What is 20 ÷ 5?",
          answer: "4",
        },
      ],

      Easy: [
        {
          question: "What is 15 + 27?",
          answer: "42",
        },
        {
          question: "What is 18 × 3?",
          answer: "54",
        },
        {
          question: "What is 72 ÷ 8?",
          answer: "9",
        },
        {
          question: "What is 50 - 17?",
          answer: "33",
        },
        {
          question: "What is 12 × 4?",
          answer: "48",
        },
      ],

      Medium: [
        {
          question: "What is 24 × 15?",
          answer: "360",
        },
        {
          question: "What is 144 ÷ 12?",
          answer: "12",
        },
        {
          question: "What is 35 × 16?",
          answer: "560",
        },
        {
          question: "What is 250 - 87?",
          answer: "163",
        },
        {
          question: "What is 48 × 13?",
          answer: "624",
        },
      ],

      Hard: [
        {
          question: "What is 125 × 16?",
          answer: "2000",
        },
        {
          question: "What is 248 × 25?",
          answer: "6200",
        },
        {
          question: "What is 936 ÷ 18?",
          answer: "52",
        },
        {
          question: "What is 425 × 32?",
          answer: "13600",
        },
        {
          question: "What is 875 - 348?",
          answer: "527",
        },
      ],

      Expert: [
        {
          question: "What is 875 × 64?",
          answer: "56000",
        },
        {
          question: "What is 936 × 47?",
          answer: "43992",
        },
        {
          question: "What is 1248 ÷ 16?",
          answer: "78",
        },
        {
          question: "What is 725 × 38?",
          answer: "27550",
        },
        {
          question: "What is 1485 × 27?",
          answer: "40095",
        },
      ],
    },

    // =====================================================
    // LOGIC PUZZLE
    // =====================================================

    "Logic Puzzle": {
      Beginner: [
        {
          question: "What comes next: 2, 4, 6, 8, ?",
          answer: "10",
        },
        {
          question: "What comes next: 1, 2, 3, 4, ?",
          answer: "5",
        },
        {
          question: "What comes next: 5, 10, 15, 20, ?",
          answer: "25",
        },
        {
          question: "What comes next: 10, 20, 30, 40, ?",
          answer: "50",
        },
        {
          question: "What comes next: 3, 6, 9, 12, ?",
          answer: "15",
        },
      ],

      Easy: [
        {
          question: "What comes next: 5, 10, 15, 20, ?",
          answer: "25",
        },
        {
          question: "What comes next: 10, 15, 20, 25, ?",
          answer: "30",
        },
        {
          question: "What comes next: 2, 5, 8, 11, ?",
          answer: "14",
        },
        {
          question: "What comes next: 7, 14, 21, 28, ?",
          answer: "35",
        },
        {
          question: "What comes next: 20, 18, 16, 14, ?",
          answer: "12",
        },
      ],

      Medium: [
        {
          question: "What comes next: 3, 6, 12, 24, ?",
          answer: "48",
        },
        {
          question: "What comes next: 4, 8, 16, 32, ?",
          answer: "64",
        },
        {
          question: "What comes next: 2, 6, 18, 54, ?",
          answer: "162",
        },
        {
          question: "What comes next: 81, 27, 9, 3, ?",
          answer: "1",
        },
        {
          question: "What comes next: 5, 15, 45, 135, ?",
          answer: "405",
        },
      ],

      Hard: [
        {
          question:
            "What comes next: 2, 6, 12, 20, 30, ?",
          answer: "42",
        },
        {
          question:
            "What comes next: 1, 4, 9, 16, 25, ?",
          answer: "36",
        },
        {
          question:
            "What comes next: 3, 7, 13, 21, 31, ?",
          answer: "43",
        },
        {
          question:
            "What comes next: 2, 5, 10, 17, 26, ?",
          answer: "37",
        },
        {
          question:
            "What comes next: 4, 9, 16, 25, 36, ?",
          answer: "49",
        },
      ],

      Expert: [
        {
          question:
            "What comes next: 3, 8, 15, 24, 35, ?",
          answer: "48",
        },
        {
          question:
            "What comes next: 2, 7, 14, 23, 34, ?",
          answer: "47",
        },
        {
          question:
            "What comes next: 1, 5, 11, 19, 29, ?",
          answer: "41",
        },
        {
          question:
            "What comes next: 4, 10, 18, 28, 40, ?",
          answer: "54",
        },
        {
          question:
            "What comes next: 2, 9, 20, 35, 54, ?",
          answer: "77",
        },
      ],
    },

    // =====================================================
    // MEMORY
    // =====================================================

    Memory: {
      Beginner: [
        {
          question:
            "Remember this number: 123. What is the number?",
          answer: "123",
        },
        {
          question:
            "Remember this number: 456. What is the number?",
          answer: "456",
        },
        {
          question:
            "Remember this number: 789. What is the number?",
          answer: "789",
        },
        {
          question:
            "Remember this number: 321. What is the number?",
          answer: "321",
        },
        {
          question:
            "Remember this number: 654. What is the number?",
          answer: "654",
        },
      ],

      Easy: [
        {
          question:
            "Remember this number: 4827. What is the number?",
          answer: "4827",
        },
        {
          question:
            "Remember this number: 6139. What is the number?",
          answer: "6139",
        },
        {
          question:
            "Remember this number: 2754. What is the number?",
          answer: "2754",
        },
        {
          question:
            "Remember this number: 8392. What is the number?",
          answer: "8392",
        },
        {
          question:
            "Remember this number: 5048. What is the number?",
          answer: "5048",
        },
      ],

      Medium: [
        {
          question:
            "Remember this number: 73915. What is the number?",
          answer: "73915",
        },
        {
          question:
            "Remember this number: 48261. What is the number?",
          answer: "48261",
        },
        {
          question:
            "Remember this number: 91537. What is the number?",
          answer: "91537",
        },
        {
          question:
            "Remember this number: 62483. What is the number?",
          answer: "62483",
        },
        {
          question:
            "Remember this number: 35791. What is the number?",
          answer: "35791",
        },
      ],

      Hard: [
        {
          question:
            "Remember this number: 581642. What is the number?",
          answer: "581642",
        },
        {
          question:
            "Remember this number: 739251. What is the number?",
          answer: "739251",
        },
        {
          question:
            "Remember this number: 426815. What is the number?",
          answer: "426815",
        },
        {
          question:
            "Remember this number: 918374. What is the number?",
          answer: "918374",
        },
        {
          question:
            "Remember this number: 265739. What is the number?",
          answer: "265739",
        },
      ],

      Expert: [
        {
          question:
            "Remember this number: 9274158. What is the number?",
          answer: "9274158",
        },
        {
          question:
            "Remember this number: 5819364. What is the number?",
          answer: "5819364",
        },
        {
          question:
            "Remember this number: 7462915. What is the number?",
          answer: "7462915",
        },
        {
          question:
            "Remember this number: 3185742. What is the number?",
          answer: "3185742",
        },
        {
          question:
            "Remember this number: 8642139. What is the number?",
          answer: "8642139",
        },
      ],
    },

    // =====================================================
    // WORD GAME
    // =====================================================

    "Word Game": {
      Beginner: [
        {
          question: "How many letters are in COGNIA?",
          answer: "6",
        },
        {
          question: "How many letters are in APPLE?",
          answer: "5",
        },
        {
          question: "How many letters are in COMPUTER?",
          answer: "8",
        },
        {
          question: "How many letters are in CODE?",
          answer: "4",
        },
        {
          question: "How many letters are in ALARM?",
          answer: "5",
        },
      ],

      Easy: [
        {
          question: "How many letters are in COMPUTER?",
          answer: "8",
        },
        {
          question: "How many letters are in JAVASCRIPT?",
          answer: "10",
        },
        {
          question: "How many letters are in DATABASE?",
          answer: "8",
        },
        {
          question: "How many letters are in KEYBOARD?",
          answer: "8",
        },
        {
          question: "How many letters are in SOFTWARE?",
          answer: "8",
        },
      ],

      Medium: [
        {
          question: "How many letters are in PROGRAMMING?",
          answer: "11",
        },
        {
          question: "How many letters are in ALGORITHM?",
          answer: "9",
        },
        {
          question: "How many letters are in DEVELOPMENT?",
          answer: "11",
        },
        {
          question: "How many letters are in ARTIFICIAL?",
          answer: "10",
        },
        {
          question: "How many letters are in INTELLIGENT?",
          answer: "11",
        },
      ],

      Hard: [
        {
          question: "How many letters are in ARTIFICIAL?",
          answer: "10",
        },
        {
          question: "How many letters are in PROGRAMMING?",
          answer: "11",
        },
        {
          question: "How many letters are in TRANSFORMATION?",
          answer: "14",
        },
        {
          question: "How many letters are in CLASSIFICATION?",
          answer: "14",
        },
        {
          question: "How many letters are in OPTIMIZATION?",
          answer: "12",
        },
      ],

      Expert: [
        {
          question: "How many letters are in INTELLIGENCE?",
          answer: "12",
        },
        {
          question: "How many letters are in PERSONALIZATION?",
          answer: "15",
        },
        {
          question: "How many letters are in NEUROSCIENCE?",
          answer: "12",
        },
        {
          question: "How many letters are in IMPLEMENTATION?",
          answer: "14",
        },
        {
          question: "How many letters are in ADAPTIVEALGORITHM?",
          answer: "17",
        },
      ],
    },

    // =====================================================
    // PATTERN RECOGNITION
    // =====================================================

    "Pattern Recognition": {
      Beginner: [
        {
          question: "What comes next: 1, 3, 5, 7, ?",
          answer: "9",
        },
        {
          question: "What comes next: 2, 4, 6, 8, ?",
          answer: "10",
        },
        {
          question: "What comes next: 10, 20, 30, 40, ?",
          answer: "50",
        },
        {
          question: "What comes next: 5, 10, 15, 20, ?",
          answer: "25",
        },
        {
          question: "What comes next: 3, 6, 9, 12, ?",
          answer: "15",
        },
      ],

      Easy: [
        {
          question: "What comes next: 2, 4, 8, 16, ?",
          answer: "32",
        },
        {
          question: "What comes next: 3, 6, 12, 24, ?",
          answer: "48",
        },
        {
          question: "What comes next: 5, 10, 20, 40, ?",
          answer: "80",
        },
        {
          question: "What comes next: 1, 2, 4, 8, ?",
          answer: "16",
        },
        {
          question: "What comes next: 4, 8, 16, 32, ?",
          answer: "64",
        },
      ],

      Medium: [
        {
          question: "What comes next: 2, 4, 8, 16, ?",
          answer: "32",
        },
        {
          question: "What comes next: 3, 9, 27, 81, ?",
          answer: "243",
        },
        {
          question: "What comes next: 5, 15, 45, 135, ?",
          answer: "405",
        },
        {
          question: "What comes next: 7, 14, 28, 56, ?",
          answer: "112",
        },
        {
          question: "What comes next: 6, 18, 54, 162, ?",
          answer: "486",
        },
      ],

      Hard: [
        {
          question: "What comes next: 1, 4, 9, 16, ?",
          answer: "25",
        },
        {
          question: "What comes next: 4, 9, 16, 25, ?",
          answer: "36",
        },
        {
          question: "What comes next: 9, 16, 25, 36, ?",
          answer: "49",
        },
        {
          question: "What comes next: 16, 25, 36, 49, ?",
          answer: "64",
        },
        {
          question: "What comes next: 25, 36, 49, 64, ?",
          answer: "81",
        },
      ],

      Expert: [
        {
          question: "What comes next: 2, 6, 18, 54, ?",
          answer: "162",
        },
        {
          question: "What comes next: 3, 12, 48, 192, ?",
          answer: "768",
        },
        {
          question: "What comes next: 4, 20, 100, 500, ?",
          answer: "2500",
        },
        {
          question: "What comes next: 5, 30, 180, 1080, ?",
          answer: "6480",
        },
        {
          question: "What comes next: 7, 42, 252, 1512, ?",
          answer: "9072",
        },
      ],
    },

    // =====================================================
    // RIDDLE
    // =====================================================

    Riddle: {
      Beginner: [
        {
          question:
            "What has hands but cannot clap?",
          answer: "clock",
        },
        {
          question:
            "What has a face and two hands but no arms or legs?",
          answer: "clock",
        },
        {
          question:
            "What has keys but cannot open locks?",
          answer: "keyboard",
        },
        {
          question:
            "What gets wetter as it dries?",
          answer: "towel",
        },
        {
          question:
            "What has legs but cannot walk?",
          answer: "table",
        },
      ],

      Easy: [
        {
          question:
            "What has keys but cannot open locks?",
          answer: "keyboard",
        },
        {
          question:
            "What gets wetter as it dries?",
          answer: "towel",
        },
        {
          question:
            "What has a neck but no head?",
          answer: "bottle",
        },
        {
          question:
            "What has one eye but cannot see?",
          answer: "needle",
        },
        {
          question:
            "What has many teeth but cannot bite?",
          answer: "comb",
        },
      ],

      Medium: [
        {
          question:
            "What gets wetter as it dries?",
          answer: "towel",
        },
        {
          question:
            "What has a head and a tail but no body?",
          answer: "coin",
        },
        {
          question:
            "What can travel around the world while staying in one corner?",
          answer: "stamp",
        },
        {
          question:
            "What has words but never speaks?",
          answer: "book",
        },
        {
          question:
            "What belongs to you but other people use it more than you?",
          answer: "name",
        },
      ],

      Hard: [
        {
          question:
            "What has a head and a tail but no body?",
          answer: "coin",
        },
        {
          question:
            "What can travel around the world while staying in one corner?",
          answer: "stamp",
        },
        {
          question:
            "What has cities but no houses, forests but no trees, and rivers but no water?",
          answer: "map",
        },
        {
          question:
            "What disappears as soon as you say its name?",
          answer: "silence",
        },
        {
          question:
            "What has an endless supply of letters but starts empty?",
          answer: "mailbox",
        },
      ],

      Expert: [
        {
          question:
            "I speak without a mouth and hear without ears. What am I?",
          answer: "echo",
        },
        {
          question:
            "The more you take, the more you leave behind. What are they?",
          answer: "footsteps",
        },
        {
          question:
            "I have branches but no fruit, trunk, or leaves. What am I?",
          answer: "bank",
        },
        {
          question:
            "I am always in front of you but can never be seen. What am I?",
          answer: "future",
        },
        {
          question:
            "What can fill a room but takes up no space?",
          answer: "light",
        },
      ],
    },

    // =====================================================
    // QUICK QUIZ
    // =====================================================

    "Quick Quiz": {
      Beginner: [
        {
          question:
            "How many days are there in a week?",
          answer: "7",
        },
        {
          question:
            "How many hours are there in a day?",
          answer: "24",
        },
        {
          question:
            "How many months are there in a year?",
          answer: "12",
        },
        {
          question:
            "How many legs does a dog have?",
          answer: "4",
        },
        {
          question:
            "How many letters are in the English alphabet?",
          answer: "26",
        },
      ],

      Easy: [
        {
          question:
            "How many months are there in a year?",
          answer: "12",
        },
        {
          question:
            "How many continents are there?",
          answer: "7",
        },
        {
          question:
            "How many sides does a triangle have?",
          answer: "3",
        },
        {
          question:
            "How many minutes are there in one hour?",
          answer: "60",
        },
        {
          question:
            "How many seconds are there in one minute?",
          answer: "60",
        },
      ],

      Medium: [
        {
          question:
            "How many planets are in our Solar System?",
          answer: "8",
        },
        {
          question:
            "How many sides does a hexagon have?",
          answer: "6",
        },
        {
          question:
            "How many degrees are in a right angle?",
          answer: "90",
        },
        {
          question:
            "How many players are on a football team on the field?",
          answer: "11",
        },
        {
          question:
            "How many colors are traditionally in a rainbow?",
          answer: "7",
        },
      ],

      Hard: [
        {
          question:
            "How many bones are in an adult human body?",
          answer: "206",
        },
        {
          question:
            "How many chromosomes are in a normal human cell?",
          answer: "46",
        },
        {
          question:
            "How many elements are currently known in the periodic table?",
          answer: "118",
        },
        {
          question:
            "How many keys are on a standard piano?",
          answer: "88",
        },
        {
          question:
            "How many teeth does a typical adult human have?",
          answer: "32",
        },
      ],

      Expert: [
        {
          question:
            "How many bits are there in one byte?",
          answer: "8",
        },
        {
          question:
            "How many bytes are in one kilobyte using the binary convention?",
          answer: "1024",
        },
        {
          question:
            "How many vertices does a cube have?",
          answer: "8",
        },
        {
          question:
            "How many edges does a cube have?",
          answer: "12",
        },
        {
          question:
            "How many degrees are there in the interior angles of a triangle combined?",
          answer: "180",
        },
      ],
    },
  };

  // =====================================================
  // GET TODAY KEY
  // =====================================================

  const getTodayKey = () => {
    const now = new Date();

    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  };

  // =====================================================
  // NORMALIZE ANSWER
  // =====================================================

  const normalizeAnswer = (value) => {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  };

  // =====================================================
  // SELECT RANDOM CHALLENGE
  // =====================================================

  const selectChallenge = (alarm) => {
    const challengeType =
      alarm?.challenge || "Math";

    const difficulty =
      alarm?.difficulty || "Beginner";

    console.log(
      "Selecting challenge:",
      challengeType,
      difficulty
    );

    // Validate challenge type
    if (!challengeData[challengeType]) {
      console.warn(
        "Unknown challenge type:",
        challengeType
      );

      return {
        question: "What is 5 + 3?",
        answer: "8",
      };
    }

    // Validate difficulty
    if (
      !challengeData[challengeType][difficulty]
    ) {
      console.warn(
        "Unknown difficulty:",
        difficulty
      );

      return {
        question: "What is 5 + 3?",
        answer: "8",
      };
    }

    const questions =
      challengeData[challengeType][difficulty];

    if (
      !Array.isArray(questions) ||
      questions.length === 0
    ) {
      return {
        question: "What is 5 + 3?",
        answer: "8",
      };
    }

    // =================================================
    // RANDOM QUESTION
    // =================================================

    const randomIndex =
      Math.floor(
        Math.random() * questions.length
      );

    const selectedQuestion =
      questions[randomIndex];

    console.log(
      "Selected question:",
      selectedQuestion
    );

    return selectedQuestion;
  };

  // =====================================================
  // START ALARM SOUND
  // =====================================================

  const playAlarmSound = () => {
    try {
      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) return;

      const audioContext =
        new AudioContext();

      audioContextRef.current =
        audioContext;

      const playBeep = () => {
        if (
          audioContext.state ===
          "suspended"
        ) {
          audioContext.resume();
        }

        const oscillator =
          audioContext.createOscillator();

        const gainNode =
          audioContext.createGain();

        oscillator.connect(
          gainNode
        );

        gainNode.connect(
          audioContext.destination
        );

        oscillator.frequency.value =
          800;

        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(
          0.3,
          audioContext.currentTime
        );

        oscillator.start();

        oscillator.stop(
          audioContext.currentTime +
            0.5
        );
      };

      playBeep();

      const soundInterval =
        setInterval(
          playBeep,
          1000
        );

      setTimeout(() => {
        clearInterval(
          soundInterval
        );
      }, 10000);

    } catch (error) {
      console.error(
        "Alarm sound error:",
        error
      );
    }
  };

  // =====================================================
  // CHECK ALARMS
  // =====================================================

  const checkAlarms = async () => {
    if (!email) return;

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/alarms/${encodeURIComponent(
          email
        )}`
      );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      const alarms =
        Array.isArray(data.alarms)
          ? data.alarms
          : [];

      const now = new Date();

      const currentHour =
        String(
          now.getHours()
        ).padStart(2, "0");

      const currentMinute =
        String(
          now.getMinutes()
        ).padStart(2, "0");

      const currentTime =
        `${currentHour}:${currentMinute}`;

      const today =
        getTodayKey();

      for (
        const alarm of alarms
      ) {
        // =============================================
        // ONLY ACTIVE ALARMS
        // =============================================

        if (
          alarm.active === false
        ) {
          continue;
        }

        if (
          !alarm.alarm_time
        ) {
          continue;
        }

        const alarmTime =
          alarm.alarm_time.substring(
            0,
            5
          );

        // =============================================
        // CHECK TIME
        // =============================================

        if (
          alarmTime !==
          currentTime
        ) {
          continue;
        }

        // =============================================
        // UNIQUE ALARM ID
        // =============================================

        const alarmId =
          alarm._id ||
          alarm.id ||
          `${alarmTime}-${alarm.challenge}-${alarm.difficulty}-${alarm.alarm_type}`;

        const triggerKey =
          `cognia_alarm_${alarmId}_${today}`;

        // =============================================
        // PREVENT REPEATED TRIGGER
        // =============================================

        if (
          localStorage.getItem(
            triggerKey
          )
        ) {
          continue;
        }

        // =============================================
        // MARK AS TRIGGERED
        // =============================================

        localStorage.setItem(
          triggerKey,
          "triggered"
        );

        console.log(
          "🔔 COGNIA ALARM TRIGGERED"
        );

        console.log(
          "Alarm:",
          alarm
        );

        console.log(
          "Challenge:",
          alarm.challenge
        );

        console.log(
          "Difficulty:",
          alarm.difficulty
        );

        // =============================================
        // SELECT QUESTION
        // =============================================

        const selectedChallenge =
          selectChallenge(
            alarm
          );

        console.log(
          "FINAL ALARM QUESTION:",
          selectedChallenge.question
        );

        console.log(
          "FINAL ALARM ANSWER:",
          selectedChallenge.answer
        );

        // =============================================
        // SAVE ALARM
        // =============================================

        setTriggeredAlarm(
          alarm
        );

        setCurrentChallenge(
          selectedChallenge
        );

        // =============================================
        // START SOUND
        // =============================================

        playAlarmSound();

        // =============================================
        // SHOW POPUP
        // =============================================

        setShowChallenge(
          true
        );

        setAnswer("");

        setMessage("");
      }

    } catch (error) {
      console.error(
        "Alarm checking error:",
        error
      );
    }
  };

  // =====================================================
  // START GLOBAL ALARM CHECKER
  // =====================================================

  useEffect(() => {
    if (!email) {
      return;
    }

    // Check immediately
    checkAlarms();

    // Check every 5 seconds
    alarmIntervalRef.current =
      setInterval(() => {
        checkAlarms();
      }, 5000);

    return () => {
      if (
        alarmIntervalRef.current
      ) {
        clearInterval(
          alarmIntervalRef.current
        );
      }

      // Close audio context
      if (
        audioContextRef.current
      ) {
        try {
          audioContextRef.current.close();
        } catch (error) {
          console.error(
            "Audio close error:",
            error
          );
        }
      }
    };
  }, [email]);

  // =====================================================
  // HANDLE ANSWER
  // =====================================================

  const handleAnswer = () => {
    if (
      !currentChallenge
    ) {
      return;
    }

    if (
      !answer.trim()
    ) {
      setMessage(
        "Please enter your answer."
      );

      return;
    }

    const userAnswer =
      normalizeAnswer(
        answer
      );

    const correctAnswer =
      normalizeAnswer(
        currentChallenge.answer
      );

    console.log(
      "User answer:",
      userAnswer
    );

    console.log(
      "Correct answer:",
      correctAnswer
    );

    if (
      userAnswer ===
      correctAnswer
    ) {
      setMessage(
        "✅ Correct! Wake-up verified."
      );

      // =============================================
      // OPTIONAL BACKEND WAKE-UP VERIFICATION
      // =============================================

      fetch(
        "http://127.0.0.1:8000/wake-up/verify",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email:
              email,

            challenge_completed:
              true,
          }),
        }
      )
        .then(
          async (response) => {
            const data =
              await response.json();

            console.log(
              "Wake-up verification:",
              data
            );
          }
        )
        .catch(
          (error) => {
            console.error(
              "Wake-up verification error:",
              error
            );
          }
        );

      // =============================================
      // DISMISS AFTER SUCCESS
      // =============================================

      setTimeout(() => {
        setShowChallenge(
          false
        );

        setTriggeredAlarm(
          null
        );

        setCurrentChallenge(
          null
        );

        setAnswer("");

        setMessage("");
      }, 1500);

    } else {
      setMessage(
        "❌ Incorrect. Try again to dismiss the alarm."
      );
    }
  };

  // =====================================================
  // NOTHING TO SHOW
  // =====================================================

  if (
    !showChallenge ||
    !triggeredAlarm ||
    !currentChallenge
  ) {
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

        background:
          "rgba(0, 0, 0, 0.75)",

        zIndex: 99999,

        display: "flex",

        alignItems: "center",

        justifyContent:
          "center",

        padding: "20px",
      }}
    >

      <div
        style={{
          width: "100%",

          maxWidth: "500px",

          background:
            "white",

          borderRadius:
            "24px",

          padding: "35px",

          textAlign:
            "center",

          boxShadow:
            "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >

        {/* ===========================================
            ICON
        =========================================== */}

        <div
          style={{
            fontSize: "55px",

            marginBottom:
              "10px",
          }}
        >
          ⏰
        </div>

        {/* ===========================================
            TITLE
        =========================================== */}

        <h1
          style={{
            margin:
              "0 0 10px",

            color:
              "#111827",
          }}
        >
          Wake Up!
        </h1>

        <p
          style={{
            color:
              "#6b7280",

            marginBottom:
              "25px",
          }}
        >
          Your COGNIA alarm is ringing.
        </p>

        {/* ===========================================
            ALARM INFORMATION
        =========================================== */}

        <div
          style={{
            background:
              "#f3f4f6",

            padding:
              "15px",

            borderRadius:
              "14px",

            marginBottom:
              "25px",
          }}
        >

          <strong
            style={{
              fontSize:
                "28px",

              color:
                "#111827",
            }}
          >
            {triggeredAlarm.alarm_time}
          </strong>

          <p
            style={{
              margin:
                "5px 0",

              color:
                "#6b7280",
            }}
          >
            {triggeredAlarm.alarm_type ||
              "Daily"}
          </p>

          <p
            style={{
              margin:
                "5px 0 0",

              color:
                "#6366f1",

              fontWeight:
                "bold",
            }}
          >
            {triggeredAlarm.challenge ||
              "Math"}{" "}
            •{" "}
            {triggeredAlarm.difficulty ||
              "Beginner"}
          </p>

        </div>

        {/* ===========================================
            COGNITIVE CHALLENGE
        =========================================== */}

        <div
          style={{
            background:
              "#eef2ff",

            padding:
              "20px",

            borderRadius:
              "16px",

            marginBottom:
              "20px",
          }}
        >

          <p
            style={{
              fontSize:
                "13px",

              fontWeight:
                "bold",

              color:
                "#6366f1",

              marginBottom:
                "10px",
            }}
          >
            🧠 COGNITIVE CHALLENGE
          </p>

          <p
            style={{
              fontSize:
                "12px",

              color:
                "#6b7280",

              marginBottom:
                "10px",
            }}
          >
            Difficulty:{" "}
            <strong>
              {triggeredAlarm.difficulty ||
                "Beginner"}
            </strong>
          </p>

          <h2
            style={{
              color:
                "#111827",

              fontSize:
                "22px",
            }}
          >
            {currentChallenge.question}
          </h2>

          {/* =========================================
              ANSWER INPUT
          ========================================= */}

          <input
            type="text"

            value={
              answer
            }

            onChange={(e) =>
              setAnswer(
                e.target.value
              )
            }

            onKeyDown={(e) => {
              if (
                e.key ===
                "Enter"
              ) {
                handleAnswer();
              }
            }}

            placeholder=
              "Enter your answer"

            autoFocus

            style={{
              width:
                "100%",

              boxSizing:
                "border-box",

              padding:
                "14px",

              borderRadius:
                "10px",

              border:
                "1px solid #d1d5db",

              fontSize:
                "18px",

              marginTop:
                "15px",

              outline:
                "none",

              color:
                "#111827",
            }}
          />

        </div>

        {/* ===========================================
            RESULT MESSAGE
        =========================================== */}

        {message && (

          <p
            style={{
              fontWeight:
                "bold",

              color:
                message.startsWith(
                  "✅"
                )
                  ? "#16a34a"
                  : "#dc2626",
            }}
          >
            {message}
          </p>

        )}

        {/* ===========================================
            SUBMIT BUTTON
        =========================================== */}

        <button
          onClick={
            handleAnswer
          }

          style={{
            width:
              "100%",

            padding:
              "15px",

            border:
              "none",

            borderRadius:
              "12px",

            background:
              "#6366f1",

            color:
              "white",

            fontSize:
              "16px",

            fontWeight:
              "bold",

            cursor:
              "pointer",
          }}
        >
          🧠 Submit Answer
        </button>

        {/* ===========================================
            FOOTER
        =========================================== */}

        <p
          style={{
            marginTop:
              "15px",

            fontSize:
              "12px",

            color:
              "#9ca3af",
          }}
        >
          Solve the challenge to dismiss the alarm.
        </p>

      </div>

    </div>
  );
}

export default AlarmTrigger;


