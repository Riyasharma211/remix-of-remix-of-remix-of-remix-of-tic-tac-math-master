import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Heart, Copy, Users, ArrowLeft, Play, Clock, SkipForward, Check, Sparkles, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptics } from '@/utils/haptics';
import { RealtimeChannel } from '@supabase/supabase-js';
import { celebrateHearts } from '@/utils/confetti';

type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'playing';
type TurnPhase = 
  | 'choosing' // Current player chooses Truth or Dare
  | 'opponent_writing' // Opponent writes the question/dare
  | 'answering' // Current player answers/does the task
  | 'confirming' // Opponent confirms completion
  | 'viewing_answer'; // Both view the answer

interface GameState {
  players: { id: string; name: string; skipsLeft: number }[];
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  currentType?: 'truth' | 'dare';
  currentQuestion?: string;
  currentAnswer?: string;
  roundCount: number;
}

const TruthOrDare: React.FC = () => {
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId] = useState(() => Math.random().toString(36).substring(2, 8));
  const [playerName, setPlayerName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  
  // Input states
  const [questionInput, setQuestionInput] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  
  // Timer
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    currentPlayerIndex: 0,
    turnPhase: 'choosing',
    roundCount: 0
  });
  
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number }[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const myPlayer = gameState.players.find(p => p.id === playerId);
  const partner = gameState.players.find(p => p.id !== playerId);
  const isOpponent = !isMyTurn;

  const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  // Floating hearts animation
  const spawnHeart = useCallback(() => {
    const newHeart = { id: Date.now(), x: Math.random() * 100 };
    setFloatingHearts(prev => [...prev, newHeart]);
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 3000);
  }, []);

  // Timer logic - for answering/dare phase
  useEffect(() => {
    if (mode === 'playing' && gameState.turnPhase === 'answering' && isMyTurn) {
      setTimeLeft(60);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            // Auto-skip on timeout
            handleAutoSkip();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode, gameState.turnPhase, isMyTurn, gameState.currentPlayerIndex]);

  const handleAutoSkip = async () => {
    if (!roomId || !myPlayer) return;
    toast.info('Time\'s up! Moving to next turn 💭');
    await moveToNextTurn();
  };

  const createRoom = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name 💕');
      return;
    }

    const code = generateRoomCode();
    const initialState: GameState = {
      players: [{ id: playerId, name: playerName, skipsLeft: 2 }],
      currentPlayerIndex: 0,
      turnPhase: 'choosing',
      roundCount: 0
    };

    const { data, error } = await supabase
      .from('game_rooms')
      .insert({
        room_code: code,
        game_type: 'truthordare',
        game_state: JSON.parse(JSON.stringify(initialState)),
        player_count: 1,
        max_players: 2,
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
    toast.success(`Room created! Share code with your love 💖`);
  };

  const joinRoom = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name 💕');
      return;
    }

    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('room_code', inputCode.toUpperCase())
      .eq('game_type', 'truthordare')
      .maybeSingle();

    if (error || !data) {
      toast.error('Room not found');
      return;
    }

    const currentState = JSON.parse(JSON.stringify(data.game_state)) as GameState;

    if (currentState.players.length >= 2 || data.player_count >= 2) {
      toast.error('This couple room is full 💔');
      return;
    }

    // Add player to game
    currentState.players.push({ id: playerId, name: playerName, skipsLeft: 2 });

    await supabase
      .from('game_rooms')
      .update({
        game_state: JSON.parse(JSON.stringify(currentState)),
        player_count: 2,
        status: 'playing'
      })
      .eq('id', data.id);

    setRoomCode(inputCode.toUpperCase());
    setRoomId(data.id);
    setGameState(currentState);
    setPartnerName(currentState.players[0]?.name || '');
    setMode('playing');

    // Broadcast join event
    const channel = supabase.channel(`tod-${inputCode.toUpperCase()}`);
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'player_joined',
      payload: { playerId, playerName, gameState: currentState }
    });
    supabase.removeChannel(channel);

    celebrateHearts();
    toast.success(`Joined ${currentState.players[0]?.name}'s room! Let's play 💕`);
  };

  // Choose Truth or Dare
  const chooseType = async (type: 'truth' | 'dare') => {
    if (!roomId || !isMyTurn) return;
    haptics.light();
    setIsSubmitting(true);
    
    const newState: GameState = {
      ...gameState,
      currentType: type,
      turnPhase: 'opponent_writing',
      currentQuestion: undefined,
      currentAnswer: undefined
    };
    
    await updateAndBroadcast(newState);
    setIsSubmitting(false);
  };

  // Opponent submits question
  const submitQuestion = async () => {
    if (!roomId || !questionInput.trim() || isMyTurn) return;
    haptics.light();
    setIsSubmitting(true);
    
    const newState: GameState = {
      ...gameState,
      currentQuestion: questionInput.trim(),
      turnPhase: 'answering'
    };
    
    await updateAndBroadcast(newState);
    setQuestionInput('');
    setIsSubmitting(false);
  };

  // Player submits answer
  const submitAnswer = async () => {
    if (!roomId || !isMyTurn) return;
    haptics.success();
    setIsSubmitting(true);
    
    const newState: GameState = {
      ...gameState,
      currentAnswer: answerInput.trim() || '(Completed! 💕)',
      turnPhase: 'confirming'
    };
    
    await updateAndBroadcast(newState);
    setAnswerInput('');
    setIsSubmitting(false);
    toast.success('Submitted! Waiting for partner to confirm 💕');
  };

  // Mark dare as done
  const markDone = async () => {
    if (!roomId || !isMyTurn) return;
    haptics.success();
    setIsSubmitting(true);
    
    const newState: GameState = {
      ...gameState,
      currentAnswer: '✅ Done!',
      turnPhase: 'confirming'
    };
    
    await updateAndBroadcast(newState);
    setIsSubmitting(false);
    toast.success('Waiting for partner to confirm 💕');
  };

  // Skip question
  const skipQuestion = async () => {
    if (!roomId || !myPlayer || myPlayer.skipsLeft <= 0) return;
    haptics.medium();
    setIsSubmitting(true);
    
    const updatedPlayers = gameState.players.map(p => 
      p.id === playerId ? { ...p, skipsLeft: p.skipsLeft - 1 } : p
    );
    
    // Move to next turn
    const nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    
    const newState: GameState = {
      ...gameState,
      players: updatedPlayers,
      currentPlayerIndex: nextIndex,
      turnPhase: 'choosing',
      currentType: undefined,
      currentQuestion: undefined,
      currentAnswer: undefined,
      roundCount: gameState.roundCount + 1
    };
    
    await updateAndBroadcast(newState);
    setIsSubmitting(false);
    toast.info(`Skipped! ${myPlayer.skipsLeft - 1} skips left 💭`);
  };

  // Partner confirms completion
  const confirmCompletion = async (reaction: string) => {
    if (!roomId || isMyTurn) return;
    haptics.success();
    setIsSubmitting(true);
    
    const newState: GameState = {
      ...gameState,
      turnPhase: 'viewing_answer'
    };
    
    await updateAndBroadcast(newState);
    setIsSubmitting(false);
    
    if (reaction === 'love') {
      celebrateHearts();
      toast.success('So much love! 😍💕');
    } else {
      spawnHeart();
      toast.success('Aww, so cute! 😊💖');
    }
    
    // Auto move to next turn after 3 seconds
    setTimeout(() => {
      moveToNextTurn();
    }, 3000);
  };

  const moveToNextTurn = async () => {
    if (!roomId) return;
    
    const nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    
    const newState: GameState = {
      ...gameState,
      currentPlayerIndex: nextIndex,
      turnPhase: 'choosing',
      currentType: undefined,
      currentQuestion: undefined,
      currentAnswer: undefined,
      roundCount: gameState.roundCount + 1
    };
    
    await updateAndBroadcast(newState);
  };

  // Realtime subscription
  useEffect(() => {
    if (!roomCode || (mode !== 'waiting' && mode !== 'playing')) return;

    const channel = supabase
      .channel(`tod-${roomCode}`, {
        config: { broadcast: { self: false } }
      })
      .on('broadcast', { event: 'game_update' }, ({ payload }) => {
        if (payload?.gameState) {
          const newState = payload.gameState as GameState;
          setGameState(newState);
          const partnerPlayer = newState.players.find(p => p.id !== playerId);
          if (partnerPlayer) {
            setPartnerName(partnerPlayer.name);
          }
        }
      })
      .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
        if (payload?.playerName && payload.playerId !== playerId) {
          setPartnerName(payload.playerName);
          if (payload.gameState) {
            setGameState(payload.gameState);
          }
          setMode('playing');
          celebrateHearts();
          haptics.success();
          toast.success(`${payload.playerName} joined! Let the love begin! 💕`);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, mode, playerId]);

  const updateAndBroadcast = async (newState: GameState) => {
    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_update',
      payload: { gameState: newState }
    });

    setGameState(newState);
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
    haptics.light();
    toast.success('Room code copied! Share with your love 💕');
  };

  // Floating hearts render
  const renderFloatingHearts = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {floatingHearts.map(heart => (
        <div
          key={heart.id}
          className="absolute animate-float-up text-4xl"
          style={{ left: `${heart.x}%`, bottom: 0 }}
        >
          ❤️
        </div>
      ))}
    </div>
  );

  // Menu
  if (mode === 'menu') {
    return (
      <div className="text-center space-y-6 px-4 py-6 max-w-md mx-auto">
        {renderFloatingHearts()}
        
        <div className="space-y-2 mb-8">
          <div className="flex items-center justify-center gap-2">
            <Heart className="w-8 h-8 text-pink-500 animate-pulse" fill="currentColor" />
            <h2 className="font-orbitron text-2xl bg-gradient-to-r from-pink-500 to-red-500 bg-clip-text text-transparent">
              Couples Truth & Dare
            </h2>
            <Heart className="w-8 h-8 text-pink-500 animate-pulse" fill="currentColor" />
          </div>
          <p className="text-muted-foreground text-sm">A loving game for two hearts 💕</p>
        </div>

        <div className="bg-gradient-to-br from-pink-500/10 to-red-500/10 rounded-2xl p-6 border border-pink-500/20">
          <Sparkles className="w-6 h-6 text-pink-400 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Write custom questions for each other in real-time! No pre-set questions - make it personal 💖
          </p>
        </div>

        <div className="flex flex-col gap-4 mt-6">
          <Button
            onClick={() => setMode('create')}
            className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white hover:from-pink-600 hover:to-red-600 py-6 text-lg shadow-lg shadow-pink-500/25"
          >
            <Heart className="w-5 h-5 mr-2" fill="currentColor" />
            Create Love Room
          </Button>
          <Button
            onClick={() => setMode('join')}
            variant="outline"
            className="w-full border-pink-500/30 hover:bg-pink-500/10 py-6 text-lg"
          >
            <Users className="w-5 h-5 mr-2" />
            Join Partner's Room
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
        
        <div className="space-y-2">
          <Heart className="w-10 h-10 text-pink-500 mx-auto animate-pulse" fill="currentColor" />
          <h3 className="font-orbitron text-xl">What's your name, love?</h3>
        </div>
        
        <Input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Your name..."
          className="w-full bg-background/50 border-pink-500/30 text-base py-6 text-center"
        />
        
        <Button
          onClick={createRoom}
          disabled={!playerName.trim()}
          className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white hover:from-pink-600 hover:to-red-600 py-6 text-lg disabled:opacity-50"
        >
          Create Room 💕
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
        
        <div className="space-y-2">
          <Heart className="w-10 h-10 text-pink-500 mx-auto animate-pulse" fill="currentColor" />
          <h3 className="font-orbitron text-xl">Join your partner's room</h3>
        </div>
        
        <Input
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          placeholder="Room Code"
          maxLength={4}
          className="w-full text-center text-3xl tracking-[0.5em] bg-background/50 border-pink-500/30 py-6 font-mono"
        />
        
        <Input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Your name..."
          className="w-full bg-background/50 border-pink-500/30 text-base py-6 text-center"
        />
        
        <Button
          onClick={joinRoom}
          disabled={inputCode.length !== 4 || !playerName.trim()}
          className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white hover:from-pink-600 hover:to-red-600 py-6 text-lg disabled:opacity-50"
        >
          Join Room 💕
        </Button>
      </div>
    );
  }

  // Waiting for partner
  if (mode === 'waiting') {
    return (
      <div className="text-center space-y-6 px-4 py-6 max-w-md mx-auto">
        {renderFloatingHearts()}
        
        <div className="relative mx-auto w-24 h-24">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500/20 to-red-500/20 animate-pulse" />
          <Heart className="absolute inset-0 m-auto w-12 h-12 text-pink-500 animate-bounce" fill="currentColor" />
        </div>

        <div className="space-y-2">
          <h3 className="font-orbitron text-xl">Waiting for your love... 💕</h3>
          <p className="text-muted-foreground text-sm">Share the room code with your partner</p>
        </div>

        <button
          onClick={copyRoomCode}
          className="flex items-center justify-center gap-3 mx-auto px-6 py-4 bg-gradient-to-r from-pink-500/20 to-red-500/20 rounded-2xl border border-pink-500/30 hover:border-pink-500/50 transition-all"
        >
          <span className="font-mono text-3xl tracking-[0.5em] text-pink-400">{roomCode}</span>
          <Copy className="w-5 h-5 text-pink-400" />
        </button>

        <div className="bg-background/50 rounded-xl p-4 border border-border">
          <p className="text-sm text-muted-foreground">Players: {gameState.players.length}/2</p>
          {gameState.players.map(p => (
            <p key={p.id} className="text-pink-400">{p.name} {p.id === playerId ? '(You)' : ''}</p>
          ))}
        </div>

        <Button variant="ghost" onClick={leaveGame} className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Leave Room
        </Button>
      </div>
    );
  }

  // Playing
  return (
    <div className="space-y-4 px-4 py-4 max-w-md mx-auto min-h-[80vh] flex flex-col">
      {renderFloatingHearts()}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Round {gameState.roundCount + 1}</p>
          <div className="flex items-center gap-2">
            <span className={isMyTurn ? 'text-pink-400 font-bold' : 'text-muted-foreground'}>{playerName}</span>
            <Heart className="w-4 h-4 text-pink-500" fill="currentColor" />
            <span className={!isMyTurn ? 'text-pink-400 font-bold' : 'text-muted-foreground'}>{partnerName || '...'}</span>
          </div>
        </div>
        <div className="w-8" />
      </div>

      {/* Turn indicator */}
      <div className={`text-center p-4 rounded-2xl ${isMyTurn ? 'bg-gradient-to-r from-pink-500/20 to-red-500/20 border border-pink-500/30' : 'bg-background/50 border border-border'}`}>
        <p className="text-lg font-medium">
          {isMyTurn ? "Your turn, love! 💕" : `${currentPlayer?.name}'s turn 💭`}
        </p>
      </div>

      {/* PHASE: Choosing Truth or Dare */}
      {gameState.turnPhase === 'choosing' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          {isMyTurn ? (
            <>
              <p className="text-lg text-center">Choose your fate! ❤️</p>
              <div className="flex gap-4 w-full">
                <Button
                  onClick={() => chooseType('truth')}
                  disabled={isSubmitting}
                  className="flex-1 py-8 text-xl bg-gradient-to-br from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '💭 Truth'}
                </Button>
                <Button
                  onClick={() => chooseType('dare')}
                  disabled={isSubmitting}
                  className="flex-1 py-8 text-xl bg-gradient-to-br from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '🔥 Dare'}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4 animate-pulse">
              <div className="w-20 h-20 mx-auto rounded-full bg-pink-500/20 flex items-center justify-center">
                <Heart className="w-10 h-10 text-pink-500" />
              </div>
              <p className="text-lg">{currentPlayer?.name} is choosing...</p>
            </div>
          )}
        </div>
      )}

      {/* PHASE: Opponent Writing Question */}
      {gameState.turnPhase === 'opponent_writing' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className={`w-full p-6 rounded-3xl text-center ${gameState.currentType === 'truth' 
            ? 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-2 border-pink-500/30' 
            : 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-2 border-red-500/30'}`}>
            <span className="text-4xl">{gameState.currentType === 'truth' ? '💭' : '🔥'}</span>
            <h3 className={`font-orbitron text-2xl mt-2 ${gameState.currentType === 'truth' ? 'text-pink-400' : 'text-red-400'}`}>
              {gameState.currentType?.toUpperCase()}
            </h3>
          </div>

          {isOpponent ? (
            <div className="w-full space-y-4">
              <p className="text-center text-muted-foreground">
                Write a {gameState.currentType} for {currentPlayer?.name}! ✍️
              </p>
              <Textarea
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder={gameState.currentType === 'truth' 
                  ? "Ask something romantic or cute..." 
                  : "Give a fun dare (keep it loving!)..."}
                className="w-full min-h-[100px] bg-background/50 border-pink-500/30"
                maxLength={200}
              />
              <Button
                onClick={submitQuestion}
                disabled={!questionInput.trim() || isSubmitting}
                className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white py-6"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                Send {gameState.currentType === 'truth' ? 'Question' : 'Dare'} 💕
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4 animate-pulse">
              <p className="text-lg">{partner?.name} is writing your {gameState.currentType}...</p>
              <p className="text-muted-foreground text-sm">Get ready! 😊</p>
            </div>
          )}
        </div>
      )}

      {/* PHASE: Answering */}
      {gameState.turnPhase === 'answering' && gameState.currentQuestion && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          {/* Question Card */}
          <div className={`w-full p-6 rounded-3xl ${gameState.currentType === 'truth' 
            ? 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-2 border-pink-500/30' 
            : 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-2 border-red-500/30'}`}>
            <div className="text-center mb-4">
              <span className="text-4xl">{gameState.currentType === 'truth' ? '💭' : '🔥'}</span>
              <h3 className={`font-orbitron text-xl mt-2 ${gameState.currentType === 'truth' ? 'text-pink-400' : 'text-red-400'}`}>
                {gameState.currentType?.toUpperCase()}
              </h3>
            </div>
            <p className="text-lg text-center leading-relaxed">{gameState.currentQuestion}</p>
          </div>

          {isMyTurn ? (
            <div className="w-full space-y-4">
              {/* Timer */}
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className={timeLeft <= 10 ? 'text-red-400 animate-pulse font-bold' : ''}>{timeLeft}s</span>
              </div>

              {gameState.currentType === 'truth' ? (
                <>
                  <Textarea
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    placeholder="Type your answer..."
                    className="w-full min-h-[80px] bg-background/50 border-pink-500/30"
                    maxLength={300}
                  />
                  <Button
                    onClick={submitAnswer}
                    disabled={!answerInput.trim() || isSubmitting}
                    className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white py-6"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                    Submit Answer 💕
                  </Button>
                </>
              ) : (
                <Button
                  onClick={markDone}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white py-6"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                  Done! ✅
                </Button>
              )}

              {myPlayer && myPlayer.skipsLeft > 0 && (
                <Button
                  onClick={skipQuestion}
                  disabled={isSubmitting}
                  variant="outline"
                  className="w-full border-muted-foreground/30 text-muted-foreground py-4"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Skip ({myPlayer.skipsLeft} left)
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center p-4 bg-background/50 rounded-xl border border-border animate-pulse">
              <p className="text-muted-foreground">
                Waiting for {currentPlayer?.name} to {gameState.currentType === 'truth' ? 'answer' : 'complete the dare'}... 💕
              </p>
            </div>
          )}
        </div>
      )}

      {/* PHASE: Confirming */}
      {gameState.turnPhase === 'confirming' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          {/* Show question and answer */}
          <div className={`w-full p-6 rounded-3xl ${gameState.currentType === 'truth' 
            ? 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-2 border-pink-500/30' 
            : 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-2 border-red-500/30'}`}>
            <div className="text-center mb-4">
              <span className="text-3xl">{gameState.currentType === 'truth' ? '💭' : '🔥'}</span>
            </div>
            <p className="text-muted-foreground text-sm mb-2">{gameState.currentQuestion}</p>
            <p className="text-lg font-medium text-center">{gameState.currentAnswer}</p>
          </div>

          {isOpponent ? (
            <div className="w-full space-y-3">
              <p className="text-center text-muted-foreground">How was that? 💕</p>
              <div className="flex gap-3">
                <Button
                  onClick={() => confirmCompletion('blush')}
                  disabled={isSubmitting}
                  className="flex-1 bg-pink-500/20 border border-pink-500 text-pink-500 hover:bg-pink-500/30 py-6 text-lg"
                >
                  😳 Blush
                </Button>
                <Button
                  onClick={() => confirmCompletion('love')}
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-red-500 text-white hover:from-pink-600 hover:to-red-600 py-6 text-lg"
                >
                  😍 Love!
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center p-4 bg-background/50 rounded-xl border border-border animate-pulse">
              <p className="text-muted-foreground">
                Waiting for {partner?.name}'s reaction... 💕
              </p>
            </div>
          )}
        </div>
      )}

      {/* PHASE: Viewing Answer */}
      {gameState.turnPhase === 'viewing_answer' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className={`w-full p-6 rounded-3xl ${gameState.currentType === 'truth' 
            ? 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-2 border-pink-500/30' 
            : 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-2 border-red-500/30'}`}>
            <div className="text-center mb-4">
              <span className="text-4xl">💕</span>
            </div>
            <p className="text-muted-foreground text-sm mb-2">{gameState.currentQuestion}</p>
            <p className="text-lg font-medium text-center">{gameState.currentAnswer}</p>
          </div>
          
          <div className="text-center animate-pulse">
            <p className="text-muted-foreground">Next turn starting... 💕</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TruthOrDare;
