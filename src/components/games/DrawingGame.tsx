import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Pencil, Eraser, Trash2, Copy, Users, ArrowLeft, Palette } from 'lucide-react';
import { toast } from 'sonner';

type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'playing';

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
  guesses: { player: string; text: string; correct: boolean }[];
  round: number;
  players: string[];
}

const WORDS = [
  'cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'star', 'fish', 'bird',
  'apple', 'banana', 'pizza', 'cake', 'ice cream', 'flower', 'rainbow', 'heart',
  'book', 'phone', 'computer', 'guitar', 'ball', 'hat', 'shoe', 'glasses'
];

const COLORS = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'];

const DrawingGame: React.FC = () => {
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId] = useState(() => Math.random().toString(36).substring(2, 8));
  const [playerName, setPlayerName] = useState('');
  const [gameState, setGameState] = useState<GameState>({
    lines: [],
    currentDrawer: '',
    word: '',
    scores: {},
    guesses: [],
    round: 1,
    players: []
  });
  const [guess, setGuess] = useState('');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentLineRef = useRef<DrawingPoint[]>([]);

  const isDrawer = gameState.currentDrawer === playerId;

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  };

  const getRandomWord = () => {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
  };

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
      players: [playerId]
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
    currentState.players.push(playerId);
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
    toast.success('Joined room!');
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`drawing-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          const newState = JSON.parse(JSON.stringify(payload.new.game_state)) as GameState;
          setGameState(newState);
          
          if (payload.new.status === 'playing' && mode === 'waiting') {
            setMode('playing');
            toast.success('Game started!');
          }

          // Redraw canvas
          redrawCanvas(newState.lines);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mode]);

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

      await supabase
        .from('game_rooms')
        .update({ game_state: JSON.parse(JSON.stringify(newState)) })
        .eq('id', roomId);

      setGameState(newState);
    }
    currentLineRef.current = [];
  };

  const clearCanvas = async () => {
    if (!isDrawer || !roomId) return;
    
    const newState = { ...gameState, lines: [] };
    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);

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
    const newGuess = { player: playerName, text: guess, correct: isCorrect };
    
    const newState = { ...gameState };
    newState.guesses = [...newState.guesses, newGuess];
    
    if (isCorrect) {
      newState.scores[playerId] = (newState.scores[playerId] || 0) + 10;
      toast.success('Correct! +10 points');
      
      // Start new round
      const nextDrawerIndex = (newState.players.indexOf(newState.currentDrawer) + 1) % newState.players.length;
      newState.currentDrawer = newState.players[nextDrawerIndex];
      newState.word = getRandomWord();
      newState.lines = [];
      newState.guesses = [];
      newState.round += 1;
    }

    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);

    setGameState(newState);
    setGuess('');
  };

  const leaveGame = async () => {
    if (roomId) {
      await supabase.from('game_rooms').delete().eq('id', roomId);
    }
    setMode('menu');
    setRoomId(null);
    setRoomCode('');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    toast.success('Room code copied!');
  };

  // Menu
  if (mode === 'menu') {
    return (
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Pencil className="w-8 h-8 text-neon-pink" />
          <h2 className="font-orbitron text-2xl text-foreground">Drawing Game</h2>
        </div>

        <Input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Your name..."
          className="max-w-xs mx-auto bg-background/50 border-border"
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
      <div className="text-center space-y-6">
        <Button variant="ghost" onClick={() => setMode('menu')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h3 className="font-orbitron text-xl text-foreground">Create Drawing Room</h3>
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
      <div className="text-center space-y-6">
        <Button variant="ghost" onClick={() => setMode('menu')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h3 className="font-orbitron text-xl text-foreground">Join Drawing Room</h3>
        <Input
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          placeholder="Enter room code..."
          maxLength={4}
          className="max-w-xs mx-auto text-center text-2xl tracking-widest bg-background/50 border-border"
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
      <div className="text-center space-y-6">
        <h3 className="font-orbitron text-xl text-foreground">Waiting for players...</h3>
        <div className="flex items-center justify-center gap-2">
          <span className="text-4xl font-mono tracking-widest text-neon-pink">{roomCode}</span>
          <Button variant="ghost" size="icon" onClick={copyRoomCode}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-muted-foreground">Share this code with friends</p>
        <Button variant="outline" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Leave
        </Button>
      </div>
    );
  }

  // Playing
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Leave
        </Button>
        <div className="text-center">
          <span className="font-orbitron text-sm text-muted-foreground">Round {gameState.round}</span>
          {isDrawer && (
            <p className="text-neon-pink font-bold">Draw: {gameState.word}</p>
          )}
          {!isDrawer && (
            <p className="text-muted-foreground">Guess the drawing!</p>
          )}
        </div>
        <span className="font-mono text-sm text-neon-cyan">{roomCode}</span>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="w-full bg-white rounded-lg border border-border touch-none"
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
                onClick={() => { setCurrentColor(color); setIsEraser(false); }}
                className={`w-6 h-6 rounded-full border-2 ${
                  currentColor === color && !isEraser ? 'border-neon-cyan' : 'border-border'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <Button
            size="sm"
            variant={isEraser ? 'default' : 'outline'}
            onClick={() => setIsEraser(!isEraser)}
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
            className="bg-background/50 border-border"
          />
          <Button onClick={submitGuess} className="bg-neon-green/20 border border-neon-green text-neon-green">
            Guess
          </Button>
        </div>
      )}

      {/* Guesses */}
      <div className="max-h-24 overflow-y-auto space-y-1">
        {gameState.guesses.slice(-5).map((g, i) => (
          <p key={i} className={`text-sm ${g.correct ? 'text-neon-green' : 'text-muted-foreground'}`}>
            <span className="font-bold">{g.player}:</span> {g.text}
            {g.correct && ' ✓'}
          </p>
        ))}
      </div>

      {/* Scores */}
      <div className="flex justify-center gap-4 text-sm">
        {Object.entries(gameState.scores).map(([id, score]) => (
          <span key={id} className={id === playerId ? 'text-neon-cyan' : 'text-muted-foreground'}>
            {id === playerId ? 'You' : 'Player'}: {score}
          </span>
        ))}
      </div>
    </div>
  );
};

export default DrawingGame;
