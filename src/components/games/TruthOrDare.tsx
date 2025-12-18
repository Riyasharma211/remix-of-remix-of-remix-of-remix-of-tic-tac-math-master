import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Heart, Copy, Users, ArrowLeft, Sparkles, Send, Loader2, Camera, X, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { haptics } from '@/utils/haptics';
import { RealtimeChannel } from '@supabase/supabase-js';
import { celebrateHearts } from '@/utils/confetti';
import { validatePlayerName, validateRoomCode, validateQuestion, validateAnswer } from '@/utils/gameValidation';
import { soundManager } from '@/utils/soundManager';
import { IOSNotificationContainer, showIOSNotification } from '@/components/ui/ios-notification';

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
    proofPhotoUrl?: string; // URL of dare proof photo
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
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; x: number; y?: number; emoji: string; delay?: number; scale?: number }[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Reactions state: { messageId: { emoji: [playerName1, playerName2] } }
  const [reactions, setReactions] = useState<Record<string, Record<string, string[]>>>({});
  
  // Read receipts state: { messageId: 'sent' | 'delivered' | 'read' }
  const [readReceipts, setReadReceipts] = useState<Record<string, 'sent' | 'delivered' | 'read'>>({});
  const lastReadMessageIdRef = useRef<string | null>(null);
  
  // Dare timer state
  const [dareTimer, setDareTimer] = useState<number | null>(null);
  const dareTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Photo upload state
  const [darePhoto, setDarePhoto] = useState<File | null>(null);
  const [darePhotoPreview, setDarePhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const REACTION_EMOJIS = ['😍', '💕', '🔥', '😂', '😤', '🥵', '💋', '😘', '🙈', '👏', '💯', '✨'];
  const DARE_TIME_LIMIT = 60; // seconds
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const myPlayerIndex = gameState.players.findIndex(p => p.id === playerId);

  const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  useEffect(() => {
    // Immediate scroll for better UX
    scrollToBottom();
    // Also scroll after a delay to handle any DOM updates
    const timer = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  // Keyboard-aware behavior for mobile
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  useEffect(() => {
    // Use visualViewport API for mobile keyboard detection
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // If viewport height is significantly smaller than window height, keyboard is open
      const isKeyboardOpen = viewport.height < window.innerHeight * 0.75;
      setKeyboardVisible(isKeyboardOpen);
      
      // Scroll to bottom when keyboard opens
      if (isKeyboardOpen) {
        setTimeout(scrollToBottom, 100);
      }
    };

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);
    
    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
    };
  }, [scrollToBottom]);

  // Send read receipts when viewing messages from partner
  useEffect(() => {
    if (mode !== 'playing' || messages.length === 0) return;
    
    // Find last message from partner
    const partnerMessages = messages.filter(m => 
      m.sender !== 'system' && 
      !((m.sender === 'player1' && myPlayerIndex === 0) || (m.sender === 'player2' && myPlayerIndex === 1))
    );
    
    if (partnerMessages.length === 0) return;
    
    const lastPartnerMsg = partnerMessages[partnerMessages.length - 1];
    
    // Only send if we haven't already sent for this message
    if (lastPartnerMsg.id !== lastReadMessageIdRef.current) {
      lastReadMessageIdRef.current = lastPartnerMsg.id;
      
      // Broadcast read receipt
      channelRef.current?.send({
        type: 'broadcast',
        event: 'read_receipt',
        payload: { lastReadMessageId: lastPartnerMsg.id, playerId }
      });
    }
  }, [messages, mode, myPlayerIndex, playerId]);

  // Mark my sent messages with initial 'sent' status
  useEffect(() => {
    const myMessages = messages.filter(m => 
      m.sender !== 'system' && 
      ((m.sender === 'player1' && myPlayerIndex === 0) || (m.sender === 'player2' && myPlayerIndex === 1))
    );
    
    setReadReceipts(prev => {
      const updated = { ...prev };
      myMessages.forEach(msg => {
        if (!updated[msg.id]) {
          // If partner is connected (partnerName exists), mark as delivered
          updated[msg.id] = partnerName ? 'delivered' : 'sent';
        }
      });
      return updated;
    });
  }, [messages, myPlayerIndex, partnerName]);

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

  // Floating emoji reaction animation - shower effect with multiple emojis
  const spawnFloatingEmoji = useCallback((emoji: string, count: number = 8) => {
    const emojis = [];
    for (let i = 0; i < count; i++) {
      emojis.push({
        id: Date.now() + Math.random() + i,
        x: Math.random() * 90 + 5, // Random x position 5-95%
        y: Math.random() * 30, // Random start y offset 0-30%
        emoji,
        delay: Math.random() * 300, // Staggered spawn
        scale: 0.8 + Math.random() * 0.6, // Random size 0.8-1.4
      });
    }
    setFloatingReactions(prev => [...prev, ...emojis]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(e => !emojis.find(ne => ne.id === e.id)));
    }, 3000);
  }, []);

  // Save message to database and add to local state immediately
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

    const savedMsg = data as unknown as ChatMessage;
    
    // Immediately add to local state to avoid waiting for realtime subscription
    setMessages(prev => {
      if (prev.some(m => m.id === savedMsg.id)) return prev;
      return [...prev, savedMsg];
    });

    return savedMsg;
  };

  // Save multiple messages and add to local state immediately
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

    const savedMsgs = (data || []) as unknown as ChatMessage[];
    
    // Immediately add to local state to avoid waiting for realtime subscription
    setMessages(prev => {
      const newMsgs = savedMsgs.filter(m => !prev.some(p => p.id === m.id));
      if (newMsgs.length === 0) return prev;
      
      const updatedMessages = [...prev, ...newMsgs];
      
      // Also update input action based on new messages
      const action = determineInputAction(updatedMessages, gameStateRef.current, playerId);
      console.log('Setting input action after save:', action);
      setCurrentInputAction(action);
      
      return updatedMessages;
    });

    return savedMsgs;
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
  const handleButtonClick = async (buttonValue: string, messageId: string, _msgContent?: ChatMessage['content']) => {
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
            ? 'Ask something interesting or fun...' 
            : 'Give a fun dare...',
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
      soundManager.playLocalSound('win');
      showIOSNotification({
        title: 'Truth Answered! 💬',
        message: '+10 points! Well done!',
        icon: '💬',
        variant: 'success',
      });

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

  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG, PNG, or WebP images allowed');
      return;
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Photo must be less than 2MB');
      return;
    }
    
    setDarePhoto(file);
    setDarePhotoPreview(URL.createObjectURL(file));
    haptics.light();
  };

  const clearPhoto = () => {
    setDarePhoto(null);
    if (darePhotoPreview) {
      URL.revokeObjectURL(darePhotoPreview);
    }
    setDarePhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload photo to storage
  const uploadDarePhoto = async (): Promise<string | null> => {
    if (!darePhoto || !roomId) return null;
    
    setIsUploading(true);
    const fileName = `${roomId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${darePhoto.type.split('/')[1]}`;
    
    const { data, error } = await supabase.storage
      .from('dare-proofs')
      .upload(fileName, darePhoto, {
        cacheControl: '3600',
        upsert: false
      });
    
    setIsUploading(false);
    
    if (error) {
      console.error('Photo upload error:', error);
      toast.error('Failed to upload photo');
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('dare-proofs')
      .getPublicUrl(data.path);
    
    return publicUrl;
  };

  // Handle dare completion - directly awards points and moves to next turn
  const handleDareComplete = async () => {
    if (isSubmitting || !roomId) return;
    haptics.light();
    setIsSubmitting(true);
    celebrateHearts();
    soundManager.playLocalSound('win');
    showIOSNotification({
      title: 'Dare Completed! 🔥',
      message: '+20 points! Amazing!',
      icon: '🔥',
      variant: 'success',
    });

    // Upload photo if selected
    let photoUrl: string | null = null;
    if (darePhoto) {
      photoUrl = await uploadDarePhoto();
    }

    // Find the question from previous messages
    const questionMsg = [...messagesRef.current].reverse().find(m => m.content.question);
    const question = questionMsg?.content.question || '';

    // Clear photo state
    clearPhoto();
    
    // Clear dare timer
    if (dareTimerRef.current) {
      clearInterval(dareTimerRef.current);
      dareTimerRef.current = null;
    }
    setDareTimer(null);

    // Save completion message
    const completionMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
      sender: myPlayerIndex === 0 ? 'player1' : 'player2',
      sender_name: playerName,
      message_type: 'text',
      content: { text: photoUrl ? '✅ I completed the dare! 📸' : '✅ I completed the dare!' }
    };

    // Save result message with photo URL
    const resultMsg: Omit<ChatMessage, 'id' | 'created_at'> = {
      sender: 'system',
      message_type: 'result',
      content: {
        text: '🔥 DARE COMPLETED',
        question,
        answer: photoUrl ? '✅ Dare completed with photo proof!' : '✅ Dare completed!',
        answeredBy: playerName,
        questionType: 'dare',
        proofPhotoUrl: photoUrl || undefined
      }
    };

    // Create next turn - add points to the player who completed
    const currentState = gameStateRef.current;
    const nextIndex = (currentState.currentPlayerIndex + 1) % currentState.players.length;
    const nextPlayer = currentState.players[nextIndex];
    
    const updatedPlayers = currentState.players.map((p, idx) => 
      idx === myPlayerIndex ? { ...p, points: p.points + POINTS.DARE_COMPLETED } : p
    );
    
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
    toast.success("Skipped! Your turn passes to your friend 💫");
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
    
    // Play emoji-specific sound effect
    soundManager.playEmojiSound(emoji);
    
    // Spawn floating emoji shower for visual feedback
    spawnFloatingEmoji(emoji, 10);
    
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
      toast.error('Room not found! Check the code or ask your friend to create a new room 😅');
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
        text: `🎉 Welcome to Friends Truth & Dare!`,
        subtext: `${currentState.players[0]?.name} 🤝 ${nameValidation.value!}`
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
    soundManager.playLocalSound('start');
    showIOSNotification({
      title: 'Game Started!',
      message: `Joined ${currentState.players[0]?.name}'s room! Let's play 💕`,
      icon: '💕',
      variant: 'love',
    });
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

  // Determine input action from messages - check for waiting state
  const determineInputAction = useCallback((msgs: ChatMessage[], state: GameState, currentPlayerId: string): string | null => {
    if (!state.players || state.players.length < 2) return null;
    
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
    
    console.log('Determining input action:', { action, isCurrentPlayerTurn, currentTurnPlayer: currentTurnPlayer?.name, currentPlayerId });
    
    // submit_question is for opponent (not current turn player)
    if (action === 'submit_question' && !isCurrentPlayerTurn) {
      return 'submit_question';
    }
    // submit_answer and complete_dare are for current turn player
    if ((action === 'submit_answer' || action === 'complete_dare') && isCurrentPlayerTurn) {
      return action;
    }

    return null;
  }, []);

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
          console.log('Message updated:', updatedMsg.id, updatedMsg);
          // Sync full message content
          setMessages(prev => prev.map(m => 
            m.id === updatedMsg.id 
              ? { ...m, disabled: updatedMsg.disabled, content: updatedMsg.content } 
              : m
          ));
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
      .on('broadcast', { event: 'game_left' }, () => {
        // Other player left - reset game
        toast.info('Your friend left the game');
        setMode('menu');
        setRoomId(null);
        setRoomCode('');
        setPlayerName('');
        setPartnerName('');
        setMessages([]);
        setInputValue('');
        setCurrentInputAction(null);
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
          soundManager.playLocalSound('start');
          showIOSNotification({
            title: `${payload.playerName} joined!`,
            message: "Let the fun game begin! 🎉",
            icon: '🎉',
            variant: 'love',
          });
        }
      })
      .on('broadcast', { event: 'game_state' }, async ({ payload }) => {
        console.log('Game state update:', payload);
        if (payload?.gameState) {
          setGameState(payload.gameState);
          gameStateRef.current = payload.gameState;
          
          // Reload messages from DB to ensure we have latest messages
          if (roomId) {
            const loadedMessages = await loadMessages(roomId);
            const adjustedMessages = adjustMessagesForPlayer(loadedMessages, payload.gameState, playerId);
            setMessages(adjustedMessages);
            const action = determineInputAction(adjustedMessages, payload.gameState, playerId);
            console.log('Updated input action after game state change:', action);
            setCurrentInputAction(action);
          }
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
          // Spawn floating emoji shower and play emoji-specific sound when partner reacts
          spawnFloatingEmoji(payload.emoji, 10);
          soundManager.playEmojiSound(payload.emoji);
          
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
      .on('broadcast', { event: 'read_receipt' }, ({ payload }) => {
        // Partner has read messages up to this ID
        if (payload?.lastReadMessageId && payload?.playerId !== playerId) {
          setReadReceipts(prev => {
            const updated = { ...prev };
            // Mark all messages up to this one as read
            messages.forEach(msg => {
              if (msg.sender !== 'system') {
                updated[msg.id] = 'read';
              }
            });
            return updated;
          });
        }
      })
      .on('broadcast', { event: 'partner_online' }, ({ payload }) => {
        // Partner is online, mark messages as delivered
        if (payload?.playerId !== playerId) {
          setReadReceipts(prev => {
            const updated = { ...prev };
            messages.forEach(msg => {
              if (msg.sender !== 'system' && prev[msg.id] === 'sent') {
                updated[msg.id] = 'delivered';
              }
            });
            return updated;
          });
        }
      })
      .subscribe((status) => {
        console.log('Broadcast channel status:', status);
        // When connected, broadcast that we're online
        if (status === 'SUBSCRIBED') {
          broadcastChannel.send({
            type: 'broadcast',
            event: 'partner_online',
            payload: { playerId }
          });
        }
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
    // Broadcast to other player that we're leaving
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
    setPlayerName('');
    setPartnerName('');
    setMessages([]);
    setInputValue('');
    setCurrentInputAction(null);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    haptics.light();
    toast.success('Room code copied! Share with your friend 🎉');
  };

  // Floating hearts, reactions render, and iOS notifications
  const renderFloatingHearts = () => (
    <>
      <IOSNotificationContainer />
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
      {floatingReactions.map(reaction => (
        <div
          key={reaction.id}
          className="absolute text-5xl drop-shadow-lg animate-float-up"
          style={{ 
            left: `${reaction.x}%`, 
            bottom: `${20 + (reaction.y || 0)}%`,
            animationDelay: `${reaction.delay || 0}ms`,
            transform: `scale(${reaction.scale || 1})`,
          }}
        >
          {reaction.emoji}
        </div>
      ))}
      </div>
    </>
  );

  // Format timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render a single chat message - WhatsApp style
  const renderMessage = (msg: ChatMessage) => {
    const isSystem = msg.sender === 'system';
    const isMe = (msg.sender === 'player1' && myPlayerIndex === 0) || (msg.sender === 'player2' && myPlayerIndex === 1);
    
    // System messages (centered cards)
    if (isSystem) {
      return (
        <div key={msg.id} className="flex justify-center animate-slide-up my-3">
          <div className="max-w-[90%] w-full">
            <div className="bg-gradient-to-br from-pink-500/15 to-purple-500/15 backdrop-blur-sm rounded-2xl p-4 border border-pink-500/20 shadow-lg shadow-pink-500/5">
              {/* Buttons message */}
              {msg.message_type === 'buttons' && (
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="text-base font-semibold">{msg.content.text}</p>
                    {msg.content.subtext && (
                      <p className="text-xs text-muted-foreground mt-1">{msg.content.subtext}</p>
                    )}
                  </div>
                  {shouldShowButtonsForMessage(msg, messages) && (
                    <div className="flex flex-wrap gap-2 justify-center pt-1">
                      {msg.content.buttons!.map(btn => (
                        <Button
                          key={btn.value}
                          onClick={() => handleButtonClick(btn.value, msg.id, msg.content)}
                          disabled={isSubmitting}
                          size="sm"
                          className={`px-5 py-4 text-sm font-medium transition-all hover:scale-105 shadow-md ${
                            btn.variant === 'truth' 
                              ? 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-pink-500/20' 
                              : btn.variant === 'dare'
                                ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-orange-500/20'
                                : btn.variant === 'end'
                                  ? 'bg-muted/80 hover:bg-muted text-muted-foreground'
                                  : 'bg-primary hover:bg-primary/90'
                          }`}
                        >
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : btn.label}
                        </Button>
                      ))}
                    </div>
                  )}
                  {msg.disabled && (
                    <p className="text-center text-xs text-green-400/80 font-medium">Choice made ✓</p>
                  )}
                  {!shouldShowButtonsForMessage(msg, messages) && !msg.disabled && msg.content.buttons && (
                    <p className="text-center text-xs text-muted-foreground italic">Waiting for friend...</p>
                  )}
                </div>
              )}

              {/* Input message */}
              {msg.message_type === 'input' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg">{msg.content.text?.includes('TRUTH') ? '💬' : '🔥'}</span>
                    <p className={`text-sm font-bold uppercase tracking-wide ${
                      msg.content.text?.includes('TRUTH') ? 'text-pink-400' : 'text-orange-400'
                    }`}>{msg.content.text?.includes('TRUTH') ? 'TRUTH QUESTION' : 'DARE CHALLENGE'}</p>
                  </div>
                  {msg.content.subtext && (
                    <p className="text-xs text-center text-muted-foreground">{msg.content.subtext}</p>
                  )}
                  {msg.content.question && (
                    <div className={`p-3 rounded-xl ${
                      msg.content.questionType === 'truth' 
                        ? 'bg-pink-500/20 border border-pink-400/30' 
                        : 'bg-orange-500/20 border border-orange-400/30'
                    }`}>
                      <p className="text-center text-base font-medium">{msg.content.question}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Result message */}
              {msg.message_type === 'result' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl">💕</span>
                    <p className={`text-sm font-bold uppercase tracking-wide ${
                      msg.content.questionType === 'truth' ? 'text-pink-400' : 'text-orange-400'
                    }`}>{msg.content.questionType === 'truth' ? 'TRUTH RESULT' : 'DARE RESULT'}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-background/40">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Question:</p>
                      <p className="text-sm">{msg.content.question}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-green-500/15 border border-green-400/25">
                      <p className="text-[10px] uppercase tracking-wider text-green-400 mb-0.5">{msg.content.answeredBy}'s Answer:</p>
                      <p className="text-base font-medium">{msg.content.answer}</p>
                    </div>
                    {msg.content.proofPhotoUrl && (
                      <div className="mt-2">
                        <p className="text-[10px] uppercase tracking-wider text-purple-400 mb-1 text-center">📸 Proof Photo</p>
                        <img 
                          src={msg.content.proofPhotoUrl} 
                          alt="Dare proof" 
                          className="w-full max-h-40 object-cover rounded-xl border border-purple-400/40"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Compact reaction buttons */}
                  <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                    {REACTION_EMOJIS.map(emoji => {
                      const msgReactions = reactions[msg.id] || {};
                      const emojiReactors = msgReactions[emoji] || [];
                      const hasReacted = emojiReactors.includes(playerName);
                      const count = emojiReactors.length;
                      
                      return (
                        <button
                          key={emoji}
                          onClick={() => sendReaction(msg.id, emoji)}
                          className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-base transition-all hover:scale-110 active:scale-95 ${
                            hasReacted 
                              ? 'bg-pink-500/30 ring-1 ring-pink-400' 
                              : 'bg-background/40 hover:bg-background/60'
                          }`}
                        >
                          <span className={hasReacted ? 'animate-bounce' : ''}>{emoji}</span>
                          {count > 0 && (
                            <span className="text-[10px] font-semibold">{count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Text message for system */}
              {msg.message_type === 'text' && (
                <div className="text-center">
                  <p className="text-sm">{msg.content.text}</p>
                  {msg.content.subtext && (
                    <p className="text-xs text-muted-foreground mt-1">{msg.content.subtext}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    
    // Player messages (WhatsApp-style bubbles)
    return (
      <div
        key={msg.id}
        className={`flex animate-slide-up my-1 ${isMe ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
          {/* Sender name */}
          {msg.sender_name && (
            <p className={`text-[11px] font-medium mb-0.5 px-2 ${
              isMe ? 'text-pink-400' : 'text-purple-400'
            }`}>
              {msg.sender_name}
            </p>
          )}
          
          {/* Message bubble with tail */}
          <div className="relative">
            <div className={`relative px-3 py-2 rounded-2xl shadow-sm ${
              isMe 
                ? 'bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-br-md' 
                : 'bg-white/10 backdrop-blur-sm border border-white/10 rounded-bl-md'
            }`}>
              {/* Bubble tail */}
              <div className={`absolute bottom-0 w-3 h-3 ${
                isMe 
                  ? 'right-[-6px] bg-rose-500' 
                  : 'left-[-6px] bg-white/10 border-l border-b border-white/10'
              }`} style={{
                clipPath: isMe 
                  ? 'polygon(0 0, 100% 100%, 0 100%)' 
                  : 'polygon(100% 0, 100% 100%, 0 100%)'
              }} />
              
              {/* Message content */}
              {msg.message_type === 'text' && (
                <div>
                  <p className="text-[15px] leading-relaxed">{msg.content.text}</p>
                  {msg.content.subtext && (
                    <p className={`text-xs mt-0.5 ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
                      {msg.content.subtext}
                    </p>
                  )}
                </div>
              )}
              
              {/* Timestamp & Read receipts */}
              <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {msg.created_at && (
                  <span className={`text-[10px] ${
                    isMe ? 'text-white/50' : 'text-muted-foreground/60'
                  }`}>
                    {formatTime(msg.created_at)}
                  </span>
                )}
                {/* Read receipt ticks for sent messages */}
                {isMe && (
                  <span className="flex items-center">
                    {readReceipts[msg.id] === 'read' ? (
                      <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                    ) : readReceipts[msg.id] === 'delivered' ? (
                      <CheckCheck className="w-3.5 h-3.5 text-white/50" />
                    ) : (
                      <Check className="w-3 h-3 text-white/50" />
                    )}
                  </span>
                )}
              </div>
            </div>
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
            <Sparkles className="w-8 h-8 text-purple-500 animate-pulse" />
            <h2 className="font-orbitron text-2xl bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
              Friends Truth & Dare
            </h2>
            <Sparkles className="w-8 h-8 text-purple-500 animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm">A fun game for friends 🎉</p>
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
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 py-6 text-lg shadow-lg shadow-purple-500/25"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Create Game Room
          </Button>
          <Button
            onClick={() => setMode('join')}
            variant="outline"
            className="w-full border-purple-500/30 hover:bg-purple-500/10 py-6 text-lg"
          >
            <Users className="w-5 h-5 mr-2" />
            Join Friend's Room
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
          <Sparkles className="w-10 h-10 text-purple-500 mx-auto animate-pulse" />
          <h3 className="font-orbitron text-xl">What's your name?</h3>
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
          <Sparkles className="w-10 h-10 text-purple-500 mx-auto animate-pulse" />
          <h3 className="font-orbitron text-xl">Join your friend's room</h3>
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
          <h3 className="font-orbitron text-xl">Waiting for your friend... 🎉</h3>
          <p className="text-muted-foreground text-sm">Share the room code with your friend</p>
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
    <div className={`flex flex-col h-full max-w-md mx-auto bg-gradient-to-b from-pink-950/20 to-background overflow-hidden transition-all duration-200 ${
      keyboardVisible 
        ? 'max-h-[calc(100dvh-80px)]' 
        : 'max-h-[calc(100dvh-200px)] sm:max-h-[calc(100dvh-140px)]'
    }`}>
      {renderFloatingHearts()}
      
      {/* WhatsApp-style Header */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-pink-500/10 to-purple-500/10 backdrop-blur-sm border-b border-white/5 shadow-sm">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={leaveGame} 
          className="text-muted-foreground hover:text-foreground h-9 w-9"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        {/* Profile section */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
                      {playerName} <span className="text-purple-400">🤝</span> {partnerName}
                    </p>
            <p className="text-[11px] text-muted-foreground">Round {gameState.roundCount + 1}</p>
          </div>
        </div>
        
        {/* Points badge */}
        <div className="flex items-center gap-1.5 bg-yellow-500/15 px-2.5 py-1.5 rounded-full border border-yellow-500/20">
          <span className="text-sm">⭐</span>
          <span className="text-xs font-bold text-yellow-400">{gameState.players[myPlayerIndex]?.points || 0}</span>
        </div>
      </div>

      {/* Chat messages with wallpaper */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1 min-h-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(236, 72, 153, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.03) 0%, transparent 50%)'
        }}
      >
        {messages.map(msg => renderMessage(msg))}
        
        {/* Typing indicator - WhatsApp style */}
        {partnerIsTyping && (
          <div className="flex justify-start animate-slide-up my-1">
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl rounded-bl-md px-4 py-2.5">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-pink-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-pink-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-pink-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
              {/* Tail */}
              <div className="absolute bottom-0 left-[-6px] w-3 h-3 bg-white/10 border-l border-b border-white/10" style={{
                clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
              }} />
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp-style Input bar */}
      {shouldShowInput && (
        <div className="shrink-0 px-3 py-2.5 bg-gradient-to-r from-pink-500/5 to-purple-500/5 border-t border-white/5">
          {currentInputAction === 'complete_dare' ? (
            <div className="space-y-2.5">
              {/* Timer display */}
              {dareTimer !== null && (
                <div className={`text-center p-2.5 rounded-xl ${
                  dareTimer <= 10 
                    ? 'bg-red-500/15 border border-red-500/30' 
                    : dareTimer <= 30 
                      ? 'bg-orange-500/15 border border-orange-500/30'
                      : 'bg-blue-500/15 border border-blue-500/30'
                }`}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">⏱️ Time Remaining</p>
                  <p className={`text-2xl font-bold font-mono ${
                    dareTimer <= 10 ? 'text-red-400 animate-pulse' : dareTimer <= 30 ? 'text-orange-400' : 'text-blue-400'
                  }`}>
                    {Math.floor(dareTimer / 60)}:{(dareTimer % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              )}
              
              {/* Photo upload section */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                
                {darePhotoPreview ? (
                  <div className="relative">
                    <img 
                      src={darePhotoPreview} 
                      alt="Dare proof" 
                      className="w-full h-28 object-cover rounded-xl border border-green-400/30"
                    />
                    <button
                      onClick={clearPhoto}
                      className="absolute top-1.5 right-1.5 p-1 bg-red-500/90 rounded-full hover:bg-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                    <div className="absolute bottom-1.5 left-1.5 bg-green-500/90 px-2 py-0.5 rounded-full">
                      <p className="text-[10px] text-white font-medium">📸 Ready</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-purple-400/30 rounded-xl hover:bg-purple-500/5 transition-colors text-purple-400"
                  >
                    <Camera className="w-4 h-4" />
                    <span className="text-sm">Add Photo Proof (Optional)</span>
                  </button>
                )}
              </div>
              
              <Button
                onClick={handleDareComplete}
                disabled={isSubmitting || isUploading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 py-5 text-base font-semibold shadow-lg shadow-green-500/20"
              >
                {isSubmitting || isUploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {isUploading ? 'Uploading...' : 'Saving...'}</>
                ) : (
                  <>✅ Mark Dare as Done! (+20 pts){darePhoto && ' 📸'}</>
                )}
              </Button>
              
              {/* Skip button for dare */}
              {gameState.players[myPlayerIndex]?.skipsLeft > 0 && (
                <button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="w-full text-center text-sm text-orange-400 hover:text-orange-300 py-1.5 transition-colors disabled:opacity-50"
                >
                  ⏭️ Skip ({gameState.players[myPlayerIndex]?.skipsLeft} left) (-5 pts)
                </button>
              )}
            </div>
          ) : currentInputAction === 'submit_answer' ? (
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <Input
                    value={inputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Type your answer..."
                    maxLength={300}
                    className="w-full bg-white/5 border-white/10 rounded-full py-5 px-4 pr-12 text-[15px] placeholder:text-muted-foreground/50"
                    onFocus={() => setTimeout(scrollToBottom, 300)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleInputSubmit();
                      }
                    }}
                  />
                  <span className="absolute right-4 bottom-2.5 text-[10px] text-muted-foreground/50">
                    {inputValue.length}/300
                  </span>
                </div>
                <Button
                  onClick={handleInputSubmit}
                  disabled={!inputValue.trim() || isSubmitting}
                  size="icon"
                  className="h-11 w-11 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg shadow-pink-500/20 shrink-0"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
              
              {/* Skip button for truth */}
              {gameState.players[myPlayerIndex]?.skipsLeft > 0 && (
                <button
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="w-full text-center text-sm text-orange-400 hover:text-orange-300 py-1 transition-colors disabled:opacity-50"
                >
                  ⏭️ Skip ({gameState.players[myPlayerIndex]?.skipsLeft} left) (-5 pts)
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <Input
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={gameState.currentType === 'truth' ? 'Ask a truth question...' : 'Give a dare...'}
                  maxLength={300}
                  className="w-full bg-white/5 border-white/10 rounded-full py-5 px-4 pr-12 text-[15px] placeholder:text-muted-foreground/50"
                  onFocus={() => setTimeout(scrollToBottom, 300)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleInputSubmit();
                    }
                  }}
                />
                <span className="absolute right-4 bottom-2.5 text-[10px] text-muted-foreground/50">
                  {inputValue.length}/300
                </span>
              </div>
              <Button
                onClick={handleInputSubmit}
                disabled={!inputValue.trim() || isSubmitting}
                size="icon"
                className="h-11 w-11 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg shadow-pink-500/20 shrink-0"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TruthOrDare;