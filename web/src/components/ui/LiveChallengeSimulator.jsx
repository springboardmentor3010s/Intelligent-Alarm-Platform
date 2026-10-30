// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useState, useEffect } from 'react';
import { Card } from '../../styles';
import { SparklesIcon, CheckCircleIcon, BrainIcon, RotateIcon, ClockIcon } from './Icons';

/* Per-type sample banks with one question per difficulty tier. The simulator
   advances to the question matching the adaptive difficulty after every answer,
   so the practice surface visibly adapts (harder samples as you climb). */
const POOL = {
  Math: [
    { type: 'Math', tag: 'Easy', title: 'Quick Multiply', question: 'What is 12 × 4?', answer: '48' },
    { type: 'Math', tag: 'Medium', title: 'Speed Arithmetic', question: 'What is 18 × 7 + 14?', answer: '140' },
    { type: 'Math', tag: 'Hard', title: 'Root Sprint', question: 'Add 8 to the square root of 144 (give one number)', answer: '20' },
    { type: 'Math', tag: 'Expert', title: 'Bodmas Sprint', question: 'Solve: (6 × 3) ÷ 2 + 10 - 3', answer: '16' },
  ],
  Logic: [
    { type: 'Logic', tag: 'Easy', title: 'Sibling Logic', question: 'A father has 3 sons and each son has 1 sister. How many children does he have?', answer: '4' },
    { type: 'Logic', tag: 'Medium', title: 'Cognitive Deduction', question: 'If 3 cats catch 3 mice in 3 minutes, how many cats catch 100 mice in 100 minutes?', answer: '3' },
    { type: 'Logic', tag: 'Hard', title: 'Truth Table', question: 'One box has gold. A sign on box 2 says "The gold is in the other box." The sign lies. Which box holds the gold? (answer 1 or 2)', answer: '2' },
    { type: 'Logic', tag: 'Expert', title: 'Deadline Math', question: 'A train departs at 9:15 and takes 85 minutes. What time does it arrive? (24h HH:MM)', answer: '10:40' },
  ],
  Memory: [
    { type: 'Memory', tag: 'Easy', title: 'Span Recall', question: 'Recall the sequence: 5, 8, 2. Which number appeared second?', answer: '8' },
    { type: 'Memory', tag: 'Medium', title: 'Digit Span', question: 'Recall the sequence: 7 2 9 4 5 8. Which number came 3rd?', answer: '9' },
    { type: 'Memory', tag: 'Hard', title: 'Letter Trace', question: 'Recall: C A T. What was the 2nd letter?', answer: 'A' },
    { type: 'Memory', tag: 'Expert', title: 'Spatial Recall', question: 'Memorize: 3 9 1 7 4 2 8. Which position is the number 4 in? (answer a digit)', answer: '5' },
  ],
  Word: [
    { type: 'Word', tag: 'Easy', title: 'Anagram Start', question: 'Unscramble: P A E L (it comes before fall, 4 letters)', answer: 'LEAP' },
    { type: 'Word', tag: 'Medium', title: 'Anagram Unscramble', question: 'Unscramble: N T I K O G', answer: 'KOGNIT' },
    { type: 'Word', tag: 'Hard', title: 'Bird Unscramble', question: 'Unscramble: S R U H T H (a small songbird, 6 letters)', answer: 'THRUSH' },
    { type: 'Word', tag: 'Expert', title: 'Double Meaning', question: 'Which word means both a fruit and a computer company? (5 letters)', answer: 'APPLE' },
  ],
  Pattern: [
    { type: 'Pattern', tag: 'Easy', title: 'Even Steps', question: 'Find next: 2, 4, 6, 8, ?', answer: '10' },
    { type: 'Pattern', tag: 'Medium', title: 'Sequence Logic', question: 'Find next: 3, 9, 27, 81, ?', answer: '243' },
    { type: 'Pattern', tag: 'Hard', title: 'Fibonacci Run', question: 'Find next: 1, 1, 2, 3, 5, 8, ?', answer: '13' },
    { type: 'Pattern', tag: 'Expert', title: 'Wave Cycle', question: 'Find next: 10, 20, 10, 20, 10, ?', answer: '20' },
  ],
  Riddle: [
    { type: 'Riddle', tag: 'Easy', title: 'Face Time', question: 'What has a face and two hands but no arms? (one word)', answer: 'CLOCK' },
    { type: 'Riddle', tag: 'Medium', title: 'Morning Riddle', question: 'I have keys but no locks, I have space but no room. What am I? (one word)', answer: 'KEYBOARD' },
    { type: 'Riddle', tag: 'Hard', title: 'Leaving Trace', question: 'The more you take, the more you leave behind. What are they? (one word)', answer: 'STEPS' },
    { type: 'Riddle', tag: 'Expert', title: 'Drying Out', question: 'What gets wetter the more it dries? (one word)', answer: 'TOWEL' },
  ],
  QuickQuiz: [
    { type: 'QuickQuiz', tag: 'Easy', title: 'Week Count', question: 'How many days in a week? (one word)', answer: 'SEVEN' },
    { type: 'QuickQuiz', tag: 'Medium', title: 'Fact Sprint', question: 'Which planet is called the Red Planet? (one word)', answer: 'MARS' },
    { type: 'QuickQuiz', tag: 'Hard', title: 'Liquid Metal', question: 'Which metal is liquid at room temperature? (one word)', answer: 'MERCURY' },
    { type: 'QuickQuiz', tag: 'Expert', title: 'First Steps', question: 'Who was the first person to step on the Moon? (surname)', answer: 'ARMSTRONG' },
  ],
};

