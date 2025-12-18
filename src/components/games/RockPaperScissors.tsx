import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Hand, Copy, Check, RotateCcw, Wifi, WifiOff, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateWin, celebrateEpicVictory, celebrateStars } from '@/utils/confetti';
import { useToast } from '@/hooks/use-toast';

type Choice = 'rock' | 'paper' | 'scissors' | null;
type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'playing' | 'result';

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  y: number;
  delay: number;
  scale: number;
}

interface GameState {
  myChoice: Choice;
  opponentChoice: Choice;
  myScore: number;
  opponentScore: number;
  round: number;
  maxRounds: number;
}

const choices: { id: Choice; emoji: string; label: string }[] = [
  { id: 'rock', emoji: '🪨', label: 'Rock' },
  { id: 'paper', emoji: '📄', label: 'Paper' },
  { id: 'scissors', emoji: '✂️', label: 'Scissors' },
];

const REACTION_EMOJIS = ['😍', '🔥', '😂', '😤', '🥵', '👏', '💯', '✨', '🎉', '💀'];

const getWinner = (choice1: Choice, choice2: Choice): 'player1' | 'player2' | 'draw' => {
  if (!choice1 || !choice2) return 'draw';
  if (choice1 === choice2) return 'draw';
  if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'paper' && choice2 === 'rock') ||
    (choice1 === 'scissors' && choice2 === 'paper')
  ) {
    return 'player1';
  }
  return 'player2';
};

