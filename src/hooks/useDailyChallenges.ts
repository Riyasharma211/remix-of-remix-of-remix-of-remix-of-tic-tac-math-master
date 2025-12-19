import { useState, useEffect, useCallback } from 'react';

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  type: 'win' | 'score' | 'play' | 'streak' | 'time';
  gameType?: string;
  target: number;
  reward: number;
  progress: number;
  completed: boolean;
  completedAt?: number;
  icon: string;
}

export interface WeeklyQuest extends DailyChallenge {
  weekNumber: number;
  daysRemaining: number;
}

const CHALLENGES_STORAGE_KEY = 'mindgames-daily-challenges';
const QUESTS_STORAGE_KEY = 'mindgames-weekly-quests';
const LAST_RESET_KEY = 'mindgames-challenges-reset';

// Generate daily challenges based on date
const generateDailyChallenges = (): DailyChallenge[] => {
  const date = new Date();
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  
  const challenges: DailyChallenge[] = [
    {
      id: 'daily-win-3',
      title: 'Triple Victory',
      description: 'Win 3 multiplayer games',
      type: 'win',
      target: 3,
      reward: 50,
      progress: 0,
      completed: false,
      icon: '🏆',
    },
    {
      id: 'daily-score-100',
      title: 'Century Club',
      description: 'Score 100+ points in any game',
      type: 'score',
      target: 100,
      reward: 30,
      progress: 0,
      completed: false,
      icon: '💯',
    },
    {
      id: 'daily-play-5',
      title: 'Game Marathon',
      description: 'Play 5 different games',
      type: 'play',
      target: 5,
      reward: 40,
      progress: 0,
      completed: false,
      icon: '🎮',
    },
  ];

  // Rotate challenges based on day
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Weekend special
    challenges.push({
      id: 'weekend-streak',
      title: 'Weekend Warrior',
      description: 'Win 2 games in a row',
      type: 'streak',
      target: 2,
      reward: 60,
      progress: 0,
      completed: false,
      icon: '🔥',
    });
  } else {
    // Weekday challenge
    const gameTypes = ['tictactoe', 'mathbattle', 'drawing', 'wordchain', 'quizbattle'];
    const gameType = gameTypes[dayOfWeek % gameTypes.length];
    challenges.push({
      id: `daily-${gameType}`,
      title: `${gameType.charAt(0).toUpperCase() + gameType.slice(1)} Master`,
      description: `Play 2 ${gameType} games`,
      type: 'play',
      gameType,
      target: 2,
      reward: 35,
      progress: 0,
      completed: false,
      icon: '⭐',
    });
  }

  return challenges;
};

// Generate weekly quest
const generateWeeklyQuest = (): WeeklyQuest => {
  const date = new Date();
  const weekNumber = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
  const dayOfWeek = date.getDay();
  const daysRemaining = 7 - dayOfWeek;

  const questTypes = [
    {
      title: 'Elite Player',
      description: 'Win 10 multiplayer games this week',
      type: 'win' as const,
      target: 10,
      reward: 200,
      icon: '👑',
    },
    {
      title: 'Score Hunter',
      description: 'Accumulate 1000 points this week',
      type: 'score' as const,
      target: 1000,
      reward: 250,
      icon: '💰',
    },
    {
      title: 'Explorer',
      description: 'Play all 10 multiplayer games this week',
      type: 'play' as const,
      target: 10,
      reward: 300,
      icon: '🗺️',
    },
  ];

  const quest = questTypes[weekNumber % questTypes.length];

  return {
    ...quest,
    id: `weekly-${weekNumber}`,
    weekNumber,
    daysRemaining,
    progress: 0,
    completed: false,
  };
};

const shouldResetChallenges = (): boolean => {
  const lastReset = localStorage.getItem(LAST_RESET_KEY);
  if (!lastReset) return true;

  const lastResetDate = new Date(parseInt(lastReset));
  const today = new Date();
  
  // Reset if it's a new day
  return (
    today.getDate() !== lastResetDate.getDate() ||
    today.getMonth() !== lastResetDate.getMonth() ||
    today.getFullYear() !== lastResetDate.getFullYear()
  );
};

