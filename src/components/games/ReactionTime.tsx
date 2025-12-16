import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, RotateCcw, Play, Trophy, Clock, AlertTriangle } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateBurst } from '@/utils/confetti';
import { useLeaderboard, GAME_TYPES } from '@/hooks/useLeaderboard';

type GameState = 'idle' | 'waiting' | 'ready' | 'clicked' | 'too-early' | 'results';

const ReactionTime: React.FC = () => {
  const { addScore, isNewHighScore } = useLeaderboard();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number[]>([]);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [playerName] = useState(() => localStorage.getItem('mindgames-player-name') || 'Player');

  const startGame = () => {
    setGameState('waiting');
    setReactionTime(null);
    soundManager.playLocalSound('click');

    // Random delay between 1-5 seconds
    const delay = Math.random() * 4000 + 1000;
    
    timeoutRef.current = setTimeout(() => {
      setGameState('ready');
      setStartTime(Date.now());
      soundManager.playLocalSound('correct');
    }, delay);
  };

  const handleClick = () => {
    if (gameState === 'waiting') {
      // Clicked too early
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setGameState('too-early');
      soundManager.playLocalSound('wrong');
      haptics.error();
    } else if (gameState === 'ready') {
      // Calculate reaction time
      const time = Date.now() - startTime;
      setReactionTime(time);
      setAttempts(prev => [...prev, time]);
      
      const isNewBest = bestTime === null || time < bestTime;
      if (isNewBest) {
        setBestTime(time);
        // Convert to score: faster = higher (1000 - time, min 100)
        const score = Math.max(100, 1000 - time);
        addScore(GAME_TYPES.REACTION_TIME, playerName, score, `${time}ms reaction`);
        celebrateBurst();
      }
      
      setGameState('clicked');
      soundManager.playLocalSound('win');
      haptics.success();
    }
  };

  const getAverageTime = () => {
    if (attempts.length === 0) return null;
    return Math.round(attempts.reduce((a, b) => a + b, 0) / attempts.length);
  };

  const getReactionRating = (time: number): { text: string; color: string } => {
    if (time < 200) return { text: 'Incredible!', color: 'text-neon-cyan' };
    if (time < 250) return { text: 'Excellent!', color: 'text-neon-green' };
    if (time < 300) return { text: 'Great!', color: 'text-neon-green' };
    if (time < 350) return { text: 'Good', color: 'text-neon-orange' };
    if (time < 400) return { text: 'Average', color: 'text-foreground' };
    return { text: 'Keep Practicing', color: 'text-muted-foreground' };
  };

  const resetGame = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setGameState('idle');
    setReactionTime(null);
  };

  const showResults = () => {
    setGameState('results');
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Idle State
  if (gameState === 'idle') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-2">
          <Zap className="w-16 h-16 text-neon-orange mx-auto animate-float" />
          <h2 className="font-orbitron text-2xl text-foreground">Reaction Time</h2>
          <p className="text-muted-foreground font-rajdhani max-w-sm">
            Click as soon as the screen turns green. Test your reflexes!
          </p>
        </div>

        {bestTime !== null && (
          <div className="flex items-center gap-2 text-neon-green">
            <Trophy className="w-5 h-5" />
            <span className="font-orbitron">Best: {bestTime}ms</span>
          </div>
        )}

        {attempts.length > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="font-rajdhani">Average: {getAverageTime()}ms ({attempts.length} attempts)</span>
          </div>
        )}

        <div className="flex gap-4">
          <Button variant="game" size="xl" onClick={startGame}>
            <Play className="w-5 h-5" />
            Start Test
          </Button>
          
          {attempts.length > 0 && (
            <Button variant="outline" size="lg" onClick={showResults}>
              View Results
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Waiting State (Red/Orange)
  if (gameState === 'waiting') {
    return (
      <button
        onClick={handleClick}
        className="w-full h-80 rounded-3xl bg-gradient-to-br from-destructive to-neon-orange flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-[1.02] animate-slide-in"
      >
        <Clock className="w-16 h-16 text-destructive-foreground mb-4 animate-pulse" />
        <span className="font-orbitron text-3xl text-destructive-foreground">Wait for green...</span>
        <span className="font-rajdhani text-lg text-destructive-foreground/80 mt-2">Don't click yet!</span>
      </button>
    );
  }

  // Ready State (Green)
  if (gameState === 'ready') {
    return (
      <button
        onClick={handleClick}
        className="w-full h-80 rounded-3xl bg-gradient-to-br from-neon-green to-neon-cyan flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-[1.02] animate-scale-pop shadow-[0_0_60px_hsl(150,100%,50%,0.5)]"
      >
        <Zap className="w-20 h-20 text-background mb-4" />
        <span className="font-orbitron text-4xl text-background font-bold">CLICK NOW!</span>
      </button>
    );
  }

  // Too Early State
  if (gameState === 'too-early') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="w-full h-60 rounded-3xl bg-gradient-to-br from-destructive/20 to-destructive/10 border-2 border-destructive flex flex-col items-center justify-center">
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
          <span className="font-orbitron text-2xl text-destructive">Too Early!</span>
          <span className="font-rajdhani text-muted-foreground mt-2">Wait for the green screen</span>
        </div>

        <Button variant="neon" size="lg" onClick={startGame}>
          <RotateCcw className="w-5 h-5" />
          Try Again
        </Button>
      </div>
    );
  }

  // Clicked State (Show Result)
  if (gameState === 'clicked' && reactionTime !== null) {
    const rating = getReactionRating(reactionTime);
    
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="w-full p-8 rounded-3xl bg-card border-2 border-neon-cyan box-glow-cyan text-center">
          <span className="font-rajdhani text-lg text-muted-foreground">Your reaction time</span>
          <p className="font-orbitron text-6xl text-neon-cyan mt-2">{reactionTime}ms</p>
          <p className={`font-orbitron text-xl mt-4 ${rating.color}`}>{rating.text}</p>
        </div>

        <div className="flex gap-4 flex-wrap justify-center">
          {bestTime === reactionTime && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-neon-orange/20 border border-neon-orange">
              <Trophy className="w-4 h-4 text-neon-orange" />
              <span className="font-orbitron text-sm text-neon-orange">New Best!</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
            <span className="font-rajdhani text-muted-foreground">
              Attempt {attempts.length} | Avg: {getAverageTime()}ms
            </span>
          </div>
        </div>

        <div className="flex gap-4">
          <Button variant="game" size="lg" onClick={startGame}>
            <RotateCcw className="w-5 h-5" />
            Try Again
          </Button>
          
          <Button variant="outline" onClick={showResults}>
            View All Results
          </Button>
        </div>
      </div>
    );
  }

  // Results State
  if (gameState === 'results') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in w-full max-w-md">
        <h2 className="font-orbitron text-2xl text-foreground">Your Results</h2>

        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <span className="font-rajdhani text-sm text-muted-foreground">Best Time</span>
            <p className="font-orbitron text-2xl text-neon-green">{bestTime}ms</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <span className="font-rajdhani text-sm text-muted-foreground">Average</span>
            <p className="font-orbitron text-2xl text-neon-cyan">{getAverageTime()}ms</p>
          </div>
        </div>

        <div className="w-full space-y-2 max-h-48 overflow-y-auto">
          <span className="font-rajdhani text-sm text-muted-foreground">All attempts:</span>
          <div className="flex flex-wrap gap-2">
            {attempts.map((time, index) => (
              <span
                key={index}
                className={`px-3 py-1 rounded-full text-sm font-orbitron border
                  ${time === bestTime 
                    ? 'border-neon-green bg-neon-green/20 text-neon-green' 
                    : 'border-border bg-card text-foreground'
                  }`}
              >
                {time}ms
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <Button variant="game" size="lg" onClick={startGame}>
            <Play className="w-5 h-5" />
            Continue
          </Button>
          
          <Button variant="ghost" onClick={resetGame}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default ReactionTime;