const DIFF_STEPS = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];

function poolIndexFor(level, pool) {
  const tag = DIFF_STEPS[level];
  const found = pool.findIndex(q => q.tag === tag);
  return found >= 0 ? found : Math.min(Math.max(level - 1, 0), pool.length - 1);
}

export default function LiveChallengeSimulator({ practice = null, onWakeGate = null, wakeSaving = false }) {
  const hasMirror = practice?.challenge_type && POOL[practice.challenge_type];
  const mirrorType = hasMirror ? practice.challenge_type : 'Math';

  const [index, setIndex] = useState(() =>
    poolIndexFor(practice?.difficulty ? DIFF_STEPS.indexOf(practice.difficulty) : 1, POOL[mirrorType])
  );
  const [userAns, setUserAns] = useState('');
  const [status, setStatus] = useState(null); // 'correct' | 'wrong' | null
  const [seconds, setSeconds] = useState(0);
  const [answeredSeconds, setAnsweredSeconds] = useState(0);
  const [active, setActive] = useState(false);
  const [diffLevel, setDiffLevel] = useState(() =>
    practice?.difficulty ? DIFF_STEPS.indexOf(practice.difficulty) : 1
  );
  const [mirrorSeed, setMirrorSeed] = useState(() => (hasMirror ? practice.challenge_type : 'Math'));
  const [manual, setManual] = useState(false);

  const pool = POOL[mirrorSeed] ?? POOL[mirrorType] ?? POOL.Math;

  const current = pool[index];

  /* When the selected challenge above changes type, mirror it below: switch to
     that type's sample bank, pin the simulated difficulty to the selection,
     and jump to the question that matches that tier. Randomized picks win. */
  useEffect(() => {
    if (manual) return;
    if (mirrorType === mirrorSeed) return;
    setMirrorSeed(mirrorType);
    const level = practice?.difficulty ? DIFF_STEPS.indexOf(practice.difficulty) : 1;
    setDiffLevel(level);
    setIndex(poolIndexFor(level, POOL[mirrorType]));
    setUserAns('');
    setStatus(null);
    setSeconds(0);
  }, [manual, mirrorType, mirrorSeed, practice?.difficulty]);

  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const handleStart = () => {
    setActive(true);
    setSeconds(0);
    setStatus(null);
    setUserAns('');
  };

  const handleRandomize = () => {
    const types = Object.keys(POOL);
    const type = types[Math.floor(Math.random() * types.length)];
    const level = Math.floor(Math.random() * DIFF_STEPS.length);
    setManual(true);
    setMirrorSeed(type);
    setDiffLevel(level);
    setIndex(poolIndexFor(level, POOL[type]));
    setUserAns('');
    setStatus(null);
    setSeconds(0);
    setAnsweredSeconds(0);
  };

  const handleCheck = (e) => {
    e.preventDefault();
    if (!userAns.trim()) return;
    const isCorrect = userAns.trim().toUpperCase() === current.answer.toUpperCase();
    const answeredIn = seconds;
    const level = isCorrect
      ? Math.min(diffLevel + 1, DIFF_STEPS.length - 1)
      : Math.max(diffLevel - 1, 0);
    setDiffLevel(level);
    setAnsweredSeconds(answeredIn);
    setStatus(isCorrect ? 'correct' : 'wrong');
    /* Advance to the next tier-matched question so the surface visibly adapts. */
    setIndex(poolIndexFor(level, pool));
    setUserAns('');
    setSeconds(0);
  };

  const isHighDiff = diffLevel >= 3;
  const previewRows = [pool[index], pool[(index + 1) % pool.length], pool[(index + 2) % pool.length]];

  return (
    <Card className="p-5 challenge-sim-card">
      <div className="sim-head">
        <div className="sim-head__top">
          <div className="sim-head__title">
            <span className="stat-card__icon sim-head__icon"><SparklesIcon size={17} /></span>
            <div className="sim-head__title-text">
              <div className="sys-label">Adaptive AI Practice Simulator</div>
              {!active ? (
                <div className="sim-head__sub">
                  {hasMirror && !manual
                    ? `Mirroring your selected ${mirrorType} challenge`
                    : 'Live practice sample. Hit Randomize to switch type and difficulty.'}
                </div>
              ) : (
                <div className="sim-head__question">{current.title}</div>
              )}
            </div>
          </div>
          {active && (
            <div className="sim-head__timer" aria-label="Practice timer">
              <ClockIcon size={14} />
              <strong className="tabular">{seconds}s</strong>
            </div>
          )}
        </div>

        <div className="sim-head__chips">
          <span className={`sim-chip sim-chip--diff${isHighDiff ? ' is-high' : ''}`} title="Simulated adaptive ML difficulty, adjusted by your answers">
            <span className="sim-chip__label">Difficulty</span>
            <strong>{DIFF_STEPS[diffLevel]}</strong>
          </span>
          <span className="sim-chip sim-chip--type" title="Challenge type">
            <span className="sim-chip__label">Type</span>
            <strong>{mirrorSeed}</strong>
          </span>
        </div>

        <div className="sim-head__actions">
          <button type="button" className="btn sim-rand-btn" onClick={handleRandomize} title="Pick a random challenge type and difficulty">
            <RotateIcon size={15} /> Randomize
          </button>
          {onWakeGate && (
            <button
              type="button"
              className="btn btn-primary sim-gate-btn"
              onClick={() => onWakeGate(mirrorSeed, DIFF_STEPS[diffLevel])}
              disabled={wakeSaving}
              title="Create a daily wake gate alarm for this challenge"
            >
              <SparklesIcon size={15} /> {wakeSaving ? 'Setting…' : 'Set as Wake Gate'}
            </button>
          )}
        </div>
      </div>

      {!active ? (
        <div className="sim-idle">
          <div className="sim-idle__copy">
            <p className="text-sm text-muted-600">
              {hasMirror && !manual
                ? `Practice the ${mirrorType} sample below. The Adaptive AI moves the simulated difficulty on every answer, and the question adapts to your tier.`
                : `Practice a random ${mirrorSeed} sample. The Adaptive AI moves the simulated difficulty on every answer, and the question adapts to your tier.`}
            </p>
            <button className="btn btn-primary" onClick={handleStart}>
              <SparklesIcon size={16} /> Start Practice Challenge
            </button>
          </div>

          <div className="sim-preview" aria-hidden="true">
            <div className="sim-preview__head">
              <span className="sys-label">Sample Bank · {mirrorSeed}</span>
              <div className="sim-preview__meter" role="img" aria-label="Practice difficulty ladder">
                {[0, 1, 2, 3, 4].map(i => (
                  <span key={i} className={`sim-preview__seg${i <= diffLevel ? ' is-fill' : ''}`} />
                ))}
              </div>
            </div>
            <ul className="sim-preview__list">
              {previewRows.map((p, i) => (
                <li
                  key={`${p.tag}-${i}`}
                  className={`sim-preview__row${i === 0 ? ' sim-preview__row--mirror' : ''}`}
                >
                  <span className="sim-preview__dot" />
                  <span className="sim-preview__type">{p.type}</span>
                  <span className="sim-preview__q">{p.question}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="sim-body">
          <div className="sim-question-box">
            <div className="sys-label">
              <span className="led led--on led--live" style={{ marginRight: '0.3rem' }} />
              Question · {current.type}
            </div>
            <div className="sim-question-text">{current.question}</div>
          </div>

          <form onSubmit={handleCheck} className="sim-answer">
            <input
              type="text"
              className="form-input"
              placeholder="Type your answer..."
              value={userAns}
              onChange={(e) => setUserAns(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={!userAns.trim()}>
              Verify
            </button>
          </form>

          {status === 'correct' && (
            <div className="banner banner-success sim-feedback sim-feedback--ok">
              <div className="sim-feedback__text">
                <CheckCircleIcon size={17} />
                <span>
                  Correct! Solved in <strong>{answeredSeconds} seconds</strong>. Difficulty adjusted to{' '}
                  <strong>{DIFF_STEPS[diffLevel]}</strong> - here is the next sample.
                </span>
              </div>
            </div>
          )}

          {status === 'wrong' && (
            <div className="banner banner-error sim-feedback sim-feedback--bad">
              <BrainIcon size={16} />
              <span>
                Incorrect - difficulty adjusted to <strong>{DIFF_STEPS[diffLevel]}</strong>. Here is an easier sample.
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}