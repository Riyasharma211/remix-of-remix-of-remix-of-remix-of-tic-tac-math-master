import { useEffect, useState } from 'react';

interface PendingJoin {
  code: string;
  gameType: string;
  roomId: string;
}

export const usePendingJoin = (): PendingJoin | null => {
  const [pendingJoin, setPendingJoin] = useState<PendingJoin | null>(null);

  useEffect(() => {
    const code = sessionStorage.getItem('pendingJoinCode');
    const gameType = sessionStorage.getItem('pendingJoinGameType');
    const roomId = sessionStorage.getItem('pendingJoinRoomId');

    if (code && gameType && roomId) {
      setPendingJoin({ code, gameType, roomId });
      // Clear after reading
      sessionStorage.removeItem('pendingJoinCode');
      sessionStorage.removeItem('pendingJoinGameType');
      sessionStorage.removeItem('pendingJoinRoomId');
    }
  }, []);

  return pendingJoin;
};
