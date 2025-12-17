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
  room_id?: string;
  sender: 'system' | 'player1' | 'player2';
  sender_name?: string;
  message_type: 'text' | 'buttons' | 'input' | 'result';
  content: {
    text?: string;
    subtext?: string;
    forPlayerId?: string; // Who should see the buttons
    buttons?: { label: string; value: string; icon?: string; variant?: 'truth' | 'dare' | 'end' | 'default' }[];
    inputPlaceholder?: string;
    inputAction?: string;
    question?: string;
    answer?: string;
    answeredBy?: string;
    questionType?: 'truth' | 'dare';
  };
  disabled?: boolean;
  created_at?: string;
}

interface GameState {
  players: { id: string; name: string; skipsLeft: number; points: number }[];
  currentPlayerIndex: number;
  currentType?: 'truth' | 'dare';
  roundCount: number;
  truthCount: number;
  dareCount: number;
}

// Points for actions
const POINTS = {
  TRUTH_ANSWERED: 10,
  DARE_COMPLETED: 20,
  SKIP_PENALTY: -5
};

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
  
  // Reactions state: { messageId: { emoji: [playerName1, playerName2] } }
  const [reactions, setReactions] = useState<Record<string, Record<string, string[]>>>({});
  
  // Dare timer state
  const [dareTimer, setDareTimer] = useState<number | null>(null);
  const dareTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const REACTION_EMOJIS = ['😍', '💕', '🔥', '😂', '😤'];
  const DARE_TIME_LIMIT = 60; // seconds

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const myPlayerIndex = gameState.players.findIndex(p => p.id === playerId);

  const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  // Auto-scroll to bottom with delay for DOM update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  // Dare timer - starts when player needs to complete a dare
  useEffect(() => {
    if (currentInputAction === 'complete_dare' && isMyTurn) {
      // Start 60 second countdown
      setDareTimer(DARE_TIME_LIMIT);
      
      dareTimerRef.current = setInterval(() => {
        setDareTimer(prev => {
          if (prev === null || prev <= 1) {
            // Time's up!
            if (dareTimerRef.current) {
              clearInterval(dareTimerRef.current);
              dareTimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (dareTimerRef.current) {
          clearInterval(dareTimerRef.current);
          dareTimerRef.current = null;
        }
      };
    } else {
      // Clear timer when not in dare mode
      if (dareTimerRef.current) {
        clearInterval(dareTimerRef.current);
        dareTimerRef.current = null;
      }
      setDareTimer(null);
    }
  }, [currentInputAction, isMyTurn]);

  // Floating hearts animation
  const spawnHeart = useCallback(() => {
    const newHeart = { id: Date.now(), x: Math.random() * 100 };
    setFloatingHearts(prev => [...prev, newHeart]);
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 3000);
  }, []);

  // Save message to database
  const saveMessage = async (msg: Omit<ChatMessage, 'id' | 'created_at'>, currentRoomId: string): Promise<ChatMessage | null> => {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: currentRoomId,
        sender: msg.sender,
        sender_name: msg.sender_name || null,
        message_type: msg.message_type,
        content: msg.content,
        disabled: msg.disabled || false
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save message:', error);
      return null;
    }

    return data as unknown as ChatMessage;
  };

  // Save multiple messages
  const saveMessages = async (msgs: Omit<ChatMessage, 'id' | 'created_at'>[], currentRoomId: string): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(msgs.map(msg => ({
        room_id: currentRoomId,
        sender: msg.sender,
        sender_name: msg.sender_name || null,
        message_type: msg.message_type,
        content: msg.content,
        disabled: msg.disabled || false
      })))
      .select();

    if (error) {
      console.error('Failed to save messages:', error);
      return [];
    }

    return (data || []) as unknown as ChatMessage[];
  };

  // Update message disabled state
  const updateMessageDisabled = async (messageId: string) => {
    await supabase
      .from('chat_messages')
      .update({ disabled: true })
      .eq('id', messageId);
  };

  // Load messages for a room
  const loadMessages = async (currentRoomId: string): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', currentRoomId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load messages:', error);
      return [];
    }

    return (data || []) as unknown as ChatMessage[];
  };

  // Create turn message content - now includes forPlayerId for reliable button display
  const createTurnMessageContent = (targetPlayerName: string, targetPlayerId: string, truthCount: number, dareCount: number, showButtons: boolean) => ({
    text: `🎭 ${targetPlayerName}'s Turn`,
    subtext: `Truths: ${truthCount} | Dares: ${dareCount}`,
    forPlayerId: targetPlayerId, // Explicitly specify who should see the buttons
    buttons: showButtons ? [
      { label: '💬 Truth', value: 'truth', variant: 'truth' as const },
      { label: '🔥 Dare', value: 'dare', variant: 'dare' as const },
      { label: '🏁 End Game', value: 'end', variant: 'end' as const }
    ] : undefined
  });

  // Handle button click
  const handleButtonClick = async (buttonValue: string, messageId: string) => {
    if (isSubmitting || !roomId) return;
    haptics.light();
    setIsSubmitting(true);

    // Disable the clicked message's buttons locally
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, disabled: true } : msg
    ));

    // Update in DB
    await updateMessageDisabled(messageId);

    if (buttonValue === 'truth' || buttonValue === 'dare') {
      const newState: GameState = {
        ...gameState,
        currentType: buttonValue as 'truth' | 'dare'
      };

      // Save choice message
      const choiceMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
        sender: myPlayerIndex === 0 ? 'player1' : 'player2',
        sender_name: playerName,
        message_type: 'text',
        content: {
          text: buttonValue === 'truth' ? '💬 I choose TRUTH!' : '🔥 I choose DARE!'
        }
      };

      // Save input prompt message for opponent - include questionType for sync
      const inputMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
        sender: 'system',
        message_type: 'input',
        content: {
          text: buttonValue === 'truth' ? '💬 TRUTH' : '🔥 DARE',
          subtext: `Type your ${buttonValue} ${buttonValue === 'truth' ? 'question' : 'challenge'} for ${currentPlayer?.name || ''}:`,
          inputPlaceholder: buttonValue === 'truth' 
            ? 'Ask something romantic or deep...' 
            : 'Give a fun dare (keep it loving!)...',
          inputAction: 'submit_question',
          questionType: buttonValue as 'truth' | 'dare'  // Store the type for sync
        }
      };

      await saveMessages([choiceMsg, inputMsg], roomId);
      setGameState(newState);
      setCurrentInputAction('submit_question');

      // Update game state in room
      await supabase
        .from('game_rooms')
        .update({ game_state: JSON.parse(JSON.stringify(newState)) })
        .eq('id', roomId);

      // Broadcast state change
      channelRef.current?.send({
        type: 'broadcast',
        event: 'game_state',
        payload: { gameState: newState }
      });

    } else if (buttonValue === 'end') {
      await leaveGame();
    }

    setIsSubmitting(false);
  };

  // Handle input submit
  const handleInputSubmit = async () => {
    if (!inputValue.trim() || isSubmitting || !roomId) return;
    
    haptics.light();
    setIsSubmitting(true);

    if (currentInputAction === 'submit_question') {
      const validation = validateQuestion(inputValue);
      if (!validation.success) {
        toast.error(validation.error || 'Invalid question');
        setIsSubmitting(false);
        return;
      }

      // Get questionType from the last input message (most reliable source)
      const lastInputMsg = [...messagesRef.current].reverse().find(m => m.message_type === 'input' && m.content.questionType);
      const questionType = lastInputMsg?.content.questionType || gameStateRef.current.currentType || 'truth';
      
      console.log('Submitting question, type:', questionType);

      // Save question message
      const questionMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
        sender: myPlayerIndex === 0 ? 'player1' : 'player2',
        sender_name: playerName,
        message_type: 'text',
        content: { text: validation.value! }
      };

      // Save answer input message for current player - use questionType from message
      const answerInputMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
        sender: 'system',
        message_type: 'input',
        content: {
          text: questionType === 'truth' ? '💬 TRUTH QUESTION' : '🔥 DARE CHALLENGE',
          subtext: `From ${playerName}:`,
          question: validation.value!,
          inputPlaceholder: questionType === 'truth' ? 'Type your answer...' : undefined,
          inputAction: questionType === 'truth' ? 'submit_answer' : 'complete_dare',
          questionType: questionType
        }
      };

      await saveMessages([questionMsg, answerInputMsg], roomId);
      setCurrentInputAction(questionType === 'truth' ? 'submit_answer' : 'complete_dare');
      setInputValue('');
      toast.success('Sent! 💕');

    } else if (currentInputAction === 'submit_answer') {
      const validation = validateAnswer(inputValue);
      if (!validation.success) {
        toast.error(validation.error || 'Invalid answer');
        setIsSubmitting(false);
        return;
      }

      celebrateHearts();

      // Find the question from previous messages and get the type
      const questionMsg = [...messagesRef.current].reverse().find(m => m.content.question);
      const question = questionMsg?.content.question || '';
      const questionType = questionMsg?.content.questionType || 'truth';

      console.log('Submitting answer, type:', questionType);

      // Save answer message
      const answerMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
        sender: myPlayerIndex === 0 ? 'player1' : 'player2',
        sender_name: playerName,
        message_type: 'text',
        content: { text: validation.value! }
      };

      // Save result message - use questionType from message
      const resultMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
        sender: 'system',
        message_type: 'result',
        content: {
          text: questionType === 'truth' ? '💬 TRUTH RESULT' : '🔥 DARE COMPLETED',
          question,
          answer: validation.value!,
          answeredBy: playerName,
          questionType: questionType
        }
      };

      // Create next turn - use refs for latest state
      const currentState = gameStateRef.current;
      const nextIndex = (currentState.currentPlayerIndex + 1) % currentState.players.length;
      const nextPlayer = currentState.players[nextIndex];
      
      // Add points for answering truth
      const updatedPlayers = currentState.players.map((p, idx) => 
        idx === myPlayerIndex ? { ...p, points: p.points + POINTS.TRUTH_ANSWERED } : p
      );
      
      const newState: GameState = {
        ...currentState,
        players: updatedPlayers,
        currentPlayerIndex: nextIndex,
        currentType: undefined,
        roundCount: currentState.roundCount + 1,
        truthCount: questionType === 'truth' ? currentState.truthCount + 1 : currentState.truthCount,
        dareCount: questionType === 'dare' ? currentState.dareCount + 1 : currentState.dareCount
      };

      // Save turn message - buttons only for next player
      const turnMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
        sender: 'system',
        message_type: 'buttons',
        content: createTurnMessageContent(
          nextPlayer?.name || '',
          nextPlayer?.id || '',
          newState.truthCount,
          newState.dareCount,
          true
        )
      };

      await saveMessages([answerMsg, resultMsg, turnMsg], roomId);
      setCurrentInputAction(null);
      setInputValue('');
      setGameState(newState);

      // Update game state in room
      await supabase
        .from('game_rooms')
        .update({ game_state: JSON.parse(JSON.stringify(newState)) })
        .eq('id', roomId);

      // Broadcast state change
      channelRef.current?.send({
        type: 'broadcast',
        event: 'game_state',
        payload: { gameState: newState }
      });
    }

    setIsSubmitting(false);
  };

  // Handle dare completion
  const handleDareComplete = async () => {
    if (isSubmitting || !roomId) return;
    haptics.success();
    setIsSubmitting(true);
    celebrateHearts();

    // Find the question from previous messages
    const questionMsg = [...messagesRef.current].reverse().find(m => m.content.question);
    const question = questionMsg?.content.question || '';

    // Save completion message
    const completionMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
      sender: myPlayerIndex === 0 ? 'player1' : 'player2',
      sender_name: playerName,
      message_type: 'text',
      content: { text: '✅ Done! I completed the dare!' }
    };

    // Save result message
    const resultMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
      sender: 'system',
      message_type: 'result',
      content: {
        text: '🔥 DARE COMPLETED',
        question,
        answer: '✅ Dare completed!',
        answeredBy: playerName,
        questionType: 'dare'
      }
    };

    // Create next turn - use refs for latest state
    const currentState = gameStateRef.current;
    const nextIndex = (currentState.currentPlayerIndex + 1) % currentState.players.length;
    const nextPlayer = currentState.players[nextIndex];
    
    // Add points for completing dare and stop timer
    const updatedPlayers = currentState.players.map((p, idx) => 
      idx === myPlayerIndex ? { ...p, points: p.points + POINTS.DARE_COMPLETED } : p
    );
    
    // Clear dare timer
    if (dareTimerRef.current) {
      clearInterval(dareTimerRef.current);
      dareTimerRef.current = null;
    }
    setDareTimer(null);
    
    const newState: GameState = {
      ...currentState,
      players: updatedPlayers,
      currentPlayerIndex: nextIndex,
      currentType: undefined,
      roundCount: currentState.roundCount + 1,
      dareCount: currentState.dareCount + 1
    };

    // Save turn message
    const turnMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
      sender: 'system',
      message_type: 'buttons',
      content: createTurnMessageContent(
        nextPlayer?.name || '',
        nextPlayer?.id || '',
        newState.truthCount,
        newState.dareCount,
        true
      )
    };

    await saveMessages([completionMsg, resultMsg, turnMsg], roomId);
    setCurrentInputAction(null);
    setGameState(newState);

    // Update game state in room
    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);

    // Broadcast state change
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_state',
      payload: { gameState: newState }
    });

    setIsSubmitting(false);
  };

  // Handle skip question/dare
  const handleSkip = async () => {
    if (isSubmitting || !roomId) return;
    
    const currentState = gameStateRef.current;
    const currentPlayerData = currentState.players[myPlayerIndex];
    
    if (!currentPlayerData || currentPlayerData.skipsLeft <= 0) {
      toast.error("No skips left! You must answer or complete the dare.");
      return;
    }
    
    haptics.medium();
    setIsSubmitting(true);

    // Find the question from previous messages
    const questionMsg = [...messagesRef.current].reverse().find(m => m.content.question);
    const question = questionMsg?.content.question || '';
    const questionType = questionMsg?.content.questionType || 'truth';

    // Save skip message
    const skipMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
      sender: myPlayerIndex === 0 ? 'player1' : 'player2',
      sender_name: playerName,
      message_type: 'text',
      content: { text: '⏭️ I skip this one!' }
    };

    // Save result message
    const resultMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
      sender: 'system',
      message_type: 'result',
      content: {
        text: '⏭️ SKIPPED',
        question,
        answer: `${playerName} used a skip (${currentPlayerData.skipsLeft - 1} left)`,
        answeredBy: playerName,
        questionType: questionType
      }
    };

    // Create next turn with updated skips
    const nextIndex = (currentState.currentPlayerIndex + 1) % currentState.players.length;
    const nextPlayer = currentState.players[nextIndex];
    
    // Update current player's skipsLeft and deduct points
    const updatedPlayers = currentState.players.map((p, idx) => 
      idx === myPlayerIndex ? { ...p, skipsLeft: p.skipsLeft - 1, points: Math.max(0, p.points + POINTS.SKIP_PENALTY) } : p
    );
    
    // Clear dare timer if skipping a dare
    if (dareTimerRef.current) {
      clearInterval(dareTimerRef.current);
      dareTimerRef.current = null;
    }
    setDareTimer(null);
    
    const newState: GameState = {
      ...currentState,
      players: updatedPlayers,
      currentPlayerIndex: nextIndex,
      currentType: undefined,
      roundCount: currentState.roundCount + 1
    };

    // Save turn message
    const turnMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
      sender: 'system',
      message_type: 'buttons',
      content: createTurnMessageContent(
        nextPlayer?.name || '',
        nextPlayer?.id || '',
        newState.truthCount,
        newState.dareCount,
        true
      )
    };

    await saveMessages([skipMsg, resultMsg, turnMsg], roomId);
    setCurrentInputAction(null);
    setInputValue('');
    setGameState(newState);

    // Update game state in room
    await supabase
      .from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId);

    // Broadcast state change
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_state',
      payload: { gameState: newState }
    });

    setIsSubmitting(false);
    toast.success("Skipped! Your turn passes to your partner 💫");
  };

  // Broadcast typing
  const broadcastTyping = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { playerId }
    });
  }, [playerId]);

  // Send reaction
  const sendReaction = (messageId: string, emoji: string) => {
    haptics.light();
    
    // Update local state immediately
    setReactions(prev => {
      const msgReactions = prev[messageId] || {};
      const emojiReactors = msgReactions[emoji] || [];
      
      // Toggle reaction
      if (emojiReactors.includes(playerName)) {
        // Remove reaction
        return {
          ...prev,
          [messageId]: {
            ...msgReactions,
            [emoji]: emojiReactors.filter(name => name !== playerName)
          }
        };
      } else {
        // Add reaction
        return {
          ...prev,
          [messageId]: {
            ...msgReactions,
            [emoji]: [...emojiReactors, playerName]
          }
        };
      }
    });
    
    // Broadcast to partner
    channelRef.current?.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { messageId, emoji, playerName }
    });
  };

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
      players: [{ id: playerId, name: validation.value!, skipsLeft: 2, points: 0 }],
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

    // Search for room (case-insensitive)
    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .ilike('room_code', codeValidation.value!)
      .eq('game_type', 'truthordare')
      .in('status', ['waiting', 'playing'])
      .maybeSingle();

    if (error) {
      console.error('Error finding room:', error);
      toast.error('Error finding room. Try again.');
      return;
    }

    if (!data) {
      toast.error('Room not found! Check the code or ask your partner to create a new room 💔');
      return;
    }

    const currentState = JSON.parse(JSON.stringify(data.game_state)) as GameState;

    if (currentState.players.length >= 2 || data.player_count >= 2) {
      toast.error('This couple room is full 💔');
      return;
    }

    // Add player to game
    currentState.players.push({ id: playerId, name: nameValidation.value!, skipsLeft: 2, points: 0 });

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

    // Save initial messages to database
    const welcomeMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
      sender: 'system',
      message_type: 'text',
      content: {
        text: `💕 Welcome to Couples Truth & Dare!`,
        subtext: `${currentState.players[0]?.name} ❤️ ${nameValidation.value!}`
      }
    };

    const turnMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
      sender: 'system',
      message_type: 'buttons',
      content: createTurnMessageContent(
        currentState.players[0]?.name || '',
        currentState.players[0]?.id || '',
        0,
        0,
        true
      )
    };

    await saveMessages([welcomeMsg, turnMsg], data.id);
    
    // Load messages after saving
    const loadedMessages = await loadMessages(data.id);
    setMessages(adjustMessagesForPlayer(loadedMessages, currentState, playerId));
    
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
        gameState: currentState
      }
    });
    supabase.removeChannel(channel);

    celebrateHearts();
    haptics.success();
    toast.success(`Joined ${currentState.players[0]?.name}'s room! Let's play 💕`);
  };

  // Adjust messages for current player - no longer remove buttons, just return as is
  const adjustMessagesForPlayer = (msgs: ChatMessage[], state: GameState, currentPlayerId: string): ChatMessage[] => {
    // Don't modify buttons - they will be shown/hidden dynamically at render time
    return msgs;
  };

  // Check if buttons should be shown for a message - use forPlayerId from the message itself
  const shouldShowButtonsForMessage = (msg: ChatMessage, allMessages: ChatMessage[]): boolean => {
    if (msg.message_type !== 'buttons' || !msg.content.buttons || msg.disabled) {
      return false;
    }
    
    // Only show buttons for the MOST RECENT non-disabled buttons message
    const latestButtonsMsg = [...allMessages].reverse().find(
      m => m.message_type === 'buttons' && !m.disabled && m.content.buttons
    );
    if (!latestButtonsMsg || latestButtonsMsg.id !== msg.id) {
      return false;
    }
    
    // Use forPlayerId from the message itself - no race condition!
    const forPlayerId = msg.content.forPlayerId;
    console.log('shouldShowButtons check:', { 
      msgId: msg.id, 
      forPlayerId,
      playerId,
      isMatch: forPlayerId === playerId 
    });
    return forPlayerId === playerId;
  };

  // Determine input action from messages
  const determineInputAction = (msgs: ChatMessage[], state: GameState, currentPlayerId: string): string | null => {
    const currentTurnPlayer = state.players[state.currentPlayerIndex];
    const isCurrentPlayerTurn = currentTurnPlayer?.id === currentPlayerId;
    
    // Find last input message and check if there's a result after it
    const reversedMsgs = [...msgs].reverse();
    const lastInputMsgIdx = reversedMsgs.findIndex(m => m.message_type === 'input' && m.content.inputAction);
    const lastResultMsgIdx = reversedMsgs.findIndex(m => m.message_type === 'result');
    const lastButtonsMsgIdx = reversedMsgs.findIndex(m => m.message_type === 'buttons' && !m.disabled);
    
    // If there's a result or buttons message after the last input, no input action needed
    if (lastInputMsgIdx === -1) return null;
    if (lastResultMsgIdx !== -1 && lastResultMsgIdx < lastInputMsgIdx) return null;
    if (lastButtonsMsgIdx !== -1 && lastButtonsMsgIdx < lastInputMsgIdx) return null;
    
    const lastInputMsg = reversedMsgs[lastInputMsgIdx];
    const action = lastInputMsg.content.inputAction;
    
    console.log('Determining input action:', { action, isCurrentPlayerTurn, currentTurnPlayer: currentTurnPlayer?.name });
    
    // submit_question is for opponent (not current turn player)
    if (action === 'submit_question' && !isCurrentPlayerTurn) {
      return 'submit_question';
    }
    // submit_answer and complete_dare are for current turn player
    if ((action === 'submit_answer' || action === 'complete_dare') && isCurrentPlayerTurn) {
      return action;
    }

    return null;
  };

  // Keep refs updated for use in callbacks
  const gameStateRef = useRef(gameState);
  const messagesRef = useRef(messages);
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!roomCode || !roomId || (mode !== 'waiting' && mode !== 'playing')) return;

    console.log('Setting up realtime for room:', roomId);

    // Subscribe to chat_messages realtime
    const messagesChannel = supabase
      .channel(`messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('New message received:', payload.new);
          const newMsg = payload.new as unknown as ChatMessage;
          
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMsg.id)) {
              console.log('Duplicate message, skipping');
              return prev;
            }
            
            // Get latest game state from ref
            const currentGameState = gameStateRef.current;
            
            // Adjust for current player
            const adjusted = adjustMessagesForPlayer([newMsg], currentGameState, playerId);
            const newMessages = [...prev, ...adjusted];
            
            // Determine input action from new messages
            const action = determineInputAction(newMessages, currentGameState, playerId);
            console.log('New input action:', action);
            setCurrentInputAction(action);
            
            return newMessages;
          });
          
          setPartnerIsTyping(false);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          const updatedMsg = payload.new as unknown as ChatMessage;
          console.log('Message updated:', updatedMsg.id);
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, disabled: updatedMsg.disabled } : m));
        }
      )
      .subscribe((status) => {
        console.log('Messages channel status:', status);
      });

    // Broadcast channel for typing and game state
    const broadcastChannel = supabase
      .channel(`tod-${roomCode}`, {
        config: { broadcast: { self: false } }
      })
      .on('broadcast', { event: 'player_joined' }, async ({ payload }) => {
        console.log('Player joined event:', payload);
        if (payload?.playerName && payload.playerId !== playerId) {
          setPartnerName(payload.playerName);
          if (payload.gameState) {
            setGameState(payload.gameState);
            gameStateRef.current = payload.gameState;
          }
          
          // Load all messages
          if (roomId) {
            const loadedMessages = await loadMessages(roomId);
            const adjustedMessages = adjustMessagesForPlayer(loadedMessages, payload.gameState || gameStateRef.current, playerId);
            setMessages(adjustedMessages);
            const action = determineInputAction(loadedMessages, payload.gameState || gameStateRef.current, playerId);
            setCurrentInputAction(action);
          }
          
          setMode('playing');
          celebrateHearts();
          haptics.success();
          toast.success(`${payload.playerName} joined! Let the love begin! 💕`);
        }
      })
      .on('broadcast', { event: 'game_state' }, ({ payload }) => {
        console.log('Game state update:', payload);
        if (payload?.gameState) {
          setGameState(payload.gameState);
          gameStateRef.current = payload.gameState;
          
          // Re-adjust messages for new game state
          setMessages(prev => {
            const adjusted = adjustMessagesForPlayer(prev, payload.gameState, playerId);
            const action = determineInputAction(adjusted, payload.gameState, playerId);
            console.log('Updated input action after game state change:', action);
            setCurrentInputAction(action);
            return adjusted;
          });
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
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (payload?.messageId && payload?.emoji && payload?.playerName) {
          setReactions(prev => {
            const msgReactions = prev[payload.messageId] || {};
            const emojiReactors = msgReactions[payload.emoji] || [];
            
            // Toggle reaction from partner
            if (emojiReactors.includes(payload.playerName)) {
              return {
                ...prev,
                [payload.messageId]: {
                  ...msgReactions,
                  [payload.emoji]: emojiReactors.filter(name => name !== payload.playerName)
                }
              };
            } else {
              return {
                ...prev,
                [payload.messageId]: {
                  ...msgReactions,
                  [payload.emoji]: [...emojiReactors, payload.playerName]
                }
              };
            }
          });
        }
      })
      .subscribe((status) => {
        console.log('Broadcast channel status:', status);
      });

    channelRef.current = broadcastChannel;

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(broadcastChannel);
      channelRef.current = null;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [roomCode, roomId, mode, playerId, gameState]);

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
          {!isSystem && msg.sender_name && (
            <p className={`text-xs text-muted-foreground mb-1 ${isMe ? 'text-right' : 'text-left'}`}>
              {msg.sender_name}
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
            {msg.message_type === 'text' && (
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
            {msg.message_type === 'buttons' && (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-lg font-semibold">{msg.content.text}</p>
                  {msg.content.subtext && (
                    <p className="text-sm text-muted-foreground">{msg.content.subtext}</p>
                  )}
                </div>
                {shouldShowButtonsForMessage(msg, messages) && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {msg.content.buttons!.map(btn => (
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
                {!shouldShowButtonsForMessage(msg, messages) && !msg.disabled && msg.content.buttons && (
                  <p className="text-center text-sm text-muted-foreground">Waiting for partner's choice...</p>
                )}
              </div>
            )}

            {/* Input message */}
            {msg.message_type === 'input' && (
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
            {msg.message_type === 'result' && (
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
                
                {/* Reaction buttons */}
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  {REACTION_EMOJIS.map(emoji => {
                    const msgReactions = reactions[msg.id] || {};
                    const emojiReactors = msgReactions[emoji] || [];
                    const hasReacted = emojiReactors.includes(playerName);
                    const count = emojiReactors.length;
                    
                    return (
                      <button
                        key={emoji}
                        onClick={() => sendReaction(msg.id, emoji)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-lg transition-all hover:scale-110 ${
                          hasReacted 
                            ? 'bg-pink-500/30 border-2 border-pink-500' 
                            : 'bg-muted/50 border border-muted-foreground/20 hover:bg-muted'
                        }`}
                      >
                        <span className={hasReacted ? 'animate-bounce' : ''}>{emoji}</span>
                        {count > 0 && (
                          <span className="text-xs font-medium">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Show who reacted */}
                {Object.entries(reactions[msg.id] || {}).some(([, reactors]) => reactors.length > 0) && (
                  <div className="text-center text-xs text-muted-foreground">
                    {Object.entries(reactions[msg.id] || {})
                      .filter(([, reactors]) => reactors.length > 0)
                      .map(([emoji, reactors]) => `${emoji} ${reactors.join(', ')}`)
                      .join(' • ')}
                  </div>
                )}
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-pink-500/20 bg-gradient-to-r from-pink-500/5 to-purple-500/5">
        <Button variant="ghost" size="icon" onClick={leaveGame} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="text-center flex-1">
          <p className="text-sm">
            {playerName} <span className="text-pink-500">❤️</span> {partnerName}
          </p>
          <p className="text-xs text-muted-foreground">Round {gameState.roundCount + 1}</p>
        </div>
        {/* Points display */}
        <div className="text-right min-w-[60px]">
          <p className="text-xs text-yellow-400 font-semibold">⭐ {gameState.players[myPlayerIndex]?.points || 0}</p>
        </div>
      </div>

      {/* Chat messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.map(msg => renderMessage(msg))}
        
        {/* Typing indicator */}
        {partnerIsTyping && (
          <div className="flex justify-start animate-slide-up">
            <div className="bg-muted rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      {shouldShowInput && (
        <div className="px-4 py-3 border-t border-pink-500/20 bg-gradient-to-r from-pink-500/5 to-purple-500/5">
          {currentInputAction === 'complete_dare' ? (
            <div className="space-y-3">
              {/* Timer display */}
              {dareTimer !== null && (
                <div className={`text-center p-3 rounded-xl ${
                  dareTimer <= 10 
                    ? 'bg-red-500/20 border border-red-500/50' 
                    : dareTimer <= 30 
                      ? 'bg-orange-500/20 border border-orange-500/50'
                      : 'bg-blue-500/20 border border-blue-500/50'
                }`}>
                  <p className="text-xs text-muted-foreground mb-1">⏱️ Time Remaining</p>
                  <p className={`text-3xl font-bold font-mono ${
                    dareTimer <= 10 ? 'text-red-400 animate-pulse' : dareTimer <= 30 ? 'text-orange-400' : 'text-blue-400'
                  }`}>
                    {Math.floor(dareTimer / 60)}:{(dareTimer % 60).toString().padStart(2, '0')}
                  </p>
                  {dareTimer === 0 && (
                    <p className="text-red-400 text-sm mt-1">⏰ Time is up! Complete or skip!</p>
                  )}
                </div>
              )}
              
              <Button
                onClick={handleDareComplete}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 py-6 text-lg"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '✅ Mark Dare as Done! (+20 pts)'}
              </Button>
              {/* Skip button for dare */}
              {gameState.players[myPlayerIndex]?.skipsLeft > 0 && (
                <Button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  variant="outline"
                  className="w-full border-orange-500/30 hover:bg-orange-500/10 text-orange-400"
                >
                  ⏭️ Skip ({gameState.players[myPlayerIndex]?.skipsLeft} left) (-5 pts)
                </Button>
              )}
            </div>
          ) : currentInputAction === 'submit_answer' ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Type your answer..."
                  maxLength={300}
                  className="flex-1 bg-background/50 border-pink-500/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleInputSubmit();
                    }
                  }}
                />
                <Button
                  onClick={handleInputSubmit}
                  disabled={!inputValue.trim() || isSubmitting}
                  className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 px-4"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
              {/* Skip button for truth */}
              {gameState.players[myPlayerIndex]?.skipsLeft > 0 && (
                <Button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  variant="outline"
                  size="sm"
                  className="w-full border-orange-500/30 hover:bg-orange-500/10 text-orange-400"
                >
                  ⏭️ Skip ({gameState.players[myPlayerIndex]?.skipsLeft} left) (-5 pts)
                </Button>
              )}
              <p className="text-xs text-muted-foreground text-center">
                {inputValue.length}/300 • Answer = +10 pts
              </p>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={gameState.currentType === 'truth' ? 'Ask a truth question...' : 'Give a dare...'}
                maxLength={300}
                className="flex-1 bg-background/50 border-pink-500/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleInputSubmit();
                  }
                }}
              />
              <Button
                onClick={handleInputSubmit}
                disabled={!inputValue.trim() || isSubmitting}
                className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 px-4"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
          )}
          {currentInputAction === 'submit_question' && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              {inputValue.length}/300
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default TruthOrDare;