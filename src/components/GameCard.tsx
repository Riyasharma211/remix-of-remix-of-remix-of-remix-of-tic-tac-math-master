import React from 'react';
import { LucideIcon } from 'lucide-react';

interface GameCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  color: 'cyan' | 'purple' | 'pink' | 'orange';
  isActive: boolean;
  onClick: () => void;
}

const colorClasses = {
  cyan: {
    border: 'border-neon-cyan',
    bg: 'bg-neon-cyan/10',
    text: 'text-neon-cyan',
    glow: 'box-glow-cyan',
  },
  purple: {
    border: 'border-neon-purple',
    bg: 'bg-neon-purple/10',
    text: 'text-neon-purple',
    glow: 'box-glow-purple',
  },
  pink: {
    border: 'border-neon-pink',
    bg: 'bg-neon-pink/10',
    text: 'text-neon-pink',
    glow: 'box-glow-pink',
  },
  orange: {
    border: 'border-neon-orange',
    bg: 'bg-neon-orange/10',
    text: 'text-neon-orange',
    glow: '',
  },
};

const GameCard: React.FC<GameCardProps> = ({
  title,
  description,
  icon: Icon,
  color,
  isActive,
  onClick,
}) => {
  const colors = colorClasses[color];

  return (
    <button
      onClick={onClick}
      className={`relative p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 text-left w-full
        ${isActive 
          ? `${colors.border} ${colors.bg} ${colors.glow}` 
          : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${colors.bg} ${colors.border} border`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${colors.text}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={`font-orbitron text-sm sm:text-base truncate ${isActive ? colors.text : 'text-foreground'}`}>
            {title}
          </h3>
          <p className="text-muted-foreground font-rajdhani text-xs sm:text-sm truncate">
            {description}
          </p>
        </div>
      </div>
      
      {isActive && (
        <div className={`absolute top-2 right-2 sm:top-3 sm:right-3 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${colors.bg} ${colors.border} border animate-pulse-glow`} />
      )}
    </button>
  );
};

export default GameCard;
