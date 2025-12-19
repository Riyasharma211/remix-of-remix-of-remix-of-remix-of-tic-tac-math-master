import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { checkSupabaseConfig } from '@/utils/supabaseHelpers';
import { Gamepad2, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';

interface GlobalGameCodeInputProps {
  onJoinGame: (gameType: string, roomCode: string) => void;
  compact?: boolean;
}

// Map game_type from database to GameType
const GAME_TYPE_MAP: Record<string, string> = {
  'tictactoe': 'tictactoe',
  'mathbattle': 'mathbattle',
  'drawing': 'drawing',
  'truthordare': 'truthordare',
  'wordchain': 'wordchain',
  'quizbattle': 'quizbattle',
  'rps': 'rps',
  'connect4': 'connect4',
  'hangman': 'hangman',
  'speedmath': 'speedmath',
};

const GlobalGameCodeInput: React.FC<GlobalGameCodeInputProps> = ({ onJoinGame, compact = false }) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a room code' });
      return;
    }

    if (!checkSupabaseConfig()) {
      return;
    }

    setIsLoading(true);
    haptics.light();

    try {
      // Search for room by code
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', code.toUpperCase().trim())
        .single();

      if (error || !data) {
        toast({ 
          variant: 'destructive', 
          title: 'Room Not Found', 
          description: 'No game found with this code. Please check and try again.' 
        });
        soundManager.playLocalSound('wrong');
        haptics.error();
        setIsLoading(false);
        return;
      }

      // Check if room is full
      if (data.player_count >= (data.max_players || 2)) {
        toast({ 
          variant: 'destructive', 
          title: 'Room Full', 
          description: 'This room is already full. Try another code.' 
        });
        soundManager.playLocalSound('wrong');
        haptics.error();
        setIsLoading(false);
        return;
      }

      // Check if room is ended
      if (data.status === 'ended') {
        toast({ 
          variant: 'destructive', 
          title: 'Game Ended', 
          description: 'This game has already ended. Please join a new game.' 
        });
        soundManager.playLocalSound('wrong');
        haptics.error();
        setIsLoading(false);
        return;
      }

      // Map game_type to our GameType
      const gameType = GAME_TYPE_MAP[data.game_type] || data.game_type;

      if (!gameType) {
        toast({ 
          variant: 'destructive', 
          title: 'Unknown Game', 
          description: 'This game type is not supported.' 
        });
        setIsLoading(false);
        return;
      }

      // Store join info in sessionStorage for the game to pick up
      sessionStorage.setItem('pendingJoinCode', code.toUpperCase().trim());
      sessionStorage.setItem('pendingJoinGameType', gameType);
      sessionStorage.setItem('pendingJoinRoomId', data.id);

      // Success - join the game
      soundManager.playLocalSound('correct');
      haptics.success();
      toast({ 
        title: 'Room Found!', 
        description: `Joining ${data.game_type} game...` 
      });

      // Clear input and trigger game join
      setCode('');
      setIsExpanded(false);
      onJoinGame(gameType, code.toUpperCase().trim());

    } catch (error) {
      console.error('Error joining room:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: 'Failed to join room. Please try again.' 
      });
      soundManager.playLocalSound('wrong');
      haptics.error();
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && code.trim()) {
      handleJoin();
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
      setCode('');
    }
  };

  // Auto-focus when expanded
  useEffect(() => {
    if (isExpanded) {
      const input = document.getElementById('global-game-code-input');
      setTimeout(() => input?.focus(), 100);
    }
  }, [isExpanded]);

  // Compact mode - for use in slideable panel
  if (compact) {
    return (
      <div className="space-y-2">
        {!isExpanded ? (
          <Button
            onClick={() => setIsExpanded(true)}
            className="w-full bg-neon-purple/20 border border-neon-purple text-neon-purple hover:bg-neon-purple/30"
            size="sm"
          >
            <Gamepad2 className="w-4 h-4 mr-2" />
            <span className="font-orbitron text-xs">Join Game</span>
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                id="global-game-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                placeholder="Enter code..."
                className="text-center text-xs font-orbitron tracking-widest uppercase flex-1"
                maxLength={8}
                disabled={isLoading}
                autoFocus
              />
              <Button
                onClick={handleJoin}
                disabled={!code.trim() || isLoading}
                className="bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 px-2"
                size="sm"
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span className="font-orbitron text-xs">Join</span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setIsExpanded(false);
                  setCode('');
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full mode - floating button
  return (
    <div className="fixed bottom-24 lg:bottom-4 right-4 z-40 pointer-events-auto">
      {!isExpanded ? (
        // Collapsed state - compact icon button
        <Button
          onClick={() => setIsExpanded(true)}
          className="h-12 w-12 rounded-full bg-neon-purple/20 border-2 border-neon-purple text-neon-purple hover:bg-neon-purple/30 shadow-lg backdrop-blur-sm p-0"
          size="icon"
          title="Join Game by Code"
        >
          <Gamepad2 className="w-5 h-5" />
        </Button>
      ) : (
        // Expanded state - input box (positioned above the button)
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-card/95 backdrop-blur-md border-2 border-neon-cyan rounded-xl p-3 shadow-2xl animate-slide-in">
          <div className="flex items-center gap-2 mb-3">
            <Gamepad2 className="w-4 h-4 text-neon-cyan" />
            <h3 className="font-orbitron text-xs text-foreground">Join Any Game</h3>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-5 w-5"
              onClick={() => {
                setIsExpanded(false);
                setCode('');
              }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Input
              id="global-game-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Enter code..."
              className="text-center text-sm font-orbitron tracking-widest uppercase flex-1"
              maxLength={8}
              disabled={isLoading}
              autoFocus
            />
            <Button
              onClick={handleJoin}
              disabled={!code.trim() || isLoading}
              className="bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 px-3"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="font-orbitron text-xs">Join</span>
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2 font-rajdhani">
            Press Enter to join
          </p>
        </div>
      )}
    </div>
  );
};

export default GlobalGameCodeInput;
