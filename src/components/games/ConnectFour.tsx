import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Circle, Copy, Check, RotateCcw, Wifi, WifiOff, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateWin, celebrateEpicVictory, celebrateStars } from '@/utils/confetti';
import { useToast } from '@/hooks/use-toast';

type Player = 'red' | 'yellow' | null;
type Board = Player[][];
type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'playing' | 'ended';

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  y: number;
  delay: number;
  scale: number;
}

const ROWS = 6;
const COLS = 7;
const REACTION_EMOJIS = ['😍', '🔥', '😂', '😤', '🥵', '👏', '💯', '✨', '🎉', '💀'];

const createEmptyBoard = (): Board => 
  Array(ROWS).fill(null).map(() => Array(COLS).fill(null));

const checkWinner = (board: Board, row: number, col: number, player: Player): boolean => {
  if (!player) return false;

  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal down-right
    [1, -1],  // diagonal down-left
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    
    // Check positive direction
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
        count++;
      } else break;
    }
    
    // Check negative direction
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
        count++;
      } else break;
    }

    if (count >= 4) return true;
  }
  return false;
};

const ConnectFour: React.FC = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<GameMode>('menu');
  const [board, setBoard] = useState<Board>(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<'red' | 'yellow'>('red');
  const [winner, setWinner] = useState<Player>(null);
  const [myColor, setMyColor] = useState<'red' | 'yellow'>('red');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [scores, setScores] = useState({ red: 0, yellow: 0 });
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
    setMyColor('red');

    try {
      await supabase.from('game_rooms').insert({
        room_code: code,
        game_type: 'connect4',
        game_state: { board: createEmptyBoard(), currentPlayer: 'red', scores: { red: 0, yellow: 0 } },
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

      const code = joinCode.toUpperCase();
      setRoomCode(code);
      setMyColor('yellow');
      setMode('playing');
      setIsConnected(true);

      await supabase.from('game_rooms')
        .update({ player_count: 2, status: 'playing' })
        .eq('room_code', code);

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
    if (!roomCode || (mode !== 'waiting' && mode !== 'playing' && mode !== 'ended')) return;

    const channel = supabase
      .channel(`c4-${roomCode}`, { config: { broadcast: { self: false } } })
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
      .on('broadcast', { event: 'game_update' }, ({ payload }) => {
        if (payload) {
          if (payload.board) setBoard(payload.board);
          if (payload.currentPlayer) setCurrentPlayer(payload.currentPlayer);
          if (payload.winner !== undefined) {
            setWinner(payload.winner);
            if (payload.winner && payload.winner !== myColor) {
              soundManager.playLocalSound('lose');
              haptics.screenShake();
            }
          }
          if (payload.scores) setScores(payload.scores);
        }
      })
      .on('broadcast', { event: 'restart_game' }, () => {
        setBoard(createEmptyBoard());
        setCurrentPlayer('red');
        setWinner(null);
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (payload?.emoji) {
          soundManager.playEmojiSound(payload.emoji);
          spawnFloatingEmojis(payload.emoji);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && myColor === 'yellow') {
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
  }, [roomCode, mode, myColor]);

  const dropPiece = useCallback((col: number) => {
    if (winner || currentPlayer !== myColor || mode !== 'playing') return;

    // Find lowest empty row
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!board[r][col]) {
        row = r;
        break;
      }
    }
    if (row === -1) return; // Column full

    haptics.medium();
    soundManager.playLocalSound('click');

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);

    // Check for winner
    if (checkWinner(newBoard, row, col, currentPlayer)) {
      setWinner(currentPlayer);
      const newScores = { ...scores, [currentPlayer]: scores[currentPlayer] + 1 };
      setScores(newScores);
      soundManager.playLocalSound('win');
      haptics.success();
      celebrateEpicVictory();
      spawnFloatingEmojis('🏆');
      setTimeout(() => spawnFloatingEmojis('🎉'), 300);

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'game_update',
          payload: { board: newBoard, winner: currentPlayer, scores: newScores },
        });
      }
    } else {
      // Check for draw
      const isDraw = newBoard.every(row => row.every(cell => cell !== null));
      if (isDraw) {
        setWinner(null);
        // Handle draw if needed
      } else {
        const nextPlayer = currentPlayer === 'red' ? 'yellow' : 'red';
        setCurrentPlayer(nextPlayer);

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'game_update',
            payload: { board: newBoard, currentPlayer: nextPlayer },
          });
        }
      }
    }
  }, [board, currentPlayer, myColor, mode, winner, scores]);

  const resetGame = () => {
    setMode('menu');
    setBoard(createEmptyBoard());
    setCurrentPlayer('red');
    setWinner(null);
    setRoomCode('');
    setJoinCode('');
    setIsConnected(false);
    setScores({ red: 0, yellow: 0 });
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

  const restartGame = () => {
    setBoard(createEmptyBoard());
    setCurrentPlayer('red');
    setWinner(null);

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'restart_game',
        payload: {},
      });
    }
  };

  // Menu
  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Circle className="w-8 h-8 text-red-500 fill-red-500" />
            <h2 className="font-orbitron text-2xl font-bold">Connect Four</h2>
            <Circle className="w-8 h-8 text-yellow-500 fill-yellow-500" />
          </div>
          <p className="text-muted-foreground">Get 4 in a row to win!</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button onClick={createRoom} className="w-full bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30">
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
          <WifiOff className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
          <h2 className="font-orbitron text-xl font-bold mb-2">Waiting for opponent...</h2>
          <p className="text-muted-foreground mb-4">Share this code:</p>
          <div className="flex items-center gap-2 justify-center">
            <span className="font-mono text-2xl font-bold text-red-500">{roomCode}</span>
            <Button variant="ghost" size="icon" onClick={copyRoomCode}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <Button variant="outline" onClick={leaveGame}>Cancel</Button>
      </div>
    );
  }

  // Playing / Ended
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-2 w-full max-w-sm">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {isConnected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
          <div className="flex items-center gap-1">
            <Circle className={`w-4 h-4 ${myColor === 'red' ? 'text-red-500 fill-red-500' : 'text-yellow-500 fill-yellow-500'}`} />
            <span className="text-sm text-muted-foreground">You</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={leaveGame}>Leave</Button>
      </div>

      {/* Scoreboard */}
      <div className="flex items-center justify-center gap-8 w-full">
        <div className="text-center">
          <Circle className="w-6 h-6 text-red-500 fill-red-500 mx-auto" />
          <p className="font-orbitron text-2xl font-bold">{scores.red}</p>
        </div>
        <span className="text-xl text-muted-foreground">vs</span>
        <div className="text-center">
          <Circle className="w-6 h-6 text-yellow-500 fill-yellow-500 mx-auto" />
          <p className="font-orbitron text-2xl font-bold">{scores.yellow}</p>
        </div>
      </div>

      {/* Turn Indicator */}
      {!winner && (
        <p className={`text-sm ${currentPlayer === myColor ? 'text-neon-green' : 'text-muted-foreground'}`}>
          {currentPlayer === myColor ? "Your turn!" : "Opponent's turn..."}
        </p>
      )}

      {/* Board */}
      <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/30">
        <div className="grid grid-cols-7 gap-1">
          {Array(COLS).fill(null).map((_, col) => (
            <button
              key={col}
              onClick={() => dropPiece(col)}
              disabled={winner !== null || currentPlayer !== myColor}
              className="flex flex-col gap-1 hover:bg-blue-500/50 rounded p-0.5 transition-all duration-200 disabled:cursor-not-allowed group"
            >
              {Array(ROWS).fill(null).map((_, row) => (
                <div
                  key={row}
                  className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-blue-800 transition-all duration-300 ${
                    board[row][col] === 'red' 
                      ? 'bg-red-500 shadow-md shadow-red-500/50 animate-scale-in' 
                      : board[row][col] === 'yellow' 
                        ? 'bg-yellow-500 shadow-md shadow-yellow-500/50 animate-scale-in' 
                        : 'bg-blue-900 group-hover:bg-blue-800 group-hover:scale-105'
                  }`}
                />
              ))}
            </button>
          ))}
        </div>
      </div>

      {/* Winner Display */}
      {winner && (
        <div className="text-center animate-scale-in">
          <Trophy className={`w-12 h-12 mx-auto mb-2 animate-[bounce_0.5s_ease-in-out_infinite] ${winner === myColor ? 'text-neon-green drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]' : 'text-red-500 drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]'}`} />
          <p className="font-orbitron text-2xl font-bold animate-pulse">
            {winner === myColor ? '🎉 You Win! 🎉' : '😢 You Lose!'}
          </p>
          <Button onClick={restartGame} className="mt-4 hover:scale-105 transition-transform">
            <RotateCcw className="w-4 h-4 mr-2" /> Play Again
          </Button>
        </div>
      )}

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
};

export default ConnectFour;
