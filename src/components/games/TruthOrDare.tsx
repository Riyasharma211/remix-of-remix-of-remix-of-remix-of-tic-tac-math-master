import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Heart, Copy, Users, ArrowLeft, Sparkles, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptics } from '@/utils/haptics';
import { RealtimeChannel } from '@supabase/supabase-js';
import { celebrateHearts } from '@/utils/confetti';
import { validatePlayerName, validateRoomCode, validateQuestion, validateAnswer } from '@/utils/gameValidation';

type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'playing';

// Chat message types
interface ChatMessage {
  id: string;
  sender: 'system' | 'player1' | 'player2';
  senderName?: string;
  type: 'text' | 'buttons' | 'input' | 'result';
  content: {
    text?: string;
    subtext?: string;
    buttons?: { label: string; value: string; icon?: string; variant?: 'truth' | 'dare' | 'end' | 'default' }[];
    inputPlaceholder?: string;
    inputAction?: string;
    question?: string;
    answer?: string;
    answeredBy?: string;
    questionType?: 'truth' | 'dare';
  };
  disabled?: boolean;
  timestamp: number;
}

interface GameState {
  players: { id: string; name: string; skipsLeft: number }[];
  currentPlayerIndex: number;
  currentType?: 'truth' | 'dare';
  roundCount: number;
  truthCount: number;
  dareCount: number;
}

// Real-time event types
type GameEvent = 
  | { type: 'chat_message'; message: ChatMessage; gameState: GameState }
  | { type: 'player_joined'; playerId: string; playerName: string; gameState: GameState }
  | { type: 'typing'; playerId: string };

