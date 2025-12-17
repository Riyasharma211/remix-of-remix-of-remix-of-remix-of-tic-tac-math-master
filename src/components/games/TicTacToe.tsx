import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Trophy } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';

type Player = 'X' | 'O' | null;
type Board = Player[];

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  y: number;
  delay: number;
  scale: number;
}

const winningCombinations = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6], // Diagonals
];

const REACTION_EMOJIS = ['😍', '💕', '🔥', '😂', '😤', '🥵', '💋', '😘', '🙈', '👏', '💯', '✨'];

const TicTacToe: React.FC = () => {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [winner, setWinner] = useState<Player>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const [isDraw, setIsDraw] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  const checkWinner = (board: Board): { winner: Player; line: number[] | null } => {
    for (const combination of winningCombinations) {
      const [a, b, c] = combination;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line: combination };
      }
    }
    return { winner: null, line: null };
  };

  // Spawn floating emojis
  const spawnFloatingEmojis = useCallback((emoji: string) => {
    const newEmojis: FloatingEmoji[] = [];
    for (let i = 0; i < 8; i++) {
      newEmojis.push({
        id: `${Date.now()}-${i}`,
        emoji,
        x: 20 + Math.random() * 60,
        y: 30 + Math.random() * 40,
        delay: i * 0.08,
        scale: 0.8 + Math.random() * 0.6,
      });
    }
    setFloatingEmojis(prev => [...prev, ...newEmojis]);
    
    // Clear after animation
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => !newEmojis.find(n => n.id === e.id)));
    }, 2500);
  }, []);

  // Handle reaction click
  const handleReaction = (emoji: string) => {
    haptics.light();
    soundManager.playEmojiSound(emoji);
    spawnFloatingEmojis(emoji);
  };

  const handleClick = (index: number) => {
    if (board[index] || winner || isDraw) return;

    haptics.light();
    soundManager.playLocalSound('click');

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);

    const result = checkWinner(newBoard);
    if (result.winner) {
      setWinner(result.winner);
      setWinningLine(result.line);
      setScores((prev) => ({
        ...prev,
        [result.winner as 'X' | 'O']: prev[result.winner as 'X' | 'O'] + 1,
      }));
      soundManager.playWinSound();
      haptics.success();
      // Auto celebration
      setTimeout(() => spawnFloatingEmojis('🎉'), 200);
      setTimeout(() => spawnFloatingEmojis('🏆'), 500);
    } else if (newBoard.every((cell) => cell !== null)) {
      setIsDraw(true);
      soundManager.playLocalSound('lose');
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
    }
  };

  const resetGame = () => {
    haptics.light();
    soundManager.playLocalSound('click');
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
    setWinningLine(null);
    setIsDraw(false);
  };

  const resetScores = () => {
    setScores({ X: 0, O: 0 });
    resetGame();
  };

  // Render floating emojis
  const renderFloatingEmojis = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {floatingEmojis.map((emoji) => (
        <div
          key={emoji.id}
          className="absolute animate-float-up text-4xl"
          style={{
            left: `${emoji.x}%`,
            top: `${emoji.y}%`,
            animationDelay: `${emoji.delay}s`,
            transform: `scale(${emoji.scale})`,
            opacity: 0,
            animation: `floatUp 2.5s ease-out ${emoji.delay}s forwards`,
          }}
        >
          {emoji.emoji}
        </div>
      ))}
      <style>{`
        @keyframes floatUp {
          0% { opacity: 0; transform: translateY(0) scale(0.5) rotate(0deg); }
          15% { opacity: 1; transform: translateY(-20px) scale(1.2) rotate(-5deg); }
          85% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-150px) scale(0.8) rotate(10deg); }
        }
      `}</style>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-6 relative">
      {renderFloatingEmojis()}
      
      {/* Scoreboard */}
      <div className="flex gap-8 items-center">
        <div className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-300 ${
          currentPlayer === 'X' && !winner && !isDraw
            ? 'border-neon-cyan box-glow-cyan bg-neon-cyan/10'
            : 'border-border bg-card'
        }`}>
          <span className="text-neon-cyan font-orbitron text-2xl font-bold">X</span>
          <span className="text-foreground font-orbitron text-3xl">{scores.X}</span>
        </div>
        
        <div className="text-muted-foreground font-rajdhani text-xl">VS</div>
        
        <div className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-300 ${
          currentPlayer === 'O' && !winner && !isDraw
            ? 'border-neon-pink box-glow-pink bg-neon-pink/10'
            : 'border-border bg-card'
        }`}>
          <span className="text-neon-pink font-orbitron text-2xl font-bold">O</span>
          <span className="text-foreground font-orbitron text-3xl">{scores.O}</span>
        </div>
      </div>

      {/* Game Status */}
      <div className="h-12 flex items-center justify-center">
        {winner ? (
          <div className="flex items-center gap-2 animate-scale-pop">
            <Trophy className="w-6 h-6 text-neon-orange" />
            <span className={`font-orbitron text-xl ${winner === 'X' ? 'text-neon-cyan' : 'text-neon-pink'}`}>
              Player {winner} Wins!
            </span>
          </div>
        ) : isDraw ? (
          <span className="font-orbitron text-xl text-neon-purple animate-scale-pop">It's a Draw!</span>
        ) : (
          <span className={`font-rajdhani text-lg ${currentPlayer === 'X' ? 'text-neon-cyan' : 'text-neon-pink'}`}>
            Player {currentPlayer}'s Turn
          </span>
        )}
      </div>

      {/* Game Board */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-card rounded-2xl border border-border">
        {board.map((cell, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 font-orbitron text-4xl font-bold
              transition-all duration-300 flex items-center justify-center
              ${cell ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'}
              ${winningLine?.includes(index) ? 'animate-pulse-glow' : ''}
              ${cell === 'X' 
                ? 'text-neon-cyan border-neon-cyan/50' 
                : cell === 'O' 
                  ? 'text-neon-pink border-neon-pink/50' 
                  : 'border-border hover:border-primary/50'
              }
              ${winningLine?.includes(index) && cell === 'X' ? 'box-glow-cyan bg-neon-cyan/10' : ''}
              ${winningLine?.includes(index) && cell === 'O' ? 'box-glow-pink bg-neon-pink/10' : ''}
            `}
          >
            {cell && (
              <span className="animate-scale-pop">{cell}</span>
            )}
          </button>
        ))}
      </div>

      {/* Reaction Bar */}
      <div className="flex flex-wrap gap-2 justify-center max-w-xs">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className="text-2xl p-2 rounded-full bg-muted/50 hover:bg-muted hover:scale-125 active:scale-95 transition-all duration-200"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <Button variant="neon" onClick={resetGame}>
          <RotateCcw className="w-4 h-4" />
          New Game
        </Button>
        <Button variant="ghost" onClick={resetScores}>
          Reset Scores
        </Button>
      </div>
    </div>
  );
};

export default TicTacToe;