/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Medal, Hourglass, ShieldCheck, Zap, ArrowLeft, RefreshCw } from 'lucide-react';
import { GameDifficulty, GameMode } from '../types.js';
import { ApiClient } from '../lib/api.js';

interface LeaderboardEntry {
  userName: string;
  totalTimeMs: number;
  accuracy: number;
  mistakes: number;
  date: string;
}

interface LeaderboardScreenProps {
  onBack: () => void;
  defaultDifficulty: GameDifficulty;
  defaultMode: GameMode;
}

export default function LeaderboardScreen({ onBack, defaultDifficulty, defaultMode }: LeaderboardScreenProps) {
  const [difficulty, setDifficulty] = useState<GameDifficulty>(defaultDifficulty);
  const [mode, setMode] = useState<GameMode>(defaultMode);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      const data = await ApiClient.fetchLeaderboard(difficulty, mode);
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, [difficulty, mode]);

  const formatTime = (ms: number) => {
    return (ms / 1000).toFixed(2) + 's';
  };

  const getDifficultyLabel = (diff: GameDifficulty) => {
    switch (diff) {
      case '3x3': return '3x3 (Beginner)';
      case '4x4': return '4x4 (Standard)';
      case '5x5': return '5x5 (Advanced)';
      case '6x6': return '6x6 (Expert)';
    }
  };

  const getModeLabel = (m: GameMode) => {
    switch (m) {
      case 'number': return 'Numbers (1–N)';
      case 'letter': return 'Letters (A–Z)';
      case 'roman': return 'Roman Numerals (I–XX)';
      case 'reverse': return 'Reverse Number Sequence';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-3 text-sm font-medium transition-colors"
            id="back-from-leaderboard"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-400" /> Focus Leaderboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Comparing fastest complete mind runs across global trainers.
          </p>
        </div>

        <button
          onClick={fetchRankings}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
          aria-label="Refresh items"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Selectors and Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Difficulty */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Matrix Grid Size
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['3x3', '4x4', '5x5', '6x6'] as GameDifficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`py-2 rounded-lg text-sm font-semibold transition ${
                  difficulty === d
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Game Mode */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Sequence Style
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['number', 'letter', 'roman', 'reverse'] as GameMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`py-2 px-1 rounded-lg text-xs font-semibold capitalize truncate transition ${
                  mode === m
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title={getModeLabel(m)}
              >
                {m === 'roman' ? 'Roman' : m === 'reverse' ? 'Reverse' : m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-slate-950/80 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-400" /> Currently displaying: {getDifficultyLabel(difficulty)} • {getModeLabel(mode)}
          </span>
          <span className="text-xs text-slate-500">
            {entries.length} records available
          </span>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col justify-center items-center text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
            <p className="text-sm">Retrieving global table times...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-24 text-center px-6">
            <Medal className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-1">No completed training runs</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Be the first to complete a session of {getDifficultyLabel(difficulty)} in {getModeLabel(mode)} to write your name on the board!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="py-4 px-6 text-center w-16">Rank</th>
                  <th className="py-4 px-6">Trainer Name</th>
                  <th className="py-4 px-6">Completion Time</th>
                  <th className="py-4 px-6 text-right">Accuracy</th>
                  <th className="py-4 px-6 text-right hidden sm:table-cell">Mistakes</th>
                  <th className="py-4 px-6 text-right hidden md:table-cell">Date Trained</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {entries.map((entry, idx) => {
                  const rank = idx + 1;
                  const isGold = rank === 1;
                  const isSilver = rank === 2;
                  const isBronze = rank === 3;

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-850/30 transition-colors ${
                        rank <= 3 ? 'bg-indigo-500/[0.02]' : ''
                      }`}
                    >
                      <td className="py-4 px-6 text-center font-mono font-bold">
                        {rank === 1 ? (
                          <div className="inline-flex items-center justify-center w-7 h-7 bg-amber-400 text-amber-955 rounded-full ring-4 ring-amber-400/20 shadow-md">
                            1
                          </div>
                        ) : rank === 2 ? (
                          <div className="inline-flex items-center justify-center w-7 h-7 bg-slate-300 text-slate-800 rounded-full ring-4 ring-slate-300/20 shadow-md">
                            2
                          </div>
                        ) : rank === 3 ? (
                          <div className="inline-flex items-center justify-center w-7 h-7 bg-orange-400 text-orange-950 rounded-full ring-4 ring-orange-400/20 shadow-md">
                            3
                          </div>
                        ) : (
                          <span className="text-slate-400">{rank}</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-white font-medium flex items-center gap-2">
                          {entry.userName}
                          {rank === 1 && <Medal className="w-4 h-4 text-amber-400" />}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-indigo-300 font-mono font-bold">
                        {formatTime(entry.totalTimeMs)}
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-semibold text-emerald-400">
                        {entry.accuracy}%
                      </td>
                      <td className="py-4 px-6 text-right font-mono text-slate-400 hidden sm:table-cell">
                        {entry.mistakes}
                      </td>
                      <td className="py-4 px-6 text-right text-xs text-slate-500 hidden md:table-cell font-mono">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
