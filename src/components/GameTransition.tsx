import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface GameTransitionProps {
  children: React.ReactNode;
  gameKey: string;
  direction?: 'left' | 'right' | null;
}

const GameTransition: React.FC<GameTransitionProps> = ({ children, gameKey, direction = null }) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const [currentKey, setCurrentKey] = useState(gameKey);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    if (gameKey !== currentKey) {
      setIsTransitioning(true);
      setShowContent(false);
      setSlideDirection(direction);
      
      // Brief loading state
      const timer = setTimeout(() => {
        setCurrentKey(gameKey);
        setShowContent(true);
        
        // End transition after content appears
        setTimeout(() => {
          setIsTransitioning(false);
          setSlideDirection(null);
        }, 300);
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [gameKey, currentKey, direction]);

  const getExitTransform = () => {
    if (!slideDirection) return 'translate-y-4 scale-95';
    return slideDirection === 'left' ? '-translate-x-full' : 'translate-x-full';
  };

  const getEnterTransform = () => {
    if (!slideDirection) return 'translate-y-0 scale-100';
    return 'translate-x-0';
  };

  const getInitialTransform = () => {
    if (!slideDirection) return 'translate-y-4 scale-95';
    return slideDirection === 'left' ? 'translate-x-full' : '-translate-x-full';
  };

  return (
    <div className="relative w-full min-h-[300px] overflow-hidden">
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
          ${showContent 
            ? `opacity-100 ${getEnterTransform()}` 
            : `opacity-0 ${isTransitioning ? getExitTransform() : getInitialTransform()}`
          }`}
      >
        {children}
      </div>
    </div>
  );
};

export default GameTransition;
