import React, { useEffect, useState } from 'react';
import { Card, Grid } from '../styles';
import {
  Badge,
  DifficultyBadge,
  EmptyState,
  Skeleton,
  SparklesIcon,
  PlayIcon,
  SectionHeader,
  ActivityIcon,
  LiveChallengeSimulator,
} from '../components/ui';

const TYPE_CONFIG = {
  Math: {
    objective: 'Numerical Acuity & Working Memory',
    desc: 'Rapid arithmetic operations and numerical relations designed to activate parietal cortex pathways.',
    badgeTone: 'brand',
    icon: '∑',
  },
  Logic: {
    objective: 'Deductive Reasoning & Executive Control',
    desc: 'Structured propositional logic and deductive puzzles to engage the dorsolateral prefrontal cortex.',
    badgeTone: 'brand',
    icon: '⬡',
  },
  Memory: {
    objective: 'Short-term Recall & Sequence Retention',
    desc: 'Visual recall and spatial patterns targeting hippocampal activation and focus stabilization.',
    badgeTone: 'mint',
    icon: '◈',
  },
  Word: {
    objective: 'Semantic Retrieval & Verbal Fluency',
    desc: 'Anagram deciphering and lexical association tasks to quickly ignite the language centers.',
    badgeTone: 'warm',
    icon: 'Aa',
  },
  Pattern: {
    objective: 'Visuospatial Pattern Recognition',
    desc: 'Cyclical pattern extrapolation and geometric sequence inference.',
    badgeTone: 'brand',
    icon: '❖',
  },
  Riddle: {
    objective: 'Lateral Thinking & Creative Insight',
    desc: 'Contextual inference and abstract thinking challenges to break morning cognitive rigidity.',
    badgeTone: 'subtle',
    icon: '?',
  },
  QuickQuiz: {
    objective: 'Rapid Semantic Fact Retrieval',
    desc: 'Fact verification and quick-fire trivia testing immediate neural responsiveness.',
    badgeTone: 'brand',
    icon: '⚡',
  },
};

const TYPES = ['All', 'Math', 'Logic', 'Memory', 'Word', 'Pattern', 'Riddle', 'QuickQuiz'];
const DIFFICULTIES = ['All Levels', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];

export default function ChallengeGenerator() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [token] = useState(localStorage.getItem('token'));
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [recommendedChallenge, setRecommendedChallenge] = useState(null);
  const [selectedType, setSelectedType] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All Levels');

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
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
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

      {/* Dominant Recommended / Current Challenge Hero */}
      {recommendedChallenge && (
        <Card
          className="mb-6"
          style={{
            borderLeft: '4px solid var(--c-violet)',
            background: 'linear-gradient(135deg, var(--surface) 0%, var(--c-violet-soft) 100%)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span className="sys-label">
              <span className="led led--on led--live" style={{ marginRight: '0.3rem' }} />
              AI Recommended Next Challenge
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <Badge tone="brand">{recommendedChallenge.challenge_type}</Badge>
              <DifficultyBadge difficulty={recommendedChallenge.difficulty} />
            </div>
          </div>

          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>
            {recommendedChallenge.title || `${recommendedChallenge.challenge_type} Challenge`}
          </div>

          <p className="text-sm text-muted-600 mt-1" style={{ maxWidth: '720px' }}>
            {TYPE_CONFIG[recommendedChallenge.challenge_type]?.desc ||
              'Calibrated to your performance curve to stimulate prefrontal neural firing.'}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.15rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => generateNext(recommendedChallenge.challenge_type, recommendedChallenge.difficulty)}
              disabled={generating}
            >
              <PlayIcon size={15} /> Set as Wake Gate
            </button>
            <span className="text-xs text-muted-600">
              Objective: <strong>{TYPE_CONFIG[recommendedChallenge.challenge_type]?.objective || 'Cognitive Focus'}</strong>
            </span>
          </div>
        </Card>
      )}

      {/* Interactive Hands-On Practice Simulator */}
      <div className="mb-4">
        <LiveChallengeSimulator />
      </div>

      {/* Filtering & Grouping Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span className="sys-label" style={{ minWidth: '90px' }}>Cognitive Type:</span>
          <div className="segmented" style={{ flexWrap: 'wrap' }}>
            {TYPES.map(t => (
              <button
                key={t}
                type="button"
                className={selectedType === t ? 'is-active' : ''}
                onClick={() => setSelectedType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span className="sys-label" style={{ minWidth: '90px' }}>Difficulty:</span>
          <div className="segmented" style={{ flexWrap: 'wrap' }}>
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
            return (
              <Card key={challenge.id} className="challenge-card">
                <div>
                  <div className="challenge-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '26px',
                          height: '26px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--c-violet-soft)',
                          color: 'var(--c-violet)',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                        }}
                      >
                        {typeInfo.icon || '✦'}
                      </span>
                      <Badge tone={typeInfo.badgeTone || 'subtle'}>{challenge.challenge_type}</Badge>
                    </div>
                    <DifficultyBadge difficulty={challenge.difficulty} />
                  </div>

                  <div className="challenge-title">{challenge.title}</div>
                  <div className="text-xs text-muted-600 mb-2" style={{ fontWeight: 600, color: 'var(--c-violet)' }}>
                    {typeInfo.objective || 'Prefrontal Activation'}
                  </div>
                  <p className="text-sm text-muted-600 challenge-desc">
                    {challenge.description || typeInfo.desc || `${challenge.challenge_type} puzzle`}
                  </p>
                </div>

                <div className="challenge-actions">
                  <span className="text-xs text-muted-600">Adaptive ML Ready</span>
                  <button
                    className="btn btn-ghost"
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