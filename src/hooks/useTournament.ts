import { useState, useEffect, useCallback } from 'react';

export interface Tournament {
  id: string;
  name: string;
  gameType: string;
  startDate: number;
  endDate: number;
  status: 'upcoming' | 'active' | 'ended';
  participants: number;
  maxParticipants: number;
  prize: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface TournamentEntry {
  id: string;
  tournamentId: string;
  playerName: string;
  score: number;
  rank: number;
  gamesPlayed: number;
  wins: number;
  joinedAt: number;
}

const TOURNAMENTS_STORAGE_KEY = 'mindgames-tournaments';
const TOURNAMENT_ENTRIES_KEY = 'mindgames-tournament-entries';

const generateWeeklyTournament = (): Tournament => {
  const now = Date.now();
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const gameTypes = ['tictactoe', 'mathbattle', 'drawing', 'wordchain', 'quizbattle'];
  const weekNumber = Math.floor(now / (7 * 24 * 60 * 60 * 1000));
  const gameType = gameTypes[weekNumber % gameTypes.length];

  const tiers: Tournament['tier'][] = ['bronze', 'silver', 'gold', 'platinum'];
  const tier = tiers[Math.floor(weekNumber / 4) % tiers.length];

  return {
    id: `tournament-${weekNumber}`,
    name: `${gameType.charAt(0).toUpperCase() + gameType.slice(1)} Championship`,
    gameType,
    startDate: weekStart.getTime(),
    endDate: weekEnd.getTime(),
    status: now < weekStart.getTime() ? 'upcoming' : now > weekEnd.getTime() ? 'ended' : 'active',
    participants: 0,
    maxParticipants: 100,
    prize: tier === 'platinum' ? '🏆 Legendary Badge' : tier === 'gold' ? '🥇 Gold Badge' : tier === 'silver' ? '🥈 Silver Badge' : '🥉 Bronze Badge',
    tier,
  };
};

export const useTournament = () => {
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [myEntry, setMyEntry] = useState<TournamentEntry | null>(null);
  const [leaderboard, setLeaderboard] = useState<TournamentEntry[]>([]);

  // Initialize tournament
  useEffect(() => {
    const tournament = generateWeeklyTournament();
    setCurrentTournament(tournament);

    // Load my entry
    const savedEntries = localStorage.getItem(TOURNAMENT_ENTRIES_KEY);
    if (savedEntries) {
      try {
        const entries: TournamentEntry[] = JSON.parse(savedEntries);
        const myTournamentEntry = entries.find(e => e.tournamentId === tournament.id);
        if (myTournamentEntry) {
          setMyEntry(myTournamentEntry);
        }

        // Load leaderboard for this tournament
        const tournamentEntries = entries
          .filter(e => e.tournamentId === tournament.id)
          .sort((a, b) => b.score - a.score)
          .map((entry, index) => ({ ...entry, rank: index + 1 }));
        setLeaderboard(tournamentEntries);
      } catch (e) {
        console.error('Failed to parse tournament entries');
      }
    }
  }, []);

  const joinTournament = useCallback((playerName: string) => {
    if (!currentTournament) return;

    const entry: TournamentEntry = {
      id: `entry-${Date.now()}`,
      tournamentId: currentTournament.id,
      playerName,
      score: 0,
      rank: 0,
      gamesPlayed: 0,
      wins: 0,
      joinedAt: Date.now(),
    };

    setMyEntry(entry);

    // Save to localStorage
    const savedEntries = localStorage.getItem(TOURNAMENT_ENTRIES_KEY);
    const entries: TournamentEntry[] = savedEntries ? JSON.parse(savedEntries) : [];
    entries.push(entry);
    localStorage.setItem(TOURNAMENT_ENTRIES_KEY, JSON.stringify(entries));

    // Update tournament participants
    setCurrentTournament(prev => prev ? {
      ...prev,
      participants: prev.participants + 1,
    } : null);
  }, [currentTournament]);

  const updateTournamentScore = useCallback((
    gameType: string,
    score: number,
    result: 'win' | 'loss' | 'draw'
  ) => {
    if (!currentTournament || !myEntry || currentTournament.gameType !== gameType) return;

    const newScore = myEntry.score + score;
    const newGamesPlayed = myEntry.gamesPlayed + 1;
    const newWins = myEntry.wins + (result === 'win' ? 1 : 0);

    const updatedEntry: TournamentEntry = {
      ...myEntry,
      score: newScore,
      gamesPlayed: newGamesPlayed,
      wins: newWins,
    };

    setMyEntry(updatedEntry);

    // Update in localStorage
    const savedEntries = localStorage.getItem(TOURNAMENT_ENTRIES_KEY);
    if (savedEntries) {
      try {
        const entries: TournamentEntry[] = JSON.parse(savedEntries);
        const updated = entries.map(e =>
          e.id === myEntry.id ? updatedEntry : e
        );
        localStorage.setItem(TOURNAMENT_ENTRIES_KEY, JSON.stringify(updated));

        // Update leaderboard
        const tournamentEntries = updated
          .filter(e => e.tournamentId === currentTournament.id)
          .sort((a, b) => b.score - a.score)
          .map((entry, index) => ({ ...entry, rank: index + 1 }));
        setLeaderboard(tournamentEntries);
      } catch (e) {
        console.error('Failed to update tournament entry');
      }
    }
  }, [currentTournament, myEntry]);

  const getMyRank = useCallback(() => {
    if (!myEntry) return null;
    return leaderboard.findIndex(e => e.id === myEntry.id) + 1;
  }, [myEntry, leaderboard]);

  const getTopPlayers = useCallback((limit: number = 10) => {
    return leaderboard.slice(0, limit);
  }, [leaderboard]);

  return {
    currentTournament,
    myEntry,
    leaderboard,
    joinTournament,
    updateTournamentScore,
    getMyRank,
    getTopPlayers,
  };
};
