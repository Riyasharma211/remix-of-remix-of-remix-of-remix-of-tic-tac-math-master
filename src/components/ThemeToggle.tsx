import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { haptics } from '@/utils/haptics';

const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check for saved theme or default to dark
    const saved = localStorage.getItem('mindgames-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved ? saved === 'dark' : prefersDark;
    
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('light', !shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  const toggleTheme = () => {
    haptics.light();
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    // Smooth transition
    document.documentElement.style.setProperty('--theme-transition', '0.3s');
    document.documentElement.classList.toggle('light', !newIsDark);
    document.documentElement.classList.toggle('dark', newIsDark);
    
    localStorage.setItem('mindgames-theme', newIsDark ? 'dark' : 'light');
    
    // Remove transition after completion
    setTimeout(() => {
      document.documentElement.style.removeProperty('--theme-transition');
    }, 300);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-8 w-8 sm:h-10 sm:w-10 relative overflow-hidden"
      aria-label="Toggle theme"
    >
      <Sun 
        className={`w-4 h-4 sm:w-5 sm:h-5 text-neon-orange absolute transition-all duration-300 ease-out
          ${isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`}
      />
      <Moon 
        className={`w-4 h-4 sm:w-5 sm:h-5 text-neon-purple absolute transition-all duration-300 ease-out
          ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`}
      />
    </Button>
  );
};

export default ThemeToggle;
