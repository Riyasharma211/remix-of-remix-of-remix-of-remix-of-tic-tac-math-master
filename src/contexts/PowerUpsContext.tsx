import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { usePowerUps } from '@/hooks/usePowerUps';

interface PowerUpsContextType {
  currency: number;
  ownedPowerUps: ReturnType<typeof usePowerUps>['ownedPowerUps'];
  addCurrency: (amount: number) => void;
  buyPowerUp: (powerUpId: string) => boolean;
  usePowerUp: (powerUpId: string) => boolean;
  getOwnedQuantity: (powerUpId: string) => number;
  getAllPowerUps: () => ReturnType<typeof usePowerUps>['getAllPowerUps'] extends () => infer R ? R : never;
}

const PowerUpsContext = createContext<PowerUpsContextType | null>(null);

export const usePowerUpsContext = () => {
  const context = useContext(PowerUpsContext);
  if (!context) {
    throw new Error('usePowerUpsContext must be used within PowerUpsProvider');
  }
  return context;
};

export const PowerUpsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const powerUps = usePowerUps();

  // Listen for challenge completion to add currency
  useEffect(() => {
    const handleChallengeCompleted = (event: CustomEvent) => {
      powerUps.addCurrency(event.detail.reward);
    };

    window.addEventListener('challenge-completed', handleChallengeCompleted as EventListener);
    return () => {
      window.removeEventListener('challenge-completed', handleChallengeCompleted as EventListener);
    };
  }, [powerUps]);

  return (
    <PowerUpsContext.Provider value={powerUps}>
      {children}
    </PowerUpsContext.Provider>
  );
};