const TruthOrDare: React.FC = () => {
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId] = useState(() => Math.random().toString(36).substring(2, 8));
  const [playerName, setPlayerName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentInputAction, setCurrentInputAction] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    currentPlayerIndex: 0,
    roundCount: 0,
    truthCount: 0,
    dareCount: 0
  });
  
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number }[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const myPlayerIndex = gameState.players.findIndex(p => p.id === playerId);

  const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // Floating hearts animation
  const spawnHeart = useCallback(() => {
    const newHeart = { id: Date.now(), x: Math.random() * 100 };
    setFloatingHearts(prev => [...prev, newHeart]);
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 3000);
  }, []);

  // Create initial turn message
  const createTurnMessage = (playerName: string, truthCount: number, dareCount: number, isCurrentPlayer: boolean): ChatMessage => ({
    id: generateMessageId(),
    sender: 'system',
    type: 'buttons',
    content: {
      text: `🎭 ${playerName}'s Turn`,
      subtext: `Truths: ${truthCount} | Dares: ${dareCount}`,
      buttons: isCurrentPlayer ? [
        { label: '💬 Truth', value: 'truth', variant: 'truth' },
        { label: '🔥 Dare', value: 'dare', variant: 'dare' },
        { label: '🏁 End Game', value: 'end', variant: 'end' }
      ] : undefined
    },
    timestamp: Date.now()
  });

  // Create input request message
  const createInputMessage = (questionType: 'truth' | 'dare', targetPlayerName: string): ChatMessage => ({
    id: generateMessageId(),
    sender: 'system',
    type: 'input',
    content: {
      text: questionType === 'truth' ? '💬 TRUTH' : '🔥 DARE',
      subtext: `Type your ${questionType} ${questionType === 'truth' ? 'question' : 'challenge'} for ${targetPlayerName}:`,
      inputPlaceholder: questionType === 'truth' 
        ? 'Ask something romantic or deep...' 
        : 'Give a fun dare (keep it loving!)...',
      inputAction: 'submit_question'
    },
    timestamp: Date.now()
  });

  // Create question display message
  const createQuestionMessage = (questionType: 'truth' | 'dare', question: string, askerName: string): ChatMessage => ({
    id: generateMessageId(),
    sender: 'system',
    type: 'input',
    content: {
      text: questionType === 'truth' ? '💬 TRUTH QUESTION' : '🔥 DARE CHALLENGE',
      subtext: `From ${askerName}:`,
      question: question,
      inputPlaceholder: questionType === 'truth' ? 'Type your answer...' : undefined,
      inputAction: questionType === 'truth' ? 'submit_answer' : 'complete_dare',
      questionType
    },
    timestamp: Date.now()
  });

  // Create result message
  const createResultMessage = (questionType: 'truth' | 'dare', question: string, answer: string, answeredBy: string): ChatMessage => ({
    id: generateMessageId(),
    sender: 'system',
    type: 'result',
    content: {
      text: questionType === 'truth' ? '💬 TRUTH RESULT' : '🔥 DARE COMPLETED',
      question,
      answer,
      answeredBy,
      questionType
    },
    timestamp: Date.now()
  });

  // Handle button click
  const handleButtonClick = async (buttonValue: string, messageId: string) => {
    if (isSubmitting) return;
    haptics.light();
    setIsSubmitting(true);

    // Disable the clicked message's buttons
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, disabled: true } : msg
    ));

    if (buttonValue === 'truth' || buttonValue === 'dare') {
      const newState: GameState = {
        ...gameState,
        currentType: buttonValue as 'truth' | 'dare'
      };

      // Add player's choice message
      const choiceMessage: ChatMessage = {
        id: generateMessageId(),
        sender: myPlayerIndex === 0 ? 'player1' : 'player2',
        senderName: playerName,
        type: 'text',
        content: {
          text: buttonValue === 'truth' ? '💬 I choose TRUTH!' : '🔥 I choose DARE!'
        },
        timestamp: Date.now()
      };

      // Create input message for opponent
      const partner = gameState.players.find(p => p.id !== playerId);
      const inputMessage = createInputMessage(buttonValue as 'truth' | 'dare', currentPlayer?.name || '');

      const newMessages = [choiceMessage, inputMessage];
      setMessages(prev => [...prev, ...newMessages]);
      setCurrentInputAction('submit_question');
      setGameState(newState);

      await broadcastChatUpdate(newMessages, newState);
    } else if (buttonValue === 'end') {
      await leaveGame();
    }

    setIsSubmitting(false);
  };

  // Handle input submit
  const handleInputSubmit = async () => {
    if (!inputValue.trim() || isSubmitting) return;
    
    haptics.light();
    setIsSubmitting(true);

    if (currentInputAction === 'submit_question') {
      const validation = validateQuestion(inputValue);
      if (!validation.success) {
        toast.error(validation.error || 'Invalid question');
        setIsSubmitting(false);
        return;
      }

      // Add opponent's question message
      const questionMessage: ChatMessage = {
        id: generateMessageId(),
        sender: myPlayerIndex === 0 ? 'player1' : 'player2',
        senderName: playerName,
        type: 'text',
        content: {
          text: validation.value!
        },
        timestamp: Date.now()
      };

      // Create answer input for current player
      const answerInputMessage = createQuestionMessage(
        gameState.currentType!,
        validation.value!,
        playerName
      );

      const newMessages = [questionMessage, answerInputMessage];
      setMessages(prev => [...prev, ...newMessages]);
      setCurrentInputAction(gameState.currentType === 'truth' ? 'submit_answer' : 'complete_dare');
      setInputValue('');

      await broadcastChatUpdate(newMessages, gameState);
      toast.success('Sent! 💕');
    } else if (currentInputAction === 'submit_answer') {
      const validation = validateAnswer(inputValue);
      if (!validation.success) {
        toast.error(validation.error || 'Invalid answer');
        setIsSubmitting(false);
        return;
      }

      celebrateHearts();

      // Find the question from previous messages
      const questionMsg = [...messages].reverse().find(m => m.content.question);
      const question = questionMsg?.content.question || '';

      // Add answer message
      const answerMessage: ChatMessage = {
        id: generateMessageId(),
        sender: myPlayerIndex === 0 ? 'player1' : 'player2',
        senderName: playerName,
        type: 'text',
        content: {
          text: validation.value!
        },
        timestamp: Date.now()
      };

      // Create result message
      const resultMessage = createResultMessage(
        gameState.currentType!,
        question,
        validation.value!,
        playerName
      );

      // Create next turn message
      const nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
      const nextPlayer = gameState.players[nextIndex];
      const newState: GameState = {
        ...gameState,
        currentPlayerIndex: nextIndex,
        currentType: undefined,
        roundCount: gameState.roundCount + 1,
        truthCount: gameState.currentType === 'truth' ? gameState.truthCount + 1 : gameState.truthCount,
        dareCount: gameState.currentType === 'dare' ? gameState.dareCount + 1 : gameState.dareCount
      };

      const turnMessage = createTurnMessage(
        nextPlayer?.name || '',
        newState.truthCount,
        newState.dareCount,
        nextPlayer?.id === playerId
      );

      const newMessages = [answerMessage, resultMessage, turnMessage];
      setMessages(prev => [...prev, ...newMessages]);
      setCurrentInputAction(null);
      setInputValue('');
      setGameState(newState);

      await broadcastChatUpdate(newMessages, newState);
    }

    setIsSubmitting(false);
  };

  // Handle dare completion
  const handleDareComplete = async () => {
    if (isSubmitting) return;
    haptics.success();
    setIsSubmitting(true);
    celebrateHearts();

    // Find the question from previous messages
    const questionMsg = [...messages].reverse().find(m => m.content.question);
    const question = questionMsg?.content.question || '';

    // Add completion message
    const completionMessage: ChatMessage = {
      id: generateMessageId(),
      sender: myPlayerIndex === 0 ? 'player1' : 'player2',
      senderName: playerName,
      type: 'text',
      content: {
        text: '✅ Done! I completed the dare!'
      },
      timestamp: Date.now()
    };

    // Create result message
    const resultMessage = createResultMessage(
      'dare',
      question,
      '✅ Dare completed!',
      playerName
    );

    // Create next turn message
    const nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    const nextPlayer = gameState.players[nextIndex];
    const newState: GameState = {
      ...gameState,
      currentPlayerIndex: nextIndex,
      currentType: undefined,
      roundCount: gameState.roundCount + 1,
      dareCount: gameState.dareCount + 1
    };

    const turnMessage = createTurnMessage(
      nextPlayer?.name || '',
      newState.truthCount,
      newState.dareCount,
      nextPlayer?.id === playerId
    );

    const newMessages = [completionMessage, resultMessage, turnMessage];
    setMessages(prev => [...prev, ...newMessages]);
    setCurrentInputAction(null);
    setGameState(newState);

    await broadcastChatUpdate(newMessages, newState);
    setIsSubmitting(false);
  };

  // Broadcast chat update
  const broadcastChatUpdate = async (newMessages: ChatMessage[], newState: GameState) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'chat_message',
      payload: { messages: newMessages, gameState: newState }
    });

    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);
  };

  // Broadcast typing
  const broadcastTyping = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { playerId }
    });
  }, [playerId]);

  const handleInputChange = (value: string) => {
    if (value.length <= 300) {
      setInputValue(value);
      broadcastTyping();
    }
  };

  const createRoom = async () => {
    const validation = validatePlayerName(playerName);
    if (!validation.success) {
      toast.error(validation.error || 'Invalid name');
      return;
    }

    const code = generateRoomCode();
    const initialState: GameState = {
      players: [{ id: playerId, name: validation.value!, skipsLeft: 2 }],
      currentPlayerIndex: 0,
      roundCount: 0,
      truthCount: 0,
      dareCount: 0
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
    haptics.success();
    toast.success('Room created! Share code with your love 💖');
  };

  const joinRoom = async () => {
    const nameValidation = validatePlayerName(playerName);
    if (!nameValidation.success) {
      toast.error(nameValidation.error || 'Invalid name');
      return;
    }

    const codeValidation = validateRoomCode(inputCode);
    if (!codeValidation.success) {
      toast.error(codeValidation.error || 'Invalid code');
      return;
    }

    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('room_code', codeValidation.value!)
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
    currentState.players.push({ id: playerId, name: nameValidation.value!, skipsLeft: 2 });

    await supabase
      .from('game_rooms')
      .update({
        game_state: JSON.parse(JSON.stringify(currentState)),
        player_count: 2,
        status: 'playing'
      })
      .eq('id', data.id);

    setRoomCode(codeValidation.value!);
    setRoomId(data.id);
    setGameState(currentState);
    setPartnerName(currentState.players[0]?.name || '');

    // Create initial messages
    const welcomeMessage: ChatMessage = {
      id: generateMessageId(),
      sender: 'system',
      type: 'text',
      content: {
        text: `💕 Welcome to Couples Truth & Dare!`,
        subtext: `${currentState.players[0]?.name} ❤️ ${nameValidation.value!}`
      },
      timestamp: Date.now()
    };

    const turnMessage = createTurnMessage(
      currentState.players[0]?.name || '',
      0,
      0,
      currentState.players[0]?.id === playerId
    );

    setMessages([welcomeMessage, turnMessage]);
    setMode('playing');

    // Broadcast join event
    const channel = supabase.channel(`tod-${codeValidation.value!}`);
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'player_joined',
      payload: { 
        playerId, 
        playerName: nameValidation.value!, 
        gameState: currentState,
        initialMessages: [welcomeMessage, turnMessage]
      }
    });
    supabase.removeChannel(channel);

    celebrateHearts();
    haptics.success();
    toast.success(`Joined ${currentState.players[0]?.name}'s room! Let's play 💕`);
  };

  // Realtime subscription
  useEffect(() => {
    if (!roomCode || (mode !== 'waiting' && mode !== 'playing')) return;

    const channel = supabase
      .channel(`tod-${roomCode}`, {
        config: { broadcast: { self: false } }
      })
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        if (payload?.messages) {
          const newMessages = payload.messages as ChatMessage[];
          // Adjust sender perspective and check for buttons
          const adjustedMessages = newMessages.map(msg => {
            // If it's a turn message with buttons, only show buttons to current player
            if (msg.type === 'buttons' && msg.content.buttons) {
              const newState = payload.gameState as GameState;
              const nextPlayer = newState.players[newState.currentPlayerIndex];
              const isMyTurnNow = nextPlayer?.id === playerId;
              return {
                ...msg,
                content: {
                  ...msg.content,
                  buttons: isMyTurnNow ? msg.content.buttons : undefined
                }
              };
            }
            return msg;
          });
          
          setMessages(prev => [...prev, ...adjustedMessages]);
          setPartnerIsTyping(false);

          // Update input action based on last input message
          const lastInputMsg = [...adjustedMessages].reverse().find(m => m.type === 'input');
          if (lastInputMsg?.content.inputAction) {
            const newState = payload.gameState as GameState;
            const currentP = newState.players[newState.currentPlayerIndex];
            // Only set input action if it's relevant to current player
            if (lastInputMsg.content.inputAction === 'submit_question' && currentP?.id !== playerId) {
              setCurrentInputAction('submit_question');
            } else if ((lastInputMsg.content.inputAction === 'submit_answer' || lastInputMsg.content.inputAction === 'complete_dare') && currentP?.id === playerId) {
              setCurrentInputAction(lastInputMsg.content.inputAction);
            } else {
              setCurrentInputAction(null);
            }
          }
        }
        if (payload?.gameState) {
          setGameState(payload.gameState);
        }
      })
      .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
        if (payload?.playerName && payload.playerId !== playerId) {
          setPartnerName(payload.playerName);
          if (payload.gameState) {
            setGameState(payload.gameState);
          }
          if (payload.initialMessages) {
            setMessages(payload.initialMessages);
          }
          setMode('playing');
          celebrateHearts();
          haptics.success();
          toast.success(`${payload.playerName} joined! Let the love begin! 💕`);
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.playerId !== playerId) {
          setPartnerIsTyping(true);
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setPartnerIsTyping(false);
          }, 2000);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [roomCode, mode, playerId]);

  const leaveGame = async () => {
    if (roomId) {
      await supabase.from('game_rooms').delete().eq('id', roomId);
    }
    setMode('menu');
    setRoomId(null);
    setRoomCode('');
    setPlayerName('');
    setPartnerName('');
    setMessages([]);
    setInputValue('');
    setCurrentInputAction(null);
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

  // Render a single chat message
  const renderMessage = (msg: ChatMessage) => {
    const isSystem = msg.sender === 'system';
    const isMe = (msg.sender === 'player1' && myPlayerIndex === 0) || (msg.sender === 'player2' && myPlayerIndex === 1);
    
    return (
      <div
        key={msg.id}
        className={`animate-slide-up ${isSystem ? 'flex justify-center' : isMe ? 'flex justify-end' : 'flex justify-start'}`}
      >
        <div className={`max-w-[85%] ${isSystem ? 'w-full' : ''}`}>
          {/* Sender name for player messages */}
          {!isSystem && msg.senderName && (
            <p className={`text-xs text-muted-foreground mb-1 ${isMe ? 'text-right' : 'text-left'}`}>
              {msg.senderName}
            </p>
          )}
          
          {/* Message bubble */}
          <div className={`rounded-2xl p-4 ${
            isSystem 
              ? 'bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20' 
              : isMe 
                ? 'bg-gradient-to-br from-pink-500 to-red-500 text-white' 
                : 'bg-muted'
          }`}>
            {/* Text message */}
            {msg.type === 'text' && (
              <div>
                <p className="text-base">{msg.content.text}</p>
                {msg.content.subtext && (
                  <p className={`text-sm mt-1 ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {msg.content.subtext}
                  </p>
                )}
              </div>
            )}

            {/* Buttons message */}
            {msg.type === 'buttons' && (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-lg font-semibold">{msg.content.text}</p>
                  {msg.content.subtext && (
                    <p className="text-sm text-muted-foreground">{msg.content.subtext}</p>
                  )}
                </div>
                {msg.content.buttons && !msg.disabled && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {msg.content.buttons.map(btn => (
                      <Button
                        key={btn.value}
                        onClick={() => handleButtonClick(btn.value, msg.id)}
                        disabled={isSubmitting}
                        className={`px-6 py-5 text-base transition-all hover:scale-105 ${
                          btn.variant === 'truth' 
                            ? 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600' 
                            : btn.variant === 'dare'
                              ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                              : btn.variant === 'end'
                                ? 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                : 'bg-primary hover:bg-primary/90'
                        }`}
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : btn.label}
                      </Button>
                    ))}
                  </div>
                )}
                {msg.disabled && (
                  <p className="text-center text-sm text-muted-foreground">Choice made ✓</p>
                )}
              </div>
            )}

            {/* Input message */}
            {msg.type === 'input' && (
              <div className="space-y-3">
                <div className="text-center">
                  <p className={`text-lg font-semibold ${
                    msg.content.text?.includes('TRUTH') ? 'text-pink-400' : 'text-orange-400'
                  }`}>{msg.content.text}</p>
                  {msg.content.subtext && (
                    <p className="text-sm text-muted-foreground">{msg.content.subtext}</p>
                  )}
                </div>
                {msg.content.question && (
                  <div className={`p-4 rounded-xl ${
                    msg.content.questionType === 'truth' 
                      ? 'bg-pink-500/20 border border-pink-500/30' 
                      : 'bg-orange-500/20 border border-orange-500/30'
                  }`}>
                    <p className="text-center text-lg">{msg.content.question}</p>
                  </div>
                )}
              </div>
            )}

            {/* Result message */}
            {msg.type === 'result' && (
              <div className="space-y-4">
                <div className="text-center">
                  <span className="text-3xl">💕</span>
                  <p className={`text-lg font-semibold mt-2 ${
                    msg.content.questionType === 'truth' ? 'text-pink-400' : 'text-orange-400'
                  }`}>{msg.content.text}</p>
                </div>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground mb-1">Question:</p>
                    <p>{msg.content.question}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30">
                    <p className="text-xs text-green-400 mb-1">{msg.content.answeredBy}'s Answer:</p>
                    <p className="text-lg">{msg.content.answer}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Should show input bar
  const shouldShowInput = currentInputAction && (
    (currentInputAction === 'submit_question' && !isMyTurn) ||
    (currentInputAction === 'submit_answer' && isMyTurn) ||
    (currentInputAction === 'complete_dare' && isMyTurn)
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
            Chat-style gameplay! Write questions for each other in real-time 💖
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
          maxLength={30}
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
          onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 4))}
          placeholder="Room Code"
          maxLength={4}
          className="w-full text-center text-3xl tracking-[0.5em] bg-background/50 border-pink-500/30 py-6 font-mono"
        />
        
        <Input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Your name..."
          maxLength={30}
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

  // Chat-style gameplay
  return (
    <div className="flex flex-col h-[calc(100dvh-120px)] max-w-md mx-auto">
      {renderFloatingHearts()}
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/50 backdrop-blur-sm">
        <Button variant="ghost" size="sm" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <div className="flex items-center gap-2">
            <span className={isMyTurn ? 'text-pink-400 font-bold' : 'text-muted-foreground'}>{playerName}</span>
            <Heart className="w-4 h-4 text-pink-500" fill="currentColor" />
            <span className={!isMyTurn ? 'text-pink-400 font-bold' : 'text-muted-foreground'}>{partnerName || '...'}</span>
          </div>
          <p className="text-xs text-muted-foreground">Round {gameState.roundCount + 1}</p>
        </div>
        <div className="w-8" />
      </div>

      {/* Chat messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map(msg => renderMessage(msg))}
        
        {/* Typing indicator */}
        {partnerIsTyping && (
          <div className="flex justify-start animate-slide-up">
            <div className="bg-muted rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{partnerName} is typing</span>
                <span className="flex gap-1">
                  <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      {shouldShowInput && (
        <div className="p-4 border-t border-border bg-background/50 backdrop-blur-sm animate-slide-up">
          {currentInputAction === 'complete_dare' ? (
            <Button
              onClick={handleDareComplete}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 py-6 text-lg"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : '✅'} 
              Mark Dare as Done!
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={
                  currentInputAction === 'submit_question' 
                    ? `Ask ${currentPlayer?.name} a ${gameState.currentType}...` 
                    : 'Type your answer...'
                }
                className="flex-1 bg-background border-pink-500/30"
                maxLength={300}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleInputSubmit()}
              />
              <Button
                onClick={handleInputSubmit}
                disabled={!inputValue.trim() || isSubmitting}
                className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 px-6"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-right mt-1">{inputValue.length}/300</p>
        </div>
      )}
    </div>
  );
};

export default TruthOrDare;
