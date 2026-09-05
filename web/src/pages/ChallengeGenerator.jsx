import React, { useEffect, useState } from 'react';
import { Card, Grid } from '../styles';

export default function ChallengeGenerator() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [token] = useState(localStorage.getItem('token'));
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [newChallenge, setNewChallenge] = useState(null);

  useEffect(() => {
    fetch('/api/v1/challenges', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setChallenges)
      .catch(err => {
        console.error(err);
        setError('Could not load challenges.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const generateNext = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/challenges/next', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'generate failed'); }
      const data = await res.json();
      setNewChallenge(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="page">Loading challenges…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Challenge Generator</h1>
          <div className="subtitle">Adaptive cognitive challenges, tuned to your skill</div>
        </div>
        <button className="btn btn-primary" onClick={generateNext} disabled={generating}>
          {generating ? 'Generating…' : '⚡ Generate Challenge'}
        </button>
      </div>

      {error && <div className="banner banner-warning">⚠️ {error}</div>}

      {newChallenge && (
        <Card className="mb-6">
          <div className="card-label mb-2">Your Next Challenge</div>
          <div className="title" style={{ fontSize: '1.2rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            {newChallenge.title}
          </div>
          <p className="text-sm text-muted-600 mt-2" style={{ maxWidth: '640px' }}>
            {newChallenge.description}
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
            <span className="pill">{newChallenge.challenge_type}</span>
            <span className="pill" style={{ background: 'rgba(110,231,224,0.15)', color: 'var(--accent-2)' }}>
              {newChallenge.difficulty}
            </span>
          </div>
        </Card>
      )}

      {challenges.length === 0 ? (
        <div className="empty">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🧩</div>
          No challenges available. Generate one using the button above.
        </div>
      ) : (
        <Grid>
          {challenges.map((challenge) => (
            <Card key={challenge.id} className="p-4">
              <div className="title" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: '0.4rem' }}>
                {challenge.title}
              </div>
              <p className="text-sm text-muted-600" style={{ minHeight: '2.6em' }}>
                {challenge.description || `${challenge.challenge_type} challenge`}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <span className="pill">{challenge.challenge_type}</span>
                <span className={`pill ${challenge.is_active ? 'pill-success' : 'pill-warm'}`}>
                  {challenge.difficulty}
                </span>
              </div>
            </Card>
          ))}
        </Grid>
      )}
    </div>
  );
}
