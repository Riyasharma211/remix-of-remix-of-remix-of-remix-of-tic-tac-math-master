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
      className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left w-full
        ${isActive 
          ? `${colors.border} ${colors.bg} ${colors.glow}` 
          : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
        }
      `}
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${colors.bg} ${colors.border} border`}>
          <Icon className={`w-6 h-6 ${colors.text}`} />
        </div>
        
        <div className="flex-1">
          <h3 className={`font-orbitron text-lg ${isActive ? colors.text : 'text-foreground'}`}>
            {title}
          </h3>
          <p className="text-muted-foreground font-rajdhani text-sm mt-1">
            {description}
          </p>
        </div>
      </div>
      
      {isActive && (
        <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${colors.bg} ${colors.border} border animate-pulse-glow`} />
      )}
    </button>
  );
};

export default GameCard;
