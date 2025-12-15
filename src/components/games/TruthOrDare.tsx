import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Heart, Zap, Copy, Users, ArrowLeft, RefreshCw, Check, X } from 'lucide-react';
import { toast } from 'sonner';

type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'playing';

interface Challenge {
  type: 'truth' | 'dare';
  text: string;
  from: string;
  to: string;
  completed?: boolean;
}

interface GameState {
  players: { id: string; name: string }[];
  currentPlayerIndex: number;
  challenges: Challenge[];
  currentChallenge: Challenge | null;
}

const TRUTHS = [
  "What's your biggest fear?",
  "What's the most embarrassing thing you've done?",
  "Who was your first crush?",
  "What's a secret you've never told anyone?",
  "What's the last lie you told?",
  "What's your guilty pleasure?",
  "Have you ever cheated on a test?",
  "What's the worst gift you've ever received?",
  "Who in this room would you date?",
  "What's your biggest insecurity?",
  "Have you ever stolen something?",
  "What's the meanest thing you've said about someone?",
  "What's your most embarrassing childhood memory?",
  "Have you ever had a crush on a friend's partner?",
  "What's the weirdest dream you've ever had?"
];

const DARES = [
  "Do 10 pushups right now",
  "Speak in an accent for the next 3 rounds",
  "Let someone post anything on your social media",
  "Do your best celebrity impression",
  "Dance for 30 seconds with no music",
  "Tell a joke and make everyone laugh",
  "Sing the chorus of your favorite song",
  "Do your best animal impression",
  "Hold your breath for 30 seconds",
  "Say the alphabet backwards",
  "Do a silly walk across the room",
  "Make a funny face and hold it for 10 seconds",
  "Speak in third person for the next round",
  "Give a compliment to everyone playing",
  "Do your best robot dance"
];

