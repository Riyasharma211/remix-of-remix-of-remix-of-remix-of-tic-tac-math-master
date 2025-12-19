import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, X, Send, Minimize2, Maximize2 } from 'lucide-react';
import { soundManager } from '@/utils/soundManager';
import { haptics } from '@/utils/haptics';

interface ChatMessage {
  id: string;
  playerName: string;
  message: string;
  timestamp: number;
  isOwn: boolean;
}

interface FloatingChatProps {
  channelRef?: React.MutableRefObject<any>;
  playerName?: string;
  roomId?: string;
}

const FloatingChat: React.FC<FloatingChatProps> = ({ channelRef, playerName = 'You', roomId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Listen for chat messages from other players
  useEffect(() => {
    if (!channelRef?.current) return;

    const handleChatMessage = (payload: any) => {
      if (payload?.type === 'chat' && payload?.message && payload?.playerName) {
        const newMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          playerName: payload.playerName,
          message: payload.message,
          timestamp: Date.now(),
          isOwn: false,
        };
        setMessages(prev => [...prev, newMessage]);
        soundManager.playLocalSound('notification');
        haptics.light();
      }
    };

    // The channel listener setup depends on how each game implements it
    // This is a generic handler that games can use
    return () => {
      // Cleanup if needed
    };
  }, [channelRef]);

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      playerName: playerName,
      message: inputMessage.trim(),
      timestamp: Date.now(),
      isOwn: true,
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');

    // Broadcast to other players
    if (channelRef?.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat',
        payload: {
          type: 'chat',
          playerName,
          message: newMessage.message,
        },
      });
    }

    // Also dispatch window event for games that listen to it
    window.dispatchEvent(new CustomEvent('game-chat', { 
      detail: { 
        playerName, 
        message: newMessage.message 
      } 
    }));

    soundManager.playLocalSound('click');
    haptics.light();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <div className="fixed bottom-20 lg:bottom-20 right-4 z-50 pointer-events-auto">
          <Button
            size="icon"
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
              haptics.light();
            }}
            className="h-12 w-12 rounded-full bg-neon-cyan/20 border-2 border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 shadow-lg animate-float"
          >
            <MessageCircle className="w-5 h-5 lg:w-6 lg:h-6" />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-neon-pink text-white text-xs flex items-center justify-center font-bold">
                {messages.length > 9 ? '9+' : messages.length}
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed right-2 lg:right-4 z-50 pointer-events-auto transition-all duration-300 ${
            isMinimized
              ? 'bottom-20 w-56 lg:w-64'
              : 'bottom-20 w-72 lg:w-80 h-80 lg:h-96'
          }`}
        >
          <div className="bg-card/95 backdrop-blur-md border-2 border-neon-cyan rounded-xl shadow-2xl flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-neon-cyan/30 bg-neon-cyan/10 rounded-t-xl">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-neon-cyan" />
                <span className="font-orbitron text-sm text-foreground">Chat</span>
                {messages.length > 0 && (
                  <span className="text-xs bg-neon-pink text-white px-2 py-0.5 rounded-full">
                    {messages.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setIsMinimized(!isMinimized);
                    haptics.light();
                  }}
                >
                  {isMinimized ? (
                    <Maximize2 className="w-3 h-3" />
                  ) : (
                    <Minimize2 className="w-3 h-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setIsOpen(false);
                    haptics.light();
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            {!isMinimized && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8 font-rajdhani">
                      No messages yet. Start chatting!
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          msg.isOwn ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 ${
                            msg.isOwn
                              ? 'bg-neon-cyan/20 border border-neon-cyan text-foreground'
                              : 'bg-muted border border-border text-foreground'
                          }`}
                        >
                          {!msg.isOwn && (
                            <div className="text-xs font-semibold text-neon-purple mb-1 font-rajdhani">
                              {msg.playerName}
                            </div>
                          )}
                          <div className="text-sm font-rajdhani break-words">{msg.message}</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 px-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-neon-cyan/30 bg-neon-cyan/5 rounded-b-xl">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      className="flex-1 text-sm font-rajdhani"
                      maxLength={200}
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!inputMessage.trim()}
                      size="icon"
                      className="bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingChat;
