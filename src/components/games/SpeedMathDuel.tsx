import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calculator, Copy, Check, Wifi, WifiOff, Trophy, RotateCcw, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateWin } from '@/utils/confetti';
import { useToast } from '@/hooks/use-toast';

type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'playing' | 'ended';
type Operator = '+' | '-' | '×';

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  y: number;
  delay: number;
  scale: number;
}

interface Problem {
  num1: number;
  num2: number;
  operator: Operator;
  answer: number;
}

const GAME_DURATION = 60;
const PROBLEMS_COUNT = 20;
const REACTION_EMOJIS = ['😍', '🔥', '😂', '😤', '🥵', '👏', '💯', '✨', '🎉', '💀'];

const generateProblem = (): Problem => {
  const operators: Operator[] = ['+', '-', '×'];
  const operator = operators[Math.floor(Math.random() * operators.length)];
  
  let num1: number, num2: number, answer: number;
  
  switch (operator) {
    case '+':
      num1 = Math.floor(Math.random() * 50) + 1;
      num2 = Math.floor(Math.random() * 50) + 1;
      answer = num1 + num2;
      break;
    case '-':
      num1 = Math.floor(Math.random() * 50) + 20;
      num2 = Math.floor(Math.random() * num1);
      answer = num1 - num2;
      break;
    case '×':
      num1 = Math.floor(Math.random() * 12) + 1;
      num2 = Math.floor(Math.random() * 12) + 1;
      answer = num1 * num2;
      break;
  }
  
  return { num1, num2, operator, answer };
};

