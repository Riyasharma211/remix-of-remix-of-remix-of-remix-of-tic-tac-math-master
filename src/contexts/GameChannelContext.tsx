import React, { createContext, useContext, useState, ReactNode } from 'react';

interface GameChannelContextType {
  channelRef: React.MutableRefObject<any> | null;
  setChannelRef: (ref: React.MutableRefObject<any> | null) => void;
  playerName: string;
  setPlayerName: (name: string) => void;
  roomId: string | null;
  setRoomId: (id: string | null) => void;
}

const GameChannelContext = createContext<GameChannelContextType | null>(null);

export const useGameChannel = () => {
  const context = useContext(GameChannelContext);
  if (!context) {
    return {
      channelRef: null,
      setChannelRef: () => {},
      playerName: '',
      setPlayerName: () => {},
      roomId: null,
      setRoomId: () => {},
    };
  }
  return context;
};

export const GameChannelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [channelRef, setChannelRefState] = useState<React.MutableRefObject<any> | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);

  const setChannelRef = (ref: React.MutableRefObject<any> | null) => {
    setChannelRefState(ref);
  };

  return (
    <GameChannelContext.Provider
      value={{
        channelRef,
        setChannelRef,
        playerName,
        setPlayerName,
        roomId,
        setRoomId,
      }}
    >
      {children}
    </GameChannelContext.Provider>
  );
};
