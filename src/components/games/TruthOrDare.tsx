import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Heart, Copy, Users, ArrowLeft, Plus, Trash2, Play, Clock, SkipForward, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { haptics } from '@/utils/haptics';
import { RealtimeChannel } from '@supabase/supabase-js';
import { celebrateHearts } from '@/utils/confetti';

type GameMode = 'menu' | 'create' | 'join' | 'setup' | 'waiting' | 'playing';
type TurnPhase = 'showing_question' | 'waiting_confirmation' | 'viewing_reaction';

interface CustomQuestion {
  type: 'truth' | 'dare';
  question: string;
  addedBy: string;
}

interface GameState {
  players: { id: string; name: string; skipsLeft: number }[];
  currentPlayerIndex: number;
  currentQuestion?: { type: 'truth' | 'dare'; question: string };
  turnPhase: TurnPhase;
  customQuestions: CustomQuestion[];
  usedQuestions: string[];
  reaction?: string;
  roundCount: number;
}

// System romantic questions
const SYSTEM_TRUTHS = [
  "When did you first feel emotionally connected to your partner? 💕",
  "What is one small thing your partner does that melts your heart?",
  "What's your favorite memory of us together?",
  "What made you realize you were falling in love?",
  "What's one thing you've never told me but always wanted to?",
  "What do you love most about our relationship?",
  "When do you feel most loved by me?",
  "What's the sweetest thing I've ever done for you?",
  "What was your first impression of me?",
  "What's your favorite physical feature of mine?",
  "What song reminds you of us?",
  "What's one thing you want us to do together someday?",
  "What makes you feel safe with me?",
  "What's the most romantic moment we've shared?",
  "What do you appreciate most about how I love you?",
  "What's something I do that always makes you smile?",
  "What's your favorite way to spend time with me?",
  "What do you think is our greatest strength as a couple?",
];

const SYSTEM_DARES = [
  "Send your partner a sweet message right now 💖",
  "Give your partner the longest hug (at least 30 seconds!)",
  "Whisper something sweet in your partner's ear",
  "Kiss your partner's forehead and tell them why they're special",
  "Look into your partner's eyes for 60 seconds without talking",
  "Dance slowly with your partner for one minute",
  "Write a short love note on your partner's hand",
  "Tell your partner 5 things you love about them",
  "Give your partner a gentle shoulder massage for 1 minute",
  "Serenade your partner with any love song",
  "Hold hands with your partner and share a wish for your future",
  "Take a cute selfie together right now",
  "Feed your partner something sweet (if available)",
  "Recreate your first kiss",
  "Give your partner butterfly kisses",
  "Create a heart shape with your hands together",
  "Slow dance to an imaginary song",
  "Tell your partner your favorite thing about their personality",
];

