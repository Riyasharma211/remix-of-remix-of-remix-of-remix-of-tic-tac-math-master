import React, { useState, useCallback, createContext, useContext } from 'react';
import { Grid3X3, Zap, Brain, Target, Gamepad2, Volume2, VolumeX, Timer, Sparkles, Palette, Swords, Pencil, Heart, Trophy, Link2, HelpCircle, Maximize, Minimize, BarChart3 } from 'lucide-react';
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
import WordChain from '@/components/games/WordChain';
import QuizBattle from '@/components/games/QuizBattle';
import GameCard from '@/components/GameCard';
import GameTransition from '@/components/GameTransition';
import DifficultySelector from '@/components/DifficultySelector';
import ThemeToggle from '@/components/ThemeToggle';
import Leaderboard from '@/components/Leaderboard';
import GameStatsDashboard from '@/components/GameStatsDashboard';
import { AchievementNotification } from '@/components/AchievementNotification';
import { Button } from '@/components/ui/button';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { DifficultyProvider } from '@/contexts/DifficultyContext';
import { Achievement } from '@/hooks/useGameStats';

// Achievement notification context
interface AchievementContextType {
  showAchievements: (achievements: Achievement[]) => void;
}
const AchievementContext = createContext<AchievementContextType | null>(null);
export const useAchievementNotification = () => {
  const context = useContext(AchievementContext);
  if (!context) throw new Error('useAchievementNotification must be used within AchievementProvider');
  return context;
};

type GameType = 'tictactoe' | 'math' | 'memory' | 'numberguess' | 'reaction' | 'pattern' | 'colormatch' | 'mathbattle' | 'drawing' | 'truthordare' | 'wordchain' | 'quizbattle';

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
    id: 'wordchain' as GameType,
    title: 'Word Chain',
    description: 'Word linking game',
    icon: Link2,
    color: 'green' as const,
    multiplayer: true,
  },
  {
    id: 'quizbattle' as GameType,
    title: 'Quiz Battle',
    description: 'Trivia showdown',
    icon: HelpCircle,
    color: 'purple' as const,
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
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);

  const showAchievements = useCallback((achievements: Achievement[]) => {
    if (achievements.length > 0) {
      setPendingAchievements(achievements);
      soundManager.playLocalSound('levelup');
      haptics.success();
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    haptics.light();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  // Listen for fullscreen changes (e.g., user presses Escape)
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleSound = () => {
    haptics.light();
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    soundManager.setEnabled(newState);
    if (newState) {
      soundManager.playLocalSound('click');
    }
  };

  const openLeaderboard = () => {
    haptics.light();
    setShowLeaderboard(true);
  };

  const openStats = () => {
    haptics.light();
    setShowStats(true);
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
      case 'wordchain':
        return <WordChain />;
      case 'quizbattle':
        return <QuizBattle />;
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
    <AchievementContext.Provider value={{ showAchievements }}>
    <div className="h-screen bg-background bg-grid-pattern relative overflow-hidden">
      {/* Achievement Notification */}
      {pendingAchievements.length > 0 && (
        <AchievementNotification 
          achievements={pendingAchievements} 
          onDismiss={() => setPendingAchievements([])} 
        />
      )}

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-neon-purple/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 container mx-auto px-3 sm:px-4 py-3 sm:py-6 h-full flex flex-col">
        {/* Header */}
        <header className="text-center mb-3 sm:mb-4 animate-slide-in shrink-0">
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
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-neon-green" />
              ) : (
                <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={openStats}
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-neon-blue" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={openLeaderboard}
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-neon-orange" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4 sm:w-5 sm:h-5 text-neon-purple" />
              ) : (
                <Maximize className="w-4 h-4 sm:w-5 sm:h-5 text-neon-purple" />
              )}
            </Button>
            <ThemeToggle />
          </div>
          <p className="text-muted-foreground font-rajdhani text-sm sm:text-lg max-w-md mx-auto mb-2 sm:mb-4">
            12 games • Real-time multiplayer • Mind training
          </p>
          <DifficultySelector />
        </header>

        {/* Mobile Game Selector - Horizontal Scroll */}
        <div className="lg:hidden mb-2 shrink-0">
          {/* Multiplayer Games */}
          <div className="mb-2">
            <h2 className="font-orbitron text-[10px] text-neon-cyan uppercase tracking-widest mb-1 flex items-center gap-1 px-1">
              <Swords className="w-2.5 h-2.5" />
              Multiplayer
            </h2>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {multiplayerGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    setActiveGame(game.id);
                    soundManager.playLocalSound('click');
                    haptics.light();
                  }}
                  className={`flex-shrink-0 px-2 py-1.5 rounded-lg border transition-all duration-300 flex items-center gap-1.5 active:scale-95
                    ${activeGame === game.id 
                      ? `border-neon-${game.color} bg-neon-${game.color}/10` 
                      : 'border-border bg-card/50'
                    }`}
                >
                  <game.icon className={`w-3 h-3 text-neon-${game.color}`} />
                  <span className={`font-orbitron text-[10px] whitespace-nowrap ${activeGame === game.id ? `text-neon-${game.color}` : 'text-foreground'}`}>
                    {game.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Solo Games */}
          <div>
            <h2 className="font-orbitron text-[10px] text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1 px-1">
              <Brain className="w-2.5 h-2.5" />
              Solo
            </h2>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {singlePlayerGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    setActiveGame(game.id);
                    soundManager.playLocalSound('click');
                    haptics.light();
                  }}
                  className={`flex-shrink-0 px-2 py-1.5 rounded-lg border transition-all duration-300 flex items-center gap-1.5 active:scale-95
                    ${activeGame === game.id 
                      ? `border-neon-${game.color} bg-neon-${game.color}/10` 
                      : 'border-border bg-card/50'
                    }`}
                >
                  <game.icon className={`w-3 h-3 text-neon-${game.color}`} />
                  <span className={`font-orbitron text-[10px] whitespace-nowrap ${activeGame === game.id ? `text-neon-${game.color}` : 'text-foreground'}`}>
                    {game.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-[280px_1fr] gap-4 sm:gap-6 max-w-6xl mx-auto flex-1 min-h-0">
          {/* Game Selector - Desktop */}
          <aside className="hidden lg:block space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-hide pr-2">
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
          <main className="bg-card/50 backdrop-blur-sm rounded-2xl sm:rounded-3xl border border-border p-3 sm:p-6 md:p-8 flex items-center justify-center overflow-hidden">
            <GameTransition gameKey={activeGame}>
              {renderGame()}
            </GameTransition>
          </main>
        </div>

        {/* Footer */}
        <footer className="text-center mt-2 sm:mt-4 text-muted-foreground font-rajdhani text-xs sm:text-sm py-2 shrink-0">
          <p>Train your brain • Challenge friends • Have fun! 🎮</p>
        </footer>
      </div>

      {/* Modals */}
      <Leaderboard isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      <GameStatsDashboard isOpen={showStats} onClose={() => setShowStats(false)} />
    </div>
    </AchievementContext.Provider>
  );
};

const Index: React.FC = () => (
  <DifficultyProvider>
    <IndexContent />
  </DifficultyProvider>
);

export default Index;
