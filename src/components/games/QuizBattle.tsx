import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HelpCircle, Users, Copy, Check, Play, Trophy, Clock, ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateFireworks } from '@/utils/confetti';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';

type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'playing' | 'ended';

interface Question {
  question: string;
  options: string[];
  correct: number;
  category: string;
}

interface GameState {
  currentQuestion: Question | null;
  questionIndex: number;
  scores: { player1: number; player2: number };
  answered: { player1: number | null; player2: number | null };
  status: 'waiting' | 'playing' | 'revealing' | 'ended';
  winner: string | null;
  playerNames: { player1: string; player2: string };
  totalQuestions: number;
}

const QUESTIONS: Question[] = [
  { question: "What is the capital of France?", options: ["London", "Paris", "Berlin", "Madrid"], correct: 1, category: "Geography" },
  { question: "Which planet is known as the Red Planet?", options: ["Venus", "Jupiter", "Mars", "Saturn"], correct: 2, category: "Science" },
  { question: "What is 15 × 8?", options: ["110", "120", "125", "130"], correct: 1, category: "Math" },
  { question: "Who painted the Mona Lisa?", options: ["Van Gogh", "Picasso", "Da Vinci", "Monet"], correct: 2, category: "Art" },
  { question: "What is the largest ocean?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correct: 3, category: "Geography" },
  { question: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], correct: 1, category: "Math" },
  { question: "What is the chemical symbol for Gold?", options: ["Go", "Gd", "Au", "Ag"], correct: 2, category: "Science" },
  { question: "Which country has the most population?", options: ["USA", "India", "China", "Brazil"], correct: 2, category: "Geography" },
  { question: "What year did World War II end?", options: ["1943", "1944", "1945", "1946"], correct: 2, category: "History" },
  { question: "What is the square root of 144?", options: ["10", "11", "12", "13"], correct: 2, category: "Math" },
  { question: "Which element has the symbol 'O'?", options: ["Gold", "Osmium", "Oxygen", "Oganesson"], correct: 2, category: "Science" },
  { question: "What is the longest river in the world?", options: ["Amazon", "Nile", "Yangtze", "Mississippi"], correct: 1, category: "Geography" },
  { question: "Who wrote 'Romeo and Juliet'?", options: ["Dickens", "Shakespeare", "Austen", "Hemingway"], correct: 1, category: "Literature" },
  { question: "What is 256 ÷ 16?", options: ["14", "15", "16", "17"], correct: 2, category: "Math" },
  { question: "Which animal is known as the King of the Jungle?", options: ["Tiger", "Elephant", "Lion", "Gorilla"], correct: 2, category: "Nature" },
];

