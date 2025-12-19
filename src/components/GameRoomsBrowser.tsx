import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { checkSupabaseConfig } from '@/utils/supabaseHelpers';
import { Wifi, WifiOff, Users, Clock, Loader2, X, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';

interface GameRoom {
  id: string;
  room_code: string;
  game_type: string;
  status: string;
  player_count: number;
  max_players: number;
  created_at: string;
}

interface GameRoomsBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (gameType: string, roomCode: string) => void;
}

const GAME_TYPE_NAMES: Record<string, string> = {
  'tictactoe': 'Tic Tac Toe',
  'mathbattle': 'Math Battle',
  'drawing': 'Drawing Game',
  'truthordare': 'Truth or Dare',
  'wordchain': 'Word Chain',
  'quizbattle': 'Quiz Battle',
  'rps': 'Rock Paper Scissors',
  'connect4': 'Connect Four',
  'hangman': 'Hangman Battle',
  'speedmath': 'Speed Math Duel',
};

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

const GameRoomsBrowser: React.FC<GameRoomsBrowserProps> = ({ isOpen, onClose, onJoinRoom }) => {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchRooms = async () => {
    if (!checkSupabaseConfig()) {
      return;
    }

    setIsLoading(true);
    try {
      let query = supabase
        .from('game_rooms')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(50);

      if (selectedGameType) {
        query = query.eq('game_type', selectedGameType);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRooms((data || []) as GameRoom[]);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load game rooms',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
      
      if (autoRefresh) {
        const interval = setInterval(fetchRooms, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
      }
    }
  }, [isOpen, selectedGameType, autoRefresh]);

  const handleJoinRoom = (room: GameRoom) => {
    const gameType = GAME_TYPE_MAP[room.game_type] || room.game_type;
    
    if (!gameType) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Unknown game type',
      });
      return;
    }

    // Store join info
    sessionStorage.setItem('pendingJoinCode', room.room_code);
    sessionStorage.setItem('pendingJoinGameType', gameType);
    sessionStorage.setItem('pendingJoinRoomId', room.id);

    soundManager.playLocalSound('correct');
    haptics.success();
    toast({
      title: 'Joining room...',
      description: `Connecting to ${GAME_TYPE_NAMES[room.game_type] || room.game_type}`,
    });

    onClose();
    onJoinRoom(gameType, room.room_code);
  };

  const getStatusColor = (status: string, playerCount: number, maxPlayers: number) => {
    if (status === 'ended') return 'bg-muted text-muted-foreground';
    if (playerCount >= maxPlayers) return 'bg-destructive/20 text-destructive';
    if (status === 'playing') return 'bg-neon-green/20 text-neon-green';
    return 'bg-neon-cyan/20 text-neon-cyan';
  };

  const gameTypes = Array.from(new Set(rooms.map(r => r.game_type)));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-neon-cyan" />
                Browse Game Rooms
              </DialogTitle>
              <DialogDescription>
                Join active multiplayer games instantly
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchRooms}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Filters */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide pb-2">
            <button
              onClick={() => {
                setSelectedGameType(null);
                haptics.light();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-orbitron whitespace-nowrap transition-all ${
                !selectedGameType
                  ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan'
                  : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
              }`}
            >
              All Games
            </button>
            {gameTypes.map(type => (
              <button
                key={type}
                onClick={() => {
                  setSelectedGameType(type);
                  haptics.light();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-orbitron whitespace-nowrap transition-all ${
                  selectedGameType === type
                    ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple'
                    : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                }`}
              >
                {GAME_TYPE_NAMES[type] || type}
              </button>
            ))}
          </div>

          {/* Rooms List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {isLoading && rooms.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-neon-cyan" />
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-12">
                <WifiOff className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-rajdhani">No active rooms</p>
                <p className="text-sm text-muted-foreground/60 font-rajdhani mt-1">
                  Create a room to start playing!
                </p>
              </div>
            ) : (
              rooms.map(room => {
                const isFull = room.player_count >= room.max_players;
                const isPlaying = room.status === 'playing';
                const canJoin = !isFull && room.status === 'waiting';

                return (
                  <div
                    key={room.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      canJoin
                        ? 'bg-card/50 border-border hover:border-neon-cyan/50 cursor-pointer'
                        : 'bg-muted/30 border-border/50 opacity-60'
                    }`}
                    onClick={() => canJoin && handleJoinRoom(room)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-orbitron text-base text-foreground">
                            {GAME_TYPE_NAMES[room.game_type] || room.game_type}
                          </h3>
                          <Badge
                            variant="outline"
                            className={getStatusColor(room.status, room.player_count, room.max_players)}
                          >
                            {room.status === 'waiting' ? 'Waiting' : room.status === 'playing' ? 'Playing' : 'Ended'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground font-rajdhani">
                          <div className="flex items-center gap-1">
                            <span className="font-orbitron text-neon-cyan">{room.room_code}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>
                              {room.player_count}/{room.max_players}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>
                              {new Date(room.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      {canJoin && (
                        <Button
                          size="sm"
                          className="ml-4 bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJoinRoom(room);
                          }}
                        >
                          Join
                        </Button>
                      )}
                      {isFull && (
                        <Badge variant="outline" className="ml-4 bg-destructive/20 text-destructive border-destructive">
                          Full
                        </Badge>
                      )}
                      {isPlaying && (
                        <Badge variant="outline" className="ml-4 bg-muted text-muted-foreground">
                          In Progress
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-rajdhani">
              <span>{rooms.length} room{rooms.length !== 1 ? 's' : ''} available</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground font-rajdhani flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => {
                    setAutoRefresh(e.target.checked);
                    haptics.light();
                  }}
                  className="rounded"
                />
                Auto-refresh
              </label>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GameRoomsBrowser;
