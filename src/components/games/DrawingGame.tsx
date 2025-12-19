import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Pencil, Eraser, Trash2, Copy, Users, ArrowLeft, Check, Trophy, Undo2, Minus, Plus } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateFireworks } from '@/utils/confetti';
import { RealtimeChannel } from '@supabase/supabase-js';
import { usePendingJoin } from '@/hooks/usePendingJoin';

type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'playing' | 'ended';

interface DrawingPoint {
  x: number;
  y: number;
  color: string;
  size: number;
  isNew: boolean;
}

interface GameState {
  lines: DrawingPoint[][];
  currentDrawer: string;
  word: string;
  scores: Record<string, number>;
  guesses: { player: string; playerName: string; text: string; correct: boolean }[];
  round: number;
  maxRounds: number;
  players: { id: string; name: string }[];
  winner: string | null;
}

const WORDS = [
  'cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'star', 'fish', 'bird',
  'apple', 'banana', 'pizza', 'cake', 'flower', 'rainbow', 'heart', 'cloud',
  'book', 'phone', 'guitar', 'ball', 'hat', 'shoe', 'glasses', 'chair',
  'mountain', 'ocean', 'butterfly', 'rocket', 'robot', 'dragon', 'unicorn'
];

const COLORS = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FF6B00'];