const TruthOrDare: React.FC = () => {
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId] = useState(() => Math.random().toString(36).substring(2, 8));
  const [playerName, setPlayerName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  
  // Custom questions setup
  const [customTruthInput, setCustomTruthInput] = useState('');
  const [customDareInput, setCustomDareInput] = useState('');
  const [myCustomQuestions, setMyCustomQuestions] = useState<CustomQuestion[]>([]);
  
  // Timer
  const [timeLeft, setTimeLeft] = useState(45);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    currentPlayerIndex: 0,
    turnPhase: 'showing_question',
    customQuestions: [],
    usedQuestions: [],
    roundCount: 0
  });
  
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number }[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const myPlayer = gameState.players.find(p => p.id === playerId);
  const partner = gameState.players.find(p => p.id !== playerId);

  const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  // Floating hearts animation
  const spawnHeart = useCallback(() => {
    const newHeart = { id: Date.now(), x: Math.random() * 100 };
    setFloatingHearts(prev => [...prev, newHeart]);
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 3000);
  }, []);

  // Timer logic
  useEffect(() => {
    if (mode === 'playing' && gameState.turnPhase === 'showing_question' && isMyTurn) {
      setTimeLeft(45);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
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

  const createRoom = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name 💕');
      return;
    }

    const code = generateRoomCode();
    const initialState: GameState = {
      players: [{ id: playerId, name: playerName, skipsLeft: 2 }],
      currentPlayerIndex: 0,
      turnPhase: 'showing_question',
      customQuestions: [],
      usedQuestions: [],
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
    setMode('setup');
    toast.success(`Room created! Add your custom questions 💖`);
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

    setRoomCode(inputCode.toUpperCase());
    setRoomId(data.id);
    setGameState(currentState);
    setPartnerName(currentState.players[0]?.name || '');
    setMode('setup');
    toast.success(`Joining ${currentState.players[0]?.name}'s room! Add your questions 💕`);
  };

  const addCustomQuestion = (type: 'truth' | 'dare') => {
    const input = type === 'truth' ? customTruthInput : customDareInput;
    if (!input.trim()) return;
    
    haptics.light();
    const newQuestion: CustomQuestion = { type, question: input.trim(), addedBy: playerName };
    setMyCustomQuestions(prev => [...prev, newQuestion]);
    
    if (type === 'truth') setCustomTruthInput('');
    else setCustomDareInput('');
    
    toast.success(`${type === 'truth' ? 'Truth' : 'Dare'} added! 💕`);
  };

  const removeCustomQuestion = (index: number) => {
    haptics.light();
    setMyCustomQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const finishSetupAndJoin = async () => {
    if (!roomId) return;
    
    haptics.success();
    
    const { data } = await supabase
      .from('game_rooms')
      .select('game_state, player_count')
      .eq('id', roomId)
      .single();
    
    if (!data) return;
    
    const currentState = JSON.parse(JSON.stringify(data.game_state)) as GameState;
    
    // Check if already in the game
    const alreadyJoined = currentState.players.some(p => p.id === playerId);
    const isJoiner = !alreadyJoined;
    
    if (!alreadyJoined) {
      currentState.players.push({ id: playerId, name: playerName, skipsLeft: 2 });
    }
    
    // Add custom questions
    currentState.customQuestions = [...currentState.customQuestions, ...myCustomQuestions];
    
    const shouldStart = currentState.players.length >= 2;
    
    // Pick first random question if starting
    if (shouldStart && !currentState.currentQuestion) {
      currentState.currentQuestion = getRandomQuestion(currentState);
    }
    
    await supabase
      .from('game_rooms')
      .update({
        game_state: JSON.parse(JSON.stringify(currentState)),
        player_count: currentState.players.length,
        status: shouldStart ? 'playing' : 'waiting'
      })
      .eq('id', roomId);

    // Use existing channel if available, otherwise create temp channel
    const broadcastChannel = channelRef.current || supabase.channel(`tod-${roomCode}`);
    
    if (!channelRef.current) {
      await broadcastChannel.subscribe();
    }
    
    // Broadcast player_joined event for instant host notification
    if (isJoiner) {
      await broadcastChannel.send({
        type: 'broadcast',
        event: 'player_joined',
        payload: { 
          playerId,
          playerName,
          timestamp: Date.now()
        }
      });
    }
    
    // Broadcast game update
    await broadcastChannel.send({
      type: 'broadcast',
      event: 'game_update',
      payload: { 
        gameState: currentState,
        status: shouldStart ? 'playing' : 'waiting'
      }
    });
    
    if (!channelRef.current) {
      supabase.removeChannel(broadcastChannel);
    }

    setGameState(currentState);
    setPartnerName(currentState.players.find(p => p.id !== playerId)?.name || '');
    setMode(shouldStart ? 'playing' : 'waiting');
    
    if (shouldStart) {
      celebrateHearts();
      toast.success('Game starting! Have fun, lovebirds! 💕');
    }
  };

  const getRandomQuestion = (state: GameState): { type: 'truth' | 'dare'; question: string } => {
    // Randomly pick truth or dare
    const type = Math.random() > 0.5 ? 'truth' : 'dare';
    
    // Combine custom and system questions
    const allQuestions = [
      ...state.customQuestions.filter(q => q.type === type).map(q => q.question),
      ...(type === 'truth' ? SYSTEM_TRUTHS : SYSTEM_DARES)
    ];
    
    // Filter out used questions
    const availableQuestions = allQuestions.filter(q => !state.usedQuestions.includes(q));
    
    // If all used, reset
    const questionsPool = availableQuestions.length > 0 ? availableQuestions : allQuestions;
    
    const question = questionsPool[Math.floor(Math.random() * questionsPool.length)];
    
    return { type, question };
  };

  // Realtime subscription - start from setup/waiting/playing modes
  useEffect(() => {
    if (!roomCode || (mode !== 'setup' && mode !== 'waiting' && mode !== 'playing')) return;

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
          
          // Transition to playing when game starts
          if (payload.status === 'playing' && (mode === 'waiting' || mode === 'setup')) {
            setMode('playing');
            celebrateHearts();
            haptics.success();
            toast.success('Your partner joined! Let the love game begin! 💕');
          }
          
          // Show reaction
          if (newState.reaction) {
            spawnHeart();
            if (newState.reaction === 'love') celebrateHearts();
          }
        }
      })
      .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
        // Instant notification when partner joins
        if (payload?.playerName && payload.playerId !== playerId) {
          setPartnerName(payload.playerName);
          toast.success(`${payload.playerName} joined! 💕`);
          haptics.success();
          
          // Refresh game state from server
          supabase
            .from('game_rooms')
            .select('game_state,status')
            .eq('room_code', roomCode)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                const newState = JSON.parse(JSON.stringify(data.game_state)) as GameState;
                setGameState(newState);
                if (data.status === 'playing' || newState.players.length >= 2) {
                  setMode('playing');
                  celebrateHearts();
                }
              }
            });
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Also listen to presence for backup detection
        if ((mode === 'waiting' || mode === 'setup') && newPresences.length > 0) {
          const otherPlayer = newPresences.find((p: any) => p.playerId !== playerId);
          if (otherPlayer) {
            supabase
              .from('game_rooms')
              .select('game_state,status')
              .eq('room_code', roomCode)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  const newState = JSON.parse(JSON.stringify(data.game_state)) as GameState;
                  setGameState(newState);
                  setPartnerName(newState.players.find(p => p.id !== playerId)?.name || '');
                  if (data.status === 'playing' || newState.players.length >= 2) {
                    setMode('playing');
                    celebrateHearts();
                    haptics.success();
                    toast.success('Your partner joined! 💕');
                  }
                }
              });
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ playerId, playerName, joined_at: Date.now() });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, mode, playerId, playerName, spawnHeart]);

  const confirmDone = async () => {
    if (!roomId) return;
    haptics.success();
    
    const newState: GameState = {
      ...gameState,
      turnPhase: 'waiting_confirmation'
    };
    
    await updateAndBroadcast(newState);
    toast.success('Waiting for your partner to confirm! 💕');
  };

  const skipQuestion = async () => {
    if (!roomId || !myPlayer || myPlayer.skipsLeft <= 0) return;
    haptics.medium();
    
    const updatedPlayers = gameState.players.map(p => 
      p.id === playerId ? { ...p, skipsLeft: p.skipsLeft - 1 } : p
    );
    
    const newQuestion = getRandomQuestion(gameState);
    
    const newState: GameState = {
      ...gameState,
      players: updatedPlayers,
      currentQuestion: newQuestion,
      usedQuestions: gameState.currentQuestion 
        ? [...gameState.usedQuestions, gameState.currentQuestion.question]
        : gameState.usedQuestions
    };
    
    await updateAndBroadcast(newState);
    toast.info(`Skipped! ${myPlayer.skipsLeft - 1} skips left 💭`);
  };

  const confirmCompletion = async (reaction: string) => {
    if (!roomId) return;
    haptics.success();
    
    const newQuestion = getRandomQuestion(gameState);
    const nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    
    const newState: GameState = {
      ...gameState,
      currentPlayerIndex: nextIndex,
      currentQuestion: newQuestion,
      turnPhase: 'showing_question',
      usedQuestions: gameState.currentQuestion 
        ? [...gameState.usedQuestions, gameState.currentQuestion.question]
        : gameState.usedQuestions,
      reaction,
      roundCount: gameState.roundCount + 1
    };
    
    await updateAndBroadcast(newState);
    
    if (reaction === 'love') {
      celebrateHearts();
      toast.success('So much love! 😍💕');
    } else {
      spawnHeart();
      toast.success('Aww, how cute! 😊💖');
    }
  };

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
    setMyCustomQuestions([]);
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
          <p className="text-sm text-muted-foreground mb-4">
            Create a private room for you and your partner. Add custom questions and enjoy romantic moments together!
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

  // Setup - Add custom questions
  if (mode === 'setup') {
    return (
      <div className="space-y-6 px-4 py-6 max-w-md mx-auto">
        <div className="text-center space-y-2">
          <h3 className="font-orbitron text-xl">Add Your Questions 💕</h3>
          <p className="text-muted-foreground text-sm">
            Optional: Add custom romantic questions for your partner!
          </p>
          
          {roomCode && (
            <button
              onClick={copyRoomCode}
              className="flex items-center justify-center gap-2 mx-auto mt-2 px-4 py-2 bg-pink-500/10 rounded-full border border-pink-500/30"
            >
              <span className="font-mono text-lg tracking-widest text-pink-400">{roomCode}</span>
              <Copy className="w-4 h-4 text-pink-400" />
            </button>
          )}
        </div>

        {/* Add Truth */}
        <div className="space-y-2">
          <label className="text-sm text-pink-400 font-medium">Add a Truth 💭</label>
          <div className="flex gap-2">
            <Input
              value={customTruthInput}
              onChange={(e) => setCustomTruthInput(e.target.value)}
              placeholder="e.g., What do you love most about us?"
              className="flex-1 bg-background/50 border-pink-500/30"
            />
            <Button
              onClick={() => addCustomQuestion('truth')}
              disabled={!customTruthInput.trim()}
              size="icon"
              className="bg-pink-500/20 border border-pink-500 text-pink-500 hover:bg-pink-500/30"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Add Dare */}
        <div className="space-y-2">
          <label className="text-sm text-red-400 font-medium">Add a Dare 🔥</label>
          <div className="flex gap-2">
            <Input
              value={customDareInput}
              onChange={(e) => setCustomDareInput(e.target.value)}
              placeholder="e.g., Give me a long hug!"
              className="flex-1 bg-background/50 border-red-500/30"
            />
            <Button
              onClick={() => addCustomQuestion('dare')}
              disabled={!customDareInput.trim()}
              size="icon"
              className="bg-red-500/20 border border-red-500 text-red-500 hover:bg-red-500/30"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* My questions list */}
        {myCustomQuestions.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Your questions ({myCustomQuestions.length})</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {myCustomQuestions.map((q, i) => (
                <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${q.type === 'truth' ? 'bg-pink-500/10' : 'bg-red-500/10'}`}>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-background/50">
                    {q.type === 'truth' ? '💭' : '🔥'}
                  </span>
                  <span className="flex-1 text-sm truncate">{q.question}</span>
                  <Button
                    onClick={() => removeCustomQuestion(i)}
                    size="icon"
                    variant="ghost"
                    className="w-6 h-6"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={finishSetupAndJoin}
          className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white hover:from-pink-600 hover:to-red-600 py-6 text-lg"
        >
          <Play className="w-5 h-5 mr-2" />
          Ready to Play! 💕
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
            <span className="text-pink-400">{playerName}</span>
            <Heart className="w-4 h-4 text-pink-500" fill="currentColor" />
            <span className="text-pink-400">{partnerName || '...'}</span>
          </div>
        </div>
        <div className="w-8" />
      </div>

      {/* Turn indicator */}
      <div className={`text-center p-4 rounded-2xl ${isMyTurn ? 'bg-gradient-to-r from-pink-500/20 to-red-500/20 border border-pink-500/30' : 'bg-background/50 border border-border'}`}>
        <p className="text-lg font-medium">
          {isMyTurn ? "It's your turn, love! 💕" : `${currentPlayer?.name}'s turn 💭`}
        </p>
      </div>

      {/* Question Card */}
      {gameState.currentQuestion && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={`w-full p-6 rounded-3xl ${gameState.currentQuestion.type === 'truth' 
            ? 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-2 border-pink-500/30' 
            : 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-2 border-red-500/30'}`}
          >
            <div className="text-center mb-4">
              <span className={`text-4xl`}>
                {gameState.currentQuestion.type === 'truth' ? '💭' : '🔥'}
              </span>
              <h3 className={`font-orbitron text-xl mt-2 ${gameState.currentQuestion.type === 'truth' ? 'text-pink-400' : 'text-red-400'}`}>
                {gameState.currentQuestion.type.toUpperCase()}
              </h3>
            </div>
            
            <p className="text-lg text-center leading-relaxed">
              {gameState.currentQuestion.question}
            </p>
          </div>

          {/* Timer for current player */}
          {isMyTurn && gameState.turnPhase === 'showing_question' && (
            <div className="mt-4 flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className={timeLeft <= 10 ? 'text-red-400 animate-pulse' : ''}>{timeLeft}s</span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3 pb-4">
        {isMyTurn && gameState.turnPhase === 'showing_question' && (
          <>
            <Button
              onClick={confirmDone}
              className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white hover:from-pink-600 hover:to-red-600 py-6 text-lg"
            >
              <Check className="w-5 h-5 mr-2" />
              Done! 💕
            </Button>
            
            {myPlayer && myPlayer.skipsLeft > 0 && (
              <Button
                onClick={skipQuestion}
                variant="outline"
                className="w-full border-muted-foreground/30 text-muted-foreground py-4"
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Skip ({myPlayer.skipsLeft} left)
              </Button>
            )}
          </>
        )}

        {!isMyTurn && gameState.turnPhase === 'waiting_confirmation' && (
          <div className="space-y-3">
            <p className="text-center text-muted-foreground">Did {currentPlayer?.name} complete it?</p>
            <div className="flex gap-3">
              <Button
                onClick={() => confirmCompletion('blush')}
                className="flex-1 bg-pink-500/20 border border-pink-500 text-pink-500 hover:bg-pink-500/30 py-6"
              >
                😊 Cute!
              </Button>
              <Button
                onClick={() => confirmCompletion('love')}
                className="flex-1 bg-gradient-to-r from-pink-500 to-red-500 text-white hover:from-pink-600 hover:to-red-600 py-6"
              >
                😍 Love it!
              </Button>
            </div>
          </div>
        )}

        {!isMyTurn && gameState.turnPhase === 'showing_question' && (
          <div className="text-center p-4 bg-background/50 rounded-xl border border-border">
            <p className="text-muted-foreground">
              Waiting for {currentPlayer?.name} to complete... 💕
            </p>
          </div>
        )}

        {isMyTurn && gameState.turnPhase === 'waiting_confirmation' && (
          <div className="text-center p-4 bg-background/50 rounded-xl border border-border">
            <p className="text-muted-foreground animate-pulse">
              Waiting for {partner?.name} to confirm... 💕
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TruthOrDare;
