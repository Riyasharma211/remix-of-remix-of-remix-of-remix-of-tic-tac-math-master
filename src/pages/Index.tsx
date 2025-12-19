import React, { useState, useCallback, createContext, useContext, useMemo, useEffect } from "react";
import { useSwipe } from "@/hooks/useSwipe";
import {
  Grid3X3,
  Zap,
  Brain,
  Target,
  Gamepad2,
  Volume2,
  VolumeX,
  Timer,
  Sparkles,
  Palette,
  Swords,
  Pencil,
  Heart,
  Trophy,
  Link2,
  HelpCircle,
  Maximize,
  ExternalLink,
  Minimize,
  BarChart3,
  Shuffle,
  Keyboard,
  Crosshair,
  Hand,
  Circle,
  Type,
  Calculator,
  Wifi,
} from "lucide-react";
import TicTacToeOnline from "@/components/games/TicTacToeOnline";
import MathChallenge from "@/components/games/MathChallenge";
import MemoryMatch from "@/components/games/MemoryMatch";
import NumberGuess from "@/components/games/NumberGuess";
import ReactionTime from "@/components/games/ReactionTime";
import PatternMemory from "@/components/games/PatternMemory";
import ColorMatch from "@/components/games/ColorMatch";
import MathBattle from "@/components/games/MathBattle";
import DrawingGame from "@/components/games/DrawingGame";
import TruthOrDare from "@/components/games/TruthOrDare";
import WordChain from "@/components/games/WordChain";
import QuizBattle from "@/components/games/QuizBattle";
import WordScramble from "@/components/games/WordScramble";
import TypingSpeed from "@/components/games/TypingSpeed";
import AimTrainer from "@/components/games/AimTrainer";
import SnakeGame from "@/components/games/SnakeGame";
import RockPaperScissors from "@/components/games/RockPaperScissors";
import ConnectFour from "@/components/games/ConnectFour";
import HangmanBattle from "@/components/games/HangmanBattle";
import SpeedMathDuel from "@/components/games/SpeedMathDuel";
import GameCard from "@/components/GameCard";
import GameTransition from "@/components/GameTransition";
import DifficultySelector from "@/components/DifficultySelector";
import ThemeToggle from "@/components/ThemeToggle";
import Leaderboard from "@/components/Leaderboard";
import GameStatsDashboard from "@/components/GameStatsDashboard";
import DailyChallenges from "@/components/DailyChallenges";
import UserProfile from "@/components/UserProfile";
import GameRoomsBrowser from "@/components/GameRoomsBrowser";
import FriendsList from "@/components/FriendsList";
import Tournament from "@/components/Tournament";
import GameHistory from "@/components/GameHistory";
import PowerUpsShop from "@/components/PowerUpsShop";
import { AchievementNotification } from "@/components/AchievementNotification";
import SplashScreen from "@/components/SplashScreen";
import CursorParticles from "@/components/CursorParticles";
import ParallaxOrbs from "@/components/ParallaxOrbs";
import LeaveGameDialog from "@/components/LeaveGameDialog";
import UniversalGameCodeInput from "@/components/UniversalGameCodeInput";
import FloatingActionPanel from "@/components/FloatingActionPanel";
import { Button } from "@/components/ui/button";
import MagneticButton from "@/components/MagneticButton";
import { soundManager } from "@/utils/soundManager";
import { haptics } from "@/utils/haptics";
import { isPWAInstalled, isInstallable, installPWA } from "@/utils/pwa";
import { DifficultyProvider } from "@/contexts/DifficultyContext";
import { ActiveGameProvider, useActiveGame } from "@/contexts/ActiveGameContext";
import { GameChannelProvider, useGameChannel } from "@/contexts/GameChannelContext";
import { ChallengeProvider } from "@/contexts/ChallengeContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { PowerUpsProvider } from "@/contexts/PowerUpsContext";
import { Achievement } from "@/hooks/useGameStats";
import { useToast } from "@/hooks/use-toast";

