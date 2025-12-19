import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { checkSupabaseConfig } from '@/utils/supabaseHelpers';
import { Gamepad2, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';

interface UniversalGameCodeInputProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinGame: (gameType: string, roomCode: string) => void;
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

const UniversalGameCodeInput: React.FC<UniversalGameCodeInputProps> = ({ isOpen, onClose, onJoinGame }) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      // Search for room by code (without game_type filter to find any game)
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
        description: `Switching to ${data.game_type} game...` 
      });

      // Close dialog and trigger game join
      setCode('');
      onClose();
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
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-neon-cyan" />
            Join Any Game
          </DialogTitle>
          <DialogDescription>
            Enter a room code to automatically join that game. Works with all multiplayer games!
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Room Code</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Enter room code (e.g., ABCD)"
              className="text-center text-2xl font-orbitron tracking-widest uppercase"
              maxLength={8}
              autoFocus
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground text-center">
              Works with Tic Tac Toe, Drawing, Math Battle, and all multiplayer games
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleJoin}
              disabled={!code.trim() || isLoading}
              className="flex-1 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <Gamepad2 className="w-4 h-4 mr-2" />
                  Join Game
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UniversalGameCodeInput;