const DrawingGame: React.FC = () => {
  const pendingJoin = usePendingJoin();
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId] = useState(() => Math.random().toString(36).substring(2, 10));
  const [playerName, setPlayerName] = useState('');
  const [copied, setCopied] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    lines: [],
    currentDrawer: '',
    word: '',
    scores: {},
    guesses: [],
    round: 1,
    maxRounds: 5,
    players: [],
    winner: null
  });
  const [guess, setGuess] = useState('');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 300 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentLineRef = useRef<DrawingPoint[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const isDrawer = gameState.currentDrawer === playerId;

  const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  const getRandomWord = () => WORDS[Math.floor(Math.random() * WORDS.length)];

  // Auto-join if pending join code exists
  useEffect(() => {
    if (pendingJoin && pendingJoin.gameType === 'drawing' && mode === 'menu') {
      setInputCode(pendingJoin.code);
      // Trigger join after a short delay
      const timer = setTimeout(() => {
        joinRoom();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pendingJoin, mode]);

  // Initialize canvas and make it responsive
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set responsive canvas size
    const updateCanvasSize = () => {
      const container = canvas.parentElement;
      if (container) {
        const maxWidth = Math.min(container.clientWidth - 32, 600);
        const aspectRatio = 4 / 3;
        const width = maxWidth;
        const height = width / aspectRatio;
        
        canvas.width = width;
        canvas.height = height;
        setCanvasSize({ width, height });
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Redraw existing lines
        if (gameState.lines.length > 0) {
          setTimeout(() => redrawCanvas(gameState.lines), 0);
        }
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [mode, gameState.lines]);

  const createRoom = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    const code = generateRoomCode();
    const word = getRandomWord();
    const initialState: GameState = {
      lines: [],
      currentDrawer: playerId,
      word: word,
      scores: { [playerId]: 0 },
      guesses: [],
      round: 1,
      maxRounds: 5,
      players: [{ id: playerId, name: playerName }],
      winner: null
    };

    const { data, error } = await supabase
      .from('game_rooms')
      .insert({
        room_code: code,
        game_type: 'drawing',
        game_state: JSON.parse(JSON.stringify(initialState)),
        player_count: 1,
        status: 'waiting'
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create room');
      return;
    }

    setRoomCode(code);
    setRoomId(data.id);
    setGameState(initialState);
    setMode('waiting');
    haptics.success();
    toast.success(`Room created! Code: ${code}`);
  };

  const joinRoom = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('room_code', inputCode.toUpperCase())
      .eq('game_type', 'drawing')
      .single();

    if (error || !data) {
      toast.error('Room not found');
      return;
    }

    const currentState = JSON.parse(JSON.stringify(data.game_state)) as GameState;
    currentState.players.push({ id: playerId, name: playerName });
    currentState.scores[playerId] = 0;

    await supabase
      .from('game_rooms')
      .update({
        game_state: JSON.parse(JSON.stringify(currentState)),
        player_count: data.player_count + 1,
        status: 'playing'
      })
      .eq('id', data.id);

    setRoomCode(inputCode.toUpperCase());
    setRoomId(data.id);
    setGameState(currentState);
    setMode('playing');
    
    // Broadcast join
    const channel = supabase.channel(`drawing-${data.id}`);
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'game_update',
      payload: { type: 'player_joined', gameState: currentState }
    });
    
    haptics.success();
    soundManager.playLocalSound('correct');
    toast.success('Joined room!');
  };

  // Subscribe to realtime updates using broadcast
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`drawing-${roomId}`, {
        config: { broadcast: { self: true } }
      })
      .on('broadcast', { event: 'game_left' }, () => {
        // Other player left - reset game
        toast.info('A player left the game');
        setMode('menu');
        setRoomId(null);
        setRoomCode('');
        setGameState({
          lines: [],
          currentDrawer: '',
          word: '',
          scores: {},
          guesses: [],
          round: 1,
          maxRounds: 5,
          players: [],
          winner: null
        });
      })
      .on('broadcast', { event: 'game_update' }, ({ payload }) => {
        if (!payload) return;

        if (payload.type === 'player_joined' && mode === 'waiting') {
          setGameState(payload.gameState);
          setMode('playing');
          haptics.success();
          soundManager.playLocalSound('correct');
          toast.success('Player joined! Game started!');
        }

        if (payload.type === 'draw_update') {
          setGameState(prev => ({ ...prev, lines: payload.lines }));
          redrawCanvas(payload.lines);
        }

        if (payload.type === 'clear_canvas') {
          setGameState(prev => ({ ...prev, lines: [] }));
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (ctx && canvas) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }

        if (payload.type === 'guess_submitted') {
          setGameState(payload.gameState);
          if (payload.correct) {
            soundManager.playLocalSound('correct');
            haptics.success();
          }
        }

        if (payload.type === 'new_round') {
          setGameState(payload.gameState);
          // Clear canvas for new round
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (ctx && canvas) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          toast.info(`Round ${payload.gameState.round}!`);
        }

        if (payload.type === 'game_ended') {
          setGameState(payload.gameState);
          setMode('ended');
          const isWinner = payload.gameState.winner === playerName;
          soundManager.playLocalSound(isWinner ? 'win' : 'lose');
          if (isWinner) {
            haptics.success();
            celebrateFireworks();
          }
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mode, playerName]);

  const redrawCanvas = useCallback((lines: DrawingPoint[][]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    lines.forEach(line => {
      if (line.length === 0) return;
      
      ctx.beginPath();
      ctx.strokeStyle = line[0].color;
      ctx.lineWidth = line[0].size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      line.forEach((point, index) => {
        if (index === 0 || point.isNew) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
    });
  }, []);

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer) return;
    e.preventDefault();
    
    const { x, y } = getCanvasCoords(e);
    setIsDrawing(true);
    currentLineRef.current = [{
      x, y,
      color: isEraser ? '#FFFFFF' : currentColor,
      size: isEraser ? 20 : brushSize,
      isNew: true
    }];
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawer) return;
    e.preventDefault();

    const { x, y } = getCanvasCoords(e);
    const point: DrawingPoint = {
      x, y,
      color: isEraser ? '#FFFFFF' : currentColor,
      size: isEraser ? 20 : brushSize,
      isNew: false
    };

    currentLineRef.current.push(point);

    // Draw locally
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && currentLineRef.current.length > 1) {
      const prev = currentLineRef.current[currentLineRef.current.length - 2];
      ctx.beginPath();
      ctx.strokeStyle = point.color;
      ctx.lineWidth = point.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  };

  const stopDrawing = async () => {
    if (!isDrawing || !isDrawer || !roomId) return;
    setIsDrawing(false);

    if (currentLineRef.current.length > 0) {
      const newLines = [...gameState.lines, currentLineRef.current];
      const newState = { ...gameState, lines: newLines };

      // Broadcast drawing update
      channelRef.current?.send({
        type: 'broadcast',
        event: 'game_update',
        payload: { type: 'draw_update', lines: newLines }
      });

      // Update DB in background
      supabase
        .from('game_rooms')
        .update({ game_state: JSON.parse(JSON.stringify(newState)) })
        .eq('id', roomId)
        .then();

      setGameState(newState);
    }
    currentLineRef.current = [];
  };

  const undoLastLine = async () => {
    if (!isDrawer || !roomId || gameState.lines.length === 0) return;
    
    const newLines = gameState.lines.slice(0, -1);
    const newState = { ...gameState, lines: newLines };
    
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_update',
      payload: { type: 'draw_update', lines: newLines }
    });
    
    supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId)
      .then();

    setGameState(newState);
    redrawCanvas(newLines);
    haptics.light();
    soundManager.playLocalSound('click');
  };

  const clearCanvas = async () => {
    if (!isDrawer || !roomId) return;
    
    const newState = { ...gameState, lines: [] };
    
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_update',
      payload: { type: 'clear_canvas' }
    });
    
    supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId)
      .then();

    setGameState(newState);
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    haptics.medium();
    soundManager.playLocalSound('click');
  };

  const submitGuess = async () => {
    if (!guess.trim() || isDrawer || !roomId) return;

    const isCorrect = guess.toLowerCase().trim() === gameState.word.toLowerCase();
    const newGuess = { player: playerId, playerName, text: guess, correct: isCorrect };
    
    let newState = { ...gameState };
    newState.guesses = [...newState.guesses, newGuess];
    
    if (isCorrect) {
      newState.scores[playerId] = (newState.scores[playerId] || 0) + 10;
      // Also give drawer points
      newState.scores[newState.currentDrawer] = (newState.scores[newState.currentDrawer] || 0) + 5;
      
      toast.success('Correct! +10 points');
      
      // Check if game should end
      if (newState.round >= newState.maxRounds) {
        // Find winner
        const sortedScores = Object.entries(newState.scores).sort((a, b) => b[1] - a[1]);
        const winnerId = sortedScores[0][0];
        const winnerPlayer = newState.players.find(p => p.id === winnerId);
        newState.winner = winnerPlayer?.name || 'Unknown';
        
        channelRef.current?.send({
          type: 'broadcast',
          event: 'game_update',
          payload: { type: 'game_ended', gameState: newState }
        });
      } else {
        // Start new round
        const nextDrawerIndex = (newState.players.findIndex(p => p.id === newState.currentDrawer) + 1) % newState.players.length;
        newState.currentDrawer = newState.players[nextDrawerIndex].id;
        newState.word = getRandomWord();
        newState.lines = [];
        newState.guesses = [];
        newState.round += 1;
        
        channelRef.current?.send({
          type: 'broadcast',
          event: 'game_update',
          payload: { type: 'new_round', gameState: newState }
        });
      }
    } else {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'game_update',
        payload: { type: 'guess_submitted', gameState: newState, correct: false }
      });
    }

    supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId)
      .then();

    setGameState(newState);
    setGuess('');
  };

  const leaveGame = async () => {
    // Broadcast to other players that we're leaving
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'game_left',
        payload: {}
      });
    }
    
    if (roomId) {
      await supabase.from('game_rooms').delete().eq('id', roomId);
    }
    setMode('menu');
    setRoomId(null);
    setRoomCode('');
    setGameState({
      lines: [],
      currentDrawer: '',
      word: '',
      scores: {},
      guesses: [],
      round: 1,
      maxRounds: 5,
      players: [],
      winner: null
    });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    haptics.light();
    setTimeout(() => setCopied(false), 2000);
  };

  const getPlayerName = (id: string) => {
    const player = gameState.players.find(p => p.id === id);
    return player?.name || 'Unknown';
  };

  // Menu
  if (mode === 'menu') {
    return (
      <div className="text-center space-y-6 animate-slide-in max-w-md mx-auto">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="relative">
            <Pencil className="w-10 h-10 text-neon-pink animate-float" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-neon-pink rounded-full animate-pulse" />
          </div>
          <h2 className="font-orbitron text-3xl text-foreground">Drawing Game</h2>
        </div>

        <p className="text-muted-foreground font-rajdhani text-lg">
          Draw and guess with friends! 🎨
        </p>

        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider block mb-2">
              Your Name
            </label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name..."
              className="text-center font-rajdhani text-lg"
              maxLength={15}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && playerName.trim()) {
                  setMode('create');
                  haptics.light();
                }
              }}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              onClick={() => { setMode('create'); haptics.light(); soundManager.playLocalSound('click'); }}
              disabled={!playerName.trim()}
              className="bg-neon-pink/20 border border-neon-pink text-neon-pink hover:bg-neon-pink/30 disabled:opacity-50"
              size="lg"
            >
              <Pencil className="w-5 h-5 mr-2" />
              Create Room
            </Button>
            <Button
              onClick={() => { setMode('join'); haptics.light(); soundManager.playLocalSound('click'); }}
              disabled={!playerName.trim()}
              variant="outline"
              className="border-border hover:bg-accent disabled:opacity-50"
              size="lg"
            >
              <Users className="w-5 h-5 mr-2" />
              Join Room
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Create room
  if (mode === 'create') {
    return (
      <div className="text-center space-y-6 animate-slide-in">
        <Button variant="ghost" onClick={() => setMode('menu')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h3 className="font-orbitron text-xl text-foreground">Create Drawing Room</h3>
        <p className="text-muted-foreground text-sm">Playing as: {playerName || 'Anonymous'}</p>
        <Button
          onClick={createRoom}
          className="bg-neon-pink/20 border border-neon-pink text-neon-pink hover:bg-neon-pink/30"
        >
          Create Game
        </Button>
      </div>
    );
  }

  // Join room
  if (mode === 'join') {
    return (
      <div className="text-center space-y-6 animate-slide-in">
        <Button variant="ghost" onClick={() => setMode('menu')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h3 className="font-orbitron text-xl text-foreground">Join Drawing Room</h3>
        <p className="text-muted-foreground text-sm">Playing as: {playerName || 'Anonymous'}</p>
        <Input
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          placeholder="Enter room code..."
          maxLength={4}
          className="max-w-xs mx-auto text-center text-2xl tracking-widest font-orbitron"
        />
        <Button
          onClick={joinRoom}
          disabled={inputCode.length !== 4}
          className="bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30"
        >
          Join Game
        </Button>
      </div>
    );
  }

  // Waiting
  if (mode === 'waiting') {
    return (
      <div className="text-center space-y-6 animate-slide-in max-w-md mx-auto">
        <div className="relative">
          <Pencil className="w-16 h-16 text-neon-pink animate-pulse mx-auto" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-neon-pink/30 rounded-full animate-ping" />
          </div>
        </div>
        <h3 className="font-orbitron text-2xl text-foreground">Waiting for players...</h3>
        <p className="text-muted-foreground font-rajdhani">You: <span className="text-neon-cyan font-semibold">{playerName}</span></p>
        
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-6 space-y-4">
          <div>
            <p className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider mb-2">Room Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-orbitron tracking-widest text-neon-pink font-bold">{roomCode}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={copyRoomCode}
                className="hover:bg-neon-green/20 hover:text-neon-green"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-neon-green" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-rajdhani">
            {copied ? '✓ Copied to clipboard!' : 'Share this code with friends'}
          </p>
        </div>
        
        <Button 
          variant="outline" 
          onClick={leaveGame}
          className="hover:bg-destructive/20 hover:border-destructive hover:text-destructive"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Leave Room
        </Button>
      </div>
    );
  }

  // Game ended
  if (mode === 'ended') {
    const sortedScores = Object.entries(gameState.scores)
      .map(([id, score]) => ({ id, name: getPlayerName(id), score }))
      .sort((a, b) => b.score - a.score);

    return (
      <div className="text-center space-y-6 animate-slide-in">
        <Trophy className="w-16 h-16 text-neon-orange mx-auto" />
        <h2 className="font-orbitron text-2xl text-foreground">
          {gameState.winner} Wins!
        </h2>
        
        <div className="space-y-2">
          {sortedScores.map((player, index) => (
            <div 
              key={player.id}
              className={`p-3 rounded-lg ${index === 0 ? 'bg-neon-orange/20 border border-neon-orange' : 'bg-card border border-border'}`}
            >
              <span className="font-rajdhani">
                {index + 1}. {player.name}: <span className="font-orbitron text-neon-cyan">{player.score}</span>
              </span>
            </div>
          ))}
        </div>
        
        <Button variant="game" size="lg" onClick={leaveGame}>
          Play Again
        </Button>
      </div>
    );
  }

  // Playing
  return (
    <div className="space-y-4 animate-slide-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-card/50 backdrop-blur-sm border border-border rounded-xl p-3">
        <Button variant="ghost" size="sm" onClick={leaveGame} className="hover:bg-destructive/20 hover:text-destructive">
          <ArrowLeft className="w-4 h-4 mr-2" /> Leave
        </Button>
        <div className="text-center flex-1 min-w-0">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="font-orbitron text-xs text-muted-foreground">Round {gameState.round}/{gameState.maxRounds}</span>
            <span className="text-muted-foreground">•</span>
            <span className="font-orbitron text-xs text-neon-cyan">{roomCode}</span>
          </div>
          {isDrawer && (
            <p className="text-neon-pink font-bold font-orbitron text-sm sm:text-base animate-pulse">
              Draw: <span className="text-foreground">{gameState.word}</span>
            </p>
          )}
          {!isDrawer && (
            <p className="text-muted-foreground font-rajdhani text-sm">
              <span className="text-neon-pink font-semibold">{getPlayerName(gameState.currentDrawer)}</span> is drawing...
            </p>
          )}
        </div>
        <div className="w-20" /> {/* Spacer for alignment */}
      </div>

      {/* Canvas */}
      <div className="relative w-full flex justify-center">
        <div className="relative bg-white rounded-xl border-2 border-border shadow-lg overflow-hidden" style={{ maxWidth: '600px', width: '100%' }}>
          <canvas
            ref={canvasRef}
            className="w-full h-auto bg-white touch-none cursor-crosshair"
            style={{ display: 'block', aspectRatio: '4/3' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {!isDrawer && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl">
              <div className="text-center p-4">
                <Pencil className="w-8 h-8 text-neon-pink mx-auto mb-2 animate-pulse" />
                <p className="font-orbitron text-sm text-muted-foreground">You can't draw right now</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawing Tools */}
      {isDrawer && (
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4 space-y-4">
          {/* Color Picker */}
          <div className="space-y-2">
            <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">Colors</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => { setCurrentColor(color); setIsEraser(false); haptics.light(); soundManager.playLocalSound('click'); }}
                  className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 active:scale-95 ${
                    currentColor === color && !isEraser 
                      ? 'border-neon-cyan scale-110 shadow-lg shadow-neon-cyan/50' 
                      : 'border-border hover:border-neon-cyan/50'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Brush Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider">Brush Size</label>
              <span className="text-xs font-orbitron text-neon-cyan">{brushSize}px</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => { setBrushSize(Math.max(2, brushSize - 2)); haptics.light(); }}
                disabled={brushSize <= 2}
              >
                <Minus className="w-3 h-3" />
              </Button>
              <Slider
                value={[brushSize]}
                onValueChange={([value]) => { setBrushSize(value); haptics.light(); }}
                min={2}
                max={20}
                step={1}
                className="flex-1"
              />
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => { setBrushSize(Math.min(20, brushSize + 2)); haptics.light(); }}
                disabled={brushSize >= 20}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Tools */}
          <div className="flex items-center justify-center gap-2 pt-2 border-t border-border">
            <Button
              size="sm"
              variant={isEraser ? 'default' : 'outline'}
              onClick={() => { setIsEraser(!isEraser); haptics.light(); soundManager.playLocalSound('click'); }}
              className={isEraser ? 'bg-neon-purple/20 border-neon-purple text-neon-purple' : ''}
            >
              <Eraser className="w-4 h-4 mr-2" />
              Eraser
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={undoLastLine}
              disabled={gameState.lines.length === 0}
              className="hover:bg-neon-blue/20 hover:border-neon-blue hover:text-neon-blue"
            >
              <Undo2 className="w-4 h-4 mr-2" />
              Undo
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={clearCanvas}
              className="hover:bg-destructive/20 hover:border-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Guess input */}
      {!isDrawer && (
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4">
          <div className="flex gap-2 max-w-md mx-auto">
            <Input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Type your guess..."
              onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
              className="font-rajdhani text-center text-lg"
              autoFocus
            />
            <Button 
              onClick={submitGuess}
              disabled={!guess.trim()}
              className="bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30 disabled:opacity-50"
            >
              <Check className="w-4 h-4 mr-2" />
              Guess
            </Button>
          </div>
        </div>
      )}

      {/* Recent Guesses */}
      {gameState.guesses.length > 0 && (
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-3 max-h-32 overflow-y-auto">
          <p className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider mb-2">Recent Guesses</p>
          <div className="space-y-1.5">
            {gameState.guesses.slice(-5).reverse().map((g, i) => (
              <div
                key={i}
                className={`p-2 rounded-lg transition-all ${
                  g.correct
                    ? 'bg-neon-green/20 border border-neon-green text-neon-green'
                    : 'bg-muted/30 text-muted-foreground'
                }`}
              >
                <p className="text-sm font-rajdhani">
                  <span className="font-semibold">{g.playerName}:</span> {g.text}
                  {g.correct && <Check className="w-3 h-3 inline ml-1" />}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scores */}
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4">
        <p className="text-xs font-orbitron text-muted-foreground uppercase tracking-wider mb-3 text-center">Scores</p>
        <div className="flex flex-wrap justify-center gap-3">
          {gameState.players
            .map(player => ({ ...player, score: gameState.scores[player.id] || 0 }))
            .sort((a, b) => b.score - a.score)
            .map((player, index) => (
              <div 
                key={player.id} 
                className={`px-4 py-2 rounded-lg transition-all ${
                  player.id === playerId 
                    ? 'bg-neon-cyan/20 border-2 border-neon-cyan shadow-lg shadow-neon-cyan/20' 
                    : player.id === gameState.currentDrawer 
                    ? 'bg-neon-pink/20 border-2 border-neon-pink'
                    : 'bg-card border border-border'
                } ${index === 0 && player.score > 0 ? 'ring-2 ring-neon-orange/50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {index === 0 && player.score > 0 && (
                    <Trophy className="w-4 h-4 text-neon-orange" />
                  )}
                  <span className="font-rajdhani text-sm">
                    {player.id === playerId && <span className="text-neon-cyan">★ </span>}
                    {player.name}
                  </span>
                  <span className="font-orbitron text-base font-bold text-neon-cyan ml-1">
                    {player.score}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default DrawingGame;
