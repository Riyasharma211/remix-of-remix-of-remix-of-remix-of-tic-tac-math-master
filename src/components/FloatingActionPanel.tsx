import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Gamepad2, X, GripVertical } from 'lucide-react';
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
  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Load saved position
  useEffect(() => {
    const saved = localStorage.getItem('fab-position');
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        setPosition(pos);
      } catch {}
    }
  }, []);

  // Save position
  useEffect(() => {
    if (!isDragging) {
      localStorage.setItem('fab-position', JSON.stringify(position));
    }
  }, [position, isDragging]);

  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
    haptics.light();
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !dragRef.current) return;

    const deltaX = clientX - dragRef.current.startX;
    const deltaY = clientY - dragRef.current.startY;
    
    const newX = Math.max(10, Math.min(window.innerWidth - 70, dragRef.current.startPosX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - 70, dragRef.current.startPosY + deltaY));
    
    setPosition({ x: newX, y: newY });
  };

  const handleEnd = () => {
    if (isDragging && dragRef.current) {
      const deltaX = Math.abs(position.x - dragRef.current.startPosX);
      const deltaY = Math.abs(position.y - dragRef.current.startPosY);
      
      // Only toggle if it wasn't a significant drag
      if (deltaX < 5 && deltaY < 5) {
        setIsExpanded(!isExpanded);
        haptics.medium();
      }
    }
    setIsDragging(false);
    dragRef.current = null;
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };
    const handleMouseUp = () => handleEnd();
    const handleTouchEnd = () => handleEnd();

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, position]);

  return (
    <>
      <FloatingReactions channelRef={channelRef} />

      {/* Draggable FAB */}
      <div
        ref={buttonRef}
        className="fixed z-50 touch-none select-none"
        style={{
          left: position.x,
          top: position.y,
          transition: isDragging ? 'none' : 'all 0.2s ease-out',
        }}
      >
        {/* Main FAB Button */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={`w-14 h-14 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple shadow-lg shadow-neon-cyan/30 flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform ${
            isDragging ? 'scale-110' : 'hover:scale-105'
          } ${isExpanded ? 'rotate-45' : ''}`}
        >
          {isExpanded ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Gamepad2 className="w-6 h-6 text-white" />
          )}
        </div>

        {/* Expanded Panel */}
        {isExpanded && (
          <div
            className="absolute bottom-16 left-1/2 -translate-x-1/2 w-72 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl shadow-black/20 animate-scale-in overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="flex items-center justify-center py-2 border-b border-border/30 cursor-move bg-muted/30">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Chat Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                  <Gamepad2 className="w-4 h-4" />
                  <span>Join Game</span>
                </div>
                <GlobalGameCodeInput onJoinGame={onJoinGame} compact={true} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default FloatingActionPanel;
