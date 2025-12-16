import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface GameTransitionProps {
  children: React.ReactNode;
  gameKey: string;
}

const GameTransition: React.FC<GameTransitionProps> = ({ children, gameKey }) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const [currentKey, setCurrentKey] = useState(gameKey);

  useEffect(() => {
    if (gameKey !== currentKey) {
      setIsTransitioning(true);
      setShowContent(false);
      
      // Brief loading state
      const timer = setTimeout(() => {
        setCurrentKey(gameKey);
        setShowContent(true);
        
        // End transition after content appears
        setTimeout(() => {
          setIsTransitioning(false);
        }, 300);
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [gameKey, currentKey]);

  return (
    <div className="relative w-full min-h-[300px]">
      {/* Loading overlay */}
      <div 
        className={`absolute inset-0 flex items-center justify-center z-10 transition-opacity duration-150
          ${isTransitioning && !showContent ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-neon-cyan animate-spin" />
          <span className="text-muted-foreground font-rajdhani text-sm">Loading game...</span>
        </div>
      </div>
      
      {/* Content with transition */}
      <div 
        className={`w-full transition-all duration-300 ease-out
          ${showContent ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
      >
        {children}
      </div>
    </div>
  );
};

export default GameTransition;