// Achievement notification context
interface AchievementContextType {
  showAchievements: (achievements: Achievement[]) => void;
}
const AchievementContext = createContext<AchievementContextType | null>(null);
export const useAchievementNotification = () => {
  const context = useContext(AchievementContext);
  if (!context) throw new Error("useAchievementNotification must be used within AchievementProvider");
  return context;
};

type GameType =
  | "tictactoe"
  | "math"
  | "memory"
  | "numberguess"
  | "reaction"
  | "pattern"
  | "colormatch"
  | "mathbattle"
  | "drawing"
  | "truthordare"
  | "wordchain"
  | "quizbattle"
  | "wordscramble"
  | "typingspeed"
  | "aimtrainer"
  | "snake"
  | "rps"
  | "connect4"
  | "hangman"
  | "speedmath";

const games = [
  {
    id: "tictactoe" as GameType,
    title: "Tic Tac Toe",
    description: "Online multiplayer",
    icon: Grid3X3,
    color: "cyan" as const,
    multiplayer: true,
  },
  {
    id: "mathbattle" as GameType,
    title: "Math Battle",
    description: "Online math race",
    icon: Swords,
    color: "orange" as const,
    multiplayer: true,
  },
  {
    id: "drawing" as GameType,
    title: "Drawing Game",
    description: "Draw & guess",
    icon: Pencil,
    color: "pink" as const,
    multiplayer: true,
  },
  {
    id: "truthordare" as GameType,
    title: "Truth or Dare",
    description: "Party game",
    icon: Heart,
    color: "pink" as const,
    multiplayer: true,
  },
  {
    id: "wordchain" as GameType,
    title: "Word Chain",
    description: "Word linking game",
    icon: Link2,
    color: "green" as const,
    multiplayer: true,
  },
  {
    id: "quizbattle" as GameType,
    title: "Quiz Battle",
    description: "Trivia showdown",
    icon: HelpCircle,
    color: "purple" as const,
    multiplayer: true,
  },
  {
    id: "rps" as GameType,
    title: "Rock Paper Scissors",
    description: "Classic showdown",
    icon: Hand,
    color: "orange" as const,
    multiplayer: true,
  },
  {
    id: "connect4" as GameType,
    title: "Connect Four",
    description: "4 in a row",
    icon: Circle,
    color: "cyan" as const,
    multiplayer: true,
  },
  {
    id: "hangman" as GameType,
    title: "Hangman Battle",
    description: "Word guessing",
    icon: Type,
    color: "purple" as const,
    multiplayer: true,
  },
  {
    id: "speedmath" as GameType,
    title: "Speed Math Duel",
    description: "60s math race",
    icon: Calculator,
    color: "green" as const,
    multiplayer: true,
  },
  {
    id: "math" as GameType,
    title: "Math Challenge",
    description: "Speed math puzzles",
    icon: Zap,
    color: "orange" as const,
    multiplayer: false,
  },
  {
    id: "pattern" as GameType,
    title: "Pattern Memory",
    description: "Simon Says style",
    icon: Sparkles,
    color: "purple" as const,
    multiplayer: false,
  },
  {
    id: "memory" as GameType,
    title: "Memory Match",
    description: "Find the pairs",
    icon: Brain,
    color: "purple" as const,
    multiplayer: false,
  },
  {
    id: "colormatch" as GameType,
    title: "Color Match",
    description: "Stroop test game",
    icon: Palette,
    color: "pink" as const,
    multiplayer: false,
  },
  {
    id: "numberguess" as GameType,
    title: "Number Guess",
    description: "Hot/Cold hints",
    icon: Target,
    color: "cyan" as const,
    multiplayer: false,
  },
  {
    id: "reaction" as GameType,
    title: "Reaction Time",
    description: "Test reflexes",
    icon: Timer,
    color: "orange" as const,
    multiplayer: false,
  },
  {
    id: "wordscramble" as GameType,
    title: "Word Scramble",
    description: "Unscramble words",
    icon: Shuffle,
    color: "green" as const,
    multiplayer: false,
  },
  {
    id: "typingspeed" as GameType,
    title: "Typing Speed",
    description: "Type fast",
    icon: Keyboard,
    color: "cyan" as const,
    multiplayer: false,
  },
  {
    id: "aimtrainer" as GameType,
    title: "Aim Trainer",
    description: "Click targets",
    icon: Crosshair,
    color: "pink" as const,
    multiplayer: false,
  },
  {
    id: "snake" as GameType,
    title: "Snake",
    description: "Classic arcade",
    icon: Gamepad2,
    color: "green" as const,
    multiplayer: false,
  },
];

