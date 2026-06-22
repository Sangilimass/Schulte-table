/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
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
  Moon,
  Printer
} from 'lucide-react';
import { GameDifficulty, GameMode, GameTheme, GameCell, UserSettings, GameSession, TrainingStats, UserProfile } from './types.js';
import { ApiClient } from './lib/api.js';
import { synth } from './lib/audio.js';
import { ToastProvider, useToast } from './components/Notifications.js';

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

  // Worksheet Print Selection configurations
  const [printCount, setPrintCount] = useState<number>(4);
  const [printSize, setPrintSize] = useState<GameDifficulty>('5x5');
  const [printMode, setPrintMode] = useState<GameMode>('number');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printSheets, setPrintSheets] = useState<Array<GameCell[][]>>([]);

  const handlePrintTrigger = () => {
    const sheetsList: Array<GameCell[][]> = [];
    const dimension = getGridDimension(printSize);
    const cellsCount = dimension * dimension;

    for (let sheetIdx = 0; sheetIdx < printCount; sheetIdx++) {
      const rawItems: Array<{ val: number; label: string }> = [];
      for (let i = 0; i < cellsCount; i++) {
        rawItems.push(getCellLabel(i, printMode, cellsCount));
      }

      // Shuffle
      const shuffled = [...rawItems];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const initialCells: GameCell[] = shuffled.map((item, idx) => ({
        id: `print-cell-${sheetIdx}-${idx}-${item.val}`,
        val: item.val,
        label: item.label,
        tapped: false,
        pulsing: false,
        error: false,
      }));

      const gridRows: GameCell[][] = [];
      for (let r = 0; r < dimension; r++) {
        gridRows.push(initialCells.slice(r * dimension, (r + 1) * dimension));
      }
      sheetsList.push(gridRows);
    }

    setPrintSheets(sheetsList);
    
    setTimeout(() => {
      window.print();
    }, 150);
  };

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
        bg: 'bg-gradient-to-br from-[#0a0f1d] via-[#121829] to-[#0a0f1d] text-slate-100 selection:bg-indigo-500/30',
        card: 'bg-slate-900/90 border border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl hover:border-indigo-500/20 transition-all duration-300 rounded-3xl',
        border: 'border-slate-800/90',
        textMuted: 'text-slate-400',
        textTitle: 'text-white font-extrabold',
        textAccent: 'text-indigo-400',
        btnAccent: 'bg-gradient-to-r from-indigo-550 via-purple-550 to-indigo-550 bg-[size:200%_auto] hover:bg-[right_center] text-white shadow-lg shadow-indigo-600/15 focus:ring-2 focus:ring-indigo-500 hover:-translate-y-0.5 active:translate-y-0 active:scale-97 transition-all duration-300',
        btnSecondary: 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/65 focus:ring-2 focus:ring-slate-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-97 transition-all duration-200',
        gridCell: 'bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 hover:from-slate-800 hover:to-slate-900 border border-slate-800/80 hover:border-indigo-500/30 active:scale-95 shadow-md active:bg-slate-800 transition-all duration-150 relative overflow-hidden group hover:shadow-[0_0_15px_rgba(99,102,241,0.15)]',
        navBtn: 'text-slate-400 hover:text-white transition-colors',
        navBtnActive: 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]',
        subCard: 'bg-slate-950/45 border border-slate-850/70 hover:border-slate-800/80 hover:bg-slate-950/60 transition-all duration-200',
        formInput: 'bg-slate-955 border border-slate-800 focus:border-indigo-505 focus:ring-1 focus:ring-indigo-505 text-white'
      },
      light: {
        bg: 'bg-gradient-to-br from-[#FFFDF1] via-white to-[#FFFDF1] text-slate-900 selection:bg-[#59C749]/20',
        card: 'bg-white border border-slate-200/95 shadow-[0_20px_40px_rgba(89,199,73,0.025)] backdrop-blur-lg hover:border-[#59C749]/15 transition-all duration-300 rounded-3xl',
        border: 'border-slate-150',
        textMuted: 'text-slate-550',
        textTitle: 'text-slate-900 font-extrabold',
        textAccent: 'text-[#59C749]',
        btnAccent: 'bg-[#59C749] hover:bg-[#4ab53b] text-white shadow-md shadow-[#59C749]/15 focus:ring-2 focus:ring-[#59C749] hover:-translate-y-0.5 active:translate-y-0 active:scale-97 transition-all duration-300',
        btnSecondary: 'bg-slate-100/95 hover:bg-slate-200 text-slate-705 border border-slate-200 focus:ring-2 focus:ring-slate-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-97 transition-all duration-200',
        gridCell: 'bg-gradient-to-b from-white to-[#FFFDF1]/30 text-slate-800 hover:from-white hover:to-[#FFFDF1] border border-slate-200 hover:border-[#59C749]/40 active:scale-95 shadow-sm active:bg-slate-100 transition-all duration-150 hover:shadow-[#59C749]/5',
        navBtn: 'text-slate-500 hover:text-slate-900 transition-colors',
        navBtnActive: 'text-white bg-[#59C749] border border-[#59C749]/60 shadow-sm',
        subCard: 'bg-white/80 border border-slate-150/70 hover:border-slate-200 hover:bg-[#FFFDF1]/50 transition-all duration-200',
        formInput: 'bg-white border border-slate-250 focus:border-[#59C749] focus:ring-1 focus:ring-[#59C749] text-slate-900 font-medium'
      }
    },
    nord: {
      dark: {
        bg: 'bg-gradient-to-br from-[#1e222b] via-[#2e3440] to-[#1e222b] text-[#d8dee9] selection:bg-[#88c0d0]/30',
        card: 'bg-[#2e3440]/95 border border-[#3b4252]/90 shadow-[0_20px_50px_rgba(46,52,64,0.3)] backdrop-blur-xl hover:border-[#88c0d0]/20 transition-all duration-300 rounded-3xl',
        border: 'border-[#3b4252]/90',
        textMuted: 'text-[#9ca3af]',
        textTitle: 'text-[#eceff4] font-extrabold',
        textAccent: 'text-[#88c0d0]',
        btnAccent: 'bg-gradient-to-r from-[#88c0d0] to-[#8fbcbb] text-[#2e3440] font-bold shadow-lg shadow-[#88c0d0]/10 focus:ring-2 focus:ring-[#88c0d0] hover:-translate-y-0.5 active:translate-y-0 active:scale-97 transition-all duration-300',
        btnSecondary: 'bg-[#3b4252]/95 hover:bg-[#434c5e] text-[#e5e9f0] border border-[#4c566a]/70 focus:ring-2 focus:ring-[#4c566a] hover:-translate-y-0.5 active:translate-y-0 active:scale-97 transition-all duration-200',
        gridCell: 'bg-gradient-to-b from-[#2e3440] to-[#242933] text-[#e5e9f0] hover:from-[#3b4252] hover:to-[#2e3440] border border-[#3b4252]/85 hover:border-[#1abc9c]/30 active:scale-95 shadow-md active:bg-[#3b4252] transition-all duration-150 relative overflow-hidden group',
        navBtn: 'text-[#9ca3af] hover:text-[#eceff4] transition-colors',
        navBtnActive: 'text-[#88c0d0] bg-[#88c0d0]/10 border border-[#88c0d0]/30 shadow-sm',
        subCard: 'bg-[#3b4252]/50 border border-[#4c566a]/80 hover:border-[#4c566a] hover:bg-[#3b4252]/75 transition-all duration-200',
        formInput: 'bg-[#242933] border border-[#4c566a] focus:ring-[#88c0d0] focus:border-[#88c0d0] text-[#eceff4]'
      },
      light: {
        bg: 'bg-gradient-to-br from-[#FFFDF1] via-white to-[#FFFDF1] text-[#2e3440] selection:bg-[#59C749]/40',
        card: 'bg-white border border-[#FFFDF1] shadow-[0_20px_40px_rgba(89,199,73,0.03)] backdrop-blur-lg hover:border-[#59C749]/20 transition-all duration-300 rounded-3xl',
        border: 'border-[#e5e9f0]',
        textMuted: 'text-[#4c566a]',
        textTitle: 'text-[#2e3440] font-bold',
        textAccent: 'text-[#59C749]',
        btnAccent: 'bg-[#59C749] hover:bg-[#4ab53b] text-white font-bold shadow-md shadow-[#59C749]/15 focus:ring-2 focus:ring-[#59C749] hover:-translate-y-0.5 active:translate-y-0 active:scale-97 transition-all duration-300',
        btnSecondary: 'bg-[#e5e9f0]/90 hover:bg-[#d8dee9] text-[#4c566a] border border-[#d8dee9] focus:ring-2 focus:ring-[#59C749] hover:-translate-y-0.5 active:translate-y-0 active:scale-97 transition-all duration-200',
        gridCell: 'bg-gradient-to-b from-white to-[#FFFDF1] text-[#2e3440] hover:from-[#eceff4] hover:to-[#e5e9f0] border border-[#e5e9f0] hover:border-[#59C749]/50 active:scale-95 shadow-sm active:bg-[#eceff4] transition-all duration-150',
        navBtn: 'text-[#4c566a] hover:text-[#2e3440] transition-colors',
        navBtnActive: 'text-white bg-[#59C749] border border-[#59C749]/30 shadow-sm',
        subCard: 'bg-[#eceff4]/60 border border-[#e5e9f0]/80 hover:border-[#e5e9f0] hover:bg-[#eceff4]/80 transition-all duration-200',
        formInput: 'bg-white border border-[#d8dee9] focus:ring-[#59C749] text-[#2e3440]'
      }
    },
    cyber: {
      dark: {
        bg: 'bg-black text-[#39ff14] selection:bg-[#ff007f]/40',
        card: 'bg-[#0f0f0f]/95 border-2 border-[#39ff14] shadow-[0_0_20px_rgba(57,255,20,0.15)] hover:shadow-[0_0_30px_rgba(57,255,20,0.25)] hover:border-[#ff007f]/50 transition-all duration-300 rounded-2xl',
        border: 'border-[#39ff14]/30',
        textMuted: 'text-zinc-500 font-mono text-[11px]',
        textTitle: 'text-[#39ff14] font-black uppercase tracking-wider',
        textAccent: 'text-[#ff007f]',
        btnAccent: 'bg-gradient-to-r from-[#ff007f] via-[#ec4899] to-[#ff007f] hover:brightness-110 text-black font-extrabold shadow-lg focus:ring-2 focus:ring-[#ff007f] uppercase tracking-widest hover:scale-103 active:scale-97 transition-all duration-200 border-2 border-black',
        btnSecondary: 'bg-[#151515] hover:bg-[#252525] text-[#39ff14] border-2 border-[#39ff14]/70 focus:ring-2 focus:ring-[#39ff14] uppercase tracking-wide font-extrabold hover:translate-y-[-1px] active:translate-y-0 transition-all duration-200',
        gridCell: 'bg-black text-[#39ff14] border-2 border-[#39ff14]/35 hover:border-[#ff007f] hover:text-white hover:bg-[#0c0c0c] shadow-[0_0_8px_rgba(57,255,20,0.06)] active:scale-95 hover:shadow-[0_0_15px_rgba(255,0,127,0.25)] transition-all duration-120 font-black',
        navBtn: 'text-[#39ff14]/60 hover:text-[#39ff14] transition-colors',
        navBtnActive: 'text-black bg-[#39ff14] border-2 border-[#39ff14] font-black',
        subCard: 'bg-black border border-[#39ff14]/30 hover:border-[#39ff14] hover:bg-[#070707] transition-all duration-200',
        formInput: 'bg-black border-2 border-[#39ff14]/50 focus:border-[#39ff14] text-[#39ff14] font-mono'
      },
      light: {
        bg: 'bg-[#FFFDF1] text-black selection:bg-[#59C749]/35 border-zinc-200',
        card: 'bg-white border-3 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 rounded-2xl',
        border: 'border-black',
        textMuted: 'text-zinc-650 font-semibold',
        textTitle: 'text-black font-black uppercase tracking-wide',
        textAccent: 'text-[#59C749] font-extrabold',
        btnAccent: 'bg-[#59C749] hover:bg-[#4ab53b] text-black font-extrabold border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200 uppercase tracking-widest',
        btnSecondary: 'bg-white hover:bg-zinc-100 text-black border-3 border-black font-extrabold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200',
        gridCell: 'bg-white text-black border-3 border-black font-black hover:bg-emerald-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-100',
        navBtn: 'text-zinc-700 hover:text-black font-extrabold transition-colors',
        navBtnActive: 'text-white bg-[#59C749] border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-150',
        subCard: 'bg-white border-2 border-black hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-150',
        formInput: 'bg-white border-3 border-black focus:ring-2 focus:ring-[#59C749] text-black font-bold'
      }
    },
    lavender: {
      dark: {
        bg: 'bg-gradient-to-br from-[#0c0819] via-[#16102c] to-[#0c0819] text-purple-100 selection:bg-purple-500/30',
        card: 'bg-[#18112c]/90 border border-[#4c3b7a]/53 shadow-[0_20px_50px_rgba(12,8,25,0.4)] backdrop-blur-xl hover:border-purple-500/25 transition-all duration-300 rounded-3xl',
        border: 'border-[#2d1f44]',
        textMuted: 'text-purple-300/60',
        textTitle: 'text-white font-extrabold',
        textAccent: 'text-[#b19ffb]',
        btnAccent: 'bg-gradient-to-r from-[#b19ffb] via-fuchsia-400 to-[#b19ffb] bg-[size:200%_auto] hover:bg-[right_center] text-[#0f0b18] font-bold shadow-lg shadow-purple-650/15 focus:ring-2 focus:ring-[#b19ffb] hover:-translate-y-0.5 active:translate-y-0 active:scale-97 transition-all duration-300',
        btnSecondary: 'bg-[#2d1f44]/90 hover:bg-[#3d2c5c] text-purple-200 border border-[#443169]/70 focus:ring-2 focus:ring-[#443169] hover:-translate-y-0.5 active:translate-y-0 active:scale-97 transition-all duration-200',
        gridCell: 'bg-gradient-to-b from-[#1c142e] to-[#120d1f] text-purple-150 hover:from-[#261b3d] hover:to-[#1c142e] border border-purple-800/40 hover:border-purple-400/50 active:scale-95 shadow-md active:bg-[#1a112c] transition-all duration-150 relative overflow-hidden group hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]',
        navBtn: 'text-purple-300/60 hover:text-white transition-colors',
        navBtnActive: 'text-[#b19ffb] bg-[#b19ffb]/10 border border-[#b19ffb]/30 shadow-sm',
        subCard: 'bg-[#2d1f44]/45 border border-[#443169]/60 hover:border-[#443169] hover:bg-[#2d1f44]/70 transition-all duration-200',
        formInput: 'bg-[#120d1f] border border-[#2d1f44] focus:ring-[#b19ffb] focus:border-[#b19ffb] text-white'
      },
      light: {
        bg: 'bg-gradient-to-br from-[#FFFDF1] via-white to-[#FFFDF1] text-purple-950 selection:bg-[#59C749]/20',
        card: 'bg-white border border-purple-200/90 shadow-[0_20px_40px_rgba(89,199,73,0.035)] backdrop-blur-lg hover:border-[#59C749]/20 transition-all duration-300 rounded-3xl',
        border: 'border-purple-150',
        textMuted: 'text-purple-650',
        textTitle: 'text-purple-950 font-bold',
        textAccent: 'text-[#59C749]',
        btnAccent: 'bg-[#59C749] hover:bg-[#4ab53b] text-white shadow-md shadow-[#59C749]/15 focus:ring-2 focus:ring-[#59C749] hover:-translate-y-0.5 active:translate-y-0 active:scale-97 transition-all duration-300',
        btnSecondary: 'bg-purple-100/90 hover:bg-purple-200 text-purple-850 border border-purple-150 focus:ring-2 focus:ring-purple-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-97 transition-all duration-200',
        gridCell: 'bg-gradient-to-b from-white to-[#FFFDF1] text-purple-900 hover:from-[#f5f3ff] hover:to-[#efeaff] border border-purple-150 hover:border-[#59C749]/50 active:scale-95 shadow-sm active:bg-[#f5f3ff] transition-all duration-150',
        navBtn: 'text-purple-700/70 hover:text-purple-950 transition-colors',
        navBtnActive: 'text-white bg-[#59C749] border border-[#59C749]/30 shadow-sm',
        subCard: 'bg-purple-50/70 border border-purple-100/80 hover:border-[#59C749] hover:bg-[#FFFDF1]/50 transition-all duration-200',
        formInput: 'bg-white border border-purple-200 focus:ring-[#59C749] focus:border-[#59C749] text-purple-900'
      }
    }
  }[settings.theme] || {
    dark: {
      bg: 'bg-slate-950 text-slate-100',
      card: 'bg-slate-900 border border-slate-800',
      border: 'border-slate-800',
      textMuted: 'text-slate-400',
      textTitle: 'text-white font-bold',
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
      bg: 'bg-[#FFFDF1] text-slate-900',
      card: 'bg-white border border-slate-200',
      border: 'border-slate-200',
      textMuted: 'text-slate-550',
      textTitle: 'text-slate-900',
      textAccent: 'text-[#59C749]',
      btnAccent: 'bg-[#59C749] hover:bg-[#4ab53b] text-white',
      btnSecondary: 'bg-slate-100 hover:bg-slate-200 text-slate-705',
      gridCell: 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200',
      navBtn: 'text-slate-500 hover:text-slate-900',
      navBtnActive: 'text-white bg-[#59C749] border border-slate-250',
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
              setCurrentScreen('home');
            }} 
            className="flex items-center gap-3 group text-left cursor-pointer focus:outline-none select-none"
          >
            <svg viewBox="0 0 100 100" className="w-10 h-10 group-hover:scale-105 transition-transform duration-300 flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Row 1 */}
              <rect x="6" y="6" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/80" />
              <rect x="28" y="6" width="18" height="18" rx="5" stroke="#3b82f6" strokeWidth="2.5" className="opacity-95" />
              <rect x="50" y="6" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/80" />
              <rect x="72" y="6" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/80" />
              
              {/* Row 2 */}
              <rect x="6" y="28" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/80" />
              <rect x="28" y="28" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/80" />
              <rect x="50" y="28" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/80" />
              <rect x="72" y="28" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/80" />

              {/* Row 3 - Middle elements */}
              <rect x="6" y="50" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/80" />
              <rect x="28" y="50" width="40" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/70" />
              <text x="48" y="63" fill="currentColor" fontFamily="monospace" fontSize="13" fontWeight="bold" textAnchor="middle" className="text-slate-400 dark:text-slate-200">8</text>
              <rect x="72" y="50" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/80" />

              {/* Row 4 */}
              <rect x="6" y="72" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/80" />
              <rect x="28" y="72" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/80" />
              <rect x="50" y="72" width="18" height="18" rx="5" stroke="#ecc94b" strokeWidth="2.5" />
              <rect x="72" y="72" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" className="text-slate-700/50 dark:text-slate-800/80" />

              {/* Cyan/Blue Circuit Routing path */}
              <path d="M 37 15 L 59 15 Q 81 15 81 37 L 81 59 L 89 59" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="37" cy="15" r="3" fill="#3b82f6" />
              <circle cx="59" cy="15" r="3" fill="#38bdf8" />
              <circle cx="89" cy="59" r="3" fill="#22d3ee" />

              {/* Yellow Routing path */}
              <path d="M 59 81 L 81 81 Q 81 69 81 59" stroke="#ecc94b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="59" cy="81" r="3" fill="#fbbf24" />
            </svg>
            <div className="flex flex-col justify-center text-left">
              <span className={`font-bold text-base sm:text-lg leading-tight tracking-tight block ${activeStyles.textTitle}`}>
                Schulte Matrix
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

            {/* Profile Logic */}
            <div className={gameRunning ? 'hidden' : 'block'}>
              {currentUser ? (
                <div className="flex items-center gap-1.5 sm:gap-3">
                  <div className="hidden md:flex flex-col text-right justify-center h-10">
                    <span className={`text-xs font-bold leading-none ${isLight ? 'text-slate-800' : 'text-slate-350'}`}>{currentUser.name}</span>
                    <span className="text-[10px] text-emerald-500 font-mono mt-1 leading-none">Streak: {stats.streakDays}d</span>
                  </div>
                  <motion.button
                    onClick={handleLogout}
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-bold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
                    id="user-logout"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline font-bold">Logout</span>
                  </motion.button>
                </div>
              ) : (
                <motion.button
                  onClick={() => setCurrentScreen('auth')}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 text-xs font-black rounded-xl transition-all duration-300 shadow-md cursor-pointer ${activeStyles.btnAccent}`}
                  id="user-login-prompt"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login</span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main SPA Container */}
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <AnimatePresence mode="wait">
          {currentScreen === 'home' ? (
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
                  <div className={`inline-flex items-center gap-2 px-3 py-1 ${isLight ? 'bg-[#59C749]/10 border border-[#59C749]/20 text-[#4ab53b]' : 'bg-indigo-505/10 border border-indigo-500/20 text-indigo-400'} rounded-full text-xs font-semibold uppercase tracking-wider`}>
                    <Sparkles className={`w-3 h-3 ${isLight ? 'text-[#59C749]' : 'text-indigo-400'}`} /> Foveal & Peripheral Sight Engine
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
                      <div className={`w-6 h-6 rounded-md ${isLight ? 'bg-[#59C749]/10 text-[#4ab53b] font-black' : 'bg-indigo-500/20 text-indigo-405 font-bold'} flex items-center justify-center`}>1</div>
                      <span className={`font-semibold block ${activeStyles.textTitle}`}>Fix Eye Center</span>
                      <p className={`leading-normal ${activeStyles.textMuted}`}>Keep focus solely on center square. Let eye expansion find values.</p>
                    </div>
                    <div className={`space-y-1.5 p-3 rounded-xl ${activeStyles.subCard}`}>
                      <div className={`w-6 h-6 rounded-md ${isLight ? 'bg-[#59C749]/10 text-[#4ab53b] font-black' : 'bg-indigo-500/20 text-indigo-405 font-bold'} flex items-center justify-center`}>2</div>
                      <span className={`font-semibold block ${activeStyles.textTitle}`}>Ascending Tap</span>
                      <p className={`leading-normal ${activeStyles.textMuted}`}>Tap numbers in sequence as quick as neurologically possible.</p>
                    </div>
                    <div className={`space-y-1.5 p-3 rounded-xl ${activeStyles.subCard}`}>
                      <div className={`w-6 h-6 rounded-md ${isLight ? 'bg-[#59C749]/10 text-[#4ab53b] font-black' : 'bg-indigo-500/20 text-indigo-405 font-bold'} flex items-center justify-center`}>3</div>
                      <span className={`font-semibold block ${activeStyles.textTitle}`}>Speed Splits</span>
                      <p className={`leading-normal ${activeStyles.textMuted}`}>Review charts and accelerate your mental split coefficients.</p>
                    </div>
                  </div>
                </div>

                {/* Primary CTA Play Button with gorgeous microinteractions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <motion.button
                    onClick={startNewRound}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex-none px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all duration-300 cursor-pointer ${activeStyles.btnAccent}`}
                    id="btn-play-game"
                  >
                    <Play className="fill-white w-5 h-5 text-white" /> Start Focus Session
                  </motion.button>
                  <motion.button
                    onClick={() => setCurrentScreen('settings')}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex-1 px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer ${activeStyles.btnSecondary}`}
                    id="btn-prep-settings"
                  >
                    <Sliders className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-slate-400'}`} /> Customize
                  </motion.button>
                  <motion.button
                    onClick={() => setIsPrintModalOpen(true)}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex-1 px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer ${activeStyles.btnSecondary}`}
                    id="btn-print-worksheets"
                  >
                    <Printer className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-slate-400'}`} /> Print Sheets
                  </motion.button>
                </div>
              </div>

              {/* Home - Right Section: Performance Card */}
              <div className="md:col-span-5 space-y-6">
                {/* Stats Widget */}
                <div className={`${activeStyles.card} p-6 rounded-3xl relative overflow-hidden text-left`}>
                  <div className={`absolute top-0 right-0 w-24 h-24 ${isLight ? 'bg-[#59C749]/5' : 'bg-indigo-500/10'} rounded-bl-full flex items-center justify-center`}>
                    <Activity className={`w-6 h-6 ${isLight ? 'text-[#59C749]' : 'text-indigo-400'} translate-x-2 -translate-y-2`} />
                  </div>

                  <h2 className={`text-xl font-bold mb-6 ${activeStyles.textTitle}`}>Training Overview</h2>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Stat Item */}
                    <div className={`p-3.5 rounded-2xl ${activeStyles.subCard}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Fastest Time</span>
                      <span className={`text-2xl font-black tracking-tight font-mono ${isLight ? 'text-[#59C749]' : 'text-indigo-400'}`}>
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
                  <div className={`mt-6 flex gap-3 p-3 rounded-xl text-xs ${isLight ? 'bg-[#59C749]/5 border border-[#59C749]/15 text-slate-705' : 'bg-indigo-500/5 border border-indigo-500/10 text-slate-400'}`}>
                    <HelpCircle className={`w-5 h-5 flex-shrink-0 ${isLight ? 'text-[#59C749]' : 'text-indigo-400'}`} />
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
                      <span className={`font-bold hover:underline ${isLight ? 'text-[#59C749]' : 'text-indigo-400'}`}>View History »</span>
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
                  <div className={`p-2 border rounded-xl ${isLight ? 'bg-[#59C749]/10 border-[#59C749]/20' : 'bg-slate-850 border border-slate-800'}`}>
                    <Clock className={`w-5 h-5 animate-pulse ${isLight ? 'text-[#59C749]' : 'text-indigo-400'}`} />
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
                    <span className={`text-2xl font-black tracking-tight font-mono leading-none ${isLight ? 'text-[#59C749]' : 'text-indigo-400'}`}>
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

              {/* Short Peripheral Training Instruction Block */}
              <div className={`p-4 rounded-2xl w-full text-xs text-left leading-normal border shadow-sm ${
                isLight 
                  ? 'bg-slate-50 border-slate-200/85 text-slate-700 shadow-slate-100/30' 
                  : 'bg-slate-900/60 border-slate-850/80 text-slate-350 shadow-none'
              }`}>
                <div className="flex gap-2.5 items-start">
                  <div className={`p-1.5 rounded-lg ${isLight ? 'bg-[#59C749]/10 text-[#4ab53b]' : 'bg-indigo-500/20 text-indigo-400'} flex-shrink-0`}>
                    <Compass className="w-4 h-4 animate-spin-slow" />
                  </div>
                  <div>
                    <h4 className={`font-extrabold mb-0.5 uppercase tracking-wide text-[10px] ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      Peripheral Sight Strategy
                    </h4>
                    <p className="opacity-90">
                      Keep your eyes fixed strictly on the center square of the matrix. Expand your vision outwards to scan and tap elements in chronological order (<strong>{settings.mode === 'reverse' ? 'from Max downwards' : 'A-Z, 1-25 or I-XXV'}</strong>) without shifting your central gaze.
                    </p>
                  </div>
                </div>
              </div>

              {/* Central Schulte Grid Canvas */}
              <div className={`w-[92vw] max-w-[480px] aspect-square flex items-center justify-center p-2.5 sm:p-4 rounded-3xl border shadow-2xl relative select-none ${isLight ? 'bg-slate-100/50 border-slate-250' : 'bg-slate-950/80 border border-slate-800/50'}`}>
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
                      <motion.button
                        key={cell.id}
                        onClick={() => handleCellTap(cell)}
                        disabled={isTapped}
                        whileHover={!isTapped ? { 
                          scale: 1.05, 
                          rotate: cell.id % 2 === 0 ? 0.8 : -0.8,
                          y: -2,
                          transition: { type: "spring", stiffness: 400, damping: 12 }
                        } : {}}
                        whileTap={!isTapped ? { scale: 0.94 } : {}}
                        className={`h-full w-full rounded-2xl font-extrabold flex items-center justify-center select-none text-xl sm:text-2xl md:text-3xl transition-all cursor-pointer relative overflow-hidden group ${
                          isTapped
                            ? isLight
                              ? 'bg-slate-100/90 border border-slate-200 text-slate-350 pointer-events-auto opacity-35 shadow-none'
                              : 'bg-slate-900/40 border border-slate-850/80 text-slate-650 pointer-events-auto opacity-25 shadow-none'
                            : isError
                            ? 'bg-red-500/15 border-2 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.25)] animate-shake'
                            : isPulsing
                            ? isLight
                              ? 'bg-[#59C749]/30 border-2 border-[#59C749] text-indigo-950 font-black pulse-target'
                              : 'bg-indigo-600/30 border-2 border-indigo-505 text-white pulse-target'
                            : activeStyles.gridCell
                        }`}
                        id={`schulte-${cell.id}`}
                        style={{
                          transformOrigin: 'center'
                        }}
                      >
                        {/* Interactive glassy shine reflection */}
                        {!isTapped && (
                          <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        )}
                        <span className="relative z-10">{cell.label}</span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Overlay Game State Screen: Starts game */}
                 {!gameStarted && (
                  <div className={`absolute inset-0 z-20 backdrop-blur-md rounded-3xl flex flex-col justify-center items-center text-center p-6 space-y-4 ${isLight ? 'bg-white/90' : 'bg-slate-950/80'}`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl ${isLight ? 'bg-[#59C749] shadow-[#59C749]/20' : 'bg-indigo-600 shadow-indigo-600/20'}`}>
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
                      className={`px-6 py-3 ${isLight ? 'bg-[#59C749] hover:bg-[#4ab53b]' : 'bg-indigo-600 hover:bg-indigo-500'} text-white font-bold text-sm rounded-xl transition duration-150 flex items-center gap-2 cursor-pointer shadow-lg ${isLight ? 'shadow-[#59C749]/10' : 'shadow-indigo-600/10'}`}
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
                      className={`px-6 py-3 ${isLight ? 'bg-[#59C749] hover:bg-[#4ab53b]' : 'bg-indigo-600 hover:bg-indigo-500'} text-white font-bold text-sm rounded-xl transition duration-150 flex items-center gap-2 cursor-pointer shadow-md ${isLight ? 'shadow-[#59C749]/10' : 'shadow-indigo-600/10'}`}
                      id="game-resume-trigger"
                    >
                      <Play className="fill-white w-4 h-4 text-white" /> Resume Focus
                    </button>
                  </div>
                )}
              </div>

              {/* In-Game Action Menus scaled down to match visual rhythm */}
              <div className="w-full max-w-md flex flex-wrap sm:flex-nowrap gap-2 justify-center mt-4">
                {gameRunning ? (
                  <motion.button
                    onClick={pauseActiveSession}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex-1 h-9 px-3.5 rounded-xl font-extrabold text-[11px] uppercase tracking-wide flex items-center justify-center gap-1.5 transition cursor-pointer ${activeStyles.btnSecondary}`}
                    id="game-pause-mid"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </motion.button>
                ) : (
                  gameStarted && (
                    <motion.button
                      onClick={resumeActiveSession}
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex-1 h-9 px-3.5 rounded-xl font-extrabold text-[11px] uppercase tracking-wide flex items-center justify-center gap-1.5 transition cursor-pointer ${activeStyles.btnAccent}`}
                      id="game-resume-mid"
                    >
                      <Play className="fill-white w-3.5 h-3.5 text-white" /> Continue
                    </motion.button>
                  )
                )}

                <motion.button
                  onClick={triggerTargetVisualPulse}
                  disabled={!gameRunning}
                  whileHover={gameRunning ? { scale: 1.02, y: -1 } : {}}
                  whileTap={gameRunning ? { scale: 0.98 } : {}}
                  className={`flex-1 h-9 px-3 text-[11px] uppercase tracking-wide rounded-xl font-extrabold border flex items-center justify-center gap-1.5 ${
                    gameRunning 
                      ? isLight
                        ? 'bg-white border-slate-250 text-[#4ab53b] hover:bg-slate-100 cursor-pointer shadow-sm'
                        : 'bg-slate-905 border-slate-800 text-indigo-400 hover:bg-slate-850 cursor-pointer'
                      : isLight
                        ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed opacity-55'
                        : 'bg-slate-950 border-slate-900 text-slate-655 cursor-not-allowed opacity-55'
                  }`}
                  title="Flash current target position"
                  id="game-pulse-hint"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isLight ? 'text-[#59C749]' : 'text-[#88c0d0]'}`} /> Hint
                </motion.button>

                <motion.button
                  onClick={() => { if (gameStarted && !confirm("Are you sure you want to reset this board? Your current progress will be lost.")) { return; } startNewRound(); }}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex-1 h-9 px-3.5 rounded-xl font-extrabold text-[11px] uppercase tracking-wide transition flex items-center justify-center gap-1.5 cursor-pointer ${activeStyles.btnSecondary}`}
                  title="Reinitialize the current board"
                  id="game-reset-mid"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </motion.button>

                <motion.button
                  onClick={quitActiveRound}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="h-9 px-3.5 rounded-xl font-extrabold text-[11px] uppercase tracking-wide border border-rose-500/25 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 transition cursor-pointer"
                  id="game-quit-mid"
                >
                  Quit
                </motion.button>
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
                  <span className={`text-2xl font-black font-mono ${isLight ? 'text-[#59C749]' : 'text-indigo-400'}`}>
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
                                className={`w-full ${isLight ? 'group-hover:bg-[#4ab53b] bg-[#59C749]/70' : 'group-hover:bg-indigo-400 bg-indigo-500/50'} transition-all ease-out rounded-t-md`}
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
                <motion.button
                  onClick={startNewRound}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className={`flex-1 py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-3 transition cursor-pointer group ${activeStyles.btnAccent}`}
                  id="results-play-again"
                >
                  <RotateCcw className="w-5 h-5 text-white transition-transform duration-500 group-hover:rotate-180" /> Start Focus Refresher
                </motion.button>
                <motion.button
                  onClick={() => setCurrentScreen('home')}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className={`py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${activeStyles.btnSecondary}`}
                  id="results-dashboard-nav"
                >
                  Return Dashboard
                </motion.button>
                <motion.button
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
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className={`py-4 px-4 rounded-xl border ${isLight ? 'border-slate-200 hover:bg-slate-50 text-slate-650' : 'border-slate-805 text-slate-350 hover:bg-slate-850'} font-semibold cursor-pointer flex items-center justify-center gap-2`}
                  title="Copy scoring to clipboard"
                >
                  <Share2 className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-slate-400'}`} /> Share Focus
                </motion.button>
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
                    <HistoryIcon className={`w-7 h-7 ${isLight ? 'text-[#59C749]' : 'text-[#88c0d0]'}`} /> Historic Logs
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
                    <svg className={`w-full h-full ${isLight ? 'text-[#59C749]' : 'text-indigo-505'}`} viewBox="0 0 100 30" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={isLight ? "#59C749" : "#6366f1"} stopOpacity="0.4" />
                          <stop offset="100%" stopColor={isLight ? "#59C749" : "#6366f1"} stopOpacity="0" />
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
                            <path d={pathStr} fill="none" stroke={isLight ? "#59C749" : "#6366f1"} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
                            {/* Dots */}
                            {coordinates.map((p, i) => (
                              <circle key={i} cx={p.x} cy={p.y} r="0.6" fill={isLight ? '#59C749' : '#fff'} stroke={isLight ? '#59C749' : '#6366f1'} strokeWidth="0.3" className="cursor-pointer group-hover:scale-150 transition" />
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
                        className={`${activeStyles.card} p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#59C749]/25 hover:shadow-md transition-all duration-300`}
                      >
                        <div className="flex items-center gap-3.5 text-left">
                          <div className={`w-11 h-11 rounded-1.5xl ${isLight ? 'bg-[#59C749]/10 border-[#59C749]/20 text-[#4ab53b]' : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'} border flex flex-col justify-center items-center`}>
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
                    <Sliders className={`w-7 h-7 ${isLight ? 'text-[#59C749]' : 'text-indigo-400'}`} /> General Preferences
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
                  <label className={`text-xs font-bold uppercase tracking-wider block ${isLight ? 'text-slate-700' : 'text-slate-355'}`}>
                    Matrix Grid Size
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(['3x3', '4x4', '5x5', '6x6'] as GameDifficulty[]).map((size) => (
                      <button
                        key={size}
                        onClick={() => saveSettingsUpdate({ ...settings, gridSize: size })}
                        className={`py-3 px-2 rounded-2xl font-bold text-center border capitalize transition cursor-pointer ${
                          settings.gridSize === size
                            ? isLight
                              ? 'bg-[#59C749] border-[#59C749] text-white shadow-md'
                              : 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
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
                            ? isLight
                              ? 'bg-[#59C749] border-[#59C749] text-white shadow-md'
                              : 'bg-indigo-600 border-indigo-550 text-white'
                            : isLight
                            ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-705'
                            : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-400'
                        }`}
                      >
                        <div>
                          <span className="block text-sm font-bold capitalize">
                            {mode === 'reverse' ? 'Reverse Order Sequencer' : mode + ' Sequence'}
                          </span>
                          <span className={`text-[10px] block mt-0.5 opacity-90 ${activeStyles.textMuted}`}>
                            {mode === 'number' && 'Ascending values: 1, 2, 3, 4, 5...'}
                            {mode === 'letter' && 'Alphabetical sequence: A-Z, then AA-AL for larger matrices'}
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
                            ? isLight
                              ? 'bg-[#59C749] border-[#59C749] text-white shadow-md'
                              : 'bg-indigo-600 border-indigo-500 text-white'
                            : isLight
                            ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                            : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-400'
                        }`}
                      >
                        {th === 'slate' && 'Slate Space'}
                        {th === 'nord' && 'Nord Frost (Experimental)'}
                        {th === 'cyber' && 'Cyber Neon'}
                        {th === 'lavender' && 'Regal Violet'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Peripheral Sound and Vibration feedback toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Sound Toggle */}
                  <div className={`flex items-center justify-between p-5 border rounded-2xl gap-4 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border border-slate-850'}`}>
                    <div className="text-left space-y-1 flex-1 min-w-0">
                      <span className={`text-sm font-bold block leading-tight ${activeStyles.textTitle}`}>Auditory Clicks</span>
                      <p className={`text-[11px] leading-normal ${activeStyles.textMuted}`}>
                        Focal synthesizer sounds confirming selection legality.
                      </p>
                    </div>
                    <button
                      onClick={() => saveSettingsUpdate({ ...settings, soundEnabled: !settings.soundEnabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        settings.soundEnabled 
                          ? isLight
                            ? 'bg-[#59C749]'
                            : 'bg-indigo-600'
                          : isLight 
                          ? 'bg-slate-200' 
                          : 'bg-slate-800'
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
                  <div className={`flex items-center justify-between p-5 border rounded-2xl gap-4 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border border-slate-850'}`}>
                    <div className="text-left space-y-1 flex-1 min-w-0">
                      <span className={`text-sm font-bold block leading-tight ${activeStyles.textTitle}`}>Saccadic Vibration</span>
                      <p className={`text-[11px] leading-normal ${activeStyles.textMuted}`}>
                        Tactile haptic triggers reacting specifically on error.
                      </p>
                    </div>
                    <button
                      onClick={() => saveSettingsUpdate({ ...settings, vibrationEnabled: !settings.vibrationEnabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                        settings.vibrationEnabled 
                          ? isLight
                            ? 'bg-[#59C749]'
                            : 'bg-indigo-600'
                          : isLight 
                          ? 'bg-slate-200' 
                          : 'bg-slate-800'
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
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold mx-auto shadow-md ${isLight ? 'bg-[#59C749]' : 'bg-indigo-600'}`}>
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
                          ? 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-[#59C749]' 
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
                        ? 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-[#59C749]' 
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
                        ? 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-[#59C749]' 
                        : 'bg-slate-950 border-slate-850 text-white placeholder-slate-600 focus:ring-indigo-650'
                    }`}
                  />
                </div>

                {/* Actions Button */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className={`w-full py-4 ${isLight ? 'bg-[#59C749] hover:bg-[#4ab53b]' : 'bg-indigo-600 hover:bg-indigo-500'} disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-2 font-semibold`}
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
                  className={`text-xs font-semibold ${isLight ? 'text-[#59C749] hover:underline hover:text-[#4ab53b]' : 'text-indigo-400 hover:underline hover:text-indigo-350'}`}
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
            <button onClick={() => showToast("Schulte Tables help expand effective reading fields using standard visual diagnostics.", "info")} className={`hover:underline transition ${isLight ? 'text-slate-600 hover:text-[#59C749]' : 'text-slate-400 hover:text-slate-350'}`}>Clinical Info</button>
            <span>•</span>
            <button onClick={() => showToast("Offline Fallback Mode is operational. Your scores store securely in local browser caches.", "success")} className={`hover:underline transition ${isLight ? 'text-slate-600 hover:text-[#59C749]' : 'text-slate-400 hover:text-slate-350'}`}>System Status</button>
          </div>
        </div>
      </footer>

      {/* Dynamic Worksheet Print Dialog Modal */}
      <AnimatePresence>
        {isPrintModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Background backdrop shadow */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPrintModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />

            {/* Modal Card Box */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className={`relative max-w-md w-full rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl ${activeStyles.card} border ${activeStyles.border} overflow-hidden`}
            >
              <div className="text-center space-y-2">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-md ${isLight ? 'bg-[#59C749] text-white' : 'bg-indigo-650 text-white'}`}>
                  <Printer className="w-6 h-6 text-white" />
                </div>
                <h3 className={`text-2xl font-black uppercase tracking-tight ${activeStyles.textTitle}`}>
                  Worksheet Print Engine
                </h3>
                <p className={`text-xs ${activeStyles.textMuted}`}>
                  Configure and generate print-ready, high-contrast Schulte training worksheets.
                </p>
              </div>

              <div className="space-y-4">
                {/* Quantity picker */}
                <div className="space-y-2">
                  <label className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-650' : 'text-slate-400'}`}>
                    Number of sheets to generate
                  </label>
                  <div className={`flex items-center justify-between p-1.5 border rounded-xl ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-850'}`}>
                    <button
                      type="button"
                      onClick={() => setPrintCount(Math.max(1, printCount - 1))}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${isLight ? 'hover:bg-slate-200 text-slate-800' : 'hover:bg-slate-800 text-slate-205'}`}
                    >
                      -
                    </button>
                    <span className={`text-sm font-extrabold font-mono ${activeStyles.textTitle}`}>
                      {printCount} Worksheet{printCount > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrintCount(Math.min(10, printCount + 1))}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${isLight ? 'hover:bg-slate-200 text-slate-800' : 'hover:bg-slate-800 text-slate-205'}`}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Sizing selection */}
                <div className="space-y-2">
                  <label className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-650' : 'text-slate-400'}`}>
                    Matrix size
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['3x3', '4x4', '5x5', '6x6'] as GameDifficulty[]).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setPrintSize(sz)}
                        className={`py-2 px-1 rounded-xl text-center font-bold text-xs capitalize border transition cursor-pointer ${
                          printSize === sz
                            ? isLight
                              ? 'bg-[#59C749] border-[#59C749] text-white shadow-sm'
                              : 'bg-indigo-600 border-indigo-500 text-white'
                            : isLight
                            ? 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
                            : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-400'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Character Format */}
                <div className="space-y-2">
                  <label className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-650' : 'text-slate-400'}`}>
                    Character Format Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['number', 'letter', 'roman'] as GameMode[]).map((md) => (
                      <button
                        key={md}
                        type="button"
                        onClick={() => setPrintMode(md)}
                        className={`py-2 px-1 rounded-xl text-center font-bold text-xs capitalize border transition cursor-pointer ${
                          printMode === md
                            ? isLight
                              ? 'bg-[#59C749] border-[#59C749] text-white shadow-sm'
                              : 'bg-indigo-600 border-indigo-505 text-white shadow-md'
                            : isLight
                            ? 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
                            : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-400'
                        }`}
                      >
                        {md}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider transition border cursor-pointer border-transparent ${
                    isLight 
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' 
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-250'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintModalOpen(false);
                    handlePrintTrigger();
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider text-white shadow-md transition cursor-pointer ${
                    isLight 
                      ? 'bg-[#59C749] hover:bg-[#4ab53b] shadow-[#59C749]/10' 
                      : 'bg-indigo-650 hover:bg-indigo-550 shadow-indigo-650/10'
                  }`}
                >
                  Generate & Print
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden print layout stylesheet area and grids */}
      <div className="hidden print:block bg-white text-black p-4 min-h-screen font-sans">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="border-b-2 border-black pb-4 text-center">
            <h1 className="text-3xl font-extrabold uppercase tracking-wide">Schulte Focus Training Sheets</h1>
            <p className="text-sm mt-1 text-zinc-650 text-slate-600">
              Validated training diagnostics to expand peripheral field of vision and visual speed.
            </p>
            <p className="text-[10px] mt-1 font-mono uppercase text-zinc-500">
              Format: {printSize} Matrix • Mode: {printMode} • Generated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 pt-4">
            {printSheets.map((sheet, sIdx) => (
              <div key={sIdx} className="border border-black p-6 rounded-2xl flex flex-col items-center justify-center page-break-inside-avoid">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-2 block">
                  Table Matrix #{sIdx + 1}
                </span>
                
                {/* Beautiful black and white matrix with borders */}
                <div 
                  className="grid border-2 border-black" 
                  style={{
                    gridTemplateColumns: `repeat(${sheet.length}, minmax(0, 1fr))`,
                    width: '320px',
                    height: '320px'
                  }}
                >
                  {sheet.flatMap(row => row).map((cell) => (
                    <div 
                      key={cell.id} 
                      className="border border-black flex items-center justify-center font-extrabold text-2xl bg-white text-black h-full w-full select-none"
                    >
                      {cell.label}
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-[10px] text-zinc-500 font-medium">
                  Fixate on the center. Trace cells in ascending order.
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
