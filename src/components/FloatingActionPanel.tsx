import React, { useState, useRef, useEffect, useCallback } from 'react';
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

const FAB_SIZE = 56;
const EDGE_MARGIN = 16;
const SNAP_THRESHOLD = 0.5;
const MAGNETIC_ZONE = 80; // Pixels from edge where magnetic effect kicks in
const MAGNETIC_STRENGTH = 0.4; // How strong the pull is (0-1)

// Get safe area insets
const getSafeAreaInsets = () => {
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('--sat') || '0', 10) || 0,
    right: parseInt(style.getPropertyValue('--sar') || '0', 10) || 0,
    bottom: parseInt(style.getPropertyValue('--sab') || '0', 10) || 0,
    left: parseInt(style.getPropertyValue('--sal') || '0', 10) || 0,
  };
};

// Calculate magnetic pull factor (0 = no pull, 1 = full pull to edge)
const getMagneticPull = (pos: number, edgePos: number, isNearEdge: boolean): number => {
  if (!isNearEdge) return 0;
  const distance = Math.abs(pos - edgePos);
  if (distance > MAGNETIC_ZONE) return 0;
  // Exponential curve for smoother feel
  const normalizedDistance = distance / MAGNETIC_ZONE;
  return Math.pow(1 - normalizedDistance, 2) * MAGNETIC_STRENGTH;
};

