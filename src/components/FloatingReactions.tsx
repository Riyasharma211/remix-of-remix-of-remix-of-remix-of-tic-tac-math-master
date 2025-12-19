import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile, Heart, Flame, ThumbsUp, HandMetal, PartyPopper, Rocket, Star } from 'lucide-react';
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
  { emoji: '😀', icon: Smile, label: 'Happy' },
  { emoji: '❤️', icon: Heart, label: 'Love' },
  { emoji: '🔥', icon: Flame, label: 'Fire' },
  { emoji: '👍', icon: ThumbsUp, label: 'Thumbs Up' },
  { emoji: '👏', icon: HandMetal, label: 'Clap' },
  { emoji: '🎉', icon: PartyPopper, label: 'Party' },
  { emoji: '🚀', icon: Rocket, label: 'Rocket' },
  { emoji: '⭐', icon: Star, label: 'Star' },
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

    const newEmojis: FloatingEmoji[] = [];
    for (let i = 0; i < 8; i++) {
      newEmojis.push({
        id: `${Date.now()}-${i}`,
        emoji,
        x: emojiX + (Math.random() - 0.5) * 100,
        y: emojiY + (Math.random() - 0.5) * 100,
        delay: i * 0.05,
        scale: 0.8 + Math.random() * 0.4,
      });
    }

    setFloatingEmojis(prev => [...prev, ...newEmojis]);

    // Remove after animation
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => !newEmojis.find(n => n.id === e.id)));
    }, 3000);

    // Play sound
    soundManager.playEmojiSound(emoji);
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

      {/* Reaction Button - Positioned to not overlap with chat */}
      <div className="fixed bottom-32 lg:bottom-20 right-4 z-50 pointer-events-auto">
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
            className="w-auto p-2 bg-card/95 backdrop-blur-md border-2 border-neon-cyan"
          >
            <div className="grid grid-cols-4 gap-2">
              {REACTION_EMOJIS.map(({ emoji, icon: Icon, label }) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 lg:h-12 lg:w-12 hover:bg-neon-cyan/20 hover:scale-110 transition-transform active:scale-95"
                  onClick={() => handleReaction(emoji)}
                  title={label}
                >
                  <span className="text-xl lg:text-2xl">{emoji}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
};

export default FloatingReactions;