export const useDailyChallenges = () => {
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [weeklyQuest, setWeeklyQuest] = useState<WeeklyQuest | null>(null);
  const [streak, setStreak] = useState(0);
  const [totalRewards, setTotalRewards] = useState(0);

  // Initialize challenges
  useEffect(() => {
    if (shouldResetChallenges()) {
      const newChallenges = generateDailyChallenges();
      const newQuest = generateWeeklyQuest();
      
      localStorage.setItem(CHALLENGES_STORAGE_KEY, JSON.stringify(newChallenges));
      localStorage.setItem(QUESTS_STORAGE_KEY, JSON.stringify(newQuest));
      localStorage.setItem(LAST_RESET_KEY, Date.now().toString());
      
      setChallenges(newChallenges);
      setWeeklyQuest(newQuest);
    } else {
      const saved = localStorage.getItem(CHALLENGES_STORAGE_KEY);
      const savedQuest = localStorage.getItem(QUESTS_STORAGE_KEY);
      const savedStreak = localStorage.getItem('mindgames-challenge-streak');
      const savedRewards = localStorage.getItem('mindgames-total-rewards');

      if (saved) {
        try {
          setChallenges(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse challenges');
        }
      }

      if (savedQuest) {
        try {
          setWeeklyQuest(JSON.parse(savedQuest));
        } catch (e) {
          console.error('Failed to parse weekly quest');
        }
      }

      if (savedStreak) {
        setStreak(parseInt(savedStreak));
      }

      if (savedRewards) {
        setTotalRewards(parseInt(savedRewards));
      }
    }
  }, []);

  const updateChallengeProgress = useCallback((
    type: DailyChallenge['type'],
    gameType?: string,
    value: number = 1
  ) => {
    setChallenges(prev => {
      const updated = prev.map(challenge => {
        if (challenge.completed) return challenge;
        if (challenge.type !== type) return challenge;
        if (challenge.gameType && challenge.gameType !== gameType) return challenge;

        const newProgress = challenge.progress + value;
        const completed = newProgress >= challenge.target;

        if (completed && !challenge.completedAt) {
          // Challenge completed!
          const newRewards = totalRewards + challenge.reward;
          setTotalRewards(newRewards);
          localStorage.setItem('mindgames-total-rewards', newRewards.toString());

          // Update streak
          const newStreak = streak + 1;
          setStreak(newStreak);
          localStorage.setItem('mindgames-challenge-streak', newStreak.toString());

          // Dispatch event for power-ups to add currency
          window.dispatchEvent(new CustomEvent('challenge-completed', {
            detail: { reward: challenge.reward }
          }));
        }

        return {
          ...challenge,
          progress: Math.min(newProgress, challenge.target),
          completed,
          completedAt: completed ? Date.now() : challenge.completedAt,
        };
      });

      localStorage.setItem(CHALLENGES_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    // Update weekly quest
    if (weeklyQuest && !weeklyQuest.completed) {
      setWeeklyQuest(prev => {
        if (!prev) return prev;
        if (prev.type !== type) return prev;

        const newProgress = prev.progress + value;
        const completed = newProgress >= prev.target;

        if (completed) {
          const newRewards = totalRewards + prev.reward;
          setTotalRewards(newRewards);
          localStorage.setItem('mindgames-total-rewards', newRewards.toString());
        }

        const updated = {
          ...prev,
          progress: Math.min(newProgress, prev.target),
          completed,
          completedAt: completed ? Date.now() : prev.completedAt,
        };

        localStorage.setItem(QUESTS_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  }, [totalRewards, streak, weeklyQuest]);

  const getCompletedCount = useCallback(() => {
    return challenges.filter(c => c.completed).length;
  }, [challenges]);

  const getTotalRewards = useCallback(() => {
    return totalRewards;
  }, [totalRewards]);

  return {
    challenges,
    weeklyQuest,
    streak,
    totalRewards,
    updateChallengeProgress,
    getCompletedCount,
    getTotalRewards,
  };
};
