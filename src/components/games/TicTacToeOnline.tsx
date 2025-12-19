import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Grid3X3, Users, Copy, Check, RotateCcw, Wifi, WifiOff, Timer, Trophy, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { checkSupabaseConfig } from '@/utils/supabaseHelpers';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateWin } from '@/utils/confetti';
import { useToast } from '@/hooks/use-toast';
import { usePendingJoin } from '@/hooks/usePendingJoin';
import { useGameChannel } from '@/contexts/GameChannelContext';
import { useChallengeContext } from '@/contexts/ChallengeContext';

type Player = 'X' | 'O' | null;
type Board = Player[];
type GameMode = 'menu' | 'local' | 'online-create' | 'online-join' | 'online-waiting' | 'online-playing';
type GridSize = 3 | 4 | 5;

interface GameState {
  board: Board;
  currentPlayer: 'X' | 'O';
  winner: Player;
  scores: { X: number; O: number };
  gridSize: GridSize;
}

interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
}

const TURN_TIME = 15; // seconds per turn

const getWinningCombinations = (size: GridSize): number[][] => {
  const combinations: number[][] = [];
  
  for (let i = 0; i < size; i++) {
    const row = [];
    for (let j = 0; j < size; j++) {
      row.push(i * size + j);
    }
    combinations.push(row);
  }
  
  for (let i = 0; i < size; i++) {
    const col = [];
    for (let j = 0; j < size; j++) {
      col.push(j * size + i);
    }
    combinations.push(col);
  }
  
  const diag1 = [];
  const diag2 = [];
  for (let i = 0; i < size; i++) {
    diag1.push(i * size + i);
    diag2.push(i * size + (size - 1 - i));
  }
  combinations.push(diag1, diag2);
  
  return combinations;
};

const loadStats = (): GameStats => {
  const saved = localStorage.getItem('tictactoe-stats');
  if (saved) return JSON.parse(saved);
  return { totalGames: 0, wins: 0, losses: 0, draws: 0 };
};

const saveStats = (stats: GameStats) => {
  localStorage.setItem('tictactoe-stats', JSON.stringify(stats));
};