const IndexContent: React.FC = () => {
  const { toast } = useToast();
  const [activeGame, setActiveGame] = useState<GameType>("tictactoe");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showDailyChallenges, setShowDailyChallenges] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showRoomsBrowser, setShowRoomsBrowser] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showTournament, setShowTournament] = useState(false);
  const [showGameHistory, setShowGameHistory] = useState(false);
  const [showPowerUpsShop, setShowPowerUpsShop] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingGameSwitch, setPendingGameSwitch] = useState<GameType | null>(null);
  const [showUniversalCodeInput, setShowUniversalCodeInput] = useState(false);
  const [globalChannelRef, setGlobalChannelRef] = useState<any>(null);
  const [currentPlayerName, setCurrentPlayerName] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(() => {
    // Only show splash on mobile and on first load
    const isMobile = window.innerWidth < 1024;
    const hasSeenSplash = sessionStorage.getItem("hasSeenSplash");
    
    // Check for PWA install prompt
    if (!isPWAInstalled() && isInstallable()) {
      setTimeout(() => setShowInstallPrompt(true), 3000);
    }
    return isMobile && !hasSeenSplash;
  });

  const { isGameActive, activeGameName, setGameActive } = useActiveGame();

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    sessionStorage.setItem("hasSeenSplash", "true");
  }, []);
  const showAchievements = useCallback((achievements: Achievement[]) => {
    if (achievements.length > 0) {
      setPendingAchievements(achievements);
      soundManager.playLocalSound("levelup");
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
      console.error("Fullscreen error:", error);
    }
  }, []);

  // Listen for fullscreen changes (e.g., user presses Escape)
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleSound = () => {
    haptics.light();
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    soundManager.setEnabled(newState);
    if (newState) {
      soundManager.playLocalSound("click");
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

  const openDailyChallenges = () => {
    haptics.light();
    setShowDailyChallenges(true);
  };

  const openUserProfile = () => {
    haptics.light();
    setShowUserProfile(true);
  };

  const openRoomsBrowser = () => {
    haptics.light();
    setShowRoomsBrowser(true);
  };

  const openFriends = () => {
    haptics.light();
    setShowFriends(true);
  };

  const openTournament = () => {
    haptics.light();
    setShowTournament(true);
  };

  const openGameHistory = () => {
    haptics.light();
    setShowGameHistory(true);
  };

  const openPowerUpsShop = () => {
    haptics.light();
    setShowPowerUpsShop(true);
  };

  const openNewTab = () => {
    haptics.light();
    window.open(window.location.href, '_blank');
  };

  const openUniversalCodeInput = () => {
    haptics.light();
    setShowUniversalCodeInput(true);
  };

  const handleJoinGameByCode = useCallback((gameType: string, roomCode: string) => {
    // Switch to the game type
    const targetGame = gameType as GameType;
    if (targetGame && games.find(g => g.id === targetGame)) {
      if (isGameActive) {
        setPendingGameSwitch(targetGame);
        setShowLeaveDialog(true);
      } else {
        setActiveGame(targetGame);
        soundManager.playLocalSound('click');
        haptics.light();
      }
    }
  }, [isGameActive]);

  // Handle game switching with confirmation if game is active
  const handleGameSwitch = useCallback(
    (newGame: GameType) => {
      if (newGame === activeGame) return;

      if (isGameActive) {
        // Show confirmation dialog
        setPendingGameSwitch(newGame);
        setShowLeaveDialog(true);
        haptics.medium();
      } else {
        // Switch directly
        setSwipeDirection(null);
        setActiveGame(newGame);
        soundManager.playLocalSound("click");
        haptics.light();
      }
    },
    [activeGame, isGameActive],
  );

  const confirmLeaveGame = useCallback(() => {
    if (pendingGameSwitch) {
      setGameActive(false);
      setSwipeDirection(null);
      setActiveGame(pendingGameSwitch);
      soundManager.playLocalSound("click");
    }
    setShowLeaveDialog(false);
    setPendingGameSwitch(null);
  }, [pendingGameSwitch, setGameActive]);

  const cancelLeaveGame = useCallback(() => {
    setShowLeaveDialog(false);
    setPendingGameSwitch(null);
  }, []);

  // Swipe navigation for mobile
  const allGames = useMemo(() => [...games.filter((g) => g.multiplayer), ...games.filter((g) => !g.multiplayer)], []);

  const navigateGame = useCallback(
    (direction: "next" | "prev") => {
      const currentIndex = allGames.findIndex((g) => g.id === activeGame);
      let newIndex: number;

      if (direction === "next") {
        newIndex = currentIndex < allGames.length - 1 ? currentIndex + 1 : 0;
        setSwipeDirection("left");
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : allGames.length - 1;
        setSwipeDirection("right");
      }

      const newGame = allGames[newIndex].id;
      if (isGameActive) {
        setPendingGameSwitch(newGame);
        setShowLeaveDialog(true);
        haptics.medium();
      } else {
        setActiveGame(newGame);
        soundManager.playLocalSound("whoosh");
        haptics.light();
      }
    },
    [activeGame, allGames, isGameActive],
  );

  // Swipe navigation for mobile
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => navigateGame("next"),
    onSwipeRight: () => navigateGame("prev"),
    threshold: 60,
  });

  const renderGame = () => {
    switch (activeGame) {
      case "tictactoe":
        return <TicTacToeOnline />;
      case "mathbattle":
        return <MathBattle />;
      case "drawing":
        return <DrawingGame />;
      case "truthordare":
        return <TruthOrDare />;
      case "wordchain":
        return <WordChain />;
      case "quizbattle":
        return <QuizBattle />;
      case "math":
        return <MathChallenge />;
      case "pattern":
        return <PatternMemory />;
      case "memory":
        return <MemoryMatch />;
      case "colormatch":
        return <ColorMatch />;
      case "numberguess":
        return <NumberGuess />;
      case "reaction":
        return <ReactionTime />;
      case "wordscramble":
        return <WordScramble />;
      case "typingspeed":
        return <TypingSpeed />;
      case "aimtrainer":
        return <AimTrainer />;
      case "snake":
        return <SnakeGame />;
      case "rps":
        return <RockPaperScissors />;
      case "connect4":
        return <ConnectFour />;
      case "hangman":
        return <HangmanBattle />;
      case "speedmath":
        return <SpeedMathDuel />;
      default:
        return <TicTacToeOnline />;
    }
  };

  const multiplayerGames = games.filter((g) => g.multiplayer);
  const singlePlayerGames = games.filter((g) => !g.multiplayer);

  return (
    <AchievementContext.Provider value={{ showAchievements }}>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <div className="h-screen bg-background relative overflow-hidden flex flex-col">
        {/* Achievement Notification */}
        {pendingAchievements.length > 0 && (
          <AchievementNotification achievements={pendingAchievements} onDismiss={() => setPendingAchievements([])} />
        )}

        {/* Cursor Particles - Desktop Only */}
        <CursorParticles />

        {/* Futuristic Animated Background */}
        <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />

        {/* Animated Floating Orbs with Parallax */}
        <ParallaxOrbs />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />

        {/* Floating Action Panel - Slideable sidebar with all actions */}
        <FloatingActionPanel
          channelRef={globalChannelRef}
          playerName={currentPlayerName || undefined}
          roomId={currentRoomId || undefined}
          onJoinGame={handleJoinGameByCode}
        />

        {/* Mobile Header - Modern App-like Design */}
        <header className="lg:hidden relative z-10 px-4 pt-3 pb-2 shrink-0 safe-area-top">
          <div className="flex items-center justify-between">
            <button
              onClick={openUserProfile}
              className="flex items-center gap-2 hover:opacity-80 transition-all active:scale-95"
            >
              <div className="relative">
                <Gamepad2 className="w-6 h-6 text-neon-cyan drop-shadow-lg" />
                <div className="absolute inset-0 bg-neon-cyan/20 blur-xl rounded-full" />
              </div>
              <span className="font-orbitron text-lg font-bold">
                <span className="text-neon-cyan drop-shadow-lg">MIND</span>
                <span className="text-neon-purple drop-shadow-lg">GAMES</span>
              </span>
            </button>
            <div className="flex items-center gap-1">
              <DifficultySelector />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleSound} 
                className="h-9 w-9 rounded-xl hover:bg-neon-green/10 active:scale-95 transition-all"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-neon-green" />
                ) : (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={openStats} 
                className="h-9 w-9 rounded-xl hover:bg-neon-cyan/10 active:scale-95 transition-all"
              >
                <BarChart3 className="w-4 h-4 text-neon-cyan" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={openLeaderboard} 
                className="h-9 w-9 rounded-xl hover:bg-neon-orange/10 active:scale-95 transition-all"
              >
                <Trophy className="w-4 h-4 text-neon-orange" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={openRoomsBrowser} 
                className="h-9 w-9 rounded-xl hover:bg-neon-purple/10 active:scale-95 transition-all" 
                title="Browse public game rooms"
              >
                <Wifi className="w-4 h-4 text-neon-purple" />
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Desktop Header - Enhanced Modern Design */}
        <header className="hidden lg:block text-center py-6 animate-slide-in shrink-0 relative z-10">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="relative">
              <Gamepad2 className="w-12 h-12 text-neon-cyan animate-float drop-shadow-lg" />
              <div className="absolute inset-0 bg-neon-cyan/30 blur-2xl rounded-full animate-pulse" />
            </div>
            <h1 className="font-orbitron text-5xl md:text-6xl font-bold text-foreground">
              <span className="text-neon-cyan text-glow-cyan drop-shadow-lg">MIND</span>
              <span className="mx-2">•</span>
              <span className="text-neon-purple text-glow-purple drop-shadow-lg">GAMES</span>
            </h1>
            <MagneticButton 
              variant="ghost" 
              size="icon" 
              onClick={toggleSound} 
              className="h-11 w-11 rounded-xl hover:bg-neon-green/10 transition-all"
            >
              {soundEnabled ? (
                <Volume2 className="w-5 h-5 text-neon-green" />
              ) : (
                <VolumeX className="w-5 h-5 text-muted-foreground" />
              )}
            </MagneticButton>
            <MagneticButton 
              variant="ghost" 
              size="icon" 
              onClick={openStats} 
              className="h-11 w-11 rounded-xl hover:bg-neon-cyan/10 transition-all"
            >
              <BarChart3 className="w-5 h-5 text-neon-cyan" />
            </MagneticButton>
            <MagneticButton 
              variant="ghost" 
              size="icon" 
              onClick={openLeaderboard} 
              className="h-11 w-11 rounded-xl hover:bg-neon-orange/10 transition-all"
            >
              <Trophy className="w-5 h-5 text-neon-orange" />
            </MagneticButton>
            <MagneticButton 
              variant="ghost" 
              size="icon" 
              onClick={toggleFullscreen} 
              className="h-11 w-11 rounded-xl hover:bg-neon-purple/10 transition-all"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5 text-neon-purple" />
              ) : (
                <Maximize className="w-5 h-5 text-neon-purple" />
              )}
            </MagneticButton>
            <MagneticButton 
              variant="ghost" 
              size="icon" 
              onClick={openRoomsBrowser} 
              className="h-11 w-11 rounded-xl hover:bg-neon-purple/10 transition-all" 
              title="Browse public game rooms"
            >
              <Wifi className="w-5 h-5 text-neon-purple" />
            </MagneticButton>
            <ThemeToggle />
          </div>
          <p className="text-muted-foreground font-rajdhani text-base max-w-md mx-auto mb-4 flex items-center justify-center gap-2">
            <span className="flex items-center gap-1">
              <Gamepad2 className="w-4 h-4 text-neon-cyan" />
              <span>20 Games</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Wifi className="w-4 h-4 text-neon-purple" />
              <span>Multiplayer</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Brain className="w-4 h-4 text-neon-pink" />
              <span>Mind Training</span>
            </span>
          </p>
          <DifficultySelector />
        </header>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 relative z-10 flex flex-col lg:block">
          {/* Mobile: Game Area Takes Full Space - Modern Design */}
          <main
            className="lg:hidden flex-1 mx-3 mb-2 glass-neon rounded-3xl p-4 flex items-center justify-center overflow-auto shadow-app-lg"
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
                        onClick={() => {
                          setSwipeDirection(null);
                          setActiveGame(game.id);
                          soundManager.playLocalSound("click");
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Single Player Games */}
              <div>
                <h2 className="font-orbitron text-sm text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2 px-2">
                  <Brain className="w-4 h-4" />
                  <span>Solo Games</span>
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
                          setSwipeDirection(null);
                          setActiveGame(game.id);
                          soundManager.playLocalSound("click");
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            {/* Game Area - Desktop - Enhanced */}
            <main className="glass-neon rounded-3xl p-8 flex items-center justify-center overflow-hidden shadow-app-lg border border-border/50">
              <GameTransition gameKey={activeGame} direction={swipeDirection}>
                {renderGame()}
              </GameTransition>
            </main>
          </div>

          {/* Desktop Footer - Enhanced */}
          <footer className="hidden lg:block text-center mt-6 text-muted-foreground font-rajdhani text-sm py-4">
            <p className="flex items-center justify-center gap-2">
              <span className="flex items-center gap-1">
                <Brain className="w-4 h-4 text-neon-cyan" />
                <span>Train your brain</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Swords className="w-4 h-4 text-neon-purple" />
                <span>Challenge friends</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Gamepad2 className="w-4 h-4 text-neon-pink" />
                <span>Have fun!</span>
              </span>
            </p>
          </footer>
        </div>

          {/* Mobile: Universal Code Input Button - Enhanced */}
          <div className="lg:hidden fixed bottom-24 right-4 z-40">
            <Button
              onClick={openUniversalCodeInput}
              size="icon"
              className="h-14 w-14 rounded-full bg-gradient-to-br from-neon-purple/30 to-neon-pink/30 border-2 border-neon-purple/50 text-neon-purple shadow-app-lg hover:bg-neon-purple/40 hover:scale-110 active:scale-95 transition-all animate-float"
            >
              <Gamepad2 className="w-7 h-7 drop-shadow-lg" />
            </Button>
          </div>

          {/* Mobile Bottom Navigation - Modern App Style */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-neon-cyan/20 px-3 py-2 safe-area-bottom shadow-[0_-8px_32px_rgba(0,0,0,0.5),0_0_80px_hsl(var(--neon-cyan)/0.15)] animate-slide-up-full">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {/* Multiplayer Section */}
            <div className="flex gap-2 pr-3 border-r border-border/30">
              {multiplayerGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => handleGameSwitch(game.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl min-w-[56px] transition-all duration-300 active:scale-90 hover:scale-105 ${
                    activeGame === game.id
                      ? `bg-neon-${game.color}/20 border-2 border-neon-${game.color}/60 shadow-app`
                      : "bg-transparent border-2 border-transparent hover:bg-muted/20"
                  }`}
                >
                  <game.icon
                    className={`w-5 h-5 transition-all ${activeGame === game.id ? `text-neon-${game.color} drop-shadow-lg` : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-[9px] font-orbitron mt-1 truncate max-w-[52px] font-semibold transition-all ${activeGame === game.id ? `text-neon-${game.color}` : "text-muted-foreground"}`}
                  >
                    {game.title.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
            {/* Solo Section */}
            <div className="flex gap-2 pl-2">
              {singlePlayerGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => handleGameSwitch(game.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl min-w-[56px] transition-all duration-300 active:scale-90 hover:scale-105 ${
                    activeGame === game.id
                      ? `bg-neon-${game.color}/20 border-2 border-neon-${game.color}/60 shadow-app`
                      : "bg-transparent border-2 border-transparent hover:bg-muted/20"
                  }`}
                >
                  <game.icon
                    className={`w-5 h-5 transition-all ${activeGame === game.id ? `text-neon-${game.color} drop-shadow-lg` : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-[9px] font-orbitron mt-1 truncate max-w-[52px] font-semibold transition-all ${activeGame === game.id ? `text-neon-${game.color}` : "text-muted-foreground"}`}
                  >
                    {game.title.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {/* iOS Home Indicator - Modern */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-36 h-1 bg-foreground/20 rounded-full" />
          </div>
        </nav>

        {/* Bottom nav spacer for mobile */}
        <div className="lg:hidden h-16 shrink-0" />

        {/* Modals */}
        <Leaderboard isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
        <GameStatsDashboard isOpen={showStats} onClose={() => setShowStats(false)} />
        <DailyChallenges isOpen={showDailyChallenges} onClose={() => setShowDailyChallenges(false)} />
        <UserProfile isOpen={showUserProfile} onClose={() => setShowUserProfile(false)} />
        <GameRoomsBrowser
          isOpen={showRoomsBrowser}
          onClose={() => setShowRoomsBrowser(false)}
          onJoinRoom={handleJoinGameByCode}
        />
        <FriendsList
          isOpen={showFriends}
          onClose={() => setShowFriends(false)}
          onInviteFriend={(friendId) => {
            // TODO: Implement friend invite to game
            toast({
              title: 'Invite Sent',
              description: 'Friend invite sent!',
            });
          }}
        />
        <Tournament isOpen={showTournament} onClose={() => setShowTournament(false)} />
        <GameHistory isOpen={showGameHistory} onClose={() => setShowGameHistory(false)} />
        <PowerUpsShop isOpen={showPowerUpsShop} onClose={() => setShowPowerUpsShop(false)} />
        
        {/* PWA Install Prompt */}
        {showInstallPrompt && !isPWAInstalled() && (
          <div className="fixed bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-96 z-50 animate-slide-in">
            <div className="bg-card border-2 border-neon-cyan rounded-xl p-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="text-3xl">📱</div>
                <div className="flex-1">
                  <h3 className="font-orbitron text-sm font-semibold text-foreground mb-1">
                    Install Mind Games
                  </h3>
                  <p className="text-xs text-muted-foreground font-rajdhani mb-3">
                    Install for a better experience with offline support!
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        installPWA();
                        setShowInstallPrompt(false);
                        haptics.success();
                      }}
                      className="bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 flex-1"
                    >
                      Install
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowInstallPrompt(false);
                        haptics.light();
                      }}
                    >
                      Later
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leave Game Confirmation Dialog */}
        <LeaveGameDialog
          isOpen={showLeaveDialog}
          gameName={activeGameName || games.find((g) => g.id === activeGame)?.title || "this game"}
          onConfirm={confirmLeaveGame}
          onCancel={cancelLeaveGame}
        />

        {/* Universal Game Code Input */}
        <UniversalGameCodeInput
          isOpen={showUniversalCodeInput}
          onClose={() => setShowUniversalCodeInput(false)}
          onJoinGame={handleJoinGameByCode}
        />
      </div>
    </AchievementContext.Provider>
  );
};

const Index: React.FC = () => (
  <DifficultyProvider>
    <ActiveGameProvider>
      <GameChannelProvider>
        <ChallengeProvider>
          <UserProfileProvider>
            <PowerUpsProvider>
              <IndexContent />
            </PowerUpsProvider>
          </UserProfileProvider>
        </ChallengeProvider>
      </GameChannelProvider>
    </ActiveGameProvider>
  </DifficultyProvider>
);

export default Index;
