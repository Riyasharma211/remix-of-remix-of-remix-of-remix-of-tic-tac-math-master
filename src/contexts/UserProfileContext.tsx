import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  level: number;
  xp: number;
  totalGames: number;
  totalWins: number;
  badges: string[];
  joinDate: number;
  lastActive: number;
}

const PROFILE_STORAGE_KEY = 'mindgames-user-profile';
const XP_PER_LEVEL = 100;
const MAX_LEVEL = 100;

const AVATARS = [
  '😀', '😎', '🤖', '🦄', '🐉', '🦁', '🐺', '🦊',
  '🐼', '🐨', '🦉', '🐸', '🦋', '🐝', '🦄', '👾',
  '🤖', '👽', '🎮', '🎯', '🏆', '⭐', '🔥', '💎',
];

const generateUserId = () => {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const getInitialProfile = (): UserProfile => {
  const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Update last active
      parsed.lastActive = Date.now();
      return parsed;
    } catch (e) {
      console.error('Failed to parse profile');
    }
  }

  // Create new profile
  const newProfile: UserProfile = {
    id: generateUserId(),
    username: `Player${Math.floor(Math.random() * 10000)}`,
    displayName: '',
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    level: 1,
    xp: 0,
    totalGames: 0,
    totalWins: 0,
    badges: [],
    joinDate: Date.now(),
    lastActive: Date.now(),
  };

  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile));
  return newProfile;
};

interface UserProfileContextType {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addXP: (amount: number) => void;
  addBadge: (badgeId: string) => void;
  levelUp: () => { leveledUp: boolean; newLevel: number };
  getXPForNextLevel: () => number;
  getXPProgress: () => number;
}

const UserProfileContext = createContext<UserProfileContextType | null>(null);

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within UserProfileProvider');
  }
  return context;
};

export const UserProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile>(getInitialProfile);

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => ({
      ...prev,
      ...updates,
      lastActive: Date.now(),
    }));
  }, []);

  const addXP = useCallback((amount: number) => {
    setProfile(prev => {
      const newXP = prev.xp + amount;
      const newLevel = Math.min(
        Math.floor(newXP / XP_PER_LEVEL) + 1,
        MAX_LEVEL
      );
      
      return {
        ...prev,
        xp: newXP,
        level: newLevel,
        lastActive: Date.now(),
      };
    });
  }, []);

  const levelUp = useCallback(() => {
    const currentLevel = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
    const newLevel = Math.min(
      Math.floor((profile.xp + 1) / XP_PER_LEVEL) + 1,
      MAX_LEVEL
    );
    
    if (newLevel > currentLevel) {
      setProfile(prev => ({
        ...prev,
        level: newLevel,
        lastActive: Date.now(),
      }));
      return { leveledUp: true, newLevel };
    }
    
    return { leveledUp: false, newLevel: currentLevel };
  }, [profile.xp]);

  const addBadge = useCallback((badgeId: string) => {
    setProfile(prev => {
      if (prev.badges.includes(badgeId)) {
        return prev; // Badge already earned
      }
      return {
        ...prev,
        badges: [...prev.badges, badgeId],
        lastActive: Date.now(),
      };
    });
  }, []);

  const getXPForNextLevel = useCallback(() => {
    const currentLevelXP = (profile.level - 1) * XP_PER_LEVEL;
    return (profile.level * XP_PER_LEVEL) - currentLevelXP;
  }, [profile.level]);

  const getXPProgress = useCallback(() => {
    const currentLevelXP = (profile.level - 1) * XP_PER_LEVEL;
    const xpInCurrentLevel = profile.xp - currentLevelXP;
    const xpNeededForNextLevel = XP_PER_LEVEL;
    return (xpInCurrentLevel / xpNeededForNextLevel) * 100;
  }, [profile.xp, profile.level]);

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        updateProfile,
        addXP,
        addBadge,
        levelUp,
        getXPForNextLevel,
        getXPProgress,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};
