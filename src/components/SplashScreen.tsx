import { useState, useEffect } from 'react';
import { Gamepad2 } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 1800);
    const completeTimer = setTimeout(() => onComplete(), 2300);
    
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-all duration-500 ${
        fadeOut ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 bg-mesh-gradient" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-neon-cyan/30 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-neon-purple/30 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '0.5s' }} />
      
      {/* Animated Logo */}
      <div className="relative animate-[scale-pop_0.8s_ease-out]">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan via-neon-purple to-neon-pink blur-3xl rounded-full opacity-60 animate-pulse" />
        <div className="relative w-28 h-28 rounded-[28px] bg-gradient-to-br from-neon-cyan via-neon-purple to-neon-pink p-[2px] shadow-2xl">
          <div className="w-full h-full rounded-[26px] bg-background flex items-center justify-center">
            <Gamepad2 className="w-14 h-14 text-neon-cyan" />
          </div>
        </div>
      </div>
      
      {/* App Name */}
      <h1 className="mt-8 font-orbitron text-4xl font-black tracking-wider animate-slide-up">
        <span className="text-neon-cyan text-glow-cyan">MIND</span>
        <span className="text-neon-purple text-glow-purple">GAMES</span>
      </h1>
      
      <p className="mt-3 text-muted-foreground font-rajdhani text-lg animate-slide-up" style={{ animationDelay: '0.2s' }}>
        Train your brain
      </p>
      
      {/* Loading indicator */}
      <div className="mt-10 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple animate-bounce"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  );
};

export default SplashScreen;
