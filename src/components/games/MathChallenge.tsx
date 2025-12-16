import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw, Zap, Clock, Target } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateBurst } from '@/utils/confetti';
import { useLeaderboard, GAME_TYPES } from '@/hooks/useLeaderboard';

type Operator = '+' | '-' | '×' | '÷';

interface Problem {
  num1: number;
  num2: number;
  operator: Operator;
  answer: number;
}

const generateProblem = (difficulty: number): Problem => {
  const operators: Operator[] = ['+', '-', '×', '÷'];
  const operator = operators[Math.floor(Math.random() * operators.length)];
  
  let num1: number, num2: number, answer: number;
  const maxNum = Math.min(10 + difficulty * 5, 50);
  
  switch (operator) {
    case '+':
      num1 = Math.floor(Math.random() * maxNum) + 1;
      num2 = Math.floor(Math.random() * maxNum) + 1;
      answer = num1 + num2;
      break;
    case '-':
      num1 = Math.floor(Math.random() * maxNum) + 10;
      num2 = Math.floor(Math.random() * num1) + 1;
      answer = num1 - num2;
      break;
    case '×':
      num1 = Math.floor(Math.random() * 12) + 1;
      num2 = Math.floor(Math.random() * 12) + 1;
      answer = num1 * num2;
      break;
    case '÷':
      num2 = Math.floor(Math.random() * 10) + 2;
      answer = Math.floor(Math.random() * 10) + 1;
      num1 = num2 * answer;
      break;
    default:
      num1 = 1;
      num2 = 1;
      answer = 2;
  }
  
  return { num1, num2, operator, answer };
};

const generateOptions = (answer: number): number[] => {
  const options = new Set<number>([answer]);
  while (options.size < 4) {
    const offset = Math.floor(Math.random() * 20) - 10;
    const option = Math.max(0, answer + offset);
    if (option !== answer) options.add(option);
  }
  return Array.from(options).sort(() => Math.random() - 0.5);
};

const MathChallenge: React.FC = () => {
  const { addScore, isNewHighScore } = useLeaderboard();
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'ended'>('idle');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [options, setOptions] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [difficulty, setDifficulty] = useState(1);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [playerName] = useState(() => localStorage.getItem('mindgames-player-name') || 'Player');

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setStreak(0);
    setTimeLeft(30);
    setDifficulty(1);
    nextProblem(1);
    soundManager.playLocalSound('click');
  };

  const nextProblem = useCallback((diff: number) => {
    const newProblem = generateProblem(diff);
    setProblem(newProblem);
    setOptions(generateOptions(newProblem.answer));
    setFeedback(null);
  }, []);

  const handleAnswer = (answer: number) => {
    if (!problem || feedback) return;
    
    if (answer === problem.answer) {
      setFeedback('correct');
      soundManager.playLocalSound('correct');
      const points = 10 + streak * 2 + difficulty * 5;
      setScore((prev) => prev + points);
      setStreak((prev) => prev + 1);
      
      if (streak > 0 && streak % 5 === 0) {
        setDifficulty((prev) => Math.min(prev + 1, 5));
      }
      
      setTimeout(() => nextProblem(difficulty), 300);
    } else {
      setFeedback('wrong');
      soundManager.playLocalSound('wrong');
      setStreak(0);
      setTimeout(() => nextProblem(difficulty), 500);
    }
  };

  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameState('ended');
          const isHighScore = isNewHighScore(GAME_TYPES.MATH_CHALLENGE, score);
          setHighScore((hs) => Math.max(hs, score));
          
          // Save to leaderboard
          if (score > 0) {
            addScore(GAME_TYPES.MATH_CHALLENGE, playerName, score, `Streak: ${streak}, Difficulty: ${difficulty}`);
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
        if (prev <= 5) {
          soundManager.playLocalSound('tick');
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gameState, score, highScore, streak, difficulty, playerName, addScore, isNewHighScore]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      {gameState === 'idle' && (
        <div className="flex flex-col items-center gap-6 animate-slide-in">
          <div className="text-center space-y-2">
            <Zap className="w-16 h-16 text-neon-orange mx-auto animate-float" />
            <h2 className="font-orbitron text-2xl text-foreground">Math Speed Challenge</h2>
            <p className="text-muted-foreground font-rajdhani">
              Solve as many problems as you can in 30 seconds!
            </p>
          </div>
          
          {highScore > 0 && (
            <div className="flex items-center gap-2 text-neon-green">
              <Target className="w-5 h-5" />
              <span className="font-orbitron">Best: {highScore}</span>
            </div>
          )}
          
          <Button variant="game" size="xl" onClick={startGame}>
            <Play className="w-5 h-5" />
            Start Challenge
          </Button>
        </div>
      )}

      {gameState === 'playing' && problem && (
        <div className="flex flex-col items-center gap-6 w-full animate-slide-in">
          {/* Stats */}
          <div className="flex justify-between w-full px-4">
            <div className="flex items-center gap-2">
              <Zap className={`w-5 h-5 ${streak > 0 ? 'text-neon-orange' : 'text-muted-foreground'}`} />
              <span className="font-orbitron text-lg">{streak}x</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${timeLeft <= 10 ? 'text-destructive animate-pulse' : 'text-neon-cyan'}`} />
              <span className={`font-orbitron text-xl ${timeLeft <= 10 ? 'text-destructive' : 'text-foreground'}`}>
                {timeLeft}s
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-neon-green" />
              <span className="font-orbitron text-lg">{score}</span>
            </div>
          </div>

          {/* Problem */}
          <div className={`text-center p-8 rounded-2xl border-2 transition-all duration-300 w-full ${
            feedback === 'correct' 
              ? 'border-neon-green bg-neon-green/10' 
              : feedback === 'wrong'
                ? 'border-destructive bg-destructive/10'
                : 'border-border bg-card'
          }`}>
            <span className="font-orbitron text-4xl sm:text-5xl text-foreground">
              {problem.num1} {problem.operator} {problem.num2} = ?
            </span>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4 w-full">
            {options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(option)}
                disabled={feedback !== null}
                className={`p-4 rounded-xl border-2 font-orbitron text-2xl transition-all duration-200
                  ${feedback === null 
                    ? 'border-border bg-card hover:border-primary hover:bg-primary/10 cursor-pointer' 
                    : option === problem.answer
                      ? 'border-neon-green bg-neon-green/20'
                      : 'border-border bg-card opacity-50'
                  }
                `}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {gameState === 'ended' && (
        <div className="flex flex-col items-center gap-6 animate-slide-in">
          <div className="text-center space-y-4">
            <h2 className="font-orbitron text-3xl text-foreground">Time's Up!</h2>
            <div className="space-y-2">
              <p className="font-orbitron text-5xl text-neon-cyan">{score}</p>
              <p className="text-muted-foreground font-rajdhani">Points Scored</p>
            </div>
            
            {score >= highScore && score > 0 && (
              <div className="flex items-center justify-center gap-2 text-neon-orange animate-pulse-glow">
                <Target className="w-6 h-6" />
                <span className="font-orbitron text-xl">New High Score!</span>
              </div>
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

export default MathChallenge;
