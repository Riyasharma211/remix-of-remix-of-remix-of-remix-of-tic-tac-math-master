import React, { createContext, useContext, useState, useCallback } from 'react';

interface ActiveGameContextType {
  isGameActive: boolean;
  setGameActive: (active: boolean) => void;
  activeGameName: string;
  setActiveGameName: (name: string) => void;
}

const ActiveGameContext = createContext<ActiveGameContextType | null>(null);

export const useActiveGame = () => {
  const context = useContext(ActiveGameContext);
  if (!context) {
    throw new Error('useActiveGame must be used within ActiveGameProvider');
  }
  return context;
};

export const ActiveGameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isGameActive, setIsGameActive] = useState(false);
  const [activeGameName, setActiveGameName] = useState('');

  const setGameActive = useCallback((active: boolean) => {
    setIsGameActive(active);
  }, []);

  return (
    <ActiveGameContext.Provider value={{ isGameActive, setGameActive, activeGameName, setActiveGameName }}>
      {children}
    </ActiveGameContext.Provider>
  );
};
