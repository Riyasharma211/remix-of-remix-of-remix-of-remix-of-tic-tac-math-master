import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Palette, Play, RotateCcw, Trophy, Clock, Zap } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { useDifficulty } from '@/contexts/DifficultyContext';
import { haptics } from '@/utils/haptics';
import { celebrateBurst } from '@/utils/confetti';
import { useLeaderboard, GAME_TYPES } from '@/hooks/useLeaderboard';

type GameState = 'idle' | 'playing' | 'ended';

const COLORS = [
  { name: 'Red', class: 'bg-destructive', text: 'text-destructive' },
  { name: 'Blue', class: 'bg-neon-cyan', text: 'text-neon-cyan' },
  { name: 'Green', class: 'bg-neon-green', text: 'text-neon-green' },
  { name: 'Orange', class: 'bg-neon-orange', text: 'text-neon-orange' },
  { name: 'Purple', class: 'bg-neon-purple', text: 'text-neon-purple' },
  { name: 'Pink', class: 'bg-neon-pink', text: 'text-neon-pink' },
];

interface Challenge {
  word: string;
  wordColor: number;
  correctColor: number;
  mode: 'word' | 'color';
}

const ColorMatch: React.FC = () => {
  const { config, difficulty } = useDifficulty();
  const { addScore, isNewHighScore } = useLeaderboard();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [playerName] = useState(() => localStorage.getItem('mindgames-player-name') || 'Player');

  const generateChallenge = useCallback((): Challenge => {
    const wordIndex = Math.floor(Math.random() * COLORS.length);
    let colorIndex = Math.floor(Math.random() * COLORS.length);
    
    // Sometimes make word and color match (30% chance)
    if (Math.random() < 0.3) {
      colorIndex = wordIndex;
    }
    
    // Randomly choose mode: match the WORD or match the COLOR
    const mode = Math.random() < 0.5 ? 'word' : 'color';
    
    return {
      word: COLORS[wordIndex].name,
      wordColor: colorIndex,
      correctColor: mode === 'word' ? wordIndex : colorIndex,
      mode,
    };
  }, []);

  const startGame = () => {
    const time = difficulty === 'easy' ? 40 : difficulty === 'medium' ? 30 : 20;
    setTimeLeft(time);
    setScore(0);
    setStreak(0);
    setGameState('playing');
    setChallenge(generateChallenge());
    soundManager.playLocalSound('click');
  };

  const handleColorClick = (colorIndex: number) => {
    if (!challenge || feedback) return;

    if (colorIndex === challenge.correctColor) {
      setFeedback('correct');
      const newStreak = streak + 1;
      
      // Play different sounds based on streak
      if (newStreak >= 5 && newStreak % 5 === 0) {
        soundManager.playLocalSound('combo');
      } else {
        soundManager.playLocalSound('correct');
      }
      
      haptics.light();
      const points = 10 + streak * 2;
      setScore(prev => prev + points);
      setStreak(newStreak);
    } else {
      setFeedback('wrong');
      soundManager.playLocalSound('wrong');
      haptics.error();
      setStreak(0);
    }

    setTimeout(() => {
      setFeedback(null);
      setChallenge(generateChallenge());
    }, 300);
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameState('ended');
          const isHighScore = isNewHighScore(GAME_TYPES.COLOR_MATCH, score);
          if (score > highScore) setHighScore(score);
          
          // Save to leaderboard
          if (score > 0) {
            addScore(GAME_TYPES.COLOR_MATCH, playerName, score, `Streak: ${streak}`);
          }
          
          if (isHighScore && score > 0) {
            soundManager.playLocalSound('win');
            haptics.success();
            celebrateBurst();
          } else {
            soundManager.playLocalSound('lose');
            haptics.light();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, score, highScore, streak, playerName, addScore, isNewHighScore]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      {gameState === 'idle' && (
        <div className="flex flex-col items-center gap-6 animate-slide-in">
          <div className="text-center space-y-2">
            <Palette className="w-16 h-16 text-neon-pink mx-auto animate-float" />
            <h2 className="font-orbitron text-2xl text-foreground">Color Match</h2>
            <p className="text-muted-foreground font-rajdhani max-w-xs">
              Match the WORD or the COLOR based on the instruction!
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

      {gameState === 'playing' && challenge && (
        <div className="flex flex-col items-center gap-6 w-full animate-slide-in">
          {/* Stats */}
          <div className="flex justify-between w-full px-4">
            <div className="flex items-center gap-2">
              <Zap className={`w-5 h-5 ${streak > 0 ? 'text-neon-orange' : 'text-muted-foreground'}`} />
              <span className="font-orbitron text-lg">{streak}x</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${timeLeft <= 10 ? 'text-destructive animate-pulse' : 'text-neon-cyan'}`} />
              <span className={`font-orbitron text-xl ${timeLeft <= 10 ? 'text-destructive' : ''}`}>
                {timeLeft}s
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-neon-green" />
              <span className="font-orbitron text-lg">{score}</span>
            </div>
          </div>

          {/* Instruction */}
          <div className="text-center">
            <span className="font-rajdhani text-muted-foreground">
              Select the color of the
            </span>
            <span className={`font-orbitron text-lg ml-2 ${challenge.mode === 'word' ? 'text-neon-cyan' : 'text-neon-pink'}`}>
              {challenge.mode === 'word' ? 'WORD' : 'TEXT COLOR'}
            </span>
          </div>

          {/* Challenge Word */}
          <div className={`p-8 rounded-2xl border-2 transition-all duration-300 w-full text-center
            ${feedback === 'correct' ? 'border-neon-green bg-neon-green/10' :
              feedback === 'wrong' ? 'border-destructive bg-destructive/10' :
              'border-border bg-card'}`}
          >
            <span className={`font-orbitron text-5xl ${COLORS[challenge.wordColor].text}`}>
              {challenge.word}
            </span>
          </div>

          {/* Color Options */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {COLORS.map((color, index) => (
              <button
                key={color.name}
                onClick={() => handleColorClick(index)}
                disabled={feedback !== null}
                className={`h-16 rounded-xl ${color.class} transition-all duration-200
                  hover:scale-105 hover:shadow-lg active:scale-95
                  ${feedback !== null && index === challenge.correctColor ? 'ring-4 ring-neon-green' : ''}
                `}
              />
            ))}
          </div>
        </div>
      )}

      {gameState === 'ended' && (
        <div className="flex flex-col items-center gap-6 animate-slide-in">
          <div className="text-center space-y-4">
            <h2 className="font-orbitron text-3xl text-foreground">Time's Up!</h2>
            <p className="font-orbitron text-5xl text-neon-cyan">{score}</p>
            <p className="text-muted-foreground font-rajdhani">Points Scored</p>
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

export default ColorMatch;
