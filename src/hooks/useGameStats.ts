import { useState, useEffect, useCallback } from 'react';

export interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  totalScore: number;
  highScore: number;
  totalPlayTime: number; // in seconds
  lastPlayed: string;
  streaks: {
    current: number;
    best: number;
  };
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
}

const STATS_KEY = 'mindgames-detailed-stats';
const ACHIEVEMENTS_KEY = 'mindgames-achievements';
const SESSION_START_KEY = 'mindgames-session-start';

const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'unlockedAt' | 'progress'>[] = [
  { id: 'first_win', name: 'First Victory', description: 'Win your first game', icon: '🏆', maxProgress: 1 },
  { id: 'ten_games', name: 'Getting Started', description: 'Play 10 games', icon: '🎮', maxProgress: 10 },
  { id: 'fifty_games', name: 'Dedicated Player', description: 'Play 50 games', icon: '🎯', maxProgress: 50 },
  { id: 'hundred_games', name: 'Game Master', description: 'Play 100 games', icon: '👑', maxProgress: 100 },
  { id: 'win_streak_3', name: 'On Fire', description: 'Win 3 games in a row', icon: '🔥', maxProgress: 3 },
  { id: 'win_streak_5', name: 'Unstoppable', description: 'Win 5 games in a row', icon: '⚡', maxProgress: 5 },
  { id: 'win_streak_10', name: 'Legend', description: 'Win 10 games in a row', icon: '🌟', maxProgress: 10 },
  { id: 'hour_played', name: 'Time Flies', description: 'Play for 1 hour total', icon: '⏰', maxProgress: 3600 },
  { id: 'five_hours', name: 'Marathon Gamer', description: 'Play for 5 hours total', icon: '🕐', maxProgress: 18000 },
  { id: 'score_1000', name: 'Point Collector', description: 'Accumulate 1,000 total points', icon: '💎', maxProgress: 1000 },
  { id: 'score_10000', name: 'Score Hunter', description: 'Accumulate 10,000 total points', icon: '💰', maxProgress: 10000 },
  { id: 'perfect_reaction', name: 'Lightning Reflexes', description: 'Get under 200ms in Reaction Time', icon: '⚡', maxProgress: 1 },
  { id: 'math_wizard', name: 'Math Wizard', description: 'Score 50+ in Math Challenge', icon: '🧮', maxProgress: 1 },
  { id: 'memory_master', name: 'Memory Master', description: 'Complete Pattern Memory level 10', icon: '🧠', maxProgress: 1 },
  { id: 'all_games', name: 'Explorer', description: 'Play all available games', icon: '🗺️', maxProgress: 12 },
];

