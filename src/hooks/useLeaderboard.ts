import { useState, useEffect, useCallback } from 'react';

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  date: string;
  details?: string;
}

export interface GameStats {
  gamesPlayed: number;
  totalScore: number;
  highScore: number;
  lastPlayed: string;
}

const STORAGE_KEY = 'mindgames-leaderboard';
const STATS_KEY = 'mindgames-stats';
const MAX_ENTRIES_PER_GAME = 10;

export const useLeaderboard = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<Record<string, GameStats>>({});

  // Load data from localStorage on mount
  useEffect(() => {
    const savedEntries = localStorage.getItem(STORAGE_KEY);
    const savedStats = localStorage.getItem(STATS_KEY);
    
    if (savedEntries) {
      try {
        setEntries(JSON.parse(savedEntries));
      } catch (e) {
        console.error('Failed to parse leaderboard data');
      }
    }
    
    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (e) {
        console.error('Failed to parse stats data');
      }
    }
  }, []);

  // Save entries to localStorage
  const saveEntries = useCallback((newEntries: LeaderboardEntry[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
    setEntries(newEntries);
  }, []);

  // Save stats to localStorage
  const saveStats = useCallback((newStats: Record<string, GameStats>) => {
    localStorage.setItem(STATS_KEY, JSON.stringify(newStats));
    setStats(newStats);
  }, []);

  // Add a new score
  const addScore = useCallback((
    gameType: string,
    playerName: string,
    score: number,
    details?: string
  ) => {
    const entry: LeaderboardEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      playerName: playerName || 'Anonymous',
      score,
      gameType,
      date: new Date().toISOString(),
      details
    };

    // Update entries
    const gameEntries = entries.filter(e => e.gameType === gameType);
    const otherEntries = entries.filter(e => e.gameType !== gameType);
    
    const updatedGameEntries = [...gameEntries, entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES_PER_GAME);
    
    saveEntries([...otherEntries, ...updatedGameEntries]);

    // Update stats
    const currentStats = stats[gameType] || {
      gamesPlayed: 0,
      totalScore: 0,
      highScore: 0,
      lastPlayed: ''
    };

    const updatedStats = {
      ...stats,
      [gameType]: {
        gamesPlayed: currentStats.gamesPlayed + 1,
        totalScore: currentStats.totalScore + score,
        highScore: Math.max(currentStats.highScore, score),
        lastPlayed: new Date().toISOString()
      }
    };

    saveStats(updatedStats);

    return entry;
  }, [entries, stats, saveEntries, saveStats]);

  // Get top scores for a specific game
  const getTopScores = useCallback((gameType: string, limit: number = 5) => {
    return entries
      .filter(e => e.gameType === gameType)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }, [entries]);

  // Get all-time top scores across all games
  const getAllTimeTop = useCallback((limit: number = 10) => {
    return entries
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }, [entries]);

  // Get stats for a specific game
  const getGameStats = useCallback((gameType: string): GameStats | null => {
    return stats[gameType] || null;
  }, [stats]);

  // Clear all data
  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STATS_KEY);
    setEntries([]);
    setStats({});
  }, []);

  // Check if score is a new high score
  const isNewHighScore = useCallback((gameType: string, score: number) => {
    const gameStats = stats[gameType];
    if (!gameStats) return score > 0;
    return score > gameStats.highScore;
  }, [stats]);

  return {
    entries,
    stats,
    addScore,
    getTopScores,
    getAllTimeTop,
    getGameStats,
    clearAll,
    isNewHighScore
  };
};

// Game type constants
export const GAME_TYPES = {
  TICTACTOE: 'tictactoe',
  MATH_CHALLENGE: 'math-challenge',
  MATH_BATTLE: 'math-battle',
  MEMORY_MATCH: 'memory-match',
  NUMBER_GUESS: 'number-guess',
  REACTION_TIME: 'reaction-time',
  PATTERN_MEMORY: 'pattern-memory',
  COLOR_MATCH: 'color-match',
  DRAWING_GAME: 'drawing-game',
  TRUTH_OR_DARE: 'truth-or-dare',
  WORD_CHAIN: 'word-chain',
  QUIZ_BATTLE: 'quiz-battle',
  WORD_SCRAMBLE: 'word-scramble',
  TYPING_SPEED: 'typing-speed',
  AIM_TRAINER: 'aim-trainer'
} as const;

export const GAME_NAMES: Record<string, string> = {
  [GAME_TYPES.TICTACTOE]: 'Tic Tac Toe',
  [GAME_TYPES.MATH_CHALLENGE]: 'Math Challenge',
  [GAME_TYPES.MATH_BATTLE]: 'Math Battle',
  [GAME_TYPES.MEMORY_MATCH]: 'Memory Match',
  [GAME_TYPES.NUMBER_GUESS]: 'Number Guess',
  [GAME_TYPES.REACTION_TIME]: 'Reaction Time',
  [GAME_TYPES.PATTERN_MEMORY]: 'Pattern Memory',
  [GAME_TYPES.COLOR_MATCH]: 'Color Match',
  [GAME_TYPES.DRAWING_GAME]: 'Drawing Game',
  [GAME_TYPES.TRUTH_OR_DARE]: 'Truth or Dare',
  [GAME_TYPES.WORD_CHAIN]: 'Word Chain',
  [GAME_TYPES.QUIZ_BATTLE]: 'Quiz Battle',
  [GAME_TYPES.WORD_SCRAMBLE]: 'Word Scramble',
  [GAME_TYPES.TYPING_SPEED]: 'Typing Speed',
  [GAME_TYPES.AIM_TRAINER]: 'Aim Trainer'
};