const TicTacToeOnline: React.FC = () => {
  const { toast } = useToast();
  const pendingJoin = usePendingJoin();
  const { setChannelRef, setPlayerName, setRoomId } = useGameChannel();
  const [mode, setMode] = useState<GameMode>('menu');
  const [localRoomId, setLocalRoomId] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>(3);
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [isLoading, setIsLoading] = useState(false);
  const [winner, setWinner] = useState<Player>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const [isDraw, setIsDraw] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<GameStats>(loadStats);
  const [gameStarted, setGameStarted] = useState(false); // Only true when game actually starts

  // Timer state
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Online state
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mySymbol, setMySymbol] = useState<'X' | 'O'>('X');
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<any>(null);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };


  const checkWinner = useCallback((board: Board, size: GridSize): { winner: Player; line: number[] | null } => {
    const combinations = getWinningCombinations(size);
    for (const combination of combinations) {
      const first = board[combination[0]];
      if (first && combination.every(idx => board[idx] === first)) {
        return { winner: first, line: combination };
      }
    }
    return { winner: null, line: null };
  }, []);

  const updateStats = useCallback((result: 'win' | 'loss' | 'draw') => {
    setStats(prev => {
      const newStats = {
        ...prev,
        totalGames: prev.totalGames + 1,
        wins: result === 'win' ? prev.wins + 1 : prev.wins,
        losses: result === 'loss' ? prev.losses + 1 : prev.losses,
        draws: result === 'draw' ? prev.draws + 1 : prev.draws,
      };
      saveStats(newStats);
      return newStats;
    });
  }, []);

  // Timer countdown - ONLY when game actually started
  useEffect(() => {
    if (gameStarted && !winner && !isDraw) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (mode === 'online-playing') {
              const isMyTurn = currentPlayer === mySymbol;
              if (isMyTurn) {
                haptics.error();
                soundManager.playLocalSound('lose');
                
                const opponent: 'X' | 'O' = mySymbol === 'X' ? 'O' : 'X';
                const newScores = { ...scores, [opponent]: scores[opponent] + 1 };
                setScores(newScores);
                setWinner(opponent);
                updateStats('loss');
                
                if (channelRef.current) {
                  channelRef.current.send({
                    type: 'broadcast',
                    event: 'game_update',
                    payload: { timeout: true, winner: opponent, scores: newScores }
                  });
                }
              }
            } else if (mode === 'local') {
              setCurrentPlayer(prev => prev === 'X' ? 'O' : 'X');
            }
            return TURN_TIME;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [gameStarted, winner, isDraw, currentPlayer, mySymbol, scores, updateStats, mode]);

  // Reset timer on player change
  useEffect(() => {
    setTimeLeft(TURN_TIME);
  }, [currentPlayer]);

  // Auto-restart after win/draw
  useEffect(() => {
    if (winner || isDraw) {
      if (timerRef.current) clearInterval(timerRef.current);
      
      const timer = setTimeout(() => {
        const newBoard = Array(gridSize * gridSize).fill(null);
        setBoard(newBoard);
        setCurrentPlayer('X');
        setWinner(null);
        setWinningLine(null);
        setIsDraw(false);
        setTimeLeft(TURN_TIME);

        if (mode === 'online-playing' && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'game_update',
            payload: { board: newBoard, currentPlayer: 'X', winner: null, scores, autoRestart: true }
          });

          supabase.from('game_rooms')
            .update({ game_state: JSON.parse(JSON.stringify({ board: newBoard, currentPlayer: 'X', winner: null, scores, gridSize })) })
            .eq('room_code', roomCode)
            .then();
        }
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [winner, isDraw, gridSize, mode, roomCode, scores]);

  const createRoom = async (selectedSize: GridSize) => {
    if (!checkSupabaseConfig()) return;
    
    setIsLoading(true);
    const code = generateRoomCode();
    setRoomCode(code);
    setMySymbol('X');
    setGridSize(selectedSize);
    setBoard(Array(selectedSize * selectedSize).fill(null));
    setTimeLeft(TURN_TIME);
    
    try {
      const { data, error } = await supabase.from('game_rooms').insert({
        room_code: code,
        game_type: 'tictactoe',
        game_state: { board: Array(selectedSize * selectedSize).fill(null), currentPlayer: 'X', scores: { X: 0, O: 0 }, gridSize: selectedSize },
        status: 'waiting'
      }).select().single();

      if (error) throw error;
      setLocalRoomId(data.id);
      setRoomId(data.id);
      setMode('online-waiting');
      toast({ title: 'Room Created!', description: 'Share the code with a friend' });
    } catch (error) {
      console.error('Error creating room:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create room' });
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) return;
    if (!checkSupabaseConfig()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', joinCode.toUpperCase())
        .single();

      if (error || !data) {
        toast({ variant: 'destructive', title: 'Error', description: 'Room not found' });
        setIsLoading(false);
        return;
      }

      const code = joinCode.toUpperCase();
      const gameState = data.game_state as any;
      const size = gameState.gridSize || 3;
      
      setRoomCode(code);
      setLocalRoomId(data.id);
      setRoomId(data.id);
      setMySymbol('O');
      setGridSize(size);
      setBoard(gameState.board || Array(size * size).fill(null));
      setScores(gameState.scores || { X: 0, O: 0 });
      setTimeLeft(TURN_TIME);
      setMode('online-playing');
      setIsConnected(true);
      setGameStarted(true);
      
      // Update global context for chat/reactions
      setRoomId(data.id); // Game starts NOW
      
      // Instant broadcast to host
      const channel = supabase.channel(`ttt-${code}`);
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'game_update',
            payload: { player_joined: true }
          });
        }
      });

      supabase.from('game_rooms')
        .update({ player_count: 2, status: 'playing' })
        .eq('room_code', code)
        .then();

      haptics.success();
      toast({ title: 'Joined!', description: 'Game starting!' });
    } catch (error) {
      console.error('Error joining room:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to join room' });
    } finally {
      setIsLoading(false);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-join if pending join code exists
  useEffect(() => {
    if (pendingJoin && pendingJoin.gameType === 'tictactoe' && mode === 'menu' && !isLoading) {
      setJoinCode(pendingJoin.code);
      // Trigger join after state update
      const timer = setTimeout(() => {
        if (joinRoom) {
          // Use the existing joinRoom function
          const event = new Event('auto-join');
          (window as any).__autoJoinTicTacToe = pendingJoin.code;
          // Directly call join logic
          const autoJoin = async () => {
            if (!pendingJoin.code.trim()) return;
            if (!checkSupabaseConfig()) return;

            setIsLoading(true);
            try {
              const { data, error } = await supabase
                .from('game_rooms')
                .select('*')
                .eq('room_code', pendingJoin.code.toUpperCase())
                .single();

              if (error || !data) {
                toast({ variant: 'destructive', title: 'Error', description: 'Room not found' });
                setIsLoading(false);
                return;
              }

              const code = pendingJoin.code.toUpperCase();
              const gameState = data.game_state as any;
              const size = gameState.gridSize || 3;
              
              setRoomCode(code);
              setLocalRoomId(data.id);
              setRoomId(data.id);
              setMySymbol('O');
              setGridSize(size);
              setBoard(gameState.board || Array(size * size).fill(null));
              setScores(gameState.scores || { X: 0, O: 0 });
              setTimeLeft(TURN_TIME);
              setMode('online-playing');
              setIsConnected(true);
              setGameStarted(true);
              
              const channel = supabase.channel(`ttt-${code}`);
              channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                  await channel.send({
                    type: 'broadcast',
                    event: 'game_update',
                    payload: { player_joined: true }
                  });
                }
              });

              supabase.from('game_rooms')
                .update({ player_count: 2, status: 'playing' })
                .eq('room_code', code)
                .then();

              haptics.success();
              toast({ title: 'Joined!', description: 'Game starting!' });
            } catch (error) {
              console.error('Error joining room:', error);
              toast({ variant: 'destructive', title: 'Error', description: 'Failed to join room' });
            } finally {
              setIsLoading(false);
            }
          };
          autoJoin();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pendingJoin, mode, isLoading]);

  // Subscribe to room changes
  useEffect(() => {
    if (!roomCode || (mode !== 'online-waiting' && mode !== 'online-playing')) return;

    const channel = supabase
      .channel(`ttt-${roomCode}`, {
        config: { broadcast: { self: false } } // Don't receive own broadcasts
      })
      .on('broadcast', { event: 'game_left' }, () => {
        // Other player left - reset game
        toast({ title: 'Opponent Left', description: 'The game has ended' });
        setMode('menu');
        setRoomCode('');
        setJoinCode('');
        setBoard(Array(9).fill(null));
        setGridSize(3);
        setCurrentPlayer('X');
        setWinner(null);
        setWinningLine(null);
        setScores({ X: 0, O: 0 });
        setIsDraw(false);
        setIsConnected(false);
        setTimeLeft(TURN_TIME);
        setGameStarted(false);
      })
      .on('broadcast', { event: 'game_update' }, ({ payload }) => {
        if (payload) {
          if (payload.player_joined && mode === 'online-waiting') {
            setMode('online-playing');
            setIsConnected(true);
            setTimeLeft(TURN_TIME);
            setGameStarted(true); // Game starts NOW when opponent joins
            haptics.success();
            toast({ title: 'Player Joined!', description: 'Game starting!' });
          }
          
          if (payload.timeout && payload.winner) {
            setWinner(payload.winner);
            if (payload.scores) setScores(payload.scores);
            const isWinner = payload.winner === mySymbol;
            if (isWinner) {
              haptics.success();
              celebrateWin();
              updateStats('win');
              // Update daily challenges
              updateChallengeProgress('win', 'tictactoe');
            }
          }
          
          if (payload.board) setBoard(payload.board);
          if (payload.currentPlayer) {
            setCurrentPlayer(payload.currentPlayer);
            setTimeLeft(TURN_TIME);
          }
          if (payload.winner !== undefined) {
            setWinner(payload.winner);
            if (payload.winner && payload.board) {
              const result = checkWinner(payload.board, gridSize);
              setWinningLine(result.line);
            } else {
              setWinningLine(null);
            }
          }
          if (payload.scores) setScores(payload.scores);
          if (payload.autoRestart) {
            setWinner(null);
            setWinningLine(null);
            setIsDraw(false);
            setTimeLeft(TURN_TIME);
          }
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Only start game if opponent (different player) joins, not self
        if (mode === 'online-waiting' && newPresences.length > 0) {
          const isOpponentJoining = newPresences.some(p => (p as any).player !== mySymbol);
          if (isOpponentJoining) {
            setMode('online-playing');
            setIsConnected(true);
            setTimeLeft(TURN_TIME);
            setGameStarted(true);
            haptics.success();
            toast({ title: 'Player Joined!', description: 'Game starting!' });
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ player: mySymbol, joined_at: Date.now() });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, mode, mySymbol, gridSize, checkWinner, updateStats]);

  const handleClick = async (index: number) => {
    if (board[index] || winner || isDraw) return;
    if (mode === 'online-playing' && currentPlayer !== mySymbol) return;

    haptics.medium();
    
    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);
    soundManager.playLocalSound('click');

    const result = checkWinner(newBoard, gridSize);
    let newWinner = result.winner;
    let newScores = scores;
    const nextPlayer: 'X' | 'O' = currentPlayer === 'X' ? 'O' : 'X';

    if (result.winner) {
      setWinner(result.winner);
      setWinningLine(result.line);
      newScores = { ...scores, [result.winner]: scores[result.winner] + 1 };
      setScores(newScores);
      soundManager.playLocalSound('win');
      haptics.success();
      celebrateWin();
      
      // Update stats
      if (mode === 'online-playing') {
        updateStats(result.winner === mySymbol ? 'win' : 'loss');
      }
    } else if (newBoard.every(cell => cell !== null)) {
      setIsDraw(true);
      soundManager.playLocalSound('lose');
      haptics.error();
      if (mode === 'online-playing') updateStats('draw');
    } else {
      setCurrentPlayer(nextPlayer);
      setTimeLeft(TURN_TIME);
    }

    if (mode === 'online-playing' && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'game_update',
        payload: { board: newBoard, currentPlayer: nextPlayer, winner: newWinner, scores: newScores }
      });

      supabase.from('game_rooms')
        .update({ game_state: JSON.parse(JSON.stringify({ board: newBoard, currentPlayer: nextPlayer, winner: newWinner, scores: newScores, gridSize })) })
        .eq('room_code', roomCode)
        .then();
    }
  };

  const resetGame = async () => {
    const newBoard = Array(gridSize * gridSize).fill(null);
    setBoard(newBoard);
    setCurrentPlayer('X');
    setWinner(null);
    setWinningLine(null);
    setIsDraw(false);
    setTimeLeft(TURN_TIME);

    if (mode === 'online-playing' && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'game_update',
        payload: { board: newBoard, currentPlayer: 'X', winner: null, scores }
      });

      supabase.from('game_rooms')
        .update({ game_state: JSON.parse(JSON.stringify({ board: newBoard, currentPlayer: 'X', winner: null, scores, gridSize })) })
        .eq('room_code', roomCode)
        .then();
    }
  };

  const leaveGame = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Broadcast to other player that we're leaving
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'game_left',
        payload: {}
      });
    }
    
    if (roomCode) {
      await supabase.from('game_rooms').delete().eq('room_code', roomCode);
    }
    setMode('menu');
    setRoomCode('');
    setJoinCode('');
    setBoard(Array(9).fill(null));
    setGridSize(3);
    setCurrentPlayer('X');
    setWinner(null);
    setWinningLine(null);
    setScores({ X: 0, O: 0 });
    setIsDraw(false);
    setIsConnected(false);
    setTimeLeft(TURN_TIME);
    setGameStarted(false);
  };

  const startLocalGame = (size: GridSize) => {
    setGridSize(size);
    setBoard(Array(size * size).fill(null));
    setScores({ X: 0, O: 0 });
    setTimeLeft(TURN_TIME);
    setGameStarted(true); // Game starts NOW for local
    setMode('local');
  };

  const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;

  // Menu
  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <Grid3X3 className="w-16 h-16 text-neon-cyan animate-float" />
        <h2 className="font-orbitron text-2xl text-foreground">Tic Tac Toe</h2>
        
        {/* Stats Card */}
        <div className="w-full max-w-xs p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="font-rajdhani text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Your Stats
            </span>
            <span className="font-orbitron text-neon-cyan">{winRate}% Win</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="font-orbitron text-lg text-foreground">{stats.totalGames}</p>
              <p className="text-xs text-muted-foreground">Games</p>
            </div>
            <div>
              <p className="font-orbitron text-lg text-neon-green">{stats.wins}</p>
              <p className="text-xs text-muted-foreground">Wins</p>
            </div>
            <div>
              <p className="font-orbitron text-lg text-destructive">{stats.losses}</p>
              <p className="text-xs text-muted-foreground">Losses</p>
            </div>
            <div>
              <p className="font-orbitron text-lg text-neon-purple">{stats.draws}</p>
              <p className="text-xs text-muted-foreground">Draws</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Button variant="neon" size="lg" onClick={() => setMode('local')}>
            <Users className="w-5 h-5" />
            Local 2 Players
          </Button>
          
          <Button variant="neon-purple" size="lg" onClick={() => setMode('online-create')}>
            <Wifi className="w-5 h-5" />
            Create Online Room
          </Button>
          
          <Button variant="outline" size="lg" onClick={() => setMode('online-join')}>
            Join Online Room
          </Button>
        </div>
      </div>
    );
  }

  // Local - Grid Selection
  if (mode === 'local' && board.length === 9 && scores.X === 0 && scores.O === 0 && !board.some(c => c !== null)) {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <h2 className="font-orbitron text-xl text-foreground">Select Grid Size</h2>
        <div className="flex gap-4">
          {([3, 4, 5] as GridSize[]).map(size => (
            <Button
              key={size}
              variant={gridSize === size ? 'neon' : 'outline'}
              size="lg"
              onClick={() => startLocalGame(size)}
              className="w-20 h-20 text-2xl font-orbitron"
            >
              {size}×{size}
            </Button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => setMode('menu')}>Back</Button>
      </div>
    );
  }

  // Online Create - Grid Selection
  if (mode === 'online-create') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <h2 className="font-orbitron text-xl text-foreground">Select Grid Size</h2>
        <div className="flex gap-4">
          {([3, 4, 5] as GridSize[]).map(size => (
            <Button
              key={size}
              variant="outline"
              size="lg"
              onClick={() => createRoom(size)}
              disabled={isLoading}
              className="w-20 h-20 text-2xl font-orbitron hover:border-neon-cyan hover:text-neon-cyan"
            >
              {isLoading ? '...' : `${size}×${size}`}
            </Button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => setMode('menu')}>Back</Button>
      </div>
    );
  }

  // Online Join
  if (mode === 'online-join') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <h2 className="font-orbitron text-xl text-foreground">Join Online Room</h2>
        <div className="flex gap-3 w-full max-w-xs">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter room code"
            className="font-orbitron text-center uppercase"
            maxLength={6}
          />
          <Button variant="neon" onClick={joinRoom} disabled={isLoading}>
            {isLoading ? 'Joining...' : 'Join'}
          </Button>
        </div>
        <Button variant="ghost" onClick={() => setMode('menu')}>Back</Button>
      </div>
    );
  }

  // Online Waiting
  if (mode === 'online-waiting') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        {/* Animated waiting indicator */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-neon-purple/30 animate-pulse" />
          <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-neon-purple animate-spin" />
          <Users className="absolute inset-0 m-auto w-8 h-8 text-neon-purple" />
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="font-orbitron text-xl text-foreground">Waiting for Opponent...</h2>
          <p className="text-muted-foreground font-rajdhani text-sm animate-pulse">
            Share the code below to start playing
          </p>
        </div>
        
        {/* Room code card */}
        <div className="relative p-6 bg-card rounded-2xl border-2 border-neon-cyan/50 shadow-lg shadow-neon-cyan/20">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-background rounded-full border border-border">
            <span className="text-xs font-rajdhani text-muted-foreground">ROOM CODE</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-orbitron text-3xl tracking-[0.4em] text-neon-cyan">{roomCode}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={copyRoomCode}
              className="hover:bg-neon-cyan/20"
            >
              {copied ? <Check className="w-5 h-5 text-neon-green" /> : <Copy className="w-5 h-5 text-neon-cyan" />}
            </Button>
          </div>
        </div>
        
        {/* Game info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Grid3X3 className="w-4 h-4" /> {gridSize}×{gridSize} Grid
          </span>
          <span className="flex items-center gap-1">
            <Timer className="w-4 h-4" /> {TURN_TIME}s per turn
          </span>
        </div>
        
        {/* Waiting dots animation */}
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <div 
              key={i} 
              className="w-3 h-3 rounded-full bg-neon-purple"
              style={{ 
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`
              }}
            />
          ))}
        </div>
        
        <Button variant="ghost" onClick={leaveGame} className="text-muted-foreground">
          Cancel
        </Button>
      </div>
    );
  }

  // Game Board
  const isMyTurn = mode === 'local' || currentPlayer === mySymbol;
  const cellSize = gridSize === 3 ? 'w-20 h-20 sm:w-24 sm:h-24 text-4xl' : 
                   gridSize === 4 ? 'w-16 h-16 sm:w-20 sm:h-20 text-3xl' : 
                   'w-14 h-14 sm:w-16 sm:h-16 text-2xl';
  const timerColor = timeLeft <= 5 ? 'text-destructive' : timeLeft <= 10 ? 'text-neon-orange' : 'text-neon-green';

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4">
      {/* Connection Status & Timer */}
      <div className="flex items-center justify-between w-full max-w-xs sm:max-w-sm px-2">
        {mode === 'online-playing' && (
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Wifi className={`w-3 h-3 sm:w-4 sm:h-4 ${isConnected ? 'text-neon-green' : 'text-destructive'}`} />
            <span className="font-rajdhani text-muted-foreground">
              {roomCode} | You: {mySymbol}
            </span>
          </div>
        )}
        
        {/* Timer */}
        {!winner && !isDraw && (
          <div className={`flex items-center gap-1 sm:gap-2 font-orbitron ${timerColor} ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>
            <Timer className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-lg sm:text-xl font-bold">{timeLeft}s</span>
          </div>
        )}
      </div>

      {/* Scoreboard */}
      <div className="flex gap-4 sm:gap-8 items-center">
        <div className={`flex flex-col items-center p-2 sm:p-4 rounded-xl border-2 transition-all duration-300 ${
          currentPlayer === 'X' && !winner && !isDraw
            ? 'border-neon-cyan box-glow-cyan bg-neon-cyan/10'
            : 'border-border bg-card'
        }`}>
          <span className="text-neon-cyan font-orbitron text-lg sm:text-2xl font-bold">X</span>
          <span className="text-foreground font-orbitron text-xl sm:text-3xl">{scores.X}</span>
        </div>
        
        <div className="text-muted-foreground font-rajdhani text-base sm:text-xl">VS</div>
        
        <div className={`flex flex-col items-center p-2 sm:p-4 rounded-xl border-2 transition-all duration-300 ${
          currentPlayer === 'O' && !winner && !isDraw
            ? 'border-neon-pink box-glow-pink bg-neon-pink/10'
            : 'border-border bg-card'
        }`}>
          <span className="text-neon-pink font-orbitron text-lg sm:text-2xl font-bold">O</span>
          <span className="text-foreground font-orbitron text-xl sm:text-3xl">{scores.O}</span>
        </div>
      </div>

      {/* Game Status */}
      <div className="h-8 sm:h-10 flex items-center justify-center">
        {winner ? (
          <span className={`font-orbitron text-base sm:text-lg animate-scale-pop ${winner === 'X' ? 'text-neon-cyan' : 'text-neon-pink'}`}>
            {winner === mySymbol ? '🎉 You Win!' : `Player ${winner} Wins!`} Next in 2s...
          </span>
        ) : isDraw ? (
          <span className="font-orbitron text-base sm:text-lg text-neon-purple animate-scale-pop">Draw! Next in 2s...</span>
        ) : (
          <span className={`font-rajdhani text-sm sm:text-base ${!isMyTurn ? 'opacity-50' : ''} ${currentPlayer === 'X' ? 'text-neon-cyan' : 'text-neon-pink'}`}>
            {mode === 'online-playing' 
              ? (isMyTurn ? "⚡ Your Turn!" : "Waiting for opponent...")
              : `Player ${currentPlayer}'s Turn`
            }
          </span>
        )}
      </div>

      {/* Game Board */}
      <div 
        className="grid gap-2 sm:gap-3 p-3 sm:p-4 bg-card rounded-2xl border border-border"
        style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
      >
        {board.map((cell, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            disabled={(!isMyTurn && mode === 'online-playing') || !!winner || isDraw}
            className={`${cellSize} rounded-xl border-2 font-orbitron font-bold
              transition-all duration-300 flex items-center justify-center
              ${cell ? 'cursor-not-allowed' : isMyTurn && !winner && !isDraw ? 'cursor-pointer hover:bg-muted/50' : 'cursor-not-allowed opacity-50'}
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
            {cell && <span className="animate-scale-pop">{cell}</span>}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-3 sm:gap-4">
        <Button variant="neon" size="sm" onClick={resetGame}>
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
        <Button variant="ghost" size="sm" onClick={leaveGame}>
          Leave
        </Button>
      </div>
    </div>
  );
};

export default TicTacToeOnline;
