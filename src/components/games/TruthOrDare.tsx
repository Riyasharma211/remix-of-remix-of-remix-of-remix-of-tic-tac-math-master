import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Heart, Zap, Copy, Users, ArrowLeft, Send, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { haptics } from '@/utils/haptics';

type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'playing';
type TurnPhase = 'choosing' | 'waiting_question' | 'answering' | 'viewing_answer';

interface Challenge {
  type: 'truth' | 'dare';
  question: string;
  answer: string;
  asker: string;
  answerer: string;
}

interface GameState {
  players: { id: string; name: string }[];
  currentPlayerIndex: number;
  challenges: Challenge[];
  turnPhase: TurnPhase;
  currentType?: 'truth' | 'dare';
  currentQuestion?: string;
  currentAnswer?: string;
  askerName?: string;
}

const TruthOrDare: React.FC = () => {
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId] = useState(() => Math.random().toString(36).substring(2, 8));
  const [playerName, setPlayerName] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    currentPlayerIndex: 0,
    challenges: [],
    turnPhase: 'choosing'
  });

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const amIAsker = gameState.askerName === playerName;

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  };

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
      turnPhase: 'choosing'
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

    const newState = { ...gameState, turnPhase: 'choosing' as TurnPhase };
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
    
    haptics.medium();

    // Pick a random other player to ask the question
    const otherPlayers = gameState.players.filter(p => p.id !== playerId);
    if (otherPlayers.length === 0) {
      toast.error('Need other players');
      return;
    }
    
    const asker = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
    
    const newState: GameState = {
      ...gameState,
      turnPhase: 'waiting_question',
      currentType: type,
      askerName: asker.name,
      currentQuestion: undefined,
      currentAnswer: undefined
    };

    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);

    setGameState(newState);
    toast.info(`${asker.name} will type a ${type} for you!`);
  };

  const submitQuestion = async () => {
    if (!roomId || !questionInput.trim()) return;
    
    haptics.success();

    const newState: GameState = {
      ...gameState,
      turnPhase: 'answering',
      currentQuestion: questionInput.trim()
    };

    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);

    setGameState(newState);
    setQuestionInput('');
    toast.success('Question sent!');
  };

  const submitAnswer = async () => {
    if (!roomId || !answerInput.trim()) return;
    
    haptics.success();

    const newState: GameState = {
      ...gameState,
      turnPhase: 'viewing_answer',
      currentAnswer: answerInput.trim()
    };

    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);

    setGameState(newState);
    setAnswerInput('');
  };

  const nextTurn = async () => {
    if (!roomId) return;
    
    haptics.light();

    const challenge: Challenge = {
      type: gameState.currentType || 'truth',
      question: gameState.currentQuestion || '',
      answer: gameState.currentAnswer || '',
      asker: gameState.askerName || '',
      answerer: currentPlayer?.name || ''
    };

    const nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

    const newState: GameState = {
      ...gameState,
      challenges: [...gameState.challenges, challenge],
      currentPlayerIndex: nextIndex,
      turnPhase: 'choosing',
      currentType: undefined,
      currentQuestion: undefined,
      currentAnswer: undefined,
      askerName: undefined
    };

    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);

    setGameState(newState);
    toast.success('Next player\'s turn!');
  };

  const leaveGame = async () => {
    if (roomId) {
      await supabase.from('game_rooms').delete().eq('id', roomId);
    }
    setMode('menu');
    setRoomId(null);
    setRoomCode('');
    setQuestionInput('');
    setAnswerInput('');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    toast.success('Room code copied!');
  };

  // Menu
  if (mode === 'menu') {
    return (
      <div className="text-center space-y-6 px-4 py-6 max-w-md mx-auto">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Heart className="w-8 h-8 text-neon-pink animate-pulse" />
          <h2 className="font-orbitron text-xl sm:text-2xl text-foreground">Truth or Dare</h2>
          <Zap className="w-8 h-8 text-neon-orange animate-pulse" />
        </div>

        <Input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Your name..."
          className="w-full bg-background/50 border-border text-base py-6"
        />

        <div className="flex flex-col gap-4">
          <Button
            onClick={() => setMode('create')}
            className="w-full bg-neon-pink/20 border border-neon-pink text-neon-pink hover:bg-neon-pink/30 py-6 text-lg"
          >
            <Heart className="w-5 h-5 mr-2" />
            Create Room
          </Button>
          <Button
            onClick={() => setMode('join')}
            variant="outline"
            className="w-full border-border hover:bg-accent py-6 text-lg"
          >
            <Users className="w-5 h-5 mr-2" />
            Join Room
          </Button>
        </div>
      </div>
    );
  }

  // Create room
  if (mode === 'create') {
    return (
      <div className="text-center space-y-6 px-4 py-6 max-w-md mx-auto">
        <Button variant="ghost" onClick={() => setMode('menu')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h3 className="font-orbitron text-xl text-foreground">Create Room</h3>
        <Button
          onClick={createRoom}
          className="w-full bg-neon-pink/20 border border-neon-pink text-neon-pink hover:bg-neon-pink/30 py-6 text-lg"
        >
          Create Game
        </Button>
      </div>
    );
  }

  // Join room
  if (mode === 'join') {
    return (
      <div className="text-center space-y-6 px-4 py-6 max-w-md mx-auto">
        <Button variant="ghost" onClick={() => setMode('menu')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h3 className="font-orbitron text-xl text-foreground">Join Room</h3>
        <Input
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          placeholder="Enter code..."
          maxLength={4}
          className="w-full text-center text-3xl tracking-[0.5em] bg-background/50 border-border py-6 font-mono"
        />
        <Button
          onClick={joinRoom}
          disabled={inputCode.length !== 4}
          className="w-full bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30 py-6 text-lg"
        >
          Join Game
        </Button>
      </div>
    );
  }

  // Waiting
  if (mode === 'waiting') {
    return (
      <div className="text-center space-y-6 px-4 py-6 max-w-md mx-auto">
        <h3 className="font-orbitron text-xl text-foreground">Waiting Room</h3>
        <div className="flex items-center justify-center gap-2">
          <span className="text-4xl font-mono tracking-[0.3em] text-neon-pink">{roomCode}</span>
          <Button variant="ghost" size="icon" onClick={copyRoomCode} className="h-12 w-12">
            <Copy className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <p className="text-muted-foreground">Players ({gameState.players.length}):</p>
          <div className="flex flex-wrap justify-center gap-2">
            {gameState.players.map((p) => (
              <span
                key={p.id}
                className={`px-4 py-2 rounded-full text-sm ${
                  p.id === playerId
                    ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan'
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
            className="w-full bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30 py-6 text-lg"
          >
            Start Game ({gameState.players.length}/2+)
          </Button>
        )}

        <Button variant="outline" onClick={leaveGame} className="w-full py-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Leave
        </Button>
      </div>
    );
  }

  // Playing
  return (
    <div className="space-y-4 px-4 py-4 max-w-md mx-auto min-h-[70vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={leaveGame} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="font-mono text-sm text-neon-cyan px-3 py-1 bg-neon-cyan/10 rounded-full">{roomCode}</span>
      </div>

      {/* Player indicators */}
      <div className="flex justify-center gap-2 flex-wrap pb-2">
        {gameState.players.map((p, i) => (
          <span
            key={p.id}
            className={`px-3 py-1.5 rounded-full text-sm transition-all ${
              i === gameState.currentPlayerIndex
                ? 'bg-neon-pink/30 text-neon-pink border border-neon-pink scale-105'
                : 'bg-accent/50 text-muted-foreground'
            }`}
          >
            {p.name}
          </span>
        ))}
      </div>

      {/* Main game area */}
      <div className="flex-1 flex flex-col justify-center">
        {/* Phase: Choosing Truth or Dare */}
        {gameState.turnPhase === 'choosing' && (
          <div className="space-y-6 text-center">
            <p className="text-lg">
              {isMyTurn ? (
                <span className="text-neon-cyan font-bold text-xl">Your turn! Choose:</span>
              ) : (
                <span className="text-muted-foreground">
                  <span className="text-neon-pink font-semibold">{currentPlayer?.name}</span> is choosing...
                </span>
              )}
            </p>

            {isMyTurn && (
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button
                  onClick={() => selectChoice('truth')}
                  className="flex-1 bg-neon-pink/20 border-2 border-neon-pink text-neon-pink hover:bg-neon-pink/30 text-xl py-8 rounded-2xl"
                >
                  <Heart className="w-6 h-6 mr-3" />
                  Truth
                </Button>
                <Button
                  onClick={() => selectChoice('dare')}
                  className="flex-1 bg-neon-orange/20 border-2 border-neon-orange text-neon-orange hover:bg-neon-orange/30 text-xl py-8 rounded-2xl"
                >
                  <Zap className="w-6 h-6 mr-3" />
                  Dare
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Phase: Waiting for question */}
        {gameState.turnPhase === 'waiting_question' && (
          <div className="space-y-6 text-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
              gameState.currentType === 'truth' ? 'bg-neon-pink/20 text-neon-pink' : 'bg-neon-orange/20 text-neon-orange'
            }`}>
              {gameState.currentType === 'truth' ? <Heart className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
              <span className="font-bold uppercase">{gameState.currentType}</span>
            </div>

            {amIAsker ? (
              <div className="space-y-4">
                <p className="text-lg text-neon-cyan font-semibold">
                  Type a {gameState.currentType} for <span className="text-neon-pink">{currentPlayer?.name}</span>!
                </p>
                <Textarea
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder={gameState.currentType === 'truth' 
                    ? "Ask a truth question..." 
                    : "Give a dare challenge..."}
                  className="w-full bg-background/50 border-border min-h-[120px] text-base resize-none"
                  maxLength={300}
                />
                <Button
                  onClick={submitQuestion}
                  disabled={!questionInput.trim()}
                  className="w-full bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30 py-6 text-lg"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Send Question
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="animate-pulse">
                  <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                </div>
                <p className="text-muted-foreground text-lg">
                  <span className="text-neon-pink font-semibold">{gameState.askerName}</span> is typing a {gameState.currentType}...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phase: Answering */}
        {gameState.turnPhase === 'answering' && (
          <div className="space-y-6">
            <div className={`p-6 rounded-2xl border-2 ${
              gameState.currentType === 'truth'
                ? 'bg-neon-pink/10 border-neon-pink'
                : 'bg-neon-orange/10 border-neon-orange'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {gameState.currentType === 'truth' ? (
                  <Heart className="w-5 h-5 text-neon-pink" />
                ) : (
                  <Zap className="w-5 h-5 text-neon-orange" />
                )}
                <span className={`text-xs uppercase tracking-widest ${
                  gameState.currentType === 'truth' ? 'text-neon-pink' : 'text-neon-orange'
                }`}>
                  {gameState.currentType} from {gameState.askerName}
                </span>
              </div>
              <p className="text-xl text-foreground font-medium leading-relaxed">
                {gameState.currentQuestion}
              </p>
            </div>

            {isMyTurn ? (
              <div className="space-y-4">
                <Textarea
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  placeholder={gameState.currentType === 'truth' ? "Type your answer..." : "Describe what you did..."}
                  className="w-full bg-background/50 border-border min-h-[100px] text-base resize-none"
                  maxLength={500}
                />
                <Button
                  onClick={submitAnswer}
                  disabled={!answerInput.trim()}
                  className="w-full bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 py-6 text-lg"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Submit Answer
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="animate-pulse">
                  <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                </div>
                <p className="text-muted-foreground">
                  <span className="text-neon-pink font-semibold">{currentPlayer?.name}</span> is answering...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phase: Viewing Answer */}
        {gameState.turnPhase === 'viewing_answer' && (
          <div className="space-y-6">
            <div className={`p-6 rounded-2xl border-2 ${
              gameState.currentType === 'truth'
                ? 'bg-neon-pink/10 border-neon-pink'
                : 'bg-neon-orange/10 border-neon-orange'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {gameState.currentType === 'truth' ? (
                  <Heart className="w-4 h-4 text-neon-pink" />
                ) : (
                  <Zap className="w-4 h-4 text-neon-orange" />
                )}
                <span className={`text-xs uppercase tracking-widest ${
                  gameState.currentType === 'truth' ? 'text-neon-pink' : 'text-neon-orange'
                }`}>
                  {gameState.currentType}
                </span>
              </div>
              <p className="text-lg text-foreground mb-4">
                {gameState.currentQuestion}
              </p>
              <div className="border-t border-border/50 pt-4">
                <p className="text-xs text-muted-foreground mb-2">{currentPlayer?.name}'s answer:</p>
                <p className="text-lg text-neon-cyan font-medium">
                  {gameState.currentAnswer}
                </p>
              </div>
            </div>

            {isMyTurn && (
              <Button
                onClick={nextTurn}
                className="w-full bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30 py-6 text-lg"
              >
                Next Turn →
              </Button>
            )}

            {!isMyTurn && (
              <p className="text-center text-muted-foreground">
                Waiting for <span className="text-neon-pink">{currentPlayer?.name}</span> to continue...
              </p>
            )}
          </div>
        )}
      </div>

      {/* History */}
      {gameState.challenges.length > 0 && (
        <div className="border-t border-border pt-4 mt-auto">
          <p className="text-sm text-muted-foreground mb-2 text-center">History</p>
          <div className="max-h-24 overflow-y-auto space-y-2">
            {gameState.challenges.slice(-3).reverse().map((c, i) => (
              <div key={i} className="text-sm bg-accent/30 rounded-lg p-2">
                <span className={c.type === 'truth' ? 'text-neon-pink' : 'text-neon-orange'}>
                  {c.answerer}
                </span>
                <span className="text-muted-foreground">: {c.question.substring(0, 30)}...</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TruthOrDare;
