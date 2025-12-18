import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Crosshair, RotateCcw, Play, Trophy, Clock, Target } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateBurst } from '@/utils/confetti';
import { useLeaderboard, GAME_TYPES } from '@/hooks/useLeaderboard';
import { useDifficulty } from '@/contexts/DifficultyContext';

const GAME_DURATION = 30;

const DIFFICULTY_SETTINGS = {
  easy: { minSize: 60, maxSize: 80, spawnDelay: 1500 },
  medium: { minSize: 40, maxSize: 60, spawnDelay: 1000 },
  hard: { minSize: 25, maxSize: 40, spawnDelay: 700 },
};

interface TargetObj {
  id: number;
  x: number;
  y: number;
  size: number;
}

const AimTrainer: React.FC = () => {
  const { addScore } = useLeaderboard();
  const { difficulty } = useDifficulty();
  const [playerName] = useState(() => localStorage.getItem('mindgames-player-name') || 'Player');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [targets, setTargets] = useState<TargetObj[]>([]);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [targetIdCounter, setTargetIdCounter] = useState(0);

  const settings = DIFFICULTY_SETTINGS[difficulty];

  const spawnTarget = useCallback(() => {
    const size = Math.random() * (settings.maxSize - settings.minSize) + settings.minSize;
    const padding = size;
    const x = Math.random() * (100 - (padding * 2 / 3)) + (padding / 3);
    const y = Math.random() * (100 - (padding * 2 / 3)) + (padding / 3);
    
    setTargetIdCounter(prev => prev + 1);
    setTargets(prev => [...prev, { id: targetIdCounter, x, y, size }]);
  }, [settings.maxSize, settings.minSize, targetIdCounter]);

  const startGame = () => {
    setIsPlaying(true);
    setTimeLeft(GAME_DURATION);
    setHits(0);
    setMisses(0);
    setTargets([]);
    setTargetIdCounter(0);
    soundManager.playLocalSound('start');
    haptics.light();
    spawnTarget();
  };

  useEffect(() => {
    if (!isPlaying || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [isPlaying, timeLeft]);

  useEffect(() => {
    if (!isPlaying) return;
    const spawnInterval = setInterval(() => {
      if (targets.length < 3) {
        spawnTarget();
      }
    }, settings.spawnDelay);
    return () => clearInterval(spawnInterval);
  }, [isPlaying, spawnTarget, settings.spawnDelay, targets.length]);

  useEffect(() => {
    if (isPlaying && timeLeft <= 0) {
      setIsPlaying(false);
      const accuracy = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;
      const score = Math.round(hits * (accuracy / 100) * 10);
      
      soundManager.playLocalSound(hits > 10 ? 'win' : 'lose');
      haptics.success();
      if (hits > 15) celebrateBurst();
      
      if (bestScore === null || score > bestScore) {
        setBestScore(score);
      }
      
      addScore(GAME_TYPES.AIM_TRAINER || 'aim_trainer', playerName, score, `${hits} hits, ${accuracy}% acc`);
    }
  }, [isPlaying, timeLeft, hits, misses, bestScore, playerName, addScore]);

  const handleTargetClick = (id: number) => {
    setTargets(prev => prev.filter(t => t.id !== id));
    setHits(prev => prev + 1);
    soundManager.playLocalSound('pop');
    haptics.light();
  };

  const handleMiss = () => {
    setMisses(prev => prev + 1);
    soundManager.playLocalSound('wrong');
    haptics.error();
  };

  const getAccuracy = () => hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 100;

  if (!isPlaying && timeLeft === GAME_DURATION) {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-2">
          <Crosshair className="w-16 h-16 text-neon-pink mx-auto animate-float" />
          <h2 className="font-orbitron text-2xl text-foreground">Aim Trainer</h2>
          <p className="text-muted-foreground font-rajdhani max-w-sm">
            Click the targets as fast as you can!
          </p>
        </div>

        {bestScore !== null && (
          <div className="flex items-center gap-2 text-neon-orange">
            <Trophy className="w-5 h-5" />
            <span className="font-orbitron">Best: {bestScore}</span>
          </div>
        )}

        <Button variant="game" size="xl" onClick={startGame}>
          <Play className="w-5 h-5" />
          Start Training
        </Button>
      </div>
    );
  }

  if (!isPlaying && timeLeft <= 0) {
    const accuracy = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;
    const score = Math.round(hits * (accuracy / 100) * 10);

    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-4">
          <Trophy className="w-16 h-16 text-neon-orange mx-auto" />
          <h2 className="font-orbitron text-2xl text-foreground">Training Complete!</h2>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <Target className="w-5 h-5 text-neon-green mx-auto mb-1" />
            <span className="font-orbitron text-2xl text-neon-green">{hits}</span>
            <p className="text-muted-foreground text-xs">Hits</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <span className="font-orbitron text-2xl text-neon-cyan">{accuracy}%</span>
            <p className="text-muted-foreground text-xs">Accuracy</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <span className="font-orbitron text-2xl text-neon-orange">{score}</span>
            <p className="text-muted-foreground text-xs">Score</p>
          </div>
        </div>

        {score === bestScore && score > 0 && (
          <p className="text-neon-orange font-orbitron animate-pulse">New Best!</p>
        )}

        <Button variant="game" size="xl" onClick={startGame}>
          <RotateCcw className="w-5 h-5" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full animate-slide-in">
      {/* Stats */}
      <div className="flex justify-between w-full max-w-md">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-neon-cyan" />
          <span className={`font-orbitron text-xl ${timeLeft <= 10 ? 'text-destructive animate-pulse' : ''}`}>
            {timeLeft}s
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-neon-green" />
          <span className="font-orbitron text-xl">{hits}</span>
        </div>
        <div className="text-muted-foreground">
          <span className="font-orbitron text-neon-orange">{getAccuracy()}%</span>
        </div>
      </div>

      {/* Game Area */}
      <div 
        className="relative w-full aspect-[4/3] max-w-lg rounded-2xl bg-card border border-border overflow-hidden cursor-crosshair"
        onClick={handleMiss}
      >
        {targets.map(target => (
          <button
            key={target.id}
            onClick={(e) => {
              e.stopPropagation();
              handleTargetClick(target.id);
            }}
            className="absolute rounded-full bg-gradient-to-br from-neon-pink to-neon-purple border-2 border-white/50 transition-transform hover:scale-110 active:scale-95 animate-scale-pop shadow-[0_0_20px_hsl(var(--neon-pink)/0.5)]"
            style={{
              left: `${target.x}%`,
              top: `${target.y}%`,
              width: target.size,
              height: target.size,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="absolute inset-2 rounded-full bg-white/30" />
            <div className="absolute inset-[40%] rounded-full bg-white/60" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default AimTrainer;
