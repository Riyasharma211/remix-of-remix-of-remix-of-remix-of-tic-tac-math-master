import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Swords, Users, Copy, Check, Play, Trophy, Clock, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateFireworks } from '@/utils/confetti';
import { useToast } from '@/hooks/use-toast';

type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'playing' | 'ended';
type Operator = '+' | '-' | '×';

interface Problem {
  num1: number;
  num2: number;
  operator: Operator;
  answer: number;
}

interface GameState {
  problem: Problem | null;
  scores: { player1: number; player2: number };
  round: number;
  maxRounds: number;
  status: 'waiting' | 'playing' | 'ended';
  winner: string | null;
}

const generateProblem = (): Problem => {
  const operators: Operator[] = ['+', '-', '×'];
  const operator = operators[Math.floor(Math.random() * operators.length)];
  
  let num1: number, num2: number, answer: number;
  
  switch (operator) {
    case '+':
      num1 = Math.floor(Math.random() * 50) + 1;
      num2 = Math.floor(Math.random() * 50) + 1;
      answer = num1 + num2;
      break;
    case '-':
      num1 = Math.floor(Math.random() * 50) + 20;
      num2 = Math.floor(Math.random() * num1) + 1;
      answer = num1 - num2;
      break;
    case '×':
      num1 = Math.floor(Math.random() * 12) + 1;
      num2 = Math.floor(Math.random() * 12) + 1;
      answer = num1 * num2;
      break;
    default:
      num1 = 1;
      num2 = 1;
      answer = 2;
  }
  
  return { num1, num2, operator, answer };
};

const generateOptions = (answer: number): number[] => {
  const options = new Set<number>([answer]);
  while (options.size < 4) {
    const offset = Math.floor(Math.random() * 20) - 10;
    const option = Math.max(0, answer + offset);
    if (option !== answer) options.add(option);
  }
  return Array.from(options).sort(() => Math.random() - 0.5);
};

