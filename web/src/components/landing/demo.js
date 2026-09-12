/**
 * CerebroKognit landing — demo data & challenge generators.
 * Everything here is strictly illustrative: demo challenges, mock analytics,
 * and product copy. No real user data, no fabricated claims.
 */

import {
  AlarmClockIcon,
  BrainIcon,
  TargetIcon,
  BarChartIcon,
} from '../ui';

export const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#insights', label: 'Insights' },
  { href: '#faq', label: 'FAQ' },
];

export const FEATURES = [
  {
    icon: AlarmClockIcon,
    title: 'Intelligent Alarms',
    kicker: 'Wake-up that can’t be ignored',
    tone: 'violet',
    desc: 'Every alarm is gated by a short cognitive challenge, so dismissal means actually being awake.',
    detail: 'Choose math, memory, logic or word challenges at a difficulty that adapts to your streak.',
  },
  {
    icon: BrainIcon,
    title: 'Cognitive Challenges',
    kicker: 'Tuned to your performance',
    tone: 'emerald',
    desc: 'Seven brain-training formats keep your response sharp instead of a tap-and-snooze ritual.',
    detail: 'Adaptive difficulty learns from accuracy and solve time; easier when you struggle, harder when you’re on fire.',
  },
  {
    icon: TargetIcon,
    title: 'Habit Tracking',
    kicker: 'One score, your whole morning',
    tone: 'deep',
    desc: 'A weighted 35/25/20/20 habit score turns waking up consistently into something you can measure.',
    detail: 'Wake-up consistency, challenge completion, snooze reduction and sleep adherence, all rolled into one number.',
  },
  {
    icon: BarChartIcon,
    title: 'Personal Insights',
    kicker: 'See what your data says',
    tone: 'mint',
    desc: 'Weekly trends and recommendations show you what is working; no guesswork, no dark patterns.',
    detail: 'Sleep windows, streaks and attempt accuracy, surfaced as plain-language coaching, not jargon.',
  },
];

export const STEPS = [
  {
    n: '01',
    title: 'Set your wake time',
    desc: 'Pick your schedule, challenge type and difficulty in under a minute.',
    detail: 'The command center arms itself for the next morning in your own timezone.',
    visual: 'sched',
    example: '07:00 · Math · Easy · Daily',
  },
  {
    n: '02',
    title: 'Wake up, solve to dismiss',
    desc: 'When the alarm fires, a quick cognitive challenge stands between you and snooze.',
    detail: 'Answer correctly to unlock dismissal. Snooze exists, but your streak will know about it.',
    visual: 'solve',
    example: '3 + 7 = ?   →  10 · correct',
  },
  {
    n: '03',
    title: 'Build the streak',
    desc: 'Watch your habit score and streak compound, week after week.',
    detail: 'Consistency is rewarded; the score breaks down exactly why a day went well or slipped.',
    visual: 'streak',
    example: '6-day streak · Habit score 78/100',
  },
];

export const FAQS = [
  {
    q: 'How does the alarm actually dismiss?',
    a: 'When an alarm fires, it presents a short cognitive challenge. Solving it correctly unlocks dismissal; that is what proves you’re awake. You can still snooze, but snoozing counts against your habit score.',
  },
  {
    q: 'What kinds of challenges are there?',
    a: 'Math, memory, logic, word, pattern, riddle and quick-quiz formats. Difficulty adapts to your historical accuracy and response time, from Beginner up to Expert.',
  },
  {
    q: 'Is my data private?',
    a: 'Your habit score, sleep patterns and challenge history are yours. The app tracks only what it needs to score your habits, and you can see and delete your data from your account.',
  },
  {
    q: 'Does this replace a medical sleep solution?',
    a: 'No. CerebroKognit is a behavioral habit tool, not a medical device, and it doesn’t claim therapeutic benefits. It simply helps you make waking up a consistent routine.',
  },
  {
    q: 'Does the demo on this page schedule a real alarm?',
    a: 'No, the landing-page demo runs entirely in your browser with sample data. It shows the product flow so you can try it before signing in. Real alarms are scheduled only after you create an account.',
  },
  {
    q: 'How do I get started?',
    a: 'Create an account, set your wake time and preferred challenge, and arm your first alarm. It takes about a minute, and the app works from your phone or browser.',
  },
];

export const PRINCIPLES = [
  {
    title: 'Your data is yours',
    desc: 'Habit and sleep data is private by default, deletable, and never sold. No dark patterns, no surprise sharing.',
  },
  {
    title: 'Truthful about scope',
    desc: 'CerebroKognit is a habit tool, not a medical device. It helps you build routine; it never claims to diagnose or cure.',
  },
  {
    title: 'Built to reduce friction',
    desc: 'The product earns every notification. Alarms are the only interruptions, and challenges keep them meaningful.',
  },
];

/* ---- Demo challenge generator ---------------------------------------- */

export const CHALLENGE_TYPES = ['Math', 'Memory', 'Logic', 'Word'];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export const DIFFICULTY_POINTS = { Easy: 10, Medium: 15, Hard: 25 };

const MULT = { Easy: 2, Medium: 1, Hard: 2 };
const ROLL = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function makeSeed(attempt) {
  const now = Date.now();
  return ((now + attempt * 7919) % 100000) / 100000;
}

function sample(arr, seed) {
  const i = Math.floor(seed * arr.length) % arr.length;
  return arr[i];
}

