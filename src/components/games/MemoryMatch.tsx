import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Brain, Trophy, Clock } from 'lucide-react';

const EMOJIS = ['🚀', '⭐', '🎮', '🎯', '💎', '🔥', '⚡', '🎪'];

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const createCards = (): Card[] => {
  const pairs = [...EMOJIS, ...EMOJIS];
  const shuffled = shuffleArray(pairs);
  return shuffled.map((emoji, index) => ({
    id: index,
    emoji,
    isFlipped: false,
    isMatched: false,
  }));
};

const MemoryMatch: React.FC = () => {
  const [cards, setCards] = useState<Card[]>(createCards());
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bestTime, setBestTime] = useState<number | null>(null);

  useEffect(() => {
    if (!isPlaying || gameComplete) return;
    
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isPlaying, gameComplete]);

  useEffect(() => {
    if (matches === EMOJIS.length) {
      setGameComplete(true);
      setIsPlaying(false);
      if (bestTime === null || timer < bestTime) {
        setBestTime(timer);
      }
    }
  }, [matches, timer, bestTime]);

  const handleCardClick = (id: number) => {
    if (isLocked || flippedCards.includes(id) || cards[id].isMatched) return;
    
    if (!isPlaying) setIsPlaying(true);

    const newFlippedCards = [...flippedCards, id];
    setFlippedCards(newFlippedCards);
    
    setCards((prev) =>
      prev.map((card) =>
        card.id === id ? { ...card, isFlipped: true } : card
      )
    );

    if (newFlippedCards.length === 2) {
      setMoves((prev) => prev + 1);
      setIsLocked(true);
      
      const [first, second] = newFlippedCards;
      
      if (cards[first].emoji === cards[second].emoji) {
        setCards((prev) =>
          prev.map((card) =>
            card.id === first || card.id === second
              ? { ...card, isMatched: true }
              : card
          )
        );
        setMatches((prev) => prev + 1);
        setFlippedCards([]);
        setIsLocked(false);
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((card) =>
              card.id === first || card.id === second
                ? { ...card, isFlipped: false }
                : card
            )
          );
          setFlippedCards([]);
          setIsLocked(false);
        }, 800);
      }
    }
  };

  const resetGame = () => {
    setCards(createCards());
    setFlippedCards([]);
    setMoves(0);
    setMatches(0);
    setIsLocked(false);
    setGameComplete(false);
    setTimer(0);
    setIsPlaying(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="w-8 h-8 text-neon-purple" />
        <h2 className="font-orbitron text-2xl text-foreground">Memory Match</h2>
      </div>

      {/* Stats */}
      <div className="flex gap-6 items-center">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-neon-cyan" />
          <span className="font-orbitron text-lg">{formatTime(timer)}</span>
        </div>
        
        <div className="text-center">
          <span className="font-orbitron text-lg text-muted-foreground">Moves</span>
          <p className="font-orbitron text-2xl text-foreground">{moves}</p>
        </div>
        
        <div className="text-center">
          <span className="font-orbitron text-lg text-muted-foreground">Pairs</span>
          <p className="font-orbitron text-2xl text-neon-green">{matches}/{EMOJIS.length}</p>
        </div>
      </div>

      {bestTime !== null && !gameComplete && (
        <div className="flex items-center gap-2 text-neon-orange">
          <Trophy className="w-4 h-4" />
          <span className="font-rajdhani">Best: {formatTime(bestTime)}</span>
        </div>
      )}

      {/* Game Board */}
      <div className="grid grid-cols-4 gap-3 p-4 bg-card rounded-2xl border border-border">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            disabled={isLocked || card.isMatched}
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl transition-all duration-300 flex items-center justify-center text-3xl
              ${card.isFlipped || card.isMatched
                ? 'bg-muted border-2 border-primary/50 rotate-0'
                : 'bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border-2 border-border hover:border-primary/50 cursor-pointer'
              }
              ${card.isMatched ? 'box-glow-cyan opacity-80' : ''}
            `}
            style={{
              transform: card.isFlipped || card.isMatched ? 'rotateY(0deg)' : 'rotateY(180deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            {(card.isFlipped || card.isMatched) && (
              <span className="animate-scale-pop">{card.emoji}</span>
            )}
          </button>
        ))}
      </div>

      {/* Game Complete Message */}
      {gameComplete && (
        <div className="text-center space-y-4 animate-slide-in">
          <div className="flex items-center justify-center gap-2 text-neon-green">
            <Trophy className="w-8 h-8" />
            <span className="font-orbitron text-2xl">Congratulations!</span>
          </div>
          <p className="text-muted-foreground font-rajdhani text-lg">
            Completed in {formatTime(timer)} with {moves} moves
          </p>
          {timer === bestTime && (
            <p className="text-neon-orange font-orbitron animate-pulse-glow">New Best Time!</p>
          )}
        </div>
      )}

      {/* Controls */}
      <Button variant="neon-purple" onClick={resetGame}>
        <RotateCcw className="w-4 h-4" />
        {gameComplete ? 'Play Again' : 'Reset'}
      </Button>
    </div>
  );
};

export default MemoryMatch;
