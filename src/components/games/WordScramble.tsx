import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RotateCcw, Shuffle, Trophy, Clock, CheckCircle, XCircle } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateBurst } from '@/utils/confetti';
import { useLeaderboard, GAME_TYPES } from '@/hooks/useLeaderboard';
import { useDifficulty } from '@/contexts/DifficultyContext';

const WORDS_BY_DIFFICULTY = {
  easy: ['apple', 'brain', 'cloud', 'dance', 'eagle', 'flame', 'grape', 'happy', 'light', 'music', 'ocean', 'piano', 'quiet', 'river', 'storm'],
  medium: ['anchor', 'basket', 'castle', 'dragon', 'flight', 'garden', 'hammer', 'island', 'jungle', 'knight', 'laptop', 'market', 'nature', 'orange', 'planet'],
  hard: ['abstract', 'building', 'calendar', 'distance', 'elephant', 'fountain', 'graphics', 'hospital', 'industry', 'junction', 'keyboard', 'language', 'mountain', 'navigate', 'organize'],
};

const GAME_DURATION = 60;

const scrambleWord = (word: string): string => {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const scrambled = arr.join('');
  return scrambled === word ? scrambleWord(word) : scrambled;
};

const WordScramble: React.FC = () => {
  const { addScore } = useLeaderboard();
  const { difficulty } = useDifficulty();
  const [playerName] = useState(() => localStorage.getItem('mindgames-player-name') || 'Player');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [scrambledWord, setScrambledWord] = useState('');
  const [guess, setGuess] = useState('');
  const [streak, setStreak] = useState(0);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);

  const words = WORDS_BY_DIFFICULTY[difficulty];

  const getNewWord = useCallback(() => {
    const available = words.filter(w => !usedWords.has(w));
    if (available.length === 0) {
      setUsedWords(new Set());
      const word = words[Math.floor(Math.random() * words.length)];
      setCurrentWord(word);
      setScrambledWord(scrambleWord(word));
      return;
    }
    const word = available[Math.floor(Math.random() * available.length)];
    setUsedWords(prev => new Set(prev).add(word));
    setCurrentWord(word);
    setScrambledWord(scrambleWord(word));
  }, [words, usedWords]);

  const startGame = () => {
    setIsPlaying(true);
    setTimeLeft(GAME_DURATION);
    setScore(0);
    setStreak(0);
    setUsedWords(new Set());
    setGuess('');
    setFeedback(null);
    getNewWord();
    soundManager.playLocalSound('start');
    haptics.light();
  };

  useEffect(() => {
    if (!isPlaying || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [isPlaying, timeLeft]);

  useEffect(() => {
    if (isPlaying && timeLeft <= 0) {
      setIsPlaying(false);
      soundManager.playLocalSound(score > 0 ? 'win' : 'lose');
      haptics.success();
      if (score > 0) celebrateBurst();
      
      if (bestScore === null || score > bestScore) {
        setBestScore(score);
      }
      addScore(GAME_TYPES.WORD_SCRAMBLE || 'word_scramble', playerName, score, `${streak} max streak`);
    }
  }, [isPlaying, timeLeft, score, streak, bestScore, playerName, addScore]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim()) return;

    if (guess.toLowerCase() === currentWord.toLowerCase()) {
      const points = (difficulty === 'easy' ? 10 : difficulty === 'medium' ? 15 : 20) + streak * 2;
      setScore(prev => prev + points);
      setStreak(prev => prev + 1);
      setFeedback('correct');
      soundManager.playLocalSound('correct');
      haptics.success();
      setTimeout(() => {
        setFeedback(null);
        setGuess('');
        getNewWord();
      }, 500);
    } else {
      setStreak(0);
      setFeedback('wrong');
      soundManager.playLocalSound('wrong');
      haptics.error();
      setTimeout(() => setFeedback(null), 500);
    }
  };

  const skipWord = () => {
    setStreak(0);
    setGuess('');
    getNewWord();
    soundManager.playLocalSound('whoosh');
    haptics.light();
  };

  if (!isPlaying && timeLeft === GAME_DURATION) {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-2">
          <Shuffle className="w-16 h-16 text-neon-green mx-auto animate-float" />
          <h2 className="font-orbitron text-2xl text-foreground">Word Scramble</h2>
          <p className="text-muted-foreground font-rajdhani max-w-sm">
            Unscramble as many words as you can in 60 seconds!
          </p>
        </div>

        {bestScore !== null && (
          <div className="flex items-center gap-2 text-neon-orange">
            <Trophy className="w-5 h-5" />
            <span className="font-orbitron">Best: {bestScore}</span>
          </div>
        )}

        <Button variant="game" size="xl" onClick={startGame}>
          Start Game
        </Button>
      </div>
    );
  }

  if (!isPlaying && timeLeft <= 0) {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-2">
          <Trophy className="w-16 h-16 text-neon-orange mx-auto" />
          <h2 className="font-orbitron text-2xl text-foreground">Time's Up!</h2>
          <p className="font-orbitron text-4xl text-neon-green">{score} points</p>
          {score === bestScore && score > 0 && (
            <p className="text-neon-orange font-orbitron animate-pulse">New Best!</p>
          )}
        </div>
        <Button variant="game" size="xl" onClick={startGame}>
          <RotateCcw className="w-5 h-5" />
          Play Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md animate-slide-in">
      {/* Stats */}
      <div className="flex justify-between w-full">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-neon-cyan" />
          <span className={`font-orbitron text-xl ${timeLeft <= 10 ? 'text-destructive animate-pulse' : ''}`}>
            {timeLeft}s
          </span>
        </div>
        <div className="text-center">
          <span className="font-orbitron text-xl text-neon-green">{score}</span>
          <span className="text-muted-foreground text-sm ml-1">pts</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-sm">Streak:</span>
          <span className="font-orbitron text-neon-orange">{streak}</span>
        </div>
      </div>

      {/* Scrambled Word */}
      <div className={`p-8 rounded-2xl bg-card border-2 transition-all duration-300 ${
        feedback === 'correct' ? 'border-neon-green box-glow-green' :
        feedback === 'wrong' ? 'border-destructive' : 'border-border'
      }`}>
        <p className="font-orbitron text-4xl text-foreground tracking-widest text-center uppercase">
          {scrambledWord}
        </p>
      </div>

      {/* Feedback Icons */}
      {feedback && (
        <div className="animate-scale-pop">
          {feedback === 'correct' ? (
            <CheckCircle className="w-10 h-10 text-neon-green" />
          ) : (
            <XCircle className="w-10 h-10 text-destructive" />
          )}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <Input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="Type your answer..."
          className="text-center font-orbitron text-lg"
          autoFocus
        />
        <div className="flex gap-3">
          <Button type="submit" variant="game" className="flex-1">
            Submit
          </Button>
          <Button type="button" variant="outline" onClick={skipWord}>
            Skip
          </Button>
        </div>
      </form>
    </div>
  );
};

export default WordScramble;
