import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
  label: string;
  color: string;
  mathTimeLimit: number;
  memoryPairs: number;
  numberRange: { min: number; max: number };
  reactionMinDelay: number;
  patternSpeed: number;
}

const difficultyConfigs: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: 'Easy',
    color: 'text-neon-green',
    mathTimeLimit: 45,
    memoryPairs: 6,
    numberRange: { min: 1, max: 50 },
    reactionMinDelay: 2000,
    patternSpeed: 800,
  },
  medium: {
    label: 'Medium',
    color: 'text-neon-orange',
    mathTimeLimit: 30,
    memoryPairs: 8,
    numberRange: { min: 1, max: 100 },
    reactionMinDelay: 1000,
    patternSpeed: 600,
  },
  hard: {
    label: 'Hard',
    color: 'text-destructive',
    mathTimeLimit: 20,
    memoryPairs: 10,
    numberRange: { min: 1, max: 200 },
    reactionMinDelay: 500,
    patternSpeed: 400,
  },
};

interface DifficultyContextType {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  config: DifficultyConfig;
}

const DifficultyContext = createContext<DifficultyContextType | undefined>(undefined);

export const DifficultyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  return (
    <DifficultyContext.Provider
      value={{
        difficulty,
        setDifficulty,
        config: difficultyConfigs[difficulty],
      }}
    >
      {children}
    </DifficultyContext.Provider>
  );
};

export const useDifficulty = () => {
  const context = useContext(DifficultyContext);
  if (!context) {
    throw new Error('useDifficulty must be used within DifficultyProvider');
  }
  return context;
};

export { difficultyConfigs };
