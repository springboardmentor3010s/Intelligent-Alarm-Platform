import React, { useEffect, useState } from 'react';
import { Card, Grid } from '../styles';
import {
  Badge,
  EmptyState,
  Skeleton,
  SparklesIcon,
  PlayIcon,
  SectionHeader,
  ActivityIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  LiveChallengeSimulator,
  SlidersIcon,
  RotateIcon,
} from '../components/ui';
import { apiFetch } from '../utils/api';

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

export default function ChallengeGenerator() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [recommendedChallenge, setRecommendedChallenge] = useState(null);
  const [selectedType, setSelectedType] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All Levels');
  const [savingAlarm, setSavingAlarm] = useState(false);
  const [wakeNotice, setWakeNotice] = useState(null); // { ok: bool, text } for Set as Wake Gate

  useEffect(() => {
    apiFetch('/api/v1/challenges')
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
    apiFetch('/api/v1/challenges/next')
      .then(res => (res.ok ? res.json() : null))
      .then(setRecommendedChallenge)
      .catch(() => {});
  }, []);

  const generateNext = async (challengeType, difficulty) => {
    setGenerating(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (challengeType && challengeType !== 'All') params.set('challenge_type', challengeType);
      if (difficulty && difficulty !== 'All Levels') params.set('difficulty', difficulty);
      const qs = params.toString();
      const res = await apiFetch(`/api/v1/challenges/next${qs ? `?${qs}` : ''}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Generation failed');
      }
      const data = await res.json();
      setRecommendedChallenge(data);
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
  const setAsWakeGate = async (challengeType, difficulty) => {
    if (savingAlarm) return;
    setSavingAlarm(true);
    setWakeNotice(null);
    try {
      const existing = await apiFetch('/api/v1/alarms');
      const myAlarms = existing.ok ? await existing.json() : [];
      const duplicate = Array.isArray(myAlarms) && myAlarms.some(a =>
        a.is_enabled &&
        a.alarm_type === 'Daily' &&
        a.challenge_type === challengeType &&
        a.difficulty === difficulty
      );
      if (duplicate) {
        setWakeNotice({
          ok: true,
          text: `Already active: your ${difficulty} ${challengeType} wake gate is already set.`,
        });
        return;
      }
      const res = await apiFetch('/api/v1/alarms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${challengeType} Wake Gate`,
          type: 'Daily',
          time: '07:00',
          challenge_type: challengeType,
          difficulty: difficulty,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Could not set wake gate');
      }
      setWakeNotice({
        ok: true,
        text: `Wake gate set: ${challengeType} at ${difficulty} difficulty, daily 07:00.`,
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

  const resetFilters = () => {
    setSelectedType('All');
    setSelectedDifficulty('All Levels');
  };

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
      />

      {error && <div className="banner banner-warning">{error}</div>}

      {/* Command bento: tune + live adaptive practice + filters */}
      <div className="challenge-bento">
        {/* Tune: regenerate by type + difficulty */}
        <section className="bento bento--tune">
          <div className="bento__head">
            <SlidersIcon size={15} />
            <span>Generate &amp; Tune</span>
          </div>
          <div className="bento__row">
            <div className="bento__field">
              <label className="form-field-label" htmlFor="gen-type">Challenge Type</label>
              <select
                id="gen-type"
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
              >
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="bento__field">
              <label className="form-field-label" htmlFor="gen-diff">Difficulty</label>
              <select
                id="gen-diff"
                value={selectedDifficulty}
                onChange={e => setSelectedDifficulty(e.target.value)}
              >
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => generateNext(selectedType, selectedDifficulty)}
            disabled={generating}
            aria-busy={generating}
          >
            <SparklesIcon size={15} />
            {generating ? 'Generating…' : 'Generate Adaptive Challenge'}
          </button>
        </section>

        {/* Adaptive AI Practice Simulator */}
        <section className="bento bento--practice">
          <LiveChallengeSimulator
            practice={recommendedChallenge}
            onWakeGate={setAsWakeGate}
            wakeSaving={savingAlarm}
          />
        </section>

        {/* Filters: unified cognitive type + difficulty panel (spans full width) */}
        <section className="bento bento--filters catalog-filters">
          <div className="catalog-filters__head">
            <span className="catalog-filters__title">
              <SlidersIcon size={15} />
              Catalog Filters
            </span>
            <span className="catalog-filters__meta">
              <span className="catalog-filters__count" role="status">
                Showing <strong className="tabular">{filtered.length}</strong> of {challenges.length}
              </span>
              {(selectedType !== 'All' || selectedDifficulty !== 'All Levels') && (
                <button type="button" className="btn catalog-filters__reset" onClick={resetFilters} title="Clear the active filters">
                  <RotateIcon size={13} /> Reset
                </button>
              )}
            </span>
          </div>

          <div className="catalog-filters__groups">
            <div className="cf-group">
              <span className="cf-group__label">Cognitive Type</span>
              <div className="cf-pills" role="group" aria-label="Filter by cognitive type">
                {TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`cf-pill${selectedType === t ? ' is-active' : ''}`}
                    onClick={() => setSelectedType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="cf-group">
              <span className="cf-group__label">Difficulty</span>
              <div className="cf-pills" role="group" aria-label="Filter by difficulty">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`cf-pill${selectedDifficulty === d ? ' is-active' : ''}`}
                    onClick={() => setSelectedDifficulty(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

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
                onClick={resetFilters}
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