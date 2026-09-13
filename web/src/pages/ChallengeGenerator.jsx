import React, { useEffect, useRef, useState } from 'react';
import { Card, Grid } from '../styles';
import {
  Badge,
  EmptyState,
  Skeleton,
  SparklesIcon,
  PlayIcon,
  RotateIcon,
  BrainIcon,
  SectionHeader,
  ActivityIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  LiveChallengeSimulator,
} from '../components/ui';

const TYPE_CONFIG = {
  Math: {
    objective: 'Numerical Acuity & Working Memory',
    desc: 'Rapid arithmetic operations and numerical relations designed to activate parietal cortex pathways.',
    icon: '∑',
  },
  Logic: {
    objective: 'Deductive Reasoning & Executive Control',
    desc: 'Structured propositional logic and deductive puzzles to engage the dorsolateral prefrontal cortex.',
    icon: '⬡',
  },
  Memory: {
    objective: 'Short-term Recall & Sequence Retention',
    desc: 'Visual recall and spatial patterns targeting hippocampal activation and focus stabilization.',
    icon: '◈',
  },
  Word: {
    objective: 'Semantic Retrieval & Verbal Fluency',
    desc: 'Anagram deciphering and lexical association tasks to quickly ignite the language centers.',
    icon: 'Aa',
  },
  Pattern: {
    objective: 'Visuospatial Pattern Recognition',
    desc: 'Cyclical pattern extrapolation and geometric sequence inference.',
    icon: '❖',
  },
  Riddle: {
    objective: 'Lateral Thinking & Creative Insight',
    desc: 'Contextual inference and abstract thinking challenges to break morning cognitive rigidity.',
    icon: '?',
  },
  QuickQuiz: {
    objective: 'Rapid Semantic Fact Retrieval',
    desc: 'Fact verification and quick-fire trivia testing immediate neural responsiveness.',
    icon: '⚡',
  },
};

const TYPES = ['All', 'Math', 'Logic', 'Memory', 'Word', 'Pattern', 'Riddle', 'QuickQuiz'];
const DIFFICULTIES = ['All Levels', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];

const DIFF_INDEX = { Beginner: 1, Easy: 2, Medium: 3, Hard: 4, Expert: 5 };

/**
 * Five-segment "laser bar" that visualizes a challenge's difficulty tier.
 * Filled segments read violet; the track reads as a device surface.
 */
