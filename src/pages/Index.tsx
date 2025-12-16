import React, { useState } from 'react';
import { Grid3X3, Zap, Brain, Target, Gamepad2, Volume2, VolumeX, Timer, Sparkles, Palette, Swords, Pencil, Heart } from 'lucide-react';
import TicTacToeOnline from '@/components/games/TicTacToeOnline';
import MathChallenge from '@/components/games/MathChallenge';
import MemoryMatch from '@/components/games/MemoryMatch';
import NumberGuess from '@/components/games/NumberGuess';
import ReactionTime from '@/components/games/ReactionTime';
import PatternMemory from '@/components/games/PatternMemory';
import ColorMatch from '@/components/games/ColorMatch';
import MathBattle from '@/components/games/MathBattle';
import DrawingGame from '@/components/games/DrawingGame';
import TruthOrDare from '@/components/games/TruthOrDare';
import GameCard from '@/components/GameCard';
import DifficultySelector from '@/components/DifficultySelector';
import { Button } from '@/components/ui/button';
import { soundManager } from '@/utils/soundManager';
import { DifficultyProvider } from '@/contexts/DifficultyContext';

type GameType = 'tictactoe' | 'math' | 'memory' | 'numberguess' | 'reaction' | 'pattern' | 'colormatch' | 'mathbattle' | 'drawing' | 'truthordare';

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
    id: 'drawing' as GameType,
    title: 'Drawing Game',
    description: 'Draw & guess',
    icon: Pencil,
    color: 'pink' as const,
    multiplayer: true,
  },
  {
    id: 'truthordare' as GameType,
    title: 'Truth or Dare',
    description: 'Party game',
    icon: Heart,
    color: 'pink' as const,
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
      case 'drawing':
        return <DrawingGame />;
      case 'truthordare':
        return <TruthOrDare />;
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
      <div className="absolute top-0 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-neon-purple/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <header className="text-center mb-4 sm:mb-8 animate-slide-in">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-4">
            <Gamepad2 className="w-7 h-7 sm:w-10 sm:h-10 text-neon-cyan animate-float" />
            <h1 className="font-orbitron text-2xl sm:text-4xl md:text-5xl font-bold text-foreground">
              <span className="text-neon-cyan text-glow-cyan">MIND</span>
              <span className="text-neon-purple text-glow-purple">GAMES</span>
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSound}
              className="ml-2 sm:ml-4 h-8 w-8 sm:h-10 sm:w-10"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-neon-green" />
              ) : (
                <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              )}
            </Button>
          </div>
          <p className="text-muted-foreground font-rajdhani text-sm sm:text-lg max-w-md mx-auto mb-2 sm:mb-4">
            10 games • Real-time multiplayer • Mind training
          </p>
          <DifficultySelector />
        </header>

        {/* Mobile Game Selector - Horizontal Scroll */}
        <div className="lg:hidden mb-4">
          {/* Multiplayer Games */}
          <div className="mb-3">
            <h2 className="font-orbitron text-xs text-neon-cyan uppercase tracking-widest mb-2 flex items-center gap-2 px-1">
              <Swords className="w-3 h-3" />
              Multiplayer
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {multiplayerGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    setActiveGame(game.id);
                    soundManager.playLocalSound('click');
                  }}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl border-2 transition-all duration-300 flex items-center gap-2
                    ${activeGame === game.id 
                      ? `border-neon-${game.color} bg-neon-${game.color}/10` 
                      : 'border-border bg-card/50'
                    }`}
                >
                  <game.icon className={`w-4 h-4 text-neon-${game.color}`} />
                  <span className={`font-orbitron text-xs whitespace-nowrap ${activeGame === game.id ? `text-neon-${game.color}` : 'text-foreground'}`}>
                    {game.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Solo Games */}
          <div>
            <h2 className="font-orbitron text-xs text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2 px-1">
              <Brain className="w-3 h-3" />
              Solo
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {singlePlayerGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    setActiveGame(game.id);
                    soundManager.playLocalSound('click');
                  }}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl border-2 transition-all duration-300 flex items-center gap-2
                    ${activeGame === game.id 
                      ? `border-neon-${game.color} bg-neon-${game.color}/10` 
                      : 'border-border bg-card/50'
                    }`}
                >
                  <game.icon className={`w-4 h-4 text-neon-${game.color}`} />
                  <span className={`font-orbitron text-xs whitespace-nowrap ${activeGame === game.id ? `text-neon-${game.color}` : 'text-foreground'}`}>
                    {game.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-[280px_1fr] gap-4 sm:gap-8 max-w-6xl mx-auto">
          {/* Game Selector - Desktop */}
          <aside className="hidden lg:block space-y-6 max-h-[70vh] overflow-y-auto pr-2">
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
          <main className="bg-card/50 backdrop-blur-sm rounded-2xl sm:rounded-3xl border border-border p-3 sm:p-6 md:p-8 min-h-[400px] sm:min-h-[500px] flex items-center justify-center">
            <div key={activeGame} className="w-full animate-slide-in">
              {renderGame()}
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="text-center mt-4 sm:mt-8 text-muted-foreground font-rajdhani text-xs sm:text-sm">
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
