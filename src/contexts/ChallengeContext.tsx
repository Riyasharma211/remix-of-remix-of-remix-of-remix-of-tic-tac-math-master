import React, { createContext, useContext, ReactNode } from 'react';
import { useDailyChallenges } from '@/hooks/useDailyChallenges';

interface ChallengeContextType {
  updateChallengeProgress: (
    type: 'win' | 'score' | 'play' | 'streak' | 'time',
    gameType?: string,
    value?: number
  ) => void;
  challenges: ReturnType<typeof useDailyChallenges>['challenges'];
  weeklyQuest: ReturnType<typeof useDailyChallenges>['weeklyQuest'];
  streak: number;
  totalRewards: number;
}

const ChallengeContext = createContext<ChallengeContextType | null>(null);

export const useChallengeContext = () => {
  const context = useContext(ChallengeContext);
  if (!context) {
    // Return no-op functions if context not available
    return {
      updateChallengeProgress: () => {},
      challenges: [],
      weeklyQuest: null,
      streak: 0,
      totalRewards: 0,
    };
  }
  return context;
};

export const ChallengeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    challenges,
    weeklyQuest,
    streak,
    totalRewards,
    updateChallengeProgress,
  } = useDailyChallenges();

  return (
    <ChallengeContext.Provider
      value={{
        updateChallengeProgress,
        challenges,
        weeklyQuest,
        streak,
        totalRewards,
      }}
    >
      {children}
    </ChallengeContext.Provider>
  );
};
