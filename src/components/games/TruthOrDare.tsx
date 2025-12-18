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
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, User } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
  query,
  orderBy,
  addDoc,
  limit,
  where,
} from "firebase/firestore";

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(typeof __firebase_config !== "undefined" ? __firebase_config : "{}");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";

// --- Utility Functions ---

const haptics = {
  light: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  },
  medium: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40);
  },
  success: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([10, 30, 10]);
  },
};

const soundManager = {
  playLocalSound: (type: "win" | "start" | "click") => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === "win") {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === "start") {
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {
      console.error("Audio error", e);
    }
  },
  playEmojiSound: (emoji: string) => {
    haptics.light();
  },
};

const validatePlayerName = (name: string) => {
  if (!name || name.trim().length < 2) return { success: false, error: "Name too short" };
  if (name.length > 20) return { success: false, error: "Name too long" };
  return { success: true, value: name.trim() };
};

const validateRoomCode = (code: string) => {
  if (!code || code.length !== 4) return { success: false, error: "Code must be 4 chars" };
  return { success: true, value: code.toUpperCase() };
};

const validateQuestion = (q: string) => {
  if (!q || q.trim().length < 3) return { success: false, error: "Question too short" };
  return { success: true, value: q.trim() };
};

const validateAnswer = (a: string) => {
  if (!a || a.trim().length < 1) return { success: false, error: "Answer cannot be empty" };
  return { success: true, value: a.trim() };
};

const celebrateHearts = () => {
  if (typeof document === "undefined") return;
  const colors = ["#ff0000", "#ff69b4", "#ff1493"];
  for (let i = 0; i < 50; i++) {
    const el = document.createElement("div");
    el.innerText = "❤";
    el.style.position = "fixed";
    el.style.left = Math.random() * 100 + "vw";
    el.style.top = "-20px";
    el.style.fontSize = Math.random() * 20 + 10 + "px";
    el.style.color = colors[Math.floor(Math.random() * colors.length)];
    el.style.pointerEvents = "none";
    el.style.zIndex = "9999";
    el.style.transition = "transform 2s linear, opacity 2s ease-in";
    document.body.appendChild(el);

    setTimeout(() => {
      el.style.transform = `translateY(${window.innerHeight + 50}px) rotate(${Math.random() * 360}deg)`;
      el.style.opacity = "0";
    }, 50);

    setTimeout(() => {
      document.body.removeChild(el);
    }, 2050);
  }
};

// --- UI Components ---

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "ghost" | "outline" | "secondary" }
>(({ className, variant = "default", ...props }, ref) => {
  const baseStyles =
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const variantClass =
    variant === "ghost"
      ? "hover:bg-gray-100 text-gray-700"
      : variant === "outline"
        ? "border border-gray-200 bg-transparent hover:bg-gray-50"
        : "bg-pink-600 text-white hover:bg-pink-700";

  return <button ref={ref} className={`${baseStyles} ${variantClass} ${className}`} {...props} />;
});
Button.displayName = "Button";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

const IOSNotificationContainer = () => (
  <div
    id="ios-notifications"
    className="fixed top-4 left-0 right-0 z-50 pointer-events-none flex flex-col items-center gap-2"
  />
);

