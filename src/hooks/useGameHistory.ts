import { useState, useEffect, useCallback } from 'react';

export interface GameHistoryEntry {
  id: string;
  gameType: string;
  gameMode: 'single' | 'multiplayer';
  result: 'win' | 'loss' | 'draw' | 'incomplete';
  score: number;
  duration: number;
  moves?: number;
  opponentName?: string;
  roomCode?: string;
  timestamp: number;
  replayData?: any; // Game-specific replay data
}

const HISTORY_STORAGE_KEY = 'mindgames-game-history';
const MAX_HISTORY_ENTRIES = 50;

export const useGameHistory = () => {
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setHistory(parsed);
      } catch (e) {
        console.error('Failed to parse game history');
      }
    }
  }, []);

  const addGameHistory = useCallback((entry: Omit<GameHistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: GameHistoryEntry = {
      ...entry,
      id: `game-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    };

    setHistory(prev => {
      const updated = [newEntry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    return newEntry.id;
  }, []);

  const getGameHistory = useCallback((gameType?: string, limit?: number) => {
    let filtered = gameType
      ? history.filter(h => h.gameType === gameType)
      : history;

    if (limit) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }, [history]);

  const getBestGame = useCallback((gameType?: string) => {
    const games = gameType
      ? history.filter(h => h.gameType === gameType)
      : history;

    if (games.length === 0) return null;

    return games.reduce((best, current) => {
      if (current.score > best.score) return current;
      if (current.score === best.score && current.result === 'win' && best.result !== 'win') return current;
      return best;
    });
  }, [history]);

  const getRecentGames = useCallback((limit: number = 10) => {
    return history.slice(0, limit);
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }, []);

  const getStats = useCallback(() => {
    const totalGames = history.length;
    const wins = history.filter(h => h.result === 'win').length;
    const losses = history.filter(h => h.result === 'loss').length;
    const draws = history.filter(h => h.result === 'draw').length;
    const totalScore = history.reduce((sum, h) => sum + h.score, 0);
    const totalDuration = history.reduce((sum, h) => sum + h.duration, 0);
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

    return {
      totalGames,
      wins,
      losses,
      draws,
      totalScore,
      totalDuration,
      winRate,
    };
  }, [history]);

  return {
    history,
    addGameHistory,
    getGameHistory,
    getBestGame,
    getRecentGames,
    clearHistory,
    getStats,
  };
};