export const useGameStats = () => {
  const [stats, setStats] = useState<Record<string, GameStats>>({});
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [sessionStart, setSessionStart] = useState<number>(Date.now());

  // Load data on mount
  useEffect(() => {
    const savedStats = localStorage.getItem(STATS_KEY);
    const savedAchievements = localStorage.getItem(ACHIEVEMENTS_KEY);
    const savedSessionStart = localStorage.getItem(SESSION_START_KEY);

    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (e) {
        console.error('Failed to parse stats');
      }
    }

    if (savedAchievements) {
      try {
        setAchievements(JSON.parse(savedAchievements));
      } catch (e) {
        console.error('Failed to parse achievements');
      }
    } else {
      // Initialize achievements
      setAchievements(ACHIEVEMENT_DEFINITIONS.map(a => ({ ...a, progress: 0 })));
    }

    if (savedSessionStart) {
      setSessionStart(parseInt(savedSessionStart));
    } else {
      const now = Date.now();
      setSessionStart(now);
      localStorage.setItem(SESSION_START_KEY, now.toString());
    }
  }, []);

  // Save stats
  const saveStats = useCallback((newStats: Record<string, GameStats>) => {
    localStorage.setItem(STATS_KEY, JSON.stringify(newStats));
    setStats(newStats);
  }, []);

  // Save achievements
  const saveAchievements = useCallback((newAchievements: Achievement[]) => {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(newAchievements));
    setAchievements(newAchievements);
  }, []);

  // Check and unlock achievements
  const checkAchievements = useCallback((
    totalGames: number,
    totalScore: number,
    totalPlayTime: number,
    currentStreak: number,
    gamesPlayed: Set<string>,
    specialConditions?: { reactionTime?: number; mathScore?: number; patternLevel?: number }
  ) => {
    const updated = [...achievements];
    let changed = false;

    updated.forEach((achievement, index) => {
      if (achievement.unlockedAt) return;

      let progress = achievement.progress || 0;
      let shouldUnlock = false;

      switch (achievement.id) {
        case 'first_win':
          if (totalGames > 0) shouldUnlock = true;
          break;
        case 'ten_games':
          progress = Math.min(totalGames, 10);
          if (totalGames >= 10) shouldUnlock = true;
          break;
        case 'fifty_games':
          progress = Math.min(totalGames, 50);
          if (totalGames >= 50) shouldUnlock = true;
          break;
        case 'hundred_games':
          progress = Math.min(totalGames, 100);
          if (totalGames >= 100) shouldUnlock = true;
          break;
        case 'win_streak_3':
          progress = Math.min(currentStreak, 3);
          if (currentStreak >= 3) shouldUnlock = true;
          break;
        case 'win_streak_5':
          progress = Math.min(currentStreak, 5);
          if (currentStreak >= 5) shouldUnlock = true;
          break;
        case 'win_streak_10':
          progress = Math.min(currentStreak, 10);
          if (currentStreak >= 10) shouldUnlock = true;
          break;
        case 'hour_played':
          progress = Math.min(totalPlayTime, 3600);
          if (totalPlayTime >= 3600) shouldUnlock = true;
          break;
        case 'five_hours':
          progress = Math.min(totalPlayTime, 18000);
          if (totalPlayTime >= 18000) shouldUnlock = true;
          break;
        case 'score_1000':
          progress = Math.min(totalScore, 1000);
          if (totalScore >= 1000) shouldUnlock = true;
          break;
        case 'score_10000':
          progress = Math.min(totalScore, 10000);
          if (totalScore >= 10000) shouldUnlock = true;
          break;
        case 'perfect_reaction':
          if (specialConditions?.reactionTime && specialConditions.reactionTime < 200) {
            shouldUnlock = true;
            progress = 1;
          }
          break;
        case 'math_wizard':
          if (specialConditions?.mathScore && specialConditions.mathScore >= 50) {
            shouldUnlock = true;
            progress = 1;
          }
          break;
        case 'memory_master':
          if (specialConditions?.patternLevel && specialConditions.patternLevel >= 10) {
            shouldUnlock = true;
            progress = 1;
          }
          break;
        case 'all_games':
          progress = gamesPlayed.size;
          if (gamesPlayed.size >= 12) shouldUnlock = true;
          break;
      }

      if (progress !== achievement.progress || shouldUnlock) {
        changed = true;
        updated[index] = {
          ...achievement,
          progress,
          unlockedAt: shouldUnlock ? new Date().toISOString() : undefined
        };
      }
    });

    if (changed) {
      saveAchievements(updated);
    }

    return updated.filter(a => a.unlockedAt && !achievements.find(old => old.id === a.id && old.unlockedAt));
  }, [achievements, saveAchievements]);

  // Record game result
  const recordGame = useCallback((
    gameType: string,
    result: 'win' | 'loss' | 'draw',
    score: number,
    playTime: number,
    specialConditions?: { reactionTime?: number; mathScore?: number; patternLevel?: number }
  ) => {
    const currentStats = stats[gameType] || {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      totalScore: 0,
      highScore: 0,
      totalPlayTime: 0,
      lastPlayed: '',
      streaks: { current: 0, best: 0 }
    };

    const newStreak = result === 'win' 
      ? currentStats.streaks.current + 1 
      : 0;

    const updatedStats: GameStats = {
      gamesPlayed: currentStats.gamesPlayed + 1,
      wins: currentStats.wins + (result === 'win' ? 1 : 0),
      losses: currentStats.losses + (result === 'loss' ? 1 : 0),
      draws: currentStats.draws + (result === 'draw' ? 1 : 0),
      totalScore: currentStats.totalScore + score,
      highScore: Math.max(currentStats.highScore, score),
      totalPlayTime: currentStats.totalPlayTime + playTime,
      lastPlayed: new Date().toISOString(),
      streaks: {
        current: newStreak,
        best: Math.max(currentStats.streaks.best, newStreak)
      }
    };

    const newStats = { ...stats, [gameType]: updatedStats };
    saveStats(newStats);

    // Calculate totals for achievements
    const totalGames = Object.values(newStats).reduce((sum, s) => sum + s.gamesPlayed, 0);
    const totalScore = Object.values(newStats).reduce((sum, s) => sum + s.totalScore, 0);
    const totalPlayTime = Object.values(newStats).reduce((sum, s) => sum + s.totalPlayTime, 0);
    const maxStreak = Math.max(...Object.values(newStats).map(s => s.streaks.best));
    const gamesPlayed = new Set(Object.keys(newStats));

    const newAchievements = checkAchievements(
      totalGames,
      totalScore,
      totalPlayTime,
      maxStreak,
      gamesPlayed,
      specialConditions
    );

    return { updatedStats, newAchievements };
  }, [stats, saveStats, checkAchievements]);

  // Get overall stats
  const getOverallStats = useCallback(() => {
    const allStats = Object.values(stats);
    return {
      totalGames: allStats.reduce((sum, s) => sum + s.gamesPlayed, 0),
      totalWins: allStats.reduce((sum, s) => sum + s.wins, 0),
      totalLosses: allStats.reduce((sum, s) => sum + s.losses, 0),
      totalDraws: allStats.reduce((sum, s) => sum + s.draws, 0),
      totalScore: allStats.reduce((sum, s) => sum + s.totalScore, 0),
      totalPlayTime: allStats.reduce((sum, s) => sum + s.totalPlayTime, 0),
      overallWinRate: allStats.reduce((sum, s) => sum + s.gamesPlayed, 0) > 0
        ? (allStats.reduce((sum, s) => sum + s.wins, 0) / allStats.reduce((sum, s) => sum + s.gamesPlayed, 0)) * 100
        : 0,
      bestStreak: Math.max(0, ...allStats.map(s => s.streaks.best)),
      gamesPlayedCount: Object.keys(stats).length
    };
  }, [stats]);

  // Format play time
  const formatPlayTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }, []);

  // Get win rate for a game
  const getWinRate = useCallback((gameType: string) => {
    const gameStats = stats[gameType];
    if (!gameStats || gameStats.gamesPlayed === 0) return 0;
    return (gameStats.wins / gameStats.gamesPlayed) * 100;
  }, [stats]);

  // Clear all data
  const clearAll = useCallback(() => {
    localStorage.removeItem(STATS_KEY);
    localStorage.removeItem(ACHIEVEMENTS_KEY);
    setStats({});
    setAchievements(ACHIEVEMENT_DEFINITIONS.map(a => ({ ...a, progress: 0 })));
  }, []);

  return {
    stats,
    achievements,
    recordGame,
    getOverallStats,
    getWinRate,
    formatPlayTime,
    clearAll
  };
};