const TruthOrDare: React.FC = () => {
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId] = useState(() => Math.random().toString(36).substring(2, 8));
  const [playerName, setPlayerName] = useState('');
  const [selectedType, setSelectedType] = useState<'truth' | 'dare' | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    currentPlayerIndex: 0,
    challenges: [],
    currentChallenge: null
  });

  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  };

  const getRandomTruth = () => TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
  const getRandomDare = () => DARES[Math.floor(Math.random() * DARES.length)];

  const createRoom = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    const code = generateRoomCode();
    const initialState: GameState = {
      players: [{ id: playerId, name: playerName }],
      currentPlayerIndex: 0,
      challenges: [],
      currentChallenge: null
    };

    const { data, error } = await supabase
      .from('game_rooms')
      .insert({
        room_code: code,
        game_type: 'truthordare',
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
      .eq('game_type', 'truthordare')
      .single();

    if (error || !data) {
      toast.error('Room not found');
      return;
    }

    const currentState = JSON.parse(JSON.stringify(data.game_state)) as GameState;
    currentState.players.push({ id: playerId, name: playerName });

    await supabase
      .from('game_rooms')
      .update({
        game_state: JSON.parse(JSON.stringify(currentState)),
        player_count: data.player_count + 1
      })
      .eq('id', data.id);

    setRoomCode(inputCode.toUpperCase());
    setRoomId(data.id);
    setGameState(currentState);
    setMode('waiting');
    toast.success('Joined room!');
  };

  const startGame = async () => {
    if (!roomId || gameState.players.length < 2) {
      toast.error('Need at least 2 players');
      return;
    }

    const newState = { ...gameState };
    await supabase
      .from('game_rooms')
      .update({
        game_state: JSON.parse(JSON.stringify(newState)),
        status: 'playing'
      })
      .eq('id', roomId);

    setMode('playing');
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`truthordare-${roomId}`)
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mode]);

  const selectChoice = async (type: 'truth' | 'dare') => {
    if (!isMyTurn || !roomId) return;

    const challenge: Challenge = {
      type,
      text: type === 'truth' ? getRandomTruth() : getRandomDare(),
      from: 'Game',
      to: playerName
    };

    const newState = {
      ...gameState,
      currentChallenge: challenge
    };

    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);

    setGameState(newState);
    setSelectedType(type);
  };

  const completeChallenge = async (completed: boolean) => {
    if (!roomId || !gameState.currentChallenge) return;

    const newChallenge = { ...gameState.currentChallenge, completed };
    const nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

    const newState: GameState = {
      ...gameState,
      challenges: [...gameState.challenges, newChallenge],
      currentChallenge: null,
      currentPlayerIndex: nextIndex
    };

    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);

    setGameState(newState);
    setSelectedType(null);
    
    toast(completed ? 'Challenge completed! 🎉' : 'Challenge skipped');
  };

  const spinAgain = async () => {
    if (!isMyTurn || !roomId || !selectedType) return;

    const challenge: Challenge = {
      type: selectedType,
      text: selectedType === 'truth' ? getRandomTruth() : getRandomDare(),
      from: 'Game',
      to: playerName
    };

    const newState = {
      ...gameState,
      currentChallenge: challenge
    };

    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);

    setGameState(newState);
  };

  const leaveGame = async () => {
    if (roomId) {
      await supabase.from('game_rooms').delete().eq('id', roomId);
    }
    setMode('menu');
    setRoomId(null);
    setRoomCode('');
    setSelectedType(null);
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
          <Heart className="w-8 h-8 text-neon-pink" />
          <h2 className="font-orbitron text-2xl text-foreground">Truth or Dare</h2>
          <Zap className="w-8 h-8 text-neon-orange" />
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
            <Heart className="w-4 h-4 mr-2" />
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
        <h3 className="font-orbitron text-xl text-foreground">Create Truth or Dare Room</h3>
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
        <h3 className="font-orbitron text-xl text-foreground">Join Truth or Dare Room</h3>
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
        <h3 className="font-orbitron text-xl text-foreground">Waiting Room</h3>
        <div className="flex items-center justify-center gap-2">
          <span className="text-4xl font-mono tracking-widest text-neon-pink">{roomCode}</span>
          <Button variant="ghost" size="icon" onClick={copyRoomCode}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground">Players ({gameState.players.length}):</p>
          <div className="flex flex-wrap justify-center gap-2">
            {gameState.players.map((p, i) => (
              <span
                key={p.id}
                className={`px-3 py-1 rounded-full text-sm ${
                  p.id === playerId
                    ? 'bg-neon-cyan/20 text-neon-cyan'
                    : 'bg-accent text-foreground'
                }`}
              >
                {p.name} {p.id === playerId && '(You)'}
              </span>
            ))}
          </div>
        </div>

        {gameState.players[0]?.id === playerId && (
          <Button
            onClick={startGame}
            disabled={gameState.players.length < 2}
            className="bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30"
          >
            Start Game ({gameState.players.length}/2+)
          </Button>
        )}

        <Button variant="outline" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Leave
        </Button>
      </div>
    );
  }

  // Playing
  return (
    <div className="space-y-6 text-center">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Leave
        </Button>
        <span className="font-mono text-sm text-neon-cyan">{roomCode}</span>
      </div>

      {/* Player indicators */}
      <div className="flex justify-center gap-2 flex-wrap">
        {gameState.players.map((p, i) => (
          <span
            key={p.id}
            className={`px-3 py-1 rounded-full text-sm transition-all ${
              i === gameState.currentPlayerIndex
                ? 'bg-neon-pink/30 text-neon-pink border border-neon-pink scale-110'
                : 'bg-accent/50 text-muted-foreground'
            }`}
          >
            {p.name}
          </span>
        ))}
      </div>

      {/* Current turn info */}
      <div className="py-4">
        {!gameState.currentChallenge ? (
          <>
            <p className="text-lg mb-4">
              {isMyTurn ? (
                <span className="text-neon-cyan font-bold">Your turn! Choose:</span>
              ) : (
                <span className="text-muted-foreground">
                  Waiting for <span className="text-neon-pink">{currentPlayer?.name}</span> to choose...
                </span>
              )}
            </p>

            {isMyTurn && (
              <div className="flex justify-center gap-4">
                <Button
                  onClick={() => selectChoice('truth')}
                  className="bg-neon-pink/20 border-2 border-neon-pink text-neon-pink hover:bg-neon-pink/30 text-lg px-8 py-6"
                >
                  <Heart className="w-5 h-5 mr-2" />
                  Truth
                </Button>
                <Button
                  onClick={() => selectChoice('dare')}
                  className="bg-neon-orange/20 border-2 border-neon-orange text-neon-orange hover:bg-neon-orange/30 text-lg px-8 py-6"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Dare
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div
              className={`p-6 rounded-2xl border-2 ${
                gameState.currentChallenge.type === 'truth'
                  ? 'bg-neon-pink/10 border-neon-pink'
                  : 'bg-neon-orange/10 border-neon-orange'
              }`}
            >
              <span
                className={`text-xs uppercase tracking-widest ${
                  gameState.currentChallenge.type === 'truth' ? 'text-neon-pink' : 'text-neon-orange'
                }`}
              >
                {gameState.currentChallenge.type}
              </span>
              <p className="text-xl mt-2 text-foreground font-medium">
                {gameState.currentChallenge.text}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                For: <span className="text-neon-cyan">{gameState.currentChallenge.to}</span>
              </p>
            </div>

            {isMyTurn && (
              <div className="flex justify-center gap-3">
                <Button
                  onClick={() => completeChallenge(true)}
                  className="bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Done!
                </Button>
                <Button
                  onClick={spinAgain}
                  variant="outline"
                  className="border-border"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  New One
                </Button>
                <Button
                  onClick={() => completeChallenge(false)}
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Skip
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History */}
      {gameState.challenges.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="text-sm text-muted-foreground mb-2">History</p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {gameState.challenges.slice(-5).reverse().map((c, i) => (
              <p key={i} className="text-sm">
                <span className={c.type === 'truth' ? 'text-neon-pink' : 'text-neon-orange'}>
                  {c.to}
                </span>
                : {c.text.substring(0, 40)}...
                <span className={c.completed ? 'text-neon-green' : 'text-destructive'}>
                  {c.completed ? ' ✓' : ' ✗'}
                </span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TruthOrDare;