const MathBattle: React.FC = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [playerNumber, setPlayerNumber] = useState<1 | 2>(1);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [options, setOptions] = useState<number[]>([]);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  const [round, setRound] = useState(0);
  const [maxRounds] = useState(10);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const createRoom = async () => {
    const code = generateRoomCode();
    setRoomCode(code);
    setPlayerNumber(1);
    
    const initialProblem = generateProblem();
    
    try {
      await supabase.from('game_rooms').insert([{
        room_code: code,
        game_type: 'mathbattle',
        game_state: JSON.parse(JSON.stringify({
          problem: initialProblem,
          options: generateOptions(initialProblem.answer),
          scores: { player1: 0, player2: 0 },
          round: 1,
          maxRounds: 10,
          status: 'waiting',
          answered: { player1: false, player2: false }
        })),
        status: 'waiting'
      }]);
      
      setMode('waiting');
      toast({ title: 'Room Created!', description: 'Share the code with a friend' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create room' });
    }
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', joinCode.toUpperCase())
        .single();
      
      if (error || !data) {
        toast({ variant: 'destructive', title: 'Error', description: 'Room not found' });
        return;
      }
      
      const currentState = data.game_state as unknown as GameState & { options?: number[]; answered?: { player1: boolean; player2: boolean } };
      
      await supabase
        .from('game_rooms')
        .update({
          player_count: 2,
          status: 'playing',
          game_state: JSON.parse(JSON.stringify({ ...currentState, status: 'playing' }))
        })
        .eq('room_code', joinCode.toUpperCase());
      
      setRoomCode(joinCode.toUpperCase());
      setPlayerNumber(2);
      setMode('playing');
      setProblem(currentState.problem);
      setOptions(currentState.options || []);
      setScores(currentState.scores);
      setRound(currentState.round);
      toast({ title: 'Joined!', description: 'Game is starting...' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to join room' });
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Subscribe to room changes
  useEffect(() => {
    if (!roomCode || (mode !== 'waiting' && mode !== 'playing')) return;

    const channel = supabase
      .channel(`mathbattle-${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms',
          filter: `room_code=eq.${roomCode}`
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData?.game_state) {
            const gs = newData.game_state;
            
            if (gs.status === 'playing' && mode === 'waiting') {
              setMode('playing');
              toast({ title: 'Player Joined!', description: 'Game is starting!' });
            }
            
            setProblem(gs.problem);
            setOptions(gs.options || []);
            setScores(gs.scores);
            setRound(gs.round);
            
            // Reset answered state for new round
            const playerKey = playerNumber === 1 ? 'player1' : 'player2';
            if (gs.answered && !gs.answered[playerKey]) {
              setHasAnswered(false);
              setFeedback(null);
            }
            
            if (gs.status === 'ended') {
              setMode('ended');
              setWinner(gs.winner);
              const isWinner = gs.winner === `Player ${playerNumber}`;
              soundManager.playLocalSound(isWinner ? 'win' : 'lose');
              if (isWinner) {
                haptics.success();
                celebrateFireworks();
              } else {
                haptics.error();
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, mode, playerNumber]);

  const handleAnswer = async (answer: number) => {
    if (!problem || hasAnswered) return;
    
    setHasAnswered(true);
    const isCorrect = answer === problem.answer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    soundManager.playLocalSound(isCorrect ? 'correct' : 'wrong');
    
    const { data } = await supabase
      .from('game_rooms')
      .select('game_state')
      .eq('room_code', roomCode)
      .single();
    
    if (!data) return;
    
    const currentState = data.game_state as any;
    const playerKey = playerNumber === 1 ? 'player1' : 'player2';
    
    const newScores = { ...currentState.scores };
    if (isCorrect) {
      newScores[playerKey] += 10;
    }
    
    const newAnswered = { ...currentState.answered, [playerKey]: true };
    
    // Check if both players answered
    const bothAnswered = newAnswered.player1 && newAnswered.player2;
    
    let newState: any = {
      ...currentState,
      scores: newScores,
      answered: newAnswered,
    };
    
    if (bothAnswered) {
      if (currentState.round >= currentState.maxRounds) {
        // Game over
        const winner = newScores.player1 > newScores.player2 ? 'Player 1' :
                       newScores.player2 > newScores.player1 ? 'Player 2' : 'Tie';
        newState.status = 'ended';
        newState.winner = winner;
      } else {
        // Next round
        const newProblem = generateProblem();
        newState.round = currentState.round + 1;
        newState.problem = newProblem;
        newState.options = generateOptions(newProblem.answer);
        newState.answered = { player1: false, player2: false };
      }
    }
    
    await supabase
      .from('game_rooms')
      .update({ game_state: newState })
      .eq('room_code', roomCode);
  };

  const leaveGame = async () => {
    if (roomCode) {
      await supabase.from('game_rooms').delete().eq('room_code', roomCode);
    }
    setMode('menu');
    setRoomCode('');
    setProblem(null);
    setScores({ player1: 0, player2: 0 });
    setRound(0);
    setHasAnswered(false);
    setWinner(null);
  };

  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <Swords className="w-16 h-16 text-neon-orange animate-float" />
        <h2 className="font-orbitron text-2xl text-foreground">Math Battle</h2>
        <p className="text-muted-foreground font-rajdhani text-center max-w-xs">
          Race against a friend to solve math problems!
        </p>
        
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Button variant="game" size="lg" onClick={() => setMode('create')}>
            <Users className="w-5 h-5" />
            Create Battle
          </Button>
          <Button variant="outline" size="lg" onClick={() => setMode('join')}>
            Join Battle
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <h2 className="font-orbitron text-xl">Create Math Battle</h2>
        <Button variant="game" size="lg" onClick={createRoom}>
          Create Room
        </Button>
        <Button variant="ghost" onClick={() => setMode('menu')}>Back</Button>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <h2 className="font-orbitron text-xl">Join Math Battle</h2>
        <div className="flex gap-3 w-full max-w-xs">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter room code"
            className="font-orbitron text-center uppercase"
            maxLength={6}
          />
          <Button variant="neon" onClick={joinRoom}>Join</Button>
        </div>
        <Button variant="ghost" onClick={() => setMode('menu')}>Back</Button>
      </div>
    );
  }

  if (mode === 'waiting') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <Swords className="w-12 h-12 text-neon-orange animate-pulse" />
        <h2 className="font-orbitron text-xl">Waiting for Opponent...</h2>
        
        <div className="flex items-center gap-2 p-4 bg-card rounded-xl border border-border">
          <span className="font-orbitron text-2xl tracking-widest text-neon-cyan">{roomCode}</span>
          <Button variant="ghost" size="icon" onClick={copyRoomCode}>
            {copied ? <Check className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        
        <Button variant="ghost" onClick={leaveGame}>Cancel</Button>
      </div>
    );
  }

  if (mode === 'playing' && problem) {
    return (
      <div className="flex flex-col items-center gap-6 w-full animate-slide-in">
        {/* Scores */}
        <div className="flex justify-between w-full px-4">
          <div className={`text-center p-3 rounded-xl border-2 ${playerNumber === 1 ? 'border-neon-cyan bg-neon-cyan/10' : 'border-border'}`}>
            <span className="text-xs text-muted-foreground font-rajdhani">P1 {playerNumber === 1 && '(You)'}</span>
            <p className="font-orbitron text-2xl text-neon-cyan">{scores.player1}</p>
          </div>
          
          <div className="text-center">
            <span className="text-muted-foreground font-rajdhani text-sm">Round</span>
            <p className="font-orbitron text-xl">{round}/{maxRounds}</p>
          </div>
          
          <div className={`text-center p-3 rounded-xl border-2 ${playerNumber === 2 ? 'border-neon-pink bg-neon-pink/10' : 'border-border'}`}>
            <span className="text-xs text-muted-foreground font-rajdhani">P2 {playerNumber === 2 && '(You)'}</span>
            <p className="font-orbitron text-2xl text-neon-pink">{scores.player2}</p>
          </div>
        </div>

        {/* Problem */}
        <div className={`text-center p-8 rounded-2xl border-2 transition-all w-full
          ${feedback === 'correct' ? 'border-neon-green bg-neon-green/10' :
            feedback === 'wrong' ? 'border-destructive bg-destructive/10' :
            'border-border bg-card'}`}
        >
          <span className="font-orbitron text-4xl text-foreground">
            {problem.num1} {problem.operator} {problem.num2} = ?
          </span>
        </div>

        {/* Status */}
        {hasAnswered && (
          <span className="font-rajdhani text-muted-foreground animate-pulse">
            Waiting for opponent...
          </span>
        )}

        {/* Options */}
        <div className="grid grid-cols-2 gap-4 w-full">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(option)}
              disabled={hasAnswered}
              className={`p-4 rounded-xl border-2 font-orbitron text-2xl transition-all
                ${hasAnswered 
                  ? option === problem.answer 
                    ? 'border-neon-green bg-neon-green/20' 
                    : 'border-border bg-card opacity-50'
                  : 'border-border bg-card hover:border-primary cursor-pointer'
                }`}
            >
              {option}
            </button>
          ))}
        </div>

        <Button variant="ghost" onClick={leaveGame}>Leave</Button>
      </div>
    );
  }

  if (mode === 'ended') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <Trophy className="w-16 h-16 text-neon-orange" />
        <h2 className="font-orbitron text-3xl text-foreground">
          {winner === 'Tie' ? "It's a Tie!" : `${winner} Wins!`}
        </h2>
        
        <div className="flex gap-8">
          <div className="text-center">
            <span className="text-muted-foreground font-rajdhani">Player 1</span>
            <p className="font-orbitron text-3xl text-neon-cyan">{scores.player1}</p>
          </div>
          <div className="text-center">
            <span className="text-muted-foreground font-rajdhani">Player 2</span>
            <p className="font-orbitron text-3xl text-neon-pink">{scores.player2}</p>
          </div>
        </div>
        
        <Button variant="game" size="lg" onClick={leaveGame}>
          Play Again
        </Button>
      </div>
    );
  }

  return null;
};

export default MathBattle;
