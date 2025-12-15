import React, { useState } from 'react';
import { Grid3X3, Zap, Brain, Gamepad2 } from 'lucide-react';
import TicTacToe from '@/components/games/TicTacToe';
import MathChallenge from '@/components/games/MathChallenge';
import MemoryMatch from '@/components/games/MemoryMatch';
import GameCard from '@/components/GameCard';

type GameType = 'tictactoe' | 'math' | 'memory';

const games = [
  {
    id: 'tictactoe' as GameType,
    title: 'Tic Tac Toe',
    description: '2-Player classic strategy game',
    icon: Grid3X3,
    color: 'cyan' as const,
  },
  {
    id: 'math' as GameType,
    title: 'Math Challenge',
    description: 'Speed math puzzles',
    icon: Zap,
    color: 'orange' as const,
  },
  {
    id: 'memory' as GameType,
    title: 'Memory Match',
    description: 'Test your memory skills',
    icon: Brain,
    color: 'purple' as const,
  },
];

const Index: React.FC = () => {
  const [activeGame, setActiveGame] = useState<GameType>('tictactoe');

  const renderGame = () => {
    switch (activeGame) {
      case 'tictactoe':
        return <TicTacToe />;
      case 'math':
        return <MathChallenge />;
      case 'memory':
        return <MemoryMatch />;
      default:
        return <TicTacToe />;
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grid-pattern relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12 animate-slide-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Gamepad2 className="w-10 h-10 text-neon-cyan animate-float" />
            <h1 className="font-orbitron text-4xl sm:text-5xl font-bold text-foreground">
              <span className="text-neon-cyan text-glow-cyan">MIND</span>
              <span className="text-neon-purple text-glow-purple">GAMES</span>
            </h1>
          </div>
          <p className="text-muted-foreground font-rajdhani text-lg max-w-md mx-auto">
            Challenge your mind with classic games and puzzles
          </p>
        </header>

        {/* Main Content */}
        <div className="grid lg:grid-cols-[320px_1fr] gap-8 max-w-6xl mx-auto">
          {/* Game Selector */}
          <aside className="space-y-4">
            <h2 className="font-orbitron text-sm text-muted-foreground uppercase tracking-widest mb-4">
              Select Game
            </h2>
            {games.map((game, index) => (
              <div
                key={game.id}
                className="animate-slide-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <GameCard
                  title={game.title}
                  description={game.description}
                  icon={game.icon}
                  color={game.color}
                  isActive={activeGame === game.id}
                  onClick={() => setActiveGame(game.id)}
                />
              </div>
            ))}
          </aside>

          {/* Game Area */}
          <main className="bg-card/50 backdrop-blur-sm rounded-3xl border border-border p-6 sm:p-8 min-h-[500px] flex items-center justify-center">
            <div key={activeGame} className="w-full animate-slide-in">
              {renderGame()}
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="text-center mt-12 text-muted-foreground font-rajdhani text-sm">
          <p>Train your brain. Challenge your friends. Have fun!</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
