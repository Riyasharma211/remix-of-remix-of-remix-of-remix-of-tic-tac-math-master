import React from 'react';
import { useDifficulty, Difficulty, difficultyConfigs } from '@/contexts/DifficultyContext';
import { Gauge } from 'lucide-react';

const DifficultySelector: React.FC = () => {
  const { difficulty, setDifficulty } = useDifficulty();

  const levels: Difficulty[] = ['easy', 'medium', 'hard'];

  return (
    <div className="flex items-center gap-3 p-3 bg-card/50 rounded-xl border border-border">
      <Gauge className="w-4 h-4 text-muted-foreground" />
      <div className="flex gap-2">
        {levels.map((level) => {
          const config = difficultyConfigs[level];
          const isActive = difficulty === level;
          
          return (
            <button
              key={level}
              onClick={() => setDifficulty(level)}
              className={`px-3 py-1 rounded-lg font-rajdhani text-sm font-medium transition-all duration-200
                ${isActive 
                  ? `${config.color} bg-current/10 border border-current` 
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DifficultySelector;
