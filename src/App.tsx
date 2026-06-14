/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Compass,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  LogOut,
  LogIn,
  User,
  Activity,
  History as HistoryIcon,
  HelpCircle,
  Clock,
  AlertCircle,
  Check,
  Pause,
  Key,
  ShieldAlert,
  Calendar,
  Sparkles,
  TrendingUp,
  Share2,
  Sun,
  Moon
} from 'lucide-react';
import { GameDifficulty, GameMode, GameTheme, GameCell, UserSettings, GameSession, TrainingStats, UserProfile } from './types.js';
import { ApiClient } from './lib/api.js';
import { synth } from './lib/audio.js';
import { ToastProvider, useToast } from './components/Notifications.js';
import LeaderboardScreen from './components/LeaderboardScreen.js';

// Constant label mappings for letters and roman modes
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX',
  'XXXI', 'XXXII', 'XXXIII', 'XXXIV', 'XXXV', 'XXXVI'
];

export default function App() {
  return (
    <ToastProvider>
      <SchulteAppContent />
    </ToastProvider>
  );
}

function SchulteAppContent() {
  const { showToast } = useToast();

  // Screen routing states: 'home' | 'game' | 'results' | 'history' | 'settings' | 'auth'
  const [currentScreen, setCurrentScreen] = useState<'home' | 'game' | 'results' | 'history' | 'settings' | 'auth'>('home');
  const [leaderboardActive, setLeaderboardActive] = useState(false);

  // Authentication states
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Application Preference states
  const [settings, setSettings] = useState<UserSettings>({
    gridSize: '5x5',
    mode: 'number',
    soundEnabled: true,
    vibrationEnabled: true,
    theme: 'slate',
    timerCountUp: true,
  });

  // Gameplay Variables
  const [gridCells, setGridCells] = useState<GameCell[]>([]);
  const [currentTarget, setCurrentTarget] = useState<number>(1);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [gameRunning, setGameRunning] = useState<boolean>(false);
  const [elapsedTimeMs, setElapsedTimeMs] = useState<number>(0);
  const [mistakesCount, setMistakesCount] = useState<number>(0);
  const [totalAttempts, setTotalAttempts] = useState<number>(0);
  const [tapIntervals, setTapIntervals] = useState<number[]>([]);

  // Time tracker references
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const roundStartTimeRef = useRef<number>(0);
  const gameElapsedTimeOffsetRef = useRef<number>(0);

  // Stats / History logs
  const [historyList, setHistoryList] = useState<GameSession[]>([]);
  const [stats, setStats] = useState<TrainingStats>({
    totalSessions: 0,
    completedSessions: 0,
    averageTimeMs: 0,
    bestTimeMs: { '3x3': 0, '4x4': 0, '5x5': 0, '6x6': 0 },
    averageAccuracy: 0,
    totalMistakes: 0,
    streakDays: 0,
  });

  // Just finished round summary
  const [lastFinishedSession, setLastFinishedSession] = useState<GameSession | null>(null);

  // Bootstrap data
  useEffect(() => {
    async function loadData() {
      const storedToken = ApiClient.getLocalToken();
      if (storedToken) {
        try {
          const profileData = await ApiClient.getProfile();
          setCurrentUser(profileData.user);
          setSettings(profileData.settings);
          showToast(`Welcome back, ${profileData.user.name}`, 'success');
        } catch (e) {
          console.warn("Auto login failed", e);
          ApiClient.logout();
        }
      } else {
        const guestSettings = ApiClient.getLocalSettings();
        setSettings(guestSettings);
      }
      refreshStatsAndHistory();
    }
    loadData();
  }, []);

  // Update audio synth toggle state when setting changes
  useEffect(() => {
    synth.setEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  const refreshStatsAndHistory = async () => {
    try {
      const list = await ApiClient.fetchHistory();
      setHistoryList(list);
      const computedStats = await ApiClient.fetchStats();
      setStats(computedStats);
    } catch {
      // Offline fallback
      const guestSess = ApiClient.getGuestSessions();
      setHistoryList(guestSess);
      setStats(ApiClient.computeGuestStats(guestSess));
    }
  };

  // Switch Theme Utility
  const isLight = settings.themeMode === 'light';

  const themeStyles = {
    slate: {
      dark: {
        bg: 'bg-slate-950 text-slate-100 selection:bg-indigo-500/30',
        card: 'bg-slate-900 border border-slate-800 shadow-xl',
        border: 'border-slate-800',
        textMuted: 'text-slate-400',
        textTitle: 'text-white',
        textAccent: 'text-indigo-400',
        btnAccent: 'bg-indigo-600 hover:bg-indigo-505 text-white shadow-lg shadow-indigo-600/10 focus:ring-2 focus:ring-indigo-500',
        btnSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-250 border border-slate-700/60 focus:ring-2 focus:ring-slate-700',
        gridCell: 'bg-slate-900 text-slate-100 hover:bg-slate-800 border border-slate-800/80 active:bg-slate-750 shadow-sm',
        navBtn: 'text-slate-400 hover:text-white',
        navBtnActive: 'text-indigo-405 bg-slate-900 border border-slate-800',
        subCard: 'bg-slate-950/40 border border-slate-805/60',
        formInput: 'bg-slate-950 border border-slate-850 focus:ring-indigo-650 text-white'
      },
      light: {
        bg: 'bg-slate-50 text-slate-900 selection:bg-indigo-600/20',
        card: 'bg-white border border-slate-200 shadow-lg',
        border: 'border-slate-200',
        textMuted: 'text-slate-500',
        textTitle: 'text-slate-900',
        textAccent: 'text-indigo-600',
        btnAccent: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10 focus:ring-2 focus:ring-indigo-505',
        btnSecondary: 'bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-200 focus:ring-2 focus:ring-slate-300',
        gridCell: 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 active:bg-slate-200 shadow-sm',
        navBtn: 'text-slate-500 hover:text-slate-900',
        navBtnActive: 'text-indigo-600 bg-indigo-50 border border-indigo-150',
        subCard: 'bg-slate-100/60 border border-slate-200/80',
        formInput: 'bg-slate-50 border border-slate-250 focus:ring-indigo-500 text-slate-905'
      }
    },
    nord: {
      dark: {
        bg: 'bg-slate-900 text-[#d8dee9] selection:bg-[#88c0d0]/30',
        card: 'bg-[#2e3440] border border-[#3b4252] shadow-xl',
        border: 'border-[#3b4252]',
        textMuted: 'text-[#9ca3af]',
        textTitle: 'text-[#eceff4]',
        textAccent: 'text-[#88c0d0]',
        btnAccent: 'bg-[#88c0d0] hover:bg-[#8fbcbb] text-[#2e3440] font-semibold focus:ring-2 focus:ring-[#88c0d0]',
        btnSecondary: 'bg-[#3b4252] hover:bg-[#434c5e] text-[#e5e9f0] border border-[#4c566a] focus:ring-2 focus:ring-[#4c566a]',
        gridCell: 'bg-[#2e3440] text-[#e5e9f0] hover:bg-[#3b4252] border border-[#3b4252]/85 active:bg-[#434c5e] shadow-sm',
        navBtn: 'text-[#9ca3af] hover:text-[#eceff4]',
        navBtnActive: 'text-[#88c0d0] bg-[#2e3440] border border-[#3b4252]',
        subCard: 'bg-[#3b4252]/40 border border-[#4c566a]/60',
        formInput: 'bg-[#2e3440] border border-[#4c566a] focus:ring-[#88c0d0] text-[#eceff4]'
      },
      light: {
        bg: 'bg-[#f8f9fb] text-[#2e3440] selection:bg-[#88c0d0]/40',
        card: 'bg-white border border-[#e5e9f0] shadow-md',
        border: 'border-[#e5e9f0]',
        textMuted: 'text-[#4c566a]',
        textTitle: 'text-[#2e3440]',
        textAccent: 'text-[#5e81ac]',
        btnAccent: 'bg-[#5e81ac] hover:bg-[#81a1c1] text-white font-semibold focus:ring-2 focus:ring-[#5e81ac]',
        btnSecondary: 'bg-[#e5e9f0] hover:bg-[#d8dee9] text-[#4c566a] border border-[#d8dee9] focus:ring-2 focus:ring-[#88c0d0]',
        gridCell: 'bg-white text-[#2e3440] hover:bg-[#eceff4] border border-[#e5e9f0] active:bg-[#d8dee9] shadow-sm',
        navBtn: 'text-[#4c566a] hover:text-[#2e3440]',
        navBtnActive: 'text-[#5e81ac] bg-[#eceff4] border border-[#e5e9f0]',
        subCard: 'bg-[#eceff4]/50 border border-[#e5e9f0]/80',
        formInput: 'bg-[#f8f9fb] border border-[#d8dee9] focus:ring-[#5e81ac] text-[#2e3440]'
      }
    },
    cyber: {
      dark: {
        bg: 'bg-black text-[#39ff14] selection:bg-[#ff007f]/40',
        card: 'bg-[#0a0a0a] border border-[#39ff14]/30 shadow-neon shadow-red-500/5',
        border: 'border-[#39ff14]/20',
        textMuted: 'text-zinc-500',
        textTitle: 'text-[#39ff14]',
        textAccent: 'text-[#ff007f]',
        btnAccent: 'bg-[#ff007f] hover:bg-[#ff00a0] text-black font-extrabold shadow-lg focus:ring-2 focus:ring-[#ff007f] uppercase tracking-wide',
        btnSecondary: 'bg-[#151515] hover:bg-[#252525] text-[#39ff14]/90 border border-[#39ff14]/30 focus:ring-2 focus:ring-[#39ff14]',
        gridCell: 'bg-black text-[#39ff14]/90 hover:bg-[#0f0f0f] border border-[#39ff14]/20 active:bg-zinc-900 shadow-sm',
        navBtn: 'text-[#39ff14]/60 hover:text-[#39ff14]',
        navBtnActive: 'text-[#ff007f] bg-[#0a0a0a] border border-[#39ff14]/30',
        subCard: 'bg-black/80 border border-[#39ff14]/20',
        formInput: 'bg-black border border-[#39ff14]/20 focus:ring-[#39ff14] text-[#39ff14]'
      },
      light: {
        bg: 'bg-zinc-55 text-black selection:bg-cyan-500/35 border-zinc-200',
        card: 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
        border: 'border-black',
        textMuted: 'text-zinc-650',
        textTitle: 'text-black font-black',
        textAccent: 'text-purple-700',
        btnAccent: 'bg-yellow-405 hover:bg-yellow-400 text-black font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider',
        btnSecondary: 'bg-white hover:bg-zinc-100 text-black border-2 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
        gridCell: 'bg-white text-black border-2 border-black hover:bg-cyan-55 font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-sm',
        navBtn: 'text-zinc-700 hover:text-black font-bold',
        navBtnActive: 'text-purple-750 bg-purple-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
        subCard: 'bg-white border border-black/30',
        formInput: 'bg-white border-2 border-black focus:ring-purple-700 text-black font-bold'
      }
    },
    lavender: {
      dark: {
        bg: 'bg-[#0f0b18] text-purple-100 selection:bg-[#b19ffb]/30',
        card: 'bg-[#1b1329] border border-[#2d1f44] shadow-xl',
        border: 'border-[#2d1f44]',
        textMuted: 'text-purple-300/60',
        textTitle: 'text-white',
        textAccent: 'text-[#b19ffb]',
        btnAccent: 'bg-[#b19ffb] hover:bg-[#c3b5fc] text-[#0f0b18] font-semibold focus:ring-2 focus:ring-[#b19ffb]',
        btnSecondary: 'bg-[#2d1f44] hover:bg-[#3d2c5c] text-purple-200 border border-[#443169] focus:ring-2 focus:ring-[#443169]',
        gridCell: 'bg-[#1c142b] text-purple-150 hover:bg-[#261b3b] border border-[#2b1f42]/80 active:bg-[#31254d] shadow-sm',
        navBtn: 'text-purple-300/60 hover:text-white',
        navBtnActive: 'text-[#b19ffb] bg-[#1b1329] border border-[#2d1f44]',
        subCard: 'bg-[#2d1f44]/40 border border-[#443169]/60',
        formInput: 'bg-[#0f0b18] border border-[#2d1f44] focus:ring-[#b19ffb] text-white'
      },
      light: {
        bg: 'bg-[#f6f4fa] text-purple-950 selection:bg-purple-600/20',
        card: 'bg-white border border-purple-200 shadow-md',
        border: 'border-purple-200',
        textMuted: 'text-purple-700/60',
        textTitle: 'text-purple-950',
        textAccent: 'text-purple-700',
        btnAccent: 'bg-purple-600 hover:bg-purple-700 text-white font-semibold focus:ring-2 focus:ring-purple-500',
        btnSecondary: 'bg-purple-100 hover:bg-purple-200 text-purple-850 border border-purple-150 focus:ring-2 focus:ring-purple-300',
        gridCell: 'bg-white text-purple-900 hover:bg-[#f6f4fa] border border-purple-150 active:bg-purple-100 shadow-sm',
        navBtn: 'text-purple-700/70 hover:text-purple-950',
        navBtnActive: 'text-purple-800 bg-purple-5 border border-purple-100',
        subCard: 'bg-purple-50/50 border border-purple-100/85',
        formInput: 'bg-[#f6f4fa] border border-purple-205 focus:ring-purple-600 text-purple-900'
      }
    }
  }[settings.theme] || {
    dark: {
      bg: 'bg-slate-950 text-slate-100',
      card: 'bg-slate-900 border border-slate-800',
      border: 'border-slate-800',
      textMuted: 'text-slate-400',
      textTitle: 'text-white',
      textAccent: 'text-indigo-400',
      btnAccent: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      btnSecondary: 'bg-slate-800 text-slate-200',
      gridCell: 'bg-slate-900 text-slate-100 hover:bg-slate-800',
      navBtn: 'text-slate-400 hover:text-white',
      navBtnActive: 'text-indigo-400 bg-slate-900 border border-slate-800',
      subCard: 'bg-slate-950/40 border border-slate-800/60',
      formInput: 'bg-slate-950 border border-slate-850 text-white'
    },
    light: {
      bg: 'bg-slate-50 text-slate-900',
      card: 'bg-white border border-slate-200',
      border: 'border-slate-200',
      textMuted: 'text-slate-550',
      textTitle: 'text-slate-900',
      textAccent: 'text-indigo-600',
      btnAccent: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      btnSecondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
      gridCell: 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200',
      navBtn: 'text-slate-500 hover:text-slate-900',
      navBtnActive: 'text-indigo-600 bg-slate-50 border border-slate-250',
      subCard: 'bg-slate-100/60 border border-slate-200/80',
      formInput: 'bg-slate-50 border border-slate-200 text-slate-900'
    }
  };

  const activeStyles = isLight ? themeStyles.light : themeStyles.dark;

  const getGridDimension = (diff: GameDifficulty): number => {
    return parseInt(diff.split('x')[0]) || 5;
  };

  // Format visual label based on index and select settings mode
  const getCellLabel = (index: number, mode: GameMode, maxVal: number): { val: number; label: string } => {
    const val = index + 1;
    let label = val.toString();

    if (mode === 'reverse') {
      // Represent target from maximum down to 1 in order, but standard values on labels.
      label = (maxVal - val + 1).toString();
      return { val, label };
    }

    if (mode === 'letter') {
      // Wrap characters using LETTERS array
      const lettersLen = LETTERS.length;
      if (val <= lettersLen) {
        label = LETTERS[val - 1];
      } else {
        const primaryIdx = Math.floor((val - 1) / lettersLen) - 1;
        const remainderIdx = (val - 1) % lettersLen;
        label = (primaryIdx >= 0 ? LETTERS[primaryIdx] : '') + LETTERS[remainderIdx];
      }
    } else if (mode === 'roman') {
      label = ROMAN_NUMERALS[(val - 1) % ROMAN_NUMERALS.length];
    }

    return { val, label };
  };

  // Generate a premium random grid
  const startNewRound = () => {
    const dimension = getGridDimension(settings.gridSize);
    const cellsCount = dimension * dimension;

    // Create the sequential mapping
    const rawItems: Array<{ val: number; label: string }> = [];
    for (let i = 0; i < cellsCount; i++) {
      rawItems.push(getCellLabel(i, settings.mode, cellsCount));
    }

    // High quality Fisher-Yates shuffle
    const shuffled = [...rawItems];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const initialCells: GameCell[] = shuffled.map((item, idx) => ({
      id: `cell-${idx}-${item.val}`,
      val: item.val,
      label: item.label,
      tapped: false,
      pulsing: false,
      error: false,
    }));

    setGridCells(initialCells);
    setCurrentTarget(1);
    setGameStarted(false);
    setGameRunning(false);
    setElapsedTimeMs(0);
    setMistakesCount(0);
    setTotalAttempts(0);
    setTapIntervals([]);

    // Clear and reset state timers
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    gameElapsedTimeOffsetRef.current = 0;

    setCurrentScreen('game');
  };

  // Starts the clock upon first successful interaction
  const triggerSessionTimer = () => {
    if (gameRunning) return;
    
    setGameStarted(true);
    setGameRunning(true);
    roundStartTimeRef.current = Date.now();
    lastTapTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - roundStartTimeRef.current) + gameElapsedTimeOffsetRef.current;
      setElapsedTimeMs(elapsed);
    }, 10);
  };

  const handleCellTap = (cell: GameCell) => {
    // If not running, trigger the game startup timer upon touch
    if (!gameStarted) {
      triggerSessionTimer();
    } else if (!gameRunning) {
      // Game is paused, ignore taps
      return;
    }

    const dimension = getGridDimension(settings.gridSize);
    const totalCells = dimension * dimension;
    setTotalAttempts((prev) => prev + 1);

    const isMatch = cell.val === currentTarget;

    if (isMatch) {
      synth.playCorrect();
      
      // Calculate split tap intervals
      const now = Date.now();
      const splitTime = now - lastTapTimeRef.current;
      setTapIntervals((prev) => [...prev, splitTime]);
      lastTapTimeRef.current = now;

      // Tag the cell as successfully completed
      setGridCells((prev) =>
        prev.map((c) => (c.val === cell.val ? { ...c, tapped: true, pulsing: false, error: false } : c))
      );

      // Check if grid is entirely complete
      if (currentTarget === totalCells) {
        completeGameRound();
      } else {
        setCurrentTarget((prev) => prev + 1);
      }
    } else {
      // Trigger error sound, update target cells to show mistake feedback
      synth.playIncorrect();
      setMistakesCount((prev) => prev + 1);

      if (settings.vibrationEnabled && navigator.vibrate) {
        navigator.vibrate(80);
      }

      setGridCells((prev) =>
        prev.map((c) => (c.val === cell.val ? { ...c, error: true } : c))
      );

      // Clear the red error outline after a subtle delay
      setTimeout(() => {
        setGridCells((prev) =>
          prev.map((c) => (c.id === cell.id ? { ...c, error: false } : c))
        );
      }, 450);
    }
  };

  const triggerTargetVisualPulse = () => {
    // Highly useful hint feature: toggles soft pulsing highlight on current active cell
    setGridCells((prev) =>
      prev.map((c) => (c.val === currentTarget ? { ...c, pulsing: true } : c))
    );
    // Remove pulsing after the player refocuses
    setTimeout(() => {
      setGridCells((prev) =>
        prev.map((c) => (c.val === currentTarget ? { ...c, pulsing: false } : c))
      );
    }, 1200);
  };

  const pauseActiveSession = () => {
    if (!gameRunning) return;
    setGameRunning(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    // Persist current cumulative time offset
    gameElapsedTimeOffsetRef.current = elapsedTimeMs;
  };

  const resumeActiveSession = () => {
    if (gameRunning) return;
    setGameRunning(true);
    roundStartTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - roundStartTimeRef.current) + gameElapsedTimeOffsetRef.current;
      setElapsedTimeMs(elapsed);
    }, 10);
    lastTapTimeRef.current = Date.now();
  };

  const completeGameRound = async () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setGameRunning(false);
    
    synth.playSuccess();
    
    const accuracy = totalAttempts > 0 ? Math.round(((totalAttempts - mistakesCount) / totalAttempts) * 100) : 100;
    
    const newSession: GameSession = {
      id: Math.random().toString(36).substring(2, 9),
      userId: currentUser ? currentUser.id : null,
      difficulty: settings.gridSize,
      mode: settings.mode,
      startedAt: new Date(roundStartTimeRef.current).toISOString(),
      endedAt: new Date().toISOString(),
      totalTimeMs: elapsedTimeMs,
      mistakes: mistakesCount,
      accuracy,
      completed: true,
      tapIntervals: tapIntervals,
    };

    setLastFinishedSession(newSession);
    setCurrentScreen('results');

    try {
      await ApiClient.submitSession(newSession);
      showToast('Training session successfully recorded.', 'success');
    } catch (e) {
      console.warn("Could not save to server. Saved locally inside anonymous guest storage instead.", e);
    }
    
    refreshStatsAndHistory();
  };

  // Terminate and exit gameplay
  const quitActiveRound = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setGameRunning(false);
    setGameStarted(false);
    setCurrentScreen('home');
  };

  // Auth Operations
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      if (authMode === 'register') {
        const profileData = await ApiClient.register(authName, authEmail, authPassword);
        setCurrentUser(profileData.user);
        setSettings(profileData.settings);
        showToast(`Welcome to Schulte Table, ${profileData.user.name}!`, 'success');
      } else {
        const profileData = await ApiClient.login(authEmail, authPassword);
        setCurrentUser(profileData.user);
        setSettings(profileData.settings);
        showToast('Successfully logged in!', 'success');
      }
      
      // Sync complete, refresh history and go home
      await refreshStatsAndHistory();
      setCurrentScreen('home');
      
      // Reset auth form input states
      setAuthName('');
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: any) {
      showToast(err.message || 'Authentication failed. Please verify credentials.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await ApiClient.logout();
    setCurrentUser(null);
    showToast('Logged out of training profile.', 'info');
    refreshStatsAndHistory();
    setCurrentScreen('home');
  };

  const saveSettingsUpdate = async (updated: UserSettings) => {
    setSettings(updated);
    try {
      await ApiClient.updateSettings(updated);
    } catch {
      // Saves local preference cache
    }
  };

  const formatDisplayTime = (ms: number): string => {
    const totalSecs = ms / 1000;
    return totalSecs.toFixed(2) + 's';
  };

  // Custom visual labels based on mode configuration
  const getExpectedItemLabel = (): string => {
    const dimension = getGridDimension(settings.gridSize);
    const total = dimension * dimension;
    return getCellLabel(currentTarget - 1, settings.mode, total).label;
  };

  return (
    <div className={`min-h-screen transition-all duration-300 ${activeStyles.bg} flex flex-col font-sans relative overflow-x-hidden`}>
      {/* Decorative ambient blobs clipped wrapper */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      {/* Main App Navigation Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md ${isLight ? 'bg-white/85' : 'bg-slate-950/80'} border-b ${activeStyles.border} py-3 px-4 sm:px-6 transition-all duration-300`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center w-full">
          {/* Logo Brand Title */}
          <button 
            onClick={() => {
              if (gameRunning) {
                if (confirm('Abandon current game and go to dashboard?')) {
                  quitActiveRound();
                } else return;
              }
              setLeaderboardActive(false);
              setCurrentScreen('home');
            }} 
            className="flex items-center gap-3 group text-left cursor-pointer focus:outline-none select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black tracking-wider text-xl shadow-lg shadow-indigo-600/20 group-hover:scale-105 transition-transform flex-shrink-0">
              S
            </div>
            <div className="flex flex-col justify-center h-10 text-left">
              <span className={`font-bold text-base sm:text-lg leading-none tracking-tight block ${activeStyles.textTitle}`}>
                Schulte Matrix
              </span>
              <span className={`text-[10px] uppercase tracking-wider block font-semibold mt-1 leading-none ${activeStyles.textAccent}`}>
                Foveal Training
              </span>
            </div>
          </button>

          {/* Quick Stats Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-3 font-medium">
            {/* Quick light/dark switch */}
            <button
              onClick={() => {
                saveSettingsUpdate({
                  ...settings,
                  themeMode: isLight ? 'dark' : 'light'
                });
              }}
              className={`w-10 h-10 inline-flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer ${
                isLight 
                  ? 'text-amber-600 hover:bg-slate-100 hover:text-amber-700' 
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
              }`}
              title={isLight ? "Activate Dark Focus" : "Activate Light Focus"}
              id="theme-mode-toggle-btn"
            >
              {isLight ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
            </button>

            <button
              onClick={() => {
                if (gameRunning) return;
                setLeaderboardActive(!leaderboardActive);
              }}
              disabled={gameRunning}
              className={`w-10 h-10 inline-flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer ${
                leaderboardActive 
                  ? 'text-amber-500 ' + activeStyles.navBtnActive 
                  : activeStyles.navBtn + (isLight ? ' hover:bg-slate-100 hover:text-slate-900' : ' hover:bg-slate-800/80 hover:text-white')
              }`}
              title="Global Leaderboard"
              id="top-leaderboard-btn"
            >
              <Trophy className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={() => {
                if (gameRunning) {
                  if (confirm('Cancel active game and open view?')) quitActiveRound();
                  else return;
                }
                setCurrentScreen('history');
              }}
              className={`w-10 h-10 inline-flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer ${
                currentScreen === 'history' 
                  ? activeStyles.navBtnActive 
                  : activeStyles.navBtn + (isLight ? ' hover:bg-slate-100 hover:text-slate-900' : ' hover:bg-slate-800/80 hover:text-white')
              }`}
              title="History Logs"
              id="top-history-btn"
            >
              <HistoryIcon className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={() => {
                if (gameRunning) {
                  if (confirm('Cancel game and enter settings?')) quitActiveRound();
                  else return;
                }
                setCurrentScreen('settings');
              }}
              className={`w-10 h-10 inline-flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer ${
                currentScreen === 'settings' 
                  ? activeStyles.navBtnActive 
                  : activeStyles.navBtn + (isLight ? ' hover:bg-slate-100 hover:text-slate-900' : ' hover:bg-slate-800/80 hover:text-white')
              }`}
              title="Preferences"
              id="top-settings-btn"
            >
              <Sliders className="w-4.5 h-4.5" />
            </button>

            <div className={`h-6 w-[1px] ${activeStyles.border} ${gameRunning ? 'hidden' : 'block'} self-center mx-1 sm:mx-2`} />

            {/* Profile Logic */}
            <div className={gameRunning ? 'hidden' : 'block'}>
              {currentUser ? (
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex flex-col text-right justify-center h-10">
                    <span className={`text-xs font-bold leading-none ${isLight ? 'text-slate-800' : 'text-slate-350'}`}>{currentUser.name}</span>
                    <span className="text-[10px] text-emerald-500 font-mono mt-1 leading-none">Streak: {stats.streakDays}d</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-bold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
                    id="user-logout"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline font-bold">Logout</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCurrentScreen('auth')}
                  className="inline-flex items-center justify-center gap-1.5 h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-indigo-600/10 cursor-pointer"
                  id="user-login-prompt"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main SPA Container */}
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <AnimatePresence mode="wait">
          {leaderboardActive ? (
            <motion.div
              key="leaderboards"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="w-full"
            >
              <LeaderboardScreen
                onBack={() => setLeaderboardActive(false)}
                defaultDifficulty={settings.gridSize}
                defaultMode={settings.mode}
              />
            </motion.div>
          ) : currentScreen === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center"
            >
              {/* Home - Left Section: Info/Intro Cards */}
              <div className="md:col-span-7 space-y-6 text-left">
                <div className="space-y-3">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 ${isLight ? 'bg-indigo-50 border-indigo-150 text-indigo-750' : 'bg-indigo-505/10 border border-indigo-500/20 text-indigo-400'} rounded-full text-xs font-semibold uppercase tracking-wider`}>
                    <Sparkles className="w-3 h-3 text-indigo-500" /> Foveal & Peripheral Sight Engine
                  </div>
                  <h1 className={`text-4xl sm:text-5xl font-black tracking-tight leading-tight ${activeStyles.textTitle}`}>
                    Double Your Reading <br />& Focus Processing
                  </h1>
                  <p className={`text-base leading-relaxed ${activeStyles.textMuted}`}>
                    The Schulte Table is a scientifically validated training grid. By keeping your gaze fixed exactly in the center of the grid, you expand your peripheral vision, and accelerate neurological reading recall. 
                  </p>
                </div>

                {/* Training Method Step Guidelines */}
                <div className={`${activeStyles.card} p-5 rounded-2xl space-y-4`}>
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Peripheral Training Method
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className={`space-y-1.5 p-3 rounded-xl ${activeStyles.subCard}`}>
                      <div className={`w-6 h-6 rounded-md ${isLight ? 'bg-indigo-100 text-indigo-705 font-black' : 'bg-indigo-500/20 text-indigo-405 font-bold'} flex items-center justify-center`}>1</div>
                      <span className={`font-semibold block ${activeStyles.textTitle}`}>Fix Eye Center</span>
                      <p className={`leading-normal ${activeStyles.textMuted}`}>Keep focus solely on center square. Let eye expansion find values.</p>
                    </div>
                    <div className={`space-y-1.5 p-3 rounded-xl ${activeStyles.subCard}`}>
                      <div className={`w-6 h-6 rounded-md ${isLight ? 'bg-indigo-100 text-indigo-705 font-black' : 'bg-indigo-500/20 text-indigo-405 font-bold'} flex items-center justify-center`}>2</div>
                      <span className={`font-semibold block ${activeStyles.textTitle}`}>Ascending Tap</span>
                      <p className={`leading-normal ${activeStyles.textMuted}`}>Tap numbers in sequence as quick as neurologically possible.</p>
                    </div>
                    <div className={`space-y-1.5 p-3 rounded-xl ${activeStyles.subCard}`}>
                      <div className={`w-6 h-6 rounded-md ${isLight ? 'bg-indigo-100 text-indigo-705 font-black' : 'bg-indigo-500/20 text-indigo-405 font-bold'} flex items-center justify-center`}>3</div>
                      <span className={`font-semibold block ${activeStyles.textTitle}`}>Speed Splits</span>
                      <p className={`leading-normal ${activeStyles.textMuted}`}>Review charts and accelerate your mental split coefficients.</p>
                    </div>
                  </div>
                </div>

                {/* Primary CTA Play Button */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={startNewRound}
                    className={`flex-none px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-aesthetic cursor-pointer ${activeStyles.btnAccent}`}
                    id="btn-play-game"
                  >
                    <Play className="fill-white w-5 h-5 text-white" /> Start Focus Session
                  </button>
                  <button
                    onClick={() => setCurrentScreen('settings')}
                    className={`px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-aesthetic cursor-pointer ${activeStyles.btnSecondary}`}
                    id="btn-prep-settings"
                  >
                    <Sliders className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-slate-400'}`} /> Customize Grid Matrix
                  </button>
                </div>
              </div>

              {/* Home - Right Section: Performance Card */}
              <div className="md:col-span-5 space-y-6">
                {/* Stats Widget */}
                <div className={`${activeStyles.card} p-6 rounded-3xl relative overflow-hidden text-left`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full flex items-center justify-center">
                    <Activity className="w-6 h-6 text-indigo-400 translate-x-2 -translate-y-2" />
                  </div>

                  <h2 className={`text-xl font-bold mb-6 ${activeStyles.textTitle}`}>Training Overview</h2>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Stat Item */}
                    <div className={`p-3.5 rounded-2xl ${activeStyles.subCard}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Fastest Time</span>
                      <span className={`text-2xl font-black tracking-tight font-mono ${isLight ? 'text-indigo-650' : 'text-indigo-400'}`}>
                        {stats.bestTimeMs[settings.gridSize] > 0 
                          ? formatDisplayTime(stats.bestTimeMs[settings.gridSize])
                          : '--'
                        }
                      </span>
                    </div>

                    <div className={`p-3.5 rounded-2xl ${activeStyles.subCard}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-550'}`}>Avg Split Time</span>
                      <span className={`text-2xl font-black tracking-tight font-mono ${activeStyles.textTitle}`}>
                        {stats.averageTimeMs > 0 ? formatDisplayTime(stats.averageTimeMs) : '--'}
                      </span>
                    </div>

                    <div className={`p-3.5 rounded-2xl ${activeStyles.subCard}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-550'}`}>Brain Accuracy</span>
                      <span className="text-2xl font-black tracking-tight text-emerald-500 font-mono">
                        {stats.averageAccuracy > 0 ? `${stats.averageAccuracy}%` : '0%'}
                      </span>
                    </div>

                    <div className={`p-3.5 rounded-2xl ${activeStyles.subCard}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-550'}`}>Streak days</span>
                      <span className="text-2xl font-black tracking-tight text-amber-500 font-mono">
                        {stats.streakDays} days
                      </span>
                    </div>
                  </div>

                  {/* Subtitle / Tip */}
                  <div className={`mt-6 flex gap-3 p-3 rounded-xl text-xs ${isLight ? 'bg-indigo-50 border border-indigo-150 text-slate-700' : 'bg-indigo-500/5 border border-indigo-500/10 text-slate-400'}`}>
                    <HelpCircle className={`w-5 h-5 flex-shrink-0 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`} />
                    <span>
                      Selected difficulty: <strong className={`font-bold ${activeStyles.textTitle}`}>{settings.gridSize} ({settings.mode})</strong>. Modify sizes or mode preferences dynamically using the Settings tab.
                    </span>
                  </div>
                </div>

                {/* Brief motivational footer of user history if exists */}
                {historyList.length > 0 && (
                  <div className={`${activeStyles.card} p-5 rounded-2xl hover:bg-slate-900/10 transition text-left cursor-pointer`} onClick={() => setCurrentScreen('history')}>
                    <div className="flex justify-between items-center text-xs">
                      <span className={`flex items-center gap-2 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                        <TrendingUp className="w-4 h-4 text-emerald-500" /> Completed sessions log loaded
                      </span>
                      <span className={`font-bold hover:underline ${isLight ? 'text-indigo-750' : 'text-indigo-400'}`}>View History »</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : currentScreen === 'game' ? (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="max-w-3xl w-full flex flex-col items-center space-y-4 sm:space-y-4.5"
            >              {/* Gameplay Header / Stats Bar */}
              <div className={`w-full flex justify-between items-center ${activeStyles.card} bg-opacity-40 p-4 rounded-2xl backdrop-blur-sm self-stretch flex-col sm:flex-row gap-4 text-left transition-all duration-300`}>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className={`p-2 border rounded-xl ${isLight ? 'bg-indigo-50 border-indigo-150' : 'bg-slate-850 border border-slate-800'}`}>
                    <Clock className={`w-5 h-5 animate-pulse ${isLight ? 'text-indigo-650' : 'text-indigo-400'}`} />
                  </div>
                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500/80' : 'text-slate-505'}`}>Elapsed Time</span>
                    <span className={`text-2xl font-black tracking-tight font-mono leading-none ${activeStyles.textTitle}`}>
                      {formatDisplayTime(elapsedTimeMs)}
                    </span>
                  </div>
                </div>

                {/* Target values */}
                <div className={`flex gap-4 sm:gap-6 justify-between sm:justify-start w-full sm:w-auto border-t sm:border-t-0 ${isLight ? 'border-slate-200' : 'border-slate-800'} pt-4 sm:pt-0`}>
                  <div className="text-center sm:text-left">
                    <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500/80' : 'text-slate-505'}`}>Expect Focus Target</span>
                    <span className={`text-2xl font-black tracking-tight font-mono leading-none ${isLight ? 'text-indigo-650' : 'text-indigo-400'}`}>
                      {getExpectedItemLabel()}
                    </span>
                  </div>

                  <div className="text-center sm:text-right">
                    <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500/80' : 'text-slate-505'}`}>Mistakes Logged</span>
                    <span className={`text-2xl font-black tracking-tight font-mono leading-none ${mistakesCount > 0 ? 'text-red-500 font-bold' : isLight ? 'text-slate-400' : 'text-slate-505'}`}>
                      {mistakesCount}
                    </span>
                  </div>

                  <div className="text-center sm:text-right">
                    <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500/80' : 'text-slate-505'}`}>Session Mode</span>
                    <span className={`text-xs font-semibold capitalize px-2.5 py-1 rounded-md inline-block border mt-1 ${isLight ? 'bg-slate-100/90 border-slate-205 text-slate-700' : 'bg-slate-850 border border-slate-805/70 text-slate-350'}`}>
                      {settings.gridSize} • {settings.mode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Central Schulte Grid Canvas */}
              <div className={`w-full max-w-xl aspect-square flex items-center justify-center p-3 sm:p-4 rounded-3xl border shadow-2xl relative select-none ${isLight ? 'bg-slate-100/50 border-slate-250' : 'bg-slate-950/80 border border-slate-800/50'}`}>
                {/* Grid cells layout */}
                <div 
                  className="grid h-full w-full gap-2 sm:gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${getGridDimension(settings.gridSize)}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${getGridDimension(settings.gridSize)}, minmax(0, 1fr))`
                  }}
                >
                  {gridCells.map((cell) => {
                    // Cell style modifiers based on tapped or current state
                    const isTapped = cell.tapped;
                    const isError = cell.error;
                    const isPulsing = cell.pulsing;

                    return (
                      <button
                        key={cell.id}
                        onClick={() => handleCellTap(cell)}
                        disabled={isTapped}
                        className={`h-full w-full rounded-2xl font-extrabold flex items-center justify-center transition-all cursor-pointer select-none text-xl sm:text-2xl md:text-3xl ${
                          isTapped
                            ? isLight
                              ? 'bg-slate-150 border border-slate-200 text-slate-400/90 pointer-events-auto opacity-40 shadow-none scale-95'
                              : 'bg-slate-905 border border-slate-850 text-slate-700 pointer-events-auto opacity-30 shadow-none scale-95'
                            : isError
                            ? 'bg-red-500/20 border-2 border-red-500 text-red-500 shadow-lg shadow-red-500/20 scale-95 animate-shake'
                            : isPulsing
                            ? 'bg-indigo-600/30 border border-indigo-500 text-white pulse-target'
                            : activeStyles.gridCell
                        }`}
                        id={`schulte-${cell.id}`}
                        style={{
                          transform: isTapped ? 'scale(0.95)' : 'scale(1)',
                          transition: 'all 0.12s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        {cell.label}
                      </button>
                    );
                  })}
                </div>

                {/* Overlay Game State Screen: Starts game */}
                {!gameStarted && (
                  <div className={`absolute inset-0 z-20 backdrop-blur-md rounded-3xl flex flex-col justify-center items-center text-center p-6 space-y-4 ${isLight ? 'bg-white/90' : 'bg-slate-950/80'}`}>
                    <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                      <Compass className="w-8 h-8 animate-spin-slow text-white" />
                    </div>
                    <div className="space-y-1">
                      <h3 className={`text-xl font-bold uppercase tracking-tight ${activeStyles.textTitle}`}>Fix Eye Focus</h3>
                      <p className={`text-xs px-4 max-w-sm ${activeStyles.textMuted}`}>
                        Fixate your gaze directly on the center crosshairs. Tap correct items using peripheral vision only.
                      </p>
                    </div>
                    <button
                      onClick={triggerSessionTimer}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition duration-150 flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/10"
                      id="game-start-trigger"
                    >
                      <Play className="fill-white w-4 h-4 text-white" /> Start Round Focus
                    </button>
                  </div>
                )}

                {/* Paused Overlay Screen */}
                {gameStarted && !gameRunning && (
                  <div className={`absolute inset-0 z-20 backdrop-blur-md rounded-3xl flex flex-col justify-center items-center text-center p-6 space-y-4 animate-fadeIn ${isLight ? 'bg-white/95' : 'bg-slate-950/85'}`}>
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center border ${isLight ? 'bg-slate-100 text-slate-800 border-slate-250' : 'bg-slate-850 text-slate-350 border-slate-700'}`}>
                      <Pause className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className={`text-lg font-bold ${activeStyles.textTitle}`}>Focus Paused</h3>
                      <p className={`text-xs px-6 ${activeStyles.textMuted}`}>
                        Eye training timer halted. Minimize distractors before resuming focus!
                      </p>
                    </div>
                    <button
                      onClick={resumeActiveSession}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition duration-150 flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10"
                      id="game-resume-trigger"
                    >
                      <Play className="fill-white w-4 h-4 text-white" /> Resume Focus
                    </button>
                  </div>
                )}
              </div>

              {/* In-Game Action Menus scaled down to match visual rhythm */}
              <div className="w-full max-w-xl flex flex-wrap sm:flex-nowrap gap-2 sm:gap-2.5 justify-center mt-1">
                {gameRunning ? (
                  <button
                    onClick={pauseActiveSession}
                    className={`flex-1 min-w-[110px] py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${activeStyles.btnSecondary}`}
                    id="game-pause-mid"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause Timer
                  </button>
                ) : (
                  gameStarted && (
                    <button
                      onClick={resumeActiveSession}
                      className={`flex-1 min-w-[110px] py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${activeStyles.btnAccent}`}
                      id="game-resume-mid"
                    >
                      <Play className="fill-white w-3.5 h-3.5 text-white" /> Continue Round
                    </button>
                  )
                )}

                <button
                  onClick={triggerTargetVisualPulse}
                  disabled={!gameRunning}
                  className={`py-1.5 px-3 sm:px-3 text-xs rounded-lg font-bold border focus:ring-1 flex items-center justify-center gap-1.5 ${
                    gameRunning 
                      ? isLight
                        ? 'bg-white border-slate-250 text-indigo-700 hover:bg-slate-100 cursor-pointer shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-indigo-400 hover:bg-slate-850 cursor-pointer'
                      : isLight
                        ? 'bg-slate-50 border-slate-100 text-slate-405 cursor-not-allowed opacity-50'
                        : 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed opacity-50'
                  }`}
                  title="Flash current target position"
                  id="game-pulse-hint"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-505" /> Target Hint
                </button>

                <button
                  onClick={startNewRound}
                  className={`py-1.5 px-3 sm:px-3 text-xs rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${activeStyles.btnSecondary}`}
                  title="Reinitialize the current board"
                  id="game-reset-mid"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>

                <button
                  onClick={quitActiveRound}
                  className="py-1.5 px-3 rounded-lg font-bold text-xs border border-rose-500/20 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 transition cursor-pointer"
                  id="game-quit-mid"
                >
                  Quit Game
                </button>
              </div>
            </motion.div>
          ) : currentScreen === 'results' && lastFinishedSession ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`max-w-2xl w-full text-left rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden ${activeStyles.card}`}
            >
              {/* Decorative graphic element */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full flex items-center justify-center pointer-events-none">
                <Check className="w-8 h-8 text-emerald-400 translate-x-4 -translate-y-4" />
              </div>

              {/* Title Header */}
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-emerald-450 bg-emerald-500/10 border border-emerald-500/20 text-xs px-3 py-1 rounded-full font-bold">
                  ✓ Round Trained Complete
                </div>
                <h2 className={`text-3xl font-black ${activeStyles.textTitle}`}>Focus Breakthrough!</h2>
                <p className={`text-sm ${activeStyles.textMuted}`}>
                  You resolved a {lastFinishedSession.difficulty} Schulte layout in {lastFinishedSession.mode} mode.
                </p>
              </div>

              {/* Score breakdown parameters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-2xl ${activeStyles.subCard}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Round Solved In</span>
                  <span className={`text-2xl font-black font-mono ${isLight ? 'text-indigo-650' : 'text-indigo-400'}`}>
                    {formatDisplayTime(lastFinishedSession.totalTimeMs)}
                  </span>
                </div>

                <div className={`p-4 rounded-2xl ${activeStyles.subCard}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Total Mistake Checks</span>
                  <span className={`text-2xl font-black font-mono ${activeStyles.textTitle}`}>
                    {lastFinishedSession.mistakes}
                  </span>
                </div>

                <div className={`p-4 rounded-2xl ${activeStyles.subCard}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Tapping Accuracy</span>
                  <span className="text-2xl font-black font-mono text-emerald-505 text-emerald-500">
                    {lastFinishedSession.accuracy}%
                  </span>
                </div>

                <div className={`p-4 rounded-2xl ${activeStyles.subCard}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Difficulty</span>
                  <span className={`text-2xl font-black capitalize ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    {lastFinishedSession.difficulty}
                  </span>
                </div>
              </div>

              {/* Advanced visual split progression line graph (SVG) */}
              {lastFinishedSession.tapIntervals && lastFinishedSession.tapIntervals.length > 0 && (
                <div className="space-y-2">
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${activeStyles.textMuted}`}>
                    Saccadic Processing Split times (Tap by Tap)
                  </h3>
                  <div className={`p-4 sm:p-5 rounded-2xl h-44 flex items-end ${activeStyles.subCard}`}>
                    <div className="w-full h-full flex flex-col justify-between">
                      {/* Plot svg bar representation of latency for each clicked value */}
                      <div className="relative flex-grow flex items-end gap-1.5 sm:gap-2.5 h-full pt-4">
                        {lastFinishedSession.tapIntervals.map((interval, index) => {
                          // Standardize scaling ratio (max cap split of 4.5 seconds to preserve scale readability)
                          const cappedInterval = Math.min(interval, 4500);
                          const pctHeight = (cappedInterval / 4500) * 100;

                          return (
                            <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                              {/* Hover Tooltip tooltip */}
                              <div className={`absolute bottom-full mb-1 border text-[10px] font-mono p-1 px-1.5 rounded opacity-0 group-hover:opacity-100 transition duration-150 z-10 pointer-events-none whitespace-nowrap shadow-xl ${
                                isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-200'
                              }`}>
                                Tap {index + 1}: {formatDisplayTime(interval)}
                              </div>
                              <div 
                                className={`w-full group-hover:bg-indigo-400 group-hover:bg-indigo-500 transition-all ease-out rounded-t-md ${
                                  isLight ? 'bg-indigo-600/70' : 'bg-indigo-500/50'
                                }`}
                                style={{ height: `${Math.max(pctHeight, 8)}%` }}
                              />
                              <span className="text-[8px] sm:text-[10px] font-mono text-slate-500 mt-1 font-semibold">
                                {index + 1}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className={`flex justify-between border-t ${isLight ? 'border-slate-200' : 'border-slate-850/50'} pt-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1`}>
                        <span>Speed Split graph 1 (Quick start)</span>
                        <span>Progression Sequence →</span>
                        <span>Item {lastFinishedSession.tapIntervals.length} finished</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={startNewRound}
                  className={`flex-1 py-4.5 px-6 rounded-xl font-bold flex items-center justify-center gap-3 transition cursor-pointer ${activeStyles.btnAccent}`}
                  id="results-play-again"
                >
                  <RotateCcw className="w-5 h-5 text-white" /> Start Focus Refresher
                </button>
                <button
                  onClick={() => setCurrentScreen('home')}
                  className={`py-4.5 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${activeStyles.btnSecondary}`}
                  id="results-dashboard-nav"
                >
                  Return Dashboard
                </button>
                <button
                  onClick={() => {
                    const shareText = `🧠 I completed a ${lastFinishedSession.difficulty} Schulte Table training in ${formatDisplayTime(lastFinishedSession.totalTimeMs)} with ${lastFinishedSession.accuracy}% accuracy! Test your focus on Schulte Matrix.`;
                    try {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(shareText);
                        showToast('Results copyable description saved to clipboard!', 'success');
                      } else {
                        showToast(shareText, 'info', 6000);
                      }
                    } catch {
                      showToast(shareText, 'info', 6000);
                    }
                  }}
                  className={`py-4.5 px-4 rounded-xl border ${isLight ? 'border-slate-200 hover:bg-slate-50 text-slate-650' : 'border-slate-805 text-slate-350 hover:bg-slate-850'} font-semibold cursor-pointer flex items-center justify-center gap-2`}
                  title="Copy scoring to clipboard"
                >
                  <Share2 className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-slate-400'}`} /> Share Focus
                </button>
              </div>
            </motion.div>
          ) : currentScreen === 'history' ? (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="max-w-4xl w-full space-y-6 text-left"
            >
              {/* Header block */}
              <div className={`flex justify-between items-start md:items-center flex-col md:flex-row gap-4 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'} pb-5`}>
                <div>
                  <h1 className={`text-3xl font-bold flex items-center gap-2 ${activeStyles.textTitle}`}>
                    <HistoryIcon className="w-7 h-7 text-indigo-400" /> Historic Logs
                  </h1>
                  <p className={`text-sm mt-1 ${activeStyles.textMuted}`}>
                    Review and synchronize past neurological diagnostic rounds.
                  </p>
                </div>

                <div className="flex gap-2">
                  {!currentUser && historyList.length > 0 && (
                    <button
                      onClick={() => {
                        showToast('Login or Register to synchronize and backup local sessions!', 'info');
                        setCurrentScreen('auth');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 cursor-pointer"
                      id="anon-history-backup"
                    >
                      ☁ Sync Guest Sessions
                    </button>
                  )}
                  <button
                    onClick={() => setCurrentScreen('home')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${activeStyles.btnSecondary}`}
                  >
                    Go Back Home
                  </button>
                </div>
              </div>

              {/* SVG Trend History Analytics Chart */}
              {historyList.length > 1 ? (
                <div className={`${activeStyles.card} p-5 rounded-2xl`}>
                  <h3 className={`text-sm font-bold mb-4 uppercase tracking-wider ${activeStyles.textTitle}`}>
                    Saccadic Flow Over History (Fastest Solves)
                  </h3>
                  <div className="h-44 w-full pt-2">
                    {/* Compact responsive custom Trend Line represent via SVG */}
                    <svg className="w-full h-full text-indigo-505" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Process coordinates */}
                      {(() => {
                        const maxPoints = Math.min(15, historyList.length);
                        // Take chronological order for historical line progression
                        const pointsDataset = [...historyList].reverse().slice(-maxPoints);
                        const times = pointsDataset.map(s => s.totalTimeMs);
                        const maxTime = Math.max(...times, 10000);
                        const minTime = Math.min(...times, 1000);
                        const timeSpan = maxTime - minTime || 1;

                        const coordinates = pointsDataset.map((s, idx) => {
                          const x = (idx / (pointsDataset.length - 1)) * 100;
                          const y = 25 - ((s.totalTimeMs - minTime) / timeSpan) * 20;
                          return { x, y, sess: s };
                        });

                        const pathStr = coordinates.reduce((currStr, p, i) => {
                          return currStr + `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
                        }, '');

                        const areaStr = coordsToArea(coordinates);

                        function coordsToArea(coords: typeof coordinates) {
                          if (coords.length === 0) return '';
                          return `${pathStr} L ${coords[coords.length - 1].x} 28 L ${coords[0].x} 28 Z`;
                        }

                        return (
                          <>
                            {/* Area Fill */}
                            <path d={areaStr} fill="url(#chartGradient)" />
                            {/* Line Trace */}
                            <path d={pathStr} fill="none" stroke="#6366f1" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
                            {/* Dots */}
                            {coordinates.map((p, i) => (
                              <circle key={i} cx={p.x} cy={p.y} r="0.6" fill={isLight ? '#6366f1' : '#fff'} stroke="#6366f1" strokeWidth="0.3" className="cursor-pointer group-hover:scale-150 transition" />
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">
                      <span>Older rounds</span>
                      <span>Linear Progress Index</span>
                      <span>Most recent completes</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Grid history session cards */}
              {historyList.length === 0 ? (
                <div className={`${activeStyles.card} text-center py-16 px-6 rounded-3xl`}>
                  <Compass className="w-12 h-12 text-slate-505 mx-auto mb-4" />
                  <h3 className={`text-xl font-bold mb-1 ${activeStyles.textTitle}`}>No gameplay records logged</h3>
                  <p className={`text-sm max-w-sm mx-auto mb-6 ${activeStyles.textMuted}`}>
                    Enter your very first training round on the dashboard, complete it successfully, and review your performance diagnostics here.
                  </p>
                  <button
                    onClick={startNewRound}
                    className={`px-5 py-3 rounded-xl font-bold text-sm inline-flex items-center gap-2 cursor-pointer ${activeStyles.btnAccent}`}
                  >
                    <Play className="fill-white w-4 h-4 text-white" /> Start Round Focus
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {historyList.map((session, index) => {
                    return (
                      <div
                        key={session.id || index}
                        className={`${activeStyles.card} p-4.5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition`}
                      >
                        <div className="flex items-center gap-3.5 text-left">
                          <div className={`w-11 h-11 rounded-1.5xl ${isLight ? 'bg-indigo-50 border-indigo-150 text-indigo-705' : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'} border flex flex-col justify-center items-center`}>
                            <span className="text-[10px] font-extrabold uppercase leading-none">{session.difficulty}</span>
                            <span className="text-[9px] font-bold opacity-80 capitalize mt-1 leading-none">{session.mode}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-base font-bold font-mono ${activeStyles.textTitle}`}>
                                {formatDisplayTime(session.totalTimeMs)}
                              </span>
                              <span className="text-xs text-slate-500">•</span>
                              <span className="text-xs text-emerald-500 font-semibold font-mono">{session.accuracy}% Accuracy</span>
                            </div>
                            <span className={`text-[11px] mt-1 block flex items-center gap-1 font-mono ${activeStyles.textMuted}`}>
                              <Calendar className="w-3 h-3 text-slate-500" /> {new Date(session.startedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className={`text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto border-t sm:border-0 ${isLight ? 'border-slate-200' : 'border-slate-800/60'} pt-3 sm:pt-0`}>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Errors Tapped</span>
                            <span className={`text-sm font-extrabold font-mono ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                              {session.mistakes} errors
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : currentScreen === 'settings' ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="max-w-2xl w-full text-left"
            >
              {/* Settings Frame Header */}
              <div className={`flex justify-between items-center border-b ${isLight ? 'border-slate-200' : 'border-slate-800'} pb-4 mb-6`}>
                <div>
                  <h1 className={`text-3xl font-extrabold flex items-center gap-2 ${activeStyles.textTitle}`}>
                    <Sliders className="w-7 h-7 text-indigo-400" /> General Preferences
                  </h1>
                  <p className={`text-sm mt-1 ${activeStyles.textMuted}`}>
                    Refine training constraints, sound, and visual interface themes.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentScreen('home')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${activeStyles.btnSecondary}`}
                  id="settings-back-btn"
                >
                  Return Home
                </button>
              </div>

              {/* Form card styling */}
              <div className={`${activeStyles.card} rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl`}>
                {/* 1. Grid Sizes */}
                <div className="space-y-2">
                  <label className={`text-xs font-bold uppercase tracking-wider block ${isLight ? 'text-slate-700' : 'text-slate-350'}`}>
                    Matrix Grid Size
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(['3x3', '4x4', '5x5', '6x6'] as GameDifficulty[]).map((size) => (
                      <button
                        key={size}
                        onClick={() => saveSettingsUpdate({ ...settings, gridSize: size })}
                        className={`py-3 px-2 rounded-2xl font-bold text-center border capitalize transition cursor-pointer ${
                          settings.gridSize === size
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                            : isLight
                            ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                            : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-400'
                        }`}
                      >
                        <span className="block text-lg">{size}</span>
                        <span className="text-[10px] font-medium block mt-1">
                          {size === '3x3' ? 'Beginner' : size === '4x4' ? 'Standard' : size === '5x5' ? 'Advanced' : 'Expert'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Sequence format modes */}
                <div className="space-y-2">
                  <label className={`text-xs font-bold uppercase tracking-wider block ${isLight ? 'text-slate-700' : 'text-slate-350'}`}>
                    Focus Grid Character Formats
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(['number', 'letter', 'roman', 'reverse'] as GameMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => saveSettingsUpdate({ ...settings, mode })}
                        className={`p-3 rounded-2xl font-semibold border text-left flex justify-between items-center transition cursor-pointer ${
                          settings.mode === mode
                            ? 'bg-indigo-600 border-indigo-550 text-white'
                            : isLight
                            ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                            : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-400'
                        }`}
                      >
                        <div>
                          <span className="block text-sm font-bold capitalize">
                            {mode === 'reverse' ? 'Reverse Order Sequencer' : mode + ' Sequence'}
                          </span>
                          <span className={`text-[10px] block mt-0.5 opacity-90 ${activeStyles.textMuted}`}>
                            {mode === 'number' && 'Ascending values: 1, 2, 3, 4, 5...'}
                            {mode === 'letter' && 'Alphabetical values: A, B, C, D, E...'}
                            {mode === 'roman' && 'Roman numerals: I, II, III, IV, V...'}
                            {mode === 'reverse' && 'Sequencer clicks downwards: Max to 1'}
                          </span>
                        </div>
                        {settings.mode === mode && <Check className="w-5 h-5 text-white flex-shrink-0 ml-2" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Appearance Themes */}
                <div className="space-y-2">
                  <label className={`text-xs font-bold uppercase tracking-wider block ${isLight ? 'text-slate-700' : 'text-slate-355'}`}>
                    Visual Aesthetics
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(['slate', 'nord', 'cyber', 'lavender'] as GameTheme[]).map((th) => (
                      <button
                        key={th}
                        onClick={() => saveSettingsUpdate({ ...settings, theme: th })}
                        className={`py-3.5 px-3 rounded-2xl font-bold capitalize border text-sm transition-all cursor-pointer ${
                          settings.theme === th
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : isLight
                            ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                            : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-400'
                        }`}
                      >
                        {th === 'slate' && 'Slate Space'}
                        {th === 'nord' && 'Nord Frost'}
                        {th === 'cyber' && 'Cyber Neon'}
                        {th === 'lavender' && 'Regal Violet'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Peripheral Sound and Vibration feedback toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Sound Toggle */}
                  <div className={`flex items-center justify-between p-4.5 sm:p-5 border rounded-2xl gap-4 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border border-slate-850'}`}>
                    <div className="text-left space-y-1 flex-1 min-w-0">
                      <span className={`text-sm font-bold block leading-tight ${activeStyles.textTitle}`}>Auditory Clicks</span>
                      <p className={`text-[11px] leading-normal ${activeStyles.textMuted}`}>
                        Focal synthesizer sounds confirming selection legality.
                      </p>
                    </div>
                    <button
                      onClick={() => saveSettingsUpdate({ ...settings, soundEnabled: !settings.soundEnabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        settings.soundEnabled ? 'bg-indigo-600' : isLight ? 'bg-slate-200' : 'bg-slate-800'
                      }`}
                      aria-label="Sound enabled toggle"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-200 ${
                          settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Vibration Toggle */}
                  <div className={`flex items-center justify-between p-4.5 sm:p-5 border rounded-2xl gap-4 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border border-slate-850'}`}>
                    <div className="text-left space-y-1 flex-1 min-w-0">
                      <span className={`text-sm font-bold block leading-tight ${activeStyles.textTitle}`}>Saccadic Vibration</span>
                      <p className={`text-[11px] leading-normal ${activeStyles.textMuted}`}>
                        Tactile haptic triggers reacting specifically on error.
                      </p>
                    </div>
                    <button
                      onClick={() => saveSettingsUpdate({ ...settings, vibrationEnabled: !settings.vibrationEnabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        settings.vibrationEnabled ? 'bg-indigo-600' : isLight ? 'bg-slate-200' : 'bg-slate-800'
                      }`}
                      aria-label="Vibration toggle"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-200 ${
                          settings.vibrationEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : currentScreen === 'auth' ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={`max-w-md w-full text-left rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative ${activeStyles.card}`}
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold mx-auto shadow-md">
                  <User className="w-6 h-6 text-white" />
                </div>
                <h2 className={`text-2xl font-black ${activeStyles.textTitle}`}>
                  {authMode === 'login' ? 'Welcome Back Trainer' : 'Create Training Profile'}
                </h2>
                <p className={`text-xs ${activeStyles.textMuted}`}>
                  {authMode === 'login'
                    ? 'Login to backup personal telemetry score split metrics.'
                    : 'Register an account to log diagnostic trend data globally.'}
                </p>
              </div>

              {/* Form container */}
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'register' && (
                  <div className="space-y-1">
                    <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                      Full Name Label
                    </label>
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="e.g. Jean Constant"
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:outline-none font-medium text-sm transition ${
                        isLight 
                          ? 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-indigo-500' 
                          : 'bg-slate-950 border-slate-850 text-white placeholder-slate-600 focus:ring-indigo-650'
                      }`}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="example@focus.com"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:outline-none font-medium text-sm transition ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-indigo-500' 
                        : 'bg-slate-950 border-slate-850 text-white placeholder-slate-600 focus:ring-indigo-650'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Enter password"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:outline-none font-medium text-sm transition ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-indigo-500' 
                        : 'bg-slate-950 border-slate-850 text-white placeholder-slate-600 focus:ring-indigo-650'
                    }`}
                  />
                </div>

                {/* Actions Button */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-2 font-semibold"
                >
                  {authLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : authMode === 'login' ? (
                    'Authenticate Account'
                  ) : (
                    'Initiate Profile'
                  )}
                </button>
              </form>

              {/* Mode Toggles */}
              <div className={`text-center border-t ${isLight ? 'border-slate-200' : 'border-slate-850'} pt-4`}>
                <button
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-xs font-semibold text-indigo-500 hover:underline hover:text-indigo-600"
                >
                  {authMode === 'login'
                    ? "Don't have an account yet? Register Here »"
                    : 'Already registered? Log in to your profile »'}
                </button>
              </div>

              {/* Play Guest Mode */}
              <div className="text-center pt-1">
                <button
                  onClick={() => setCurrentScreen('home')}
                  className={`text-xs font-medium tracking-wide underline ${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Skip and train anonymous as Guest »
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      {/* Elegant minimalist footer */}
      <footer className={`py-4 px-4 sm:px-6 text-center text-xs border-t transition-all ${
        isLight 
          ? 'bg-white/70 border-slate-200 text-slate-500 shadow-sm' 
          : 'bg-slate-950/40 border-slate-900 text-slate-500'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>🧠 Schulte Matrix Focus Applet © 2026. All rights and neurological diagnostics reserved.</span>
          <div className="flex gap-4">
            <button onClick={() => showToast("Schulte Tables help expand effective reading fields using standard visual diagnostics.", "info")} className={`hover:underline transition ${isLight ? 'text-slate-600 hover:text-indigo-600' : 'text-slate-400 hover:text-slate-350'}`}>Clinical Info</button>
            <span>•</span>
            <button onClick={() => showToast("Offline Fallback Mode is operational. Your scores store securely in local browser caches.", "success")} className={`hover:underline transition ${isLight ? 'text-slate-600 hover:text-indigo-600' : 'text-slate-400 hover:text-slate-350'}`}>System Status</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
