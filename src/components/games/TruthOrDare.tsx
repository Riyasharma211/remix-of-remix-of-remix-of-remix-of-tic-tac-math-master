import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart,
  Copy,
  Users,
  ArrowLeft,
  Sparkles,
  Send,
  Loader2,
  Camera,
  X,
  Check,
  CheckCheck,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import { soundManager } from "@/utils/soundManager";
import { useActiveGame } from "@/contexts/ActiveGameContext";
import { celebrateHearts } from "@/utils/confetti";

// --- Types ---
type GameMode = "menu" | "create" | "join" | "waiting" | "playing";

interface ChatMessage {
  id: string;
  sender: "system" | "player1" | "player2";
  sender_name?: string;
  message_type: "text" | "buttons" | "input" | "result";
  content: {
    text?: string;
    subtext?: string;
    forPlayerId?: string;
    buttons?: { label: string; value: string; variant?: "truth" | "dare" | "end" | "default" }[];
    inputPlaceholder?: string;
    inputAction?: string;
    question?: string;
    answer?: string;
    answeredBy?: string;
    questionType?: "truth" | "dare";
    proofPhotoUrl?: string;
  };
  disabled?: boolean;
  created_at?: string;
}

interface Player {
  id: string;
  name: string;
  skipsLeft: number;
  points: number;
}

interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  currentType?: "truth" | "dare";
  roundCount: number;
  truthCount: number;
  dareCount: number;
}

const POINTS = { TRUTH_ANSWERED: 10, DARE_COMPLETED: 20, SKIP_PENALTY: -5 };

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);
const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

// Create turn message content
const createTurnMessageContent = (
  playerName: string,
  playerId: string,
  truthCount: number,
  dareCount: number,
  showButtons: boolean
) => ({
  text: `✨ ${playerName}'s turn!`,
  subtext: `Truths: ${truthCount} | Dares: ${dareCount}`,
  forPlayerId: playerId,
  buttons: showButtons
    ? [
        { label: "💬 Truth", value: "truth", variant: "truth" as const },
        { label: "🔥 Dare", value: "dare", variant: "dare" as const },
        { label: "End Game", value: "end", variant: "end" as const },
      ]
    : undefined,
});

