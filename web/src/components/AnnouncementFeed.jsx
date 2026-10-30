// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useEffect, useState } from 'react';
import { Card } from '../styles';
import { apiFetch } from '../utils/api';

/**
 * User-facing announcements feed (Module 11).
 * Reads the public, unauthenticated `/announcements/public` endpoint and renders
 * nothing when there are no active announcements.
 */
export default function AnnouncementFeed() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    apiFetch('/api/v1/announcements/public')
      .then(res => (res.ok ? res.json() : []))
      .then(data => { if (alive && Array.isArray(data)) setItems(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (items.length === 0) return null;

  return (
    <Card className="p-4 mb-6">
      <div className="card-label mb-3"><span className="sys-label">Announcements</span></div>
      <ul style={{ display: 'grid', gap: '0.75rem', margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map(a => (
          <li key={a.id}>
            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{a.title}</div>
            <p className="text-sm text-muted-600" style={{ margin: '0.15rem 0 0', lineHeight: 1.5 }}>{a.body}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
