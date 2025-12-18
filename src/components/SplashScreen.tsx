import { useState, useEffect } from 'react';
import { Gamepad2 } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 1500);
    const completeTimer = setTimeout(() => onComplete(), 2000);
    
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Animated Logo */}
      <div className="relative animate-[scale-pop_0.6s_ease-out]">
        <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full animate-pulse" />
        <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-neon-purple flex items-center justify-center shadow-2xl shadow-primary/50">
          <Gamepad2 className="w-12 h-12 text-primary-foreground" />
        </div>
      </div>
      
      {/* App Name */}
      <h1 className="mt-6 font-orbitron text-3xl font-bold bg-gradient-to-r from-primary via-neon-cyan to-neon-purple bg-clip-text text-transparent animate-slide-up">
        Game Zone
      </h1>
      
      {/* Loading indicator */}
      <div className="mt-8 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
};

export default SplashScreen;
