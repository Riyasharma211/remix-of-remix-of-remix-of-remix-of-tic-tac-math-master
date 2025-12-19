import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Swords, Users, Copy, Check, Play, Trophy, Clock, Zap, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateFireworks } from '@/utils/confetti';
import { useGameChannel } from '@/contexts/GameChannelContext';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  options: number[];
  scores: { player1: number; player2: number };
  round: number;
  maxRounds: number;
  status: 'waiting' | 'playing' | 'ended';
  answered: { player1: boolean; player2: boolean };
  winner: string | null;
  playerNames: { player1: string; player2: string };
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
  const { setChannelRef, setPlayerName: setGlobalPlayerName, setRoomId: setGlobalRoomId } = useGameChannel();
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [copied, setCopied] = useState(false);
  const [playerNumber, setPlayerNumber] = useState<1 | 2>(1);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [options, setOptions] = useState<number[]>([]);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  const [round, setRound] = useState(1);
  const [maxRounds] = useState(10);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [playerNames, setPlayerNames] = useState({ player1: '', player2: '' });
  const channelRef = useRef<RealtimeChannel | null>(null);

  const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const createRoom = async () => {
    if (!playerName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your name' });
      return;
    }
    
    const code = generateRoomCode();
    setRoomCode(code);
    setPlayerNumber(1);
    
    const initialProblem = generateProblem();
    const initialOptions = generateOptions(initialProblem.answer);
    
    const initialState: GameState = {
      problem: initialProblem,
      options: initialOptions,
      scores: { player1: 0, player2: 0 },
      round: 1,
      maxRounds: 10,
      status: 'waiting',
      answered: { player1: false, player2: false },
      winner: null,
      playerNames: { player1: playerName, player2: '' }
    };
    
    try {
      const { data, error } = await supabase.from('game_rooms').insert([{
        room_code: code,
        game_type: 'mathbattle',
        game_state: JSON.parse(JSON.stringify(initialState)),
        status: 'waiting'
      }]).select().single();
      
      if (error) throw error;
      
      setRoomId(data.id);
      setProblem(initialProblem);
      setOptions(initialOptions);
      setPlayerNames({ player1: playerName, player2: '' });
      setMode('waiting');
      haptics.success();
      toast({ title: 'Room Created!', description: 'Share the code with a friend' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create room' });
    }
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) return;
    if (!playerName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your name' });
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', joinCode.toUpperCase())
        .eq('game_type', 'mathbattle')
        .single();
      
      if (error || !data) {
        toast({ variant: 'destructive', title: 'Error', description: 'Room not found' });
        return;
      }
      
      const code = joinCode.toUpperCase();
      const currentState = data.game_state as unknown as GameState;
      
      // Update state with player 2 info
      const updatedState: GameState = {
        ...currentState,
        status: 'playing',
        playerNames: { ...currentState.playerNames, player2: playerName }
      };
      
      await supabase.from('game_rooms')
        .update({ 
          player_count: 2, 
          status: 'playing', 
          game_state: JSON.parse(JSON.stringify(updatedState)) 
        })
        .eq('id', data.id);
      
      setRoomCode(code);
      setRoomId(data.id);
      setPlayerNumber(2);
      setProblem(currentState.problem);
      setOptions(currentState.options || []);
      setScores(currentState.scores);
      setRound(currentState.round);
      setPlayerNames({ ...currentState.playerNames, player2: playerName });
      setMode('playing');
      
      // Broadcast join to host
      const channel = supabase.channel(`mathbattle-${data.id}`);
      await channel.subscribe();
      
      // Update global channel ref
      channelRef.current = channel;
      setChannelRef(channelRef);
      setGlobalPlayerName(playerName);
      setGlobalRoomId(data.id);
      
      await channel.send({
        type: 'broadcast',
        event: 'game_update',
        payload: { 
          type: 'player_joined',
          playerNames: updatedState.playerNames,
          status: 'playing'
        }
      });
      
      haptics.success();
      soundManager.playLocalSound('correct');
      toast({ title: 'Joined!', description: 'Game starting!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to join room' });
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    haptics.light();
    setTimeout(() => setCopied(false), 2000);
  };

  // Subscribe to room changes using broadcast
  useEffect(() => {
    if (!roomId || (mode !== 'waiting' && mode !== 'playing')) return;

    const channel = supabase
      .channel(`mathbattle-${roomId}`, {
        config: { broadcast: { self: true } }
      })
      .on('broadcast', { event: 'game_left' }, () => {
        // Other player left - reset game
        toast({ title: 'Opponent Left', description: 'The game has ended' });
        setMode('menu');
        setRoomCode('');
        setRoomId(null);
        setProblem(null);
        setOptions([]);
        setScores({ player1: 0, player2: 0 });
        setRound(1);
        setHasAnswered(false);
        setWinner(null);
        setFeedback(null);
      })
      .on('broadcast', { event: 'game_update' }, ({ payload }) => {
        if (!payload) return;
        
        // Player joined
        if (payload.type === 'player_joined' && mode === 'waiting') {
          setMode('playing');
          if (payload.playerNames) setPlayerNames(payload.playerNames);
          haptics.success();
          soundManager.playLocalSound('correct');
          toast({ title: 'Player Joined!', description: 'Game starting!' });
        }
        
        // Answer submitted
        if (payload.type === 'answer_submitted') {
          if (payload.scores) setScores(payload.scores);
        }
        
        // New round
        if (payload.type === 'new_round') {
          setProblem(payload.problem);
          setOptions(payload.options);
          setScores(payload.scores);
          setRound(payload.round);
          setHasAnswered(false);
          setFeedback(null);
          soundManager.playLocalSound('click');
        }
        
        // Game ended
        if (payload.type === 'game_ended') {
          setMode('ended');
          setScores(payload.scores);
          setWinner(payload.winner);
          const isWinner = payload.winner === `Player ${playerNumber}` || 
                          payload.winner === playerNames[playerNumber === 1 ? 'player1' : 'player2'];
          soundManager.playLocalSound(isWinner ? 'win' : 'lose');
          if (isWinner) {
            haptics.success();
            celebrateFireworks();
          } else {
            haptics.error();
          }
        }
      })
      .subscribe();

    channelRef.current = channel;
    
    // Update global channel ref for FloatingReactions and FloatingChat
    setChannelRef(channelRef);
    setGlobalPlayerName(playerName || `Player ${playerNumber}`);
    setGlobalRoomId(roomId);
    
    // Listen for reactions and chat from global components
    channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      if (payload?.emoji) {
        window.dispatchEvent(new CustomEvent('game-reaction', { detail: { emoji: payload.emoji } }));
      }
    });
    
    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      if (payload?.type === 'chat' && payload?.message && payload?.playerName) {
        window.dispatchEvent(new CustomEvent('game-chat', { detail: payload }));
      }
    });

    return () => {
      supabase.removeChannel(channel);
      setChannelRef(null);
      setGlobalRoomId(null);
    };
  }, [roomId, mode, playerNumber, playerNames, playerName, setChannelRef, setGlobalPlayerName, setGlobalRoomId]);

  const handleAnswer = async (answer: number) => {
    if (!problem || hasAnswered || !roomId) return;
    
    setHasAnswered(true);
    const isCorrect = answer === problem.answer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    soundManager.playLocalSound(isCorrect ? 'correct' : 'wrong');
    haptics.light();
    
    const { data } = await supabase
      .from('game_rooms')
      .select('game_state')
      .eq('id', roomId)
      .single();
    
    if (!data) return;
    
    const currentState = data.game_state as unknown as GameState;
    const playerKey = playerNumber === 1 ? 'player1' : 'player2';
    
    const newScores = { ...currentState.scores };
    if (isCorrect) {
      newScores[playerKey] += 10;
    }
    
    const newAnswered = { ...currentState.answered, [playerKey]: true };
    const bothAnswered = newAnswered.player1 && newAnswered.player2;
    
    let newState: GameState = { ...currentState, scores: newScores, answered: newAnswered };
    
    // Broadcast score update
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_update',
      payload: { type: 'answer_submitted', scores: newScores }
    });
    
    if (bothAnswered) {
      if (currentState.round >= currentState.maxRounds) {
        // Game ended
        const winnerName = newScores.player1 > newScores.player2 
          ? currentState.playerNames.player1 || 'Player 1'
          : newScores.player2 > newScores.player1 
          ? currentState.playerNames.player2 || 'Player 2' 
          : 'Tie';
        
        newState = { ...newState, status: 'ended', winner: winnerName };
        
        channelRef.current?.send({
          type: 'broadcast',
          event: 'game_update',
          payload: { type: 'game_ended', scores: newScores, winner: winnerName }
        });
      } else {
        // New round
        const newProblem = generateProblem();
        const newOptions = generateOptions(newProblem.answer);
        
        newState = {
          ...newState,
          round: currentState.round + 1,
          problem: newProblem,
          options: newOptions,
          answered: { player1: false, player2: false }
        };
        
        channelRef.current?.send({
          type: 'broadcast',
          event: 'game_update',
          payload: { 
            type: 'new_round',
            problem: newProblem,
            options: newOptions,
            scores: newScores,
            round: newState.round
          }
        });
      }
    }
    
    // Update DB in background
    supabase.from('game_rooms')
      .update({ game_state: JSON.parse(JSON.stringify(newState)) })
      .eq('id', roomId)
      .then();
  };

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
    setRoomCode('');
    setRoomId(null);
    setProblem(null);
    setOptions([]);
    setScores({ player1: 0, player2: 0 });
    setRound(1);
    setHasAnswered(false);
    setWinner(null);
    setFeedback(null);
  };

  // Menu
  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <Swords className="w-16 h-16 text-neon-orange animate-float" />
        <h2 className="font-orbitron text-2xl text-foreground">Math Battle</h2>
        <p className="text-muted-foreground font-rajdhani text-center max-w-xs">
          Race against a friend to solve math problems!
        </p>
        
        <Input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name..."
          className="max-w-xs text-center font-rajdhani"
          maxLength={15}
        />
        
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
        <Button variant="ghost" onClick={() => setMode('menu')} className="self-start">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h2 className="font-orbitron text-xl">Create Math Battle</h2>
        <p className="text-muted-foreground text-sm">Playing as: {playerName || 'Anonymous'}</p>
        <Button variant="game" size="lg" onClick={createRoom}>
          Create Room
        </Button>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <Button variant="ghost" onClick={() => setMode('menu')} className="self-start">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h2 className="font-orbitron text-xl">Join Math Battle</h2>
        <p className="text-muted-foreground text-sm">Playing as: {playerName || 'Anonymous'}</p>
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
      </div>
    );
  }

  if (mode === 'waiting') {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <Swords className="w-12 h-12 text-neon-orange animate-pulse" />
        <h2 className="font-orbitron text-xl">Waiting for Opponent...</h2>
        <p className="text-muted-foreground text-sm">You: {playerName}</p>
        
        <div className="flex items-center gap-2 p-4 bg-card rounded-xl border border-border">
          <span className="font-orbitron text-2xl tracking-widest text-neon-cyan">{roomCode}</span>
          <Button variant="ghost" size="icon" onClick={copyRoomCode}>
            {copied ? <Check className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Share this code with a friend</p>
        
        <Button variant="ghost" onClick={leaveGame}>Cancel</Button>
      </div>
    );
  }

  if (mode === 'playing' && problem) {
    return (
      <div className="flex flex-col items-center gap-6 w-full animate-slide-in">
        {/* Scores */}
        <div className="flex justify-between w-full px-2">
          <div className={`text-center p-3 rounded-xl border-2 ${playerNumber === 1 ? 'border-neon-cyan bg-neon-cyan/10' : 'border-border'}`}>
            <span className="text-xs text-muted-foreground font-rajdhani">
              {playerNames.player1 || 'P1'} {playerNumber === 1 && '(You)'}
            </span>
            <p className="font-orbitron text-2xl text-neon-cyan">{scores.player1}</p>
          </div>
          
          <div className="text-center">
            <span className="text-muted-foreground font-rajdhani text-sm">Round</span>
            <p className="font-orbitron text-xl">{round}/{maxRounds}</p>
          </div>
          
          <div className={`text-center p-3 rounded-xl border-2 ${playerNumber === 2 ? 'border-neon-pink bg-neon-pink/10' : 'border-border'}`}>
            <span className="text-xs text-muted-foreground font-rajdhani">
              {playerNames.player2 || 'P2'} {playerNumber === 2 && '(You)'}
            </span>
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
                  : 'border-border bg-card hover:border-primary active:scale-95 cursor-pointer'
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
    const winnerDisplay = winner === 'Tie' ? "It's a Tie!" : `${winner} Wins!`;
    
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <Trophy className="w-16 h-16 text-neon-orange" />
        <h2 className="font-orbitron text-3xl text-foreground">{winnerDisplay}</h2>
        
        <div className="flex gap-8">
          <div className="text-center">
            <span className="text-muted-foreground font-rajdhani">{playerNames.player1 || 'Player 1'}</span>
            <p className="font-orbitron text-3xl text-neon-cyan">{scores.player1}</p>
          </div>
          <div className="text-center">
            <span className="text-muted-foreground font-rajdhani">{playerNames.player2 || 'Player 2'}</span>
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
