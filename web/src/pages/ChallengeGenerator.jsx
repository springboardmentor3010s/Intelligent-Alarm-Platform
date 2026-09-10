import React, { useEffect, useState } from 'react';
import { Card, Grid } from '../styles';
import { Badge, DifficultyBadge, EmptyState, Skeleton, SparklesIcon, PlayIcon } from '../components/ui';

function categoryBadge(type) {
  return <Badge tone="subtle">{type}</Badge>;
}

export default function ChallengeGenerator() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [token] = useState(localStorage.getItem('token'));
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [newChallenge, setNewChallenge] = useState(null);
  const [activeCard, setActiveCard] = useState(null);

  useEffect(() => {
    fetch('/api/v1/challenges', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setChallenges(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error(err);
        setError('Could not load challenges.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const generateNext = async (challengeType, difficulty) => {
    setGenerating(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (challengeType) params.set('challenge_type', challengeType);
      if (difficulty) params.set('difficulty', difficulty);
      const qs = params.toString();
      const res = await fetch(`/api/v1/challenges/next${qs ? `?${qs}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'generate failed'); }
      const data = await res.json();
      setNewChallenge(data);
      setActiveCard(challengeType ? `${challengeType}:${difficulty}` : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Challenges</h1>
            <div className="subtitle">Adaptive cognitive challenges, tuned to your skill</div>
          </div>
        </div>
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
      <div className="page-header">
        <div>
          <h1>Challenges</h1>
          <div className="subtitle">Adaptive cognitive challenges, tuned to your skill</div>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-primary" onClick={() => generateNext()} disabled={generating} aria-busy={generating}>
            <SparklesIcon size={16} />
            {generating ? 'Generating…' : 'Generate Challenge'}
          </button>
        </div>
      </div>

      {error && <div className="banner banner-warning">{error}</div>}

      {newChallenge && (
        <Card className="form-panel mb-6">
          <div className="card-label mb-2">Your Next Challenge</div>
          <div className="title" style={{ fontSize: '1.15rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            {newChallenge.title}
          </div>
          <p className="text-sm text-muted-600 mt-2" style={{ maxWidth: '640px' }}>
            {newChallenge.description}
          </p>
          <div className="challenge-meta">
            {categoryBadge(newChallenge.challenge_type)}
            <DifficultyBadge difficulty={newChallenge.difficulty} />
            {newChallenge.question_count && <span className="pill pill-neutral">{newChallenge.question_count} questions</span>}
          </div>
        </Card>
      )}

      {challenges.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<SparklesIcon size={24} />}
            title="No challenges available"
            description="Generate a fresh adaptive challenge using the button above."
            action={
              <button className="btn btn-primary" onClick={() => generateNext()} disabled={generating}>
                <SparklesIcon size={16} /> Generate Challenge
              </button>
            }
          />
        </div>
      ) : (
        <Grid>
          {challenges.map((challenge) => {
            const isActive = activeCard === `${challenge.challenge_type}:${challenge.difficulty}`;
            return (
              <Card key={challenge.id} className={`challenge-card ${isActive ? 'challenge-card--active' : ''}`}>
                <div className="challenge-meta">
                  {categoryBadge(challenge.challenge_type)}
                  <DifficultyBadge difficulty={challenge.difficulty} />
                </div>
                <div className="challenge-title">{challenge.title}</div>
                <p className="text-sm text-muted-600 challenge-desc">
                  {challenge.description || `${challenge.challenge_type} challenge`}
                </p>
                <div className="challenge-actions">
                  <button
                    className="btn btn-ghost"
                    onClick={() => generateNext(challenge.challenge_type, challenge.difficulty)}
                    disabled={generating}
                  >
                    <PlayIcon size={15} /> Set as challenge
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