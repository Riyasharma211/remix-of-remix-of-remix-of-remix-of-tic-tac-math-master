import { useState, useEffect, useCallback } from 'react';

export interface PowerUp {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  effect: 'extra_time' | 'hint' | 'skip' | 'double_points' | 'undo';
  duration?: number; // For temporary power-ups
}

export interface OwnedPowerUp {
  powerUpId: string;
  quantity: number;
}

const POWER_UPS: PowerUp[] = [
  {
    id: 'extra_time',
    name: 'Extra Time',
    description: 'Add 30 seconds to your timer',
    icon: '⏰',
    cost: 50,
    effect: 'extra_time',
    duration: 30,
  },
  {
    id: 'hint',
    name: 'Hint',
    description: 'Get a helpful hint',
    icon: '💡',
    cost: 75,
    effect: 'hint',
  },
  {
    id: 'skip',
    name: 'Skip Question',
    description: 'Skip the current question',
    icon: '⏭️',
    cost: 100,
    effect: 'skip',
  },
  {
    id: 'double_points',
    name: 'Double Points',
    description: 'Double your score for this round',
    icon: '✨',
    cost: 150,
    effect: 'double_points',
  },
  {
    id: 'undo',
    name: 'Undo Move',
    description: 'Undo your last move',
    icon: '↩️',
    cost: 60,
    effect: 'undo',
  },
];

const POWER_UPS_STORAGE_KEY = 'mindgames-power-ups';
const CURRENCY_STORAGE_KEY = 'mindgames-currency';

export const usePowerUps = () => {
  const [ownedPowerUps, setOwnedPowerUps] = useState<OwnedPowerUp[]>([]);
  const [currency, setCurrency] = useState(0);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(POWER_UPS_STORAGE_KEY);
    const savedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY);

    if (saved) {
      try {
        setOwnedPowerUps(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse power-ups');
      }
    }

    if (savedCurrency) {
      try {
        setCurrency(parseInt(savedCurrency));
      } catch (e) {
        console.error('Failed to parse currency');
      }
    }
  }, []);

  const addCurrency = useCallback((amount: number) => {
    setCurrency(prev => {
      const newAmount = prev + amount;
      localStorage.setItem(CURRENCY_STORAGE_KEY, newAmount.toString());
      return newAmount;
    });
  }, []);

  const buyPowerUp = useCallback((powerUpId: string) => {
    const powerUp = POWER_UPS.find(p => p.id === powerUpId);
    if (!powerUp) return false;

    if (currency < powerUp.cost) {
      return false; // Not enough currency
    }

    setCurrency(prev => {
      const newAmount = prev - powerUp.cost;
      localStorage.setItem(CURRENCY_STORAGE_KEY, newAmount.toString());
      return newAmount;
    });

    setOwnedPowerUps(prev => {
      const existing = prev.find(p => p.powerUpId === powerUpId);
      const updated = existing
        ? prev.map(p => p.powerUpId === powerUpId ? { ...p, quantity: p.quantity + 1 } : p)
        : [...prev, { powerUpId, quantity: 1 }];
      localStorage.setItem(POWER_UPS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    return true;
  }, [currency]);

  const usePowerUp = useCallback((powerUpId: string) => {
    const owned = ownedPowerUps.find(p => p.powerUpId === powerUpId);
    if (!owned || owned.quantity <= 0) {
      return false; // Don't have this power-up
    }

    setOwnedPowerUps(prev => {
      const updated = prev.map(p =>
        p.powerUpId === powerUpId
          ? { ...p, quantity: Math.max(0, p.quantity - 1) }
          : p
      ).filter(p => p.quantity > 0);
      localStorage.setItem(POWER_UPS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    return true;
  }, [ownedPowerUps]);

  const getOwnedQuantity = useCallback((powerUpId: string) => {
    const owned = ownedPowerUps.find(p => p.powerUpId === powerUpId);
    return owned ? owned.quantity : 0;
  }, [ownedPowerUps]);

  const getAllPowerUps = useCallback(() => {
    return POWER_UPS;
  }, []);

  return {
    currency,
    ownedPowerUps,
    addCurrency,
    buyPowerUp,
    usePowerUp,
    getOwnedQuantity,
    getAllPowerUps,
  };
};
