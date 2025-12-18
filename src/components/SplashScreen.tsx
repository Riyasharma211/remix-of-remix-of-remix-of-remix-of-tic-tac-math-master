import { useState, useEffect } from 'react';
import { Gamepad2 } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    const fadeTimer = setTimeout(() => setFadeOut(true), 1800);
    const completeTimer = setTimeout(() => onComplete(), 2300);
    
    return () => {
      clearInterval(progressInterval);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Animated Orbs Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-neon-cyan/30 rounded-full blur-[100px] animate-orb-1" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-neon-purple/30 rounded-full blur-[120px] animate-orb-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-neon-pink/20 rounded-full blur-[150px] animate-orb-3" />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />

      {/* Glowing Ring */}
      <div className="absolute w-[300px] h-[300px] rounded-full border border-neon-cyan/20 animate-glow-ring">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-neon-cyan rounded-full shadow-[0_0_20px_hsl(var(--neon-cyan))]" />
      </div>
      <div className="absolute w-[350px] h-[350px] rounded-full border border-neon-purple/10 animate-glow-ring" style={{ animationDirection: 'reverse', animationDuration: '12s' }} />

      {/* Logo Container */}
      <div className="relative animate-[scale-pop_0.8s_ease-out]">
        {/* Outer Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/40 to-neon-purple/40 blur-[60px] rounded-full scale-150 animate-neon-pulse" />
        
        {/* Inner Glow Ring */}
        <div className="absolute -inset-4 rounded-[32px] bg-gradient-to-br from-neon-cyan/30 via-neon-purple/20 to-neon-pink/30 blur-xl animate-pulse" />
        
        {/* Main Logo */}
        <div className="relative w-28 h-28 rounded-[28px] bg-gradient-to-br from-neon-cyan via-primary to-neon-purple p-[2px] shadow-2xl shadow-primary/50">
          <div className="w-full h-full rounded-[26px] bg-background/90 backdrop-blur-xl flex items-center justify-center">
            <Gamepad2 className="w-14 h-14 text-neon-cyan drop-shadow-[0_0_15px_hsl(var(--neon-cyan))]" />
          </div>
        </div>
      </div>
      
      {/* App Name */}
      <h1 className="mt-8 font-orbitron text-4xl font-bold animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <span className="bg-gradient-to-r from-neon-cyan via-primary to-neon-purple bg-clip-text text-transparent drop-shadow-[0_0_30px_hsl(var(--neon-cyan)/0.5)]">
          MIND
        </span>
        <span className="bg-gradient-to-r from-neon-purple via-neon-pink to-accent bg-clip-text text-transparent drop-shadow-[0_0_30px_hsl(var(--neon-purple)/0.5)]">
          GAMES
        </span>
      </h1>

      {/* Tagline */}
      <p className="mt-2 text-muted-foreground font-rajdhani text-sm animate-slide-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
        Train Your Brain • Challenge Friends
      </p>
      
      {/* Progress Bar */}
      <div className="mt-10 w-48 h-1 bg-border/50 rounded-full overflow-hidden glass">
        <div 
          className="h-full bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink rounded-full transition-all duration-100 ease-out shadow-[0_0_20px_hsl(var(--neon-cyan))]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Loading Text */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-rajdhani tracking-widest uppercase">Loading</span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-bounce shadow-[0_0_10px_hsl(var(--neon-cyan))]"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;