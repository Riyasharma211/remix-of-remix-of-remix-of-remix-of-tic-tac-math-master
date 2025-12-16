import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Grid3X3, Users, Copy, Check, RotateCcw, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateWin } from '@/utils/confetti';
import { useToast } from '@/hooks/use-toast';

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

const getWinningCombinations = (size: GridSize): number[][] => {
  const combinations: number[][] = [];
  
  // Rows
  for (let i = 0; i < size; i++) {
    const row = [];
    for (let j = 0; j < size; j++) {
      row.push(i * size + j);
    }
    combinations.push(row);
  }
  
  // Columns
  for (let i = 0; i < size; i++) {
    const col = [];
    for (let j = 0; j < size; j++) {
      col.push(j * size + i);
    }
    combinations.push(col);
  }
  
  // Diagonals
  const diag1 = [];
  const diag2 = [];
  for (let i = 0; i < size; i++) {
    diag1.push(i * size + i);
    diag2.push(i * size + (size - 1 - i));
  }
  combinations.push(diag1, diag2);
  
  return combinations;
};

const TicTacToeOnline: React.FC = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<GameMode>('menu');
  const [gridSize, setGridSize] = useState<GridSize>(3);
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [winner, setWinner] = useState<Player>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const [isDraw, setIsDraw] = useState(false);

  // Online state
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mySymbol, setMySymbol] = useState<'X' | 'O'>('X');
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

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

  // Auto-restart after win/draw
  useEffect(() => {
    if (winner || isDraw) {
      const timer = setTimeout(() => {
        const newBoard = Array(gridSize * gridSize).fill(null);
        setBoard(newBoard);
        setCurrentPlayer('X');
        setWinner(null);
        setWinningLine(null);
        setIsDraw(false);

        if (mode === 'online-playing') {
          const channel = supabase.channel(`ttt-${roomCode}`);
          channel.send({
            type: 'broadcast',
            event: 'game_update',
            payload: { board: newBoard, currentPlayer: 'X', winner: null, scores, autoRestart: true }
          });

          supabase.from('game_rooms')
            .update({ game_state: JSON.parse(JSON.stringify({ board: newBoard, currentPlayer: 'X', winner: null, scores, gridSize })) })
            .eq('room_code', roomCode)
            .then();
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [winner, isDraw, gridSize, mode, roomCode, scores]);

  const createRoom = async (selectedSize: GridSize) => {
    const code = generateRoomCode();
    setRoomCode(code);
    setMySymbol('X');
    setGridSize(selectedSize);
    setBoard(Array(selectedSize * selectedSize).fill(null));
    
    try {
      const { error } = await supabase.from('game_rooms').insert({
        room_code: code,
        game_type: 'tictactoe',
        game_state: { board: Array(selectedSize * selectedSize).fill(null), currentPlayer: 'X', scores: { X: 0, O: 0 }, gridSize: selectedSize },
        status: 'waiting'
      });

      if (error) throw error;
      setMode('online-waiting');
      toast({ title: 'Room Created!', description: 'Share the code with a friend' });
    } catch (error) {
      console.error('Error creating room:', error);
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
      const gameState = data.game_state as any;
      const size = gameState.gridSize || 3;
      
      setRoomCode(code);
      setMySymbol('O');
      setGridSize(size);
      setBoard(gameState.board || Array(size * size).fill(null));
      setScores(gameState.scores || { X: 0, O: 0 });
      setMode('online-playing');
      setIsConnected(true);
      
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

      // Update DB in background (non-blocking)
      supabase.from('game_rooms')
        .update({ player_count: 2, status: 'playing' })
        .eq('room_code', code)
        .then();

      haptics.success();
      toast({ title: 'Joined!', description: 'Game starting!' });
    } catch (error) {
      console.error('Error joining room:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to join room' });
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Subscribe to room changes - using broadcast for instant updates
  useEffect(() => {
    if (!roomCode || (mode !== 'online-waiting' && mode !== 'online-playing')) return;

    const channel = supabase
      .channel(`ttt-${roomCode}`, {
        config: { broadcast: { self: true } }
      })
      .on('broadcast', { event: 'game_update' }, ({ payload }) => {
        if (payload) {
          // Someone joined - instant!
          if (payload.player_joined && mode === 'online-waiting') {
            setMode('online-playing');
            setIsConnected(true);
            haptics.success();
            toast({ title: 'Player Joined!', description: 'Game starting!' });
          }
          
          // Update game state instantly
          if (payload.board) setBoard(payload.board);
          if (payload.currentPlayer) setCurrentPlayer(payload.currentPlayer);
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
          }
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // Instant player detection
        if (mode === 'online-waiting' && newPresences.length > 0) {
          setMode('online-playing');
          setIsConnected(true);
          haptics.success();
          toast({ title: 'Player Joined!', description: 'Game starting!' });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ player: mySymbol, joined_at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, mode, mySymbol, gridSize, checkWinner]);

  const handleClick = async (index: number) => {
    if (board[index] || winner || isDraw) return;
    
    // In online mode, only allow moves on your turn
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
      newScores = {
        ...scores,
        [result.winner]: scores[result.winner] + 1
      };
      setScores(newScores);
      soundManager.playLocalSound('win');
      haptics.success();
      celebrateWin();
    } else if (newBoard.every(cell => cell !== null)) {
      setIsDraw(true);
      soundManager.playLocalSound('lose');
      haptics.error();
    } else {
      setCurrentPlayer(nextPlayer);
    }

    // Sync instantly via broadcast for online mode
    if (mode === 'online-playing') {
      const channel = supabase.channel(`ttt-${roomCode}`);
      channel.send({
        type: 'broadcast',
        event: 'game_update',
        payload: {
          board: newBoard,
          currentPlayer: nextPlayer,
          winner: newWinner,
          scores: newScores
        }
      });

      // DB update in background
      supabase.from('game_rooms')
        .update({
          game_state: JSON.parse(JSON.stringify({ board: newBoard, currentPlayer: nextPlayer, winner: newWinner, scores: newScores, gridSize }))
        })
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

    if (mode === 'online-playing') {
      // Instant broadcast
      const channel = supabase.channel(`ttt-${roomCode}`);
      channel.send({
        type: 'broadcast',
        event: 'game_update',
        payload: { board: newBoard, currentPlayer: 'X', winner: null, scores }
      });

      // DB in background
      supabase.from('game_rooms')
        .update({ game_state: JSON.parse(JSON.stringify({ board: newBoard, currentPlayer: 'X', winner: null, scores, gridSize })) })
        .eq('room_code', roomCode)
        .then();
    }
  };

  const leaveGame = async () => {
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
  };

  const startLocalGame = (size: GridSize) => {
    setGridSize(size);
    setBoard(Array(size * size).fill(null));
    setScores({ X: 0, O: 0 });
    setMode('local');
  };

  // Menu
  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <Grid3X3 className="w-16 h-16 text-neon-cyan animate-float" />
        <h2 className="font-orbitron text-2xl text-foreground">Tic Tac Toe</h2>
        
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
              className="w-20 h-20 text-2xl font-orbitron hover:border-neon-cyan hover:text-neon-cyan"
            >
              {size}×{size}
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
          <Button variant="neon" onClick={joinRoom}>Join</Button>
        </div>
        <Button variant="ghost" onClick={() => setMode('menu')}>Back</Button>
      </div>
    );
  }

  // Online Waiting
  if (mode === 'online-waiting') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <WifiOff className="w-12 h-12 text-neon-purple animate-pulse" />
        <h2 className="font-orbitron text-xl text-foreground">Waiting for Player...</h2>
        
        <div className="flex items-center gap-2 p-4 bg-card rounded-xl border border-border">
          <span className="font-orbitron text-2xl tracking-widest text-neon-cyan">{roomCode}</span>
          <Button variant="ghost" size="icon" onClick={copyRoomCode}>
            {copied ? <Check className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        
        <p className="text-muted-foreground font-rajdhani text-center">
          Grid: {gridSize}×{gridSize} • Share code to start
        </p>
        
        <Button variant="ghost" onClick={leaveGame}>Cancel</Button>
      </div>
    );
  }

  // Game Board (Local or Online)
  const isMyTurn = mode === 'local' || currentPlayer === mySymbol;
  const cellSize = gridSize === 3 ? 'w-20 h-20 sm:w-24 sm:h-24 text-4xl' : 
                   gridSize === 4 ? 'w-16 h-16 sm:w-20 sm:h-20 text-3xl' : 
                   'w-14 h-14 sm:w-16 sm:h-16 text-2xl';

  return (
    <div className="flex flex-col items-center gap-4 sm:gap-6">
      {/* Connection Status */}
      {mode === 'online-playing' && (
        <div className="flex items-center gap-2 text-sm">
          <Wifi className={`w-4 h-4 ${isConnected ? 'text-neon-green' : 'text-destructive'}`} />
          <span className="font-rajdhani text-muted-foreground">
            Room: {roomCode} | You: {mySymbol} | {gridSize}×{gridSize}
          </span>
        </div>
      )}

      {/* Scoreboard */}
      <div className="flex gap-6 sm:gap-8 items-center">
        <div className={`flex flex-col items-center p-3 sm:p-4 rounded-xl border-2 transition-all duration-300 ${
          currentPlayer === 'X' && !winner && !isDraw
            ? 'border-neon-cyan box-glow-cyan bg-neon-cyan/10'
            : 'border-border bg-card'
        }`}>
          <span className="text-neon-cyan font-orbitron text-xl sm:text-2xl font-bold">X</span>
          <span className="text-foreground font-orbitron text-2xl sm:text-3xl">{scores.X}</span>
        </div>
        
        <div className="text-muted-foreground font-rajdhani text-lg sm:text-xl">VS</div>
        
        <div className={`flex flex-col items-center p-3 sm:p-4 rounded-xl border-2 transition-all duration-300 ${
          currentPlayer === 'O' && !winner && !isDraw
            ? 'border-neon-pink box-glow-pink bg-neon-pink/10'
            : 'border-border bg-card'
        }`}>
          <span className="text-neon-pink font-orbitron text-xl sm:text-2xl font-bold">O</span>
          <span className="text-foreground font-orbitron text-2xl sm:text-3xl">{scores.O}</span>
        </div>
      </div>

      {/* Game Status */}
      <div className="h-10 sm:h-12 flex items-center justify-center">
        {winner ? (
          <span className={`font-orbitron text-lg sm:text-xl animate-scale-pop ${winner === 'X' ? 'text-neon-cyan' : 'text-neon-pink'}`}>
            Player {winner} Wins! Next in 2s...
          </span>
        ) : isDraw ? (
          <span className="font-orbitron text-lg sm:text-xl text-neon-purple animate-scale-pop">Draw! Next in 2s...</span>
        ) : (
          <span className={`font-rajdhani text-base sm:text-lg ${!isMyTurn ? 'opacity-50' : ''} ${currentPlayer === 'X' ? 'text-neon-cyan' : 'text-neon-pink'}`}>
            {mode === 'online-playing' 
              ? (isMyTurn ? "Your Turn!" : "Waiting for opponent...")
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
      <div className="flex gap-4">
        <Button variant="neon" onClick={resetGame}>
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
        <Button variant="ghost" onClick={leaveGame}>
          Leave
        </Button>
      </div>
    </div>
  );
};

export default TicTacToeOnline;