// --- Main Component ---
const TruthOrDare: React.FC = () => {
  const [mode, setMode] = useState<GameMode>("menu");
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId] = useState(() => generateId());
  const [playerName, setPlayerName] = useState("");
  const [partnerName, setPartnerName] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [currentInputAction, setCurrentInputAction] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [gameState, setGameState] = useState<GameState>({
    players: [],
    currentPlayerIndex: 0,
    roundCount: 0,
    truthCount: 0,
    dareCount: 0,
  });

  const [floatingReactions, setFloatingReactions] = useState<
    { id: number; x: number; y?: number; emoji: string; delay?: number; scale?: number }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dareTimer, setDareTimer] = useState<number | null>(null);
  const [darePhoto, setDarePhoto] = useState<File | null>(null);
  const [darePhotoPreview, setDarePhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { setGameActive, setActiveGameName } = useActiveGame();

  // Refs for callbacks
  const gameStateRef = useRef(gameState);
  const messagesRef = useRef(messages);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Derived state
  const myPlayerIndex = gameState.players.findIndex((p) => p.id === playerId);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      setGameActive(false);
      setActiveGameName('');
    };
  }, [setGameActive, setActiveGameName]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
    const timer = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  // --- Determine Input Action ---
  const determineInputAction = useCallback(
    (msgs: ChatMessage[], state: GameState, currentPlayerId: string): string | null => {
      if (!state.players || state.players.length < 2) return null;

      const currentTurnPlayer = state.players[state.currentPlayerIndex];
      const isCurrentTurnPlayer = currentTurnPlayer?.id === currentPlayerId;

      const reversedMsgs = [...msgs].reverse();
      const lastInputMsgIdx = reversedMsgs.findIndex((m) => m.message_type === "input" && m.content.inputAction);
      const lastResultMsgIdx = reversedMsgs.findIndex((m) => m.message_type === "result");
      const lastButtonsMsgIdx = reversedMsgs.findIndex((m) => m.message_type === "buttons" && !m.disabled);

      // If no input message or a result/buttons came after, no input needed
      if (lastInputMsgIdx === -1) return null;
      if (lastResultMsgIdx !== -1 && lastResultMsgIdx < lastInputMsgIdx) return null;
      if (lastButtonsMsgIdx !== -1 && lastButtonsMsgIdx < lastInputMsgIdx) return null;

      const lastInputMsg = reversedMsgs[lastInputMsgIdx];
      const action = lastInputMsg.content.inputAction;

      // 'submit_question' -> The OPPONENT (not current turn player) needs to type
      if (action === "submit_question") {
        if (!isCurrentTurnPlayer) return "submit_question";
        return null;
      }

      // 'submit_answer'/'complete_dare' -> The CURRENT TURN PLAYER types
      if (action === "submit_answer" || action === "complete_dare") {
        if (isCurrentTurnPlayer) return action;
        return null;
      }

      return null;
    },
    []
  );

  // --- Setup Realtime Channel ---
  const setupChannel = useCallback(
    (code: string) => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase.channel(`tod-${code}`, {
        config: { broadcast: { self: true } },
      });

      channel
        .on("broadcast", { event: "game_state" }, ({ payload }) => {
          setGameState(payload.state);
          
          const otherPlayer = payload.state.players.find((p: Player) => p.id !== playerId);
          if (otherPlayer) setPartnerName(otherPlayer.name);
          
          if (payload.state.players.length === 2 && mode === "waiting") {
            setMode("playing");
            celebrateHearts();
            haptics.success();
            soundManager.playLocalSound("start");
          }
        })
        .on("broadcast", { event: "message" }, ({ payload }) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === payload.message.id);
            if (exists) return prev;
            const newMsgs = [...prev, payload.message];
            const action = determineInputAction(newMsgs, gameStateRef.current, playerId);
            setCurrentInputAction(action);
            return newMsgs;
          });
        })
        .on("broadcast", { event: "disable_message" }, ({ payload }) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.messageId ? { ...m, disabled: true } : m))
          );
        })
        .on("broadcast", { event: "game_left" }, () => {
          toast.info("Game ended");
          leaveGame();
        })
        .on("broadcast", { event: "reaction" }, ({ payload }) => {
          showFloatingEmoji(payload.emoji);
          soundManager.playEmojiSound(payload.emoji);
        })
        .subscribe();

      channelRef.current = channel;
    },
    [mode, playerId, determineInputAction]
  );

  // --- Broadcast Helpers ---
  const broadcastState = (state: GameState) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "game_state",
      payload: { state },
    });
  };

  const broadcastMessage = (message: ChatMessage) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "message",
      payload: { message },
    });
  };

  const broadcastDisableMessage = (messageId: string) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "disable_message",
      payload: { messageId },
    });
  };

  // --- Leave Game ---
  const leaveGame = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game_left",
        payload: {},
      });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setMode("menu");
    setRoomId(null);
    setRoomCode("");
    setMessages([]);
    setGameState({
      players: [],
      currentPlayerIndex: 0,
      roundCount: 0,
      truthCount: 0,
      dareCount: 0,
    });
    setPartnerName("");
    setCurrentInputAction(null);
    setGameActive(false);
    setActiveGameName('');
  }, [setGameActive, setActiveGameName]);

  // --- Copy Room Code ---
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    toast.success("Code copied!");
    haptics.light();
  };

  // --- Floating Emoji ---
  const showFloatingEmoji = (emoji: string) => {
    const newReactions = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 80 + 10,
      y: Math.random() * 20 + 40,
      emoji,
      delay: i * 80,
      scale: 0.8 + Math.random() * 0.4,
    }));
    setFloatingReactions((prev) => [...prev, ...newReactions]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => !newReactions.some((nr) => nr.id === r.id)));
    }, 3000);
  };

  // --- Photo Handlers ---
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDarePhoto(file);
      setDarePhotoPreview(URL.createObjectURL(file));
    }
  };

  const clearPhoto = () => {
    setDarePhoto(null);
    setDarePhotoPreview(null);
  };

  // --- Button Click Handler ---
  const handleButtonClick = async (buttonValue: string, messageId: string) => {
    if (isSubmitting || !roomId) return;
    haptics.light();
    setIsSubmitting(true);

    // Disable the button message
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, disabled: true } : m)));
    broadcastDisableMessage(messageId);

    if (buttonValue === "truth" || buttonValue === "dare") {
      const newState: GameState = { ...gameState, currentType: buttonValue as "truth" | "dare" };

      // 1. Announce Choice
      const choiceMsg: ChatMessage = {
        id: generateId(),
        sender: myPlayerIndex === 0 ? "player1" : "player2",
        sender_name: playerName,
        message_type: "text",
        content: { text: buttonValue === "truth" ? "💬 I choose TRUTH!" : "🔥 I choose DARE!" },
        created_at: new Date().toISOString(),
      };

      // 2. Ask OPPONENT to type question (opponent is NOT the current turn player)
      const opponent = gameState.players.find((p) => p.id !== playerId);
      const opponentName = opponent?.name || "Partner";

      const inputMsg: ChatMessage = {
        id: generateId(),
        sender: "system",
        message_type: "input",
        content: {
          text: buttonValue === "truth" ? `💬 ${playerName} CHOSE TRUTH` : `🔥 ${playerName} CHOSE DARE`,
          subtext: `${opponentName}, please type your ${buttonValue === "truth" ? "question" : "dare"} for ${playerName}:`,
          inputPlaceholder: buttonValue === "truth" ? "Ask a truth question..." : "Give a dare...",
          inputAction: "submit_question",
          questionType: buttonValue as "truth" | "dare",
        },
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, choiceMsg, inputMsg]);
      broadcastMessage(choiceMsg);
      broadcastMessage(inputMsg);
      
      setGameState(newState);
      broadcastState(newState);
      
      // Re-evaluate input action
      const action = determineInputAction([...messagesRef.current, choiceMsg, inputMsg], newState, playerId);
      setCurrentInputAction(action);
    } else if (buttonValue === "end") {
      leaveGame();
    }
    
    setIsSubmitting(false);
  };

  // --- Input Submit Handler ---
  const handleInputSubmit = async () => {
    if (!inputValue.trim() || isSubmitting || !roomId) return;
    haptics.light();
    setIsSubmitting(true);

    // PHASE 1: Opponent asking question
    if (currentInputAction === "submit_question") {
      const questionType = gameState.currentType || "truth";
      const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];

      // 1. Save Question as player message
      const questionMsg: ChatMessage = {
        id: generateId(),
        sender: myPlayerIndex === 0 ? "player1" : "player2",
        sender_name: playerName,
        message_type: "text",
        content: { text: inputValue.trim() },
        created_at: new Date().toISOString(),
      };

      // 2. Prompt Current Turn Player to Answer
      const answerInputMsg: ChatMessage = {
        id: generateId(),
        sender: "system",
        message_type: "input",
        content: {
          text: questionType === "truth" ? "💬 ANSWER TRUTH" : "🔥 COMPLETE DARE",
          subtext: `Question for ${currentTurnPlayer?.name}:`,
          question: inputValue.trim(),
          inputPlaceholder: questionType === "truth" ? "Type your answer..." : undefined,
          inputAction: questionType === "truth" ? "submit_answer" : "complete_dare",
          questionType: questionType,
        },
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, questionMsg, answerInputMsg]);
      broadcastMessage(questionMsg);
      broadcastMessage(answerInputMsg);
      setInputValue("");
      
      // Re-evaluate input action
      const action = determineInputAction([...messagesRef.current, questionMsg, answerInputMsg], gameState, playerId);
      setCurrentInputAction(action);

    // PHASE 2: Current Player Answering
    } else if (currentInputAction === "submit_answer") {
      celebrateHearts();
      soundManager.playLocalSound("win");
      toast.success("Answered! +10 points!");

      const questionMsg = [...messagesRef.current].reverse().find((m) => m.content.question);
      const question = questionMsg?.content.question || "";
      const questionType = questionMsg?.content.questionType || "truth";

      const answerMsg: ChatMessage = {
        id: generateId(),
        sender: myPlayerIndex === 0 ? "player1" : "player2",
        sender_name: playerName,
        message_type: "text",
        content: { text: inputValue.trim() },
        created_at: new Date().toISOString(),
      };

      const resultMsg: ChatMessage = {
        id: generateId(),
        sender: "system",
        message_type: "result",
        content: {
          text: "💬 TRUTH RESULT",
          question,
          answer: inputValue.trim(),
          answeredBy: playerName,
          questionType: questionType,
        },
        created_at: new Date().toISOString(),
      };

      // SWITCH TURN to next player
      const currentState = gameStateRef.current;
      const nextIndex = (currentState.currentPlayerIndex + 1) % currentState.players.length;
      const nextPlayer = currentState.players[nextIndex];

      const updatedPlayers = currentState.players.map((p, idx) =>
        idx === myPlayerIndex ? { ...p, points: p.points + POINTS.TRUTH_ANSWERED } : p
      );

      const newState: GameState = {
        ...currentState,
        players: updatedPlayers,
        currentPlayerIndex: nextIndex,
        currentType: undefined,
        roundCount: currentState.roundCount + 1,
        truthCount: currentState.truthCount + 1,
      };

      // Show Buttons for Next Player
      const turnMsg: ChatMessage = {
        id: generateId(),
        sender: "system",
        message_type: "buttons",
        content: createTurnMessageContent(
          nextPlayer.name,
          nextPlayer.id,
          newState.truthCount,
          newState.dareCount,
          true
        ),
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, answerMsg, resultMsg, turnMsg]);
      broadcastMessage(answerMsg);
      broadcastMessage(resultMsg);
      broadcastMessage(turnMsg);
      
      setGameState(newState);
      broadcastState(newState);
      setCurrentInputAction(null);
      setInputValue("");
    }
    
    setIsSubmitting(false);
  };

  // --- Dare Complete Handler ---
  const handleDareComplete = async () => {
    if (isSubmitting || !roomId) return;
    setIsSubmitting(true);

    celebrateHearts();
    soundManager.playLocalSound("win");
    toast.success("Dare completed! +20 points!");

    const questionMsg = [...messagesRef.current].reverse().find((m) => m.content.question);
    const question = questionMsg?.content.question || "";

    const completionMsg: ChatMessage = {
      id: generateId(),
      sender: myPlayerIndex === 0 ? "player1" : "player2",
      sender_name: playerName,
      message_type: "text",
      content: { text: darePhotoPreview ? "✅ I completed the dare! 📸" : "✅ I completed the dare!" },
      created_at: new Date().toISOString(),
    };

    const resultMsg: ChatMessage = {
      id: generateId(),
      sender: "system",
      message_type: "result",
      content: {
        text: "🔥 DARE COMPLETED",
        question,
        answer: darePhotoPreview ? "✅ Dare completed with proof!" : "✅ Dare completed!",
        answeredBy: playerName,
        questionType: "dare",
        proofPhotoUrl: darePhotoPreview || undefined,
      },
      created_at: new Date().toISOString(),
    };

    // SWITCH TURN
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
      dareCount: currentState.dareCount + 1,
    };

    const turnMsg: ChatMessage = {
      id: generateId(),
      sender: "system",
      message_type: "buttons",
      content: createTurnMessageContent(nextPlayer.name, nextPlayer.id, newState.truthCount, newState.dareCount, true),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, completionMsg, resultMsg, turnMsg]);
    broadcastMessage(completionMsg);
    broadcastMessage(resultMsg);
    broadcastMessage(turnMsg);
    
    setGameState(newState);
    broadcastState(newState);
    setCurrentInputAction(null);
    setDarePhoto(null);
    setDarePhotoPreview(null);
    setIsSubmitting(false);
  };

  // --- Skip Handler ---
  const handleSkip = async () => {
    if (isSubmitting || !roomId) return;

    const currentState = gameStateRef.current;
    const currentPlayerData = currentState.players[myPlayerIndex];
    if (!currentPlayerData || currentPlayerData.skipsLeft <= 0) {
      toast.error("No skips left!");
      return;
    }

    setIsSubmitting(true);

    const questionMsg = [...messagesRef.current].reverse().find((m) => m.content.question);
    const question = questionMsg?.content.question || "";

    const skipMsg: ChatMessage = {
      id: generateId(),
      sender: myPlayerIndex === 0 ? "player1" : "player2",
      sender_name: playerName,
      message_type: "text",
      content: { text: "⏭️ I skip this one!" },
      created_at: new Date().toISOString(),
    };

    const resultMsg: ChatMessage = {
      id: generateId(),
      sender: "system",
      message_type: "result",
      content: {
        text: "⏭️ SKIPPED",
        question,
        answer: `${playerName} used a skip (${currentPlayerData.skipsLeft - 1} left)`,
        answeredBy: playerName,
        questionType: gameState.currentType,
      },
      created_at: new Date().toISOString(),
    };

    // SWITCH TURN
    const nextIndex = (currentState.currentPlayerIndex + 1) % currentState.players.length;
    const nextPlayer = currentState.players[nextIndex];
    const updatedPlayers = currentState.players.map((p, idx) =>
      idx === myPlayerIndex
        ? { ...p, skipsLeft: p.skipsLeft - 1, points: Math.max(0, p.points + POINTS.SKIP_PENALTY) }
        : p
    );

    const newState: GameState = {
      ...currentState,
      players: updatedPlayers,
      currentPlayerIndex: nextIndex,
      currentType: undefined,
      roundCount: currentState.roundCount + 1,
    };

    const turnMsg: ChatMessage = {
      id: generateId(),
      sender: "system",
      message_type: "buttons",
      content: createTurnMessageContent(nextPlayer.name, nextPlayer.id, newState.truthCount, newState.dareCount, true),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, skipMsg, resultMsg, turnMsg]);
    broadcastMessage(skipMsg);
    broadcastMessage(resultMsg);
    broadcastMessage(turnMsg);
    
    setGameState(newState);
    broadcastState(newState);
    setCurrentInputAction(null);
    setIsSubmitting(false);
  };

  // --- Create Room ---
  const createRoom = async () => {
    if (!playerName.trim() || playerName.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }

    const code = generateRoomCode();
    const rid = generateId();
    
    const initialState: GameState = {
      players: [{ id: playerId, name: playerName.trim(), skipsLeft: 2, points: 0 }],
      currentPlayerIndex: 0,
      roundCount: 0,
      truthCount: 0,
      dareCount: 0,
    };

    setRoomCode(code);
    setRoomId(rid);
    setGameState(initialState);
    setMode("waiting");
    setGameActive(true);
    setActiveGameName("truth-or-dare");
    
    setupChannel(code);
    broadcastState(initialState);
  };

  // --- Join Room ---
  const joinRoom = async () => {
    if (!playerName.trim() || playerName.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    if (!inputCode || inputCode.length !== 4) {
      toast.error("Room code must be 4 characters");
      return;
    }

    const code = inputCode.toUpperCase();
    setRoomCode(code);
    setRoomId(generateId());
    setMode("waiting");
    setGameActive(true);
    setActiveGameName("truth-or-dare");
    
    setupChannel(code);

    // Wait a moment for channel to connect, then request to join
    setTimeout(() => {
      const newPlayer: Player = { id: playerId, name: playerName.trim(), skipsLeft: 2, points: 0 };
      
      channelRef.current?.send({
        type: "broadcast",
        event: "join_request",
        payload: { player: newPlayer },
      });
    }, 500);
  };

  // Listen for join requests (host only)
  useEffect(() => {
    if (!channelRef.current || mode !== "waiting") return;

    const handleJoinRequest = ({ payload }: { payload: { player: Player } }) => {
      if (gameState.players.length >= 2) return;
      if (gameState.players.some(p => p.id === payload.player.id)) return;

      const newState: GameState = {
        ...gameState,
        players: [...gameState.players, payload.player],
      };

      setGameState(newState);
      setPartnerName(payload.player.name);
      broadcastState(newState);

      // Start game with welcome message
      const welcomeMsg: ChatMessage = {
        id: generateId(),
        sender: "system",
        message_type: "text",
        content: { 
          text: "🎉 Welcome!", 
          subtext: `${gameState.players[0].name} 🤝 ${payload.player.name}` 
        },
        created_at: new Date().toISOString(),
      };
      
      const turnMsg: ChatMessage = {
        id: generateId(),
        sender: "system",
        message_type: "buttons",
        content: createTurnMessageContent(
          gameState.players[0].name,
          gameState.players[0].id,
          0,
          0,
          true
        ),
        created_at: new Date().toISOString(),
      };

      setMessages([welcomeMsg, turnMsg]);
      broadcastMessage(welcomeMsg);
      broadcastMessage(turnMsg);
    };

    channelRef.current.on("broadcast", { event: "join_request" }, handleJoinRequest);

    return () => {
      // Cleanup handled by channel removal
    };
  }, [mode, gameState, broadcastState]);

  // --- Render Logic ---
  const shouldShowButtonsForMessage = (msg: ChatMessage, allMessages: ChatMessage[]): boolean => {
    if (msg.message_type !== "buttons" || !msg.content.buttons || msg.disabled === true) return false;
    
    const latestButtonsMsg = [...allMessages]
      .reverse()
      .find((m) => m.message_type === "buttons" && m.disabled !== true && m.content.buttons);
    
    if (!latestButtonsMsg || latestButtonsMsg.id !== msg.id) return false;
    
    const forPlayerId = msg.content.forPlayerId;
    return forPlayerId === playerId;
  };

  const renderMessage = (msg: ChatMessage) => {
    const isSystem = msg.sender === "system";
    const isMe = (msg.sender === "player1" && myPlayerIndex === 0) || (msg.sender === "player2" && myPlayerIndex === 1);

    if (isSystem) {
      return (
        <div key={msg.id} className="flex justify-center my-3 animate-in slide-in-from-bottom-2">
          <div className="max-w-[90%] w-full bg-secondary/50 backdrop-blur border border-border rounded-2xl p-4 shadow-sm">
            {msg.message_type === "buttons" && (
              <div className="space-y-3 text-center">
                <p className="font-semibold text-foreground">{msg.content.text}</p>
                {msg.content.subtext && <p className="text-xs text-muted-foreground">{msg.content.subtext}</p>}

                {shouldShowButtonsForMessage(msg, messages) ? (
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {msg.content.buttons?.map((btn) => (
                      <Button
                        key={btn.value}
                        onClick={() => handleButtonClick(btn.value, msg.id)}
                        disabled={isSubmitting}
                        className={
                          btn.variant === "truth"
                            ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white"
                            : btn.variant === "dare"
                            ? "bg-gradient-to-r from-orange-500 to-red-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {btn.label}
                      </Button>
                    ))}
                  </div>
                ) : msg.disabled ? (
                  <p className="text-xs text-green-600 font-medium mt-1">✓ Selection made</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic mt-1">Waiting for player...</p>
                )}
              </div>
            )}
            {msg.message_type === "input" && (
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl">{msg.content.text?.includes("TRUTH") ? "💬" : "🔥"}</span>
                  <span
                    className={`font-bold text-sm tracking-wide ${
                      msg.content.text?.includes("TRUTH") ? "text-pink-600" : "text-orange-600"
                    }`}
                  >
                    {msg.content.text}
                  </span>
                </div>
                <p className="text-sm text-foreground">{msg.content.subtext}</p>
                {msg.content.question && (
                  <div className="bg-background/50 p-3 rounded-xl border border-border mt-2">
                    <p className="font-medium text-foreground">{msg.content.question}</p>
                  </div>
                )}
              </div>
            )}
            {msg.message_type === "result" && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl">✨</span>
                  <span className="font-bold text-sm text-foreground">{msg.content.text}</span>
                </div>
                <div className="space-y-2">
                  <div className="bg-background/50 p-2 rounded-lg">
                    <p className="text-[10px] uppercase text-muted-foreground">Question</p>
                    <p className="text-sm text-foreground">{msg.content.question}</p>
                  </div>
                  <div className="bg-green-500/10 p-2 rounded-lg border border-green-500/20">
                    <p className="text-[10px] uppercase text-green-600">Answer by {msg.content.answeredBy}</p>
                    <p className="text-sm font-medium text-foreground">{msg.content.answer}</p>
                  </div>
                  {msg.content.proofPhotoUrl && (
                    <div className="mt-2 text-center">
                      <p className="text-xs text-purple-500 mb-1">📸 Photo Proof</p>
                      <img
                        src={msg.content.proofPhotoUrl}
                        className="max-h-32 rounded-lg mx-auto border border-border"
                        alt="Dare proof"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            {msg.message_type === "text" && (
              <div className="text-center">
                <p className="text-sm text-foreground">{msg.content.text}</p>
                {msg.content.subtext && <p className="text-xs text-muted-foreground mt-1">{msg.content.subtext}</p>}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} className={`flex my-2 ${isMe ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm ${
            isMe
              ? "bg-primary text-primary-foreground rounded-br-none"
              : "bg-card text-card-foreground rounded-bl-none border border-border"
          }`}
        >
          {msg.sender_name && !isMe && (
            <p className="text-[10px] font-bold text-primary mb-1">{msg.sender_name}</p>
          )}
          {msg.message_type === "text" && <p className="text-sm">{msg.content.text}</p>}
        </div>
      </div>
    );
  };

  // Render floating reactions
  const renderFloatingReactions = () => (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {floatingReactions.map((r) => (
        <div
          key={r.id}
          className="absolute animate-float-up"
          style={{
            left: `${r.x}%`,
            top: `${r.y || 50}%`,
            animationDelay: `${r.delay || 0}ms`,
            transform: `scale(${r.scale || 1})`,
            fontSize: "2rem",
          }}
        >
          {r.emoji}
        </div>
      ))}
    </div>
  );

  // --- MENU VIEW ---
  if (mode === "menu") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 bg-gradient-to-b from-background to-secondary/20">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Truth or Dare
          </h1>
          <p className="text-muted-foreground">Play with a friend!</p>
        </div>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Button
            className="h-14 text-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
            onClick={() => setMode("create")}
          >
            <Heart className="w-5 h-5 mr-2" /> Create Room
          </Button>
          <Button
            variant="outline"
            className="h-14 text-lg border-2"
            onClick={() => setMode("join")}
          >
            <Users className="w-5 h-5 mr-2" /> Join Room
          </Button>
        </div>
      </div>
    );
  }

  // --- CREATE/JOIN VIEW ---
  if (mode === "create" || mode === "join") {
    return (
      <div className="flex flex-col h-full p-6 bg-background">
        <Button variant="ghost" onClick={() => setMode("menu")} className="self-start mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 max-w-sm mx-auto w-full">
          <h2 className="text-2xl font-bold text-foreground">
            {mode === "create" ? "Create a Room" : "Join a Room"}
          </h2>

          {mode === "join" && (
            <div className="w-full space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Room Code</label>
              <Input
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 4))}
                className="text-center text-2xl tracking-[0.5em] font-mono h-14 uppercase"
                placeholder="ABCD"
              />
            </div>
          )}

          <div className="w-full space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Your Name</label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="text-center text-lg h-12"
              placeholder="Enter your name"
            />
          </div>

          <Button
            className="w-full h-12 text-lg mt-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
            onClick={mode === "create" ? createRoom : joinRoom}
          >
            {mode === "create" ? "Start Game" : "Join Game"}
          </Button>
        </div>
      </div>
    );
  }

  // --- WAITING VIEW ---
  if (mode === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 bg-gradient-to-b from-background to-secondary/20">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-foreground">Waiting for friend...</h2>
          <p className="text-muted-foreground text-sm">Share this code with your partner</p>
        </div>

        <button
          onClick={copyRoomCode}
          className="bg-card px-8 py-6 rounded-3xl shadow-sm border border-border flex flex-col items-center gap-2 transition-transform active:scale-95"
        >
          <span className="text-4xl font-mono font-bold text-primary tracking-widest">{roomCode}</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Copy className="w-3 h-3" /> Tap to copy
          </span>
        </button>

        <div className="w-full max-w-xs bg-card/50 rounded-xl p-4 border border-border">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Players Joined</p>
          <div className="space-y-2">
            {gameState.players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                {p.name} {p.id === playerId && <span className="text-muted-foreground text-xs">(You)</span>}
              </div>
            ))}
            {gameState.players.length === 0 && (
              <p className="text-muted-foreground text-sm italic">Loading...</p>
            )}
          </div>
        </div>

        <Button variant="ghost" onClick={leaveGame} className="text-muted-foreground hover:text-destructive">
          Cancel
        </Button>
      </div>
    );
  }

  // --- PLAYING VIEW ---
  const shouldShowInput = !!currentInputAction;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {renderFloatingReactions()}

      {/* Header */}
      <div className="h-16 bg-card border-b border-border flex items-center px-4 justify-between shrink-0 shadow-sm z-10">
        <Button variant="ghost" onClick={leaveGame} className="p-2">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Button>
        <div className="text-center">
          <p className="font-bold text-foreground text-sm">
            {playerName} <span className="text-primary">vs</span> {partnerName}
          </p>
          <div className="flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-[10px] text-muted-foreground">Round {gameState.roundCount + 1}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-muted-foreground">PTS</span>
          <span className="text-sm font-bold text-primary">{gameState.players[myPlayerIndex]?.points || 0}</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth" ref={chatContainerRef}>
        {messages.map((msg) => renderMessage(msg))}
        {messages.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Game started! Waiting for the first move...
          </div>
        )}
        <div className="h-4" />
      </div>

      {/* Input Area */}
      {shouldShowInput && (
        <div className="shrink-0 bg-card p-4 border-t border-border animate-in slide-in-from-bottom-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {currentInputAction === "complete_dare" ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-secondary p-3 rounded-lg border border-border">
                <span className="text-xs font-bold text-muted-foreground uppercase">Timer</span>
                <span className="font-mono font-bold text-xl text-orange-500">
                  {dareTimer
                    ? `${Math.floor(dareTimer / 60)}:${(dareTimer % 60).toString().padStart(2, "0")}`
                    : "00:00"}
                </span>
              </div>

              {!darePhotoPreview ? (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-12 border-dashed border-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-4 h-4 mr-2" /> Add Proof
                  </Button>
                  <Button
                    onClick={handleDareComplete}
                    disabled={isSubmitting}
                    className="h-12 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Mark Done"}
                  </Button>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-border h-32 bg-black">
                  <img src={darePhotoPreview} className="w-full h-full object-cover opacity-80" alt="Proof" />
                  <div className="absolute inset-0 flex items-center justify-center gap-2">
                    <Button variant="secondary" onClick={clearPhoto}>
                      Retake
                    </Button>
                    <Button className="bg-green-500 text-white" onClick={handleDareComplete}>
                      Send Proof
                    </Button>
                  </div>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handlePhotoSelect}
              />

              {gameState.players[myPlayerIndex]?.skipsLeft > 0 && (
                <button
                  onClick={handleSkip}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Skip Dare (-5 pts, {gameState.players[myPlayerIndex]?.skipsLeft} left)
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground ml-1 uppercase">
                {currentInputAction === "submit_question"
                  ? `Ask ${gameState.players[gameState.currentPlayerIndex]?.name || "Opponent"}`
                  : "Your Answer"}
              </p>
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInputSubmit()}
                  placeholder={
                    currentInputAction === "submit_question" ? "Type your question..." : "Type your answer..."
                  }
                  className="h-12 text-lg"
                  autoFocus
                />
                <Button
                  onClick={handleInputSubmit}
                  disabled={!inputValue.trim() || isSubmitting}
                  className="h-12 w-12 rounded-xl shrink-0"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
              {currentInputAction === "submit_answer" && gameState.players[myPlayerIndex]?.skipsLeft > 0 && (
                <button
                  onClick={handleSkip}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Skip Question (-5 pts)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TruthOrDare;
