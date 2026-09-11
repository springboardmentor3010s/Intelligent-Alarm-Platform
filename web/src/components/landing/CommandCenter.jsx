import React, { useCallback, useEffect, useState } from 'react';
import { Badge } from '../ui';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  FlameIcon,
  ClockIcon,
  ZapIcon,
  RotateIcon,
} from '../ui';
import {
  CHALLENGE_TYPES,
  DIFFICULTIES,
  DIFFICULTY_POINTS,
  generateChallenge,
} from './demo';

const WAKE_TIMES = ['06:00', '06:30', '07:00', '07:30'];

const TONE = { Easy: 'success', Medium: 'brand', Hard: 'warm' };

/**
 * Interactive command-center product demo. Entirely local state — nothing here
 * schedules a real alarm. Shows the wake → solve → dismiss → streak loop with
 * live score/streak progression and a smooth progress ring.
 */
export default function CommandCenter({ getChallenge = generateChallenge }) {
  const [wakeTime, setWakeTime] = useState('07:00');
  const [type, setType] = useState('Math');
  const [difficulty, setDifficulty] = useState('Easy');
  const [phase, setPhase] = useState('armed'); // armed | ringing | snoozed | dismissed
  const [challenge, setChallenge] = useState(() => getChallenge('Math', 'Easy', 0));
  const [attempt, setAttempt] = useState(0);
  const [input, setInput] = useState('');
  const [option, setOption] = useState(null);
  const [status, setStatus] = useState(null); // null | correct | incorrect
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(false);
  const [note, setNote] = useState(null);

  const TOTAL = 100;

  const resetDemo = () => {
    setWakeTime('07:00');
    setType('Math');
    setDifficulty('Easy');
    setPhase('armed');
    setAttempt(0);
    setInput('');
    setOption(null);
    setStatus(null);
    setScore(0);
    setStreak(0);
    setSolved(false);
    setNote(null);
    setChallenge(getChallenge('Math', 'Easy', 0));
  };

  const fireAlarm = () => {
    setPhase('ringing');
    setNote(null);
    rollChallenge(type, difficulty, attempt);
  };

  const rollChallenge = (nextType = type, nextDifficulty = difficulty, base = attempt) => {
    const next = getChallenge(nextType, nextDifficulty, base + 1);
    setChallenge(next);
    setAttempt(base + 1);
    setStatus(null);
    setInput('');
    setOption(null);
    setSolved(false);
  };

  const changeType = nextType => {
    setType(nextType);
    if (phase === 'ringing' || phase === 'dismissed') {
      rollChallenge(nextType, difficulty, attempt);
    }
  };

  const changeDifficulty = nextDifficulty => {
    setDifficulty(nextDifficulty);
    if (phase === 'ringing' || phase === 'dismissed') {
      rollChallenge(type, nextDifficulty, attempt);
    }
  };

  const submit = useCallback(() => {
    if (!challenge) return;
    const answer =
      challenge.options != null
        ? option
        : input.trim().replace(/\s+/g, ' ').toUpperCase().replace(/^0+(?=\d)/, '');
    if (!answer) return;

    const expected = (challenge.options != null
      ? option
      : String(challenge.answer).trim().toUpperCase()
    );
    const ok =
      challenge.options != null
        ? option === challenge.answer
        : expected === answer || (challenge.memorize != null && answer === challenge.memorize);

    if (ok) {
      const points = DIFFICULTY_POINTS[difficulty] || 10;
      setScore(s => Math.min(TOTAL, s + points));
      setStreak(s => s + 1);
      setStatus('correct');
      setSolved(true);
      setNote(`Correct! +${points} points, streak ${streak + 1}.`);
    } else {
      setStreak(0);
      setStatus('incorrect');
      setSolved(false);
      setNote('Not quite, try again, pace yourself.');
    }
  }, [challenge, input, option, difficulty, streak]);

  const snooze = () => {
    setPhase('snoozed');
    setNote('Demo snoozed, postponed 5 minutes. A real alarm would ring again.');
  };

  const dismiss = () => {
    setPhase('dismissed');
    setNote('Morning verified. Habit score updated.');
  };

  const ringPct = score;

  const isMultipleChoice = challenge && challenge.options != null;

  const nextAction =
    phase === 'armed'
      ? 'Armed, ready for tomorrow morning.'
      : phase === 'ringing'
        ? 'Solve the challenge to unlock dismissal.'
        : phase === 'snoozed'
          ? 'Postponed 5 minutes. Tap to simulate again.'
          : 'Morning complete, score updated.';

  return (
    <div className="cc" aria-label="Interactive product demo (sample data)">
      <div className="cc__chrome" aria-hidden="true"><span /><span /><span /></div>
      <div className="cc__top">
        <div className="cc__title">
          <span className="sys-label"><ZapIcon size={12} /> CerebroKognit · Command Center</span>
          <span className="cc__sub">Everything here uses sample data; it never schedules a real alarm.</span>
        </div>
        <button type="button" className="btn-icon cc__reset" onClick={resetDemo} title="Reset demo">
          <RotateIcon size={16} />
          <span className="visually-hidden">Reset demo</span>
        </button>
      </div>

      <div className="cc__ring-row">
        <div className="cc__ring-wrap">
          <svg className="cc__ring" viewBox="0 0 120 120" role="progressbar" aria-label="Demo habit score">
            <circle className="cc__ring-track" cx="60" cy="60" r="52" />
            <circle
              className="cc__ring-fill"
              cx="60"
              cy="60"
              r="52"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - ringPct}
            />
          </svg>
          <div className="cc__ring-center">
            <span className="cc__ring-num tabular">{score}</span>
            <span className="cc__ring-cap">Habit Score</span>
          </div>
        </div>

        <div className="cc__status">
          <div className="cc__next-label">
            <ClockIcon size={14} /> Next wake window
          </div>
          <div className="cc__next-time tabular">{wakeTime}</div>
          <div className="cc__streak">
            <FlameIcon size={14} />
            <span className="tabular">{streak}</span> day streak
          </div>
        </div>
      </div>

      <div className="cc__meta">
        <span className="cc__nextaction" role="status">
          <span className="led led--on led--live" aria-hidden="true" />
          {nextAction}
        </span>
        <span className="cc__consistency" title="Illustrative sample">
          <span className="sys-label">Wake consistency</span>
          <span className="cc__consistency-track">
            <span className="cc__consistency-fill" style={{ width: '85%' }} />
          </span>
          <span className="cc__consistency-num tabular">85%</span>
        </span>
      </div>

      <div className="cc__controls">
        <fieldset className="cc__fieldset">
          <legend className="cc__legend">Wake time</legend>
          <div className="cc__seg" role="radiogroup" aria-label="Demo wake time">
            {WAKE_TIMES.map(t => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={wakeTime === t}
                className={`cc__seg-btn ${wakeTime === t ? 'is-active' : ''}`}
                onClick={() => setWakeTime(t)}
              >
                <span className="tabular">{t}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="cc__fieldset">
          <legend className="cc__legend">Challenge type</legend>
          <div className="cc__seg" role="radiogroup" aria-label="Demo challenge type">
            {CHALLENGE_TYPES.map(t => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                className={`cc__seg-btn ${type === t ? 'is-active' : ''}`}
                onClick={() => changeType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="cc__fieldset">
          <legend className="cc__legend">Difficulty</legend>
          <div className="cc__seg" role="radiogroup" aria-label="Demo difficulty">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={difficulty === d}
                className={`cc__seg-btn ${difficulty === d ? 'is-active' : ''}`}
                onClick={() => changeDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="cc__stage" aria-live="polite">
        {phase === 'armed' && (
          <div className="cc__armed">
            <p className="cc__armed-text">
              Alarm armed. When it rings, you’ll need to solve a challenge to dismiss it.
            </p>
            <button type="button" className="btn btn-primary" onClick={fireAlarm}>
              Simulate alarm <ArrowRightIcon size={15} />
            </button>
          </div>
        )}

        {(phase === 'ringing' || phase === 'dismissed') && challenge && (
          <div className={`cc__card ${phase === 'dismissed' ? 'cc__card--solved' : ''}`}>
            <div className="cc__card-head">
              <Badge tone={TONE[difficulty]}>{difficulty}</Badge>
              <Badge tone="brand">{type}</Badge>
            </div>

            {phase === 'dismissed' ? (
              <div className="cc__success">
                <CheckCircleIcon size={22} />
                <div>
                  <strong>Verified, you’re awake.</strong>
                  <span>Alarm dismissed. Score updated.</span>
                </div>
              </div>
            ) : (
              <>
                <p className="cc__question">{challenge.question}</p>

                {challenge.memorize != null && (
                  <div className="cc__memorize">
                    <Badge tone="subtle">Memorize</Badge>
                    <code className="tabular">{challenge.memorize}</code>
                  </div>
                )}

                {isMultipleChoice ? (
                  <div className="cc__options" role="radiogroup" aria-label="Answer options">
                    {challenge.options.map(o => (
                      <button
                        key={o}
                        type="button"
                        role="radio"
                        aria-checked={option === o}
                        className={`cc__option ${option === o ? 'is-active' : ''}`}
                        onClick={() => setOption(o)}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                ) : (
                  <label className="cc__answer-label">
                    <span className="visually-hidden">Your answer</span>
                    <input
                      type="text"
                      className="form-input cc__answer"
                      placeholder="Type your answer…"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') submit();
                      }}
                    />
                  </label>
                )}

                <div className="cc__actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={submit}
                    disabled={isMultipleChoice ? option == null : !input.trim()}
                  >
                    Submit answer
                  </button>
                  {solved && (
                    <button type="button" className="btn btn-primary" onClick={dismiss}>
                      Dismiss alarm
                    </button>
                  )}
                </div>

                {solved && (
                  <button type="button" className="btn-ghost cc__next" onClick={() => rollChallenge()}>
                    Next challenge <ArrowRightIcon size={14} />
                  </button>
                )}

                {status === 'correct' && (
                  <div className="cc__feedback cc__feedback--ok" role="status">
                    <CheckCircleIcon size={15} /> Correct, dismissal unlocked.
                  </div>
                )}
                {status === 'incorrect' && (
                  <div className="cc__feedback cc__feedback--no" role="status">
                    <AlertCircleIcon size={15} /> Not quite. Hint: {challenge.hint}
                  </div>
                )}
              </>
            )}

            {phase === 'dismissed' && (
              <button type="button" className="btn btn-ghost cc__next" onClick={resetDemo}>
                Start fresh demo <ArrowRightIcon size={14} />
              </button>
            )}
          </div>
        )}

        {phase === 'snoozed' && (
          <div className="cc__snoozed" role="status">
            <ClockIcon size={20} />
            <div>
              <strong>Snoozed until {wakeTime} + 5 min (demo).</strong>
              <span>This preview doesn’t schedule anything real.</span>
            </div>
            <button type="button" className="btn btn-secondary" onClick={fireAlarm}>
              Simulate alarm again
            </button>
          </div>
        )}
      </div>

      <div className="cc__snooze-bar">
        {(phase === 'ringing' || phase === 'armed') && (
          <button type="button" className="cc__snooze-link" onClick={snooze}>
            Snooze (postpone 5 min)
          </button>
        )}
        {note && (
          <span className="cc__note" role="status">{note}</span>
        )}
      </div>
    </div>
  );
}