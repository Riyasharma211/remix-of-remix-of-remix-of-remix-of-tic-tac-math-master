import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile, Heart, Flame, ThumbsUp, HandMetal, PartyPopper, Rocket, Star, Laugh, Skull, CheckCircle2, Brain, AlertCircle } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  y: number;
  delay: number;
  scale: number;
}

interface FloatingReactionsProps {
  channelRef?: React.MutableRefObject<any>;
  onReaction?: (emoji: string) => void;
}

const REACTION_EMOJIS = [
  { emoji: '😂', icon: Laugh, label: 'Tears of Joy', soundPrompt: 'joyful laughter, happy giggling sound' },
  { emoji: '❤️', icon: Heart, label: 'Red Heart', soundPrompt: 'romantic heart beat, love sound effect' },
  { emoji: '🤣', icon: Laugh, label: 'Rolling Laughing', soundPrompt: 'hysterical laughter, rolling on floor laughing' },
  { emoji: '👍', icon: ThumbsUp, label: 'Thumbs Up', soundPrompt: 'approval sound, positive affirmation' },
  { emoji: '😭', icon: Smile, label: 'Loudly Crying', soundPrompt: 'crying sound, sad weeping' },
  { emoji: '🎉', icon: PartyPopper, label: 'Party Popper', soundPrompt: 'party celebration, confetti pop sound' },
  { emoji: '🔥', icon: Flame, label: 'Fire', soundPrompt: 'fire crackling, flames burning' },
  { emoji: '🤔', icon: Brain, label: 'Thinking', soundPrompt: 'thinking sound, contemplation' },
  { emoji: '😱', icon: AlertCircle, label: 'Scared/Gasping', soundPrompt: 'gasping sound, surprised gasp' },
  { emoji: '💀', icon: Skull, label: 'Skull', soundPrompt: 'spooky sound, eerie effect' },
  { emoji: '💯', icon: Star, label: 'Hundred Points', soundPrompt: 'perfect score sound, achievement unlocked' },
  { emoji: '✔️', icon: CheckCircle2, label: 'Check Mark', soundPrompt: 'check mark sound, confirmation beep' },
];

const FloatingReactions: React.FC<FloatingReactionsProps> = ({ channelRef, onReaction }) => {
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const spawnFloatingEmoji = (emoji: string, x?: number, y?: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const emojiX = x !== undefined ? x : 20 + Math.random() * (rect.width - 40);
    const emojiY = y !== undefined ? y : 20 + Math.random() * (rect.height - 40);

    // Create more emojis for better visual effect (Facebook-style)
    const newEmojis: FloatingEmoji[] = [];
    const emojiCount = 12; // More emojis for better effect
    for (let i = 0; i < emojiCount; i++) {
      newEmojis.push({
        id: `${Date.now()}-${i}`,
        emoji,
        x: emojiX + (Math.random() - 0.5) * 150,
        y: emojiY + (Math.random() - 0.5) * 150,
        delay: i * 0.03,
        scale: 0.7 + Math.random() * 0.5,
      });
    }

    setFloatingEmojis(prev => [...prev, ...newEmojis]);

    // Remove after animation (longer for better visibility)
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => !newEmojis.find(n => n.id === e.id)));
    }, 4000);

    // Play ElevenLabs sound effect (preferred) with fallback
    const reaction = REACTION_EMOJIS.find(r => r.emoji === emoji);
    if (reaction?.soundPrompt) {
      // Try ElevenLabs first
      soundManager.generateAndPlaySFX(reaction.soundPrompt, 0.8).catch(() => {
        // Fallback to local sound if ElevenLabs fails
        soundManager.playEmojiSound(emoji, false);
      });
    } else {
      // Try ElevenLabs if mapping exists, otherwise local sound
      soundManager.playEmojiSound(emoji, true);
    }
    
    haptics.light();
  };

  const handleReaction = (emoji: string) => {
    spawnFloatingEmoji(emoji);
    
    // Broadcast to other players
    if (channelRef?.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { emoji },
      });
    }

    // Also dispatch window event for games that listen to it
    window.dispatchEvent(new CustomEvent('game-reaction', { detail: { emoji } }));

    // Call custom handler if provided
    if (onReaction) {
      onReaction(emoji);
    }
  };

  // Listen for reactions from other players
  useEffect(() => {
    if (!channelRef?.current) return;

    const handleReaction = (payload: any) => {
      if (payload?.emoji) {
        spawnFloatingEmoji(payload.emoji);
      }
    };

    // Note: This assumes the channel is already set up with broadcast listeners
    // The actual implementation depends on how each game sets up its channel
    return () => {
      // Cleanup if needed
    };
  }, [channelRef]);

  return (
    <>
      {/* Floating Emojis Container */}
      <div
        ref={containerRef}
        className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
        style={{ touchAction: 'none' }}
      >
        {floatingEmojis.map(emoji => (
          <div
            key={emoji.id}
            className="absolute text-4xl animate-float-emoji pointer-events-none"
            style={{
              left: `${emoji.x}px`,
              top: `${emoji.y}px`,
              transform: `scale(${emoji.scale})`,
              animationDelay: `${emoji.delay}s`,
            }}
          >
            {emoji.emoji}
          </div>
        ))}
      </div>

      {/* Reaction Button - Positioned above chat button */}
      <div className="fixed bottom-52 lg:bottom-32 right-4 z-50 pointer-events-auto">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              className="h-12 w-12 rounded-full bg-neon-pink/20 border-2 border-neon-pink text-neon-pink hover:bg-neon-pink/30 shadow-lg animate-float"
            >
              <Smile className="w-5 h-5 lg:w-6 lg:h-6" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            side="left"
            align="end"
            className="w-auto p-3 bg-card/95 backdrop-blur-md border-2 border-neon-cyan shadow-2xl"
          >
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {REACTION_EMOJIS.map(({ emoji, icon: Icon, label }) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 lg:h-14 lg:w-14 hover:bg-neon-cyan/20 hover:scale-110 transition-all active:scale-95 rounded-xl group relative"
                  onClick={() => handleReaction(emoji)}
                  title={label}
                >
                  <span className="text-2xl lg:text-3xl group-hover:scale-110 transition-transform">{emoji}</span>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-rajdhani opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {label}
                  </span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3 font-rajdhani">
              Click to react with sound! 🔊
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
};

export default FloatingReactions;
