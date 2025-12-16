import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Play, RotateCcw, Trophy, Volume2 } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { useDifficulty } from '@/contexts/DifficultyContext';
import { haptics } from '@/utils/haptics';
import { celebrateStars } from '@/utils/confetti';
import { useLeaderboard, GAME_TYPES } from '@/hooks/useLeaderboard';

type GameState = 'idle' | 'showing' | 'input' | 'success' | 'failed';

const COLORS = [
  { name: 'red', bg: 'bg-destructive', active: 'bg-destructive/50 shadow-[0_0_30px_hsl(0,84%,60%,0.5)]', border: 'border-destructive' },
  { name: 'blue', bg: 'bg-neon-cyan', active: 'bg-neon-cyan/50 shadow-[0_0_30px_hsl(180,100%,50%,0.5)]', border: 'border-neon-cyan' },
  { name: 'green', bg: 'bg-neon-green', active: 'bg-neon-green/50 shadow-[0_0_30px_hsl(150,100%,50%,0.5)]', border: 'border-neon-green' },
  { name: 'yellow', bg: 'bg-neon-orange', active: 'bg-neon-orange/50 shadow-[0_0_30px_hsl(30,100%,55%,0.5)]', border: 'border-neon-orange' },
];

const PatternMemory: React.FC = () => {
  const { config } = useDifficulty();
  const { addScore } = useLeaderboard();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [pattern, setPattern] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [activeColor, setActiveColor] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [round, setRound] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [playerName] = useState(() => localStorage.getItem('mindgames-player-name') || 'Player');

  const playTone = (index: number) => {
    const frequencies = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = frequencies[index];
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  };

  const startGame = () => {
    setPattern([]);
    setPlayerInput([]);
    setScore(0);
    setRound(0);
    setGameState('showing');
    addToPattern([]);
  };

  const addToPattern = useCallback((currentPattern: number[]) => {
    const newColor = Math.floor(Math.random() * 4);
    const newPattern = [...currentPattern, newColor];
    setPattern(newPattern);
    setRound(newPattern.length);
    
    // Show pattern after a short delay
    setTimeout(() => {
      showPattern(newPattern);
    }, 500);
  }, []);

  const showPattern = async (patternToShow: number[]) => {
    setGameState('showing');
    
    for (let i = 0; i < patternToShow.length; i++) {
      await new Promise(resolve => setTimeout(resolve, config.patternSpeed));
      setActiveColor(patternToShow[i]);
      playTone(patternToShow[i]);
      await new Promise(resolve => setTimeout(resolve, config.patternSpeed / 2));
      setActiveColor(null);
    }
    
    setPlayerInput([]);
    setGameState('input');
  };

  const handleColorClick = (index: number) => {
    if (gameState !== 'input') return;
    
    setActiveColor(index);
    playTone(index);
    setTimeout(() => setActiveColor(null), 200);
    
    const newInput = [...playerInput, index];
    setPlayerInput(newInput);
    
    // Check if correct
    if (pattern[newInput.length - 1] !== index) {
      // Wrong!
      setGameState('failed');
      soundManager.playLocalSound('lose');
      haptics.error();
      
      // Save score to leaderboard
      if (score > 0) {
        addScore(GAME_TYPES.PATTERN_MEMORY, playerName, score, `Round ${round}`);
      }
      
      if (score > highScore) {
        setHighScore(score);
        celebrateStars();
      }
      return;
    }
    
    // Check if pattern complete
    if (newInput.length === pattern.length) {
      setGameState('success');
      const points = pattern.length * 10;
      setScore(prev => prev + points);
      soundManager.playLocalSound('correct');
      
      // Next round
      setTimeout(() => {
        addToPattern(pattern);
      }, 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      {gameState === 'idle' && (
        <div className="flex flex-col items-center gap-6 animate-slide-in">
          <div className="text-center space-y-2">
            <Sparkles className="w-16 h-16 text-neon-purple mx-auto animate-float" />
            <h2 className="font-orbitron text-2xl text-foreground">Pattern Memory</h2>
            <p className="text-muted-foreground font-rajdhani">
              Watch the pattern, then repeat it!
            </p>
          </div>

          {highScore > 0 && (
            <div className="flex items-center gap-2 text-neon-green">
              <Trophy className="w-5 h-5" />
              <span className="font-orbitron">High Score: {highScore}</span>
            </div>
          )}

          <Button variant="game" size="xl" onClick={startGame}>
            <Play className="w-5 h-5" />
            Start Game
          </Button>
        </div>
      )}

      {(gameState === 'showing' || gameState === 'input' || gameState === 'success') && (
        <div className="flex flex-col items-center gap-6 w-full animate-slide-in">
          {/* Stats */}
          <div className="flex justify-between w-full px-4">
            <div className="text-center">
              <span className="text-muted-foreground font-rajdhani text-sm">Round</span>
              <p className="font-orbitron text-2xl text-neon-cyan">{round}</p>
            </div>
            <div className="text-center">
              <span className="text-muted-foreground font-rajdhani text-sm">Score</span>
              <p className="font-orbitron text-2xl text-neon-green">{score}</p>
            </div>
          </div>

          {/* Status */}
          <div className="h-8 flex items-center">
            {gameState === 'showing' && (
              <div className="flex items-center gap-2 text-neon-purple animate-pulse">
                <Volume2 className="w-5 h-5" />
                <span className="font-rajdhani">Watch the pattern...</span>
              </div>
            )}
            {gameState === 'input' && (
              <span className="font-rajdhani text-neon-cyan">Your turn! Repeat the pattern</span>
            )}
            {gameState === 'success' && (
              <span className="font-orbitron text-neon-green animate-scale-pop">Correct!</span>
            )}
          </div>

          {/* Color Buttons */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-card rounded-2xl border border-border">
            {COLORS.map((color, index) => (
              <button
                key={color.name}
                onClick={() => handleColorClick(index)}
                disabled={gameState !== 'input'}
                className={`w-28 h-28 sm:w-32 sm:h-32 rounded-2xl transition-all duration-200 border-2
                  ${activeColor === index ? color.active : color.bg}
                  ${color.border}
                  ${gameState === 'input' ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                  ${activeColor === index ? 'scale-95' : 'scale-100'}
                `}
              />
            ))}
          </div>

          {/* Progress */}
          <div className="flex gap-1">
            {pattern.map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all
                  ${i < playerInput.length 
                    ? 'bg-neon-green' 
                    : 'bg-muted'
                  }`}
              />
            ))}
          </div>
        </div>
      )}

      {gameState === 'failed' && (
        <div className="flex flex-col items-center gap-6 animate-slide-in">
          <div className="text-center space-y-4">
            <h2 className="font-orbitron text-3xl text-destructive">Game Over!</h2>
            <p className="font-orbitron text-5xl text-foreground">{score}</p>
            <p className="text-muted-foreground font-rajdhani">
              You reached round {round}
            </p>
            {score >= highScore && score > 0 && (
              <p className="text-neon-orange font-orbitron animate-pulse-glow">New High Score!</p>
            )}
          </div>

          <Button variant="game" size="lg" onClick={startGame}>
            <RotateCcw className="w-5 h-5" />
            Play Again
          </Button>
        </div>
      )}
    </div>
  );
};

export default PatternMemory;
