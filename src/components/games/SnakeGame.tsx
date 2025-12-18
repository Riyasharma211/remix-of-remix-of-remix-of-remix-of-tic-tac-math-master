import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Play, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Zap, Shield, Clock, Gem } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateBurst } from '@/utils/confetti';
import { useLeaderboard, GAME_TYPES } from '@/hooks/useLeaderboard';
import { useDifficulty } from '@/contexts/DifficultyContext';

const GRID_SIZE = 15;
const CELL_SIZE = 20;

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type PowerUpType = 'speed' | 'invincible' | 'slow' | 'double';

interface PowerUp {
  type: PowerUpType;
  position: Position;
  expiresAt: number;
}

interface ActivePowerUp {
  type: PowerUpType;
  endsAt: number;
}

const SPEED_BY_DIFFICULTY = {
  easy: 200,
  medium: 130,
  hard: 80,
};

const POWER_UP_CONFIG: Record<PowerUpType, { emoji: string; duration: number; color: string; label: string }> = {
  speed: { emoji: '⚡', duration: 5000, color: 'text-neon-orange', label: 'Speed Boost' },
  invincible: { emoji: '🛡️', duration: 5000, color: 'text-neon-cyan', label: 'Invincible' },
  slow: { emoji: '🐢', duration: 5000, color: 'text-neon-blue', label: 'Slow Mode' },
  double: { emoji: '💎', duration: 8000, color: 'text-neon-purple', label: '2x Points' },
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
  const [powerUp, setPowerUp] = useState<PowerUp | null>(null);
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  
  const directionRef = useRef(direction);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const powerUpSpawnRef = useRef<NodeJS.Timeout | null>(null);

  const baseSpeed = SPEED_BY_DIFFICULTY[difficulty];
  
  // Calculate current speed based on active power-ups
  const currentSpeed = useCallback(() => {
    const hasSpeed = activePowerUps.some(p => p.type === 'speed');
    const hasSlow = activePowerUps.some(p => p.type === 'slow');
    if (hasSpeed) return Math.max(50, baseSpeed * 0.5);
    if (hasSlow) return baseSpeed * 1.5;
    return baseSpeed;
  }, [activePowerUps, baseSpeed]);

  const isInvincible = activePowerUps.some(p => p.type === 'invincible');
  const hasDoublePoints = activePowerUps.some(p => p.type === 'double');

  const generatePosition = useCallback((currentSnake: Position[], excludePositions: Position[] = []): Position => {
    let pos: Position;
    const allExcluded = [...currentSnake, ...excludePositions];
    do {
      pos = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (allExcluded.some(p => p.x === pos.x && p.y === pos.y));
    return pos;
  }, []);

  const spawnPowerUp = useCallback(() => {
    if (powerUp) return;
    
    const types: PowerUpType[] = ['speed', 'invincible', 'slow', 'double'];
    const type = types[Math.floor(Math.random() * types.length)];
    const position = generatePosition(snake, [food]);
    
    setPowerUp({
      type,
      position,
      expiresAt: Date.now() + 6000, // Power-up disappears after 6 seconds
    });
    
    soundManager.playLocalSound('ding');
  }, [powerUp, snake, food, generatePosition]);

  const resetGame = useCallback(() => {
    const initialSnake = [{ x: 7, y: 7 }];
    setSnake(initialSnake);
    setFood(generatePosition(initialSnake));
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setScore(0);
    setIsGameOver(false);
    setPowerUp(null);
    setActivePowerUps([]);
  }, [generatePosition]);

  const startGame = () => {
    resetGame();
    setIsPlaying(true);
    soundManager.playLocalSound('start');
    haptics.light();
  };

  const endGame = useCallback(() => {
    setIsPlaying(false);
    setIsGameOver(true);
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    if (powerUpSpawnRef.current) clearInterval(powerUpSpawnRef.current);
    
    soundManager.playLocalSound('lose');
    haptics.error();
    
    if (score > 0) {
      if (bestScore === null || score > bestScore) {
        setBestScore(score);
        celebrateBurst();
      }
      addScore(GAME_TYPES.SNAKE_GAME, playerName, score, `${snake.length} length`);
    }
  }, [score, bestScore, snake.length, playerName, addScore]);

  const collectPowerUp = useCallback((type: PowerUpType) => {
    const config = POWER_UP_CONFIG[type];
    
    // Remove existing power-up of same type and add new one
    setActivePowerUps(prev => [
      ...prev.filter(p => p.type !== type),
      { type, endsAt: Date.now() + config.duration }
    ]);
    
    setPowerUp(null);
    soundManager.playLocalSound('levelup');
    haptics.success();
  }, []);

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

      // Check wall collision (wrap around if invincible)
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
        if (isInvincible) {
          // Wrap around
          newHead.x = (newHead.x + GRID_SIZE) % GRID_SIZE;
          newHead.y = (newHead.y + GRID_SIZE) % GRID_SIZE;
        } else {
          endGame();
          return currentSnake;
        }
      }

      // Check self collision (ignore if invincible)
      if (currentSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        if (!isInvincible) {
          endGame();
          return currentSnake;
        }
      }

      const newSnake = [newHead, ...currentSnake];

      // Check power-up collision
      if (powerUp && newHead.x === powerUp.position.x && newHead.y === powerUp.position.y) {
        collectPowerUp(powerUp.type);
      }

      // Check food collision
      if (newHead.x === food.x && newHead.y === food.y) {
        const points = hasDoublePoints ? 20 : 10;
        setScore(prev => prev + points);
        setFood(generatePosition(newSnake, powerUp ? [powerUp.position] : []));
        soundManager.playLocalSound('pop');
        haptics.light();
        return newSnake;
      }

      newSnake.pop();
      return newSnake;
    });
  }, [food, generatePosition, endGame, isInvincible, powerUp, collectPowerUp, hasDoublePoints]);

  // Game loop - restart when speed changes
  useEffect(() => {
    if (!isPlaying) return;
    
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    gameLoopRef.current = setInterval(moveSnake, currentSpeed());
    
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, moveSnake, currentSpeed]);

  // Power-up spawning
  useEffect(() => {
    if (!isPlaying) return;
    
    powerUpSpawnRef.current = setInterval(() => {
      if (Math.random() < 0.3) { // 30% chance every 5 seconds
        spawnPowerUp();
      }
    }, 5000);
    
    return () => {
      if (powerUpSpawnRef.current) clearInterval(powerUpSpawnRef.current);
    };
  }, [isPlaying, spawnPowerUp]);

  // Power-up expiration
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Remove expired power-up from field
      if (powerUp && now > powerUp.expiresAt) {
        setPowerUp(null);
      }
      
      // Remove expired active power-ups
      setActivePowerUps(prev => prev.filter(p => p.endsAt > now));
    }, 100);
    
    return () => clearInterval(interval);
  }, [isPlaying, powerUp]);

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

  const getSnakeColor = () => {
    if (isInvincible) return 'bg-neon-cyan shadow-[0_0_15px_hsl(var(--neon-cyan)/0.7)]';
    if (activePowerUps.some(p => p.type === 'speed')) return 'bg-neon-orange shadow-[0_0_15px_hsl(var(--neon-orange)/0.7)]';
    if (activePowerUps.some(p => p.type === 'double')) return 'bg-neon-purple shadow-[0_0_15px_hsl(var(--neon-purple)/0.7)]';
    return 'bg-neon-green shadow-[0_0_10px_hsl(var(--neon-green)/0.5)]';
  };

  if (!isPlaying && !isGameOver) {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-2">
          <div className="text-5xl animate-float">🐍</div>
          <h2 className="font-orbitron text-2xl text-foreground">Snake</h2>
          <p className="text-muted-foreground font-rajdhani max-w-sm">
            Eat food to grow! Collect power-ups for special abilities.
          </p>
        </div>

        {/* Power-up legend */}
        <div className="flex flex-wrap gap-3 justify-center text-xs">
          {Object.entries(POWER_UP_CONFIG).map(([type, config]) => (
            <div key={type} className={`flex items-center gap-1 ${config.color}`}>
              <span>{config.emoji}</span>
              <span className="font-rajdhani">{config.label}</span>
            </div>
          ))}
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
    <div className="flex flex-col items-center gap-3 animate-slide-in">
      {/* Score & Active Power-ups */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <span className="font-orbitron text-2xl text-neon-green">{score}</span>
          {bestScore !== null && (
            <span className="text-muted-foreground text-sm">Best: {bestScore}</span>
          )}
        </div>
        
        {/* Active power-ups display */}
        {activePowerUps.length > 0 && (
          <div className="flex gap-2">
            {activePowerUps.map((ap) => {
              const config = POWER_UP_CONFIG[ap.type];
              const remaining = Math.max(0, Math.ceil((ap.endsAt - Date.now()) / 1000));
              return (
                <div
                  key={ap.type}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full bg-card border border-border text-xs ${config.color}`}
                >
                  <span>{config.emoji}</span>
                  <span className="font-orbitron">{remaining}s</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Game Board */}
      <div 
        className={`relative bg-card border-2 rounded-lg overflow-hidden transition-all duration-300 ${
          isInvincible ? 'border-neon-cyan shadow-[0_0_20px_hsl(var(--neon-cyan)/0.3)]' : 'border-border'
        }`}
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

        {/* Power-up */}
        {powerUp && (
          <div
            className="absolute flex items-center justify-center text-base animate-pulse"
            style={{
              left: powerUp.position.x * CELL_SIZE,
              top: powerUp.position.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
            }}
          >
            {POWER_UP_CONFIG[powerUp.type].emoji}
          </div>
        )}

        {/* Snake */}
        {snake.map((segment, index) => (
          <div
            key={index}
            className={`absolute rounded-sm transition-all duration-75 ${
              index === 0 ? getSnakeColor() : 'bg-neon-green/70'
            } ${isInvincible && index === 0 ? 'animate-pulse' : ''}`}
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
          {hasDoublePoints ? '🍇' : '🍎'}
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
