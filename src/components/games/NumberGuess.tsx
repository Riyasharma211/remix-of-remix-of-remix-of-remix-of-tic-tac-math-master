import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HelpCircle, Flame, Snowflake, Target, RotateCcw, Play } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateWin } from '@/utils/confetti';
import { useLeaderboard, GAME_TYPES } from '@/hooks/useLeaderboard';

type GameState = 'idle' | 'playing' | 'won';

const NumberGuess: React.FC = () => {
  const { addScore } = useLeaderboard();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [targetNumber, setTargetNumber] = useState(0);
  const [guess, setGuess] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts] = useState(7);
  const [hint, setHint] = useState<'hot' | 'warm' | 'cold' | 'freezing' | null>(null);
  const [history, setHistory] = useState<{ guess: number; hint: string }[]>([]);
  const [range, setRange] = useState({ min: 1, max: 100 });
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [playerName] = useState(() => localStorage.getItem('mindgames-player-name') || 'Player');

  const startGame = () => {
    const target = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    setTargetNumber(target);
    setGameState('playing');
    setAttempts(0);
    setGuess('');
    setHint(null);
    setHistory([]);
    soundManager.playLocalSound('click');
  };

  const getHint = (guessNum: number): 'hot' | 'warm' | 'cold' | 'freezing' => {
    const diff = Math.abs(guessNum - targetNumber);
    const rangeSize = range.max - range.min;
    const percentage = (diff / rangeSize) * 100;

    if (percentage <= 5) return 'hot';
    if (percentage <= 15) return 'warm';
    if (percentage <= 30) return 'cold';
    return 'freezing';
  };

  const handleGuess = () => {
    const guessNum = parseInt(guess);
    if (isNaN(guessNum) || guessNum < range.min || guessNum > range.max) return;

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (guessNum === targetNumber) {
      setGameState('won');
      setHint(null);
      soundManager.playLocalSound('win');
      haptics.success();
      celebrateWin();
      
      // Score: higher for fewer attempts (max 7 attempts -> score from 100-700)
      const calculatedScore = (maxAttempts - newAttempts + 1) * 100;
      addScore(GAME_TYPES.NUMBER_GUESS, playerName, calculatedScore, `Found in ${newAttempts} tries`);
      
      if (bestScore === null || newAttempts < bestScore) {
        setBestScore(newAttempts);
      }
    } else {
      const newHint = getHint(guessNum);
      setHint(newHint);
      const direction = guessNum < targetNumber ? '↑ Higher' : '↓ Lower';
      setHistory(prev => [...prev, { guess: guessNum, hint: `${newHint} - ${direction}` }]);
      
      if (newHint === 'hot' || newHint === 'warm') {
        soundManager.playLocalSound('correct');
      } else {
        soundManager.playLocalSound('wrong');
      }

      if (newAttempts >= maxAttempts) {
        setGameState('idle');
        soundManager.playLocalSound('lose');
      }
    }
    setGuess('');
  };

  const getHintStyles = () => {
    switch (hint) {
      case 'hot':
        return 'border-destructive bg-destructive/20 text-destructive';
      case 'warm':
        return 'border-neon-orange bg-neon-orange/20 text-neon-orange';
      case 'cold':
        return 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan';
      case 'freezing':
        return 'border-neon-purple bg-neon-purple/20 text-neon-purple';
      default:
        return 'border-border bg-card';
    }
  };

  const getHintIcon = () => {
    switch (hint) {
      case 'hot':
        return <Flame className="w-8 h-8 text-destructive animate-pulse" />;
      case 'warm':
        return <Flame className="w-8 h-8 text-neon-orange" />;
      case 'cold':
        return <Snowflake className="w-8 h-8 text-neon-cyan" />;
      case 'freezing':
        return <Snowflake className="w-8 h-8 text-neon-purple animate-pulse" />;
      default:
        return <HelpCircle className="w-8 h-8 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      {gameState === 'idle' && (
        <div className="flex flex-col items-center gap-6 animate-slide-in">
          <div className="text-center space-y-2">
            <Target className="w-16 h-16 text-neon-green mx-auto animate-float" />
            <h2 className="font-orbitron text-2xl text-foreground">Number Guessing</h2>
            <p className="text-muted-foreground font-rajdhani">
              Guess the number between {range.min} and {range.max}!
            </p>
            <p className="text-muted-foreground font-rajdhani text-sm">
              Use hot/cold hints to find it in {maxAttempts} tries
            </p>
          </div>

          {bestScore && (
            <div className="flex items-center gap-2 text-neon-green">
              <Target className="w-5 h-5" />
              <span className="font-orbitron">Best: {bestScore} attempts</span>
            </div>
          )}

          <Button variant="game" size="xl" onClick={startGame}>
            <Play className="w-5 h-5" />
            Start Game
          </Button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="flex flex-col items-center gap-6 w-full animate-slide-in">
          {/* Stats */}
          <div className="flex justify-between w-full px-4">
            <div className="text-center">
              <span className="text-muted-foreground font-rajdhani text-sm">Attempts</span>
              <p className="font-orbitron text-xl">{attempts}/{maxAttempts}</p>
            </div>
            <div className="text-center">
              <span className="text-muted-foreground font-rajdhani text-sm">Range</span>
              <p className="font-orbitron text-xl">{range.min}-{range.max}</p>
            </div>
          </div>

          {/* Hint Display */}
          <div className={`p-8 rounded-2xl border-2 transition-all duration-500 w-full text-center ${getHintStyles()}`}>
            <div className="flex flex-col items-center gap-2">
              {getHintIcon()}
              <span className="font-orbitron text-2xl uppercase">
                {hint || 'Make a guess!'}
              </span>
              {hint && (
                <span className="text-sm font-rajdhani opacity-80">
                  {history[history.length - 1]?.hint.split(' - ')[1]}
                </span>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="flex gap-3 w-full">
            <Input
              type="number"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleGuess()}
              placeholder={`${range.min} - ${range.max}`}
              className="font-orbitron text-xl text-center bg-card border-border"
              min={range.min}
              max={range.max}
            />
            <Button variant="neon" onClick={handleGuess} disabled={!guess}>
              Guess
            </Button>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="w-full space-y-2 max-h-32 overflow-y-auto">
              <span className="text-muted-foreground font-rajdhani text-sm">Previous guesses:</span>
              <div className="flex flex-wrap gap-2">
                {history.map((item, index) => (
                  <span
                    key={index}
                    className={`px-3 py-1 rounded-full text-sm font-rajdhani border
                      ${item.hint.includes('hot') ? 'border-destructive/50 bg-destructive/10' :
                        item.hint.includes('warm') ? 'border-neon-orange/50 bg-neon-orange/10' :
                        item.hint.includes('cold') ? 'border-neon-cyan/50 bg-neon-cyan/10' :
                        'border-neon-purple/50 bg-neon-purple/10'
                      }`}
                  >
                    {item.guess}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Button variant="ghost" onClick={() => setGameState('idle')}>
            <RotateCcw className="w-4 h-4" />
            Give Up
          </Button>
        </div>
      )}

      {gameState === 'won' && (
        <div className="flex flex-col items-center gap-6 animate-slide-in">
          <div className="text-center space-y-4">
            <Target className="w-16 h-16 text-neon-green mx-auto animate-bounce-subtle" />
            <h2 className="font-orbitron text-3xl text-neon-green">You Got It!</h2>
            <p className="text-foreground font-orbitron text-5xl">{targetNumber}</p>
            <p className="text-muted-foreground font-rajdhani text-lg">
              Found in {attempts} {attempts === 1 ? 'attempt' : 'attempts'}!
            </p>
            {attempts === bestScore && (
              <p className="text-neon-orange font-orbitron animate-pulse-glow">New Best!</p>
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

export default NumberGuess;
