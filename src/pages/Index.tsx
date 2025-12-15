import React, { useState } from 'react';
import { Grid3X3, Zap, Brain, Target, Gamepad2, Volume2, VolumeX, Timer, Sparkles, Palette, Swords } from 'lucide-react';
import TicTacToeOnline from '@/components/games/TicTacToeOnline';
import MathChallenge from '@/components/games/MathChallenge';
import MemoryMatch from '@/components/games/MemoryMatch';
import NumberGuess from '@/components/games/NumberGuess';
import ReactionTime from '@/components/games/ReactionTime';
import PatternMemory from '@/components/games/PatternMemory';
import ColorMatch from '@/components/games/ColorMatch';
import MathBattle from '@/components/games/MathBattle';
import GameCard from '@/components/GameCard';
import DifficultySelector from '@/components/DifficultySelector';
import { Button } from '@/components/ui/button';
import { soundManager } from '@/utils/soundManager';
import { DifficultyProvider } from '@/contexts/DifficultyContext';

type GameType = 'tictactoe' | 'math' | 'memory' | 'numberguess' | 'reaction' | 'pattern' | 'colormatch' | 'mathbattle';

const games = [
  {
    id: 'tictactoe' as GameType,
    title: 'Tic Tac Toe',
    description: 'Online multiplayer',
    icon: Grid3X3,
    color: 'cyan' as const,
    multiplayer: true,
  },
  {
    id: 'mathbattle' as GameType,
    title: 'Math Battle',
    description: 'Online math race',
    icon: Swords,
    color: 'orange' as const,
    multiplayer: true,
  },
  {
    id: 'math' as GameType,
    title: 'Math Challenge',
    description: 'Speed math puzzles',
    icon: Zap,
    color: 'orange' as const,
    multiplayer: false,
  },
  {
    id: 'pattern' as GameType,
    title: 'Pattern Memory',
    description: 'Simon Says style',
    icon: Sparkles,
    color: 'purple' as const,
    multiplayer: false,
  },
  {
    id: 'memory' as GameType,
    title: 'Memory Match',
    description: 'Find the pairs',
    icon: Brain,
    color: 'purple' as const,
    multiplayer: false,
  },
  {
    id: 'colormatch' as GameType,
    title: 'Color Match',
    description: 'Stroop test game',
    icon: Palette,
    color: 'pink' as const,
    multiplayer: false,
  },
  {
    id: 'numberguess' as GameType,
    title: 'Number Guess',
    description: 'Hot/Cold hints',
    icon: Target,
    color: 'cyan' as const,
    multiplayer: false,
  },
  {
    id: 'reaction' as GameType,
    title: 'Reaction Time',
    description: 'Test reflexes',
    icon: Timer,
    color: 'orange' as const,
    multiplayer: false,
  },
];

const IndexContent: React.FC = () => {
  const [activeGame, setActiveGame] = useState<GameType>('tictactoe');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    soundManager.setEnabled(newState);
    if (newState) {
      soundManager.playLocalSound('click');
    }
  };

  const renderGame = () => {
    switch (activeGame) {
      case 'tictactoe':
        return <TicTacToeOnline />;
      case 'mathbattle':
        return <MathBattle />;
      case 'math':
        return <MathChallenge />;
      case 'pattern':
        return <PatternMemory />;
      case 'memory':
        return <MemoryMatch />;
      case 'colormatch':
        return <ColorMatch />;
      case 'numberguess':
        return <NumberGuess />;
      case 'reaction':
        return <ReactionTime />;
      default:
        return <TicTacToeOnline />;
    }
  };

  const multiplayerGames = games.filter(g => g.multiplayer);
  const singlePlayerGames = games.filter(g => !g.multiplayer);

  return (
    <div className="min-h-screen bg-background bg-grid-pattern relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-8 animate-slide-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Gamepad2 className="w-10 h-10 text-neon-cyan animate-float" />
            <h1 className="font-orbitron text-4xl sm:text-5xl font-bold text-foreground">
              <span className="text-neon-cyan text-glow-cyan">MIND</span>
              <span className="text-neon-purple text-glow-purple">GAMES</span>
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSound}
              className="ml-4"
            >
              {soundEnabled ? (
                <Volume2 className="w-5 h-5 text-neon-green" />
              ) : (
                <VolumeX className="w-5 h-5 text-muted-foreground" />
              )}
            </Button>
          </div>
          <p className="text-muted-foreground font-rajdhani text-lg max-w-md mx-auto mb-4">
            8 games • Real-time multiplayer • Mind training
          </p>
          <DifficultySelector />
        </header>

        {/* Main Content */}
        <div className="grid lg:grid-cols-[320px_1fr] gap-8 max-w-6xl mx-auto">
          {/* Game Selector */}
          <aside className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* Multiplayer Games */}
            <div>
              <h2 className="font-orbitron text-xs text-neon-cyan uppercase tracking-widest mb-3 flex items-center gap-2">
                <Swords className="w-4 h-4" />
                Multiplayer
              </h2>
              <div className="space-y-3">
                {multiplayerGames.map((game, index) => (
                  <div
                    key={game.id}
                    className="animate-slide-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <GameCard
                      title={game.title}
                      description={game.description}
                      icon={game.icon}
                      color={game.color}
                      isActive={activeGame === game.id}
                      onClick={() => {
                        setActiveGame(game.id);
                        soundManager.playLocalSound('click');
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Single Player Games */}
            <div>
              <h2 className="font-orbitron text-xs text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Solo Games
              </h2>
              <div className="space-y-3">
                {singlePlayerGames.map((game, index) => (
                  <div
                    key={game.id}
                    className="animate-slide-in"
                    style={{ animationDelay: `${(index + multiplayerGames.length) * 50}ms` }}
                  >
                    <GameCard
                      title={game.title}
                      description={game.description}
                      icon={game.icon}
                      color={game.color}
                      isActive={activeGame === game.id}
                      onClick={() => {
                        setActiveGame(game.id);
                        soundManager.playLocalSound('click');
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Game Area */}
          <main className="bg-card/50 backdrop-blur-sm rounded-3xl border border-border p-6 sm:p-8 min-h-[500px] flex items-center justify-center">
            <div key={activeGame} className="w-full animate-slide-in">
              {renderGame()}
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="text-center mt-8 text-muted-foreground font-rajdhani text-sm">
          <p>Train your brain • Challenge friends • Have fun! 🎮</p>
        </footer>
      </div>
    </div>
  );
};

const Index: React.FC = () => (
  <DifficultyProvider>
    <IndexContent />
  </DifficultyProvider>
);

export default Index;
