import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Pencil, Eraser, Trash2, Copy, Users, ArrowLeft, Check, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateFireworks } from '@/utils/confetti';
import { RealtimeChannel } from '@supabase/supabase-js';

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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentLineRef = useRef<DrawingPoint[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const isDrawer = gameState.currentDrawer === playerId;

  const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  const getRandomWord = () => WORDS[Math.floor(Math.random() * WORDS.length)];

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [mode]);

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
      <div className="text-center space-y-6 animate-slide-in">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Pencil className="w-8 h-8 text-neon-pink animate-float" />
          <h2 className="font-orbitron text-2xl text-foreground">Drawing Game</h2>
        </div>

        <p className="text-muted-foreground font-rajdhani">
          Draw and guess with friends!
        </p>

        <Input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name..."
          className="max-w-xs mx-auto text-center font-rajdhani"
          maxLength={15}
        />

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => setMode('create')}
            className="bg-neon-pink/20 border border-neon-pink text-neon-pink hover:bg-neon-pink/30"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Create Room
          </Button>
          <Button
            onClick={() => setMode('join')}
            variant="outline"
            className="border-border hover:bg-accent"
          >
            <Users className="w-4 h-4 mr-2" />
            Join Room
          </Button>
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
      <div className="text-center space-y-6 animate-slide-in">
        <Pencil className="w-12 h-12 text-neon-pink animate-pulse mx-auto" />
        <h3 className="font-orbitron text-xl text-foreground">Waiting for players...</h3>
        <p className="text-muted-foreground text-sm">You: {playerName}</p>
        
        <div className="flex items-center justify-center gap-2 p-4 bg-card rounded-xl border border-border">
          <span className="text-3xl font-orbitron tracking-widest text-neon-pink">{roomCode}</span>
          <Button variant="ghost" size="icon" onClick={copyRoomCode}>
            {copied ? <Check className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Share this code with friends</p>
        
        <Button variant="outline" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Leave
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
    <div className="space-y-4 animate-slide-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Leave
        </Button>
        <div className="text-center">
          <span className="font-orbitron text-sm text-muted-foreground">Round {gameState.round}/{gameState.maxRounds}</span>
          {isDrawer && (
            <p className="text-neon-pink font-bold font-orbitron">Draw: {gameState.word}</p>
          )}
          {!isDrawer && (
            <p className="text-muted-foreground font-rajdhani">
              {getPlayerName(gameState.currentDrawer)} is drawing...
            </p>
          )}
        </div>
        <span className="font-orbitron text-sm text-neon-cyan">{roomCode}</span>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="w-full bg-white rounded-lg border-2 border-border touch-none"
          style={{ maxWidth: '400px', margin: '0 auto', display: 'block' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      {/* Drawing Tools */}
      {isDrawer && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex gap-1">
            {COLORS.map(color => (
              <button
                key={color}
                onClick={() => { setCurrentColor(color); setIsEraser(false); haptics.light(); }}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  currentColor === color && !isEraser ? 'border-neon-cyan scale-110' : 'border-border'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <Button
            size="sm"
            variant={isEraser ? 'default' : 'outline'}
            onClick={() => { setIsEraser(!isEraser); haptics.light(); }}
          >
            <Eraser className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={clearCanvas}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Guess input */}
      {!isDrawer && (
        <div className="flex gap-2 max-w-md mx-auto">
          <Input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Type your guess..."
            onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
            className="font-rajdhani"
          />
          <Button 
            onClick={submitGuess} 
            className="bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30"
          >
            Guess
          </Button>
        </div>
      )}

      {/* Recent Guesses */}
      <div className="max-h-20 overflow-y-auto space-y-1 px-2">
        {gameState.guesses.slice(-5).map((g, i) => (
          <p key={i} className={`text-sm font-rajdhani ${g.correct ? 'text-neon-green font-bold' : 'text-muted-foreground'}`}>
            <span className="font-semibold">{g.playerName}:</span> {g.text}
            {g.correct && ' ✓'}
          </p>
        ))}
      </div>

      {/* Scores */}
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        {gameState.players.map(player => (
          <div 
            key={player.id} 
            className={`px-3 py-1 rounded-full ${
              player.id === playerId 
                ? 'bg-neon-cyan/20 border border-neon-cyan' 
                : player.id === gameState.currentDrawer 
                ? 'bg-neon-pink/20 border border-neon-pink'
                : 'bg-card border border-border'
            }`}
          >
            <span className="font-rajdhani">
              {player.name}{player.id === playerId && ' (You)'}: 
              <span className="font-orbitron ml-1">{gameState.scores[player.id] || 0}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DrawingGame;