const SpeedMathDuel: React.FC = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameStarted, setGameStarted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  
  const channelRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Spawn floating emojis
  const spawnFloatingEmojis = useCallback((emoji: string) => {
    const newEmojis: FloatingEmoji[] = [];
    for (let i = 0; i < 10; i++) {
      newEmojis.push({
        id: `${Date.now()}-${i}`,
        emoji,
        x: 10 + Math.random() * 80,
        y: 60 + Math.random() * 30,
        delay: i * 0.06,
        scale: 0.7 + Math.random() * 0.5,
      });
    }
    setFloatingEmojis(prev => [...prev, ...newEmojis]);
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => !newEmojis.find(n => n.id === e.id)));
    }, 2500);
  }, []);

  const handleReaction = (emoji: string) => {
    haptics.light();
    soundManager.playEmojiSound(emoji);
    spawnFloatingEmojis(emoji);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { emoji },
      });
    }
  };

  const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const generateProblems = useCallback(() => {
    return Array(PROBLEMS_COUNT).fill(null).map(() => generateProblem());
  }, []);

  const createRoom = async () => {
    const code = generateRoomCode();
    const newProblems = generateProblems();
    setRoomCode(code);
    setIsHost(true);
    setProblems(newProblems);

    try {
      await supabase.from('game_rooms').insert([{
        room_code: code,
        game_type: 'speedmath',
        game_state: JSON.parse(JSON.stringify({ problems: newProblems, scores: { host: 0, guest: 0 } })),
        status: 'waiting',
      }]);
      setMode('waiting');
      toast({ title: 'Room Created!', description: 'Share the code with a friend' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create room' });
    }
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) return;

    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', joinCode.toUpperCase())
        .single();

      if (error || !data) {
        toast({ variant: 'destructive', title: 'Error', description: 'Room not found' });
        return;
      }

      const gameState = data.game_state as any;
      setRoomCode(joinCode.toUpperCase());
      setIsHost(false);
      setProblems(gameState.problems || generateProblems());
      setIsConnected(true);
      setMode('playing');
      setGameStarted(true);

      await supabase.from('game_rooms')
        .update({ player_count: 2, status: 'playing' })
        .eq('room_code', joinCode.toUpperCase());

      haptics.success();
      toast({ title: 'Joined!', description: 'Game starting!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to join room' });
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Timer
  useEffect(() => {
    if (!gameStarted || mode !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, mode]);

  // Subscribe to room
  useEffect(() => {
    if (!roomCode || (mode !== 'waiting' && mode !== 'playing' && mode !== 'ended')) return;

    const channel = supabase
      .channel(`speedmath-${roomCode}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'game_left' }, () => {
        toast({ title: 'Opponent Left', description: 'The game has ended' });
        resetGame();
      })
      .on('broadcast', { event: 'player_joined' }, () => {
        if (mode === 'waiting') {
          setMode('playing');
          setIsConnected(true);
          setGameStarted(true);
          haptics.success();
          toast({ title: 'Player Joined!', description: 'GO GO GO!' });
        }
      })
      .on('broadcast', { event: 'score_update' }, ({ payload }) => {
        if (payload) {
          setOpponentScore(payload.score);
        }
      })
      .on('broadcast', { event: 'game_ended' }, ({ payload }) => {
        if (payload) {
          setOpponentScore(payload.finalScore);
          setMode('ended');
        }
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (payload?.emoji) {
          soundManager.playEmojiSound(payload.emoji);
          spawnFloatingEmojis(payload.emoji);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && !isHost) {
          await channel.send({
            type: 'broadcast',
            event: 'player_joined',
            payload: {},
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, mode, isHost]);

  // Focus input
  useEffect(() => {
    if (mode === 'playing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode, currentIndex]);

  const submitAnswer = () => {
    if (!userAnswer.trim()) return;

    const answer = parseInt(userAnswer);
    const correct = answer === problems[currentIndex]?.answer;

    if (correct) {
      const points = 10 + streak * 2; // Bonus for streak
      setMyScore(prev => prev + points);
      setStreak(prev => prev + 1);
      soundManager.playLocalSound('correct');
      haptics.success();

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'score_update',
          payload: { score: myScore + points },
        });
      }
    } else {
      setStreak(0);
      soundManager.playLocalSound('lose');
      haptics.error();
    }

    setUserAnswer('');
    
    if (currentIndex < problems.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      endGame();
    }
  };

  const endGame = () => {
    setMode('ended');
    
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'game_ended',
        payload: { finalScore: myScore },
      });
    }

    if (myScore > opponentScore) {
      celebrateWin();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitAnswer();
    }
  };

  const resetGame = () => {
    setMode('menu');
    setRoomCode('');
    setJoinCode('');
    setIsHost(false);
    setIsConnected(false);
    setProblems([]);
    setCurrentIndex(0);
    setUserAnswer('');
    setMyScore(0);
    setOpponentScore(0);
    setTimeLeft(GAME_DURATION);
    setGameStarted(false);
    setStreak(0);
  };

  const leaveGame = async () => {
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'game_left',
        payload: {},
      });
    }
    if (roomCode) {
      await supabase.from('game_rooms').delete().eq('room_code', roomCode);
    }
    resetGame();
  };

  const playAgain = async () => {
    const newProblems = generateProblems();
    setProblems(newProblems);
    setCurrentIndex(0);
    setUserAnswer('');
    setMyScore(0);
    setOpponentScore(0);
    setTimeLeft(GAME_DURATION);
    setStreak(0);
    setMode('playing');
    setGameStarted(true);
  };

  // Menu
  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calculator className="w-8 h-8 text-neon-green" />
            <h2 className="font-orbitron text-2xl font-bold">Speed Math Duel</h2>
          </div>
          <p className="text-muted-foreground">60 seconds of intense math!</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button onClick={createRoom} className="w-full bg-neon-green/20 border-neon-green text-neon-green hover:bg-neon-green/30">
            Create Room
          </Button>
          <div className="flex gap-2">
            <Input
              placeholder="Enter room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="flex-1"
            />
            <Button onClick={joinRoom} variant="outline">Join</Button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting
  if (mode === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-4">
        <div className="text-center">
          <WifiOff className="w-12 h-12 text-neon-green mx-auto mb-4 animate-pulse" />
          <h2 className="font-orbitron text-xl font-bold mb-2">Waiting for opponent...</h2>
          <p className="text-muted-foreground mb-4">Share this code:</p>
          <div className="flex items-center gap-2 justify-center">
            <span className="font-mono text-2xl font-bold text-neon-green">{roomCode}</span>
            <Button variant="ghost" size="icon" onClick={copyRoomCode}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <Button variant="outline" onClick={leaveGame}>Cancel</Button>
      </div>
    );
  }

  // Playing
  if (mode === 'playing' && problems.length > 0) {
    const currentProblem = problems[currentIndex];
    
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-4 w-full max-w-md">
      <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {isConnected ? <Wifi className="w-4 h-4 text-green-500 animate-pulse" /> : <WifiOff className="w-4 h-4 text-red-500" />}
            <Timer className={`w-5 h-5 ${timeLeft <= 10 ? 'text-red-500 animate-[spin_1s_linear_infinite]' : 'text-neon-orange'}`} />
            <span className={`font-mono text-xl font-bold transition-all duration-300 ${
              timeLeft <= 10 ? 'text-red-500 animate-pulse scale-110' : 
              timeLeft <= 30 ? 'text-neon-orange' : 'text-foreground'
            }`}>
              {timeLeft}s
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={leaveGame}>Leave</Button>
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-center gap-8 w-full">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">You</p>
            <p className="font-orbitron text-3xl font-bold text-neon-green drop-shadow-[0_0_10px_rgba(0,255,0,0.3)] transition-all duration-200" key={myScore} style={{ animation: 'pulse 0.3s ease-out' }}>{myScore}</p>
          </div>
          <span className="text-2xl text-muted-foreground">⚡</span>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Opponent</p>
            <p className="font-orbitron text-3xl font-bold text-neon-orange drop-shadow-[0_0_10px_rgba(255,165,0,0.3)] transition-all duration-200" key={opponentScore} style={{ animation: 'pulse 0.3s ease-out' }}>{opponentScore}</p>
          </div>
        </div>

        {/* Streak */}
        {streak > 1 && (
          <div className="flex items-center gap-2 animate-scale-in">
            <span className="text-2xl animate-[bounce_0.5s_ease-in-out_infinite]">🔥</span>
            <p className="text-neon-cyan font-bold">{streak} streak! (+{streak * 2} bonus)</p>
            <span className="text-2xl animate-[bounce_0.5s_ease-in-out_infinite_0.1s]">🔥</span>
          </div>
        )}

        {/* Problem */}
        <div className="bg-card/50 p-8 rounded-2xl text-center shadow-lg shadow-neon-green/10 animate-scale-in" key={currentIndex}>
          <p className="font-orbitron text-4xl font-bold bg-gradient-to-r from-neon-green via-neon-cyan to-neon-green bg-clip-text text-transparent">
            {currentProblem.num1} {currentProblem.operator} {currentProblem.num2} = ?
          </p>
        </div>

        {/* Input */}
        <div className="flex gap-2 w-full max-w-xs">
          <Input
            ref={inputRef}
            type="number"
            placeholder="Your answer"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyPress={handleKeyPress}
            className="text-center text-xl font-mono"
            autoFocus
          />
          <Button onClick={submitAnswer} className="bg-neon-green text-black">
            GO
          </Button>
        </div>

        {/* Progress */}
        <p className="text-sm text-muted-foreground">
          Problem {currentIndex + 1} / {problems.length}
        </p>

        {/* Reaction Bar */}
        <div className="flex flex-wrap gap-2 justify-center max-w-xs">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="text-xl p-1.5 rounded-full bg-muted/50 hover:bg-muted hover:scale-125 active:scale-95 transition-all duration-200"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Floating Emojis */}
        {floatingEmojis.map((e) => (
          <span
            key={e.id}
            className="fixed text-3xl pointer-events-none animate-float-up"
            style={{
              left: `${e.x}%`,
              top: `${e.y}%`,
              animationDelay: `${e.delay}s`,
              transform: `scale(${e.scale})`,
              zIndex: 50,
            }}
          >
            {e.emoji}
          </span>
        ))}
      </div>
    );
  }

  // Ended
  if (mode === 'ended') {
    const won = myScore > opponentScore;
    const tied = myScore === opponentScore;

    return (
      <div className="flex flex-col items-center justify-center gap-6 p-4">
        <Trophy className={`w-16 h-16 ${won ? 'text-neon-green' : tied ? 'text-yellow-500' : 'text-red-500'}`} />
        <h2 className="font-orbitron text-2xl font-bold">
          {won ? 'You Win!' : tied ? "It's a Tie!" : 'You Lose!'}
        </h2>
        <div className="text-center">
          <p className="text-3xl font-bold">
            <span className="text-neon-green">{myScore}</span>
            <span className="text-muted-foreground mx-2">-</span>
            <span className="text-neon-orange">{opponentScore}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={playAgain} className="bg-neon-green/20 text-neon-green">
            <RotateCcw className="w-4 h-4 mr-2" /> Play Again
          </Button>
          <Button variant="outline" onClick={leaveGame}>Leave</Button>
        </div>
      </div>
    );
  }

  return null;
};

export default SpeedMathDuel;
