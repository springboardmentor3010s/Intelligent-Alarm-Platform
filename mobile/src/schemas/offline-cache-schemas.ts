/**
 * Offline Puzzle Cache Schemas for React Native (Expo)
 * Mirrors critical PostgreSQL tables with synced flag for offline-first sync
 */

// Puzzle Challenge Cache
export type PuzzleCache = {
  challengeId: string;
  version: number;
  payload: string;  // JSON string of challenge data
  expiresAt: number;  // Unix timestamp
  lastAccessed: number;  // Unix timestamp
  synced: boolean;
  createdAt: number;  // Unix timestamp
};

// User Profile Cache (offline copy)
export type UserProfileCache = {
  userId: string;
  email: string;
  preferredWakeUpTime: string;  // HH:MM format
  sleepDuration: number;  // minutes
  timeZone: string;
  productivityGoals: string[];
  difficultyPreference: 'Beginner' | 'Easy' | 'Medium' | 'Hard' | 'Expert';
  habitPreferences: Record<string, any>;
  synced: boolean;
  lastSyncAt: number;  // Unix timestamp
};

// Alarm Cache
export type AlarmCache = {
  alarmId: string;
  userId: string;
  title: string;
  type: 'Daily' | 'Weekday' | 'Weekend' | 'One-Time' | 'Smart Adaptive';
  nextTrigger: number;  // Unix timestamp
  isEnabled: boolean;
  challengeId: string | null;
  timesSnoozed: number;
  createdAt: number;  // Unix timestamp;
  synced: boolean;
};

// Habit Score Cache
export type HabitScoreCache = {
  userId: string;
  date: string;  // YYYY-MM-DD format
  wakeUpConsistency: number;  // 0-100
  challengeCompletion: number;  // 0-100
  snoozeReduction: number;  // 0-100
  sleepScheduleAdherence: number;  // 0-100
  overallScore: number;  // weighted composite
  synced: boolean;
};