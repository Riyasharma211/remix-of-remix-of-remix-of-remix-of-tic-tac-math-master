import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Users, Copy, Check, Play, Trophy, Clock, ArrowLeft, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateFireworks } from '@/utils/confetti';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';

type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'playing' | 'ended';

interface GameState {
  words: string[];
  currentTurn: 1 | 2;
  scores: { player1: number; player2: number };
  timeLeft: number;
  status: 'waiting' | 'playing' | 'ended';
  winner: string | null;
  playerNames: { player1: string; player2: string };
  lastWord: string;
}

const TURN_TIME = 15; // seconds per turn

const WordChain: React.FC = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [copied, setCopied] = useState(false);
  const [playerNumber, setPlayerNumber] = useState<1 | 2>(1);
  const [words, setWords] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState<1 | 2>(1);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [winner, setWinner] = useState<string | null>(null);
  const [playerNames, setPlayerNames] = useState({ player1: '', player2: '' });
  const [inputWord, setInputWord] = useState('');
  const [lastWord, setLastWord] = useState('');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const startingWords = ['APPLE', 'ELEPHANT', 'ORANGE', 'ENERGY', 'YELLOW', 'WATER'];

  const createRoom = async () => {
    if (!playerName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your name' });
      return;
    }
    
    const code = generateRoomCode();
    const startWord = startingWords[Math.floor(Math.random() * startingWords.length)];
    
    const initialState: GameState = {
      words: [startWord],
      currentTurn: 1,
      scores: { player1: 0, player2: 0 },
      timeLeft: TURN_TIME,
      status: 'waiting',
      winner: null,
      playerNames: { player1: playerName, player2: '' },
      lastWord: startWord,
    };

    const { data, error } = await supabase
      .from('game_rooms')
      .insert({
        room_code: code,
        game_type: 'wordchain',
        game_state: initialState as any,
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
    setWords([startWord]);
    setLastWord(startWord);
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
      .eq('game_type', 'wordchain')
      .single();

    if (error || !room) {
      toast({ variant: 'destructive', title: 'Error', description: 'Room not found' });
      return;
    }

    if (room.player_count >= 2) {
      toast({ variant: 'destructive', title: 'Error', description: 'Room is full' });
      return;
    }

    const currentState = room.game_state as unknown as GameState;
    const updatedState: GameState = {
      ...currentState,
      playerNames: { ...currentState.playerNames, player2: playerName },
      status: 'playing',
    };

    await supabase
      .from('game_rooms')
      .update({ 
        player_count: 2, 
        game_state: updatedState as any,
        status: 'playing'
      })
      .eq('id', room.id);

    setRoomCode(joinCode.toUpperCase());
    setRoomId(room.id);
    setPlayerNumber(2);
    setPlayerNames(updatedState.playerNames);
    setWords(currentState.words);
    setLastWord(currentState.lastWord);
    setMode('playing');
    soundManager.playLocalSound('start');
    haptics.success();
    
    setupRealtimeChannel(room.id, 2);
  };

  const setupRealtimeChannel = (roomId: string, player: 1 | 2) => {
    const channel = supabase
      .channel(`wordchain-${roomId}`)
      .on('broadcast', { event: 'game_update' }, ({ payload }) => {
        const state = payload as GameState;
        setWords(state.words);
        setCurrentTurn(state.currentTurn);
        setScores(state.scores);
        setTimeLeft(state.timeLeft);
        setLastWord(state.lastWord);
        setPlayerNames(state.playerNames);
        
        if (state.status === 'ended') {
          setWinner(state.winner);
          setMode('ended');
          if (state.winner === (player === 1 ? state.playerNames.player1 : state.playerNames.player2)) {
            soundManager.playLocalSound('win');
            haptics.success();
            celebrateFireworks();
          } else {
            soundManager.playLocalSound('lose');
            haptics.error();
          }
        }
      })
      .on('broadcast', { event: 'game_start' }, ({ payload }) => {
        setMode('playing');
        setPlayerNames(payload.playerNames);
        soundManager.playLocalSound('start');
        haptics.success();
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
    if (mode !== 'playing') return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - other player wins
          handleTimeout();
          return TURN_TIME;
        }
        if (prev <= 5) {
          soundManager.playLocalSound('tick');
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode, currentTurn]);

  const handleTimeout = async () => {
    if (!roomId) return;
    
    const loser = currentTurn;
    const winnerName = loser === 1 ? playerNames.player2 : playerNames.player1;
    
    const endState: GameState = {
      words,
      currentTurn,
      scores,
      timeLeft: 0,
      status: 'ended',
      winner: winnerName,
      playerNames,
      lastWord,
    };

    await supabase.from('game_rooms').update({ 
      game_state: endState as any,
      status: 'ended'
    }).eq('id', roomId);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_update',
      payload: endState,
    });
  };

  const submitWord = async () => {
    if (!inputWord.trim() || currentTurn !== playerNumber || !roomId) return;

    const word = inputWord.trim().toUpperCase();
    const requiredLetter = lastWord.slice(-1).toUpperCase();

    // Validate word starts with correct letter
    if (word[0] !== requiredLetter) {
      toast({ variant: 'destructive', title: 'Invalid!', description: `Word must start with "${requiredLetter}"` });
      soundManager.playLocalSound('wrong');
      haptics.error();
      return;
    }

    // Check if word was already used
    if (words.includes(word)) {
      toast({ variant: 'destructive', title: 'Already used!', description: 'This word was already played' });
      soundManager.playLocalSound('wrong');
      haptics.error();
      return;
    }

    // Word length must be at least 2
    if (word.length < 2) {
      toast({ variant: 'destructive', title: 'Too short!', description: 'Word must be at least 2 letters' });
      soundManager.playLocalSound('wrong');
      haptics.error();
      return;
    }

    soundManager.playLocalSound('correct');
    haptics.success();

    const newWords = [...words, word];
    const newScores = {
      ...scores,
      [playerNumber === 1 ? 'player1' : 'player2']: scores[playerNumber === 1 ? 'player1' : 'player2'] + word.length,
    };
    const nextTurn = currentTurn === 1 ? 2 : 1;

    const newState: GameState = {
      words: newWords,
      currentTurn: nextTurn as 1 | 2,
      scores: newScores,
      timeLeft: TURN_TIME,
      status: 'playing',
      winner: null,
      playerNames,
      lastWord: word,
    };

    setWords(newWords);
    setScores(newScores);
    setCurrentTurn(nextTurn as 1 | 2);
    setTimeLeft(TURN_TIME);
    setLastWord(word);
    setInputWord('');

    await supabase.from('game_rooms').update({ game_state: newState as any }).eq('id', roomId);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_update',
      payload: newState,
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
    setWords([]);
    setScores({ player1: 0, player2: 0 });
    setWinner(null);
    setInputWord('');
    setLastWord('');
    setCurrentTurn(1);
    setTimeLeft(TURN_TIME);
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
          <Link2 className="w-16 h-16 text-neon-green mx-auto animate-float" />
          <h2 className="font-orbitron text-2xl text-foreground">Word Chain</h2>
          <p className="text-muted-foreground font-rajdhani max-w-sm">
            Take turns typing words that start with the last letter of the previous word!
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
          <Users className="w-16 h-16 text-neon-green mx-auto animate-pulse" />
          <h2 className="font-orbitron text-2xl text-foreground">Waiting for Player 2</h2>
          <p className="text-muted-foreground font-rajdhani">Share this code with your friend</p>
        </div>

        <div className="flex items-center gap-2 p-4 bg-muted rounded-xl">
          <span className="font-orbitron text-3xl text-neon-green tracking-widest">{roomCode}</span>
          <Button variant="ghost" size="icon" onClick={copyRoomCode}>
            {copied ? <Check className="w-5 h-5 text-neon-green" /> : <Copy className="w-5 h-5" />}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground font-rajdhani">Starting word: <span className="text-neon-cyan font-bold">{lastWord}</span></p>

        <Button variant="ghost" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4" />
          Leave
        </Button>
      </div>
    );
  }

  // Playing Screen
  if (mode === 'playing') {
    const isMyTurn = currentTurn === playerNumber;
    const requiredLetter = lastWord.slice(-1).toUpperCase();

    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-md animate-slide-in">
        {/* Scoreboard */}
        <div className="flex justify-between w-full px-4">
          <div className={`text-center p-3 rounded-xl border-2 ${currentTurn === 1 ? 'border-neon-cyan bg-neon-cyan/10' : 'border-border'}`}>
            <span className="font-rajdhani text-sm text-muted-foreground">{playerNames.player1}</span>
            <p className="font-orbitron text-2xl text-neon-cyan">{scores.player1}</p>
          </div>
          
          <div className="flex flex-col items-center justify-center">
            <Clock className={`w-5 h-5 ${timeLeft <= 5 ? 'text-destructive animate-pulse' : 'text-neon-orange'}`} />
            <span className={`font-orbitron text-xl ${timeLeft <= 5 ? 'text-destructive' : ''}`}>{timeLeft}s</span>
          </div>

          <div className={`text-center p-3 rounded-xl border-2 ${currentTurn === 2 ? 'border-neon-pink bg-neon-pink/10' : 'border-border'}`}>
            <span className="font-rajdhani text-sm text-muted-foreground">{playerNames.player2}</span>
            <p className="font-orbitron text-2xl text-neon-pink">{scores.player2}</p>
          </div>
        </div>

        {/* Last Word */}
        <div className="text-center p-6 bg-card rounded-2xl border border-border w-full">
          <span className="font-rajdhani text-muted-foreground">Last word</span>
          <p className="font-orbitron text-4xl text-foreground">{lastWord}</p>
          <p className="font-rajdhani text-neon-green mt-2">
            Next word must start with: <span className="font-orbitron text-2xl">{requiredLetter}</span>
          </p>
        </div>

        {/* Turn Indicator */}
        <div className={`text-center py-2 px-4 rounded-full ${isMyTurn ? 'bg-neon-green/20 text-neon-green' : 'bg-muted text-muted-foreground'}`}>
          <span className="font-orbitron text-sm">
            {isMyTurn ? "Your turn!" : `${currentTurn === 1 ? playerNames.player1 : playerNames.player2}'s turn`}
          </span>
        </div>

        {/* Input */}
        {isMyTurn && (
          <div className="flex gap-2 w-full">
            <Input
              placeholder={`Type a word starting with "${requiredLetter}"`}
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && submitWord()}
              className="font-orbitron uppercase"
              autoFocus
            />
            <Button variant="neon" onClick={submitWord}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Word History */}
        <div className="w-full max-h-32 overflow-y-auto">
          <div className="flex flex-wrap gap-2 justify-center">
            {words.slice(-10).map((word, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-muted text-sm font-orbitron">
                {word}
              </span>
            ))}
          </div>
        </div>

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

    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-4">
          <Trophy className={`w-20 h-20 mx-auto ${isWinner ? 'text-neon-orange' : 'text-muted-foreground'}`} />
          <h2 className={`font-orbitron text-3xl ${isWinner ? 'text-neon-green' : 'text-destructive'}`}>
            {isWinner ? 'You Win!' : 'You Lose!'}
          </h2>
          <p className="text-muted-foreground font-rajdhani">{winner} wins the game!</p>
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

        <p className="text-muted-foreground font-rajdhani">{words.length} words played</p>

        <Button variant="game" onClick={leaveGame}>
          <ArrowLeft className="w-4 h-4" />
          Back to Menu
        </Button>
      </div>
    );
  }

  return null;
};

export default WordChain;
