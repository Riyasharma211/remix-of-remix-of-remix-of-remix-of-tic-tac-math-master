import { useEffect, useState } from 'react';
import { Achievement } from '@/hooks/useGameStats';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AchievementNotificationProps {
  achievements: Achievement[];
  onDismiss: () => void;
}

export const AchievementNotification = ({ achievements, onDismiss }: AchievementNotificationProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const currentAchievement = achievements[currentIndex];

  useEffect(() => {
    if (achievements.length > 0) {
      // Trigger entrance animation
      setTimeout(() => setIsVisible(true), 100);
      
      // Auto-advance or dismiss after 4 seconds
      const timer = setTimeout(() => {
        if (currentIndex < achievements.length - 1) {
          setIsExiting(true);
          setTimeout(() => {
            setIsExiting(false);
            setCurrentIndex(prev => prev + 1);
          }, 300);
        } else {
          handleDismiss();
        }
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, achievements.length]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 300);
  };

  if (!currentAchievement || achievements.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex items-start justify-center pt-8">
      {/* Backdrop glow */}
      <div 
        className={cn(
          "absolute inset-0 bg-primary/5 transition-opacity duration-500",
          isVisible && !isExiting ? "opacity-100" : "opacity-0"
        )}
      />
      
      {/* Achievement card */}
      <div
        className={cn(
          "pointer-events-auto relative overflow-hidden",
          "bg-gradient-to-br from-background/95 via-background/90 to-primary/10",
          "backdrop-blur-xl border border-primary/30 rounded-2xl",
          "shadow-[0_0_60px_-10px] shadow-primary/40",
          "p-6 min-w-[320px] max-w-[400px]",
          "transform transition-all duration-500 ease-out",
          isVisible && !isExiting 
            ? "translate-y-0 opacity-100 scale-100" 
            : "-translate-y-8 opacity-0 scale-95"
        )}
      >
        {/* Animated border glow */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div 
            className={cn(
              "absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0",
              "animate-[shimmer_2s_infinite]"
            )}
            style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s infinite linear'
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary animate-pulse">
                Achievement Unlocked!
              </span>
              {achievements.length > 1 && (
                <span className="text-xs text-muted-foreground">
                  {currentIndex + 1}/{achievements.length}
                </span>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-full hover:bg-primary/20 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Achievement content */}
          <div className="flex items-center gap-4">
            {/* Icon with animated ring */}
            <div className="relative">
              <div className="absolute inset-0 animate-ping bg-primary/30 rounded-full" />
              <div className="absolute inset-[-4px] animate-spin-slow bg-gradient-to-r from-primary via-primary/50 to-transparent rounded-full" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/50 flex items-center justify-center text-3xl transform animate-bounce-subtle">
                {currentAchievement.icon}
              </div>
            </div>

            {/* Text */}
            <div className="flex-1">
              <h3 className="font-bold text-lg text-foreground mb-1">
                {currentAchievement.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {currentAchievement.description}
              </p>
            </div>
          </div>

          {/* Confetti particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-confetti"
                style={{
                  left: `${10 + (i * 7)}%`,
                  top: '-10%',
                  backgroundColor: ['hsl(var(--primary))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'][i % 4],
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: `${1 + Math.random()}s`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
