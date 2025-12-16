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

interface GameState {
  board: Board;
  currentPlayer: 'X' | 'O';
  winner: Player;
  scores: { X: number; O: number };
}

const winningCombinations = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const TicTacToeOnline: React.FC = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<GameMode>('menu');
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

  const checkWinner = (board: Board): { winner: Player; line: number[] | null } => {
    for (const combination of winningCombinations) {
      const [a, b, c] = combination;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line: combination };
      }
    }
    return { winner: null, line: null };
  };

  const createRoom = async () => {
    const code = generateRoomCode();
    setRoomCode(code);
    setMySymbol('X');
    
    try {
      const { error } = await supabase.from('game_rooms').insert({
        room_code: code,
        game_type: 'tictactoe',
        game_state: { board: Array(9).fill(null), currentPlayer: 'X', scores: { X: 0, O: 0 } },
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

      // Update room to mark as full
      await supabase
        .from('game_rooms')
        .update({ player_count: 2, status: 'playing' })
        .eq('room_code', joinCode.toUpperCase());

      setRoomCode(joinCode.toUpperCase());
      setMySymbol('O');
      setMode('online-playing');
      setIsConnected(true);
      toast({ title: 'Joined!', description: 'Game is starting...' });
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

  // Subscribe to room changes
  useEffect(() => {
    if (!roomCode || (mode !== 'online-waiting' && mode !== 'online-playing')) return;

    const channel = supabase
      .channel(`room-${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms',
          filter: `room_code=eq.${roomCode}`
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData) {
            // Someone joined
            if (newData.player_count === 2 && mode === 'online-waiting') {
              setMode('online-playing');
              setIsConnected(true);
              toast({ title: 'Player Joined!', description: 'Game is starting!' });
            }
            
            // Update game state
            if (newData.game_state) {
              const gs = newData.game_state as GameState;
              setBoard(gs.board || Array(9).fill(null));
              if (gs.currentPlayer === 'X' || gs.currentPlayer === 'O') {
                setCurrentPlayer(gs.currentPlayer);
              }
              if (gs.winner) {
                setWinner(gs.winner);
                const result = checkWinner(gs.board);
                setWinningLine(result.line);
              }
              if (gs.scores) {
                setScores(gs.scores);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, mode]);

  const handleClick = async (index: number) => {
    if (board[index] || winner || isDraw) return;
    
    // In online mode, only allow moves on your turn
    if (mode === 'online-playing' && currentPlayer !== mySymbol) return;

    haptics.medium();
    
    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);
    soundManager.playLocalSound('click');

    const result = checkWinner(newBoard);
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

    // Sync to database for online mode
    if (mode === 'online-playing') {
      await supabase
        .from('game_rooms')
        .update({
          game_state: {
            board: newBoard,
            currentPlayer: nextPlayer,
            winner: newWinner,
            scores: newScores
          }
        })
        .eq('room_code', roomCode);
    }
  };

  const resetGame = async () => {
    const newBoard = Array(9).fill(null);
    setBoard(newBoard);
    setCurrentPlayer('X');
    setWinner(null);
    setWinningLine(null);
    setIsDraw(false);

    if (mode === 'online-playing') {
      await supabase
        .from('game_rooms')
        .update({
          game_state: {
            board: newBoard,
            currentPlayer: 'X',
            winner: null,
            scores
          }
        })
        .eq('room_code', roomCode);
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
    setCurrentPlayer('X');
    setWinner(null);
    setWinningLine(null);
    setScores({ X: 0, O: 0 });
    setIsDraw(false);
    setIsConnected(false);
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

  // Online Create
  if (mode === 'online-create') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <h2 className="font-orbitron text-xl text-foreground">Create Online Room</h2>
        <p className="text-muted-foreground font-rajdhani text-center">
          Create a room and share the code with a friend
        </p>
        <Button variant="game" size="lg" onClick={createRoom}>
          Create Room
        </Button>
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
          Share this code with a friend to start playing
        </p>
        
        <Button variant="ghost" onClick={leaveGame}>Cancel</Button>
      </div>
    );
  }

  // Game Board (Local or Online)
  const isMyTurn = mode === 'local' || currentPlayer === mySymbol;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Connection Status */}
      {mode === 'online-playing' && (
        <div className="flex items-center gap-2 text-sm">
          <Wifi className={`w-4 h-4 ${isConnected ? 'text-neon-green' : 'text-destructive'}`} />
          <span className="font-rajdhani text-muted-foreground">
            Room: {roomCode} | You: {mySymbol}
          </span>
        </div>
      )}

      {/* Scoreboard */}
      <div className="flex gap-8 items-center">
        <div className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-300 ${
          currentPlayer === 'X' && !winner && !isDraw
            ? 'border-neon-cyan box-glow-cyan bg-neon-cyan/10'
            : 'border-border bg-card'
        }`}>
          <span className="text-neon-cyan font-orbitron text-2xl font-bold">X</span>
          <span className="text-foreground font-orbitron text-3xl">{scores.X}</span>
        </div>
        
        <div className="text-muted-foreground font-rajdhani text-xl">VS</div>
        
        <div className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-300 ${
          currentPlayer === 'O' && !winner && !isDraw
            ? 'border-neon-pink box-glow-pink bg-neon-pink/10'
            : 'border-border bg-card'
        }`}>
          <span className="text-neon-pink font-orbitron text-2xl font-bold">O</span>
          <span className="text-foreground font-orbitron text-3xl">{scores.O}</span>
        </div>
      </div>

      {/* Game Status */}
      <div className="h-12 flex items-center justify-center">
        {winner ? (
          <span className={`font-orbitron text-xl animate-scale-pop ${winner === 'X' ? 'text-neon-cyan' : 'text-neon-pink'}`}>
            Player {winner} Wins!
          </span>
        ) : isDraw ? (
          <span className="font-orbitron text-xl text-neon-purple animate-scale-pop">It's a Draw!</span>
        ) : (
          <span className={`font-rajdhani text-lg ${!isMyTurn ? 'opacity-50' : ''} ${currentPlayer === 'X' ? 'text-neon-cyan' : 'text-neon-pink'}`}>
            {mode === 'online-playing' 
              ? (isMyTurn ? "Your Turn!" : "Waiting for opponent...")
              : `Player ${currentPlayer}'s Turn`
            }
          </span>
        )}
      </div>

      {/* Game Board */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-card rounded-2xl border border-border">
        {board.map((cell, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            disabled={!isMyTurn && mode === 'online-playing'}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 font-orbitron text-4xl font-bold
              transition-all duration-300 flex items-center justify-center
              ${cell ? 'cursor-not-allowed' : isMyTurn ? 'cursor-pointer hover:bg-muted/50' : 'cursor-not-allowed opacity-50'}
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
          New Game
        </Button>
        <Button variant="ghost" onClick={leaveGame}>
          Leave
        </Button>
      </div>
    </div>
  );
};

export default TicTacToeOnline;