const showIOSNotification = ({ title, message, icon }: any) => {
  if (typeof document === "undefined") return;
  const container = document.getElementById("ios-notifications");
  if (!container) return;
  const el = document.createElement("div");
  el.className =
    "bg-white/90 backdrop-blur-md text-black px-4 py-3 rounded-2xl shadow-lg border border-gray-100 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 max-w-[90vw]";
  el.innerHTML = `<span class="text-2xl">${icon}</span><div><p class="font-semibold text-sm">${title}</p><p class="text-xs text-gray-500">${message}</p></div>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-20px)";
    setTimeout(() => container.removeChild(el), 300);
  }, 3000);
};

// --- Types & Constants ---

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
  created_at?: any;
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

// --- Main Game Component ---

const TruthOrDare: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<GameMode>("menu");
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
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

  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number }[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<
    { id: number; x: number; y?: number; emoji: string; delay?: number; scale?: number }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reactions, setReactions] = useState<Record<string, Record<string, string[]>>>({});
  const [readReceipts, setReadReceipts] = useState<Record<string, "sent" | "delivered" | "read">>({});

  const [dareTimer, setDareTimer] = useState<number | null>(null);
  const dareTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [darePhoto, setDarePhoto] = useState<File | null>(null);
  const [darePhotoPreview, setDarePhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const REACTION_EMOJIS = ["😍", "💕", "🔥", "😂", "😤", "🥵", "💋", "😘", "🙈", "👏", "💯", "✨"];

  // --- Auth Initialization (FIXED) ---
  useEffect(() => {
    const init = async () => {
      try {
        if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
          // Correct Modular Syntax
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth error, falling back to anon", e);
        // Fallback
        try {
          await signInAnonymously(auth);
        } catch (innerE) {
          console.error("Fatal auth error", innerE);
        }
      }
    };
    init();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Derived state
  const myPlayerIndex = gameState.players.findIndex((p) => p.id === user?.uid);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  // Logic Fix: Opponent is whoever is NOT the current player
  const opponentPlayer = gameState.players.find((p) => p.id !== currentPlayer?.id);
  const isMyTurn = currentPlayer?.id === user?.uid;

  // Refs for callbacks
  const gameStateRef = useRef(gameState);
  const messagesRef = useRef(messages);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // --- Helpers ---

  const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

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

  // --- Firebase Listeners ---

  useEffect(() => {
    if (!roomId || !user) return;

    // Listen to Room State
    const roomUnsub = onSnapshot(doc(db, "artifacts", appId, "public", "data", `tod_room_${roomId}`), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        if (data.game_state) {
          setGameState(data.game_state);

          // Partner Name logic
          const otherPlayer = data.game_state.players.find((p: Player) => p.id !== user.uid);
          if (otherPlayer) setPartnerName(otherPlayer.name);

          // Re-evaluate input action whenever game state changes
          if (messagesRef.current.length > 0) {
            const action = determineInputAction(messagesRef.current, data.game_state, user.uid);
            setCurrentInputAction(action);
          }

          if (data.status === "playing" && mode === "waiting") {
            setMode("playing");
            celebrateHearts();
            haptics.success();
          }
        }
      } else {
        // Room deleted
        if (mode !== "menu") {
          // Only alert if we were in game
          leaveGame();
        }
      }
    });

    // Listen to Messages
    const msgsQuery = query(
      collection(db, "artifacts", appId, "public", "data", `tod_room_${roomId}_messages`),
      orderBy("created_at", "asc"),
    );
    const msgsUnsub = onSnapshot(msgsQuery, (snapshot) => {
      const newMsgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage);
      setMessages(newMsgs);

      // Determine input action based on new messages
      const action = determineInputAction(newMsgs, gameStateRef.current, user.uid);
      setCurrentInputAction(action);
      setPartnerIsTyping(false);
    });

    return () => {
      roomUnsub();
      msgsUnsub();
    };
  }, [roomId, user, mode]);

  // --- LOGIC FIX: Determining who types when ---
  const determineInputAction = useCallback(
    (msgs: ChatMessage[], state: GameState, currentPlayerId: string): string | null => {
      if (!state.players || state.players.length < 2) return null;

      const currentTurnPlayer = state.players[state.currentPlayerIndex];
      const isCurrentTurnPlayer = currentTurnPlayer?.id === currentPlayerId;

      const reversedMsgs = [...msgs].reverse();
      const lastInputMsgIdx = reversedMsgs.findIndex((m) => m.message_type === "input" && m.content.inputAction);
      const lastResultMsgIdx = reversedMsgs.findIndex((m) => m.message_type === "result");
      const lastButtonsMsgIdx = reversedMsgs.findIndex((m) => m.message_type === "buttons" && !m.disabled);

      // If we have a result or new buttons AFTER the input request, the input is finished
      if (lastInputMsgIdx === -1) return null;
      if (lastResultMsgIdx !== -1 && lastResultMsgIdx < lastInputMsgIdx) return null;
      if (lastButtonsMsgIdx !== -1 && lastButtonsMsgIdx < lastInputMsgIdx) return null;

      const lastInputMsg = reversedMsgs[lastInputMsgIdx];
      const action = lastInputMsg.content.inputAction;

      // Logic 1: 'submit_question' -> The OPPONENT needs to type
      if (action === "submit_question") {
        if (!isCurrentTurnPlayer) return "submit_question";
        return null; // Current turn player waits
      }

      // Logic 2: 'submit_answer'/'complete_dare' -> The CURRENT TURN PLAYER types
      if (action === "submit_answer" || action === "complete_dare") {
        if (isCurrentTurnPlayer) return action;
        return null; // Opponent waits
      }

      return null;
    },
    [],
  );

  const saveMessages = async (msgs: Omit<ChatMessage, "id" | "created_at">[]) => {
    if (!roomId) return;
    const batch = msgs.map((msg) =>
      addDoc(collection(db, "artifacts", appId, "public", "data", `tod_room_${roomId}_messages`), {
        ...msg,
        created_at: serverTimestamp(),
      }),
    );
    await Promise.all(batch);
  };

  const updateMessageDisabled = async (msgId: string) => {
    if (!roomId) return;
    await updateDoc(doc(db, "artifacts", appId, "public", "data", `tod_room_${roomId}_messages`, msgId), {
      disabled: true,
    });
  };

  const updateGameState = async (newState: GameState) => {
    if (!roomId) return;
    await updateDoc(doc(db, "artifacts", appId, "public", "data", `tod_room_${roomId}`), {
      game_state: newState,
    });
  };

  // --- Interaction Handlers ---

  const handleButtonClick = async (buttonValue: string, messageId: string) => {
    if (isSubmitting || !roomId || !user) return;
    haptics.light();
    setIsSubmitting(true);

    // Update UI locally immediately
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, disabled: true } : m)));
    await updateMessageDisabled(messageId);

    if (buttonValue === "truth" || buttonValue === "dare") {
      const newState: GameState = { ...gameState, currentType: buttonValue as "truth" | "dare" };

      // 1. Announce Choice
      const choiceMsg: Omit<ChatMessage, "id" | "created_at"> = {
        sender: myPlayerIndex === 0 ? "player1" : "player2",
        sender_name: playerName,
        message_type: "text",
        content: { text: buttonValue === "truth" ? "💬 I choose TRUTH!" : "🔥 I choose DARE!" },
      };

      // 2. Ask OPPONENT to type question
      const opponent = gameState.players.find((p) => p.id !== user.uid) || { name: "Partner" };

      const inputMsg: Omit<ChatMessage, "id" | "created_at"> = {
        sender: "system",
        message_type: "input",
        content: {
          text: buttonValue === "truth" ? `💬 ${playerName} CHOSE TRUTH` : `🔥 ${playerName} CHOSE DARE`,
          subtext: `${opponent.name}, please type your question for ${playerName}:`,
          inputPlaceholder: buttonValue === "truth" ? `Ask a truth question...` : `Give a dare...`,
          inputAction: "submit_question", // Triggers input for Opponent
          questionType: buttonValue as "truth" | "dare",
        },
      };

      await saveMessages([choiceMsg, inputMsg]);
      await updateGameState(newState);
    } else if (buttonValue === "end") {
      await leaveGame();
    }
    setIsSubmitting(false);
  };

  const handleInputSubmit = async () => {
    if (!inputValue.trim() || isSubmitting || !roomId || !user) return;
    haptics.light();
    setIsSubmitting(true);

    // --- PHASE 1: Opponent asking question ---
    if (currentInputAction === "submit_question") {
      const validation = validateQuestion(inputValue);
      if (!validation.success) {
        // Simple alert or toast
        alert(validation.error || "Invalid question");
        setIsSubmitting(false);
        return;
      }

      const lastInputMsg = [...messagesRef.current]
        .reverse()
        .find((m) => m.message_type === "input" && m.content.questionType);
      const questionType = lastInputMsg?.content.questionType || "truth";

      // 1. Save Question
      const questionMsg: Omit<ChatMessage, "id" | "created_at"> = {
        sender: myPlayerIndex === 0 ? "player1" : "player2",
        sender_name: playerName,
        message_type: "text",
        content: { text: validation.value! },
      };

      // 2. Prompt Current Player to Answer
      const answerInputMsg: Omit<ChatMessage, "id" | "created_at"> = {
        sender: "system",
        message_type: "input",
        content: {
          text: questionType === "truth" ? "💬 ANSWER TRUTH" : "🔥 COMPLETE DARE",
          subtext: `Question for ${gameState.players[gameState.currentPlayerIndex]?.name}:`,
          question: validation.value!,
          inputPlaceholder: questionType === "truth" ? "Type your answer..." : undefined,
          inputAction: questionType === "truth" ? "submit_answer" : "complete_dare",
          questionType: questionType,
        },
      };

      await saveMessages([questionMsg, answerInputMsg]);
      setInputValue("");

      // --- PHASE 2: Current Player Answering ---
    } else if (currentInputAction === "submit_answer") {
      const validation = validateAnswer(inputValue);
      if (!validation.success) {
        alert(validation.error || "Invalid answer");
        setIsSubmitting(false);
        return;
      }

      celebrateHearts();
      soundManager.playLocalSound("win");
      showIOSNotification({ title: "Answered!", message: "+10 points!", icon: "💬" });

      const questionMsg = [...messagesRef.current].reverse().find((m) => m.content.question);
      const question = questionMsg?.content.question || "";
      const questionType = questionMsg?.content.questionType || "truth";

      const answerMsg: Omit<ChatMessage, "id" | "created_at"> = {
        sender: myPlayerIndex === 0 ? "player1" : "player2",
        sender_name: playerName,
        message_type: "text",
        content: { text: validation.value! },
      };

      const resultMsg: Omit<ChatMessage, "id" | "created_at"> = {
        sender: "system",
        message_type: "result",
        content: {
          text: "💬 TRUTH RESULT",
          question,
          answer: validation.value!,
          answeredBy: playerName,
          questionType: questionType,
        },
      };

      // SWITCH TURN (Next Player)
      const currentState = gameStateRef.current;
      const nextIndex = (currentState.currentPlayerIndex + 1) % currentState.players.length;
      const nextPlayer = currentState.players[nextIndex];

      const updatedPlayers = currentState.players.map((p, idx) =>
        idx === myPlayerIndex ? { ...p, points: p.points + POINTS.TRUTH_ANSWERED } : p,
      );

      const newState: GameState = {
        ...currentState,
        players: updatedPlayers,
        currentPlayerIndex: nextIndex,
        currentType: undefined,
        roundCount: currentState.roundCount + 1,
        truthCount: currentState.truthCount + 1,
        dareCount: currentState.dareCount,
      };

      // Show Buttons for Next Player
      const turnMsg: Omit<ChatMessage, "id" | "created_at"> = {
        sender: "system",
        message_type: "buttons",
        content: createTurnMessageContent(
          nextPlayer.name,
          nextPlayer.id,
          newState.truthCount,
          newState.dareCount,
          true,
        ),
      };

      await saveMessages([answerMsg, resultMsg, turnMsg]);
      await updateGameState(newState);
      setCurrentInputAction(null);
      setInputValue("");
    }
    setIsSubmitting(false);
  };

  const handleDareComplete = async () => {
    if (isSubmitting || !roomId || !user) return;
    setIsSubmitting(true);

    let photoUrl = null;
    if (darePhoto) {
      // In real app, upload here. Mocking for stability in single file.
      photoUrl = "https://placehold.co/400x300?text=Proof+Image";
    }

    const questionMsg = [...messagesRef.current].reverse().find((m) => m.content.question);
    const question = questionMsg?.content.question || "";

    const completionMsg: Omit<ChatMessage, "id" | "created_at"> = {
      sender: myPlayerIndex === 0 ? "player1" : "player2",
      sender_name: playerName,
      message_type: "text",
      content: { text: photoUrl ? "✅ I completed the dare! 📸" : "✅ I completed the dare!" },
    };

    const resultMsg: Omit<ChatMessage, "id" | "created_at"> = {
      sender: "system",
      message_type: "result",
      content: {
        text: "🔥 DARE COMPLETED",
        question,
        answer: photoUrl ? "✅ Dare completed with proof!" : "✅ Dare completed!",
        answeredBy: playerName,
        questionType: "dare",
        proofPhotoUrl: photoUrl || undefined,
      },
    };

    // SWITCH TURN
    const currentState = gameStateRef.current;
    const nextIndex = (currentState.currentPlayerIndex + 1) % currentState.players.length;
    const nextPlayer = currentState.players[nextIndex];

    const updatedPlayers = currentState.players.map((p, idx) =>
      idx === myPlayerIndex ? { ...p, points: p.points + POINTS.DARE_COMPLETED } : p,
    );

    const newState: GameState = {
      ...currentState,
      players: updatedPlayers,
      currentPlayerIndex: nextIndex,
      currentType: undefined,
      roundCount: currentState.roundCount + 1,
      truthCount: currentState.truthCount,
      dareCount: currentState.dareCount + 1,
    };

    const turnMsg: Omit<ChatMessage, "id" | "created_at"> = {
      sender: "system",
      message_type: "buttons",
      content: createTurnMessageContent(nextPlayer.name, nextPlayer.id, newState.truthCount, newState.dareCount, true),
    };

    await saveMessages([completionMsg, resultMsg, turnMsg]);
    await updateGameState(newState);
    setCurrentInputAction(null);
    setDarePhoto(null);
    setDarePhotoPreview(null);
    setIsSubmitting(false);
  };

  const handleSkip = async () => {
    if (isSubmitting || !roomId || !user) return;

    const currentState = gameStateRef.current;
    const currentPlayerData = currentState.players[myPlayerIndex];
    if (!currentPlayerData || currentPlayerData.skipsLeft <= 0) {
      alert("No skips left!");
      return;
    }

    setIsSubmitting(true);

    const questionMsg = [...messagesRef.current].reverse().find((m) => m.content.question);
    const question = questionMsg?.content.question || "";

    const skipMsg: Omit<ChatMessage, "id" | "created_at"> = {
      sender: myPlayerIndex === 0 ? "player1" : "player2",
      sender_name: playerName,
      message_type: "text",
      content: { text: "⏭️ I skip this one!" },
    };

    const resultMsg: Omit<ChatMessage, "id" | "created_at"> = {
      sender: "system",
      message_type: "result",
      content: {
        text: "⏭️ SKIPPED",
        question,
        answer: `${playerName} used a skip (${currentPlayerData.skipsLeft - 1} left)`,
        answeredBy: playerName,
        questionType: gameState.currentType,
      },
    };

    // SWITCH TURN
    const nextIndex = (currentState.currentPlayerIndex + 1) % currentState.players.length;
    const nextPlayer = currentState.players[nextIndex];
    const updatedPlayers = currentState.players.map((p, idx) =>
      idx === myPlayerIndex
        ? { ...p, skipsLeft: p.skipsLeft - 1, points: Math.max(0, p.points + POINTS.SKIP_PENALTY) }
        : p,
    );

    const newState: GameState = {
      ...currentState,
      players: updatedPlayers,
      currentPlayerIndex: nextIndex,
      currentType: undefined,
      roundCount: currentState.roundCount + 1,
      truthCount: currentState.truthCount,
      dareCount: currentState.dareCount,
    };

    const turnMsg: Omit<ChatMessage, "id" | "created_at"> = {
      sender: "system",
      message_type: "buttons",
      content: createTurnMessageContent(nextPlayer.name, nextPlayer.id, newState.truthCount, newState.dareCount, true),
    };

    await saveMessages([skipMsg, resultMsg, turnMsg]);
    await updateGameState(newState);
    setCurrentInputAction(null);
    setIsSubmitting(false);
  };

  const createRoom = async () => {
    if (!user) return;
    const validation = validatePlayerName(playerName);
    if (!validation.success) {
      alert(validation.error);
      return;
    }

    const code = generateRoomCode();
    const initialState: GameState = {
      players: [{ id: user.uid, name: validation.value!, skipsLeft: 2, points: 0 }],
      currentPlayerIndex: 0,
      roundCount: 0,
      truthCount: 0,
      dareCount: 0,
    };

    const roomDoc = await addDoc(collection(db, "artifacts", appId, "public", "data"), {
      type: "tod_room",
      room_code: code,
      game_state: initialState,
      status: "waiting",
      created_at: serverTimestamp(),
    });

    setRoomCode(code);
    setRoomId(roomDoc.id);
    setGameState(initialState);
    setMode("waiting");
  };

  const joinRoom = async () => {
    if (!user) return;
    const nameVal = validatePlayerName(playerName);
    if (!nameVal.success) {
      alert(nameVal.error);
      return;
    }
    const codeVal = validateRoomCode(inputCode);
    if (!codeVal.success) {
      alert(codeVal.error);
      return;
    }

    // Fetch by code using 'where'
    const { getDocs } = await import("firebase/firestore");
    const roomQuery = query(
      collection(db, "artifacts", appId, "public", "data"),
      where("room_code", "==", codeVal.value),
    );
    const querySnapshot = await getDocs(roomQuery);

    if (querySnapshot.empty) {
      alert("Room not found");
      return;
    }

    const roomDoc = querySnapshot.docs[0];
    const data = roomDoc.data();

    if (data.status !== "waiting") {
      alert("Game already started or full");
      return;
    }

    const currentState = data.game_state as GameState;
    if (currentState.players.length >= 2) {
      alert("Room full");
      return;
    }

    currentState.players.push({ id: user.uid, name: nameVal.value!, skipsLeft: 2, points: 0 });

    await updateDoc(roomDoc.ref, {
      game_state: currentState,
      status: "playing",
    });

    setRoomId(roomDoc.id);
    setRoomCode(codeVal.value!);
    setGameState(currentState);
    setPartnerName(currentState.players[0].name);

    const welcomeMsg: Omit<ChatMessage, "id" | "created_at"> = {
      sender: "system",
      message_type: "text",
      content: { text: `🎉 Welcome!`, subtext: `${currentState.players[0].name} 🤝 ${nameVal.value!}` },
    };
    const turnMsg: Omit<ChatMessage, "id" | "created_at"> = {
      sender: "system",
      message_type: "buttons",
      content: createTurnMessageContent(currentState.players[0].name, currentState.players[0].id, 0, 0, true),
    };

    await saveMessages([welcomeMsg, turnMsg]);
    setMode("playing");
  };

  // --- Rendering UI ---

  const shouldShowButtonsForMessage = (msg: ChatMessage, allMessages: ChatMessage[]): boolean => {
    if (msg.message_type !== "buttons" || !msg.content.buttons || msg.disabled) return false;
    const latestButtonsMsg = [...allMessages]
      .reverse()
      .find((m) => m.message_type === "buttons" && !m.disabled && m.content.buttons);
    if (!latestButtonsMsg || latestButtonsMsg.id !== msg.id) return false;
    const forPlayerId = msg.content.forPlayerId;
    return forPlayerId === user?.uid;
  };

  const renderMessage = (msg: ChatMessage) => {
    const isSystem = msg.sender === "system";
    const isMe = (msg.sender === "player1" && myPlayerIndex === 0) || (msg.sender === "player2" && myPlayerIndex === 1);

    if (isSystem) {
      return (
        <div key={msg.id} className="flex justify-center my-3 animate-in slide-in-from-bottom-2">
          <div className="max-w-[90%] w-full bg-pink-50/90 backdrop-blur border border-pink-200 rounded-2xl p-4 shadow-sm">
            {msg.message_type === "buttons" && (
              <div className="space-y-3 text-center">
                <p className="font-semibold text-gray-800">{msg.content.text}</p>
                {msg.content.subtext && <p className="text-xs text-gray-500">{msg.content.subtext}</p>}

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
                              : "bg-gray-200 text-gray-800"
                        }
                      >
                        {btn.label}
                      </Button>
                    ))}
                  </div>
                ) : msg.disabled ? (
                  <p className="text-xs text-green-600 font-medium mt-1">✓ Selection made</p>
                ) : (
                  <p className="text-xs text-gray-400 italic mt-1">Waiting for player...</p>
                )}
              </div>
            )}
            {msg.message_type === "input" && (
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl">{msg.content.text?.includes("TRUTH") ? "💬" : "🔥"}</span>
                  <span
                    className={`font-bold text-sm tracking-wide ${msg.content.text?.includes("TRUTH") ? "text-pink-600" : "text-orange-600"}`}
                  >
                    {msg.content.text}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{msg.content.subtext}</p>
                {msg.content.question && (
                  <div className="bg-white/50 p-3 rounded-xl border border-pink-100 mt-2">
                    <p className="font-medium text-gray-800">{msg.content.question}</p>
                  </div>
                )}
              </div>
            )}
            {msg.message_type === "result" && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl">✨</span>
                  <span className="font-bold text-sm text-gray-800">{msg.content.text}</span>
                </div>
                <div className="space-y-2">
                  <div className="bg-white/50 p-2 rounded-lg">
                    <p className="text-[10px] uppercase text-gray-400">Question</p>
                    <p className="text-sm text-gray-800">{msg.content.question}</p>
                  </div>
                  <div className="bg-green-50 p-2 rounded-lg border border-green-100">
                    <p className="text-[10px] uppercase text-green-600">Answer by {msg.content.answeredBy}</p>
                    <p className="text-sm font-medium text-gray-800">{msg.content.answer}</p>
                  </div>
                  {msg.content.proofPhotoUrl && (
                    <div className="mt-2 text-center">
                      <p className="text-xs text-purple-500 mb-1">📸 Photo Proof</p>
                      <img
                        src={msg.content.proofPhotoUrl}
                        className="max-h-32 rounded-lg mx-auto border border-gray-200"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            {msg.message_type === "text" && (
              <div className="text-center">
                <p className="text-sm text-gray-800">{msg.content.text}</p>
                {msg.content.subtext && <p className="text-xs text-gray-400 mt-1">{msg.content.subtext}</p>}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} className={`flex my-2 ${isMe ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm ${isMe ? "bg-pink-500 text-white rounded-br-none" : "bg-white text-gray-800 rounded-bl-none border border-gray-100"}`}
        >
          {msg.sender_name && !isMe && <p className="text-[10px] font-bold text-pink-500 mb-1">{msg.sender_name}</p>}
          {msg.message_type === "text" && <p className="text-sm">{msg.content.text}</p>}
        </div>
      </div>
    );
  };

  // --- Main Render ---

  if (mode === "menu") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 bg-pink-50/30">
        {renderFloatingHearts()}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Heart className="w-12 h-12 text-pink-500 fill-pink-500 animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Friends Truth & Dare
          </h1>
          <p className="text-gray-500">Fun game for close friends 💕</p>
        </div>

        <div className="w-full max-w-xs space-y-4">
          <Button
            className="w-full h-12 text-lg bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg"
            onClick={() => setMode("create")}
          >
            <Sparkles className="w-5 h-5 mr-2" /> Create Room
          </Button>
          <Button
            variant="outline"
            className="w-full h-12 text-lg border-pink-200 text-pink-700 hover:bg-pink-50"
            onClick={() => setMode("join")}
          >
            <Users className="w-5 h-5 mr-2" /> Join Room
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "create" || mode === "join") {
    return (
      <div className="flex flex-col h-full p-6 bg-white">
        <Button variant="ghost" onClick={() => setMode("menu")} className="self-start mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 max-w-sm mx-auto w-full">
          <h2 className="text-2xl font-bold text-gray-800">{mode === "create" ? "Create a Room" : "Join a Room"}</h2>

          {mode === "join" && (
            <div className="w-full space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Room Code</label>
              <Input
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 4))}
                className="text-center text-2xl tracking-[0.5em] font-mono h-14 uppercase"
                placeholder="ABCD"
              />
            </div>
          )}

          <div className="w-full space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase">Your Name</label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="text-center text-lg h-12"
              placeholder="Enter your name"
            />
          </div>

          <Button
            className="w-full h-12 text-lg mt-4 bg-pink-600 hover:bg-pink-700"
            onClick={mode === "create" ? createRoom : joinRoom}
          >
            {mode === "create" ? "Start Game" : "Join Game"}
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 bg-pink-50/50">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-800">Waiting for friend...</h2>
          <p className="text-gray-500 text-sm">Share this code with your partner</p>
        </div>

        <button
          onClick={copyRoomCode}
          className="bg-white px-8 py-6 rounded-3xl shadow-sm border border-pink-100 flex flex-col items-center gap-2 transition-transform active:scale-95"
        >
          <span className="text-4xl font-mono font-bold text-pink-600 tracking-widest">{roomCode}</span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Copy className="w-3 h-3" /> Tap to copy
          </span>
        </button>

        <div className="w-full max-w-xs bg-white/50 rounded-xl p-4 border border-white">
          <p className="text-xs font-bold text-gray-400 uppercase mb-2">Players Joined</p>
          <div className="space-y-2">
            {gameState.players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-gray-800">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                {p.name} {p.id === user?.uid && <span className="text-gray-400 text-xs">(You)</span>}
              </div>
            ))}
            {gameState.players.length === 0 && <p className="text-gray-400 text-sm italic">Loading...</p>}
          </div>
        </div>

        <Button variant="ghost" onClick={leaveGame} className="text-gray-400 hover:text-red-500">
          Cancel
        </Button>
      </div>
    );
  }

  // Playing Mode
  const shouldShowInput = !!currentInputAction;

  return (
    <div
      className={`flex flex-col h-full bg-gray-50 overflow-hidden ${keyboardVisible ? "max-h-[calc(100dvh-80px)]" : ""}`}
    >
      {renderFloatingHearts()}

      {/* Header */}
      <div className="h-16 bg-white border-b border-gray-100 flex items-center px-4 justify-between shrink-0 shadow-sm z-10">
        <Button variant="ghost" size="sm" onClick={leaveGame}>
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Button>
        <div className="text-center">
          <p className="font-bold text-gray-800 text-sm">
            {playerName} <span className="text-pink-500">vs</span> {partnerName}
          </p>
          <div className="flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-[10px] text-gray-500">Round {gameState.roundCount + 1}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-gray-400">PTS</span>
          <span className="text-sm font-bold text-pink-600">{gameState.players[myPlayerIndex]?.points || 0}</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth" ref={chatContainerRef}>
        {messages.map((msg) => renderMessage(msg))}
        {messages.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Game started! Waiting for the first move...
          </div>
        )}
        <div className="h-4" /> {/* Spacer */}
      </div>

      {/* Input Area */}
      {shouldShowInput && (
        <div className="shrink-0 bg-white p-4 border-t border-gray-100 animate-in slide-in-from-bottom-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {currentInputAction === "complete_dare" ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase">Timer</span>
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
                    className="h-12 border-dashed border-2 border-gray-300 text-gray-500"
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
                <div className="relative rounded-xl overflow-hidden border border-gray-200 h-32 bg-black">
                  <img src={darePhotoPreview} className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center gap-2">
                    <Button size="sm" variant="secondary" onClick={clearPhoto}>
                      Retake
                    </Button>
                    <Button size="sm" className="bg-green-500 text-white" onClick={handleDareComplete}>
                      Send Proof
                    </Button>
                  </div>
                </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoSelect} />

              {gameState.players[myPlayerIndex]?.skipsLeft > 0 && (
                <button
                  onClick={handleSkip}
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Skip Dare (-5 pts, {gameState.players[myPlayerIndex]?.skipsLeft} left)
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 ml-1 uppercase">
                {currentInputAction === "submit_question" ? `Ask ${partnerName || "Opponent"}` : "Your Answer"}
              </p>
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInputSubmit()}
                  placeholder={
                    currentInputAction === "submit_question" ? "Type your question..." : "Type your answer..."
                  }
                  className="h-12 text-lg bg-gray-50 border-gray-200 focus:bg-white transition-all"
                  autoFocus
                />
                <Button
                  onClick={handleInputSubmit}
                  disabled={!inputValue.trim() || isSubmitting}
                  className="h-12 w-12 rounded-xl bg-pink-500 hover:bg-pink-600 shrink-0"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
              {currentInputAction === "submit_answer" && gameState.players[myPlayerIndex]?.skipsLeft > 0 && (
                <button
                  onClick={handleSkip}
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-600 underline"
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
