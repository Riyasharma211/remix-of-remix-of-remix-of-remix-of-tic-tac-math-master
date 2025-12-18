import React, { useState, useCallback, createContext, useContext, useMemo, useEffect } from 'react';
import { useSwipe } from '@/hooks/useSwipe';
import { Grid3X3, Zap, Brain, Target, Gamepad2, Volume2, VolumeX, Timer, Sparkles, Palette, Swords, Pencil, Heart, Trophy, Link2, HelpCircle, Maximize, Minimize, BarChart3, Shuffle, Keyboard, Crosshair } from 'lucide-react';
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
import WordScramble from '@/components/games/WordScramble';
import TypingSpeed from '@/components/games/TypingSpeed';
import AimTrainer from '@/components/games/AimTrainer';
import SnakeGame from '@/components/games/SnakeGame';
import GameCard from '@/components/GameCard';
import GameTransition from '@/components/GameTransition';
import DifficultySelector from '@/components/DifficultySelector';
import ThemeToggle from '@/components/ThemeToggle';
import Leaderboard from '@/components/Leaderboard';
import GameStatsDashboard from '@/components/GameStatsDashboard';
import { AchievementNotification } from '@/components/AchievementNotification';
import SplashScreen from '@/components/SplashScreen';
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

type GameType = 'tictactoe' | 'math' | 'memory' | 'numberguess' | 'reaction' | 'pattern' | 'colormatch' | 'mathbattle' | 'drawing' | 'truthordare' | 'wordchain' | 'quizbattle' | 'wordscramble' | 'typingspeed' | 'aimtrainer' | 'snake';

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
  {
    id: 'wordscramble' as GameType,
    title: 'Word Scramble',
    description: 'Unscramble words',
    icon: Shuffle,
    color: 'green' as const,
    multiplayer: false,
  },
  {
    id: 'typingspeed' as GameType,
    title: 'Typing Speed',
    description: 'Type fast',
    icon: Keyboard,
    color: 'cyan' as const,
    multiplayer: false,
  },
  {
    id: 'aimtrainer' as GameType,
    title: 'Aim Trainer',
    description: 'Click targets',
    icon: Crosshair,
    color: 'pink' as const,
    multiplayer: false,
  },
  {
    id: 'snake' as GameType,
    title: 'Snake',
    description: 'Classic arcade',
    icon: Gamepad2,
    color: 'green' as const,
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
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [showSplash, setShowSplash] = useState(() => {
    // Only show splash on mobile and on first load
    const isMobile = window.innerWidth < 1024;
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');
    return isMobile && !hasSeenSplash;
  });

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    sessionStorage.setItem('hasSeenSplash', 'true');
  }, []);
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

  // Swipe navigation for mobile
  const allGames = useMemo(() => [...games.filter(g => g.multiplayer), ...games.filter(g => !g.multiplayer)], []);
  
  const navigateGame = useCallback((direction: 'next' | 'prev') => {
    const currentIndex = allGames.findIndex(g => g.id === activeGame);
    let newIndex: number;
    
    if (direction === 'next') {
      newIndex = currentIndex < allGames.length - 1 ? currentIndex + 1 : 0;
      setSwipeDirection('left');
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : allGames.length - 1;
      setSwipeDirection('right');
    }
    
    setActiveGame(allGames[newIndex].id);
    soundManager.playLocalSound('whoosh');
    haptics.light();
  }, [activeGame, allGames]);

  // Swipe navigation disabled for better mobile UX
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {},
    onSwipeRight: () => {},
    threshold: 60,
  });

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
      case 'wordscramble':
        return <WordScramble />;
      case 'typingspeed':
        return <TypingSpeed />;
      case 'aimtrainer':
        return <AimTrainer />;
      case 'snake':
        return <SnakeGame />;
      default:
        return <TicTacToeOnline />;
    }
  };

  const multiplayerGames = games.filter(g => g.multiplayer);
  const singlePlayerGames = games.filter(g => !g.multiplayer);

  return (
    <AchievementContext.Provider value={{ showAchievements }}>
    {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    <div className="h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Achievement Notification */}
      {pendingAchievements.length > 0 && (
        <AchievementNotification 
          achievements={pendingAchievements} 
          onDismiss={() => setPendingAchievements([])} 
        />
      )}

      {/* Futuristic Background Effects */}
      <div className="absolute inset-0 bg-mesh-gradient pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
      
      {/* Animated Orbs */}
      <div className="absolute top-10 left-[10%] w-64 h-64 bg-neon-cyan/20 rounded-full blur-[100px] pointer-events-none animate-orb" />
      <div className="absolute bottom-20 right-[10%] w-72 h-72 bg-neon-purple/20 rounded-full blur-[120px] pointer-events-none animate-orb-delayed" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-neon-pink/10 rounded-full blur-[150px] pointer-events-none animate-pulse" />

      {/* Mobile Header - Futuristic */}
      <header className="lg:hidden relative z-10 px-3 pt-2 pb-1 shrink-0">
        <div className="flex items-center justify-between glass-morphism rounded-2xl px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Gamepad2 className="w-6 h-6 text-neon-cyan" />
              <div className="absolute inset-0 bg-neon-cyan/50 blur-md -z-10" />
            </div>
            <span className="font-orbitron text-lg font-bold tracking-wider">
              <span className="text-neon-cyan text-glow-cyan">MIND</span>
              <span className="text-neon-purple text-glow-purple">GAMES</span>
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <DifficultySelector />
            <Button variant="ghost" size="icon" onClick={toggleSound} className="h-8 w-8 rounded-xl hover:bg-neon-green/10">
              {soundEnabled ? <Volume2 className="w-4 h-4 text-neon-green" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={openStats} className="h-8 w-8 rounded-xl hover:bg-neon-cyan/10">
              <BarChart3 className="w-4 h-4 text-neon-cyan" />
            </Button>
            <Button variant="ghost" size="icon" onClick={openLeaderboard} className="h-8 w-8 rounded-xl hover:bg-neon-orange/10">
              <Trophy className="w-4 h-4 text-neon-orange" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Desktop Header - Futuristic */}
      <header className="hidden lg:block text-center py-6 animate-slide-in shrink-0 relative z-10">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="relative">
            <Gamepad2 className="w-12 h-12 text-neon-cyan animate-float" />
            <div className="absolute inset-0 bg-neon-cyan/40 blur-xl -z-10" />
          </div>
          <h1 className="font-orbitron text-5xl md:text-6xl font-black tracking-wider">
            <span className="text-neon-cyan text-glow-cyan">MIND</span>
            <span className="text-neon-purple text-glow-purple">GAMES</span>
          </h1>
          <div className="flex items-center gap-1 ml-4">
            <Button variant="ghost" size="icon" onClick={toggleSound} className="h-11 w-11 rounded-xl glass-morphism hover:bg-neon-green/20 transition-all">
              {soundEnabled ? <Volume2 className="w-5 h-5 text-neon-green" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={openStats} className="h-11 w-11 rounded-xl glass-morphism hover:bg-neon-cyan/20 transition-all">
              <BarChart3 className="w-5 h-5 text-neon-cyan" />
            </Button>
            <Button variant="ghost" size="icon" onClick={openLeaderboard} className="h-11 w-11 rounded-xl glass-morphism hover:bg-neon-orange/20 transition-all">
              <Trophy className="w-5 h-5 text-neon-orange" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-11 w-11 rounded-xl glass-morphism hover:bg-neon-purple/20 transition-all">
              {isFullscreen ? <Minimize className="w-5 h-5 text-neon-purple" /> : <Maximize className="w-5 h-5 text-neon-purple" />}
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <p className="text-muted-foreground font-rajdhani text-xl max-w-lg mx-auto mb-5 tracking-wide">
          16 games • Real-time multiplayer • Mind training
        </p>
        <DifficultySelector />
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative z-10 flex flex-col lg:block">
        {/* Mobile: Game Area Takes Full Space */}
        <main 
          className="lg:hidden flex-1 mx-2 mb-2 glass-morphism rounded-3xl p-3 flex items-center justify-center overflow-auto neon-border"
          {...swipeHandlers}
        >
          <GameTransition gameKey={activeGame} direction={swipeDirection}>
            {renderGame()}
          </GameTransition>
        </main>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-[280px_1fr] gap-6 max-w-6xl mx-auto px-4 h-full">
          {/* Game Selector - Desktop */}
          <aside className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-hide pr-2">
            {/* Multiplayer Games */}
            <div>
              <h2 className="font-orbitron text-xs text-neon-cyan uppercase tracking-widest mb-3 flex items-center gap-2">
                <Swords className="w-4 h-4" />
                Multiplayer
              </h2>
              <div className="space-y-3">
                {multiplayerGames.map((game, index) => (
                  <div key={game.id} className="animate-slide-in" style={{ animationDelay: `${index * 50}ms` }}>
                    <GameCard
                      title={game.title}
                      description={game.description}
                      icon={game.icon}
                      color={game.color}
                      isActive={activeGame === game.id}
                      onClick={() => { setSwipeDirection(null); setActiveGame(game.id); soundManager.playLocalSound('click'); }}
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
                  <div key={game.id} className="animate-slide-in" style={{ animationDelay: `${(index + multiplayerGames.length) * 50}ms` }}>
                    <GameCard
                      title={game.title}
                      description={game.description}
                      icon={game.icon}
                      color={game.color}
                      isActive={activeGame === game.id}
                      onClick={() => { setSwipeDirection(null); setActiveGame(game.id); soundManager.playLocalSound('click'); }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Game Area - Desktop */}
          <main className="bg-card/50 backdrop-blur-sm rounded-3xl border border-border p-8 flex items-center justify-center overflow-hidden">
            <GameTransition gameKey={activeGame} direction={swipeDirection}>
              {renderGame()}
            </GameTransition>
          </main>
        </div>

        {/* Desktop Footer */}
        <footer className="hidden lg:block text-center mt-4 text-muted-foreground font-rajdhani text-sm py-2">
          <p>Train your brain • Challenge friends • Have fun! 🎮</p>
        </footer>
      </div>

      {/* Mobile Bottom Navigation - Futuristic Glass */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-2 pb-1 safe-area-bottom animate-slide-up-full">
        <div className="glass-morphism rounded-3xl px-2 py-2 shadow-[0_-8px_32px_rgba(0,0,0,0.4)]">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
            {/* Multiplayer Section */}
            <div className="flex gap-1 pr-2 border-r border-neon-cyan/20">
              {multiplayerGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    setSwipeDirection(null);
                    setActiveGame(game.id);
                    soundManager.playLocalSound('click');
                    haptics.light();
                  }}
                  className={`relative flex flex-col items-center justify-center p-2 rounded-2xl min-w-[56px] transition-all duration-300 active:scale-90 ${
                    activeGame === game.id 
                      ? `bg-gradient-to-br from-neon-${game.color}/30 to-neon-${game.color}/10 shadow-lg` 
                      : 'bg-transparent hover:bg-muted/30'
                  }`}
                >
                  {activeGame === game.id && (
                    <div className={`absolute inset-0 bg-neon-${game.color}/20 rounded-2xl blur-md -z-10`} />
                  )}
                  <game.icon className={`w-5 h-5 transition-all duration-300 ${activeGame === game.id ? `text-neon-${game.color} drop-shadow-[0_0_8px_hsl(var(--neon-${game.color}))]` : 'text-muted-foreground'}`} />
                  <span className={`text-[9px] font-orbitron mt-1 truncate max-w-[48px] transition-all duration-300 ${activeGame === game.id ? `text-neon-${game.color} font-semibold` : 'text-muted-foreground'}`}>
                    {game.title.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
            {/* Solo Section */}
            <div className="flex gap-1 pl-1">
              {singlePlayerGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    setSwipeDirection(null);
                    setActiveGame(game.id);
                    soundManager.playLocalSound('click');
                    haptics.light();
                  }}
                  className={`relative flex flex-col items-center justify-center p-2 rounded-2xl min-w-[56px] transition-all duration-300 active:scale-90 ${
                    activeGame === game.id 
                      ? `bg-gradient-to-br from-neon-${game.color}/30 to-neon-${game.color}/10 shadow-lg` 
                      : 'bg-transparent hover:bg-muted/30'
                  }`}
                >
                  {activeGame === game.id && (
                    <div className={`absolute inset-0 bg-neon-${game.color}/20 rounded-2xl blur-md -z-10`} />
                  )}
                  <game.icon className={`w-5 h-5 transition-all duration-300 ${activeGame === game.id ? `text-neon-${game.color} drop-shadow-[0_0_8px_hsl(var(--neon-${game.color}))]` : 'text-muted-foreground'}`} />
                  <span className={`text-[9px] font-orbitron mt-1 truncate max-w-[48px] transition-all duration-300 ${activeGame === game.id ? `text-neon-${game.color} font-semibold` : 'text-muted-foreground'}`}>
                    {game.title.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {/* iOS Home Indicator */}
          <div className="flex justify-center pt-2">
            <div className="w-28 h-1 bg-gradient-to-r from-neon-cyan/50 via-neon-purple/50 to-neon-pink/50 rounded-full" />
          </div>
        </div>
      </nav>

      {/* Bottom nav spacer for mobile */}
      <div className="lg:hidden h-16 shrink-0" />

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
