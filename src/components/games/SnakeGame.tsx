import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Play, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateBurst } from '@/utils/confetti';
import { useLeaderboard, GAME_TYPES } from '@/hooks/useLeaderboard';
import { useDifficulty } from '@/contexts/DifficultyContext';

const GRID_SIZE = 15;
const CELL_SIZE = 20;

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };

const SPEED_BY_DIFFICULTY = {
  easy: 200,
  medium: 130,
  hard: 80,
};

const SnakeGame: React.FC = () => {
  const { addScore } = useLeaderboard();
  const { difficulty } = useDifficulty();
  const [playerName] = useState(() => localStorage.getItem('mindgames-player-name') || 'Player');
  
  const [snake, setSnake] = useState<Position[]>([{ x: 7, y: 7 }]);
  const [food, setFood] = useState<Position>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  
  const directionRef = useRef(direction);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  const speed = SPEED_BY_DIFFICULTY[difficulty];

  const generateFood = useCallback((currentSnake: Position[]): Position => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    return newFood;
  }, []);

  const resetGame = useCallback(() => {
    const initialSnake = [{ x: 7, y: 7 }];
    setSnake(initialSnake);
    setFood(generateFood(initialSnake));
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setScore(0);
    setIsGameOver(false);
  }, [generateFood]);

  const startGame = () => {
    resetGame();
    setIsPlaying(true);
    soundManager.playLocalSound('start');
    haptics.light();
  };

  const endGame = useCallback(() => {
    setIsPlaying(false);
    setIsGameOver(true);
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }
    
    soundManager.playLocalSound('lose');
    haptics.error();
    
    if (score > 0) {
      if (bestScore === null || score > bestScore) {
        setBestScore(score);
        celebrateBurst();
      }
      addScore(GAME_TYPES.SNAKE_GAME || 'snake-game', playerName, score, `${snake.length} length`);
    }
  }, [score, bestScore, snake.length, playerName, addScore]);

  const moveSnake = useCallback(() => {
    setSnake(currentSnake => {
      const head = currentSnake[0];
      const dir = directionRef.current;
      
      let newHead: Position;
      switch (dir) {
        case 'UP':
          newHead = { x: head.x, y: head.y - 1 };
          break;
        case 'DOWN':
          newHead = { x: head.x, y: head.y + 1 };
          break;
        case 'LEFT':
          newHead = { x: head.x - 1, y: head.y };
          break;
        case 'RIGHT':
          newHead = { x: head.x + 1, y: head.y };
          break;
      }

      // Check wall collision
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
        endGame();
        return currentSnake;
      }

      // Check self collision
      if (currentSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        endGame();
        return currentSnake;
      }

      const newSnake = [newHead, ...currentSnake];

      // Check food collision
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(prev => prev + 10);
        setFood(generateFood(newSnake));
        soundManager.playLocalSound('pop');
        haptics.light();
        return newSnake;
      }

      newSnake.pop();
      return newSnake;
    });
  }, [food, generateFood, endGame]);

  // Game loop
  useEffect(() => {
    if (!isPlaying) return;
    
    gameLoopRef.current = setInterval(moveSnake, speed);
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [isPlaying, moveSnake, speed]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      
      const currentDir = directionRef.current;
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (currentDir !== 'DOWN') {
            setDirection('UP');
            directionRef.current = 'UP';
          }
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (currentDir !== 'UP') {
            setDirection('DOWN');
            directionRef.current = 'DOWN';
          }
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (currentDir !== 'RIGHT') {
            setDirection('LEFT');
            directionRef.current = 'LEFT';
          }
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (currentDir !== 'LEFT') {
            setDirection('RIGHT');
            directionRef.current = 'RIGHT';
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  const handleDirectionButton = (newDir: Direction) => {
    if (!isPlaying) return;
    const currentDir = directionRef.current;
    
    if (
      (newDir === 'UP' && currentDir !== 'DOWN') ||
      (newDir === 'DOWN' && currentDir !== 'UP') ||
      (newDir === 'LEFT' && currentDir !== 'RIGHT') ||
      (newDir === 'RIGHT' && currentDir !== 'LEFT')
    ) {
      setDirection(newDir);
      directionRef.current = newDir;
      haptics.light();
    }
  };

  if (!isPlaying && !isGameOver) {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-2">
          <div className="text-5xl animate-float">🐍</div>
          <h2 className="font-orbitron text-2xl text-foreground">Snake</h2>
          <p className="text-muted-foreground font-rajdhani max-w-sm">
            Use arrow keys or buttons to move. Eat food to grow!
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
          Start Game
        </Button>
      </div>
    );
  }

  if (isGameOver) {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-4">
          <div className="text-5xl">💀</div>
          <h2 className="font-orbitron text-2xl text-foreground">Game Over!</h2>
          <p className="font-orbitron text-4xl text-neon-green">{score} points</p>
          <p className="text-muted-foreground">Snake length: {snake.length}</p>
          {score === bestScore && score > 0 && (
            <p className="text-neon-orange font-orbitron animate-pulse">New Best!</p>
          )}
        </div>
        <Button variant="game" size="xl" onClick={startGame}>
          <RotateCcw className="w-5 h-5" />
          Play Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 animate-slide-in">
      {/* Score */}
      <div className="flex items-center gap-4">
        <span className="font-orbitron text-2xl text-neon-green">{score}</span>
        {bestScore !== null && (
          <span className="text-muted-foreground text-sm">Best: {bestScore}</span>
        )}
      </div>

      {/* Game Board */}
      <div 
        className="relative bg-card border-2 border-border rounded-lg overflow-hidden"
        style={{ 
          width: GRID_SIZE * CELL_SIZE, 
          height: GRID_SIZE * CELL_SIZE 
        }}
      >
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: GRID_SIZE }).map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute w-full border-t border-border"
              style={{ top: i * CELL_SIZE }}
            />
          ))}
          {Array.from({ length: GRID_SIZE }).map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute h-full border-l border-border"
              style={{ left: i * CELL_SIZE }}
            />
          ))}
        </div>

        {/* Snake */}
        {snake.map((segment, index) => (
          <div
            key={index}
            className={`absolute rounded-sm transition-all duration-75 ${
              index === 0 
                ? 'bg-neon-green shadow-[0_0_10px_hsl(var(--neon-green)/0.5)]' 
                : 'bg-neon-green/70'
            }`}
            style={{
              left: segment.x * CELL_SIZE + 1,
              top: segment.y * CELL_SIZE + 1,
              width: CELL_SIZE - 2,
              height: CELL_SIZE - 2,
            }}
          />
        ))}

        {/* Food */}
        <div
          className="absolute flex items-center justify-center text-sm animate-pulse"
          style={{
            left: food.x * CELL_SIZE,
            top: food.y * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
          }}
        >
          🍎
        </div>
      </div>

      {/* Mobile Controls */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        <div />
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleDirectionButton('UP')}
          className="h-12 w-12"
        >
          <ArrowUp className="w-6 h-6" />
        </Button>
        <div />
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleDirectionButton('LEFT')}
          className="h-12 w-12"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleDirectionButton('DOWN')}
          className="h-12 w-12"
        >
          <ArrowDown className="w-6 h-6" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleDirectionButton('RIGHT')}
          className="h-12 w-12"
        >
          <ArrowRight className="w-6 h-6" />
        </Button>
      </div>

      <p className="text-muted-foreground text-xs hidden sm:block">
        Use arrow keys or WASD to move
      </p>
    </div>
  );
};

export default SnakeGame;
