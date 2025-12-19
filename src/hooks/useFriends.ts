import { useState, useEffect, useCallback } from 'react';

export interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  isOnline: boolean;
  lastSeen: number;
  level: number;
  totalWins: number;
  totalGames: number;
}

const FRIENDS_STORAGE_KEY = 'mindgames-friends';
const FRIEND_REQUESTS_KEY = 'mindgames-friend-requests';

export const useFriends = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<Array<{ id: string; username: string; sentAt: number }>>([]);

  // Load friends from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(FRIENDS_STORAGE_KEY);
    const savedRequests = localStorage.getItem(FRIEND_REQUESTS_KEY);

    if (saved) {
      try {
        setFriends(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse friends');
      }
    }

    if (savedRequests) {
      try {
        setFriendRequests(JSON.parse(savedRequests));
      } catch (e) {
        console.error('Failed to parse friend requests');
      }
    }
  }, []);

  const addFriend = useCallback((friend: Friend) => {
    setFriends(prev => {
      // Check if friend already exists
      if (prev.find(f => f.id === friend.id)) {
        return prev;
      }
      const updated = [...prev, friend];
      localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFriend = useCallback((friendId: string) => {
    setFriends(prev => {
      const updated = prev.filter(f => f.id !== friendId);
      localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const sendFriendRequest = useCallback((username: string) => {
    const request = {
      id: `${Date.now()}-${Math.random()}`,
      username,
      sentAt: Date.now(),
    };
    setFriendRequests(prev => {
      const updated = [...prev, request];
      localStorage.setItem(FRIEND_REQUESTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const acceptFriendRequest = useCallback((requestId: string, friend: Friend) => {
    setFriendRequests(prev => {
      const updated = prev.filter(r => r.id !== requestId);
      localStorage.setItem(FRIEND_REQUESTS_KEY, JSON.stringify(updated));
      return updated;
    });
    addFriend(friend);
  }, [addFriend]);

  const rejectFriendRequest = useCallback((requestId: string) => {
    setFriendRequests(prev => {
      const updated = prev.filter(r => r.id !== requestId);
      localStorage.setItem(FRIEND_REQUESTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateFriendStatus = useCallback((friendId: string, updates: Partial<Friend>) => {
    setFriends(prev => {
      const updated = prev.map(f =>
        f.id === friendId ? { ...f, ...updates } : f
      );
      localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getOnlineFriends = useCallback(() => {
    return friends.filter(f => f.isOnline);
  }, [friends]);

  return {
    friends,
    friendRequests,
    addFriend,
    removeFriend,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    updateFriendStatus,
    getOnlineFriends,
  };
};
