import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Type, Copy, Check, Wifi, WifiOff, Trophy, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateWin } from '@/utils/confetti';
import { useToast } from '@/hooks/use-toast';

type GameMode = 'menu' | 'create' | 'join' | 'waiting' | 'set-word' | 'playing' | 'ended';

const MAX_WRONG_GUESSES = 6;

const WORD_CATEGORIES = [
  { category: 'Animals', words: ['elephant', 'giraffe', 'penguin', 'dolphin', 'kangaroo'] },
  { category: 'Countries', words: ['australia', 'brazil', 'canada', 'germany', 'japan'] },
  { category: 'Food', words: ['pizza', 'burger', 'spaghetti', 'chocolate', 'sandwich'] },
  { category: 'Sports', words: ['basketball', 'football', 'tennis', 'swimming', 'volleyball'] },
];

const HangmanBattle: React.FC = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<GameMode>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const [word, setWord] = useState('');
  const [wordInput, setWordInput] = useState('');
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [scores, setScores] = useState({ host: 0, guest: 0 });
  const [isMyTurnToGuess, setIsMyTurnToGuess] = useState(false);
  const [round, setRound] = useState(1);
  const [maxRounds] = useState(4);
  
  const channelRef = useRef<any>(null);

  const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const createRoom = async () => {
    const code = generateRoomCode();
    setRoomCode(code);
    setIsHost(true);

    try {
      await supabase.from('game_rooms').insert({
        room_code: code,
        game_type: 'hangman',
        game_state: { round: 1, scores: { host: 0, guest: 0 } },
        status: 'waiting',
      });
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

      setRoomCode(joinCode.toUpperCase());
      setIsHost(false);
      setIsConnected(true);
      setMode('set-word'); // Guest sets word first

      await supabase.from('game_rooms')
        .update({ player_count: 2, status: 'playing' })
        .eq('room_code', joinCode.toUpperCase());

      haptics.success();
      toast({ title: 'Joined!', description: 'Set a word for your opponent!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to join room' });
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Subscribe to room
  useEffect(() => {
    if (!roomCode || mode === 'menu') return;

    const channel = supabase
      .channel(`hangman-${roomCode}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'game_left' }, () => {
        toast({ title: 'Opponent Left', description: 'The game has ended' });
        resetGame();
      })
      .on('broadcast', { event: 'player_joined' }, () => {
        if (mode === 'waiting') {
          setIsConnected(true);
          setMode('playing'); // Host waits for word
          setIsMyTurnToGuess(true);
          toast({ title: 'Player Joined!', description: 'Waiting for word...' });
        }
      })
      .on('broadcast', { event: 'word_set' }, ({ payload }) => {
        if (payload && payload.wordLength) {
          setWord('_'.repeat(payload.wordLength));
          setGuessedLetters([]);
          setWrongGuesses(0);
          setIsMyTurnToGuess(true);
          setMode('playing');
          toast({ title: 'Word Set!', description: `Guess the ${payload.wordLength}-letter word!` });
        }
      })
      .on('broadcast', { event: 'guess_result' }, ({ payload }) => {
        if (payload) {
          setWord(payload.displayWord);
          setGuessedLetters(payload.guessedLetters);
          setWrongGuesses(payload.wrongGuesses);
          
          if (payload.gameOver) {
            if (payload.won) {
              soundManager.playLocalSound('lose');
              haptics.error();
            } else {
              soundManager.playLocalSound('win');
              haptics.success();
              celebrateWin();
            }
            setScores(payload.scores);
            
            if (payload.round >= maxRounds) {
              setMode('ended');
            } else {
              // Switch roles
              setTimeout(() => {
                setRound(payload.round + 1);
                setMode('set-word');
                setWord('');
                setGuessedLetters([]);
                setWrongGuesses(0);
              }, 2000);
            }
          }
        }
      })
      .on('broadcast', { event: 'letter_guess' }, ({ payload }) => {
        if (payload && !isMyTurnToGuess) {
          handleOpponentGuess(payload.letter);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && !isHost) {
          await channel.send({
            type: 'broadcast',
            event: 'player_joined',
            payload: {},
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, mode, isHost, isMyTurnToGuess]);

  const [actualWord, setActualWord] = useState('');

  const submitWord = () => {
    const cleanWord = wordInput.trim().toLowerCase().replace(/[^a-z]/g, '');
    if (cleanWord.length < 3 || cleanWord.length > 12) {
      toast({ variant: 'destructive', title: 'Invalid word', description: 'Word must be 3-12 letters' });
      return;
    }

    setActualWord(cleanWord);
    setWord('_'.repeat(cleanWord.length));
    setIsMyTurnToGuess(false);
    setMode('playing');
    setWordInput('');

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'word_set',
        payload: { wordLength: cleanWord.length },
      });
    }
  };

  const handleOpponentGuess = (letter: string) => {
    const newGuessedLetters = [...guessedLetters, letter];
    setGuessedLetters(newGuessedLetters);

    let newWrongGuesses = wrongGuesses;
    let displayWord = '';

    for (const char of actualWord) {
      displayWord += newGuessedLetters.includes(char) ? char : '_';
    }
    setWord(displayWord);

    if (!actualWord.includes(letter)) {
      newWrongGuesses = wrongGuesses + 1;
      setWrongGuesses(newWrongGuesses);
      soundManager.playLocalSound('lose');
    } else {
      soundManager.playLocalSound('correct');
    }

    const won = !displayWord.includes('_');
    const lost = newWrongGuesses >= MAX_WRONG_GUESSES;
    const gameOver = won || lost;

    let newScores = scores;
    if (gameOver) {
      if (won) {
        // Guesser wins
        newScores = isHost 
          ? { ...scores, guest: scores.guest + 1 }
          : { ...scores, host: scores.host + 1 };
      } else {
        // Word setter wins
        newScores = isHost 
          ? { ...scores, host: scores.host + 1 }
          : { ...scores, guest: scores.guest + 1 };
      }
      setScores(newScores);
    }

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'guess_result',
        payload: {
          displayWord,
          guessedLetters: newGuessedLetters,
          wrongGuesses: newWrongGuesses,
          gameOver,
          won,
          scores: newScores,
          round,
        },
      });
    }

    if (gameOver) {
      if (won) {
        soundManager.playLocalSound('lose');
        haptics.error();
      } else {
        soundManager.playLocalSound('win');
        haptics.success();
        celebrateWin();
      }

      if (round >= maxRounds) {
        setMode('ended');
      } else {
        setTimeout(() => {
          setRound(prev => prev + 1);
          setMode('set-word');
          setWord('');
          setActualWord('');
          setGuessedLetters([]);
          setWrongGuesses(0);
        }, 2000);
      }
    }
  };

  const guessLetter = (letter: string) => {
    if (!isMyTurnToGuess || guessedLetters.includes(letter)) return;

    haptics.medium();
    
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'letter_guess',
        payload: { letter },
      });
    }

    setGuessedLetters(prev => [...prev, letter]);
  };

  const resetGame = () => {
    setMode('menu');
    setRoomCode('');
    setJoinCode('');
    setIsHost(false);
    setIsConnected(false);
    setWord('');
    setActualWord('');
    setWordInput('');
    setGuessedLetters([]);
    setWrongGuesses(0);
    setScores({ host: 0, guest: 0 });
    setRound(1);
  };

  const leaveGame = async () => {
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'game_left',
        payload: {},
      });
    }
    if (roomCode) {
      await supabase.from('game_rooms').delete().eq('room_code', roomCode);
    }
    resetGame();
  };

  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

  // Menu
  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Type className="w-8 h-8 text-neon-purple" />
            <h2 className="font-orbitron text-2xl font-bold">Hangman Battle</h2>
          </div>
          <p className="text-muted-foreground">Take turns setting words!</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button onClick={createRoom} className="w-full bg-neon-purple/20 border-neon-purple text-neon-purple hover:bg-neon-purple/30">
            Create Room
          </Button>
          <div className="flex gap-2">
            <Input
              placeholder="Enter room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="flex-1"
            />
            <Button onClick={joinRoom} variant="outline">Join</Button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting
  if (mode === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-4">
        <div className="text-center">
          <WifiOff className="w-12 h-12 text-neon-purple mx-auto mb-4 animate-pulse" />
          <h2 className="font-orbitron text-xl font-bold mb-2">Waiting for opponent...</h2>
          <p className="text-muted-foreground mb-4">Share this code:</p>
          <div className="flex items-center gap-2 justify-center">
            <span className="font-mono text-2xl font-bold text-neon-purple">{roomCode}</span>
            <Button variant="ghost" size="icon" onClick={copyRoomCode}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <Button variant="outline" onClick={leaveGame}>Cancel</Button>
      </div>
    );
  }

  // Set Word
  if (mode === 'set-word') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-4 w-full max-w-md">
        <div className="text-center">
          <Type className="w-12 h-12 text-neon-purple mx-auto mb-4" />
          <h2 className="font-orbitron text-xl font-bold mb-2">Set a Word</h2>
          <p className="text-muted-foreground">Round {round}/{maxRounds}</p>
        </div>

        <div className="w-full max-w-xs">
          <Input
            placeholder="Enter a word (3-12 letters)"
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value)}
            className="mb-3"
          />
          <Button onClick={submitWord} className="w-full">Set Word</Button>
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Or pick a random word:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {WORD_CATEGORIES.map(cat => (
              <Button
                key={cat.category}
                variant="outline"
                size="sm"
                onClick={() => {
                  const randomWord = cat.words[Math.floor(Math.random() * cat.words.length)];
                  setWordInput(randomWord);
                }}
              >
                {cat.category}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Playing
  if (mode === 'playing') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-4 w-full max-w-md">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {isConnected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
            <span className="text-sm text-muted-foreground">Round {round}/{maxRounds}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={leaveGame}>Leave</Button>
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-center gap-8 w-full">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{isHost ? 'You' : 'Opponent'}</p>
            <p className="font-orbitron text-2xl font-bold text-neon-cyan">{scores.host}</p>
          </div>
          <span className="text-xl text-muted-foreground">vs</span>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{isHost ? 'Opponent' : 'You'}</p>
            <p className="font-orbitron text-2xl font-bold text-neon-purple">{scores.guest}</p>
          </div>
        </div>

        {/* Hangman Drawing */}
        <div className="text-center">
          <div className="text-4xl mb-2">
            {wrongGuesses >= 1 && '😵'}
            {wrongGuesses >= 2 && '🫥'}
            {wrongGuesses >= 3 && '💀'}
          </div>
          <p className="text-sm text-red-500">Wrong: {wrongGuesses}/{MAX_WRONG_GUESSES}</p>
        </div>

        {/* Word Display */}
        <div className="flex gap-2 justify-center flex-wrap">
          {word.split('').map((letter, idx) => (
            <span
              key={idx}
              className="w-8 h-10 border-b-2 border-foreground flex items-center justify-center font-mono text-2xl font-bold"
            >
              {letter === '_' ? '' : letter.toUpperCase()}
            </span>
          ))}
        </div>

        {/* Status */}
        <p className={`text-sm ${isMyTurnToGuess ? 'text-neon-green' : 'text-muted-foreground'}`}>
          {isMyTurnToGuess ? 'Your turn to guess!' : 'Waiting for opponent...'}
        </p>

        {/* Keyboard */}
        {isMyTurnToGuess && (
          <div className="grid grid-cols-9 gap-1 w-full max-w-xs">
            {alphabet.map(letter => (
              <Button
                key={letter}
                variant={guessedLetters.includes(letter) ? 'secondary' : 'outline'}
                size="sm"
                className="w-8 h-8 p-0 text-xs font-bold"
                onClick={() => guessLetter(letter)}
                disabled={guessedLetters.includes(letter)}
              >
                {letter.toUpperCase()}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Ended
  if (mode === 'ended') {
    const myScore = isHost ? scores.host : scores.guest;
    const opponentScore = isHost ? scores.guest : scores.host;
    const won = myScore > opponentScore;

    return (
      <div className="flex flex-col items-center justify-center gap-6 p-4">
        <Trophy className={`w-16 h-16 ${won ? 'text-neon-green' : 'text-red-500'}`} />
        <h2 className="font-orbitron text-2xl font-bold">
          {won ? 'You Win!' : myScore === opponentScore ? "It's a Tie!" : 'You Lose!'}
        </h2>
        <p className="text-xl">
          {myScore} - {opponentScore}
        </p>
        <div className="flex gap-3">
          <Button onClick={resetGame} className="bg-neon-green/20 text-neon-green">
            <RotateCcw className="w-4 h-4 mr-2" /> Play Again
          </Button>
          <Button variant="outline" onClick={leaveGame}>Leave</Button>
        </div>
      </div>
    );
  }

  return null;
};

export default HangmanBattle;
