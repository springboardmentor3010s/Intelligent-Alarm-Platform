import React, { useState, useEffect } from 'react';
import { Card } from '../../styles';
import { SparklesIcon, CheckCircleIcon } from './Icons';

const DEMO_PUZZLES = [
  { type: 'Math', title: 'Speed Arithmetic', question: 'What is 18 × 7 + 14?', answer: '140', hint: 'Multiply 18 × 7 first' },
  { type: 'Pattern', title: 'Sequence Logic', question: 'Find next: 3, 9, 27, 81, ?', answer: '243', hint: 'Powers of 3' },
  { type: 'Word', title: 'Anagram Unscramble', question: 'Unscramble: K O G N I T', answer: 'KOGNIT', hint: 'Platform name' },
  { type: 'Logic', title: 'Cognitive Deduction', question: 'If 3 cats catch 3 mice in 3 minutes, how many cats catch 100 mice in 100 minutes?', answer: '3', hint: 'Think rate per cat' },
];

const DIFF_STEPS = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
const DIFF_TONE = ['success', 'brand', 'warm', 'warm', 'danger'];

export default function LiveChallengeSimulator() {
  const [index, setIndex] = useState(0);
  const [userAns, setUserAns] = useState('');
  const [status, setStatus] = useState(null); // 'correct' | 'wrong' | null
  const [seconds, setSeconds] = useState(0);
  const [active, setActive] = useState(false);
  const [diffLevel, setDiffLevel] = useState(1); // index into DIFF_STEPS

  const current = DEMO_PUZZLES[index];

  useEffect(() => {
    let timer;
    if (active && status !== 'correct') {
      timer = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [active, status]);

  const handleStart = () => {
    setActive(true);
    setSeconds(0);
    setStatus(null);
    setUserAns('');
  };

  const handleCheck = (e) => {
    e.preventDefault();
    if (!userAns.trim()) return;
    if (userAns.trim().toUpperCase() === current.answer.toUpperCase()) {
      setStatus('correct');
      // Adaptive ML difficulty: correct answers push the level up
      setDiffLevel(d => Math.min(d + 1, DIFF_STEPS.length - 1));
    } else {
      setStatus('wrong');
      // Wrong answers pull the level back down for recovery
      setDiffLevel(d => Math.max(d - 1, 0));
    }
  };

  const handleNext = () => {
    setIndex((index + 1) % DEMO_PUZZLES.length);
    setUserAns('');
    setStatus(null);
    setSeconds(0);
    setActive(true);
  };

  const isHighDiff = diffLevel >= 3;

  return (
    <Card className="p-6 challenge-sim-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="stat-card__icon" style={{ width: '36px', height: '36px' }}><SparklesIcon size={18} /></span>
          <div>
            <div className="sys-label">Interactive Practice Simulator</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{current.title}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`pill ${isHighDiff ? 'pill-brand' : 'pill-success'}`} title="Simulated adaptive ML difficulty, adjusted by your answers">
            Adaptive ML · <strong>{DIFF_STEPS[diffLevel]}</strong>
          </span>
          <span className="pill pill-neutral">
            ⏱ <strong className="tabular">{seconds}s</strong>
          </span>
        </div>
      </div>

      {!active ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
          <p className="text-sm text-muted-600" style={{ marginBottom: '1.25rem' }}>
            Test your morning cognitive agility with a live sample puzzle before your next alarm fires.
          </p>
          <button className="btn btn-primary" onClick={handleStart}>
            <SparklesIcon size={16} /> Start Practice Challenge
          </button>
        </div>
      ) : (
        <div className="sim-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="sim-question-box" style={{ background: 'var(--surface-2)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div className="sys-label" style={{ marginBottom: '0.35rem' }}>
              <span className="led led--on led--live" style={{ marginRight: '0.3rem' }} />
              Question · {current.type} ({DIFF_STEPS[diffLevel]} difficulty)
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {current.question}
            </div>
            {status === 'wrong' && (
              <div className="text-xs text-muted-600" style={{ marginTop: '0.5rem' }}>
                Hint: {current.hint}
              </div>
            )}
          </div>

          <form onSubmit={handleCheck} style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Type your answer..."
              value={userAns}
              onChange={(e) => setUserAns(e.target.value)}
              disabled={status === 'correct'}
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={status === 'correct' || !userAns.trim()}>
              Verify
            </button>
          </form>

          {status === 'correct' && (
            <div className="banner banner-success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-emerald)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircleIcon size={18} />
                <span>Correct! Solved in <strong>{seconds} seconds</strong>. Difficulty raised to <strong>{DIFF_STEPS[Math.min(diffLevel, DIFF_STEPS.length - 1)]}</strong>.</span>
              </div>
              <button className="btn btn-secondary" onClick={handleNext} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                Next Puzzle
              </button>
            </div>
          )}

          {status === 'wrong' && (
            <div className="banner banner-warning">
              <span>Incorrect — difficulty adjusted to {DIFF_STEPS[diffLevel]}. Try again with the hint above!</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
