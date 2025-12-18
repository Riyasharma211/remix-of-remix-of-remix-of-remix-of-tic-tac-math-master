import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Keyboard, RotateCcw, Play, Trophy, Clock, Zap } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';
import { celebrateBurst } from '@/utils/confetti';
import { useLeaderboard, GAME_TYPES } from '@/hooks/useLeaderboard';
import { useDifficulty } from '@/contexts/DifficultyContext';

const SENTENCES = {
  easy: [
    'the quick fox',
    'happy dog runs',
    'blue sky today',
    'fast car race',
    'green tree park',
    'cold ice cream',
    'warm sunny day',
    'small red bird',
  ],
  medium: [
    'the quick brown fox jumps',
    'coding is really fun today',
    'learning new skills daily',
    'practice makes perfect now',
    'never give up on dreams',
    'technology changes everything',
    'creativity sparks innovation',
  ],
  hard: [
    'the quick brown fox jumps over the lazy dog',
    'programming requires patience and dedication',
    'artificial intelligence is transforming our world',
    'success comes from consistent daily practice',
    'imagination is more important than knowledge',
    'every expert was once a complete beginner',
  ],
};

const GAME_DURATION = 30;

const TypingSpeed: React.FC = () => {
  const { addScore } = useLeaderboard();
  const { difficulty } = useDifficulty();
  const [playerName] = useState(() => localStorage.getItem('mindgames-player-name') || 'Player');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [currentSentence, setCurrentSentence] = useState('');
  const [userInput, setUserInput] = useState('');
  const [wordsTyped, setWordsTyped] = useState(0);
  const [correctChars, setCorrectChars] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [bestWPM, setBestWPM] = useState<number | null>(null);
  const [usedSentences, setUsedSentences] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const sentences = SENTENCES[difficulty];

  const getNewSentence = useCallback(() => {
    const available = sentences.filter(s => !usedSentences.has(s));
    if (available.length === 0) {
      setUsedSentences(new Set());
      return sentences[Math.floor(Math.random() * sentences.length)];
    }
    const sentence = available[Math.floor(Math.random() * available.length)];
    setUsedSentences(prev => new Set(prev).add(sentence));
    return sentence;
  }, [sentences, usedSentences]);

  const startGame = () => {
    setIsPlaying(true);
    setTimeLeft(GAME_DURATION);
    setWordsTyped(0);
    setCorrectChars(0);
    setTotalChars(0);
    setUserInput('');
    setUsedSentences(new Set());
    setCurrentSentence(getNewSentence());
    soundManager.playLocalSound('start');
    haptics.light();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  useEffect(() => {
    if (!isPlaying || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [isPlaying, timeLeft]);

  useEffect(() => {
    if (isPlaying && timeLeft <= 0) {
      setIsPlaying(false);
      const wpm = Math.round((wordsTyped / GAME_DURATION) * 60);
      const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 0;
      
      soundManager.playLocalSound(wpm > 0 ? 'win' : 'lose');
      haptics.success();
      if (wpm > 20) celebrateBurst();
      
      if (bestWPM === null || wpm > bestWPM) {
        setBestWPM(wpm);
      }
      
      const score = wpm * (accuracy / 100);
      addScore(GAME_TYPES.TYPING_SPEED || 'typing_speed', playerName, Math.round(score), `${wpm} WPM, ${accuracy}% acc`);
    }
  }, [isPlaying, timeLeft, wordsTyped, correctChars, totalChars, bestWPM, playerName, addScore]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserInput(value);
    setTotalChars(prev => prev + 1);

    // Check if character is correct
    const expectedChar = currentSentence[value.length - 1];
    const typedChar = value[value.length - 1];
    
    if (typedChar === expectedChar) {
      setCorrectChars(prev => prev + 1);
      soundManager.playLocalSound('click');
    } else {
      haptics.error();
    }

    // Check if sentence is complete
    if (value === currentSentence) {
      const words = currentSentence.split(' ').length;
      setWordsTyped(prev => prev + words);
      setUserInput('');
      setCurrentSentence(getNewSentence());
      soundManager.playLocalSound('correct');
      haptics.success();
    }
  };

  const getWPM = () => Math.round((wordsTyped / (GAME_DURATION - timeLeft || 1)) * 60);
  const getAccuracy = () => totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100;

  const renderSentence = () => {
    return currentSentence.split('').map((char, index) => {
      let className = 'text-muted-foreground';
      if (index < userInput.length) {
        className = userInput[index] === char ? 'text-neon-green' : 'text-destructive underline';
      } else if (index === userInput.length) {
        className = 'text-foreground bg-neon-cyan/20 rounded';
      }
      return (
        <span key={index} className={className}>
          {char}
        </span>
      );
    });
  };

  if (!isPlaying && timeLeft === GAME_DURATION) {
    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-2">
          <Keyboard className="w-16 h-16 text-neon-blue mx-auto animate-float" />
          <h2 className="font-orbitron text-2xl text-foreground">Typing Speed</h2>
          <p className="text-muted-foreground font-rajdhani max-w-sm">
            Type as fast and accurately as you can!
          </p>
        </div>

        {bestWPM !== null && (
          <div className="flex items-center gap-2 text-neon-orange">
            <Trophy className="w-5 h-5" />
            <span className="font-orbitron">Best: {bestWPM} WPM</span>
          </div>
        )}

        <Button variant="game" size="xl" onClick={startGame}>
          <Play className="w-5 h-5" />
          Start Typing
        </Button>
      </div>
    );
  }

  if (!isPlaying && timeLeft <= 0) {
    const finalWPM = Math.round((wordsTyped / GAME_DURATION) * 60);
    const finalAccuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 0;

    return (
      <div className="flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-center space-y-4">
          <Trophy className="w-16 h-16 text-neon-orange mx-auto" />
          <h2 className="font-orbitron text-2xl text-foreground">Results</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <Zap className="w-6 h-6 text-neon-cyan mx-auto mb-2" />
            <span className="font-orbitron text-3xl text-neon-cyan">{finalWPM}</span>
            <p className="text-muted-foreground text-sm">WPM</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border text-center">
            <span className="font-orbitron text-3xl text-neon-green">{finalAccuracy}%</span>
            <p className="text-muted-foreground text-sm">Accuracy</p>
          </div>
        </div>

        {finalWPM === bestWPM && finalWPM > 0 && (
          <p className="text-neon-orange font-orbitron animate-pulse">New Best!</p>
        )}

        <Button variant="game" size="xl" onClick={startGame}>
          <RotateCcw className="w-5 h-5" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg animate-slide-in">
      {/* Stats */}
      <div className="flex justify-between w-full">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-neon-cyan" />
          <span className={`font-orbitron text-xl ${timeLeft <= 10 ? 'text-destructive animate-pulse' : ''}`}>
            {timeLeft}s
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-neon-orange" />
          <span className="font-orbitron text-xl">{getWPM()} WPM</span>
        </div>
        <div className="text-muted-foreground">
          <span className="font-orbitron text-neon-green">{getAccuracy()}%</span>
        </div>
      </div>

      {/* Sentence Display */}
      <div className="p-6 rounded-2xl bg-card border border-border w-full">
        <p className="font-mono text-xl sm:text-2xl leading-relaxed break-words">
          {renderSentence()}
        </p>
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={userInput}
        onChange={handleInputChange}
        className="w-full p-4 rounded-xl bg-muted border border-border font-mono text-lg text-foreground focus:outline-none focus:ring-2 focus:ring-neon-cyan"
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      <p className="text-muted-foreground text-sm">
        Words completed: <span className="text-neon-green font-orbitron">{wordsTyped}</span>
      </p>
    </div>
  );
};

export default TypingSpeed;