const RockPaperScissors: React.FC = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    myChoice: null,
    opponentChoice: null,
    myScore: 0,
    opponentScore: 0,
    round: 1,
    maxRounds: 5,
  });
  const [showResult, setShowResult] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const channelRef = useRef<any>(null);

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

  const createRoom = async () => {
    const code = generateRoomCode();
    setRoomCode(code);
    setIsHost(true);

    try {
      await supabase.from('game_rooms').insert({
        room_code: code,
        game_type: 'rps',
        game_state: { round: 1, scores: { host: 0, guest: 0 } },
        status: 'waiting',
      });
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

      setRoomCode(joinCode.toUpperCase());
      setIsHost(false);
      setMode('playing');
      setIsConnected(true);

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

  // Subscribe to room
  useEffect(() => {
    if (!roomCode || (mode !== 'waiting' && mode !== 'playing' && mode !== 'result')) return;

    const channel = supabase
      .channel(`rps-${roomCode}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'game_left' }, () => {
        toast({ title: 'Opponent Left', description: 'The game has ended' });
        resetGame();
      })
      .on('broadcast', { event: 'player_joined' }, () => {
        if (mode === 'waiting') {
          setMode('playing');
          setIsConnected(true);
          haptics.success();
          toast({ title: 'Player Joined!', description: 'Game starting!' });
        }
      })
      .on('broadcast', { event: 'choice_made' }, ({ payload }) => {
        if (payload) {
          setGameState(prev => ({ ...prev, opponentChoice: payload.choice }));
        }
      })
      .on('broadcast', { event: 'next_round' }, ({ payload }) => {
        if (payload) {
          setGameState(prev => ({
            ...prev,
            round: payload.round,
            myChoice: null,
            opponentChoice: null,
          }));
          setShowResult(false);
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

  // Handle both choices made
  useEffect(() => {
    if (gameState.myChoice && gameState.opponentChoice && !showResult) {
      setShowResult(true);
      const winner = getWinner(gameState.myChoice, gameState.opponentChoice);
      
      if (winner === 'player1') {
        soundManager.playLocalSound('win');
        haptics.success();
        setGameState(prev => ({ ...prev, myScore: prev.myScore + 1 }));
      } else if (winner === 'player2') {
        soundManager.playLocalSound('lose');
        haptics.error();
        setGameState(prev => ({ ...prev, opponentScore: prev.opponentScore + 1 }));
      } else {
        soundManager.playLocalSound('click');
      }

      // Check if game is over
      setTimeout(() => {
        const newMyScore = gameState.myScore + (winner === 'player1' ? 1 : 0);
        const newOpponentScore = gameState.opponentScore + (winner === 'player2' ? 1 : 0);
        
        if (gameState.round >= gameState.maxRounds || newMyScore >= 3 || newOpponentScore >= 3) {
          if (newMyScore > newOpponentScore) {
            celebrateEpicVictory();
            spawnFloatingEmojis('🏆');
            setTimeout(() => spawnFloatingEmojis('🎉'), 300);
          }
          setMode('result');
        } else {
          // Next round
          const nextRound = gameState.round + 1;
          setGameState(prev => ({
            ...prev,
            round: nextRound,
            myChoice: null,
            opponentChoice: null,
          }));
          setShowResult(false);
          
          if (isHost && channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'next_round',
              payload: { round: nextRound },
            });
          }
        }
      }, 2000);
    }
  }, [gameState.myChoice, gameState.opponentChoice, showResult]);

  const makeChoice = (choice: Choice) => {
    if (gameState.myChoice) return;
    
    haptics.medium();
    soundManager.playLocalSound('click');
    setGameState(prev => ({ ...prev, myChoice: choice }));

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'choice_made',
        payload: { choice },
      });
    }
  };

  const resetGame = () => {
    setMode('menu');
    setRoomCode('');
    setJoinCode('');
    setIsHost(false);
    setIsConnected(false);
    setShowResult(false);
    setGameState({
      myChoice: null,
      opponentChoice: null,
      myScore: 0,
      opponentScore: 0,
      round: 1,
      maxRounds: 5,
    });
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

  const playAgain = () => {
    setGameState({
      myChoice: null,
      opponentChoice: null,
      myScore: 0,
      opponentScore: 0,
      round: 1,
      maxRounds: 5,
    });
    setShowResult(false);
    setMode('playing');
  };

  // Menu
  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Hand className="w-8 h-8 text-neon-orange" />
            <h2 className="font-orbitron text-2xl font-bold">Rock Paper Scissors</h2>
          </div>
          <p className="text-muted-foreground">Best of 5 rounds!</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button onClick={createRoom} className="w-full bg-neon-orange/20 border-neon-orange text-neon-orange hover:bg-neon-orange/30">
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
          <WifiOff className="w-12 h-12 text-neon-orange mx-auto mb-4 animate-pulse" />
          <h2 className="font-orbitron text-xl font-bold mb-2">Waiting for opponent...</h2>
          <p className="text-muted-foreground mb-4">Share this code:</p>
          <div className="flex items-center gap-2 justify-center">
            <span className="font-mono text-2xl font-bold text-neon-orange">{roomCode}</span>
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
  if (mode === 'playing') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-4 w-full max-w-md">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {isConnected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
            <span className="text-sm text-muted-foreground">Round {gameState.round}/{gameState.maxRounds}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={leaveGame}>Leave</Button>
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-center gap-8 w-full">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">You</p>
            <p className="font-orbitron text-3xl font-bold text-neon-cyan transition-all duration-300" key={gameState.myScore} style={{ animation: 'pulse 0.3s ease-out' }}>{gameState.myScore}</p>
          </div>
          <span className="text-2xl text-muted-foreground animate-pulse">⚡</span>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Opponent</p>
            <p className="font-orbitron text-3xl font-bold text-neon-orange transition-all duration-300" key={gameState.opponentScore} style={{ animation: 'pulse 0.3s ease-out' }}>{gameState.opponentScore}</p>
          </div>
        </div>

        {/* Choices Display */}
        {showResult ? (
          <div className="flex items-center justify-center gap-8 py-4">
            <div className="text-center animate-scale-in">
              <p className="text-6xl mb-2 animate-[bounce_0.5s_ease-in-out]">{choices.find(c => c.id === gameState.myChoice)?.emoji}</p>
              <p className="text-sm text-muted-foreground">You</p>
            </div>
            <span className="text-2xl animate-pulse">⚔️</span>
            <div className="text-center animate-scale-in" style={{ animationDelay: '0.2s' }}>
              <p className="text-6xl mb-2 animate-[bounce_0.5s_ease-in-out_0.2s]">{choices.find(c => c.id === gameState.opponentChoice)?.emoji}</p>
              <p className="text-sm text-muted-foreground">Opponent</p>
            </div>
          </div>
        ) : gameState.myChoice ? (
          <div className="text-center py-8">
            <p className="text-6xl mb-4 animate-[pulse_1s_ease-in-out_infinite]">{choices.find(c => c.id === gameState.myChoice)?.emoji}</p>
            <p className="text-muted-foreground animate-pulse">Waiting for opponent...</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 w-full">
            {choices.map((choice, index) => (
              <Button
                key={choice.id}
                variant="outline"
                className="h-24 text-4xl hover:scale-125 hover:rotate-12 active:scale-95 transition-all duration-200 hover:shadow-lg hover:shadow-neon-orange/30 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => makeChoice(choice.id)}
              >
                {choice.emoji}
              </Button>
            ))}
          </div>
        )}

        {!gameState.myChoice && !showResult && (
          <p className="text-center text-muted-foreground">Make your choice!</p>
        )}

        {/* Reaction Bar */}
        <div className="flex flex-wrap gap-2 justify-center max-w-xs mt-4">
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

  // Result
  if (mode === 'result') {
    const won = gameState.myScore > gameState.opponentScore;
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-4">
        <Trophy className={`w-16 h-16 ${won ? 'text-neon-green' : 'text-red-500'}`} />
        <h2 className="font-orbitron text-2xl font-bold">
          {won ? 'You Win!' : gameState.myScore === gameState.opponentScore ? "It's a Tie!" : 'You Lose!'}
        </h2>
        <p className="text-xl">
          {gameState.myScore} - {gameState.opponentScore}
        </p>
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

export default RockPaperScissors;
