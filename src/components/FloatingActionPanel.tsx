import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Gamepad2, ChevronLeft, ChevronRight } from 'lucide-react';
import { haptics } from '@/utils/haptics';
import FloatingReactions from './FloatingReactions';
import FloatingChat from './FloatingChat';
import GlobalGameCodeInput from './GlobalGameCodeInput';

interface FloatingActionPanelProps {
  channelRef?: React.MutableRefObject<any>;
  playerName?: string;
  roomId?: string;
  onJoinGame: (gameType: string, roomCode: string) => void;
}

const FloatingActionPanel: React.FC<FloatingActionPanelProps> = ({
  channelRef,
  playerName,
  roomId,
  onJoinGame,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Floating Reactions - Always visible for emoji animations */}
      <FloatingReactions channelRef={channelRef} />

      {/* Slideable Panel */}
      <div
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 transition-all duration-300 ease-in-out ${
          isExpanded ? 'translate-x-0' : 'translate-x-[calc(100%-3rem)]'
        }`}
      >
        <div className="relative">
          {/* Toggle Button */}
          <Button
            onClick={() => {
              setIsExpanded(!isExpanded);
              haptics.light();
            }}
            className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full h-14 w-14 rounded-l-full rounded-r-none bg-card/95 backdrop-blur-md border-2 border-r-0 border-neon-cyan shadow-lg z-10 hover:bg-neon-cyan/20 transition-all ${
              isExpanded ? 'bg-neon-cyan/20' : ''
            }`}
            size="icon"
          >
            {isExpanded ? (
              <ChevronRight className="w-6 h-6 text-neon-cyan" />
            ) : (
              <ChevronLeft className="w-6 h-6 text-neon-cyan" />
            )}
          </Button>

          {/* Panel Content */}
          <div
            className={`bg-card/95 backdrop-blur-md border-2 border-neon-cyan rounded-l-2xl shadow-2xl transition-all duration-300 overflow-hidden ${
              isExpanded ? 'w-80 opacity-100' : 'w-0 opacity-0'
            }`}
          >
            {isExpanded && (
              <div className="p-4 space-y-4 min-h-[400px]">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-neon-cyan/30">
                  <h3 className="font-orbitron text-base text-neon-cyan">Quick Actions</h3>
                </div>

                {/* Chat Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-rajdhani mb-2">
                    <MessageCircle className="w-4 h-4" />
                    <span>Chat</span>
                  </div>
                  <FloatingChat
                    channelRef={channelRef}
                    playerName={playerName}
                    roomId={roomId}
                    compact={true}
                  />
                </div>

                {/* Join Game Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-rajdhani mb-2">
                    <Gamepad2 className="w-4 h-4" />
                    <span>Join Game</span>
                  </div>
                  <GlobalGameCodeInput onJoinGame={onJoinGame} compact={true} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default FloatingActionPanel;