const FloatingActionPanel: React.FC<FloatingActionPanelProps> = ({
  channelRef,
  playerName,
  roomId,
  onJoinGame,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: EDGE_MARGIN, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [magneticEdge, setMagneticEdge] = useState<'left' | 'right' | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const lastHapticRef = useRef<number>(0);

  // Initialize position with safe area consideration
  useEffect(() => {
    const insets = getSafeAreaInsets();
    const defaultY = window.innerHeight - FAB_SIZE - EDGE_MARGIN - Math.max(insets.bottom, 20);
    
    const saved = localStorage.getItem('fab-position');
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        // Validate saved position is still within bounds
        const maxX = window.innerWidth - FAB_SIZE - EDGE_MARGIN - insets.right;
        const maxY = window.innerHeight - FAB_SIZE - EDGE_MARGIN - Math.max(insets.bottom, 20);
        const minX = EDGE_MARGIN + insets.left;
        const minY = EDGE_MARGIN + Math.max(insets.top, 20);
        
        setPosition({
          x: Math.max(minX, Math.min(maxX, pos.x)),
          y: Math.max(minY, Math.min(maxY, pos.y)),
        });
        return;
      } catch {}
    }
    
    setPosition({ x: EDGE_MARGIN + insets.left, y: defaultY });
  }, []);

  // Save position after snapping
  useEffect(() => {
    if (!isDragging && !isSnapping) {
      localStorage.setItem('fab-position', JSON.stringify(position));
    }
  }, [position, isDragging, isSnapping]);

  // Snap to nearest edge
  const snapToEdge = useCallback((x: number, y: number) => {
    const insets = getSafeAreaInsets();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    const minX = EDGE_MARGIN + insets.left;
    const maxX = screenWidth - FAB_SIZE - EDGE_MARGIN - insets.right;
    const minY = EDGE_MARGIN + Math.max(insets.top, 20);
    const maxY = screenHeight - FAB_SIZE - EDGE_MARGIN - Math.max(insets.bottom, 20);
    
    // Determine horizontal snap (left or right edge)
    const centerX = x + FAB_SIZE / 2;
    const snapX = centerX < screenWidth * SNAP_THRESHOLD ? minX : maxX;
    
    // Clamp Y within safe bounds
    const clampedY = Math.max(minY, Math.min(maxY, y));
    
    return { x: snapX, y: clampedY };
  }, []);

  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setIsSnapping(false);
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
    haptics.light();
  };

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !dragRef.current) return;

    const insets = getSafeAreaInsets();
    const screenWidth = window.innerWidth;
    const deltaX = clientX - dragRef.current.startX;
    const deltaY = clientY - dragRef.current.startY;
    
    const minX = EDGE_MARGIN + insets.left;
    const maxX = screenWidth - FAB_SIZE - EDGE_MARGIN - insets.right;
    const minY = EDGE_MARGIN + Math.max(insets.top, 20);
    const maxY = window.innerHeight - FAB_SIZE - EDGE_MARGIN - Math.max(insets.bottom, 20);
    
    let rawX = dragRef.current.startPosX + deltaX;
    const rawY = dragRef.current.startPosY + deltaY;
    
    // Calculate distance to edges
    const distToLeft = rawX - minX;
    const distToRight = maxX - rawX;
    
    // Apply magnetic pull
    const leftPull = getMagneticPull(rawX, minX, distToLeft < MAGNETIC_ZONE);
    const rightPull = getMagneticPull(rawX, maxX, distToRight < MAGNETIC_ZONE);
    
    // Determine which edge is magnetic
    let newMagneticEdge: 'left' | 'right' | null = null;
    if (leftPull > 0) {
      rawX = rawX - (rawX - minX) * leftPull;
      newMagneticEdge = 'left';
    } else if (rightPull > 0) {
      rawX = rawX + (maxX - rawX) * rightPull;
      newMagneticEdge = 'right';
    }
    
    // Trigger haptic when entering magnetic zone
    if (newMagneticEdge !== magneticEdge) {
      const now = Date.now();
      if (newMagneticEdge && now - lastHapticRef.current > 100) {
        haptics.light();
        lastHapticRef.current = now;
      }
      setMagneticEdge(newMagneticEdge);
    }
    
    const newX = Math.max(minX, Math.min(maxX, rawX));
    const newY = Math.max(minY, Math.min(maxY, rawY));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging, magneticEdge]);

  const handleEnd = useCallback(() => {
    if (isDragging && dragRef.current) {
      const deltaX = Math.abs(position.x - dragRef.current.startPosX);
      const deltaY = Math.abs(position.y - dragRef.current.startPosY);
      
      // Only toggle if it wasn't a significant drag
      if (deltaX < 5 && deltaY < 5) {
        setIsExpanded(!isExpanded);
        haptics.medium();
      } else {
        // Snap to edge with animation
        setIsSnapping(true);
        const snappedPos = snapToEdge(position.x, position.y);
        setPosition(snappedPos);
        haptics.medium(); // Stronger haptic on snap
        
        // Clear snapping state after animation
        setTimeout(() => setIsSnapping(false), 300);
      }
    }
    setIsDragging(false);
    setMagneticEdge(null);
    dragRef.current = null;
  }, [isDragging, position, isExpanded, snapToEdge]);

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
  }, [isDragging, handleMove, handleEnd]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const snappedPos = snapToEdge(position.x, position.y);
      setPosition(snappedPos);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, snapToEdge]);

  // Determine if FAB is on left or right side for panel positioning
  const isOnLeftSide = position.x < window.innerWidth / 2;

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
          transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          // Respect safe areas via env()
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Main FAB Button */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={`w-14 h-14 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-150 ${
            isDragging ? 'scale-110' : 'hover:scale-105'
          } ${isExpanded ? 'rotate-45' : ''}`}
          style={{
            boxShadow: magneticEdge
              ? `0 0 30px hsl(var(--neon-cyan) / 0.8), 0 0 60px hsl(var(--neon-purple) / 0.5), 0 0 80px hsl(var(--neon-cyan) / 0.3)`
              : isDragging
                ? '0 10px 40px hsl(var(--neon-cyan) / 0.5)'
                : '0 4px 20px hsl(var(--neon-cyan) / 0.3)',
          }}
        >
          {isExpanded ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Gamepad2 className="w-6 h-6 text-white" />
          )}
        </div>

        {/* Magnetic zone indicator */}
        {magneticEdge && isDragging && (
          <div 
            className="absolute inset-0 rounded-full animate-pulse pointer-events-none"
            style={{
              boxShadow: `0 0 20px hsl(var(--neon-cyan) / 0.6), inset 0 0 15px hsl(var(--neon-cyan) / 0.3)`,
              border: '2px solid hsl(var(--neon-cyan) / 0.8)',
            }}
          />
        )}

        {/* Expanded Panel - positioned based on which side FAB is on */}
        {isExpanded && (
          <div
            className={`absolute w-72 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl shadow-black/20 animate-scale-in overflow-hidden ${
              isOnLeftSide ? 'left-0' : 'right-0'
            }`}
            style={{
              bottom: FAB_SIZE + 12,
              maxHeight: `calc(100vh - ${position.y + FAB_SIZE + 40}px - env(safe-area-inset-top, 20px))`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="flex items-center justify-center py-2 border-b border-border/30 bg-muted/30">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: '50vh' }}>
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