function mathQuestion(diff, attempt) {
  const max = { Easy: 12, Medium: 25, Hard: 40 }[diff];
  const a = ROLL(2, max);
  const b = ROLL(2, max);
  const op = attempt % 4 === 0 ? '×' : attempt % 4 === 1 ? '+' : attempt % 4 === 2 ? '−' : '+';
  const answer = op === '×' ? a * b : op === '+' ? a + b : a > b ? a - b : b - a;
  const [x, y] = op === '−' && a < b ? [b, a] : [a, b];
  const prompt = diff === 'Hard' ? `Solve: (${x} ${op} ${y}) + ${ROLL(0, 5)}` : `${x} ${op} ${y}`;
  const extra = prompt.startsWith('Solve:') ? ROLL(0, 5) : 0;
  return {
    question: `What is ${prompt}?`,
    hint: 'Work step by step, rate × time counts.',
    answer: String((op === '×' ? x * y : op === '+' ? x + y : x - y) + extra),
  };
}

function memoryQuestion(diff, attempt) {
  const len = { Easy: 4, Medium: 6, Hard: 8 }[diff];
  const seed = makeSeed(attempt);
  let code = '';
  for (let i = 0; i < len; i += 1) {
    const r = sample(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], seed * (i + 3));
    code += r;
  }
  return {
    question: `Memorize the code, then type it back:`,
    memorize: code,
    hint: 'Chunk it into pairs, 4 8 · 2 6 reads easier than one long run.',
    answer: code,
  };
}

function logicQuestion(diff, attempt) {
  const seed = makeSeed(attempt);
  const cases = [
    {
      q: 'Every day you solve the challenge 10 minutes after waking. If you woke at 07:00, when did you solve it?',
      options: ['07:05', '07:10', '07:15', '07:20'],
      answer: '07:10',
    },
    {
      q: 'A streak resets to 0 on a missed morning. If you have a 6-day streak and miss one, what is your streak?',
      options: ['5', '6', '0', '7'],
      answer: '0',
    },
    {
      q: 'Three people set alarms at 6:00, 6:30 and 7:00. Who wakes earliest?',
      options: ['6:00', '6:30', '7:00', 'All together'],
      answer: '6:00',
    },
  ];
  const item = sample(cases, seed + attempt * 0.37);
  return {
    question: item.q,
    options: item.options,
    hint: 'Read the constraints carefully, the trap is in the wording.',
    answer: item.answer,
  };
}

function wordQuestion(diff, attempt) {
  const pools = {
    Easy: ['ALARM', 'BRAIN', 'STREAK', 'WAKE'],
    Medium: ['FOCUS', 'HABIT', 'CIRCLE', 'SHARP'],
    Hard: ['ADAPTIVE', 'COGNITIVE', 'CONSISTENT', 'REWARD'],
  };
  const word = sample(pools[diff], makeSeed(attempt));
  const shuffled = word.split('').sort(() => (makeSeed(attempt + 1) * 10 > 5 ? 1 : -1)).join('');
  const prompt = shuffled === word ? word.split('').reverse().join('') : shuffled;
  return {
    question: `Unscramble the word: ${prompt}`,
    hint: word[0] + '…' + word[word.length - 1],
    answer: word,
  };
}

/**
 * Generate a deterministic-per-session demo challenge.
 * Returns { question, options?, hint, answer, memorize? }.
 */
export function generateChallenge(type, difficulty, attempt = 0) {
  if (type === 'Math') return mathQuestion(difficulty, attempt);
  if (type === 'Memory') return memoryQuestion(difficulty, attempt);
  if (type === 'Logic') return logicQuestion(difficulty, attempt);
  return wordQuestion(difficulty, attempt);
}

/* ---- Demo analytics (labels truthful: illustrative sample) ------------ */

export const SAMPLE_WEEK = [
  { day: 'Mon', score: 62, label: 'Mon' },
  { day: 'Tue', score: 71, label: 'Tue' },
  { day: 'Wed', score: 68, label: 'Wed' },
  { day: 'Thu', score: 74, label: 'Thu' },
  { day: 'Fri', score: 80, label: 'Fri' },
  { day: 'Sat', score: 86, label: 'Sat' },
  { day: 'Sun', score: 83, label: 'Sun' },
];

export const SAMPLE_INSIGHTS = {
  streakDays: 6,
  habitScore: 78,
  consistency: 85,
  accuracy: 91,
  challengesCompleted: 34,
};

/* ---- Showcase mock content (strictly illustrative) -------------------- */

export const PILLARS = [
  { label: 'Wake-up', value: 90, tone: 'violet' },
  { label: 'Challenges', value: 72, tone: 'emerald' },
  { label: 'Snooze cut', value: 68, tone: 'deep' },
  { label: 'Sleep', value: 82, tone: 'mint' },
];

export const CHALLENGE_PREVIEWS = [
  {
    key: 'math',
    label: 'Math · solved',
    question: '3 + 7 = ?',
    meta: 'Math · Hard · 25 pts',
    points: '+25',
    tone: 'ok',
  },
  {
    key: 'memory',
    label: 'Sequence · solved',
    question: 'Sequence: 2, 4, 8, ?',
    meta: 'Memory · Hard · 10 pts',
    points: '+10',
    tone: 'ok',
  },
  {
    key: 'word',
    label: 'Word · missed',
    question: 'Unscramble: "WAKEL"',
    meta: 'Word · Medium · missed',
    points: 'missed',
    tone: 'no',
  },
];