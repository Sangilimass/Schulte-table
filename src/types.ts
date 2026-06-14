/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameDifficulty = '3x3' | '4x4' | '5x5' | '6x6';
export type GameMode = 'letter' | 'number' | 'reverse' | 'roman';
export type GameTheme = 'slate' | 'nord' | 'cyber' | 'lavender';
export type GameThemeMode = 'light' | 'dark';

export interface GameCell {
  id: string;
  val: number;        // The sequential target value (1, 2, 3...)
  label: string;      // The actual visual label ('1', 'A', 'I', ...)
  tapped: boolean;
  pulsing: boolean;
  error: boolean;
}

export interface UserSettings {
  gridSize: GameDifficulty;
  mode: GameMode;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  theme: GameTheme;
  themeMode: GameThemeMode;
  timerCountUp: boolean; // true for standard timer, false for countdown challenge
}

export interface GameSession {
  id: string;
  userId: string | null;
  difficulty: GameDifficulty;
  mode: GameMode;
  startedAt: string;
  endedAt: string;
  totalTimeMs: number;
  mistakes: number;
  accuracy: number;
  completed: boolean;
  tapIntervals?: number[]; // list of time differences between each tap in ms
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface TrainingStats {
  totalSessions: number;
  completedSessions: number;
  averageTimeMs: number;
  bestTimeMs: Record<GameDifficulty, number>;
  averageAccuracy: number;
  totalMistakes: number;
  streakDays: number;
}

export interface UserState {
  user: UserProfile | null;
  settings: UserSettings;
  history: GameSession[];
  stats: TrainingStats;
  token: string | null;
}
