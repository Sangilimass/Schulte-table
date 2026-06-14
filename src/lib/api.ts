/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameDifficulty, GameMode, GameSession, UserSettings, UserProfile, TrainingStats } from '../types.js';

const GUEST_SETTINGS_KEY = 'schulte_guest_settings';
const GUEST_SESSIONS_KEY = 'schulte_guest_sessions';
const AUTH_TOKEN_KEY = 'schulte_auth_token';
const AUTH_USER_KEY = 'schulte_auth_user';

const DEFAULT_SETTINGS: UserSettings = {
  gridSize: '5x5',
  mode: 'number',
  soundEnabled: true,
  vibrationEnabled: true,
  theme: 'slate',
  themeMode: 'dark',
  timerCountUp: true,
};

// API Base configuration
const API_BASE = '/api';

export class ApiClient {
  static getLocalToken(): string | null {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  static setLocalToken(token: string | null) {
    try {
      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch (e) {
      console.warn("localStorage is restricted or full", e);
    }
  }

  static getLocalUser(): UserProfile | null {
    try {
      const data = localStorage.getItem(AUTH_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static setLocalUser(user: UserProfile | null) {
    try {
      if (user) {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_USER_KEY);
      }
    } catch (e) {
      console.warn("localStorage restricted", e);
    }
  }

  static getHeaders(): HeadersInit {
    const token = this.getLocalToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  // Check if current user is logged in
  static isLoggedIn(): boolean {
    return !!this.getLocalToken();
  }

  // --- Auth Actions ---
  static async register(name: string, email: string, password: string): Promise<{ token: string; user: UserProfile; settings: UserSettings }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register account.');
    }

    const data = await res.json();
    this.setLocalToken(data.token);
    this.setLocalUser(data.user);
    
    // Sync guest sessions to the new user account if they exist
    try {
      const guestSessions = this.getGuestSessions();
      if (guestSessions.length > 0) {
        await this.syncSessions(guestSessions);
        this.clearGuestSessions();
      }
    } catch (syncErr) {
      console.warn("Guest session migration deferred:", syncErr);
    }

    return data;
  }

  static async login(email: string, password: string): Promise<{ token: string; user: UserProfile; settings: UserSettings }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to login.');
    }

    const data = await res.json();
    this.setLocalToken(data.token);
    this.setLocalUser(data.user);

    // Sync guest sessions to authenticated account automatically
    try {
      const guestSessions = this.getGuestSessions();
      if (guestSessions.length > 0) {
        await this.syncSessions(guestSessions);
        this.clearGuestSessions();
      }
    } catch (syncErr) {
      console.warn("Guest session automatic migration deferred:", syncErr);
    }

    return data;
  }

  static async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } catch {
      // Ignore network errors when logging out
    }
    this.setLocalToken(null);
    this.setLocalUser(null);
  }

  static async getProfile(): Promise<{ user: UserProfile; settings: UserSettings }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      this.logout(); // Clean states if stale token
      throw new Error('Session is expired.');
    }

    return res.json();
  }

  // --- Settings Persistence ---
  static getLocalSettings(): UserSettings {
    try {
      const custom = localStorage.getItem(GUEST_SETTINGS_KEY);
      return custom ? JSON.parse(custom) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  static saveLocalSettings(settings: UserSettings): void {
    try {
      localStorage.setItem(GUEST_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("localSettings write failed", e);
    }
  }

  static async fetchSettings(): Promise<UserSettings> {
    if (!this.isLoggedIn()) {
      return this.getLocalSettings();
    }
    
    try {
      const res = await fetch(`${API_BASE}/settings`, { headers: this.getHeaders() });
      if (res.ok) {
        const remote = await res.json();
        // Keep in sync locally
        this.saveLocalSettings(remote);
        return remote;
      }
    } catch (e) {
      console.warn("Offline, loading local settings cache:", e);
    }
    return this.getLocalSettings();
  }

  static async updateSettings(settings: UserSettings): Promise<UserSettings> {
    // Update locally immediately for instant feedback
    this.saveLocalSettings(settings);

    if (!this.isLoggedIn()) {
      return settings;
    }

    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        return res.json();
      }
    } catch (e) {
      console.warn("Offline settings change queued locally:", e);
    }
    return settings;
  }

  // --- Sessions Logic ---
  static getGuestSessions(): GameSession[] {
    try {
      const data = localStorage.getItem(GUEST_SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveGuestSession(session: GameSession): void {
    try {
      const list = this.getGuestSessions();
      list.unshift(session); // Add to beginning (reverse chron)
      localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("Guest session persistent save failed:", e);
    }
  }

  static clearGuestSessions(): void {
    try {
      localStorage.removeItem(GUEST_SESSIONS_KEY);
    } catch {}
  }

  static async submitSession(session: GameSession): Promise<GameSession> {
    if (!this.isLoggedIn()) {
      this.saveGuestSession(session);
      return session;
    }

    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(session),
      });
      if (res.ok) {
        return res.json();
      }
    } catch {
      console.warn("Submit failed; caching session locally as guest backup");
    }
    // Fallback save locally
    this.saveGuestSession(session);
    return session;
  }

  static async fetchHistory(): Promise<GameSession[]> {
    if (!this.isLoggedIn()) {
      return this.getGuestSessions();
    }

    try {
      const res = await fetch(`${API_BASE}/sessions`, { headers: this.getHeaders() });
      if (res.ok) {
        return res.json();
      }
    } catch (e) {
      console.warn("History loaded from LocalStorage guest cache owing to connectivity issues.", e);
    }
    return this.getGuestSessions();
  }

  static async syncSessions(sessions: GameSession[]): Promise<GameSession[]> {
    const res = await fetch(`${API_BASE}/sessions/sync`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ sessions }),
    });

    if (!res.ok) {
      throw new Error('Conflict synchronizing sessions.');
    }

    const data = await res.json();
    return data.sessions;
  }

  // --- Leaderboard ---
  static async fetchLeaderboard(difficulty: GameDifficulty, mode: GameMode): Promise<Array<{ userName: string; totalTimeMs: number; accuracy: number; mistakes: number; date: string }>> {
    try {
      const res = await fetch(`${API_BASE}/leaderboard?difficulty=${difficulty}&mode=${mode}`);
      if (res.ok) {
        return res.json();
      }
    } catch (err) {
      console.warn("Offline or missing network, could not fetch leaderboard metrics.", err);
    }
    return [];
  }

  // --- Aggregated Stats ---
  static computeGuestStats(sessions: GameSession[]): TrainingStats {
    const completed = sessions.filter(s => s.completed);
    const totalSessions = sessions.length;
    const completedSessions = completed.length;
    const averageTimeMs = completedSessions > 0
      ? Math.round(completed.reduce((acc, s) => acc + s.totalTimeMs, 0) / completedSessions)
      : 0;

    const averageAccuracy = completedSessions > 0
      ? Math.round(completed.reduce((acc, s) => acc + s.accuracy, 0) / completedSessions)
      : 0;

    const totalMistakes = completed.reduce((acc, s) => acc + s.mistakes, 0);

    const bestTimeMs: Record<GameDifficulty, number> = {
      '3x3': 0,
      '4x4': 0,
      '5x5': 0,
      '6x6': 0,
    };

    completed.forEach(s => {
      const best = bestTimeMs[s.difficulty];
      if (best === 0 || s.totalTimeMs < best) {
        bestTimeMs[s.difficulty] = s.totalTimeMs;
      }
    });

    // Simple consecutive day streak calculation
    const activeDates = Array.from(new Set(
      sessions.map(s => s.startedAt.split('T')[0])
    )).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streakDays = 0;
    if (activeDates.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      if (activeDates[0] === todayStr || activeDates[0] === yesterdayStr) {
        streakDays = 1;
        let lastDate = new Date(activeDates[0]);
        for (let i = 1; i < activeDates.length; i++) {
          const currDate = new Date(activeDates[i]);
          const diffDays = (lastDate.getTime() - currDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 1.1) {
            streakDays++;
            lastDate = currDate;
          } else {
            break;
          }
        }
      }
    }

    return {
      totalSessions,
      completedSessions,
      averageTimeMs,
      bestTimeMs,
      averageAccuracy,
      totalMistakes,
      streakDays,
    };
  }

  static async fetchStats(): Promise<TrainingStats> {
    if (!this.isLoggedIn()) {
      return this.computeGuestStats(this.getGuestSessions());
    }

    try {
      const res = await fetch(`${API_BASE}/stats`, { headers: this.getHeaders() });
      if (res.ok) {
        return res.json();
      }
    } catch {
      console.warn("Stats API lost connection, evaluating local stats");
    }
    return this.computeGuestStats(this.getGuestSessions());
  }
}