const QuizBattle: React.FC = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [copied, setCopied] = useState(false);
  const [playerNumber, setPlayerNumber] = useState<1 | 2>(1);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  const [answered, setAnswered] = useState<{ player1: number | null; player2: number | null }>({ player1: null, player2: null });
  const [winner, setWinner] = useState<string | null>(null);
  const [playerNames, setPlayerNames] = useState({ player1: '', player2: '' });
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [questions, setQuestions] = useState<Question[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const shuffleQuestions = () => {
    const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10);
  };

  const createRoom = async () => {
    if (!playerName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your name' });
      return;
    }
    
    const code = generateRoomCode();
    const gameQuestions = shuffleQuestions();
    
    const initialState: GameState = {
      currentQuestion: gameQuestions[0],
      questionIndex: 0,
      scores: { player1: 0, player2: 0 },
      answered: { player1: null, player2: null },
      status: 'waiting',
      winner: null,
      playerNames: { player1: playerName, player2: '' },
      totalQuestions: 10,
    };

    const { data, error } = await supabase
      .from('game_rooms')
      .insert({
        room_code: code,
        game_type: 'quizbattle',
        game_state: { ...initialState, questions: gameQuestions } as any,
        status: 'waiting',
        player_count: 1,
        max_players: 2,
      })
      .select()
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create room' });
      return;
    }

    setRoomCode(code);
    setRoomId(data.id);
    setPlayerNumber(1);
    setPlayerNames({ player1: playerName, player2: '' });
    setQuestions(gameQuestions);
    setCurrentQuestion(gameQuestions[0]);
    setMode('waiting');
    soundManager.playLocalSound('click');
    haptics.light();
    
    setupRealtimeChannel(data.id, 1);
  };

  const joinRoom = async () => {
    if (!playerName.trim() || !joinCode.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your name and room code' });
      return;
    }

    const { data: room, error } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('room_code', joinCode.toUpperCase())
      .eq('game_type', 'quizbattle')
      .single();

    if (error || !room) {
      toast({ variant: 'destructive', title: 'Error', description: 'Room not found' });
      return;
    }

    if (room.player_count >= 2) {
      toast({ variant: 'destructive', title: 'Error', description: 'Room is full' });
      return;
    }

    const currentState = room.game_state as any;
    const updatedState = {
      ...currentState,
      playerNames: { ...currentState.playerNames, player2: playerName },
      status: 'playing',
    };

    await supabase
      .from('game_rooms')
      .update({ 
        player_count: 2, 
        game_state: updatedState,
        status: 'playing'
      })
      .eq('id', room.id);

    setRoomCode(joinCode.toUpperCase());
    setRoomId(room.id);
    setPlayerNumber(2);
    setPlayerNames(updatedState.playerNames);
    setQuestions(currentState.questions);
    setCurrentQuestion(currentState.currentQuestion);
    setMode('playing');
    setTimeLeft(10);
    soundManager.playLocalSound('start');
    haptics.success();
    
    setupRealtimeChannel(room.id, 2);
  };

  const setupRealtimeChannel = (roomId: string, player: 1 | 2) => {
    const channel = supabase
      .channel(`quizbattle-${roomId}`)
      .on('broadcast', { event: 'game_update' }, ({ payload }) => {
        setCurrentQuestion(payload.currentQuestion);
        setQuestionIndex(payload.questionIndex);
        setScores(payload.scores);
        setAnswered(payload.answered);
        setPlayerNames(payload.playerNames);
        
        if (payload.status === 'ended') {
          setWinner(payload.winner);
          setMode('ended');
          if (payload.winner === (player === 1 ? payload.playerNames.player1 : payload.playerNames.player2)) {
            soundManager.playLocalSound('win');
            haptics.success();
            celebrateFireworks();
          } else if (payload.winner === 'Tie') {
            soundManager.playLocalSound('correct');
            haptics.light();
          } else {
            soundManager.playLocalSound('lose');
            haptics.error();
          }
        } else if (payload.status === 'revealing') {
          setShowResult(true);
        } else if (payload.status === 'playing' && payload.questionIndex !== questionIndex) {
          // New question
          setShowResult(false);
          setSelectedAnswer(null);
          setTimeLeft(10);
        }
      })
      .on('broadcast', { event: 'game_start' }, ({ payload }) => {
        setMode('playing');
        setPlayerNames(payload.playerNames);
        setTimeLeft(10);
        soundManager.playLocalSound('start');
        haptics.success();
      })
      .on('broadcast', { event: 'answer' }, ({ payload }) => {
        setAnswered(prev => ({
          ...prev,
          [payload.player === 1 ? 'player1' : 'player2']: payload.answer,
        }));
      })
      .on('broadcast', { event: 'game_left' }, () => {
        toast({ title: 'Game ended', description: 'Other player left the game' });
        leaveGame();
      })
      .subscribe();

    channelRef.current = channel;
  };

  // Timer effect
  useEffect(() => {
    if (mode !== 'playing' || showResult) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-submit if not answered
          if (selectedAnswer === null) {
            handleAnswer(-1); // -1 means no answer
          }
          return 0;
        }
        if (prev <= 4) {
          soundManager.playLocalSound('tick');
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode, showResult, selectedAnswer]);

  const handleAnswer = async (answerIndex: number) => {
    if (selectedAnswer !== null || !roomId || !currentQuestion) return;

    setSelectedAnswer(answerIndex);
    haptics.light();

    const isCorrect = answerIndex === currentQuestion.correct;
    if (isCorrect) {
      soundManager.playLocalSound('correct');
    } else {
      soundManager.playLocalSound('wrong');
    }

    // Broadcast answer
    channelRef.current?.send({
      type: 'broadcast',
      event: 'answer',
      payload: { player: playerNumber, answer: answerIndex },
    });

    // Update local answered state
    const newAnswered = {
      ...answered,
      [playerNumber === 1 ? 'player1' : 'player2']: answerIndex,
    };
    setAnswered(newAnswered);

    // Check if both players answered
    const otherPlayerKey = playerNumber === 1 ? 'player2' : 'player1';
    if (newAnswered[otherPlayerKey] !== null || playerNumber === 1) {
      // Small delay then check if we should reveal
      setTimeout(() => checkBothAnswered(newAnswered), 500);
    }
  };

  const checkBothAnswered = async (currentAnswered: { player1: number | null; player2: number | null }) => {
    if (currentAnswered.player1 !== null && currentAnswered.player2 !== null && roomId && currentQuestion) {
      // Calculate new scores
      const newScores = { ...scores };
      if (currentAnswered.player1 === currentQuestion.correct) {
        newScores.player1 += 10;
      }
      if (currentAnswered.player2 === currentQuestion.correct) {
        newScores.player2 += 10;
      }
      setScores(newScores);
      setShowResult(true);

      // Reveal results
      channelRef.current?.send({
        type: 'broadcast',
        event: 'game_update',
        payload: {
          currentQuestion,
          questionIndex,
          scores: newScores,
          answered: currentAnswered,
          status: 'revealing',
          playerNames,
          totalQuestions: 10,
        },
      });

      // After 2 seconds, move to next question or end game
      setTimeout(() => {
        if (questionIndex >= 9) {
          endGame(newScores);
        } else {
          nextQuestion(newScores);
        }
      }, 2000);
    }
  };

  const nextQuestion = async (currentScores: typeof scores) => {
    if (!roomId) return;
    
    const nextIdx = questionIndex + 1;
    const nextQ = questions[nextIdx];

    const newState = {
      currentQuestion: nextQ,
      questionIndex: nextIdx,
      scores: currentScores,
      answered: { player1: null, player2: null },
      status: 'playing',
      playerNames,
      totalQuestions: 10,
    };

    setQuestionIndex(nextIdx);
    setCurrentQuestion(nextQ);
    setAnswered({ player1: null, player2: null });
    setSelectedAnswer(null);
    setShowResult(false);
    setTimeLeft(10);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_update',
      payload: newState,
    });
  };

  const endGame = async (finalScores: typeof scores) => {
    if (!roomId) return;

    let winnerName: string;
    if (finalScores.player1 > finalScores.player2) {
      winnerName = playerNames.player1;
    } else if (finalScores.player2 > finalScores.player1) {
      winnerName = playerNames.player2;
    } else {
      winnerName = 'Tie';
    }

    const endState = {
      currentQuestion,
      questionIndex,
      scores: finalScores,
      answered,
      status: 'ended',
      winner: winnerName,
      playerNames,
      totalQuestions: 10,
    };

    await supabase.from('game_rooms').update({ 
      game_state: { ...endState, questions } as any,
      status: 'ended'
    }).eq('id', roomId);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_update',
      payload: endState,
    });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    haptics.light();
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveGame = async () => {
    if (roomId) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'game_left',
      });
      await supabase.from('game_rooms').delete().eq('id', roomId);
    }
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    
    setMode('menu');
    setRoomCode('');
    setRoomId(null);
    setJoinCode('');
    setScores({ player1: 0, player2: 0 });
    setWinner(null);
    setSelectedAnswer(null);
    setShowResult(false);
    setQuestionIndex(0);
    setCurrentQuestion(null);
    setTimeLeft(10);
    setAnswered({ player1: null, player2: null });
  };

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Menu Screen
  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-2">
          <HelpCircle className="w-16 h-16 text-neon-purple mx-auto animate-float" />
          <h2 className="font-orbitron text-2xl text-foreground">Quiz Battle</h2>
          <p className="text-muted-foreground font-rajdhani max-w-sm">
            Answer trivia questions head-to-head. Fastest correct answer wins!
          </p>
        </div>

        <Input
          placeholder="Your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="max-w-xs font-rajdhani"
        />

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Button variant="game" size="lg" onClick={createRoom}>
            <Users className="w-5 h-5" />
            Create Game
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground font-rajdhani">or join a game</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="font-orbitron uppercase"
              maxLength={6}
            />
            <Button variant="neon" onClick={joinRoom}>
              <Play className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting Screen
  if (mode === 'waiting') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-2">
          <Users className="w-16 h-16 text-neon-purple mx-auto animate-pulse" />
          <h2 className="font-orbitron text-2xl text-foreground">Waiting for Player 2</h2>
          <p className="text-muted-foreground font-rajdhani">Share this code with your friend</p>
        </div>

        <div className="flex items-center gap-2 p-4 bg-muted rounded-xl">
          <span className="font-orbitron text-3xl text-neon-purple tracking-widest">{roomCode}</span>
          <Button variant="ghost" size="icon" onClick={copyRoomCode}>
            {copied ? <Check className="w-5 h-5 text-neon-green" /> : <Copy className="w-5 h-5" />}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground font-rajdhani">10 trivia questions await!</p>

        <Button variant="ghost" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4" />
          Leave
        </Button>
      </div>
    );
  }

  // Playing Screen
  if (mode === 'playing' && currentQuestion) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-lg animate-slide-in">
        {/* Header */}
        <div className="flex justify-between w-full items-center">
          <div className="text-center">
            <span className="font-rajdhani text-xs text-muted-foreground">{playerNames.player1}</span>
            <p className="font-orbitron text-xl text-neon-cyan">{scores.player1}</p>
          </div>
          
          <div className="text-center">
            <span className="font-rajdhani text-xs text-muted-foreground">Q{questionIndex + 1}/10</span>
            <div className={`flex items-center gap-1 ${timeLeft <= 3 ? 'text-destructive' : 'text-neon-orange'}`}>
              <Clock className="w-4 h-4" />
              <span className="font-orbitron text-lg">{timeLeft}</span>
            </div>
          </div>

          <div className="text-center">
            <span className="font-rajdhani text-xs text-muted-foreground">{playerNames.player2}</span>
            <p className="font-orbitron text-xl text-neon-pink">{scores.player2}</p>
          </div>
        </div>

        {/* Category Badge */}
        <div className="flex items-center gap-2 px-3 py-1 bg-neon-purple/20 rounded-full">
          <Sparkles className="w-4 h-4 text-neon-purple" />
          <span className="font-rajdhani text-sm text-neon-purple">{currentQuestion.category}</span>
        </div>

        {/* Question */}
        <div className="text-center p-6 bg-card rounded-2xl border border-border w-full">
          <p className="font-orbitron text-lg text-foreground">{currentQuestion.question}</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 w-full">
          {currentQuestion.options.map((option, index) => {
            let buttonClass = 'border-border bg-card hover:border-primary';
            
            if (showResult) {
              if (index === currentQuestion.correct) {
                buttonClass = 'border-neon-green bg-neon-green/20';
              } else if (selectedAnswer === index) {
                buttonClass = 'border-destructive bg-destructive/20';
              }
            } else if (selectedAnswer === index) {
              buttonClass = 'border-neon-cyan bg-neon-cyan/20';
            }

            return (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={selectedAnswer !== null}
                className={`p-4 rounded-xl border-2 font-rajdhani text-lg transition-all ${buttonClass}
                  ${selectedAnswer === null ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {/* Status */}
        {selectedAnswer !== null && !showResult && (
          <p className="text-muted-foreground font-rajdhani animate-pulse">Waiting for other player...</p>
        )}

        {showResult && (
          <p className="font-orbitron text-neon-green animate-scale-pop">
            {selectedAnswer === currentQuestion.correct ? '+10 points!' : 'Incorrect!'}
          </p>
        )}

        <Button variant="ghost" size="sm" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4" />
          Leave Game
        </Button>
      </div>
    );
  }

  // Ended Screen
  if (mode === 'ended') {
    const isWinner = winner === (playerNumber === 1 ? playerNames.player1 : playerNames.player2);
    const isTie = winner === 'Tie';

    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-4">
          <Trophy className={`w-20 h-20 mx-auto ${isWinner ? 'text-neon-orange' : isTie ? 'text-neon-purple' : 'text-muted-foreground'}`} />
          <h2 className={`font-orbitron text-3xl ${isWinner ? 'text-neon-green' : isTie ? 'text-neon-purple' : 'text-destructive'}`}>
            {isTie ? "It's a Tie!" : isWinner ? 'You Win!' : 'You Lose!'}
          </h2>
          {!isTie && <p className="text-muted-foreground font-rajdhani">{winner} wins the quiz!</p>}
        </div>

        <div className="flex gap-8">
          <div className="text-center">
            <span className="font-rajdhani text-muted-foreground">{playerNames.player1}</span>
            <p className="font-orbitron text-3xl text-neon-cyan">{scores.player1}</p>
          </div>
          <div className="text-center">
            <span className="font-rajdhani text-muted-foreground">{playerNames.player2}</span>
            <p className="font-orbitron text-3xl text-neon-pink">{scores.player2}</p>
          </div>
        </div>

        <Button variant="game" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4" />
          Back to Menu
        </Button>
      </div>
    );
  }

  return null;
};

export default QuizBattle;