function DifficultyLaser({ difficulty }) {
  const level = DIFF_INDEX[difficulty] || 1;
  return (
    <div className="challenge-laser">
      <div className="challenge-laser__head">
        <span className="challenge-laser__label">Difficulty</span>
        <span className="challenge-laser__value">{difficulty}</span>
      </div>
      <div
        className="challenge-laser__track"
        role="img"
        aria-label={`Difficulty level ${level} of ${Object.keys(DIFF_INDEX).length}`}
      >
        {Object.keys(DIFF_INDEX).map((d, i) => (
          <span
            key={d}
            className={`challenge-laser__seg${i < level ? ' is-fill' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Dominant "AI in-flight model" card. Reads like a live product surface:
 * model status, tuned chip, type/objective/laser meta, and edge-case note.
 */
function AiRecommendedCard({ challenge, generating, onSet, onSurprise, flash, setting = false }) {
  const typeInfo = TYPE_CONFIG[challenge.challenge_type] || {};
  return (
    <Card className={`ai-challenge-card${flash ? ' ai-challenge-card--fresh' : ''}`}>
      <div className="ai-challenge-card__head">
        <div className="ai-challenge-card__identity">
          <span className="ai-challenge-card__icon">
            <SparklesIcon size={20} />
          </span>
          <div className="ai-challenge-card__headline">
            <span className="sys-label">AI Recommended Next Challenge</span>
            <div className="ai-challenge-card__title">
              {challenge.title || `${challenge.challenge_type} Challenge`}
            </div>
          </div>
        </div>
        <div className="ai-challenge-card__status">
          <span className="pill pill-success">
            <span className="led led--on" aria-hidden="true" /> Model online
          </span>
          <span className="pill pill-brand">Adaptive ML</span>
        </div>
      </div>

      <p className="ai-challenge-card__desc">
        {typeInfo.desc ||
          'Calibrated to your performance curve to stimulate prefrontal neural firing.'}
      </p>

      <div className="ai-challenge-card__meta">
        <span className="ai-challenge-card__chip">
          <span className="sys-label">Type</span>
          <Badge tone="mono">{challenge.challenge_type}</Badge>
        </span>
        <span className="ai-challenge-card__chip">
          <span className="sys-label">Objective</span>
          <span className="ai-challenge-card__objective">
            {typeInfo.objective || 'Cognitive Focus'}
          </span>
        </span>
        <span className="ai-challenge-card__chip ai-challenge-card__chip--laser">
          <DifficultyLaser difficulty={challenge.difficulty} />
        </span>
      </div>

      <div className="ai-challenge-card__note">
        <BrainIcon size={15} />
        <span>
          A live model surface: difficulty adapts to your recent attempts, none of the copy above
          is placeholder filler.
        </span>
      </div>

      <div className="ai-challenge-card__actions">
        <button className="btn btn-primary" onClick={onSet} disabled={generating || setting}>
          <PlayIcon size={15} /> {setting ? 'Setting…' : 'Set as Wake Gate'}
        </button>
        <button className="btn btn-ghost" onClick={onSurprise} disabled={generating}>
          <RotateIcon size={14} /> Surprise me
        </button>
      </div>
    </Card>
  );
}

export default function ChallengeGenerator() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [token] = useState(localStorage.getItem('token'));
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [recommendedChallenge, setRecommendedChallenge] = useState(null);
  const [selectedType, setSelectedType] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All Levels');
  const [justPicked, setJustPicked] = useState(false);
  const [savingAlarm, setSavingAlarm] = useState(false);
  const [wakeNotice, setWakeNotice] = useState(null); // { ok: bool, text } for Set as Wake Gate
  const aiCardRef = useRef(null);

  /* After a user pick, bring the AI card into view and flash its border so the
     "clicked card -> next challenge" hand-off is obvious. */
  useEffect(() => {
    if (!justPicked || !recommendedChallenge) return undefined;
    aiCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const t = setTimeout(() => setJustPicked(false), 1400);
    return () => clearTimeout(t);
  }, [justPicked, recommendedChallenge]);

  useEffect(() => {
    fetch('/api/v1/challenges', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setChallenges(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error(err);
        setError('Could not load challenges.');
      })
      .finally(() => setLoading(false));

    // Also pre-fetch the recommended next challenge
    fetch('/api/v1/challenges/next', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => (res.ok ? res.json() : null))
      .then(setRecommendedChallenge)
      .catch(() => {});
  }, [token]);

  const generateNext = async (challengeType, difficulty) => {
    setGenerating(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (challengeType && challengeType !== 'All') params.set('challenge_type', challengeType);
      if (difficulty && difficulty !== 'All Levels') params.set('difficulty', difficulty);
      const qs = params.toString();
      const res = await fetch(`/api/v1/challenges/next${qs ? `?${qs}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Generation failed');
      }
      const data = await res.json();
      setRecommendedChallenge(data);
      setJustPicked(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  /* "Set as Wake Gate" creates a real Daily alarm wired to the recommended
     challenge (type + difficulty), instead of the previous no-op that merely
     regenerated the same challenge. Skips creation when an identical Daily
     wake gate is already active for this user. */
  const setAsWakeGate = async () => {
    if (!recommendedChallenge || savingAlarm) return;
    setSavingAlarm(true);
    setWakeNotice(null);
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    try {
      const existing = await fetch('/api/v1/alarms', { headers });
      const myAlarms = existing.ok ? await existing.json() : [];
      const duplicate = Array.isArray(myAlarms) && myAlarms.some(a =>
        a.is_enabled &&
        a.alarm_type === 'Daily' &&
        a.challenge_type === recommendedChallenge.challenge_type &&
        a.difficulty === recommendedChallenge.difficulty
      );
      if (duplicate) {
        setWakeNotice({
          ok: true,
          text: `Already active: your ${recommendedChallenge.difficulty} ${recommendedChallenge.challenge_type} wake gate is already set.`,
        });
        return;
      }
      const res = await fetch('/api/v1/alarms', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: `${recommendedChallenge.challenge_type} Wake Gate`,
          type: 'Daily',
          time: '07:00',
          challenge_type: recommendedChallenge.challenge_type,
          difficulty: recommendedChallenge.difficulty,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Could not set wake gate');
      }
      setWakeNotice({
        ok: true,
        text: `Wake gate set: ${recommendedChallenge.challenge_type} at ${recommendedChallenge.difficulty} difficulty, daily 07:00.`,
      });
    } catch (err) {
      setWakeNotice({ ok: false, text: err.message });
    } finally {
      setSavingAlarm(false);
    }
  };

  const filtered = challenges.filter(c => {
    const matchesType = selectedType === 'All' || c.challenge_type === selectedType;
    const matchesDiff = selectedDifficulty === 'All Levels' || c.difficulty === selectedDifficulty;
    return matchesType && matchesDiff;
  });

  if (loading) {
    return (
      <div className="page">
        <SectionHeader title="Challenges" subtitle="Adaptive cognitive challenges, tuned to your skill" />
        <div className="grid-cards">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="card" key={i}>
              <Skeleton tone="line" style={{ width: '35%' }} />
              <Skeleton tone="line" style={{ width: '80%', marginTop: '0.8rem' }} />
              <Skeleton tone="block" style={{ height: '44px', marginTop: '0.8rem' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <SectionHeader
        title="Challenges"
        subtitle="Adaptive cognitive puzzles engineered to overcome sleep inertia and prime focus"
      >
        <button
          className="btn btn-primary"
          onClick={() => generateNext()}
          disabled={generating}
          aria-busy={generating}
        >
          <SparklesIcon size={16} />
          {generating ? 'Generating…' : 'Generate Adaptive Challenge'}
        </button>
      </SectionHeader>

      {error && <div className="banner banner-warning">{error}</div>}

      {/* Dominant AI Recommended / Current Challenge surface */}
      {recommendedChallenge && (
        <div ref={aiCardRef} className="ai-challenge-card-anchor">
          <AiRecommendedCard
            challenge={recommendedChallenge}
            generating={generating}
            flash={justPicked}
            setting={savingAlarm}
            onSet={setAsWakeGate}
            onSurprise={() => generateNext()}
          />
        </div>
      )}

      {wakeNotice && (
        <div className={`banner ${wakeNotice.ok ? 'banner-success' : 'banner-error'} mt-3`} role="status">
          {wakeNotice.ok ? (
            <CheckCircleIcon size={17} />
          ) : (
            <AlertCircleIcon size={17} />
          )}
          <span>{wakeNotice.text}</span>
        </div>
      )}

      {/* Interactive Hands-On Practice Simulator */}
      <LiveChallengeSimulator practice={recommendedChallenge} />

      {/* Filtering & Grouping surface */}
      <div className="challenge-filters">
        <div className="challenge-filters__row">
          <span className="sys-label challenge-filters__label">Cognitive Type</span>
          <div className="challenge-type-pills" role="group" aria-label="Filter by cognitive type">
            {TYPES.map(t => (
              <button
                key={t}
                type="button"
                className={`challenge-type-pill${selectedType === t ? ' is-active' : ''}`}
                onClick={() => setSelectedType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="challenge-filters__row">
          <span className="sys-label challenge-filters__label">Difficulty</span>
          <div className="segmented" role="group" aria-label="Filter by difficulty">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                type="button"
                className={selectedDifficulty === d ? 'is-active' : ''}
                onClick={() => setSelectedDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Challenge Catalog Grid */}
      {filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<SparklesIcon size={24} />}
            title="No matching cognitive challenges"
            description="Try changing the type or difficulty filter above to explore the catalog."
            action={
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedType('All');
                  setSelectedDifficulty('All Levels');
                }}
              >
                Reset Filters
              </button>
            }
          />
        </div>
      ) : (
        <Grid>
          {filtered.map(challenge => {
            const typeInfo = TYPE_CONFIG[challenge.challenge_type] || {};
            const isRecommended = recommendedChallenge?.id === challenge.id;
            return (
              <Card
                key={challenge.id}
                className={`challenge-card${isRecommended ? ' challenge-card--recommended' : ''}`}
              >
                <div className="challenge-card__head">
                  <span className="challenge-card__icon">
                    {typeInfo.icon || '✦'}
                  </span>
                  <div className="challenge-card__badges">
                    <Badge tone="mono">{challenge.challenge_type}</Badge>
                    <Badge tone="mono">{challenge.difficulty}</Badge>
                  </div>
                </div>

                <div className="challenge-title">{challenge.title}</div>
                <div className="challenge-objective">{typeInfo.objective || 'Prefrontal Activation'}</div>
                <p className="text-sm text-muted-600 challenge-desc">
                  {challenge.description || typeInfo.desc || `${challenge.challenge_type} puzzle`}
                </p>

                <DifficultyLaser difficulty={challenge.difficulty} />

                <div className="challenge-actions">
                  <span className="challenge-ml-note">
                    <ActivityIcon size={13} /> Adaptive ML
                  </span>
                  <button
                    className="btn btn-primary challenge-go"
                    onClick={() => generateNext(challenge.challenge_type, challenge.difficulty)}
                    disabled={generating}
                    title="Generate and set this challenge"
                  >
                    <PlayIcon size={14} /> Practice / Set
                  </button>
                </div>
              </Card>
            );
          })}
        </Grid>
      )}
    </div>
  );
}